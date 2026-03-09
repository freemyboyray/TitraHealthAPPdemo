import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

// ─── Convenience type aliases ─────────────────────────────────────────────────

export type WeightLog = Database['public']['Tables']['weight_logs']['Row'];
export type SideEffectLog = Database['public']['Tables']['side_effect_logs']['Row'];
export type InjectionLog = Database['public']['Tables']['injection_logs']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];
export type FoodLog = Database['public']['Tables']['food_logs']['Row'];

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
  profile: ProfileRow | null;
  userGoals: UserGoalsRow | null;

  fetchInsightsData: () => Promise<void>;

  // Weight — DB stores lbs
  addWeightLog: (weight_lbs: number, notes?: string) => Promise<void>;

  // Side effects — effect_type is enum, severity 1–10, phase required
  addSideEffectLog: (
    effect_type: SideEffectType,
    severity: number,
    phase_at_log: PhaseType,
    notes?: string,
  ) => Promise<void>;

  // Injection — medication + dose + site + batch + date/time
  addInjectionLog: (
    dose_mg: number,
    injection_date: string,
    injection_time?: string,
    site?: string,
    notes?: string,
    medication_name?: string,
    batch_number?: string,
  ) => Promise<void>;

  // Activity — manual workout fields
  addActivityLog: (
    exercise_type: string,
    duration_min: number,
    intensity?: 'low' | 'moderate' | 'high',
  ) => Promise<void>;

  // Food — uses food_logs table (richer, with meal_type + source enums)
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
};

export const useLogStore = create<LogStore>((set) => ({
  loading: false,
  error: null,

  // ── Initial fetch state ───────────────────────────────────────────────────
  weightLogs: [],
  injectionLogs: [],
  foodLogs: [],
  activityLogs: [],
  sideEffectLogs: [],
  profile: null,
  userGoals: null,

  fetchInsightsData: async () => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false }); return; }
    const uid = user.id;

    const since90d = new Date(Date.now() - 90 * 86400000).toISOString();
    const since1y  = new Date(Date.now() - 365 * 86400000).toISOString();

    const [w, inj, f, a, se, prof, goals] = await Promise.all([
      supabase.from('weight_logs').select('*').eq('user_id', uid).gte('logged_at', since1y).order('logged_at', { ascending: false }),
      supabase.from('injection_logs').select('*').eq('user_id', uid).order('injection_date', { ascending: false }).limit(20),
      supabase.from('food_logs').select('*').eq('user_id', uid).gte('logged_at', since90d).order('logged_at', { ascending: false }),
      supabase.from('activity_logs').select('*').eq('user_id', uid).gte('date', since90d.slice(0, 10)).order('date', { ascending: false }),
      supabase.from('side_effect_logs').select('*').eq('user_id', uid).order('logged_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('user_goals').select('*').eq('user_id', uid).single(),
    ]);

    set({
      weightLogs:    w.data   ?? [],
      injectionLogs: inj.data ?? [],
      foodLogs:      f.data   ?? [],
      activityLogs:  a.data   ?? [],
      sideEffectLogs: se.data ?? [],
      profile:       prof.data ?? null,
      userGoals:     goals.data ?? null,
      loading:       false,
      error:         w.error?.message ?? inj.error?.message ?? f.error?.message ?? null,
    });
  },



  addWeightLog: async (weight_lbs, notes) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('weight_logs')
      .insert({ user_id: user.id, weight_lbs, notes: notes ?? null });
    set({ loading: false, error: error?.message ?? null });
  },

  addSideEffectLog: async (effect_type, severity, phase_at_log, notes) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const { error } = await supabase
      .from('side_effect_logs')
      .insert({ user_id: user.id, effect_type, severity, phase_at_log, notes: notes ?? null });
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
    set({ loading: false, error: error?.message ?? null });
  },

  addActivityLog: async (exercise_type, duration_min, intensity) => {
    set({ loading: true, error: null });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { set({ loading: false, error: 'Not authenticated' }); return; }
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        date: today,
        exercise_type,
        duration_min,
        intensity: intensity ?? null,
        source: 'manual',
      });
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
    set({ loading: false, error: error?.message ?? null });
  },
}));
