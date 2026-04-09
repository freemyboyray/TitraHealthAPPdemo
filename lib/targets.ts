// ─── Personalized Targets Engine ──────────────────────────────────────────────
// computeBaseTargets() - Mifflin-St Jeor BMR → TDEE → deficit → macros.
// applyAdjustments()   - evidence-based side-effect delta rules engine.
// Pure TypeScript - no React, no Supabase.
//
// Evidence sources (2024-2025):
//   PMC9821052   - GLP-1 GI adverse event management (multidisciplinary consensus)
//   PMC11668918  - Dietary recommendations for GLP-1 GI symptoms
//   PMC12536186  - Lean mass preservation on GLP-1/GIP agonists
//   ACLM/ASN/OMA/TOS joint advisory - Nutritional priorities for GLP-1 therapy

import type { FullUserProfile } from '@/constants/user-profile';

// ─── Base Targets ─────────────────────────────────────────────────────────────

export type BaseTargets = {
  caloriesTarget: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  waterMl: number;
  steps: number;
  activeMinutes: number;
};

/** Maps targetWeeklyLossLbs → daily caloric deficit (kcal). */
const WEEKLY_LOSS_TO_DEFICIT: Record<string, number> = {
  '0.2': 100,
  '0.5': 250,
  '1.0': 500,
  '1.5': 750,
  '2.0': 1000,
  '2.5': 1100,
  '3.0': 1250,
};

function deficitForWeeklyLoss(lbs: number): number {
  const keys = Object.keys(WEEKLY_LOSS_TO_DEFICIT).map(Number);
  const closest = keys.reduce((a, b) => (Math.abs(b - lbs) < Math.abs(a - lbs) ? b : a));
  return WEEKLY_LOSS_TO_DEFICIT[String(closest)] ?? 500;
}

/**
 * Computes evidence-based daily targets from onboarding profile.
 * Uses Mifflin-St Jeor BMR (gold standard, most validated 2024 meta-analyses).
 * Stored in user_goals at onboarding completion; recalculated if profile metrics change.
 */
export function computeBaseTargets(profile: FullUserProfile): BaseTargets {
  const { weightKg, heightCm, age, sex, activityLevel, targetWeeklyLossLbs } = profile;
  const weeklyLoss = targetWeeklyLossLbs ?? 1.0;

  // ── BMR (Mifflin-St Jeor) ──────────────────────────────────────────────────
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);

  // ── TDEE ───────────────────────────────────────────────────────────────────
  const activityMult: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    active: 1.55,
    very_active: 1.725,
  };
  const tdee = bmr * (activityMult[activityLevel] ?? 1.375);

  // ── Calorie Target ─────────────────────────────────────────────────────────
  // GLP-1 note: this is a minimum floor, not a restriction - users often under-eat.
  const deficit = deficitForWeeklyLoss(weeklyLoss);
  const calorieFloor = sex === 'male' ? 1500 : 1200;
  const caloriesTarget = Math.max(Math.round(tdee - deficit), calorieFloor);

  // ── Protein (1.0–1.2 g/kg — floor of clinical range) ───────────────────────
  // Clinical range is 1.2–2.0 g/kg for GLP-1 patients; we use the floor to
  // keep targets achievable, especially with appetite suppression.
  const proteinMult = weeklyLoss >= 1.5 ? 1.2 : 1.0;
  const proteinG = Math.round(weightKg * proteinMult);

  // ── Fat (28% of calories) ─────────────────────────────────────────────────
  const fatG = Math.round((caloriesTarget * 0.28) / 9);

  // ── Carbs (remainder calories, floor 50g) ─────────────────────────────────
  const carbsG = Math.max(Math.round((caloriesTarget - proteinG * 4 - fatG * 9) / 4), 50);

  // ── Fiber (conservative: 20–25g) ──────────────────────────────────────────
  // IOM norms go up to 38g but that's aspirational; most Americans average 15g.
  const fiberG = sex === 'male' ? (age >= 50 ? 22 : 25) : (age >= 50 ? 18 : 20);

  // ── Water (30 ml/kg, bounded [2000, 3000]) ────────────────────────────────
  // Standard hydration; GLP-1 patients may need more but we start conservative.
  const waterMl = Math.min(3000, Math.max(2000, Math.round(weightKg * 30)));

  // ── Steps (achievable baselines) ──────────────────────────────────────────
  // Average American walks ~4,000/day. Start near that and scale gently.
  const steps = weeklyLoss >= 1.5 ? 7000 : weeklyLoss >= 0.8 ? 6000 : 5000;

  return { caloriesTarget, proteinG, fatG, carbsG, fiberG, waterMl, steps, activeMinutes: 30 };
}

