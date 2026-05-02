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
    const startWeight = profile?.startWeightLbs ?? 0;
    const latestLog = weightLogs[0];
    const currentWeight = latestLog?.weight_lbs ?? profile?.currentWeightLbs ?? 0;
    if (startWeight > 0 && currentWeight > 0 && startWeight > currentWeight) {
      return startWeight - currentWeight;
    }
    return 0;
  }, [profile, weightLogs]);

  const daysOnTreatment = useMemo(() => {
    if (!profile?.startDate) return 0;
    const start = new Date(profile.startDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
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
    if (seedingRef.current || !hydrated || !profile) return;
    if (achievementsSeeded && photoMilestonesSeeded) return;
    seedingRef.current = true;
    if (!achievementsSeeded) seedAchievements(allUnlockedIds);
    if (!photoMilestonesSeeded) seedPhotoMilestones(allReachedPhotoMilestones);
  }, [achievementsSeeded, photoMilestonesSeeded, hydrated, profile, allUnlockedIds, allReachedPhotoMilestones, seedAchievements, seedPhotoMilestones]);

  const seeded = achievementsSeeded && photoMilestonesSeeded;

  // Build unified pending queue after seeding
  const pendingQueue = useMemo<MilestoneEvent[]>(() => {
    if (!seeded) return [];

    const events: MilestoneEvent[] = [];

    // New photo milestones (every 5 lbs)
    const newPhotoMilestones = allReachedPhotoMilestones.filter(
      (m) => !shownPhotoMilestones.includes(m),
    );

    // New non-weight achievements (streak, treatment)
    const newAchievementIds = allUnlockedIds.filter((id) => !shownIds.includes(id));
    const newAchievements = newAchievementIds
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id)!)
      .filter(Boolean);

    // Non-weight achievements first
    for (const a of newAchievements) {
      if (a.category !== 'weight') {
        events.push({ type: 'achievement', achievement: a });
      }
    }

    // Photo milestones — attach weight achievement if one coincides
    for (const lbs of newPhotoMilestones) {
      const matchingAchievement = WEIGHT_ACHIEVEMENT_THRESHOLDS.includes(lbs)
        ? newAchievements.find((a) => a.category === 'weight' && a.threshold === lbs) ?? null
        : null;
      events.push({ type: 'photo-milestone', lbs, achievement: matchingAchievement });
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
