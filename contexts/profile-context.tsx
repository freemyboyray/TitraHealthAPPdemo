import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  FullUserProfile,
  ProfileDraft,
  computeProfileDerivedMetrics,
} from '@/constants/user-profile';
import { getDailyTargets, daysSinceInjection } from '@/constants/scoring';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = '@titrahealth_profile';

// ─── Context Type ─────────────────────────────────────────────────────────────

type ProfileContextValue = {
  profile: FullUserProfile | null;
  draft: ProfileDraft;
  updateDraft: (fields: Partial<FullUserProfile>) => void;
  completeOnboarding: () => Promise<void>;
  resetProfile: () => Promise<void>;
  isLoading: boolean;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

// ─── Supabase row → FullUserProfile ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSupabaseToProfile(row: Record<string, any>): FullUserProfile {
  const heightInches = row.height_inches ?? 0;
  const heightFt = Math.floor(heightInches / 12);
  const heightIn = heightInches % 12;

  return {
    glp1Status: 'active',
    medicationBrand: 'other',
    unitSystem: 'imperial',
    glp1Type: row.medication_type ?? 'semaglutide',
    routeOfAdministration: 'injection',
    doseMg: row.dose_mg ?? 0,
    injectionFrequencyDays: row.injection_frequency_days ?? 7,
    lastInjectionDate: '',
    sex: row.sex ?? 'prefer_not_to_say',
    birthday: row.dob ?? '',
    age: row.dob
      ? (() => {
          const bd = new Date(row.dob);
          const today = new Date();
          let age = today.getFullYear() - bd.getFullYear();
          const m = today.getMonth() - bd.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
          return age;
        })()
      : 0,
    heightCm: Math.round(heightInches * 2.54),
    heightFt,
    heightIn,
    weightLbs: row.start_weight_lbs ?? 0,
    weightKg: Math.round((row.start_weight_lbs ?? 0) * 0.453592 * 10) / 10,
    appleHealthEnabled: row.apple_health_enabled ?? false,
    startWeightLbs: row.start_weight_lbs ?? 0,
    startDate: row.program_start_date ?? '',
    goalWeightLbs: row.goal_weight_lbs ?? 0,
    goalWeightKg: Math.round((row.goal_weight_lbs ?? 0) * 0.453592 * 10) / 10,
    targetWeeklyLossLbs: row.target_weekly_loss_lbs ?? 1.0,
    activityLevel: row.activity_level ?? 'light',
    cravingDays: row.craving_days ?? [],
    sideEffects: row.initial_side_effects ?? [],
    onboardingCompletedAt: row.program_start_date ?? new Date().toISOString(),
  };
}

// ─── TDEE Estimate (Harris-Benedict simplified) ───────────────────────────────

function estimateTDEE(p: FullUserProfile): number {
  const bmr = p.weightLbs * 6.8 + p.heightCm * 4.57 - p.age * 4.7;
  const mult: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    active: 1.55,
    very_active: 1.725,
  };
  return Math.round(bmr * (mult[p.activityLevel] ?? 1.375));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<FullUserProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        // 1. Try AsyncStorage first (fast, offline-capable)
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          setProfile(JSON.parse(json) as FullUserProfile);
          return;
        }

        // 2. If empty + session exists → try Supabase profiles table
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: row } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        // 3. If Supabase has a row with program_start_date → reconstruct + cache
        if (row && row.program_start_date) {
          const reconstructed = mapSupabaseToProfile(row);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reconstructed));
          setProfile(reconstructed);
        }
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  const updateDraft = (fields: Partial<FullUserProfile>) => {
    setDraft((prev) => ({ ...prev, ...fields }));
  };

  const completeOnboarding = async () => {
    const derived = computeProfileDerivedMetrics(draft);
    const complete: FullUserProfile = {
      ...draft,
      ...derived,
      onboardingCompletedAt: new Date().toISOString(),
    } as FullUserProfile;

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(complete));
    setProfile(complete);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 1. Upsert profiles row
      await supabase.from('profiles').upsert({
        id: user.id,
        dob:                      complete.birthday,
        dose_mg:                  complete.doseMg,
        medication_type:          complete.glp1Type,
        injection_frequency_days: complete.injectionFrequencyDays,
        program_start_date:       complete.startDate,
        start_weight_lbs:         complete.startWeightLbs,
        goal_weight_lbs:          complete.goalWeightLbs,
        height_inches:            complete.heightFt * 12 + complete.heightIn,
        sex:                      complete.sex,
        apple_health_enabled:     complete.appleHealthEnabled,
        target_weekly_loss_lbs:   complete.targetWeeklyLossLbs,
        activity_level:           complete.activityLevel,
        craving_days:             complete.cravingDays,
        initial_side_effects:     complete.sideEffects,
      });

      // 2. Upsert user_goals (computed from scoring engine)
      const daysSince = complete.lastInjectionDate
        ? daysSinceInjection(complete.lastInjectionDate)
        : 1;
      const targets = getDailyTargets(complete, daysSince);
      const tdee = estimateTDEE(complete);
      await supabase.from('user_goals').upsert({
        user_id:                user.id,
        daily_protein_g_target:  Math.round(targets.proteinG),
        daily_fiber_g_target:    Math.round(targets.fiberG),
        daily_steps_target:      Math.round(targets.steps),
        daily_calories_target:   Math.max(1200, tdee - 500),
        active_calories_target:  400,
      }, { onConflict: 'user_id' });

      // 3. Insert first injection_log from lastInjectionDate (fire-and-forget)
      if (complete.lastInjectionDate) {
        supabase.from('injection_logs').insert({
          user_id:        user.id,
          dose_mg:        complete.doseMg,
          injection_date: complete.lastInjectionDate,
          notes:          'Logged during onboarding setup',
        }).then(() => {});
      }
    }
  };

  const resetProfile = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setDraft({});
  };

  return (
    <ProfileContext.Provider
      value={{ profile, draft, updateDraft, completeOnboarding, resetProfile, isLoading }}>
      {children}
    </ProfileContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
