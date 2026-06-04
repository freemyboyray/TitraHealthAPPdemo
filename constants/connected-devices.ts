import type { HKCategoryKey } from '@/lib/healthkit';

export type DeviceProduct = {
  name: string;
  note: string;
  price: string;
  companionApp: string;
};

export type DeviceCategory = {
  id: string;
  title: string;
  subtitle: string;
  whyItMatters: string;
  icon: string;
  accent: string;
  hkKeys: HKCategoryKey[];
  dataTypes: string[];
  products: DeviceProduct[];
};

export const DEVICE_CATEGORIES: DeviceCategory[] = [
  {
    id: 'smart-scales',
    title: 'Smart Scales',
    subtitle: 'The most impactful device for GLP-1 tracking',
    whyItMatters: 'Track weight trends, body fat %, and lean mass to see if you\'re losing fat, not muscle.',
    icon: 'Scale',
    accent: '#5AC8FA',
    hkKeys: ['weight', 'bodyFat', 'leanMass'],
    dataTypes: ['Weight', 'Body Fat %', 'Lean Mass'],
    products: [
      { name: 'Withings Body Smart', note: 'Wi-Fi sync, body composition', price: '$100', companionApp: 'Withings Health Mate' },
      { name: 'RENPHO Smart Scale', note: 'Budget pick, 13 metrics', price: '$20', companionApp: 'RENPHO Health' },
      { name: 'Garmin Index S2', note: 'Best for Garmin users', price: '$150', companionApp: 'Garmin Connect' },
    ],
  },
  {
    id: 'fitness-trackers',
    title: 'Wearables',
    subtitle: 'Activity, sleep, and recovery',
    whyItMatters: 'Steps, heart rate variability, and sleep quality all feed into your energy and recovery scores.',
    icon: 'Activity',
    accent: '#34C759',
    hkKeys: ['steps', 'activeEnergy', 'hrv', 'restingHR', 'sleep', 'spo2', 'exerciseMinutes'],
    dataTypes: ['Steps', 'Heart Rate', 'HRV', 'Sleep', 'SpO\u2082', 'Workouts'],
    products: [
      { name: 'Apple Watch', note: 'Deepest HealthKit integration', price: '$249+', companionApp: 'Built-in' },
      { name: 'Oura Ring Gen 4', note: 'Best sleep & recovery ring', price: '$349+', companionApp: 'Oura' },
      { name: 'WHOOP 5.0', note: 'Strain & recovery focus', price: '$199/yr', companionApp: 'WHOOP' },
      { name: 'Garmin', note: 'Venu, Forerunner, Fenix series', price: '$300+', companionApp: 'Garmin Connect' },
    ],
  },
  {
    id: 'sleep-trackers',
    title: 'Sleep Trackers',
    subtitle: 'Sleep drives appetite and recovery',
    whyItMatters: 'Poor sleep increases hunger hormones and reduces GLP-1 effectiveness. Better sleep = better results.',
    icon: 'Moon',
    accent: '#AF52DE',
    hkKeys: ['sleep', 'respiratoryRate'],
    dataTypes: ['Sleep Stages', 'Respiratory Rate'],
    products: [
      { name: 'Oura Ring Gen 4', note: 'Gold standard for sleep', price: '$349+', companionApp: 'Oura' },
      { name: 'Withings Sleep Mat', note: 'Under-mattress, no wearable', price: '$100', companionApp: 'Withings Health Mate' },
      { name: 'Eight Sleep Pod', note: 'Smart mattress + climate', price: '$2,000+', companionApp: 'Eight Sleep' },
    ],
  },
];
