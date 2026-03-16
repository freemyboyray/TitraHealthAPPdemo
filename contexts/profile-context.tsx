import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  FullUserProfile,
  ProfileDraft,
  computeProfileDerivedMetrics,
} from '@/constants/user-profile';
import { computeBaseTargets } from '@/lib/targets';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = '@titrahealth_profile';

// ─── Context Type ─────────────────────────────────────────────────────────────

type ProfileContextValue = {
  profile: FullUserProfile | null;
  draft: ProfileDraft;
  updateDraft: (fields: Partial<FullUserProfile>) => void;
  completeOnboarding: () => Promise<void>;
  resetProfile: () => Promise<void>;
  updateProfile: (fields: Partial<FullUserProfile>) => Promise<void>;
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
    glp1Status:             row.glp1_status ?? 'active',
    medicationBrand:        row.medication_brand ?? 'other',
    unitSystem:             row.unit_system ?? 'imperial',
    glp1Type:               row.medication_type ?? 'semaglutide',
    routeOfAdministration:  row.route_of_administration ?? 'injection',
    doseMg:                 row.dose_mg ?? 0,
    initialDoseMg:          row.initial_dose_mg ?? null,
    doseStartDate:          row.dose_start_date ?? '',
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
        medication_brand:         complete.medicationBrand,
        route_of_administration:  complete.routeOfAdministration,
        glp1_status:              complete.glp1Status,
        unit_system:              complete.unitSystem,
        initial_dose_mg:          complete.initialDoseMg,
        dose_start_date:          complete.doseStartDate || null,
      });

      // 2. Upsert user_goals (computed from Mifflin-St Jeor base targets)
      const baseTargets = computeBaseTargets(complete);
      await supabase.from('user_goals').upsert({
        user_id:                 user.id,
        daily_protein_g_target:  baseTargets.proteinG,
        daily_fiber_g_target:    baseTargets.fiberG,
        daily_steps_target:      baseTargets.steps,
        daily_calories_target:   baseTargets.caloriesTarget,
        active_calories_target:  baseTargets.activeMinutes * 3, // ~3 cal/min
      }, { onConflict: 'user_id' });

    }
  };

  const updateProfile = async (fields: Partial<FullUserProfile>) => {
    if (!profile) return;
    const derived = computeProfileDerivedMetrics(fields);
    const updated: FullUserProfile = { ...profile, ...fields, ...derived };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setProfile(updated);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: Record<string, any> = {};
      if (fields.doseMg                  !== undefined) row.dose_mg                  = fields.doseMg;
      if (fields.glp1Type                !== undefined) row.medication_type           = fields.glp1Type;
      if (fields.medicationBrand         !== undefined) row.medication_brand          = fields.medicationBrand;
      if (fields.routeOfAdministration   !== undefined) row.route_of_administration   = fields.routeOfAdministration;
      if (fields.glp1Status              !== undefined) row.glp1_status               = fields.glp1Status;
      if (fields.initialDoseMg           !== undefined) row.initial_dose_mg           = fields.initialDoseMg;
      if (fields.injectionFrequencyDays  !== undefined) row.injection_frequency_days  = fields.injectionFrequencyDays;
      if (fields.doseStartDate           !== undefined) row.dose_start_date           = fields.doseStartDate;
      if (fields.sex                     !== undefined) row.sex                       = fields.sex;
      if (fields.birthday                !== undefined) row.dob                       = fields.birthday;
      if (fields.unitSystem              !== undefined) row.unit_system               = fields.unitSystem;
      if (fields.activityLevel           !== undefined) row.activity_level            = fields.activityLevel;
      if (fields.targetWeeklyLossLbs     !== undefined) row.target_weekly_loss_lbs    = fields.targetWeeklyLossLbs;
      if (fields.goalWeightLbs           !== undefined) row.goal_weight_lbs           = fields.goalWeightLbs;
      else if (fields.goalWeightKg       !== undefined) row.goal_weight_lbs           = Math.round(fields.goalWeightKg / 0.453592);
      // weightLbs / startWeightLbs both map to start_weight_lbs — prefer weightLbs
      if (fields.weightLbs               !== undefined) row.start_weight_lbs          = fields.weightLbs;
      else if (fields.startWeightLbs     !== undefined) row.start_weight_lbs          = fields.startWeightLbs;
      else if (fields.weightKg           !== undefined) row.start_weight_lbs          = Math.round(fields.weightKg * 2.20462);
      // height — trigger if any height field appears
      if (fields.heightFt !== undefined || fields.heightIn !== undefined || fields.heightCm !== undefined) {
        row.height_inches = updated.heightFt * 12 + updated.heightIn;
      }

      if (Object.keys(row).length > 0) {
        await supabase.from('profiles').update(row).eq('id', user.id);
      }

      // Recompute user_goals when nutrition-affecting fields change
      const NUTRITION_AFFECTING = new Set([
        'heightFt','heightIn','heightCm','weightLbs','weightKg','startWeightLbs',
        'activityLevel','goalWeightLbs','goalWeightKg','targetWeeklyLossLbs',
        'sex','birthday',
      ]);
      if (Object.keys(fields).some(k => NUTRITION_AFFECTING.has(k))) {
        const baseTargets = computeBaseTargets(updated);
        await supabase.from('user_goals').upsert({
          user_id:                user.id,
          daily_protein_g_target: baseTargets.proteinG,
          daily_fiber_g_target:   baseTargets.fiberG,
          daily_steps_target:     baseTargets.steps,
          daily_calories_target:  baseTargets.caloriesTarget,
          active_calories_target: baseTargets.activeMinutes * 3,
        }, { onConflict: 'user_id' });
      }
    }
  };

  const resetProfile = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setDraft({});
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ program_start_date: null }).eq('id', user.id);
    }
  };

  return (
    <ProfileContext.Provider
      value={{ profile, draft, updateDraft, completeOnboarding, resetProfile, updateProfile, isLoading }}>
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
