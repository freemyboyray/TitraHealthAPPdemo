// Shared activity definitions used by the Log Activity screen and the
// workout-type picker. Calories for any exercise = MET × intensityMult ×
// weightKg × hours. The only unknown for a user-added exercise is its base
// MET, captured via an effort archetype at add-time and cached on the def.

export type WorkoutTypeDatum = { key: string; label: string; icon: string };

export const WORKOUT_TYPE_DATA: WorkoutTypeDatum[] = [
  { key: 'Walking',  label: 'Walking',  icon: 'Footprints' },
  { key: 'Running',  label: 'Running',  icon: 'Footprints' },
  { key: 'Cycling',  label: 'Cycling',  icon: 'Bike' },
  { key: 'Strength', label: 'Strength', icon: 'Dumbbell' },
  { key: 'HIIT',     label: 'HIIT',     icon: 'Zap' },
  { key: 'Yoga',     label: 'Yoga',     icon: 'PersonStanding' },
  { key: 'Pilates',  label: 'Pilates',  icon: 'Activity' },
  { key: 'Swimming', label: 'Swimming', icon: 'Waves' },
  { key: 'Other',    label: 'Other',    icon: 'MoreHorizontal' },
];

// Only step-based activities estimate steps. Everything else doesn't produce
// steps, so we don't fabricate them.
export const STEPS_PER_MIN: Record<string, number> = {
  Walking: 100,
  Running: 160,
};

export const MET_VALUES: Record<string, number> = {
  Walking:  3.8,
  Running:  9.8,
  Cycling:  7.5,
  Strength: 4.5,
  HIIT:    10.0,
  Yoga:     2.8,
  Pilates:  3.0,
  Swimming: 7.0,
  Other:    4.0,
};

// ─── Custom exercises ──────────────────────────────────────────────────────────
export const CUSTOM_ACTIVITIES_KEY = 'custom_activities_v1';

export type CustomActivity = { id: string; label: string; icon: string; met: number };

export const MET_ARCHETYPES: { key: string; label: string; met: number; example: string }[] = [
  { key: 'light',    label: 'Light',         met: 2.5,  example: 'Stretching, easy yoga' },
  { key: 'moderate', label: 'Moderate',      met: 5.0,  example: 'Brisk walk, recreational sport' },
  { key: 'vigorous', label: 'Vigorous',      met: 8.0,  example: 'Running, fast cycling' },
  { key: 'max',      label: 'Very vigorous', met: 11.0, example: 'Sprints, competitive sport' },
];

export const CUSTOM_ICON_CHOICES = ['Activity', 'Heart', 'Mountain', 'Bike', 'Waves', 'PersonStanding', 'Zap', 'Dumbbell'];

// A unified shape the grid renders, whether built-in or custom.
export type ActivityItem = { key: string; label: string; icon: string; met: number; stepsPerMin: number; custom?: boolean };

export function buildActivityItems(customs: CustomActivity[]): ActivityItem[] {
  return [
    ...WORKOUT_TYPE_DATA.map((t) => ({
      key: t.key,
      label: t.label,
      icon: t.icon,
      met: MET_VALUES[t.key] ?? 4.0,
      stepsPerMin: STEPS_PER_MIN[t.key] ?? 0,
    })),
    ...customs.map((c) => ({
      key: c.id, label: c.label, icon: c.icon, met: c.met, stepsPerMin: 0, custom: true,
    })),
  ];
}
