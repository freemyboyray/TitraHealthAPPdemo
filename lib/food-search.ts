// Shared adapters that normalize the various "pickable" foods (custom foods,
// previously-logged recents, saved-meal recipes) into FoodResult (per-100g
// macros) so they all flow through the same addReadyDish path as DB search
// results. Used by both the top-level search sheet and the routed add-food
// screen (the review "+" / ingredient sub-flows).
import type { FoodResult } from './fatsecret';
import type { CustomFood, RecentFood, SavedMeal } from '../stores/meal-tray-store';

export function customToResult(cf: CustomFood): FoodResult {
  const serving = cf.serving_size_g ?? 100;
  return {
    fdcId: -1, // custom: no FatSecret id → addReadyDish skips hydration
    name: cf.name,
    brand: cf.brand || 'My Foods',
    calories: cf.calories_per_100g,
    protein_g: cf.protein_per_100g,
    carbs_g: cf.carbs_per_100g,
    fat_g: cf.fat_per_100g,
    fiber_g: cf.fiber_per_100g,
    serving_size_g: serving,
    serving_options:
      cf.serving_size_g != null
        ? [
            { label: '1 serving', grams: serving, isDefault: true },
            { label: '100 g', grams: 100 },
          ]
        : [{ label: '100 g', grams: 100, isDefault: true }],
  };
}

// A previously-logged food. We don't store its serving grams, so treat the
// logged macros as one serving (≈100g) — the user can re-portion on review.
export function recentToResult(rf: RecentFood): FoodResult {
  return {
    fdcId: -1,
    name: rf.food_name,
    brand: '',
    calories: rf.calories,
    protein_g: rf.protein_g,
    carbs_g: rf.carbs_g,
    fat_g: rf.fat_g,
    fiber_g: rf.fiber_g,
    serving_size_g: 100,
    serving_options: [{ label: '1 serving', grams: 100, isDefault: true }],
  };
}

// A saved meal (recipe) expands into one FoodResult per item; per-100g macros
// are derived from the stored per-serving values so review math stays correct.
export function savedMealToResults(m: SavedMeal): FoodResult[] {
  return m.items.map((it) => {
    const g = it.serving_g > 0 ? it.serving_g : 100;
    const scale = 100 / g;
    const r1 = (v: number) => parseFloat((v * scale).toFixed(1));
    return {
      fdcId: -1,
      name: it.food_name,
      brand: m.name,
      calories: Math.round(it.calories * scale),
      protein_g: r1(it.protein_g),
      carbs_g: r1(it.carbs_g),
      fat_g: r1(it.fat_g),
      fiber_g: r1(it.fiber_g),
      serving_size_g: g,
      serving_options: [{ label: '1 serving', grams: g, isDefault: true }],
    };
  });
}
