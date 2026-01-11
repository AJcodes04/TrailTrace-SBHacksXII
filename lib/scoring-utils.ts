import { DerivedMetrics, ScoringNutritionData } from '@/types/scoring';

/**
 * Parses serving size string to extract numeric value and unit
 * Examples: "100g" -> { value: 100, unit: "g" }
 *           "250ml" -> { value: 250, unit: "ml" }
 *           "1 cup" -> { value: 1, unit: "cup" }
 *           "1" -> { value: null, unit: null } (ambiguous, reject)
 */
export function parseServingSize(servingSize: string | null): { value: number | null; unit: string | null } {
  if (!servingSize) {
    return { value: null, unit: null };
  }

  const trimmed = servingSize.trim();
  
  // Try to match patterns like "100g", "250ml", "1.5 cups", etc. (number + unit)
  const match = trimmed.match(/^([\d.]+)\s+([a-zA-Z]+)$/);
  if (match) {
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    return { value: isNaN(value) ? null : value, unit };
  }

  // Try to match patterns without space like "100g", "250ml"
  const noSpaceMatch = trimmed.match(/^([\d.]+)([a-zA-Z]+)$/);
  if (noSpaceMatch) {
    const value = parseFloat(noSpaceMatch[1]);
    const unit = noSpaceMatch[2].toLowerCase();
    return { value: isNaN(value) ? null : value, unit };
  }

  // Don't assume grams for bare numbers - they're ambiguous
  // (could be "1 serving", "1 piece", etc.)
  return { value: null, unit: null };
}

/**
 * Calculates serving weight in grams
 * If serving size is in mL and density ~1 g/mL, treat 1 mL = 1 g
 */
export function calculateServingWeightG(servingSize: string | null): number | null {
  const { value, unit } = parseServingSize(servingSize);
  if (value === null) {
    return null;
  }

  if (unit === 'g' || unit === 'gram' || unit === 'grams') {
    return value;
  }

  if (unit === 'ml' || unit === 'milliliter' || unit === 'milliliters' || unit === 'l' || unit === 'liter' || unit === 'liters') {
    // Treat 1 mL = 1 g (approximation for water-based products)
    const mlValue = unit.startsWith('l') && !unit.startsWith('ml') ? value * 1000 : value;
    return mlValue;
  }

  // For other units, assume the numeric value represents grams
  // This is a fallback - in practice, many serving sizes are just numbers meaning grams
  return value;
}

/**
 * Calculates all derived metrics from nutrition data
 */
export function calculateDerivedMetrics(nutrition: ScoringNutritionData): DerivedMetrics {
  const servingWeightG = calculateServingWeightG(nutrition.servingSize);

  // Energy density: calories per gram
  let energyDensity: number | null = null;
  if (servingWeightG !== null && servingWeightG > 0 && nutrition.caloriesKcal !== null && nutrition.caloriesKcal > 0) {
    energyDensity = nutrition.caloriesKcal / servingWeightG;
  }

  // Carb to protein ratio
  let carbToProteinRatio: number | null = null;
  if (nutrition.proteinG !== null && nutrition.proteinG > 0 && nutrition.carbsG !== null) {
    carbToProteinRatio = nutrition.carbsG / nutrition.proteinG;
  }

  // Total sugars as percentage of carbs
  let totalSugarsPercentCarb: number | null = null;
  if (nutrition.carbsG !== null && nutrition.carbsG > 0 && nutrition.sugarsG !== null) {
    totalSugarsPercentCarb = (nutrition.sugarsG / nutrition.carbsG) * 100;
  }

  return {
    servingWeightG,
    energyDensity,
    carbToProteinRatio,
    totalSugarsPercentCarb,
  };
}

/**
 * Clamps a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculates per-100g values from serving values
 * Returns null for each value if serving weight cannot be determined
 */
export function calculatePer100gValues(nutrition: ScoringNutritionData): {
  fatPer100g: number | null;
  fiberPer100g: number | null;
  proteinPer100g: number | null;
  sodiumMgPer100g: number | null;
} {
  const servingWeightG = calculateServingWeightG(nutrition.servingSize);
  
  if (servingWeightG === null || servingWeightG <= 0) {
    return {
      fatPer100g: null,
      fiberPer100g: null,
      proteinPer100g: null,
      sodiumMgPer100g: null,
    };
  }
  
  const factor = 100 / servingWeightG;
  
  return {
    fatPer100g: nutrition.totalFatG !== null ? nutrition.totalFatG * factor : null,
    fiberPer100g: nutrition.fiberG !== null ? nutrition.fiberG * factor : null,
    proteinPer100g: nutrition.proteinG !== null ? nutrition.proteinG * factor : null,
    sodiumMgPer100g: nutrition.sodiumMg !== null ? nutrition.sodiumMg * factor : null,
  };
}

/**
 * Checks if ingredients list contains any of the specified terms (case-insensitive)
 */
export function containsAnyIngredient(ingredients: string | null, terms: string[]): boolean {
  if (!ingredients) {
    return false;
  }
  
  const lowerIngredients = ingredients.toLowerCase();
  return terms.some(term => lowerIngredients.includes(term.toLowerCase()));
}

/**
 * Calculates carbohydrate concentration in grams per 100ml for beverages
 * Returns null if serving size is not in ml or cannot be determined
 */
export function calculateCarbConcentration(nutrition: ScoringNutritionData): number | null {
  if (!nutrition.servingSize || nutrition.carbsG === null) {
    return null;
  }
  
  const parsed = parseServingSize(nutrition.servingSize);
  if (parsed.value === null || parsed.unit === null) {
    return null;
  }
  
  // Check if serving size is in ml
  const isMl = parsed.unit === 'ml' || parsed.unit === 'milliliter' || parsed.unit === 'milliliters';
  const isLiter = parsed.unit === 'l' || parsed.unit === 'liter' || parsed.unit === 'liters';
  
  if (!isMl && !isLiter) {
    return null; // Not a liquid serving size
  }
  
  // Convert to ml
  const servingSizeMl = isLiter ? parsed.value * 1000 : parsed.value;
  
  if (servingSizeMl <= 0) {
    return null;
  }
  
  // Calculate carbs per 100ml
  return (nutrition.carbsG / servingSizeMl) * 100;
}
