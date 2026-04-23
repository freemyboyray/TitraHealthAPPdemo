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

export type ReminderContext = {
  foodLogs: FoodLog[];
  weightLogs: WeightLog[];
  sideEffectLogs: SideEffectLog[];
  injectionLogs: InjectionLog[];
  activityLogs: ActivityLog[];
  profile: ProfileRow | null;
  userGoals: UserGoalsRow | null;
  todayProteinG?: number;
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
        body: `You had ${Math.round(ydProtein)}g protein yesterday — aim for a high-protein breakfast to close the gap.`,
        deepLink: '/entry/log-food',
      };
    }
    if (ydProtein >= proteinTarget) {
      return {
        title: 'Great Protein Day Yesterday!',
        body: `${Math.round(ydProtein)}g — keep it going. Log your breakfast to stay on track.`,
        deepLink: '/entry/log-food',
      };
    }
  }

  // Streak
  const streak = countStreak(ctx.foodLogs);
  if (streak >= 3) {
    return {
      title: 'Log Your Breakfast',
      body: `${streak}-day food logging streak — don't break the chain!`,
      deepLink: '/entry/log-food',
    };
  }

  // Gap
  const gap = daysSinceLastLog(ctx.foodLogs);
  if (gap >= 2 && gap < 30) {
    return {
      title: 'Log Your Breakfast',
      body: `It's been ${gap} days since your last food log — one tap to get back on track.`,
      deepLink: '/entry/log-food',
    };
  }

  return {
    title: 'Log Your Breakfast',
    body: 'Tap to log what you had this morning.',
    deepLink: '/entry/log-food',
  };
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
        body: `You're at ${Math.round(todayProtein)}g protein today — aim for ${Math.round(remaining)}g more at dinner.`,
        deepLink: '/entry/log-food',
      };
    }
    if (remaining <= 10) {
      return {
        title: 'You Crushed Protein Today',
        body: `${Math.round(todayProtein)}g protein — log dinner to cap off a strong day.`,
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
        body: `You're in the waning phase of ${drugLabel(ctx.profile)} — log dinner to stay mindful.`,
        deepLink: '/entry/log-food',
      };
    }
  }

  return {
    title: 'Log Your Dinner',
    body: 'End the day strong — log your evening meal.',
    deepLink: '/entry/log-food',
  };
}

export function getWeightMorningContent(ctx: ReminderContext): ReminderContent {
  // Suppress if already logged today
  if (hasLoggedToday(ctx.weightLogs)) return null;

  // Progress callout
  const progress = weightProgress(ctx.weightLogs, ctx.profile);
  if (progress) {
    return {
      title: 'Morning Weigh-In',
      body: `Down ${progress} from your start — keep tracking to see your trend.`,
      deepLink: '/entry/log-weight',
    };
  }

  // Streak
  const streak = countStreak(ctx.weightLogs);
  if (streak >= 3) {
    return {
      title: 'Morning Weigh-In',
      body: `${streak}-day weigh-in streak — consistency is key!`,
      deepLink: '/entry/log-weight',
    };
  }

  // Gap
  const gap = daysSinceLastLog(ctx.weightLogs);
  if (gap >= 2 && gap < 30) {
    return {
      title: 'Morning Weigh-In',
      body: `Haven't logged weight in ${gap} days — one tap to get back on track.`,
      deepLink: '/entry/log-weight',
    };
  }

  return {
    title: 'Morning Weigh-In',
    body: 'Log your weight to track your progress.',
    deepLink: '/entry/log-weight',
  };
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
      body: `${doseLabel(ctx.profile)} is peaking — log any symptoms while they're fresh.`,
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
      body: `Week ${weeks + 1} on ${doseLabel(ctx.profile)} — GI symptoms often shift around now. Any changes?`,
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
        body: 'Your symptoms have been elevated this week — logging helps spot patterns.',
        deepLink: '/entry/side-effects',
      };
    }
  }

  return {
    title: 'How Are You Feeling?',
    body: 'Log any side effects from today.',
    deepLink: '/entry/side-effects',
  };
}

export function getDailyPlanMorningContent(ctx: ReminderContext): ReminderContent {
  // Phase-specific daily plan messages (only for medication users)
  if (ctx.profile?.medication_brand && ctx.injectionLogs.length > 0) {
    const phase = getInjectionPhase(ctx.injectionLogs, ctx.profile);

    if (phase === 'Waning Phase') {
      return {
        title: 'Your Daily Focus',
        body: `Waning phase — appetite may return. Stay ahead of cravings today.`,
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
  const weeksStr = weeks !== null ? ` — week ${weeks + 1} on your current dose` : '';

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
