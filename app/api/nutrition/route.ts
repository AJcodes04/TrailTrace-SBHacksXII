import { NextRequest, NextResponse } from 'next/server';
import { lookupNutrition } from '@/core/lookup';
import { scoreNutritionProduct } from '@/lib/scoring-engine';
import { combineNutritionResults, NutritionItem } from '@/lib/combine-nutrition';
import { z } from 'zod';

const BarcodeQuerySchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
});

const NutritionItemSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
  servings: z.number().int().min(1).max(20).default(1),
});

const MultipleItemsBodySchema = z.object({
  items: z.array(NutritionItemSchema).min(1).max(5, 'Maximum 5 items allowed'),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barcode = searchParams.get('barcode');

    // Validate input
    const validation = BarcodeQuerySchema.safeParse({ barcode });
    if (!validation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'INVALID_BARCODE',
            message: validation.error.errors[0].message,
          },
        },
        { status: 400 }
      );
    }

    // Perform lookup
    const result = await lookupNutrition(validation.data.barcode);

    // Calculate scoring if we have a successful result
    const resultWithScoring = {
      ...result,
      scoring: result.ok ? scoreNutritionProduct(result) : undefined,
    };

    // Determine HTTP status code
    let status = 200;
    if (!result.ok) {
      switch (result.error.code) {
        case 'INVALID_BARCODE':
          status = 400;
          break;
        case 'NOT_FOUND':
          status = 404;
          break;
        case 'CONFIG_ERROR':
          status = 502;
          break;
        case 'UPSTREAM_ERROR':
          status = 502;
          break;
        default:
          status = 500;
      }
    }

    return NextResponse.json(resultWithScoring, { status });
  } catch (error) {
    console.error('Unexpected error in nutrition API:', error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = MultipleItemsBodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: validation.error.errors[0].message,
          },
        },
        { status: 400 }
      );
    }

    const items = validation.data.items;

    // Look up all items in parallel
    const lookupPromises = items.map(item => lookupNutrition(item.barcode));
    const results = await Promise.all(lookupPromises);

    // Combine results with their servings
    const itemsWithResults = items.map((item, index) => ({
      barcode: item.barcode,
      servings: item.servings,
      result: results[index],
    }));

    // Combine nutrition data
    const combined = combineNutritionResults(itemsWithResults);

    if (!combined) {
      // All items failed
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'None of the provided items could be found',
          },
          items: itemsWithResults.map(item => ({
            barcode: item.barcode,
            servings: item.servings,
            result: item.result,
          })),
          combined: null,
        },
        { status: 404 }
      );
    }

    // Calculate scoring for combined result
    const scoring = scoreNutritionProduct(combined);

    // Determine HTTP status code based on whether all items succeeded
    const allSucceeded = itemsWithResults.every(item => item.result.ok);
    const status = allSucceeded ? 200 : 207; // 207 Multi-Status if some failed

    return NextResponse.json({
      ok: true,
      items: itemsWithResults.map(item => ({
        barcode: item.barcode,
        servings: item.servings,
        result: item.result,
      })),
      combined: {
        ...combined,
        scoring,
      },
    }, { status });
  } catch (error) {
    console.error('Unexpected error in nutrition API (POST):', error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'UPSTREAM_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 }
    );
  }
}
