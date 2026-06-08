// Barcode → food resolution shared by the scan-barcode screen.
// Tries Open Food Facts first (free, fast, broad packaged-food coverage) and
// falls back to FatSecret. Both paths normalize to a FoodResult whose macros
// are PER-100g (the canonical form the food-task store / review screen expect),
// so a scanned product flows straight into addReadyDish without double-counting.
import { lookupFatSecretBarcode, type FoodResult } from './fatsecret';

async function lookupOpenFoodFacts(barcode: string): Promise<FoodResult | null> {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
      { cache: 'no-store' },
    );
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const n = p.nutriments ?? {};
    const num = (v: any) => {
      const f = parseFloat(v);
      return Number.isFinite(f) ? f : 0;
    };
    const r1 = (v: number) => parseFloat(v.toFixed(1));

    const result: FoodResult = {
      // fdcId -1 marks a non-FatSecret food: addReadyDish skips re-hydration
      // (there's no FatSecret id to fetch) and componentFromResult defaults the
      // serving to 100g, which matches the per-100g macros below.
      fdcId: -1,
      name: p.product_name ?? p.product_name_en ?? 'Scanned product',
      brand: p.brands ?? '',
      calories: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
      protein_g: r1(num(n['proteins_100g'])),
      carbs_g: r1(num(n['carbohydrates_100g'])),
      fat_g: r1(num(n['fat_100g'])),
      fiber_g: r1(num(n['fiber_100g'])),
      serving_size_g: 100,
      serving_options: [{ label: '100g', grams: 100, isDefault: true }],
    };
    // Extended nutrients — only set when Open Food Facts actually returned a
    // value, preserving the "not provided" vs. "real zero" distinction.
    if (n['saturated-fat_100g'] != null) result.saturated_fat_g = parseFloat(num(n['saturated-fat_100g']).toFixed(2));
    if (n['sugars_100g'] != null) result.sugar_g = r1(num(n['sugars_100g']));
    // OFF reports sodium in grams per 100g; food_logs stores milligrams.
    if (n['sodium_100g'] != null) result.sodium_mg = Math.round(num(n['sodium_100g']) * 1000);
    if (n['cholesterol_100g'] != null) result.cholesterol_mg = Math.round(num(n['cholesterol_100g']) * 1000);
    const img = p.image_front_small_url ?? p.image_front_url ?? p.image_url;
    if (img) result.image_url = img;
    return result;
  } catch {
    return null;
  }
}

export async function resolveBarcodeToFood(barcode: string): Promise<FoodResult | null> {
  const off = await lookupOpenFoodFacts(barcode);
  if (off) return off;
  return lookupFatSecretBarcode(barcode);
}
