// Calls FatSecret directly from the app.
// For production: move these behind a server with a static IP and keep them server-side.
const CLIENT_ID = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET ?? '';

const TOKEN_URL = 'https://oauth.fatsecret.com/connect/token';
const FS_BASE = 'https://platform.fatsecret.com/rest/server.api';

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

// ─── OAuth token (fetched fresh each call — 24h lifetime, fine at MVP scale) ──

async function getToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'basic',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`FatSecret token error: ${res.status}`);
  const json = await res.json();
  return json.access_token as string;
}

// ─── REST API call ─────────────────────────────────────────────────────────────

async function callFS(token: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(FS_BASE);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`FatSecret API error: ${res.status}`);
  return res.json();
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
    const token = await getToken();
    const data = await callFS(token, {
      method: 'foods.search',
      search_expression: query,
      max_results: '20',
      page_number: '0',
    }) as any;

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
    const token = await getToken();
    const data = await callFS(token, {
      method: 'food.get.v4',
      food_id: String(foodId),
    }) as any;

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

// ─── Barcode lookup ────────────────────────────────────────────────────────────

export async function lookupFatSecretBarcode(barcode: string): Promise<FoodResult | null> {
  try {
    const token = await getToken();
    const barcodeRes = await callFS(token, {
      method: 'food.find_id_for_barcode',
      barcode,
    }) as any;

    const foodId = barcodeRes?.food_id?.value;
    if (!foodId) return null;

    const data = await callFS(token, {
      method: 'food.get.v4',
      food_id: foodId,
    }) as any;

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
