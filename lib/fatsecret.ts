// Routes FatSecret calls through the Supabase edge function which handles
// authentication and credential management server-side.
import { supabase } from './supabase';
import { usePreferencesStore } from '@/stores/preferences-store';

export type ServingOption = { label: string; grams: number; isDefault?: boolean };

// FatSecret allergen ternary: 1 = contains, 0 = does not contain, -1 = unknown.
export type AllergenFlags = {
  milk?: number;
  lactose?: number;
  egg?: number;
  fish?: number;
  gluten?: number;
  nuts?: number;
  peanuts?: number;
  shellfish?: number;
  soy?: number;
  sesame?: number;
};

// FatSecret preference ternary: 1 = yes, 0 = no, -1 = unknown.
export type PreferenceFlags = {
  vegan?: number;
  vegetarian?: number;
};

export type FoodResult = {
  fdcId: number;       // stores FatSecret food_id as number
  name: string;
  brand: string;
  // Per-100g macros (canonical normalized form)
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  // Per-100g extended nutrients (Premier or v4 fields; null when not provided)
  saturated_fat_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  cholesterol_mg?: number;
  trans_fat_g?: number;
  polyunsaturated_fat_g?: number;
  monounsaturated_fat_g?: number;
  potassium_mg?: number;
  added_sugars_g?: number;
  vitamin_a_mcg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  calcium_mg?: number;
  iron_mg?: number;
  // Premier-only enrichments
  image_url?: string;
  allergens?: AllergenFlags;
  preferences?: PreferenceFlags;
  // FatSecret food sub-category (e.g., Poultry, Dairy). Used for Top
  // Contributors taxonomy rollup. Picked as the first entry in
  // food.food_sub_categories.food_sub_category[].
  category_name?: string;
  // Serving metadata
  serving_description?: string;
  serving_size_g?: number;
  serving_options?: ServingOption[];
};

// ─── Supabase edge function proxy ────────────────────────────────────────────

async function callEdge(params: Record<string, string>): Promise<unknown> {
  if (!usePreferencesStore.getState().foodDbConsent) {
    throw new Error('Food database access requires your consent. Enable "Food Database" in Settings > Privacy & Data.');
  }
  __DEV__ && console.log('[FatSecret] callEdge →', params);

  const query = new URLSearchParams(params).toString();
  const { data, error } = await supabase.functions.invoke(`fatsecret?${query}`, {
    method: 'GET',
  });

  if (error) {
    const errMsg = error.message ?? '';
    __DEV__ && console.error('[FatSecret] callEdge error:', errMsg);
    throw new Error(`FatSecret proxy error: ${errMsg}`);
  }

  __DEV__ && console.log('[FatSecret] callEdge ← response:', JSON.stringify(data).slice(0, 500));

  if (data?.error && data.error !== 'not_found') {
    __DEV__ && console.error('[FatSecret] callEdge API error:', data.error);
    throw new Error(data.error);
  }

  return data;
}

// ─── Parse food_description string ────────────────────────────────────────────
// Format: "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0g | Prot: 31.02g"

function parseDescription(desc: string): { calories: number; fat_g: number; carbs_g: number; protein_g: number; fiber_g: number } {
  const num = (pattern: RegExp) => {
    const m = desc.match(pattern);
    return m ? parseFloat(m[1]) : 0;
  };
  return {
    calories: num(/Calories:\s*([\d.]+)/i),
    fat_g: parseFloat((num(/Fat:\s*([\d.]+)/i)).toFixed(1)),
    carbs_g: parseFloat((num(/Carbs:\s*([\d.]+)/i)).toFixed(1)),
    protein_g: parseFloat((num(/Prot[ein]*:\s*([\d.]+)/i)).toFixed(1)),
    fiber_g: parseFloat((num(/Fiber:\s*([\d.]+)/i)).toFixed(1)),
  };
}

// ─── Premier flag parsers ─────────────────────────────────────────────────────
// FatSecret nests single items as objects, multiple as arrays. Normalize.
function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

