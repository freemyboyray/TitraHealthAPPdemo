import Constants from 'expo-constants';
import { Platform } from 'react-native';

// NitroModules (used by react-native-healthkit) crash in Expo Go with a fatal
// error that bypasses try/catch. Skip the require entirely when in Expo Go.
const isExpoGo = Constants.appOwnership === 'expo';

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
  if (Platform.OS !== 'ios') return null;
  if (isExpoGo) return null; // NitroModules are not supported in Expo Go
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@kingstinct/react-native-healthkit').default;
  } catch {
    return null;
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function requestPermissions(): Promise<boolean> {
  const HK = getHK();
  if (!HK) return false;
  try {
    const available = await HK.isHealthDataAvailable();
    if (!available) return false;
    await HK.requestAuthorization(READ_TYPES, WRITE_TYPES);
    return true;
  } catch (error) {
    console.error('[HealthKit] requestPermissions failed:', error);
    return false;
  }
}

export async function readTodaySteps(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const samples = await HK.queryQuantitySamples(
      'HKQuantityTypeIdentifierStepCount',
      { from: startOfToday(), to: new Date(), unit: 'count' },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.round(samples.reduce((s: number, x: any) => s + x.quantity, 0));
  } catch {
    return null;
  }
}

export async function readTodayActiveCalories(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const samples = await HK.queryQuantitySamples(
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      { from: startOfToday(), to: new Date(), unit: 'kcal' },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.round(samples.reduce((s: number, x: any) => s + x.quantity, 0));
  } catch {
    return null;
  }
}

export async function readLatestWeight(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const sample = await HK.getLatestQuantitySample('HKQuantityTypeIdentifierBodyMass', 'lb');
    return sample ? parseFloat((sample.quantity as number).toFixed(1)) : null;
  } catch {
    return null;
  }
}

export async function readTodayNutrition(): Promise<{
  protein: number; calories: number; carbs: number; fat: number; fiber: number;
} | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const gOpts = { from: startOfToday(), to: new Date(), unit: 'g' };
    const cOpts = { from: startOfToday(), to: new Date(), unit: 'kcal' };
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
  } catch {
    return null;
  }
}

export async function readLatestHRV(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const sample = await HK.getLatestQuantitySample(
      'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms',
    );
    return sample ? Math.round(sample.quantity as number) : null;
  } catch {
    return null;
  }
}

export async function readLatestRestingHR(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const sample = await HK.getLatestQuantitySample(
      'HKQuantityTypeIdentifierRestingHeartRate', 'count/min',
    );
    return sample ? Math.round(sample.quantity as number) : null;
  } catch {
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
      { from: yesterday, to: new Date() },
    );
    // Sum asleep stages - exclude InBed (0) and Awake (2)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let totalMs = 0;
    for (const s of samples as any[]) {
      if (s.value !== 0 && s.value !== 2) {
        totalMs += new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
      }
    }
    return totalMs > 0 ? parseFloat((totalMs / 3_600_000).toFixed(1)) : null;
  } catch {
    return null;
  }
}

export async function readLatestBloodGlucose(): Promise<number | null> {
  const HK = getHK();
  if (!HK) return null;
  try {
    const sample = await HK.getLatestQuantitySample(
      'HKQuantityTypeIdentifierBloodGlucose', 'mg/dL',
    );
    return sample ? parseFloat((sample.quantity as number).toFixed(1)) : null;
  } catch {
    return null;
  }
}

export async function writeWeight(lbs: number): Promise<void> {
  const HK = getHK();
  if (!HK) return;
  try {
    const now = new Date();
    await HK.saveQuantitySample('HKQuantityTypeIdentifierBodyMass', 'lb', lbs, { start: now, end: now });
  } catch {
    // silent - write failures shouldn't crash the UI
  }
}

export async function writeNutrition(macros: {
  protein: number; calories: number; carbs: number; fat: number; fiber: number;
}): Promise<void> {
  const HK = getHK();
  if (!HK) return;
  try {
    const now = new Date();
    const opts = { start: now, end: now };
    await Promise.all([
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryProtein', 'g', macros.protein, opts),
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryEnergyConsumed', 'kcal', macros.calories, opts),
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryCarbohydrates', 'g', macros.carbs, opts),
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryFatTotal', 'g', macros.fat, opts),
      HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryFiber', 'g', macros.fiber, opts),
    ]);
  } catch {
    // silent
  }
}
