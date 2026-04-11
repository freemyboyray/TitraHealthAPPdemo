import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

// NitroModules (used by react-native-healthkit) crash in Expo Go with a fatal
// error that bypasses try/catch. Skip the require entirely when in Expo Go.
const isExpoGo = Constants.appOwnership === 'expo';

const TAG = '[HealthKit]';
const log = (...args: unknown[]) => console.log(TAG, ...args);
const warn = (...args: unknown[]) => console.warn(TAG, ...args);
const err = (label: string, e: unknown) => {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  console.error(`${TAG} ${label}:`, msg);
};

const TITRA_BUNDLE_ID = 'com.titrahealth.app';

// ─── Category registry ───────────────────────────────────────────────────────
// Single source of truth for every HK type we touch. Category keys are used
// throughout the app (store, UI gates, live-detection cache) so they must stay
// stable — the identifier string can change, the key cannot.

export const HK_CATEGORIES = {
  // Core vitals
  weight: 'HKQuantityTypeIdentifierBodyMass',
  steps: 'HKQuantityTypeIdentifierStepCount',
  activeEnergy: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  hrv: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  restingHR: 'HKQuantityTypeIdentifierRestingHeartRate',
  sleep: 'HKCategoryTypeIdentifierSleepAnalysis',

  // Body composition
  bodyFat: 'HKQuantityTypeIdentifierBodyFatPercentage',
  leanMass: 'HKQuantityTypeIdentifierLeanBodyMass',
  waist: 'HKQuantityTypeIdentifierWaistCircumference',
  bmi: 'HKQuantityTypeIdentifierBodyMassIndex',
  height: 'HKQuantityTypeIdentifierHeight',

  // Cardiovascular
  vo2max: 'HKQuantityTypeIdentifierVO2Max',
  spo2: 'HKQuantityTypeIdentifierOxygenSaturation',
  bpSystolic: 'HKQuantityTypeIdentifierBloodPressureSystolic',
  bpDiastolic: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
  walkingHR: 'HKQuantityTypeIdentifierWalkingHeartRateAverage',
  heartRateRecovery: 'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute',

  // Nutrition — core macros
  protein: 'HKQuantityTypeIdentifierDietaryProtein',
  calories: 'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  carbs: 'HKQuantityTypeIdentifierDietaryCarbohydrates',
  fat: 'HKQuantityTypeIdentifierDietaryFatTotal',
  fiber: 'HKQuantityTypeIdentifierDietaryFiber',
  // Nutrition — extended (GLP-1 relevant)
  water: 'HKQuantityTypeIdentifierDietaryWater',
  sodium: 'HKQuantityTypeIdentifierDietarySodium',
  sugar: 'HKQuantityTypeIdentifierDietarySugar',
  caffeine: 'HKQuantityTypeIdentifierDietaryCaffeine',

  // Metabolic
  glucose: 'HKQuantityTypeIdentifierBloodGlucose',
  bodyTemp: 'HKQuantityTypeIdentifierBodyTemperature',

  // Activity (watch-only secondary)
  exerciseMinutes: 'HKQuantityTypeIdentifierAppleExerciseTime',
  standHours: 'HKCategoryTypeIdentifierAppleStandHour',

  // GI symptoms (Apple's symptom tracker — direct 1:1 match for GLP-1 side effects)
  symptomNausea: 'HKCategoryTypeIdentifierNausea',
  symptomVomiting: 'HKCategoryTypeIdentifierVomiting',
  symptomDiarrhea: 'HKCategoryTypeIdentifierDiarrhea',
  symptomConstipation: 'HKCategoryTypeIdentifierConstipation',
  symptomHeartburn: 'HKCategoryTypeIdentifierHeartburn',
  symptomBloating: 'HKCategoryTypeIdentifierBloating',
  symptomAbdominalCramps: 'HKCategoryTypeIdentifierAbdominalCramps',
  symptomHeadache: 'HKCategoryTypeIdentifierHeadache',
  symptomFatigue: 'HKCategoryTypeIdentifierFatigue',
  symptomDizziness: 'HKCategoryTypeIdentifierDizziness',
  symptomRapidHR: 'HKCategoryTypeIdentifierRapidPoundingOrFlutteringHeartbeat',
  symptomHairLoss: 'HKCategoryTypeIdentifierHairLoss',
  symptomAppetite: 'HKCategoryTypeIdentifierAppetiteChanges',
  symptomMood: 'HKCategoryTypeIdentifierMoodChanges',
} as const;

