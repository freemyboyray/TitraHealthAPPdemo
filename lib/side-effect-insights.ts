import type { SideEffectLog, InjectionLog } from '@/stores/log-store';
import { severityTier, type SeverityTier } from '@/constants/side-effects';

const DAY_MS = 86400000;

export type ToleranceResult = {
  score: number;          // 0-100
  trend: 'improving' | 'flat' | 'worsening' | 'insufficient';
  recentAvgSev: number;
  olderAvgSev: number;
  recentEpisodes: number;
  olderEpisodes: number;
  logCount: number;
  progress: number;       // 0-1 toward "unlocked"
};

export type CyclePoint = {
  id: string;
  type: string;
  dayInCycle: number;     // 0..freqDays (fractional)
  severity: number;
};

export type SeverityBreakdown = {
  mild: number;
  moderate: number;
  severe: number;
  currentTier: SeverityTier;    // tier of the most recent log
  currentStreak: number;        // # of most-recent consecutive logs at currentTier
  isFreshHigh: boolean;         // most recent log is the only one at the window's worst tier
  prevTier: SeverityTier | null; // tier of the log before the most recent (null if only one log)
};

export type SymptomTrend = {
  type: string;
  count: number;
  avgSev: number;
  recentSev: number;
  sparkline: number[];    // up to last 6 severities, chronological
  trend: 'improving' | 'worsening' | 'flat' | 'insufficient';
  trendDeltaPct: number;  // recent vs older avg, signed
  breakdown: SeverityBreakdown;
};

export type CoOccurrencePair = {
  a: string;
  b: string;
  daysTogether: number;
  pctOverlap: number;     // share of days either appears that they appear together
};

export type SpikeAlert = {
  type: string;
  recentSev: number;
  baselineSev: number;
  deltaPct: number;       // positive jump
  loggedAt: string;
};

// ─── Cycle position helpers ──────────────────────────────────────────────────

/** Returns the most recent injection at or before the given timestamp. */
export function lastInjectionAt(injections: InjectionLog[], at: number): InjectionLog | null {
  let last: InjectionLog | null = null;
  let lastMs = -Infinity;
  for (const inj of injections) {
    const ms = injectionTimestamp(inj);
    if (ms <= at && ms > lastMs) {
      last = inj;
      lastMs = ms;
    }
  }
  return last;
}

export function injectionTimestamp(inj: InjectionLog): number {
  const time = inj.injection_time ?? '12:00:00';
  return new Date(`${inj.injection_date}T${time}`).getTime();
}

/**
 * Days into the current dosing cycle, in the range [0, freqDays).
 * If there's no prior dose, returns null.
 *
 * If the nearest preceding dose is more than one full cycle behind, the log is
 * stale relative to the current regimen (a missed dose, or — critically — a
 * regimen change such as weekly injectable → daily oral) and returns null.
 * We deliberately do NOT wrap `delta % freqDays`: wrapping would fold a symptom
 * logged 3 days after an old weekly shot onto a 1-day axis, producing a
 * misleading scatter that has nothing to do with the new daily cycle.
 */
export function dayInCycle(
  loggedAt: string,
  injections: InjectionLog[],
  freqDays: number,
): number | null {
  const t = new Date(loggedAt).getTime();
  const last = lastInjectionAt(injections, t);
  if (!last) return null;
  const delta = (t - injectionTimestamp(last)) / DAY_MS;
  if (delta < 0 || delta > freqDays) return null;
  return delta;
}

// ─── Tolerance / adaptation score ────────────────────────────────────────────

/**
 * Composite "adaptation" metric: are episodes getting milder + less frequent?
 * Compares the recent half of the window (last 14d) to the older half (15-28d).
 * Threshold to unlock: at least 4 logs across the 28d window.
 */
