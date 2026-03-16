// ─── Weekly Summary Data Aggregation ─────────────────────────────────────────
// Pure function — no side effects, fully testable.
// Computes a 7-day cycle recap ending yesterday (the completed injection cycle).

import type { DailyTargets } from '@/constants/scoring';
import type {
  FoodLog,
  WeightLog,
  ActivityLog,
  SideEffectLog,
  WeeklyCheckinRow,
  FoodNoiseLog,
} from '@/stores/log-store';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function dayStartMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeeklySummaryData {
  windowStart: string;   // 'yyyy-MM-dd', 7 days ago
  windowEnd: string;     // 'yyyy-MM-dd', yesterday
  weight: {
    start: number | null;   // lbs, oldest log in window
    end: number | null;     // lbs, most recent log in window
    delta: number | null;   // end - start (negative = loss)
  };
  nutrition: {
    avgCalories: number | null;
    avgProteinG: number | null;
    avgFiberG: number | null;
    avgWaterMl: number | null;
    caloriesTarget: number;
    proteinTarget: number;
    fiberTarget: number;
    waterTarget: number;
    daysLogged: number;
  };
  activity: {
    avgSteps: number | null;
    stepsTarget: number;
    activeDays: number;
    dayFlags: boolean[];   // 7 slots: slot 0 = windowStart, slot 6 = yesterday
  };
  checkins: {
    foodNoise: number | null;
    appetite: number | null;
    energyMood: number | null;
    giBurden: number | null;
    activityQuality: number | null;
    sleepQuality: number | null;
    mentalHealth: number | null;
  };
  sideEffects: {
    totalCount: number;
    topTypes: string[];   // up to 3 most frequent
  };
}

// ─── Input Shape ──────────────────────────────────────────────────────────────

export type LogsInput = {
  foodLogs: FoodLog[];
  weightLogs: WeightLog[];
  activityLogs: ActivityLog[];
  sideEffectLogs: SideEffectLog[];
  weeklyCheckins: Record<string, WeeklyCheckinRow[]>;
  foodNoiseLogs: FoodNoiseLog[];
};

// ─── Aggregation ──────────────────────────────────────────────────────────────

