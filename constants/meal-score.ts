import type { DailyTargets } from './scoring';
import type { ShotPhase } from './scoring';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MealScoreGrade = 'great' | 'good' | 'fair' | 'poor';

export type MealScoreFactor = {
  name: string;
  score: number;   // 0-10
  weight: number;  // 0-1
  note: string;
};

export type MealScoreResult = {
  score: number;          // 0-10, one decimal
  grade: MealScoreGrade;
  label: string;
  color: string;          // hex color for the grade
  factors: MealScoreFactor[];
};

export type MealMacros = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

// ─── Grade Mapping ────────────────────────────────────────────────────────────

function getGrade(score: number): { grade: MealScoreGrade; label: string; color: string } {
  if (score >= 8) return { grade: 'great', label: 'Great for your GLP-1 journey', color: '#34C759' };
  if (score >= 6) return { grade: 'good', label: 'Good choice — solid nutrition', color: '#8BC34A' };
  if (score >= 4) return { grade: 'fair', label: 'Room to boost this meal', color: '#F6CB45' };
  return { grade: 'poor', label: 'Add protein to boost this meal', color: '#F6CB45' };
}

// ─── Factor Scorers ───────────────────────────────────────────────────────────

/** Factor 1: Protein Content (30%) — 25-30g/meal triggers muscle protein synthesis */
function scoreProtein(macros: MealMacros): MealScoreFactor {
  const p = macros.protein_g;
  const pctCal = macros.calories > 0 ? (p * 4 / macros.calories) * 100 : 0;

  let score: number;
  let note: string;
  if (p >= 30) { score = 10; note = `${Math.round(p)}g protein — excellent for muscle preservation`; }
  else if (p >= 25) { score = 8; note = `${Math.round(p)}g protein — hitting MPS threshold`; }
  else if (p >= 20) { score = 6; note = `${Math.round(p)}g protein — aim for 25g+`; }
  else if (p >= 15) { score = 4; note = `${Math.round(p)}g protein — below muscle-sparing minimum`; }
  else if (p >= 10) { score = 2; note = `Only ${Math.round(p)}g protein — muscle loss risk`; }
  else { score = 0; note = `Very low protein (${Math.round(p)}g) — critical gap`; }

  // Bonus if protein is >30% of calories
  if (pctCal > 30 && score < 10) score = Math.min(10, score + 1);

  return { name: 'Protein', score, weight: 0.30, note };
}

/** Factor 2: Fat Moderation (20%) — high fat + slowed gastric emptying = GI distress */
function scoreFat(macros: MealMacros, phase: ShotPhase): MealScoreFactor {
  const fatPct = macros.calories > 0 ? (macros.fat_g * 9 / macros.calories) * 100 : 0;
  // During peak phase, shift thresholds down 5% (stricter)
  const offset = phase === 'peak' ? 5 : 0;

  let score: number;
  let note: string;
  if (fatPct < 25 - offset) { score = 10; note = 'Low fat — easy on digestion'; }
  else if (fatPct < 30 - offset) { score = 8; note = 'Moderate fat — within range'; }
  else if (fatPct < 35 - offset) { score = 5; note = `${Math.round(fatPct)}% fat — getting high`; }
  else if (fatPct < 40 - offset) { score = 3; note = `${Math.round(fatPct)}% fat — may cause GI issues`; }
  else { score = 1; note = `${Math.round(fatPct)}% fat — high risk for nausea`; }

  return { name: 'Fat', score, weight: 0.20, note };
}

/** Factor 3: Fiber Balance (15%) — 5-8g/meal sweet spot */
function scoreFiber(macros: MealMacros, sideEffects: string[]): MealScoreFactor {
  const f = macros.fiber_g;
  const hasConstipation = sideEffects.includes('constipation');
  const hasDiarrhea = sideEffects.includes('diarrhea');
  const hasBloating = sideEffects.includes('bloating');

  let score: number;
  let note: string;
  if (f >= 5 && f <= 8) { score = 10; note = `${f.toFixed(1)}g fiber — ideal range`; }
  else if (f >= 3 && f < 5) { score = 7; note = `${f.toFixed(1)}g fiber — a bit low`; }
  else if (f > 8 && f <= 12) { score = 6; note = `${f.toFixed(1)}g fiber — borderline high`; }
  else if (f >= 1 && f < 3) { score = 4; note = `Low fiber (${f.toFixed(1)}g) — constipation risk`; }
  else if (f > 12) { score = 3; note = `High fiber (${f.toFixed(1)}g) — bloating risk`; }
  else { score = 2; note = 'Almost no fiber'; }

  // Side-effect modifiers
  if (hasConstipation && f >= 5) score = Math.min(10, score + 2);
  if (hasDiarrhea && f > 8) score = Math.max(0, score - 2);
  if (hasBloating && f > 10) score = Math.max(0, score - 2);

  return { name: 'Fiber', score: Math.min(10, score), weight: 0.15, note };
}

