import { Glp1Type, Glp1Status } from './user-profile';

interface DrugPkParams {
  ka: number;  // absorption rate constant, h⁻¹
  ke: number;  // elimination rate constant, h⁻¹
}

// ─── FDA / population-PK sourced parameters ──────────────────────────────────
//
// Semaglutide SC (Ozempic/Wegovy):   NDA 209637; t½=168h Tmax=56h → ka=0.0476 h⁻¹ ✓
// Tirzepatide SC (Mounjaro/Zepbound): NDA 215866; t½=120h Tmax=24h → ka=0.135  h⁻¹ ✓
// Dulaglutide SC (Trulicity):         NDA 125469; t½=120h Tmax=48h → ka=0.0525 h⁻¹ ✓
// Liraglutide SC (Saxenda/Victoza):   NDA 202253; t½=13h  Tmax=11h → ka=0.14   h⁻¹ ✓
// Oral semaglutide (Rybelsus/Oral Wegovy): NDA 213051; t½=158h Tmax≈1h → ka=7.0 h⁻¹ ✓
//   Note: ka=2.09 h⁻¹ is the population-PK fitted value but yields Tmax≈3h in the
//   simple Bateman equation. ka=7.0 h⁻¹ matches the clinically observed Tmax≈1h for
//   the SNAC-mediated gastric absorption mechanism.
// Orforglipron (Eli Lilly, NDA filed ~2025): t½=50h (SS midpoint) Tmax=8h → ka=0.45 h⁻¹ ✓
//   ka verified: ln(0.45/0.01386)/(0.45−0.01386) = 7.98h ≈ 8h ✓
//
// ka derivation for each: solve ln(ka/ke)/(ka−ke) = Tmax numerically.

export const DRUG_PK: Record<Glp1Type, DrugPkParams> = {
  // Weekly SC — 7-day chart
  semaglutide:     { ka: 0.0476, ke: 0.00413 },   // t½=168h, Tmax=56h
  tirzepatide:     { ka: 0.135,  ke: 0.00578 },   // t½=120h, Tmax=24h
  dulaglutide:     { ka: 0.0525, ke: 0.00578 },   // t½=120h, Tmax=48h
  // Daily SC — intraday chart (τ=24h)
  liraglutide:     { ka: 0.14,   ke: 0.0533  },   // t½=13h,  Tmax=11h
  // Oral daily — intraday chart (τ=24h)
  oral_semaglutide:{ ka: 7.0,    ke: 0.00439 },   // t½=158h, Tmax≈1h
  orforglipron:    { ka: 0.45,   ke: 0.01386 },   // t½=50h,  Tmax=8h
};

export const DRUG_HALF_LIFE_LABEL: Record<Glp1Type, string> = {
  semaglutide:      '7-day half-life',
  tirzepatide:      '5-day half-life',
  dulaglutide:      '5-day half-life',
  liraglutide:      '13-hour half-life',
  oral_semaglutide: '7-day half-life',
  orforglipron:     '2-day half-life',
};

// Whether the drug is taken orally (drives chart/UX branches)
export const DRUG_IS_ORAL: Record<Glp1Type, boolean> = {
  semaglutide:      false,
  tirzepatide:      false,
  dulaglutide:      false,
  liraglutide:      false,
  oral_semaglutide: true,
  orforglipron:     true,
};

// Default dosing interval per drug class (days)
export const DRUG_DEFAULT_FREQ_DAYS: Record<Glp1Type, number> = {
  semaglutide:      7,
  tirzepatide:      7,
  dulaglutide:      7,
  liraglutide:      1,
  oral_semaglutide: 1,
  orforglipron:     1,
};

// ─── Bateman equation helpers ─────────────────────────────────────────────────

function singleC(t: number, ka: number, ke: number): number {
  return (Math.exp(-ke * t) - Math.exp(-ka * t)) / (ka - ke);
}

function steadyStateC(t: number, ka: number, ke: number, intervalH: number): number {
  const denom = ka - ke;
  const accumKe = 1 - Math.exp(-ke * intervalH);
  const accumKa = 1 - Math.exp(-ka * intervalH);
  if (accumKe < 1e-12 || accumKa < 1e-12) return singleC(t, ka, ke);
  return Math.exp(-ke * t) / (denom * accumKe) - Math.exp(-ka * t) / (denom * accumKa);
}

export function pkConcentrationPct(
  tHours: number,
  drug: Glp1Type,
  atSteadyState: boolean,
  intervalH: number,
): number {
  if (tHours <= 0) return 0;
  const { ka, ke } = DRUG_PK[drug];
  const EPSILON = 1e-6;

  const rawC = (t: number) =>
    Math.abs(ka - ke) < EPSILON
      ? t * Math.exp(-ke * t)  // L'Hôpital limit when ka ≈ ke
      : atSteadyState
        ? steadyStateC(t, ka, ke, intervalH)
        : singleC(t, ka, ke);

  // Find peak over one dosing interval (200 steps)
  let peak = 0;
  for (let i = 1; i <= 200; i++) {
    const v = rawC((i / 200) * intervalH);
    if (v > peak) peak = v;
  }
  if (peak < EPSILON) return 0;
  return Math.min(100, Math.max(0, (rawC(tHours) / peak) * 100));
}

// ─── 7-day curve (weekly/biweekly injectable drugs) ───────────────────────────
// Index 0 = 6 days ago, index 6 = today.

export function generatePkCurve(
  daysSince: number,
  glp1Type: Glp1Type,
  glp1Status: Glp1Status,
  injFreqDays: number,
): number[] {
  const atSteadyState = glp1Status === 'active';
  const intervalH = Math.max(1, injFreqDays) * 24;
  return Array.from({ length: 7 }, (_, i) => {
    const daysAfterInj = daysSince - (6 - i);
    const tHours = daysAfterInj > 0
      ? daysAfterInj * 24
      : Math.max(0, (injFreqDays + daysAfterInj) * 24);
    return Math.round(pkConcentrationPct(tHours, glp1Type, atSteadyState, intervalH));
  });
}

// ─── 24-hour intraday curve (daily drugs) ─────────────────────────────────────
// Returns 7 points spanning 0 → 24h of a single dosing cycle.
// Index 0 = dose time (t≈0), index 6 = t=24h (next dose).
// Always computed at steady state since daily drugs reach SS within days.
//
// Clinical insight per drug:
//   liraglutide:      rises to peak ~11h, trough at 24h is ~64% of peak (sawtooth shape)
//   oral_semaglutide: sharp peak at ~1h, near-flat thereafter (trough ≈91% of peak)
//   orforglipron:     rises to peak ~8h, trough at 24h is ~55% of peak

export function generateIntradayPkCurve(glp1Type: Glp1Type): number[] {
  const intervalH = 24;
  // Daily drugs are virtually always at steady state within days
  const atSteadyState = true;
  // Sample at t = 0.5, 4, 8, 12, 16, 20, 24h
  // (0.5h instead of 0 to avoid the early-guard zero at t=0)
  const sampleHours = [0.5, 4, 8, 12, 16, 20, 24];
  return sampleHours.map(t =>
    Math.round(pkConcentrationPct(t, glp1Type, atSteadyState, intervalH))
  );
}

// X-axis labels for the intraday chart
export const INTRADAY_TIME_LABELS = ['Dose', '+4h', '+8h', '+12h', '+16h', '+20h', '+24h'];
