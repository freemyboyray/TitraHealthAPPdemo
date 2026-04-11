// ─── Provider Report Data Aggregation ────────────────────────────────────────
// Pure function — no side effects, fully testable.
// Computes a multi-period clinical summary for provider PDF export.

import type { DailyTargets } from '@/constants/scoring';
import type {
  FoodLog,
  WeightLog,
  ActivityLog,
  SideEffectLog,
  InjectionLog,
  WeeklyCheckinRow,
  FoodNoiseLog,
} from '@/stores/log-store';
import type { FullUserProfile } from '@/constants/user-profile';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T00:00:00').getTime();
  const msB = new Date(b + 'T00:00:00').getTime();
  return Math.round(Math.abs(msB - msA) / 86400000);
}

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d);
  start.setDate(d.getDate() - d.getDay()); // Sunday
  return toDateStr(start);
}

function dateStrFromTs(ts: string): string {
  return ts.slice(0, 10);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProviderReportConfig {
  dateRange: { start: string; end: string }; // YYYY-MM-DD
  sections: {
    weight: boolean;
    adherence: boolean;
    sideEffects: boolean;
    nutrition: boolean;
    activity: boolean;
    biometrics: boolean;
    checkins: boolean;
  };
  providerName?: string;
  practiceName?: string;
  appointmentDate?: string;
  includeAiSummary: boolean;
  includeDetailedTables: boolean;
}

export interface ProviderReportInput {
  foodLogs: FoodLog[];
  weightLogs: WeightLog[];
  activityLogs: ActivityLog[];
  sideEffectLogs: SideEffectLog[];
  injectionLogs: InjectionLog[];
  weeklyCheckins: Record<string, WeeklyCheckinRow[]>;
  foodNoiseLogs: FoodNoiseLog[];
  profile: FullUserProfile;
  targets: DailyTargets;
  wearable: {
    hrvMs?: number;
    restingHR?: number;
    sleepMinutes?: number;
    spo2Pct?: number;
  };
  waterByDate: Record<string, number>;
  /** Optional RTM context — pass when the patient has linked a clinician. */
  rtm?: {
    clinicianName: string | null;
    engagementDays: number;
  };
}

export interface WeightSection {
  startOfPeriod: number | null;
  endOfPeriod: number | null;
  deltaLbs: number | null;
  deltaPct: number | null;
  totalLossFromBaseline: number | null;
  totalLossPct: number | null;
  weeklyRateLbs: number | null;
  bmi: number | null;
  bmiClass: string;
  dataPoints: { date: string; weight: number }[];
  flags: string[];
}

export interface AdherenceSection {
  expectedDoses: number;
  loggedDoses: number;
  adherencePct: number;
  missedWindows: string[];
  doseHistory: { date: string; dose: number; site: string | null; medication: string | null }[];
  flags: string[];
}

export interface SideEffectRow {
  type: string;
  count: number;
  avgSeverity: number;
  maxSeverity: number;
  trend: 'improving' | 'stable' | 'worsening';
}

export interface SideEffectSection {
  totalEvents: number;
  uniqueTypes: number;
  byType: SideEffectRow[];
  severityDistribution: { mild: number; moderate: number; severe: number };
  giCluster: boolean;
  flags: string[];
  weeklyBars: { week: string; count: number; avgSeverity: number }[];
}

export interface NutritionSection {
  daysLogged: number;
  totalDays: number;
  loggingPct: number;
  averages: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null };
  targets: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  proteinPct: number | null;
  caloriePct: number | null;
  weeklyTrend: { week: string; avgCalories: number; avgProtein: number }[];
  flags: string[];
}

export interface ActivitySection {
  avgDailySteps: number | null;
  stepsTarget: number;
  activeDays: number;
  totalDays: number;
  exerciseSessions: number;
  exerciseByType: { type: string; count: number; avgDuration: number }[];
  weeklySteps: { week: string; avgSteps: number }[];
  flags: string[];
}

export interface BiometricsSection {
  restingHR: number | null;
  hrv: number | null;
  sleepHours: number | null;
  bloodGlucose: number | null;
  spo2: number | null;
}

export interface CheckinSection {
  latestScores: Record<string, number | null>;
  foodNoiseHistory: { date: string; score: number }[];
}

/**
 * Clinician-context block at the top of the provider report.
 * Holds the linked clinician's display name plus a simple count of distinct
 * days the patient logged data within the reporting window — informational
 * context only, not a billing or attestation artifact.
 */
export interface RtmSection {
  enabled: boolean;
  clinicianName: string | null;
  periodStart: string;          // YYYY-MM-DD
  periodEnd: string;            // YYYY-MM-DD
  engagementDays: number;
}

export interface ClinicalFlag {
  severity: 'warning' | 'info';
  title: string;
  body: string;
}

// ─── SOAP Narrative ───────────────────────────────────────────────────────────
// Structured, neutral observations used by the new SOAP-format renderer.
// All text is pre-written in non-judgmental, observation-only language —
// no recommendations, no directives, safe for both clinician and patient eyes.

