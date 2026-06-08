import type { ShotPhase, IntradayPhase } from '@/constants/scoring';

/**
 * Warm, human-facing copy for the home hero card. This deliberately does NOT
 * reuse the clinical PHASE_DESCRIPTIONS (those are too technical for a hero) —
 * it turns the already-computed dosing phase + weight progress into a short
 * message that speaks to the user, like the RISE / Gentler Streak home cards.
 *
 * Keep headlines short (wraps to ~2 lines) and subtext to a single line.
 */

export type HomeHeadline = { headline: string; subtext?: string };

type TransitionPhase = 'none' | 'old_med' | 'washout' | 'new_med_ready';

// Default per-phase copy for an injectable weekly/biweekly cycle.
const SHOT_COPY: Record<ShotPhase, HomeHeadline> = {
  shot: { headline: 'Fresh cycle ahead', subtext: 'Shot day. Hydrate and rotate your site.' },
  peak: { headline: "You're in your strongest window", subtext: 'Appetite control peaks now. Lean on protein.' },
  balance: { headline: 'Steady and strong', subtext: 'Stable levels, a great window to move.' },
  reset: { headline: 'Hunger may creep back', subtext: 'Levels are tapering. Plan meals, stay consistent.' },
};

// Default per-phase copy for daily / oral drugs (intraday rhythm).
const INTRADAY_COPY: Record<IntradayPhase, HomeHeadline> = {
  post_dose: { headline: 'Settling in', subtext: 'Your dose is absorbing. Give it a little time.' },
  peak: { headline: "You're in your strongest window", subtext: 'Peak effect now. Lean on protein-rich meals.' },
  trough: { headline: 'Hunger may creep back', subtext: 'Approaching the trough. Protein keeps you steady.' },
};

export type HomeHeadlineInput = {
  shotPhase: ShotPhase;
  intradayPhase: IntradayPhase | null;
  transitionPhase: TransitionPhase;
  oral: boolean;
  daysUntil: number;
  rawDaysUntil: number | null; // negative = overdue
  todayInjLogged: boolean;
  weightDelta: number | null; // negative = loss
  pctToGoal: number | null;
  hasLoggedDose: boolean; // false until the first shot/dose is logged
  isToday: boolean; // false when viewing a past/future day
};

export function getHomeHeadline(input: HomeHeadlineInput): HomeHeadline {
  const {
    shotPhase, intradayPhase, transitionPhase, oral,
    rawDaysUntil, todayInjLogged, weightDelta, pctToGoal,
    hasLoggedDose, isToday,
  } = input;

  const lostLbs = weightDelta != null && weightDelta < 0 ? Math.round(-weightDelta) : 0;
  const doseWord = oral ? 'dose' : 'shot';

  // The everyday phase message — also used as fallback subtext for special states.
  const base = oral && intradayPhase ? INTRADAY_COPY[intradayPhase] : SHOT_COPY[shotPhase];

  // 1. Switching meds — calm reset state (highest priority).
  if (transitionPhase === 'washout') {
    return { headline: 'Transitioning meds', subtext: 'A calm reset between medications.' };
  }

  // Past / future days just reflect that day's phase — no "today" prompts.
  if (!isToday) return base;

  // 2. Haven't started yet.
  if (!hasLoggedDose) {
    return {
      headline: "Let's get started",
      subtext: `Log your first ${doseWord} to begin tracking.`,
    };
  }

  // 3. Goal reached.
  if (pctToGoal != null && pctToGoal >= 100) {
    return { headline: 'Goal reached 🎉', subtext: 'Incredible work. Time to set what’s next.' };
  }

  // 4. Dose timing prompts.
  const isOverdue = !todayInjLogged && rawDaysUntil != null && rawDaysUntil < 0;
  const isDoseDay = !todayInjLogged && rawDaysUntil === 0;
  if (isOverdue) {
    return {
      headline: oral ? 'Your dose is due' : 'Your shot is due',
      subtext: 'Log it when you can to stay on track.',
    };
  }
  if (isDoseDay) {
    return {
      headline: oral ? 'Dose day' : 'Shot day',
      subtext: lostLbs >= 5
        ? `Down ${lostLbs} lbs. Fresh cycle ahead.`
        : (oral ? "Time for today's dose." : 'Time for your shot. Fresh cycle ahead.'),
    };
  }

  // 5. Milestone moment — celebrate meaningful loss while keeping the phase hint.
  if (lostLbs >= 10) {
    return { headline: `Down ${lostLbs} lbs`, subtext: base.subtext };
  }

  // 6. Everyday phase message.
  return base;
}
