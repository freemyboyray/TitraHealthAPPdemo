import { glp1HrvOffset, glp1RhrOffset, type ShotPhase } from '@/constants/scoring';
import { pkConcentrationPct } from '@/constants/drug-pk';
import type { Glp1Type, Glp1Status } from '@/constants/user-profile';
import { localDateStr } from '@/lib/date-utils';
import type { ActivityLog, WeightLog } from '@/stores/log-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BiometricClassification =
  | 'expected_glp1'
  | 'expected_positive'
  | 'mild_unusual'
  | 'concerning'
  | 'insufficient_data';

export type MetricInterpretation = {
  actual: number | null;
  baseline: number | null;
  delta: number | null;
  expectedDelta: number | null;
  deviationFromExpected: number | null;
  classification: BiometricClassification;
  label: string;
  subLabel: string;
};

export type ForecastDay = {
  cycleDay: number;
  dateStr: string;
  appetiteSuppressionPct: number;
  energyForecastPct: number;
  pkConcentrationPct: number;
  state: 'peak_suppression' | 'moderate_suppression' | 'returning' | 'near_baseline';
  label: string;
  isToday: boolean;
};

export type MetabolicAdaptationResult = {
  hasEnoughData: boolean;
  calPerStepTrend: number[];
  rhrTrend: number[];
  weekLabels: string[];
  plateauRisk: 'none' | 'approaching' | 'detected';
  adaptationMessage: string | null;
  rhrImprovementBpm: number | null;
};

export type BiometricBaseline = {
  hrvMs: number | null;
  restingHR: number | null;
  sleepMinutes: number | null;
  sampleCount: number;
  lastUpdatedAt: string;
};

export type CycleIntelligenceResult = {
  hrv: MetricInterpretation;
  rhr: MetricInterpretation;
  sleep: MetricInterpretation;
  cycleDay: number | null;
  shotPhase: ShotPhase | null;
  headerLabel: string;
};

// ─── Appetite suppression % from PK concentration ─────────────────────────────
// Linear map: pkPct=0 → 5% suppression (near-baseline), pkPct=100 → 58% (peak)

export function computeAppetiteSuppressionPct(pkPct: number): number {
  return Math.round(5 + (pkPct / 100) * 53);
}

// ─── Energy forecast % from PK concentration ──────────────────────────────────
// Inverse: high drug concentration → lower energy (GI burden, fatigue)

function computeEnergyForecastPct(pkPct: number): number {
  return Math.round(100 - (pkPct / 100) * 40);
}

// ─── Forecast strip generation ────────────────────────────────────────────────

export function generateForecastStrip(
  lastInjectionDate: string | null,
  injFreqDays: number,
  glp1Type: Glp1Type,
  glp1Status: Glp1Status,
): ForecastDay[] {
  if (!lastInjectionDate) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);

  const displayDays = Math.min(injFreqDays, 7);
  const intervalH = injFreqDays * 24;
  const atSteadyState = glp1Status === 'active';

  return Array.from({ length: displayDays }, (_, i) => {
    const injDate = new Date(lastInjectionDate + 'T00:00:00');
    const dayDate = new Date(injDate.getTime() + i * 86400000);
    const dateStr = localDateStr(dayDate);
    const tHours = (i + 1) * 24; // day 1 = 24h post-injection

    const pkPct = Math.round(pkConcentrationPct(tHours, glp1Type, atSteadyState, intervalH));
    const appetiteSuppressionPct = computeAppetiteSuppressionPct(pkPct);
    const energyForecastPct = computeEnergyForecastPct(pkPct);

    const state: ForecastDay['state'] =
      appetiteSuppressionPct >= 60 ? 'peak_suppression'
      : appetiteSuppressionPct >= 40 ? 'moderate_suppression'
      : appetiteSuppressionPct >= 20 ? 'returning'
      : 'near_baseline';

    const stateLabels: Record<ForecastDay['state'], string> = {
      peak_suppression: 'Peak',
      moderate_suppression: 'Moderate',
      returning: 'Returning',
      near_baseline: 'Baseline',
    };

    return {
      cycleDay: i + 1,
      dateStr,
      appetiteSuppressionPct,
      energyForecastPct,
      pkConcentrationPct: pkPct,
      state,
      label: stateLabels[state],
      isToday: dateStr === todayStr,
    };
  });
}

// ─── Biometric deviation classification ───────────────────────────────────────

const HRV_TOLERANCE = 5;    // ms
const RHR_TOLERANCE = 3;    // bpm
const SLEEP_TOLERANCE = 30; // minutes

const CLASSIFICATION_LABELS: Record<BiometricClassification, { label: string; subLabel: string }> = {
  expected_glp1:      { label: 'Expected GLP-1 Effect', subLabel: 'Normal for your cycle phase' },
  expected_positive:  { label: 'Better Than Expected',  subLabel: 'Performing above cycle norms' },
  mild_unusual:       { label: 'Worth Watching',        subLabel: 'Slightly outside expected range' },
  concerning:         { label: 'Unusual',               subLabel: 'Significantly outside expected range' },
  insufficient_data:  { label: 'Insufficient Data',     subLabel: 'Building baseline...' },
};

