import { NativeModules, Platform } from 'react-native';

interface WidgetDataPayload {
  doseStatusLabel: string;
  doseUrgency: 'logged' | 'upcoming' | 'soon' | 'dueToday' | 'overdue';
  cycleDayLabel: string;
  cycleProgress: number;
  phaseName: string;
  medicationLabel: string;
  weightDeltaLbs: number | null;
  percentToGoal: number | null;
  streakCount: number;
  lastUpdated: string; // ISO 8601
}

const noop = { syncData: async (_: any) => { console.warn('[WidgetSync] NOOP — native module not found'); }, reloadTimelines: async () => {} };
const hasNative = Platform.OS === 'ios' && NativeModules.WidgetSyncModule;
console.warn('[WidgetSync] NativeModules.WidgetSyncModule =', hasNative ? 'FOUND' : 'MISSING');
const WidgetSync = hasNative ? NativeModules.WidgetSyncModule : noop;

/** Write current app state to the widget's shared storage and trigger a refresh. */
export async function syncWidgetData(data: WidgetDataPayload): Promise<void> {
  try {
    await WidgetSync.syncData(data);
  } catch {
    // Widget sync is best-effort; never crash the app for it
  }
}

/** Force the widget to re-read its data without writing new data. */
export async function reloadWidgetTimelines(): Promise<void> {
  try {
    await WidgetSync.reloadTimelines();
  } catch {
    // Best-effort
  }
}

export type { WidgetDataPayload };
