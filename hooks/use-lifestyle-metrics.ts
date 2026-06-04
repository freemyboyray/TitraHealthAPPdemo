import { useCallback, useEffect, useMemo } from 'react';

import { useHealthData } from '@/contexts/health-data';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useQuickAdjustStore, type QuickAdj } from '@/stores/quick-adjust-store';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { localDateStr } from '@/lib/date-utils';
import {
  buildHealthMetrics,
  DEFAULT_CHOLESTEROL_MG,
  DEFAULT_SAT_FAT_G,
  DEFAULT_SODIUM_MG,
  DEFAULT_SUGAR_G,
  DEFAULT_TRANS_FAT_G,
  DEFAULT_POLY_FAT_G,
  DEFAULT_MONO_FAT_G,
  DEFAULT_POTASSIUM_MG,
  DEFAULT_ADDED_SUGARS_G,
  DEFAULT_VITAMIN_A_MCG,
  DEFAULT_VITAMIN_C_MG,
  DEFAULT_VITAMIN_D_MCG,
  DEFAULT_CALCIUM_MG,
  DEFAULT_IRON_MG,
  type HealthMetric,
} from '@/app/(tabs)/log';

export type HealthMetricGroup = { category: string; metrics: HealthMetric[] };

const PREMIUM_METRIC_IDS = new Set(['hrv', 'spo2', 'respRate']);

/**
 * Shared data layer for the Lifestyle tab and its three detail screens
 * (`/insights/nutrition`, `/insights/activity`, `/insights/vitals`).
 * Lifted out of `app/(tabs)/log.tsx` so the same today-values + adjustMetric
 * stay consistent across the tab row preview and the detail screen cards.
 */
