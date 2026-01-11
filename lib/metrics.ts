/**
 * Pure functions for calculating derived protein metrics with null safety.
 */

interface NutritionServing {
  proteinG: number | null;
  caloriesKcal: number | null;
}

/**
 * Calculates protein per serving in grams
 */
export function proteinPerServing(serving: NutritionServing): number | null {
  return serving.proteinG;
}

/**
 * Calculates protein density: grams of protein per 100 calories
 * Formula: (proteinG / caloriesKcal) * 100
 */
export function proteinPer100kcal(serving: NutritionServing): number | null {
  const { proteinG, caloriesKcal } = serving;
  if (proteinG == null || caloriesKcal == null || caloriesKcal <= 0) {
    return null;
  }
  return (proteinG / caloriesKcal) * 100;
}

/**
 * Calculates percentage of calories from protein
 * Formula: ((proteinG * 4) / caloriesKcal) * 100
 * Note: Protein has 4 calories per gram
 */
export function percentCaloriesFromProtein(serving: NutritionServing): number | null {
  const { proteinG, caloriesKcal } = serving;
  if (proteinG == null || caloriesKcal == null || caloriesKcal <= 0) {
    return null;
  }
  return ((proteinG * 4) / caloriesKcal) * 100;
}

/**
 * Calculates calories per 10g of protein (inverse protein density)
 * Formula: (caloriesKcal / proteinG) * 10
 */
export function caloriesPer10gProtein(serving: NutritionServing): number | null {
  const { proteinG, caloriesKcal } = serving;
  if (proteinG == null || caloriesKcal == null || proteinG <= 0) {
    return null;
  }
  return (caloriesKcal / proteinG) * 10;
}
