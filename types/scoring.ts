import { NutritionLookupResult } from './nutrition';

/**
 * Scoring context (when the product would be consumed)
 */
export type ScoringContext = 'pre_run' | 'during_run' | 'post_run';

/**
 * Severity levels for flags
 */
export type FlagSeverity = 'info' | 'caution';

/**
 * A score component result
 */
export interface ScoreComponent {
  name: string;
  weight: number;
  points: number;
  description: string;
}

/**
 * Complete score result for a context
 */
export interface ContextScore {
  context: ScoringContext;
  displayName: string;
  score: number; // 0-100
  components: ScoreComponent[];
  applicable: boolean;
}

/**
 * A flag/warning about the product
 */
export interface Flag {
  name: string;
  severity: FlagSeverity;
  message: string;
  appliesTo: ScoringContext[];
}

/**
 * Derived metrics from nutrition data
 */
export interface DerivedMetrics {
  servingWeightG: number | null;
  energyDensity: number | null; // kcal/g
  carbToProteinRatio: number | null;
  totalSugarsPercentCarb: number | null; // %
}

/**
 * Complete scoring result
 */
export interface ScoringResult {
  scores: ContextScore[];
  flags: Flag[];
  derivedMetrics: DerivedMetrics;
}

/**
 * Nutrition data structure for scoring (normalized field names)
 */
export interface ScoringNutritionData {
  servingSize: string | null;
  caloriesKcal: number | null;
  totalFatG: number | null;
  saturatedFatG: number | null;
  transFatG: number | null;
  carbsG: number | null;
  fiberG: number | null;
  sugarsG: number | null;
  addedSugarsG: number | null;
  proteinG: number | null;
  sodiumMg: number | null;
}
