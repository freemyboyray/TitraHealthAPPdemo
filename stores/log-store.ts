import { Alert, Platform } from 'react-native';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { localDateStr } from '../lib/date-utils';
import { BRAND_DISPLAY_NAMES } from '../constants/user-profile';
import { useSubscriptionStore } from './subscription-store';


// ─── Convenience type aliases ─────────────────────────────────────────────────

export type WeightLog = Database['public']['Tables']['weight_logs']['Row'];
export type SideEffectLog = Database['public']['Tables']['side_effect_logs']['Row'];
export type InjectionLog = Database['public']['Tables']['injection_logs']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type FoodLog = Database['public']['Tables']['food_logs']['Row'];
export type FoodNoiseLog = Database['public']['Tables']['food_noise_logs']['Row'];
export type WeeklyCheckinRow = Database['public']['Tables']['weekly_checkins']['Row'];
export type EnergyLog = Database['public']['Tables']['energy_logs']['Row'];
export type WeeklySummaryRow = Database['public']['Tables']['weekly_summaries']['Row'];

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
  energyLogs: EnergyLog[];
  weeklySummaries: WeeklySummaryRow[];
  profile: ProfileRow | null;
  userGoals: UserGoalsRow | null;

  /** Reset all in-memory state (called on sign-out to prevent stale data bleeding into the next account). */
  resetAll: () => void;
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
  deleteFoodLog: (id: string) => Promise<void>;
  deleteActivityLog: (id: string) => Promise<void>;
  deleteSideEffectLog: (id: string) => Promise<void>;

  updateInjectionLog: (id: string, fields: { dose_mg?: number; injection_date?: string; site?: string | null; notes?: string | null; medication_name?: string; batch_number?: string | null }) => Promise<void>;
  updateWeightLog: (id: string, fields: { weight_lbs?: number; notes?: string | null }) => Promise<void>;
  updateFoodLog: (id: string, fields: { food_name?: string; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; fiber_g?: number; meal_type?: MealType }) => Promise<void>;
  updateActivityLog: (id: string, fields: { exercise_type?: string; duration_min?: number; intensity?: 'low' | 'moderate' | 'high' | null; steps?: number; active_calories?: number }) => Promise<void>;
  updateSideEffectLog: (id: string, fields: { severity?: number; notes?: string | null }) => Promise<void>;

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
    trans_fat_g?: number;
    polyunsaturated_fat_g?: number;
    monounsaturated_fat_g?: number;
    potassium_mg?: number;
    added_sugars_g?: number;
    vitamin_a_mcg?: number;
    vitamin_c_mg?: number;
    vitamin_d_mcg?: number;
    calcium_mg?: number;
    iron_mg?: number;
    // FatSecret Premier enrichments. Allergen/preference flags are ternary
    // (1 = contains/yes, 0 = does not contain/no, -1 = unknown).
    image_url?: string;
    allergens?: Record<string, number>;
    preferences?: Record<string, number>;
    fatsecret_food_id?: number;
    fatsecret_category_name?: string;
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

  // Energy logs
  addEnergyLog: (
    level: number,
    time_slot: string,
    note?: string,
    phase_at_log?: string,
    program_week?: number,
  ) => Promise<void>;
  deleteEnergyLog: (id: string) => Promise<void>;

  // Weekly summaries
  fetchWeeklySummaries: () => Promise<void>;
  upsertWeeklySummary: (params: {
    window_start: string;
    window_end: string;
    summary_data: unknown;
    ai_insight: string | null;
  }) => Promise<void>;

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