export function useLifestyleMetrics() {
  const health = useHealthData();
  const { actuals, targets } = health;
  const { foodLogs, activityLogs, userGoals } = useLogStore();
  const hkStore = useHealthKitStore();
  const isPremiumUser = useSubscriptionStore(s => s.isPremium);
  const appleHealthEnabled = usePreferencesStore(s => s.appleHealthEnabled);
  const { qa, hydrate, adjust } = useQuickAdjustStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const todayStr = localDateStr();

  const todayFoodLogs = useMemo(
    () => foodLogs.filter(f => localDateStr(new Date(f.logged_at)) === todayStr),
    [foodLogs, todayStr],
  );
  const todayActivityLogs = useMemo(
    () => activityLogs.filter(a => a.date === todayStr),
    [activityLogs, todayStr],
  );

  // For nutrition + activity metrics, prefer in-app logs but fall back to
  // Apple Health when nothing is logged today. Quick-adjust offsets layer on top.
  const loggedProteinG = Math.round(todayFoodLogs.reduce((s, f) => s + f.protein_g, 0));
  const loggedFiberG = Math.round(todayFoodLogs.reduce((s, f) => s + f.fiber_g, 0));
  const loggedCarbsG = Math.round(todayFoodLogs.reduce((s, f) => s + f.carbs_g, 0));
  const loggedFatG = Math.round(todayFoodLogs.reduce((s, f) => s + f.fat_g, 0));
  const loggedCalories = Math.round(todayFoodLogs.reduce((s, f) => s + f.calories, 0));

  const todaySodiumMg = Math.round(todayFoodLogs.reduce((s, f) => s + (f.sodium_mg ?? 0), 0)) + qa.sodiumMg;
  const todaySugarG = Math.round(todayFoodLogs.reduce((s, f) => s + (f.sugar_g ?? 0), 0)) + qa.sugarG;
  const todaySaturatedFatG = Math.round(todayFoodLogs.reduce((s, f) => s + (f.saturated_fat_g ?? 0), 0)) + qa.satFatG;
  const todayCholesterolMg = Math.round(todayFoodLogs.reduce((s, f) => s + (f.cholesterol_mg ?? 0), 0)) + qa.cholesterolMg;
  const todayTransFatG = Math.round(todayFoodLogs.reduce((s, f) => s + (f.trans_fat_g ?? 0), 0)) + qa.transFatG;
  const todayPolyFatG = Math.round(todayFoodLogs.reduce((s, f) => s + (f.polyunsaturated_fat_g ?? 0), 0)) + qa.polyFatG;
  const todayMonoFatG = Math.round(todayFoodLogs.reduce((s, f) => s + (f.monounsaturated_fat_g ?? 0), 0)) + qa.monoFatG;
  const todayPotassiumMg = Math.round(todayFoodLogs.reduce((s, f) => s + (f.potassium_mg ?? 0), 0)) + qa.potassiumMg;
  const todayAddedSugarsG = Math.round(todayFoodLogs.reduce((s, f) => s + (f.added_sugars_g ?? 0), 0)) + qa.addedSugarsG;
  const todayVitaminAMcg = Math.round(todayFoodLogs.reduce((s, f) => s + (f.vitamin_a_mcg ?? 0), 0)) + qa.vitaminAMcg;
  const todayVitaminCMg = Math.round(todayFoodLogs.reduce((s, f) => s + (f.vitamin_c_mg ?? 0), 0)) + qa.vitaminCMg;
  const todayVitaminDMcg = Math.round(todayFoodLogs.reduce((s, f) => s + (f.vitamin_d_mcg ?? 0), 0)) + qa.vitaminDMcg;
  const todayCalciumMg = Math.round(todayFoodLogs.reduce((s, f) => s + (f.calcium_mg ?? 0), 0)) + qa.calciumMg;
  const todayIronMg = Math.round(todayFoodLogs.reduce((s, f) => s + (f.iron_mg ?? 0), 0)) + qa.ironMg;

  const loggedActiveCalories = Math.round(todayActivityLogs.reduce((s, a) => s + (a.active_calories ?? 0), 0));
  const loggedSteps = todayActivityLogs.reduce((s, a) => s + (a.steps ?? 0), 0);

  const todayProteinG = (loggedProteinG > 0 ? loggedProteinG : Math.round(hkStore.todayNutrition?.protein ?? 0)) + qa.proteinG;
  const todayFiberG = (loggedFiberG > 0 ? loggedFiberG : Math.round(hkStore.todayNutrition?.fiber ?? 0)) + qa.fiberG;
  const todayCarbsG = (loggedCarbsG > 0 ? loggedCarbsG : Math.round(hkStore.todayNutrition?.carbs ?? 0)) + qa.carbsG;
  const todayFatG = (loggedFatG > 0 ? loggedFatG : Math.round(hkStore.todayNutrition?.fat ?? 0)) + qa.fatG;
  const todayCalories = (loggedCalories > 0 ? loggedCalories : Math.round(hkStore.todayNutrition?.calories ?? 0)) + qa.calories;
  const todayActiveCalories = (loggedActiveCalories > 0 ? loggedActiveCalories : Math.round(hkStore.activeCalories ?? 0)) + qa.activeCal;
  const todaySteps = (loggedSteps > 0 ? loggedSteps : (hkStore.steps ?? 0)) + qa.steps;

  const hkWaterMl = hkStore.waterToday != null ? Math.round(hkStore.waterToday * 29.5735) : 0;
  const resolvedWaterMl = actuals.waterMl > 0 ? actuals.waterMl : hkWaterMl;
  const waterOz = Math.round(resolvedWaterMl / 29.57);
  const waterTargetOz = Math.round(targets.waterMl / 29.57);

  const proteinPct = targets.proteinG > 0 ? Math.round((todayProteinG / targets.proteinG) * 100) : 0;
  const fiberPct = targets.fiberG > 0 ? Math.round((todayFiberG / targets.fiberG) * 100) : 0;
  const carbsPct = targets.carbsG > 0 ? Math.round((todayCarbsG / targets.carbsG) * 100) : 0;
  const fatPct = targets.fatG > 0 ? Math.round((todayFatG / targets.fatG) * 100) : 0;
  const caloriesPct = targets.caloriesTarget > 0 ? Math.round((todayCalories / targets.caloriesTarget) * 100) : 0;
  const waterPct = targets.waterMl > 0 ? Math.round((resolvedWaterMl / targets.waterMl) * 100) : 0;

  const sodiumTargetMg = userGoals?.daily_sodium_mg_target ?? DEFAULT_SODIUM_MG;
  const sugarTargetG = userGoals?.daily_sugar_g_target ?? DEFAULT_SUGAR_G;
  const satFatTargetG = userGoals?.daily_saturated_fat_g_target ?? DEFAULT_SAT_FAT_G;
  const cholesterolTargetMg = userGoals?.daily_cholesterol_mg_target ?? DEFAULT_CHOLESTEROL_MG;

  const sodiumPct = sodiumTargetMg > 0 ? Math.round((todaySodiumMg / sodiumTargetMg) * 100) : 0;
  const sugarPct = sugarTargetG > 0 ? Math.round((todaySugarG / sugarTargetG) * 100) : 0;
  const satFatPct = satFatTargetG > 0 ? Math.round((todaySaturatedFatG / satFatTargetG) * 100) : 0;
  const cholesterolPct = cholesterolTargetMg > 0 ? Math.round((todayCholesterolMg / cholesterolTargetMg) * 100) : 0;

  // Extended nutrient targets (FDA Daily Values / dietary references — see log.tsx).
  const transFatTargetG = DEFAULT_TRANS_FAT_G;
  const polyFatTargetG = DEFAULT_POLY_FAT_G;
  const monoFatTargetG = DEFAULT_MONO_FAT_G;
  const potassiumTargetMg = DEFAULT_POTASSIUM_MG;
  const addedSugarsTargetG = DEFAULT_ADDED_SUGARS_G;
  const vitaminATargetMcg = DEFAULT_VITAMIN_A_MCG;
  const vitaminCTargetMg = DEFAULT_VITAMIN_C_MG;
  const vitaminDTargetMcg = DEFAULT_VITAMIN_D_MCG;
  const calciumTargetMg = DEFAULT_CALCIUM_MG;
  const ironTargetMg = DEFAULT_IRON_MG;

  const adjustMetric = useCallback((field: keyof QuickAdj, delta: number) => {
    adjust(field, delta);
    if (field === 'proteinG') health.dispatch({ type: 'LOG_PROTEIN', grams: delta });
    else if (field === 'fiberG') health.dispatch({ type: 'MERGE_ACTUALS', updates: { fiberG: health.actuals.fiberG + delta } });
    else if (field === 'steps') health.dispatch({ type: 'LOG_STEPS', steps: delta });
  }, [adjust, health]);

  const routedHealthGroups = useMemo<{
    activity: HealthMetricGroup[];
    vitals: HealthMetricGroup[];
    bodyComp: HealthMetricGroup[];
  }>(() => {
    if (!appleHealthEnabled) return { activity: [], vitals: [], bodyComp: [] };
    const rawGroups = buildHealthMetrics(hkStore);
    const filtered = isPremiumUser
      ? rawGroups
      : rawGroups
          .map(g => ({ ...g, metrics: g.metrics.filter(m => !PREMIUM_METRIC_IDS.has(m.id)) }))
          .filter(g => g.metrics.length > 0);
    return {
      activity: filtered.filter(g => g.category === 'Activity' || g.category === 'Workouts'),
      vitals: filtered.filter(g => g.category === 'Vitals' || g.category === 'Mindfulness' || g.category === 'Glucose (24h)'),
      bodyComp: filtered.filter(g => g.category === 'Body Composition'),
    };
  }, [appleHealthEnabled, hkStore, isPremiumUser]);

  return {
    // Today values
    todayProteinG, todayFiberG, todayCarbsG, todayFatG, todayCalories,
    todaySodiumMg, todaySugarG, todaySaturatedFatG, todayCholesterolMg,
    todayTransFatG, todayPolyFatG, todayMonoFatG, todayPotassiumMg, todayAddedSugarsG,
    todayVitaminAMcg, todayVitaminCMg, todayVitaminDMcg, todayCalciumMg, todayIronMg,
    todayActiveCalories, todaySteps,
    waterOz, waterTargetOz, resolvedWaterMl,
    // Targets
    targets,
    sodiumTargetMg, sugarTargetG, satFatTargetG, cholesterolTargetMg,
    transFatTargetG, polyFatTargetG, monoFatTargetG, potassiumTargetMg, addedSugarsTargetG,
    vitaminATargetMcg, vitaminCTargetMg, vitaminDTargetMcg, calciumTargetMg, ironTargetMg,
    // Percentages
    proteinPct, fiberPct, carbsPct, fatPct, caloriesPct, waterPct,
    sodiumPct, sugarPct, satFatPct, cholesterolPct,
    // Behavior
    adjustMetric,
    health,
    // HealthKit
    hkStore,
    routedHealthGroups,
    appleHealthEnabled,
  };
}
