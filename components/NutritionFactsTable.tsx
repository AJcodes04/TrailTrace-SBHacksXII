'use client';

import { formatNumber, formatInteger } from '@/lib/format';

interface NutritionServing {
  servingSize: string | null;
  caloriesKcal: number | null;
  fatG: number | null;
  satFatG: number | null;
  transFatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  sugarsG: number | null;
  addedSugarsG: number | null;
  proteinG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
}

interface NutritionFactsTableProps {
  serving: NutritionServing;
}

interface NutrientRowProps {
  label: string;
  value: number | null;
  unit: string;
}

function NutrientRow({ label, value, unit }: NutrientRowProps) {
  const displayValue = value != null ? formatNumber(value, value < 1 ? 1 : 0) : '—';
  const isEmpty = value === null;

  return (
    <tr className={isEmpty ? 'opacity-50' : ''}>
      <td className="py-2.5 md:py-2 pr-3 md:pr-4 border-b border-gray-200">
        <span className="font-medium text-gray-700 text-sm md:text-base">{label}</span>
      </td>
      <td className="py-2.5 md:py-2 text-right border-b border-gray-200">
        <span className={`text-sm md:text-base ${isEmpty ? 'text-gray-400' : 'text-gray-900'}`}>
          {displayValue}
        </span>
        {!isEmpty && <span className="text-gray-600 ml-1 text-sm md:text-base">{unit}</span>}
      </td>
    </tr>
  );
}

export default function NutritionFactsTable({ serving }: NutritionFactsTableProps) {
  return (
    <div className="w-full">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4">Nutrition Facts</h2>
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {serving.servingSize && (
          <div className="px-3 md:px-4 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-semibold">Serving Size:</span> {serving.servingSize}
            </p>
          </div>
        )}
        <div className="p-3 md:p-4 overflow-x-auto">
          <table className="w-full min-w-[300px]">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-2 font-bold text-gray-900">Nutrient</th>
                <th className="text-right py-2 font-bold text-gray-900">Amount</th>
              </tr>
            </thead>
            <tbody>
              <NutrientRow
                label="Calories"
                value={serving.caloriesKcal}
                unit="kcal"
              />
              <NutrientRow
                label="Total Fat"
                value={serving.fatG}
                unit="g"
              />
              {serving.satFatG != null && (
                <NutrientRow
                  label="  Saturated Fat"
                  value={serving.satFatG}
                  unit="g"
                />
              )}
              {serving.transFatG != null && (
                <NutrientRow
                  label="  Trans Fat"
                  value={serving.transFatG}
                  unit="g"
                />
              )}
              <NutrientRow
                label="Total Carbohydrates"
                value={serving.carbsG}
                unit="g"
              />
              {serving.fiberG != null && (
                <NutrientRow
                  label="  Dietary Fiber"
                  value={serving.fiberG}
                  unit="g"
                />
              )}
              {serving.sugarsG != null && (
                <NutrientRow
                  label="  Total Sugars"
                  value={serving.sugarsG}
                  unit="g"
                />
              )}
              {serving.addedSugarsG != null && (
                <NutrientRow
                  label="  Added Sugars"
                  value={serving.addedSugarsG}
                  unit="g"
                />
              )}
              <NutrientRow
                label="Protein"
                value={serving.proteinG}
                unit="g"
              />
              <NutrientRow
                label="Sodium"
                value={serving.sodiumMg}
                unit="mg"
              />
              {serving.cholesterolMg != null && (
                <NutrientRow
                  label="Cholesterol"
                  value={serving.cholesterolMg}
                  unit="mg"
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
