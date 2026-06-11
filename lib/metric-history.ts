/**
 * Metric history + config — the single source of truth for the Apple-Health-style
 * Lifestyle summary cards and their per-metric detail screens.
 *
 * Nutrition + Activity metrics carry full daily history (rebuilt from the food/activity
 * logs already loaded into the log-store), so they get real sparklines + trend graphs.
 * Vitals have no historical source yet (HealthKit reads are "latest/today" only), so
 * they render value + status without a sparkline — see the Lifestyle tab in log.tsx.
 */

import { localDateStr } from '@/lib/date-utils';
import type { ActivityLog, FoodLog } from '@/stores/log-store';

// ─── Per-day aggregates ───────────────────────────────────────────────────────

export type DayNutrition = {
  protein: number; carbs: number; fat: number; calories: number; fiber: number;
  sodium_mg: number; sugar_g: number; saturated_fat_g: number; cholesterol_mg: number;
  trans_fat_g: number; poly_fat_g: number; mono_fat_g: number; potassium_mg: number;
  added_sugars_g: number; vitamin_a_mcg: number; vitamin_c_mg: number; vitamin_d_mcg: number;
  calcium_mg: number; iron_mg: number;
};
export type FoodByDate = Record<string, DayNutrition>;
export type ActivityByDate = Record<string, { steps: number; calories: number }>;

const emptyDay = (): DayNutrition => ({
  protein: 0, carbs: 0, fat: 0, calories: 0, fiber: 0,
  sodium_mg: 0, sugar_g: 0, saturated_fat_g: 0, cholesterol_mg: 0,
  trans_fat_g: 0, poly_fat_g: 0, mono_fat_g: 0, potassium_mg: 0,
  added_sugars_g: 0, vitamin_a_mcg: 0, vitamin_c_mg: 0, vitamin_d_mcg: 0,
  calcium_mg: 0, iron_mg: 0,
});

/** Bucket food logs by local calendar day. Mirrors the derivation in log.tsx. */
export function buildFoodByDate(foodLogs: FoodLog[]): FoodByDate {
  const map: FoodByDate = {};
  foodLogs.forEach((log) => {
    const date = localDateStr(new Date(log.logged_at));
    if (!map[date]) map[date] = emptyDay();
    map[date].protein += log.protein_g;
    map[date].carbs += log.carbs_g;
    map[date].fat += log.fat_g;
    map[date].calories += log.calories;
    map[date].fiber += log.fiber_g;
    map[date].sodium_mg += log.sodium_mg ?? 0;
    map[date].sugar_g += log.sugar_g ?? 0;
    map[date].saturated_fat_g += log.saturated_fat_g ?? 0;
    map[date].cholesterol_mg += log.cholesterol_mg ?? 0;
    map[date].trans_fat_g += log.trans_fat_g ?? 0;
    map[date].poly_fat_g += log.polyunsaturated_fat_g ?? 0;
    map[date].mono_fat_g += log.monounsaturated_fat_g ?? 0;
    map[date].potassium_mg += log.potassium_mg ?? 0;
    map[date].added_sugars_g += log.added_sugars_g ?? 0;
    map[date].vitamin_a_mcg += log.vitamin_a_mcg ?? 0;
    map[date].vitamin_c_mg += log.vitamin_c_mg ?? 0;
    map[date].vitamin_d_mcg += log.vitamin_d_mcg ?? 0;
    map[date].calcium_mg += log.calcium_mg ?? 0;
    map[date].iron_mg += log.iron_mg ?? 0;
  });
  return map;
}

/** Bucket activity logs by their stored date string. Mirrors the derivation in log.tsx. */
export function buildActivityByDate(activityLogs: ActivityLog[]): ActivityByDate {
  const map: ActivityByDate = {};
  activityLogs.forEach((log) => {
    if (!map[log.date]) map[log.date] = { steps: 0, calories: 0 };
    map[log.date].steps += log.steps ?? 0;
    map[log.date].calories += log.active_calories ?? 0;
  });
  return map;
}

