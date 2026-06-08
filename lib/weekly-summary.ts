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
    // Per-day series (7 slots, slot 0 = windowStart). null = nothing logged that
    // day, so charts render an empty column rather than a fake zero.
    caloriesByDay: (number | null)[];
    proteinByDay: (number | null)[];
    fiberByDay: (number | null)[];
    waterByDay: (number | null)[];   // ml; null on days with no water logged
  };
  activity: {
    avgSteps: number | null;
    stepsTarget: number;
    activeDays: number;
    dayFlags: boolean[];   // 7 slots: slot 0 = windowStart, slot 6 = yesterday
    stepsByDay: number[];  // 7 slots; 0 when no steps logged that day
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
    countByDay: number[];                  // 7 slots; logs per day for the trend line
    typeCounts: Record<string, number>;    // full per-type tally for the week-over-week log
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
  /**
   * Explicit week window to summarize. When omitted, defaults to the rolling
   * 7-day window ending yesterday. Pass a program-week window (from
   * lib/program-week.ts) to produce a frozen, week-keyed snapshot.
   */
  window?: { windowStart: string; windowEnd: string },
): WeeklySummaryData {
  let windowStartStr: string;
  let windowEndStr: string;
  if (window) {
    windowStartStr = window.windowStart;
    windowEndStr   = window.windowEnd;
  } else {
    const today = new Date();
    windowStartStr = toDateStr(subDays(today, 7));
    windowEndStr   = toDateStr(subDays(today, 1));
  }

  const windowStartMs = new Date(`${windowStartStr}T00:00:00`).getTime();
  const windowEndMs   = new Date(`${windowEndStr}T00:00:00`).getTime() + 86400000 - 1; // inclusive end

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

  // Slot 0..6 for a date string, where slot 0 = windowStart. Out-of-window → -1.
  function dayIndex(dateStr: string): number {
    const ms = new Date(`${dateStr}T00:00:00`).getTime();
    const i = Math.round((ms - windowStartMs) / 86400000);
    return i >= 0 && i < 7 ? i : -1;
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

  // Per-day calorie/protein/fiber series (null on days with no food logged).
  const caloriesByDay: (number | null)[] = Array(7).fill(null);
  const proteinByDay:  (number | null)[] = Array(7).fill(null);
  const fiberByDay:    (number | null)[] = Array(7).fill(null);
  for (const [dateStr, dayFoods] of foodByDate) {
    const idx = dayIndex(dateStr);
    if (idx < 0) continue;
    caloriesByDay[idx] = Math.round(dayFoods.reduce((a, fl) => a + (fl.calories  ?? 0), 0));
    proteinByDay[idx]  = Math.round(dayFoods.reduce((a, fl) => a + (fl.protein_g ?? 0), 0));
    fiberByDay[idx]    = Math.round(dayFoods.reduce((a, fl) => a + (fl.fiber_g   ?? 0), 0));
  }

  // Water from AsyncStorage keys
  const waterValues = Object.entries(waterByDate)
    .filter(([k]) => k >= windowStartStr && k <= windowEndStr)
    .map(([, v]) => v)
    .filter(v => v > 0);
  const avgWaterMl = waterValues.length > 0
    ? Math.round(waterValues.reduce((a, b) => a + b, 0) / waterValues.length)
    : null;

  // Per-day water (ml); null on days with no water logged.
  const waterByDay: (number | null)[] = Array(7).fill(null);
  for (const [dateStr, ml] of Object.entries(waterByDate)) {
    const idx = dayIndex(dateStr);
    if (idx >= 0 && ml > 0) waterByDay[idx] = Math.round(ml);
  }

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

  // 7-slot day flags + step counts (slot 0 = windowStart, slot 6 = windowEnd)
  const dayFlags: boolean[] = Array(7).fill(false);
  const stepsByDay: number[] = Array(7).fill(0);
  for (let i = 0; i < 7; i++) {
    const dateStr = toDateStr(new Date(windowStartMs + i * 86400000));
    const steps = stepsByDate.get(dateStr) ?? 0;
    stepsByDay[i] = steps;
    dayFlags[i] = steps > 0;
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
  const seCountByDay: number[] = Array(7).fill(0);
  for (const se of seInWindow) {
    seTypeCounts.set(se.effect_type, (seTypeCounts.get(se.effect_type) ?? 0) + 1);
    const idx = dayIndex(se.logged_at.slice(0, 10));
    if (idx >= 0) seCountByDay[idx] += 1;
  }
  const topTypes = [...seTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
  const typeCounts: Record<string, number> = Object.fromEntries(seTypeCounts);

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
      caloriesByDay,
      proteinByDay,
      fiberByDay,
      waterByDay,
    },
    activity: {
      avgSteps,
      stepsTarget: targets.steps,
      activeDays,
      dayFlags,
      stepsByDay,
    },
    checkins,
    sideEffects: {
      totalCount: seInWindow.length,
      topTypes,
      countByDay: seCountByDay,
      typeCounts,
    },
  };
}
