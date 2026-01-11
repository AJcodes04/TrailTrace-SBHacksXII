import { NutritionLookupResult } from '@/types/nutrition';

interface USDASearchResult {
  foods?: Array<{
    fdcId: number;
    description: string;
    brandOwner?: string;
    brandName?: string;
    gtinUpc?: string;
  }>;
  totalHits?: number;
}

interface USDALabelNutrients {
  fat?: { value: number };
  saturatedFat?: { value: number };
  transFat?: { value: number };
  cholesterol?: { value: number };
  sodium?: { value: number };
  carbohydrates?: { value: number };
  fiber?: { value: number };
  sugars?: { value: number };
  addedSugars?: { value: number };
  protein?: { value: number };
  calories?: { value: number };
  iron?: { value: number };
  calcium?: { value: number };
  potassium?: { value: number };
}

interface USDAFoodDetail {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  labelNutrients?: USDALabelNutrients;
  foodNutrients?: Array<{
    nutrient?: {
      id?: number;
      name?: string;
      unitName?: string;
    };
    amount?: number;
  }>;
}

/**
 * Searches USDA FoodData Central for branded foods by barcode
 */
export async function searchUSDAByBarcode(barcode: string, apiKey: string): Promise<USDASearchResult | null> {
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=10`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('USDA search error:', error);
    return null;
  }
}

/**
 * Fetches detailed food data from USDA FoodData Central by FDC ID
 */
export async function fetchUSDAFoodDetail(fdcId: number, apiKey: string): Promise<USDAFoodDetail | null> {
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('USDA food detail fetch error:', error);
    return null;
  }
}

/**
 * Finds a food in USDA search results that matches the barcode
 */
function findMatchingFood(searchResults: USDASearchResult, barcode: string): { fdcId: number; description: string; brandOwner?: string; brandName?: string } | null {
  if (!searchResults.foods || searchResults.foods.length === 0) {
    return null;
  }

  // Try exact barcode match first
  for (const food of searchResults.foods) {
    if (food.gtinUpc === barcode) {
      return {
        fdcId: food.fdcId,
        description: food.description,
        brandOwner: food.brandOwner,
        brandName: food.brandName,
      };
    }
  }

  // Fallback to first result (barcode might be in description or other fields)
  const firstFood = searchResults.foods[0];
  return {
    fdcId: firstFood.fdcId,
    description: firstFood.description,
    brandOwner: firstFood.brandOwner,
    brandName: firstFood.brandName,
  };
}

/**
 * Maps USDA FoodData Central response to normalized NutritionLookupResult
 */
export async function mapUSDAToResult(
  barcode: string,
  normalizedBarcode: string,
  apiKey: string
): Promise<NutritionLookupResult | null> {
  try {
    // Step 1: Search for foods by barcode
    const searchResults = await searchUSDAByBarcode(barcode, apiKey);
    if (!searchResults || !searchResults.foods || searchResults.foods.length === 0) {
      return null;
    }

    // Step 2: Find matching food
    const matchingFood = findMatchingFood(searchResults, barcode);
    if (!matchingFood) {
      return null;
    }

    // Step 3: Fetch detailed food data
    const foodDetail = await fetchUSDAFoodDetail(matchingFood.fdcId, apiKey);
    if (!foodDetail) {
      return null;
    }

    const warnings: string[] = [];
    const labelNutrients = foodDetail.labelNutrients || {};

    // USDA labelNutrients values are typically per serving
    // Prefer labelNutrients when present as they match nutrition labels
    const servingSize = foodDetail.servingSize != null && foodDetail.servingSizeUnit
      ? `${foodDetail.servingSize} ${foodDetail.servingSizeUnit}`
      : null;

    // Helper to extract value from labelNutrient
    const getLabelNutrientValue = (nutrient: { value: number } | undefined): number | null => {
      return nutrient?.value != null ? nutrient.value : null;
    };

    const caloriesKcal = getLabelNutrientValue(labelNutrients.calories);
    const fatG = getLabelNutrientValue(labelNutrients.fat);
    const satFatG = getLabelNutrientValue(labelNutrients.saturatedFat);
    const transFatG = getLabelNutrientValue(labelNutrients.transFat);
    const carbsG = getLabelNutrientValue(labelNutrients.carbohydrates);
    const fiberG = getLabelNutrientValue(labelNutrients.fiber);
    const sugarsG = getLabelNutrientValue(labelNutrients.sugars);
    const addedSugarsG = getLabelNutrientValue(labelNutrients.addedSugars);
    const proteinG = getLabelNutrientValue(labelNutrients.protein);
    const sodiumMg = getLabelNutrientValue(labelNutrients.sodium); // Already in mg
    const cholesterolMg = getLabelNutrientValue(labelNutrients.cholesterol); // Already in mg

    // Check if we have meaningful nutrition data
    const hasNutritionData = caloriesKcal != null || fatG != null || carbsG != null || proteinG != null;
    
    if (!hasNutritionData) {
      warnings.push('Product found but no nutrition data available');
    }

    // Calculate per 100g values if serving size is known
    // Note: This is a simplification. For accurate per 100g, we'd need to parse serving size
    // and calculate, but for now we'll leave per100g mostly null and let downstream calculate
    let caloriesPer100g: number | null = null;
    let fatPer100g: number | null = null;
    let carbsPer100g: number | null = null;
    let proteinPer100g: number | null = null;
    let sodiumPer100g: number | null = null;

    if (foodDetail.servingSize != null && foodDetail.servingSize > 0) {
      // Try to calculate per 100g if serving size is in grams
      if (foodDetail.servingSizeUnit?.toLowerCase().includes('g')) {
        const servingSizeG = foodDetail.servingSize;
        const factor = 100 / servingSizeG;
        
        caloriesPer100g = caloriesKcal != null ? Math.round(caloriesKcal * factor) : null;
        fatPer100g = fatG != null ? Math.round(fatG * factor * 10) / 10 : null;
        carbsPer100g = carbsG != null ? Math.round(carbsG * factor * 10) / 10 : null;
        proteinPer100g = proteinG != null ? Math.round(proteinG * factor * 10) / 10 : null;
        sodiumPer100g = sodiumMg != null ? Math.round(sodiumMg * factor) : null;
      }
    }

    return {
      ok: true,
      barcode,
      normalizedBarcode,
      product: {
        name: foodDetail.description || matchingFood.description || null,
        brand: foodDetail.brandName || foodDetail.brandOwner || matchingFood.brandName || matchingFood.brandOwner || null,
        imageUrl: null, // USDA doesn't provide images
        ingredients: null, // USDA FDC doesn't provide ingredients data
      },
      nutrition: {
        serving: {
          servingSize,
          caloriesKcal,
          fatG,
          satFatG,
          transFatG,
          carbsG,
          fiberG,
          sugarsG,
          addedSugarsG,
          proteinG,
          sodiumMg,
          cholesterolMg,
        },
        per100g: {
          caloriesKcal: caloriesPer100g,
          fatG: fatPer100g,
          carbsG: carbsPer100g,
          proteinG: proteinPer100g,
          sodiumMg: sodiumPer100g,
        },
      },
      source: {
        provider: 'usda_fdc',
        providerProductUrl: foodDetail.fdcId ? `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${foodDetail.fdcId}/nutrients` : null,
        retrievedAtIso: new Date().toISOString(),
      },
      warnings,
      raw: {
        openFoodFacts: null,
        usdaFdc: foodDetail,
      },
      error: {
        code: null,
        message: null,
      },
    };
  } catch (error) {
    console.error('USDA mapping error:', error);
    return null;
  }
}
