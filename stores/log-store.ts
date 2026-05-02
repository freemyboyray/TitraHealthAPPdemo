import { Alert, Platform } from 'react-native';
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

// ─── Body composition input (optional fields for weight logs) ────────────────

export type BodyCompositionInput = {
  body_fat_pct?: number;
  lean_mass_lbs?: number;
  muscle_mass_lbs?: number;
  bone_mass_lbs?: number;
  body_water_pct?: number;
  visceral_fat_level?: number;
  bmr_kcal?: number;
  waist_inches?: number;
  source?: 'manual' | 'healthkit';
};

// ─── Store ────────────────────────────────────────────────────────────────────

type LogStore = {
  loading: boolean;
  hydrated: boolean;
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
  addWeightLog: (weight_lbs: number, bodyComp?: BodyCompositionInput, notes?: string) => Promise<void>;

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
  ) => Promise<boolean>;

  deleteInjectionLog: (id: string) => Promise<void>;
  deleteWeightLog: (id: string) => Promise<void>;

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
    // Extended nutrition fields (scaled to logged serving). All optional.
    saturated_fat_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
    cholesterol_mg?: number;
    // FatSecret Premier enrichments. Allergen/preference flags are ternary
    // (1 = contains/yes, 0 = does not contain/no, -1 = unknown).
    image_url?: string;
    allergens?: Record<string, number>;
    preferences?: Record<string, number>;
    fatsecret_food_id?: number;
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

  // Apple Health weight sync — imports latest weight sample if newer than last log
  syncWeightFromHealthKit: () => Promise<void>;
};

// ─── Streak helper (computed from already-fetched logs) ──────────────────────

/** Returns the number of consecutive days (ending today) that have at least one log entry. */
/** Format a Date as YYYY-MM-DD in the user's local timezone. */
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse an ISO timestamp string to a local YYYY-MM-DD key. */
function isoToLocalDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return localDateKey(new Date(iso));
}

