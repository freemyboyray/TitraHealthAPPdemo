import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import {
  ACHIEVEMENTS,
  getUnlockedAchievementIds,
  type Achievement,
} from '@/constants/achievements';

/**
 * Reactively detects newly unlocked achievements that haven't been shown yet.
 *
 * On first run (achievementsSeeded === false) it silently marks all currently-
 * earned achievements as "already shown" so the overlay only fires for NEW
 * unlocks going forward.
 */
export function useAchievementDetector() {
  const { profile } = useProfile();
  const weightLogs = useLogStore((s) => s.weightLogs);
  const hydrated = useLogStore((s) => s.hydrated);
  const streakCount = usePreferencesStore((s) => s.streakCount);
  const shownIds = usePreferencesStore((s) => s.shownAchievementIds);
  const seeded = usePreferencesStore((s) => s.achievementsSeeded);
  const markShown = usePreferencesStore((s) => s.markAchievementShown);
  const seedAchievements = usePreferencesStore((s) => s.seedAchievements);

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

  const allUnlocked = useMemo(
    () => getUnlockedAchievementIds(streakCount, weightLost, daysOnTreatment),
    [streakCount, weightLost, daysOnTreatment],
  );

  // One-time seed: mark everything currently unlocked as already shown.
  // Wait until the log store has hydrated so we have real data, not empty defaults.
  const seedingRef = useRef(false);
  useEffect(() => {
    if (seeded || seedingRef.current || !hydrated || !profile) return;
    seedingRef.current = true;
    seedAchievements(allUnlocked);
  }, [seeded, hydrated, profile, allUnlocked, seedAchievements]);

  // Only compute pending queue after seeding is done
  const pendingQueue = useMemo(() => {
    if (!seeded) return [];
    const newIds = allUnlocked.filter((id) => !shownIds.includes(id));
    return newIds
      .map((id) => ACHIEVEMENTS.find((a) => a.id === id)!)
      .filter(Boolean);
  }, [seeded, allUnlocked, shownIds]);

  // Show only the first pending achievement at a time
  const [current, setCurrent] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!current && pendingQueue.length > 0) {
      setCurrent(pendingQueue[0]);
    }
  }, [pendingQueue, current]);

  const dismiss = useCallback(() => {
    if (current) {
      markShown(current.id);
      setCurrent(null);
    }
  }, [current, markShown]);

  return { pendingAchievement: current, dismissAchievement: dismiss };
}
