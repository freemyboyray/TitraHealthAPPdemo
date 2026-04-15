import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import { localDateStr } from '../lib/date-utils';
import { computePeerPercentile } from './insights-store';
import { BRAND_TO_GLP1_TYPE, type MedicationBrand } from '../constants/user-profile';

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

  // Peer comparison
  peerComparison: PeerComparisonData | null;
  fetchPeerComparison: () => Promise<void>;
  updatePeerOptIn: (optIn: boolean) => Promise<void>;
};

// ─── Streak helper (computed from already-fetched logs) ──────────────────────

/** Returns the number of consecutive days (ending today) that have at least one log entry. */
export function computeStreak(store: Pick<LogStore, 'weightLogs' | 'injectionLogs' | 'foodLogs' | 'activityLogs' | 'sideEffectLogs' | 'foodNoiseLogs'>): number {
  // Collect all log dates as YYYY-MM-DD strings
  const dates = new Set<string>();
  const toDate = (iso: string | null | undefined) => iso ? iso.slice(0, 10) : null;

  store.weightLogs.forEach(l => { const d = toDate(l.logged_at); if (d) dates.add(d); });
  store.injectionLogs.forEach(l => { const d = toDate(l.injection_date); if (d) dates.add(d); });
  store.foodLogs.forEach(l => { const d = toDate(l.logged_at); if (d) dates.add(d); });
  store.activityLogs.forEach(l => { const d = toDate(l.date); if (d) dates.add(d); });
  store.sideEffectLogs.forEach(l => { const d = toDate(l.logged_at); if (d) dates.add(d); });
  store.foodNoiseLogs.forEach(l => { const d = toDate(l.logged_at); if (d) dates.add(d); });

  // Walk backwards from today
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const key = d.toISOString().slice(0, 10);
    if (dates.has(key)) {
      streak++;
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export type PeerComparisonData = {
  percentile: number;
  cohortSize: number;
  medicationName: string;
  treatmentWeek: number;
  insufficientData: boolean;
};

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

      // Fetch peer comparison data if opted in (non-blocking)
      if (prof.data?.peer_comparison_opted_in) {
        get().fetchPeerComparison();
      }
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
    if (!error) {
      // Keep profile current_weight_lbs in sync with latest weigh-in
      await supabase.from('profiles').update({ current_weight_lbs: weight_lbs }).eq('id', user.id);
      await get().fetchInsightsData();
    }
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
      const { error: pErr } = await supabase
        .from('profiles')
        .update({ last_injection_date: injection_date })
        .eq('id', user.id);
      if (pErr) console.warn('addInjectionLog: profiles.update last_injection_date failed:', pErr);
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

  // ── Peer Comparison ──────────────────────────────────────────────────────
  peerComparison: null,

  fetchPeerComparison: async () => {
    const state = get();
    const profile = state.profile;
    if (!profile?.peer_comparison_opted_in) { set({ peerComparison: null }); return; }
    if (!profile.medication_brand || !profile.dose_mg || !profile.program_start_date || !profile.start_weight_lbs) {
      set({ peerComparison: null });
      return;
    }

    // Compute user's cohort params
    const medKey = BRAND_TO_GLP1_TYPE[(profile.medication_brand as MedicationBrand)] ?? 'other';
    const treatmentWeek = Math.max(1, Math.round(
      (Date.now() - new Date(profile.program_start_date).getTime()) / (7 * 86400000),
    ));
    // Bucket treatment week to match the materialized view
    let weekBucket: number;
    if (treatmentWeek <= 6)  weekBucket = 4;
    else if (treatmentWeek <= 10) weekBucket = 8;
    else if (treatmentWeek <= 16) weekBucket = 12;
    else if (treatmentWeek <= 24) weekBucket = 20;
    else if (treatmentWeek <= 32) weekBucket = 28;
    else if (treatmentWeek <= 44) weekBucket = 36;
    else weekBucket = 52;

    // Bucket dose
    const dm = profile.dose_mg;
    let doseTier: number;
    if (dm <= 0.375) doseTier = 0.25;
    else if (dm <= 0.75) doseTier = 0.5;
    else if (dm <= 1.5) doseTier = 1.0;
    else if (dm <= 2.2) doseTier = 2.0;
    else if (dm <= 3.5) doseTier = 2.4;
    else if (dm <= 6.25) doseTier = 5.0;
    else if (dm <= 8.75) doseTier = 7.5;
    else if (dm <= 11.25) doseTier = 10.0;
    else if (dm <= 13.75) doseTier = 12.5;
    else doseTier = 15.0;

    // User's weight loss %
    const latestWeight = state.weightLogs[0]?.weight_lbs;
    if (!latestWeight) { set({ peerComparison: null }); return; }
    const userLossPct = Math.round(((profile.start_weight_lbs - latestWeight) / profile.start_weight_lbs) * 1000) / 10;

    try {
      // Try exact cohort match first (medication + dose + week)
      let { data } = await supabase
        .from('peer_weight_loss_summary' as any)
        .select('*')
        .eq('medication_name', medKey)
        .eq('dose_tier', doseTier)
        .eq('treatment_week_bucket', weekBucket)
        .single();

      // Fallback: wider match (medication + week only, ignoring dose)
      if (!data || (data as any).cohort_size < 50) {
        const wider = await supabase
          .from('peer_weight_loss_summary' as any)
          .select('*')
          .eq('medication_name', medKey)
          .eq('treatment_week_bucket', weekBucket);
        // Aggregate across dose tiers
        if (wider.data && wider.data.length > 0) {
          const totalSize = wider.data.reduce((s: number, r: any) => s + r.cohort_size, 0);
          if (totalSize >= 50) {
            // Weighted average of percentiles
            const wP25 = wider.data.reduce((s: number, r: any) => s + r.p25 * r.cohort_size, 0) / totalSize;
            const wP50 = wider.data.reduce((s: number, r: any) => s + r.p50 * r.cohort_size, 0) / totalSize;
            const wP75 = wider.data.reduce((s: number, r: any) => s + r.p75 * r.cohort_size, 0) / totalSize;
            data = { p25: wP25, p50: wP50, p75: wP75, cohort_size: totalSize, medication_name: medKey, treatment_week_bucket: weekBucket } as any;
          }
        }
      }

      if (!data || (data as any).cohort_size < 50) {
        set({
          peerComparison: {
            percentile: 0,
            cohortSize: (data as any)?.cohort_size ?? 0,
            medicationName: medKey,
            treatmentWeek: weekBucket,
            insufficientData: true,
          },
        });
        return;
      }

      const row = data as any;
      const percentile = computePeerPercentile(userLossPct, row.p25, row.p50, row.p75);

      set({
        peerComparison: {
          percentile,
          cohortSize: row.cohort_size,
          medicationName: medKey,
          treatmentWeek: weekBucket,
          insufficientData: false,
        },
      });
    } catch {
      set({ peerComparison: null });
    }
  },

  updatePeerOptIn: async (optIn: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      peer_comparison_opted_in: optIn,
      peer_comparison_opted_in_at: optIn ? new Date().toISOString() : null,
    }).eq('id', user.id);
    if (error) {
      console.warn('updatePeerOptIn: profiles.update failed:', error);
      return; // bail before refresh — local state would be misleading
    }
    // Refresh profile
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    set({ profile: prof ?? get().profile });
    if (optIn) await get().fetchPeerComparison();
    else set({ peerComparison: null });
  },
}));
