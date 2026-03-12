import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { computePersonalizedPlan, mergeProfileData, type PersonalizedPlan, type FullUserProfileForPlan } from '@/lib/personalization';
import { useLogStore } from './log-store';
import { useHealthKitStore } from './healthkit-store';
import type { DailyActuals, WearableData } from '@/constants/scoring';

type PersonalizationStore = {
  plan: PersonalizedPlan | null;
  loading: boolean;
  lastComputedAt: string | null;
  // Synchronous recompute — used after local log actions with fresh actuals/wearable
  recompute: (actuals: DailyActuals, wearable: Partial<WearableData>) => void;
  // Fetch fresh data then recompute
  fetchAndRecompute: () => Promise<void>;
};

export const usePersonalizationStore = create<PersonalizationStore>((set, get) => ({
  plan: null,
  loading: false,
  lastComputedAt: null,

  recompute: (actuals: DailyActuals, wearable: Partial<WearableData>) => {
    const logState = useLogStore.getState();
    const hkState  = useHealthKitStore.getState();

    if (!logState.profile) return;

    const mergedWearable: Partial<WearableData> = {
      sleepMinutes: hkState.sleepHours != null ? Math.round(hkState.sleepHours * 60) : wearable.sleepMinutes,
      hrvMs:        hkState.hrv        ?? wearable.hrvMs,
      restingHR:    hkState.restingHR  ?? wearable.restingHR,
      spo2Pct:      wearable.spo2Pct,
    };

    const profile = mergeProfileData(logState.profile, {});

    const plan = computePersonalizedPlan({
      profile,
      wearable: mergedWearable,
      actuals,
      injectionLogs:  logState.injectionLogs,
      sideEffectLogs: logState.sideEffectLogs,
      weightLogs:     logState.weightLogs,
      foodLogs:       logState.foodLogs,
      activityLogs:   logState.activityLogs,
      userGoals:      logState.userGoals,
      profileRow:     logState.profile,
      userName:          logState.profile.full_name ?? null,
      foodNoiseLogs:     (logState as any).foodNoiseLogs ?? [],
      weeklyCheckinLogs: (logState as any).weeklyCheckins ?? {},
    });

    set({ plan, lastComputedAt: new Date().toISOString() });
  },

  fetchAndRecompute: async () => {
    set({ loading: true });
    try {
      const logStore = useLogStore.getState();
      const hkStore  = useHealthKitStore.getState();

      await Promise.all([
        logStore.fetchInsightsData(),
        hkStore.fetchAll(),
      ]);

      const freshLogState = useLogStore.getState();
      const freshHkState  = useHealthKitStore.getState();

      if (!freshLogState.profile) { set({ loading: false }); return; }

      // Fetch food noise logs + weekly checkins
      const { data: { user } } = await supabase.auth.getUser();
      let foodNoiseLogs: PersonalizedPlan['focuses'] = [];
      let weeklyCheckinLogs: Record<string, Array<{ score: number; logged_at: string }>> = {};
      if (user) {
        const [fnResult, emResult, apResult] = await Promise.all([
          supabase
            .from('food_noise_logs' as any)
            .select('id, score, logged_at, program_week')
            .eq('user_id', user.id)
            .order('logged_at', { ascending: false })
            .limit(12),
          supabase
            .from('weekly_checkins' as any)
            .select('id, score, logged_at, checkin_type')
            .eq('user_id', user.id)
            .eq('checkin_type', 'energy_mood')
            .order('logged_at', { ascending: false })
            .limit(12),
          supabase
            .from('weekly_checkins' as any)
            .select('id, score, logged_at, checkin_type')
            .eq('user_id', user.id)
            .eq('checkin_type', 'appetite')
            .order('logged_at', { ascending: false })
            .limit(12),
        ]);
        foodNoiseLogs = (fnResult.data ?? []) as any;
        weeklyCheckinLogs = {
          energy_mood: (emResult.data ?? []) as any,
          appetite:    (apResult.data ?? []) as any,
        };
      }

      const wearable: Partial<WearableData> = {
        sleepMinutes: freshHkState.sleepHours != null ? Math.round(freshHkState.sleepHours * 60) : undefined,
        hrvMs:        freshHkState.hrv        ?? undefined,
        restingHR:    freshHkState.restingHR  ?? undefined,
        spo2Pct:      undefined,
      };

      const actuals: DailyActuals = {
        proteinG:         (freshLogState.foodLogs ?? [])
          .filter(f => f.logged_at?.startsWith(new Date().toISOString().split('T')[0]))
          .reduce((s, f) => s + (f.protein_g ?? 0), 0),
        waterMl:          1100, // TODO: wire water log table
        fiberG:           (freshLogState.foodLogs ?? [])
          .filter(f => f.logged_at?.startsWith(new Date().toISOString().split('T')[0]))
          .reduce((s, f) => s + (f.fiber_g ?? 0), 0),
        steps:            (freshLogState.activityLogs ?? [])
          .filter(a => a.date === new Date().toISOString().split('T')[0])
          .reduce((s, a) => s + (a.steps ?? 0), 0),
        injectionLogged:  (freshLogState.injectionLogs ?? [])
          .some(i => i.injection_date === new Date().toISOString().split('T')[0]),
      };

      const profile = mergeProfileData(freshLogState.profile, {});

      const plan = computePersonalizedPlan({
        profile,
        wearable,
        actuals,
        injectionLogs:  freshLogState.injectionLogs,
        sideEffectLogs: freshLogState.sideEffectLogs,
        weightLogs:     freshLogState.weightLogs,
        foodLogs:       freshLogState.foodLogs,
        activityLogs:   freshLogState.activityLogs,
        userGoals:      freshLogState.userGoals,
        profileRow:     freshLogState.profile,
        userName:          freshLogState.profile.full_name ?? null,
        foodNoiseLogs:     foodNoiseLogs as any,
        weeklyCheckinLogs: (freshLogState as any).weeklyCheckins ?? {},
      });

      set({ plan, loading: false, lastComputedAt: new Date().toISOString() });
    } catch (e) {
      set({ loading: false });
    }
  },
}));
