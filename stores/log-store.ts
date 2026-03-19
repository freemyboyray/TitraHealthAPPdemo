import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { localDateStr } from '../lib/date-utils';

// ─── Convenience type aliases ─────────────────────────────────────────────────

export type WeightLog = Database['public']['Tables']['weight_logs']['Row'];
export type SideEffectLog = Database['public']['Tables']['side_effect_logs']['Row'];
export type InjectionLog = Database['public']['Tables']['injection_logs']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type FoodLog = Database['public']['Tables']['food_logs']['Row'];
export type FoodNoiseLog = Database['public']['Tables']['food_noise_logs']['Row'];
export type WeeklyCheckinRow = Database['public']['Tables']['weekly_checkins']['Row'];

export type SideEffectType = Database['public']['Enums']['side_effect_type'];
export type PhaseType = Database['public']['Enums']['phase_type'];
export type MealType = Database['public']['Enums']['meal_type'];
export type FoodSource = Database['public']['Enums']['food_source'];
export type ActivitySource = Database['public']['Enums']['activity_source'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type UserGoalsRow = Database['public']['Tables']['user_goals']['Row'];

// ─── Store ────────────────────────────────────────────────────────────────────

type LogStore = {
  loading: boolean;
  error: string | null;

  // ── Fetched data ──────────────────────────────────────────────────────────
  weightLogs: WeightLog[];
  injectionLogs: InjectionLog[];
  foodLogs: FoodLog[];
  activityLogs: ActivityLog[];
  sideEffectLogs: SideEffectLog[];
  foodNoiseLogs: FoodNoiseLog[];
  weeklyCheckins: Record<string, WeeklyCheckinRow[]>;
  profile: ProfileRow | null;
  userGoals: UserGoalsRow | null;

  fetchInsightsData: () => Promise<void>;

  // Weight - DB stores lbs
  addWeightLog: (weight_lbs: number, notes?: string) => Promise<void>;

  // Side effects - effect_type is enum, severity 1–10, phase required
  addSideEffectLog: (
    effect_type: SideEffectType,
    severity: number,
    phase_at_log: PhaseType,
    notes?: string,
  ) => Promise<void>;

  // Injection - medication + dose + site + batch + date/time
  addInjectionLog: (
    dose_mg: number,
    injection_date: string,
    injection_time?: string,
    site?: string,
    notes?: string,
    medication_name?: string,
    batch_number?: string,
  ) => Promise<void>;

  deleteInjectionLog: (id: string) => Promise<void>;

  // Activity - manual workout fields
  addActivityLog: (
    exercise_type: string,
    duration_min: number,
    intensity?: 'low' | 'moderate' | 'high',
    steps?: number,
    active_calories?: number,
  ) => Promise<void>;

  // Food - uses food_logs table (richer, with meal_type + source enums)
  addFoodLog: (entry: {
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    meal_type: MealType;
    source: FoodSource;
    barcode?: string;
    raw_ai_response?: object;
  }) => Promise<void>;

  // Food Noise Questionnaire (FNQ)
  addFoodNoiseLog: (params: {
    score: number;
    q1: number;
    q2: number;
    q3: number;
    q4: number;
    q5: number;
    program_week?: number;
    phase_at_log?: PhaseType;
  }) => Promise<void>;

  // Weekly Check-ins
  addWeeklyCheckin: (
    type: 'energy_mood' | 'appetite' | 'gi_burden' | 'activity_quality' | 'sleep_quality' | 'mental_health' | 'food_noise',
    answers: Record<string, number>,
    score: number,
    program_week?: number,
  ) => Promise<void>;
  fetchWeeklyCheckins: (type: 'energy_mood' | 'appetite' | 'gi_burden' | 'activity_quality' | 'sleep_quality' | 'mental_health' | 'food_noise') => Promise<void>;
  deleteWeeklyCheckinSession: (date: string) => Promise<void>;
};

export const useLogStore = create<LogStore>((set, get) => ({
  loading: false,
  error: null,

  // ── Initial fetch state ───────────────────────────────────────────────────
  weightLogs: [],
  injectionLogs: [],
  foodLogs: [],
  activityLogs: [],
  sideEffectLogs: [],
  foodNoiseLogs: [],
  weeklyCheckins: {},
  profile: null,
  userGoals: null,

  fetchInsightsData: async () => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false }); return; }
    const uid = user.id;

    const state = get();
    const programStart = state.profile?.program_start_date;
    const fallback = new Date(Date.now() - 365 * 86400000).toISOString();
    const since90d = programStart
      ? new Date(Math.min(new Date(programStart).getTime(), new Date(fallback).getTime())).toISOString()
      : fallback;
    const since1y  = since90d;

    try {
      const [w, inj, f, a, se, prof, goals, fn, wcEm, wcAp, wcGi, wcAq, wcSq, wcMh, wcFn] = await Promise.all([
        supabase.from('weight_logs').select('*').eq('user_id', uid).gte('logged_at', since1y).order('logged_at', { ascending: false }),
        supabase.from('injection_logs').select('*').eq('user_id', uid).order('injection_date', { ascending: false }).limit(20),
        supabase.from('food_logs').select('*').eq('user_id', uid).gte('logged_at', since90d).order('logged_at', { ascending: false }),
        supabase.from('activity_logs').select('*').eq('user_id', uid).gte('date', since90d.slice(0, 10)).order('date', { ascending: false }),
        supabase.from('side_effect_logs').select('*').eq('user_id', uid).order('logged_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('*').eq('id', uid).single(),
        supabase.from('user_goals').select('*').eq('user_id', uid).single(),
        supabase.from('food_noise_logs').select('*').eq('user_id', uid).order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'energy_mood').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'appetite').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'gi_burden').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'activity_quality').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'sleep_quality').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'mental_health').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'food_noise').order('logged_at', { ascending: false }).limit(12),
      ]);

      set({
        weightLogs:     w.data   ?? [],
        injectionLogs:  inj.data ?? [],
        foodLogs:       f.data   ?? [],
        activityLogs:   a.data   ?? [],
        sideEffectLogs: se.data  ?? [],
        foodNoiseLogs:  (fn.data ?? []) as FoodNoiseLog[],
        weeklyCheckins: {
          energy_mood:      (wcEm.data ?? []) as WeeklyCheckinRow[],
          appetite:         (wcAp.data ?? []) as WeeklyCheckinRow[],
          gi_burden:        (wcGi.data ?? []) as WeeklyCheckinRow[],
          activity_quality: (wcAq.data ?? []) as WeeklyCheckinRow[],
          sleep_quality:    (wcSq.data ?? []) as WeeklyCheckinRow[],
          mental_health:    (wcMh.data ?? []) as WeeklyCheckinRow[],
          food_noise:       (wcFn.data ?? []) as WeeklyCheckinRow[],
        },
        profile:        prof.data ?? null,
        userGoals:      goals.data ?? null,
        loading:        false,
        error:          w.error?.message ?? inj.error?.message ?? f.error?.message ?? null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to load data' });
    }
  },



  addWeightLog: async (weight_lbs, notes) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('weight_logs')
      .insert({ user_id: user.id, weight_lbs, notes: notes ?? null });
    if (!error) await get().fetchInsightsData();
    set({ loading: false, error: error?.message ?? null });
  },

  addSideEffectLog: async (effect_type, severity, phase_at_log, notes) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('side_effect_logs')
      .insert({ user_id: user.id, effect_type, severity, phase_at_log, notes: notes ?? null });
    if (!error) await get().fetchInsightsData();
    set({ loading: false, error: error?.message ?? null });
  },

  addInjectionLog: async (dose_mg, injection_date, injection_time, site, notes, medication_name, batch_number) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('injection_logs')
      .insert({
        user_id: user.id,
        dose_mg,
        injection_date,
        injection_time: injection_time ?? null,
        site: site ?? null,
        notes: notes ?? null,
        medication_name: medication_name ?? null,
        batch_number: batch_number ?? null,
      });
    if (!error) {
      await supabase.from('profiles').update({ last_injection_date: injection_date }).eq('id', user.id);
      await get().fetchInsightsData();
    }
    set({ loading: false, error: error?.message ?? null });
  },

  deleteInjectionLog: async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('injection_logs').delete().eq('id', id).eq('user_id', user.id);
    if (!error) {
      const remaining = get().injectionLogs.filter(l => l.id !== id);
      set({ injectionLogs: remaining });
      // Keep profiles.last_injection_date in sync with the new most-recent injection
      const newLastDate = remaining[0]?.injection_date ?? null;
      await supabase.from('profiles').update({ last_injection_date: newLastDate }).eq('id', user.id);
    }
  },

  addActivityLog: async (exercise_type, duration_min, intensity, steps, active_calories) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const today = localDateStr();
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        date: today,
        exercise_type,
        duration_min,
        intensity: intensity ?? null,
        source: 'manual',
        steps: steps ?? 0,
        active_calories: active_calories ?? 0,
      });
    if (!error) await get().fetchInsightsData();
    set({ loading: false, error: error?.message ?? null });
  },

  addFoodLog: async (entry) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('food_logs')
      .insert({
        ...entry,
        user_id: user.id,
        raw_ai_response: entry.raw_ai_response ?? null,
        barcode: entry.barcode ?? null,
      });
    if (!error) await get().fetchInsightsData();
    set({ loading: false, error: error?.message ?? null });
  },

  addFoodNoiseLog: async ({ score, q1, q2, q3, q4, q5, program_week, phase_at_log }) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('food_noise_logs')
      .insert({
        user_id: user.id,
        score,
        q1, q2, q3, q4, q5,
        program_week: program_week ?? null,
        phase_at_log: phase_at_log ?? null,
      });
    if (!error) {
      const { data } = await supabase
        .from('food_noise_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(12);
      set({ loading: false, error: null, foodNoiseLogs: (data ?? []) as FoodNoiseLog[] });
    } else {
      set({ loading: false, error: error.message });
    }
  },

  addWeeklyCheckin: async (type, answers, score, program_week) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('weekly_checkins' as any)
      .insert({
        user_id: user.id,
        checkin_type: type,
        score,
        answers,
        program_week: program_week ?? null,
      });
    if (!error) {
      // Refresh this checkin type's data
      const { data } = await supabase
        .from('weekly_checkins' as any)
        .select('*')
        .eq('user_id', user.id)
        .eq('checkin_type', type)
        .order('logged_at', { ascending: false })
        .limit(12);
      set(state => ({
        loading: false,
        error: null,
        weeklyCheckins: { ...state.weeklyCheckins, [type]: (data ?? []) as WeeklyCheckinRow[] },
      }));
    } else {
      set({ loading: false, error: error.message });
    }
  },

  deleteWeeklyCheckinSession: async (date: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd   = `${date}T23:59:59.999Z`;
    const { error } = await supabase
      .from('weekly_checkins' as any)
      .delete()
      .eq('user_id', user.id)
      .gte('logged_at', dayStart)
      .lte('logged_at', dayEnd);
    if (!error) {
      set(state => {
        const updated: Record<string, WeeklyCheckinRow[]> = {};
        for (const key of Object.keys(state.weeklyCheckins)) {
          updated[key] = state.weeklyCheckins[key].filter(r => !(r.logged_at as string).startsWith(date));
        }
        return { weeklyCheckins: updated };
      });
    }
  },

  fetchWeeklyCheckins: async (type) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('weekly_checkins' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('checkin_type', type)
      .order('logged_at', { ascending: false })
      .limit(12);
    set(state => ({
      weeklyCheckins: { ...state.weeklyCheckins, [type]: (data ?? []) as WeeklyCheckinRow[] },
    }));
  },
}));
