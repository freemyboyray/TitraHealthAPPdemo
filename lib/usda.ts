const USDA_KEY = 'DEMO_KEY';
const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1';

export type FoodResult = {
  fdcId: number;
  name: string;
  brand: string;
  calories: number;   // per 100 g
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
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
    return {
      fdcId: f.fdcId,
      name: f.description ?? '',
      brand: f.brandOwner ?? f.brandName ?? '',
      calories: Math.round(getNutrient(1008)),
      protein_g: parseFloat(getNutrient(1003).toFixed(1)),
      carbs_g: parseFloat(getNutrient(1005).toFixed(1)),
      fat_g: parseFloat(getNutrient(1004).toFixed(1)),
      fiber_g: parseFloat(getNutrient(1079).toFixed(1)),
    };
  });
}
