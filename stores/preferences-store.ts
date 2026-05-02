import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Format a Date as YYYY-MM-DD in local timezone. */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type ThemeMode = 'system' | 'light' | 'dark';

type PreferencesStore = {
  isLightMode: boolean;
  toggleLightMode: () => void;
  setLightMode: (v: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  appleHealthEnabled: boolean;
  setAppleHealthEnabled: (v: boolean) => void;
  lastWeeklySummaryDate: string | null;
  setLastWeeklySummaryDate: (date: string) => void;
  lastDailyStreakDate: string | null;
  setLastDailyStreakDate: (date: string) => void;
  /** Consecutive days the user has opened the app. */
  streakCount: number;
  /** Last date (YYYY-MM-DD) the streak was recorded. */
  lastStreakDate: string | null;
  /** Call on each app open — continues, resets, or no-ops the streak. */
  updateStreakOnOpen: () => number;
  /** Set streak to 1 for today (called after onboarding). */
  initStreak: () => void;
  /** Achievement IDs whose congrats screen has already been shown. */
  shownAchievementIds: string[];
  /** Whether the initial baseline of already-earned achievements has been seeded. */
  achievementsSeeded: boolean;
  /** Mark an achievement as shown so the congrats screen doesn't re-trigger. */
  markAchievementShown: (id: string) => void;
  /** Seed all currently-earned achievements as already shown (one-time on first run). */
  seedAchievements: (ids: string[]) => void;
  /** Photo milestone lbs values whose prompt has already been shown. */
  shownPhotoMilestones: number[];
  /** Whether the initial baseline of already-reached photo milestones has been seeded. */
  photoMilestonesSeeded: boolean;
  /** Mark a photo milestone as shown so the prompt doesn't re-trigger. */
  markPhotoMilestoneShown: (lbs: number) => void;
  /** Seed all currently-reached photo milestones as already shown (one-time on first run). */
  seedPhotoMilestones: (milestones: number[]) => void;
  /** Whether to use the gradient header or solid orange. */
  useGradientHeader: boolean;
  setUseGradientHeader: (v: boolean) => void;
  reset: () => void;
};

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      isLightMode: false,
      toggleLightMode: () => set((s) => ({ isLightMode: !s.isLightMode })),
      setLightMode: (v) => set({ isLightMode: v }),
      themeMode: 'system' as ThemeMode,
      setThemeMode: (mode) => set({ themeMode: mode }),
      appleHealthEnabled: false,
      setAppleHealthEnabled: (v) => set({ appleHealthEnabled: v }),
      lastWeeklySummaryDate: null,
      setLastWeeklySummaryDate: (date) => set({ lastWeeklySummaryDate: date }),
      lastDailyStreakDate: null,
      setLastDailyStreakDate: (date) => set({ lastDailyStreakDate: date }),
      streakCount: 0,
      lastStreakDate: null,
      updateStreakOnOpen: (): number => {
        const today = todayKey();
        const state: PreferencesStore = usePreferencesStore.getState();
        if (state.lastStreakDate === today) return state.streakCount;
        const yesterday = yesterdayKey();
        const newCount = state.lastStreakDate === yesterday ? state.streakCount + 1 : 1;
        set({ streakCount: newCount, lastStreakDate: today });
        return newCount;
      },
      initStreak: () => set({ streakCount: 1, lastStreakDate: todayKey() }),
      shownAchievementIds: [],
      achievementsSeeded: false,
      markAchievementShown: (id) => set((s) => ({
        shownAchievementIds: s.shownAchievementIds.includes(id)
          ? s.shownAchievementIds
          : [...s.shownAchievementIds, id],
      })),
      seedAchievements: (ids) => set((s) => {
        const merged = new Set([...s.shownAchievementIds, ...ids]);
        return { shownAchievementIds: [...merged], achievementsSeeded: true };
      }),
      shownPhotoMilestones: [],
      photoMilestonesSeeded: false,
      markPhotoMilestoneShown: (lbs) => set((s) => ({
        shownPhotoMilestones: s.shownPhotoMilestones.includes(lbs)
          ? s.shownPhotoMilestones
          : [...s.shownPhotoMilestones, lbs],
      })),
      seedPhotoMilestones: (milestones) => set((s) => {
        const merged = new Set([...s.shownPhotoMilestones, ...milestones]);
        return { shownPhotoMilestones: [...merged], photoMilestonesSeeded: true };
      }),
      useGradientHeader: true,
      setUseGradientHeader: (v) => set({ useGradientHeader: v }),
      reset: () => set({ isLightMode: false, appleHealthEnabled: false, lastWeeklySummaryDate: null, lastDailyStreakDate: null, streakCount: 0, lastStreakDate: null, shownAchievementIds: [], achievementsSeeded: false, shownPhotoMilestones: [], photoMilestonesSeeded: false, themeMode: 'system' as ThemeMode, useGradientHeader: true }),
    }),
    { name: 'preferences-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);
