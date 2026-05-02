// Routes FatSecret calls through the Supabase edge function which handles
// authentication and credential management server-side.
import { supabase } from './supabase';

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
  // Premier-only enrichments
  image_url?: string;
  allergens?: AllergenFlags;
  preferences?: PreferenceFlags;
  // Serving metadata
  serving_description?: string;
  serving_size_g?: number;
  serving_options?: ServingOption[];
};

// ─── Supabase edge function proxy ────────────────────────────────────────────

async function callEdge(params: Record<string, string>): Promise<unknown> {
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
    if (gramServing.saturated_fat != null) per100g.saturated_fat_g = parseFloat((num(gramServing.saturated_fat) * scale).toFixed(2));
    if (gramServing.sugar != null)         per100g.sugar_g         = parseFloat((num(gramServing.sugar) * scale).toFixed(1));
    if (gramServing.sodium != null)        per100g.sodium_mg       = Math.round(num(gramServing.sodium) * scale);
    if (gramServing.cholesterol != null)   per100g.cholesterol_mg  = Math.round(num(gramServing.cholesterol) * scale);
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
