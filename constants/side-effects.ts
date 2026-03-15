import type { SideEffectType } from '../stores/log-store';

export type SideEffectCategory = 'digestive' | 'appetite' | 'physical' | 'mental';

export type SideEffectId =
  | 'nausea' | 'heartburn' | 'constipation' | 'diarrhea' | 'bloating'
  | 'sulfur_burps' | 'stomach_pain' | 'metallic_taste' | 'vomiting'
  | 'food_noise' | 'suppressed_appetite'
  | 'fatigue' | 'hair_loss' | 'migraine' | 'muscle_loss' | 'loose_skin'
  | 'injection_site' | 'dizziness' | 'rapid_heart_rate'
  | 'mood_swings' | 'injection_anxiety' | 'brain_fog' | 'sleep_disturbances';

export type SideEffectDef = {
  id: SideEffectId;
  label: string;
  category: SideEffectCategory;
  defaultEnabled: boolean;
  dbType: SideEffectType;
};

export const SIDE_EFFECTS: SideEffectDef[] = [
  // Digestive
  { id: 'nausea',          label: 'Nausea',            category: 'digestive', defaultEnabled: true,  dbType: 'nausea' },
  { id: 'heartburn',       label: 'Heartburn',         category: 'digestive', defaultEnabled: true,  dbType: 'heartburn' },
  { id: 'constipation',    label: 'Constipation',      category: 'digestive', defaultEnabled: false, dbType: 'constipation' },
  { id: 'diarrhea',        label: 'Diarrhea',          category: 'digestive', defaultEnabled: false, dbType: 'diarrhea' },
  { id: 'bloating',        label: 'Bloating',          category: 'digestive', defaultEnabled: false, dbType: 'bloating' },
  { id: 'sulfur_burps',    label: 'Sulfur Burps',      category: 'digestive', defaultEnabled: false, dbType: 'sulfur_burps' },
  { id: 'stomach_pain',    label: 'Stomach Pain',      category: 'digestive', defaultEnabled: false, dbType: 'other' },
  { id: 'metallic_taste',  label: 'Metallic Taste',    category: 'digestive', defaultEnabled: false, dbType: 'other' },
  { id: 'vomiting',        label: 'Vomiting',          category: 'digestive', defaultEnabled: false, dbType: 'vomiting' },
  // Appetite
  { id: 'food_noise',          label: 'Food Noise',          category: 'appetite', defaultEnabled: true, dbType: 'food_noise' },
  { id: 'suppressed_appetite', label: 'Suppressed Appetite', category: 'appetite', defaultEnabled: true, dbType: 'appetite_loss' },
  // Physical
  { id: 'fatigue',          label: 'Fatigue',          category: 'physical', defaultEnabled: true,  dbType: 'fatigue' },
  { id: 'hair_loss',        label: 'Hair Loss',        category: 'physical', defaultEnabled: true,  dbType: 'hair_loss' },
  { id: 'migraine',         label: 'Migraine',         category: 'physical', defaultEnabled: false, dbType: 'headache' },
  { id: 'muscle_loss',      label: 'Muscle Loss',      category: 'physical', defaultEnabled: false, dbType: 'muscle_loss' },
  { id: 'loose_skin',       label: 'Loose Skin',       category: 'physical', defaultEnabled: false, dbType: 'other' },
  { id: 'injection_site',   label: 'Injection Site',   category: 'physical', defaultEnabled: false, dbType: 'injection_site' },
  { id: 'dizziness',        label: 'Dizziness',        category: 'physical', defaultEnabled: false, dbType: 'dizziness' },
  { id: 'rapid_heart_rate', label: 'Rapid Heart Rate', category: 'physical', defaultEnabled: false, dbType: 'other' },
  // Mental
  { id: 'mood_swings',        label: 'Mood Swings',        category: 'mental', defaultEnabled: false, dbType: 'other' },
  { id: 'injection_anxiety',  label: 'Injection Anxiety',  category: 'mental', defaultEnabled: false, dbType: 'other' },
  { id: 'brain_fog',          label: 'Brain Fog',          category: 'mental', defaultEnabled: false, dbType: 'other' },
  { id: 'sleep_disturbances', label: 'Sleep Disturbances', category: 'mental', defaultEnabled: false, dbType: 'other' },
];

export const CATEGORY_LABELS: Record<SideEffectCategory, string> = {
  digestive: 'Digestive',
  appetite:  'Appetite',
  physical:  'Physical',
  mental:    'Mental',
};

export const ACTIVE_EFFECTS_KEY = '@titrahealth_active_effects';
export const CUSTOM_EFFECTS_KEY  = '@titrahealth_custom_effects';
