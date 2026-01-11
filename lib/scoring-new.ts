import { ContextScore, ScoringContext, ScoringNutritionData } from '@/types/scoring';
import { clamp } from './scoring-utils';

/**
 * Calculates normalized per-100kcal values
 */
function calculatePer100kcalMetrics(nutrition: ScoringNutritionData): {
  carbsPer100kcal: number;
  proteinPer100kcal: number;
  fatPer100kcal: number;
  sugarPer100kcal: number;
} {
  const calories = nutrition.caloriesKcal || 0;
  
  if (calories > 0) {
    return {
      carbsPer100kcal: (nutrition.carbsG || 0) / (calories / 100.0),
      proteinPer100kcal: (nutrition.proteinG || 0) / (calories / 100.0),
      fatPer100kcal: (nutrition.totalFatG || 0) / (calories / 100.0),
      sugarPer100kcal: (nutrition.sugarsG || 0) / (calories / 100.0),
    };
  }
  
  return {
    carbsPer100kcal: 0,
    proteinPer100kcal: 0,
    fatPer100kcal: 0,
    sugarPer100kcal: 0,
  };
}

/**
 * Scores a product for pre-run fueling
 */
export function scorePreRun(nutrition: ScoringNutritionData): ContextScore {
  const components: any[] = [];
  let score = 0.0;
  
  const { carbsPer100kcal, proteinPer100kcal, fatPer100kcal, sugarPer100kcal } = calculatePer100kcalMetrics(nutrition);
  const proteinG = nutrition.proteinG || 0;
  const fiberG = nutrition.fiberG || 0;
  const sodiumMg = nutrition.sodiumMg || 0;
  
  // Carbs (per 100 kcal): optimal ≥12, moderate 8-12, poor <8
  let carbsPoints = 0.0;
  if (carbsPer100kcal >= 12) {
    carbsPoints = 1.0;
  } else if (carbsPer100kcal >= 8) {
    carbsPoints = 0.5;
  }
  components.push({
    name: 'Carbohydrates (per 100 kcal)',
    weight: 1,
    points: carbsPoints,
    description: 'Optimal ≥12g/100kcal, moderate 8-12g/100kcal',
  });
  score += carbsPoints;
  
  // Protein (absolute per serving): optimal low <=10g
  let proteinPoints = 0.0;
  if (proteinG <= 10) {
    proteinPoints = 1.0;
  } else if (proteinG <= 15) {
    proteinPoints = 0.5;
  }
  components.push({
    name: 'Protein (per serving)',
    weight: 1,
    points: proteinPoints,
    description: 'Optimal ≤10g, moderate 11-15g',
  });
  score += proteinPoints;
  
  // Fat (per 100 kcal): optimal <=3g, moderate 3-4g, poor >4g
  let fatPoints = 0.0;
  if (fatPer100kcal <= 3) {
    fatPoints = 1.0;
  } else if (fatPer100kcal <= 4) {
    fatPoints = 0.5;
  }
  components.push({
    name: 'Fat (per 100 kcal)',
    weight: 1,
    points: fatPoints,
    description: 'Optimal ≤3g/100kcal, moderate 3-4g/100kcal',
  });
  score += fatPoints;
  
  // Fiber (per serving): optimal <=3g, moderate 3-5g, poor >5g
  let fiberPoints = 0.0;
  if (fiberG <= 3) {
    fiberPoints = 1.0;
  } else if (fiberG <= 5) {
    fiberPoints = 0.5;
  }
  components.push({
    name: 'Fiber (per serving)',
    weight: 1,
    points: fiberPoints,
    description: 'Optimal ≤3g, moderate 3-5g',
  });
  score += fiberPoints;
  
  // Sodium (per serving): bonus if 100-300mg, penalty if >500mg
  let sodiumPoints = 0.0;
  if (100 <= sodiumMg && sodiumMg <= 300) {
    sodiumPoints = 0.5;
  } else if (sodiumMg > 500) {
    sodiumPoints = -0.5;
  }
  components.push({
    name: 'Sodium (per serving)',
    weight: 1,
    points: sodiumPoints,
    description: 'Bonus 100-300mg, penalty >500mg',
  });
  score += sodiumPoints;
  
  // Sugars (per 100 kcal): optimal 5-15g, bell curve logic
  let sugarPoints = 0.0;
  if (5 <= sugarPer100kcal && sugarPer100kcal <= 15) {
    sugarPoints = 1.0;
  } else if (sugarPer100kcal > 15 || sugarPer100kcal < 5) {
    sugarPoints = 0.5;
  }
  components.push({
    name: 'Sugars (per 100 kcal)',
    weight: 1,
    points: sugarPoints,
    description: 'Optimal 5-15g/100kcal, partial outside range',
  });
  score += sugarPoints;
  
  // Convert to 0-100 scale (max possible is ~6 points, so multiply by 100/6)
  const normalizedScore = Math.max(0, Math.min(100, (score / 6.0) * 100));
  
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
export function scoreDuringRun(nutrition: ScoringNutritionData): ContextScore {
  const components: any[] = [];
  let score = 0.0;
  
  const { carbsPer100kcal, proteinPer100kcal, fatPer100kcal, sugarPer100kcal } = calculatePer100kcalMetrics(nutrition);
  const proteinG = nutrition.proteinG || 0;
  const fiberG = nutrition.fiberG || 0;
  const sodiumMg = nutrition.sodiumMg || 0;
  
  // Carbs (per 100 kcal): need high
  let carbsPoints = 0.0;
  if (carbsPer100kcal >= 15) {
    carbsPoints = 1.0;
  } else if (carbsPer100kcal >= 10) {
    carbsPoints = 0.5;
  }
  components.push({
    name: 'Carbohydrates (per 100 kcal)',
    weight: 1,
    points: carbsPoints,
    description: 'Optimal ≥15g/100kcal, moderate ≥10g/100kcal',
  });
  score += carbsPoints;
  
  // Protein (per serving): want minimal
  let proteinPoints = 0.0;
  if (proteinG <= 5) {
    proteinPoints = 1.0;
  } else if (proteinG <= 10) {
    proteinPoints = 0.5;
  }
  components.push({
    name: 'Protein (per serving)',
    weight: 1,
    points: proteinPoints,
    description: 'Optimal ≤5g, moderate ≤10g',
  });
  score += proteinPoints;
  
  // Fat (per 100 kcal): want very low
  let fatPoints = 0.0;
  if (fatPer100kcal <= 1.5) {
    fatPoints = 1.0;
  } else if (fatPer100kcal <= 3) {
    fatPoints = 0.5;
  }
  components.push({
    name: 'Fat (per 100 kcal)',
    weight: 1,
    points: fatPoints,
    description: 'Optimal ≤1.5g/100kcal, moderate ≤3g/100kcal',
  });
  score += fatPoints;
  
  // Fiber (per serving): want near-zero
  let fiberPoints = 0.0;
  if (fiberG <= 1) {
    fiberPoints = 1.0;
  } else if (fiberG <= 3) {
    fiberPoints = 0.5;
  }
  components.push({
    name: 'Fiber (per serving)',
    weight: 1,
    points: fiberPoints,
    description: 'Optimal ≤1g, moderate ≤3g',
  });
  score += fiberPoints;
  
  // Sodium (per serving): want some
  let sodiumPoints = 0.0;
  if (sodiumMg >= 100) {
    sodiumPoints = 1.0;
  }
  components.push({
    name: 'Sodium (per serving)',
    weight: 1,
    points: sodiumPoints,
    description: 'Optimal ≥100mg',
  });
  score += sodiumPoints;
  
  // Sugars (per 100 kcal): high sugar content is good
  let sugarPoints = 0.0;
  if (sugarPer100kcal >= 15) {
    sugarPoints = 1.0;
  } else if (sugarPer100kcal >= 8) {
    sugarPoints = 0.5;
  }
  components.push({
    name: 'Sugars (per 100 kcal)',
    weight: 1,
    points: sugarPoints,
    description: 'Optimal ≥15g/100kcal, moderate ≥8g/100kcal',
  });
  score += sugarPoints;
  
  // Convert to 0-100 scale (max possible is ~6 points)
  const normalizedScore = Math.max(0, Math.min(100, (score / 6.0) * 100));
  
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
export function scorePostRun(nutrition: ScoringNutritionData): ContextScore {
  const components: any[] = [];
  let score = 0.0;
  
  const { carbsPer100kcal, proteinPer100kcal, fatPer100kcal, sugarPer100kcal } = calculatePer100kcalMetrics(nutrition);
  const proteinG = nutrition.proteinG || 0;
  const fiberG = nutrition.fiberG || 0;
  const sodiumMg = nutrition.sodiumMg || 0;
  
  // Carbs (per 100 kcal): moderate to high
  let carbsPoints = 0.0;
  if (carbsPer100kcal >= 8) {
    carbsPoints = 1.0;
  } else if (carbsPer100kcal >= 5) {
    carbsPoints = 0.5;
  }
  components.push({
    name: 'Carbohydrates (per 100 kcal)',
    weight: 1,
    points: carbsPoints,
    description: 'Optimal ≥8g/100kcal, moderate ≥5g/100kcal',
  });
  score += carbsPoints;
  
  // Protein (per serving): high absolute amount needed
  let proteinPoints = 0.0;
  if (proteinG >= 20) {
    proteinPoints = 1.0;
  } else if (proteinG >= 15) {
    proteinPoints = 0.5;
  }
  components.push({
    name: 'Protein (per serving)',
    weight: 1,
    points: proteinPoints,
    description: 'Optimal ≥20g, good 15-19g',
  });
  score += proteinPoints;
  
  // Fat (per 100 kcal): allow moderate fat
  let fatPoints = 0.0;
  if (fatPer100kcal <= 4) {
    fatPoints = 1.0;
  } else {
    fatPoints = 0.5; // partial credit if >4g/100kcal
  }
  components.push({
    name: 'Fat (per 100 kcal)',
    weight: 1,
    points: fatPoints,
    description: 'Optimal ≤4g/100kcal, partial >4g/100kcal',
  });
  score += fatPoints;
  
  // Fiber (per serving): not crucial, only penalize if very high
  let fiberPoints = 0.0;
  if (fiberG <= 5) {
    fiberPoints = 1.0;
  } else if (fiberG <= 10) {
    fiberPoints = 0.5;
  }
  components.push({
    name: 'Fiber (per serving)',
    weight: 1,
    points: fiberPoints,
    description: 'Optimal ≤5g, moderate ≤10g',
  });
  score += fiberPoints;
  
  // Sodium (per serving): bonus for presence
  let sodiumPoints = 0.0;
  if (sodiumMg >= 150) {
    sodiumPoints = 0.5;
  }
  if (sodiumMg >= 400) {
    sodiumPoints = 0.5; // cap at 0.5 total
  }
  components.push({
    name: 'Sodium (per serving)',
    weight: 1,
    points: sodiumPoints,
    description: 'Bonus ≥150mg (capped at 0.5)',
  });
  score += sodiumPoints;
  
  // Sugars (per 100 kcal): give credit if high
  let sugarPoints = 0.0;
  if (sugarPer100kcal >= 10) {
    sugarPoints = 1.0;
  } else if (sugarPer100kcal >= 5) {
    sugarPoints = 0.5;
  }
  components.push({
    name: 'Sugars (per 100 kcal)',
    weight: 1,
    points: sugarPoints,
    description: 'Optimal ≥10g/100kcal, moderate ≥5g/100kcal',
  });
  score += sugarPoints;
  
  // Convert to 0-100 scale (max possible is ~6 points)
  const normalizedScore = Math.max(0, Math.min(100, (score / 6.0) * 100));
  
  return {
    context: 'post_run',
    displayName: 'Post-Run Recovery Score',
    score: normalizedScore,
    components,
    applicable: true,
  };
}
