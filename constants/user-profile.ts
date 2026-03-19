// ─── Enums / Union Types ──────────────────────────────────────────────────────

export type Glp1Status = 'active' | 'starting';

export type MedicationBrand =
  // ── Weekly SC injectables ─────────────────────────────────────────────────
  | 'zepbound'
  | 'mounjaro'
  | 'ozempic'
  | 'wegovy'
  | 'trulicity'
  | 'compounded_semaglutide'
  | 'compounded_tirzepatide'
  // ── Daily SC injectables ──────────────────────────────────────────────────
  | 'saxenda'               // liraglutide 3 mg/day (weight loss)
  | 'victoza'               // liraglutide 1.8 mg/day (T2D, off-label weight loss)
  | 'compounded_liraglutide'
  // ── Oral daily pills ──────────────────────────────────────────────────────
  | 'rybelsus'              // oral semaglutide 3/7/14 mg (T2D approved)
  | 'oral_wegovy'           // oral semaglutide 25 mg (obesity, FDA approved Dec 2025)
  | 'orforglipron'          // Eli Lilly small-molecule GLP-1 (FDA decision ~Apr 2026)
  // ── Catch-all ─────────────────────────────────────────────────────────────
  | 'other';

export type Glp1Type =
  // Injectable - weekly
  | 'semaglutide'
  | 'tirzepatide'
  | 'dulaglutide'
  // Injectable - daily
  | 'liraglutide'
  // Oral - daily
  | 'oral_semaglutide'
  | 'orforglipron';
export type Sex = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';
export type SideEffect =
  | 'nausea'
  | 'fatigue'
  | 'hair_loss'
  | 'constipation'
  | 'bloating'
  | 'sulfur_burps'
  | 'diarrhea'
  | 'vomiting'
  | 'headache'
  | 'heartburn'
  | 'dizziness'
  | 'muscle_loss'
  | 'dehydration'
  | 'food_noise';
export type UnitSystem = 'imperial' | 'metric';

// ─── Full User Profile ────────────────────────────────────────────────────────

export type RouteOfAdministration = 'injection' | 'oral';

export type FullUserProfile = {
  glp1Status: Glp1Status;
  medicationBrand: MedicationBrand;
  glp1Type: Glp1Type;
  routeOfAdministration: RouteOfAdministration;
  doseMg: number;
  initialDoseMg: number | null;     // dose they started on
  doseStartDate: string;            // YYYY-MM-DD, when they started current dose
  injectionFrequencyDays: number;   // 1 | 7 | 14 | custom
  doseTime: string;                 // HH:MM (e.g. "08:00") — daily drug dose time; empty for weekly
  lastInjectionDate: string;        // YYYY-MM-DD (also used as "last dose date" for oral)
  sex: Sex;
  birthday: string;                 // YYYY-MM-DD
  age: number;                      // computed from birthday
  unitSystem: UnitSystem;
  heightCm: number;
  heightFt: number;
  heightIn: number;
  weightLbs: number;
  weightKg: number;
  appleHealthEnabled: boolean;
  startWeightLbs: number;
  startDate: string;                // YYYY-MM-DD
  goalWeightLbs: number;
  goalWeightKg: number;
  targetWeeklyLossLbs: number;      // 0.2 | 0.5 | 1.0 | 1.5 | 2.0 | 2.5 | 3.0
  activityLevel: ActivityLevel;
  cravingDays: string[];            // ['monday', 'wednesday', ...]
  sideEffects: SideEffect[];
  onboardingCompletedAt: string;
};

export type ProfileDraft = Partial<FullUserProfile>;

// ─── Medication Brand → GLP-1 Type Mapping ───────────────────────────────────

export const BRAND_TO_GLP1_TYPE: Record<MedicationBrand, Glp1Type> = {
  // Weekly injectable
  zepbound:               'tirzepatide',
  mounjaro:               'tirzepatide',
  ozempic:                'semaglutide',
  wegovy:                 'semaglutide',
  trulicity:              'dulaglutide',
  compounded_semaglutide: 'semaglutide',
  compounded_tirzepatide: 'tirzepatide',
  // Daily injectable
  saxenda:                'liraglutide',
  victoza:                'liraglutide',
  compounded_liraglutide: 'liraglutide',
  // Oral daily
  rybelsus:               'oral_semaglutide',
  oral_wegovy:            'oral_semaglutide',
  orforglipron:           'orforglipron',
  // Catch-all
  other:                  'semaglutide',
};

export const BRAND_DISPLAY_NAMES: Record<MedicationBrand, string> = {
  zepbound:               'Zepbound®',
  mounjaro:               'Mounjaro®',
  ozempic:                'Ozempic®',
  wegovy:                 'Wegovy®',
  trulicity:              'Trulicity®',
  compounded_semaglutide: 'Compounded Semaglutide',
  compounded_tirzepatide: 'Compounded Tirzepatide',
  saxenda:                'Saxenda®',
  victoza:                'Victoza®',
  compounded_liraglutide: 'Compounded Liraglutide',
  rybelsus:               'Rybelsus®',
  oral_wegovy:            'Oral Wegovy®',
  orforglipron:           'Orforglipron',
  other:                  'Other',
};

export const BRAND_TO_ROUTE: Record<MedicationBrand, RouteOfAdministration> = {
  zepbound:               'injection',
  mounjaro:               'injection',
  ozempic:                'injection',
  wegovy:                 'injection',
  trulicity:              'injection',
  compounded_semaglutide: 'injection',
  compounded_tirzepatide: 'injection',
  saxenda:                'injection',
  victoza:                'injection',
  compounded_liraglutide: 'injection',
  rybelsus:               'oral',
  oral_wegovy:            'oral',
  orforglipron:           'oral',
  other:                  'injection',
};