export function computeTolerance(logs: SideEffectLog[]): ToleranceResult {
  const now = Date.now();
  const recentCutoff = now - 14 * DAY_MS;
  const olderCutoff = now - 28 * DAY_MS;

  const recent = logs.filter(l => {
    const t = new Date(l.logged_at).getTime();
    return t >= recentCutoff && t <= now;
  });
  const older = logs.filter(l => {
    const t = new Date(l.logged_at).getTime();
    return t >= olderCutoff && t < recentCutoff;
  });

  const logCount = recent.length + older.length;
  const progress = Math.min(1, logCount / 4);

  if (logCount < 4) {
    return {
      score: 0,
      trend: 'insufficient',
      recentAvgSev: 0,
      olderAvgSev: 0,
      recentEpisodes: recent.length,
      olderEpisodes: older.length,
      logCount,
      progress,
    };
  }

  const avg = (arr: SideEffectLog[]) =>
    arr.length === 0 ? 0 : arr.reduce((s, l) => s + l.severity, 0) / arr.length;

  const recentAvgSev = avg(recent);
  const olderAvgSev = avg(older);

  // If there's no older window data, anchor against the recent window itself
  // (so score reflects current severity, not nothing).
  const sevBaseline = olderAvgSev > 0 ? olderAvgSev : recentAvgSev;
  const sevDelta = sevBaseline > 0 ? (sevBaseline - recentAvgSev) / sevBaseline : 0;

  // Episode frequency change: per-week comparison
  const recentRate = recent.length / 2; // 14d window → per week
  const olderRate = older.length / 2;
  const rateBaseline = olderRate > 0 ? olderRate : recentRate;
  const rateDelta = rateBaseline > 0 ? (rateBaseline - recentRate) / rateBaseline : 0;

  // Combine into 0–100. Severity weighted 60%, frequency 40%.
  // A drop of 50% in severity + 50% in frequency = 100.
  // No change anchors at ~50 (neutral).
  const combined = 0.5 + 0.6 * sevDelta + 0.4 * rateDelta;
  const score = Math.round(Math.max(0, Math.min(1, combined)) * 100);

  let trend: ToleranceResult['trend'];
  if (combined > 0.6) trend = 'improving';
  else if (combined < 0.4) trend = 'worsening';
  else trend = 'flat';

  return {
    score,
    trend,
    recentAvgSev: Math.round(recentAvgSev * 10) / 10,
    olderAvgSev: Math.round(olderAvgSev * 10) / 10,
    recentEpisodes: recent.length,
    olderEpisodes: older.length,
    logCount,
    progress,
  };
}

// ─── Cycle-position chart data ────────────────────────────────────────────────

/**
 * Maps each side-effect log to its position within the injection cycle.
 * Returns only points within the last 60 days where an injection precedes them.
 */
export function computeCyclePositions(
  logs: SideEffectLog[],
  injections: InjectionLog[],
  freqDays: number,
): CyclePoint[] {
  const cutoff = Date.now() - 60 * DAY_MS;
  const points: CyclePoint[] = [];
  for (const log of logs) {
    const t = new Date(log.logged_at).getTime();
    if (t < cutoff) continue;
    const d = dayInCycle(log.logged_at, injections, freqDays);
    if (d == null) continue;
    points.push({ id: log.id, type: log.effect_type, dayInCycle: d, severity: log.severity });
  }
  return points;
}

// ─── Per-symptom trend & sparkline ───────────────────────────────────────────

const SPARKLINE_MAX = 6;

const TIER_RANK: Record<SeverityTier, number> = { mild: 0, moderate: 1, severe: 2 };

/**
 * Collapses a chronological severity list (oldest→newest) into a tier
 * distribution plus recency signals: how long the current tier has held, and
 * whether the latest log is a fresh high (the only log at the window's worst
 * tier — i.e. it just spiked).
 */
function buildBreakdown(sevs: number[]): SeverityBreakdown {
  const tiers = sevs.map(severityTier);
  const last = tiers[tiers.length - 1];

  let currentStreak = 0;
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (tiers[i] === last) currentStreak++;
    else break;
  }

  const worstRank = Math.max(...tiers.map(t => TIER_RANK[t]));
  const worstCount = tiers.filter(t => TIER_RANK[t] === worstRank).length;
  const isFreshHigh = TIER_RANK[last] === worstRank && worstCount === 1 && tiers.length > 1;

  return {
    mild: tiers.filter(t => t === 'mild').length,
    moderate: tiers.filter(t => t === 'moderate').length,
    severe: tiers.filter(t => t === 'severe').length,
    currentTier: last,
    currentStreak,
    isFreshHigh,
    prevTier: tiers.length >= 2 ? tiers[tiers.length - 2] : null,
  };
}

