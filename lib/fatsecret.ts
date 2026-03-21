// Routes all FatSecret calls through the Fly.io proxy so credentials stay
// server-side and the outbound IP is static (required for FatSecret IP whitelist).
const PROXY_URL = process.env.EXPO_PUBLIC_FATSECRET_PROXY_URL ?? '';
const PROXY_SECRET = process.env.EXPO_PUBLIC_FATSECRET_PROXY_SECRET ?? '';

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

// ─── Edge function proxy ───────────────────────────────────────────────────────

async function callEdge(params: Record<string, string>): Promise<unknown> {
  const url = new URL(PROXY_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: {
      'x-proxy-secret': PROXY_SECRET,
    },
  });
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
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

// ─── Build serving options from food.get.v4 servings ──────────────────────────

function buildServingOptions(servings: any[]): { options: ServingOption[]; per100g: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } | null } {
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

  const seen = new Set<number>();
  const options: ServingOption[] = [];

  for (const s of servings) {
    if (s.metric_serving_unit !== 'g') continue;
    const grams = Math.round(parseFloat(s.metric_serving_amount));
    if (!grams || seen.has(grams)) continue;
    seen.add(grams);
    options.push({ label: `${s.serving_description} (${grams}g)`, grams });
  }

  if (!seen.has(100)) options.push({ label: '100g', grams: 100 });
  options.sort((a, b) => a.grams - b.grams);
  return { options, per100g };
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchFatSecret(query: string): Promise<FoodResult[]> {
  try {
    const data = await callEdge({ action: 'search', q: query }) as any;

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
  } catch (e) {
    console.warn('[FatSecret] search failed:', e);
    return [];
  }
}

// ─── Get full food detail (with serving options) ───────────────────────────────

export async function getFatSecretFood(foodId: number): Promise<FoodResult | null> {
  try {
    const data = await callEdge({ action: 'food', id: String(foodId) }) as any;

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
  } catch (e) {
    console.warn('[FatSecret] food detail failed:', e);
    return null;
  }
}

// ─── Barcode lookup ────────────────────────────────────────────────────────────

export async function lookupFatSecretBarcode(barcode: string): Promise<FoodResult | null> {
  try {
    const data = await callEdge({ action: 'barcode', code: barcode }) as any;

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
  } catch (e) {
    console.warn('[FatSecret] barcode lookup failed:', e);
    return null;
  }
}
