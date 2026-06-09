/**
 * Reconstructs an hourly energy timeline for the last 24 hours by replaying
 * timestamped food/water/side-effect logs through computeEnergyBank().
 * Uses a fixed rolling 24h window (ending "now") so the tile always has a
 * full curve to draw — no more sparse early-morning collapse to the battery.
 */
import {
  computeEnergyBank,
  type DailyActuals,
  type DailyTargets,
  type WearableData,
  type ShotPhase,
} from '@/constants/scoring';
import { pkConcentrationPct } from '@/constants/drug-pk';
import type { Glp1Type } from '@/constants/user-profile';

export type EnergyTimelinePoint = {
  time: Date;
  score: number;
  label: string;
  hourLabel: string;
};

type FoodEntry = { logged_at: string; calories: number; protein_g: number; fiber_g: number };
type SideEffectEntry = { logged_at: string; severity: number; effect_type: string };

type TimelineParams = {
  wearable: Partial<WearableData>;
  targets: DailyTargets;
  phase: ShotPhase;
  seBurden: number;
  fatigueBurden: number;
  baseline: { hrvMs: number | null; restingHR: number | null; sleepMinutes: number | null; sampleCount: number } | null;
  /** Hours since last injection at the current moment */
  pkHoursSinceInjection: number;
  glp1Type: Glp1Type | null;
  injectionFrequencyDays: number;
  todayFoodLogs: FoodEntry[];
  todayWaterMl: number;
  todaySideEffectLogs: SideEffectEntry[];
  /** When false (between medications), drug-related factors are excluded. */
  isOnTreatment?: boolean;
};

function formatHourLabel(h: number): string {
  if (h === 0) return '12AM';
  if (h < 12) return `${h}AM`;
  if (h === 12) return '12PM';
  return `${h - 12}PM`;
}

export function buildEnergyTimeline(params: TimelineParams): EnergyTimelinePoint[] {
  const {
    wearable, targets, phase, seBurden, fatigueBurden, baseline,
    pkHoursSinceInjection, glp1Type, injectionFrequencyDays,
    todayFoodLogs, todayWaterMl, todaySideEffectLogs,
    isOnTreatment = true,
  } = params;

  const WINDOW_HOURS = 24;
  const HOUR_MS = 3_600_000;

  const now = new Date();
  const nowMs = now.getTime();
  const intervalH = injectionFrequencyDays * 24;

  // Top of the current hour — every point except "now" lands on an hour mark.
  const topOfHour = new Date(now);
  topOfHour.setMinutes(0, 0, 0);

  // Local midnight, used to scale water accrual (water is a today-only total).
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const elapsedTodayMs = Math.max(1, nowMs - startOfToday.getTime());

  // Parse food log timestamps once for cumulative replay across the window.
  const foodWithTs = todayFoodLogs.map(f => ({ ...f, ts: new Date(f.logged_at).getTime() }));

  // Walk back a fixed 24h window so there is always a full curve to draw.
  const points: EnergyTimelinePoint[] = [];

  for (let i = WINDOW_HOURS; i >= 0; i--) {
    // i === 0 is "now" (keeps live minutes); earlier points sit on hour marks.
    const pointTime = i === 0 ? now : new Date(topOfHour.getTime() - i * HOUR_MS);
    const pointMs = pointTime.getTime();

    // Cumulative food up to this timestamp (absolute, so it survives midnight).
    const foodBefore = foodWithTs.filter(f => f.ts <= pointMs);
    const cumCalories = foodBefore.reduce((s, f) => s + f.calories, 0);
    const cumProtein = foodBefore.reduce((s, f) => s + f.protein_g, 0);
    const cumFiber = foodBefore.reduce((s, f) => s + f.fiber_g, 0);

    // Water accrues linearly across today; 0 for the overnight portion.
    const waterFrac = Math.max(0, Math.min(1, (pointMs - startOfToday.getTime()) / elapsedTodayMs));
    const cumWater = todayWaterMl * waterFrac;

    // PK concentration at this specific point in time.
    const hoursAgo = (nowMs - pointMs) / HOUR_MS;
    const pkAtPoint = pkHoursSinceInjection - hoursAgo;
    const pkPct = isOnTreatment && glp1Type && pkAtPoint > 0
      ? pkConcentrationPct(pkAtPoint, glp1Type, true, intervalH)
      : null;

    const actuals: DailyActuals = {
      proteinG: cumProtein,
      waterMl: cumWater,
      fiberG: cumFiber,
      steps: 0,
      caloriesKcal: cumCalories,
      injectionLogged: false,
      exerciseMinutes: 0,
      workoutMinutes: 0,
      workoutCalories: 0,
      flightsClimbed: 0,
    };

    const result = computeEnergyBank(
      wearable, actuals, targets, phase, seBurden, pkPct, fatigueBurden, baseline, isOnTreatment,
    );

    points.push({
      time: pointTime,
      score: result.score,
      label: result.label,
      hourLabel: i === 0 ? 'Now' : formatHourLabel(pointTime.getHours()),
    });
  }

  return points;
}