export type HKCategoryKey = keyof typeof HK_CATEGORIES;

// Which keys use queryCategorySamples vs queryQuantitySamples. Drives the
// live-detection path and anywhere we need to dispatch by kind.
const CATEGORY_KEYS: ReadonlySet<HKCategoryKey> = new Set<HKCategoryKey>([
  'sleep',
  'standHours',
  'symptomNausea', 'symptomVomiting', 'symptomDiarrhea', 'symptomConstipation',
  'symptomHeartburn', 'symptomBloating', 'symptomAbdominalCramps',
  'symptomHeadache', 'symptomFatigue', 'symptomDizziness',
  'symptomRapidHR', 'symptomHairLoss', 'symptomAppetite', 'symptomMood',
]);

const READ_TYPES = Object.values(HK_CATEGORIES);

// We only write what Titra owns. Symptoms/activity are read-only so we don't
// pollute the user's Health app with data they already logged in Titra — the
// two stores stay additive, not duplicative.
const WRITE_TYPES = [
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKQuantityTypeIdentifierDietaryFiber',
  'HKQuantityTypeIdentifierDietaryWater',
] as const;

// ─── Module loading ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHK(): any | null {
  if (Platform.OS !== 'ios') return null;
  if (isExpoGo) {
    warn('getHK → null (running in Expo Go; NitroModules unsupported — use a dev client or TestFlight build)');
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@kingstinct/react-native-healthkit');
    const HK = mod.default ?? mod;
    if (!HK || typeof HK.requestAuthorization !== 'function') {
      err('getHK', 'module loaded but requestAuthorization missing — native module likely not linked in this build');
      return null;
    }
    return HK;
  } catch (e) {
    err('getHK require failed', e);
    return null;
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDaysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// v13 QueryOptions shape: { filter: { date: { startDate, endDate } }, limit, unit? }
// limit: 0 means "all samples in the window"
function dateRangeOptions(from: Date, to: Date, unit?: string, limit = 0) {
  return {
    filter: { date: { startDate: from, endDate: to } },
    limit,
    ...(unit ? { unit } : {}),
  };
}

// Drop samples that Titra itself wrote — prevents the nutrition echo where
// writeNutrition() writes to HK and a subsequent read sees our own data.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function excludeTitraSources<T extends { sourceRevision?: any }>(samples: T[]): T[] {
  return samples.filter((s) => {
    const bundleId = s?.sourceRevision?.source?.bundleIdentifier;
    return bundleId !== TITRA_BUNDLE_ID;
  });
}

// ─── Authorization ───────────────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  const HK = getHK();
  if (!HK) {
    warn('requestPermissions → false (HealthKit module unavailable)');
    return false;
  }
  try {
    const available = await HK.isHealthDataAvailable();
    if (!available) {
      warn('requestPermissions → false (HealthKit not available on this device)');
      return false;
    }
    log('requesting authorization for', READ_TYPES.length, 'read types and', WRITE_TYPES.length, 'write types');
    await HK.requestAuthorization({ toShare: WRITE_TYPES, toRead: READ_TYPES });
    log('requestAuthorization resolved — iOS does not reveal read grants; live status is inferred from sample presence');
    return true;
  } catch (e) {
    err('requestPermissions failed', e);
    return false;
  }
}

// Opens the Titra app page inside iOS Settings. The user taps "Health" from
// there to reach the per-category toggles. This is the ONLY way to re-grant
// a category that was previously declined — HK won't re-prompt programmatically.
export async function openHealthSettings(): Promise<void> {
  try {
    await Linking.openURL('app-settings:');
  } catch (e) {
    err('openHealthSettings', e);
  }
}

// ─── Live-category detection ─────────────────────────────────────────────────
// Apple deliberately hides read-grant state from apps. The only reliable signal
// is "did any sample come back?" — if yes, the category is live. We cache the
// result so UI can render conditional sections on cold start without blocking.

const LIVE_CACHE_KEY = '@titrahealth_hk_live_categories_v1';
const LIVE_LOOKBACK_DAYS = 30;