export function computeWeeklySummary(
  logs: LogsInput,
  targets: DailyTargets,
  waterByDate: Record<string, number>,
): WeeklySummaryData {
  const today      = new Date();
  const yesterday  = subDays(today, 1);
  const windowStart = subDays(today, 7);

  const windowStartStr = toDateStr(windowStart);
  const windowEndStr   = toDateStr(yesterday);

  const windowStartMs = dayStartMs(windowStart);
  const windowEndMs   = dayStartMs(yesterday) + 86400000 - 1; // inclusive end

  function tsInWindow(ts: string): boolean {
    try {
      const ms = new Date(ts).getTime();
      return ms >= windowStartMs && ms <= windowEndMs;
    } catch {
      return false;
    }
  }

  function dateStrInWindow(dateStr: string): boolean {
    return dateStr >= windowStartStr && dateStr <= windowEndStr;
  }

  // ── Weight ────────────────────────────────────────────────────────────────

  const weightInWindow = logs.weightLogs
    .filter(w => tsInWindow(w.logged_at))
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at));

  const weightStart = weightInWindow.length > 0 ? weightInWindow[0].weight_lbs : null;
  const weightEnd   = weightInWindow.length > 0 ? weightInWindow[weightInWindow.length - 1].weight_lbs : null;
  const weightDelta = weightStart != null && weightEnd != null ? weightEnd - weightStart : null;

  // ── Nutrition ─────────────────────────────────────────────────────────────

  const foodByDate = new Map<string, FoodLog[]>();
  for (const fl of logs.foodLogs) {
    if (!tsInWindow(fl.logged_at)) continue;
    const dateStr = fl.logged_at.slice(0, 10);
    if (!foodByDate.has(dateStr)) foodByDate.set(dateStr, []);
    foodByDate.get(dateStr)!.push(fl);
  }

  const daysLogged = foodByDate.size;

  let totalCalories = 0, totalProtein = 0, totalFiber = 0;
  for (const dayFoods of foodByDate.values()) {
    for (const fl of dayFoods) {
      totalCalories += fl.calories ?? 0;
      totalProtein  += fl.protein_g ?? 0;
      totalFiber    += fl.fiber_g ?? 0;
    }
  }

  const avgCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : null;
  const avgProteinG = daysLogged > 0 ? Math.round(totalProtein  / daysLogged) : null;
  const avgFiberG   = daysLogged > 0 ? Math.round(totalFiber    / daysLogged) : null;

  // Water from AsyncStorage keys
  const waterValues = Object.entries(waterByDate)
    .filter(([k]) => k >= windowStartStr && k <= windowEndStr)
    .map(([, v]) => v)
    .filter(v => v > 0);
  const avgWaterMl = waterValues.length > 0
    ? Math.round(waterValues.reduce((a, b) => a + b, 0) / waterValues.length)
    : null;

  // ── Activity ──────────────────────────────────────────────────────────────

  const actInWindow = logs.activityLogs.filter(a => dateStrInWindow(a.date));

  const stepsByDate = new Map<string, number>();
  for (const a of actInWindow) {
    stepsByDate.set(a.date, (stepsByDate.get(a.date) ?? 0) + (a.steps ?? 0));
  }

  const activeDays = [...stepsByDate.values()].filter(s => s > 0).length;
  const allStepsValues = [...stepsByDate.values()];
  const avgSteps = allStepsValues.length > 0
    ? Math.round(allStepsValues.reduce((a, b) => a + b, 0) / allStepsValues.length)
    : null;

  // 7-slot day flags (slot 0 = windowStart, slot 6 = yesterday)
  const dayFlags: boolean[] = Array(7).fill(false);
  for (let i = 0; i < 7; i++) {
    const dateStr = toDateStr(subDays(today, 7 - i));
    dayFlags[i] = (stepsByDate.get(dateStr) ?? 0) > 0;
  }

  // ── Check-ins (most recent within window per type) ────────────────────────

  function latestCheckinScore(type: string): number | null {
    if (type === 'food_noise') {
      const recent = logs.foodNoiseLogs.find(fn => tsInWindow(fn.logged_at));
      return recent ? recent.score : null;
    }
    const rows = logs.weeklyCheckins[type] ?? [];
    const recent = rows.find(r => tsInWindow((r as any).logged_at ?? ''));
    return recent ? (recent as any).score : null;
  }

  const checkins = {
    foodNoise:       latestCheckinScore('food_noise'),
    appetite:        latestCheckinScore('appetite'),
    energyMood:      latestCheckinScore('energy_mood'),
    giBurden:        latestCheckinScore('gi_burden'),
    activityQuality: latestCheckinScore('activity_quality'),
    sleepQuality:    latestCheckinScore('sleep_quality'),
    mentalHealth:    latestCheckinScore('mental_health'),
  };

  // ── Side Effects ──────────────────────────────────────────────────────────

  const seInWindow = logs.sideEffectLogs.filter(se => tsInWindow(se.logged_at));
  const seTypeCounts = new Map<string, number>();
  for (const se of seInWindow) {
    seTypeCounts.set(se.effect_type, (seTypeCounts.get(se.effect_type) ?? 0) + 1);
  }
  const topTypes = [...seTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  return {
    windowStart: windowStartStr,
    windowEnd:   windowEndStr,
    weight: { start: weightStart, end: weightEnd, delta: weightDelta },
    nutrition: {
      avgCalories,
      avgProteinG,
      avgFiberG,
      avgWaterMl,
      caloriesTarget: targets.caloriesTarget,
      proteinTarget:  targets.proteinG,
      fiberTarget:    targets.fiberG,
      waterTarget:    targets.waterMl,
      daysLogged,
    },
    activity: {
      avgSteps,
      stepsTarget: targets.steps,
      activeDays,
      dayFlags,
    },
    checkins,
    sideEffects: {
      totalCount: seInWindow.length,
      topTypes,
    },
  };
}
