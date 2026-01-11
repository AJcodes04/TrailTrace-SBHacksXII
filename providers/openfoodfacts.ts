import { NutritionLookupResult } from '@/types/nutrition';

interface OpenFoodFactsProduct {
  code?: string;
  status?: number;
  product?: {
    product_name?: string;
    brands?: string;
    image_url?: string;
    image_front_url?: string;
    ingredients_text?: string;
    nutriments?: {
      'energy-kcal_serving'?: number;
      'energy-kcal_100g'?: number;
      'fat_serving'?: number;
      'fat_100g'?: number;
      'saturated-fat_serving'?: number;
      'saturated-fat_100g'?: number;
      'trans-fat_serving'?: number;
      'trans-fat_100g'?: number;
      'carbohydrates_serving'?: number;
      'carbohydrates_100g'?: number;
      'fiber_serving'?: number;
      'fiber_100g'?: number;
      'sugars_serving'?: number;
      'sugars_100g'?: number;
      'proteins_serving'?: number;
      'proteins_100g'?: number;
      'sodium_serving'?: number;
      'sodium_100g'?: number;
      'cholesterol_serving'?: number;
      'cholesterol_100g'?: number;
    };
    serving_size?: string;
  };
}

/**
 * Fetches product data from Open Food Facts API
 */
export async function fetchOpenFoodFacts(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ProteinTST/1.0 (https://github.com/yourusername/proteintst)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // Check if product was found (status 1 means found, 0 means not found)
    if (data.status === 0 || !data.product) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('Open Food Facts fetch error:', error);
    return null;
  }
}

/**
 * Maps Open Food Facts response to normalized NutritionLookupResult
 */
export function mapOpenFoodFactsToResult(
  barcode: string,
  normalizedBarcode: string,
  rawData: OpenFoodFactsProduct | null
): NutritionLookupResult | null {
  if (!rawData || !rawData.product) {
    return null;
  }

  const product = rawData.product;
  const nutriments = product.nutriments || {};
  const warnings: string[] = [];

  // Prefer serving values when present, otherwise use per-100g
  const getServingOrPer100g = (servingKey: string, per100gKey: string): number | null => {
    if (nutriments[servingKey] != null) {
      return nutriments[servingKey];
    }
    if (nutriments[per100gKey] != null) {
      return nutriments[per100gKey];
    }
    return null;
  };

  const caloriesKcal = getServingOrPer100g('energy-kcal_serving', 'energy-kcal_100g');
  const fatG = getServingOrPer100g('fat_serving', 'fat_100g');
  const satFatG = getServingOrPer100g('saturated-fat_serving', 'saturated-fat_100g');
  const transFatG = getServingOrPer100g('trans-fat_serving', 'trans-fat_100g');
  const carbsG = getServingOrPer100g('carbohydrates_serving', 'carbohydrates_100g');
  const fiberG = getServingOrPer100g('fiber_serving', 'fiber_100g');
  const sugarsG = getServingOrPer100g('sugars_serving', 'sugars_100g');
  const proteinG = getServingOrPer100g('proteins_serving', 'proteins_100g');
  const sodiumMg = getServingOrPer100g('sodium_serving', 'sodium_100g');
    // Sodium in OFF is typically in g, convert to mg
  const sodiumMgConverted = sodiumMg != null ? sodiumMg * 1000 : null;
  const cholesterolMg = getServingOrPer100g('cholesterol_serving', 'cholesterol_100g');
  // Cholesterol in OFF is typically in g, convert to mg
  const cholesterolMgConverted = cholesterolMg != null ? cholesterolMg * 1000 : null;

  // Check if we have meaningful nutrition data
  const hasNutritionData = caloriesKcal != null || fatG != null || carbsG != null || proteinG != null;
  
  if (!hasNutritionData) {
    warnings.push('Product found but no nutrition data available');
  }

  // Per 100g values
  const caloriesPer100g = nutriments['energy-kcal_100g'] ?? null;
  const fatPer100g = nutriments['fat_100g'] ?? null;
  const carbsPer100g = nutriments['carbohydrates_100g'] ?? null;
  const proteinPer100g = nutriments['proteins_100g'] ?? null;
  const sodiumPer100g = nutriments['sodium_100g'] != null ? nutriments['sodium_100g'] * 1000 : null;

  return {
    ok: true,
    barcode,
    normalizedBarcode,
    product: {
      name: product.product_name || null,
      brand: product.brands || null,
      imageUrl: product.image_front_url || product.image_url || null,
      ingredients: product.ingredients_text || null,
    },
    nutrition: {
      serving: {
        servingSize: product.serving_size || null,
        caloriesKcal,
        fatG,
        satFatG,
        transFatG,
        carbsG,
        fiberG,
        sugarsG,
        addedSugarsG: null, // OFF doesn't always distinguish added sugars
        proteinG,
        sodiumMg: sodiumMgConverted,
        cholesterolMg: cholesterolMgConverted,
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
      provider: 'openfoodfacts',
      providerProductUrl: rawData.product ? `https://world.openfoodfacts.org/product/${barcode}` : null,
      retrievedAtIso: new Date().toISOString(),
    },
    warnings,
    raw: {
      openFoodFacts: rawData,
      usdaFdc: null,
    },
    error: {
      code: null,
      message: null,
    },
  };
}
