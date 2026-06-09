import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import {
  ACHIEVEMENTS,
  getUnlockedAchievementIds,
  getReachedPhotoMilestones,
  WEIGHT_ACHIEVEMENT_THRESHOLDS,
  type Achievement,
} from '@/constants/achievements';
import { resolveEngagementStart } from '@/lib/program-week';

export type MilestoneEvent =
  | { type: 'achievement'; achievement: Achievement }
  | { type: 'photo-milestone'; lbs: number; achievement: Achievement | null };

/**
 * Reactively detects newly unlocked achievements AND 5-lb photo milestones.
 *
 * On first run (seeded === false) it silently marks all currently-earned items
 * as "already shown" so overlays only fire for NEW unlocks going forward.
 *
 * Returns a single pending event at a time plus a dismiss callback.
 */
export function useAchievementDetector() {
  const { profile } = useProfile();
  const weightLogs = useLogStore((s) => s.weightLogs);
  const hydrated = useLogStore((s) => s.hydrated);
  const streakCount = usePreferencesStore((s: { streakCount: number }) => s.streakCount);
  const prefsHydrated = usePreferencesStore((s: { _hasHydrated: boolean }) => s._hasHydrated);

  // Achievement tracking
  const shownIds = usePreferencesStore((s: { shownAchievementIds: string[] }) => s.shownAchievementIds);
  const achievementsSeeded = usePreferencesStore((s: { achievementsSeeded: boolean }) => s.achievementsSeeded);
  const markAchievementShown = usePreferencesStore((s: { markAchievementShown: (id: string) => void }) => s.markAchievementShown);
  const seedAchievements = usePreferencesStore((s: { seedAchievements: (ids: string[]) => void }) => s.seedAchievements);

  // Photo milestone tracking
  const shownPhotoMilestones = usePreferencesStore((s: { shownPhotoMilestones: number[] }) => s.shownPhotoMilestones);
  const photoMilestonesSeeded = usePreferencesStore((s: { photoMilestonesSeeded: boolean }) => s.photoMilestonesSeeded);
  const markPhotoMilestoneShown = usePreferencesStore((s: { markPhotoMilestoneShown: (lbs: number) => void }) => s.markPhotoMilestoneShown);
  const seedPhotoMilestones = usePreferencesStore((s: { seedPhotoMilestones: (milestones: number[]) => void }) => s.seedPhotoMilestones);

  const weightLost = useMemo(() => {
    // Don't attempt weight-milestone math until we know when the user started
    // using Titra. Without it, resolveEngagementStart() falls back to *today*,
    // so the baseline shifts as the real engagement date and older logs load in
    // — which fires phantom milestones. Wait until the anchor is known.
    if (!profile?.engagementStartDate) return 0;

    const latestLog = weightLogs[0];
    // Only calculate weight loss from actual weight log entries — never fall
    // back to profile.currentWeightLbs alone, which can drift from the baseline
    // (e.g. via HealthKit sync) and trigger false achievements.
    if (!latestLog) return 0;
    const currentWeight = latestLog.weight_lbs;

    // Reject corrupt readings before they unlock every weight milestone at once
    // (and get marked shown forever). A sub-floor weight is a mistyped/garbage
    // entry; an implausible single-weigh-in drop is almost certainly a typo or
    // bad HealthKit sync, not real loss.
    const MIN_PLAUSIBLE_WEIGHT_LBS = 50;
    const MAX_SINGLE_STEP_DROP_LBS = 30;
    if (currentWeight < MIN_PLAUSIBLE_WEIGHT_LBS) return 0;
    const prevWeight = weightLogs[1]?.weight_lbs; // weightLogs sorted desc by logged_at
    if (prevWeight != null && prevWeight - currentWeight > MAX_SINGLE_STEP_DROP_LBS) return 0;

    // Baseline = the user's weight when they STARTED using Titra, so milestones
    // celebrate in-app progress, not weight lost before they ever installed the
    // app. Use the earliest weight log on/after the engagement start; if none
    // exists yet, baseline = current weight (→ 0 lost, nothing to celebrate).
    const engagementStart = resolveEngagementStart(profile?.engagementStartDate);
    const engagementMs = new Date(engagementStart + 'T00:00:00').getTime();
    const onAfter = weightLogs.filter((l) => new Date(l.logged_at).getTime() >= engagementMs);
    const baselineLog = onAfter.length > 0
      ? onAfter.reduce((a, b) => (new Date(a.logged_at).getTime() <= new Date(b.logged_at).getTime() ? a : b))
      : null;
    const baseline = baselineLog?.weight_lbs ?? currentWeight;

    if (baseline > 0 && currentWeight > 0 && baseline > currentWeight) {
      return baseline - currentWeight;
    }
    return 0;
  }, [profile, weightLogs]);

  const daysOnTreatment = useMemo(() => {
    if (!profile?.startDate) return 0;
    // Use noon to avoid off-by-one from DST spring-forward (23-hour day).
    const start = new Date(profile.startDate + 'T12:00:00');
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  }, [profile?.startDate]);

  const allUnlockedIds = useMemo(
    () => getUnlockedAchievementIds(streakCount, weightLost, daysOnTreatment),
    [streakCount, weightLost, daysOnTreatment],
  );

  const allReachedPhotoMilestones = useMemo(
    () => getReachedPhotoMilestones(weightLost),
    [weightLost],
  );

  // One-time seed: mark everything currently unlocked/reached as already shown.
  const seedingRef = useRef(false);
  useEffect(() => {
    if (seedingRef.current) return;
    if (achievementsSeeded && photoMilestonesSeeded) return;
    // Only seed once EVERY baseline input has settled. Seeding against a value
    // that is still loading (default streakCount, an empty/partial weight-log
    // list, a profile without its dates yet) snapshots a too-small baseline, so
    // everything that loads afterward looks like a brand-new unlock and fires.
    //  - prefsHydrated: streakCount / shown* arrays are off disk, not defaults
    //  - hydrated:      weight logs fetch has resolved
    //  - startDate:     treatment-day count is real, not 0
    //  - engagementStartDate: weight baseline anchor is known (see weightLost)
    if (!prefsHydrated || !hydrated || !profile) return;
    if (!profile.startDate || !profile.engagementStartDate) return;
    seedingRef.current = true;
    if (!achievementsSeeded) seedAchievements(allUnlockedIds);
    if (!photoMilestonesSeeded) seedPhotoMilestones(allReachedPhotoMilestones);
  }, [achievementsSeeded, photoMilestonesSeeded, prefsHydrated, hydrated, profile, allUnlockedIds, allReachedPhotoMilestones, seedAchievements, seedPhotoMilestones]);

  const seeded = achievementsSeeded && photoMilestonesSeeded;

  // Build unified pending queue after seeding
  const pendingQueue = useMemo<MilestoneEvent[]>(() => {
    if (!seeded) return [];

    const events: MilestoneEvent[] = [];

    // New photo milestones (every 5 lbs)
    const newPhotoMilestones = allReachedPhotoMilestones.filter(
      (m) => !shownPhotoMilestones.includes(m),
    );

    // New achievements not yet shown
    const newAchievementIds = allUnlockedIds.filter((id) => !shownIds.includes(id));
    const newAchievements = newAchievementIds
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id)!)
      .filter(Boolean);

    // Track which weight achievements get attached to a photo milestone
    const attachedWeightIds = new Set<string>();

    // Photo milestones — attach weight achievement if one coincides
    for (const lbs of newPhotoMilestones) {
      const matchingAchievement = WEIGHT_ACHIEVEMENT_THRESHOLDS.includes(lbs)
        ? newAchievements.find((a) => a.category === 'weight' && a.threshold === lbs) ?? null
        : null;
      if (matchingAchievement) attachedWeightIds.add(matchingAchievement.id);
      events.push({ type: 'photo-milestone', lbs, achievement: matchingAchievement });
    }

    // Non-weight achievements + any weight achievements whose photo milestone
    // was already shown (prevents them from being silently dropped).
    for (const a of newAchievements) {
      if (a.category !== 'weight' || !attachedWeightIds.has(a.id)) {
        events.push({ type: 'achievement', achievement: a });
      }
    }

    return events;
  }, [seeded, allUnlockedIds, shownIds, allReachedPhotoMilestones, shownPhotoMilestones]);

  // Show only the first pending event at a time
  const [current, setCurrent] = useState<MilestoneEvent | null>(null);

  useEffect(() => {
    if (!current && pendingQueue.length > 0) {
      setCurrent(pendingQueue[0]);
    }
  }, [pendingQueue, current]);

  const dismiss = useCallback(() => {
    if (!current) return;
    if (current.type === 'achievement') {
      markAchievementShown(current.achievement.id);
    } else {
      markPhotoMilestoneShown(current.lbs);
      if (current.achievement) {
        markAchievementShown(current.achievement.id);
      }
    }
    setCurrent(null);
  }, [current, markAchievementShown, markPhotoMilestoneShown]);

  return { pendingEvent: current, dismissEvent: dismiss };
}