export function computeSymptomTrends(logs: SideEffectLog[]): SymptomTrend[] {
  const cutoff = Date.now() - 30 * DAY_MS;
  const byType = new Map<string, SideEffectLog[]>();
  for (const l of logs) {
    if (new Date(l.logged_at).getTime() < cutoff) continue;
    const arr = byType.get(l.effect_type) ?? [];
    arr.push(l);
    byType.set(l.effect_type, arr);
  }

  const trends: SymptomTrend[] = [];
  for (const [type, arr] of byType) {
    const sorted = [...arr].sort((a, b) =>
      new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime(),
    );
    const sevs = sorted.map(l => l.severity);
    const sparkline = sevs.slice(-SPARKLINE_MAX);
    const count = sevs.length;
    const avgSev = Math.round((sevs.reduce((s, v) => s + v, 0) / count) * 10) / 10;
    const recentSev = sparkline[sparkline.length - 1];

    let trend: SymptomTrend['trend'] = 'insufficient';
    let trendDeltaPct = 0;
    if (count >= 3) {
      const half = Math.floor(count / 2);
      const olderHalf = sevs.slice(0, half);
      const recentHalf = sevs.slice(-half);
      const olderAvg = olderHalf.reduce((s, v) => s + v, 0) / olderHalf.length;
      const recentAvg = recentHalf.reduce((s, v) => s + v, 0) / recentHalf.length;
      const delta = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;
      trendDeltaPct = Math.round(delta * 100);
      // 15% change threshold to call a direction
      if (delta < -0.15) trend = 'improving';
      else if (delta > 0.15) trend = 'worsening';
      else trend = 'flat';
    }

    const breakdown = buildBreakdown(sevs);

    trends.push({ type, count, avgSev, recentSev, sparkline, trend, trendDeltaPct, breakdown });
  }
  return trends.sort((a, b) => b.count - a.count || b.avgSev - a.avgSev);
}

// ─── Co-occurrence detection ──────────────────────────────────────────────────

function dayKey(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

/**
 * Returns symptom pairs that co-occur on the same day at least twice.
 * Sorted by overlap strength, capped at top 3.
 */
export function computeCoOccurrence(logs: SideEffectLog[]): CoOccurrencePair[] {
  const cutoff = Date.now() - 30 * DAY_MS;
  // For each day, the set of symptom types logged
  const byDay = new Map<string, Set<string>>();
  for (const l of logs) {
    if (new Date(l.logged_at).getTime() < cutoff) continue;
    const key = dayKey(l.logged_at);
    const set = byDay.get(key) ?? new Set<string>();
    set.add(l.effect_type);
    byDay.set(key, set);
  }

  // Counts: per type total days, per pair shared days
  const typeDays = new Map<string, number>();
  const pairDays = new Map<string, number>();
  for (const set of byDay.values()) {
    const types = [...set];
    for (const t of types) typeDays.set(t, (typeDays.get(t) ?? 0) + 1);
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const [a, b] = [types[i], types[j]].sort();
        const key = `${a}::${b}`;
        pairDays.set(key, (pairDays.get(key) ?? 0) + 1);
      }
    }
  }

  const pairs: CoOccurrencePair[] = [];
  for (const [key, daysTogether] of pairDays) {
    if (daysTogether < 2) continue;
    const [a, b] = key.split('::');
    const eitherDays = (typeDays.get(a) ?? 0) + (typeDays.get(b) ?? 0) - daysTogether;
    const pctOverlap = eitherDays > 0 ? daysTogether / eitherDays : 0;
    pairs.push({ a, b, daysTogether, pctOverlap });
  }

  return pairs.sort((p, q) => q.pctOverlap - p.pctOverlap || q.daysTogether - p.daysTogether).slice(0, 3);
}

