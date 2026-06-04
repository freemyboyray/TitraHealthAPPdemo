import { ActivityLevel, FullUserProfile, Glp1Type } from './user-profile';
import { applyAdjustments, type RecentSideEffectLog } from '@/lib/targets';
import { localDateStr } from '@/lib/date-utils';

// Medical source citations are centralized in constants/medical-sources.ts
// for App Store Guideline 1.4.1 compliance.

// ─── Types ────────────────────────────────────────────────────────────────────

export type DailyTargets = {
  proteinG: number;
  waterMl: number;
  fiberG: number;
  steps: number;
  // Phase-aware targets (Layer 2)
  caloriesTarget: number;
  carbsG: number;
  fatG: number;
  activeCaloriesTarget: number;
  exerciseMinutesTarget: number;
  proteinPriority: boolean;
  programPhase: ProgramPhase;
  // Side-effect adjustment metadata (only populated when adjustments apply)
  mealFrequency?: number;
  foodsToAvoid?: string[];
  foodsToPrioritize?: string[];
  adjustmentReasons?: string[];
  resistanceTrainingRecommended?: boolean;
  fiberType?: string;
  checkinAdjustmentReasons?: string[];
};

export type DailyActuals = {
  proteinG: number;
  waterMl: number;
  fiberG: number;
  steps: number;
  caloriesKcal: number;
  injectionLogged: boolean;
  exerciseMinutes: number;
  workoutMinutes: number;
  workoutCalories: number;
  flightsClimbed: number;
};

export type WearableData = {
  sleepMinutes?: number; // e.g. 443 = 7h 23m
  hrvMs?: number;        // e.g. 45
  restingHR?: number;    // e.g. 58
  spo2Pct?: number;      // e.g. 98
  respRateRpm?: number;  // normal: 12–20; elevated = illness/stress (HealthKit Phase 2)
  mindfulMinutes?: number; // meditation/mindfulness sessions today
};

// ─── Shot Phase Type ──────────────────────────────────────────────────────────
// Defined here (before scoring formulas) so phase-aware functions can reference it.

export type ShotPhase = 'shot' | 'peak' | 'balance' | 'reset';

// ─── Intraday Phase Type (daily drugs) ───────────────────────────────────────
// Replaces cycle-day phase for drugs with injFreqDays === 1.
// post_dose: within first half of Tmax
// peak:      between half-Tmax and 2×Tmax (highest appetite suppression)
// trough:    beyond 2×Tmax (hunger may rise before next dose)
export type IntradayPhase = 'post_dose' | 'peak' | 'trough';

// ─── Schedule Mode Gate ───────────────────────────────────────────────────────
// cycle-day: 7d / 14d — phase = function of days since injection
// intraday:  1d daily — phase = function of hours since dose

export type ScheduleMode = 'cycle-day' | 'intraday';

export function getScheduleMode(injFreqDays: number): ScheduleMode {
  return injFreqDays === 1 ? 'intraday' : 'cycle-day';
}

// ─── Program Phase Type ───────────────────────────────────────────────────────
// 3-tier clinical phase derived from escalation phase name.
// Drives protein multipliers, calorie adaptation, and activity targets.

export type ProgramPhase = 'initiation' | 'titration' | 'maintenance';

// ─── InjectionLog (minimal shape needed for medication scoring) ───────────────
export type InjectionLogForScoring = {
  injection_date: string;
  injection_time?: string | null;
};

// ─── Shot Cycle ───────────────────────────────────────────────────────────────

export function daysSinceInjection(
  lastInjectionDate: string | Date | null | undefined,
  refDate?: Date,
  injFreqDays: number = 7,
): number {
  if (!lastInjectionDate) return injFreqDays;
  // Parse as local midnight to avoid UTC-offset skew (same logic as Insights page)
  const lastMs =
    typeof lastInjectionDate === 'string'
      ? new Date(lastInjectionDate + 'T00:00:00').getTime()
      : lastInjectionDate.getTime();
  if (isNaN(lastMs)) return injFreqDays;
  // Anchor ref to local midnight so timezone doesn't shift the day count
  const ref = new Date(refDate ?? new Date());
  ref.setHours(0, 0, 0, 0);
  const days = Math.round((ref.getTime() - lastMs) / 86400000);
  return Math.max(0, Math.min(injFreqDays, days));
}

/** Unclamped days since last injection — for PK concentration calculations
 *  that must continue decaying beyond the dosing interval.
 *  Returns Infinity when no injection date is available. */
export function rawDaysSinceInjection(
  lastInjectionDate: string | Date | null | undefined,
  refDate?: Date,
): number {
  if (!lastInjectionDate) return Infinity;
  const lastMs =
    typeof lastInjectionDate === 'string'
      ? new Date(lastInjectionDate + 'T00:00:00').getTime()
      : lastInjectionDate.getTime();
  if (isNaN(lastMs)) return Infinity;
  const ref = new Date(refDate ?? new Date());
  ref.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((ref.getTime() - lastMs) / 86400000));
}

/** Hours since last dose (for intraday phase computation on daily drugs). */
export function hoursSinceDose(
  lastDoseDate: string | null | undefined,
  doseTime: string = '08:00',
): number {
  if (!lastDoseDate) return 12; // mid-day fallback
  const [hh, mm] = doseTime.split(':').map(Number);
  const doseMs = new Date(lastDoseDate + 'T' + doseTime + ':00').getTime();
  if (isNaN(doseMs)) return 12;
  const elapsedMs = Date.now() - doseMs;
  // If negative (dose is in the future today), wrap to yesterday
  if (elapsedMs < 0) return Math.max(0, (elapsedMs + 86400000) / 3600000);
  return Math.min(24, elapsedMs / 3600000);
}

/** Number of calendar days between two injection_date strings (absolute value). */
export function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.abs(
    Math.round((new Date(dateA).getTime() - new Date(dateB).getTime()) / msPerDay),
  );
}

// ─── Dynamic Daily Targets ────────────────────────────────────────────────────

const stepsMap: Record<ActivityLevel, number> = {
  sedentary: 4000,
  light: 6000,
  active: 8000,
  very_active: 10000,
};

const activeCaloriesMap: Record<ActivityLevel, number> = {
  sedentary: 150,
  light: 250,
  active: 350,
  very_active: 450,
};

const exerciseMinutesMap: Record<ActivityLevel, number> = {
  sedentary: 15,
  light: 30,
  active: 45,
  very_active: 60,
};

export function getDailyTargets(
  profile: FullUserProfile,
  opts?: {
    programPhase?: ProgramPhase;
    baseCaloriesTarget?: number;
    weightLostKg?: number;
    /** Recent side-effect logs (last 7 days) - used to apply evidence-based adjustments. */
    sideEffectLogs?: RecentSideEffectLog[];
  },
): DailyTargets {
  const programPhase: ProgramPhase = opts?.programPhase ?? 'initiation';

  // Protein: 1.2 g/kg base — minimum per 2025 ACLM/ASN/OMA/TOS Joint Advisory
  // Source: AJCN 2025 — Nutritional Priorities to Support GLP-1 Therapy
  // 1.2 g/kg is the evidence-based floor; medication-dose and phase multipliers
  // layer on top, hard-capped at 1.6 g/kg.
  let proteinG = profile.weightKg * 1.2;

  // Medication-specific: higher doses = slightly more lean mass risk → gentle bump
  if (profile.glp1Type === 'semaglutide') {
    if (profile.doseMg >= 1.7) proteinG *= 1.1;
    else if (profile.doseMg >= 1.0) proteinG *= 1.05;
  } else if (profile.glp1Type === 'tirzepatide') {
    if (profile.doseMg >= 10) proteinG *= 1.1;
    else if (profile.doseMg >= 7.5) proteinG *= 1.05;
  }

  // Program phase: modest increase as user progresses (no aggressive stacking)
  const programPhaseMultiplier: Record<ProgramPhase, number> = {
    initiation:  1.0,
    titration:   1.05,
    maintenance: 1.1,
  };
  proteinG *= programPhaseMultiplier[programPhase];

  // Hard cap: 1.6 g/kg/day (clinical floor-to-mid range)
  proteinG = Math.min(proteinG, profile.weightKg * 1.6);

  // GLP-1 ramp for new starters (first 3 weeks on current dose) — ease in gently
  const doseStart = new Date(profile.doseStartDate ?? profile.startDate ?? Date.now());
  const daysSinceStart = Math.floor((Date.now() - doseStart.getTime()) / 86400000);
  if (daysSinceStart < 7) proteinG *= 0.8;
  else if (daysSinceStart < 21) proteinG *= 0.9;

  // Hydration: 30 ml/kg base, capped at 3L (conservative, achievable)
  // Source: National Academies DRI for Water — ~30 mL/kg/day adequate intake.
  const waterMl = Math.min(3000, Math.max(2000, Math.round(profile.weightKg * 30)));

  // Fiber: 20g — achievable baseline (average American eats ~15g)
  // Source: Weickert MO, Pfeiffer AFH. J Nutr. 2018;148(1):7-12.
  const fiberG = 20;

  // Steps: activity level driven, with maintenance boost to counter metabolic adaptation
  let steps = stepsMap[profile.activityLevel] ?? 8000;
  if (programPhase === 'maintenance') steps = Math.round(steps * 1.1);

  // Active calories: activity level base with phase adjustments
  // Titration: ×0.9 - side effects may reduce capacity during dose escalation
  // Maintenance: ×1.05 - counter metabolic adaptation at stable weight
  let activeCaloriesTarget = activeCaloriesMap[profile.activityLevel] ?? 300;
  if (programPhase === 'titration') activeCaloriesTarget = Math.round(activeCaloriesTarget * 0.9);
  else if (programPhase === 'maintenance') activeCaloriesTarget = Math.round(activeCaloriesTarget * 1.05);

  // Exercise minutes: activity level driven, phase-adjusted
  let exerciseMinutesTarget = exerciseMinutesMap[profile.activityLevel] ?? 30;
  if (programPhase === 'titration') exerciseMinutesTarget = Math.round(exerciseMinutesTarget * 0.8);
  else if (programPhase === 'maintenance') exerciseMinutesTarget = Math.round(exerciseMinutesTarget * 1.1);

  // Calories: use stored onboarding target (TDEE−500) or rough estimate fallback
  const estimatedBase = Math.round(profile.weightKg * 28); // rough TDEE−500 fallback
  let caloriesTarget = opts?.baseCaloriesTarget ?? estimatedBase;

  // Maintenance: apply metabolic adaptation adjustment (conservative 10 kcal/kg lost)
  if (programPhase === 'maintenance' && opts?.weightLostKg) {
    caloriesTarget = Math.max(1200, caloriesTarget - Math.round(opts.weightLostKg * 10));
  }

  // Macros: derive from resolved calories + protein
  // Source: American College of Lifestyle Medicine (ACLM), 2025 guidelines.
  const fatG = Math.round(caloriesTarget * 0.28 / 9);
  const fatCals = fatG * 9;
  const proteinCals = Math.round(proteinG) * 4;
  const carbsG = Math.round(Math.max(50, caloriesTarget - proteinCals - fatCals) / 4);

  const base = {
    proteinG: Math.round(proteinG),
    waterMl,
    fiberG,
    steps,
    caloriesTarget,
    carbsG,
    fatG,
    activeCaloriesTarget,
    exerciseMinutesTarget,
    proteinPriority: programPhase === 'titration',
    programPhase,
  };

  // Apply evidence-based side-effect adjustments if recent logs provided
  if (opts?.sideEffectLogs && opts.sideEffectLogs.length > 0) {
    return applyAdjustments(base, opts.sideEffectLogs);
  }

  return base;
}

// ─── Recovery Sub-Scorers ─────────────────────────────────────────────────────

