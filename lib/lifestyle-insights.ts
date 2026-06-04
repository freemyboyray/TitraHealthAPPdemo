// Lifestyle insight pipeline.
//
// Generators produce InsightCards from the user's logs. Each one declares its
// data dependencies implicitly by returning `null` when its inputs are missing —
// so a user with no Apple Watch never sees a broken sleep card, and a brand-new
// user never sees an empty correlation panel. The carousel rotates through
// whatever bubbled up, falling through to floor cards as a safety net.
//
// Strength tiers (rank determines carousel order):
//   correlation (100): real finding from cross-comparing food↔symptoms etc.
//   trend       (50):  notable change in a single metric over time
//   baseline    (20):  always-interesting if data exists (avg, streak, top)
//   floor       (1):   CTA / tip / nudge — shown only as filler

import type {
  FoodLog,
  ActivityLog,
  SideEffectLog,
  InjectionLog,
} from '@/stores/log-store';
import type { DailyTargets } from '@/constants/scoring';
import { computeNutritionPatterns } from '@/stores/insights-store';
import { ORANGE } from '@/constants/theme';

export type InsightStrength = 'correlation' | 'trend' | 'baseline' | 'floor';

export type InsightCard = {
  id: string;
  strength: InsightStrength;
  rank: number;              // used to sort, defaults from strength
  icon: string;              // Ionicons name
  iconColor: string;
  tagline: string;           // small uppercase label
  title: string;             // main headline
  body?: string;             // optional supporting line
  stats?: { value: string; label: string }[];  // 0–3 pills
  cta?: { label: string; route: string };      // floor cards mostly
};

export type InsightContext = {
  foodLogs: FoodLog[];
  activityLogs: ActivityLog[];
  sideEffectLogs: SideEffectLog[];
  injectionLogs: InjectionLog[];
  hk: {
    enabled: boolean;
    steps: number | null;
    sleepHours: number | null;
    hrv: number | null;
    restingHR: number | null;
  };
  targets: DailyTargets;
  todayStr: string;          // YYYY-MM-DD local
};

type Generator = (ctx: InsightContext) => InsightCard | null;

const STRENGTH_RANK: Record<InsightStrength, number> = {
  correlation: 100,
  trend: 50,
  baseline: 20,
  floor: 1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_MS = 86400000;
const BLUE = '#5B8BF5';
const GREEN = '#27AE60';
const YELLOW = '#F6CB45';
const PURPLE = '#C084FC';

function localDateOf(iso: string): string {
  return iso.slice(0, 10);
}

function daysAgo(iso: string, refMs: number): number {
  const t = new Date(iso).getTime();
  return Math.floor((refMs - t) / DAY_MS);
}

function uniqueDaysInWindow<T extends { logged_at?: string | null; date?: string | null }>(
  rows: T[],
  windowDays: number,
  refMs: number,
  getDate: (r: T) => string | null,
): Set<string> {
  const cutoff = refMs - windowDays * DAY_MS;
  const out = new Set<string>();
  for (const r of rows) {
    const d = getDate(r);
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isFinite(t) && t >= cutoff) out.add(d.slice(0, 10));
  }
  return out;
}

// ─── Generators ───────────────────────────────────────────────────────────────

// 1) Correlation: surface the single strongest food↔symptom finding (if any).
const topNutritionPattern: Generator = (ctx) => {
  const res = computeNutritionPatterns(ctx.foodLogs, ctx.sideEffectLogs, ctx.injectionLogs);
  if (!res.hasEnoughData || res.patterns.length === 0) return null;
  const p = res.patterns[0];
  const moreOrLess = p.delta > 0 ? 'more' : 'less';
  const pct = Math.abs(Math.round(p.delta * 100));
  return {
    id: `pattern:${p.triggerKey}:${p.effectType}`,
    strength: 'correlation',
    rank: STRENGTH_RANK.correlation + Math.min(20, pct),  // bigger delta ranks higher
    icon: 'BarChart3',
    iconColor: PURPLE,
    tagline: 'PATTERN',
    title: `${p.effectLabel} was ${pct}% ${moreOrLess} frequent`,
    body: `On ${p.triggerLabel.toLowerCase()} days vs non-${p.triggerLabel.toLowerCase()} days, over the last 30 days.`,
    stats: [
      { value: `${Math.round(p.pctWith * 100)}%`, label: `with ${p.triggerLabel.toLowerCase()}` },
      { value: `${Math.round(p.pctWithout * 100)}%`, label: 'without' },
    ],
  };
};

