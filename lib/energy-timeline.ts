/**
 * Reconstructs an hourly energy timeline for the current day by replaying
 * timestamped food/water/side-effect logs through computeEnergyBank().
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
};

function formatHourLabel(h: number): string {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

export function buildEnergyTimeline(params: TimelineParams): EnergyTimelinePoint[] {
  const {
    wearable, targets, phase, seBurden, fatigueBurden, baseline,
    pkHoursSinceInjection, glp1Type, injectionFrequencyDays,
    todayFoodLogs, todayWaterMl, todaySideEffectLogs,
  } = params;

  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;

  // Estimate wake hour from sleep duration, or default to 6am
  const sleepMin = wearable.sleepMinutes;
  const sleepHrs = sleepMin != null ? sleepMin / 60 : 8;
  const wakeHour = Math.max(0, Math.floor(currentHour - (24 - sleepHrs)));
  const startHour = Math.max(0, Math.min(wakeHour, Math.floor(currentHour)));

  // Parse food log hours (local time)
  const foodWithHour = todayFoodLogs.map(f => {
    const d = new Date(f.logged_at);
    return { ...f, hour: d.getHours() + d.getMinutes() / 60 };
  });

  // Build hourly time points from wake to now
  const points: EnergyTimelinePoint[] = [];
  const endHour = Math.floor(currentHour);
  const intervalH = injectionFrequencyDays * 24;

  for (let h = startHour; h <= endHour; h++) {
    const pointTime = new Date(now);
    pointTime.setHours(h, 0, 0, 0);

    // Cumulative food up to this hour
    const foodBefore = foodWithHour.filter(f => f.hour <= h);
    const cumCalories = foodBefore.reduce((s, f) => s + f.calories, 0);
    const cumProtein = foodBefore.reduce((s, f) => s + f.protein_g, 0);
    const cumFiber = foodBefore.reduce((s, f) => s + f.fiber_g, 0);

    // Proportional water: distribute evenly across waking hours
    const wakingHoursElapsed = Math.max(0, h - startHour);
    const totalWakingHours = Math.max(1, endHour - startHour);
    const cumWater = todayWaterMl * (wakingHoursElapsed / totalWakingHours);

    // PK concentration at this specific hour
    // pkHoursSinceInjection is "now", so adjust backward for earlier hours
    const hoursAgo = currentHour - h;
    const pkAtPoint = pkHoursSinceInjection - hoursAgo;
    const pkPct = glp1Type && pkAtPoint > 0
      ? pkConcentrationPct(pkAtPoint, glp1Type, true, intervalH)
      : null;

    const actuals: DailyActuals = {
      proteinG: cumProtein,
      waterMl: cumWater,
      fiberG: cumFiber,
      steps: 0,
      caloriesKcal: cumCalories,
      injectionLogged: false,
    };

    const result = computeEnergyBank(
      wearable, actuals, targets, phase, seBurden, pkPct, fatigueBurden, baseline,
    );

    points.push({
      time: pointTime,
      score: result.score,
      label: result.label,
      hourLabel: h === endHour ? 'Now' : formatHourLabel(h),
    });
  }

  return points;
}
