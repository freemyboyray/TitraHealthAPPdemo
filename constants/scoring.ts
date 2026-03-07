import { ActivityLevel, FullUserProfile } from './user-profile';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DailyTargets = {
  proteinG: number;
  waterMl: number;
  fiberG: number;
  steps: number;
};

export type DailyActuals = {
  proteinG: number;
  waterMl: number;
  fiberG: number;
  steps: number;
  injectionLogged: boolean;
};

export type WearableData = {
  sleepMinutes: number; // e.g. 443 = 7h 23m
  hrvMs: number;        // e.g. 45
  restingHR: number;    // e.g. 58
  spo2Pct: number;      // e.g. 98
  respRateRpm?: number; // normal: 12–20; elevated = illness/stress (HealthKit Phase 2)
};

// ─── Shot Phase Type ──────────────────────────────────────────────────────────
// Defined here (before scoring formulas) so phase-aware functions can reference it.

export type ShotPhase = 'shot' | 'peak' | 'balance' | 'reset';

// ─── Shot Cycle ───────────────────────────────────────────────────────────────

export function daysSinceInjection(
  lastInjectionDate: string | Date,
  refDate?: Date,
): number {
  const last =
    typeof lastInjectionDate === 'string'
      ? new Date(lastInjectionDate)
      : lastInjectionDate;
  const ref = refDate ?? new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((ref.getTime() - last.getTime()) / msPerDay) + 1;
  return Math.max(1, Math.min(7, days));
}

// ─── Dynamic Daily Targets ────────────────────────────────────────────────────

const stepsMap: Record<ActivityLevel, number> = {
  sedentary: 6000,
  light: 8000,
  active: 10000,
  very_active: 12000,
};

