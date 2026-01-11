import { Flag, ScoringContext, ScoringNutritionData } from '@/types/scoring';
import { containsAnyIngredient } from './scoring-utils';

/**
 * Detects all flags for a product based on nutrition data and ingredients
 */
export function detectFlags(
  nutrition: ScoringNutritionData,
  ingredients: string | null
): Flag[] {
  const flags: Flag[] = [];

  // High Fiber (GI caution) - applies to pre_run and during_run
  if (nutrition.fiberG !== null && nutrition.fiberG >= 5) {
    flags.push({
      name: 'High Fiber (GI caution)',
      severity: 'caution',
      message: 'High fiber content (>=5 g) – may cause gastrointestinal discomfort if consumed close to or during running.',
      appliesTo: ['pre_run', 'during_run'],
    });
  }

  // High Fat (GI caution) - applies to pre_run and during_run
  if (nutrition.totalFatG !== null && nutrition.totalFatG >= 15) {
    flags.push({
      name: 'High Fat (GI caution)',
      severity: 'caution',
      message: 'High fat content – may slow digestion and cause GI issues during exercise.',
      appliesTo: ['pre_run', 'during_run'],
    });
  }

  // High Protein (Potential GI load) - applies to pre_run and during_run
  if (nutrition.proteinG !== null && nutrition.proteinG >= 20) {
    flags.push({
      name: 'High Protein (Potential GI load)',
      severity: 'caution',
      message: 'Very high protein for a pre/during-run food – might be hard to digest during exercise.',
      appliesTo: ['pre_run', 'during_run'],
    });
  }

  // Contains Caffeine
  if (ingredients) {
    const caffeinePattern = /\bcaffeine\b|guarana|matcha|coffee/i;
    if (caffeinePattern.test(ingredients)) {
      flags.push({
        name: 'Contains Caffeine',
        severity: 'info',
        message: 'Contains caffeine – may enhance alertness/performance for some, but can cause jitters or GI issues in others.',
        appliesTo: ['pre_run', 'during_run', 'post_run'],
      });
    }
  }

  // Good Electrolyte Source
  if (nutrition.sodiumMg !== null && nutrition.sodiumMg >= 300) {
    flags.push({
      name: 'Good Electrolyte Source',
      severity: 'info',
      message: 'High sodium/electrolyte content – can help maintain/replenish hydration (useful for sweat loss).',
      appliesTo: ['pre_run', 'during_run', 'post_run'],
    });
  }

  // Penalty flags (context-specific)
  
  // Artificial sweeteners – Pre-run and During-run: Moderate, Post-run: Minor
  if (containsAnyIngredient(ingredients, ['sucralose', 'aspartame', 'acesulfame', 'saccharin'])) {
    flags.push({
      name: 'Contains Artificial Sweeteners',
      severity: 'caution',
      message: 'Contains artificial sweeteners – may disrupt gut microbiota or cause GI discomfort.',
      appliesTo: ['pre_run', 'during_run', 'post_run'],
    });
  }
  
  // Sugar alcohols – Major penalty for all contexts
  if (containsAnyIngredient(ingredients, ['sorbitol', 'xylitol', 'mannitol', 'maltitol', 'erythritol'])) {
    flags.push({
      name: 'Contains Sugar Alcohols',
      severity: 'caution',
      message: 'Contains sugar alcohols – can cause gas, bloating, or diarrhea, especially problematic before or during exercise.',
      appliesTo: ['pre_run', 'during_run', 'post_run'],
    });
  }
  
  // Emulsifiers and additives – Moderate penalty for all contexts
  if (containsAnyIngredient(ingredients, ['polysorbate', 'carboxymethylcellulose', 'carrageenan', 'polyglycerol', 'monoglyceride'])) {
    flags.push({
      name: 'Contains Emulsifiers',
      severity: 'caution',
      message: 'Contains emulsifiers – may impair gut integrity and contribute to intestinal inflammation.',
      appliesTo: ['pre_run', 'during_run', 'post_run'],
    });
  }
  
  // Palm oil – Moderate penalty for all contexts
  if (containsAnyIngredient(ingredients, ['palm oil', 'palm kernel oil'])) {
    flags.push({
      name: 'Contains Palm Oil',
      severity: 'caution',
      message: 'Contains palm oil – high in saturated fat, slows digestion and may negatively impact cardiovascular health.',
      appliesTo: ['pre_run', 'during_run', 'post_run'],
    });
  }
  
  // Trans fats – Major penalty for all contexts
  const hasTransFat = (nutrition.transFatG !== null && nutrition.transFatG > 0) ||
    containsAnyIngredient(ingredients, ['partially hydrogenated']);
  if (hasTransFat) {
    flags.push({
      name: 'Contains Trans Fats',
      severity: 'caution',
      message: 'Contains trans fats – serious health risks with no performance benefit. Linked to heart disease and inflammation.',
      appliesTo: ['pre_run', 'during_run', 'post_run'],
    });
  }
  
  // Note: Excessive caffeine flags are not added as caffeine_mg is not available in the data structure

  return flags;
}