// ─── Cycle volume (stacked-by-severity bars) ─────────────────────────────────

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The user's habitual injection weekday (0=Sun…6=Sat), but only when it
 * dominates recent injections (≥60% share). Returns null for irregular
 * schedules, so the cycle axis falls back to "Day N" labels rather than
 * implying a weekday pattern that isn't there.
 */
export function detectInjectionWeekday(injections: InjectionLog[]): number | null {
  const cutoff = Date.now() - 90 * DAY_MS;
  const counts = new Array(7).fill(0);
  let total = 0;
  for (const inj of injections) {
    const ms = injectionTimestamp(inj);
    if (ms < cutoff) continue;
    counts[new Date(ms).getDay()]++;
    total++;
  }
  if (total < 3) return null;
  let best = 0;
  for (let i = 1; i < 7; i++) if (counts[i] > counts[best]) best = i;
  return counts[best] / total >= 0.6 ? best : null;
}

export type CycleBucketDef = { label: string; startDay: number; endDay: number };

/**
 * Buckets that tile the dose cycle [0, freqDays]. The final bucket reads "Next"
 * (the upcoming dose). Resolution adapts to the regimen so the bar chart holds
 * integrity for every cycle length:
 *   • daily oral (≤1d)  → 4 intraday 6-hour buckets
 *   • weekly (7d)       → one bucket per day; weekday-labeled when the user
 *                         injects on a fixed weekday, else D1…D6 / Next
 *   • anything else     → ~7 even buckets across the cycle
 */
export function buildCycleBuckets(freqDays: number, weekday: number | null): CycleBucketDef[] {
  if (freqDays <= 1) {
    return [
      { label: '0–6h',   startDay: 0,    endDay: 0.25 },
      { label: '6–12h',  startDay: 0.25, endDay: 0.5 },
      { label: '12–18h', startDay: 0.5,  endDay: 0.75 },
      { label: '18–24h', startDay: 0.75, endDay: 1 },
    ];
  }
  if (Math.round(freqDays) === 7) {
    return Array.from({ length: 7 }, (_, i) => ({
      startDay: i,
      endDay: i + 1,
      label: weekday != null
        ? WEEKDAY_NAMES[(weekday + i) % 7]
        : i === 6 ? 'Next' : `D${i + 1}`,
    }));
  }
  const n = Math.min(7, Math.max(3, Math.round(freqDays)));
  const width = freqDays / n;
  return Array.from({ length: n }, (_, i) => {
    const startDay = i * width;
    const endDay = (i + 1) * width;
    const mid = Math.max(1, Math.round((startDay + endDay) / 2));
    return { startDay, endDay, label: i === n - 1 ? 'Next' : `D${mid}` };
  });
}

export type VolumeBucket = {
  label: string;
  mild: number;
  moderate: number;
  severe: number;
  total: number;
};

export type CycleVolume = {
  buckets: VolumeBucket[];
  peakIndex: number;     // bucket with the most logs (-1 if none)
  maxTotal: number;      // tallest bucket's count (for y-scaling)
  totalPoints: number;   // logs mapped onto the cycle
};

/**
 * Volume of symptom logs per cycle bucket, split by severity tier — the data
 * behind the stacked bar hero. Built on `computeCyclePositions` so it inherits
 * the same staleness/regimen-change guards.
 */
export function computeCycleVolume(
  logs: SideEffectLog[],
  injections: InjectionLog[],
  freqDays: number,
  weekday: number | null,
): CycleVolume {
  const points = computeCyclePositions(logs, injections, freqDays);
  const defs = buildCycleBuckets(freqDays, weekday);
  const buckets: VolumeBucket[] = defs.map(d => ({ label: d.label, mild: 0, moderate: 0, severe: 0, total: 0 }));

  for (const p of points) {
    let idx = defs.findIndex(d => p.dayInCycle >= d.startDay && p.dayInCycle < d.endDay);
    if (idx === -1) idx = defs.length - 1; // dayInCycle === freqDays → last bucket
    buckets[idx][severityTier(p.severity)]++;
    buckets[idx].total++;
  }

  let peakIndex = -1;
  let maxTotal = 0;
  buckets.forEach((b, i) => {
    if (b.total > maxTotal) { maxTotal = b.total; peakIndex = i; }
  });
  return { buckets, peakIndex, maxTotal, totalPoints: points.length };
}

