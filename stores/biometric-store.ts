import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ShotPhase } from '@/constants/scoring';
import type { BiometricBaseline } from '@/lib/cycle-intelligence';

export type BiometricDayEntry = {
  dateStr: string;
  hrvMs: number | null;
  restingHR: number | null;
  sleepMinutes: number | null;
  shotPhase: ShotPhase;
  pkConcentrationPct: number | null;
};

type BiometricStore = {
  baseline: BiometricBaseline | null;
  history: BiometricDayEntry[];
  isBootstrapped: boolean;
  recordDayEntry(entry: BiometricDayEntry): void;
  resetBaseline(): void;
};

const EMA_ALPHA = 0.1;
const BOOTSTRAP_MIN_DAYS = 14;
const HISTORY_MAX_DAYS = 90;

function isBaselineExcluded(phase: ShotPhase): boolean {
  // Never update baseline on shot/peak days — drug concentration distorts readings
  return phase === 'peak' || phase === 'shot';
}

function mean(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

function ema(current: number | null, next: number | null): number | null {
  if (next == null) return current;
  if (current == null) return next;
  return EMA_ALPHA * next + (1 - EMA_ALPHA) * current;
}

export const useBiometricStore = create<BiometricStore>()(
  persist(
    (set, get) => ({
      baseline: null,
      history: [],
      isBootstrapped: false,

      recordDayEntry(entry: BiometricDayEntry) {
        const state = get();

        // Deduplicate by date
        const without = state.history.filter(h => h.dateStr !== entry.dateStr);

        // Cap rolling window to 90 days
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - HISTORY_MAX_DAYS);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        const trimmed = [entry, ...without].filter(h => h.dateStr >= cutoffStr);

        // Non-peak/shot days are eligible for baseline
        const eligibleDays = trimmed.filter(h => !isBaselineExcluded(h.shotPhase));
        const bootstrapped = eligibleDays.length >= BOOTSTRAP_MIN_DAYS;

        let newBaseline = state.baseline;

        if (!isBaselineExcluded(entry.shotPhase)) {
          if (!state.isBootstrapped && bootstrapped) {
            // First bootstrap: simple mean across all eligible days
            newBaseline = {
              hrvMs:        mean(eligibleDays.map(h => h.hrvMs)),
              restingHR:    mean(eligibleDays.map(h => h.restingHR)),
              sleepMinutes: mean(eligibleDays.map(h => h.sleepMinutes)),
              sampleCount:  eligibleDays.length,
              lastUpdatedAt: entry.dateStr,
            };
          } else if (!state.isBootstrapped && !bootstrapped) {
            // Still bootstrapping: update mean incrementally
            newBaseline = {
              hrvMs:        mean(eligibleDays.map(h => h.hrvMs)),
              restingHR:    mean(eligibleDays.map(h => h.restingHR)),
              sleepMinutes: mean(eligibleDays.map(h => h.sleepMinutes)),
              sampleCount:  eligibleDays.length,
              lastUpdatedAt: entry.dateStr,
            };
          } else if (state.isBootstrapped && state.baseline) {
            // EMA update after bootstrap complete
            newBaseline = {
              hrvMs:        ema(state.baseline.hrvMs, entry.hrvMs),
              restingHR:    ema(state.baseline.restingHR, entry.restingHR),
              sleepMinutes: ema(state.baseline.sleepMinutes, entry.sleepMinutes),
              sampleCount:  eligibleDays.length,
              lastUpdatedAt: entry.dateStr,
            };
          }
        }

        set({ history: trimmed, baseline: newBaseline, isBootstrapped: bootstrapped });
      },

      resetBaseline() {
        set({ baseline: null, history: [], isBootstrapped: false });
      },
    }),
    { name: 'biometric-store', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