export function computeStreak(store: Pick<LogStore, 'weightLogs' | 'injectionLogs' | 'foodLogs' | 'activityLogs' | 'sideEffectLogs' | 'foodNoiseLogs' | 'energyLogs'>): number {
  // Collect all log dates as local YYYY-MM-DD strings
  const dates = new Set<string>();

  store.weightLogs.forEach(l => { const d = isoToLocalDate(l.logged_at); if (d) dates.add(d); });
  store.injectionLogs.forEach(l => { const d = isoToLocalDate(l.injection_date); if (d) dates.add(d); });
  store.foodLogs.forEach(l => { const d = isoToLocalDate(l.logged_at); if (d) dates.add(d); });
  store.activityLogs.forEach(l => { const d = isoToLocalDate(l.date); if (d) dates.add(d); });
  store.sideEffectLogs.forEach(l => { const d = isoToLocalDate(l.logged_at); if (d) dates.add(d); });
  store.foodNoiseLogs.forEach(l => { const d = isoToLocalDate(l.logged_at); if (d) dates.add(d); });
  store.energyLogs.forEach(l => { const d = isoToLocalDate(l.logged_at); if (d) dates.add(d); });

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
  energyLogs: [],
  weeklyCheckins: {},
  weeklySummaries: [],
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
      const [w, inj, f, a, se, prof, goals, fn, en, wcEm, wcAp, wcGi, wcAq, wcSq, wcMh, wcFn, ws] = await Promise.all([
        supabase.from('weight_logs').select('*').eq('user_id', uid).gte('logged_at', since1y).order('logged_at', { ascending: false }),
        supabase.from('injection_logs').select('*').eq('user_id', uid).order('injection_date', { ascending: false }).limit(20),
        supabase.from('food_logs').select('*').eq('user_id', uid).gte('logged_at', since90d).order('logged_at', { ascending: false }),
        supabase.from('activity_logs').select('*').eq('user_id', uid).gte('date', since90d.slice(0, 10)).order('date', { ascending: false }),
        supabase.from('side_effect_logs').select('*').eq('user_id', uid).order('logged_at', { ascending: false }).limit(50),
        supabase.from('profiles').select('*').eq('id', uid).single(),
        supabase.from('user_goals').select('*').eq('user_id', uid).single(),
        supabase.from('food_noise_logs').select('*').eq('user_id', uid).order('logged_at', { ascending: false }).limit(12),
        supabase.from('energy_logs' as any).select('*').eq('user_id', uid).gte('logged_at', since90d).order('logged_at', { ascending: false }).limit(90),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'energy_mood').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'appetite').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'gi_burden').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'activity_quality').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'sleep_quality').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'mental_health').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_checkins' as any).select('*').eq('user_id', uid).eq('checkin_type', 'food_noise').order('logged_at', { ascending: false }).limit(12),
        supabase.from('weekly_summaries').select('*').eq('user_id', uid).order('window_end', { ascending: false }).limit(26),
      ]);

      const weightLogsData = w.data ?? [];
      const profileData = prof.data ?? null;
      // Self-heal: profiles.current_weight_lbs can drift stale if weight rows were
      // inserted outside addWeightLog (onboarding seed, legacy/manual imports), so
      // the stored value stays at the start weight while the logs move on. Every
      // weigh-in path reconciles, but pre-existing data never gets corrected —
      // realign it here to the newest log so all consumers of current_weight_lbs
      // (home card, Progress page, AI context) agree.
      const newestLoggedWeight = weightLogsData[0]?.weight_lbs ?? null;
      let reconciledProfile = profileData;
      if (
        profileData &&
        newestLoggedWeight != null &&
        (profileData.current_weight_lbs == null ||
          Math.abs(profileData.current_weight_lbs - newestLoggedWeight) >= 0.05)
      ) {
        reconciledProfile = { ...profileData, current_weight_lbs: newestLoggedWeight };
        // Fire-and-forget; a failure just means we retry the heal on the next load.
        supabase
          .from('profiles')
          .update({ current_weight_lbs: newestLoggedWeight })
          .eq('id', uid)
          .then(() => {}, () => {});
      }

      set({
        weightLogs:     weightLogsData,
        injectionLogs:  inj.data ?? [],
        foodLogs:       f.data   ?? [],
        activityLogs:   a.data   ?? [],
        sideEffectLogs: se.data  ?? [],
        foodNoiseLogs:  (fn.data ?? []) as FoodNoiseLog[],
        energyLogs:     (en.data ?? []) as EnergyLog[],
        weeklyCheckins: {
          energy_mood:      (wcEm.data ?? []) as WeeklyCheckinRow[],
          appetite:         (wcAp.data ?? []) as WeeklyCheckinRow[],
          gi_burden:        (wcGi.data ?? []) as WeeklyCheckinRow[],
          activity_quality: (wcAq.data ?? []) as WeeklyCheckinRow[],
          sleep_quality:    (wcSq.data ?? []) as WeeklyCheckinRow[],
          mental_health:    (wcMh.data ?? []) as WeeklyCheckinRow[],
          food_noise:       (wcFn.data ?? []) as WeeklyCheckinRow[],
        },
        weeklySummaries: (ws.data ?? []) as WeeklySummaryRow[],
        profile:        reconciledProfile,
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
      // Keep profile.current_weight_lbs aligned with the most recent log by
      // logged_at — not the value we just inserted. Otherwise a backdated entry
      // (HK sync, onboarding seed, manual edit with past date) would silently
      // overwrite the legitimate current weight with an older reading.
      const { data: latestLog } = await supabase
        .from('weight_logs')
        .select('weight_lbs')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestLog?.weight_lbs != null) {
        await supabase.from('profiles').update({ current_weight_lbs: latestLog.weight_lbs }).eq('id', user.id);
      }
      await get().fetchInsightsData();
    }
    set({ loading: false, error: error?.message ?? null });
  },

  fetchWeeklySummaries: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('window_end', { ascending: false })
      .limit(26);
    set({ weeklySummaries: (data ?? []) as WeeklySummaryRow[] });
  },

  upsertWeeklySummary: async ({ window_start, window_end, summary_data, ai_insight }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('weekly_summaries')
      .upsert({
        user_id: user.id,
        window_start,
        window_end,
        summary_data: summary_data as any,
        ai_insight,
      }, { onConflict: 'user_id,window_end' });
    if (error) {
      console.warn('upsertWeeklySummary failed:', error.message);
      return;
    }
    await get().fetchWeeklySummaries();
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
        // Same guard as addWeightLog: reconcile current_weight_lbs against the
        // latest log by logged_at, in case the HK sample was backdated.
        const { data: latestAfterInsert } = await supabase
          .from('weight_logs')
          .select('weight_lbs')
          .eq('user_id', user.id)
          .order('logged_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestAfterInsert?.weight_lbs != null) {
          await supabase.from('profiles').update({ current_weight_lbs: latestAfterInsert.weight_lbs }).eq('id', user.id);
        }
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
    // Stamp the active medication + dose so side effects can be read in the
    // context of the regimen at log time (e.g. did nausea improve after a
    // dose/med change). During a washout the profile still holds the med the
    // user just came off — the correct attribution for residual effects.
    let medication_name: string | null = null;
    let dose_mg: number | null = null;
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('medication_brand, dose_mg, treatment_status')
        .eq('id', user.id)
        .maybeSingle();
      if (prof && prof.treatment_status === 'on') {
        medication_name = prof.medication_brand
          ? (BRAND_DISPLAY_NAMES[prof.medication_brand as keyof typeof BRAND_DISPLAY_NAMES] ?? prof.medication_brand)
          : null;
        dose_mg = prof.dose_mg ?? null;
      }
    } catch {
      // Non-fatal: log the side effect without medication context.
    }
    const { error } = await supabase
      .from('side_effect_logs')
      .insert({ user_id: user.id, effect_type, severity, phase_at_log, notes: notes ?? null, medication_name, dose_mg });
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

    // Check usage limit for free users (query DB for accurate today count)
    const { isPremium, loaded: subLoaded } = useSubscriptionStore.getState();
    if (subLoaded && !isPremium) {
      // Use local date string (YYYY-MM-DD) to build UTC midnight boundary
      // so the count window matches the user's calendar day
      const todayISO = localDateStr(new Date()) + 'T00:00:00';
      const { count, error: countErr } = await supabase
        .from('food_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('logged_at', todayISO);
      if (countErr) {
        console.warn('[addFoodLog] count query failed:', countErr.message);
        // Fail closed — block if we can't verify
        set({ loading: false, error: 'Unable to verify daily limit' });
        return;
      }
      if ((count ?? 0) >= 5) {
        Alert.alert(
          'Daily limit reached',
          "You've used all 5 free food logs for today. Upgrade to Titra Pro for unlimited logging.",
          [{ text: 'OK' }],
        );
        set({ loading: false, error: 'FOOD_LOG_LIMIT' });
        return;
      }
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
        trans_fat_g: entry.trans_fat_g ?? null,
        polyunsaturated_fat_g: entry.polyunsaturated_fat_g ?? null,
        monounsaturated_fat_g: entry.monounsaturated_fat_g ?? null,
        potassium_mg: entry.potassium_mg ?? null,
        added_sugars_g: entry.added_sugars_g ?? null,
        vitamin_a_mcg: entry.vitamin_a_mcg ?? null,
        vitamin_c_mg: entry.vitamin_c_mg ?? null,
        vitamin_d_mcg: entry.vitamin_d_mcg ?? null,
        calcium_mg: entry.calcium_mg ?? null,
        iron_mg: entry.iron_mg ?? null,
        image_url: entry.image_url ?? null,
        allergens: entry.allergens ?? null,
        preferences: entry.preferences ?? null,
        fatsecret_food_id: entry.fatsecret_food_id ?? null,
        fatsecret_category_name: entry.fatsecret_category_name ?? null,
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

  deleteFoodLog: async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('food_logs').delete().eq('id', id).eq('user_id', user.id);
    if (!error) set({ foodLogs: get().foodLogs.filter(l => l.id !== id) });
  },

  deleteActivityLog: async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('activity_logs').delete().eq('id', id).eq('user_id', user.id);
    if (!error) set({ activityLogs: get().activityLogs.filter(l => l.id !== id) });
  },

  deleteSideEffectLog: async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('side_effect_logs').delete().eq('id', id).eq('user_id', user.id);
    if (!error) set({ sideEffectLogs: get().sideEffectLogs.filter(l => l.id !== id) });
  },

  addEnergyLog: async (level, time_slot, note, phase_at_log, program_week) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('energy_logs' as any)
      .insert({ user_id: user.id, level, time_slot, note: note ?? null, phase_at_log: phase_at_log ?? null, program_week: program_week ?? null });
    if (!error) await get().fetchInsightsData();
    set({ loading: false, error: error?.message ?? null });
  },

  deleteEnergyLog: async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('energy_logs' as any).delete().eq('id', id).eq('user_id', user.id);
    if (!error) set({ energyLogs: get().energyLogs.filter(l => l.id !== id) });
  },

  updateInjectionLog: async (id, fields) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('injection_logs').update(fields).eq('id', id).eq('user_id', user.id);
    if (!error) await get().fetchInsightsData();
  },

  updateWeightLog: async (id, fields) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('weight_logs').update(fields).eq('id', id).eq('user_id', user.id);
    if (!error) await get().fetchInsightsData();
  },

  updateFoodLog: async (id, fields) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('food_logs').update(fields).eq('id', id).eq('user_id', user.id);
    if (!error) await get().fetchInsightsData();
  },

  updateActivityLog: async (id, fields) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('activity_logs').update(fields).eq('id', id).eq('user_id', user.id);
    if (!error) await get().fetchInsightsData();
  },

  updateSideEffectLog: async (id, fields) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('side_effect_logs').update(fields).eq('id', id).eq('user_id', user.id);
    if (!error) await get().fetchInsightsData();
  },

  resetAll: () => set({
    loading: false,
    hydrated: false,
    error: null,
    weightLogs: [],
    injectionLogs: [],
    foodLogs: [],
    activityLogs: [],
    sideEffectLogs: [],
    foodNoiseLogs: [],
    energyLogs: [],
    weeklyCheckins: {},
    weeklySummaries: [],
    profile: null,
    userGoals: null,
  }),

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
