import { ContextScore, ScoringContext, ScoringNutritionData } from '@/types/scoring';
import { containsAnyIngredient } from './scoring-utils';

// Penalty values (on 0-100 scale)
const MAJOR_PENALTY = 15;
const MODERATE_PENALTY = 8;
const MINOR_PENALTY = 4;

/**
 * Calculates a linearly scaling penalty for values that exceed the maximum threshold.
 * Penalty scales from 0 (at max) to maxPenalty (at 2x max), allowing extremely excessive
 * values to drive the total score to 0.
 * @param value The actual value
 * @param max The maximum threshold before penalty starts
 * @param maxPenalty Maximum penalty to apply (default 100, which can zero out the score)
 * @returns The penalty value (0 to maxPenalty)
 */
function calculateExcessivePenalty(value: number, max: number, maxPenalty: number = 100): number {
  if (value <= max) {
    return 0;
  }
  const excess = value - max;
  const excessRatio = excess / max; // At 2x max, ratio = 1.0
  return Math.min(maxPenalty, excessRatio * maxPenalty);
}

/**
 * Scores a product for pre-run fueling
 */
export function scorePreRun(nutrition: ScoringNutritionData, ingredients: string | null = null, servings: number = 1): ContextScore {
  const components: any[] = [];
  
  // Get values per serving
  const carbsG = nutrition.carbsG || 0;
  const proteinG = nutrition.proteinG || 0;
  const fatG = nutrition.totalFatG || 0;
  const fiberG = nutrition.fiberG || 0;
  const sodiumMg = nutrition.sodiumMg || 0;
  
  // Carbohydrate score (0-100) with maximum cap
  let carbsScore = 0;
  if (carbsG > 90) {
    carbsScore = 0; // >90g = too high
  } else if (carbsG >= 30) {
    carbsScore = 100; // 30-90g = ideal
  } else if (carbsG >= 15) {
    carbsScore = 50; // 15-29g = moderate carbs, partial credit
  } else {
    carbsScore = 0; // <15g = too little carb
  }
  components.push({
    name: 'Carbohydrates',
    weight: 0.4,
    points: carbsScore,
    description: carbsG > 90 ? `Too high (>90g) - ${Math.round(carbsG)}g` : carbsG >= 30 ? `Ideal (30-90g) - ${Math.round(carbsG)}g` : carbsG >= 15 ? `Moderate (15-29g) - ${Math.round(carbsG)}g` : `Low (<15g) - ${Math.round(carbsG)}g`,
  });
  
  // Protein score (inverse, 0-100)
  let proteinScore = 0;
  if (proteinG <= 10) {
    proteinScore = 100; // ≤10 g prot = ideal (light on protein)
  } else if (proteinG <= 20) {
    proteinScore = 75; // 10–20 g prot = OK if well before exercise
  } else {
    proteinScore = 0; // >20 g prot = too high (GI risk)
  }
  components.push({
    name: 'Protein',
    weight: 0.2,
    points: proteinScore,
    description: proteinG <= 10 ? `Ideal (≤10g) - ${Math.round(proteinG)}g` : proteinG <= 20 ? `OK (11-20g) - ${Math.round(proteinG)}g` : `Too high (>20g) - ${Math.round(proteinG)}g`,
  });
  
  // Fat score (inverse, 0-100)
  let fatScore = 0;
  if (fatG <= 3) {
    fatScore = 100; // ≤3 g fat = very low-fat
  } else if (fatG <= 10) {
    fatScore = 50; // 4–10 g fat = moderate
  } else {
    fatScore = 0; // >10 g fat = high fat (penalize)
  }
  components.push({
    name: 'Fat',
    weight: 0.2,
    points: fatScore,
    description: fatG <= 3 ? `Very low (≤3g) - ${Math.round(fatG)}g` : fatG <= 10 ? `Moderate (4-10g) - ${Math.round(fatG)}g` : `High (>10g) - ${Math.round(fatG)}g`,
  });
  
  // Fiber score (inverse, 0-100)
  let fiberScore = 0;
  if (fiberG <= 2) {
    fiberScore = 100; // ≤2 g fiber = low fiber
  } else if (fiberG <= 5) {
    fiberScore = 50; // 3–5 g fiber = moderate fiber
  } else {
    fiberScore = 0; // >5 g fiber = high fiber (penalize)
  }
  components.push({
    name: 'Fiber',
    weight: 0.1,
    points: fiberScore,
    description: fiberG <= 2 ? `Low (≤2g) - ${Math.round(fiberG)}g` : fiberG <= 5 ? `Moderate (3-5g) - ${Math.round(fiberG)}g` : `High (>5g) - ${Math.round(fiberG)}g`,
  });
  
  // Sodium score (bonus factor, 0-100) with maximum cap
  let sodiumScore = 0;
  if (sodiumMg > 800) {
    sodiumScore = 0; // >800mg = too high
  } else if (sodiumMg >= 300) {
    sodiumScore = 100; // 300-800mg = ideal (provides electrolytes for hydration)
  } else if (sodiumMg >= 100) {
    sodiumScore = 50; // 100–299mg = some sodium
  } else {
    sodiumScore = 0; // <100mg = negligible sodium
  }
  components.push({
    name: 'Sodium',
    weight: 0.1,
    points: sodiumScore,
    description: sodiumMg > 800 ? `Too high (>800mg) - ${Math.round(sodiumMg)}mg` : sodiumMg >= 300 ? `Ideal (300-800mg) - ${Math.round(sodiumMg)}mg` : sodiumMg >= 100 ? `Moderate (100-299mg) - ${Math.round(sodiumMg)}mg` : `Low (<100mg) - ${Math.round(sodiumMg)}mg`,
  });
  
  // Combine factor scores with weights
  // Carbs 40%, Protein 20%, Fat 20%, Fiber 10%, Sodium 10%
  let totalScore = 0.4 * carbsScore + 0.2 * proteinScore + 0.2 * fatScore + 0.1 * fiberScore + 0.1 * sodiumScore;
  
  // Apply excessive value penalties (linearly scaling)
  const carbsExcessivePenalty = calculateExcessivePenalty(carbsG, 90, 100);
  if (carbsExcessivePenalty > 0) {
    totalScore -= carbsExcessivePenalty;
    components.push({
      name: 'Penalty: Excessive Carbohydrates',
      weight: 0,
      points: -carbsExcessivePenalty,
      description: `Excessive carbs (${Math.round(carbsG)}g exceeds 90g maximum)`,
    });
  }
  
  const sodiumExcessivePenalty = calculateExcessivePenalty(sodiumMg, 800, 100);
  if (sodiumExcessivePenalty > 0) {
    totalScore -= sodiumExcessivePenalty;
    components.push({
      name: 'Penalty: Excessive Sodium',
      weight: 0,
      points: -sodiumExcessivePenalty,
      description: `Excessive sodium (${Math.round(sodiumMg)}mg exceeds 800mg maximum)`,
    });
  }
  
  // Apply penalties (scaled by servings)
  // Artificial sweeteners – Moderate penalty
  if (containsAnyIngredient(ingredients, ['sucralose', 'aspartame', 'acesulfame', 'saccharin'])) {
    totalScore -= MODERATE_PENALTY * servings;
  }
  
  // Sugar alcohols – Major penalty
  if (containsAnyIngredient(ingredients, ['sorbitol', 'xylitol', 'mannitol', 'maltitol', 'erythritol'])) {
    totalScore -= MAJOR_PENALTY * servings;
  }
  
  // Emulsifiers and gums – Moderate penalty
  if (containsAnyIngredient(ingredients, ['polysorbate', 'carboxymethylcellulose', 'carrageenan', 'polyglycerol', 'monoglyceride'])) {
    totalScore -= MODERATE_PENALTY * servings;
  }
  
  // Palm oil – Moderate penalty
  if (containsAnyIngredient(ingredients, ['palm oil', 'palm kernel oil'])) {
    totalScore -= MODERATE_PENALTY * servings;
  }
  
  // Trans fats – Major penalty
  const hasTransFat = (nutrition.transFatG !== null && nutrition.transFatG > 0) ||
    containsAnyIngredient(ingredients, ['partially hydrogenated']);
  if (hasTransFat) {
    totalScore -= MAJOR_PENALTY * servings;
  }
  
  // Note: Excessive caffeine penalty is skipped as caffeine_mg is not available in the data structure
  
  const normalizedScore = Math.max(0, Math.min(100, totalScore));
  
  return {
    context: 'pre_run',
    displayName: 'Pre-Run Fueling Score',
    score: normalizedScore,
    components,
    applicable: true,
  };
}

