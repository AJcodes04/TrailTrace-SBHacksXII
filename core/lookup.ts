import { NutritionLookupResult, ErrorCode } from '@/types/nutrition';
import { normalizeBarcode } from '@/utils/barcode';
import { fetchOpenFoodFacts, mapOpenFoodFactsToResult } from '@/providers/openfoodfacts';
import { mapUSDAToResult } from '@/providers/usda-fdc';

// Simple in-memory cache
const cache = new Map<string, { result: NutritionLookupResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a NOT_FOUND result
 */
function createNotFoundResult(barcode: string, normalizedBarcode: string): NutritionLookupResult {
  return {
    ok: false,
    barcode,
    normalizedBarcode,
    product: {
      name: null,
      brand: null,
      imageUrl: null,
      ingredients: null,
    },
    nutrition: {
      serving: {
        servingSize: null,
        caloriesKcal: null,
        fatG: null,
        satFatG: null,
        transFatG: null,
        carbsG: null,
        fiberG: null,
        sugarsG: null,
        addedSugarsG: null,
        proteinG: null,
        sodiumMg: null,
        cholesterolMg: null,
      },
      per100g: {
        caloriesKcal: null,
        fatG: null,
        carbsG: null,
        proteinG: null,
        sodiumMg: null,
      },
    },
    source: {
      provider: 'none',
      providerProductUrl: null,
      retrievedAtIso: new Date().toISOString(),
    },
    warnings: [],
    raw: {
      openFoodFacts: null,
      usdaFdc: null,
    },
    error: {
      code: 'NOT_FOUND',
      message: `No nutrition data found for barcode: ${barcode}`,
    },
  };
}

/**
 * Creates an INVALID_BARCODE result
 */
function createInvalidBarcodeResult(barcode: string): NutritionLookupResult {
  return {
    ok: false,
    barcode,
    normalizedBarcode: barcode,
    product: {
      name: null,
      brand: null,
      imageUrl: null,
      ingredients: null,
    },
    nutrition: {
      serving: {
        servingSize: null,
        caloriesKcal: null,
        fatG: null,
        satFatG: null,
        transFatG: null,
        carbsG: null,
        fiberG: null,
        sugarsG: null,
        addedSugarsG: null,
        proteinG: null,
        sodiumMg: null,
        cholesterolMg: null,
      },
      per100g: {
        caloriesKcal: null,
        fatG: null,
        carbsG: null,
        proteinG: null,
        sodiumMg: null,
      },
    },
    source: {
      provider: 'none',
      providerProductUrl: null,
      retrievedAtIso: new Date().toISOString(),
    },
    warnings: [],
    raw: {
      openFoodFacts: null,
      usdaFdc: null,
    },
    error: {
      code: 'INVALID_BARCODE',
      message: `Invalid barcode format: ${barcode}. Expected 8, 12, 13, or 14 digits.`,
    },
  };
}

/**
 * Creates an UPSTREAM_ERROR result
 */
function createUpstreamErrorResult(
  barcode: string,
  normalizedBarcode: string,
  message: string
): NutritionLookupResult {
  return {
    ok: false,
    barcode,
    normalizedBarcode,
    product: {
      name: null,
      brand: null,
      imageUrl: null,
      ingredients: null,
    },
    nutrition: {
      serving: {
        servingSize: null,
        caloriesKcal: null,
        fatG: null,
        satFatG: null,
        transFatG: null,
        carbsG: null,
        fiberG: null,
        sugarsG: null,
        addedSugarsG: null,
        proteinG: null,
        sodiumMg: null,
        cholesterolMg: null,
      },
      per100g: {
        caloriesKcal: null,
        fatG: null,
        carbsG: null,
        proteinG: null,
        sodiumMg: null,
      },
    },
    source: {
      provider: 'none',
      providerProductUrl: null,
      retrievedAtIso: new Date().toISOString(),
    },
    warnings: [message],
    raw: {
      openFoodFacts: null,
      usdaFdc: null,
    },
    error: {
      code: 'UPSTREAM_ERROR',
      message,
    },
  };
}

/**
 * Creates a CONFIG_ERROR result
 */
function createConfigErrorResult(
  barcode: string,
  normalizedBarcode: string,
  message: string
): NutritionLookupResult {
  return {
    ok: false,
    barcode,
    normalizedBarcode,
    product: {
      name: null,
      brand: null,
      imageUrl: null,
      ingredients: null,
    },
    nutrition: {
      serving: {
        servingSize: null,
        caloriesKcal: null,
        fatG: null,
        satFatG: null,
        transFatG: null,
        carbsG: null,
        fiberG: null,
        sugarsG: null,
        addedSugarsG: null,
        proteinG: null,
        sodiumMg: null,
        cholesterolMg: null,
      },
      per100g: {
        caloriesKcal: null,
        fatG: null,
        carbsG: null,
        proteinG: null,
        sodiumMg: null,
      },
    },
    source: {
      provider: 'none',
      providerProductUrl: null,
      retrievedAtIso: new Date().toISOString(),
    },
    warnings: [],
    raw: {
      openFoodFacts: null,
      usdaFdc: null,
    },
    error: {
      code: 'CONFIG_ERROR',
      message,
    },
  };
}

/**
 * Checks if a result has meaningful nutrition data
 */
function hasMeaningfulNutritionData(result: NutritionLookupResult): boolean {
  const { nutrition } = result;
  return (
    nutrition.serving.caloriesKcal != null ||
    nutrition.serving.fatG != null ||
    nutrition.serving.carbsG != null ||
    nutrition.serving.proteinG != null
  );
}

/**
 * Core lookup function that orchestrates providers with fallback
 */
export async function lookupNutrition(barcode: string): Promise<NutritionLookupResult> {
  // Step 1: Normalize barcode
  const normalization = normalizeBarcode(barcode);
  if (!normalization) {
    return createInvalidBarcodeResult(barcode);
  }

  const { normalized, candidates } = normalization;

  // Step 2: Check cache
  const cacheKey = normalized;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.result, barcode }; // Return cached result but preserve original barcode
  }

  // Step 3: Try Open Food Facts first (no API key required)
  for (const candidate of candidates) {
    try {
      const rawData = await fetchOpenFoodFacts(candidate);
      if (rawData) {
        const result = mapOpenFoodFactsToResult(barcode, normalized, rawData);
        if (result && hasMeaningfulNutritionData(result)) {
          // Cache the result
          cache.set(cacheKey, { result, timestamp: Date.now() });
          return result;
        }
      }
    } catch (error) {
      console.error(`Open Food Facts lookup failed for ${candidate}:`, error);
      // Continue to next candidate/provider
    }
  }

  // Step 4: Fallback to USDA FoodData Central (requires API key)
  const usdaApiKey = process.env.USDA_FDC_API_KEY;
  if (!usdaApiKey) {
    // If no API key, return NOT_FOUND with a warning
    const result = createNotFoundResult(barcode, normalized);
    result.warnings.push('USDA FoodData Central API key not configured; fallback unavailable');
    return result;
  }

  for (const candidate of candidates) {
    try {
      const result = await mapUSDAToResult(barcode, normalized, usdaApiKey);
      if (result && hasMeaningfulNutritionData(result)) {
        // Cache the result
        cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
    } catch (error) {
      console.error(`USDA lookup failed for ${candidate}:`, error);
      // Continue to next candidate
    }
  }

  // Step 5: All providers failed - return NOT_FOUND
  return createNotFoundResult(barcode, normalized);
}

/**
 * Clears the in-memory cache (useful for testing)
 */
export function clearCache(): void {
  cache.clear();
}