export type ObservationCategory =
  | 'weight'
  | 'nutrition'
  | 'side_effects'
  | 'adherence'
  | 'activity'
  | 'checkins'
  | 'program';

export interface ObservationItem {
  severity: 'warning' | 'info';
  category: ObservationCategory;
  text: string;
}

export interface DiscussionItem {
  category: ObservationCategory;
  text: string;
}

export interface NarrativeSections {
  assessment: ObservationItem[];
  discussion: DiscussionItem[];
}

export interface ProviderReportData {
  dateRange: { start: string; end: string; totalDays: number };

  patient: {
    name: string | null;
    dob: string | null;
    age: number | null;
    sex: string;
    heightDisplay: string;
    bmi: number | null;
    bmiClass: string;
    programStartDate: string | null;
    programWeek: number | null;
    startWeight: number | null;
    currentWeight: number | null;
    goalWeight: number | null;
  };

  medication: {
    type: string | null;
    brand: string | null;
    currentDose: number | null;
    initialDose: number | null;
    route: string;
    frequency: string;
  };

  weight: WeightSection;
  adherence: AdherenceSection;
  sideEffects: SideEffectSection;
  nutrition: NutritionSection;
  activity: ActivitySection;
  biometrics: BiometricsSection;
  checkins: CheckinSection;
  clinicalFlags: ClinicalFlag[];
  narrative: NarrativeSections;
  rtm?: RtmSection;
}

// ─── BMI helpers ──────────────────────────────────────────────────────────────

function computeBmi(weightLbs: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightLbs * 0.453592 / (heightM * heightM);
}

function classifyBmi(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  if (bmi < 35) return 'Obesity I';
  if (bmi < 40) return 'Obesity II';
  return 'Obesity III';
}

// ─── Height display ───────────────────────────────────────────────────────────

function heightToDisplay(cm: number): string {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return `${ft}'${inches}"`;
}

// ─── Main aggregation ─────────────────────────────────────────────────────────