export function computeStreak(store: Pick<LogStore, 'weightLogs' | 'injectionLogs' | 'foodLogs' | 'activityLogs' | 'sideEffectLogs' | 'foodNoiseLogs'>): number {
  // Collect all log dates as local YYYY-MM-DD strings
  const dates = new Set<string>();

  store.weightLogs.forEach(l => { const d = isoToLocalDate(l.logged_at); if (d) dates.add(d); });
  store.injectionLogs.forEach(l => { const d = isoToLocalDate(l.injection_date); if (d) dates.add(d); });
  store.foodLogs.forEach(l => { const d = isoToLocalDate(l.logged_at); if (d) dates.add(d); });
  store.activityLogs.forEach(l => { const d = isoToLocalDate(l.date); if (d) dates.add(d); });
  store.sideEffectLogs.forEach(l => { const d = isoToLocalDate(l.logged_at); if (d) dates.add(d); });
  store.foodNoiseLogs.forEach(l => { const d = isoToLocalDate(l.logged_at); if (d) dates.add(d); });

  // Walk backwards from today using local dates
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = localDateKey(d);
    if (dates.has(key)) {
      streak++;
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}


export const useLogStore = create<LogStore>((set, get) => ({
  loading: false,
  hydrated: false,
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
        hydrated:       true,
        error:          w.error?.message ?? inj.error?.message ?? f.error?.message ?? null,
      });

    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Failed to load data' });
    }
  },



  addWeightLog: async (weight_lbs, bodyComp, notes) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('weight_logs')
      .insert({
        user_id: user.id,
        weight_lbs,
        notes: notes ?? null,
        ...(bodyComp && {
          body_fat_pct: bodyComp.body_fat_pct ?? null,
          lean_mass_lbs: bodyComp.lean_mass_lbs ?? null,
          muscle_mass_lbs: bodyComp.muscle_mass_lbs ?? null,
          bone_mass_lbs: bodyComp.bone_mass_lbs ?? null,
          body_water_pct: bodyComp.body_water_pct ?? null,
          visceral_fat_level: bodyComp.visceral_fat_level ?? null,
          bmr_kcal: bodyComp.bmr_kcal ?? null,
          waist_inches: bodyComp.waist_inches ?? null,
          source: bodyComp.source ?? 'manual',
        }),
      });
    if (!error) {
      // Keep profile current_weight_lbs in sync with latest weigh-in
      await supabase.from('profiles').update({ current_weight_lbs: weight_lbs }).eq('id', user.id);
      await get().fetchInsightsData();
    }
    set({ loading: false, error: error?.message ?? null });
  },

  syncWeightFromHealthKit: async () => {
    if (Platform.OS !== 'ios') return;
    try {
      // Dynamic import to avoid crashes in Expo Go
      const HK = require('../lib/healthkit') as typeof import('../lib/healthkit');
      const sample = await HK.readLatestWeightSample();
      if (!sample) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if we already have a weight log at or after this sample's timestamp
      const latestLog = get().weightLogs[0]; // sorted desc by logged_at
      if (latestLog) {
        const logTime = new Date(latestLog.logged_at).getTime();
        const sampleTime = sample.recordedAt.getTime();
        // Skip if our latest log is newer than or equal to the HK sample
        if (logTime >= sampleTime) return;
        // Skip if weight is identical (avoids re-logging the same reading)
        if (Math.abs(latestLog.weight_lbs - sample.lbs) < 0.05) return;
      }

      // Insert the Apple Health weight as a new log
      const { error } = await supabase.from('weight_logs').insert({
        user_id: user.id,
        weight_lbs: sample.lbs,
        logged_at: sample.recordedAt.toISOString(),
        notes: 'Synced from Apple Health',
      });
      if (!error) {
        await supabase.from('profiles').update({ current_weight_lbs: sample.lbs }).eq('id', user.id);
        await get().fetchInsightsData();
      }
    } catch {
      // HealthKit unavailable (Expo Go, Android) — silently skip
    }
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
    if (!user) {
      // Demo mode: create a local-only entry so the UI updates
      const localEntry: InjectionLog = {
        id: `demo_${Date.now()}`,
        user_id: 'demo',
        dose_mg,
        injection_date,
        injection_time: injection_time ?? null,
        site: site ?? null,
        notes: notes ?? null,
        medication_name: medication_name ?? null,
        batch_number: batch_number ?? null,
        created_at: new Date().toISOString(),
      };
      set((state) => ({
        loading: false,
        injectionLogs: [localEntry, ...state.injectionLogs],
      }));
      return true;
    }
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
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ last_injection_date: injection_date })
        .eq('id', user.id);
      if (pErr) console.warn('addInjectionLog: profiles.update last_injection_date failed:', pErr);
      await get().fetchInsightsData();
    }
    set({ loading: false, error: error?.message ?? null });
    return !error;
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
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ last_injection_date: newLastDate })
        .eq('id', user.id);
      if (pErr) console.warn('deleteInjectionLog: profiles.update last_injection_date failed:', pErr);
    }
  },

  deleteWeightLog: async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('weight_logs').delete().eq('id', id).eq('user_id', user.id);
    if (!error) {
      set({ weightLogs: get().weightLogs.filter(l => l.id !== id) });
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

    // Check usage limit for free users
    const { data: usageResult, error: usageErr } = await supabase.rpc('check_and_increment_usage', {
      p_user_id: user.id,
      p_feature_key: 'food_log',
      p_limit: 5,
    });
    if (!usageErr && usageResult && !(usageResult as { allowed: boolean }).allowed) {
      Alert.alert(
        'Daily limit reached',
        'You\'ve used all 5 free food logs for today. Upgrade to Titra Pro for unlimited logging.',
        [{ text: 'OK' }],
      );
      set({ loading: false, error: 'FOOD_LOG_LIMIT' });
      return;
    }

    const { error } = await supabase
      .from('food_logs')
      .insert({
        ...entry,
        user_id: user.id,
        raw_ai_response: entry.raw_ai_response ?? null,
        barcode: entry.barcode ?? null,
        saturated_fat_g: entry.saturated_fat_g ?? null,
        sugar_g: entry.sugar_g ?? null,
        sodium_mg: entry.sodium_mg ?? null,
        cholesterol_mg: entry.cholesterol_mg ?? null,
        image_url: entry.image_url ?? null,
        allergens: entry.allergens ?? null,
        preferences: entry.preferences ?? null,
        fatsecret_food_id: entry.fatsecret_food_id ?? null,
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
