import { Platform } from 'react-native';

/**
 * Platform-aware display name for the OS health data service.
 *
 * iOS reads/writes via Apple HealthKit → users know it as "Apple Health".
 * Android reads via Google's Health Connect → users know it as "Health Connect".
 *
 * Use this in any USER-FACING string instead of hardcoding "Apple Health" so the
 * UI renders the correct brand per platform. (Internal storage keys, routes, and
 * comments intentionally keep their existing names — only display text uses this.)
 */
export const HEALTH_SERVICE_NAME = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';
