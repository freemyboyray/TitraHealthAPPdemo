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
};

// ─── Shot Cycle ───────────────────────────────────────────────────────────────

export function daysSinceInjection(lastInjectionDate: string | Date): number {
  const last =
    typeof lastInjectionDate === 'string'
      ? new Date(lastInjectionDate)
      : lastInjectionDate;
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.floor((Date.now() - last.getTime()) / msPerDay) + 1;
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

function scoreSleep(minutes: number): number {
  if (minutes >= 420 && minutes <= 540) return 1.0;
  if (minutes >= 360 && minutes < 420) return 0.75;
  if (minutes >= 300 && minutes < 360) return 0.5;
  if (minutes > 540 && minutes <= 600) return 0.85;
  if (minutes > 600) return 0.65;
  return Math.max(0, minutes / 420);
}

function scoreHRV(ms: number): number {
  if (ms >= 60) return 1.0;
  if (ms >= 50) return 0.9;
  if (ms >= 40) return 0.75;
  if (ms >= 30) return 0.55;
  if (ms >= 20) return 0.35;
  return 0.1;
}

function scoreRHR(bpm: number): number {
  if (bpm < 55) return 1.0;
  if (bpm < 65) return 0.85;
  if (bpm < 75) return 0.65;
  if (bpm < 85) return 0.4;
  return 0.15;
}

function scoreSPO2(pct: number): number {
  if (pct >= 98) return 1.0;
  if (pct >= 96) return 0.8;
  if (pct >= 94) return 0.5;
  if (pct >= 90) return 0.2;
  return 0;
}

// ─── Scoring Formulas ─────────────────────────────────────────────────────────

export function computeRecovery(wearable: WearableData): number {
  const sleep = scoreSleep(wearable.sleepMinutes) * 40;
  const hrv   = scoreHRV(wearable.hrvMs) * 25;
  const rhr   = scoreRHR(wearable.restingHR) * 20;
  const spo2  = scoreSPO2(wearable.spo2Pct) * 15;
  return Math.round(sleep + hrv + rhr + spo2);
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

export function recoveryBreakdown(wearable: WearableData): Array<{ label: string; actual: number; max: number }> {
  return [
    { label: 'Sleep',    actual: Math.round(scoreSleep(wearable.sleepMinutes) * 40), max: 40 },
    { label: 'HRV',      actual: Math.round(scoreHRV(wearable.hrvMs) * 25),           max: 25 },
    { label: 'Rest. HR', actual: Math.round(scoreRHR(wearable.restingHR) * 20),       max: 20 },
    { label: 'SpO₂',     actual: Math.round(scoreSPO2(wearable.spo2Pct) * 15),        max: 15 },
  ];
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