// ─── Side-Effect Rule Shape ───────────────────────────────────────────────────

export type SideEffectRule = {
  /** Absolute ml to add to water target. */
  waterMlDelta: number;
  /** % increase to protein (0 = no change; protein is never reduced for GLP-1 users). */
  proteinPct: number;
  /** Grams to add/remove from fiber target (negative = reduce). */
  fiberGDelta: number;
  /** % change to fat (negative = reduce). */
  fatPct: number;
  /** % change to carbs. */
  carbsPct: number;
  /** Absolute steps to add. */
  stepsDelta: number;
  /** Active minutes to add (~3 cal/min conversion). */
  activeMinDelta: number;
  /** Suggested meals/day (0 = no recommendation). */
  mealFrequency: number;
  /** Fiber quality guidance. */
  fiberType?: 'soluble_first' | 'soluble_only' | 'avoid_cruciferous';
  /** Whether resistance training is explicitly recommended. */
  resistanceFlag?: boolean;
  foodsToAvoid?: string[];
  foodsToPrioritize?: string[];
  /** Human-readable label for UI reason string. */
  label: string;
};

// ─── Side-Effect Rules Table ──────────────────────────────────────────────────
// Keys match side_effect_type DB enum values.
// New enum values (heartburn, bloating, sulfur_burps, muscle_loss, dizziness,
// food_noise, dehydration) become active after migration 20260315 is applied.

