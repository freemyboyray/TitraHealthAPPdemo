// ─── Food macro math (shared) ───────────────────────────────────────────────
// Single source of truth for scaling/summing a dish's macros + micros. Used by
// the review screen, the nutrition-label modal, the edit-food / edit-ingredient
// screens, and the confirm/log builder so the numbers can never drift apart.
//
// Extracted from app/entry/review-food.tsx (Phase 0). `dishMacros` is now
// portion-aware: `dish.portion` (a whole-dish multiplier, default 1) scales the
// summed component macros AFTER summing — component macros never see portion, so
// the per-ingredient steppers and the card-level Portion stepper can't
// double-count.

import type { Component as FoodComponent, Dish } from '../stores/food-task-store';
import type { ServingOption } from './fatsecret';

// ─── Serving-unit selection ─────────────────────────────────────────────────
// Choose which database serving option to display a gram-based component in.
// The model gives us two facts: how MANY units (quantity) and the typical weight
// of ONE unit (perUnitGrams). A serving option is only a display UNIT.
//
// Strategy:
//  1. Prefer a natural SINGLE-unit named serving ("1 round", "1 large") within
//     ±50% of the per-unit estimate. The user's own count maps straight onto it
//     (count = quantity), and we bias to the SMALLER size when the estimate
//     straddles two — so a portion is never inflated into a "large" serving.
//  2. Else, if a serving that BAKES IN its own count ("2 eggs") is the closest
//     match, use it but DERIVE the count from total grams so the baked-in count
//     is not multiplied by quantity again (the old "2 × 2 eggs" double-count).
//  3. Else leave the component gram-based (return null) — exact and honest.
// serving_options is sorted smallest-grams-first, so never just take [0].
export function pickServingForEstimate(
  opts: ServingOption[] | undefined,
  perUnitGrams: number,
  quantity: number,
): { unitLabel: string; unitGrams: number; qty: string } | null {
  if (!opts || opts.length === 0) return null;
  const perUnitG = perUnitGrams > 0 ? perUnitGrams : 100;
  const qty = Math.max(1, Math.round(quantity || 1));
  const totalG = Math.max(1, Math.round(qty * perUnitG));

  const isPlainGrams = (label: string) => /^\s*\d+(\.\d+)?\s*g\b/i.test(label.trim());
  // Count a serving's label bakes in: "2 eggs" → 2, "1 round"/"miniature" → 1.
  const bakedCount = (label: string) => {
    const m = label.trim().match(/^(\d+)/);
    const n = m ? parseInt(m[1], 10) : 1;
    return Number.isFinite(n) && n >= 1 ? n : 1;
  };

  // ── 1. Natural single-unit serving near the per-unit estimate ──────────────
  const singleUnit = opts.filter(
    (o) =>
      !isPlainGrams(o.label) &&
      bakedCount(o.label) <= 1 &&
      Math.abs(o.grams - perUnitG) <= perUnitG * 0.5,
  );
  if (singleUnit.length) {
    // Lever A: when the estimate straddles two sizes, pick the largest that does
    // NOT exceed it; if all exceed it, the smallest (closest from above).
    const atOrBelow = singleUnit.filter((o) => o.grams <= perUnitG);
    const best = atOrBelow.length
      ? atOrBelow.reduce((a, b) => (b.grams > a.grams ? b : a))
      : singleUnit.reduce((a, b) => (b.grams < a.grams ? b : a));
    // One serving == one unit, so the user's count carries over directly.
    return { unitLabel: best.label, unitGrams: best.grams, qty: String(qty) };
  }

  // ── 2. Count-baked serving as a fallback (derive the count) ────────────────
  const named = opts.filter((o) => !isPlainGrams(o.label));
  if (named.length) {
    const best = named.reduce((a, b) =>
      Math.abs(b.grams - perUnitG) < Math.abs(a.grams - perUnitG) ? b : a,
    );
    if (Math.abs(best.grams - perUnitG) <= perUnitG) {
      const count = Math.max(1, Math.round(totalG / best.grams));
      return { unitLabel: best.label, unitGrams: best.grams, qty: String(count) };
    }
  }

  // ── 3. Nothing natural is close — stay gram-based (exact). ─────────────────
  return null;
}

// ─── Macro icon colors (semantic, theme-independent) ────────────────────────
export const MACRO_COLORS = {
  cal: '#FF742A',
  protein: '#E74C6F',
  carbs: '#F6A623',
  fat: '#5B8BF5',
  fiber: '#34C759',
} as const;

// Canonical list of optional micronutrient fields carried on a Macros object.
// Kept here so the label modal and the confirm builder iterate one list.
export const MICRO_KEYS = [
  'saturated_fat',
  'sugar',
  'sodium',
  'cholesterol',
  'trans_fat',
  'polyunsaturated_fat',
  'monounsaturated_fat',
  'potassium',
  'added_sugars',
  'vitamin_a',
  'vitamin_c',
  'vitamin_d',
  'calcium',
  'iron',
] as const;