export function scoreSleep(minutes: number): number {
  if (minutes >= 420 && minutes <= 540) return 1.0;
  if (minutes >= 360 && minutes < 420) return 0.75;
  if (minutes >= 300 && minutes < 360) return 0.5;
  if (minutes > 540 && minutes <= 600) return 0.85;
  if (minutes > 600) return 0.65;
  return Math.max(0, minutes / 420);
}

export function scoreHRV(ms: number): number {
  if (ms >= 60) return 1.0;
  if (ms >= 50) return 0.9;
  if (ms >= 40) return 0.75;
  if (ms >= 30) return 0.55;
  if (ms >= 20) return 0.35;
  return 0.1;
}

export function scoreRHR(bpm: number): number {
  if (bpm < 55) return 1.0;
  if (bpm < 65) return 0.85;
  if (bpm < 75) return 0.65;
  if (bpm < 85) return 0.4;
  return 0.15;
}

export function scoreSPO2(pct: number): number {
  if (pct >= 98) return 1.0;
  if (pct >= 96) return 0.8;
  if (pct >= 94) return 0.5;
  if (pct >= 90) return 0.2;
  return 0;
}

// Normal resting respiratory rate: 12–20 bpm. Elevated signals illness or stress.
export function scoreRespRate(rpm: number): number {
  if (rpm >= 12 && rpm <= 20) return 1.0;
  if (rpm >= 10 && rpm < 12) return 0.7;
  if (rpm > 20 && rpm <= 24) return 0.5;
  if (rpm > 24 && rpm <= 28) return 0.25;
  return 0.1;
}

// ─── Baseline-Normalized Scoring (WHOOP-style personal baselines) ────────────
// When a personal baseline is available (14+ days of data), score relative to
// the user's own average rather than absolute population thresholds.
// Falls back to absolute scoring (scoreHRV/scoreRHR) when no baseline exists.

/** HRV scored against personal baseline. +20% above → 1.0, at baseline → 0.75, -30% below → 0.30 */
export function scoreHRVBaseline(todayMs: number, baselineMs: number): number {
  if (baselineMs <= 0) return scoreHRV(todayMs);
  const pctDiff = (todayMs - baselineMs) / baselineMs;
  // Linear interpolation: -0.30 → 0.30, 0.0 → 0.75, +0.20 → 1.0
  const score = 0.75 + pctDiff * (pctDiff >= 0 ? 1.25 : 1.5);
  return Math.max(0.05, Math.min(1.0, score));
}

/** RHR scored against personal baseline (inverted — lower is better). -10% below → 1.0, at baseline → 0.75, +20% above → 0.30 */
export function scoreRHRBaseline(todayBpm: number, baselineBpm: number): number {
  if (baselineBpm <= 0) return scoreRHR(todayBpm);
  const pctDiff = (todayBpm - baselineBpm) / baselineBpm;
  // Inverted: -0.10 → 1.0, 0.0 → 0.75, +0.20 → 0.30
  const score = 0.75 - pctDiff * (pctDiff >= 0 ? 2.25 : 2.5);
  return Math.max(0.05, Math.min(1.0, score));
}

/** Calorie adequacy scored with a bell curve. Under-eating penalized more steeply than over-eating. */
export function scoreCalories(actualKcal: number, targetKcal: number): number {
  if (targetKcal <= 0) return 0;
  const ratio = actualKcal / targetKcal;
  if (ratio >= 0.85 && ratio <= 1.10) return 1.0;  // optimal range
  if (ratio < 0.85) {
    // Under-eating penalty: 50% → 0.30, 70% → 0.65
    return Math.max(0.05, ratio / 0.85);
  }
  // Over-eating: gentle penalty — 130% → 0.85, 150%+ → 0.70
  return Math.max(0.70, 1.0 - (ratio - 1.10) * 0.75);
}

// ─── GLP-1 Phase Offsets ──────────────────────────────────────────────────────
// GLP-1 RAs suppress HRV by ~6ms and raise RHR by 2–4 bpm via autonomic effects.
// These offsets adjust the effective input during scoring so patients are not
// penalized for clinically expected, medication-induced biometric changes.
// Raw displayed values remain unchanged; only the score contribution shifts.

export function glp1HrvOffset(phase: ShotPhase): number {
  if (phase === 'peak') return 6;  // peak drug concentration → largest HRV suppression
  if (phase === 'shot') return 3;
  return 0;
}

export function glp1RhrOffset(phase: ShotPhase): number {
  if (phase === 'peak') return -3;  // GLP-1 raises RHR; negative offset lowers effective bpm for scoring
  if (phase === 'shot') return -2;
  return 0;
}

/**
 * HRV offset for intraday phase (daily drugs).
 * Liraglutide: intraday peak = −4ms HRV effect.
 * Oral sema: near-flat steady-state = −4ms all day (flat offset, no phase variation).
 * Orforglipron: similar to liraglutide.
 */
export function glp1HrvOffsetIntraday(phase: IntradayPhase, glp1Type?: string): number {
  if (glp1Type === 'oral_semaglutide') return 4; // flat steady-state offset
  if (phase === 'peak') return 4;
  return 0;
}

export function glp1RhrOffsetIntraday(phase: IntradayPhase, glp1Type?: string): number {
  if (glp1Type === 'oral_semaglutide') return -2; // flat steady-state offset
  if (phase === 'peak') return -2;
  return 0;
}

// ─── Scoring Formulas ─────────────────────────────────────────────────────────
// Adaptive: only includes components where data is actually available.
// Returns null when no wearable data is present at all.

export function computeRecovery(wearable: Partial<WearableData>, phase?: ShotPhase): number | null {
  const components: { score: number; weight: number }[] = [];

  if (wearable.sleepMinutes != null)
    components.push({ score: scoreSleep(wearable.sleepMinutes), weight: 35 });
  if (wearable.hrvMs != null) {
    const adjHrv = phase ? wearable.hrvMs + glp1HrvOffset(phase) : wearable.hrvMs;
    components.push({ score: scoreHRV(adjHrv), weight: 30 });
  }
  if (wearable.restingHR != null) {
    const adjRhr = phase ? wearable.restingHR + glp1RhrOffset(phase) : wearable.restingHR;
    components.push({ score: scoreRHR(adjRhr), weight: 15 });
  }
  if (wearable.spo2Pct != null)
    components.push({ score: scoreSPO2(wearable.spo2Pct), weight: 10 });
  if (wearable.respRateRpm != null)
    components.push({ score: scoreRespRate(wearable.respRateRpm), weight: 10 });
  if (wearable.mindfulMinutes != null && wearable.mindfulMinutes > 0)
    components.push({ score: Math.min(wearable.mindfulMinutes / 30, 1), weight: 5 });

  if (components.length === 0) return null;

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  return Math.round(
    components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight * 100
  );
}

/** @deprecated Use computeGlp1AdherenceScore instead. Kept for backward compat with log.tsx. */
export function computeGlp1Support(actual: DailyActuals, targets: DailyTargets): number {
  const protein   = Math.min(actual.proteinG / targets.proteinG, 1) * 30;
  const hydration = Math.min(actual.waterMl  / targets.waterMl,  1) * 20;
  const fiber     = Math.min(actual.fiberG   / targets.fiberG,   1) * 15;
  const movement  = Math.min(actual.steps    / targets.steps,    1) * 20;
  const medication = actual.injectionLogged ? 15 : 0;
  return Math.round(protein + hydration + fiber + movement + medication);
}

// ─── Phase Component Weights ──────────────────────────────────────────────────

export type PhaseComponentWeights = {
  medication:  number;
  sideEffects: number;
  nutrition:   number;
  activity:    number;
};

/**
 * Returns score component weights for each 3-tier program phase.
 * Falls back to titration weights for unknown values.
 */
export function getPhaseWeights(programPhase: string): PhaseComponentWeights {
  switch (programPhase) {
    case 'initiation':
      return { medication: 45, sideEffects: 30, nutrition: 15, activity: 10 };
    case 'maintenance':
      return { medication: 30, sideEffects: 20, nutrition: 30, activity: 20 };
    case 'titration':
    default:
      return { medication: 35, sideEffects: 25, nutrition: 25, activity: 15 };
  }
}

// ─── Side Effect Burden ───────────────────────────────────────────────────────
// Separate from the SideEffectLog type to avoid circular imports.
export type SideEffectEntry = {
  effect_type: string;
  severity: number;
  phase_at_log: string;
  logged_at: string;
};

export type SideEffectBurdenResult = {
  burden: number;        // 0–100 (higher = more burden)
  thiamineRisk: boolean; // true when severity ≥6 nausea/vomiting within 72h
};

/**
 * Compute a 0–100 side-effect burden score from recent logs.
 * Incorporates both frequency (how many days had effects) and severity.
 * GI effects (nausea, vomiting, sulfur_burps): ×1.3 multiplier
 * Low-concern effects (fatigue, hair_loss): ×0.8 multiplier
 * Thiamine risk: severity ≥6 nausea/vomiting within 72h of refDate.
 *
 * @param windowDays  Look-back window in days (default 14)
 * @param refDate     Reference date for window + thiamine risk (default now)
 */
export function computeSideEffectBurden(
  logs: SideEffectEntry[],
  currentPhase: ShotPhase,
  windowDays: number = 14,
  refDate?: Date,
): SideEffectBurdenResult {
  const ref = refDate ?? new Date();
  const cutoffMs = ref.getTime() - windowDays * 86400000;
  const cutoff72h = ref.getTime() - 72 * 3600000;
  const recent = logs.filter(l => new Date(l.logged_at).getTime() >= cutoffMs);

  if (recent.length === 0) return { burden: 0, thiamineRisk: false };

  const GI_HIGH     = new Set(['nausea', 'vomiting', 'sulfur_burps']);
  const LOW_CONCERN = new Set(['fatigue', 'hair_loss']);
  const GI_EXPECTED = new Set(['nausea', 'vomiting']); // for thiamine risk

  // Frequency component: how many distinct days had effects
  const uniqueDays = new Set(recent.map(l => l.logged_at.slice(0, 10)));
  const frequency_ratio = uniqueDays.size / windowDays;

  let weightedSeveritySum = 0;
  let thiamineRisk = false;

  for (const log of recent) {
    const effectMultiplier = GI_HIGH.has(log.effect_type) ? 1.3
      : LOW_CONCERN.has(log.effect_type) ? 0.8
      : 1.0;
    const rawSeverityPct = log.severity / 10; // 0–1
    weightedSeveritySum += rawSeverityPct * effectMultiplier;

    // Thiamine risk: severe nausea/vomiting within 72h (unchanged logic)
    const isRecent72h = new Date(log.logged_at).getTime() >= cutoff72h;
    if (isRecent72h && GI_EXPECTED.has(log.effect_type) && log.severity >= 6) {
      thiamineRisk = true;
    }
  }

  const avg_severity_pct = weightedSeveritySum / recent.length; // 0–1+
  const burden = Math.min(100, Math.round(
    (frequency_ratio * 0.4 + avg_severity_pct * 0.6) * 100,
  ));

  return { burden, thiamineRisk };
}

// ─── Medication Streak Scoring ────────────────────────────────────────────────