// ─── Metric config ────────────────────────────────────────────────────────────

export type SummaryMetric = {
  id: string;
  label: string;
  unit: string;
  /** Per-metric color — stable identity across the app (see DESIGN.md). */
  color: string;
  /** Lucide icon name resolved via LucideIconByName. */
  icon: string;
  group: 'nutrition' | 'wellness' | 'micro';
  /** When true, the goal is to stay UNDER target (not used for the macro cards yet). */
  inverseGoal?: boolean;
  /** Pull this metric's value for a given day; null when there's no data that day. */
  getValue: (f: FoodByDate, a: ActivityByDate, d: string) => number | null;
  /** Short explainer shown on the detail screen. */
  about: string;
  /** Related education article id (constants/articles.ts) shown at the bottom of the detail. */
  articleId: string;
};

export const SUMMARY_METRICS: SummaryMetric[] = [
  {
    id: 'protein', label: 'Protein', unit: 'g', color: '#E0533A', icon: 'Beef', group: 'nutrition',
    getValue: (f, _a, d) => f[d]?.protein ?? null,
    about: 'Protein helps preserve lean muscle while you lose weight on a GLP-1, when appetite is lower and it is easy to fall short. Aim to spread it across the day.',
    articleId: 'protein-priority',
  },
  {
    id: 'carbs', label: 'Carbs', unit: 'g', color: '#5B8BF5', icon: 'Wheat', group: 'nutrition',
    getValue: (f, _a, d) => f[d]?.carbs ?? null,
    about: 'Carbohydrates are your body\'s main energy source. Favoring fiber-rich, slower-digesting carbs helps steady energy and blood sugar.',
    articleId: 'what-to-eat',
  },
  {
    id: 'fat', label: 'Fat', unit: 'g', color: '#F6CB45', icon: 'Droplet', group: 'nutrition',
    getValue: (f, _a, d) => f[d]?.fat ?? null,
    about: 'Dietary fat supports hormone health and helps absorb fat-soluble vitamins. Healthy fats in modest portions are easiest to digest while gastric emptying is slowed.',
    articleId: 'what-to-eat',
  },
  {
    id: 'calories', label: 'Calories', unit: 'cal', color: '#C084FC', icon: 'Flame', group: 'nutrition',
    getValue: (f, _a, d) => f[d]?.calories ?? null,
    about: 'Total energy intake. With reduced appetite, the quality of each calorie matters more, so focus on nutrient-dense, protein-forward meals.',
    articleId: 'what-to-eat',
  },
  {
    id: 'fiber', label: 'Fiber', unit: 'g', color: '#3AAE5A', icon: 'Leaf', group: 'nutrition',
    getValue: (f, _a, d) => f[d]?.fiber ?? null,
    about: 'Fiber supports digestion and helps with the constipation that is common early on GLP-1 therapy. Increase it gradually and pair with plenty of water.',
    articleId: 'what-to-eat',
  },
  {
    id: 'steps', label: 'Steps', unit: 'steps', color: '#F5972A', icon: 'Footprints', group: 'wellness',
    getValue: (_f, a, d) => a[d]?.steps ?? null,
    about: 'Daily steps are a simple measure of movement. Consistent walking supports cardiovascular health, mood, and digestion during treatment.',
    articleId: 'exercise-on-glp1s',
  },
  {
    id: 'active_cal', label: 'Calories Burned', unit: 'cal', color: '#E8960C', icon: 'Zap', group: 'wellness',
    getValue: (_f, a, d) => a[d]?.calories ?? null,
    about: 'Active calories reflect energy burned through movement. Pairing activity, especially resistance training, with adequate protein helps preserve muscle.',
    articleId: 'exercise-on-glp1s',
  },

  // ─── Micronutrients & extended fats ─────────────────────────────────────────
  {
    id: 'sodium', label: 'Sodium', unit: 'mg', color: '#FF6B6B', icon: 'Soup', group: 'micro', inverseGoal: true,
    getValue: (f, _a, d) => (f[d] ? f[d].sodium_mg : null),
    about: 'Sodium helps regulate fluid balance, but most people get too much. Staying under target supports healthy blood pressure.',
    articleId: 'what-to-eat',
  },
  {
    id: 'sugar', label: 'Sugar', unit: 'g', color: '#E879F9', icon: 'Candy', group: 'micro', inverseGoal: true,
    getValue: (f, _a, d) => (f[d] ? f[d].sugar_g : null),
    about: 'Total sugars, including natural and added. Keeping these moderate helps steady energy and blood sugar.',
    articleId: 'what-to-eat',
  },
  {
    id: 'added_sugars', label: 'Added Sugars', unit: 'g', color: '#F472B6', icon: 'Candy', group: 'micro', inverseGoal: true,
    getValue: (f, _a, d) => (f[d] ? f[d].added_sugars_g : null),
    about: 'Sugars added during processing. These add calories without nutrition, so keeping them low leaves room for protein and fiber.',
    articleId: 'what-to-eat',
  },
  {
    id: 'sat_fat', label: 'Sat Fat', unit: 'g', color: '#F59E0B', icon: 'Droplet', group: 'micro', inverseGoal: true,
    getValue: (f, _a, d) => (f[d] ? f[d].saturated_fat_g : null),
    about: 'Saturated fat in excess can raise cholesterol. Favoring unsaturated fats supports heart health.',
    articleId: 'what-to-eat',
  },
  {
    id: 'trans_fat', label: 'Trans Fat', unit: 'g', color: '#EF4444', icon: 'Droplet', group: 'micro', inverseGoal: true,
    getValue: (f, _a, d) => (f[d] ? f[d].trans_fat_g : null),
    about: 'Trans fats are best avoided entirely, since they raise bad cholesterol and lower good cholesterol.',
    articleId: 'what-to-eat',
  },
  {
    id: 'mono_fat', label: 'Mono Fat', unit: 'g', color: '#FBBF24', icon: 'Droplet', group: 'micro',
    getValue: (f, _a, d) => (f[d] ? f[d].mono_fat_g : null),
    about: 'Monounsaturated fats, from olive oil, avocado and nuts, support heart health and help absorb vitamins.',
    articleId: 'what-to-eat',
  },
  {
    id: 'poly_fat', label: 'Poly Fat', unit: 'g', color: '#FCD34D', icon: 'Droplet', group: 'micro',
    getValue: (f, _a, d) => (f[d] ? f[d].poly_fat_g : null),
    about: 'Polyunsaturated fats include omega-3 and omega-6, essential fats your body cannot make on its own.',
    articleId: 'what-to-eat',
  },
  {
    id: 'cholesterol', label: 'Cholesterol', unit: 'mg', color: '#A78BFA', icon: 'HeartPulse', group: 'micro', inverseGoal: true,
    getValue: (f, _a, d) => (f[d] ? f[d].cholesterol_mg : null),
    about: 'Dietary cholesterol. Keeping it within target supports cardiovascular health alongside healthy fats.',
    articleId: 'what-to-eat',
  },
  {
    id: 'potassium', label: 'Potassium', unit: 'mg', color: '#34D399', icon: 'Banana', group: 'micro',
    getValue: (f, _a, d) => (f[d] ? f[d].potassium_mg : null),
    about: 'Potassium balances sodium and supports muscle and nerve function. Many people fall short of the daily goal.',
    articleId: 'what-to-eat',
  },
  {
    id: 'calcium', label: 'Calcium', unit: 'mg', color: '#60A5FA', icon: 'Milk', group: 'micro',
    getValue: (f, _a, d) => (f[d] ? f[d].calcium_mg : null),
    about: 'Calcium keeps bones strong, especially important during weight loss, when bone density can decline.',
    articleId: 'what-to-eat',
  },
  {
    id: 'iron', label: 'Iron', unit: 'mg', color: '#F87171', icon: 'Bone', group: 'micro',
    getValue: (f, _a, d) => (f[d] ? f[d].iron_mg : null),
    about: 'Iron carries oxygen in your blood. Low intake can cause fatigue, which can compound lower energy on a GLP-1.',
    articleId: 'what-to-eat',
  },
  {
    id: 'vitamin_a', label: 'Vitamin A', unit: 'mcg', color: '#FB923C', icon: 'Carrot', group: 'micro',
    getValue: (f, _a, d) => (f[d] ? f[d].vitamin_a_mcg : null),
    about: 'Vitamin A supports vision, immunity and skin health. Found in colorful vegetables and dairy.',
    articleId: 'what-to-eat',
  },
  {
    id: 'vitamin_c', label: 'Vitamin C', unit: 'mg', color: '#4ADE80', icon: 'Citrus', group: 'micro',
    getValue: (f, _a, d) => (f[d] ? f[d].vitamin_c_mg : null),
    about: 'Vitamin C supports immunity and helps your body absorb iron from plant foods.',
    articleId: 'what-to-eat',
  },
  {
    id: 'vitamin_d', label: 'Vitamin D', unit: 'mcg', color: '#FACC15', icon: 'Sun', group: 'micro',
    getValue: (f, _a, d) => (f[d] ? f[d].vitamin_d_mcg : null),
    about: 'Vitamin D supports bone health, mood and immunity. Many people are low, especially with limited sun exposure.',
    articleId: 'what-to-eat',
  },
];

