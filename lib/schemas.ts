import { z } from 'zod';
import { NutritionLookupResultSchema } from '@/types/nutrition';

/**
 * Client-side schema for validating API responses
 * This is a subset/extension of the full NutritionLookupResult schema
 * used specifically for UI validation
 */
export const NutritionResponseSchema = NutritionLookupResultSchema;

export type NutritionResponse = z.infer<typeof NutritionResponseSchema>;

/**
 * Schema for multi-item API response (POST endpoint)
 */
export const MultiItemNutritionResponseSchema = z.object({
  ok: z.boolean(),
  items: z.array(z.object({
    barcode: z.string(),
    servings: z.number(),
    result: NutritionLookupResultSchema,
  })),
  combined: NutritionLookupResultSchema.nullable(),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }).optional(),
});

export type MultiItemNutritionResponse = z.infer<typeof MultiItemNutritionResponseSchema>;

/**
 * Validates and parses a nutrition API response (single item)
 * Returns the parsed data or throws a ZodError
 */
export function validateNutritionResponse(data: unknown): NutritionResponse {
  return NutritionResponseSchema.parse(data);
}

/**
 * Validates and parses a multi-item nutrition API response (POST endpoint)
 * Returns the parsed data or throws a ZodError
 */
export function validateMultiItemNutritionResponse(data: unknown): MultiItemNutritionResponse {
  return MultiItemNutritionResponseSchema.parse(data);
}
