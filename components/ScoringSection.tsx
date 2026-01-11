'use client';

import { ScoringResult } from '@/types/scoring';
import { NutritionLookupResult } from '@/types/nutrition';
import ScoringCard from './ScoringCard';
import FlagsDisplay from './FlagsDisplay';
import { useState, useMemo } from 'react';
import { scoreNutritionProductWithServings } from '@/lib/scoring-engine-client';

interface ScoringSectionProps {
  scoring: ScoringResult;
  nutritionData: NutritionLookupResult;
  servings?: number;
  onServingsIncrement?: () => void;
  onServingsDecrement?: () => void;
  showServingsControl?: boolean;
}

export default function ScoringSection({
  scoring: initialScoring,
  nutritionData,
  servings = 1,
  onServingsIncrement,
  onServingsDecrement,
  showServingsControl = false,
}: ScoringSectionProps) {
  const [selectedContext, setSelectedContext] = useState<'pre_run' | 'during_run' | 'post_run' | null>(null);

  // Recalculate scoring with scaled servings (only for single-item mode with servings control)
  const scoring = useMemo(() => {
    if (!nutritionData.ok || !showServingsControl || servings === 1) {
      return initialScoring;
    }
    return scoreNutritionProductWithServings(nutritionData, servings);
  }, [nutritionData, servings, initialScoring, showServingsControl]);

  if (!scoring || scoring.scores.length === 0) {
    return null;
  }

  return (
    <div className="w-full space-y-4 md:space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Performance Scores</h2>
          <p className="text-sm text-gray-600 mt-1">Rated for before, during, and after running</p>
        </div>
        {showServingsControl && onServingsIncrement && onServingsDecrement && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Servings:
            </label>
            <div className="flex items-center border border-gray-300 rounded-md">
              <button
                type="button"
                onClick={onServingsDecrement}
                disabled={servings <= 0}
                className="px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed border-r border-gray-300"
                aria-label="Decrease servings"
              >
                −
              </button>
              <span className="px-3 py-1 text-sm font-medium text-gray-900 min-w-[2rem] text-center">
                {servings}
              </span>
              <button
                type="button"
                onClick={onServingsIncrement}
                disabled={servings >= 20}
                className="px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed border-l border-gray-300"
                aria-label="Increase servings"
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Context Scores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        {scoring.scores.map((score) => (
          <div
            key={score.context}
            className={`cursor-pointer transition-all ${
              selectedContext === score.context ? 'ring-2 ring-blue-500 ring-offset-2' : ''
            }`}
            onClick={() => setSelectedContext(selectedContext === score.context ? null : score.context)}
          >
            <ScoringCard score={score} flags={scoring.flags} />
          </div>
        ))}
      </div>

      {/* Info Flags Display - show only info flags (caution flags are merged with penalties) */}
      {scoring.flags.filter((flag) => flag.severity === 'info').length > 0 && (
        <div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3">Additional Information</h3>
          <FlagsDisplay flags={scoring.flags.filter((flag) => flag.severity === 'info')} context={selectedContext || undefined} />
        </div>
      )}
    </div>
  );
}