export function computeProviderReport(
  input: ProviderReportInput,
  config: ProviderReportConfig,
): ProviderReportData {
  const { start, end } = config.dateRange;
  const totalDays = daysBetween(start, end) + 1;
  const { profile, targets } = input;

  // Window filters
  const startMs = new Date(start + 'T00:00:00').getTime();
  const endMs = new Date(end + 'T23:59:59.999').getTime();

  function tsInWindow(ts: string): boolean {
    try {
      const ms = new Date(ts).getTime();
      return ms >= startMs && ms <= endMs;
    } catch { return false; }
  }

  function dateInWindow(dateStr: string): boolean {
    return dateStr >= start && dateStr <= end;
  }

  // ── Patient info ──────────────────────────────────────────────────────────

  const programStartDate = profile.startDate ?? null;
  let programWeek: number | null = null;
  if (programStartDate) {
    programWeek = Math.floor(daysBetween(programStartDate, end) / 7) + 1;
  }

  const heightCm = profile.heightCm ?? 170;
  const currentWeightLbs = profile.weightLbs ?? null;
  const bmi = currentWeightLbs ? computeBmi(currentWeightLbs, heightCm) : null;

  const patient = {
    name: (profile as any).fullName ?? (profile as any).username ?? null,
    dob: (profile as any).dob ?? null,
    age: profile.age ?? null,
    sex: profile.sex ?? 'Not specified',
    heightDisplay: heightToDisplay(heightCm),
    bmi: bmi ? Math.round(bmi * 10) / 10 : null,
    bmiClass: bmi ? classifyBmi(bmi) : 'Unknown',
    programStartDate,
    programWeek,
    startWeight: profile.startWeightLbs ?? null,
    currentWeight: currentWeightLbs,
    goalWeight: profile.goalWeightLbs ?? null,
  };

  const injFreq = profile.injectionFrequencyDays ?? 7;
  const medication = {
    type: profile.glp1Type ?? null,
    brand: profile.medicationBrand ?? null,
    currentDose: profile.doseMg ?? null,
    initialDose: (profile as any).initialDoseMg ?? null,
    route: injFreq === 1 ? 'Oral' : 'Subcutaneous Injection',
    frequency: injFreq === 1 ? 'Daily' : injFreq === 7 ? 'Weekly' : `Every ${injFreq} days`,
  };

  // ── Weight ────────────────────────────────────────────────────────────────

  const weightInWindow = input.weightLogs
    .filter(w => tsInWindow(w.logged_at))
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));

  const wStart = weightInWindow.length > 0 ? weightInWindow[0].weight_lbs : null;
  const wEnd = weightInWindow.length > 0 ? weightInWindow[weightInWindow.length - 1].weight_lbs : null;
  const wDelta = wStart != null && wEnd != null ? wEnd - wStart : null;
  const wDeltaPct = wStart != null && wDelta != null ? (wDelta / wStart) * 100 : null;

  const baselineWeight = profile.startWeightLbs ?? null;
  const totalLoss = baselineWeight != null && wEnd != null ? wEnd - baselineWeight : null;
  const totalLossPct = baselineWeight != null && totalLoss != null ? (totalLoss / baselineWeight) * 100 : null;

  const weeksInPeriod = totalDays / 7;
  const weeklyRate = wDelta != null && weeksInPeriod > 0 ? wDelta / weeksInPeriod : null;

  const dataPoints = weightInWindow.map(w => ({
    date: dateStrFromTs(w.logged_at),
    weight: w.weight_lbs,
  }));

  const weightFlags: string[] = [];
  if (weeklyRate != null && weeklyRate < -3) {
    weightFlags.push('Rapid weight loss detected (>' + Math.abs(weeklyRate).toFixed(1) + ' lbs/wk). Evaluate for excessive caloric restriction or dehydration.');
  }
  if (wEnd != null && bmi != null && bmi < 18.5) {
    weightFlags.push('BMI below 18.5 — patient is underweight.');
  }

  // Check for consecutive weeks of rapid loss
  if (dataPoints.length >= 3) {
    const byWeek = new Map<string, number[]>();
    for (const dp of dataPoints) {
      const wk = weekLabel(dp.date);
      if (!byWeek.has(wk)) byWeek.set(wk, []);
      byWeek.get(wk)!.push(dp.weight);
    }
    const weeklyAvgs = [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, vals]) => vals.reduce((a, b) => a + b, 0) / vals.length);
    let consecutiveRapid = 0;
    for (let i = 1; i < weeklyAvgs.length; i++) {
      if (weeklyAvgs[i - 1] - weeklyAvgs[i] > 3) consecutiveRapid++;
      else consecutiveRapid = 0;
    }
    if (consecutiveRapid >= 2 && !weightFlags.some(f => f.includes('Rapid'))) {
      weightFlags.push('Weight loss exceeding 3 lbs/wk for 2+ consecutive weeks.');
    }
  }

  const weight: WeightSection = {
    startOfPeriod: wStart,
    endOfPeriod: wEnd,
    deltaLbs: wDelta,
    deltaPct: wDeltaPct ? Math.round(wDeltaPct * 10) / 10 : null,
    totalLossFromBaseline: totalLoss,
    totalLossPct: totalLossPct ? Math.round(totalLossPct * 10) / 10 : null,
    weeklyRateLbs: weeklyRate ? Math.round(weeklyRate * 10) / 10 : null,
    bmi: patient.bmi,
    bmiClass: patient.bmiClass,
    dataPoints,
    flags: weightFlags,
  };

  // ── Adherence ─────────────────────────────────────────────────────────────

  const injInWindow = input.injectionLogs
    .filter(i => dateInWindow(i.injection_date))
    .sort((a, b) => a.injection_date.localeCompare(b.injection_date));

  // Calculate expected doses
  const expectedDoses = injFreq === 1
    ? totalDays
    : Math.floor(totalDays / injFreq);

  const loggedDoses = injInWindow.length;
  const adherencePct = expectedDoses > 0 ? Math.round((loggedDoses / expectedDoses) * 100) : 100;

  // Find missed windows (for non-daily: check each expected window)
  const missedWindows: string[] = [];
  if (injFreq > 1) {
    const loggedDates = new Set(injInWindow.map(i => i.injection_date));
    const startD = new Date(start + 'T00:00:00');
    const endD = new Date(end + 'T00:00:00');
    // Walk through expected injection windows
    let cursor = new Date(startD);
    while (cursor <= endD) {
      const windowStart = toDateStr(cursor);
      const windowEnd = new Date(cursor);
      windowEnd.setDate(windowEnd.getDate() + injFreq - 1);
      const windowEndStr = toDateStr(windowEnd);

      let found = false;
      for (const ld of loggedDates) {
        if (ld >= windowStart && ld <= windowEndStr) { found = true; break; }
      }
      if (!found && windowEndStr <= end) {
        missedWindows.push(windowStart);
      }
      cursor.setDate(cursor.getDate() + injFreq);
    }
  }

  const doseHistory = injInWindow.map(i => ({
    date: i.injection_date,
    dose: i.dose_mg,
    site: i.site,
    medication: i.medication_name,
  }));

  const adherenceFlags: string[] = [];
  if (adherencePct < 80) {
    adherenceFlags.push(`Sub-therapeutic adherence (${adherencePct}%). Review barriers to medication compliance.`);
  }
  // Check consecutive misses
  if (missedWindows.length >= 2) {
    adherenceFlags.push(`${missedWindows.length} missed dose windows detected. Consider adherence support strategies.`);
  }

  const adherence: AdherenceSection = {
    expectedDoses,
    loggedDoses,
    adherencePct: Math.min(adherencePct, 100),
    missedWindows,
    doseHistory,
    flags: adherenceFlags,
  };

  // ── Side Effects ──────────────────────────────────────────────────────────

  const seInWindow = input.sideEffectLogs
    .filter(se => tsInWindow(se.logged_at))
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));

  const GI_TYPES = new Set(['nausea', 'vomiting', 'constipation', 'diarrhea', 'bloating', 'heartburn', 'sulfur_burps']);

  const seByType = new Map<string, SideEffectLog[]>();
  for (const se of seInWindow) {
    if (!seByType.has(se.effect_type)) seByType.set(se.effect_type, []);
    seByType.get(se.effect_type)!.push(se);
  }

  const midpointMs = startMs + (endMs - startMs) / 2;
  const byTypeRows: SideEffectRow[] = [...seByType.entries()].map(([type, logs]) => {
    const severities = logs.map(l => l.severity);
    const avg = severities.reduce((a, b) => a + b, 0) / severities.length;
    const max = Math.max(...severities);

    // Trend: compare first half vs second half
    const firstHalf = logs.filter(l => new Date(l.logged_at).getTime() < midpointMs);
    const secondHalf = logs.filter(l => new Date(l.logged_at).getTime() >= midpointMs);
    const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a, b) => a + b.severity, 0) / firstHalf.length : 0;
    const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a, b) => a + b.severity, 0) / secondHalf.length : 0;

    let trend: 'improving' | 'stable' | 'worsening' = 'stable';
    if (secondHalf.length === 0 && firstHalf.length > 0) trend = 'improving';
    else if (secondAvg < firstAvg - 1) trend = 'improving';
    else if (secondAvg > firstAvg + 1) trend = 'worsening';

    return { type, count: logs.length, avgSeverity: Math.round(avg * 10) / 10, maxSeverity: max, trend };
  }).sort((a, b) => b.count - a.count);

  let mild = 0, moderate = 0, severe = 0;
  for (const se of seInWindow) {
    if (se.severity <= 3) mild++;
    else if (se.severity <= 6) moderate++;
    else severe++;
  }

  const giTypesLogged = [...seByType.keys()].filter(t => GI_TYPES.has(t));
  const giCluster = giTypesLogged.length >= 3;

  // Weekly bars
  const seByWeek = new Map<string, SideEffectLog[]>();
  for (const se of seInWindow) {
    const wk = weekLabel(dateStrFromTs(se.logged_at));
    if (!seByWeek.has(wk)) seByWeek.set(wk, []);
    seByWeek.get(wk)!.push(se);
  }
  const weeklyBars = [...seByWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, logs]) => ({
      week,
      count: logs.length,
      avgSeverity: Math.round((logs.reduce((a, b) => a + b.severity, 0) / logs.length) * 10) / 10,
    }));

  const seFlags: string[] = [];
  if (severe > 0) {
    const severeTypes = byTypeRows.filter(r => r.maxSeverity >= 8).map(r => capitalize(r.type));
    seFlags.push(`Severe side effect(s) reported: ${severeTypes.join(', ')}. Clinical evaluation recommended.`);
  }
  if (giCluster) {
    seFlags.push(`GI symptom cluster detected (${giTypesLogged.map(capitalize).join(', ')}). Common during titration; consider anti-emetic PRN if persistent.`);
  }
  if (byTypeRows.some(r => r.trend === 'worsening')) {
    const worsening = byTypeRows.filter(r => r.trend === 'worsening').map(r => capitalize(r.type));
    seFlags.push(`Worsening trend for: ${worsening.join(', ')}.`);
  }

  const sideEffects: SideEffectSection = {
    totalEvents: seInWindow.length,
    uniqueTypes: seByType.size,
    byType: byTypeRows,
    severityDistribution: { mild, moderate, severe },
    giCluster,
    flags: seFlags,
    weeklyBars,
  };

  // ── Nutrition ─────────────────────────────────────────────────────────────

  const foodByDate = new Map<string, FoodLog[]>();
  for (const fl of input.foodLogs) {
    if (!tsInWindow(fl.logged_at)) continue;
    const ds = dateStrFromTs(fl.logged_at);
    if (!foodByDate.has(ds)) foodByDate.set(ds, []);
    foodByDate.get(ds)!.push(fl);
  }

  const nutDaysLogged = foodByDate.size;
  let totCal = 0, totPro = 0, totCarb = 0, totFat = 0, totFib = 0;
  for (const dayFoods of foodByDate.values()) {
    for (const fl of dayFoods) {
      totCal += fl.calories ?? 0;
      totPro += fl.protein_g ?? 0;
      totCarb += fl.carbs_g ?? 0;
      totFat += fl.fat_g ?? 0;
      totFib += fl.fiber_g ?? 0;
    }
  }

  const avgCal = nutDaysLogged > 0 ? Math.round(totCal / nutDaysLogged) : null;
  const avgPro = nutDaysLogged > 0 ? Math.round(totPro / nutDaysLogged) : null;
  const avgCarb = nutDaysLogged > 0 ? Math.round(totCarb / nutDaysLogged) : null;
  const avgFatN = nutDaysLogged > 0 ? Math.round(totFat / nutDaysLogged) : null;
  const avgFib = nutDaysLogged > 0 ? Math.round(totFib / nutDaysLogged) : null;

  const proteinPct = avgPro != null && targets.proteinG > 0 ? Math.round((avgPro / targets.proteinG) * 100) : null;
  const caloriePct = avgCal != null && targets.caloriesTarget > 0 ? Math.round((avgCal / targets.caloriesTarget) * 100) : null;

  // Weekly nutrition trend
  const nutByWeek = new Map<string, { calories: number; protein: number; days: number }>();
  for (const [dateStr, foods] of foodByDate) {
    const wk = weekLabel(dateStr);
    if (!nutByWeek.has(wk)) nutByWeek.set(wk, { calories: 0, protein: 0, days: 0 });
    const entry = nutByWeek.get(wk)!;
    entry.days++;
    for (const f of foods) {
      entry.calories += f.calories ?? 0;
      entry.protein += f.protein_g ?? 0;
    }
  }
  const weeklyTrend = [...nutByWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, d]) => ({
      week,
      avgCalories: Math.round(d.calories / d.days),
      avgProtein: Math.round(d.protein / d.days),
    }));

  const nutFlags: string[] = [];
  if (proteinPct != null && proteinPct < 70) {
    nutFlags.push(`Protein intake averaging ${proteinPct}% of target (${avgPro}g/day vs ${targets.proteinG}g). Below threshold for lean mass preservation. Recommend protein supplementation counseling.`);
  }
  const isFemale = profile.sex === 'female';
  const lowCalThreshold = isFemale ? 1200 : 1500;
  if (avgCal != null && avgCal < lowCalThreshold) {
    nutFlags.push(`Very low average calorie intake (${avgCal} kcal/day). Below ${lowCalThreshold} kcal minimum. Evaluate for nutritional adequacy.`);
  }
  if (nutDaysLogged > 0 && (nutDaysLogged / totalDays) < 0.5) {
    nutFlags.push(`Nutrition logging compliance is ${Math.round((nutDaysLogged / totalDays) * 100)}%. Insufficient data for reliable assessment.`);
  }

  const nutrition: NutritionSection = {
    daysLogged: nutDaysLogged,
    totalDays,
    loggingPct: Math.round((nutDaysLogged / totalDays) * 100),
    averages: { calories: avgCal, protein: avgPro, carbs: avgCarb, fat: avgFatN, fiber: avgFib },
    targets: {
      calories: targets.caloriesTarget,
      protein: targets.proteinG,
      carbs: targets.carbsG ?? 0,
      fat: targets.fatG ?? 0,
      fiber: targets.fiberG,
    },
    proteinPct,
    caloriePct,
    weeklyTrend,
    flags: nutFlags,
  };

  // ── Activity ──────────────────────────────────────────────────────────────

  const actInWindow = input.activityLogs.filter(a => dateInWindow(a.date));

  const stepsByDate = new Map<string, number>();
  const exerciseLogs: ActivityLog[] = [];
  for (const a of actInWindow) {
    stepsByDate.set(a.date, (stepsByDate.get(a.date) ?? 0) + (a.steps ?? 0));
    if (a.exercise_type && a.duration_min) exerciseLogs.push(a);
  }

  const allSteps = [...stepsByDate.values()];
  const avgDailySteps = allSteps.length > 0
    ? Math.round(allSteps.reduce((a, b) => a + b, 0) / allSteps.length)
    : null;
  const activeDays = allSteps.filter(s => s > 0).length;

  // Exercise by type
  const exerciseMap = new Map<string, { count: number; totalDur: number }>();
  for (const e of exerciseLogs) {
    const t = e.exercise_type!;
    if (!exerciseMap.has(t)) exerciseMap.set(t, { count: 0, totalDur: 0 });
    const entry = exerciseMap.get(t)!;
    entry.count++;
    entry.totalDur += e.duration_min!;
  }
  const exerciseByType = [...exerciseMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([type, d]) => ({ type, count: d.count, avgDuration: Math.round(d.totalDur / d.count) }));

  // Weekly steps
  const stepsByWeek = new Map<string, { total: number; days: number }>();
  for (const [dateStr, steps] of stepsByDate) {
    const wk = weekLabel(dateStr);
    if (!stepsByWeek.has(wk)) stepsByWeek.set(wk, { total: 0, days: 0 });
    const entry = stepsByWeek.get(wk)!;
    entry.total += steps;
    entry.days++;
  }
  const weeklySteps = [...stepsByWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, d]) => ({ week, avgSteps: Math.round(d.total / d.days) }));

  const actFlags: string[] = [];
  if (avgDailySteps != null && targets.steps > 0 && avgDailySteps < targets.steps * 0.5) {
    actFlags.push(`Average daily steps at ${Math.round((avgDailySteps / targets.steps) * 100)}% of target. Recommend gradual activity increase.`);
  }
  const hasStrength = exerciseByType.some(e => e.type.toLowerCase().includes('strength'));
  if (!hasStrength && exerciseLogs.length > 0) {
    actFlags.push('No resistance/strength training sessions logged. Important for lean mass preservation during GLP-1 therapy.');
  }

  const activity: ActivitySection = {
    avgDailySteps,
    stepsTarget: targets.steps,
    activeDays,
    totalDays,
    exerciseSessions: exerciseLogs.length,
    exerciseByType,
    weeklySteps,
    flags: actFlags,
  };

  // ── Biometrics ────────────────────────────────────────────────────────────

  const biometrics: BiometricsSection = {
    restingHR: input.wearable.restingHR ?? null,
    hrv: input.wearable.hrvMs ?? null,
    sleepHours: input.wearable.sleepMinutes != null ? Math.round((input.wearable.sleepMinutes / 60) * 10) / 10 : null,
    bloodGlucose: null, // Populated from HealthKit if available
    spo2: input.wearable.spo2Pct ?? null,
  };

  // ── Check-ins ─────────────────────────────────────────────────────────────

  // food_noise_logs.score is stored as a raw 0–20 sum (5 questions × 0–4),
  // where HIGHER is WORSE (more food noise). The other check-ins are stored
  // as 0–100 where HIGHER is BETTER. Normalize food noise to that same scale
  // here so the SOAP report can render every check-in as "X/100" with a
  // consistent "higher = better" semantic. Mirror of the conversion at
  // app/entry/food-noise-survey.tsx:134.
  function normalizeFoodNoiseScore(raw: number): number {
    return Math.round((1 - raw / 20) * 100);
  }

  function latestCheckinScore(type: string): number | null {
    if (type === 'food_noise') {
      const recent = input.foodNoiseLogs.find(fn => tsInWindow(fn.logged_at));
      return recent ? normalizeFoodNoiseScore(recent.score) : null;
    }
    const rows = input.weeklyCheckins[type] ?? [];
    const recent = rows.find(r => tsInWindow((r as any).logged_at ?? ''));
    return recent ? (recent as any).score ?? null : null;
  }

  const checkins: CheckinSection = {
    latestScores: {
      foodNoise: latestCheckinScore('food_noise'),
      appetite: latestCheckinScore('appetite'),
      energyMood: latestCheckinScore('energy_mood'),
      giBurden: latestCheckinScore('gi_burden'),
      activityQuality: latestCheckinScore('activity_quality'),
      sleepQuality: latestCheckinScore('sleep_quality'),
      mentalHealth: latestCheckinScore('mental_health'),
    },
    foodNoiseHistory: input.foodNoiseLogs
      .filter(fn => tsInWindow(fn.logged_at))
      .map(fn => ({ date: dateStrFromTs(fn.logged_at), score: normalizeFoodNoiseScore(fn.score) })),
  };

  // ── Clinical Flags (aggregate) ────────────────────────────────────────────

  const clinicalFlags: ClinicalFlag[] = [];

  // Collect all section flags
  for (const f of weightFlags) clinicalFlags.push({ severity: 'warning', title: 'Weight', body: f });
  for (const f of adherenceFlags) clinicalFlags.push({ severity: 'warning', title: 'Adherence', body: f });
  for (const f of seFlags) clinicalFlags.push({ severity: 'warning', title: 'Side Effects', body: f });
  for (const f of nutFlags) clinicalFlags.push({ severity: 'warning', title: 'Nutrition', body: f });
  for (const f of actFlags) clinicalFlags.push({ severity: 'info', title: 'Activity', body: f });

  // Add clinical reminders based on program week
  if (programWeek != null && programWeek >= 8) {
    clinicalFlags.push({
      severity: 'info',
      title: 'Lab Reminder',
      body: `Week ${programWeek} of GLP-1 therapy. Consider comprehensive metabolic panel, iron/ferritin, and vitamin D levels.`,
    });
  }

  // Dose titration consideration
  if (weeklyRate != null && Math.abs(weeklyRate) < 0.5 && programWeek != null && programWeek >= 4 && seInWindow.length < 3) {
    clinicalFlags.push({
      severity: 'info',
      title: 'Dose Titration',
      body: `Weight loss rate has slowed to ${Math.abs(weeklyRate).toFixed(1)} lbs/wk with minimal side effects. Patient may be a candidate for dose escalation.`,
    });
  }

  // Sort: warnings first
  clinicalFlags.sort((a, b) => (a.severity === 'warning' ? 0 : 1) - (b.severity === 'warning' ? 0 : 1));

  // ── Clinician context block ───────────────────────────────────────────────
  // Built only when the patient has linked a clinician and the caller passes
  // in pre-computed engagement days (RPC happens outside this pure function).
  // Purely informational — no billing thresholds, no attestation logic.
  let rtm: RtmSection | undefined;
  if (profile.rtmEnabled && input.rtm) {
    rtm = {
      enabled: true,
      clinicianName: input.rtm.clinicianName,
      periodStart: start,
      periodEnd: end,
      engagementDays: input.rtm.engagementDays,
    };
  }

  // ── SOAP Narrative (Assessment + Discussion) ──────────────────────────────
  // Pure observations, neutral phrasing. No recommendations, no directives.
  // Safe for both clinician and patient to read.

  const assessment: ObservationItem[] = [];
  const discussion: DiscussionItem[] = [];

  // Weight observations
  if (weeklyRate != null) {
    if (weeklyRate < -3) {
      assessment.push({
        severity: 'warning',
        category: 'weight',
        text: `Weight loss averaged ${Math.abs(weeklyRate).toFixed(1)} lbs per week during this period.`,
      });
    } else if (weeklyRate < -2) {
      assessment.push({
        severity: 'info',
        category: 'weight',
        text: `Weight loss averaged ${Math.abs(weeklyRate).toFixed(1)} lbs per week during this period.`,
      });
    } else if (Math.abs(weeklyRate) < 0.5 && programWeek != null && programWeek >= 4) {
      assessment.push({
        severity: 'info',
        category: 'weight',
        text: `Weight change averaged ${weeklyRate >= 0 ? '+' : ''}${weeklyRate.toFixed(1)} lbs per week — a relatively stable period at week ${programWeek} of the program.`,
      });
    }
  }
  if (wEnd != null && bmi != null && bmi < 18.5) {
    assessment.push({
      severity: 'warning',
      category: 'weight',
      text: `Most recent BMI is ${bmi.toFixed(1)}, which is below the standard reference range of 18.5–24.9.`,
    });
  }

  // Nutrition observations
  if (proteinPct != null && proteinPct < 70 && avgPro != null) {
    assessment.push({
      severity: 'warning',
      category: 'nutrition',
      text: `Average daily protein intake was ${avgPro} g, approximately ${proteinPct}% of the ${targets.proteinG} g target for this user.`,
    });
  } else if (proteinPct != null && proteinPct >= 70 && proteinPct < 90 && avgPro != null) {
    assessment.push({
      severity: 'info',
      category: 'nutrition',
      text: `Average daily protein intake was ${avgPro} g (${proteinPct}% of target).`,
    });
  }
  const lowCalThresholdObs = profile.sex === 'female' ? 1200 : 1500;
  if (avgCal != null && avgCal < lowCalThresholdObs) {
    assessment.push({
      severity: 'warning',
      category: 'nutrition',
      text: `Average daily caloric intake was ${avgCal} kcal, below the ${lowCalThresholdObs} kcal reference threshold.`,
    });
  }
  if (nutDaysLogged > 0 && (nutDaysLogged / totalDays) < 0.5) {
    assessment.push({
      severity: 'info',
      category: 'nutrition',
      text: `Nutrition was logged on ${nutDaysLogged} of ${totalDays} days (${Math.round((nutDaysLogged / totalDays) * 100)}%) during this period.`,
    });
  }

  // Side effect observations
  if (severe > 0) {
    const severeTypes = byTypeRows.filter(r => r.maxSeverity >= 8).map(r => capitalize(r.type));
    assessment.push({
      severity: 'warning',
      category: 'side_effects',
      text: `Severe-range events (8/10 or higher) were reported for: ${severeTypes.join(', ')}.`,
    });
  }
  if (giCluster) {
    assessment.push({
      severity: 'info',
      category: 'side_effects',
      text: `Multiple gastrointestinal symptoms were logged this period (${giTypesLogged.map(capitalize).join(', ')}).`,
    });
  }
  const worseningTypes = byTypeRows.filter(r => r.trend === 'worsening').map(r => capitalize(r.type));
  if (worseningTypes.length > 0) {
    assessment.push({
      severity: 'warning',
      category: 'side_effects',
      text: `Severity increased between the first and second halves of the period for: ${worseningTypes.join(', ')}.`,
    });
  }
  const improvingTypes = byTypeRows.filter(r => r.trend === 'improving').map(r => capitalize(r.type));
  if (improvingTypes.length > 0) {
    assessment.push({
      severity: 'info',
      category: 'side_effects',
      text: `Severity decreased or resolved between the first and second halves of the period for: ${improvingTypes.join(', ')}.`,
    });
  }

  // Adherence observations
  if (expectedDoses > 0 && adherencePct < 80) {
    assessment.push({
      severity: 'warning',
      category: 'adherence',
      text: `Doses were logged for ${loggedDoses} of ${expectedDoses} expected windows (${adherencePct}%) during this period.`,
    });
  } else if (expectedDoses > 0 && adherencePct >= 80 && adherencePct < 100) {
    assessment.push({
      severity: 'info',
      category: 'adherence',
      text: `${loggedDoses} of ${expectedDoses} expected dose windows had a logged injection (${adherencePct}%).`,
    });
  } else if (expectedDoses > 0 && adherencePct >= 100) {
    assessment.push({
      severity: 'info',
      category: 'adherence',
      text: `All ${expectedDoses} expected dose windows had a logged injection during this period.`,
    });
  }

  // Activity observations
  if (avgDailySteps != null && targets.steps > 0 && avgDailySteps < targets.steps * 0.5) {
    const pct = Math.round((avgDailySteps / targets.steps) * 100);
    assessment.push({
      severity: 'info',
      category: 'activity',
      text: `Average daily step count was ${avgDailySteps.toLocaleString()}, approximately ${pct}% of the ${targets.steps.toLocaleString()} target.`,
    });
  }
  const hasStrengthObs = exerciseByType.some(e => e.type.toLowerCase().includes('strength'));
  if (!hasStrengthObs && exerciseLogs.length > 0) {
    assessment.push({
      severity: 'info',
      category: 'activity',
      text: `${exerciseLogs.length} exercise session${exerciseLogs.length === 1 ? '' : 's'} were logged this period; none were categorized as strength or resistance training.`,
    });
  }

  // Program-week observations (informational, not directive)
  if (programWeek != null && programWeek >= 8 && programWeek % 4 === 0) {
    assessment.push({
      severity: 'info',
      category: 'program',
      text: `This report covers week ${programWeek} of the program.`,
    });
  }

  // Sort assessment: warnings first, then info
  assessment.sort((a, b) => (a.severity === 'warning' ? 0 : 1) - (b.severity === 'warning' ? 0 : 1));

  // ── Discussion items: period-anchored facts worth raising ──
  // Computed from within-window deltas, not transformations of the assessment list.

  // Check-in deltas (first vs latest within window)
  function checkinDelta(type: string, label: string): { latest: number; first: number } | null {
    const rows = (input.weeklyCheckins[type] ?? [])
      .filter(r => tsInWindow((r as any).logged_at ?? ''))
      .sort((a, b) => ((a as any).logged_at ?? '').localeCompare((b as any).logged_at ?? ''));
    if (rows.length < 2) return null;
    return { first: (rows[0] as any).score, latest: (rows[rows.length - 1] as any).score };
  }

  const checkinTypes: [string, string][] = [
    ['sleep_quality', 'Sleep quality'],
    ['energy_mood', 'Energy and mood'],
    ['gi_burden', 'GI symptom burden'],
    ['mental_health', 'Mental health'],
    ['appetite', 'Appetite'],
    ['activity_quality', 'Activity quality'],
  ];
  for (const [type, label] of checkinTypes) {
    const d = checkinDelta(type, label);
    if (d == null) continue;
    const delta = d.latest - d.first;
    if (Math.abs(delta) >= 15) {
      const direction = delta > 0 ? 'rose' : 'declined';
      discussion.push({
        category: 'checkins',
        text: `${label} self-rating ${direction} from ${d.first}/100 to ${d.latest}/100 across the period.`,
      });
    }
  }

  // Food noise delta
  const fnInWindow = input.foodNoiseLogs
    .filter(fn => tsInWindow(fn.logged_at))
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  if (fnInWindow.length >= 2) {
    const first = fnInWindow[0].score;
    const last = fnInWindow[fnInWindow.length - 1].score;
    if (Math.abs(last - first) >= 15) {
      const direction = last > first ? 'rose' : 'declined';
      discussion.push({
        category: 'checkins',
        text: `Food noise self-rating ${direction} from ${first}/100 to ${last}/100 during this period.`,
      });
    }
  }

  // New side effect types appearing this period
  const firstHalfTypes = new Set(
    seInWindow.filter(s => new Date(s.logged_at).getTime() < midpointMs).map(s => s.effect_type),
  );
  const secondHalfTypes = new Set(
    seInWindow.filter(s => new Date(s.logged_at).getTime() >= midpointMs).map(s => s.effect_type),
  );
  const newTypes = [...secondHalfTypes].filter(t => !firstHalfTypes.has(t));
  if (newTypes.length > 0) {
    discussion.push({
      category: 'side_effects',
      text: `New symptom type${newTypes.length === 1 ? '' : 's'} first reported in the second half of the period: ${newTypes.map(capitalize).join(', ')}.`,
    });
  }

  // Missed dose dates (specific)
  if (missedWindows.length > 0 && missedWindows.length <= 3) {
    discussion.push({
      category: 'adherence',
      text: `Dose window${missedWindows.length === 1 ? '' : 's'} without a logged injection: ${missedWindows.join(', ')}.`,
    });
  } else if (missedWindows.length > 3) {
    discussion.push({
      category: 'adherence',
      text: `${missedWindows.length} dose windows had no logged injection during this period.`,
    });
  }

  // Weight rate change (acceleration / deceleration within period)
  if (dataPoints.length >= 4) {
    const half = Math.floor(dataPoints.length / 2);
    const firstAvg = dataPoints.slice(0, half).reduce((a, b) => a + b.weight, 0) / half;
    const secondAvg = dataPoints.slice(half).reduce((a, b) => a + b.weight, 0) / (dataPoints.length - half);
    const halfDelta = secondAvg - firstAvg;
    if (Math.abs(halfDelta) >= 2) {
      const direction = halfDelta < 0 ? 'lower' : 'higher';
      discussion.push({
        category: 'weight',
        text: `Average weight in the second half of the period was ${Math.abs(halfDelta).toFixed(1)} lbs ${direction} than the first half.`,
      });
    }
  }

  // Activity volume note if very few active days
  if (activeDays > 0 && activeDays / totalDays < 0.4) {
    discussion.push({
      category: 'activity',
      text: `Step data was recorded on ${activeDays} of ${totalDays} days during this period.`,
    });
  }

  const narrative: NarrativeSections = { assessment, discussion };

  return {
    dateRange: { start, end, totalDays },
    patient,
    medication,
    weight,
    adherence,
    sideEffects,
    nutrition,
    activity,
    biometrics,
    checkins,
    clinicalFlags,
    narrative,
    rtm,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
