// ─── Enums / Union Types ──────────────────────────────────────────────────────

export type Glp1Status = 'active' | 'starting';

export type MedicationBrand =
  | 'zepbound'
  | 'mounjaro'
  | 'ozempic'
  | 'wegovy'
  | 'trulicity'
  | 'compounded_semaglutide'
  | 'compounded_tirzepatide'
  | 'other';

export type Glp1Type = 'semaglutide' | 'tirzepatide' | 'dulaglutide';
export type Sex = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type ActivityLevel = 'sedentary' | 'light' | 'active' | 'very_active';
export type SideEffect =
  | 'nausea'
  | 'fatigue'
  | 'hair_loss'
  | 'constipation'
  | 'bloating'
  | 'sulfur_burps';
export type UnitSystem = 'imperial' | 'metric';

// ─── Full User Profile ────────────────────────────────────────────────────────

export type FullUserProfile = {
  glp1Status: Glp1Status;
  medicationBrand: MedicationBrand;
  glp1Type: Glp1Type;
  doseMg: number;
  injectionFrequencyDays: number;   // 1 | 7 | 14 | custom
  lastInjectionDate: string;        // YYYY-MM-DD
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
  zepbound: 'tirzepatide',
  mounjaro: 'tirzepatide',
  ozempic: 'semaglutide',
  wegovy: 'semaglutide',
  trulicity: 'dulaglutide',
  compounded_semaglutide: 'semaglutide',
  compounded_tirzepatide: 'tirzepatide',
  other: 'semaglutide',
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