export function computeMedicationScore(
  injectionLogs: InjectionLogForScoring[],
  injectionFreqDays: number,
): number {
  const sorted = [...injectionLogs].sort((a, b) =>
    b.injection_date.localeCompare(a.injection_date),
  );
  const last = sorted[0];
  if (!last) return 0;

  // Daily drug adherence: stricter — each missed day drops 20 points
  // (daily consistency is critical for oral bioavailability and intraday PK)
  if (injectionFreqDays === 1) {
    const today = localDateStr(new Date());
    const dosedToday = sorted.some(l => l.injection_date === today);
    if (dosedToday) {
      // Streak bonus: consecutive daily logs
      let streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const gap = daysBetween(sorted[i - 1].injection_date, sorted[i].injection_date);
        if (gap === 1) streak++;
        else break;
      }
      const streakBonus = streak >= 14 ? 10 : streak >= 7 ? 6 : streak >= 3 ? 3 : 0;
      return Math.min(25 + streakBonus, 35);
    }
    // Missed today — check if logged yesterday (1 day late)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dosedYesterday = sorted.some(l => l.injection_date === localDateStr(yesterday));
    return dosedYesterday ? 10 : 0;
  }

  const daysLate = daysSinceInjection(last.injection_date, undefined, injectionFreqDays) - injectionFreqDays;
  const injectOnTime =
    daysLate <= 0 ? 20
    : daysLate === 1 ? 15
    : daysLate <= 3 ? 8
    : daysLate <= 5 ? 3
    : 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].injection_date, sorted[i].injection_date);
    if (gap <= injectionFreqDays + 1) streak++;
    else break;
  }
  const streakBonus = streak >= 8 ? 10 : streak >= 4 ? 6 : streak >= 2 ? 3 : 0;

  const onCycleBonus = daysLate <= 0 ? (last.injection_time ? 5 : 2) : 0;

  return Math.min(injectOnTime + streakBonus + onCycleBonus, 35);
}

// ─── GLP-1 Adherence Score (replaces GLP-1 Support) ─────────────────────────
// Weights: Medication(35) + SideEffects(25) + Protein(25) + Activity(15)
// Adaptive exclusion: protein only counted if food was logged; activity only if steps data available.

export function computeGlp1AdherenceScore(
  actual: DailyActuals,
  targets: DailyTargets,
  sideEffectBurden: number,  // 0–100 from computeSideEffectBurden
  injectionLogs?: InjectionLogForScoring[],
  injFreqDays?: number,
  hasActivityData?: boolean,
  hasFoodData?: boolean,
  phaseWeights?: PhaseComponentWeights,
  proteinPriority?: boolean,
): number {
  const w = phaseWeights ?? { medication: 35, sideEffects: 25, nutrition: 25, activity: 15 };
  const components: { score: number; weight: number }[] = [];

  // Medication - always available (normalize raw 0–35 points to 0–100 scale)
  if (injectionLogs != null && injFreqDays != null) {
    components.push({ score: (computeMedicationScore(injectionLogs, injFreqDays) / 35) * 100, weight: w.medication });
  } else {
    // Fallback: binary logged/not-logged
    components.push({ score: actual.injectionLogged ? 100 : 0, weight: w.medication });
  }

  // Side Effects - always included (defaults to neutral if no logs)
  components.push({ score: (1 - sideEffectBurden / 100) * 100, weight: w.sideEffects });

  // Protein - only if food was logged today
  const includeFood = hasFoodData !== undefined ? hasFoodData : actual.proteinG > 0;
  if (includeFood) {
    const proteinPct = Math.min(actual.proteinG / targets.proteinG, 1);
    // During titration, boost protein score 1.5× - appetite suppression increases lean mass loss risk
    const proteinScore = proteinPriority ? Math.min(100, proteinPct * 1.5 * 100) : proteinPct * 100;
    components.push({ score: proteinScore, weight: w.nutrition });
  }

  // Activity - blend steps (55%), exercise minutes (35%), flights intensity bonus (10%)
  const includeActivity = hasActivityData !== undefined ? hasActivityData
    : (actual.steps > 0 || actual.exerciseMinutes > 0 || actual.flightsClimbed > 0);
  if (includeActivity) {
    const stepsPct = Math.min(actual.steps / targets.steps, 1);
    const exercisePct = targets.exerciseMinutesTarget > 0
      ? Math.min(actual.exerciseMinutes / targets.exerciseMinutesTarget, 1) : 0;
    const intensityBonus = Math.min(actual.flightsClimbed / 10, 1);
    const activityScore = (stepsPct * 0.55 + exercisePct * 0.35 + intensityBonus * 0.10) * 100;
    components.push({ score: activityScore, weight: w.activity });
  }

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  // Components are already 0–100 scale - do NOT multiply by 100 again
  return Math.round(
    components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight,
  );
}

// ─── Color State Helpers ──────────────────────────────────────────────────────

export function recoveryColor(score: number): string {
  if (score < 40) return '#E53E3E';
  if (score < 60) return '#E8960C';
  if (score < 80) return '#F6CB45';
  return '#2B9450';
}

export function supportColor(score: number): string {
  if (score < 40) return '#E53E3E';
  if (score < 60) return '#E8960C';
  if (score < 80) return '#5B8BF5';
  return '#2B9450';
}

// ─── Contextual Ring Messages ─────────────────────────────────────────────────

export function recoveryMessage(score: number): string {
  if (score < 40) return 'Under stress today';
  if (score < 60) return 'Light recovery day';
  if (score < 80) return 'Moderately recovered';
  return 'Well recovered';
}

export function supportMessage(score: number): string {
  if (score < 40) return 'Needs attention';
  if (score < 60) return 'Getting there';
  if (score < 80) return 'Supporting well';
  return 'Excellent support';
}

// ─── Insight Engine ───────────────────────────────────────────────────────────

export function generateInsights(
  recovery: number | null,
  support: number,
  wearable: Partial<WearableData>,
  actuals: DailyActuals,
  targets: DailyTargets,
): Array<{ text: string; phase: string }> {
  const insights: Array<{ text: string; phase: string }> = [];

  if (recovery != null) {
    if (recovery < 40) {
      insights.push({ text: 'Recovery is critically low - prioritize rest and light movement only', phase: 'ALERT' });
    }
    if (wearable.spo2Pct != null && wearable.spo2Pct < 94) {
      insights.push({ text: 'Oxygen saturation is below normal - check for illness or altitude effects', phase: 'ALERT' });
    }

    if (recovery >= 70 && support < 50) {
      insights.push({ text: 'Body is well recovered - boost your support score with protein and hydration', phase: 'TODAY' });
    } else if (recovery < 60 && support >= 70) {
      insights.push({ text: 'GLP-1 support is strong - rest today to let your body consolidate gains', phase: 'RECOVERY' });
    } else if (recovery >= 70 && support >= 70) {
      insights.push({ text: 'Both scores are strong - maintain your current habits for best GLP-1 outcomes', phase: 'SHOT PHASE' });
    }
  } else {
    // No wearable data
    if (support < 50) {
      insights.push({ text: 'Connect Apple Health to track recovery alongside your adherence score', phase: 'TODAY' });
    }
  }

  const proteinPct = actuals.proteinG / targets.proteinG;
  const waterPct   = actuals.waterMl  / targets.waterMl;
  const sleepMin   = wearable.sleepMinutes;

  if (sleepMin != null && sleepMin < 360) {
    insights.push({ text: 'Sleep is below 6h - poor sleep blunts GLP-1 appetite control by up to 30% (Spiegel K, et al. Ann Intern Med. 2004)', phase: 'RECOVERY' });
  } else if (!actuals.injectionLogged) {
    insights.push({ text: 'Log your dose to unlock the full medication bonus and enable phase-aware coaching', phase: 'TODAY' });
  } else if (proteinPct < 0.5) {
    insights.push({ text: `Protein is at ${Math.round(proteinPct * 100)}% - aim for ${targets.proteinG}g to preserve muscle on GLP-1`, phase: 'NUTRITION' });
  } else if (waterPct < 0.6) {
    insights.push({ text: `Hydration is at ${Math.round(waterPct * 100)}% - adequate water reduces GLP-1 side effects`, phase: 'HYDRATION' });
  } else if (wearable.hrvMs != null && wearable.hrvMs >= 50) {
    insights.push({ text: 'HRV is strong - your body is recovering well from medication', phase: 'SHOT PHASE' });
  } else {
    insights.push({ text: 'All vitals are in range - maintain your current habits', phase: 'SHOT PHASE' });
  }

  return insights.slice(0, 3);
}

// ─── Breakdown Rows ───────────────────────────────────────────────────────────

export function recoveryBreakdown(
  wearable: Partial<WearableData>,
  phase?: ShotPhase,
): Array<{ label: string; actual: number; max: number; available: boolean }> {
  const adjHrv = wearable.hrvMs != null
    ? (phase ? wearable.hrvMs + glp1HrvOffset(phase) : wearable.hrvMs)
    : null;
  const adjRhr = wearable.restingHR != null
    ? (phase ? wearable.restingHR + glp1RhrOffset(phase) : wearable.restingHR)
    : null;

  return [
    {
      label: 'Sleep',
      actual: wearable.sleepMinutes != null ? Math.round(scoreSleep(wearable.sleepMinutes) * 35) : 0,
      max: 35,
      available: wearable.sleepMinutes != null,
    },
    {
      label: 'HRV',
      actual: adjHrv != null ? Math.round(scoreHRV(adjHrv) * 30) : 0,
      max: 30,
      available: wearable.hrvMs != null,
    },
    {
      label: 'Rest. HR',
      actual: adjRhr != null ? Math.round(scoreRHR(adjRhr) * 15) : 0,
      max: 15,
      available: wearable.restingHR != null,
    },
    {
      label: 'SpO\u2082',
      actual: wearable.spo2Pct != null ? Math.round(scoreSPO2(wearable.spo2Pct) * 10) : 0,
      max: 10,
      available: wearable.spo2Pct != null,
    },
    {
      label: 'Resp. Rate',
      actual: wearable.respRateRpm != null ? Math.round(scoreRespRate(wearable.respRateRpm) * 10) : 0,
      max: 10,
      available: wearable.respRateRpm != null,
    },
  ];
}

/** @deprecated Use adherenceBreakdown instead. */
export function supportBreakdown(
  actuals: DailyActuals,
  targets: DailyTargets,
): Array<{ label: string; actual: number; max: number }> {
  return [
    { label: 'Protein',    actual: Math.round(Math.min(actuals.proteinG / targets.proteinG, 1) * 30), max: 30 },
    { label: 'Hydration',  actual: Math.round(Math.min(actuals.waterMl  / targets.waterMl,  1) * 20), max: 20 },
    { label: 'Movement',   actual: Math.round(Math.min(actuals.steps    / targets.steps,    1) * 20), max: 20 },
    { label: 'Fiber',      actual: Math.round(Math.min(actuals.fiberG   / targets.fiberG,   1) * 15), max: 15 },
    { label: 'Medication', actual: actuals.injectionLogged ? 15 : 0,                                  max: 15 },
  ];
}

/**
 * 4-pillar adherence breakdown: Medication(35) + SideEffects(25) + Protein(25) + Activity(15)
 * Rows with included:false mean no data was available for that pillar.
 */
export function adherenceBreakdown(
  actuals: DailyActuals,
  targets: DailyTargets,
  sideEffectBurden: number,
  hasActivityData?: boolean,
  hasFoodData?: boolean,
): Array<{ label: string; actual: number; max: number; included: boolean; note?: string }> {
  const includeFood = hasFoodData !== undefined ? hasFoodData : actuals.proteinG > 0;
  const includeActivity = hasActivityData !== undefined ? hasActivityData : actuals.steps > 0;

  return [
    {
      label: 'Medication',
      actual: actuals.injectionLogged ? 35 : 0,
      max: 35,
      included: true,
    },
    {
      label: 'Side Effects',
      actual: Math.round((1 - sideEffectBurden / 100) * 25),
      max: 25,
      included: true,
    },
    {
      label: 'Protein',
      actual: includeFood ? Math.round(Math.min(actuals.proteinG / targets.proteinG, 1) * 25) : 0,
      max: 25,
      included: includeFood,
      note: includeFood ? undefined : 'Log meals to add protein to your score',
    },
    {
      label: 'Movement',
      actual: includeActivity ? Math.round(Math.min(actuals.steps / targets.steps, 1) * 15) : 0,
      max: 15,
      included: includeActivity,
      note: includeActivity ? undefined : 'Log activity to add movement to your score',
    },
  ];
}

