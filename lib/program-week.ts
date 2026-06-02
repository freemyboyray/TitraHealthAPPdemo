// ─── Program-week boundary ───────────────────────────────────────────────────
// Single source of truth for "which week of the program is the user in."
// Anchored to profile.startDate (program_start_date) and counted in whole
// 7-day blocks. Used to gate the weekly check-in (one per program week) and to
// key the weekly summary snapshot to a specific week window.
//
// Week 0 = days 0–6 since start, week 1 = days 7–13, etc. The index increments
// exactly every 7 days, so "the next week hits" is deterministic.

const DAY_MS = 86400000;

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Parse a YYYY-MM-DD (or ISO) start date into a local Date, or null if invalid. */
export function parseStartDate(startDate?: string | null): Date | null {
  if (!startDate) return null;
  const s = startDate.length <= 10 ? `${startDate}T00:00:00` : startDate;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Format a Date as YYYY-MM-DD in local timezone. */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type WeekWindow = {
  /** 0-based program-week index. */
  index: number;
  /** Local midnight of the window start. */
  start: Date;
  /** Local midnight of the window end (start + 6 days). */
  end: Date;
  /** YYYY-MM-DD of window start. */
  startStr: string;
  /** YYYY-MM-DD of window end. */
  endStr: string;
};

/** 0-based program-week index for `now`, or null if no/invalid/future start date. */
export function getProgramWeekIndex(startDate?: string | null, now: Date = new Date()): number | null {
  const start = parseStartDate(startDate);
  if (!start) return null;
  const days = Math.floor((startOfLocalDay(now) - startOfLocalDay(start)) / DAY_MS);
  if (days < 0) return null;
  return Math.floor(days / 7);
}

/** 1-based week number for display (Week 1 = first 7 days). */
export function getProgramWeekNumber(startDate?: string | null, now: Date = new Date()): number | null {
  const i = getProgramWeekIndex(startDate, now);
  return i == null ? null : i + 1;
}

/** The calendar window [start, start+6] for a given 0-based week index. */
export function getWeekWindow(startDate: string | null | undefined, weekIndex: number): WeekWindow | null {
  const start = parseStartDate(startDate);
  if (!start || weekIndex < 0) return null;
  const startMs = startOfLocalDay(start) + weekIndex * 7 * DAY_MS;
  const winStart = new Date(startMs);
  const winEnd = new Date(startMs + 6 * DAY_MS);
  return {
    index: weekIndex,
    start: winStart,
    end: winEnd,
    startStr: toDateStr(winStart),
    endStr: toDateStr(winEnd),
  };
}

/** The window of the program week that contains `now`. */
export function currentWeekWindow(startDate?: string | null, now: Date = new Date()): WeekWindow | null {
  const idx = getProgramWeekIndex(startDate, now);
  if (idx == null) return null;
  return getWeekWindow(startDate, idx);
}

/** Inclusive timestamp-in-window test (window end is extended to end-of-day). */
export function isWithinWindow(iso: string | null | undefined, win: WeekWindow): boolean {
  if (!iso) return false;
  const ms = new Date(iso).getTime();
  if (isNaN(ms)) return false;
  return ms >= win.start.getTime() && ms < win.end.getTime() + DAY_MS;
}

/** Whole days from `now` until `date` (local-midnight diff, never negative). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.round((startOfLocalDay(date) - startOfLocalDay(now)) / DAY_MS));
}
