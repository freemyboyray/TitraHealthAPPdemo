import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { localDateStr } from '@/lib/date-utils';

import { supabase } from '@/lib/supabase';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { FullUserProfile } from '@/constants/user-profile';
import {
  DailyActuals,
  DailyTargets,
  FocusItem,
  WearableData,
  computeGlp1Support,
  computeRecovery,
  daysSinceInjection,
  generateFocuses,
  getDailyTargets,
  getShotPhase,
} from '@/constants/scoring';

// ─── Seed Data ────────────────────────────────────────────────────────────────

// Initial values before HealthKit data arrives. Overwritten by SYNC_WEARABLE on mount.
// All undefined so focuses/scores don't assume fake values.
const STUB_WEARABLE: WearableData = {
};

const ZERO_ACTUALS: DailyActuals = {
  proteinG: 0,
  waterMl: 0,
  fiberG: 0,
  steps: 0,
  injectionLogged: false,
};

function todayWaterKey(): string {
  return `@titrahealth_water_${localDateStr()}`;
}

// ─── State & Actions ──────────────────────────────────────────────────────────

export type LogAction = 'water' | 'protein' | 'injection' | null;

type HealthState = {
  profile: FullUserProfile;
  wearable: WearableData;
  actuals: DailyActuals;
  targets: DailyTargets;
  recoveryScore: number | null;
  supportScore: number;
  focuses: FocusItem[];
  lastLogAction: LogAction;
};

type Action =
  | { type: 'LOG_WATER'; ml: number }
  | { type: 'LOG_PROTEIN'; grams: number }
  | { type: 'LOG_INJECTION' }
  | { type: 'LOG_STEPS'; steps: number }
  | { type: 'CLEAR_ACTION' }
  | { type: 'FETCH_ACTUALS'; actuals: DailyActuals }
  | { type: 'SYNC_WEARABLE'; wearable: WearableData }
  | { type: 'SYNC_HK_STEPS'; steps: number }
  | { type: 'SYNC_PROFILE'; profile: FullUserProfile }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialState(profile: FullUserProfile): HealthState {
  const daysSinceShot = daysSinceInjection(profile.lastInjectionDate);
  const phase = getShotPhase(daysSinceShot);
  const recoveryScore = computeRecovery(STUB_WEARABLE, phase);
  const targets = getDailyTargets(profile);
  const supportScore = computeGlp1Support(ZERO_ACTUALS, targets);
  // Pass isInjectionDue: false — the home screen handles injection reminders
  // separately via isShotDay logic. Without this, the fallback
  // (daysSinceShot >= injFreqDays) causes injection to show up every day.
  const focuses = generateFocuses(ZERO_ACTUALS, targets, STUB_WEARABLE, daysSinceShot, undefined, false);
  return {
    profile,
    wearable: STUB_WEARABLE,
    actuals: ZERO_ACTUALS,
    targets,
    recoveryScore,
    supportScore,
    focuses,
    lastLogAction: null,
  };
}