/**
 * Scores a product for during-run fueling
 */
export function scoreDuringRun(nutrition: ScoringNutritionData, ingredients: string | null = null, servings: number = 1): ContextScore {
  const components: any[] = [];
  
  // Get values per serving
  const carbsG = nutrition.carbsG || 0;
  const sodiumMg = nutrition.sodiumMg || 0;
  const fatG = nutrition.totalFatG || 0;
  const proteinG = nutrition.proteinG || 0;
  const fiberG = nutrition.fiberG || 0;
  
  // Carbohydrates with maximum cap
  let carbsScore = 0;
  if (carbsG > 60) {
    carbsScore = 0; // >60g = too high
  } else if (carbsG >= 20) {
    carbsScore = 100; // 20-60g = ideal for hourly fueling
  } else if (carbsG >= 10) {
    carbsScore = 50; // 10–19g = partial contribution
  } else {
    carbsScore = 0; // <10g = insufficient
  }
  components.push({
    name: 'Carbohydrates',
    weight: 0.4,
    points: carbsScore,
    description: carbsG > 60 ? `Too high (>60g) - ${Math.round(carbsG)}g` : carbsG >= 20 ? `Ideal (20-60g) - ${Math.round(carbsG)}g` : carbsG >= 10 ? `Moderate (10-19g) - ${Math.round(carbsG)}g` : `Low (<10g) - ${Math.round(carbsG)}g`,
  });
  
  // Sodium with maximum cap
  let sodiumScore = 0;
  if (sodiumMg > 600) {
    sodiumScore = 0; // >600mg = too high
  } else if (sodiumMg >= 200) {
    sodiumScore = 100; // 200-600mg = ideal (high electrolyte content)
  } else if (sodiumMg >= 100) {
    sodiumScore = 50; // 100–199mg = moderate electrolytes
  } else {
    sodiumScore = 0; // <100mg = little/no sodium
  }
  components.push({
    name: 'Sodium',
    weight: 0.3,
    points: sodiumScore,
    description: sodiumMg > 600 ? `Too high (>600mg) - ${Math.round(sodiumMg)}mg` : sodiumMg >= 200 ? `Ideal (200-600mg) - ${Math.round(sodiumMg)}mg` : sodiumMg >= 100 ? `Moderate (100-199mg) - ${Math.round(sodiumMg)}mg` : `Low (<100mg) - ${Math.round(sodiumMg)}mg`,
  });
  
  // Fat (inverse scoring)
  let fatScore = 0;
  if (fatG <= 2) {
    fatScore = 100; // ~0–2 g fat (essentially fat-free)
  } else if (fatG <= 5) {
    fatScore = 50; // 3–5 g fat (low-to-moderate fat)
  } else {
    fatScore = 0; // >5 g fat (too high during exercise)
  }
  components.push({
    name: 'Fat',
    weight: 0.1,
    points: fatScore,
    description: fatG <= 2 ? `Very low (≤2g) - ${Math.round(fatG)}g` : fatG <= 5 ? `Moderate (3-5g) - ${Math.round(fatG)}g` : `High (>5g) - ${Math.round(fatG)}g`,
  });
  
  // Protein (inverse scoring)
  let proteinScore = 0;
  if (proteinG <= 3) {
    proteinScore = 100; // 0–3 g protein (no protein, ideal)
  } else if (proteinG <= 8) {
    proteinScore = 50; // 4–8 g protein (some protein, not ideal)
  } else {
    proteinScore = 0; // >8 g protein (excessive mid-run)
  }
  components.push({
    name: 'Protein',
    weight: 0.1,
    points: proteinScore,
    description: proteinG <= 3 ? `Ideal (≤3g) - ${Math.round(proteinG)}g` : proteinG <= 8 ? `Moderate (4-8g) - ${Math.round(proteinG)}g` : `High (>8g) - ${Math.round(proteinG)}g`,
  });
  
  // Fiber (inverse scoring)
  let fiberScore = 0;
  if (fiberG < 1) {
    fiberScore = 100; // <1 g fiber (fiber-free)
  } else if (fiberG <= 3) {
    fiberScore = 50; // 1–3 g fiber (a bit of fiber)
  } else {
    fiberScore = 0; // >3 g fiber (too high during exercise)
  }
  components.push({
    name: 'Fiber',
    weight: 0.1,
    points: fiberScore,
    description: fiberG < 1 ? `Very low (<1g) - ${fiberG.toFixed(1)}g` : fiberG <= 3 ? `Moderate (1-3g) - ${Math.round(fiberG)}g` : `High (>3g) - ${Math.round(fiberG)}g`,
  });
  
  // Combine factor scores with weights
  // Carbs 40%, Sodium 30%, Fat 10%, Protein 10%, Fiber 10%
  let totalScore = 0.4 * carbsScore + 0.3 * sodiumScore + 0.1 * fatScore + 0.1 * proteinScore + 0.1 * fiberScore;
  
  // Apply excessive value penalties (linearly scaling)
  const carbsExcessivePenalty = calculateExcessivePenalty(carbsG, 60, 100);
  if (carbsExcessivePenalty > 0) {
    totalScore -= carbsExcessivePenalty;
    components.push({
      name: 'Penalty: Excessive Carbohydrates',
      weight: 0,
      points: -carbsExcessivePenalty,
      description: `Excessive carbs (${Math.round(carbsG)}g exceeds 60g maximum)`,
    });
  }
  
  const sodiumExcessivePenalty = calculateExcessivePenalty(sodiumMg, 600, 100);
  if (sodiumExcessivePenalty > 0) {
    totalScore -= sodiumExcessivePenalty;
    components.push({
      name: 'Penalty: Excessive Sodium',
      weight: 0,
      points: -sodiumExcessivePenalty,
      description: `Excessive sodium (${Math.round(sodiumMg)}mg exceeds 600mg maximum)`,
    });
  }
  
  // Apply penalties (scaled by servings)
  // Artificial sweeteners – Moderate penalty
  if (containsAnyIngredient(ingredients, ['sucralose', 'aspartame', 'acesulfame', 'saccharin'])) {
    totalScore -= MODERATE_PENALTY * servings;
  }
  
  // Sugar alcohols – Major penalty
  if (containsAnyIngredient(ingredients, ['sorbitol', 'xylitol', 'mannitol', 'maltitol', 'erythritol'])) {
    totalScore -= MAJOR_PENALTY * servings;
  }
  
  // Emulsifiers and additives – Moderate penalty
  if (containsAnyIngredient(ingredients, ['polysorbate', 'carboxymethylcellulose', 'carrageenan', 'polyglycerol', 'monoglyceride'])) {
    totalScore -= MODERATE_PENALTY * servings;
  }
  
  // Palm oil – Moderate penalty
  if (containsAnyIngredient(ingredients, ['palm oil', 'palm kernel oil'])) {
    totalScore -= MODERATE_PENALTY * servings;
  }
  
  // Trans fats – Major penalty
  const hasTransFat = (nutrition.transFatG !== null && nutrition.transFatG > 0) ||
    containsAnyIngredient(ingredients, ['partially hydrogenated']);
  if (hasTransFat) {
    totalScore -= MAJOR_PENALTY * servings;
  }
  
  // Note: Excessive caffeine penalty is skipped as caffeine_mg is not available in the data structure
  
  const normalizedScore = Math.max(0, Math.min(100, totalScore));
  
  return {
    context: 'during_run',
    displayName: 'During-Run Fueling Score',
    score: normalizedScore,
    components,
    applicable: true,
  };
}

