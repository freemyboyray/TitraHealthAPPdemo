// ─── Personalization Orchestrator ────────────────────────────────────────────
// computePersonalizedPlan() — assembles all scoring, projection, and AI context.
// Pure TypeScript — no React imports.

import {
  computeGlp1AdherenceScore,
  computeMedicationScore,
  computeRecovery,
  computeRollingAdherenceScore,
  computeSideEffectBurden,
  computeSideEffectIndex,
  daysSinceInjection,
  generateFocuses,
  getDailyTargets,
  getShotPhase,
  type DailyActuals,
  type FocusItem,
  type ProgramPhase,
  type ShotPhase,
  type SideEffectIndex,
  type WearableData,
} from '@/constants/scoring';
import type {
  ActivityLevel,
  FullUserProfile,
  Glp1Type,
  Sex,
} from '@/constants/user-profile';
import { applyCheckinAdjustments, type CheckinScores } from '@/lib/checkin-adjustments';
import { localDateStr } from '@/lib/date-utils';
import { buildContextSnapshot } from '@/lib/context-snapshot';
import { getEscalationPhase, type EscalationPhase } from '@/lib/escalation-phase';
import { computeWeightProjection, type WeightProjection } from '@/lib/weight-projection';
import type {
  ActivityLog,
  FoodLog,
  InjectionLog,
  ProfileRow,
  SideEffectLog,
  UserGoalsRow,
  WeightLog,
} from '@/stores/log-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FoodNoiseLog = {
  id: string;
  score: number;
  logged_at: string;
  program_week: number | null;
};

export type PersonalizedPlan = {
  // Scores
  recoveryScore: number | null;
  adherenceScore: number;
  rollingAdherenceScore: number;
  sideEffectBurden: number;
  thiamineRisk: boolean;

  // Targets & actuals
  targets: ReturnType<typeof getDailyTargets>;
  actuals: DailyActuals;

  // Phase context
  daysSinceShot: number;
  shotPhase: ShotPhase;
  shotPhaseLabel: string;
  programWeek: number;
  programPhase: ProgramPhase;

  // Injection schedule
  isInjectionDue: boolean;    // true when next scheduled dose is today or overdue
  daysUntilNextDose: number;  // 0 = due today, positive = days remaining, negative = overdue
  injectionFrequencyDays: number;

  // Personalization
  escalationPhase: EscalationPhase;
  weightProjection: WeightProjection | null;
  focuses: FocusItem[];

  // Food noise
  latestFoodNoiseScore: number | null;
  foodNoiseTrend: 'improving' | 'worsening' | 'stable' | null;

  // Weekly check-ins
  weeklyCheckins: {
    foodNoise: { score: number | null; loggedAt: string | null };
    energyMood: { score: number | null; loggedAt: string | null };
    appetite:   { score: number | null; loggedAt: string | null };
  };

  // Side effect index (badge)
  sideEffectIndex: SideEffectIndex | null;

  // AI context
  contextSnapshot: string;
};

export type FullUserProfileForPlan = {
  glp1Type: Glp1Type;
  doseMg: number;
  weightKg: number;
  weightLbs: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  startDate: string;
  startWeightLbs: number;
  goalWeightLbs: number;
  sex: Sex;
  lastInjectionDate: string;
  injectionFrequencyDays: number;
  glp1Status: FullUserProfile['glp1Status'];
  sideEffects: FullUserProfile['sideEffects'];
};

// ─── Shot phase label ─────────────────────────────────────────────────────────

function buildShotPhaseLabel(daysSinceShot: number, phase: ShotPhase, daysUntilNextDose?: number): string {
  const dayLabel = `Day ${daysSinceShot}`;
  if (daysUntilNextDose !== undefined) {
    if (daysUntilNextDose < 0)  return `Injection overdue (${Math.abs(daysUntilNextDose)}d past due)`;
    if (daysUntilNextDose === 0) return `Injection due today (${dayLabel})`;
    if (daysUntilNextDose === 1) return `Reset Phase (${dayLabel}) — due tomorrow`;
  }
  switch (phase) {
    case 'shot':    return `Shot Day (${dayLabel})`;
    case 'peak':    return `Peak Phase (${dayLabel})`;
    case 'balance': return `Balance Phase (${dayLabel})`;
    case 'reset':   return `Reset Phase (${dayLabel})`;
  }
}

