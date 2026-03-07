import type {
  ActivityLog,
  FoodLog,
  InjectionLog,
  ProfileRow,
  SideEffectLog,
  UserGoalsRow,
} from './log-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScoreBreakdown = {
  total: number;
  medication: number;
  nutrition: number;
  activity: number;
  sideEffect: number;
};

export type InjectionPhase =
  | 'Shot Day'
  | 'Peak Phase'
  | 'Mid Phase'
  | 'Waning Phase'
  | 'Due Soon'
  | 'Overdue'
  | 'Unknown';

export type FocusItem = {
  iconLib: 'ionicons' | 'material';
  icon: string;
  label: string;
  badge: string;
};

// ─── Score computation ────────────────────────────────────────────────────────

export function computeScore(
  injectionLogs: InjectionLog[],
  foodLogs: FoodLog[],
  activityLogs: ActivityLog[],
  sideEffectLogs: SideEffectLog[],
  userGoals: UserGoalsRow | null,
  _profile: ProfileRow | null,
): ScoreBreakdown {
  const today = new Date().toISOString().split('T')[0];

  // ── Medication pillar (30%) ───────────────────────────────────────────────
  let medicationScore = 50;
  if (injectionLogs.length > 0 && _profile) {
    const freq = _profile.injection_frequency_days ?? 7;
    const lastDate = new Date(injectionLogs[0].injection_date);
    const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
    if (daysSince === 0) {
      medicationScore = 100;
    } else if (daysSince < freq) {
      medicationScore = Math.round(100 - (daysSince / freq) * 40);
    } else {
      medicationScore = Math.max(0, Math.round(60 - (daysSince - freq) * 10));
    }
  }

  // ── Nutrition pillar (30%) ────────────────────────────────────────────────
  let nutritionScore = 50;
  const todayFoods = foodLogs.filter((f) => f.logged_at?.startsWith(today));
  if (userGoals && todayFoods.length > 0) {
    const calories = todayFoods.reduce((s, f) => s + (f.calories ?? 0), 0);
    const protein = todayFoods.reduce((s, f) => s + (f.protein_g ?? 0), 0);
    const fiber = todayFoods.reduce((s, f) => s + (f.fiber_g ?? 0), 0);

    const calsTarget = userGoals.daily_calories_target || 2000;
    const calsRatio = calories / calsTarget;
    const calScore =
      calsRatio < 0.6
        ? calsRatio * 80
        : calsRatio > 1.2
          ? Math.max(0, 100 - (calsRatio - 1.2) * 150)
          : 80 + ((calsRatio - 0.6) / 0.6) * 20;

    const proteinScore = Math.min(
      100,
      (protein / (userGoals.daily_protein_g_target || 120)) * 100,
    );
    const fiberScore = Math.min(
      100,
      (fiber / (userGoals.daily_fiber_g_target || 25)) * 100,
    );
    nutritionScore = Math.round(calScore * 0.3 + proteinScore * 0.5 + fiberScore * 0.2);
  }

  // ── Activity pillar (25%) ─────────────────────────────────────────────────
  let activityScore = 50;
  const todayActivity = activityLogs.filter((a) => a.date === today);
  if (todayActivity.length > 0) {
    const totalMin = todayActivity.reduce((s, a) => s + (a.duration_min ?? 0), 0);
    const totalSteps = todayActivity.reduce((s, a) => s + (a.steps ?? 0), 0);
    const minScore = Math.min(100, (totalMin / 30) * 100); // 30min target
    const stepsScore = Math.min(
      100,
      (totalSteps / (userGoals?.daily_steps_target || 8000)) * 100,
    );
    activityScore = Math.round(minScore * 0.6 + stepsScore * 0.4);
  }

  // ── Side effect burden (15% inverse) ─────────────────────────────────────
  let sideEffectScore = 80;
  const last7 = sideEffectLogs.filter(
    (se) => Date.now() - new Date(se.logged_at).getTime() < 7 * 86400000,
  );
  if (last7.length > 0) {
    const avgSeverity = last7.reduce((s, se) => s + se.severity, 0) / last7.length;
    sideEffectScore = Math.max(0, Math.round(100 - (avgSeverity / 10) * 100));
  }

  const total = Math.round(
    medicationScore * 0.3 +
      nutritionScore * 0.3 +
      activityScore * 0.25 +
      sideEffectScore * 0.15,
  );

  return {
    total,
    medication: medicationScore,
    nutrition: nutritionScore,
    activity: activityScore,
    sideEffect: sideEffectScore,
  };
}

// ─── Injection phase ──────────────────────────────────────────────────────────

export function getInjectionPhase(
  injectionLogs: InjectionLog[],
  profile: ProfileRow | null,
): InjectionPhase {
  if (injectionLogs.length === 0) return 'Unknown';
  const lastDate = new Date(injectionLogs[0].injection_date);
  const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000);
  const freq = profile?.injection_frequency_days ?? 7;

  if (daysSince === 0) return 'Shot Day';
  if (daysSince <= 2) return 'Peak Phase';
  if (daysSince <= Math.floor(freq * 0.6)) return 'Mid Phase';
  if (daysSince < freq) return 'Waning Phase';
  if (daysSince === freq) return 'Due Soon';
  return 'Overdue';
}

// ─── Focuses ──────────────────────────────────────────────────────────────────

export function buildFocuses(
  score: ScoreBreakdown,
  todayProtein: number,
  proteinTarget: number,
): FocusItem[] {
  const pillars: (FocusItem & { score: number })[] = [
    {
      score: score.nutrition,
      iconLib: 'material',
      icon: 'restaurant',
      label:
        proteinTarget > 0 && todayProtein < proteinTarget
          ? `Add ${Math.round(proteinTarget - todayProtein)}g Protein`
          : 'Log a High-Protein Meal',
      badge: '+3% Score',
    },
    {
      score: score.activity,
      iconLib: 'material',
      icon: 'trending-up',
      label: '15 min Walk',
      badge: '+2% Score',
    },
    {
      score: score.medication,
      iconLib: 'ionicons',
      icon: 'medical-outline',
      label: "Log Today's Injection",
      badge: '+4% Score',
    },
    {
      score: score.sideEffect,
      iconLib: 'ionicons',
      icon: 'water-outline',
      label: 'Hydration Goal',
      badge: '+1% Score',
    },
  ];

  return pillars
    .filter((p) => p.score < 85)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(({ score: _s, ...rest }) => rest);
}
