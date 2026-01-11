import { NutritionLookupResult } from '@/types/nutrition';
import { ScoringResult, ScoringNutritionData, ContextScore } from '@/types/scoring';
import { calculateDerivedMetrics } from './scoring-utils';
import { scorePreRun, scoreDuringRun, scorePostRun } from './scoring';
import { detectFlags } from './flags';

/**
 * Converts NutritionLookupResult nutrition data to ScoringNutritionData format
 */
export function normalizeNutritionData(result: NutritionLookupResult): ScoringNutritionData {
  const serving = result.nutrition.serving;
  return {
    servingSize: serving.servingSize,
    caloriesKcal: serving.caloriesKcal,
    totalFatG: serving.fatG,
    saturatedFatG: serving.satFatG,
    transFatG: serving.transFatG,
    carbsG: serving.carbsG,
    fiberG: serving.fiberG,
    sugarsG: serving.sugarsG,
    addedSugarsG: serving.addedSugarsG,
    proteinG: serving.proteinG,
    sodiumMg: serving.sodiumMg,
  };
}

/**
 * Main scoring function that calculates scores for all contexts
 */
export function scoreNutritionProduct(result: NutritionLookupResult): ScoringResult {
  // Only score if we have a successful result
  if (!result.ok) {
    return {
      scores: [],
      flags: [],
      derivedMetrics: {
        servingWeightG: null,
        energyDensity: null,
        carbToProteinRatio: null,
        totalSugarsPercentCarb: null,
      },
    };
  }

  const nutrition = normalizeNutritionData(result);
  const ingredients = result.product.ingredients;

  // Calculate derived metrics
  const derivedMetrics = calculateDerivedMetrics(nutrition);

  // Calculate scores for each context
  const scores: ContextScore[] = [
    scorePreRun(nutrition, ingredients),
    scoreDuringRun(nutrition, ingredients),
    scorePostRun(nutrition, ingredients),
  ];

  // Detect flags
  const flags = detectFlags(nutrition, ingredients);

  return {
    scores,
    flags,
    derivedMetrics,
  };
}
