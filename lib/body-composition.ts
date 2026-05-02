import type { WeightLog } from '../stores/log-store';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BodyCompStatus = 'excellent' | 'good' | 'monitor' | 'concern';

export type FatToLeanResult = {
  fatLossLbs: number;
  leanLossLbs: number;
  fatLossRatio: number; // 0-1, fraction of total loss that was fat
  status: BodyCompStatus;
  startWeight: number;
  endWeight: number;
  startBodyFatPct: number;
  endBodyFatPct: number;
};

export type LeanPreservationResult = {
  startLeanLbs: number;
  currentLeanLbs: number;
  preservationPct: number; // e.g. 95 means 95% of lean mass preserved
  leanLostLbs: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Filter weight logs that have body composition data */
function logsWithBodyComp(logs: WeightLog[]): WeightLog[] {
  return logs
    .filter(l => l.body_fat_pct != null || l.lean_mass_lbs != null)
    .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
}

// ─── Fat-to-lean loss ratio ──────────────────────────────────────────────────

export function computeFatToLeanRatio(logs: WeightLog[]): FatToLeanResult | null {
  const filtered = logsWithBodyComp(logs);
  if (filtered.length < 2) return null;

  const first = filtered[0];
  const last = filtered[filtered.length - 1];

  const startWeight = first.weight_lbs;
  const endWeight = last.weight_lbs;
  const totalLoss = startWeight - endWeight;

  // Need meaningful weight change (at least 1 lb)
  if (Math.abs(totalLoss) < 1) return null;

  // Prefer direct lean_mass_lbs if available on both ends
  if (first.lean_mass_lbs != null && last.lean_mass_lbs != null) {
    const startLean = first.lean_mass_lbs;
    const endLean = last.lean_mass_lbs;
    const leanLoss = startLean - endLean;
    const fatLoss = totalLoss - leanLoss;
    const ratio = totalLoss > 0 ? fatLoss / totalLoss : 0;

    return {
      fatLossLbs: fatLoss,
      leanLossLbs: leanLoss,
      fatLossRatio: Math.max(0, Math.min(1, ratio)),
      status: bodyCompStatus(ratio),
      startWeight,
      endWeight,
      startBodyFatPct: first.body_fat_pct ?? ((startWeight - startLean) / startWeight * 100),
      endBodyFatPct: last.body_fat_pct ?? ((endWeight - endLean) / endWeight * 100),
    };
  }

  // Fall back to body_fat_pct calculation
  if (first.body_fat_pct != null && last.body_fat_pct != null) {
    const startFatMass = startWeight * (first.body_fat_pct / 100);
    const endFatMass = endWeight * (last.body_fat_pct / 100);
    const fatLoss = startFatMass - endFatMass;
    const leanLoss = totalLoss - fatLoss;
    const ratio = totalLoss > 0 ? fatLoss / totalLoss : 0;

    return {
      fatLossLbs: fatLoss,
      leanLossLbs: leanLoss,
      fatLossRatio: Math.max(0, Math.min(1, ratio)),
      status: bodyCompStatus(ratio),
      startWeight,
      endWeight,
      startBodyFatPct: first.body_fat_pct,
      endBodyFatPct: last.body_fat_pct,
    };
  }

  return null;
}

// ─── Lean mass preservation ──────────────────────────────────────────────────

export function computeLeanPreservation(logs: WeightLog[]): LeanPreservationResult | null {
  const filtered = logsWithBodyComp(logs);
  if (filtered.length < 2) return null;

  const first = filtered[0];
  const last = filtered[filtered.length - 1];

  let startLean: number;
  let currentLean: number;

  if (first.lean_mass_lbs != null && last.lean_mass_lbs != null) {
    startLean = first.lean_mass_lbs;
    currentLean = last.lean_mass_lbs;
  } else if (first.body_fat_pct != null && last.body_fat_pct != null) {
    startLean = first.weight_lbs * (1 - first.body_fat_pct / 100);
    currentLean = last.weight_lbs * (1 - last.body_fat_pct / 100);
  } else {
    return null;
  }

  if (startLean <= 0) return null;

  return {
    startLeanLbs: startLean,
    currentLeanLbs: currentLean,
    preservationPct: (currentLean / startLean) * 100,
    leanLostLbs: startLean - currentLean,
  };
}

// ─── Status classification ───────────────────────────────────────────────────

export function bodyCompStatus(fatLossRatio: number): BodyCompStatus {
  if (fatLossRatio >= 0.75) return 'excellent';
  if (fatLossRatio >= 0.60) return 'good';
  if (fatLossRatio >= 0.40) return 'monitor';
  return 'concern';
}

export const BODY_COMP_STATUS_COLORS: Record<BodyCompStatus, string> = {
  excellent: '#34C759',
  good: '#FF9500',
  monitor: '#FF6B00',
  concern: '#FF3B30',
};

export const BODY_COMP_STATUS_LABELS: Record<BodyCompStatus, string> = {
  excellent: 'Excellent',
  good: 'Good',
  monitor: 'Monitor',
  concern: 'Concern',
};

// ─── Body comp trend data points ─────────────────────────────────────────────

export type BodyCompTrendPoint = {
  date: string;
  bodyFatPct: number | null;
  leanMassLbs: number | null;
  weightLbs: number;
};

export function bodyCompTrendData(logs: WeightLog[]): BodyCompTrendPoint[] {
  return logsWithBodyComp(logs).map(l => ({
    date: l.logged_at,
    bodyFatPct: l.body_fat_pct,
    leanMassLbs: l.lean_mass_lbs ?? (l.body_fat_pct != null ? l.weight_lbs * (1 - l.body_fat_pct / 100) : null),
    weightLbs: l.weight_lbs,
  }));
}