// ─── Gradient Helpers ─────────────────────────────────────────────────────────

export function recoveryGradient(score: number): { start: string; end: string } {
  if (score < 40) return { start: '#C0392B', end: '#E74C3C' };
  if (score < 65) return { start: '#D4801A', end: '#F39C12' };
  if (score < 85) return { start: '#1E8449', end: '#27AE60' };
  return { start: '#0E6655', end: '#1ABC9C' };
}

export function supportGradient(score: number): { start: string; end: string } {
  if (score < 50) return { start: '#C05C10', end: '#FF742A' };
  if (score < 80) return { start: '#FF742A', end: '#F4A44A' };
  return { start: '#FF742A', end: '#F9BE6A' };
}

// ─── Sub-Metric Chip Data ─────────────────────────────────────────────────────

export type ChipData = { label: string; value: string; pct: number; glp1Note?: string };

export function recoveryChips(wearable: Partial<WearableData>): ChipData[] {
  const chips: ChipData[] = [];
  if (wearable.sleepMinutes != null) {
    const h = Math.floor(wearable.sleepMinutes / 60);
    const m = wearable.sleepMinutes % 60;
    chips.push({ label: 'Sleep', value: `${h}h ${m}m`, pct: scoreSleep(wearable.sleepMinutes) });
  }
  if (wearable.hrvMs != null) {
    chips.push({
      label: 'HRV', value: `${wearable.hrvMs}ms`, pct: scoreHRV(wearable.hrvMs),
      glp1Note: wearable.hrvMs < 50 ? 'GLP-1 effect' : undefined,
    });
  }
  if (wearable.restingHR != null) {
    chips.push({ label: 'Heart Rate', value: `${wearable.restingHR}`, pct: scoreRHR(wearable.restingHR) });
  }
  if (wearable.spo2Pct != null) {
    chips.push({ label: 'SpO\u2082', value: `${wearable.spo2Pct}%`, pct: scoreSPO2(wearable.spo2Pct) });
  }
  if (wearable.respRateRpm != null) {
    chips.push({ label: 'Resp. Rate', value: `${wearable.respRateRpm} bpm`, pct: scoreRespRate(wearable.respRateRpm) });
  }
  return chips;
}

/** @deprecated Use adherenceChips instead. */
export function supportChips(actuals: DailyActuals, targets: DailyTargets): ChipData[] {
  return [
    { label: 'Protein',  value: `${actuals.proteinG}g`,                          pct: Math.min(actuals.proteinG / targets.proteinG, 1) },
    { label: 'Water',    value: `${Math.round(actuals.waterMl / 29.57)}oz`,       pct: Math.min(actuals.waterMl / targets.waterMl, 1) },
    { label: 'Movement', value: actuals.steps.toLocaleString(),                   pct: Math.min(actuals.steps / targets.steps, 1) },
    { label: 'Fiber',    value: `${actuals.fiberG}g`,                             pct: Math.min(actuals.fiberG / targets.fiberG, 1) },
  ];
}

export function adherenceChips(
  actuals: DailyActuals,
  targets: DailyTargets,
  sideEffectBurden: number,
): ChipData[] {
  return [
    { label: 'Medication', value: actuals.injectionLogged ? 'Logged' : 'Not Logged', pct: actuals.injectionLogged ? 1 : 0 },
    { label: 'Protein',    value: `${actuals.proteinG}g`,                             pct: Math.min(actuals.proteinG / targets.proteinG, 1) },
    { label: 'Movement',   value: actuals.steps.toLocaleString(),                     pct: Math.min(actuals.steps / targets.steps, 1) },
    { label: 'Side Effects', value: `${sideEffectBurden}% burden`,                   pct: 1 - sideEffectBurden / 100 },
  ];
}

// ─── Breakdown Row Notes ──────────────────────────────────────────────────────
// Use the phase-aware functions below for all new code.
// Static arrays are preserved for backward compatibility only.

export function getRecoveryRowNotes(phase: ShotPhase): string[] {
  const hrvNote =
    phase === 'peak'
      ? "GLP-1 suppresses HRV by ~6ms during peak days (3–4) - this is a known medication effect. Your score has been adjusted. Exercise restores autonomic tone over 8+ weeks."
      : phase === 'shot'
      ? "GLP-1 begins suppressing HRV on injection day. Your score is adjusted for this medication effect. Consistent exercise counteracts it over time."
      : "GLP-1 medications cause an average −6.2ms HRV decrease via direct sinus node activation. Exercise counteracts this.";

  const rhrNote =
    phase === 'peak' || phase === 'shot'
      ? "GLP-1 raises resting HR by 2–4 bpm during active days. Your score reflects this phase adjustment. Physical activity attenuates the increase over 12 weeks."
      : "Resting HR reflects autonomic tone. GLP-1 users typically see 2–4 bpm improvement over 12 weeks.";

  return [
    "Below 7h blunts GLP-1 appetite control by reducing leptin and elevating ghrelin. (Spiegel K, et al. Ann Intern Med. 2004;141(11):846-850)",
    hrvNote,
    rhrNote,
    "SpO₂ below 96% signals respiratory stress or altitude effects unrelated to GLP-1 therapy.",
    "Resting respiratory rate 12–20 bpm is normal. Elevated rates can signal illness, stress, or dehydration, which is common during GLP-1 dose escalation.",
  ];
}

export function getGLP1RowNotes(phase: ShotPhase): string[] {
  const proteinNote =
    phase === 'shot'
      ? "Peak absorption phase - protein shake recommended today if nausea is mild. Adequate protein prevents muscle loss alongside fat."
      : "GLP-1 medications suppress appetite broadly - intentional protein intake prevents muscle loss alongside fat.";

  return [
    proteinNote,
    "Adequate hydration reduces nausea and constipation, the most common GLP-1 side effects. (National Academies DRI for Water)",
    "Daily movement improves insulin sensitivity and supports appetite regulation during GLP-1 therapy. (Blundell JE, et al. Obes Rev. 2015;16(Suppl 1):67-76)",
    "Fiber slows gastric emptying, complementing GLP-1's mechanism and reducing post-meal blood sugar spikes. (Weickert MO, Pfeiffer AFH. J Nutr. 2018)",
  ];
}

export const RECOVERY_ROW_NOTES = [
  "Below 7h blunts GLP-1 appetite control by reducing leptin and elevating ghrelin. (Spiegel K, et al. Ann Intern Med. 2004;141(11):846-850)",
  "GLP-1 receptor agonists increase heart rate via direct sinus node activation. Exercise counteracts this. (Smits MM, et al. Eur J Endocrinol. 2017;176(1):77-86)",
  "Resting HR reflects autonomic tone. GLP-1 users typically see 2–4 bpm increase that stabilizes over 12 weeks. (Smits MM, et al. Eur J Endocrinol. 2017;176(1):77-86)",
  "SpO₂ below 96% signals respiratory stress or altitude effects unrelated to GLP-1 therapy.",
  "Resting respiratory rate 12–20 bpm is normal. Elevated rates can signal illness, stress, or dehydration, which is common during GLP-1 dose escalation.",
];

export const GLP1_ROW_NOTES = [
  "GLP-1 medications suppress appetite broadly - intentional protein intake (1.0-1.6 g/kg/day) prevents muscle loss alongside fat. (Mechanick JI, et al. Obesity. 2013;21(S1):S1-S27)",
  "Adequate hydration reduces nausea and constipation, the most common GLP-1 side effects. (National Academies DRI for Water)",
  "Daily movement improves insulin sensitivity and supports appetite regulation during GLP-1 therapy. (Blundell JE, et al. Obes Rev. 2015;16(Suppl 1):67-76)",
  "Fiber slows gastric emptying, complementing GLP-1's mechanism and reducing post-meal blood sugar spikes. (Weickert MO, Pfeiffer AFH. J Nutr. 2018;148(1):7-12)",
];

export const RECOVERY_COACH_NOTE =
  "HRV and sleep improve most with consistent aerobic exercise and 7–9h sleep. GLP-1 users typically see +4ms HRV improvement over 8 weeks of treatment. (Smits MM, et al. Diabetes Obes Metab. 2019)";

export const GLP1_COACH_NOTE =
  "Hitting your protein target is the single highest-impact daily action on GLP-1. Each 10g above baseline preserves ~0.5 lbs of muscle over 12 weeks. (Wilding JPH, et al. N Engl J Med. 2021;384(11):989-1002)";

// ─── Focus Engine Types ───────────────────────────────────────────────────────

export type FocusCategory =
  | 'injection' | 'hydration' | 'protein' | 'fiber'
  | 'activity'  | 'sleep'     | 'recovery' | 'rest';

export type FocusItem = {
  id: FocusCategory;
  label: string;
  subtitle: string;
  status: 'completed' | 'active' | 'pending';
  /** Lucide component name, e.g. 'Droplet', 'Utensils' */
  lucideIcon: string;
  progressPct?: number;  // 0–100, omit for binary items (injection)
  valueLabel?: string;   // e.g. "142 / 180g" or "48 / 64oz"
};

// ─── Shot Phase Helper ────────────────────────────────────────────────────────

/**
 * Returns the cycle-day phase for weekly/bi-weekly drugs.
 * Thresholds scale proportionally with injFreqDays so 14-day cycles
 * are not permanently stuck in "shot" phase.
 *
 *   shotEnd    ≈ 15% of cycle  (first ~15%)
 *   peakEnd    ≈ 50% of cycle  (up to ~50%)
 *   balanceEnd ≈ 85% of cycle  (up to ~85%)
 *   remainder  = reset phase
 */
/**
 * Cycle day for display ("Day N of freq"). `daysSinceShot` (a.k.a. todayDayNum)
 * is days *elapsed* since the shot — 0 on shot day. Clinical convention calls
 * the shot day "Day 1", so the display day is elapsed + 1, capped at the cycle
 * length so an overdue shot never reads "Day 8 of 7". This keeps the day count
 * internally consistent with "In N days" (Day N + days-until = next cycle's Day 1).
 *
 * Single source of truth for the cycle-day label — use everywhere the cycle day
 * is shown (home gauge, vertical timeline, cycle-phase hero) so they never drift.
 */
export function cycleDisplayDay(daysSinceShot: number, injFreqDays: number = 7): number {
  return Math.min(daysSinceShot + 1, injFreqDays);
}

export function getShotPhase(daysSinceShot: number, injFreqDays: number = 7): ShotPhase {
  const shotEnd    = Math.max(1, Math.round(injFreqDays * 0.15));
  const peakEnd    = Math.max(2, Math.round(injFreqDays * 0.50));
  const balanceEnd = Math.max(3, Math.round(injFreqDays * 0.85));
  if (daysSinceShot <= shotEnd)    return 'shot';
  if (daysSinceShot <= peakEnd)    return 'peak';
  if (daysSinceShot <= balanceEnd) return 'balance';
  return 'reset';
}

/**
 * Returns the intraday phase for daily drugs (liraglutide, oral sema, orforglipron).
 * Uses Tmax-anchored thresholds:
 *   post_dose: 0 → Tmax * 0.5
 *   peak:      Tmax * 0.5 → Tmax * 2.0
 *   trough:    beyond Tmax * 2.0
 *
 * Drug-specific Tmax values (hours):
 *   liraglutide:       11h
 *   oral_semaglutide:  1h  (near-flat due to 158h t½ — effectively steady state all day)
 *   orforglipron:      8h
 */
