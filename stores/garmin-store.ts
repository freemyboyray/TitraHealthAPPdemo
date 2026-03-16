import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  initiateGarminOAuth,
  triggerGarminSync,
  disconnectGarmin,
} from '@/lib/garmin';

type GarminStore = {
  connected: boolean;
  lastSynced: string | null;       // ISO timestamp
  latestSteps: number | null;
  latestActiveCalories: number | null;
  latestSleepHours: number | null;
  latestRestingHR: number | null;
  latestWeight: number | null;
  connect(): Promise<void>;
  sync(): Promise<void>;
  disconnect(): Promise<void>;
};

export const useGarminStore = create<GarminStore>()(
  persist(
    (set, get) => ({
      connected: false,
      lastSynced: null,
      latestSteps: null,
      latestActiveCalories: null,
      latestSleepHours: null,
      latestRestingHR: null,
      latestWeight: null,

      async connect() {
        const code = await initiateGarminOAuth();
        if (code) {
          set({ connected: true });
          // Auto-sync after connecting
          await get().sync();
        }
      },

      async sync() {
        if (!get().connected) return;
        const result = await triggerGarminSync();
        set({
          lastSynced: new Date().toISOString(),
          latestSteps: result.steps,
          latestActiveCalories: result.activeCalories,
          latestSleepHours: result.sleepHours,
          latestRestingHR: result.restingHR,
          latestWeight: result.weight,
        });
      },

      async disconnect() {
        await disconnectGarmin();
        set({
          connected: false,
          lastSynced: null,
          latestSteps: null,
          latestActiveCalories: null,
          latestSleepHours: null,
          latestRestingHR: null,
          latestWeight: null,
        });
      },
    }),
    { name: 'garmin-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);