// 2) Trend: protein average — last 7d vs prior 7d.
const proteinTrend: Generator = (ctx) => {
  const refMs = new Date(ctx.todayStr + 'T12:00:00').getTime();
  const cutoff14 = refMs - 14 * DAY_MS;
  const cutoff7 = refMs - 7 * DAY_MS;
  const byDay = new Map<string, number>();
  for (const f of ctx.foodLogs) {
    if (!f.logged_at) continue;
    const t = new Date(f.logged_at).getTime();
    if (!Number.isFinite(t) || t < cutoff14) continue;
    const d = localDateOf(f.logged_at);
    byDay.set(d, (byDay.get(d) ?? 0) + (f.protein_g ?? 0));
  }
  const recent: number[] = [];
  const prior: number[] = [];
  for (const [d, g] of byDay) {
    const t = new Date(d + 'T12:00:00').getTime();
    if (t >= cutoff7) recent.push(g);
    else prior.push(g);
  }
  if (recent.length < 3 || prior.length < 3) return null;
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
  if (priorAvg === 0) return null;
  const delta = (recentAvg - priorAvg) / priorAvg;
  if (Math.abs(delta) < 0.10) return null;  // suppress noise
  const up = delta > 0;
  const pct = Math.round(Math.abs(delta) * 100);
  return {
    id: 'trend:protein',
    strength: 'trend',
    rank: STRENGTH_RANK.trend + Math.min(20, pct / 2),
    icon: up ? 'trending-up' : 'trending-down',
    iconColor: up ? GREEN : YELLOW,
    tagline: 'PROTEIN TREND',
    title: `Protein ${up ? 'up' : 'down'} ${pct}% this week`,
    body: `Avg ${Math.round(recentAvg)}g/day vs ${Math.round(priorAvg)}g/day prior. ${up ? 'Keep it going. Protein protects lean mass.' : 'Lean mass loss is a key GLP-1 risk; aim for your target.'}`,
    stats: [
      { value: `${Math.round(recentAvg)}g`, label: 'this week' },
      { value: `${Math.round(priorAvg)}g`, label: 'last week' },
      { value: `${ctx.targets.proteinG}g`, label: 'target' },
    ],
  };
};

// 3) Trend: step-goal hit streak (HK or activity logs).
const stepGoalStreak: Generator = (ctx) => {
  if (!ctx.hk.enabled) return null;
  // Use activity_logs for historical steps, which is what fetchInsightsData populates.
  // Hit means meeting target.steps on a given day.
  const target = ctx.targets.steps;
  if (!target || target <= 0) return null;
  const refMs = new Date(ctx.todayStr + 'T12:00:00').getTime();
  const byDay = new Map<string, number>();
  for (const a of ctx.activityLogs) {
    if (!a.date) continue;
    byDay.set(a.date, Math.max(byDay.get(a.date) ?? 0, a.steps ?? 0));
  }
  let streak = 0;
  for (let i = 0; i < 14; i++) {
    const d = new Date(refMs - i * DAY_MS);
    const ds = d.toISOString().slice(0, 10);
    const s = byDay.get(ds) ?? 0;
    // Allow today to count via the live HK value too
    const effective = i === 0 ? Math.max(s, ctx.hk.steps ?? 0) : s;
    if (effective >= target) streak++;
    else break;
  }
  if (streak < 2) return null;
  return {
    id: 'trend:step-streak',
    strength: 'trend',
    rank: STRENGTH_RANK.trend + Math.min(20, streak * 2),
    icon: 'Footprints',
    iconColor: ORANGE,
    tagline: 'ACTIVITY STREAK',
    title: `${streak}-day step goal streak`,
    body: `You've hit ${target.toLocaleString()} steps ${streak} day${streak === 1 ? '' : 's'} in a row.`,
    stats: [
      { value: streak.toString(), label: 'days in a row' },
      { value: target.toLocaleString(), label: 'daily target' },
    ],
  };
};

// 4) Trend: sleep getting shorter — last 7d vs prior 7d (HK only).
const sleepShorteningTrend: Generator = (ctx) => {
  // Without per-day sleep history in this context we can only react to "now".
  // Skip silently if no sleep data — baseline sleepAvg covers single-value display.
  return null;
};

// ─── Baseline ─────────────────────────────────────────────────────────────────

