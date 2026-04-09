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
const DRAFT_KEY   = '@titrahealth_profile_draft';
const TARGETS_VERSION_KEY = '@titrahealth_targets_version';
// Bump this when target formulas change to force a one-time server-side recomputation
const TARGETS_VERSION = 2;

// ─── Context Type ─────────────────────────────────────────────────────────────

type ProfileContextValue = {
  profile: FullUserProfile | null;
  draft: ProfileDraft;
  updateDraft: (fields: Partial<FullUserProfile>) => void;
  completeOnboarding: () => Promise<void>;
  resetProfile: () => Promise<void>;
  updateProfile: (fields: Partial<FullUserProfile>) => Promise<void>;
  /** Apply a pending medication transition — copies pending fields to active, clears pending. */
  applyPendingTransition: () => Promise<void>;
  /** Directly set the in-memory profile (e.g. demo mode). */
  setProfile: (p: FullUserProfile | null) => void;
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
    doseTime:               row.dose_time ?? '',
    lastInjectionDate: row.last_injection_date ?? '',
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
    tosAcceptedAt: row.tos_accepted_at ?? undefined,
    tosVersion: row.tos_version ?? undefined,
    privacyAcceptedAt: row.privacy_accepted_at ?? undefined,
    privacyVersion: row.privacy_version ?? undefined,

    // Pending medication transition
    pendingMedicationBrand: row.pending_medication_brand ?? null,
    pendingGlp1Type:        row.pending_glp1_type ?? null,
    pendingRoute:           row.pending_route ?? null,
    pendingDoseMg:          row.pending_dose_mg ?? null,
    pendingFrequencyDays:   row.pending_frequency_days ?? null,
    pendingDoseTime:        row.pending_dose_time ?? null,
    pendingFirstDoseDate:   row.pending_first_dose_date ?? null,
    pendingLastDoseOld:     row.pending_last_dose_old ?? null,
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
        if (!user) {
          // Rehydrate draft so returning users don't lose onboarding progress
          const draftJson = await AsyncStorage.getItem(DRAFT_KEY);
          if (draftJson) setDraft(JSON.parse(draftJson) as ProfileDraft);
          return;
        }

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
        } else {
          // No completed profile yet — rehydrate in-progress draft
          const draftJson = await AsyncStorage.getItem(DRAFT_KEY);
          if (draftJson) setDraft(JSON.parse(draftJson) as ProfileDraft);
        }
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, []);

  // One-time targets recalculation when formula version changes.
  // Existing users get their Supabase user_goals row recomputed on next launch.
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const stored = await AsyncStorage.getItem(TARGETS_VERSION_KEY);
      if (stored === String(TARGETS_VERSION)) return;
      // Trigger recomputation by "updating" weightLbs to its current value.
      // updateProfile sees weightLbs in NUTRITION_AFFECTING → recomputes user_goals.
      await updateProfile({ weightLbs: profile.weightLbs });
      await AsyncStorage.setItem(TARGETS_VERSION_KEY, String(TARGETS_VERSION));
    })();
  }, [profile != null]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDraft = (fields: Partial<FullUserProfile>) => {
    setDraft((prev) => {
      const next = { ...prev, ...fields };
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const completeOnboarding = async () => {
    const derived = computeProfileDerivedMetrics(draft);
    const complete: FullUserProfile = {
      ...draft,
      ...derived,
      onboardingCompletedAt: new Date().toISOString(),
    } as FullUserProfile;

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(complete));
    await AsyncStorage.removeItem(DRAFT_KEY);
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
        dose_time:                complete.doseTime || null,
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
        last_injection_date:      complete.lastInjectionDate || null,
        tos_accepted_at:          complete.tosAcceptedAt || null,
        tos_version:              complete.tosVersion || null,
        privacy_accepted_at:      complete.privacyAcceptedAt || null,
        privacy_version:          complete.privacyVersion || null,
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
      if (fields.doseTime                !== undefined) row.dose_time                 = fields.doseTime || null;
      if (fields.doseStartDate           !== undefined) row.dose_start_date           = fields.doseStartDate;
      if (fields.lastInjectionDate       !== undefined) row.last_injection_date       = fields.lastInjectionDate || null;
      if (fields.tosAcceptedAt           !== undefined) row.tos_accepted_at           = fields.tosAcceptedAt;
      if (fields.tosVersion              !== undefined) row.tos_version               = fields.tosVersion;
      if (fields.privacyAcceptedAt       !== undefined) row.privacy_accepted_at       = fields.privacyAcceptedAt;
      if (fields.privacyVersion          !== undefined) row.privacy_version           = fields.privacyVersion;
      if (fields.sex                     !== undefined) row.sex                       = fields.sex;
      if (fields.birthday                !== undefined) row.dob                       = fields.birthday;
      if (fields.unitSystem              !== undefined) row.unit_system               = fields.unitSystem;
      if (fields.activityLevel           !== undefined) row.activity_level            = fields.activityLevel;
      if (fields.targetWeeklyLossLbs     !== undefined) row.target_weekly_loss_lbs    = fields.targetWeeklyLossLbs;
      if (fields.goalWeightLbs           !== undefined) row.goal_weight_lbs           = fields.goalWeightLbs;
      else if (fields.goalWeightKg       !== undefined) row.goal_weight_lbs           = Math.round(fields.goalWeightKg / 0.453592);
      // weightLbs / startWeightLbs both map to start_weight_lbs - prefer weightLbs
      if (fields.weightLbs               !== undefined) row.start_weight_lbs          = fields.weightLbs;
      else if (fields.startWeightLbs     !== undefined) row.start_weight_lbs          = fields.startWeightLbs;
      else if (fields.weightKg           !== undefined) row.start_weight_lbs          = Math.round(fields.weightKg * 2.20462);
      // height - trigger if any height field appears
      if (fields.heightFt !== undefined || fields.heightIn !== undefined || fields.heightCm !== undefined) {
        row.height_inches = updated.heightFt * 12 + updated.heightIn;
      }

      // Pending medication transition fields
      if (fields.pendingMedicationBrand !== undefined) row.pending_medication_brand = fields.pendingMedicationBrand;
      if (fields.pendingGlp1Type        !== undefined) row.pending_glp1_type        = fields.pendingGlp1Type;
      if (fields.pendingRoute           !== undefined) row.pending_route            = fields.pendingRoute;
      if (fields.pendingDoseMg          !== undefined) row.pending_dose_mg          = fields.pendingDoseMg;
      if (fields.pendingFrequencyDays   !== undefined) row.pending_frequency_days   = fields.pendingFrequencyDays;
      if (fields.pendingDoseTime        !== undefined) row.pending_dose_time        = fields.pendingDoseTime;
      if (fields.pendingFirstDoseDate   !== undefined) row.pending_first_dose_date  = fields.pendingFirstDoseDate;
      if (fields.pendingLastDoseOld     !== undefined) row.pending_last_dose_old    = fields.pendingLastDoseOld;

      if (Object.keys(row).length > 0) {
        await supabase.from('profiles').update(row).eq('id', user.id);
      }

      // Recompute user_goals when nutrition-affecting fields change
      const NUTRITION_AFFECTING = new Set([
        'heightFt','heightIn','heightCm','weightLbs','weightKg','startWeightLbs',
        'activityLevel','goalWeightLbs','goalWeightKg','targetWeeklyLossLbs',
        'sex','birthday',
        // Medication fields affect protein, water, and calorie targets
        'glp1Type','doseMg','glp1Status','injectionFrequencyDays',
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

  const applyPendingTransition = async () => {
    if (!profile?.pendingFirstDoseDate || !profile?.pendingMedicationBrand) return;

    // Set lastInjectionDate = firstDoseDate - freq so that
    // lastInjDate + freq = firstDoseDate → "Due today" on transition day
    const freq = profile.pendingFrequencyDays ?? 7;
    const firstDose = new Date(profile.pendingFirstDoseDate + 'T00:00:00');
    const fakeLastDate = new Date(firstDose);
    fakeLastDate.setDate(fakeLastDate.getDate() - freq);
    const fakeLastDateStr = `${fakeLastDate.getFullYear()}-${String(fakeLastDate.getMonth() + 1).padStart(2, '0')}-${String(fakeLastDate.getDate()).padStart(2, '0')}`;

    await updateProfile({
      // Apply new medication
      medicationBrand: profile.pendingMedicationBrand,
      glp1Type: profile.pendingGlp1Type as any,
      routeOfAdministration: profile.pendingRoute as any,
      doseMg: profile.pendingDoseMg!,
      injectionFrequencyDays: profile.pendingFrequencyDays!,
      doseTime: profile.pendingDoseTime ?? '',
      lastInjectionDate: fakeLastDateStr,
      doseStartDate: profile.pendingFirstDoseDate,
      // Clear pending fields
      pendingMedicationBrand: null,
      pendingGlp1Type: null,
      pendingRoute: null,
      pendingDoseMg: null,
      pendingFrequencyDays: null,
      pendingDoseTime: null,
      pendingFirstDoseDate: null,
      pendingLastDoseOld: null,
    });
  };

  const resetProfile = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(DRAFT_KEY);
    setProfile(null);
    setDraft({});
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ program_start_date: null }).eq('id', user.id);
    }
  };

  return (
    <ProfileContext.Provider
      value={{ profile, draft, updateDraft, completeOnboarding, resetProfile, updateProfile, applyPendingTransition, setProfile, isLoading }}>
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
