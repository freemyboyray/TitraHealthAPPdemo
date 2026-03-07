const USDA_KEY = process.env.EXPO_PUBLIC_USDA_API_KEY ?? 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

export type ServingOption = { label: string; grams: number };

export type FoodResult = {
  fdcId: number;
  name: string;
  brand: string;
  calories: number;   // per 100 g
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  serving_description?: string;   // e.g. "1 breast"
  serving_size_g?: number;        // grams for that serving
  serving_options?: ServingOption[];
};

export async function searchUSDA(query: string): Promise<FoodResult[]> {
  const url =
    `${USDA_BASE}/foods/search?query=${encodeURIComponent(query)}&api_key=${USDA_KEY}` +
    `&dataType=Foundation,SR%20Legacy,Branded&pageSize=25`;
  const res = await fetch(url);
  const json = await res.json();
  return (json.foods ?? []).map((f: any) => {
    const getNutrient = (id: number) =>
      f.foodNutrients?.find((n: any) => n.nutrientId === id)?.value ?? 0;

    const householdServing = f.householdServingFullText as string | undefined;
    const servingG: number | undefined =
      f.servingSize && f.servingSizeUnit === 'g' ? f.servingSize : undefined;

    const servingOptions: ServingOption[] = [];
    if (householdServing && servingG) {
      servingOptions.push({ label: `${householdServing} (${Math.round(servingG)}g)`, grams: servingG });
    } else if (servingG && servingG !== 100) {
      servingOptions.push({ label: `1 serving (${Math.round(servingG)}g)`, grams: servingG });
    }
    // Always include standard increments as fallback options
    for (const g of [50, 100, 150, 200, 250]) {
      if (!servingOptions.some((o) => o.grams === g)) {
        servingOptions.push({ label: `${g}g`, grams: g });
      }
    }
    servingOptions.sort((a, b) => a.grams - b.grams);

    return {
      fdcId: f.fdcId,
      name: f.description ?? '',
      brand: f.brandOwner ?? f.brandName ?? '',
      calories: Math.round(getNutrient(1008)),
      protein_g: parseFloat(getNutrient(1003).toFixed(1)),
      carbs_g: parseFloat(getNutrient(1005).toFixed(1)),
      fat_g: parseFloat(getNutrient(1004).toFixed(1)),
      fiber_g: parseFloat(getNutrient(1079).toFixed(1)),
      serving_description: householdServing,
      serving_size_g: servingG,
      serving_options: servingOptions,
    };
  });
}