// 5) Baseline: protein average this week (always interesting when logged).
const proteinAvg: Generator = (ctx) => {
  const refMs = new Date(ctx.todayStr + 'T12:00:00').getTime();
  const cutoff = refMs - 7 * DAY_MS;
  const byDay = new Map<string, number>();
  for (const f of ctx.foodLogs) {
    if (!f.logged_at) continue;
    const t = new Date(f.logged_at).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    const d = localDateOf(f.logged_at);
    byDay.set(d, (byDay.get(d) ?? 0) + (f.protein_g ?? 0));
  }
  if (byDay.size < 2) return null;
  const days = Array.from(byDay.values());
  const avg = Math.round(days.reduce((s, v) => s + v, 0) / days.length);
  const target = ctx.targets.proteinG;
  const pctOfTarget = target > 0 ? Math.round((avg / target) * 100) : 0;
  return {
    id: 'baseline:protein-avg',
    strength: 'baseline',
    rank: STRENGTH_RANK.baseline,
    icon: 'Utensils',
    iconColor: ORANGE,
    tagline: 'PROTEIN AVERAGE',
    title: `${avg}g protein/day this week`,
    body: `That's ${pctOfTarget}% of your ${target}g target across ${byDay.size} logged day${byDay.size === 1 ? '' : 's'}.`,
    stats: [
      { value: `${avg}g`, label: 'avg/day' },
      { value: `${pctOfTarget}%`, label: 'of target' },
    ],
  };
};

// 6) Baseline: steps average this week.
const stepsAvg: Generator = (ctx) => {
  if (!ctx.hk.enabled) return null;
  const refMs = new Date(ctx.todayStr + 'T12:00:00').getTime();
  const cutoff = refMs - 7 * DAY_MS;
  const samples: number[] = [];
  for (const a of ctx.activityLogs) {
    if (!a.date) continue;
    const t = new Date(a.date + 'T12:00:00').getTime();
    if (Number.isFinite(t) && t >= cutoff && (a.steps ?? 0) > 0) samples.push(a.steps);
  }
  if (samples.length < 3) return null;
  const avg = Math.round(samples.reduce((s, v) => s + v, 0) / samples.length);
  const target = ctx.targets.steps;
  return {
    id: 'baseline:steps-avg',
    strength: 'baseline',
    rank: STRENGTH_RANK.baseline,
    icon: 'Footprints',
    iconColor: BLUE,
    tagline: 'STEPS AVERAGE',
    title: `${avg.toLocaleString()} steps/day`,
    body: target > 0
      ? `Across ${samples.length} day${samples.length === 1 ? '' : 's'} this week. Your daily target is ${target.toLocaleString()}.`
      : `Across ${samples.length} day${samples.length === 1 ? '' : 's'} this week.`,
    stats: [
      { value: avg.toLocaleString(), label: 'avg/day' },
      ...(target > 0 ? [{ value: target.toLocaleString(), label: 'target' }] : []),
    ],
  };
};

// 7) Baseline: top side effect by frequency in last 30d.
const topSideEffect: Generator = (ctx) => {
  const refMs = new Date(ctx.todayStr + 'T12:00:00').getTime();
  const cutoff = refMs - 30 * DAY_MS;
  const counts = new Map<string, Set<string>>();
  for (const s of ctx.sideEffectLogs) {
    if (!s.logged_at) continue;
    const t = new Date(s.logged_at).getTime();
    if (!Number.isFinite(t) || t < cutoff) continue;
    const key = s.effect_type as string;
    const set = counts.get(key) ?? new Set<string>();
    set.add(s.logged_at.slice(0, 10));
    counts.set(key, set);
  }
  if (counts.size === 0) return null;
  let topKey = '';
  let topDays = 0;
  for (const [k, set] of counts) {
    if (set.size > topDays) { topKey = k; topDays = set.size; }
  }
  if (topDays < 2) return null;
  const labelMap: Record<string, string> = {
    nausea: 'Nausea', vomiting: 'Vomiting', fatigue: 'Fatigue',
    constipation: 'Constipation', diarrhea: 'Diarrhea', headache: 'Headache',
    injection_site: 'Injection-site soreness', appetite_loss: 'Low appetite',
    hair_loss: 'Hair loss', dehydration: 'Dehydration', dizziness: 'Dizziness',
    muscle_loss: 'Muscle loss', heartburn: 'Heartburn', food_noise: 'Food noise',
    sulfur_burps: 'Sulfur burps', bloating: 'Bloating', other: 'Other',
  };
  const label = labelMap[topKey] ?? topKey;
  return {
    id: 'baseline:top-side-effect',
    strength: 'baseline',
    rank: STRENGTH_RANK.baseline - 1,
    icon: 'HeartPulse',
    iconColor: YELLOW,
    tagline: 'MOST FREQUENT SYMPTOM',
    title: `${label}: ${topDays} day${topDays === 1 ? '' : 's'} this month`,
    body: 'Patterns often emerge around shot timing or specific foods. Log consistently to surface what triggers it.',
  };
};

