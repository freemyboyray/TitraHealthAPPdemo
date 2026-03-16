import { Platform } from 'react-native';
import { create } from 'zustand';
import * as HealthKit from '../lib/healthkit';
import * as HealthConnect from '../lib/health-connect';

type NutritionData = { protein: number; calories: number; carbs: number; fat: number; fiber: number };

type HealthKitStore = {
  steps: number | null;
  activeCalories: number | null;
  hrv: number | null;
  restingHR: number | null;
  sleepHours: number | null;
  latestWeight: number | null;
  todayNutrition: NutritionData | null;
  bloodGlucose: number | null;
  permissionsGranted: boolean;
  lastRefreshed: Date | null;
  requestPermissions(): Promise<boolean>;
  fetchAll(): Promise<void>;
  writeWeight(lbs: number): Promise<void>;
  writeNutrition(macros: NutritionData): Promise<void>;
};

const lib = Platform.OS === 'ios' ? HealthKit : HealthConnect;

export const useHealthKitStore = create<HealthKitStore>((set) => ({
  steps: null,
  activeCalories: null,
  hrv: null,
  restingHR: null,
  sleepHours: null,
  latestWeight: null,
  todayNutrition: null,
  bloodGlucose: null,
  permissionsGranted: false,
  lastRefreshed: null,

  async requestPermissions() {
    const granted = await lib.requestPermissions();
    set({ permissionsGranted: granted });
    return granted;
  },

  async fetchAll() {
    const [steps, activeCalories, hrv, restingHR, sleepHours, latestWeight, todayNutrition, bloodGlucose] =
      await Promise.all([
        lib.readTodaySteps(),
        lib.readTodayActiveCalories(),
        lib.readLatestHRV(),
        lib.readLatestRestingHR(),
        lib.readLastNightSleep(),
        lib.readLatestWeight(),
        lib.readTodayNutrition(),
        lib.readLatestBloodGlucose(),
      ]);
    set({ steps, activeCalories, hrv, restingHR, sleepHours, latestWeight, todayNutrition, bloodGlucose, lastRefreshed: new Date() });
  },

  async writeWeight(lbs) {
    await lib.writeWeight(lbs);
  },

  async writeNutrition(macros) {
    await lib.writeNutrition(macros);
  },
}));
