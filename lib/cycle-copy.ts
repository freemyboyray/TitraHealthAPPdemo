// Templated, deterministic "how you're doing in the cycle" coaching copy for the
// home greeting. Driven entirely by the medication cycle position (days until
// the next shot) + dose state — no AI, no cost, offline-safe.
//
// IMPORTANT: this is supportive/educational copy, NOT medical advice. Keep the
// language soft ("usually", "may", "some people") and never prescribe doses,
// diagnose, or tell the user to change their medication.

export type CycleCoach = { headline: string; line: string };

export type CycleCoachInput = {
  onTreatment: boolean;
  oral: boolean;          // oral meds are daily — the weekly rhythm doesn't apply
  daysUntil: number;      // days until the next dose (>= 0, capped)
  todayDosed: boolean;    // already dosed today
  overdueDays: number;    // > 0 when the dose is overdue
  freq: number;           // cycle length in days (e.g. 7 for weekly)
};

/**
 * Returns a short {headline, line} for where the user is in their shot cycle,
 * or null when no coaching line applies (not on treatment, or oral/daily meds).
 */
export function getCycleCoachLine(i: CycleCoachInput): CycleCoach | null {
  if (!i.onTreatment || i.oral) return null;

  const freq = i.freq > 0 ? i.freq : 7;
  const d = Math.max(0, i.daysUntil);

  if (i.overdueDays > 0) {
    return {
      headline: 'Dose Overdue',
      line: `Your dose is ${i.overdueDays} day${i.overdueDays === 1 ? '' : 's'} overdue. Take it when you can, and check timing with your provider if you're unsure.`,
    };
  }
  if (i.todayDosed) {
    return {
      headline: 'Dose Done',
      line: 'The first day or two can bring more nausea. Be gentle with yourself: light meals and plenty of water.',
    };
  }
  if (d <= 0) {
    return {
      headline: 'Dose Day',
      line: "It's time for this week's dose. Pick a fresh injection site and log it when you're done.",
    };
  }
  if (d === 1) {
    return {
      headline: 'Dose Tomorrow',
      line: "Levels are low before tomorrow's dose, so today may feel hungrier. You've got this.",
    };
  }

  const ratio = d / freq; // ~1 just after a dose, ~0 as the next one nears
  if (ratio >= 0.7) {
    return {
      headline: 'Peak Effect',
      line: 'Your medication is near its strongest and appetite is usually lowest. Lean into protein and water while it feels easy.',
    };
  }
  if (ratio >= 0.35) {
    return {
      headline: 'Steady State',
      line: 'Levels are steady and side effects usually settle here. A great stretch to move your body and build your routine.',
    };
  }
  return {
    headline: 'Almost There',
    line: `Hunger may creep back before your next dose in ${d} days. Totally normal, plan ahead and keep going.`,
  };
}