// ─── Food noise trend ─────────────────────────────────────────────────────────

function computeFoodNoiseTrend(
  logs: FoodNoiseLog[],
): 'improving' | 'worsening' | 'stable' | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at));
  const diff = sorted[sorted.length - 1].score - sorted[sorted.length - 2].score;
  if (diff < -1) return 'improving';
  if (diff > 1)  return 'worsening';
  return 'stable';
}

// ─── Profile bridge ───────────────────────────────────────────────────────────

/**
 * Bridges a Supabase ProfileRow (snake_case DB row) to FullUserProfileForPlan.
 * Handles the impedance mismatch between DB shape and app profile shape.
 */
export function mergeProfileData(
  profileRow: ProfileRow,
  onboardingProfile: Partial<FullUserProfile>,
): FullUserProfileForPlan {
  const weightLbs = onboardingProfile.weightLbs ?? (profileRow.start_weight_lbs ?? 180);
  const weightKg  = onboardingProfile.weightKg  ?? Math.round(weightLbs * 0.453592 * 10) / 10;
  return {
    glp1Type:               (onboardingProfile.glp1Type ?? (profileRow.medication_type as Glp1Type)) ?? 'semaglutide',
    doseMg:                 onboardingProfile.doseMg   ?? (profileRow.dose_mg ?? 0.25),
    weightKg,
    weightLbs,
    heightCm:               onboardingProfile.heightCm ?? (profileRow.height_inches ? profileRow.height_inches * 2.54 : 170),
    activityLevel:          onboardingProfile.activityLevel ?? 'light',
    startDate:              onboardingProfile.startDate ?? (profileRow.program_start_date ?? new Date().toISOString().split('T')[0]),
    startWeightLbs:         onboardingProfile.startWeightLbs ?? (profileRow.start_weight_lbs ?? weightLbs),
    goalWeightLbs:          onboardingProfile.goalWeightLbs  ?? (profileRow.goal_weight_lbs ?? weightLbs - 20),
    sex:                    onboardingProfile.sex ?? 'prefer_not_to_say',
    lastInjectionDate:      onboardingProfile.lastInjectionDate ?? new Date().toISOString().split('T')[0],
    injectionFrequencyDays: onboardingProfile.injectionFrequencyDays ?? (profileRow.injection_frequency_days ?? 7),
    glp1Status:             onboardingProfile.glp1Status ?? 'active',
    sideEffects:            onboardingProfile.sideEffects ?? [],
  };
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export function computePersonalizedPlan(params: {
  profile: FullUserProfileForPlan;
  wearable: Partial<WearableData>;
  actuals: DailyActuals;
  injectionLogs: InjectionLog[];
  sideEffectLogs: SideEffectLog[];
  weightLogs: WeightLog[];
  foodLogs: FoodLog[];
  activityLogs: ActivityLog[];
  userGoals: UserGoalsRow | null;
  profileRow: ProfileRow | null;
  userName: string | null;
  foodNoiseLogs: FoodNoiseLog[];
  weeklyCheckinLogs?: Record<string, Array<{ score: number; logged_at: string }>>;
}): PersonalizedPlan {
  const {
    profile, wearable, actuals,
    injectionLogs, sideEffectLogs, weightLogs,
    foodLogs, activityLogs, userGoals, profileRow, userName,
    foodNoiseLogs, weeklyCheckinLogs = {},
  } = params;

  // 1. Shot phase
  const daysSinceShot = daysSinceInjection(profile.lastInjectionDate);
  const shotPhase = getShotPhase(daysSinceShot);

  // 1b. Injection schedule — uncapped date math, independent of shot phase cap
  const injectionFrequencyDays = profile.injectionFrequencyDays;
  const lastInjMs = new Date(profile.lastInjectionDate).getTime();
  const actualDaysSinceShot = Math.floor((Date.now() - lastInjMs) / 86400000) + 1;
  const daysUntilNextDose = injectionFrequencyDays - actualDaysSinceShot;
  const isInjectionDue = daysUntilNextDose <= 0;

  const shotPhaseLabel = buildShotPhaseLabel(daysSinceShot, shotPhase, daysUntilNextDose);

  // 2. Program week + escalation phase (needed before targets)
  const startDateEarly = profile.startDate ? new Date(profile.startDate) : new Date();
  const daysSinceStartEarly = Math.floor((Date.now() - startDateEarly.getTime()) / 86400000);
  const programWeekEarly = Math.max(1, Math.round(daysSinceStartEarly / 7));
  const escalationPhaseEarly = getEscalationPhase(programWeekEarly, profile.doseMg, profile.glp1Type);

  // Derive 3-tier program phase from escalation phase name
  const programPhase: ProgramPhase =
    escalationPhaseEarly.name === 'initiation' ? 'initiation' :
    escalationPhaseEarly.name === 'max_dose'   ? 'maintenance' :
    'titration';

  // 2b. Targets (phase-aware + side-effect adjusted)
  const currentWeightKg = (weightLogs[0]?.weight_lbs ?? profile.weightLbs) * 0.453592;
  const startWeightKg = profile.startWeightLbs * 0.453592;
  const weightLostKg = Math.max(0, startWeightKg - currentWeightKg);

  // Filter side effect logs to last 7 days for adjustment engine
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const recentSideEffectLogs = sideEffectLogs
    .filter(l => l.logged_at >= sevenDaysAgo)
    .map(l => ({
      effect_type: l.effect_type,
      severity: l.severity,
      logged_at: l.logged_at,
    }));

  let targets = getDailyTargets(
    profile as unknown as FullUserProfile,
    {
      programPhase,
      baseCaloriesTarget: userGoals?.daily_calories_target ?? undefined,
      weightLostKg,
      sideEffectLogs: recentSideEffectLogs,
    },
  );

  // 3. Recovery score
  const recoveryScore = computeRecovery(wearable, shotPhase);

  // 4. Side effect burden
  const { burden: sideEffectBurden, thiamineRisk } = computeSideEffectBurden(
    sideEffectLogs,
    shotPhase,
  );

  // 4b. Side effect index (for badge)
  const sideEffectIndex = sideEffectLogs.length > 0
    ? computeSideEffectIndex(
        sideEffectLogs.map(l => ({
          effect_type: l.effect_type,
          severity: l.severity,
          logged_at: l.logged_at,
          phase_at_log: l.phase_at_log as ShotPhase,
        })),
        shotPhase,
        daysSinceShot,
      )
    : null;

  // 5. Adherence score
  const todayLocal = localDateStr();
  const hasFoodData     = (foodLogs ?? []).some(f => localDateStr(new Date(f.logged_at)) === todayLocal);
  const hasActivityData = (activityLogs ?? []).some(a => a.date === todayLocal);
  const adherenceScore = computeGlp1AdherenceScore(
    actuals,
    targets,
    sideEffectBurden,
    injectionLogs,
    profile.injectionFrequencyDays,
    hasActivityData,
    hasFoodData,
  );

  // 5b. Rolling adherence score (14-day linear weighted average)
  const rollingAdherenceScore = computeRollingAdherenceScore({
    injectionLogs: injectionLogs.map(l => ({
      injection_date: l.injection_date,
      injection_time: l.injection_time ?? undefined,
    })),
    foodLogs: foodLogs.map(l => ({
      logged_at: l.logged_at,
      protein_g: (l as any).protein_g ?? 0,
      fiber_g:   (l as any).fiber_g   ?? 0,
    })),
    activityLogs: activityLogs.map(l => ({
      date:  l.date,
      steps: (l as any).steps ?? null,
    })),
    sideEffectLogs: sideEffectLogs.map(l => ({
      effect_type:  l.effect_type,
      severity:     l.severity,
      phase_at_log: l.phase_at_log ?? 'balance',
      logged_at:    l.logged_at,
    })),
    profile: profile as any,
    programPhase,
    proteinPriority: targets.proteinPriority,
  });

  // 6. Focus items (protein boosted in titration; injection only surfaces when due)
  const focuses = generateFocuses(actuals, targets, wearable, daysSinceShot, programPhase, isInjectionDue);

  // 7. Program week (reuse early computation)
  const programWeek = programWeekEarly;

  // 8. Escalation phase (reuse early computation)
  const escalationPhase = escalationPhaseEarly;

  // 9. Weight projection (requires at least a start weight)
  let weightProjection: WeightProjection | null = null;
  if (profile.startWeightLbs > 0 && profile.heightCm > 0) {
    weightProjection = computeWeightProjection({
      startWeightLbs:    profile.startWeightLbs,
      currentWeightLbs:  weightLogs[0]?.weight_lbs ?? profile.weightLbs,
      goalWeightLbs:     profile.goalWeightLbs,
      weightLogHistory:  weightLogs.map(l => ({ weight_lbs: l.weight_lbs, logged_at: l.logged_at })),
      programWeek,
      medicationType:    profile.glp1Type,
      doseMg:            profile.doseMg,
      sex:               profile.sex,
      heightCm:          profile.heightCm,
    });
  }

  // 10. Food noise
  const sortedFoodNoise = [...foodNoiseLogs].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  const latestFoodNoiseScore = sortedFoodNoise[0]?.score ?? null;
  const foodNoiseTrend = computeFoodNoiseTrend(foodNoiseLogs);

  // 10b. Weekly check-ins
  function latestCheckin(type: string): { score: number | null; loggedAt: string | null } {
    const logs = weeklyCheckinLogs[type] ?? [];
    const sorted = [...logs].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
    return { score: sorted[0]?.score ?? null, loggedAt: sorted[0]?.logged_at ?? null };
  }
  const weeklyCheckins = {
    foodNoise: { score: latestFoodNoiseScore, loggedAt: sortedFoodNoise[0]?.logged_at ?? null },
    energyMood: latestCheckin('energy_mood'),
    appetite:   latestCheckin('appetite'),
  };

  // 10c. Apply check-in score adjustments on top of side-effect adjusted targets
  const sevenDaysAgoMs = Date.now() - 7 * 86400000;
  const checkinIsRecent = (at: string | null) => at != null && new Date(at).getTime() >= sevenDaysAgoMs;

  const checkinScores: CheckinScores = {
    foodNoise:  checkinIsRecent(weeklyCheckins.foodNoise.loggedAt)  ? weeklyCheckins.foodNoise.score  : null,
    energyMood: checkinIsRecent(weeklyCheckins.energyMood.loggedAt) ? weeklyCheckins.energyMood.score : null,
    appetite:   checkinIsRecent(weeklyCheckins.appetite.loggedAt)   ? weeklyCheckins.appetite.score   : null,
  };

  if (Object.values(checkinScores).some(v => v != null)) {
    targets = applyCheckinAdjustments(targets, checkinScores);
  }

  // 11. Context snapshot for AI surfaces
  const contextSnapshot = buildContextSnapshot({
    injectionLogs,
    foodLogs,
    weightLogs,
    activityLogs,
    sideEffectLogs,
    userGoals,
    profile:    profileRow,
    userName,
    score: {
      total:      rollingAdherenceScore,
      medication: actuals.injectionLogged ? 100 : 0,
      nutrition:  Math.round(Math.min(actuals.proteinG / targets.proteinG, 1) * 100),
      activity:   Math.round(Math.min(actuals.steps / targets.steps, 1) * 100),
    },
    escalationPhase: {
      name:        escalationPhase.displayName,
      programWeek,
      weeklyFocus: escalationPhase.weeklyFocus,
    },
    shotPhaseLabel,
    foodNoiseScore:      latestFoodNoiseScore,
    bmi:                 weightProjection?.bmi,
    isPlasticityWindow:  escalationPhase.isPlasticityWindow,
    projection: weightProjection
      ? {
          projectedGoalDate: weightProjection.projectedGoalDate,
          confidenceLevel:   weightProjection.confidenceLevel,
          lossToDatePct:     weightProjection.lossToDatePct,
        }
      : undefined,
  });

  return {
    recoveryScore,
    adherenceScore,
    rollingAdherenceScore,
    sideEffectBurden,
    thiamineRisk,
    targets,
    actuals,
    daysSinceShot,
    shotPhase,
    shotPhaseLabel,
    programWeek,
    programPhase,
    isInjectionDue,
    daysUntilNextDose,
    injectionFrequencyDays,
    escalationPhase,
    weightProjection,
    focuses,
    latestFoodNoiseScore,
    foodNoiseTrend,
    weeklyCheckins,
    sideEffectIndex,
    contextSnapshot,
  };
}