// ─── Floor ────────────────────────────────────────────────────────────────────

// 8) Floor: connect Apple Health (only if not enabled).
const connectAppleHealth: Generator = (ctx) => {
  if (ctx.hk.enabled) return null;
  return {
    id: 'floor:connect-health',
    strength: 'floor',
    rank: STRENGTH_RANK.floor + 2,
    icon: 'Heart',
    iconColor: '#E74C3C',
    tagline: 'UNLOCK MORE INSIGHTS',
    title: 'Connect Apple Health',
    body: 'Sync steps, sleep, HRV, and resting heart rate. GLP-1s measurably affect all of these.',
    cta: { label: 'Connect', route: '/settings' },
  };
};

// 9) Floor: log a meal — only if no food logs in last 3 days.
const logMealCta: Generator = (ctx) => {
  const refMs = new Date(ctx.todayStr + 'T12:00:00').getTime();
  const recent = ctx.foodLogs.filter(f => {
    if (!f.logged_at) return false;
    const t = new Date(f.logged_at).getTime();
    return Number.isFinite(t) && refMs - t < 3 * DAY_MS;
  });
  if (recent.length > 0) return null;
  return {
    id: 'floor:log-meal',
    strength: 'floor',
    rank: STRENGTH_RANK.floor + 1,
    icon: 'Utensils',
    iconColor: ORANGE,
    tagline: 'GET STARTED',
    title: 'Log a meal to unlock protein insights',
    body: 'Lean-mass loss is the top risk on GLP-1s. Tracking protein helps you stay on the right side of the data.',
    cta: { label: 'Log food', route: '/entry/log-food' },
  };
};

// 10) Floor: rotating GLP-1 educational tip.
const TIPS: { title: string; body: string }[] = [
  {
    title: '26–40% of GLP-1 weight loss is lean mass',
    body: 'Protein and resistance training are the strongest defenses. Aim for ≥1.6g/kg body weight daily.',
  },
  {
    title: 'GLP-1s lower HRV by ~6ms in the first 12 weeks',
    body: 'That\'s a measurable autonomic shift, not a bug. Your body is adapting.',
  },
  {
    title: 'Hydration matters more on GLP-1s',
    body: 'Reduced thirst sensation + slower gastric emptying = easy to under-drink. Aim for clear urine before dinner.',
  },
  {
    title: 'Fiber smooths GLP-1 side effects',
    body: '25–30g/day helps with constipation and improves satiety beyond what the drug does alone.',
  },
  {
    title: '60% of weight loss is regained within 18 months of stopping',
    body: 'The habits you build now, not the drug, are what protect the loss long-term.',
  },
];
const glp1Tip: Generator = (ctx) => {
  // Deterministic by day so it doesn't shuffle on every render.
  const seed = ctx.todayStr.split('-').join('');
  const idx = Number(seed) % TIPS.length;
  const tip = TIPS[idx] ?? TIPS[0];
  return {
    id: `floor:tip:${idx}`,
    strength: 'floor',
    rank: STRENGTH_RANK.floor,
    icon: 'bulb-outline',
    iconColor: YELLOW,
    tagline: 'GLP-1 TIP',
    title: tip.title,
    body: tip.body,
  };
};

// ─── Pipeline ─────────────────────────────────────────────────────────────────

const GENERATORS: Generator[] = [
  topNutritionPattern,
  proteinTrend,
  stepGoalStreak,
  sleepShorteningTrend,
  proteinAvg,
  stepsAvg,
  topSideEffect,
  connectAppleHealth,
  logMealCta,
  glp1Tip,
];

const MAX_CARDS = 5;

export function runLifestylePipeline(ctx: InsightContext): InsightCard[] {
  const candidates: InsightCard[] = [];
  for (const gen of GENERATORS) {
    try {
      const card = gen(ctx);
      if (card) candidates.push(card);
    } catch {
      // Defensive — a single broken generator must never break the whole carousel.
    }
  }
  candidates.sort((a, b) => b.rank - a.rank);

  // Promote a floor card if we'd otherwise have fewer than 2 cards total.
  const real = candidates.filter(c => c.strength !== 'floor');
  const floors = candidates.filter(c => c.strength === 'floor');
  const picked: InsightCard[] = [...real.slice(0, MAX_CARDS)];
  if (picked.length < 2 && floors.length > 0) {
    picked.push(...floors.slice(0, MAX_CARDS - picked.length));
  } else if (picked.length === 0) {
    // Last-resort floor — guaranteed at least the GLP-1 tip.
    picked.push(...floors.slice(0, 1));
  }
  return picked.slice(0, MAX_CARDS);
}
