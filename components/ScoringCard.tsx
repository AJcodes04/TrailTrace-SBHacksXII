'use client';

import { ContextScore, Flag } from '@/types/scoring';
import { formatNumber } from '@/lib/format';

interface ScoringCardProps {
  score: ContextScore;
  flags?: Flag[];
}

/**
 * Gets a color class based on score value
 */
function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 50) return 'text-blue-600';
  if (score >= 30) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Gets a background color class based on score value
 */
function getScoreBgColor(score: number): string {
  if (score >= 70) return 'bg-green-50 border-green-200';
  if (score >= 50) return 'bg-blue-50 border-blue-200';
  if (score >= 30) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

/**
 * Gets a simplified, user-friendly title for the scoring context
 */
function getContextTitle(context: string, displayName: string): { title: string; subtitle: string } {
  switch (context) {
    case 'pre_run':
      return { title: 'Before Run', subtitle: 'Pre-run fueling' };
    case 'during_run':
      return { title: 'During Run', subtitle: 'Mid-run fueling' };
    case 'post_run':
      return { title: 'After Run', subtitle: 'Recovery' };
    default:
      return { title: displayName, subtitle: '' };
  }
}

/**
 * Gets a color class for threshold descriptions based on the text
 */
function getThresholdColor(description: string, componentName: string): string {
  const desc = description.toLowerCase();
  
  // Determine if this is an inverse metric (lower is better)
  const isInverse = ['fat', 'fiber'].includes(componentName.toLowerCase());
  
  if (isInverse) {
    // For fat/fiber: low = good, high = bad
    if (desc.includes('very low') || desc.includes('low')) {
      return 'text-green-600';
    } else if (desc.includes('moderate') || desc.includes('ok')) {
      return 'text-yellow-600';
    } else if (desc.includes('high') || desc.includes('too high')) {
      return 'text-red-600';
    }
  } else {
    // For carbs/protein/sodium: high = good (usually), low = bad
    if (desc.includes('ideal') || (desc.includes('high') && !desc.includes('too high'))) {
      return 'text-green-600';
    } else if (desc.includes('moderate') || desc.includes('ok')) {
      return 'text-yellow-600';
    } else if (desc.includes('low') || desc.includes('too high')) {
      return 'text-red-600';
    }
  }
  
  // Default to gray if no match
  return 'text-gray-600';
}

export default function ScoringCard({ score, flags = [] }: ScoringCardProps) {
  const scoreColor = getScoreColor(score.score);
  const bgBorderColor = getScoreBgColor(score.score);
  const { title, subtitle } = getContextTitle(score.context, score.displayName);

  // Separate score components from penalties
  const scoreComponents = score.components.filter((component) => component.weight !== 0);
  const penalties = score.components.filter((component) => component.weight === 0 && component.points < 0);

  // Get caution flags that apply to this context
  const cautionFlags = flags.filter((flag) => flag.severity === 'caution' && flag.appliesTo.includes(score.context));

  return (
    <div className={`p-4 md:p-6 rounded-lg border-2 ${bgBorderColor} shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base md:text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl md:text-4xl font-bold ${scoreColor}`}>
            {formatNumber(score.score, 0)}
          </span>
          <span className="text-sm text-gray-500">/100</span>
        </div>
      </div>

      {/* Score Components Breakdown */}
      {scoreComponents.length > 0 && (
        <div className="mt-2 space-y-2">
          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Score Breakdown</h4>
          <div className="space-y-1.5">
            {scoreComponents.map((component, index) => {
              const thresholdColor = getThresholdColor(component.description || '', component.name);
              // Split description to color-code only the threshold part
              const desc = component.description || formatNumber(component.points, 0);
              const parts = desc.split(' - ');
              const thresholdText = parts[0] || desc;
              const actualValue = parts[1] || null;
              
              return (
                <div key={index} className="flex items-center justify-between text-xs md:text-sm">
                  <span className="text-gray-600 flex-1">{component.name}</span>
                  <span className="font-medium">
                    <span className={thresholdColor}>{thresholdText}</span>
                    {actualValue && <span className="text-gray-700"> - {actualValue}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Penalties and Caution Flags */}
      {(penalties.length > 0 || cautionFlags.length > 0) && (
        <div className="mt-3 pt-3 border-t border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-red-600">Issues</span>
            <span className="text-xs text-gray-500">
              ({penalties.length + cautionFlags.length})
            </span>
          </div>
          <div className="space-y-1">
            {penalties.map((penalty, index) => (
              <div key={`penalty-${index}`} className="text-xs text-red-700">
                {penalty.name.replace('Penalty: ', '')}
              </div>
            ))}
            {cautionFlags.map((flag, index) => (
              <div key={`flag-${index}`} className="text-xs text-red-700">
                {flag.name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