function recompute(state: HealthState): HealthState {
  const daysSinceShot = daysSinceInjection(state.profile.lastInjectionDate);
  const phase = getShotPhase(daysSinceShot);
  const recoveryScore = computeRecovery(state.wearable, phase);
  const targets = getDailyTargets(state.profile);
  const supportScore = computeGlp1Support(state.actuals, targets);
  const focuses = generateFocuses(state.actuals, targets, state.wearable, daysSinceShot, undefined, false);
  return { ...state, targets, recoveryScore, supportScore, focuses };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: HealthState, action: Action): HealthState {
  switch (action.type) {
    case 'LOG_WATER': {
      const actuals = { ...state.actuals, waterMl: state.actuals.waterMl + action.ml };
      return recompute({ ...state, actuals, lastLogAction: 'water' });
    }
    case 'LOG_PROTEIN': {
      const actuals = { ...state.actuals, proteinG: state.actuals.proteinG + action.grams };
      return recompute({ ...state, actuals, lastLogAction: 'protein' });
    }
    case 'LOG_INJECTION': {
      const actuals = { ...state.actuals, injectionLogged: true };
      return recompute({ ...state, actuals, lastLogAction: 'injection' });
    }
    case 'LOG_STEPS': {
      const actuals = { ...state.actuals, steps: state.actuals.steps + action.steps };
      return recompute({ ...state, actuals, lastLogAction: null });
    }
    case 'CLEAR_ACTION':
      return { ...state, lastLogAction: null };
    case 'FETCH_ACTUALS':
      return recompute({ ...state, actuals: action.actuals, lastLogAction: null });
    case 'SYNC_WEARABLE':
      return recompute({ ...state, wearable: { ...state.wearable, ...action.wearable } });
    case 'SYNC_HK_STEPS': {
      const steps = Math.max(state.actuals.steps, action.steps);
      return recompute({ ...state, actuals: { ...state.actuals, steps } });
    }
    case 'SYNC_PROFILE':
      return recompute({ ...state, profile: action.profile });
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type HealthContextValue = HealthState & {
  dispatch: React.Dispatch<Action>;
  refreshActuals: () => Promise<void>;
};

const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({
  profile,
  wearable: liveWearable,
  children,
}: {
  profile: FullUserProfile;
  wearable?: Partial<WearableData>;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, profile, buildInitialState);

  const hkSteps = useHealthKitStore(s => s.steps);

  // Sync profile into scoring engine whenever it changes (e.g. after async load or settings update)
  useEffect(() => {
    dispatch({ type: 'SYNC_PROFILE', profile });
  }, [profile]);

  // Sync live wearable data from HealthKit into scoring engine
  useEffect(() => {
    if (!liveWearable || Object.keys(liveWearable).length === 0) return;
    dispatch({ type: 'SYNC_WEARABLE', wearable: liveWearable as WearableData });
  }, [liveWearable?.hrvMs, liveWearable?.restingHR, liveWearable?.sleepMinutes, liveWearable?.spo2Pct]);

  // Sync HealthKit steps - prefer whichever is higher (HealthKit is live; Supabase is manually logged)
  useEffect(() => {
    if (hkSteps == null) return;
    dispatch({ type: 'SYNC_HK_STEPS', steps: hkSteps });
  }, [hkSteps]);

  // Load today's actuals from Supabase (protein/fiber/steps/injection) + AsyncStorage (water)
  async function fetchTodayActuals() {
    const todayStr = localDateStr();    // local YYYY-MM-DD (date-only fields)
    const localMidnight = new Date();
    localMidnight.setHours(0, 0, 0, 0); // local midnight → correct UTC boundary for food_logs

    // Load water from AsyncStorage (not in Supabase)
    const storedWater = await AsyncStorage.getItem(todayWaterKey());
    const waterMl = storedWater ? parseFloat(storedWater) : 0;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Unauthenticated: still apply any logged water
      if (waterMl > 0) {
        dispatch({ type: 'FETCH_ACTUALS', actuals: { ...ZERO_ACTUALS, waterMl } });
      }
      return;
    }

    const [foodRes, actRes, injRes] = await Promise.all([
      supabase.from('food_logs').select('protein_g,fiber_g').eq('user_id', user.id).gte('logged_at', localMidnight.toISOString()),
      supabase.from('activity_logs').select('steps').eq('user_id', user.id).eq('date', todayStr),
      supabase.from('injection_logs').select('injection_date').eq('user_id', user.id).gte('injection_date', todayStr).limit(1),
    ]);
    const proteinG = (foodRes.data ?? []).reduce((s, f) => s + (f.protein_g ?? 0), 0);
    const fiberG = (foodRes.data ?? []).reduce((s, f) => s + (f.fiber_g ?? 0), 0);
    const steps = (actRes.data ?? []).reduce((s, a) => s + (a.steps ?? 0), 0);
    const injectionLogged = (injRes.data ?? []).length > 0;
    dispatch({
      type: 'FETCH_ACTUALS',
      actuals: { proteinG, fiberG, steps, waterMl, injectionLogged },
    });
  }

  // Run on mount (may be a no-op if session not yet restored from AsyncStorage)
  useEffect(() => {
    fetchTodayActuals();
  }, []);

  // Re-run whenever auth session is confirmed — catches the case where the session
  // is restored from AsyncStorage after the initial mount fetch already ran as unauthenticated.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        fetchTodayActuals();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Persist water to AsyncStorage whenever it changes
  useEffect(() => {
    AsyncStorage.setItem(todayWaterKey(), String(state.actuals.waterMl));
  }, [state.actuals.waterMl]);

  // Auto-clear lastLogAction after 600ms
  useEffect(() => {
    if (state.lastLogAction !== null) {
      const t = setTimeout(() => dispatch({ type: 'CLEAR_ACTION' }), 600);
      return () => clearTimeout(t);
    }
  }, [state.lastLogAction]);

  return (
    <HealthContext.Provider value={{ ...state, dispatch, refreshActuals: fetchTodayActuals }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealthData(): HealthContextValue {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealthData must be used within HealthProvider');
  return ctx;
}

// ─── Standalone date-scoped snapshot fetcher ─────────────────────────────────

export type DailySnapshot = {
  actuals: DailyActuals;
  foodLogs: Array<{
    id: string;
    food_name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    meal_type: string;
    logged_at: string;
  }>;
  activityLogs: Array<{
    id: string;
    exercise_type: string;
    duration_min: number;
    steps: number;
    active_calories: number;
  }>;
  weightLog: { id: string; weight_lbs: number; logged_at: string } | null;
  injectionLog: { id: string; dose_mg: number; injection_date: string; medication_name: string | null } | null;
  sideEffectLogs: Array<{ id: string; effect_type: string; severity: number; logged_at: string }>;
};

export async function fetchDailySnapshot(dateStr: string): Promise<DailySnapshot> {
  const waterKey = `@titrahealth_water_${dateStr}`;
  const storedWater = await AsyncStorage.getItem(waterKey);
  const waterMl = storedWater ? parseFloat(storedWater) : 0;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      actuals: { proteinG: 0, waterMl, fiberG: 0, steps: 0, injectionLogged: false },
      foodLogs: [],
      activityLogs: [],
      weightLog: null,
      injectionLog: null,
      sideEffectLogs: [],
    };
  }

  const [y, mo, d] = dateStr.split('-').map(Number);
  const localStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const localEnd   = new Date(y, mo - 1, d + 1, 0, 0, 0, 0);

  const [foodRes, actRes, injRes, weightRes, seRes] = await Promise.all([
    supabase.from('food_logs')
      .select('id,food_name,calories,protein_g,carbs_g,fat_g,fiber_g,meal_type,logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', localStart.toISOString())
      .lt('logged_at', localEnd.toISOString()),
    supabase.from('activity_logs')
      .select('id,exercise_type,duration_min,steps,active_calories')
      .eq('user_id', user.id)
      .eq('date', dateStr),
    supabase.from('injection_logs')
      .select('id,dose_mg,injection_date,medication_name')
      .eq('user_id', user.id)
      .eq('injection_date', dateStr)
      .limit(1),
    supabase.from('weight_logs')
      .select('id,weight_lbs,logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', localStart.toISOString())
      .lt('logged_at', localEnd.toISOString())
      .limit(1),
    supabase.from('side_effect_logs')
      .select('id,effect_type,severity,logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', localStart.toISOString())
      .lt('logged_at', localEnd.toISOString()),
  ]);

  const foods = foodRes.data ?? [];
  const acts  = actRes.data  ?? [];

  const proteinG = foods.reduce((s, f) => s + (f.protein_g ?? 0), 0);
  const fiberG   = foods.reduce((s, f) => s + (f.fiber_g   ?? 0), 0);
  const steps    = acts.reduce( (s, a) => s + (a.steps     ?? 0), 0);
  const injectionLogged = (injRes.data ?? []).length > 0;

  return {
    actuals: { proteinG, fiberG, steps, waterMl, injectionLogged },
    foodLogs: foods.map(f => ({
      id:        f.id,
      food_name: f.food_name,
      calories:  f.calories  ?? 0,
      protein_g: f.protein_g ?? 0,
      carbs_g:   f.carbs_g   ?? 0,
      fat_g:     f.fat_g     ?? 0,
      fiber_g:   f.fiber_g   ?? 0,
      meal_type: f.meal_type ?? 'snack',
      logged_at: f.logged_at,
    })),
    activityLogs: acts.map(a => ({
      id:             a.id,
      exercise_type:  a.exercise_type  ?? '',
      duration_min:   a.duration_min   ?? 0,
      steps:          a.steps          ?? 0,
      active_calories: a.active_calories ?? 0,
    })),
    weightLog: (() => {
      const row = (weightRes.data ?? [])[0];
      return row ? { id: row.id, weight_lbs: row.weight_lbs ?? 0, logged_at: row.logged_at } : null;
    })(),
    injectionLog: (() => {
      const row = (injRes.data ?? [])[0];
      return row ? { id: row.id, dose_mg: row.dose_mg ?? 0, injection_date: row.injection_date, medication_name: row.medication_name ?? null } : null;
    })(),
    sideEffectLogs: (seRes.data ?? []).map(s => ({
      id:          s.id,
      effect_type: s.effect_type,
      severity:    s.severity ?? 0,
      logged_at:   s.logged_at,
    })),
  };
}

export async function fetchActualsForDate(dateStr: string): Promise<DailyActuals> {
  return fetchDailySnapshot(dateStr).then(s => s.actuals);
}
