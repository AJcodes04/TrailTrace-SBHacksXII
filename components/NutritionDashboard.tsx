'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { NutritionResponse, validateNutritionResponse } from '@/lib/schemas';
import { validateMultiItemNutritionResponse, MultiItemNutritionResponse } from '@/lib/schemas';
import MultiItemManager, { Item } from './MultiItemManager';
import DerivedMetrics from './DerivedMetrics';
import NutritionFactsTable from './NutritionFactsTable';
import SourceAndWarnings from './SourceAndWarnings';
import IngredientsList from './IngredientsList';
import ScoringSection from './ScoringSection';

type State = 'idle' | 'loading' | 'success' | 'error';

interface DashboardState {
  state: State;
  data: NutritionResponse | MultiItemNutritionResponse | null;
  error: string | null;
  isMultiItem: boolean;
}

export default function NutritionDashboard() {
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    state: 'idle',
    data: null,
    error: null,
    isMultiItem: false,
  });
  const [items, setItems] = useState<Item[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch single item (GET endpoint - backward compatible)
  const fetchNutrition = async (barcode: string) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setDashboardState({ state: 'loading', data: null, error: null, isMultiItem: false });

    try {
      const response = await fetch(`/api/nutrition?barcode=${encodeURIComponent(barcode)}`, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        
        setDashboardState({
          state: 'error',
          data: null,
          error: errorMessage,
          isMultiItem: false,
        });
        return;
      }

      const jsonData = await response.json();

      // Validate response with Zod
      try {
        const validatedData = validateNutritionResponse(jsonData);
        
        if (validatedData.ok) {
          setDashboardState({
            state: 'success',
            data: validatedData,
            error: null,
            isMultiItem: false,
          });
        } else {
          // Handle API-level errors (e.g., NOT_FOUND)
          const errorCode = validatedData.error.code || 'UNKNOWN_ERROR';
          const errorMessage = validatedData.error.message || 'An error occurred';
          
          setDashboardState({
            state: 'error',
            data: validatedData,
            error: `${errorCode}: ${errorMessage}`,
            isMultiItem: false,
          });
        }
      } catch (validationError) {
        console.error('Response validation error:', validationError);
        setDashboardState({
          state: 'error',
          data: null,
          error: 'Invalid response format from server',
          isMultiItem: false,
        });
      }
    } catch (error: any) {
      // Handle abort errors gracefully
      if (error.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }

      console.error('Fetch error:', error);
      setDashboardState({
        state: 'error',
        data: null,
        error: error.message || 'Failed to fetch nutrition data',
        isMultiItem: false,
      });
    } finally {
      abortControllerRef.current = null;
    }
  };

  // Fetch multiple items (POST endpoint)
  const fetchMultipleNutrition = useCallback(async (itemsToFetch: Item[]) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Don't fetch if no items
    if (itemsToFetch.length === 0) {
      setDashboardState({ state: 'idle', data: null, error: null, isMultiItem: false });
      return;
    }

    // Filter out items with servings = 0 (shouldn't happen, but defensive)
    const validItems = itemsToFetch.filter(item => item.servings > 0);
    if (validItems.length === 0) {
      setDashboardState({ state: 'idle', data: null, error: null, isMultiItem: false });
      return;
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setDashboardState({ state: 'loading', data: null, error: null, isMultiItem: true });

    try {
      const response = await fetch('/api/nutrition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: validItems.map(item => ({
            barcode: item.barcode,
            servings: item.servings,
          })),
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        
        setDashboardState({
          state: 'error',
          data: null,
          error: errorMessage,
          isMultiItem: true,
        });
        return;
      }

      const jsonData = await response.json();

      // Validate response with Zod
      try {
        const validatedData = validateMultiItemNutritionResponse(jsonData);
        
        if (validatedData.ok && validatedData.combined) {
          setDashboardState({
            state: 'success',
            data: validatedData,
            error: null,
            isMultiItem: true,
          });
        } else {
          // Handle API-level errors
          const errorCode = validatedData.error?.code || 'UNKNOWN_ERROR';
          const errorMessage = validatedData.error?.message || 'An error occurred';
          
          setDashboardState({
            state: 'error',
            data: validatedData,
            error: `${errorCode}: ${errorMessage}`,
            isMultiItem: true,
          });
        }
      } catch (validationError) {
        console.error('Response validation error:', validationError);
        setDashboardState({
          state: 'error',
          data: null,
          error: 'Invalid response format from server',
          isMultiItem: true,
        });
      }
    } catch (error: any) {
      // Handle abort errors gracefully
      if (error.name === 'AbortError') {
        return; // Request was cancelled, ignore
      }

      console.error('Fetch error:', error);
      setDashboardState({
        state: 'error',
        data: null,
        error: error.message || 'Failed to fetch nutrition data',
        isMultiItem: true,
      });
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  // Fetch when items change
  useEffect(() => {
    if (items.length > 0) {
      fetchMultipleNutrition(items);
    } else {
      setDashboardState({ state: 'idle', data: null, error: null, isMultiItem: false });
    }
  }, [items, fetchMultipleNutrition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleBarcodeSubmit = (barcode: string) => {
    // For single item mode, use GET endpoint (backward compatible)
    // Clear items and fetch single item
    setItems([]);
    fetchNutrition(barcode);
  };

  const handleItemsChange = (newItems: Item[]) => {
    setItems(newItems);
  };

  const renderContent = () => {
    const { state, data, error, isMultiItem } = dashboardState;

    if (state === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center py-8 md:py-12">
          <div className="animate-spin rounded-full h-10 w-10 md:h-12 md:w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm md:text-base text-gray-600">Loading nutrition data...</p>
        </div>
      );
    }

    if (state === 'error') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-sm md:text-base text-red-700 mb-4 break-words">{error || 'An unknown error occurred'}</p>
          {data && !isMultiItem && (data as NutritionResponse).warnings && (data as NutritionResponse).warnings.length > 0 && (
            <div className="mt-4">
              <SourceAndWarnings
                source={(data as NutritionResponse).source}
                warnings={(data as NutritionResponse).warnings}
                normalizedBarcode={(data as NutritionResponse).normalizedBarcode}
              />
            </div>
          )}
        </div>
      );
    }

    if (state === 'success' && data) {
      // Handle multi-item response
      if (isMultiItem && 'combined' in data) {
        const multiItemData = data as MultiItemNutritionResponse;
        const combined = multiItemData.combined;

        if (!combined || !combined.ok) {
          return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 md:p-6">
              <h3 className="text-base md:text-lg font-semibold text-red-800 mb-2">Error</h3>
              <p className="text-sm md:text-base text-red-700">Could not combine items. Please check that all barcodes are valid.</p>
            </div>
          );
        }

        return (
          <div className="space-y-4 md:space-y-6">
            {/* Individual Items Display */}
            {multiItemData.items.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Items ({multiItemData.items.length}/5)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {multiItemData.items.map((item, index) => (
                    <div key={item.barcode} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      {item.result.ok && item.result.product.imageUrl && (
                        <img
                          src={item.result.product.imageUrl}
                          alt={item.result.product.name || `Item ${index + 1}`}
                          className="w-16 h-16 md:w-20 md:h-20 object-contain rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {item.result.ok && item.result.product.name ? (
                              <>
                                <p className="text-sm font-medium text-gray-900 break-words">
                                  {item.result.product.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {item.barcode}
                                </p>
                              </>
                            ) : (
                              <p className="text-sm font-medium text-gray-900">
                                Item #{index + 1}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleItemsChange(items.filter(i => i.barcode !== item.barcode));
                            }}
                            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-red-600 hover:bg-red-50 rounded text-lg font-bold leading-none"
                            aria-label="Remove item"
                          >
                            ×
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <label className="text-xs text-gray-600">Servings:</label>
                          <div className="flex items-center border border-gray-300 rounded text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                const itemIndex = items.findIndex(i => i.barcode === item.barcode);
                                if (itemIndex >= 0 && items[itemIndex].servings > 1) {
                                  const newItems = [...items];
                                  newItems[itemIndex] = { ...newItems[itemIndex], servings: newItems[itemIndex].servings - 1 };
                                  handleItemsChange(newItems);
                                }
                              }}
                              className="px-1 py-0.5 text-gray-700 hover:bg-gray-100 border-r border-gray-300"
                              aria-label="Decrease servings"
                            >
                              −
                            </button>
                            <span className="px-1.5 py-0.5 text-gray-900 min-w-[1.25rem] text-center font-medium">
                              {item.servings}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const itemIndex = items.findIndex(i => i.barcode === item.barcode);
                                if (itemIndex >= 0 && items[itemIndex].servings < 20) {
                                  const newItems = [...items];
                                  newItems[itemIndex] = { ...newItems[itemIndex], servings: newItems[itemIndex].servings + 1 };
                                  handleItemsChange(newItems);
                                }
                              }}
                              disabled={item.servings >= 20}
                              className="px-1 py-0.5 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed border-l border-gray-300"
                              aria-label="Increase servings"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scoring Section - No servings control for multi-item (servings are per-item) */}
            {combined.scoring && (
              <ScoringSection
                scoring={combined.scoring}
                nutritionData={combined}
                servings={1}
                onServingsIncrement={() => {}}
                onServingsDecrement={() => {}}
              />
            )}

            {/* Derived Metrics */}
            <DerivedMetrics serving={combined.nutrition.serving} scoringDerivedMetrics={combined.scoring?.derivedMetrics} />

            {/* Nutrition Facts Table */}
            <NutritionFactsTable serving={combined.nutrition.serving} />

            {/* Ingredients */}
            <IngredientsList ingredients={combined.product.ingredients} />

            {/* Source and Warnings */}
            <SourceAndWarnings
              source={combined.source}
              warnings={combined.warnings}
              normalizedBarcode={combined.normalizedBarcode}
              items={multiItemData.items.map(item => ({
                barcode: item.barcode,
                name: item.result.ok ? item.result.product.name : null,
                source: item.result.source,
              }))}
            />
          </div>
        );
      }

      // Handle single item response
      const singleItemData = data as NutritionResponse;
      if (!singleItemData.ok) {
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-sm md:text-base text-red-700 mb-4 break-words">
              {singleItemData.error?.message || 'An error occurred'}
            </p>
          </div>
        );
      }

      return (
        <div className="space-y-4 md:space-y-6">
          {/* Product Information */}
          {(singleItemData.product.name || singleItemData.product.brand || singleItemData.product.imageUrl) && (
            <div className="bg-white p-4 md:p-6 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-start gap-3 md:gap-4">
                {singleItemData.product.imageUrl && (
                  <img
                    src={singleItemData.product.imageUrl}
                    alt={singleItemData.product.name || 'Product image'}
                    className="w-20 h-20 md:w-24 md:h-24 object-contain rounded flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  {singleItemData.product.name && (
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 break-words">{singleItemData.product.name}</h2>
                  )}
                  {singleItemData.product.brand && (
                    <p className="text-base md:text-lg text-gray-600 break-words">{singleItemData.product.brand}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scoring Section - Single item mode (no servings control, using legacy single-item flow) */}
          {singleItemData.scoring && (
            <ScoringSection
              scoring={singleItemData.scoring}
              nutritionData={singleItemData}
              servings={1}
              onServingsIncrement={() => {}}
              onServingsDecrement={() => {}}
            />
          )}

          {/* Derived Metrics */}
          <DerivedMetrics serving={singleItemData.nutrition.serving} scoringDerivedMetrics={singleItemData.scoring?.derivedMetrics} />

          {/* Nutrition Facts Table */}
          <NutritionFactsTable serving={singleItemData.nutrition.serving} />

          {/* Ingredients */}
          <IngredientsList ingredients={singleItemData.product.ingredients} />

          {/* Source and Warnings */}
          <SourceAndWarnings
            source={singleItemData.source}
            warnings={singleItemData.warnings}
            normalizedBarcode={singleItemData.normalizedBarcode}
          />
        </div>
      );
    }

    // Idle state
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Add items above to get started</p>
      </div>
    );
  };

  return (
      <div className="w-full max-w-6xl mx-auto space-y-4 md:space-y-6">
        <MultiItemManager
          items={items}
          onItemsChange={handleItemsChange}
          maxItems={5}
        />

        <div aria-live="polite" aria-atomic="true">
          {renderContent()}
        </div>
      </div>
  );
}
