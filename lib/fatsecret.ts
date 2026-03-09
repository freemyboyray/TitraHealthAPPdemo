const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const EDGE_FN = `${SUPABASE_URL}/functions/v1/fatsecret`;

export type ServingOption = { label: string; grams: number };

export type FoodResult = {
  fdcId: number;       // stores FatSecret food_id as number
  name: string;
  brand: string;
  calories: number;   // per 100 g
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  serving_description?: string;
  serving_size_g?: number;
  serving_options?: ServingOption[];
};

async function callEdge(params: string): Promise<unknown> {
  const res = await fetch(`${EDGE_FN}?${params}`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) throw new Error(`Edge function error: ${res.status}`);
  return res.json();
}

// ─── Parse food_description string ────────────────────────────────────────────
// Format: "Per 100g - Calories: 165kcal | Fat: 3.57g | Carbs: 0g | Prot: 31.02g"
// Also handles: "Per serving - Calories: 165kcal | ..."
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

// ─── Build serving options from FatSecret food.get.v4 servings ────────────────
function buildServingOptions(servings: any[]): { options: ServingOption[]; per100g: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } | null } {
  // Find a gram-based serving to derive per-100g values
  const gramServing = servings.find(
    (s) => s.metric_serving_unit === 'g' && parseFloat(s.metric_serving_amount) > 0,
  );

  let per100g: ReturnType<typeof buildServingOptions>['per100g'] = null;
  if (gramServing) {
    const grams = parseFloat(gramServing.metric_serving_amount);
    const scale = 100 / grams;
    per100g = {
      calories: Math.round(parseFloat(gramServing.calories ?? '0') * scale),
      protein_g: parseFloat((parseFloat(gramServing.protein ?? '0') * scale).toFixed(1)),
      carbs_g: parseFloat((parseFloat(gramServing.carbohydrate ?? '0') * scale).toFixed(1)),
      fat_g: parseFloat((parseFloat(gramServing.fat ?? '0') * scale).toFixed(1)),
      fiber_g: parseFloat((parseFloat(gramServing.fiber ?? '0') * scale).toFixed(1)),
    };
  }

  // Build unique serving options from all gram-unit servings
  const seen = new Set<number>();
  const options: ServingOption[] = [];

  for (const s of servings) {
    if (s.metric_serving_unit !== 'g') continue;
    const grams = Math.round(parseFloat(s.metric_serving_amount));
    if (!grams || seen.has(grams)) continue;
    seen.add(grams);
    options.push({ label: `${s.serving_description} (${grams}g)`, grams });
  }

  // Always include 100g if not already present
  if (!seen.has(100)) {
    options.push({ label: '100g', grams: 100 });
  }

  options.sort((a, b) => a.grams - b.grams);
  return { options, per100g };
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchFatSecret(query: string): Promise<FoodResult[]> {
  try {
    const data = await callEdge(`action=search&q=${encodeURIComponent(query)}`) as any;
    const foods = data?.foods?.food;
    if (!foods) return [];

    const list = Array.isArray(foods) ? foods : [foods];
    return list.map((f: any) => {
      const macros = parseDescription(f.food_description ?? '');
      return {
        fdcId: parseInt(f.food_id, 10),
        name: f.food_name ?? '',
        brand: f.brand_name ?? '',
        ...macros,
      };
    });
  } catch {
    return [];
  }
}

// ─── Get full food detail (with serving options) ───────────────────────────────

export async function getFatSecretFood(foodId: number): Promise<FoodResult | null> {
  try {
    const data = await callEdge(`action=food&id=${foodId}`) as any;
    const food = data?.food;
    if (!food) return null;

    const rawServings = food.servings?.serving;
    const servings = rawServings
      ? (Array.isArray(rawServings) ? rawServings : [rawServings])
      : [];

    const { options, per100g } = buildServingOptions(servings);

    // Fallback: parse food_description if no gram-serving found
    const macros = per100g ?? parseDescription(food.food_description ?? '');

    return {
      fdcId: parseInt(food.food_id, 10),
      name: food.food_name ?? '',
      brand: food.brand_name ?? '',
      ...macros,
      serving_options: options.length > 0 ? options : undefined,
    };
  } catch {
    return null;
  }
}

// ─── Barcode lookup ────────────────────────────────────────────────────────────

export async function lookupFatSecretBarcode(barcode: string): Promise<FoodResult | null> {
  try {
    const data = await callEdge(`action=barcode&code=${encodeURIComponent(barcode)}`) as any;
    if (data?.error) return null;

    const food = data?.food;
    if (!food) return null;

    const rawServings = food.servings?.serving;
    const servings = rawServings
      ? (Array.isArray(rawServings) ? rawServings : [rawServings])
      : [];

    const { options, per100g } = buildServingOptions(servings);
    const macros = per100g ?? parseDescription(food.food_description ?? '');

    return {
      fdcId: parseInt(food.food_id, 10),
      name: food.food_name ?? '',
      brand: food.brand_name ?? '',
      ...macros,
      serving_options: options.length > 0 ? options : undefined,
    };
  } catch {
    return null;
  }
}
