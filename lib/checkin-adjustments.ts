// ─── Check-In Score → Goal Adjustment Engine ─────────────────────────────────
// applyCheckinAdjustments() — layers weekly survey scores on top of side-effect
// adjusted targets. Evidence basis:
//   - High food noise → protein + fiber for satiety (PMC9821052)
//   - Over-suppressed appetite → calorie floor guard (ACLM/OMA advisory)
//   - Low energy/mood → reduce activity targets, boost carbs for fuel
//
// Pure TypeScript — no React, no Supabase.

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckinScores = {
  foodNoise:  number | null;  // 0–100, 100 = minimal (good)
  appetite:   number | null;  // 0–100, 100 = well controlled (good)
  energyMood: number | null;  // 0–100, 100 = strong/stable (good)
};

export type CheckinAdjustmentMeta = {
  checkinAdjustmentReasons: string[];
};

type AdjustableTargets = {
  proteinG: number;
  waterMl: number;
  fiberG: number;
  steps: number;
  caloriesTarget: number;
  carbsG: number;
  fatG: number;
  activeCaloriesTarget: number;
};

// ─── Calorie floor ────────────────────────────────────────────────────────────

const CALORIE_FLOOR = 1200;
const STEPS_FLOOR   = 4000;
const ACTIVE_CAL_FLOOR = 150;

// ─── applyCheckinAdjustments ──────────────────────────────────────────────────

/**
 * Applies weekly check-in score adjustments on top of already-adjusted targets.
 * Conflict resolution mirrors applyAdjustments() in lib/targets.ts:
 *   - protein:        MAX (never reduce)
 *   - fiber:          MAX increase (calorie-floor guard doesn't touch fiber)
 *   - calories:       most restrictive (largest reduction), hard floor 1200
 *   - steps:          sum all deltas, floor 4000
 *   - activeCalories: compound multipliers, floor 150
 *   - carbs:          max increase
 *
 * All other fields (waterMl, fatG, etc.) pass through untouched.
 */
export function applyCheckinAdjustments<T extends AdjustableTargets>(
  targets: T,
  scores: CheckinScores,
): T & CheckinAdjustmentMeta {
  const reasons: string[] = [];

  // Per-signal deltas
  let proteinDelta    = 0;
  let fiberDelta      = 0;
  let caloriesDelta   = 0;
  let stepsDelta      = 0;
  let activeCalMult   = 1.0;
  let carbsDelta      = 0;

  // ── Food Noise ──────────────────────────────────────────────────────────────
  // Low score = high food noise (bad). Scale: 0–100, 100 = minimal noise (good)
  if (scores.foodNoise != null) {
    if (scores.foodNoise < 30) {
      proteinDelta = Math.max(proteinDelta, 15);
      fiberDelta   = Math.max(fiberDelta,    4);
      reasons.push('High food noise — increasing protein & fiber for satiety');
    } else if (scores.foodNoise <= 55) {
      proteinDelta = Math.max(proteinDelta, 8);
      fiberDelta   = Math.max(fiberDelta,   2);
      reasons.push('Moderate food noise — modest protein & fiber increase');
    }
    // > 75 → no adjustment
  }

  // ── Appetite ────────────────────────────────────────────────────────────────
  // Low score = poor appetite control / over-suppression (bad).
  // Protein is NEVER reduced per GLP-1 lean-mass preservation rule.
  if (scores.appetite != null) {
    if (scores.appetite < 25) {
      caloriesDelta = Math.min(caloriesDelta, -150);
      stepsDelta   += -500;
      activeCalMult *= 0.8;
      reasons.push('Very low appetite — calorie floor guard active, activity reduced');
    } else if (scores.appetite <= 50) {
      caloriesDelta = Math.min(caloriesDelta, -75);
      reasons.push('Low appetite — mild calorie reduction');
    }
    // > 70 → no adjustment
  }

  // ── Energy / Mood ──────────────────────────────────────────────────────────
  // Low score = poor energy or unstable mood (bad).
  if (scores.energyMood != null) {
    if (scores.energyMood < 30) {
      stepsDelta   += -1000;
      activeCalMult *= 0.8;
      carbsDelta    = Math.max(carbsDelta, Math.round(targets.caloriesTarget * 0.05 / 4));
      reasons.push('Low energy & mood — activity reduced, carbs increased for fuel');
    } else if (scores.energyMood <= 50) {
      stepsDelta   += -500;
      activeCalMult *= 0.9;
      reasons.push('Moderate energy dip — activity moderately reduced');
    }
    // > 70 → no adjustment
  }

  if (reasons.length === 0) {
    return { ...targets, checkinAdjustmentReasons: [] };
  }

  // ── Apply with floors ──────────────────────────────────────────────────────
  const newProteinG   = Math.round(targets.proteinG + proteinDelta);           // MAX, no reduction
  const newFiberG     = Math.round(targets.fiberG   + fiberDelta);
  const newCalories   = Math.max(CALORIE_FLOOR, Math.round(targets.caloriesTarget + caloriesDelta));
  const newSteps      = Math.max(STEPS_FLOOR,   Math.round(targets.steps + stepsDelta));
  const newActiveCal  = Math.max(ACTIVE_CAL_FLOOR, Math.round(targets.activeCaloriesTarget * activeCalMult));
  const newCarbsG     = Math.round(targets.carbsG + carbsDelta);

  return {
    ...targets,
    proteinG:            newProteinG,
    fiberG:              newFiberG,
    caloriesTarget:      newCalories,
    steps:               newSteps,
    activeCaloriesTarget: newActiveCal,
    carbsG:              newCarbsG,
    checkinAdjustmentReasons: reasons,
  };
}
