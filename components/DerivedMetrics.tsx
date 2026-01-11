'use client';

import { proteinPerServing, proteinPer100kcal, percentCaloriesFromProtein } from '@/lib/metrics';
import { formatNumber, formatPercent } from '@/lib/format';
import { DerivedMetrics as ScoringDerivedMetrics } from '@/types/scoring';

interface NutritionServing {
  servingSize: string | null;
  caloriesKcal: number | null;
  proteinG: number | null;
  [key: string]: any;
}

interface DerivedMetricsProps {
  serving: NutritionServing;
  scoringDerivedMetrics?: ScoringDerivedMetrics | null;
}

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  footnote: string;
  hint?: string;
}

function MetricCard({ label, value, unit, footnote, hint }: MetricCardProps) {
  const isEmpty = value === '—';
  
  return (
    <div className="bg-white p-4 md:p-6 rounded-lg border border-gray-200 shadow-sm">
      <div className="mb-2">
        <p className="text-xs md:text-sm font-medium text-gray-600">{label}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl md:text-4xl font-bold ${isEmpty ? 'text-gray-400' : 'text-gray-900'}`}>
          {value}
        </span>
        <span className={`text-base md:text-lg ${isEmpty ? 'text-gray-400' : 'text-gray-600'}`}>
          {unit}
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-500">{footnote}</p>
      {hint && isEmpty && (
        <p className="mt-1 text-xs text-gray-400 italic">{hint}</p>
      )}
    </div>
  );
}

export default function DerivedMetrics({ serving, scoringDerivedMetrics }: DerivedMetricsProps) {
  const proteinPerServingValue = proteinPerServing(serving);
  const caloriesPerServing = serving.caloriesKcal;
  const proteinPer100kcalValue = proteinPer100kcal(serving);
  const percentFromProtein = percentCaloriesFromProtein(serving);

  // Build array of metrics to display
  const metrics = [
    {
      label: 'Protein per Serving',
      value: formatNumber(proteinPerServingValue, 1),
      unit: 'g',
      footnote: 'per serving',
      hint: proteinPerServingValue === null ? 'Protein data not available' : undefined,
    },
    {
      label: 'Calories per Serving',
      value: formatNumber(caloriesPerServing, 0),
      unit: 'kcal',
      footnote: 'per serving',
      hint: caloriesPerServing === null ? 'Calories data not available' : undefined,
    },
    {
      label: 'Protein Density',
      value: formatNumber(proteinPer100kcalValue, 1),
      unit: 'g',
      footnote: 'per 100 kcal',
      hint: proteinPer100kcalValue === null ? 'Requires calories + protein' : undefined,
    },
    {
      label: '% Calories from Protein',
      value: formatPercent(percentFromProtein, 1),
      unit: '',
      footnote: 'of total calories',
      hint: percentFromProtein === null ? 'Requires calories + protein' : undefined,
    },
  ];

  // Add scoring-derived metrics if available
  if (scoringDerivedMetrics) {
    if (scoringDerivedMetrics.servingWeightG !== null) {
      metrics.push({
        label: 'Serving Weight',
        value: formatNumber(scoringDerivedMetrics.servingWeightG, 1),
        unit: 'g',
        footnote: 'per serving',
        hint: undefined,
      });
    }

    if (scoringDerivedMetrics.energyDensity !== null) {
      metrics.push({
        label: 'Energy Density',
        value: formatNumber(scoringDerivedMetrics.energyDensity, 2),
        unit: 'kcal/g',
        footnote: 'calories per gram',
        hint: undefined,
      });
    }

    if (scoringDerivedMetrics.carbToProteinRatio !== null) {
      metrics.push({
        label: 'Carb:Protein Ratio',
        value: formatNumber(scoringDerivedMetrics.carbToProteinRatio, 2),
        unit: '',
        footnote: 'carbohydrates to protein',
        hint: undefined,
      });
    }

    if (scoringDerivedMetrics.totalSugarsPercentCarb !== null) {
      metrics.push({
        label: '% Sugars of Carbs',
        value: formatPercent(scoringDerivedMetrics.totalSugarsPercentCarb, 1),
        unit: '',
        footnote: 'of total carbohydrates',
        hint: undefined,
      });
    }
  }

  return (
    <div className="w-full">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4">Derived Metrics</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            label={metric.label}
            value={metric.value}
            unit={metric.unit}
            footnote={metric.footnote}
            hint={metric.hint}
          />
        ))}
      </div>
    </div>
  );
}
