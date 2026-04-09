// ─── Smart Side Effect Context ──────────────────────────────────────────────
// Provides contextual messaging based on how long the user has been on their
// current dose, helping distinguish expected adjustment-period side effects
// from ones worth flagging to a provider.
//
// Evidence: GLP-1 GI side effects peak in weeks 1-4 of each dose escalation
// and typically resolve by week 8 (PMC9821052, PMC11668918).

export type SideEffectContextMessage = {
  effect: string;
  message: string;
  severity: 'expected' | 'watch' | 'flag';
};

// Which effects are commonly dose-onset related (GI + fatigue cluster)
const DOSE_ONSET_EFFECTS = new Set([
  'nausea', 'vomiting', 'diarrhea', 'constipation',
  'bloating', 'heartburn', 'fatigue', 'headache',
  'appetite_loss', 'sulfur_burps',
]);

// Effects that should always be flagged regardless of timing
const ALWAYS_FLAG_EFFECTS = new Set([
  'pancreatitis', 'thyroid', 'allergic_reaction', 'kidney',
]);

/**
 * Returns contextual guidance for a side effect based on how long the user
 * has been on their current dose.
 *
 * @param effect - The side effect type (e.g. 'nausea', 'constipation')
 * @param doseStartDate - YYYY-MM-DD string of when the current dose started
 * @param isNewDrug - Whether the user recently switched drug types (not just dose)
 */
export function getSideEffectContext(
  effect: string,
  doseStartDate: string | null | undefined,
  isNewDrug?: boolean,
): SideEffectContextMessage | null {
  if (!doseStartDate) return null;

  const start = new Date(doseStartDate + 'T00:00:00');
  const now = new Date();
  const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const weeksSinceStart = Math.floor(daysSinceStart / 7);

  // Always-flag effects get provider guidance regardless of timing
  if (ALWAYS_FLAG_EFFECTS.has(effect)) {
    return {
      effect,
      message: 'This symptom should be discussed with your provider.',
      severity: 'flag',
    };
  }

  // Non-dose-onset effects don't get timing context
  if (!DOSE_ONSET_EFFECTS.has(effect)) return null;

  const drugContext = isNewDrug ? 'new medication' : 'current dose';

  if (weeksSinceStart <= 2) {
    return {
      effect,
      message: `Common in the first 2 weeks of a ${drugContext}. Usually improves as your body adjusts.`,
      severity: 'expected',
    };
  }

  if (weeksSinceStart <= 4) {
    return {
      effect,
      message: `Can persist for up to 4 weeks on a ${drugContext}. If it's affecting your daily life, mention it at your next visit.`,
      severity: 'expected',
    };
  }

  if (weeksSinceStart <= 8) {
    return {
      effect,
      message: `At ${weeksSinceStart} weeks on your ${drugContext}, this should be improving. Consider mentioning it to your provider if it's not.`,
      severity: 'watch',
    };
  }

  // Beyond 8 weeks — unusual, worth flagging
  return {
    effect,
    message: `Persisting beyond 8 weeks on your ${drugContext} is unusual. Discuss with your provider — they may adjust your dose.`,
    severity: 'flag',
  };
}

/**
 * Determines if the user recently switched drugs (vs just a dose change)
 * by checking the medication_changes table. Returns true if the most recent
 * change was a drug_type switch.
 */
export function isRecentDrugSwitch(
  doseStartDate: string | null | undefined,
  lastChangeType?: string | null,
): boolean {
  if (!doseStartDate || !lastChangeType) return false;
  return lastChangeType === 'drug_type';
}
