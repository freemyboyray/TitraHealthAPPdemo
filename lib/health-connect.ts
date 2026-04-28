import { Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHC(): any | null {
  if (Platform.OS !== 'android') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-health-connect');
  } catch {
    return null;
  }
}

function isoNow() { return new Date().toISOString(); }
function isoStartOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function isoYesterday6pm() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

export async function requestPermissions(): Promise<boolean> {
  const HC = getHC();
  if (!HC) return false;
  try {
    const ok = await HC.initialize();
    if (!ok) return false;
    await HC.requestPermission([
      { accessType: 'read',  recordType: 'Steps' },
      { accessType: 'read',  recordType: 'ActiveCaloriesBurned' },
      { accessType: 'read',  recordType: 'HeartRateVariabilityRmssd' },
      { accessType: 'read',  recordType: 'RestingHeartRate' },
      { accessType: 'read',  recordType: 'SleepSession' },
      { accessType: 'read',  recordType: 'BloodGlucose' },
      { accessType: 'read',  recordType: 'Nutrition' },
      { accessType: 'read',  recordType: 'Weight' },
      { accessType: 'write', recordType: 'Weight' },
      { accessType: 'write', recordType: 'Nutrition' },
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function readTodaySteps(): Promise<number | null> {
  const HC = getHC();
  if (!HC) return null;
  try {
    const timeRangeFilter = { operator: 'between', startTime: isoStartOfToday(), endTime: isoNow() };
    const { records } = await HC.readRecords('Steps', { timeRangeFilter });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.round(records.reduce((s: number, r: any) => s + r.count, 0));
  } catch {
    return null;
  }
}

export async function readTodayActiveCalories(): Promise<number | null> {
  const HC = getHC();
  if (!HC) return null;
  try {
    const timeRangeFilter = { operator: 'between', startTime: isoStartOfToday(), endTime: isoNow() };
    const { records } = await HC.readRecords('ActiveCaloriesBurned', { timeRangeFilter });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.round(records.reduce((s: number, r: any) => s + (r.energy?.inKilocalories ?? 0), 0));
  } catch {
    return null;
  }
}

export async function readLatestWeight(): Promise<number | null> {
  const HC = getHC();
  if (!HC) return null;
  try {
    const timeRangeFilter = { operator: 'before', endTime: isoNow() };
    const { records } = await HC.readRecords('Weight', { timeRangeFilter, ascendingOrder: false, pageSize: 1 });
    if (!records.length) return null;
    const kg = records[0].weight?.inKilograms ?? null;
    return kg ? parseFloat((kg * 2.20462).toFixed(1)) : null;
  } catch {
    return null;
  }
}

export async function readTodayNutrition(): Promise<{
  protein: number; calories: number; carbs: number; fat: number; fiber: number;
} | null> {
  const HC = getHC();
  if (!HC) return null;
  try {
    const timeRangeFilter = { operator: 'between', startTime: isoStartOfToday(), endTime: isoNow() };
    const { records } = await HC.readRecords('Nutrition', { timeRangeFilter });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sum = (key: string) => Math.round(records.reduce((s: number, r: any) => s + (r[key]?.inGrams ?? 0), 0));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kcal = Math.round(records.reduce((s: number, r: any) => s + (r.energy?.inKilocalories ?? 0), 0));
    return { protein: sum('protein'), calories: kcal, carbs: sum('totalCarbohydrate'), fat: sum('totalFat'), fiber: sum('dietaryFiber') };
  } catch {
    return null;
  }
}

export async function readLatestHRV(): Promise<number | null> {
  const HC = getHC();
  if (!HC) return null;
  try {
    const timeRangeFilter = { operator: 'before', endTime: isoNow() };
    const { records } = await HC.readRecords('HeartRateVariabilityRmssd', { timeRangeFilter, ascendingOrder: false, pageSize: 1 });
    if (!records.length) return null;
    return Math.round(records[0].heartRateVariabilityMillis ?? 0);
  } catch {
    return null;
  }
}

export async function readLatestRestingHR(): Promise<number | null> {
  const HC = getHC();
  if (!HC) return null;
  try {
    const timeRangeFilter = { operator: 'before', endTime: isoNow() };
    const { records } = await HC.readRecords('RestingHeartRate', { timeRangeFilter, ascendingOrder: false, pageSize: 1 });
    if (!records.length) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Math.round(records[0].samples?.[0]?.beatsPerMinute ?? records[0].beatsPerMinute ?? 0);
  } catch {
    return null;
  }
}

export async function readLastNightSleep(): Promise<number | null> {
  const HC = getHC();
  if (!HC) return null;
  try {
    const timeRangeFilter = { operator: 'between', startTime: isoYesterday6pm(), endTime: isoNow() };
    const { records } = await HC.readRecords('SleepSession', { timeRangeFilter });
    let totalMs = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of records as any[]) {
      totalMs += new Date(r.endTime).getTime() - new Date(r.startTime).getTime();
    }
    return totalMs > 0 ? parseFloat((totalMs / 3_600_000).toFixed(1)) : null;
  } catch {
    return null;
  }
}

export async function readLatestBloodGlucose(): Promise<number | null> {
  const HC = getHC();
  if (!HC) return null;
  try {
    const timeRangeFilter = { operator: 'before', endTime: isoNow() };
    const { records } = await HC.readRecords('BloodGlucose', { timeRangeFilter, ascendingOrder: false, pageSize: 1 });
    if (!records.length) return null;
    return parseFloat((records[0].level?.inMilligramsPerDeciliter ?? 0).toFixed(1));
  } catch {
    return null;
  }
}

export async function writeWeight(lbs: number): Promise<void> {
  const HC = getHC();
  if (!HC) return;
  try {
    await HC.insertRecords([{
      recordType: 'Weight',
      weight: { unit: 'pounds', value: lbs },
      time: isoNow(),
    }]);
  } catch {
    // silent
  }
}

export async function writeNutrition(macros: {
  protein: number; calories: number; carbs: number; fat: number; fiber: number;
}): Promise<void> {
  const HC = getHC();
  if (!HC) return;
  try {
    await HC.insertRecords([{
      recordType: 'Nutrition',
      startTime: isoNow(),
      endTime: isoNow(),
      energy: { unit: 'kilocalories', value: macros.calories },
      protein: { unit: 'grams', value: macros.protein },
      totalCarbohydrate: { unit: 'grams', value: macros.carbs },
      totalFat: { unit: 'grams', value: macros.fat },
      dietaryFiber: { unit: 'grams', value: macros.fiber },
    }]);
  } catch {
    // silent
  }
}

export async function writeWater(ml: number): Promise<void> {
  const HC = getHC();
  if (!HC) return;
  try {
    await HC.insertRecords([{
      recordType: 'Hydration',
      startTime: isoNow(),
      endTime: isoNow(),
      volume: { unit: 'milliliters', value: ml },
    }]);
  } catch {
    // silent
  }
}
