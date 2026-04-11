// ─── Patient engagement helpers ──────────────────────────────────────────────
//
// Thin wrapper around the `rtm_engagement_days` Postgres RPC.
// Returns the count of distinct calendar dates within a window on which the
// user actively logged at least one piece of patient-entered data
// (medication, food, weight, side effects, food noise, weekly check-ins,
// journal, mindfulness, manual activity). Excludes HealthKit-synced rows.
//
// Used to populate the "Days With Patient-Logged Data" line in the Provider
// Report's clinician-context block — informational only.

import { supabase } from '@/lib/supabase';

export type RtmEngagement = {
  days: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  year: number;
  month: number;       // 1-12
};

function fmtDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  // month is 1-12
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start: fmtDate(start), end: fmtDate(end) };
}

/** Number of distinct engagement days for the given user across [start, end] (YYYY-MM-DD). */
export async function fetchEngagementDaysRange(
  userId: string,
  start: string,
  end: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('rtm_engagement_days', {
    p_user_id: userId,
    p_start: start,
    p_end: end,
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/** Engagement count for a specific calendar month (year, month=1-12). */
export async function fetchMonthlyEngagement(
  userId: string,
  year: number,
  month: number,
): Promise<RtmEngagement> {
  const { start, end } = monthBounds(year, month);
  const days = await fetchEngagementDaysRange(userId, start, end);
  return { days, periodStart: start, periodEnd: end, year, month };
}

/** Engagement for the current calendar month (UTC). */
export async function fetchCurrentMonthEngagement(userId: string): Promise<RtmEngagement> {
  const now = new Date();
  return fetchMonthlyEngagement(userId, now.getUTCFullYear(), now.getUTCMonth() + 1);
}

/** Engagement for the last N calendar months, oldest first. */
export async function fetchLastNMonthsEngagement(
  userId: string,
  n: number,
): Promise<RtmEngagement[]> {
  const now = new Date();
  const results: RtmEngagement[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    // eslint-disable-next-line no-await-in-loop
    const r = await fetchMonthlyEngagement(userId, ref.getUTCFullYear(), ref.getUTCMonth() + 1);
    results.push(r);
  }
  return results;
}