export function classifyBiometricDeviation(
  actual: number | null,
  baseline: number | null,
  phase: ShotPhase | null,
  metric: 'hrv' | 'rhr' | 'sleep',
): MetricInterpretation {
  if (actual === null || baseline === null) {
    return {
      actual, baseline, delta: null, expectedDelta: null, deviationFromExpected: null,
      classification: 'insufficient_data',
      ...CLASSIFICATION_LABELS.insufficient_data,
    };
  }

  const delta = actual - baseline;

  // expectedDelta: drug-induced change we anticipate
  // HRV:  glp1HrvOffset positive = scoring adjustment → actual drug effect = suppression → expectedDelta negative
  // RHR:  glp1RhrOffset negative = scoring adjustment → actual drug effect = elevation → expectedDelta positive
  // Sleep: no known GLP-1 pharmacodynamic effect on sleep quality
  let expectedDelta = 0;
  let tolerance = 0;
  let higherIsBetter = true;

  switch (metric) {
    case 'hrv':
      expectedDelta = phase ? -glp1HrvOffset(phase) : 0;
      tolerance = HRV_TOLERANCE;
      higherIsBetter = true;
      break;
    case 'rhr':
      expectedDelta = phase ? -glp1RhrOffset(phase) : 0;
      tolerance = RHR_TOLERANCE;
      higherIsBetter = false;
      break;
    case 'sleep':
      expectedDelta = 0;
      tolerance = SLEEP_TOLERANCE;
      higherIsBetter = true;
      break;
  }

  const deviationFromExpected = delta - expectedDelta;

  // For classification: positive deviation = better than expected (for HRV/sleep = more, for RHR = less)
  const normalizedDev = higherIsBetter ? deviationFromExpected : -deviationFromExpected;

  let classification: BiometricClassification;
  if (normalizedDev >= -tolerance && normalizedDev <= tolerance) {
    classification = 'expected_glp1';
  } else if (normalizedDev > tolerance) {
    classification = 'expected_positive';
  } else if (normalizedDev > -(tolerance * 2)) {
    classification = 'mild_unusual';
  } else {
    classification = 'concerning';
  }

  return {
    actual, baseline, delta, expectedDelta, deviationFromExpected,
    classification,
    ...CLASSIFICATION_LABELS[classification],
  };
}

// ─── Full cycle intelligence result ───────────────────────────────────────────

export function computeCycleIntelligence(
  baseline: BiometricBaseline | null,
  wearable: { hrv: number | null; restingHR: number | null; sleepHours: number | null },
  phase: ShotPhase | null,
  cycleDay: number | null,
  glp1Drug?: string,
): CycleIntelligenceResult {
  const sleepMinutes = wearable.sleepHours != null
    ? Math.round(wearable.sleepHours * 60)
    : null;

  const hrv   = classifyBiometricDeviation(wearable.hrv, baseline?.hrvMs ?? null, phase, 'hrv');
  const rhr   = classifyBiometricDeviation(wearable.restingHR, baseline?.restingHR ?? null, phase, 'rhr');
  const sleep = classifyBiometricDeviation(sleepMinutes, baseline?.sleepMinutes ?? null, null, 'sleep');

  const phaseLabel =
    phase === 'shot'    ? 'Shot Day'      :
    phase === 'peak'    ? 'Peak Phase'    :
    phase === 'balance' ? 'Balance Phase' :
    phase === 'reset'   ? 'Reset Phase'   : null;

  let headerLabel = 'Biometric Intelligence';
  if (cycleDay != null && phase != null) {
    const classifications = [hrv.classification, rhr.classification, sleep.classification];
    const hasConcerning = classifications.includes('concerning');
    const hasUnusual = classifications.includes('mild_unusual');
    const statusNote = hasConcerning
      ? 'Unusual pattern detected'
      : hasUnusual ? 'Monitor closely'
      : 'Normal GLP-1 effects';
    const drugSuffix = glp1Drug ? ` · ${glp1Drug}` : '';
    headerLabel = `Day ${cycleDay}${drugSuffix} · ${phaseLabel ?? 'Active'} — ${statusNote}`;
  }

  return { hrv, rhr, sleep, cycleDay, shotPhase: phase, headerLabel };
}

// ─── Metabolic adaptation score ───────────────────────────────────────────────

function getISOWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
  return localDateStr(monday);
}

