import { ActivityLevel, FullUserProfile } from './user-profile';
import { applyAdjustments, type RecentSideEffectLog } from '@/lib/targets';
import { localDateStr } from '@/lib/date-utils';

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
  injectionLogged: boolean;
};

export type WearableData = {
  sleepMinutes?: number; // e.g. 443 = 7h 23m
  hrvMs?: number;        // e.g. 45
  restingHR?: number;    // e.g. 58
  spo2Pct?: number;      // e.g. 98
  respRateRpm?: number;  // normal: 12–20; elevated = illness/stress (HealthKit Phase 2)
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
  const days = Math.round((ref.getTime() - lastMs) / 86400000) + 1;
  return Math.max(1, Math.min(injFreqDays, days));
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
  sedentary: 6000,
  light: 8000,
  active: 10000,
  very_active: 12000,
};

const activeCaloriesMap: Record<ActivityLevel, number> = {
  sedentary: 200,
  light: 300,
  active: 400,
  very_active: 500,
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

  // Protein: kg-based (1.2 g/kg/day per 2025 ACLM/ASN/OMA/TOS joint advisory)
  let proteinG = profile.weightKg * 1.2;

  // Medication-specific dose breakpoints (sema vs tize have different dose scales)
  if (profile.glp1Type === 'semaglutide') {
    if (profile.doseMg >= 1.7) proteinG *= 1.15;
    else if (profile.doseMg >= 1.0) proteinG *= 1.1;
  } else if (profile.glp1Type === 'tirzepatide') {
    if (profile.doseMg >= 10) proteinG *= 1.15;
    else if (profile.doseMg >= 7.5) proteinG *= 1.1;
  }

  // Activity level boost
  if (profile.activityLevel === 'active' || profile.activityLevel === 'very_active') {
    proteinG *= 1.1;
  }

  // Program phase multiplier (stacks with dose-based boosts - clinically appropriate)
  // Titration: higher lean mass loss risk during dose escalation → push protein harder
  // Maintenance: max lean mass protection at plateau
  const programPhaseMultiplier: Record<ProgramPhase, number> = {
    initiation:  1.0,
    titration:   1.15,
    maintenance: 1.25,
  };
  proteinG *= programPhaseMultiplier[programPhase];

  // Hard cap: 2.0 g/kg/day
  proteinG = Math.min(proteinG, profile.weightKg * 2.0);

  // GLP-1 ramp for new starters (first 3 weeks)
  if (profile.glp1Status === 'starting') {
    const startDate = new Date(profile.startDate ?? Date.now());
    const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / 86400000);
    if (daysSinceStart < 7) proteinG *= 0.75;
    else if (daysSinceStart < 21) proteinG *= 0.875;
  }

  // Hydration: weight-based + medication multipliers (oz → ml)
  let waterOz = profile.weightLbs * 0.6;
  if (profile.glp1Type === 'semaglutide') waterOz *= 1.1;
  if (profile.doseMg >= 7.5) waterOz *= 1.15;
  else if (profile.doseMg >= 5) waterOz *= 1.1;
  const waterMl = Math.round(waterOz * 29.5735);

  // Fiber: flat 30g - shot cycle does not affect fiber target
  const fiberG = 30;

  // Steps: activity level driven, with maintenance boost to counter metabolic adaptation
  let steps = stepsMap[profile.activityLevel] ?? 8000;
  if (programPhase === 'maintenance') steps = Math.round(steps * 1.1);

  // Active calories: activity level base with phase adjustments
  // Titration: ×0.9 - side effects may reduce capacity during dose escalation
  // Maintenance: ×1.05 - counter metabolic adaptation at stable weight
  let activeCaloriesTarget = activeCaloriesMap[profile.activityLevel] ?? 300;
  if (programPhase === 'titration') activeCaloriesTarget = Math.round(activeCaloriesTarget * 0.9);
  else if (programPhase === 'maintenance') activeCaloriesTarget = Math.round(activeCaloriesTarget * 1.05);

  // Calories: use stored onboarding target (TDEE−500) or rough estimate fallback
  const estimatedBase = Math.round(profile.weightKg * 28); // rough TDEE−500 fallback
  let caloriesTarget = opts?.baseCaloriesTarget ?? estimatedBase;

  // Maintenance: apply metabolic adaptation adjustment (conservative 10 kcal/kg lost)
  if (programPhase === 'maintenance' && opts?.weightLostKg) {
    caloriesTarget = Math.max(1200, caloriesTarget - Math.round(opts.weightLostKg * 10));
  }

  // Macros: derive from resolved calories + protein (2025 ACLM guidelines)
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
    components.push({ score: scoreSleep(wearable.sleepMinutes), weight: 40 });
  if (wearable.hrvMs != null) {
    const adjHrv = phase ? wearable.hrvMs + glp1HrvOffset(phase) : wearable.hrvMs;
    components.push({ score: scoreHRV(adjHrv), weight: 35 });
  }
  if (wearable.restingHR != null) {
    const adjRhr = phase ? wearable.restingHR + glp1RhrOffset(phase) : wearable.restingHR;
    components.push({ score: scoreRHR(adjRhr), weight: 15 });
  }
  if (wearable.spo2Pct != null)
    components.push({ score: scoreSPO2(wearable.spo2Pct), weight: 10 });

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

  // Activity - only if steps or activity data is available
  const includeActivity = hasActivityData !== undefined ? hasActivityData : actual.steps > 0;
  if (includeActivity) {
    const stepsPct = Math.min(actual.steps / targets.steps, 1);
    components.push({ score: stepsPct * 100, weight: w.activity });
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
    insights.push({ text: 'Sleep is below 6h - poor sleep blunts GLP-1 appetite control by up to 30%', phase: 'RECOVERY' });
  } else if (!actuals.injectionLogged) {
    insights.push({ text: 'Log your injection to unlock the full medication bonus and enable phase-aware coaching', phase: 'TODAY' });
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
      actual: wearable.sleepMinutes != null ? Math.round(scoreSleep(wearable.sleepMinutes) * 40) : 0,
      max: 40,
      available: wearable.sleepMinutes != null,
    },
    {
      label: 'HRV',
      actual: adjHrv != null ? Math.round(scoreHRV(adjHrv) * 35) : 0,
      max: 35,
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
    "Below 7h blunts GLP-1 appetite control by reducing leptin and elevating ghrelin.",
    hrvNote,
    rhrNote,
    "SpO₂ below 96% signals respiratory stress or altitude effects unrelated to GLP-1 therapy.",
  ];
}

