import { NutritionLookupResult } from '@/types/nutrition';
import { ScoringResult, ScoringNutritionData } from '@/types/scoring';
import { calculateDerivedMetrics } from './scoring-utils';
import { scorePreRun, scoreDuringRun, scorePostRun } from './scoring';
import { detectFlags } from './flags';
import { scaleNutritionData } from './scale-nutrition';

/**
 * Client-side scoring function that scales nutrition data by servings
 */
export function scoreNutritionProductWithServings(
  result: NutritionLookupResult,
  servings: number
): ScoringResult {
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

  // Scale nutrition data by servings
  const nutrition = scaleNutritionData(result, servings);
  const ingredients = result.product.ingredients;

  // Calculate derived metrics
  const derivedMetrics = calculateDerivedMetrics(nutrition);

  // Calculate scores for each context (pass servings for penalty scaling)
  const scores = [
    scorePreRun(nutrition, ingredients, servings),
    scoreDuringRun(nutrition, ingredients, servings),
    scorePostRun(nutrition, ingredients, servings),
  ];

  // Detect flags
  const flags = detectFlags(nutrition, ingredients);

  return {
    scores,
    flags,
    derivedMetrics,
  };
}