const ALLERGEN_KEYS: Record<string, keyof AllergenFlags> = {
  milk: 'milk',
  lactose: 'lactose',
  egg: 'egg',
  fish: 'fish',
  gluten: 'gluten',
  nuts: 'nuts',
  'tree nuts': 'nuts',
  peanuts: 'peanuts',
  shellfish: 'shellfish',
  soy: 'soy',
  soybean: 'soy',
  sesame: 'sesame',
};

const PREFERENCE_KEYS: Record<string, keyof PreferenceFlags> = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
};

function parseAllergens(food_attributes: any): AllergenFlags | undefined {
  const list = asArray(food_attributes?.allergens?.allergen);
  if (list.length === 0) return undefined;
  const out: AllergenFlags = {};
  for (const item of list) {
    const name = String(item?.name ?? '').toLowerCase();
    const key = ALLERGEN_KEYS[name];
    if (!key) continue;
    const v = parseInt(String(item?.value ?? '-1'), 10);
    if (!Number.isFinite(v)) continue;
    out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parsePreferences(food_attributes: any): PreferenceFlags | undefined {
  const list = asArray(food_attributes?.preferences?.preference);
  if (list.length === 0) return undefined;
  const out: PreferenceFlags = {};
  for (const item of list) {
    const name = String(item?.name ?? '').toLowerCase();
    const key = PREFERENCE_KEYS[name];
    if (!key) continue;
    const v = parseInt(String(item?.value ?? '-1'), 10);
    if (!Number.isFinite(v)) continue;
    out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseCategoryName(food: any): string | undefined {
  // food.get.v4 with include_sub_categories=true returns:
  //   food.food_sub_categories.food_sub_category: string[] | string
  // We pick the first entry as the canonical category for grouping.
  const list = asArray(food?.food_sub_categories?.food_sub_category);
  if (list.length === 0) return undefined;
  const first = list[0];
  if (typeof first === 'string') return first;
  // Some responses wrap each sub-category as { food_sub_category_name: ... }
  return typeof first?.food_sub_category_name === 'string' ? first.food_sub_category_name : undefined;
}

function parseImageUrl(food: any): string | undefined {
  // food.get.v4 returns food_images.food_image as object or array of objects
  // each with { image_url, image_type? } where image_type is "Standard" or "Isolated".
  const list = asArray(food?.food_images?.food_image);
  if (list.length === 0) return undefined;
  const isolated = list.find((i: any) => String(i?.image_type ?? '').toLowerCase() === 'isolated');
  const pick = isolated ?? list[0];
  return typeof pick?.image_url === 'string' ? pick.image_url : undefined;
}

// ─── Build serving options from food.get.v4 servings ──────────────────────────

type Per100g = {
  calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number;
  saturated_fat_g?: number; sugar_g?: number; sodium_mg?: number; cholesterol_mg?: number;
  trans_fat_g?: number; polyunsaturated_fat_g?: number; monounsaturated_fat_g?: number;
  potassium_mg?: number; added_sugars_g?: number;
  vitamin_a_mcg?: number; vitamin_c_mg?: number; vitamin_d_mcg?: number;
  calcium_mg?: number; iron_mg?: number;
};

function buildServingOptions(servings: any[]): { options: ServingOption[]; per100g: Per100g | null } {
  // Prefer the FatSecret-marked default serving (Premier flag_default_serving=true);
  // fall back to the first gram-based serving for the per-100g normalization.
  const defaultServing = servings.find((s) => String(s.is_default ?? '') === '1');
  const gramServing = (defaultServing && defaultServing.metric_serving_unit === 'g'
      && parseFloat(defaultServing.metric_serving_amount) > 0)
    ? defaultServing
    : servings.find(
        (s) => s.metric_serving_unit === 'g' && parseFloat(s.metric_serving_amount) > 0,
      );

  let per100g: Per100g | null = null;
  if (gramServing) {
    const grams = parseFloat(gramServing.metric_serving_amount);
    const scale = 100 / grams;
    const num = (v: any) => parseFloat(v ?? '0') || 0;
    per100g = {
      calories: Math.round(num(gramServing.calories) * scale),
      protein_g: parseFloat((num(gramServing.protein) * scale).toFixed(1)),
      carbs_g: parseFloat((num(gramServing.carbohydrate) * scale).toFixed(1)),
      fat_g: parseFloat((num(gramServing.fat) * scale).toFixed(1)),
      fiber_g: parseFloat((num(gramServing.fiber) * scale).toFixed(1)),
    };
    // Extended nutrients — only set when FatSecret returned a value, so the
    // distinction between "not provided" and "actually zero" is preserved.
    if (gramServing.saturated_fat != null)       per100g.saturated_fat_g       = parseFloat((num(gramServing.saturated_fat) * scale).toFixed(2));
    if (gramServing.sugar != null)               per100g.sugar_g               = parseFloat((num(gramServing.sugar) * scale).toFixed(1));
    if (gramServing.sodium != null)              per100g.sodium_mg             = Math.round(num(gramServing.sodium) * scale);
    if (gramServing.cholesterol != null)         per100g.cholesterol_mg        = Math.round(num(gramServing.cholesterol) * scale);
    if (gramServing.trans_fat != null)           per100g.trans_fat_g           = parseFloat((num(gramServing.trans_fat) * scale).toFixed(2));
    if (gramServing.polyunsaturated_fat != null) per100g.polyunsaturated_fat_g = parseFloat((num(gramServing.polyunsaturated_fat) * scale).toFixed(2));
    if (gramServing.monounsaturated_fat != null) per100g.monounsaturated_fat_g = parseFloat((num(gramServing.monounsaturated_fat) * scale).toFixed(2));
    if (gramServing.potassium != null)           per100g.potassium_mg          = Math.round(num(gramServing.potassium) * scale);
    if (gramServing.added_sugars != null)        per100g.added_sugars_g        = parseFloat((num(gramServing.added_sugars) * scale).toFixed(1));
    if (gramServing.vitamin_a != null)           per100g.vitamin_a_mcg         = parseFloat((num(gramServing.vitamin_a) * scale).toFixed(1));
    if (gramServing.vitamin_c != null)           per100g.vitamin_c_mg          = parseFloat((num(gramServing.vitamin_c) * scale).toFixed(1));
    if (gramServing.vitamin_d != null)           per100g.vitamin_d_mcg         = parseFloat((num(gramServing.vitamin_d) * scale).toFixed(1));
    if (gramServing.calcium != null)             per100g.calcium_mg            = Math.round(num(gramServing.calcium) * scale);
    if (gramServing.iron != null)                per100g.iron_mg               = parseFloat((num(gramServing.iron) * scale).toFixed(2));
  }

  const seen = new Set<number>();
  const options: ServingOption[] = [];

  for (const s of servings) {
    if (s.metric_serving_unit !== 'g') continue;
    const grams = Math.round(parseFloat(s.metric_serving_amount));
    if (!grams || seen.has(grams)) continue;
    seen.add(grams);
    options.push({
      label: `${s.serving_description} (${grams}g)`,
      grams,
      isDefault: String(s.is_default ?? '') === '1' ? true : undefined,
    });
  }

  if (!seen.has(100)) options.push({ label: '100g', grams: 100 });
  options.sort((a, b) => a.grams - b.grams);
  return { options, per100g };
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchFatSecret(query: string): Promise<FoodResult[]> {
  __DEV__ && console.log('[FatSecret] searchFatSecret called with query:', query);
  try {
    const data = await callEdge({ action: 'search', q: query }) as any;

    const foods = data?.foods?.food;
    if (!foods) {
      __DEV__ && console.log('[FatSecret] searchFatSecret: no foods in response');
      return [];
    }

    const list = Array.isArray(foods) ? foods : [foods];
    __DEV__ && console.log('[FatSecret] searchFatSecret: got', list.length, 'results for', query);
    const mapped = list.map((f: any) => {
      const macros = parseDescription(f.food_description ?? '');
      return {
        fdcId: parseInt(f.food_id, 10),
        name: f.food_name ?? '',
        brand: f.brand_name ?? '',
        ...macros,
      };
    });
    __DEV__ && console.log('[FatSecret] searchFatSecret: first result →', JSON.stringify(mapped[0]));
    return mapped;
  } catch (e) {
    __DEV__ && console.warn('[FatSecret] search failed:', e);
    return [];
  }
}

// ─── Get full food detail (with serving options) ───────────────────────────────

function buildFoodResult(food: any): FoodResult | null {
  const rawServings = food.servings?.serving;
  const servings = rawServings
    ? (Array.isArray(rawServings) ? rawServings : [rawServings])
    : [];

  const { options, per100g } = buildServingOptions(servings);
  const fallbackMacros = parseDescription(food.food_description ?? '');
  const macros = per100g ?? fallbackMacros;

  return {
    fdcId: parseInt(food.food_id, 10),
    name: food.food_name ?? '',
    brand: food.brand_name ?? '',
    ...macros,
    image_url: parseImageUrl(food),
    allergens: parseAllergens(food.food_attributes),
    preferences: parsePreferences(food.food_attributes),
    category_name: parseCategoryName(food),
    serving_options: options.length > 0 ? options : undefined,
  };
}

export async function getFatSecretFood(foodId: number): Promise<FoodResult | null> {
  __DEV__ && console.log('[FatSecret] getFatSecretFood called with id:', foodId);
  try {
    const data = await callEdge({ action: 'food', id: String(foodId) }) as any;

    const food = data?.food;
    if (!food) {
      __DEV__ && console.log('[FatSecret] getFatSecretFood: no food in response for id', foodId);
      return null;
    }

    return buildFoodResult(food);
  } catch (e) {
    __DEV__ && console.warn('[FatSecret] food detail failed:', e);
    return null;
  }
}

// ─── Barcode lookup ────────────────────────────────────────────────────────────

export async function lookupFatSecretBarcode(barcode: string): Promise<FoodResult | null> {
  __DEV__ && console.log('[FatSecret] lookupFatSecretBarcode called with:', barcode);
  try {
    const data = await callEdge({ action: 'barcode', code: barcode }) as any;

    const food = data?.food;
    if (!food) {
      __DEV__ && console.log('[FatSecret] lookupFatSecretBarcode: no food for barcode', barcode);
      return null;
    }

    return buildFoodResult(food);
  } catch (e) {
    __DEV__ && console.warn('[FatSecret] barcode lookup failed:', e);
    return null;
  }
}

// ─── Autocomplete ─────────────────────────────────────────────────────────────

export async function autocompleteFatSecret(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  try {
    const data = await callEdge({ action: 'autocomplete', q: query }) as any;
    const suggestions = data?.suggestions?.suggestion;
    if (!suggestions) return [];
    const list = Array.isArray(suggestions) ? suggestions : [suggestions];
    return list.map((s: any) => (typeof s === 'string' ? s : s?.value ?? '')).filter(Boolean);
  } catch (e) {
    __DEV__ && console.warn('[FatSecret] autocomplete failed:', e);
    return [];
  }
}

// ─── Food Categories ──────────────────────────────────────────────────────────

export type FoodCategory = { id: number; name: string; description: string };

export async function getFoodCategories(): Promise<FoodCategory[]> {
  try {
    const data = await callEdge({ action: 'food_categories' }) as any;
    const cats = data?.food_categories?.food_category;
    if (!cats) return [];
    const list = Array.isArray(cats) ? cats : [cats];
    return list.map((c: any) => ({
      id: parseInt(c.food_category_id, 10),
      name: c.food_category_name ?? '',
      description: c.food_category_description ?? '',
    }));
  } catch (e) {
    __DEV__ && console.warn('[FatSecret] food categories failed:', e);
    return [];
  }
}