export function getGLP1RowNotes(phase: ShotPhase): string[] {
  const proteinNote =
    phase === 'shot'
      ? "Peak absorption phase - protein shake recommended today if nausea is mild. Adequate protein prevents muscle loss alongside fat."
      : "GLP-1 medications suppress appetite broadly - intentional protein intake prevents muscle loss alongside fat.";

  return [
    proteinNote,
    "Adequate hydration reduces nausea and constipation, the most common GLP-1 side effects.",
    "Daily movement improves insulin sensitivity and enhances GLP-1 receptor expression in muscle tissue.",
    "Fiber slows gastric emptying, complementing GLP-1's mechanism and reducing post-meal blood sugar spikes.",
  ];
}

export const RECOVERY_ROW_NOTES = [
  "Below 7h blunts GLP-1 appetite control by reducing leptin and elevating ghrelin.",
  "GLP-1 medications cause an average −6.2ms HRV decrease via direct sinus node activation. Exercise counteracts this.",
  "Resting HR reflects autonomic tone. GLP-1 users typically see 2–4 bpm improvement over 12 weeks.",
  "SpO₂ below 96% signals respiratory stress or altitude effects unrelated to GLP-1 therapy.",
];

export const GLP1_ROW_NOTES = [
  "GLP-1 medications suppress appetite broadly - intentional protein intake prevents muscle loss alongside fat.",
  "Adequate hydration reduces nausea and constipation, the most common GLP-1 side effects.",
  "Daily movement improves insulin sensitivity and enhances GLP-1 receptor expression in muscle tissue.",
  "Fiber slows gastric emptying, complementing GLP-1's mechanism and reducing post-meal blood sugar spikes.",
];

export const RECOVERY_COACH_NOTE =
  "HRV and sleep improve most with consistent aerobic exercise and 7–9h sleep. GLP-1 users typically see +4ms HRV improvement over 8 weeks of treatment.";

export const GLP1_COACH_NOTE =
  "Hitting your protein target is the single highest-impact daily action on GLP-1. Each 10g above baseline preserves ~0.5 lbs of muscle over 12 weeks.";

// ─── Focus Engine Types ───────────────────────────────────────────────────────