export const SIDE_EFFECT_RULES: Record<string, SideEffectRule> = {
  // ── Already in DB enum ───────────────────────────────────────────────────
  constipation: {
    waterMlDelta: 500, proteinPct: 0, fiberGDelta: 8, fatPct: -10, carbsPct: 0,
    stepsDelta: 1000, activeMinDelta: 10, mealFrequency: 5,
    fiberType: 'soluble_first',
    foodsToAvoid: ['fried foods', 'processed foods', 'refined grains'],
    foodsToPrioritize: ['oats', 'legumes', 'leafy greens', 'berries', 'cooked vegetables'],
    label: 'Water, fiber, and activity increased for constipation',
  },
  diarrhea: {
    waterMlDelta: 400, proteinPct: 0, fiberGDelta: -10, fatPct: -15, carbsPct: 0,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 5,
    fiberType: 'soluble_only',
    foodsToAvoid: ['high-FODMAP foods', 'dairy', 'fried foods', 'artificial sweeteners', 'high-fat foods'],
    foodsToPrioritize: ['white rice', 'bananas', 'plain chicken', 'cooked carrots', 'boiled potatoes'],
    label: 'Water increased, fiber and fat reduced for diarrhea',
  },
  nausea: {
    waterMlDelta: 300, proteinPct: 0, fiberGDelta: -5, fatPct: -20, carbsPct: 0,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 6,
    foodsToAvoid: ['greasy foods', 'spicy foods', 'citrus', 'carbonated drinks', 'high-fat foods'],
    foodsToPrioritize: ['bland foods', 'crackers', 'white rice', 'bananas', 'plain chicken', 'toast'],
    label: 'Fat and fiber reduced, small frequent meals recommended for nausea',
  },
  vomiting: {
    waterMlDelta: 500, proteinPct: 0, fiberGDelta: -10, fatPct: -25, carbsPct: 0,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 6,
    foodsToAvoid: ['greasy foods', 'fried foods', 'spicy foods', 'high-fat foods', 'high-fiber foods'],
    foodsToPrioritize: ['bananas', 'white rice', 'applesauce', 'toast', 'protein shakes', 'clear fluids'],
    label: 'Fat and fiber minimized, hydration prioritized for vomiting',
  },
  fatigue: {
    waterMlDelta: 300, proteinPct: 0, fiberGDelta: 0, fatPct: 0, carbsPct: 10,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 4,
    foodsToAvoid: ['ultra-processed foods', 'high-sugar foods'],
    foodsToPrioritize: ['complex carbs', 'whole grains', 'protein-rich foods', 'electrolyte drinks'],
    label: 'Complex carbs and water increased for fatigue',
  },
  headache: {
    waterMlDelta: 500, proteinPct: 0, fiberGDelta: 0, fatPct: 0, carbsPct: 5,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 4,
    foodsToAvoid: ['excessive caffeine', 'alcohol'],
    foodsToPrioritize: ['electrolyte drinks', 'water-rich foods', 'balanced meals'],
    label: 'Water and regular meal timing recommended for headaches',
  },
  appetite_loss: {
    waterMlDelta: 200, proteinPct: 15, fiberGDelta: 5, fatPct: 0, carbsPct: 0,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 5,
    foodsToPrioritize: ['protein shakes', 'Greek yogurt', 'eggs', 'nutrient-dense foods'],
    label: 'Protein and small frequent meals prioritized for suppressed appetite',
  },

  // ── New enum values (active after migration 20260315) ────────────────────
  dehydration: {
    waterMlDelta: 700, proteinPct: 0, fiberGDelta: 0, fatPct: 0, carbsPct: 0,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 0,
    foodsToPrioritize: ['electrolyte drinks', 'water-rich foods'],
    foodsToAvoid: ['caffeine', 'alcohol', 'high-sugar drinks'],
    label: 'Water significantly increased for dehydration',
  },
  dizziness: {
    waterMlDelta: 500, proteinPct: 0, fiberGDelta: 0, fatPct: 0, carbsPct: 5,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 4,
    foodsToAvoid: ['caffeine', 'alcohol'],
    foodsToPrioritize: ['electrolyte drinks', 'balanced meals'],
    label: 'Water and regular meals recommended for dizziness',
  },
  muscle_loss: {
    waterMlDelta: 0, proteinPct: 25, fiberGDelta: 0, fatPct: 0, carbsPct: 0,
    stepsDelta: 500, activeMinDelta: 15, mealFrequency: 4,
    resistanceFlag: true,
    foodsToPrioritize: ['fish', 'poultry', 'eggs', 'Greek yogurt', 'cottage cheese', 'tofu'],
    label: 'Protein increased, resistance training recommended for muscle loss',
  },
  heartburn: {
    waterMlDelta: 0, proteinPct: 0, fiberGDelta: 0, fatPct: -15, carbsPct: 0,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 6,
    foodsToAvoid: ['citrus', 'tomatoes', 'spicy foods', 'chocolate', 'caffeine', 'carbonated drinks', 'alcohol', 'fried foods'],
    foodsToPrioritize: ['lean protein', 'whole grains', 'bananas', 'melons', 'non-citrus fruits'],
    label: 'Fat reduced, small frequent meals recommended for heartburn',
  },
  food_noise: {
    waterMlDelta: 0, proteinPct: 10, fiberGDelta: 5, fatPct: 0, carbsPct: 0,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 4,
    foodsToPrioritize: ['high-protein foods', 'high-fiber foods', 'low-glycemic foods'],
    label: 'Protein and fiber increased to reduce food noise',
  },
  sulfur_burps: {
    waterMlDelta: 300, proteinPct: 0, fiberGDelta: -5, fatPct: -10, carbsPct: 0,
    stepsDelta: 0, activeMinDelta: 0, mealFrequency: 5,
    fiberType: 'avoid_cruciferous',
    foodsToAvoid: ['eggs', 'red meat', 'broccoli', 'cauliflower', 'cabbage', 'brussels sprouts', 'garlic', 'onions', 'fried foods'],
    foodsToPrioritize: ['white fish', 'poultry', 'turkey', 'non-cruciferous vegetables'],
    label: 'Sulfur-rich foods avoided, fat reduced for sulfur burps',
  },
  bloating: {
    waterMlDelta: 300, proteinPct: 0, fiberGDelta: 0, fatPct: -10, carbsPct: 0,
    stepsDelta: 500, activeMinDelta: 0, mealFrequency: 5,
    fiberType: 'soluble_only',
    foodsToAvoid: ['high-FODMAP foods', 'cruciferous vegetables', 'carbonated drinks', 'artificial sweeteners', 'fried foods'],
    foodsToPrioritize: ['low-FODMAP foods', 'soluble fiber sources', 'cooked vegetables'],
    label: 'Fat reduced, gentle movement and small meals recommended for bloating',
  },
};

