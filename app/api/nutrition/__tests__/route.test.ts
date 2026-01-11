import { GET } from '../route';
import { NextRequest } from 'next/server';
import { lookupNutrition } from '@/core/lookup';
import { scoreNutritionProduct } from '@/lib/scoring-engine';

jest.mock('@/core/lookup');
jest.mock('@/lib/scoring-engine');

const mockLookupNutrition = lookupNutrition as jest.MockedFunction<typeof lookupNutrition>;
const mockScoreNutritionProduct = scoreNutritionProduct as jest.MockedFunction<typeof scoreNutritionProduct>;

describe('GET /api/nutrition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for scoring - returns empty scoring result
    mockScoreNutritionProduct.mockReturnValue({
      scores: [],
      flags: [],
      derivedMetrics: {
        servingWeightG: null,
        energyDensity: null,
        carbToProteinRatio: null,
        totalSugarsPercentCarb: null,
      },
    });
  });

  it('should return 400 for missing barcode', async () => {
    const request = new NextRequest('http://localhost/api/nutrition');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error.code).toBe('INVALID_BARCODE');
  });

  it('should return 200 with nutrition data', async () => {
    const mockResult = {
      ok: true,
      barcode: '077034085228',
      normalizedBarcode: '077034085228',
      product: { name: 'Test Product', brand: null, imageUrl: null, ingredients: null },
      nutrition: {
        serving: {
          servingSize: null,
          caloriesKcal: 250,
          fatG: null,
          satFatG: null,
          transFatG: null,
          carbsG: null,
          fiberG: null,
          sugarsG: null,
          addedSugarsG: null,
          proteinG: null,
          sodiumMg: null,
          cholesterolMg: null,
        },
        per100g: {
          caloriesKcal: null,
          fatG: null,
          carbsG: null,
          proteinG: null,
          sodiumMg: null,
        },
      },
      source: { provider: 'openfoodfacts' as const, providerProductUrl: null, retrievedAtIso: '' },
      warnings: [],
      raw: { openFoodFacts: null, usdaFdc: null },
      error: { code: null, message: null },
    };

    mockLookupNutrition.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/nutrition?barcode=077034085228');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.product.name).toBe('Test Product');
    // Scoring should be included for successful results
    expect(data.scoring).toBeDefined();
    expect(mockScoreNutritionProduct).toHaveBeenCalledWith(mockResult);
  });

  it('should return 404 for NOT_FOUND', async () => {
    const mockResult = {
      ok: false,
      barcode: '123456789012',
      normalizedBarcode: '123456789012',
      product: { name: null, brand: null, imageUrl: null, ingredients: null },
      nutrition: {
        serving: {
          servingSize: null,
          caloriesKcal: null,
          fatG: null,
          satFatG: null,
          transFatG: null,
          carbsG: null,
          fiberG: null,
          sugarsG: null,
          addedSugarsG: null,
          proteinG: null,
          sodiumMg: null,
          cholesterolMg: null,
        },
        per100g: {
          caloriesKcal: null,
          fatG: null,
          carbsG: null,
          proteinG: null,
          sodiumMg: null,
        },
      },
      source: { provider: 'none' as const, providerProductUrl: null, retrievedAtIso: '' },
      warnings: [],
      raw: { openFoodFacts: null, usdaFdc: null },
      error: { code: 'NOT_FOUND' as const, message: 'Not found' },
    };

    mockLookupNutrition.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/nutrition?barcode=123456789012');
    const response = await GET(request);

    expect(response.status).toBe(404);
    // Scoring should not be calculated for failed results
    expect(mockScoreNutritionProduct).not.toHaveBeenCalled();
  });

  it('should return 400 for INVALID_BARCODE', async () => {
    const mockResult = {
      ok: false,
      barcode: '123',
      normalizedBarcode: '123',
      product: { name: null, brand: null, imageUrl: null, ingredients: null },
      nutrition: {
        serving: {
          servingSize: null,
          caloriesKcal: null,
          fatG: null,
          satFatG: null,
          transFatG: null,
          carbsG: null,
          fiberG: null,
          sugarsG: null,
          addedSugarsG: null,
          proteinG: null,
          sodiumMg: null,
          cholesterolMg: null,
        },
        per100g: {
          caloriesKcal: null,
          fatG: null,
          carbsG: null,
          proteinG: null,
          sodiumMg: null,
        },
      },
      source: { provider: 'none' as const, providerProductUrl: null, retrievedAtIso: '' },
      warnings: [],
      raw: { openFoodFacts: null, usdaFdc: null },
      error: { code: 'INVALID_BARCODE' as const, message: 'Invalid barcode' },
    };

    mockLookupNutrition.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/nutrition?barcode=123');
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it('should return 502 for CONFIG_ERROR', async () => {
    const mockResult = {
      ok: false,
      barcode: '077034085228',
      normalizedBarcode: '077034085228',
      product: { name: null, brand: null, imageUrl: null, ingredients: null },
      nutrition: {
        serving: {
          servingSize: null,
          caloriesKcal: null,
          fatG: null,
          satFatG: null,
          transFatG: null,
          carbsG: null,
          fiberG: null,
          sugarsG: null,
          addedSugarsG: null,
          proteinG: null,
          sodiumMg: null,
          cholesterolMg: null,
        },
        per100g: {
          caloriesKcal: null,
          fatG: null,
          carbsG: null,
          proteinG: null,
          sodiumMg: null,
        },
      },
      source: { provider: 'none' as const, providerProductUrl: null, retrievedAtIso: '' },
      warnings: [],
      raw: { openFoodFacts: null, usdaFdc: null },
      error: { code: 'CONFIG_ERROR' as const, message: 'Config error' },
    };

    mockLookupNutrition.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/nutrition?barcode=077034085228');
    const response = await GET(request);

    expect(response.status).toBe(502);
  });
});
