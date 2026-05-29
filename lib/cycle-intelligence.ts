import {
  glp1HrvOffset, glp1RhrOffset,
  glp1HrvOffsetIntraday, glp1RhrOffsetIntraday,
  type ShotPhase, type IntradayPhase,
} from '@/constants/scoring';
import { pkConcentrationPct, DRUG_DOSE_APPETITE_RANGE } from '@/constants/drug-pk';
import type { Glp1Type } from '@/constants/user-profile';
import { localDateStr } from '@/lib/date-utils';

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
  isShotDay: boolean;
  isProjected: boolean;
};

// ─── Intraday Hour Block (daily drugs) ───────────────────────────────────────

export type HourBlock = {
  blockIndex: number;       // 0–5 (0 = dose time, 5 = last 4h window before next dose)
  startHour: number;        // 0, 4, 8, 12, 16, 20
  endHour: number;          // 4, 8, 12, 16, 20, 24
  label: string;            // e.g. "0–4h"
  appetiteSuppressionPct: number;
  pkConcentrationPct: number;
  isCurrent: boolean;
  phase: 'post_dose' | 'peak' | 'trough';
};

/**
 * Generates 6 four-hour blocks representing the intraday PK curve for daily drugs.
 * Uses the midpoint of each block (t = 2, 6, 10, 14, 18, 22h) to sample PK level.
 * @param doseTime HH:MM string of the daily dose time (e.g. "08:00")
 */
export function generateIntradayForecast(
  glp1Type: Glp1Type,
  atSteadyState: boolean,
  doseTime: string = '08:00',
  doseMg?: number | null,
): HourBlock[] {
  const [hh, mm] = doseTime.split(':').map(Number);
  const intervalH = 24;
  const now = new Date();
  const doseDate = new Date(now);
  doseDate.setHours(hh, mm ?? 0, 0, 0);
  // If dose time is in the future today, use yesterday's dose
  if (doseDate > now) doseDate.setDate(doseDate.getDate() - 1);
  const hoursSinceDoseNow = (now.getTime() - doseDate.getTime()) / 3600000;

  // Drug-specific Tmax for phase classification
  const tmaxMap: Record<string, number> = {
    liraglutide: 11, oral_semaglutide: 1, orforglipron: 8,
  };
  const tmax = tmaxMap[glp1Type] ?? 8;

  return Array.from({ length: 6 }, (_, i) => {
    const startHour = i * 4;
    const endHour   = startHour + 4;
    const midpoint  = startHour + 2; // sample PK at block midpoint

    const pkPct = Math.round(pkConcentrationPct(midpoint, glp1Type, atSteadyState, intervalH));
    const appetiteSuppressionPct = computeAppetiteSuppressionPct(pkPct, glp1Type, doseMg);
    const isCurrent = hoursSinceDoseNow >= startHour && hoursSinceDoseNow < endHour;

    let phase: HourBlock['phase'];
    if (midpoint < tmax * 0.5)       phase = 'post_dose';
    else if (midpoint < tmax * 2.0)  phase = 'peak';
    else                              phase = 'trough';

    return {
      blockIndex: i,
      startHour,
      endHour,
      label: `+${startHour}–${endHour}h`,
      appetiteSuppressionPct,
      pkConcentrationPct: pkPct,
      isCurrent,
      phase,
    };
  });
}

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
// Linear map: pkPct=0 → 5% suppression (near-baseline), pkPct=100 → ceiling (peak)
// Ceiling is dose-tier scaled; thresholds scale with ceiling so all four states
// remain reachable even on starter doses.

function computeSuppressionCeiling(glp1Type: Glp1Type, doseMg?: number | null): number {
  const range = DRUG_DOSE_APPETITE_RANGE[glp1Type];
  const dose = doseMg ?? range.maxDoseMg;
  const clamped = Math.max(range.minDoseMg, Math.min(range.maxDoseMg, dose));
  const tierFraction = (range.maxDoseMg - range.minDoseMg) > 0
    ? (clamped - range.minDoseMg) / (range.maxDoseMg - range.minDoseMg)
    : 1.0;
  return range.minSuppPct + tierFraction * (range.maxSuppPct - range.minSuppPct);
}

export function computeAppetiteSuppressionPct(
  pkPct: number,
  glp1Type: Glp1Type,
  doseMg?: number | null,
): number {
  const ceiling = computeSuppressionCeiling(glp1Type, doseMg);
  return Math.round(5 + (pkPct / 100) * (ceiling - 5));
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
  atSteadyState: boolean,
  doseMg?: number | null,
): ForecastDay[] {
  if (!lastInjectionDate) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDateStr(today);

  const lastInjDate = new Date(lastInjectionDate + 'T00:00:00');
  const nextShotDate = new Date(lastInjDate.getTime() + injFreqDays * 86400000);
  const shotDue = today >= nextShotDate;
  // Always anchor to real injection date so decay continues accurately when overdue
  const anchorDateStr = lastInjectionDate;
  const isProjected = shotDue;

  // Extend display to show continued decay when overdue (capped at 3× cycle)
  const overdueDays = shotDue
    ? Math.min(injFreqDays * 2, Math.round((today.getTime() - nextShotDate.getTime()) / 86400000))
    : 0;
  const displayDays = injFreqDays + overdueDays;
  const intervalH = injFreqDays * 24;
  return Array.from({ length: displayDays }, (_, i) => {
    const injDate = new Date(anchorDateStr + 'T00:00:00');
    const dayDate = new Date(injDate.getTime() + i * 86400000);
    const dateStr = localDateStr(dayDate);
    const tHours = (i + 1) * 24; // day 1 = 24h post-injection

    const pkPct = Math.round(pkConcentrationPct(tHours, glp1Type, atSteadyState, intervalH));
    const appetiteSuppressionPct = computeAppetiteSuppressionPct(pkPct, glp1Type, doseMg);
    const energyForecastPct = computeEnergyForecastPct(pkPct);

    // Thresholds expressed as fractions of the dose-scaled ceiling so users on
    // starter doses still cycle through all four gradient phases.
    const ceiling = computeSuppressionCeiling(glp1Type, doseMg);
    const state: ForecastDay['state'] =
      appetiteSuppressionPct >= ceiling * 0.85 ? 'peak_suppression'
      : appetiteSuppressionPct >= ceiling * 0.60 ? 'moderate_suppression'
      : appetiteSuppressionPct >= ceiling * 0.35 ? 'returning'
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
      isShotDay: i === 0 && dateStr === todayStr,
      isProjected,
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
  intradayPhase?: IntradayPhase | null,
  glp1Type?: string,
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
      expectedDelta = intradayPhase != null
        ? -glp1HrvOffsetIntraday(intradayPhase, glp1Type)
        : phase ? -glp1HrvOffset(phase) : 0;
      tolerance = HRV_TOLERANCE;
      higherIsBetter = true;
      break;
    case 'rhr':
      expectedDelta = intradayPhase != null
        ? -glp1RhrOffsetIntraday(intradayPhase, glp1Type)
        : phase ? -glp1RhrOffset(phase) : 0;
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
