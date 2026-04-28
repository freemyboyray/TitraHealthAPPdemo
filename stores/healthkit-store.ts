import { Platform } from 'react-native';
import { create } from 'zustand';
import * as HealthKit from '../lib/healthkit';
import * as HealthConnect from '../lib/health-connect';
import type { HKCategoryKey, WorkoutSample, GlucoseSample, GlucoseStats } from '../lib/healthkit';
import { usePreferencesStore } from './preferences-store';

type NutritionData = { protein: number; calories: number; carbs: number; fat: number; fiber: number };

type BloodPressure = { systolic: number; diastolic: number };

type HealthKitStore = {
  // Core (cross-platform — iOS HealthKit + Android Health Connect)
  steps: number | null;
  activeCalories: number | null;
  hrv: number | null;
  restingHR: number | null;
  sleepHours: number | null;
  latestWeight: number | null;
  todayNutrition: NutritionData | null;
  bloodGlucose: number | null;

  // Extended (iOS-only today; Android stays null)
  bodyFat: number | null;         // %
  leanMass: number | null;        // lbs
  waist: number | null;           // inches
  bmi: number | null;
  vo2max: number | null;          // mL/kg/min
  spo2: number | null;            // %
  bloodPressure: BloodPressure | null;
  exerciseMinutes: number | null; // today
  waterToday: number | null;      // fl oz

  // New extended metrics
  respiratoryRate: number | null; // breaths/min
  basalEnergy: number | null;     // kcal (resting metabolic burn today)
  distance: number | null;        // miles today
  flightsClimbed: number | null;  // flights today
  workouts: WorkoutSample[];      // structured workout sessions today
  mindfulMinutes: number | null;  // minutes today
  glucoseTimeSeries: GlucoseSample[]; // CGM readings (24h)
  glucoseStats: GlucoseStats | null;  // computed from time-series

  // Per-category live status (iOS-only). A category is "live" if it has
  // returned ≥1 sample in the last 30 days — that's the only reliable signal
  // Apple gives us about what the user actually granted.
  liveCategories: Set<HKCategoryKey>;

  permissionsGranted: boolean;
  lastRefreshed: Date | null;

  requestPermissions(): Promise<boolean>;
  fetchAll(): Promise<void>;
  refreshLive(): Promise<void>;
  isLive(key: HKCategoryKey): boolean;
  writeWeight(lbs: number): Promise<boolean>;
  writeNutrition(macros: NutritionData): Promise<boolean>;
  writeWater(ml: number): Promise<boolean>;
};

const lib = Platform.OS === 'ios' ? HealthKit : HealthConnect;
const isIOS = Platform.OS === 'ios';