async function hasAnyRecentSample(HK: unknown, key: HKCategoryKey): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hk = HK as any;
  const type = HK_CATEGORIES[key];
  const opts = dateRangeOptions(startOfDaysAgo(LIVE_LOOKBACK_DAYS), new Date(), undefined, 1);
  try {
    if (CATEGORY_KEYS.has(key)) {
      const samples = await hk.queryCategorySamples(type, opts);
      return Array.isArray(samples) && samples.length > 0;
    }
    const samples = await hk.queryQuantitySamples(type, opts);
    return Array.isArray(samples) && samples.length > 0;
  } catch {
    // A throw here almost always means "permission denied for this type".
    // Denied == dormant from the user's perspective, so treat it as not live.
    return false;
  }
}

export async function refreshLiveCategories(): Promise<Set<HKCategoryKey>> {
  const HK = getHK();
  if (!HK) return new Set();
  const keys = Object.keys(HK_CATEGORIES) as HKCategoryKey[];
  const results = await Promise.all(keys.map((k) => hasAnyRecentSample(HK, k)));
  const live = new Set<HKCategoryKey>();
  keys.forEach((k, i) => { if (results[i]) live.add(k); });
  try {
    await AsyncStorage.setItem(LIVE_CACHE_KEY, JSON.stringify([...live]));
  } catch (e) {
    err('refreshLiveCategories cache write', e);
  }
  log('refreshLiveCategories →', live.size, 'live of', keys.length, ':', [...live].join(','));
  return live;
}

export async function getCachedLiveCategories(): Promise<Set<HKCategoryKey>> {
  try {
    const raw = await AsyncStorage.getItem(LIVE_CACHE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as HKCategoryKey[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

// ─── Diagnostic helper (for debug screens / REPL) ────────────────────────────

export async function diagnose(): Promise<{
  platform: string;
  isExpoGo: boolean;
  moduleLoaded: boolean;
  healthDataAvailable: boolean | null;
  liveCount: number;
  live: HKCategoryKey[];
}> {
  const report = {
    platform: Platform.OS,
    isExpoGo,
    moduleLoaded: false,
    healthDataAvailable: null as boolean | null,
    liveCount: 0,
    live: [] as HKCategoryKey[],
  };
  const HK = getHK();
  if (!HK) {
    log('diagnose:', JSON.stringify(report, null, 2));
    return report;
  }
  report.moduleLoaded = true;
  try {
    report.healthDataAvailable = await HK.isHealthDataAvailable();
  } catch (e) {
    err('diagnose isHealthDataAvailable', e);
  }
  const live = await refreshLiveCategories();
  report.liveCount = live.size;
  report.live = [...live];
  log('diagnose:', JSON.stringify(report, null, 2));
  return report;
}

// ─── Core readers ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sumToday(HK: any, type: string, unit: string): Promise<number> {
  const samples = await HK.queryQuantitySamples(type, dateRangeOptions(startOfToday(), new Date(), unit));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return samples.reduce((t: number, s: any) => t + s.quantity, 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function latestQuantity(HK: any, type: string, unit: string): Promise<number | null> {
  const sample = await HK.getMostRecentQuantitySample(type, unit);
  return sample ? (sample.quantity as number) : null;
}

export async function readTodaySteps(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try { return Math.round(await sumToday(HK, HK_CATEGORIES.steps, 'count')); }
  catch (e) { err('readTodaySteps', e); return null; }
}

export async function readTodayActiveCalories(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try { return Math.round(await sumToday(HK, HK_CATEGORIES.activeEnergy, 'kcal')); }
  catch (e) { err('readTodayActiveCalories', e); return null; }
}

export async function readLatestWeight(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.weight, 'lb');
    return v != null ? parseFloat(v.toFixed(1)) : null;
  } catch (e) { err('readLatestWeight', e); return null; }
}

// Returns the most recent body-mass sample along with its timestamp — used by
// the Log Weight auto-fill chip so we can show "recorded 14 min ago".
export async function readLatestWeightSample(): Promise<{ lbs: number; recordedAt: Date } | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const sample = await HK.getMostRecentQuantitySample(HK_CATEGORIES.weight, 'lb');
    if (!sample) return null;
    return {
      lbs: parseFloat((sample.quantity as number).toFixed(1)),
      recordedAt: new Date(sample.endDate ?? sample.startDate),
    };
  } catch (e) { err('readLatestWeightSample', e); return null; }
}

export async function readTodayNutrition(): Promise<{
  protein: number; calories: number; carbs: number; fat: number; fiber: number;
} | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const gOpts = dateRangeOptions(startOfToday(), new Date(), 'g');
    const cOpts = dateRangeOptions(startOfToday(), new Date(), 'kcal');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sum = (arr: any[]) => Math.round(excludeTitraSources(arr).reduce((t: number, s: any) => t + s.quantity, 0));
    const [protein, carbs, fat, fiber, calories] = await Promise.all([
      HK.queryQuantitySamples(HK_CATEGORIES.protein, gOpts),
      HK.queryQuantitySamples(HK_CATEGORIES.carbs, gOpts),
      HK.queryQuantitySamples(HK_CATEGORIES.fat, gOpts),
      HK.queryQuantitySamples(HK_CATEGORIES.fiber, gOpts),
      HK.queryQuantitySamples(HK_CATEGORIES.calories, cOpts),
    ]);
    return { protein: sum(protein), calories: sum(calories), carbs: sum(carbs), fat: sum(fat), fiber: sum(fiber) };
  } catch (e) { err('readTodayNutrition', e); return null; }
}

