// ─── Personalization Orchestrator ────────────────────────────────────────────
// computePersonalizedPlan() — assembles all scoring, projection, and AI context.
// Pure TypeScript — no React imports.

import {
  computeGlp1AdherenceScore,
  computeMedicationScore,
  computeRecovery,
  computeSideEffectBurden,
  computeSideEffectIndex,
  daysSinceInjection,
  generateFocuses,
  getDailyTargets,
  getShotPhase,
  type DailyActuals,
  type FocusItem,
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

function buildShotPhaseLabel(daysSinceShot: number, phase: ShotPhase): string {
  const dayLabel = `Day ${daysSinceShot}`;
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
  const shotPhaseLabel = buildShotPhaseLabel(daysSinceShot, shotPhase);

  // 2. Targets
  const targets = getDailyTargets(profile as unknown as FullUserProfile, daysSinceShot);

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
  const hasFoodData = (foodLogs ?? []).some(f =>
    f.logged_at?.startsWith(new Date().toISOString().split('T')[0]),
  );
  const hasActivityData = (activityLogs ?? []).some(a =>
    a.date === new Date().toISOString().split('T')[0],
  );
  const adherenceScore = computeGlp1AdherenceScore(
    actuals,
    targets,
    sideEffectBurden,
    injectionLogs,
    profile.injectionFrequencyDays,
    hasActivityData,
    hasFoodData,
  );

  // 6. Focus items
  const focuses = generateFocuses(actuals, targets, wearable, daysSinceShot);

  // 7. Program week
  const startDate = profile.startDate ? new Date(profile.startDate) : new Date();
  const daysSinceStart = Math.floor((Date.now() - startDate.getTime()) / 86400000);
  const programWeek = Math.max(1, Math.round(daysSinceStart / 7));

  // 8. Escalation phase
  const escalationPhase = getEscalationPhase(programWeek, profile.doseMg, profile.glp1Type);

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
      total:      adherenceScore,
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
    sideEffectBurden,
    thiamineRisk,
    targets,
    actuals,
    daysSinceShot,
    shotPhase,
    shotPhaseLabel,
    programWeek,
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