export function computeMetabolicAdaptationScore(
  activityLogs: ActivityLog[],
  weightLogs: WeightLog[],
  biometricHistory: Array<{ dateStr: string; restingHR: number | null }>,
): MetabolicAdaptationResult {
  const weekMap = new Map<string, { cals: number[]; steps: number[]; rhrValues: number[] }>();

  for (const log of activityLogs) {
    if (!log.date) continue;
    const week = getISOWeekLabel(log.date);
    if (!weekMap.has(week)) weekMap.set(week, { cals: [], steps: [], rhrValues: [] });
    const entry = weekMap.get(week)!;
    if (log.active_calories > 0) entry.cals.push(log.active_calories);
    if (log.steps > 0) entry.steps.push(log.steps);
  }

  for (const entry of biometricHistory) {
    if (!entry.restingHR) continue;
    const week = getISOWeekLabel(entry.dateStr);
    if (weekMap.has(week)) {
      weekMap.get(week)!.rhrValues.push(entry.restingHR);
    }
  }

  const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  if (sortedWeeks.length < 4) {
    return {
      hasEnoughData: false,
      calPerStepTrend: [],
      rhrTrend: [],
      weekLabels: [],
      plateauRisk: 'none',
      adaptationMessage: null,
      rhrImprovementBpm: null,
    };
  }

  type WeekData = { calPerStep: number | null; avgRhr: number | null; weekLabel: string };

  const weekData: WeekData[] = sortedWeeks.map(([weekLabel, data]) => {
    const totalCals  = data.cals.reduce((s, v) => s + v, 0);
    const totalSteps = data.steps.reduce((s, v) => s + v, 0);
    const calPerStep = totalSteps > 0 ? (totalCals / totalSteps) * 1000 : null;
    const avgRhr     = data.rhrValues.length > 0
      ? Math.round(data.rhrValues.reduce((s, v) => s + v, 0) / data.rhrValues.length)
      : null;
    return { calPerStep, avgRhr, weekLabel };
  });

  const calPerStepTrend = weekData.map(w => w.calPerStep ?? 0);
  const rhrTrend        = weekData.map(w => w.avgRhr ?? 0);
  const weekLabels      = weekData.map(w => {
    const d = new Date(w.weekLabel + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  // Plateau detection: recent 2 weeks vs prior 6-week average
  let plateauRisk: MetabolicAdaptationResult['plateauRisk'] = 'none';
  let adaptationMessage: string | null = null;

  const validCalSteps = calPerStepTrend.filter(v => v > 0);
  if (validCalSteps.length >= 8) {
    const recent    = validCalSteps.slice(-2);
    const prior     = validCalSteps.slice(-8, -2);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const priorAvg  = prior.reduce((s, v) => s + v, 0) / prior.length;
    const declinePct = priorAvg > 0 ? (priorAvg - recentAvg) / priorAvg : 0;

    // Weight stall: last 3+ weeks within 1 lb
    const recentWeights = weightLogs.slice(0, 21).map(l => l.weight_lbs);
    const weightStalled = recentWeights.length >= 3 &&
      Math.abs(recentWeights[0] - recentWeights[recentWeights.length - 1]) < 1.0;

    if (declinePct > 0.15 && weightStalled) {
      plateauRisk = 'detected';
      adaptationMessage = 'Metabolic adaptation detected — calorie efficiency is declining and weight has stalled. Consider adjusting calorie targets or increasing activity variety.';
    } else if (declinePct > 0.10) {
      plateauRisk = 'approaching';
      adaptationMessage = 'Early metabolic adaptation signal — calorie efficiency is declining. Watch for weight stalling.';
    }
  }

  // RHR improvement vs program start
  const firstRhr = weekData.find(w => w.avgRhr != null)?.avgRhr ?? null;
  const lastRhr  = [...weekData].reverse().find(w => w.avgRhr != null)?.avgRhr ?? null;
  const rhrImprovementBpm = (firstRhr != null && lastRhr != null && weekData.length >= 4)
    ? Math.round(firstRhr - lastRhr)
    : null;

  return {
    hasEnoughData: true,
    calPerStepTrend,
    rhrTrend,
    weekLabels,
    plateauRisk,
    adaptationMessage,
    rhrImprovementBpm,
  };
}

// ─── AI context builder ───────────────────────────────────────────────────────

export function buildCycleBiometricContext(
  result: CycleIntelligenceResult,
  cycleDay: number | null,
  shotPhase: ShotPhase | null,
  drug: string,
): string {
  const fmt = (m: MetricInterpretation, metricName: string, unit: string): string => {
    if (m.classification === 'insufficient_data') return `- ${metricName}: Insufficient data`;
    const actualStr   = m.actual != null   ? `${Math.round(m.actual)}${unit}` : 'N/A';
    const baselineStr = m.baseline != null ? `${Math.round(m.baseline)}${unit}` : 'N/A';
    const deltaStr    = m.delta != null    ? ` (${m.delta > 0 ? '+' : ''}${Math.round(m.delta)}${unit} vs baseline)` : '';
    const expectedStr = m.expectedDelta != null && m.expectedDelta !== 0
      ? `, expected ${m.expectedDelta > 0 ? '+' : ''}${Math.round(m.expectedDelta)}${unit} from GLP-1`
      : '';
    return `- ${metricName}: ${actualStr} vs baseline ${baselineStr}${deltaStr}${expectedStr} → ${m.label}`;
  };

  return `CYCLEIQ BIOMETRIC INTELLIGENCE:
- Drug: ${drug}
- Injection cycle: Day ${cycleDay ?? 'unknown'} · ${shotPhase ?? 'unknown'} phase
${fmt(result.hrv, 'HRV', 'ms')}
${fmt(result.rhr, 'Resting HR', ' bpm')}
${fmt(result.sleep, 'Sleep', ' min')}
- Summary: ${result.headerLabel}`.trim();
}
