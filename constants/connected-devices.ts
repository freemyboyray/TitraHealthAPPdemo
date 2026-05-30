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
    whyItMatters: 'Track weight trends, body fat %, and lean mass to see if you\'re losing fat — not muscle.',
    icon: 'Scale',
    accent: '#5AC8FA',
    hkKeys: ['weight', 'bodyFat', 'leanMass', 'bmi'],
    dataTypes: ['Weight', 'Body Fat %', 'Lean Mass', 'BMI'],
    products: [
      { name: 'Withings Body Smart', note: 'Wi-Fi sync, body composition', price: '$100', companionApp: 'Withings Health Mate' },
      { name: 'RENPHO Smart Scale', note: 'Budget pick, 13 metrics', price: '$20', companionApp: 'RENPHO Health' },
      { name: 'Garmin Index S2', note: 'Best for Garmin users', price: '$150', companionApp: 'Garmin Connect' },
    ],
  },
  {
    id: 'cgm',
    title: 'Glucose Monitors',
    subtitle: 'See real-time blood sugar response',
    whyItMatters: 'GLP-1 medications directly affect blood glucose. A CGM shows you the impact in real time.',
    icon: 'Activity',
    accent: '#FF9500',
    hkKeys: ['glucose'],
    dataTypes: ['Blood Glucose'],
    products: [
      { name: 'Dexcom Stelo', note: 'Over-the-counter, no Rx', price: '$49/mo', companionApp: 'Stelo by Dexcom' },
      { name: 'Dexcom G7', note: 'Real-time alerts, Apple Watch', price: '$75/mo', companionApp: 'Dexcom G7' },
      { name: 'FreeStyle Libre 3', note: '14-day sensor, compact', price: '$35/mo', companionApp: 'FreeStyle Libre 3' },
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
    id: 'blood-pressure',
    title: 'Blood Pressure',
    subtitle: 'Track cardiovascular improvements',
    whyItMatters: 'GLP-1 medications can lower blood pressure. A connected monitor tracks the improvement automatically.',
    icon: 'HeartPulse',
    accent: '#FF2D55',
    hkKeys: ['bpSystolic', 'bpDiastolic'],
    dataTypes: ['Systolic', 'Diastolic'],
    products: [
      { name: 'Withings BPM Connect', note: 'Wi-Fi, phone-free sync', price: '$100', companionApp: 'Withings Health Mate' },
      { name: 'OMRON Evolv', note: '#1 doctor-recommended', price: '$75', companionApp: 'OMRON Connect' },
      { name: 'QardioArm', note: 'Compact, portable', price: '$80', companionApp: 'Qardio' },
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
