import { FullUserProfile } from './user-profile';

// Re-export for backward compat
export type UserProfile = FullUserProfile;

export const MOCK_PROFILE: FullUserProfile = {
  glp1Status: 'active',
  medicationBrand: 'ozempic',
  glp1Type: 'semaglutide',
  doseMg: 1.0,
  injectionFrequencyDays: 7,
  lastInjectionDate: (() => {
    const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })(),
  sex: 'female',
  birthday: '1986-04-15',
  age: 38,
  unitSystem: 'imperial',
  heightCm: 165,
  heightFt: 5,
  heightIn: 5,
  weightLbs: 180.8,
  weightKg: 82,
  appleHealthEnabled: false,
  startWeightLbs: 195,
  startDate: '2024-01-01',
  goalWeightLbs: 154,
  goalWeightKg: 70,
  targetWeeklyLossLbs: 1.0,
  activityLevel: 'light',
  cravingDays: ['friday', 'saturday'],
  sideEffects: [],
  onboardingCompletedAt: '2024-01-01T00:00:00.000Z',
};
