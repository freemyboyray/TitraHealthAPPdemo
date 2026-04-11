import Constants from 'expo-constants';
import { Platform } from 'react-native';

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

// All HealthKit type identifier strings (Apple native)
const READ_TYPES = [
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBloodGlucose',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKQuantityTypeIdentifierDietaryFiber',
] as const;

const WRITE_TYPES = [
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKQuantityTypeIdentifierDietaryFiber',
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHK(): any | null {
  if (Platform.OS !== 'ios') {
    log('getHK → null (platform is not iOS)');
    return null;
  }
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

// Helper: build the v13 QueryOptions shape. v13 expects:
//   { filter: { date: { startDate, endDate } }, limit, unit? }
// Pass limit: 0 to fetch all samples in the date window.
function dateRangeOptions(from: Date, to: Date, unit?: string) {
  return {
    filter: { date: { startDate: from, endDate: to } },
    limit: 0,
    ...(unit ? { unit } : {}),
  };
}

export async function requestPermissions(): Promise<boolean> {
  const HK = getHK();
  if (!HK) {
    warn('requestPermissions → false (HealthKit module unavailable)');
    return false;
  }
  try {
    // isHealthDataAvailable is sync in v13 but await-on-value is safe
    const available = await HK.isHealthDataAvailable();
    if (!available) {
      warn('requestPermissions → false (HealthKit not available on this device)');
      return false;
    }
    log('requesting authorization for', READ_TYPES.length, 'read types and', WRITE_TYPES.length, 'write types');
    // v13 API: single object { toShare, toRead }
    await HK.requestAuthorization({ toShare: WRITE_TYPES, toRead: READ_TYPES });
    log('requestAuthorization call resolved — iOS does not reveal read grants, but the sheet was presented if needed');
    return true;
  } catch (e) {
    err('requestPermissions failed', e);
    return false;
  }
}

// Diagnostic helper — call from a debug screen or console to see why HK isn't working.
export async function diagnose(): Promise<{
  platform: string;
  isExpoGo: boolean;
  moduleLoaded: boolean;
  healthDataAvailable: boolean | null;
  sampleReads: Record<string, unknown>;
}> {
  const report = {
    platform: Platform.OS,
    isExpoGo,
    moduleLoaded: false,
    healthDataAvailable: null as boolean | null,
    sampleReads: {} as Record<string, unknown>,
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
  const tryRead = async (label: string, fn: () => Promise<unknown>) => {
    try {
      report.sampleReads[label] = await fn();
    } catch (e) {
      report.sampleReads[label] = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
    }
  };
  await Promise.all([
    tryRead('weight', readLatestWeight),
    tryRead('hrv', readLatestHRV),
    tryRead('restingHR', readLatestRestingHR),
    tryRead('steps', readTodaySteps),
    tryRead('activeCalories', readTodayActiveCalories),
    tryRead('sleep', readLastNightSleep),
    tryRead('glucose', readLatestBloodGlucose),
    tryRead('nutrition', readTodayNutrition),
  ]);
  log('diagnose:', JSON.stringify(report, null, 2));
  return report;
}

export async function readTodaySteps(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const samples = await HK.queryQuantitySamples(
      'HKQuantityTypeIdentifierStepCount',
      dateRangeOptions(startOfToday(), new Date(), 'count'),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.round(samples.reduce((s: number, x: any) => s + x.quantity, 0));
  } catch (e) {
    err('readTodaySteps', e);
    return null;
  }
}

export async function readTodayActiveCalories(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const samples = await HK.queryQuantitySamples(
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      dateRangeOptions(startOfToday(), new Date(), 'kcal'),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.round(samples.reduce((s: number, x: any) => s + x.quantity, 0));
  } catch (e) {
    err('readTodayActiveCalories', e);
    return null;
  }
}

export async function readLatestWeight(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    // v13: getLatestQuantitySample was renamed to getMostRecentQuantitySample
    const sample = await HK.getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'lb');
    return sample ? parseFloat((sample.quantity as number).toFixed(1)) : null;
  } catch (e) {
    err('readLatestWeight', e);
    return null;
  }
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
    const sum = (arr: any[]) => Math.round(arr.reduce((t: number, s: any) => t + s.quantity, 0));
    const [protein, carbs, fat, fiber, calories] = await Promise.all([
      HK.queryQuantitySamples('HKQuantityTypeIdentifierDietaryProtein', gOpts),
      HK.queryQuantitySamples('HKQuantityTypeIdentifierDietaryCarbohydrates', gOpts),
      HK.queryQuantitySamples('HKQuantityTypeIdentifierDietaryFatTotal', gOpts),
      HK.queryQuantitySamples('HKQuantityTypeIdentifierDietaryFiber', gOpts),
      HK.queryQuantitySamples('HKQuantityTypeIdentifierDietaryEnergyConsumed', cOpts),
    ]);
    return { protein: sum(protein), calories: sum(calories), carbs: sum(carbs), fat: sum(fat), fiber: sum(fiber) };
  } catch (e) {
    err('readTodayNutrition', e);
    return null;
  }
}

export async function readLatestHRV(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const sample = await HK.getMostRecentQuantitySample(
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms',
    );
    return sample ? Math.round(sample.quantity as number) : null;
  } catch (e) {
    err('readLatestHRV', e);
    return null;
  }
}

export async function readLatestRestingHR(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const sample = await HK.getMostRecentQuantitySample(
      'HKQuantityTypeIdentifierRestingHeartRate', 'count/min',
    );
    return sample ? Math.round(sample.quantity as number) : null;
  } catch (e) {
    err('readLatestRestingHR', e);
    return null;
  }
}

export async function readLastNightSleep(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0);
    const samples = await HK.queryCategorySamples(
      'HKCategoryTypeIdentifierSleepAnalysis',
      dateRangeOptions(yesterday, new Date()),
    );
    // Sum asleep stages - exclude InBed (0) and Awake (2)
    let totalMs = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of samples as any[]) {
      if (s.value !== 0 && s.value !== 2) {
        totalMs += new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
      }
    }
    return totalMs > 0 ? parseFloat((totalMs / 3_600_000).toFixed(1)) : null;
  } catch (e) {
    err('readLastNightSleep', e);
    return null;
  }
}

export async function readLatestBloodGlucose(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const sample = await HK.getMostRecentQuantitySample(
      'HKQuantityTypeIdentifierBloodGlucose', 'mg/dL',
    );
    return sample ? parseFloat((sample.quantity as number).toFixed(1)) : null;
  } catch (e) {
    err('readLatestBloodGlucose', e);
    return null;
  }
}

export async function writeWeight(lbs: number): Promise<void> {
  const HK = getHK();
  if (!HK) return;
  try {
    const now = new Date();
    // v13: positional start/end dates (not an options object)
    await HK.saveQuantitySample('HKQuantityTypeIdentifierBodyMass', 'lb', lbs, now, now);
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
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryProtein', 'g', macros.protein, now, now),
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryEnergyConsumed', 'kcal', macros.calories, now, now),
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryCarbohydrates', 'g', macros.carbs, now, now),
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryFatTotal', 'g', macros.fat, now, now),
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryFiber', 'g', macros.fiber, now, now),
    ]);
  } catch (e) {
    err('writeNutrition', e);
  }
}
