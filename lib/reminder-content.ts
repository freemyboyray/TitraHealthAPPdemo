/**
 * Pure functions that generate personalized reminder content based on store snapshots.
 * Returns { title, body, deepLink } or null (suppress the reminder).
 *
 * Priority: Suppress > Streak/Gap > Phase-aware > Contextual > Default fallback
 */

import type {
  FoodLog,
  WeightLog,
  SideEffectLog,
  InjectionLog,
  ActivityLog,
  ProfileRow,
  UserGoalsRow,
} from '../stores/log-store';
import { getInjectionPhase, type InjectionPhase } from '../stores/insights-store';
import { isOralDrug, doseNoun } from '../constants/drug-pk';
import type { Glp1Type } from '../constants/user-profile';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReminderContent = {
  title: string;
  body: string;
  deepLink: string;
} | null;

export type EngagementTier = 'engaged' | 'slipping' | 'dormant';

export type ReminderContext = {
  foodLogs: FoodLog[];
  weightLogs: WeightLog[];
  sideEffectLogs: SideEffectLog[];
  injectionLogs: InjectionLog[];
  activityLogs: ActivityLog[];
  profile: ProfileRow | null;
  userGoals: UserGoalsRow | null;
  todayProteinG?: number;
  /** Coarse engagement signal, set by syncNotifications to drive copy tone / back-off. */
  tier?: EngagementTier;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function hasLoggedToday(logs: { logged_at?: string | null; date?: string }[]): boolean {
  const today = todayStr();
  return logs.some(
    (l) => (l.logged_at?.startsWith(today)) || (l as { date?: string }).date === today,
  );
}

/** Count consecutive days with at least one log entry, going backwards from yesterday. */
function countStreak(logs: { logged_at?: string | null; date?: string }[]): number {
  const dates = new Set(
    logs.map((l) => (l.logged_at?.split('T')[0]) ?? (l as { date?: string }).date).filter(Boolean),
  );
  let streak = 0;
  const d = new Date();
  // Start from today (include today if logged)
  for (let i = 0; i < 365; i++) {
    const ds = d.toISOString().split('T')[0];
    if (dates.has(ds)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** Days since last log entry. Returns Infinity if no logs. */
function daysSinceLastLog(logs: { logged_at?: string | null; date?: string }[]): number {
  if (logs.length === 0) return Infinity;
  const dates = logs
    .map((l) => (l.logged_at?.split('T')[0]) ?? (l as { date?: string }).date)
    .filter(Boolean) as string[];
  if (dates.length === 0) return Infinity;
  dates.sort((a, b) => b.localeCompare(a));
  const lastMs = new Date(dates[0] + 'T00:00:00').getTime();
  return Math.floor((Date.now() - lastMs) / 86400000);
}

function weeksOnCurrentDose(profile: ProfileRow | null): number | null {
  if (!profile?.dose_start_date) return null;
  const ms = Date.now() - new Date(profile.dose_start_date + 'T00:00:00').getTime();
  return Math.floor(ms / (7 * 86400000));
}

function drugLabel(profile: ProfileRow | null): string {
  return profile?.medication_brand ?? profile?.medication_type ?? 'GLP-1';
}

function doseLabel(profile: ProfileRow | null): string {
  const brand = drugLabel(profile);
  if (profile?.dose_mg) return `${brand} ${profile.dose_mg}mg`;
  return brand;
}

function weightProgress(weightLogs: WeightLog[], profile: ProfileRow | null): string | null {
  if (!profile?.start_weight_lbs || weightLogs.length === 0) return null;
  const latest = weightLogs[0]; // assumed sorted desc
  const lbs = (latest as { weight_lbs?: number }).weight_lbs;
  if (!lbs) return null;
  const diff = profile.start_weight_lbs - lbs;
  if (diff <= 0) return null;
  return `${diff.toFixed(1)} lbs`;
}

// ─── Variety + engagement helpers ─────────────────────────────────────────────

/** Day-of-year (0–365). Stable within a calendar day; advances daily. */
function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

/**
 * Deterministic daily rotation through a pool — same result all day, different copy
 * day to day. `salt` de-syncs different slots so two slots don't rotate in lockstep.
 */
function pickVariant<T>(pool: T[], salt = 0): T {
  return pool[(dayOfYear() + salt) % pool.length];
}

/**
 * Coarse engagement signal from how recently the user logged anything. Drives
 * anti-fatigue back-off (in syncNotifications) and copy tone. A brand-new user with
 * no logs is treated as `slipping` (gentle), never `dormant`.
 */
export function getEngagementTier(ctx: ReminderContext): EngagementTier {
  const recent = Math.min(
    daysSinceLastLog(ctx.foodLogs),
    daysSinceLastLog(ctx.weightLogs),
    daysSinceLastLog(ctx.sideEffectLogs),
    daysSinceLastLog(ctx.activityLogs),
  );
  if (!isFinite(recent)) return 'slipping';
  if (recent <= 2) return 'engaged';
  if (recent <= 6) return 'slipping';
  return 'dormant';
}

// Rotation pools for each slot's default copy. Data-driven branches
// (protein / streak / gap / phase) already vary and are left untouched; these cover
// the terminal fallback so a disengaged user doesn't see the identical line every day.
const MEALS_MORNING_VARIANTS = [
  { title: 'Log Your Breakfast', body: 'Tap to log what you had this morning.' },
  { title: 'Breakfast Time', body: 'A quick log keeps your day on track.' },
  { title: 'Morning Fuel', body: 'What did you have this morning? Log it in seconds.' },
  { title: 'Start the Day Logged', body: 'Capture breakfast while it’s fresh.' },
];

const MEALS_EVENING_VARIANTS = [
  { title: 'Log Your Dinner', body: 'End the day strong. Log your evening meal.' },
  { title: 'Dinner Check-In', body: 'A few taps to round out today’s log.' },
  { title: 'Evening Meal', body: 'Log dinner to keep your day complete.' },
  { title: 'Wind Down Logged', body: 'What’s for dinner tonight? Log it before bed.' },
];

const WEIGHT_MORNING_VARIANTS = [
  { title: 'Morning Weigh-In', body: 'Log your weight to track your progress.' },
  { title: 'Step on the Scale', body: 'A morning weigh-in keeps your trend honest.' },
  { title: 'Daily Weigh-In', body: 'Quick weight log, best taken first thing.' },
  { title: 'Track Your Trend', body: 'Log today’s weight to see the bigger picture.' },
];

const SIDE_EFFECTS_VARIANTS = [
  { title: 'How Are You Feeling?', body: 'Log any side effects from today.' },
  { title: 'Symptom Check-In', body: 'Noticed anything today? A quick log helps spot patterns.' },
  { title: 'Daily Wellness Note', body: 'How did your body feel today? Jot it down.' },
  { title: 'Side Effect Tracker', body: 'Logging how you feel builds a clearer picture over time.' },
];

const DAILY_PLAN_VARIANTS = [
  { title: 'Your Daily Focus', body: 'Open TitraHealth to see today’s priorities.' },
  { title: 'Today’s Plan', body: 'A quick look at what matters today.' },
  { title: 'Start Your Day', body: 'Check your focus areas for today.' },
  { title: 'Daily Check-In', body: 'See where to put your energy today.' },
];

// Low-pressure copy for users who have gone quiet (dormant tier).
const DAILY_PLAN_DORMANT_VARIANTS = [
  { title: 'No pressure', body: 'We’re here whenever you’re ready to pick back up.' },
  { title: 'Still here for you', body: 'One small log is enough to get going again.' },
  { title: ‘Whenever you’re ready’, body: ‘No rush. Your progress is waiting when you are.’ },
];

// ─── Content builders per slot ───────────────────────────────────────────────

export function getMealsMorningContent(ctx: ReminderContext): ReminderContent {
  const today = todayStr();
  const todayFoods = ctx.foodLogs.filter((f) => f.logged_at?.startsWith(today));

  // Suppress if already logged a morning meal
  const hasMorningMeal = todayFoods.some((f) => {
    const hour = f.logged_at ? new Date(f.logged_at).getHours() : 12;
    return hour < 12;
  });
  if (hasMorningMeal) return null;

  // Contextual: yesterday's protein
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const ydStr = yesterday.toISOString().split('T')[0];
  const ydFoods = ctx.foodLogs.filter((f) => f.logged_at?.startsWith(ydStr));
  const ydProtein = ydFoods.reduce((s, f) => s + (f.protein_g ?? 0), 0);
  const proteinTarget = ctx.userGoals?.daily_protein_g_target ?? 0;

  if (ydProtein > 0 && proteinTarget > 0) {
    const gap = proteinTarget - ydProtein;
    if (gap > 20) {
      return {
        title: 'Start Strong This Morning',
        body: `You had ${Math.round(ydProtein)}g protein yesterday. Aim for a high-protein breakfast to close the gap.`,
        deepLink: '/entry/log-food',
      };
    }
    if (ydProtein >= proteinTarget) {
      return {
        title: 'Great Protein Day Yesterday!',
        body: `${Math.round(ydProtein)}g. Keep it going. Log your breakfast to stay on track.`,
        deepLink: '/entry/log-food',
      };
    }
  }

  // Streak
  const streak = countStreak(ctx.foodLogs);
  if (streak >= 3) {
    return {
      title: 'Log Your Breakfast',
      body: `${streak}-day food logging streak! Don't break the chain!`,
      deepLink: '/entry/log-food',
    };
  }

  // Gap
  const gap = daysSinceLastLog(ctx.foodLogs);
  if (gap >= 2 && gap < 30) {
    return {
      title: 'Log Your Breakfast',
      body: `It's been ${gap} days since your last food log. One tap to get back on track.`,
      deepLink: '/entry/log-food',
    };
  }

  return { ...pickVariant(MEALS_MORNING_VARIANTS, 0), deepLink: '/entry/log-food' };
}

export function getMealsEveningContent(ctx: ReminderContext): ReminderContent {
  const today = todayStr();
  const todayFoods = ctx.foodLogs.filter((f) => f.logged_at?.startsWith(today));

  // Suppress if already logged an evening meal
  const hasEveningMeal = todayFoods.some((f) => {
    const hour = f.logged_at ? new Date(f.logged_at).getHours() : 12;
    return hour >= 17;
  });
  if (hasEveningMeal) return null;

  // Contextual: today's protein so far
  const todayProtein = ctx.todayProteinG ?? todayFoods.reduce((s, f) => s + (f.protein_g ?? 0), 0);
  const proteinTarget = ctx.userGoals?.daily_protein_g_target ?? 0;

  if (todayProtein > 0 && proteinTarget > 0) {
    const remaining = proteinTarget - todayProtein;
    if (remaining > 10) {
      return {
        title: 'Evening Meal Time',
        body: `You're at ${Math.round(todayProtein)}g protein today. Aim for ${Math.round(remaining)}g more at dinner.`,
        deepLink: '/entry/log-food',
      };
    }
    if (remaining <= 10) {
      return {
        title: 'You Crushed Protein Today',
        body: `${Math.round(todayProtein)}g protein. Log dinner to cap off a strong day.`,
        deepLink: '/entry/log-food',
      };
    }
  }

  // Phase-aware: waning phase appetite warning (only for medication users)
  if (ctx.profile?.medication_brand && ctx.injectionLogs.length > 0) {
    const phase = getInjectionPhase(ctx.injectionLogs, ctx.profile);
    if (phase === 'Waning Phase') {
      return {
        title: 'Appetite May Be Returning',
        body: `You're in the waning phase of ${drugLabel(ctx.profile)}. Log dinner to stay mindful.`,
        deepLink: '/entry/log-food',
      };
    }
  }

  return { ...pickVariant(MEALS_EVENING_VARIANTS, 1), deepLink: '/entry/log-food' };
}

export function getWeightMorningContent(ctx: ReminderContext): ReminderContent {
  // Suppress if already logged today
  if (hasLoggedToday(ctx.weightLogs)) return null;

  // Progress callout
  const progress = weightProgress(ctx.weightLogs, ctx.profile);
  if (progress) {
    return {
      title: 'Morning Weigh-In',
      body: `Down ${progress} from your start. Keep tracking to see your trend.`,
      deepLink: '/entry/log-weight',
    };
  }

  // Streak
  const streak = countStreak(ctx.weightLogs);
  if (streak >= 3) {
    return {
      title: 'Morning Weigh-In',
      body: `${streak}-day weigh-in streak. Consistency is key!`,
      deepLink: '/entry/log-weight',
    };
  }

  // Gap
  const gap = daysSinceLastLog(ctx.weightLogs);
  if (gap >= 2 && gap < 30) {
    return {
      title: 'Morning Weigh-In',
      body: `Haven't logged weight in ${gap} days. One tap to get back on track.`,
      deepLink: '/entry/log-weight',
    };
  }

  return { ...pickVariant(WEIGHT_MORNING_VARIANTS, 2), deepLink: '/entry/log-weight' };
}

export function getSideEffectsEveningContent(ctx: ReminderContext): ReminderContent {
  // Suppress if already logged today
  if (hasLoggedToday(ctx.sideEffectLogs)) return null;

  const phase = getInjectionPhase(ctx.injectionLogs, ctx.profile);
  const weeks = weeksOnCurrentDose(ctx.profile);

  // Phase-aware
  if (phase === 'Peak Phase') {
    return {
      title: 'Peak Phase Check-In',
      body: `${doseLabel(ctx.profile)} is peaking. Log any symptoms while they're fresh.`,
      deepLink: '/entry/side-effects',
    };
  }

  if (phase === 'Shot Day') {
    const oral = isOralDrug(ctx.profile?.medication_type as Glp1Type | undefined);
    return {
      title: oral ? 'Dose Day Check-In' : 'Injection Day Check-In',
      body: `How are you feeling after your ${oral ? 'dose' : 'shot'}? Log any side effects.`,
      deepLink: '/entry/side-effects',
    };
  }

  // Dose-week aware
  if (weeks !== null && weeks <= 3) {
    return {
      title: 'How Are You Feeling?',
      body: `Week ${weeks + 1} on ${doseLabel(ctx.profile)}. GI symptoms often shift around now. Any changes?`,
      deepLink: '/entry/side-effects',
    };
  }

  // Recent severity trend
  const last7 = ctx.sideEffectLogs.filter(
    (se) => Date.now() - new Date(se.logged_at).getTime() < 7 * 86400000,
  );
  if (last7.length > 0) {
    const avgSeverity = last7.reduce((s, se) => s + se.severity, 0) / last7.length;
    if (avgSeverity >= 5) {
      return {
        title: 'Side Effect Tracker',
        body: 'Your symptoms have been elevated this week. Logging helps spot patterns.',
        deepLink: '/entry/side-effects',
      };
    }
  }

  return { ...pickVariant(SIDE_EFFECTS_VARIANTS, 3), deepLink: '/entry/side-effects' };
}

export function getDailyPlanMorningContent(ctx: ReminderContext): ReminderContent {
  // Dormant users get a single low-pressure nudge (back-off handled in syncNotifications).
  if (ctx.tier === 'dormant') {
    return { ...pickVariant(DAILY_PLAN_DORMANT_VARIANTS, 4), deepLink: '/(tabs)' };
  }

  // Phase-specific daily plan messages (only for medication users)
  if (ctx.profile?.medication_brand && ctx.injectionLogs.length > 0) {
    const phase = getInjectionPhase(ctx.injectionLogs, ctx.profile);

    if (phase === 'Waning Phase') {
      return {
        title: 'Your Daily Focus',
        body: `Waning phase: appetite may return. Stay ahead of cravings today.`,
        deepLink: '/(tabs)',
      };
    }

    if (phase === 'Due Soon' || phase === 'Overdue') {
      const oral = isOralDrug(ctx.profile?.medication_type as Glp1Type | undefined);
      return {
        title: 'Your Daily Focus',
        body: `Your ${drugLabel(ctx.profile)} ${doseNoun(oral)} is ${phase === 'Overdue' ? 'overdue' : 'coming up soon'}. Check your plan for today.`,
        deepLink: '/(tabs)',
      };
    }

    if (phase === 'Shot Day') {
      const oral = isOralDrug(ctx.profile?.medication_type as Glp1Type | undefined);
      return {
        title: oral ? 'Dose Day' : 'Injection Day',
        body: `Today is ${drugLabel(ctx.profile)} day. Open TitraHealth to see your priorities.`,
        deepLink: '/(tabs)',
      };
    }
  }

  return {
    title: 'Your Daily Focus',
    body: "Open TitraHealth to see today's priorities.",
    deepLink: '/(tabs)',
  };
}

// ─── Dose reminder content ──────────────────────────────────────────────────

export function getDoseReminderContent(ctx: ReminderContext): {
  dailyTitle: string;
  dailyBody: string;
  shotDayTitle: string;
  shotDayBody: string;
  eveTitle: string;
  eveBody: string;
} {
  const weeks = weeksOnCurrentDose(ctx.profile);
  const weeksStr = weeks !== null ? ` (week ${weeks + 1} on your current dose)` : '';

  const oral = isOralDrug(ctx.profile?.medication_type as Glp1Type | undefined);
  return {
    dailyTitle: 'Time for your daily dose',
    dailyBody: `Log your dose after taking it to keep your cycle accurate.${weeksStr ? '\n' + weeksStr : ''}`,
    shotDayTitle: `Today is your ${doseNoun(oral)} day`,
    shotDayBody: `Log your ${doseNoun(oral)} to keep your cycle on track.${weeksStr ? '\n' + weeksStr : ''}`,
    eveTitle: `${oral ? 'Dose' : 'Injection'} tomorrow`,
    eveBody: oral
      ? 'Your dose is due tomorrow.'
      : 'Your injection is due tomorrow. Prepare your injection and rotation site.',
  };
}

// ─── Master content resolver ─────────────────────────────────────────────────

export type ReminderSlot =
  | 'meals_morning'
  | 'meals_evening'
  | 'weight_morning'
  | 'side_effects_evening'
  | 'daily_plan_morning';

const SLOT_BUILDERS: Record<ReminderSlot, (ctx: ReminderContext) => ReminderContent> = {
  meals_morning: getMealsMorningContent,
  meals_evening: getMealsEveningContent,
  weight_morning: getWeightMorningContent,
  side_effects_evening: getSideEffectsEveningContent,
  daily_plan_morning: getDailyPlanMorningContent,
};

export function buildReminderContent(
  slot: ReminderSlot,
  ctx: ReminderContext,
): ReminderContent {
  return SLOT_BUILDERS[slot](ctx);
}

// ─── Hydration Reminder Content ─────────────────────────────────────────────

const HYDRATION_TITLES = [
  'Time for a few sips',
  'Hydration check',
  'Stay hydrated',
  'Water break',
  'Quick sip reminder',
];

const HYDRATION_BODIES = [
  'Small, steady sips throughout the day are easier on your stomach than large amounts at once.',
  'Staying hydrated helps manage GI symptoms and supports how your medication works.',
  'Have you had water recently? Even a few sips count.',
  'Your body needs extra fluids right now. Grab your water bottle.',
  'Dehydration can worsen side effects. Keep sipping steadily.',
  'Try adding electrolytes if plain water feels hard to drink.',
  'Room temperature water is often easier to tolerate on GLP-1s.',
];

export function getHydrationTitles(): string[] {
  return HYDRATION_TITLES;
}

export function getHydrationBodies(): string[] {
  return HYDRATION_BODIES;
}

// ─── Protein Check Content ──────────────────────────────────────────────────

export function getProteinCheckContent(
  ctx: ReminderContext,
  mealIndex: number, // 0=breakfast, 1=lunch, 2=dinner
): ReminderContent {
  const mealLabels = ['breakfast', 'lunch', 'dinner'];
  const mealLabel = mealLabels[mealIndex] ?? 'meal';

  const todayProtein = ctx.todayProteinG ?? 0;
  const targetProtein = ctx.userGoals?.daily_protein_g_target ?? 0;

  if (targetProtein > 0 && todayProtein > 0) {
    const remaining = Math.max(0, targetProtein - todayProtein);
    if (remaining <= 0) {
      return {
        title: 'Protein goal hit!',
        body: `You've reached ${targetProtein}g today. Great job keeping your muscle-preserving protein high.`,
        deepLink: '/entry/log-food',
      };
    }
    const perMeal = Math.round(remaining / (3 - mealIndex || 1));
    return {
      title: `Protein check: ${mealLabel}`,
      body: `You're at ${todayProtein}g of ${targetProtein}g. Aim for ~${perMeal}g this ${mealLabel}.`,
      deepLink: '/entry/log-food',
    };
  }

  // Fallback if no tracking data
  const fallbacks = [
    'Start with protein first: eggs, Greek yogurt, or a shake.',
    'Protein preserves lean muscle on GLP-1. Prioritize it every meal.',
    'Even a small protein-rich snack counts. Try cottage cheese or a handful of nuts.',
  ];

  return {
    title: `Protein first: ${mealLabel}`,
    body: fallbacks[mealIndex % fallbacks.length],
    deepLink: '/entry/log-food',
  };
}