export function getIntradayPhase(
  hoursSince: number,
  glp1Type: string,
): IntradayPhase {
  const tmaxMap: Record<string, number> = {
    liraglutide:      11,
    oral_semaglutide:  1,
    orforglipron:      8,
  };
  const tmax = tmaxMap[glp1Type] ?? 8;
  if (hoursSince < tmax * 0.5) return 'post_dose';
  if (hoursSince < tmax * 2.0) return 'peak';
  return 'trough';
}

// ─── Phase Multipliers ────────────────────────────────────────────────────────

const PHASE_WEIGHTS: Record<ShotPhase, Partial<Record<FocusCategory, number>>> = {
  shot:    { injection: 3.0, hydration: 1.5, protein: 1.2, sleep: 1.2, recovery: 1.3, activity: 0.8, fiber: 0.9 },
  peak:    { hydration: 2.0, rest: 2.5, recovery: 2.0, sleep: 1.8, protein: 1.0, activity: 0.4, fiber: 0.6 },
  balance: { activity: 1.4, fiber: 1.3, protein: 1.1, hydration: 1.0 },
  reset:   { protein: 1.3, activity: 1.3, hydration: 1.2, sleep: 1.1 },
};

// Intraday phase weights for daily drugs (liraglutide, oral sema, orforglipron).
// post_dose: just took medication — hydration + rest priority
// peak:      optimal satiety window — protein + activity window
// trough:    hunger may rise before next dose — protein + hydration to buffer
const INTRADAY_PHASE_WEIGHTS: Record<IntradayPhase, Partial<Record<FocusCategory, number>>> = {
  post_dose: { hydration: 2.0, injection: 1.0, rest: 1.5, sleep: 1.2, activity: 0.7, protein: 0.9 },
  peak:      { protein: 1.8, activity: 1.3, hydration: 1.2, fiber: 1.1, sleep: 1.0 },
  trough:    { protein: 1.5, hydration: 1.3, fiber: 1.2, activity: 1.1, sleep: 1.1 },
};

// ─── Focus Status Helpers ─────────────────────────────────────────────────────

function pctStatus(actual: number, target: number): 'completed' | 'active' | 'pending' {
  const pct = actual / target;
  if (pct >= 1) return 'completed';
  if (pct >= 0.1) return 'active';
  return 'pending';
}

function computeFocusStatus(
  category: FocusCategory,
  actuals: DailyActuals,
  targets: DailyTargets,
  wearable: Partial<WearableData>,
): 'completed' | 'active' | 'pending' {
  switch (category) {
    case 'injection': return actuals.injectionLogged ? 'completed' : 'pending';
    case 'hydration': return pctStatus(actuals.waterMl, targets.waterMl);
    case 'protein':   return pctStatus(actuals.proteinG, targets.proteinG);
    case 'fiber':     return pctStatus(actuals.fiberG, targets.fiberG);
    case 'activity':  return pctStatus(actuals.steps, targets.steps);
    case 'sleep':     return pctStatus(wearable.sleepMinutes ?? 0, 420);
    default:          return 'active';
  }
}

// ─── Focus Item Builder ───────────────────────────────────────────────────────

/** Returns day-of-year (1–365) for today, used to rotate subtitle tips. */
function getDayOfYear(date = new Date()): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

/** Picks a pool entry deterministically by day so it rotates daily. */
function dailyPick<T>(pool: T[], dayOfYear: number): T {
  return pool[dayOfYear % pool.length];
}

const PROTEIN_TIPS = [
  'Try chicken, Greek yogurt, eggs, or cottage cheese',
  'Small, frequent, high-protein meals work best',
  'A protein shake is an easy win on busy days',
  'GLP-1s reduce appetite, so front-load protein early',
];

const HYDRATION_TIPS = [
  'Keep a water bottle visible at all times',
  'Try sparkling water if plain water feels hard',
  'Herbal teas and broth count toward your intake',
  'Staying hydrated reduces nausea and fatigue',
];

const FIBER_TIPS = [
  'Beans, berries, avocado, and oats are great choices',
  'Fiber slows digestion, so space it out to avoid bloating',
  'Add veggies to your next meal for an easy fiber boost',
];

const ACTIVITY_TIPS = [
  'A 10-minute walk after meals improves glucose response',
  'Resistance training preserves lean mass on GLP-1s',
  'Even light movement counts. Take the stairs.',
];

const SLEEP_TIPS = [
  'Poor sleep can increase GLP-1 side effects',
  'Aim for 7–9 hours; avoid screens 30 min before bed',
];

// ─── Phase-aware motivational messages for Daily Focuses card ────────────────

// Drugs differ in how fast they peak after a dose, which changes the phase
// narrative. Semaglutide-class drugs build slowly (Tmax ~2\u20133 days), so shot day
// is NOT peak suppression; tirzepatide ramps quickly (Tmax ~1 day); daily/oral
// drugs sit near steady state and have no meaningful within-cycle taper.
type PeakProfile = 'building' | 'fast' | 'daily';

function peakProfileFor(glp1Type?: Glp1Type): PeakProfile {
  switch (glp1Type) {
    case 'tirzepatide':
      return 'fast';
    case 'liraglutide':
    case 'oral_semaglutide':
    case 'orforglipron':
      return 'daily';
    // semaglutide, dulaglutide (slow-building weekly drugs)
    default:
      return 'building';
  }
}

/** Human cadence word for the dosing interval (drives schedule-aware copy). */
function cadenceWord(injFreqDays: number): string {
  if (injFreqDays <= 1) return 'daily';
  if (injFreqDays === 7) return 'weekly';
  if (injFreqDays === 14) return 'every 2 weeks';
  return `every ${injFreqDays} days`;
}

const DRUG_PHASE_MESSAGES: Record<PeakProfile, Record<ShotPhase, { title: string; messages: string[] }>> = {
  // Semaglutide / dulaglutide: levels build over 2\u20133 days after the dose.
  building: {
    shot: {
      title: 'Dose Day',
      messages: [
        'Levels are just starting to climb \u2014 this drug class builds slowly and peaks around days 2\u20133, so appetite suppression ramps up over the next couple of days rather than today.',
        'Today\u2019s dose stacks onto what\u2019s already in your system. Effects build gradually, so keep meals light and sip water steadily as levels rise.',
      ],
    },
    peak: {
      title: 'Peak Phase',
      messages: [
        'Medication is near its peak (days 2\u20133 for this class). Appetite is most suppressed \u2014 make every bite protein-forward.',
        'You may have little hunger right now, but your body still needs fuel. Small, frequent, high-protein meals work best.',
      ],
    },
    balance: {
      title: 'Steady State',
      messages: [
        'Levels are stable and predictable \u2014 a great window to build protein and activity habits.',
        'Appetite is balanced today. Focus on hitting your fiber and water targets.',
      ],
    },
    reset: {
      title: 'Winding Down',
      messages: [
        'Hunger may start returning as levels taper toward your next dose. Lean on your habits to stay on track.',
        'Appetite creeping up is normal pharmacology, not failure. High-protein meals help bridge the gap.',
      ],
    },
  },
  // Tirzepatide: ramps quickly, peaks ~24h.
  fast: {
    shot: {
      title: 'Dose Day',
      messages: [
        'This drug ramps quickly \u2014 it peaks around 24 hours, so appetite suppression sets in fast. Lean on hydration and light, protein-rich meals.',
        'Effects come on quickly today and tomorrow. Nausea risk is highest now \u2014 sip water, favor electrolytes, and avoid heavy foods.',
      ],
    },
    peak: {
      title: 'Peak Phase',
      messages: [
        'Medication peaks around day 1 for this drug. Appetite is most suppressed \u2014 make every bite count with protein.',
        'Strongest suppression is early in the cycle. Small, frequent meals keep you fueled even when hunger is low.',
      ],
    },
    balance: {
      title: 'Steady State',
      messages: [
        'Past the early peak, levels are settling. A strong window to build protein and movement habits.',
        'Appetite is balanced. Focus on fiber, water, and consistent activity today.',
      ],
    },
    reset: {
      title: 'Winding Down',
      messages: [
        'Hunger may return as levels taper toward your next dose. Stay consistent with protein and hydration.',
        'Appetite returning late in the cycle is expected \u2014 lean on your habits to bridge to the next dose.',
      ],
    },
  },
  // Daily / oral drugs: near steady state, no meaningful within-cycle taper.
  daily: {
    shot: {
      title: 'Daily Rhythm',
      messages: [
        'Daily dosing keeps your levels fairly steady \u2014 there\u2019s no big within-day cycle. Take your dose consistently and aim for protein at each meal.',
        'Consistency is everything here. Same time each day keeps levels even and appetite predictable.',
      ],
    },
    peak: {
      title: 'Daily Rhythm',
      messages: [
        'Your level stays close to steady through the day. Protein and hydration matter more than timing your meals to a phase.',
        'Appetite suppression is fairly constant. Focus on hitting protein, fiber, and water targets every day.',
      ],
    },
    balance: {
      title: 'Daily Rhythm',
      messages: [
        'Steady levels mean steady energy \u2014 a good day for movement and habit-building.',
        'Nothing dramatic in the curve today. Keep meals protein-forward and stay hydrated.',
      ],
    },
    reset: {
      title: 'Daily Rhythm',
      messages: [
        'Hunger can creep up before your next dose \u2014 a protein-rich snack helps bridge the gap.',
        'If you feel hungrier toward dose time, that\u2019s normal. Stay consistent with timing and protein.',
      ],
    },
  },
};

/**
 * Phase narrative tailored to the user's drug and dosing schedule.
 * @param phase        computed shot phase
 * @param glp1Type     drug type (drives peak-timing copy)
 * @param injFreqDays  dosing interval in days (drives schedule-aware taper copy)
 */
export function getPhaseFocusMessage(
  phase: ShotPhase,
  glp1Type?: Glp1Type,
  injFreqDays: number = 7,
): { title: string; message: string } {
  const doy = getDayOfYear(new Date());
  const profile = peakProfileFor(glp1Type);
  const entry = DRUG_PHASE_MESSAGES[profile][phase];
  let message = dailyPick(entry.messages, doy);

  // Schedule-aware note for non-weekly injectable cadences (e.g. biweekly).
  if (phase === 'reset' && profile !== 'daily' && injFreqDays !== 7) {
    message += ` Your doses are spaced ${cadenceWord(injFreqDays)}, so this taper window runs ${injFreqDays > 7 ? 'longer' : 'shorter'} than a standard weekly cycle.`;
  }

  return { title: entry.title, message };
}

