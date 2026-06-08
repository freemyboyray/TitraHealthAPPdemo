// Single source of truth for the weekly check-in domains — label, icon, a stable
// per-domain identity color, and the 0–12 sum → status mapping. Consumed by the
// check-in form, the result screen, and the history screen so copy + color never
// drift between them. (The form layers on daily-drug question variants + the
// Dose Consistency domain; everything else reads from here.)

import type { ImageSourcePropType } from 'react-native';

export type CheckinDomainKey =
  | 'gi_burden'
  | 'energy_mood'
  | 'appetite'
  | 'food_noise'
  | 'sleep_quality'
  | 'activity_quality'
  | 'mental_health';

export type DomainStatus = { label: string; color: string };

// Status ramp (mirrors DESIGN.md "Status ramp" — good → low).
export const STATUS_GOOD = '#27AE60';
export const STATUS_OKAY = '#5AC8FA';
export const STATUS_MID = '#F6CB45';
export const STATUS_WARN = '#E8960C';
export const STATUS_BAD = '#E53E3E';

/**
 * Bucket a 0–12 question sum into one of four status labels/colors.
 * labels[0] = lowest sum, labels[3] = highest sum (semantics depend on domain).
 */
export function makeStatus(
  sum: number,
  labels: readonly [string, string, string, string],
  colors: readonly [string, string, string, string],
): DomainStatus {
  if (sum <= 2) return { label: labels[0], color: colors[0] };
  if (sum <= 5) return { label: labels[1], color: colors[1] };
  if (sum <= 8) return { label: labels[2], color: colors[2] };
  return { label: labels[3], color: colors[3] };
}

export type CheckinDomainMeta = {
  key: CheckinDomainKey;
  label: string;
  icon: string;
  /** Stable identity color for this domain's icon/accents (DESIGN: same metric, same color). */
  color: string;
  /** When true, higher sum = better (activity). All others: higher sum = worse. */
  higherIsBetter: boolean;
  getStatus: (sum: number) => DomainStatus;
};

export const CHECKIN_DOMAINS: readonly CheckinDomainMeta[] = [
  {
    key: 'gi_burden',
    label: 'GI Symptoms',
    icon: 'Hospital',
    color: '#E0533A',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Minimal', 'Mild', 'Moderate', 'Severe'],
      [STATUS_GOOD, STATUS_MID, STATUS_WARN, STATUS_BAD]),
  },
  {
    key: 'energy_mood',
    label: 'Energy & Mood',
    icon: 'Zap',
    color: '#F5972A',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Excellent', 'Good', 'Fair', 'Low'],
      [STATUS_GOOD, STATUS_OKAY, STATUS_MID, STATUS_BAD]),
  },
  {
    key: 'appetite',
    label: 'Appetite',
    icon: 'Utensils',
    color: '#E8960C',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Excellent', 'Good', 'Fair', 'Low'],
      [STATUS_GOOD, STATUS_OKAY, STATUS_MID, STATUS_BAD]),
  },
  {
    key: 'food_noise',
    label: 'Food Noise',
    icon: 'Volume2',
    color: '#9B6EE0',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Quiet', 'Mild', 'Moderate', 'High'],
      [STATUS_GOOD, STATUS_OKAY, STATUS_MID, STATUS_BAD]),
  },
  {
    key: 'sleep_quality',
    label: 'Sleep',
    icon: 'Moon',
    color: '#6E73E0',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Excellent', 'Good', 'Fair', 'Poor'],
      [STATUS_GOOD, STATUS_OKAY, STATUS_MID, STATUS_BAD]),
  },
  {
    key: 'activity_quality',
    label: 'Activity',
    icon: 'Dumbbell',
    color: '#3AAE5A',
    higherIsBetter: true,
    getStatus: (s) => makeStatus(s,
      ['Low', 'Fair', 'Good', 'Excellent'],
      [STATUS_BAD, STATUS_MID, STATUS_OKAY, STATUS_GOOD]),
  },
  {
    key: 'mental_health',
    label: 'Mental Health',
    icon: 'Heart',
    color: '#E0699B',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Stable', 'Mild', 'Moderate', 'High'],
      [STATUS_GOOD, STATUS_OKAY, STATUS_MID, STATUS_BAD]),
  },
] as const;

export const DOMAIN_ORDER: readonly CheckinDomainKey[] =
  CHECKIN_DOMAINS.map((d) => d.key);

export const DOMAIN_BY_KEY: Record<CheckinDomainKey, CheckinDomainMeta> =
  Object.fromEntries(CHECKIN_DOMAINS.map((d) => [d.key, d])) as Record<CheckinDomainKey, CheckinDomainMeta>;

/**
 * Per-domain hero illustration — the same hand-illustrated asset shown big at the
 * top of each section in the paged check-in form, reused (small) on the result &
 * history screens so a domain's identity stays consistent everywhere.
 */
export const CHECKIN_ASSETS: Record<CheckinDomainKey, ImageSourcePropType> = {
  gi_burden:        require('@/assets/images/checkin/gi-symptoms.png'),
  energy_mood:      require('@/assets/images/checkin/energy-mood.png'),
  appetite:         require('@/assets/images/checkin/appetite.png'),
  food_noise:       require('@/assets/images/checkin/food-noise.png'),
  sleep_quality:    require('@/assets/images/checkin/sleep.png'),
  activity_quality: require('@/assets/images/checkin/activity.png'),
  mental_health:    require('@/assets/images/checkin/mental-health.png'),
};

/** Map a 0–100 check-in score to a status-ramp color (used by the summary page). */
export function scoreColor(score: number): string {
  if (score >= 70) return STATUS_GOOD;
  if (score >= 50) return STATUS_MID;
  if (score >= 30) return STATUS_WARN;
  return STATUS_BAD;
}
