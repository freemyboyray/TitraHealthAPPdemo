// ─── Medical Sources & Citations ─────────────────────────────────────────────
// Centralized references for all health claims made in the app.
// Apple App Store Guideline 1.4.1 requires that medical information
// presented to users is backed by credible, published sources.
//
// These citations are displayed in disclaimers and info popovers throughout
// the app so users can verify claims with their healthcare provider.

export const MEDICAL_SOURCES = {
  // ── Pharmacokinetic parameters ──────────────────────────────────────────────
  semaglutide_pk: {
    label: 'Semaglutide SC pharmacokinetics',
    citation: 'FDA NDA 209637 (Ozempic); Wegovy prescribing information. Half-life ~160 h, Tmax ~56 h.',
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=adec4fd2-6858-4c99-91d4-531f5f2a2d79',
  },
  tirzepatide_pk: {
    label: 'Tirzepatide SC pharmacokinetics',
    citation: 'FDA NDA 215866 (Mounjaro/Zepbound); prescribing information. Half-life ~120 h, Tmax ~24 h.',
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=d2d7da5d-ad07-4228-955f-cf7e355c8cc0',
  },
  dulaglutide_pk: {
    label: 'Dulaglutide SC pharmacokinetics',
    citation: 'FDA BLA 125469 (Trulicity); prescribing information. Half-life ~120 h, Tmax ~48 h.',
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=463050bd-2b1c-40f5-b3c3-0a04bb433309',
  },
  liraglutide_pk: {
    label: 'Liraglutide SC pharmacokinetics',
    citation: 'FDA NDA 206321 (Saxenda); prescribing information. Half-life ~13 h, Tmax ~11 h.',
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=3946d389-0926-4f77-a708-0acb8153b143',
  },
  oral_semaglutide_pk: {
    label: 'Oral semaglutide pharmacokinetics',
    citation: 'FDA NDA 213051 (Rybelsus); prescribing information. Half-life ~158 h, Tmax ~1 h (SNAC-mediated).',
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=27f15fac-7d98-4114-a2ec-92494a91da98',
  },

  // ── Clinical trials (weight loss benchmarks) ───────────────────────────────
  step1_trial: {
    label: 'STEP 1:Semaglutide 2.4 mg',
    citation: 'Wilding JPH, et al. Once-weekly semaglutide in adults with overweight or obesity. N Engl J Med. 2021;384(11):989-1002.',
    url: 'https://doi.org/10.1056/NEJMoa2032183',
  },
  surmount1_trial: {
    label: 'SURMOUNT-1:Tirzepatide',
    citation: 'Jastreboff AM, et al. Tirzepatide once weekly for the treatment of obesity. N Engl J Med. 2022;387(3):205-216.',
    url: 'https://doi.org/10.1056/NEJMoa2206038',
  },
  scale_trial: {
    label: 'SCALE:Liraglutide 3.0 mg',
    citation: 'Pi-Sunyer X, et al. A randomized, controlled trial of 3.0 mg of liraglutide in weight management. N Engl J Med. 2015;373(1):11-22.',
    url: 'https://doi.org/10.1056/NEJMoa1411892',
  },
  award2_trial: {
    label: 'AWARD-2:Dulaglutide',
    citation: 'Giorgino F, et al. Efficacy and safety of once-weekly dulaglutide versus insulin glargine. Diabetes Care. 2015;38(12):2241-2249.',
    url: 'https://doi.org/10.2337/dc14-1625',
  },

  // ── Nutrition & protein targets ────────────────────────────────────────────
  protein_glp1: {
    label: 'Protein intake during GLP-1 therapy',
    citation: 'Mechanick JI, et al. Clinical practice guidelines for the perioperative nutrition, metabolic, and nonsurgical support of patients undergoing bariatric procedures. Obesity. 2013;21(S1):S1-S27. Protein range: 1.0-1.6 g/kg/day recommended to preserve lean mass during pharmacotherapy-induced weight loss.',
    url: 'https://doi.org/10.1002/oby.20461',
  },
  aclm_macros: {
    label: 'Macronutrient distribution',
    citation: 'American College of Lifestyle Medicine (ACLM). Position statement on dietary patterns for health. 2025.',
    url: 'https://lifestylemedicine.org',
  },

  // ── Hydration ─────────────────────────────────────────────────────────────
  hydration_baseline: {
    label: 'Hydration recommendations',
    citation: 'National Academies of Sciences, Engineering, and Medicine. Dietary Reference Intakes for Water. ~30 mL/kg/day adequate intake for adults.',
    url: 'https://doi.org/10.17226/10925',
  },

  // ── Sleep & GLP-1 interaction ──────────────────────────────────────────────
  sleep_glp1: {
    label: 'Sleep and GLP-1 appetite control',
    citation: 'Spiegel K, et al. Brief communication: Sleep curtailment in healthy young men is associated with decreased leptin levels, elevated ghrelin levels, and increased hunger and appetite. Ann Intern Med. 2004;141(11):846-850.',
    url: 'https://doi.org/10.7326/0003-4819-141-11-200412070-00008',
  },

  // ── HRV & cardiovascular effects ──────────────────────────────────────────
  glp1_hrv: {
    label: 'GLP-1 RA cardiovascular autonomic effects',
    citation: 'Smits MM, et al. Heart rate acceleration with GLP-1 receptor agonists in type 2 diabetes patients: an acute and 12-week randomised, double-blind, placebo-controlled trial. Eur J Endocrinol. 2017;176(1):77-86.',
    url: 'https://doi.org/10.1530/EJE-16-0507',
  },

  // ── Lean mass preservation ────────────────────────────────────────────────
  lean_mass_glp1: {
    label: 'Lean mass loss during GLP-1 weight loss',
    citation: 'Wilding JPH, et al. STEP 1 Trial: body composition analysis. Approximately 39% of weight lost was lean mass. Adequate protein and resistance training recommended.',
    url: 'https://doi.org/10.1056/NEJMoa2032183',
  },

  // ── Fiber & GLP-1 mechanism ───────────────────────────────────────────────
  fiber_gastric: {
    label: 'Fiber and gastric emptying',
    citation: 'Weickert MO, Pfeiffer AFH. Impact of dietary fiber consumption on insulin resistance and the prevention of type 2 diabetes. J Nutr. 2018;148(1):7-12.',
    url: 'https://doi.org/10.1093/jn/nxx008',
  },

  // ── Activity & GLP-1 receptor expression ──────────────────────────────────
  exercise_glp1: {
    label: 'Exercise and GLP-1 appetite regulation',
    citation: 'Blundell JE, et al. Appetite control and energy balance: impact of exercise. Obes Rev. 2015;16(Suppl 1):67-76.',
    url: 'https://doi.org/10.1111/obr.12257',
  },
} as const;

// ─── Disclaimer text shown alongside medical content ─────────────────────────

export const MEDICAL_DISCLAIMER =
  'This information is for educational purposes only and is not medical advice. ' +
  'Always consult your prescribing physician before making changes to your treatment.';

export const PK_DISCLAIMER =
  'Pharmacokinetic estimates are based on prescribing information and published population-PK models. ' +
  'Individual drug levels vary based on injection site, body composition, and other factors.';

export const NUTRITION_DISCLAIMER =
  'Nutrition targets are based on published clinical guidelines for patients on GLP-1 receptor agonist therapy. ' +
  'Your healthcare provider may recommend different targets based on your individual needs.';

export const WEIGHT_PROJECTION_DISCLAIMER =
  'Weight projections are based on published clinical trial averages and your personal trend data. ' +
  'Individual results vary significantly. These projections are not a guarantee of outcomes.';

// ─── Helper to build a compact citation line for UI display ─────────────────

export function citationLine(
  key: keyof typeof MEDICAL_SOURCES,
): string {
  const src = MEDICAL_SOURCES[key];
  return `Source: ${src.citation}`;
}
