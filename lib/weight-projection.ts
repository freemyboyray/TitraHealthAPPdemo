// ─── Weight Projection Engine ─────────────────────────────────────────────────
// Computes a sigmoid-based weight projection and clinical risk flags.
// Pure TypeScript - no React/Supabase dependencies.

import type { Glp1Type, Sex } from '@/constants/user-profile';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BmiClass = 'normal' | 'overweight' | 'obesity_1' | 'obesity_2' | 'obesity_3';
export type ConfidenceLevel = 'high' | 'on_track' | 'monitoring';
export type PlateauRisk = 'none' | 'approaching' | 'detected';

export type WeightProjection = {
  lossToDateLbs: number;
  lossToDatePct: number;
  weeklyLossRateLbs: number;   // linear regression over last 4 weight logs
  earlyResponderFlag: boolean; // >= 5% loss by week 12
  confidenceLevel: ConfidenceLevel;
  projectedTotalLossLbs: number;
  projectedGoalDate: string;   // ISO date string
  weeksToGoal: number;
  bmi: number;
  bmiClass: BmiClass;
  plateauRisk: PlateauRisk;
  curve: { week: number; weightLbs: number }[]; // 72 points for chart
};

// ─── BMI helpers ──────────────────────────────────────────────────────────────

export function computeBmi(weightLbs: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const kg = weightLbs * 0.453592;
  const m  = heightCm / 100;
  return Math.round((kg / (m * m)) * 10) / 10;
}

export function bmiClass(bmi: number): BmiClass {
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  if (bmi < 35) return 'obesity_1';
  if (bmi < 40) return 'obesity_2';
  return 'obesity_3';
}

// ─── Expected total loss benchmarks (clinical trial data) ─────────────────────

function expectedLossPct(medicationType: Glp1Type, doseMg: number): number {
  if (medicationType === 'tirzepatide') {
    if (doseMg >= 15) return 20.9;
    if (doseMg >= 10) return 19.5;
    return 15.0;
  }
  // semaglutide
  if (doseMg >= 2.4) return 14.9;
  if (doseMg >= 1.0) return 12.4;
  return 6.0;
}

// ─── Plateau week by BMI ──────────────────────────────────────────────────────

function plateauWeekEstimate(bmi: number): number {
  if (bmi >= 40) return 36;
  if (bmi >= 30) return 28;
  return 24;
}

// ─── Linear regression slope ─────────────────────────────────────────────────

function linearRegressionSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const xMean = points.reduce((s, p) => s + p.x, 0) / n;
  const yMean = points.reduce((s, p) => s + p.y, 0) / n;
  const num = points.reduce((s, p) => s + (p.x - xMean) * (p.y - yMean), 0);
  const den = points.reduce((s, p) => s + (p.x - xMean) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

// ─── Add weeks helper ────────────────────────────────────────────────────────

function addWeeksToDate(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeWeightProjection(params: {
  startWeightLbs: number;
  currentWeightLbs: number;
  goalWeightLbs: number;
  weightLogHistory: { weight_lbs: number; logged_at: string }[];
  programWeek: number;
  medicationType: Glp1Type;
  doseMg: number;
  sex: Sex;
  heightCm: number;
  targetWeeklyLossLbs: number;
}): WeightProjection {
  const {
    startWeightLbs, currentWeightLbs, goalWeightLbs,
    weightLogHistory, programWeek, medicationType, doseMg, heightCm,
    targetWeeklyLossLbs,
  } = params;

  // 1. BMI
  const bmi = computeBmi(currentWeightLbs, heightCm);
  const bmiCls = bmiClass(bmi);

  // 2. Loss to date
  const lossToDateLbs = Math.max(0, startWeightLbs - currentWeightLbs);
  const lossToDatePct = startWeightLbs > 0
    ? Math.round((lossToDateLbs / startWeightLbs) * 1000) / 10
    : 0;

  // 3. Linear regression over last 4 weight logs (most recent first → sort by date asc)
  const sorted4 = [...weightLogHistory]
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .slice(-4);

  const timespanDays = sorted4.length >= 2
    ? (new Date(sorted4.at(-1)!.logged_at).getTime() - new Date(sorted4[0].logged_at).getTime()) / 86400000
    : 0;

  const t0 = sorted4.length >= 2 ? new Date(sorted4[0].logged_at).getTime() : 0;
  const regressionPoints = sorted4.map(l => ({
    x: (new Date(l.logged_at).getTime() - t0) / 86400000, // elapsed days
    y: l.weight_lbs,
  }));
  const slope = linearRegressionSlope(regressionPoints); // lbs/day

  const regressionRate = sorted4.length >= 2 && timespanDays >= 7
    ? Math.min(3.0, Math.round(Math.abs(slope) * 7 * 10) / 10)
    : 0;

  // Use regression if valid, else fall back to onboarding target
  const weeklyLossRateLbs = regressionRate > 0 ? regressionRate : targetWeeklyLossLbs;

  // 4. Early responder flag
  const earlyResponderFlag = programWeek >= 12 && lossToDatePct >= 5;

  // 5. Expected total loss pct (scale up for early responders)
  let targetLossPct = expectedLossPct(medicationType, doseMg);
  if (earlyResponderFlag) targetLossPct *= 1.1;

  // 6. Projected total loss
  const projectedTotalLossLbs = Math.round(startWeightLbs * (targetLossPct / 100) * 10) / 10;
  const projectedFinalWeight   = startWeightLbs - projectedTotalLossLbs;

  // 7. Plateau week
  const pWeek = plateauWeekEstimate(bmi);

  // 8. Sigmoid curve over 72 weeks
  // L / (1 + e^(-0.15 * (week - pWeek/2))) anchored to startWeight → projectedFinalWeight
  const L = projectedTotalLossLbs;
  const curve: { week: number; weightLbs: number }[] = [];
  for (let w = 0; w <= 72; w++) {
    const lostAtWeek = L / (1 + Math.exp(-0.15 * (w - pWeek / 2)));
    curve.push({ week: w, weightLbs: Math.round((startWeightLbs - lostAtWeek) * 10) / 10 });
  }

  // 9. Projected goal date - forward projection from current weight at current rate
  const lbsToGoal = Math.max(0, currentWeightLbs - goalWeightLbs);
  const effectiveRate = weeklyLossRateLbs > 0 ? weeklyLossRateLbs : targetWeeklyLossLbs;
  const weeksToGoal = effectiveRate > 0 ? Math.round(lbsToGoal / effectiveRate) : 104;
  const projectedGoalDate = toISODate(addWeeksToDate(new Date(), weeksToGoal));

  // 10. Confidence level
  const confidenceLevel: ConfidenceLevel =
    earlyResponderFlag ? 'high'
    : lossToDatePct >= targetLossPct * 0.5 ? 'on_track'
    : 'monitoring';

  // 11. Plateau risk: last 3 consecutive weekly entries diff < 0.5 lbs
  let plateauRisk: PlateauRisk = 'none';
  if (sorted4.length >= 3) {
    const last3 = sorted4.slice(-3);
    const diffs = [
      Math.abs(last3[0].weight_lbs - last3[1].weight_lbs),
      Math.abs(last3[1].weight_lbs - last3[2].weight_lbs),
    ];
    if (diffs.every(d => d < 0.5)) plateauRisk = 'detected';
    else if (diffs.some(d => d < 0.5)) plateauRisk = 'approaching';
  }

  return {
    lossToDateLbs,
    lossToDatePct,
    weeklyLossRateLbs,
    earlyResponderFlag,
    confidenceLevel,
    projectedTotalLossLbs,
    projectedGoalDate,
    weeksToGoal,
    bmi,
    bmiClass: bmiCls,
    plateauRisk,
    curve,
  };
}
