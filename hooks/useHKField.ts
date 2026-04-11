import { useHealthKitStore } from '../stores/healthkit-store';
import type { HKCategoryKey } from '../lib/healthkit';

// Maps a single HK category key to the store field that holds its value.
// Keys that don't have a store-backed value (symptoms, height, etc.) return
// null for `value` but still expose a `live` flag.
//
// Usage:
//   const vo2 = useHKField('vo2max');
//   if (!vo2.live) return null;
//   return <Text>{vo2.value} mL/kg/min</Text>;
const FIELD_MAP: Partial<Record<HKCategoryKey, keyof ReturnType<typeof useHealthKitStore.getState>>> = {
  weight: 'latestWeight',
  steps: 'steps',
  activeEnergy: 'activeCalories',
  hrv: 'hrv',
  restingHR: 'restingHR',
  sleep: 'sleepHours',
  glucose: 'bloodGlucose',
  bodyFat: 'bodyFat',
  leanMass: 'leanMass',
  waist: 'waist',
  bmi: 'bmi',
  vo2max: 'vo2max',
  spo2: 'spo2',
  exerciseMinutes: 'exerciseMinutes',
  water: 'waterToday',
};

type HKFieldResult<T = unknown> = {
  value: T | null;
  live: boolean;
};

export function useHKField<T = number>(key: HKCategoryKey): HKFieldResult<T> {
  const live = useHealthKitStore((s) => s.liveCategories.has(key));
  const fieldName = FIELD_MAP[key];
  const value = useHealthKitStore((s) => {
    if (!fieldName) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (s as any)[fieldName] as T | null;
  });
  return { value, live };
}

// Convenience: batch check if any of the given categories are live. Use to
// render a whole section header only when at least one tile inside has data.
export function useAnyHKLive(keys: HKCategoryKey[]): boolean {
  return useHealthKitStore((s) => keys.some((k) => s.liveCategories.has(k)));
}