// Default dosing interval per brand (days). Used to pre-fill schedule screen.
export const BRAND_DEFAULT_FREQ_DAYS: Record<MedicationBrand, number> = {
  zepbound:               7,
  mounjaro:               7,
  ozempic:                7,
  wegovy:                 7,
  trulicity:              7,
  compounded_semaglutide: 7,
  compounded_tirzepatide: 7,
  saxenda:                1,
  victoza:                1,
  compounded_liraglutide: 1,
  rybelsus:               1,
  oral_wegovy:            1,
  orforglipron:           1,
  other:                  7,
};

// ─── Derived Metric Helper ────────────────────────────────────────────────────

export function computeProfileDerivedMetrics(draft: ProfileDraft): Partial<FullUserProfile> {
  const result: Partial<FullUserProfile> = {};

  // Compute age from birthday
  if (draft.birthday) {
    const bd = new Date(draft.birthday);
    const today = new Date();
    let age = today.getFullYear() - bd.getFullYear();
    const m = today.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
    result.age = age;
  }

  // Imperial ↔ metric weight conversions
  if (draft.weightLbs !== undefined) {
    result.weightKg = Math.round(draft.weightLbs * 0.453592 * 10) / 10;
  } else if (draft.weightKg !== undefined) {
    result.weightLbs = Math.round(draft.weightKg * 2.20462 * 10) / 10;
  }

  // Imperial ↔ metric goal weight
  if (draft.goalWeightLbs !== undefined) {
    result.goalWeightKg = Math.round(draft.goalWeightLbs * 0.453592 * 10) / 10;
  } else if (draft.goalWeightKg !== undefined) {
    result.goalWeightLbs = Math.round(draft.goalWeightKg * 2.20462 * 10) / 10;
  }

  // Height cm from ft + in
  if (draft.heightFt !== undefined && draft.heightIn !== undefined) {
    result.heightCm = Math.round(((draft.heightFt * 12) + draft.heightIn) * 2.54);
  }

  return result;
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addWeeks(d: Date, weeks: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + Math.round(weeks * 7));
  return result;
}

// ─── Brand-specific dose options ──────────────────────────────────────────────

const GENERIC_DOSES = [0.25, 0.5, 1.0, 2.5, 5.0, 7.5, 10.0, 12.5, 15.0];

export const BRAND_DOSES: Partial<Record<MedicationBrand, number[]>> = {
  ozempic:               [0.25, 0.5, 1.0, 2.0],
  wegovy:                [0.25, 0.5, 1.0, 1.7, 2.4],
  oral_wegovy:           [1.5, 3, 7, 14, 25],
  rybelsus:              [3, 7, 14],
  mounjaro:              [2.5, 5, 7.5, 10, 12.5, 15],
  zepbound:              [2.5, 5, 7.5, 10, 12.5, 15],
  saxenda:               [0.6, 1.2, 1.8, 2.4, 3.0],
  victoza:               [0.6, 1.2, 1.8],
  trulicity:             [0.75, 1.5, 3.0, 4.5],
  compounded_semaglutide:[0.25, 0.5, 1.0, 1.7, 2.0, 2.4],
  compounded_tirzepatide:[2.5, 5, 7.5, 10, 12.5, 15],
  compounded_liraglutide:[0.6, 1.2, 1.8, 2.4, 3.0],
};

export function getBrandDoses(brand: MedicationBrand): number[] {
  return BRAND_DOSES[brand] ?? GENERIC_DOSES;
}

// ─── Titration summary strings ────────────────────────────────────────────────

export const BRAND_TITRATION_SUMMARY: Partial<Record<MedicationBrand, string>> = {
  ozempic:               'Starts at 0.25 mg · escalates every 4 weeks · max 2 mg/wk',
  wegovy:                'Starts at 0.25 mg · 5 escalation steps · max 2.4 mg/wk',
  oral_wegovy:           'Starts at 1.5 mg/day · escalates every 30 days · max 25 mg/day',
  rybelsus:              'Starts at 3 mg/day · 30-day steps · max 14 mg/day',
  mounjaro:              'Starts at 2.5 mg · escalates every 4 weeks · max 15 mg/wk',
  zepbound:              'Starts at 2.5 mg · escalates every 4 weeks · max 15 mg/wk',
  saxenda:               'Starts at 0.6 mg/day · escalates weekly · max 3 mg/day',
  victoza:               'Starts at 0.6 mg/day · escalates over 2 weeks · max 1.8 mg/day',
  trulicity:             'Starts at 0.75 mg · can escalate to 4.5 mg/wk',
  compounded_semaglutide:'Starts at 0.25 mg · protocol varies by compounding pharmacy',
  compounded_tirzepatide:'Starts at 2.5 mg · protocol varies by compounding pharmacy',
};

// ─── Default starting dose per brand ─────────────────────────────────────────

export const BRAND_STARTING_DOSE: Partial<Record<MedicationBrand, number>> = {
  ozempic:               0.25,
  wegovy:                0.25,
  oral_wegovy:           1.5,
  rybelsus:              3,
  mounjaro:              2.5,
  zepbound:              2.5,
  saxenda:               0.6,
  victoza:               0.6,
  trulicity:             0.75,
  compounded_semaglutide:0.25,
  compounded_tirzepatide:2.5,
  compounded_liraglutide:0.6,
};