export async function readLatestHRV(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.hrv, 'ms');
    return v != null ? Math.round(v) : null;
  } catch (e) { err('readLatestHRV', e); return null; }
}

export async function readLatestRestingHR(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.restingHR, 'count/min');
    return v != null ? Math.round(v) : null;
  } catch (e) { err('readLatestRestingHR', e); return null; }
}

export async function readLastNightSleep(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0);
    const samples = await HK.queryCategorySamples(HK_CATEGORIES.sleep, dateRangeOptions(yesterday, new Date()));
    let totalMs = 0;
    // HKCategoryValueSleepAnalysis: InBed=0, Asleep (legacy)=1, Awake=2, Core=3, Deep=4, REM=5
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of samples as any[]) {
      if (s.value !== 0 && s.value !== 2) {
        totalMs += new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
      }
    }
    return totalMs > 0 ? parseFloat((totalMs / 3_600_000).toFixed(1)) : null;
  } catch (e) { err('readLastNightSleep', e); return null; }
}

export async function readLatestBloodGlucose(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.glucose, 'mg/dL');
    return v != null ? parseFloat(v.toFixed(1)) : null;
  } catch (e) { err('readLatestBloodGlucose', e); return null; }
}

// ─── Extended readers: body composition ──────────────────────────────────────

export async function readLatestBodyFat(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.bodyFat, '%');
    return v != null ? parseFloat((v * 100).toFixed(1)) : null;
  } catch (e) { err('readLatestBodyFat', e); return null; }
}

export async function readLatestLeanMass(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.leanMass, 'lb');
    return v != null ? parseFloat(v.toFixed(1)) : null;
  } catch (e) { err('readLatestLeanMass', e); return null; }
}

export async function readLatestWaist(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.waist, 'in');
    return v != null ? parseFloat(v.toFixed(1)) : null;
  } catch (e) { err('readLatestWaist', e); return null; }
}

export async function readLatestBMI(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.bmi, 'count');
    return v != null ? parseFloat(v.toFixed(1)) : null;
  } catch (e) { err('readLatestBMI', e); return null; }
}

// ─── Extended readers: cardiovascular ────────────────────────────────────────

export async function readLatestVO2Max(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.vo2max, 'mL/kg*min');
    return v != null ? parseFloat(v.toFixed(1)) : null;
  } catch (e) { err('readLatestVO2Max', e); return null; }
}

export async function readLatestSpO2(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const v = await latestQuantity(HK, HK_CATEGORIES.spo2, '%');
    return v != null ? parseFloat((v * 100).toFixed(1)) : null;
  } catch (e) { err('readLatestSpO2', e); return null; }
}

export async function readLatestBloodPressure(): Promise<{ systolic: number; diastolic: number } | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const [sys, dia] = await Promise.all([
      latestQuantity(HK, HK_CATEGORIES.bpSystolic, 'mmHg'),
      latestQuantity(HK, HK_CATEGORIES.bpDiastolic, 'mmHg'),
    ]);
    if (sys == null || dia == null) return null;
    return { systolic: Math.round(sys), diastolic: Math.round(dia) };
  } catch (e) { err('readLatestBloodPressure', e); return null; }
}

// ─── Extended readers: activity (watch) ──────────────────────────────────────

export async function readTodayExerciseMinutes(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try { return Math.round(await sumToday(HK, HK_CATEGORIES.exerciseMinutes, 'min')); }
  catch (e) { err('readTodayExerciseMinutes', e); return null; }
}

// ─── Extended readers: nutrition (extended macros) ───────────────────────────

