// ─── Target Adjustment Rationale + Sources ────────────────────────────────────
// Plain-language "why" + clinical citations for each daily target, surfaced in the
// "Why these changes?" disclosure whenever we adjust a user's targets (medication
// changes, side-effect logs, weekly check-ins).
//
// These mirror the same evidence base the targets engine is built on:
//   constants/scoring.ts  (getDailyTargets) and lib/targets.ts (computeBaseTargets).
//
// ⚠️  MEDICAL REVIEW: citation labels/descriptions below should be reviewed for
//     accuracy before public release — they are pulled from the sources already
//     referenced in the targets engine, not independently re-verified here.

export type TargetCitation = { label: string; shortDesc: string };

export type TargetRationale = {
  /** One-line, plain-language reason this target is set the way it is. */
  rationale: string;
  /** Clinical sources backing the rationale. */
  citations: TargetCitation[];
};

// Canonical target labels match the `TargetDiff.label` values produced in
// edit-treatment.tsx (Calories, Protein, Water, Fiber, Steps, Carbs, Fat, Active Cal).
export const TARGET_RATIONALE: Record<string, TargetRationale> = {
  Protein: {
    rationale:
      'Set to preserve lean muscle while GLP-1 suppresses appetite, scaled to your body weight, dose, and treatment phase (1.2–1.6 g/kg/day).',
    citations: [
      { label: '2025 ACLM/ASN/OMA/TOS Joint Advisory', shortDesc: '≥1.2 g/kg/day protein to preserve lean mass on GLP-1 therapy' },
      { label: 'PMC12536186', shortDesc: 'Lean mass preservation on GLP-1/GIP receptor agonists' },
    ],
  },
  Calories: {
    rationale:
      'Estimated from your body metrics (Mifflin–St Jeor energy equation) minus a deficit matched to your weekly loss goal. Treated as a floor, not a restriction.',
    citations: [
      { label: 'Mifflin–St Jeor (Am J Clin Nutr, 1990)', shortDesc: 'Most-validated resting energy expenditure equation' },
    ],
  },
  Carbs: {
    rationale:
      'Fills the calories remaining after protein and fat are set, so when your protein target shifts, carbs adjust to keep your overall energy balanced.',
    citations: [
      { label: '2025 ACLM/ASN/OMA/TOS Joint Advisory', shortDesc: 'Macronutrient priorities for GLP-1 therapy' },
    ],
  },
  Fat: {
    rationale:
      'Set to roughly 28% of your daily calories, a balanced mid-range that also limits the GI burden of high-fat meals on GLP-1.',
    citations: [
      { label: '2025 ACLM/ASN/OMA/TOS Joint Advisory', shortDesc: 'Macronutrient priorities for GLP-1 therapy' },
    ],
  },
  Water: {
    rationale:
      'About 30 mL per kg of body weight, the adequate-intake benchmark, which also helps manage common GI side effects and supports medication absorption.',
    citations: [
      { label: 'National Academies DRI (Water & Electrolytes, 2005)', shortDesc: 'Adequate water intake reference (~30 mL/kg/day)' },
    ],
  },
  Fiber: {
    rationale:
      'An achievable daily baseline that supports digestion and satiety during treatment (most adults average well below this).',
    citations: [
      { label: 'Weickert & Pfeiffer (J Nutr, 2018)', shortDesc: 'Dietary fiber, metabolic health, and satiety' },
    ],
  },
  Steps: {
    rationale:
      'Based on your activity level, with a small boost during maintenance to counter the metabolic adaptation that follows weight loss.',
    citations: [
      { label: 'Physical Activity Guidelines for Americans, 2nd ed. (2018)', shortDesc: 'Daily movement recommendations for adults' },
    ],
  },
  'Active Cal': {
    rationale:
      'Your daily active-calorie burn target, eased during dose escalation when capacity is lower, and raised at maintenance to protect progress.',
    citations: [
      { label: 'Physical Activity Guidelines for Americans, 2nd ed. (2018)', shortDesc: 'Daily movement recommendations for adults' },
    ],
  },
};

/** Normalizes the various label spellings used across screens to the canonical key. */
export function resolveTargetRationale(label: string): TargetRationale | undefined {
  const normalized = label.replace(/^Daily\s+/i, '').trim();
  const alias: Record<string, string> = {
    'Active Calories': 'Active Cal',
    'Active Cal': 'Active Cal',
  };
  return TARGET_RATIONALE[alias[normalized] ?? normalized];
}