function buildFocusItem(
  category: FocusCategory,
  actuals: DailyActuals,
  targets: DailyTargets,
  wearable: Partial<WearableData>,
  phase: ShotPhase,
  dayOfYear = getDayOfYear(),
): FocusItem {
  const status = computeFocusStatus(category, actuals, targets, wearable);
  const phaseNote = phase === 'peak' ? ' · Peak GLP-1 day' : '';

  switch (category) {
    case 'injection':
      return {
        id: 'injection', label: 'Log Your Dose',
        subtitle: 'Keep your dose cycle accurate',
        lucideIcon: 'Syringe',
        status,
      };
    case 'hydration': {
      const loggedOz = Math.round(actuals.waterMl / 29.57);
      const targetOz = Math.round(targets.waterMl / 29.57);
      const pct = Math.round(actuals.waterMl / targets.waterMl * 100);
      const label =
        status === 'completed'
          ? 'Hydration goal crushed today'
          : pct >= 75
          ? 'Almost at your hydration goal'
          : 'Sip water throughout your day';
      const subtitle =
        phase === 'peak'
          ? 'Electrolytes critical today'
          : status === 'completed'
          ? `${targetOz}oz reached. Great work!`
          : dailyPick(HYDRATION_TIPS, dayOfYear);
      return {
        id: 'hydration', label, subtitle,
        lucideIcon: 'Droplet',
        status,
        progressPct: Math.min(100, actuals.waterMl / targets.waterMl * 100),
        valueLabel: `${loggedOz} / ${targetOz}oz`,
      };
    }
    case 'protein': {
      const loggedG = Math.round(actuals.proteinG);
      const pct = actuals.proteinG / targets.proteinG;
      const label =
        status === 'completed'
          ? 'Great job hitting protein today'
          : pct >= 0.75
          ? 'Almost at your protein goal'
          : 'Prioritize protein at every meal';
      const subtitle =
        phase === 'shot'
          ? 'Try a protein shake on shot day'
          : status === 'completed'
          ? `${targets.proteinG}g reached. Lean mass protected.`
          : dailyPick(PROTEIN_TIPS, dayOfYear);
      return {
        id: 'protein', label, subtitle,
        lucideIcon: 'Utensils',
        status,
        progressPct: Math.min(100, actuals.proteinG / targets.proteinG * 100),
        valueLabel: `${loggedG} / ${targets.proteinG}g`,
      };
    }
    case 'fiber': {
      const loggedG = Math.round(actuals.fiberG);
      const pct = actuals.fiberG / targets.fiberG;
      const label =
        status === 'completed'
          ? 'Fiber goal hit. Nice work!'
          : pct >= 0.75
          ? 'Almost at your fiber goal'
          : 'Add fiber to your next meal';
      const subtitle =
        status === 'completed'
          ? `${targets.fiberG}g reached. Digestion supported.`
          : dailyPick(FIBER_TIPS, dayOfYear);
      return {
        id: 'fiber', label, subtitle,
        lucideIcon: 'Leaf',
        status,
        progressPct: Math.min(100, actuals.fiberG / targets.fiberG * 100),
        valueLabel: `${loggedG} / ${targets.fiberG}g`,
      };
    }
    case 'activity': {
      const pct = actuals.steps / targets.steps;
      const label =
        status === 'completed'
          ? 'You got your movement in today'
          : pct >= 0.75
          ? 'Almost at your step goal'
          : 'Get some movement in today';
      const subtitle =
        status === 'completed'
          ? `${actuals.steps.toLocaleString()} steps. Well done!`
          : dailyPick(ACTIVITY_TIPS, dayOfYear);
      return {
        id: 'activity', label, subtitle,
        lucideIcon: 'Footprints',
        status,
        progressPct: Math.min(100, actuals.steps / targets.steps * 100),
        valueLabel: `${actuals.steps.toLocaleString()} / ${targets.steps.toLocaleString()} steps`,
      };
    }
    case 'sleep': {
      const sleepMin = wearable.sleepMinutes ?? 0;
      const hrs = Math.round(sleepMin / 60 * 10) / 10;
      const label =
        status === 'completed'
          ? 'Sleep goal achieved'
          : 'Prioritize sleep tonight';
      const subtitle =
        status === 'completed'
          ? `${hrs}h last night. Recovery on track.`
          : dailyPick(SLEEP_TIPS, dayOfYear) + phaseNote;
      return {
        id: 'sleep', label, subtitle,
        lucideIcon: 'Moon',
        status,
        progressPct: Math.min(100, sleepMin / 420 * 100),
        valueLabel: `${hrs}h / 7–9h`,
      };
    }
    case 'recovery': {
      const recovery = computeRecovery(wearable, phase);
      return {
        id: 'recovery',
        label: 'Recovery day. Take it easy.',
        subtitle: wearable.hrvMs != null && wearable.restingHR != null
          ? `HRV ${wearable.hrvMs}ms · RHR ${wearable.restingHR}bpm · Score ${recovery ?? '-'}`
          : 'Connect Apple Health to see recovery details',
        lucideIcon: 'Heart',
        status,
      };
    }
    case 'rest':
      return {
        id: 'rest',
        label: 'Rest & recover today',
        subtitle: 'Peak GLP-1 day. Light movement only.',
        lucideIcon: 'Brain',
        status,
      };
  }
}

// ─── Main Focus Generator ─────────────────────────────────────────────────────

export function generateFocuses(
  actuals: DailyActuals,
  targets: DailyTargets,
  wearable: Partial<WearableData>,
  daysSinceShot: number,
  programPhase?: ProgramPhase,
  isInjectionDue?: boolean,
  opts?: {
    injFreqDays?: number;
    intradayPhase?: IntradayPhase;
  },
): FocusItem[] {
  const injFreqDays = opts?.injFreqDays ?? 7;
  const scheduleMode = getScheduleMode(injFreqDays);
  const phase = getShotPhase(daysSinceShot, injFreqDays);
  const recovery = computeRecovery(wearable, phase) ?? 70;

  // Injection deficit: only non-zero when the dose is actually due.
  // isInjectionDue defaults to daysSinceShot >= injFreqDays for backwards compat.
  const injDue = isInjectionDue ?? daysSinceShot >= injFreqDays;

  const deficits: Record<FocusCategory, number> = {
    injection: actuals.injectionLogged ? 0 : (injDue ? 100 : 0),
    hydration: Math.max(0, (targets.waterMl - actuals.waterMl) / targets.waterMl * 100),
    protein:   Math.max(0, (targets.proteinG - actuals.proteinG) / targets.proteinG * 100),
    fiber:     Math.max(0, (targets.fiberG - actuals.fiberG) / targets.fiberG * 100),
    activity:  Math.max(0,
      ((targets.steps - actuals.steps) / targets.steps * 0.55 +
       (targets.exerciseMinutesTarget > 0 ? (targets.exerciseMinutesTarget - actuals.exerciseMinutes) / targets.exerciseMinutesTarget * 0.35 : 0) +
       (1 - Math.min(actuals.flightsClimbed / 10, 1)) * 0.10) * 100),
    sleep:     wearable.sleepMinutes != null ? (1 - scoreSleep(wearable.sleepMinutes)) * 100 : 0,
    recovery:  Math.max(0, 70 - recovery),
    rest:      phase === 'peak' ? Math.max(0, 65 - recovery) : 0,
  };

  // Use intraday weights for daily drugs, cycle-day weights for weekly/bi-weekly
  const weights: Partial<Record<FocusCategory, number>> =
    scheduleMode === 'intraday' && opts?.intradayPhase
      ? INTRADAY_PHASE_WEIGHTS[opts.intradayPhase]
      : PHASE_WEIGHTS[phase];

  const weighted = (Object.keys(deficits) as FocusCategory[]).map((cat) => {
    let mult = weights[cat] ?? 1.0;
    // During titration, boost protein ranking - appetite suppression at escalating doses
    // increases lean mass loss risk; surface protein focus even when other deficits exist
    if (cat === 'protein' && programPhase === 'titration') mult *= 1.5;
    return { cat, score: deficits[cat] * mult };
  });

  // Show all relevant focuses for the day as a stable checklist.
  // Items stay visible even after completion (shown with a checkmark).
  // Only exclude categories that were never relevant (score was always 0
  // AND the item isn't already completed — completed items should persist).
  const status = (cat: FocusCategory) => computeFocusStatus(cat, actuals, targets, wearable);
  const all = weighted
    .filter(({ cat, score }) => score > 0 || status(cat) === 'completed')
    .sort((a, b) => {
      // Incomplete items first, then completed; within each group sort by score desc
      const aComplete = status(a.cat) === 'completed' ? 1 : 0;
      const bComplete = status(b.cat) === 'completed' ? 1 : 0;
      if (aComplete !== bComplete) return aComplete - bComplete;
      return b.score - a.score;
    })
    .map(({ cat }) => buildFocusItem(cat, actuals, targets, wearable, phase));

  if (all.length === 0) {
    all.push(buildFocusItem('hydration', actuals, targets, wearable, phase));
  }

  return all;
}

// ─── Side Effect Index ────────────────────────────────────────────────────────

export type SideEffectSeverityLevel = 'none' | 'mild' | 'moderate' | 'severe';

export type SideEffectIndex = {
  level: SideEffectSeverityLevel;
  phaseNote: string;
  primarySymptom: string | null;
  daysActive: number;
  score: number;
};

type SideEffectLogForIndex = {
  effect_type: string;
  severity: number;
  logged_at: string;
  phase_at_log: ShotPhase;
};

export function computeSideEffectIndex(
  logs: SideEffectLogForIndex[],
  currentPhase: ShotPhase,
  daysSinceShot: number,
): SideEffectIndex {
  const cutoff7d = Date.now() - 7 * 86400000;
  const recent = logs.filter(l => new Date(l.logged_at).getTime() >= cutoff7d);

  if (recent.length === 0) {
    return { level: 'none', phaseNote: '', primarySymptom: null, daysActive: 0, score: 0 };
  }

  // Find max severity and primary symptom
  let maxSeverity = 0;
  let primarySymptom: string | null = null;
  for (const log of recent) {
    if (log.severity > maxSeverity) {
      maxSeverity = log.severity;
      primarySymptom = log.effect_type;
    }
  }

  const level: SideEffectSeverityLevel =
    maxSeverity >= 8 ? 'severe'
    : maxSeverity >= 5 ? 'moderate'
    : maxSeverity >= 1 ? 'mild'
    : 'none';

  const GI_TYPES = new Set(['nausea', 'vomiting', 'diarrhea', 'constipation', 'bloating']);
  const isPrimaryGI = primarySymptom != null && GI_TYPES.has(primarySymptom);

  let phaseNote = '';
  if (currentPhase === 'shot' || currentPhase === 'peak') {
    if (isPrimaryGI) phaseNote = 'Expected at this phase';
    else phaseNote = 'Monitor non-GI symptoms during peak week';
  } else if (currentPhase === 'reset') {
    phaseNote = 'Unusual for trough week - monitor';
  } else {
    phaseNote = 'Side effects should be easing';
  }

  // Count consecutive days with this level logged
  const sortedDays = [...new Set(
    recent.map(l => l.logged_at.slice(0, 10)),
  )].sort().reverse();

  let daysActive = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < sortedDays.length; i++) {
    const expected = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    if (sortedDays[i] === expected || (i === 0 && sortedDays[0] <= today)) {
      daysActive++;
    } else {
      break;
    }
  }

  return {
    level,
    phaseNote,
    primarySymptom,
    daysActive,
    score: Math.round(maxSeverity * 10),
  };
}

// ─── Rolling Adherence Score ──────────────────────────────────────────────────
// 14-day linear weighted average: today = weight 14, 13 days ago = weight 1.
// Days with no data at all are excluded from the average entirely.
// Returns 0 for brand-new users with no data.

