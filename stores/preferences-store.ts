import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type PreferencesStore = {
  isLightMode: boolean;
  toggleLightMode: () => void;
  setLightMode: (v: boolean) => void;
  appleHealthEnabled: boolean;
  setAppleHealthEnabled: (v: boolean) => void;
  garminConnected: boolean;
  setGarminConnected: (v: boolean) => void;
  lastWeeklySummaryDate: string | null;
  setLastWeeklySummaryDate: (date: string) => void;
};

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      isLightMode: false,
      toggleLightMode: () => set((s) => ({ isLightMode: !s.isLightMode })),
      setLightMode: (v) => set({ isLightMode: v }),
      appleHealthEnabled: false,
      setAppleHealthEnabled: (v) => set({ appleHealthEnabled: v }),
      garminConnected: false,
      setGarminConnected: (v) => set({ garminConnected: v }),
      lastWeeklySummaryDate: null,
      setLastWeeklySummaryDate: (date) => set({ lastWeeklySummaryDate: date }),
    }),
    { name: 'preferences-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);
