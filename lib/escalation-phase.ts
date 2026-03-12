// ─── Escalation Phase Engine ─────────────────────────────────────────────────
// Maps current dose + program week to a named clinical phase with coaching data.
// Pure TypeScript — no React/Supabase dependencies.

import type { Glp1Type } from '@/constants/user-profile';

export type EscalationPhaseName =
  | 'initiation'
  | 'low_therapeutic'
  | 'mid_therapeutic'
  | 'high_therapeutic'
  | 'high_plus'
  | 'max_dose';

export type EscalationPhase = {
  name: EscalationPhaseName;
  displayName: string;
  programWeek: number;
  weeklyFocus: string;
  behavioralEmphasis: string[];
  isPlasticityWindow: boolean; // weeks 5–16
  expectedDoseMg: number;      // typical dose for this week + medication
  isAcceleratedEscalator: boolean;
  isSlowTitrator: boolean;
};

// ─── Dose phase tables ────────────────────────────────────────────────────────

type PhaseRow = {
  name: EscalationPhaseName;
  displayName: string;
  minDoseMg: number;
  maxDoseMg: number;
  expectedWeekStart: number;
  expectedWeekEnd: number;
  weeklyFocus: string;
  behavioralEmphasis: string[];
};

const SEMA_PHASES: PhaseRow[] = [
  {
    name: 'initiation',
    displayName: 'Initiation Phase',
    minDoseMg: 0, maxDoseMg: 0.5,
    expectedWeekStart: 1, expectedWeekEnd: 4,
    weeklyFocus: 'Build consistent injection habits and identify any early GI tolerance patterns.',
    behavioralEmphasis: [
      'Log every injection on the same day each week',
      'Start protein-forward eating to establish the habit early',
      'Note any nausea triggers — they inform titration speed',
    ],
  },
  {
    name: 'low_therapeutic',
    displayName: 'Low Therapeutic',
    minDoseMg: 0.5, maxDoseMg: 1.0,
    expectedWeekStart: 5, expectedWeekEnd: 8,
    weeklyFocus: 'Appetite suppression is beginning — harness it to hit protein targets consistently.',
    behavioralEmphasis: [
      'Use reduced appetite as a window to practice portion control',
      'Hit 7–8h sleep — GLP-1 appetite control is blunted by poor sleep',
      'Introduce resistance exercise if not already doing it',
    ],
  },
  {
    name: 'mid_therapeutic',
    displayName: 'Mid Therapeutic',
    minDoseMg: 1.0, maxDoseMg: 1.7,
    expectedWeekStart: 9, expectedWeekEnd: 12,
    weeklyFocus: 'Peak habit plasticity — changes made now are most likely to stick long-term.',
    behavioralEmphasis: [
      'Focus on protein and movement — lean mass protection is critical at this dose',
      "Track food noise score weekly — it's a pharmacodynamic marker",
      'Build the behavioral habits that will sustain after medication ends',
    ],
  },
  {
    name: 'high_therapeutic',
    displayName: 'High Therapeutic',
    minDoseMg: 1.7, maxDoseMg: 2.4,
    expectedWeekStart: 13, expectedWeekEnd: 16,
    weeklyFocus: 'Maximize lean mass protection and establish sustainable eating patterns.',
    behavioralEmphasis: [
      'Protein target is highest here — prioritize it above all other nutrition',
      'Consider body composition assessment if available',
      'Monitor iron and vitamin D labs this week (schedule if not done)',
    ],
  },
  {
    name: 'max_dose',
    displayName: 'Maintenance Dose',
    minDoseMg: 2.4, maxDoseMg: Infinity,
    expectedWeekStart: 17, expectedWeekEnd: 999,
    weeklyFocus: 'Consolidate the behavioral habits built during titration for long-term success.',
    behavioralEmphasis: [
      'Maintain the protein and movement habits established during titration',
      'Monitor for weight plateau — intervention protocols differ at max dose',
      'Focus on the behavioral skills needed for eventual medication tapering',
    ],
  },
];

