// ─── Lazy weekly-summary generation ──────────────────────────────────────────
// Generates ONE frozen summary snapshot per program week, the first time the
// user opens the app after that week completes. To the user this is
// indistinguishable from a server cron: a new snapshot simply appears, dated to
// the week it covers. No regeneration on view — the snapshot is keyed to the
// week's window_end and persisted to Supabase.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';

import { useProfile } from '@/contexts/profile-context';
import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { computeWeeklySummary } from '@/lib/weekly-summary';
import { generateWeeklyInsight } from '@/lib/openai';
import { currentWeekWindow, getWeekWindow, resolveEngagementStart } from '@/lib/program-week';
import { scheduleWeeklyCheckinReminderAt } from '@/lib/notifications';

/**
 * Ensures the just-completed program week has a summary snapshot. Safe to call
 * on every home render — it no-ops once a snapshot exists for the target week.
 */
export function useWeeklySummaryAutoGen() {
  const { profile } = useProfile();
  const { targets } = useHealthData();
  const hydrated = useLogStore((s) => s.hydrated);
  const weeklySummaries = useLogStore((s) => s.weeklySummaries);
  const aiDataConsent = usePreferencesStore((s) => s.aiDataConsent);

  // Guards against re-running for the same week within a session (the upsert +
  // refetch is async, so the existence check below can briefly still be false).
  const ranForWeek = useRef<string | null>(null);

  // Anchor weekly windows to when the user started using Titra, not their
  // (possibly historical) medication start — so summaries/check-ins describe
  // real in-app activity rather than weeks before the account existed.
  const engagementStart = resolveEngagementStart(profile?.engagementStartDate);

  // Keep a local check-in reminder pointed at the start of the next engagement
  // week, so a new week's check-in announces itself even without a server cron.
  useEffect(() => {
    if (!profile) return;
    const cur = currentWeekWindow(engagementStart);
    if (!cur) return;
    const nextWin = getWeekWindow(engagementStart, cur.index + 1);
    if (nextWin) scheduleWeeklyCheckinReminderAt(nextWin.start).catch(() => {});
  }, [profile, engagementStart]);

  useEffect(() => {
    if (!profile || !hydrated || !targets) return;

    const cur = currentWeekWindow(engagementStart);
    // Need at least one fully-completed engagement week (index >= 1) to summarize.
    if (!cur || cur.index < 1) return;

    const lastWin = getWeekWindow(engagementStart, cur.index - 1);
    if (!lastWin) return;

    if (ranForWeek.current === lastWin.endStr) return;
    // Regenerate when no snapshot exists OR the existing one is stale: frozen
    // before the per-day chart fields existed (or before that week's logs synced),
    // which would otherwise leave it permanently empty.
    const existing = weeklySummaries.find((s) => s.window_end === lastWin.endStr);
    const existingNutrition = (existing?.summary_data as { nutrition?: { caloriesByDay?: unknown } } | undefined)?.nutrition;
    const isStaleFormat = !!existing && !Array.isArray(existingNutrition?.caloriesByDay);
    if (existing && !isStaleFormat) {
      ranForWeek.current = lastWin.endStr;
      return;
    }
    ranForWeek.current = lastWin.endStr;

    (async () => {
      const store = useLogStore.getState();

      // Water lives in AsyncStorage, keyed by date. Read the window's 7 days.
      const waterByDate: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(lastWin.start.getTime() + i * 86400000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const val = await AsyncStorage.getItem(`@titrahealth_water_${dateStr}`).catch(() => null);
        if (val) waterByDate[dateStr] = parseFloat(val);
      }

      const computed = computeWeeklySummary(
        {
          foodLogs: store.foodLogs,
          weightLogs: store.weightLogs,
          activityLogs: store.activityLogs,
          sideEffectLogs: store.sideEffectLogs,
          weeklyCheckins: store.weeklyCheckins,
          foodNoiseLogs: store.foodNoiseLogs,
        },
        targets,
        waterByDate,
        { windowStart: lastWin.startStr, windowEnd: lastWin.endStr },
      );

      // Only send data to OpenAI when the user has consented. No consent →
      // snapshot still saves, just without an AI insight.
      let insight: string | null = null;
      if (aiDataConsent && profile) {
        try {
          insight = await generateWeeklyInsight(computed, profile);
        } catch {
          insight = null;
        }
      }

      try {
        await store.upsertWeeklySummary({
          window_start: computed.windowStart,
          window_end: computed.windowEnd,
          summary_data: computed,
          ai_insight: insight,
        });
      } catch (err) {
        // Reset the guard so a later render can retry the generation.
        ranForWeek.current = null;
        console.warn('useWeeklySummaryAutoGen: upsert failed', err);
      }
    })();
  }, [engagementStart, profile, hydrated, targets, weeklySummaries, aiDataConsent]);
}
