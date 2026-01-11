import { z } from 'zod';

export type Provider = 'openfoodfacts' | 'usda_fdc' | 'none';

export type ErrorCode = 'INVALID_BARCODE' | 'NOT_FOUND' | 'UPSTREAM_ERROR' | 'CONFIG_ERROR' | null;

// Scoring schemas (imported from scoring types)
const ScoringContextSchema = z.enum(['pre_run', 'during_run', 'post_run']);
const FlagSeveritySchema = z.enum(['info', 'caution']);

const ScoreComponentSchema = z.object({
  name: z.string(),
  weight: z.number(),
  points: z.number(),
  description: z.string(),
});

const ContextScoreSchema = z.object({
  context: ScoringContextSchema,
  displayName: z.string(),
  score: z.number(),
  components: z.array(ScoreComponentSchema),
  applicable: z.boolean(),
});

const FlagSchema = z.object({
  name: z.string(),
  severity: FlagSeveritySchema,
  message: z.string(),
  appliesTo: z.array(ScoringContextSchema),
});

const DerivedMetricsSchema = z.object({
  servingWeightG: z.number().nullable(),
  energyDensity: z.number().nullable(),
  carbToProteinRatio: z.number().nullable(),
  totalSugarsPercentCarb: z.number().nullable(),
});

const ScoringResultSchema = z.object({
  scores: z.array(ContextScoreSchema),
  flags: z.array(FlagSchema),
  derivedMetrics: DerivedMetricsSchema,
});

// Zod schema for NutritionLookupResult
export const NutritionLookupResultSchema = z.object({
  ok: z.boolean(),
  barcode: z.string(),
  normalizedBarcode: z.string(),
  product: z.object({
    name: z.string().nullable(),
    brand: z.string().nullable(),
    imageUrl: z.string().nullable(),
    ingredients: z.string().nullable(),
  }),
  nutrition: z.object({
    serving: z.object({
      servingSize: z.string().nullable(),
      caloriesKcal: z.number().nullable(),
      fatG: z.number().nullable(),
      satFatG: z.number().nullable(),
      transFatG: z.number().nullable(),
      carbsG: z.number().nullable(),
      fiberG: z.number().nullable(),
      sugarsG: z.number().nullable(),
      addedSugarsG: z.number().nullable(),
      proteinG: z.number().nullable(),
      sodiumMg: z.number().nullable(),
      cholesterolMg: z.number().nullable(),
    }),
    per100g: z.object({
      caloriesKcal: z.number().nullable(),
      fatG: z.number().nullable(),
      carbsG: z.number().nullable(),
      proteinG: z.number().nullable(),
      sodiumMg: z.number().nullable(),
    }),
  }),
  source: z.object({
    provider: z.enum(['openfoodfacts', 'usda_fdc', 'none']),
    providerProductUrl: z.string().nullable(),
    retrievedAtIso: z.string(),
  }),
  warnings: z.array(z.string()),
  raw: z.object({
    openFoodFacts: z.any().nullable(),
    usdaFdc: z.any().nullable(),
  }),
  error: z.object({
    code: z.enum(['INVALID_BARCODE', 'NOT_FOUND', 'UPSTREAM_ERROR', 'CONFIG_ERROR']).nullable(),
    message: z.string().nullable(),
  }),
  scoring: ScoringResultSchema.optional(), // Optional scoring results
});

export type NutritionLookupResult = z.infer<typeof NutritionLookupResultSchema>;

// Helper type for barcode normalization result
export interface BarcodeNormalization {
  normalized: string;
  candidates: string[];
}