export type MicroKey = (typeof MICRO_KEYS)[number];

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  grams: number;
  saturated_fat?: number;
  sugar?: number;
  sodium?: number;
  cholesterol?: number;
  trans_fat?: number;
  polyunsaturated_fat?: number;
  monounsaturated_fat?: number;
  potassium?: number;
  added_sugars?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  calcium?: number;
  iron?: number;
};

export const EMPTY: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, grams: 0 };

export const r0 = (n: number) => Math.round(n);
export const r1 = (n: number) => parseFloat(n.toFixed(1));

// Grams currently selected for a component (qty × grams-per-unit).
export function componentGrams(comp: FoodComponent): number {
  const q = parseFloat(comp.qty) || 1;
  return q * comp.unitGrams;
}

// Macros for a single component at its selected serving. Never includes portion.
export function componentMacros(comp: FoodComponent): Macros {
  const food = comp.results[comp.selectedIdx];
  if (!food) return { ...EMPTY };
  const g = componentGrams(comp);
  const scale = g / 100;
  const opt = (v?: number) => (v == null ? undefined : v * scale);
  return {
    calories: food.calories * scale,
    protein: food.protein_g * scale,
    carbs: food.carbs_g * scale,
    fat: food.fat_g * scale,
    fiber: food.fiber_g * scale,
    grams: g,
    saturated_fat: opt(food.saturated_fat_g),
    sugar: opt(food.sugar_g),
    sodium: opt(food.sodium_mg),
    cholesterol: opt(food.cholesterol_mg),
    trans_fat: opt(food.trans_fat_g),
    polyunsaturated_fat: opt(food.polyunsaturated_fat_g),
    monounsaturated_fat: opt(food.monounsaturated_fat_g),
    potassium: opt(food.potassium_mg),
    added_sugars: opt(food.added_sugars_g),
    vitamin_a: opt(food.vitamin_a_mcg),
    vitamin_c: opt(food.vitamin_c_mg),
    vitamin_d: opt(food.vitamin_d_mcg),
    calcium: opt(food.calcium_mg),
    iron: opt(food.iron_mg),
  };
}

export function addMacros(a: Macros, b: Macros): Macros {
  const add = (x?: number, y?: number) =>
    x == null && y == null ? undefined : (x ?? 0) + (y ?? 0);
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    grams: a.grams + b.grams,
    saturated_fat: add(a.saturated_fat, b.saturated_fat),
    sugar: add(a.sugar, b.sugar),
    sodium: add(a.sodium, b.sodium),
    cholesterol: add(a.cholesterol, b.cholesterol),
    trans_fat: add(a.trans_fat, b.trans_fat),
    polyunsaturated_fat: add(a.polyunsaturated_fat, b.polyunsaturated_fat),
    monounsaturated_fat: add(a.monounsaturated_fat, b.monounsaturated_fat),
    potassium: add(a.potassium, b.potassium),
    added_sugars: add(a.added_sugars, b.added_sugars),
    vitamin_a: add(a.vitamin_a, b.vitamin_a),
    vitamin_c: add(a.vitamin_c, b.vitamin_c),
    vitamin_d: add(a.vitamin_d, b.vitamin_d),
    calcium: add(a.calcium, b.calcium),
    iron: add(a.iron, b.iron),
  };
}

// Scale every numeric field (macros + grams + present micros) by `factor`.
// Used to apply a dish's whole-dish portion multiplier.
export function multiplyMacros(m: Macros, factor: number): Macros {
  if (factor === 1) return m;
  const mul = (v?: number) => (v == null ? undefined : v * factor);
  return {
    calories: m.calories * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
    fiber: m.fiber * factor,
    grams: m.grams * factor,
    saturated_fat: mul(m.saturated_fat),
    sugar: mul(m.sugar),
    sodium: mul(m.sodium),
    cholesterol: mul(m.cholesterol),
    trans_fat: mul(m.trans_fat),
    polyunsaturated_fat: mul(m.polyunsaturated_fat),
    monounsaturated_fat: mul(m.monounsaturated_fat),
    potassium: mul(m.potassium),
    added_sugars: mul(m.added_sugars),
    vitamin_a: mul(m.vitamin_a),
    vitamin_c: mul(m.vitamin_c),
    vitamin_d: mul(m.vitamin_d),
    calcium: mul(m.calcium),
    iron: mul(m.iron),
  };
}

// Total macros for a dish: sum of component macros × the dish portion (default 1).
export function dishMacros(dish: Dish): Macros {
  const base = dish.components.reduce((acc, c) => addMacros(acc, componentMacros(c)), { ...EMPTY });
  return multiplyMacros(base, dish.portion ?? 1);
}