// ─── Adjustment Result ────────────────────────────────────────────────────────

export type SideEffectAdjustment = {
  mealFrequency: number;
  foodsToAvoid: string[];
  foodsToPrioritize: string[];
  adjustmentReasons: string[];
  resistanceTrainingRecommended: boolean;
  fiberType?: string;
};

// ─── Adjustable Targets (minimal shape - avoids circular import with scoring.ts) ─

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

export type RecentSideEffectLog = {
  effect_type: string;   // matches side_effect_type DB enum value
  severity: number;      // 0–10
  logged_at: string;     // ISO timestamp
};

/**
 * Applies evidence-based side-effect adjustments to a set of daily targets.
 * Severity and recency weighted; conflict-resolved across multiple active effects.
 *
 * Conflict rules:
 *  - water:   MAX of all adjustments
 *  - protein: MAX (never reduced for GLP-1 users)
 *  - fiber:   decrease wins over increase
 *  - fat:     most restrictive (most negative)
 *  - carbs:   max increase
 *  - steps/active: MAX; capped to base if vomiting/severe nausea (severity ≥ 8)
 *  - meal frequency: highest suggested value wins
 */
export function applyAdjustments<T extends AdjustableTargets>(
  base: T,
  recentLogs: RecentSideEffectLog[],
): T & SideEffectAdjustment {
  const noOp: SideEffectAdjustment = {
    mealFrequency: 3,
    foodsToAvoid: [],
    foodsToPrioritize: [],
    adjustmentReasons: [],
    resistanceTrainingRecommended: false,
  };

  if (!recentLogs || recentLogs.length === 0) return { ...base, ...noOp };

  const now = Date.now();

  // Compute effective weight = severity_scale × recency_weight
  const weighted = recentLogs
    .map(log => {
      const daysSince = (now - new Date(log.logged_at).getTime()) / 86400000;
      if (daysSince > 7) return null;
      const recency = daysSince <= 1 ? 1.0 : daysSince <= 3 ? 0.75 : 0.25;
      const severityScale = log.severity <= 3 ? 0.5 : log.severity <= 6 ? 0.75 : 1.0;
      return { ...log, weight: severityScale * recency, daysSince: Math.round(daysSince) };
    })
    .filter(Boolean) as Array<RecentSideEffectLog & { weight: number; daysSince: number }>;

  if (weighted.length === 0) return { ...base, ...noOp };

  // Deduplicate by effect type - keep highest weight per type
  const byType = new Map<string, (typeof weighted)[0]>();
  for (const log of weighted) {
    const existing = byType.get(log.effect_type);
    if (!existing || log.weight > existing.weight) byType.set(log.effect_type, log);
  }

  // Accumulate deltas
  let waterDelta = 0;
  let proteinDelta = 0;
  let fiberDelta = 0;
  let fiberDecreaseWins = false;
  let fatPctDelta = 0;
  let carbsPctDelta = 0;
  let stepsDelta = 0;
  let activeMinDelta = 0;
  let mealFrequency = 3;
  let resistanceFlag = false;
  let fiberType: string | undefined;
  const foodsToAvoid: string[] = [];
  const foodsToPrioritize: string[] = [];
  const reasons: string[] = [];

  const fiberTypePriority: Record<string, number> = {
    soluble_only: 3,
    avoid_cruciferous: 2,
    soluble_first: 1,
  };

  for (const [type, log] of byType) {
    const rule = SIDE_EFFECT_RULES[type];
    if (!rule) continue;

    const w = log.weight;
    const daysLabel =
      log.daysSince === 0 ? 'today'
      : log.daysSince === 1 ? 'yesterday'
      : `${log.daysSince}d ago`;

    // Water: MAX
    waterDelta = Math.max(waterDelta, rule.waterMlDelta * w);

    // Protein: MAX (never reduce)
    proteinDelta = Math.max(proteinDelta, base.proteinG * (rule.proteinPct / 100) * w);

    // Fiber: decrease wins
    const fDelta = rule.fiberGDelta * w;
    if (fDelta < 0) {
      fiberDecreaseWins = true;
      fiberDelta = Math.min(fiberDelta, fDelta);
    } else if (!fiberDecreaseWins) {
      fiberDelta = Math.max(fiberDelta, fDelta);
    }

    // Fat: most restrictive
    fatPctDelta = Math.min(fatPctDelta, rule.fatPct * w);

    // Carbs: max increase
    carbsPctDelta = Math.max(carbsPctDelta, rule.carbsPct * w);

    // Steps/active: MAX; cap to 0 for vomiting or severe nausea
    const activitySuppressed =
      (type === 'vomiting' || type === 'nausea') && log.severity >= 8;
    if (!activitySuppressed) {
      stepsDelta = Math.max(stepsDelta, rule.stepsDelta * w);
      activeMinDelta = Math.max(activeMinDelta, rule.activeMinDelta * w);
    }

    // Meal frequency: highest
    if (rule.mealFrequency > mealFrequency) mealFrequency = rule.mealFrequency;

    // Resistance flag
    if (rule.resistanceFlag) resistanceFlag = true;

    // Fiber type: most restrictive wins
    if (rule.fiberType) {
      const incomingPriority = fiberTypePriority[rule.fiberType] ?? 0;
      const existingPriority = fiberType ? (fiberTypePriority[fiberType] ?? 0) : 0;
      if (incomingPriority > existingPriority) fiberType = rule.fiberType;
    }

    // Food flags (deduplicated)
    for (const f of rule.foodsToAvoid ?? []) {
      if (!foodsToAvoid.includes(f)) foodsToAvoid.push(f);
    }
    for (const f of rule.foodsToPrioritize ?? []) {
      if (!foodsToPrioritize.includes(f)) foodsToPrioritize.push(f);
    }

    reasons.push(`${rule.label} (logged ${daysLabel})`);
  }

  // Apply deltas with hard floors
  const newProteinG = Math.round(base.proteinG + proteinDelta);
  const newWaterMl = Math.min(4000, Math.round(base.waterMl + waterDelta));
  const newFiberG = Math.max(15, Math.round(base.fiberG + fiberDelta));
  const newFatG = Math.max(20, Math.round(base.fatG * (1 + fatPctDelta / 100)));
  const newCarbsG = Math.max(50, Math.round(base.carbsG * (1 + carbsPctDelta / 100)));
  const newSteps = Math.round(base.steps + stepsDelta);
  const newActiveCalories = Math.round(base.activeCaloriesTarget + activeMinDelta * 3);

  return {
    ...base,
    proteinG: newProteinG,
    waterMl: newWaterMl,
    fiberG: newFiberG,
    fatG: newFatG,
    carbsG: newCarbsG,
    steps: newSteps,
    activeCaloriesTarget: newActiveCalories,
    mealFrequency,
    foodsToAvoid,
    foodsToPrioritize,
    adjustmentReasons: reasons,
    resistanceTrainingRecommended: resistanceFlag,
    fiberType,
  };
}