/** Fallback article when a metric has no specific match. */
export const GENERIC_ARTICLE_ID = 'how-glp1s-work';

export function getSummaryMetric(id: string): SummaryMetric | undefined {
  return SUMMARY_METRICS.find((m) => m.id === id);
}

// ─── Series + stats ───────────────────────────────────────────────────────────

/** Build the last `days` values (oldest → today) for a metric. */
export function buildSeries(
  metric: SummaryMetric,
  foodByDate: FoodByDate,
  activityByDate: ActivityByDate,
  todayStr: string,
  days: number,
): { dates: string[]; values: (number | null)[] } {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayStr + 'T12:00:00');
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const values = dates.map((d) => metric.getValue(foodByDate, activityByDate, d));
  return { dates, values };
}

export type SeriesStats = {
  hitRate: number;
  average: number;
  trendPct: number;
  bestStreak: number;
  count: number;
};

export function seriesStats(
  values: (number | null)[],
  target: number,
  inverseGoal = false,
): SeriesStats {
  const withData = values.filter((v): v is number => v != null);
  const onTarget = (v: number) => (inverseGoal ? Math.round(v) <= target : Math.round(v) >= target);
  const hitRate = withData.length ? withData.filter(onTarget).length / withData.length : 0;
  const average = withData.length ? withData.reduce((s, v) => s + v, 0) / withData.length : 0;
  const mid = Math.floor(withData.length / 2);
  const firstHalf = mid > 0 ? withData.slice(0, mid).reduce((s, v) => s + v, 0) / mid : 0;
  const secondHalf = mid > 0 ? withData.slice(mid).reduce((s, v) => s + v, 0) / (withData.length - mid) : 0;
  const trendPct = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;
  let cur = 0;
  let best = 0;
  values.forEach((v) => {
    if (v != null && onTarget(v)) { cur++; best = Math.max(best, cur); } else { cur = 0; }
  });
  return { hitRate, average, trendPct, bestStreak: best, count: withData.length };
}

/** Goal-relative descriptor + color for a card. pct = current / target * 100. */
export function goalStatus(pct: number, inverseGoal = false): { label: string; color: string } {
  if (inverseGoal) {
    if (pct <= 80) return { label: 'On track', color: '#27AE60' };
    if (pct <= 100) return { label: 'Near limit', color: '#9A9490' };
    return { label: 'Over target', color: '#E74C3C' };
  }
  if (pct >= 100) return { label: 'Goal reached', color: '#27AE60' };
  if (pct >= 60) return { label: 'On track', color: '#27AE60' };
  if (pct >= 30) return { label: 'Getting there', color: '#F39C12' };
  return { label: 'Below goal', color: '#9A9490' };
}
