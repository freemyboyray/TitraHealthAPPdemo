import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useReducer } from 'react';

import { supabase } from '@/lib/supabase';
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

// TODO: Replace with Apple Health data when appleHealthEnabled === true
const STUB_WEARABLE: WearableData = {
  sleepMinutes: 443,
  hrvMs: 45,
  restingHR: 58,
  spo2Pct: 98,
};

const ZERO_ACTUALS: DailyActuals = {
  proteinG: 0,
  waterMl: 0,
  fiberG: 0,
  steps: 0,
  injectionLogged: false,
};

function todayWaterKey(): string {
  return `@titrahealth_water_${new Date().toISOString().slice(0, 10)}`;
}

// ─── State & Actions ──────────────────────────────────────────────────────────

export type LogAction = 'water' | 'protein' | 'injection' | null;

type HealthState = {
  profile: FullUserProfile;
  wearable: WearableData;
  actuals: DailyActuals;
  targets: DailyTargets;
  recoveryScore: number;
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
  | { type: 'FETCH_ACTUALS'; actuals: DailyActuals };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialState(profile: FullUserProfile): HealthState {
  const daysSinceShot = daysSinceInjection(profile.lastInjectionDate);
  const phase = getShotPhase(daysSinceShot);
  const recoveryScore = computeRecovery(STUB_WEARABLE, phase);
  const targets = getDailyTargets(profile, daysSinceShot);
  const supportScore = computeGlp1Support(ZERO_ACTUALS, targets);
  const focuses = generateFocuses(ZERO_ACTUALS, targets, STUB_WEARABLE, daysSinceShot);
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
  const targets = getDailyTargets(state.profile, daysSinceShot);
  const supportScore = computeGlp1Support(state.actuals, targets);
  const focuses = generateFocuses(state.actuals, targets, state.wearable, daysSinceShot);
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
    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

type HealthContextValue = HealthState & {
  dispatch: React.Dispatch<Action>;
};

const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({
  profile,
  children,
}: {
  profile: FullUserProfile;
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, profile, buildInitialState);

  // Load today's actuals from Supabase (protein/fiber/steps/injection) + AsyncStorage (water)
  useEffect(() => {
    async function fetchTodayActuals() {
      const todayStr = new Date().toISOString().slice(0, 10);

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
        supabase.from('food_logs').select('protein_g,fiber_g').eq('user_id', user.id).gte('logged_at', todayStr),
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
    fetchTodayActuals();
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
    <HealthContext.Provider value={{ ...state, dispatch }}>
      {children}
    </HealthContext.Provider>
  );
}

export function useHealthData(): HealthContextValue {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealthData must be used within HealthProvider');
  return ctx;
}
