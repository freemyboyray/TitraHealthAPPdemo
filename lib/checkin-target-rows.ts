// Shared builder for the "this week's target adjustments" rows. Used by the
// check-in targets screen (full cards) and the past-check-ins history (compact
// list) so the deltas, copy, and metric→asset mapping never drift.

import { applyCheckinAdjustments, type CheckinScores } from '@/lib/checkin-adjustments';
import { computeBaseTargets } from '@/lib/targets';

export type AdjustmentImageKey = 'calories' | 'steps' | 'protein' | 'water' | 'carbs';

export type AdjustmentRow = {
  key: string;
  imageKey: AdjustmentImageKey;
  label: string;
  before: number;
  after: number;
  beforeStr: string;
  afterStr: string;
  delta: string;
  increased: boolean;
  reason: string;
};

type Profile = Parameters<typeof computeBaseTargets>[0];

export function mlToOz(ml: number): number {
  return Math.round(ml / 29.5735);
}

/**
 * Compute the adjusted daily targets for a set of check-in scores and return
 * only the metrics that meaningfully changed, as display-ready rows.
 * `scores` is keyed by check-in domain key (gi_burden, energy_mood, …) → 0–100.
 */
export function buildAdjustmentRows(profile: Profile, scores: Record<string, number>): AdjustmentRow[] {
  const base = computeBaseTargets(profile);
  const baseWithActive = { ...base, activeCaloriesTarget: base.activeMinutes * 3 };
  const checkinScores: CheckinScores = {
    foodNoise:       scores['food_noise']       ?? null,
    energyMood:      scores['energy_mood']      ?? null,
    appetite:        scores['appetite']          ?? null,
    giBurden:        scores['gi_burden']         ?? null,
    activityQuality: scores['activity_quality'] ?? null,
    sleepQuality:    scores['sleep_quality']    ?? null,
    mentalHealth:    scores['mental_health']    ?? null,
  };
  const adjusted = applyCheckinAdjustments(baseWithActive, checkinScores);
  const rows: AdjustmentRow[] = [];

  const calDiff = adjusted.caloriesTarget - baseWithActive.caloriesTarget;
  if (Math.abs(calDiff) >= 50) rows.push({
    key: 'cal', imageKey: 'calories', label: 'Daily Calories',
    before: baseWithActive.caloriesTarget, after: adjusted.caloriesTarget,
    beforeStr: `${baseWithActive.caloriesTarget} cal`, afterStr: `${adjusted.caloriesTarget} cal`,
    delta: `${calDiff > 0 ? '+' : ''}${calDiff}`, increased: calDiff > 0,
    reason: calDiff < 0 ? 'Calorie target eased to reduce the burden on your body this week.' : 'Calorie target increased to support your energy needs.',
  });

  const stepsDiff = adjusted.steps - baseWithActive.steps;
  if (Math.abs(stepsDiff) >= 200) rows.push({
    key: 'steps', imageKey: 'steps', label: 'Daily Steps',
    before: baseWithActive.steps, after: adjusted.steps,
    beforeStr: baseWithActive.steps.toLocaleString(), afterStr: adjusted.steps.toLocaleString(),
    delta: `${stepsDiff > 0 ? '+' : ''}${stepsDiff.toLocaleString()}`, increased: stepsDiff > 0,
    reason: stepsDiff > 0 ? 'Higher activity target reflects your strong weekly performance. Keep building.' : 'Step target reduced to keep goals realistic given what you reported this week.',
  });

  const proteinDiff = adjusted.proteinG - baseWithActive.proteinG;
  if (Math.abs(proteinDiff) >= 1) rows.push({
    key: 'protein', imageKey: 'protein', label: 'Daily Protein',
    before: baseWithActive.proteinG, after: adjusted.proteinG,
    beforeStr: `${baseWithActive.proteinG} g`, afterStr: `${adjusted.proteinG} g`,
    delta: `${proteinDiff > 0 ? '+' : ''}${proteinDiff} g`, increased: proteinDiff > 0,
    reason: 'Protein is the single most important nutrient for preserving lean mass on GLP-1. Try eggs, Greek yogurt, or a protein shake.',
  });

  const waterDiffMl = adjusted.waterMl - baseWithActive.waterMl;
  const waterDiffOz = mlToOz(Math.abs(waterDiffMl));
  if (waterDiffOz >= 2) rows.push({
    key: 'water', imageKey: 'water', label: 'Daily Water',
    before: mlToOz(baseWithActive.waterMl), after: mlToOz(adjusted.waterMl),
    beforeStr: `${mlToOz(baseWithActive.waterMl)} oz`, afterStr: `${mlToOz(adjusted.waterMl)} oz`,
    delta: `${waterDiffMl > 0 ? '+' : '-'}${waterDiffOz} oz`, increased: waterDiffMl > 0,
    reason: 'Extra hydration helps manage GI symptoms and supports medication absorption. Sip steadily throughout the day.',
  });

  const carbsDiff = adjusted.carbsG - baseWithActive.carbsG;
  if (Math.abs(carbsDiff) >= 3) rows.push({
    key: 'carbs', imageKey: 'carbs', label: 'Daily Carbs',
    before: baseWithActive.carbsG, after: adjusted.carbsG,
    beforeStr: `${baseWithActive.carbsG} g`, afterStr: `${adjusted.carbsG} g`,
    delta: `${carbsDiff > 0 ? '+' : ''}${carbsDiff} g`, increased: carbsDiff > 0,
    reason: carbsDiff > 0 ? 'A modest carb boost provides steady fuel. Focus on complex sources: oats, sweet potato, whole grains.' : 'Carb target reduced to lower GI load.',
  });

  return rows;
}

/** Shared metric→card-illustration map for adjustment rows. */
export const ADJUSTMENT_IMAGE = {
  calories: require('@/assets/images/cards/calories.png'),
  steps: require('@/assets/images/cards/steps.png'),
  protein: require('@/assets/images/cards/protein.png'),
  water: require('@/assets/images/cards/hydration.png'),
  carbs: require('@/assets/images/cards/carbs.png'),
} as const;