/**
 * Scores a product for post-run recovery
 */
export function scorePostRun(nutrition: ScoringNutritionData, ingredients: string | null = null, servings: number = 1): ContextScore {
  const components: any[] = [];
  
  // Get values per serving
  const carbsG = nutrition.carbsG || 0;
  const proteinG = nutrition.proteinG || 0;
  const fatG = nutrition.totalFatG || 0;
  const fiberG = nutrition.fiberG || 0;
  const sodiumMg = nutrition.sodiumMg || 0;
  
  // Carbohydrates with maximum cap
  let carbsScore = 0;
  if (carbsG > 120) {
    carbsScore = 0; // >120g = too high
  } else if (carbsG >= 50) {
    carbsScore = 100; // 50-120g = ideal (meets robust recovery carb need)
  } else if (carbsG >= 20) {
    carbsScore = 50; // 20–49g = moderate, partial credit
  } else {
    carbsScore = 0; // <20g = very low for recovery
  }
  components.push({
    name: 'Carbohydrates',
    weight: 0.35,
    points: carbsScore,
    description: carbsG > 120 ? `Too high (>120g) - ${Math.round(carbsG)}g` : carbsG >= 50 ? `Ideal (50-120g) - ${Math.round(carbsG)}g` : carbsG >= 20 ? `Moderate (20-49g) - ${Math.round(carbsG)}g` : `Low (<20g) - ${Math.round(carbsG)}g`,
  });
  
  // Protein with maximum cap
  let proteinScore = 0;
  if (proteinG > 50) {
    proteinScore = 0; // >50g = too high
  } else if (proteinG >= 20) {
    proteinScore = 100; // 20-50g = ideal (optimal for muscle repair)
  } else if (proteinG >= 10) {
    proteinScore = 50; // 10–19g = some protein, but below ideal
  } else {
    proteinScore = 0; // <10g = inadequate for recovery
  }
  components.push({
    name: 'Protein',
    weight: 0.35,
    points: proteinScore,
    description: proteinG > 50 ? `Too high (>50g) - ${Math.round(proteinG)}g` : proteinG >= 20 ? `Ideal (20-50g) - ${Math.round(proteinG)}g` : proteinG >= 10 ? `Moderate (10-19g) - ${Math.round(proteinG)}g` : `Low (<10g) - ${Math.round(proteinG)}g`,
  });
  
  // Fat (inverse)
  let fatScore = 0;
  if (fatG < 5) {
    fatScore = 100; // <5 g fat (low-fat, quick absorption)
  } else if (fatG <= 10) {
    fatScore = 50; // 5–10 g fat (moderate fat)
  } else {
    fatScore = 0; // >10 g fat (high fat, not ideal post-exercise)
  }
  components.push({
    name: 'Fat',
    weight: 0.1,
    points: fatScore,
    description: fatG < 5 ? `Low (<5g) - ${Math.round(fatG)}g` : fatG <= 10 ? `Moderate (5-10g) - ${Math.round(fatG)}g` : `High (>10g) - ${Math.round(fatG)}g`,
  });
  
  // Fiber (inverse)
  let fiberScore = 0;
  if (fiberG <= 3) {
    fiberScore = 100; // 0–3 g fiber (low fiber, easy on stomach)
  } else if (fiberG <= 6) {
    fiberScore = 50; // 4–6 g fiber (moderate fiber)
  } else {
    fiberScore = 0; // >6 g fiber (high fiber, could hinder rapid recovery)
  }
  components.push({
    name: 'Fiber',
    weight: 0.1,
    points: fiberScore,
    description: fiberG <= 3 ? `Low (≤3g) - ${Math.round(fiberG)}g` : fiberG <= 6 ? `Moderate (4-6g) - ${Math.round(fiberG)}g` : `High (>6g) - ${Math.round(fiberG)}g`,
  });
  
  // Sodium with maximum cap
  let sodiumScore = 0;
  if (sodiumMg > 800) {
    sodiumScore = 0; // >800mg = too high
  } else if (sodiumMg >= 300) {
    sodiumScore = 100; // 300-800mg = ideal (high electrolyte content)
  } else if (sodiumMg >= 100) {
    sodiumScore = 50; // 100–299mg = moderate electrolytes
  } else {
    sodiumScore = 0; // <100mg = little electrolyte contribution
  }
  components.push({
    name: 'Sodium',
    weight: 0.1,
    points: sodiumScore,
    description: sodiumMg > 800 ? `Too high (>800mg) - ${Math.round(sodiumMg)}mg` : sodiumMg >= 300 ? `Ideal (300-800mg) - ${Math.round(sodiumMg)}mg` : sodiumMg >= 100 ? `Moderate (100-299mg) - ${Math.round(sodiumMg)}mg` : `Low (<100mg) - ${Math.round(sodiumMg)}mg`,
  });
  
  // Combine factor scores with weights
  // Carbs 35%, Protein 35%, Fat 10%, Fiber 10%, Sodium 10%
  let totalScore = 0.35 * carbsScore + 0.35 * proteinScore + 0.1 * fatScore + 0.1 * fiberScore + 0.1 * sodiumScore;
  
  // Apply excessive value penalties (linearly scaling)
  const carbsExcessivePenalty = calculateExcessivePenalty(carbsG, 120, 100);
  if (carbsExcessivePenalty > 0) {
    totalScore -= carbsExcessivePenalty;
    components.push({
      name: 'Penalty: Excessive Carbohydrates',
      weight: 0,
      points: -carbsExcessivePenalty,
      description: `Excessive carbs (${Math.round(carbsG)}g exceeds 120g maximum)`,
    });
  }
  
  const proteinExcessivePenalty = calculateExcessivePenalty(proteinG, 50, 100);
  if (proteinExcessivePenalty > 0) {
    totalScore -= proteinExcessivePenalty;
    components.push({
      name: 'Penalty: Excessive Protein',
      weight: 0,
      points: -proteinExcessivePenalty,
      description: `Excessive protein (${Math.round(proteinG)}g exceeds 50g maximum)`,
    });
  }
  
  const sodiumExcessivePenalty = calculateExcessivePenalty(sodiumMg, 800, 100);
  if (sodiumExcessivePenalty > 0) {
    totalScore -= sodiumExcessivePenalty;
    components.push({
      name: 'Penalty: Excessive Sodium',
      weight: 0,
      points: -sodiumExcessivePenalty,
      description: `Excessive sodium (${Math.round(sodiumMg)}mg exceeds 800mg maximum)`,
    });
  }
  
  // Apply penalties (scaled by servings)
  // Artificial sweeteners – Minor penalty
  if (containsAnyIngredient(ingredients, ['sucralose', 'aspartame', 'acesulfame', 'saccharin'])) {
    totalScore -= MINOR_PENALTY * servings;
  }
  
  // Sugar alcohols – Moderate penalty
  if (containsAnyIngredient(ingredients, ['sorbitol', 'xylitol', 'mannitol', 'maltitol', 'erythritol'])) {
    totalScore -= MODERATE_PENALTY * servings;
  }
  
  // Emulsifiers and additives – Moderate penalty
  if (containsAnyIngredient(ingredients, ['polysorbate', 'carboxymethylcellulose', 'carrageenan', 'polyglycerol', 'monoglyceride'])) {
    totalScore -= MODERATE_PENALTY * servings;
  }
  
  // Palm oil – Moderate penalty
  if (containsAnyIngredient(ingredients, ['palm oil', 'palm kernel oil'])) {
    totalScore -= MODERATE_PENALTY * servings;
  }
  
  // Trans fats – Major penalty
  const hasTransFat = (nutrition.transFatG !== null && nutrition.transFatG > 0) ||
    containsAnyIngredient(ingredients, ['partially hydrogenated']);
  if (hasTransFat) {
    totalScore -= MAJOR_PENALTY * servings;
  }
  
  // Note: Excessive caffeine penalty is skipped as caffeine_mg is not available in the data structure
  
  const normalizedScore = Math.max(0, Math.min(100, totalScore));
  
  return {
    context: 'post_run',
    displayName: 'Post-Run Recovery Score',
    score: normalizedScore,
    components,
    applicable: true,
  };
}