// ─── Daily severity series (expanded detail + cluster overlap) ────────────────

export type DailyPoint = { date: string; worst: number | null };

function toLocalDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Worst (max) severity per local day for one symptom over the last `days` days,
 * oldest → newest. Days with no log are null so the line shows real gaps rather
 * than implying a zero. Drives the expanded trend graph and cluster overlay.
 */
export function computeSymptomDailySeries(
  logs: SideEffectLog[],
  type: string,
  days = 30,
): DailyPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime() - (days - 1) * DAY_MS;

  const worstByDay = new Map<string, number>();
  for (const l of logs) {
    if (l.effect_type !== type) continue;
    const t = new Date(l.logged_at).getTime();
    if (t < startMs) continue;
    const key = toLocalDayKey(new Date(t));
    worstByDay.set(key, Math.max(worstByDay.get(key) ?? 0, l.severity));
  }

  const out: DailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const key = toLocalDayKey(new Date(startMs + i * DAY_MS));
    out.push({ date: key, worst: worstByDay.get(key) ?? null });
  }
  return out;
}

/**
 * Worst severity per local day across ALL symptoms — drives the 30-day strip on
 * the Symptom Changes summary card. Same null-for-empty-day convention.
 */
export function computeOverallDailySeries(logs: SideEffectLog[], days = 30): DailyPoint[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = today.getTime() - (days - 1) * DAY_MS;

  const worstByDay = new Map<string, number>();
  for (const l of logs) {
    const t = new Date(l.logged_at).getTime();
    if (t < startMs) continue;
    const key = toLocalDayKey(new Date(t));
    worstByDay.set(key, Math.max(worstByDay.get(key) ?? 0, l.severity));
  }

  const out: DailyPoint[] = [];
  for (let i = 0; i < days; i++) {
    const key = toLocalDayKey(new Date(startMs + i * DAY_MS));
    out.push({ date: key, worst: worstByDay.get(key) ?? null });
  }
  return out;
}

export type PairSeries = { a: DailyPoint[]; b: DailyPoint[] };

/** Two aligned daily severity series for the symptom-cluster overlap graph. */
export function computePairSeries(logs: SideEffectLog[], a: string, b: string, days = 30): PairSeries {
  return {
    a: computeSymptomDailySeries(logs, a, days),
    b: computeSymptomDailySeries(logs, b, days),
  };
}

// ─── Spike detection ──────────────────────────────────────────────────────────

/**
 * Detects a recent severity spike: latest log of any symptom whose severity
 * is at least 50% higher than the rolling avg of that symptom's prior logs.
 * Requires at least 3 prior logs of that symptom to baseline against.
 */
export function detectRecentSpike(logs: SideEffectLog[]): SpikeAlert | null {
  const cutoff = Date.now() - 3 * DAY_MS;
  const recent = logs.filter(l => new Date(l.logged_at).getTime() >= cutoff);
  if (recent.length === 0) return null;

  let best: SpikeAlert | null = null;
  for (const r of recent) {
    const prior = logs.filter(l =>
      l.effect_type === r.effect_type &&
      l.id !== r.id &&
      new Date(l.logged_at).getTime() < new Date(r.logged_at).getTime(),
    );
    if (prior.length < 3) continue;
    const baseline = prior.reduce((s, l) => s + l.severity, 0) / prior.length;
    if (baseline <= 0) continue;
    const delta = (r.severity - baseline) / baseline;
    if (delta < 0.5) continue;
    if (!best || delta > best.deltaPct / 100) {
      best = {
        type: r.effect_type,
        recentSev: r.severity,
        baselineSev: Math.round(baseline * 10) / 10,
        deltaPct: Math.round(delta * 100),
        loggedAt: r.logged_at,
      };
    }
  }
  return best;
}
