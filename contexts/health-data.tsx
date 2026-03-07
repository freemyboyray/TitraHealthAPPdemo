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

const SEED_WEARABLE: WearableData = {
  sleepMinutes: 443,
  hrvMs: 45,
  restingHR: 58,
  spo2Pct: 98,
};

const SEED_ACTUALS: DailyActuals = {
  proteinG: 62,
  waterMl: 1100,
  fiberG: 14,
  steps: 3200,
  injectionLogged: false,
};

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
  const recoveryScore = computeRecovery(SEED_WEARABLE, phase);
  const targets = getDailyTargets(profile, daysSinceShot);
  const supportScore = computeGlp1Support(SEED_ACTUALS, targets);
  const focuses = generateFocuses(SEED_ACTUALS, targets, SEED_WEARABLE, daysSinceShot);
  return {
    profile,
    wearable: SEED_WEARABLE,
    actuals: SEED_ACTUALS,
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

  // Seed today's actuals from Supabase on mount
  useEffect(() => {
    async function fetchTodayActuals() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const todayStr = new Date().toISOString().slice(0, 10);
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
        actuals: { proteinG, fiberG, steps, waterMl: SEED_ACTUALS.waterMl, injectionLogged },
      });
    }
    fetchTodayActuals();
  }, []);

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
