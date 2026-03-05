import React, { createContext, useContext, useEffect, useReducer } from 'react';

import { FullUserProfile } from '@/constants/user-profile';
import {
  DailyActuals,
  DailyTargets,
  WearableData,
  computeGlp1Support,
  computeRecovery,
  daysSinceInjection,
  getDailyTargets,
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
  lastLogAction: LogAction;
};

type Action =
  | { type: 'LOG_WATER'; ml: number }
  | { type: 'LOG_PROTEIN'; grams: number }
  | { type: 'LOG_INJECTION' }
  | { type: 'LOG_STEPS'; steps: number }
  | { type: 'CLEAR_ACTION' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialState(profile: FullUserProfile): HealthState {
  const daysSinceShot = daysSinceInjection(profile.lastInjectionDate);
  const recoveryScore = computeRecovery(SEED_WEARABLE);
  const targets = getDailyTargets(profile, daysSinceShot);
  const supportScore = computeGlp1Support(SEED_ACTUALS, targets);
  return {
    profile,
    wearable: SEED_WEARABLE,
    actuals: SEED_ACTUALS,
    targets,
    recoveryScore,
    supportScore,
    lastLogAction: null,
  };
}

function recompute(state: HealthState): HealthState {
  const daysSinceShot = daysSinceInjection(state.profile.lastInjectionDate);
  const targets = getDailyTargets(state.profile, daysSinceShot);
  const supportScore = computeGlp1Support(state.actuals, targets);
  return { ...state, targets, supportScore };
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