export async function readTodayWater(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const samples = await HK.queryQuantitySamples(HK_CATEGORIES.water, dateRangeOptions(startOfToday(), new Date(), 'fl_oz_us'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = excludeTitraSources(samples).reduce((t: number, s: any) => t + s.quantity, 0);
    return total > 0 ? parseFloat(total.toFixed(1)) : 0;
  } catch (e) { err('readTodayWater', e); return null; }
}

// ─── Symptom reader (the big GLP-1 unlock) ───────────────────────────────────
//
// Apple's symptom tracker uses HKCategoryValueSeverity (0-4) for most symptoms
// and HKCategoryValuePresence (0-3) for a few (appetite/mood). We normalize
// both onto Titra's 0-10 slider scale.

const SEVERITY_TO_TITRA: Record<number, number> = {
  0: 0,   // notPresent — skip
  1: 3,   // mild
  2: 6,   // moderate
  3: 9,   // severe
  4: 5,   // unspecified
};

// Titra side-effect IDs that have a direct HK counterpart. Keys that resolve
// to null have no HK equivalent (food_noise, hair_loss is too noisy, etc.).
export const HK_SYMPTOM_MAP: Record<string, HKCategoryKey | null> = {
  nausea: 'symptomNausea',
  vomiting: 'symptomVomiting',
  diarrhea: 'symptomDiarrhea',
  constipation: 'symptomConstipation',
  heartburn: 'symptomHeartburn',
  bloating: 'symptomBloating',
  stomach_pain: 'symptomAbdominalCramps',
  migraine: 'symptomHeadache',
  fatigue: 'symptomFatigue',
  dizziness: 'symptomDizziness',
  rapid_heart_rate: 'symptomRapidHR',
  suppressed_appetite: 'symptomAppetite',
  mood_swings: 'symptomMood',
  hair_loss: 'symptomHairLoss',
};

// Returns a map of Titra side-effect id → suggested slider severity (1-10),
// for any symptom that has ≥1 sample logged in Apple Health today. Callers
// use this to pre-fill the Side Effects screen; the user can still slide the
// value back down to 0 to dismiss.
export async function readTodaySymptomSeverities(): Promise<Record<string, number>> {
  const HK = getHK();
  if (!HK) return {};
  const out: Record<string, number> = {};
  const entries = Object.entries(HK_SYMPTOM_MAP).filter(([, key]) => key != null) as [string, HKCategoryKey][];
  const opts = dateRangeOptions(startOfToday(), new Date());
  await Promise.all(entries.map(async ([sideEffectId, key]) => {
    try {
      const samples = await HK.queryCategorySamples(HK_CATEGORIES[key], opts);
      if (!Array.isArray(samples) || samples.length === 0) return;
      // Take the max severity across today's samples — if user felt nausea
      // mild earlier and severe later, we want to reflect the severe.
      let maxValue = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of samples as any[]) {
        const v = typeof s.value === 'number' ? s.value : 0;
        if (v > maxValue) maxValue = v;
      }
      if (maxValue <= 0) return;
      const titraSeverity = SEVERITY_TO_TITRA[maxValue] ?? 5;
      if (titraSeverity > 0) out[sideEffectId] = titraSeverity;
    } catch {
      // silent — category denied or unsupported, skip
    }
  }));
  return out;
}

// ─── Writers (unchanged contract, v13 API) ───────────────────────────────────

export async function writeWeight(lbs: number): Promise<void> {
  const HK = getHK();
  if (!HK) return;
  try {
    const now = new Date();
    await HK.saveQuantitySample(HK_CATEGORIES.weight, 'lb', lbs, now, now);
  } catch (e) {
    err('writeWeight', e);
  }
}

export async function writeNutrition(macros: {
  protein: number; calories: number; carbs: number; fat: number; fiber: number;
}): Promise<void> {
  const HK = getHK();
  if (!HK) return;
  try {
    const now = new Date();
    await Promise.all([
      HK.saveQuantitySample(HK_CATEGORIES.protein, 'g', macros.protein, now, now),
      HK.saveQuantitySample(HK_CATEGORIES.calories, 'kcal', macros.calories, now, now),
      HK.saveQuantitySample(HK_CATEGORIES.carbs, 'g', macros.carbs, now, now),
      HK.saveQuantitySample(HK_CATEGORIES.fat, 'g', macros.fat, now, now),
      HK.saveQuantitySample(HK_CATEGORIES.fiber, 'g', macros.fiber, now, now),
    ]);
  } catch (e) {
    err('writeNutrition', e);
  }
}
