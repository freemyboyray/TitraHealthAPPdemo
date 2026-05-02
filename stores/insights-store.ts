import type {
  ActivityLog,
  FoodLog,
  InjectionLog,
  ProfileRow,
  SideEffectLog,
  UserGoalsRow,
  WeightLog,
} from './log-store';
import { TRIAL_BENCHMARKS, interpolateBenchmark, getTrialTrajectory } from '@/constants/scoring';
import type { Glp1Type } from '@/constants/user-profile';

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

// ─── Clinical Trial Benchmarking ─────────────────────────────────────────────

export type BenchmarkStatus = 'ahead' | 'on_track' | 'behind';

export type UserTrajectoryPoint = { week: number; lossPct: number };

export type TrialTrajectoryPoint = { week: number; mean: number; low: number; high: number };

export type ClinicalBenchmarkResult = {
  hasEnoughData: boolean;
  treatmentWeek: number;
  userLossPct: number;
  trialLossPct: number | null;
  trialLabel: string;
  trialName: string;
  deltaVsTrial: number | null;
  status: BenchmarkStatus | null;
  /** true when user has weight data but treatment week is before first trial datapoint */
  tooEarly: boolean;
  /** true when medication type is unknown / not set */
  unknownMedication: boolean;
  /** true when medication is set but no published trial benchmarks exist for it */
  noTrialData: boolean;
  /** User's weight-loss % at each treatment week (for chart) */
  userTrajectory: UserTrajectoryPoint[];
  /** Trial band data at each key timepoint (for chart) */
  trialTrajectory: TrialTrajectoryPoint[];
  /** Last week in the trial data (for X-axis range) */
  trialMaxWeek: number;
};

const EMPTY_BENCHMARK: ClinicalBenchmarkResult = {
  hasEnoughData: false,
  treatmentWeek: 0,
  userLossPct: 0,
  trialLossPct: null,
  trialLabel: '',
  trialName: '',
  deltaVsTrial: null,
  status: null,
  tooEarly: false,
  unknownMedication: false,
  noTrialData: false,
  userTrajectory: [],
  trialTrajectory: [],
  trialMaxWeek: 0,
};

/** Convert weight logs into weekly weight-loss-% trajectory relative to baseline. */
export function computeUserTrajectory(
  weightLogs: WeightLog[],
  programStartDate: string | null,
): UserTrajectoryPoint[] {
  if (weightLogs.length < 2) return [];
  // weightLogs are sorted newest-first
  const refDateStr = programStartDate ?? weightLogs[weightLogs.length - 1]?.logged_at ?? null;
  if (!refDateStr) return [];
  const refDate = new Date(refDateStr).getTime();
  const baseline = weightLogs[weightLogs.length - 1].weight_lbs;
  if (!baseline || baseline <= 0) return [];

  // Group by treatment week and average
  const weekMap = new Map<number, number[]>();
  for (const log of weightLogs) {
    const week = Math.max(0, Math.round((new Date(log.logged_at).getTime() - refDate) / (7 * 86400000)));
    const lossPct = Math.round(((baseline - log.weight_lbs) / baseline) * 1000) / 10;
    const arr = weekMap.get(week);
    if (arr) arr.push(lossPct);
    else weekMap.set(week, [lossPct]);
  }

  const points: UserTrajectoryPoint[] = [];
  for (const [week, values] of weekMap) {
    const avg = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
    points.push({ week, lossPct: avg });
  }
  return points.sort((a, b) => a.week - b.week);
}

export function computeClinicalBenchmark(
  weightLogs: WeightLog[],
  programStartDate: string | null,
  medicationType: Glp1Type | string | null,
): ClinicalBenchmarkResult {
  if (weightLogs.length < 2) return EMPTY_BENCHMARK;

  // Treatment week: from program_start_date, or fallback to earliest weight log
  const refDateStr = programStartDate ?? weightLogs[weightLogs.length - 1]?.logged_at ?? null;
  if (!refDateStr) return EMPTY_BENCHMARK;
  const treatmentWeek = Math.max(1, Math.round(
    (Date.now() - new Date(refDateStr).getTime()) / (7 * 86400000),
  ));

  // Weight loss %: earliest log → latest log
  const earliest = weightLogs[weightLogs.length - 1].weight_lbs;
  const latest = weightLogs[0].weight_lbs;
  if (!earliest || earliest <= 0) return EMPTY_BENCHMARK;
  const userLossPct = Math.round(((earliest - latest) / earliest) * 1000) / 10;

  const userTrajectory = computeUserTrajectory(weightLogs, programStartDate);

  // Medication lookup — map oral variants to their active ingredient's trial data
  const rawMedKey = medicationType?.toLowerCase() ?? '';
  const medKey = rawMedKey === 'oral_semaglutide' ? 'semaglutide' : rawMedKey;
  const tiers = TRIAL_BENCHMARKS[medKey];
  if (!tiers || tiers.length === 0) {
    return {
      ...EMPTY_BENCHMARK,
      hasEnoughData: true,
      treatmentWeek,
      userLossPct,
      unknownMedication: !medicationType,
      noTrialData: !!medicationType,
      userTrajectory,
    };
  }

  const tier = tiers[0]; // Use first (primary) tier
  const trialLossPct = interpolateBenchmark(tier.data, treatmentWeek);
  const trialTrajectory = getTrialTrajectory(medKey);
  const trialMaxWeek = trialTrajectory.length > 0
    ? trialTrajectory[trialTrajectory.length - 1].week
    : 0;

  if (trialLossPct === null) {
    return {
      ...EMPTY_BENCHMARK,
      hasEnoughData: true,
      treatmentWeek,
      userLossPct,
      trialLabel: tier.label,
      trialName: tier.trialName,
      tooEarly: true,
      userTrajectory,
      trialTrajectory,
      trialMaxWeek,
    };
  }

  const deltaVsTrial = Math.round((userLossPct - trialLossPct) * 10) / 10;
  let status: BenchmarkStatus;
  if (deltaVsTrial > 0.5) status = 'ahead';
  else if (deltaVsTrial < -0.5) status = 'behind';
  else status = 'on_track';

  return {
    hasEnoughData: true,
    treatmentWeek,
    userLossPct,
    trialLossPct,
    trialLabel: tier.label,
    trialName: tier.trialName,
    deltaVsTrial,
    status,
    tooEarly: false,
    unknownMedication: false,
    noTrialData: false,
    userTrajectory,
    trialTrajectory,
    trialMaxWeek,
  };
}