export function getDailyTargets(
  profile: FullUserProfile,
  daysSinceShot: number,
): DailyTargets {
  // Protein: weight-based + medication multipliers
  let proteinG = profile.weightLbs * 0.8;
  if (profile.glp1Type === 'tirzepatide') proteinG *= 1.1;
  if (profile.doseMg >= 7.5) proteinG *= 1.15;
  else if (profile.doseMg >= 5) proteinG *= 1.1;

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
  if (profile.sideEffects?.includes('constipation')) waterOz *= 1.1;
  const waterMl = Math.round(waterOz * 29.5735);

  // Fiber
  let fiberG = profile.sideEffects?.includes('constipation') ? 35 : 30;
  if (daysSinceShot <= 3) fiberG += 5;

  // Steps: activity level driven
  const steps = stepsMap[profile.activityLevel] ?? 8000;

  return {
    proteinG: Math.round(proteinG),
    waterMl,
    fiberG,
    steps,
  };
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

// ─── Scoring Formulas ─────────────────────────────────────────────────────────
// When phase is provided, HRV and RHR are adjusted for medication effects.
// When respRateRpm is present, SpO₂ weight drops 15→5 pts and RespRate gets 10 pts
// so the total stays 100: Sleep(40) + HRV(25) + RHR(20) + SpO₂(5) + RespRate(10) = 100.

export function computeRecovery(wearable: WearableData, phase?: ShotPhase): number {
  const sleep  = scoreSleep(wearable.sleepMinutes) * 40;
  const adjHrv = phase ? wearable.hrvMs + glp1HrvOffset(phase) : wearable.hrvMs;
  const adjRhr = phase ? wearable.restingHR + glp1RhrOffset(phase) : wearable.restingHR;
  const hrv    = scoreHRV(adjHrv) * 25;
  const rhr    = scoreRHR(adjRhr) * 20;
  let spo2: number;
  let resp = 0;
  if (wearable.respRateRpm != null) {
    spo2 = scoreSPO2(wearable.spo2Pct) * 5;
    resp = scoreRespRate(wearable.respRateRpm) * 10;
  } else {
    spo2 = scoreSPO2(wearable.spo2Pct) * 15;
  }
  return Math.round(sleep + hrv + rhr + spo2 + resp);
}

export function computeGlp1Support(actual: DailyActuals, targets: DailyTargets): number {
  const protein   = Math.min(actual.proteinG / targets.proteinG, 1) * 30;
  const hydration = Math.min(actual.waterMl  / targets.waterMl,  1) * 20;
  const fiber     = Math.min(actual.fiberG   / targets.fiberG,   1) * 15;
  const movement  = Math.min(actual.steps    / targets.steps,    1) * 20;
  const medication = actual.injectionLogged ? 15 : 0;
  return Math.round(protein + hydration + fiber + movement + medication);
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
  recovery: number,
  support: number,
  wearable: WearableData,
  actuals: DailyActuals,
  targets: DailyTargets,
): Array<{ text: string; phase: string }> {
  const insights: Array<{ text: string; phase: string }> = [];

  if (recovery < 40) {
    insights.push({ text: 'Recovery is critically low — prioritize rest and light movement only', phase: 'ALERT' });
  }
  if (wearable.spo2Pct < 94) {
    insights.push({ text: 'Oxygen saturation is below normal — check for illness or altitude effects', phase: 'ALERT' });
  }

  if (recovery >= 70 && support < 50) {
    insights.push({ text: 'Body is well recovered — boost your support score with protein and hydration', phase: 'TODAY' });
  } else if (recovery < 60 && support >= 70) {
    insights.push({ text: 'GLP-1 support is strong — rest today to let your body consolidate gains', phase: 'RECOVERY' });
  } else if (recovery >= 70 && support >= 70) {
    insights.push({ text: 'Both scores are strong — maintain your current habits for best GLP-1 outcomes', phase: 'SHOT PHASE' });
  }

  const proteinPct = actuals.proteinG / targets.proteinG;
  const waterPct   = actuals.waterMl  / targets.waterMl;

  if (wearable.sleepMinutes < 360) {
    insights.push({ text: 'Sleep is below 6h — poor sleep blunts GLP-1 appetite control by up to 30%', phase: 'RECOVERY' });
  } else if (!actuals.injectionLogged) {
    insights.push({ text: 'Log your injection to unlock the full 15-point medication bonus', phase: 'TODAY' });
  } else if (proteinPct < 0.5) {
    insights.push({ text: `Protein is at ${Math.round(proteinPct * 100)}% — aim for ${targets.proteinG}g to preserve muscle on GLP-1`, phase: 'NUTRITION' });
  } else if (waterPct < 0.6) {
    insights.push({ text: `Hydration is at ${Math.round(waterPct * 100)}% — adequate water reduces GLP-1 side effects`, phase: 'HYDRATION' });
  } else if (wearable.hrvMs >= 50) {
    insights.push({ text: 'HRV is strong — your body is recovering well from medication', phase: 'SHOT PHASE' });
  } else {
    insights.push({ text: 'All vitals are in range — maintain your current habits', phase: 'SHOT PHASE' });
  }

  return insights.slice(0, 3);
}

// ─── Breakdown Rows ───────────────────────────────────────────────────────────

export function recoveryBreakdown(
  wearable: WearableData,
  phase?: ShotPhase,
): Array<{ label: string; actual: number; max: number }> {
  const adjHrv = phase ? wearable.hrvMs + glp1HrvOffset(phase) : wearable.hrvMs;
  const adjRhr = phase ? wearable.restingHR + glp1RhrOffset(phase) : wearable.restingHR;
  const spo2Max = wearable.respRateRpm != null ? 5 : 15;
  const rows: Array<{ label: string; actual: number; max: number }> = [
    { label: 'Sleep',    actual: Math.round(scoreSleep(wearable.sleepMinutes) * 40), max: 40 },
    { label: 'HRV',      actual: Math.round(scoreHRV(adjHrv) * 25),                  max: 25 },
    { label: 'Rest. HR', actual: Math.round(scoreRHR(adjRhr) * 20),                  max: 20 },
    { label: 'SpO₂',     actual: Math.round(scoreSPO2(wearable.spo2Pct) * spo2Max),  max: spo2Max },
  ];
  if (wearable.respRateRpm != null) {
    rows.push({ label: 'Resp. Rate', actual: Math.round(scoreRespRate(wearable.respRateRpm) * 10), max: 10 });
  }
  return rows;
}

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

export function recoveryChips(wearable: WearableData): ChipData[] {
  const h = Math.floor(wearable.sleepMinutes / 60);
  const m = wearable.sleepMinutes % 60;
  return [
    { label: 'Sleep',      value: `${h}h ${m}m`,          pct: scoreSleep(wearable.sleepMinutes) },
    { label: 'HRV',        value: `${wearable.hrvMs}ms`,   pct: scoreHRV(wearable.hrvMs),
      glp1Note: wearable.hrvMs < 50 ? 'GLP-1 effect' : undefined },
    { label: 'Heart Rate', value: `${wearable.restingHR}`, pct: scoreRHR(wearable.restingHR) },
    { label: 'SpO₂',       value: `${wearable.spo2Pct}%`, pct: scoreSPO2(wearable.spo2Pct) },
  ];
}

export function supportChips(actuals: DailyActuals, targets: DailyTargets): ChipData[] {
  return [
    { label: 'Protein',  value: `${actuals.proteinG}g`,                          pct: Math.min(actuals.proteinG / targets.proteinG, 1) },
    { label: 'Water',    value: `${Math.round(actuals.waterMl / 29.57)}oz`,       pct: Math.min(actuals.waterMl / targets.waterMl, 1) },
    { label: 'Movement', value: actuals.steps.toLocaleString(),                   pct: Math.min(actuals.steps / targets.steps, 1) },
    { label: 'Fiber',    value: `${actuals.fiberG}g`,                             pct: Math.min(actuals.fiberG / targets.fiberG, 1) },
  ];
}

// ─── Breakdown Row Notes ──────────────────────────────────────────────────────
// Use the phase-aware functions below for all new code.
// Static arrays are preserved for backward compatibility only.

export function getRecoveryRowNotes(phase: ShotPhase): string[] {
  const hrvNote =
    phase === 'peak'
      ? "GLP-1 suppresses HRV by ~6ms during peak days (3–4) — this is a known medication effect. Your score has been adjusted. Exercise restores autonomic tone over 8+ weeks."
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
      ? "Peak absorption phase — protein shake recommended today if nausea is mild. Adequate protein prevents muscle loss alongside fat."
      : "GLP-1 medications suppress appetite broadly — intentional protein intake prevents muscle loss alongside fat.";

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
  "GLP-1 medications suppress appetite broadly — intentional protein intake prevents muscle loss alongside fat.",
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
  badge: string;
  iconName: string;
  iconSet: 'MaterialIcons' | 'Ionicons';
};

// ─── Shot Phase Helper ────────────────────────────────────────────────────────

export function getShotPhase(daysSinceShot: number): ShotPhase {
  if (daysSinceShot <= 2) return 'shot';
  if (daysSinceShot <= 4) return 'peak';
  if (daysSinceShot <= 6) return 'balance';
  return 'reset';
}

// ─── Phase Multipliers ────────────────────────────────────────────────────────

const PHASE_WEIGHTS: Record<ShotPhase, Partial<Record<FocusCategory, number>>> = {
  shot:    { injection: 3.0, hydration: 1.5, protein: 1.2, sleep: 1.2, recovery: 1.3, activity: 0.8, fiber: 0.9 },
  peak:    { hydration: 2.0, rest: 2.5, recovery: 2.0, sleep: 1.8, protein: 1.0, activity: 0.4, fiber: 0.6 },
  balance: { activity: 1.4, fiber: 1.3, protein: 1.1, hydration: 1.0 },
  reset:   { protein: 1.3, activity: 1.3, hydration: 1.2, sleep: 1.1 },
};

// ─── Focus Item Builder ───────────────────────────────────────────────────────

function buildFocusItem(
  category: FocusCategory,
  actuals: DailyActuals,
  targets: DailyTargets,
  wearable: WearableData,
  phase: ShotPhase,
): FocusItem {
  const phaseNote = phase === 'peak' ? ' · Peak GLP-1 day' : '';

  switch (category) {
    case 'injection':
      return {
        id: 'injection', label: 'Log Your Injection',
        subtitle: 'Keep your shot cycle accurate',
        badge: '+15 pts', iconName: 'colorize', iconSet: 'MaterialIcons',
      };
    case 'hydration': {
      const pct = Math.round(actuals.waterMl / targets.waterMl * 100);
      const remainOz = Math.round(Math.max(0, targets.waterMl - actuals.waterMl) / 29.57);
      const pts = Math.round(20 * Math.max(0, 1 - actuals.waterMl / targets.waterMl));
      return {
        id: 'hydration',
        label: remainOz > 0 ? `Drink ${remainOz}oz more water` : 'Hit your hydration goal',
        subtitle: `${pct}% of daily target${phase === 'peak' ? ' · Electrolytes critical today' : phaseNote}`,
        badge: pts > 0 ? `+${pts} pts` : 'On Track',
        iconName: 'water-outline', iconSet: 'Ionicons',
      };
    }
    case 'protein': {
      const remainG = Math.round(Math.max(0, targets.proteinG - actuals.proteinG));
      const pts = Math.round(30 * Math.max(0, 1 - actuals.proteinG / targets.proteinG));
      const tip = phase === 'shot' ? ' · Try a protein shake today' : '';
      return {
        id: 'protein',
        label: remainG > 0 ? `Add ${remainG}g protein today` : 'Protein goal reached',
        subtitle: `Preserves lean muscle on GLP-1${tip}`,
        badge: pts > 0 ? `+${pts} pts` : 'Complete',
        iconName: 'restaurant', iconSet: 'MaterialIcons',
      };
    }
    case 'fiber': {
      const remainG = Math.round(Math.max(0, targets.fiberG - actuals.fiberG));
      const pts = Math.round(15 * Math.max(0, 1 - actuals.fiberG / targets.fiberG));
      return {
        id: 'fiber',
        label: remainG > 0 ? `Get ${remainG}g more fiber` : 'Fiber goal complete',
        subtitle: `Supports digestion · ${targets.fiberG}g daily target`,
        badge: pts > 0 ? `+${pts} pts` : 'Complete',
        iconName: 'eco', iconSet: 'MaterialIcons',
      };
    }
    case 'activity': {
      const remainSteps = Math.max(0, targets.steps - actuals.steps);
      const pts = Math.round(20 * Math.max(0, 1 - actuals.steps / targets.steps));
      return {
        id: 'activity',
        label: remainSteps > 500 ? `Walk ${remainSteps.toLocaleString()} more steps` : '15-min walk',
        subtitle: `${actuals.steps.toLocaleString()} of ${targets.steps.toLocaleString()} steps today`,
        badge: pts > 0 ? `+${pts} pts` : 'Goal Met',
        iconName: 'directions-walk', iconSet: 'MaterialIcons',
      };
    }
    case 'sleep': {
      const hrs = Math.round(wearable.sleepMinutes / 60 * 10) / 10;
      return {
        id: 'sleep',
        label: 'Prioritize sleep tonight',
        subtitle: `Last night: ${hrs}h · Aim for 7–9h${phaseNote}`,
        badge: 'Sleep Focus',
        iconName: 'moon-outline', iconSet: 'Ionicons',
      };
    }
    case 'recovery': {
      const recovery = computeRecovery(wearable, phase);
      return {
        id: 'recovery',
        label: 'Recovery day today',
        subtitle: `HRV ${wearable.hrvMs}ms · RHR ${wearable.restingHR}bpm · Score ${Math.round(recovery)}`,
        badge: 'Recovery',
        iconName: 'favorite-border', iconSet: 'MaterialIcons',
      };
    }
    case 'rest':
      return {
        id: 'rest',
        label: 'Rest & recover today',
        subtitle: 'Peak GLP-1 day — light movement only',
        badge: 'Phase Rest',
        iconName: 'self-improvement', iconSet: 'MaterialIcons',
      };
  }
}

// ─── Main Focus Generator ─────────────────────────────────────────────────────

export function generateFocuses(
  actuals: DailyActuals,
  targets: DailyTargets,
  wearable: WearableData,
  daysSinceShot: number,
): FocusItem[] {
  const phase = getShotPhase(daysSinceShot);
  const recovery = computeRecovery(wearable, phase);

  const deficits: Record<FocusCategory, number> = {
    injection: actuals.injectionLogged ? 0 : (daysSinceShot >= 7 ? 100 : 40),
    hydration: Math.max(0, (targets.waterMl - actuals.waterMl) / targets.waterMl * 100),
    protein:   Math.max(0, (targets.proteinG - actuals.proteinG) / targets.proteinG * 100),
    fiber:     Math.max(0, (targets.fiberG - actuals.fiberG) / targets.fiberG * 100),
    activity:  Math.max(0, (targets.steps - actuals.steps) / targets.steps * 100),
    sleep:     (1 - scoreSleep(wearable.sleepMinutes)) * 100,
    recovery:  Math.max(0, 70 - recovery),
    rest:      phase === 'peak' ? Math.max(0, 65 - recovery) : 0,
  };

  const weights = PHASE_WEIGHTS[phase];
  const weighted = (Object.keys(deficits) as FocusCategory[]).map((cat) => {
    const mult = weights[cat] ?? 1.0;
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