export function computeRollingAdherenceScore(params: {
  injectionLogs:  Array<{ injection_date: string; injection_time?: string }>;
  foodLogs:       Array<{ logged_at: string; protein_g: number; fiber_g: number }>;
  activityLogs:   Array<{ date: string; steps: number | null }>;
  sideEffectLogs: SideEffectEntry[];
  profile:        Pick<FullUserProfile, 'weightKg' | 'weightLbs' | 'activityLevel'
                    | 'glp1Type' | 'doseMg' | 'glp1Status' | 'sideEffects'
                    | 'injectionFrequencyDays'>;
  programPhase:   string;   // 'initiation' | 'titration' | 'maintenance'
  proteinPriority?: boolean;
  today?:         Date;
}): number {
  const {
    injectionLogs, foodLogs, activityLogs, sideEffectLogs,
    profile, programPhase, proteinPriority = false, today: todayParam,
  } = params;

  const today = todayParam ?? new Date();
  const phaseWeights = getPhaseWeights(programPhase);
  const injFreq = (profile as any).injectionFrequencyDays ?? 7;

  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < 14; i++) {
    const dayWeight = 14 - i; // today = 14, yesterday = 13, 13 days ago = 1

    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const dayStr = localDateStr(dayStart);                                        // local date

    // Filter logs to this calendar date
    const dayInjections = injectionLogs.filter(l => l.injection_date === dayStr);
    const dayFood       = foodLogs.filter(l => localDateStr(new Date(l.logged_at)) === dayStr);
    const dayActivity   = activityLogs.filter(l => l.date === dayStr);

    const hasInjection = dayInjections.length > 0;
    const hasFood      = dayFood.length > 0;
    const hasActivity  = dayActivity.length > 0;
    const hasAnyData   = hasInjection || hasFood || hasActivity;

    if (!hasAnyData) continue;

    // Reconstruct DailyActuals for this day
    const proteinG = dayFood.reduce((s, f) => s + (f.protein_g ?? 0), 0);
    const fiberG   = dayFood.reduce((s, f) => s + (f.fiber_g ?? 0), 0);
    const steps    = dayActivity.reduce((s, a) => s + (a.steps ?? 0), 0);
    const actuals: DailyActuals = {
      proteinG,
      waterMl: 1100, // neutral - no historical water data
      fiberG,
      steps,
      caloriesKcal: dayFood.reduce((s, f) => s + ((f as any).calories ?? 0), 0),
      injectionLogged: hasInjection,
      exerciseMinutes: 0,
      workoutMinutes: 0,
      workoutCalories: 0,
      flightsClimbed: 0,
    };

    // Find last injection on or before this day (for streak + daysLate scoring)
    const injectionsOnOrBefore = injectionLogs
      .filter(l => l.injection_date <= dayStr)
      .sort((a, b) => b.injection_date.localeCompare(a.injection_date));

    const lastInj = injectionsOnOrBefore[0];
    const daySinceShot = lastInj
      ? daysSinceInjection(lastInj.injection_date, dayStart)
      : 7; // fallback: reset phase

    const shotPhase = getShotPhase(daySinceShot);

    // Get phase-aware targets for this day
    const targets = getDailyTargets(
      profile as unknown as FullUserProfile,
      { programPhase: programPhase as ProgramPhase },
    );

    // Side effects: 7-day window ending this day
    const seWindowStart = dayEnd.getTime() - 7 * 86400000;
    const daySE = sideEffectLogs.filter(l => {
      const t = new Date(l.logged_at).getTime();
      return t >= seWindowStart && t <= dayEnd.getTime();
    });

    const { burden: seBurden } = computeSideEffectBurden(daySE, shotPhase, 7, dayEnd);

    // Compute this day's adherence score
    const dayScore = computeGlp1AdherenceScore(
      actuals,
      targets,
      seBurden,
      injectionsOnOrBefore as InjectionLogForScoring[],
      injFreq,
      hasActivity,
      hasFood,
      phaseWeights,
      proteinPriority,
    );

    weightedSum += dayScore * dayWeight;
    totalWeight += dayWeight;
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

// ─── Clinical Trial Benchmarks ───────────────────────────────────────────────
// Sources:
//   STEP 1 (semaglutide 2.4 mg): Wilding JPH, et al. N Engl J Med. 2021;384(11):989-1002
//   SURMOUNT-1 (tirzepatide): Jastreboff AM, et al. N Engl J Med. 2022;387(3):205-216
//   SCALE (liraglutide 3.0 mg): Pi-Sunyer X, et al. N Engl J Med. 2015;373(1):11-22
//   AWARD-2 (dulaglutide): Giorgino F, et al. Diabetes Care. 2015;38(12):2241-2249

export type TrialBenchmarkEntry = {
  week: number;
  lossPct: number;
  /** Lower bound of expected range (approx 25th percentile or low-dose arm) */
  lossPctLow: number;
  /** Upper bound of expected range (approx 75th percentile or high-dose arm) */
  lossPctHigh: number;
};

export type TrialBenchmarkTier = {
  label: string;
  trialName: string;
  data: TrialBenchmarkEntry[];
};

/**
 * Published weight-loss % at key timepoints from landmark GLP-1 trials.
 * Keyed by generic molecule name (matches Glp1Type from user-profile.ts).
 * Low/high bounds derived from published SDs or multi-dose arms.
 * Intermediate weeks are linearly interpolated at runtime.
 */
export const TRIAL_BENCHMARKS: Record<string, TrialBenchmarkTier[]> = {
  semaglutide: [
    {
      label: 'STEP 1 (2.4 mg)',
      trialName: 'STEP 1',
      data: [
        // Low/high approximate ±1 SD from STEP 1 ITT population
        { week: 4,  lossPct: 2.1,  lossPctLow: 1.0,  lossPctHigh: 3.2 },
        { week: 8,  lossPct: 4.2,  lossPctLow: 2.5,  lossPctHigh: 5.9 },
        { week: 12, lossPct: 5.9,  lossPctLow: 3.5,  lossPctHigh: 8.3 },
        { week: 20, lossPct: 9.0,  lossPctLow: 5.5,  lossPctHigh: 12.5 },
        { week: 28, lossPct: 11.5, lossPctLow: 7.0,  lossPctHigh: 16.0 },
        { week: 36, lossPct: 13.0, lossPctLow: 8.0,  lossPctHigh: 18.0 },
        { week: 44, lossPct: 14.2, lossPctLow: 8.5,  lossPctHigh: 19.9 },
        { week: 52, lossPct: 14.9, lossPctLow: 9.0,  lossPctHigh: 20.8 },
        { week: 68, lossPct: 14.9, lossPctLow: 9.0,  lossPctHigh: 20.8 },
      ],
    },
  ],
  tirzepatide: [
    {
      label: 'SURMOUNT-1 (15 mg)',
      trialName: 'SURMOUNT-1',
      data: [
        // Low = 5 mg arm, High = 15 mg arm from SURMOUNT-1
        { week: 4,  lossPct: 3.0,  lossPctLow: 1.8,  lossPctHigh: 3.5 },
        { week: 8,  lossPct: 5.8,  lossPctLow: 3.8,  lossPctHigh: 7.1 },
        { week: 12, lossPct: 8.3,  lossPctLow: 5.5,  lossPctHigh: 10.0 },
        { week: 20, lossPct: 13.5, lossPctLow: 9.5,  lossPctHigh: 15.0 },
        { week: 28, lossPct: 16.8, lossPctLow: 12.0, lossPctHigh: 19.0 },
        { week: 36, lossPct: 19.5, lossPctLow: 13.5, lossPctHigh: 21.5 },
        { week: 44, lossPct: 21.0, lossPctLow: 14.5, lossPctHigh: 23.0 },
        { week: 52, lossPct: 21.8, lossPctLow: 15.0, lossPctHigh: 24.0 },
        { week: 72, lossPct: 22.5, lossPctLow: 15.5, lossPctHigh: 25.0 },
      ],
    },
  ],
  liraglutide: [
    {
      label: 'Saxenda (3.0 mg)',
      trialName: 'Saxenda Trials',
      data: [
        // Approximate ±1 SD from SCALE trials
        { week: 12, lossPct: 5.0, lossPctLow: 2.5, lossPctHigh: 7.5 },
        { week: 28, lossPct: 8.0, lossPctLow: 4.0, lossPctHigh: 12.0 },
        { week: 56, lossPct: 8.0, lossPctLow: 4.0, lossPctHigh: 12.0 },
      ],
    },
  ],
  dulaglutide: [
    {
      label: 'AWARD-2 (1.5 mg)',
      trialName: 'AWARD-2',
      data: [
        // AWARD-2 primary endpoint at 78 weeks; weight loss is modest vs newer agents
        { week: 12, lossPct: 1.5, lossPctLow: 0.5, lossPctHigh: 2.5 },
        { week: 26, lossPct: 2.5, lossPctLow: 1.0, lossPctHigh: 4.0 },
        { week: 52, lossPct: 3.0, lossPctLow: 1.5, lossPctHigh: 4.5 },
        { week: 78, lossPct: 3.1, lossPctLow: 1.5, lossPctHigh: 4.7 },
      ],
    },
  ],
};

/** Linearly interpolate expected weight-loss % at a given treatment week. */
export function interpolateBenchmark(
  data: TrialBenchmarkEntry[],
  week: number,
): number | null {
  if (data.length === 0 || week < data[0].week) return null;
  if (week >= data[data.length - 1].week) return data[data.length - 1].lossPct;
  for (let i = 0; i < data.length - 1; i++) {
    if (week >= data[i].week && week <= data[i + 1].week) {
      const ratio = (week - data[i].week) / (data[i + 1].week - data[i].week);
      return Math.round((data[i].lossPct + ratio * (data[i + 1].lossPct - data[i].lossPct)) * 10) / 10;
    }
  }
  return null;
}

/** Interpolate all three band values (mean, low, high) at a given week. */
export function interpolateBenchmarkBand(
  data: TrialBenchmarkEntry[],
  week: number,
): { mean: number; low: number; high: number } | null {
  if (data.length === 0 || week < data[0].week) return null;
  if (week >= data[data.length - 1].week) {
    const last = data[data.length - 1];
    return { mean: last.lossPct, low: last.lossPctLow, high: last.lossPctHigh };
  }
  for (let i = 0; i < data.length - 1; i++) {
    if (week >= data[i].week && week <= data[i + 1].week) {
      const ratio = (week - data[i].week) / (data[i + 1].week - data[i].week);
      const lerp = (a: number, b: number) => Math.round((a + ratio * (b - a)) * 10) / 10;
      return {
        mean: lerp(data[i].lossPct, data[i + 1].lossPct),
        low: lerp(data[i].lossPctLow, data[i + 1].lossPctLow),
        high: lerp(data[i].lossPctHigh, data[i + 1].lossPctHigh),
      };
    }
  }
  return null;
}

/** Return the full trial trajectory as an array for chart rendering. */
export function getTrialTrajectory(
  medKey: string,
): { week: number; mean: number; low: number; high: number }[] {
  const tiers = TRIAL_BENCHMARKS[medKey];
  if (!tiers || tiers.length === 0) return [];
  const data = tiers[0].data;
  return data.map(d => ({
    week: d.week,
    mean: d.lossPct,
    low: d.lossPctLow,
    high: d.lossPctHigh,
  }));
}

// ─── Energy Bank Score ──────────────────────────────────────────────────────

export type EnergyComponent = {
  id: 'sleep' | 'drugLevel' | 'recovery' | 'nutrition' | 'hydration' | 'sideEffects';
  label: string;
  score: number;        // 0–100 component score
  weight: number;       // fractional weight after redistribution
  baseWeight: number;   // original weight before redistribution
  available: boolean;   // false when no data exists for this component
  detail: string;       // human-readable explanation
};

export type EnergyBankResult = {
  score: number;              // 0–100 final score
  label: string;              // Depleted / Low / Moderate / Good / Charged
  components: EnergyComponent[];
  missingCount: number;       // how many components lack data
  disclaimer: string | null;  // null when all data present
};

/**
 * Builds the human-readable "Drug Level" line for the Energy Bank.
 *
 * This is a *prediction of how you'll likely feel given where you are in your
 * dose cycle* — not a grade. Drug concentration follows an unavoidable
 * pharmacokinetic curve the user can't change, so the copy is framed as cycle
 * context, never as something they did wrong.
 *
 * Critically, the symptom language is gated on the user's ACTUAL state rather
 * than asserted from concentration alone:
 *   - `programPhase` (tenure): GI side effects + fatigue are concentration-
 *     AND tenure-driven. Someone still ramping (initiation/titration) genuinely
 *     has higher risk at peak; an acclimated maintenance user usually doesn't.
 *   - logged burden: if the user is actually reporting fatigue/side effects we
 *     reflect that; if they've logged none and have acclimated, we say they're
 *     tolerating peak well rather than predicting nausea that isn't happening.
 */
function buildDrugLevelDetail(
  pkConcentration: number | null,
  phase: ShotPhase,
  programPhase: ProgramPhase,
  sideEffectBurden: number,
  fatigueBurden: number,
): string {
  const acclimating = programPhase === 'initiation' || programPhase === 'titration';
  const hasSymptoms = sideEffectBurden >= 30 || fatigueBurden >= 30;

  // No PK data — describe cycle position only; don't assert a concentration we
  // can't compute.
  if (pkConcentration == null) {
    switch (phase) {
      case 'shot':
        return acclimating
          ? 'Dose just taken. Levels climbing as your body adjusts.'
          : 'Dose just taken. Levels climbing.';
      case 'peak':
        return hasSymptoms
          ? 'Near peak in your cycle, which tracks with the side effects you\'ve logged'
          : acclimating
          ? 'Near peak in your cycle; side effects can run higher here while you adjust'
          : 'Near peak in your cycle. You\'ve been tolerating this window well.';
      case 'balance':
        return 'Levels steady mid-cycle. A stable window.';
      default:
        return 'Levels tapering before your next dose';
    }
  }

  const pct = Math.round(pkConcentration);
  const conc =
    pct >= 80 ? `${pct}% of peak, near your cycle high`
    : pct >= 55 ? `${pct}% of peak, still elevated`
    : pct >= 30 ? `${pct}% of peak, easing off`
    : `${pct}% of peak, dose wearing off before your next one`;

  let note: string;
  if (pct >= 55) {
    note = hasSymptoms
      ? 'tracks with the side effects you\'ve logged'
      : acclimating
      ? 'fatigue or nausea can show up while you adjust to this dose'
      : 'you\'ve been tolerating peak levels well';
  } else {
    note = hasSymptoms
      ? 'levels easing should help your energy return'
      : 'a lighter window for side effects';
  }

  return `${conc}; ${note}`;
}

/**
 * Compute the Energy Bank score from existing health data.
 *
 * The score reflects how much energy a GLP-1 user likely has available,
 * based on factors that directly affect energy levels on these medications:
 *
 * 1. **Sleep** (25%) — The #1 predictor of daily energy.
 * 2. **Recovery** (20%) — HRV (65%) + RHR (35%) with personal baseline normalization.
 * 3. **Drug Concentration** (18%) — Real-time PK modeling of GLP-1 levels.
 * 4. **Nutrition** (17%) — Calories (60%) + Protein (40%) blend.
 * 5. **Hydration** (10%) — Water intake vs. target.
 * 6. **Side Effects** (10%) — Burden score with fatigue up-weighting.
 */
export function computeEnergyBank(
  wearable: Partial<WearableData>,
  actuals: DailyActuals,
  targets: DailyTargets,
  phase: ShotPhase,
  sideEffectBurden: number,
  pkConcentration?: number | null,
  fatigueBurden?: number,
  baseline?: { hrvMs: number | null; restingHR: number | null; sleepMinutes: number | null; sampleCount: number } | null,
  isOnTreatment: boolean = true,
): EnergyBankResult {
  const hasSleep = wearable.sleepMinutes != null;
  const hasHRV = wearable.hrvMs != null;
  const hasRHR = wearable.restingHR != null;
  const hasRecovery = hasHRV || hasRHR;
  const hasNutrition = actuals.proteinG > 0 || actuals.caloriesKcal > 0;
  const hasHydration = actuals.waterMl > 0;
  const hasPK = pkConcentration != null;
  const hasBaseline = baseline != null && baseline.sampleCount >= 14;

  type RawComponent = Omit<EnergyComponent, 'weight'> & { baseWeight: number };
  const raw: RawComponent[] = [];

  // ── 1. Sleep (25%) ───────────────────────────────────────────────────────
  const sleepScore = hasSleep
    ? Math.round(scoreSleep(wearable.sleepMinutes!) * 100)
    : 0;
  const sleepHrs = hasSleep
    ? `${Math.floor(wearable.sleepMinutes! / 60)}h ${wearable.sleepMinutes! % 60}m`
    : null;
  raw.push({
    id: 'sleep', label: 'Sleep', score: sleepScore, baseWeight: 0.25,
    available: hasSleep,
    detail: hasSleep
      ? `${sleepHrs} logged: ${sleepScore >= 75 ? 'good recovery window' : sleepScore >= 50 ? 'adequate but could improve' : 'insufficient for recovery'}`
      : 'Not tracked. Connect Apple Health to include sleep in your score.',
  });

  // ── 2. Recovery — HRV (65%) + RHR (35%) (20%) ───────────────────────────
  let recoveryScore = 0;
  let recoveryDetail = 'Not tracked. Wear Apple Watch to sleep for recovery data.';
  if (hasRecovery) {
    let hrvSub = 0.5;
    let rhrSub = 0.5;
    if (hasHRV) {
      const adjHrv = wearable.hrvMs! + glp1HrvOffset(phase);
      hrvSub = hasBaseline && baseline!.hrvMs != null
        ? scoreHRVBaseline(adjHrv, baseline!.hrvMs)
        : scoreHRV(adjHrv);
    }
    if (hasRHR) {
      const adjRhr = wearable.restingHR! + glp1RhrOffset(phase);
      rhrSub = hasBaseline && baseline!.restingHR != null
        ? scoreRHRBaseline(adjRhr, baseline!.restingHR)
        : scoreRHR(adjRhr);
    }
    if (hasHRV && hasRHR) {
      recoveryScore = Math.round((hrvSub * 0.65 + rhrSub * 0.35) * 100);
    } else if (hasHRV) {
      recoveryScore = Math.round(hrvSub * 100);
    } else {
      recoveryScore = Math.round(rhrSub * 100);
    }
    const parts: string[] = [];
    if (hasHRV) parts.push(`HRV ${wearable.hrvMs}ms`);
    if (hasRHR) parts.push(`RHR ${wearable.restingHR}bpm`);
    const baselineNote = hasBaseline ? ' (vs. your baseline)' : '';
    recoveryDetail = `${parts.join(' · ')}${baselineNote}: ${recoveryScore >= 75 ? 'strong recovery' : recoveryScore >= 50 ? 'moderate recovery' : 'low recovery; rest may help'}`;
  }
  raw.push({
    id: 'recovery', label: 'Recovery', score: recoveryScore, baseWeight: 0.20,
    available: hasRecovery,
    detail: recoveryDetail,
  });

  // ── 3. Drug Concentration (18%) ──────────────────────────────────────────
  let drugScore: number;
  if (hasPK) {
    const pct = pkConcentration!;
    drugScore = Math.round(100 - (pct / 100) * 80 * (0.5 + 0.5 * (pct / 100)));
    drugScore = Math.max(10, Math.min(100, drugScore));
  } else {
    const phaseScores: Record<ShotPhase, number> = {
      shot: 50, peak: 25, balance: 85, reset: 70,
    };
    drugScore = phaseScores[phase] ?? 60;
  }
  raw.push({
    id: 'drugLevel', label: 'Drug Level', score: drugScore, baseWeight: 0.18,
    available: isOnTreatment,
    detail: isOnTreatment
      ? buildDrugLevelDetail(
          hasPK ? pkConcentration! : null,
          phase,
          targets.programPhase,
          sideEffectBurden,
          fatigueBurden ?? 0,
        )
      : 'Paused. Not counted while you\'re between medications.',
  });

  // ── 4. Nutrition — Calories (60%) + Protein (40%) (17%) ─────────────────
  let nutritionScore = 0;
  let nutritionDetail = 'Not tracked. Log food to include nutrition in your score.';
  if (hasNutrition) {
    const calScore = actuals.caloriesKcal > 0 && targets.caloriesTarget > 0
      ? scoreCalories(actuals.caloriesKcal, targets.caloriesTarget)
      : 0;
    const proScore = actuals.proteinG > 0 && targets.proteinG > 0
      ? Math.min(actuals.proteinG / targets.proteinG, 1)
      : 0;
    if (actuals.caloriesKcal > 0 && actuals.proteinG > 0) {
      nutritionScore = Math.round((calScore * 0.60 + proScore * 0.40) * 100);
    } else if (actuals.caloriesKcal > 0) {
      nutritionScore = Math.round(calScore * 100);
    } else {
      nutritionScore = Math.round(proScore * 100);
    }
    const parts: string[] = [];
    if (actuals.caloriesKcal > 0) parts.push(`${Math.round(actuals.caloriesKcal)} / ${Math.round(targets.caloriesTarget)} cal`);
    if (actuals.proteinG > 0) parts.push(`${Math.round(actuals.proteinG)}g / ${Math.round(targets.proteinG)}g protein`);
    nutritionDetail = `${parts.join(' · ')}: ${nutritionScore >= 75 ? 'well fueled' : nutritionScore >= 40 ? 'needs more fuel' : 'under-eating drains energy'}`;
  }
  raw.push({
    id: 'nutrition', label: 'Nutrition', score: nutritionScore, baseWeight: 0.17,
    available: hasNutrition,
    detail: nutritionDetail,
  });

  // ── 5. Hydration (10%) ───────────────────────────────────────────────────
  const waterPct = hasHydration && targets.waterMl > 0
    ? Math.min(actuals.waterMl / targets.waterMl, 1)
    : 0;
  const hydrationScore = Math.round(waterPct * 100);
  const loggedOz = Math.round(actuals.waterMl / 29.57);
  const targetOz = Math.round(targets.waterMl / 29.57);
  raw.push({
    id: 'hydration', label: 'Hydration', score: hydrationScore, baseWeight: 0.10,
    available: hasHydration,
    detail: hasHydration
      ? `${loggedOz}oz / ${targetOz}oz: ${hydrationScore >= 75 ? 'well hydrated' : hydrationScore >= 40 ? 'drink more water' : 'dehydration causes fatigue on GLP-1s'}`
      : 'Not tracked. Log water to include hydration in your score.',
  });

  // ── 6. Side Effects (10%) — fatigue up-weighted ──────────────────────────
  const blendedBurden = fatigueBurden != null && fatigueBurden > 0
    ? sideEffectBurden * 0.5 + fatigueBurden * 0.5
    : sideEffectBurden;
  const seScore = Math.max(0, Math.round(100 - blendedBurden));
  raw.push({
    id: 'sideEffects', label: 'Side Effects', score: seScore, baseWeight: 0.10,
    available: isOnTreatment,
    detail: !isOnTreatment
      ? 'Paused. Not counted while you\'re between medications.'
      : blendedBurden > 0
      ? `${Math.round(blendedBurden)}% burden${fatigueBurden != null && fatigueBurden > 0 ? ' (fatigue-weighted)' : ''}: ${blendedBurden >= 40 ? 'significant drain on energy' : 'mild impact'}`
      : 'No recent side effects. Positive for energy.',
  });

  // ── Redistribute weights ─────────────────────────────────────────────────
  const availableWeight = raw.filter(c => c.available).reduce((s, c) => s + c.baseWeight, 0);
  const components: EnergyComponent[] = raw.map(c => ({
    ...c,
    weight: c.available && availableWeight > 0 ? c.baseWeight / availableWeight : 0,
  }));

  const rawScore = components
    .filter(c => c.available)
    .reduce((sum, c) => sum + c.score * c.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const label =
    score >= 80 ? 'Charged' :
    score >= 60 ? 'Good' :
    score >= 40 ? 'Moderate' :
    score >= 20 ? 'Low' :
    'Depleted';

  const missing = raw.filter(c => !c.available);
  const missingCount = missing.length;
  let disclaimer: string | null = null;
  if (missingCount > 0) {
    const names = missing.map(c => c.label.toLowerCase()).join(', ');
    const pct = Math.round((1 - availableWeight) * 100);
    disclaimer = `Your score is based on ${6 - missingCount} of 6 factors. `
      + `${names} (${pct}% of full score) ${missingCount === 1 ? 'is' : 'are'} not yet tracked. `
      + `Log more data or connect Apple Health for a more complete score.`;
  }

  return { score, label, components, missingCount, disclaimer };
}
