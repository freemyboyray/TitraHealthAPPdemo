import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

import {
  FullUserProfile,
  ProfileDraft,
  computeProfileDerivedMetrics,
} from '@/constants/user-profile';
import { computeBaseTargets } from '@/lib/targets';
import { toDateStr } from '@/lib/program-week';
import { syncDoseReminder } from '@/stores/reminders-store';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUserStore } from '@/stores/user-store';
import {
  getReachedPhotoMilestones,
  getUnlockedAchievementIds,
} from '@/constants/achievements';

// Strict-typed UPDATE shape for profiles. Prevents the Glp1Type/medication_type
// drift bug from recurring: any column name typo or unknown column becomes a
// compile-time error here instead of a silent runtime PGRST204 failure.
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

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
  /** Re-fetch profile from Supabase (e.g. after sign-in). */
  reloadProfile: () => Promise<void>;
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
    doctorCode:             row.doctor_code ?? null,
    providerName:           row.provider_name ?? null,
    glp1Status:             row.glp1_status ?? 'active',
    treatmentStatus:        row.treatment_status ?? 'on',
    medicationBrand:        row.medication_brand ?? 'other',
    medicationCustomName:   row.medication_custom_name ?? null,
    unitSystem:             row.unit_system ?? 'imperial',
    glp1Type:               row.medication_type ?? 'semaglutide',
    routeOfAdministration:  row.route_of_administration ?? 'injection',
    doseMg:                 row.dose_mg ?? 0,
    initialDoseMg:          row.initial_dose_mg ?? null,
    doseStartDate:          row.dose_start_date ?? '',
    medicationStartDate:    row.medication_start_date ?? '',
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
    weightLbs: row.current_weight_lbs ?? row.start_weight_lbs ?? 0,
    weightKg: Math.round((row.current_weight_lbs ?? row.start_weight_lbs ?? 0) * 0.453592 * 10) / 10,
    currentWeightLbs: row.current_weight_lbs ?? row.start_weight_lbs ?? 0,
    currentWeightKg: Math.round((row.current_weight_lbs ?? row.start_weight_lbs ?? 0) * 0.453592 * 10) / 10,
    appleHealthEnabled: row.apple_health_enabled ?? false,
    startWeightLbs: row.start_weight_lbs ?? 0,
    startDate: row.program_start_date ?? '',
    // When the user started using Titra (row creation), anchoring weekly + milestone
    // features to in-app engagement rather than the historical medication start.
    engagementStartDate: row.created_at ? toDateStr(new Date(row.created_at)) : undefined,
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
    aiAcceptedAt: row.ai_accepted_at ?? undefined,
    aiVersion: row.ai_version ?? undefined,

    // Medication detail
    medicationNotes: row.medication_notes ?? null,
    medicationPhotoUrl: row.medication_photo_url ?? null,

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

  // Shared logic for loading the profile from cache / Supabase.
  // Called on mount and again after sign-in to ensure fresh state.
  async function loadProfileFromServer(attempt = 0, forceRefresh = false) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1500;
    setIsLoading(true);
    try {
      // One-time cache migration: wipe legacy caches without uid tagging
      const migrated = await AsyncStorage.getItem('@titrahealth_cache_v2');
      if (!migrated) {
        await AsyncStorage.multiRemove([STORAGE_KEY, STORAGE_KEY + '_uid', DRAFT_KEY, DRAFT_KEY + '_uid']).catch(() => {});
        await AsyncStorage.setItem('@titrahealth_cache_v2', '1');
      }

      // 1. Get current user — may fail on transient network errors (e.g. simulator reload)
      let user: { id: string } | null = null;
      try {
        const { data } = await supabase.auth.getUser();
        user = data.user;
      } catch {
        // Network error reaching Supabase — fall back to cached profile if available
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          setProfile(JSON.parse(json) as FullUserProfile);
          return;
        }
        // No cache and network is down — retry before giving up
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          return loadProfileFromServer(attempt + 1);
        }
        return;
      }

      // 2. Try AsyncStorage (fast, offline-capable) — but only if it belongs to this user
      //    Skip cache when forceRefresh is true (e.g. after logging a new weight)
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      const cachedUserId = await AsyncStorage.getItem(STORAGE_KEY + '_uid');
      if (json && !forceRefresh) {
        // Only trust cache if we have a matching uid (no uid = legacy cache, discard it)
        if (cachedUserId && (!user || cachedUserId === user.id)) {
          setProfile(JSON.parse(json) as FullUserProfile);
          return;
        }
        // Cache is stale, belongs to a different user, or has no uid — clear it
        await AsyncStorage.removeItem(STORAGE_KEY);
        await AsyncStorage.removeItem(STORAGE_KEY + '_uid');
        await AsyncStorage.removeItem(DRAFT_KEY);
        await AsyncStorage.removeItem(DRAFT_KEY + '_uid');
      }
      if (!user) {
        // No authenticated user — clear any stale caches from previous users
        await AsyncStorage.multiRemove([STORAGE_KEY, STORAGE_KEY + '_uid', DRAFT_KEY, DRAFT_KEY + '_uid']).catch(() => {});
        setProfile(null);
        return;
      }

      let row: Record<string, any> | null = null;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        row = data;
      } catch {
        // Network error fetching profile row — retry
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          return loadProfileFromServer(attempt + 1);
        }
        return;
      }

      // 3. If Supabase has a row with program_start_date → reconstruct + cache
      if (row && row.program_start_date) {
        const reconstructed = mapSupabaseToProfile(row);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reconstructed));
        await AsyncStorage.setItem(STORAGE_KEY + '_uid', user.id);
        setProfile(reconstructed);
      } else {
        setProfile(null);
        // No completed profile yet — only rehydrate draft if it belongs to this user
        const draftJson = await AsyncStorage.getItem(DRAFT_KEY);
        const draftUid = await AsyncStorage.getItem(DRAFT_KEY + '_uid');
        if (draftJson && draftUid === user.id) {
          setDraft(JSON.parse(draftJson) as ProfileDraft);
        } else if (draftJson) {
          // Draft belongs to a different user — clear it
          await AsyncStorage.removeItem(DRAFT_KEY);
          await AsyncStorage.removeItem(DRAFT_KEY + '_uid');
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProfileFromServer();
  }, []);

  // Auto-apply pending medication transitions when the start date has arrived.
  // Runs once per profile load — if pendingFirstDoseDate <= today, the pending
  // medication becomes the active medication and treatmentStatus is set to 'on'.
  useEffect(() => {
    if (!profile?.pendingFirstDoseDate || !profile?.pendingMedicationBrand) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pending = new Date(profile.pendingFirstDoseDate + 'T00:00:00');
    if (pending.getTime() <= today.getTime()) {
      console.log('profile-context: pending transition date reached, auto-applying');
      applyPendingTransition().catch((err) =>
        console.warn('profile-context: auto-apply pending transition failed:', err),
      );
    }
  }, [profile?.pendingFirstDoseDate]);

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
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) AsyncStorage.setItem(DRAFT_KEY + '_uid', user.id).catch(() => {});
      }).catch(() => {});
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

    // Force startWeightLbs == currentWeightLbs. Onboarding only collects ONE
    // weight; the chart anchors at "today." If a stale draft slipped in a
    // larger startWeightLbs, this prevents the achievement detector from
    // celebrating "weight loss" the user never actually had.
    const baselineWeight =
      complete.currentWeightLbs ?? complete.weightLbs ?? complete.startWeightLbs ?? 0;
    if (baselineWeight > 0) {
      complete.startWeightLbs = baselineWeight;
      complete.weightLbs = baselineWeight;
      complete.currentWeightLbs = baselineWeight;
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(complete));
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) await AsyncStorage.setItem(STORAGE_KEY + '_uid', currentUser.id);
    await AsyncStorage.removeItem(DRAFT_KEY);
    setProfile(complete);

    // Establish the milestone baseline. Weight milestones are measured from the
    // user's weight when they START using Titra (engagement baseline), so the
    // in-app loss is 0 at onboarding — pass 0 for weight so we DON'T pre-mark any
    // weight milestone as shown (that would suppress a legitimate future
    // "5 lbs with Titra" celebration). Treatment-day milestones, however, are
    // tied to the real medication start, so we still suppress days already
    // passed before install using the historical day count.
    let initialDaysOnTreatment = 0;
    if (complete.startDate) {
      const start = new Date(complete.startDate + 'T12:00:00');
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      initialDaysOnTreatment = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
    }
    usePreferencesStore.getState().resetMilestoneTracking(
      getUnlockedAchievementIds(0, 0, initialDaysOnTreatment),
      getReachedPhotoMilestones(0),
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // 1. Upsert profiles row.
      // Errors here are critical: a failed upsert leaves the user with no
      // profile row, which makes the app behave as if they're not signed in.
      // Throw so the caller (onboarding finish screen) can show an error.
      const { error: profileErr } = await supabase.from('profiles').upsert({
        id: user.id,
        username:                 complete.username ?? null,
        doctor_code:              complete.doctorCode ?? null,
        provider_name:            complete.providerName ?? null,
        dob:                      complete.birthday,
        dose_mg:                  complete.doseMg,
        medication_type:          complete.glp1Type,
        injection_frequency_days: complete.injectionFrequencyDays,
        dose_time:                complete.doseTime || null,
        program_start_date:       complete.startDate,
        current_weight_lbs:       complete.currentWeightLbs ?? complete.weightLbs,
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
        medication_custom_name:   complete.medicationCustomName ?? null,
        route_of_administration:  complete.routeOfAdministration,
        glp1_status:              complete.glp1Status,
        treatment_status:         complete.treatmentStatus ?? 'on',
        unit_system:              complete.unitSystem,
        initial_dose_mg:          complete.initialDoseMg,
        dose_start_date:          complete.doseStartDate || null,
        // First medication start: anchor "weeks on medication" here. Resets later
        // only on a drug/brand change (edit-treatment), not on dose titrations.
        medication_start_date:    complete.doseStartDate || complete.startDate || null,
        last_injection_date:      complete.lastInjectionDate || null,
        tos_accepted_at:          complete.tosAcceptedAt || null,
        tos_version:              complete.tosVersion || null,
        privacy_accepted_at:      complete.privacyAcceptedAt || null,
        privacy_version:          complete.privacyVersion || null,
        ai_accepted_at:           complete.aiAcceptedAt || null,
        ai_version:               complete.aiVersion || null,
      });
      if (profileErr) {
        console.warn('completeOnboarding: profiles.upsert failed:', profileErr);
        throw new Error(`Failed to save profile during onboarding: ${profileErr.message}`);
      }

      // 2. Upsert user_goals (computed from Mifflin-St Jeor base targets).
      // Non-critical: if this fails the targets are recomputable on next launch.
      const baseTargets = computeBaseTargets(complete);
      const { error: goalsErr } = await supabase.from('user_goals').upsert({
        user_id:                 user.id,
        daily_protein_g_target:  baseTargets.proteinG,
        daily_fiber_g_target:    baseTargets.fiberG,
        daily_steps_target:      baseTargets.steps,
        daily_calories_target:   baseTargets.caloriesTarget,
        active_calories_target:  baseTargets.activeMinutes * 3, // ~3 cal/min
      }, { onConflict: 'user_id' });
      if (goalsErr) {
        console.warn('completeOnboarding: user_goals.upsert failed:', goalsErr);
      }

      // 3. Seed weight_logs with onboarding weight(s) so the graph has data from day one.
      const seedWeightLbs = complete.startWeightLbs ?? complete.weightLbs;
      if (seedWeightLbs) {
        const seedDate = complete.startDate
          ? new Date(complete.startDate + 'T12:00:00').toISOString()
          : new Date().toISOString();
        const { error: wErr } = await supabase.from('weight_logs').insert({
          user_id: user.id,
          weight_lbs: seedWeightLbs,
          logged_at: seedDate,
          notes: 'Starting weight from onboarding',
        });
        if (wErr) console.warn('completeOnboarding: weight_logs seed failed:', wErr);

        // If the user also provided a current weight that differs from start weight,
        // seed a second entry at today's date so the chart shows both points.
        const currentLbs = complete.currentWeightLbs ?? complete.weightLbs;
        const isDistinctWeight = currentLbs && currentLbs !== seedWeightLbs;
        const isHistoricalStart = complete.startDate && seedDate !== new Date().toISOString();
        if (isDistinctWeight && isHistoricalStart) {
          const { error: cwErr } = await supabase.from('weight_logs').insert({
            user_id: user.id,
            weight_lbs: currentLbs,
            logged_at: new Date().toISOString(),
            notes: 'Current weight from onboarding',
          });
          if (cwErr) console.warn('completeOnboarding: current weight seed failed:', cwErr);
        }
      }

      // 4. Seed injection_logs if user is on-treatment and has a last injection date.
      const isOnTx = complete.treatmentStatus === 'on' && complete.lastInjectionDate;
      if (isOnTx) {
        const brandDisplay = complete.medicationBrand === 'other' && complete.medicationCustomName
          ? complete.medicationCustomName
          : complete.medicationBrand
            ? (complete.medicationBrand.charAt(0).toUpperCase() + complete.medicationBrand.slice(1))
            : null;
        const { error: iErr } = await supabase.from('injection_logs').insert({
          user_id: user.id,
          dose_mg: complete.doseMg,
          injection_date: complete.lastInjectionDate,
          injection_time: complete.doseTime || null,
          medication_name: brandDisplay,
        });
        if (iErr) console.warn('completeOnboarding: injection_logs seed failed:', iErr);
      }

      // 5. Schedule dose reminders from the treatment plan.
      if (complete.treatmentStatus === 'on') {
        const brandDisplay = complete.medicationBrand === 'other' && complete.medicationCustomName
          ? complete.medicationCustomName
          : complete.medicationBrand
            ? (complete.medicationBrand.charAt(0).toUpperCase() + complete.medicationBrand.slice(1))
            : 'GLP-1';
        await syncDoseReminder({
          injFreqDays: complete.injectionFrequencyDays ?? 7,
          doseTime: complete.doseTime || '09:00',
          drugName: brandDisplay,
          lastInjectionDate: complete.lastInjectionDate || null,
        }).catch(() => {});
      }

      // Reload user store so the home screen greeting picks up the saved username
      useUserStore.getState().loadProfile().catch(() => {});
    }
  };

  const updateProfile = async (fields: Partial<FullUserProfile>) => {
    if (!profile) return;
    const previousProfile = profile;
    const derived = computeProfileDerivedMetrics(fields);
    const updated: FullUserProfile = { ...profile, ...fields, ...derived };
    // Optimistic local update — reverted below if the DB write fails.
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setProfile(updated);

    // If the treatment start date itself changed (e.g. setting a medication
    // active for the first time, or backdating it), the treatment-day
    // achievements the new date puts in the past are historical data entry, not
    // real-time progress — suppress them so they don't fire celebration popups.
    // Thresholds crossed naturally over time leave startDate unchanged and still
    // celebrate correctly, since this only runs when startDate is edited.
    if (fields.startDate !== undefined && fields.startDate !== previousProfile.startDate && updated.startDate) {
      const start = new Date(updated.startDate.slice(0, 10) + 'T12:00:00');
      if (!isNaN(start.getTime())) {
        const now = new Date();
        now.setHours(12, 0, 0, 0);
        const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
        usePreferencesStore.getState().seedAchievements(getUnlockedAchievementIds(0, 0, days));
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const row: ProfileUpdate = {};
      if (fields.doseMg                  !== undefined) row.dose_mg                  = fields.doseMg;
      if (fields.glp1Type                !== undefined) row.medication_type           = fields.glp1Type;
      if (fields.medicationBrand         !== undefined) row.medication_brand          = fields.medicationBrand;
      if (fields.medicationCustomName    !== undefined) row.medication_custom_name    = fields.medicationCustomName ?? null;
      if (fields.routeOfAdministration   !== undefined) row.route_of_administration   = fields.routeOfAdministration;
      if (fields.glp1Status              !== undefined) row.glp1_status               = fields.glp1Status;
      if (fields.treatmentStatus        !== undefined) (row as any).treatment_status  = fields.treatmentStatus;
      if (fields.initialDoseMg           !== undefined) row.initial_dose_mg           = fields.initialDoseMg;
      if (fields.injectionFrequencyDays  !== undefined) row.injection_frequency_days  = fields.injectionFrequencyDays;
      if (fields.doseTime                !== undefined) row.dose_time                 = fields.doseTime || null;
      if (fields.doseStartDate           !== undefined) row.dose_start_date           = fields.doseStartDate;
      if (fields.medicationStartDate     !== undefined) row.medication_start_date     = fields.medicationStartDate || null;
      if (fields.lastInjectionDate       !== undefined) row.last_injection_date       = fields.lastInjectionDate || null;
      if (fields.tosAcceptedAt           !== undefined) row.tos_accepted_at           = fields.tosAcceptedAt;
      if (fields.tosVersion              !== undefined) row.tos_version               = fields.tosVersion;
      if (fields.privacyAcceptedAt       !== undefined) row.privacy_accepted_at       = fields.privacyAcceptedAt;
      if (fields.privacyVersion          !== undefined) row.privacy_version           = fields.privacyVersion;
      if (fields.aiAcceptedAt            !== undefined) row.ai_accepted_at            = fields.aiAcceptedAt;
      if (fields.aiVersion               !== undefined) row.ai_version                = fields.aiVersion;
      if (fields.sex                     !== undefined) row.sex                       = fields.sex;
      if (fields.birthday                !== undefined) row.dob                       = fields.birthday;
      if (fields.unitSystem              !== undefined) row.unit_system               = fields.unitSystem;
      if (fields.activityLevel           !== undefined) row.activity_level            = fields.activityLevel;
      if (fields.targetWeeklyLossLbs     !== undefined) row.target_weekly_loss_lbs    = fields.targetWeeklyLossLbs;
      if (fields.goalWeightLbs           !== undefined) row.goal_weight_lbs           = fields.goalWeightLbs;
      else if (fields.goalWeightKg       !== undefined) row.goal_weight_lbs           = Math.round(fields.goalWeightKg / 0.453592);
      // currentWeightLbs → current_weight_lbs (what user weighs now)
      if (fields.currentWeightLbs        !== undefined) row.current_weight_lbs        = fields.currentWeightLbs;
      // weightLbs updates current_weight_lbs (used for nutrition calcs)
      if (fields.weightLbs               !== undefined) row.current_weight_lbs        = fields.weightLbs;
      else if (fields.weightKg           !== undefined) row.current_weight_lbs        = Math.round(fields.weightKg * 2.20462);
      // startWeightLbs → start_weight_lbs (what user weighed when starting GLP-1)
      if (fields.startWeightLbs          !== undefined) row.start_weight_lbs          = fields.startWeightLbs;
      // height - trigger if any height field appears
      if (fields.heightFt !== undefined || fields.heightIn !== undefined || fields.heightCm !== undefined) {
        row.height_inches = updated.heightFt * 12 + updated.heightIn;
      }

      // Medication detail fields
      if (fields.medicationNotes    !== undefined) (row as any).medication_notes     = fields.medicationNotes ?? null;
      if (fields.medicationPhotoUrl !== undefined) (row as any).medication_photo_url = fields.medicationPhotoUrl ?? null;

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
        const { error: profileErr } = await supabase
          .from('profiles')
          .update(row)
          .eq('id', user.id);
        if (profileErr) {
          // Revert optimistic local state so the UI matches what's actually persisted.
          // Without this, the user sees the value they tried to set, but the next
          // loadProfile() will overwrite it with the stale DB row, leaving them
          // confused about whether their change took effect.
          console.warn('updateProfile: profiles.update failed:', profileErr);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(previousProfile));
          setProfile(previousProfile);
          throw new Error(`Failed to save profile changes: ${profileErr.message}`);
        }
      }

      // Recompute user_goals when nutrition-affecting fields change.
      // Only runs if the profiles UPDATE above succeeded — otherwise we'd be
      // writing nutrition targets derived from a state that didn't actually persist.
      const NUTRITION_AFFECTING = new Set([
        'heightFt','heightIn','heightCm','weightLbs','weightKg','currentWeightLbs','startWeightLbs',
        'activityLevel','goalWeightLbs','goalWeightKg','targetWeeklyLossLbs',
        'sex','birthday',
        // Medication fields affect protein, water, and calorie targets
        'glp1Type','doseMg','glp1Status','treatmentStatus','injectionFrequencyDays',
      ]);
      if (Object.keys(fields).some(k => NUTRITION_AFFECTING.has(k))) {
        const baseTargets = computeBaseTargets(updated);
        const { error: goalsErr } = await supabase.from('user_goals').upsert({
          user_id:                user.id,
          daily_protein_g_target: baseTargets.proteinG,
          daily_fiber_g_target:   baseTargets.fiberG,
          daily_steps_target:     baseTargets.steps,
          daily_calories_target:  baseTargets.caloriesTarget,
          active_calories_target: baseTargets.activeMinutes * 3,
        }, { onConflict: 'user_id' });
        if (goalsErr) {
          // Profile already saved successfully — log but don't revert; user_goals
          // is recomputable from profile state on next launch.
          console.warn('updateProfile: user_goals.upsert failed:', goalsErr);
        }
      }
    }
  };

  const applyPendingTransition = async () => {
    if (!profile?.pendingFirstDoseDate || !profile?.pendingMedicationBrand) return;

    // Set lastInjectionDate = firstDoseDate so the next expected shot
    // is firstDoseDate + freq. Previously this was set to firstDoseDate - freq
    // which caused a false "missed shot" alert when the transition was applied
    // after the first dose date had already passed.
    const firstDoseDateStr = profile.pendingFirstDoseDate;

    // Reset the "weeks on medication" anchor only when the drug or brand actually
    // changes — a scheduled dose-only change keeps the same medication, so the
    // counter should keep running. (Pending changes are only ever drug_type,
    // brand_swap, or dose_only; freq changes aren't future-schedulable.)
    const isMedicationChange =
      profile.pendingMedicationBrand !== profile.medicationBrand ||
      profile.pendingGlp1Type !== profile.glp1Type;

    await updateProfile({
      // Apply new medication
      treatmentStatus: 'on',
      medicationBrand: profile.pendingMedicationBrand,
      glp1Type: profile.pendingGlp1Type as any,
      routeOfAdministration: profile.pendingRoute as any,
      doseMg: profile.pendingDoseMg!,
      injectionFrequencyDays: profile.pendingFrequencyDays!,
      doseTime: profile.pendingDoseTime ?? '',
      lastInjectionDate: firstDoseDateStr,
      doseStartDate: profile.pendingFirstDoseDate,
      ...(isMedicationChange ? { medicationStartDate: profile.pendingFirstDoseDate } : {}),
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
    await AsyncStorage.removeItem(STORAGE_KEY + '_uid');
    await AsyncStorage.removeItem(DRAFT_KEY);
    setProfile(null);
    setDraft({});
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('profiles').update({ program_start_date: null }).eq('id', user.id);
      if (error) console.warn('resetProfile: profiles.update failed:', error);
    }
  };

  return (
    <ProfileContext.Provider
      value={{ profile, draft, updateDraft, completeOnboarding, resetProfile, reloadProfile: () => loadProfileFromServer(0, true), updateProfile, applyPendingTransition, setProfile, isLoading }}>
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
