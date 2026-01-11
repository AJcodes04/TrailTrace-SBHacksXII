import { NutritionLookupResult } from '@/types/nutrition';
import { ScoringNutritionData } from '@/types/scoring';

/**
 * Scales nutrition data by the number of servings
 */
export function scaleNutritionData(
  result: NutritionLookupResult,
  servings: number
): ScoringNutritionData {
  if (!result.ok) {
    throw new Error('Cannot scale nutrition data for failed result');
  }

  const serving = result.nutrition.serving;
  const multiplier = servings;

  return {
    servingSize: serving.servingSize, // Keep original serving size
    caloriesKcal: serving.caloriesKcal !== null ? serving.caloriesKcal * multiplier : null,
    totalFatG: serving.fatG !== null ? serving.fatG * multiplier : null,
    saturatedFatG: serving.satFatG !== null ? serving.satFatG * multiplier : null,
    transFatG: serving.transFatG !== null ? serving.transFatG * multiplier : null,
    carbsG: serving.carbsG !== null ? serving.carbsG * multiplier : null,
    fiberG: serving.fiberG !== null ? serving.fiberG * multiplier : null,
    sugarsG: serving.sugarsG !== null ? serving.sugarsG * multiplier : null,
    addedSugarsG: serving.addedSugarsG !== null ? serving.addedSugarsG * multiplier : null,
    proteinG: serving.proteinG !== null ? serving.proteinG * multiplier : null,
    sodiumMg: serving.sodiumMg !== null ? serving.sodiumMg * multiplier : null,
  };
}
