// ─── Clinical Alert Engine ────────────────────────────────────────────────────
// Generates evidence-based clinical flags based on program week, side effects,
// body composition trends, and behavioral patterns.
// Pure TypeScript — no React/Supabase dependencies.

export type ClinicalFlagType =
  | 'iron_lab_reminder'
  | 'vitamin_d_lab_reminder'
  | 'hair_loss_reassurance'
  | 'plateau_protocol'
  | 'resistance_training'
  | 'lean_mass_alert'
  | 'dropout_risk';

export type ClinicalFlagSeverity = 'info' | 'warning' | 'action_required';

export type ClinicalFlag = {
  type: ClinicalFlagType;
  severity: ClinicalFlagSeverity;
  title: string;
  body: string;
  actionLabel?: string;
  actionRoute?: string;
  dismissible: boolean;
};

type SideEffectEntry = {
  effect_type: string;
  severity: number;
  logged_at: string;
};

export type ClinicalFlagsInput = {
  programWeek: number;
  sideEffectLogs: SideEffectEntry[];
  activityLevel: 'sedentary' | 'light' | 'active' | 'very_active';
  proteinCompliancePct: number;     // actual / target, 0–1
  plateauDetected: boolean;
  hasSideEffectHairLoss: boolean;   // hair_loss was logged
  daysSinceLastLog: number;         // days since any log entry
};

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildClinicalFlags(input: ClinicalFlagsInput): ClinicalFlag[] {
  const {
    programWeek, sideEffectLogs, activityLevel,
    proteinCompliancePct, plateauDetected,
    hasSideEffectHairLoss, daysSinceLastLog,
  } = input;

  const flags: ClinicalFlag[] = [];

  // ── Iron lab reminder at week 8 ──────────────────────────────────────────
  if (programWeek === 8) {
    flags.push({
      type: 'iron_lab_reminder',
      severity: 'info',
      title: 'Lab Reminder: Iron & Ferritin',
      body: 'Week 8 is a good time to check your iron and ferritin levels. GLP-1 medications can reduce iron absorption due to decreased food intake. Ask your prescriber about a blood panel.',
      dismissible: true,
    });
  }

  // ── Vitamin D lab reminder at week 12 ────────────────────────────────────
  if (programWeek === 12) {
    flags.push({
      type: 'vitamin_d_lab_reminder',
      severity: 'info',
      title: 'Lab Reminder: Vitamin D',
      body: 'At week 12, a Vitamin D check is recommended. Deficiency is common in people with obesity and may impair GLP-1 effectiveness. Ask your prescriber to include it in your next panel.',
      dismissible: true,
    });
  }

  // ── Hair loss reassurance (weeks 12–26) ──────────────────────────────────
  if (hasSideEffectHairLoss && programWeek >= 12 && programWeek <= 26) {
    flags.push({
      type: 'hair_loss_reassurance',
      severity: 'warning',
      title: 'Hair Loss: Likely Telogen Effluvium',
      body: 'Hair shedding during rapid weight loss is common and usually temporary. It\'s caused by the physical stress of weight loss (telogen effluvium), not the medication directly. Adequate protein intake (your top priority) is the best mitigation. Most cases resolve by week 26–36.',
      dismissible: true,
    });
  }

  // ── Plateau protocol (week ≥20, plateau detected) ────────────────────────
  if (plateauDetected && programWeek >= 20) {
    flags.push({
      type: 'plateau_protocol',
      severity: 'info',
      title: 'Weight Plateau Detected',
      body: 'A plateau at week 20+ often reflects metabolic adaptation. Common strategies: increase protein to 1.5 g/kg, add or intensify resistance training, and review caloric density of your meals. Discuss dose escalation options with your prescriber if applicable.',
      actionLabel: 'Log Activity',
      actionRoute: '/entry/log-activity',
      dismissible: true,
    });
  }

  // ── Resistance training nudge (sedentary/light, week ≥5) ─────────────────
  if ((activityLevel === 'sedentary' || activityLevel === 'light') && programWeek >= 5) {
    flags.push({
      type: 'resistance_training',
      severity: 'warning',
      title: 'Add Resistance Training',
      body: '26–40% of GLP-1 weight loss can be lean mass. Resistance training 2–3x per week dramatically reduces this. Starting at week 5, even bodyweight exercises produce measurable muscle preservation.',
      actionLabel: 'Log Activity',
      actionRoute: '/entry/log-activity',
      dismissible: true,
    });
  }

  // ── Lean mass alert (protein < 60% of target, week ≥8) ───────────────────
  if (proteinCompliancePct < 0.6 && programWeek >= 8) {
    flags.push({
      type: 'lean_mass_alert',
      severity: 'warning',
      title: 'Low Protein — Lean Mass at Risk',
      body: `Your protein intake is at ${Math.round(proteinCompliancePct * 100)}% of your target. Below 60% for extended periods accelerates muscle loss alongside fat. Each 10g increase preserves roughly 0.5 lbs of muscle over 12 weeks.`,
      actionLabel: 'Log Food',
      actionRoute: '/entry/log-food',
      dismissible: true,
    });
  }

  // ── Dropout risk (no log in 5+ days, months 4–6 = weeks 17–26) ───────────
  if (daysSinceLastLog >= 5 && programWeek >= 17 && programWeek <= 26) {
    flags.push({
      type: 'dropout_risk',
      severity: 'info',
      title: 'Stay Consistent — High-Risk Period',
      body: 'Weeks 17–26 are the highest dropout period for GLP-1 programs. Logging even one data point per day is strongly correlated with long-term success. You\'ve got this.',
      actionLabel: 'Log Something',
      actionRoute: '/entry/log-weight',
      dismissible: true,
    });
  }

  // Sort by severity: action_required first, then warning, then info
  const order: Record<ClinicalFlagSeverity, number> = {
    action_required: 0,
    warning: 1,
    info: 2,
  };

  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}