/** Factor 4: Calorie Efficiency (15%) — nutrient density per calorie */
function scoreCalorieEfficiency(macros: MealMacros): MealScoreFactor {
  const cal = macros.calories;
  if (cal <= 0) return { name: 'Calories', score: 0, weight: 0.15, note: 'No calories detected' };

  // Nutrient density = (protein + fiber) per 100 cal
  const density = (macros.protein_g + macros.fiber_g) / cal * 100;

  let score: number;
  if (density > 8) score = 10;
  else if (density > 6) score = 8;
  else if (density > 4) score = 6;
  else if (density > 2) score = 4;
  else score = 2;

  // Penalize oversized meals (GLP-1 reduces stomach capacity)
  if (cal > 600) score = Math.max(0, score - 2);
  // Penalize too-small meals (need to eat enough to prevent muscle loss)
  if (cal < 100) score = Math.max(0, score - 2);

  let note: string;
  if (score >= 8) note = 'Nutrient-dense — every calorie counts';
  else if (score >= 5) note = `${Math.round(cal)} cal — moderate density`;
  else if (cal > 600) note = `${Math.round(cal)} cal — large for GLP-1 portions`;
  else note = 'Low nutrient density — mostly empty calories';

  return { name: 'Calories', score, weight: 0.15, note };
}

/** Factor 5: Side-Effect Compatibility (10%) */
function scoreSideEffects(macros: MealMacros, sideEffects: string[]): MealScoreFactor {
  if (sideEffects.length === 0) {
    return { name: 'Tolerance', score: 8, weight: 0.10, note: 'No active side effects' };
  }

  let score = 8;
  const issues: string[] = [];
  const fatPct = macros.calories > 0 ? (macros.fat_g * 9 / macros.calories) * 100 : 0;

  if (sideEffects.includes('nausea') && fatPct > 35) { score -= 3; issues.push('high fat + nausea'); }
  if (sideEffects.includes('vomiting') && fatPct > 30) { score -= 4; issues.push('fat may worsen vomiting'); }
  if (sideEffects.includes('bloating') && macros.fiber_g > 10) { score -= 2; issues.push('high fiber + bloating'); }
  if (sideEffects.includes('heartburn') && fatPct > 30) { score -= 2; issues.push('fat may trigger heartburn'); }
  if (sideEffects.includes('constipation') && macros.fiber_g >= 5) { score += 2; issues.push('good fiber for constipation'); }

  score = Math.max(0, Math.min(10, score));
  const note = issues.length > 0 ? issues.join('; ') : 'Compatible with your side effects';

  return { name: 'Tolerance', score, weight: 0.10, note };
}

/** Factor 6: Phase Alignment (10%) */
function scorePhase(macros: MealMacros, phase: ShotPhase): MealScoreFactor {
  let score = 7;
  let note = '';

  switch (phase) {
    case 'peak':
      if (macros.calories <= 400 && macros.protein_g >= 20) { score = 10; note = 'Small protein meal — perfect for peak phase'; }
      else if (macros.calories > 500) { score = 4; note = 'Large meal during peak — may cause nausea'; }
      else { score = 6; note = 'Moderate for peak phase'; }
      break;
    case 'shot':
      if (macros.protein_g >= 25 && macros.calories <= 500) { score = 9; note = 'Good pre-medication nutrition'; }
      else { score = 7; note = 'Moderate for shot day'; }
      break;
    case 'balance':
      if (macros.protein_g >= 25 && macros.fiber_g >= 4) { score = 9; note = 'Balanced meal — great timing'; }
      else { score = 7; note = 'Balance phase — push for nutrients'; }
      break;
    case 'reset':
      if (macros.protein_g >= 30) { score = 10; note = 'High protein as appetite returns — ideal'; }
      else if (macros.protein_g >= 20) { score = 7; note = 'Appetite returning — push for more protein'; }
      else { score = 4; note = 'Low protein as appetite returns — missed opportunity'; }
      break;
  }

  return { name: 'Timing', score, weight: 0.10, note };
}

// ─── Main Scoring Function ────────────────────────────────────────────────────

export function computeMealScore(
  macros: MealMacros,
  phase: ShotPhase,
  sideEffects: string[],
): MealScoreResult {
  const factors = [
    scoreProtein(macros),
    scoreFat(macros, phase),
    scoreFiber(macros, sideEffects),
    scoreCalorieEfficiency(macros),
    scoreSideEffects(macros, sideEffects),
    scorePhase(macros, phase),
  ];

  const weightedSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  // Floor at 3 — nobody should feel punished for logging food
  const score = parseFloat(Math.max(3, weightedSum).toFixed(1));
  const { grade, label, color } = getGrade(score);

  // Override generic label with the most impactful factor note for fair/poor scores
  let finalLabel = label;
  if (score < 6) {
    const worst = factors.reduce((a, b) => (a.score * a.weight < b.score * b.weight ? a : b));
    if (worst.score <= 4) finalLabel = worst.note;
  }

  return { score, grade, label: finalLabel, color, factors };
}
