import { NutritionLookupResult } from '@/types/nutrition';
import { ScoringNutritionData } from '@/types/scoring';
import { calculateServingWeightG } from './scoring-utils';

export interface NutritionItem {
  barcode: string;
  servings: number;
}

export interface CombinedNutritionResult {
  ok: boolean;
  items: Array<{
    barcode: string;
    servings: number;
    result: NutritionLookupResult;
  }>;
  combined: NutritionLookupResult | null;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Combines multiple nutrition lookup results into a single result
 * Scales each item by its servings count and sums the nutrition values
 */
export function combineNutritionResults(
  items: Array<{ barcode: string; servings: number; result: NutritionLookupResult }>
): NutritionLookupResult | null {
  // Filter out failed results - we need at least one successful result
  const validItems = items.filter(item => item.result.ok);
  
  if (validItems.length === 0) {
    return null;
  }

  // Use the first valid item as a template for structure
  const firstItem = validItems[0].result;
  
  // Combine product information (use first item's product info, or combine names/brands)
  const productNames = validItems
    .map(item => item.result.product.name)
    .filter(name => name !== null) as string[];
  const productBrands = validItems
    .map(item => item.result.product.brand)
    .filter(brand => brand !== null) as string[];
  
  // Combine ingredients (join with ", " and remove duplicates)
  const allIngredients = validItems
    .map(item => item.result.product.ingredients)
    .filter(ing => ing !== null && ing.trim() !== '') as string[];
  const combinedIngredients = allIngredients.length > 0 
    ? allIngredients.join(', ') 
    : null;

  // Combine serving nutrition (scale by servings and sum)
  let combinedCalories = 0;
  let combinedFatG = 0;
  let combinedSatFatG = 0;
  let combinedTransFatG = 0;
  let combinedCarbsG = 0;
  let combinedFiberG = 0;
  let combinedSugarsG = 0;
  let combinedAddedSugarsG = 0;
  let combinedProteinG = 0;
  let combinedSodiumMg = 0;
  let combinedCholesterolMg = 0;
  
  let hasAnyCalories = false;
  let hasAnyFat = false;
  let hasAnySatFat = false;
  let hasAnyTransFat = false;
  let hasAnyCarbs = false;
  let hasAnyFiber = false;
  let hasAnySugars = false;
  let hasAnyAddedSugars = false;
  let hasAnyProtein = false;
  let hasAnySodium = false;
  let hasAnyCholesterol = false;

  for (const item of validItems) {
    const serving = item.result.nutrition.serving;
    const multiplier = item.servings;

    if (serving.caloriesKcal !== null) {
      combinedCalories += serving.caloriesKcal * multiplier;
      hasAnyCalories = true;
    }
    if (serving.fatG !== null) {
      combinedFatG += serving.fatG * multiplier;
      hasAnyFat = true;
    }
    if (serving.satFatG !== null) {
      combinedSatFatG += serving.satFatG * multiplier;
      hasAnySatFat = true;
    }
    if (serving.transFatG !== null) {
      combinedTransFatG += serving.transFatG * multiplier;
      hasAnyTransFat = true;
    }
    if (serving.carbsG !== null) {
      combinedCarbsG += serving.carbsG * multiplier;
      hasAnyCarbs = true;
    }
    if (serving.fiberG !== null) {
      combinedFiberG += serving.fiberG * multiplier;
      hasAnyFiber = true;
    }
    if (serving.sugarsG !== null) {
      combinedSugarsG += serving.sugarsG * multiplier;
      hasAnySugars = true;
    }
    if (serving.addedSugarsG !== null) {
      combinedAddedSugarsG += serving.addedSugarsG * multiplier;
      hasAnyAddedSugars = true;
    }
    if (serving.proteinG !== null) {
      combinedProteinG += serving.proteinG * multiplier;
      hasAnyProtein = true;
    }
    if (serving.sodiumMg !== null) {
      combinedSodiumMg += serving.sodiumMg * multiplier;
      hasAnySodium = true;
    }
    if (serving.cholesterolMg !== null) {
      combinedCholesterolMg += serving.cholesterolMg * multiplier;
      hasAnyCholesterol = true;
    }
  }

  // Calculate per100g values (weighted average based on serving weights)
  // For simplicity, we'll calculate per100g based on combined totals
  // This is an approximation - ideally we'd weight by actual serving weights
  let combinedPer100gCalories = 0;
  let combinedPer100gFat = 0;
  let combinedPer100gCarbs = 0;
  let combinedPer100gProtein = 0;
  let combinedPer100gSodium = 0;
  
  let hasAnyPer100gCalories = false;
  let hasAnyPer100gFat = false;
  let hasAnyPer100gCarbs = false;
  let hasAnyPer100gProtein = false;
  let hasAnyPer100gSodium = false;

  // Sum up total weight (approximate - using per100g as proxy for density)
  // Also calculate total serving weight using servingSize parsing where possible
  let totalWeight = 0;
  let totalServingWeightG = 0;
  
  for (const item of validItems) {
    const per100g = item.result.nutrition.per100g;
    const serving = item.result.nutrition.serving;
    
    // Try to estimate weight from servingSize first (more accurate)
    const servingWeightG = calculateServingWeightG(serving.servingSize);
    if (servingWeightG !== null) {
      totalServingWeightG += servingWeightG * item.servings;
    }
    
    // Fallback: Estimate weight from calories (rough approximation: ~200 cal per 100g average)
    if (per100g.caloriesKcal !== null && per100g.caloriesKcal > 0) {
      if (serving.caloriesKcal !== null) {
        const estimatedWeight = (serving.caloriesKcal / per100g.caloriesKcal) * 100 * item.servings;
        totalWeight += estimatedWeight;
      }
    }
  }
  
  // Prefer servingWeightG calculation if available
  if (totalServingWeightG > 0) {
    totalWeight = totalServingWeightG;
  }

  if (totalWeight > 0) {
    for (const item of validItems) {
      const per100g = item.result.nutrition.per100g;
      const serving = item.result.nutrition.serving;
      const multiplier = item.servings;
      
      // Estimate weight for this item - prefer servingSize calculation
      let itemWeight = 0;
      const servingWeightG = calculateServingWeightG(serving.servingSize);
      if (servingWeightG !== null) {
        itemWeight = servingWeightG * multiplier;
      } else if (per100g.caloriesKcal !== null && per100g.caloriesKcal > 0 && serving.caloriesKcal !== null) {
        itemWeight = (serving.caloriesKcal / per100g.caloriesKcal) * 100 * multiplier;
      }
      
      if (itemWeight > 0 && totalWeight > 0) {
        const weightRatio = itemWeight / totalWeight;
        
        if (per100g.caloriesKcal !== null) {
          combinedPer100gCalories += per100g.caloriesKcal * weightRatio;
          hasAnyPer100gCalories = true;
        }
        if (per100g.fatG !== null) {
          combinedPer100gFat += per100g.fatG * weightRatio;
          hasAnyPer100gFat = true;
        }
        if (per100g.carbsG !== null) {
          combinedPer100gCarbs += per100g.carbsG * weightRatio;
          hasAnyPer100gCarbs = true;
        }
        if (per100g.proteinG !== null) {
          combinedPer100gProtein += per100g.proteinG * weightRatio;
          hasAnyPer100gProtein = true;
        }
        if (per100g.sodiumMg !== null) {
          combinedPer100gSodium += per100g.sodiumMg * weightRatio;
          hasAnyPer100gSodium = true;
        }
      }
    }
  }

  // Create combined serving size string
  // Try to use actual weight if we calculated it, otherwise use servings count
  const totalServings = validItems.reduce((sum, item) => sum + item.servings, 0);
  let combinedServingSize: string | null;
  
  if (totalWeight > 0) {
    // Use actual weight in grams (rounded to nearest gram)
    combinedServingSize = `${Math.round(totalWeight)}g`;
  } else {
    // Fallback to servings count (less ideal but better than nothing)
    combinedServingSize = `${totalServings} serving${totalServings !== 1 ? 's' : ''}`;
  }

  // Build combined result
  const combined: NutritionLookupResult = {
    ok: true,
    barcode: validItems.map(item => item.barcode).join('+'),
    normalizedBarcode: validItems.map(item => item.result.normalizedBarcode).join('+'),
    product: {
      name: productNames.length > 0 ? productNames.join(' + ') : firstItem.product.name,
      brand: productBrands.length > 0 ? productBrands.join(' + ') : firstItem.product.brand,
      imageUrl: firstItem.product.imageUrl, // Use first item's image
      ingredients: combinedIngredients,
    },
    nutrition: {
      serving: {
        servingSize: combinedServingSize,
        caloriesKcal: hasAnyCalories ? combinedCalories : null,
        fatG: hasAnyFat ? combinedFatG : null,
        satFatG: hasAnySatFat ? combinedSatFatG : null,
        transFatG: hasAnyTransFat ? combinedTransFatG : null,
        carbsG: hasAnyCarbs ? combinedCarbsG : null,
        fiberG: hasAnyFiber ? combinedFiberG : null,
        sugarsG: hasAnySugars ? combinedSugarsG : null,
        addedSugarsG: hasAnyAddedSugars ? combinedAddedSugarsG : null,
        proteinG: hasAnyProtein ? combinedProteinG : null,
        sodiumMg: hasAnySodium ? combinedSodiumMg : null,
        cholesterolMg: hasAnyCholesterol ? combinedCholesterolMg : null,
      },
      per100g: {
        caloriesKcal: hasAnyPer100gCalories ? combinedPer100gCalories : null,
        fatG: hasAnyPer100gFat ? combinedPer100gFat : null,
        carbsG: hasAnyPer100gCarbs ? combinedPer100gCarbs : null,
        proteinG: hasAnyPer100gProtein ? combinedPer100gProtein : null,
        sodiumMg: hasAnyPer100gSodium ? combinedPer100gSodium : null,
      },
    },
    source: {
      provider: firstItem.source.provider, // Use first item's provider
      providerProductUrl: firstItem.source.providerProductUrl,
      retrievedAtIso: new Date().toISOString(),
    },
    warnings: [...new Set(validItems.flatMap(item => item.result.warnings))], // Combine and deduplicate warnings
    raw: {
      openFoodFacts: null, // Don't store raw data for combined results
      usdaFdc: null,
    },
    error: {
      code: null,
      message: null,
    },
  };

  return combined;
}
