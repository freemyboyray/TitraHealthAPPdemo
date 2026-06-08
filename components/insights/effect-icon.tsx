import React from 'react';

import { LucideIconByName } from '@/lib/lucide-icon-map';

// Shared display registry for side-effect types (the stored effect_type values).
// Centralized here so the cycle, trend, and cluster cards stay consistent.

export const EFFECT_LABELS: Record<string, string> = {
  nausea: 'Nausea', vomiting: 'Vomiting', fatigue: 'Fatigue',
  constipation: 'Constipation', diarrhea: 'Diarrhea', headache: 'Headache',
  injection_site: 'Injection Site', appetite_loss: 'Appetite Loss',
  dehydration: 'Dehydration', dizziness: 'Dizziness', muscle_loss: 'Muscle Loss',
  heartburn: 'Heartburn', food_noise: 'Food Noise', sulfur_burps: 'Sulfur Burps',
  bloating: 'Bloating', hair_loss: 'Hair Loss', other: 'Other',
};

export const EFFECT_ICONS: Record<string, string> = {
  nausea:         'Frown',
  vomiting:       'Frown',
  fatigue:        'Bed',
  constipation:   'PersonStanding',
  diarrhea:       'Droplet',
  headache:       'Brain',
  injection_site: 'Syringe',
  appetite_loss:  'Utensils',
  dehydration:    'Droplet',
  dizziness:      'RefreshCw',
  muscle_loss:    'Dumbbell',
  heartburn:      'Flame',
  food_noise:     'Brain',
  sulfur_burps:   'Wind',
  bloating:       'Wind',
  hair_loss:      'PersonStanding',
  other:          'TriangleAlert',
};

export function effectLabel(type: string): string {
  return EFFECT_LABELS[type] ?? type;
}

export function EffectIcon({ type, size = 20, color }: { type: string; size?: number; color: string }) {
  const iconName = EFFECT_ICONS[type] ?? 'TriangleAlert';
  return <LucideIconByName name={iconName} size={size} color={color} />;
}