const TIZE_PHASES: PhaseRow[] = [
  {
    name: 'initiation',
    displayName: 'Initiation Phase',
    minDoseMg: 0, maxDoseMg: 5,
    expectedWeekStart: 1, expectedWeekEnd: 4,
    weeklyFocus: 'Establish injection routine and monitor GI tolerance at the starting dose.',
    behavioralEmphasis: [
      'Log every injection on the same day each week',
      'Start protein-forward eating to establish the habit early',
      'Tirzepatide GI effects can be more pronounced — pace fiber intake',
    ],
  },
  {
    name: 'low_therapeutic',
    displayName: 'Low Therapeutic',
    minDoseMg: 5, maxDoseMg: 7.5,
    expectedWeekStart: 5, expectedWeekEnd: 8,
    weeklyFocus: 'Dual GIP+GLP-1 action is active — leverage appetite suppression for protein habits.',
    behavioralEmphasis: [
      'Dual incretin action is stronger than semaglutide — portions naturally shrink',
      'Protein becomes even more critical to preserve lean mass',
      'Resistance training amplifies tirzepatide\'s insulin sensitivity benefit',
    ],
  },
  {
    name: 'mid_therapeutic',
    displayName: 'Mid Therapeutic',
    minDoseMg: 7.5, maxDoseMg: 10,
    expectedWeekStart: 9, expectedWeekEnd: 12,
    weeklyFocus: 'Peak behavioral plasticity — habits formed now persist after medication ends.',
    behavioralEmphasis: [
      'Tirzepatide mid-dose is associated with the steepest weight loss — track closely',
      'Food noise scores often reach their lowest here — capitalize on the window',
      'Weekly activity logs are key — muscle preservation is a clinical priority',
    ],
  },
  {
    name: 'high_therapeutic',
    displayName: 'High Therapeutic',
    minDoseMg: 10, maxDoseMg: 12.5,
    expectedWeekStart: 13, expectedWeekEnd: 16,
    weeklyFocus: 'Clinical trial outcomes show ~18–20% body weight loss range starting here.',
    behavioralEmphasis: [
      'Protein target is at maximum — do not skip it even if appetite is very low',
      'Iron, vitamin D, and B12 labs due around week 12–16',
      'Early responders at this stage often see plateau onset — prepare behaviorally',
    ],
  },
  {
    name: 'high_plus',
    displayName: 'High+ Dose',
    minDoseMg: 12.5, maxDoseMg: 15,
    expectedWeekStart: 17, expectedWeekEnd: 20,
    weeklyFocus: 'Approaching max dose — focus on behavioral consolidation and plateau management.',
    behavioralEmphasis: [
      'Monitor for plateau — intervention strategies differ at this dose level',
      'Sleep quality is critical — tirzepatide sleep apnea data applies here',
      'Begin planning for eventual maintenance phase behaviors',
    ],
  },
  {
    name: 'max_dose',
    displayName: 'Maintenance Dose',
    minDoseMg: 15, maxDoseMg: Infinity,
    expectedWeekStart: 21, expectedWeekEnd: 999,
    weeklyFocus: 'Maximum clinical efficacy achieved — consolidate habits for lifelong maintenance.',
    behavioralEmphasis: [
      'Sustain the protein, movement, and sleep habits built during titration',
      'Weekly weight tracking remains important for plateau detection',
      'Build the identity-level behaviors that persist after medication ends',
    ],
  },
];

// ─── Expected dose by week ────────────────────────────────────────────────────

function getExpectedDose(programWeek: number, medicationType: Glp1Type): number {
  const phases = medicationType === 'tirzepatide' ? TIZE_PHASES : SEMA_PHASES;
  const phase = phases.find(
    p => programWeek >= p.expectedWeekStart && programWeek <= p.expectedWeekEnd,
  );
  return phase?.minDoseMg ?? (medicationType === 'tirzepatide' ? 2.5 : 0.25);
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function getEscalationPhase(
  programWeek: number,
  doseMg: number,
  medicationType: Glp1Type,
): EscalationPhase {
  const phases = medicationType === 'tirzepatide' ? TIZE_PHASES : SEMA_PHASES;
  const row = phases.find(p => doseMg >= p.minDoseMg && doseMg < p.maxDoseMg)
    ?? phases[phases.length - 1];

  const expectedDoseMg = getExpectedDose(programWeek, medicationType);
  const phasesArray = phases;
  const currentPhaseIdx = phasesArray.indexOf(row);
  const expectedPhaseRow = phasesArray.find(
    p => expectedDoseMg >= p.minDoseMg && expectedDoseMg < p.maxDoseMg,
  ) ?? phasesArray[0];
  const expectedPhaseIdx = phasesArray.indexOf(expectedPhaseRow);

  const isAcceleratedEscalator = currentPhaseIdx > expectedPhaseIdx;
  const isSlowTitrator          = currentPhaseIdx < expectedPhaseIdx;
  const isPlasticityWindow      = programWeek >= 5 && programWeek <= 16;

  return {
    name:                 row.name,
    displayName:          row.displayName,
    programWeek,
    weeklyFocus:          row.weeklyFocus,
    behavioralEmphasis:   row.behavioralEmphasis,
    isPlasticityWindow,
    expectedDoseMg,
    isAcceleratedEscalator,
    isSlowTitrator,
  };
}