export const useHealthKitStore = create<HealthKitStore>((set, get) => ({
  steps: null,
  activeCalories: null,
  hrv: null,
  restingHR: null,
  sleepHours: null,
  latestWeight: null,
  todayNutrition: null,
  bloodGlucose: null,

  bodyFat: null,
  leanMass: null,
  waist: null,
  bmi: null,
  vo2max: null,
  spo2: null,
  bloodPressure: null,
  exerciseMinutes: null,
  waterToday: null,

  respiratoryRate: null,
  basalEnergy: null,
  distance: null,
  flightsClimbed: null,
  workouts: [],
  mindfulMinutes: null,
  glucoseTimeSeries: [],
  glucoseStats: null,

  liveCategories: new Set<HKCategoryKey>(),

  permissionsGranted: false,
  lastRefreshed: null,

  async requestPermissions() {
    const granted = await lib.requestPermissions();
    set({ permissionsGranted: granted });
    // After a successful permission request, kick off a live-category refresh
    // so the UI can immediately show/hide sections based on what actually
    // returned data. Non-blocking.
    if (granted && isIOS) {
      get().refreshLive().catch(() => {});
    }
    return granted;
  },

  async refreshLive() {
    if (!isIOS) return;
    try {
      const live = await HealthKit.refreshLiveCategories();
      set({ liveCategories: live });
    } catch {
      // swallow — UI treats empty set as "nothing live"
    }
  },

  isLive(key) {
    return get().liveCategories.has(key);
  },

  async fetchAll() {
    // Core reads (both platforms)
    const core = await Promise.all([
      lib.readTodaySteps(),
      lib.readTodayActiveCalories(),
      lib.readLatestHRV(),
      lib.readLatestRestingHR(),
      lib.readLastNightSleep(),
      lib.readLatestWeight(),
      lib.readTodayNutrition(),
      lib.readLatestBloodGlucose(),
    ]);
    const [steps, activeCalories, hrv, restingHR, sleepHours, latestWeight, todayNutrition, bloodGlucose] = core;

    // Extended reads (iOS only — Android's Health Connect doesn't have
    // equivalents for most of these, so we leave them null on Android)
    let extended = {
      bodyFat: null as number | null,
      leanMass: null as number | null,
      waist: null as number | null,
      bmi: null as number | null,
      vo2max: null as number | null,
      spo2: null as number | null,
      bloodPressure: null as BloodPressure | null,
      exerciseMinutes: null as number | null,
      waterToday: null as number | null,
      respiratoryRate: null as number | null,
      basalEnergy: null as number | null,
      distance: null as number | null,
      flightsClimbed: null as number | null,
      workouts: [] as WorkoutSample[],
      mindfulMinutes: null as number | null,
      glucoseTimeSeries: [] as GlucoseSample[],
      glucoseStats: null as GlucoseStats | null,
    };
    if (isIOS) {
      const [
        bodyFat, leanMass, waist, bmi, vo2max, spo2, bloodPressure,
        exerciseMinutes, waterToday, respiratoryRate, basalEnergy,
        distance, flightsClimbed, workouts, mindfulMinutes, glucoseTimeSeries,
      ] = await Promise.all([
        HealthKit.readLatestBodyFat(),
        HealthKit.readLatestLeanMass(),
        HealthKit.readLatestWaist(),
        HealthKit.readLatestBMI(),
        HealthKit.readLatestVO2Max(),
        HealthKit.readLatestSpO2(),
        HealthKit.readLatestBloodPressure(),
        HealthKit.readTodayExerciseMinutes(),
        HealthKit.readTodayWater(),
        HealthKit.readLatestRespiratoryRate(),
        HealthKit.readTodayBasalEnergy(),
        HealthKit.readTodayDistance(),
        HealthKit.readTodayFlightsClimbed(),
        HealthKit.readTodayWorkouts(),
        HealthKit.readTodayMindfulMinutes(),
        HealthKit.readGlucoseTimeSeries(24),
      ]);
      const glucoseStats = HealthKit.computeGlucoseStats(glucoseTimeSeries);
      extended = {
        bodyFat, leanMass, waist, bmi, vo2max, spo2, bloodPressure,
        exerciseMinutes, waterToday, respiratoryRate, basalEnergy,
        distance, flightsClimbed, workouts, mindfulMinutes,
        glucoseTimeSeries, glucoseStats,
      };
    }

    set({
      steps, activeCalories, hrv, restingHR, sleepHours, latestWeight, todayNutrition, bloodGlucose,
      ...extended,
      lastRefreshed: new Date(),
    });
  },

  async writeWeight(lbs) {
    if (!usePreferencesStore.getState().appleHealthEnabled) return false;
    try {
      await lib.writeWeight(lbs);
      return true;
    } catch {
      return false;
    }
  },

  async writeNutrition(macros) {
    if (!usePreferencesStore.getState().appleHealthEnabled) return false;
    try {
      await lib.writeNutrition(macros);
      return true;
    } catch {
      return false;
    }
  },

  async writeWater(ml) {
    if (!usePreferencesStore.getState().appleHealthEnabled) return false;
    try {
      await lib.writeWater(ml);
      return true;
    } catch {
      return false;
    }
  },
}));

// On module load, hydrate the live-category set from AsyncStorage so screens
// that mount before the first fetchAll() have something to render against.
// This is fire-and-forget; fetchAll() will refresh it later.
if (isIOS) {
  HealthKit.getCachedLiveCategories()
    .then((cached) => {
      if (cached.size > 0) useHealthKitStore.setState({ liveCategories: cached });
    })
    .catch(() => {});
}