export type FocusCategory =
  | 'injection' | 'hydration' | 'protein' | 'fiber'
  | 'activity'  | 'sleep'     | 'recovery' | 'rest';

export type FocusItem = {
  id: FocusCategory;
  label: string;
  subtitle: string;
  status: 'completed' | 'active' | 'pending';
  iconName: string;
  iconSet: 'MaterialIcons' | 'Ionicons';
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
  'GLP-1s reduce appetite — front-load protein early',
];

const HYDRATION_TIPS = [
  'Keep a water bottle visible at all times',
  'Try sparkling water if plain water feels hard',
  'Herbal teas and broth count toward your intake',
  'Staying hydrated reduces nausea and fatigue',
];

const FIBER_TIPS = [
  'Beans, berries, avocado, and oats are great choices',
  'Fiber slows digestion — space it out to avoid bloating',
  'Add veggies to your next meal for an easy fiber boost',
];

const ACTIVITY_TIPS = [
  'A 10-minute walk after meals improves glucose response',
  'Resistance training preserves lean mass on GLP-1s',
  'Even light movement counts — take the stairs',
];

const SLEEP_TIPS = [
  'Poor sleep can increase GLP-1 side effects',
  'Aim for 7–9 hours; avoid screens 30 min before bed',
];

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
        id: 'injection', label: 'Log Your Injection',
        subtitle: 'Keep your shot cycle accurate',
        iconName: 'colorize', iconSet: 'MaterialIcons',
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
          ? `${targetOz}oz reached — great work`
          : dailyPick(HYDRATION_TIPS, dayOfYear);
      return {
        id: 'hydration', label, subtitle,
        iconName: 'water-outline', iconSet: 'Ionicons',
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
          ? `${targets.proteinG}g reached — lean mass protected`
          : dailyPick(PROTEIN_TIPS, dayOfYear);
      return {
        id: 'protein', label, subtitle,
        iconName: 'restaurant', iconSet: 'MaterialIcons',
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
          ? 'Fiber goal hit — nice work'
          : pct >= 0.75
          ? 'Almost at your fiber goal'
          : 'Add fiber to your next meal';
      const subtitle =
        status === 'completed'
          ? `${targets.fiberG}g reached — digestion supported`
          : dailyPick(FIBER_TIPS, dayOfYear);
      return {
        id: 'fiber', label, subtitle,
        iconName: 'eco', iconSet: 'MaterialIcons',
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
          ? `${actuals.steps.toLocaleString()} steps — well done`
          : dailyPick(ACTIVITY_TIPS, dayOfYear);
      return {
        id: 'activity', label, subtitle,
        iconName: 'directions-walk', iconSet: 'MaterialIcons',
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
          ? `${hrs}h last night — recovery on track`
          : dailyPick(SLEEP_TIPS, dayOfYear) + phaseNote;
      return {
        id: 'sleep', label, subtitle,
        iconName: 'moon-outline', iconSet: 'Ionicons',
        status,
        progressPct: Math.min(100, sleepMin / 420 * 100),
        valueLabel: `${hrs}h / 7–9h`,
      };
    }
    case 'recovery': {
      const recovery = computeRecovery(wearable, phase);
      return {
        id: 'recovery',
        label: 'Recovery day — take it easy',
        subtitle: wearable.hrvMs != null && wearable.restingHR != null
          ? `HRV ${wearable.hrvMs}ms · RHR ${wearable.restingHR}bpm · Score ${recovery ?? '-'}`
          : 'Connect Apple Health to see recovery details',
        iconName: 'favorite-border', iconSet: 'MaterialIcons',
        status,
      };
    }
    case 'rest':
      return {
        id: 'rest',
        label: 'Rest & recover today',
        subtitle: 'Peak GLP-1 day — light movement only',
        iconName: 'self-improvement', iconSet: 'MaterialIcons',
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
    activity:  Math.max(0, (targets.steps - actuals.steps) / targets.steps * 100),
    sleep:     (1 - scoreSleep(wearable.sleepMinutes ?? 443)) * 100,
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

  const top = weighted
    .filter(({ score }) => score > 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ cat }) => buildFocusItem(cat, actuals, targets, wearable, phase));

  if (top.length === 0) {
    top.push(buildFocusItem('hydration', actuals, targets, wearable, phase));
  }

  return top;
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
      injectionLogged: hasInjection,
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
