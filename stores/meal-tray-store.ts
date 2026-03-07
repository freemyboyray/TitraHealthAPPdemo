import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useLogStore, type MealType, type FoodSource } from './log-store';
import type { Database } from '../lib/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TrayItem = {
  id: string;
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  serving_g: number;
  source: FoodSource;
  serving_description?: string;
  barcode?: string;
  raw_ai_response?: object;
};

export type SavedMealItem = {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  serving_g: number;
};

export type SavedMeal = {
  id: string;
  name: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  items: SavedMealItem[];
};

export type RecentFood = {
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  is_favorite: boolean;
  log_count: number;
  source: string | null;
};

export type CustomFood = Database['public']['Tables']['user_custom_foods']['Row'];
type NewCustomFood = Omit<CustomFood, 'id' | 'user_id' | 'created_at'>;

// ─── Store type ───────────────────────────────────────────────────────────────

type MealTrayStore = {
  trayItems: TrayItem[];
  addToTray: (item: Omit<TrayItem, 'id'>) => void;
  removeFromTray: (id: string) => void;
  updateTrayItem: (id: string, patch: Partial<TrayItem>) => void;
  clearTray: () => void;
  logMeal: (meal_type: MealType) => Promise<void>;
  saveAsMeal: (name: string) => Promise<void>;
  loadSavedMeal: (meal: SavedMeal) => void;

  savedMeals: SavedMeal[];
  fetchSavedMeals: () => Promise<void>;
  deleteSavedMeal: (id: string) => Promise<void>;

  recentFoods: RecentFood[];
  fetchRecentFoods: () => Promise<void>;
  toggleFavorite: (food_name: string) => Promise<void>;

  customFoods: CustomFood[];
  fetchCustomFoods: () => Promise<void>;
  addCustomFood: (food: NewCustomFood) => Promise<void>;
  deleteCustomFood: (id: string) => Promise<void>;

  loading: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function upsertFoodPreference(item: TrayItem) {
  const { data: existing } = await supabase
    .from('user_food_preferences')
    .select('id, log_count')
    .eq('food_name', item.food_name)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('user_food_preferences')
      .update({
        log_count: (existing.log_count ?? 0) + 1,
        last_logged_at: new Date().toISOString(),
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fat_g: item.fat_g,
        fiber_g: item.fiber_g,
      })
      .eq('id', existing.id);
  } else {
    await supabase.from('user_food_preferences').insert({
      food_name: item.food_name,
      calories: item.calories,
      protein_g: item.protein_g,
      carbs_g: item.carbs_g,
      fat_g: item.fat_g,
      fiber_g: item.fiber_g,
      source: item.source,
      barcode: item.barcode ?? null,
    });
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMealTrayStore = create<MealTrayStore>((set, get) => ({
  trayItems: [],
  savedMeals: [],
  recentFoods: [],
  customFoods: [],
  loading: false,

  // ── Tray ──────────────────────────────────────────────────────────────────

  addToTray: (item) =>
    set((s) => ({ trayItems: [...s.trayItems, { ...item, id: uid() }] })),

  removeFromTray: (id) =>
    set((s) => ({ trayItems: s.trayItems.filter((it) => it.id !== id) })),

  updateTrayItem: (id, patch) =>
    set((s) => ({
      trayItems: s.trayItems.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    })),

  clearTray: () => set({ trayItems: [] }),

  logMeal: async (meal_type) => {
    const { trayItems } = get();
    if (trayItems.length === 0) return;
    set({ loading: true });
    try {
      const { addFoodLog } = useLogStore.getState();
      for (const item of trayItems) {
        await addFoodLog({
          food_name: item.food_name,
          calories: item.calories,
          protein_g: item.protein_g,
          carbs_g: item.carbs_g,
          fat_g: item.fat_g,
          fiber_g: item.fiber_g,
          meal_type,
          source: item.source,
          barcode: item.barcode,
          raw_ai_response: item.raw_ai_response,
        });
        await upsertFoodPreference(item);
      }
      set({ trayItems: [], loading: false });
      get().fetchRecentFoods();
    } catch {
      set({ loading: false });
    }
  },

  saveAsMeal: async (name) => {
    const { trayItems } = get();
    if (trayItems.length === 0) return;
    set({ loading: true });

    const total_calories = trayItems.reduce((s, it) => s + it.calories, 0);
    const total_protein_g = trayItems.reduce((s, it) => s + it.protein_g, 0);
    const total_carbs_g = trayItems.reduce((s, it) => s + it.carbs_g, 0);
    const total_fat_g = trayItems.reduce((s, it) => s + it.fat_g, 0);

    try {
      const { data: meal, error } = await supabase
        .from('user_saved_meals')
        .insert({ name, total_calories, total_protein_g, total_carbs_g, total_fat_g })
        .select()
        .single();
      if (error || !meal) throw error;

      await supabase.from('user_saved_meal_items').insert(
        trayItems.map((it) => ({
          saved_meal_id: meal.id,
          food_name: it.food_name,
          calories: it.calories,
          protein_g: it.protein_g,
          carbs_g: it.carbs_g,
          fat_g: it.fat_g,
          fiber_g: it.fiber_g,
          serving_g: it.serving_g,
        })),
      );

      await get().fetchSavedMeals();
    } finally {
      set({ loading: false });
    }
  },

  loadSavedMeal: (meal) =>
    set({
      trayItems: meal.items.map((it) => ({
        id: uid(),
        food_name: it.food_name,
        calories: it.calories,
        protein_g: it.protein_g,
        carbs_g: it.carbs_g,
        fat_g: it.fat_g,
        fiber_g: it.fiber_g,
        serving_g: it.serving_g,
        source: 'manual' as FoodSource,
      })),
    }),

  // ── Saved meals ───────────────────────────────────────────────────────────

  fetchSavedMeals: async () => {
    const { data } = await supabase
      .from('user_saved_meals')
      .select('*, user_saved_meal_items(*)')
      .order('last_used_at', { ascending: false, nullsFirst: false });
    if (!data) return;
    set({
      savedMeals: (data as any[]).map((m) => ({
        id: m.id,
        name: m.name,
        total_calories: m.total_calories ?? 0,
        total_protein_g: m.total_protein_g ?? 0,
        total_carbs_g: m.total_carbs_g ?? 0,
        total_fat_g: m.total_fat_g ?? 0,
        items: (m.user_saved_meal_items ?? []).map((it: any) => ({
          food_name: it.food_name,
          calories: it.calories ?? 0,
          protein_g: it.protein_g ?? 0,
          carbs_g: it.carbs_g ?? 0,
          fat_g: it.fat_g ?? 0,
          fiber_g: it.fiber_g ?? 0,
          serving_g: it.serving_g ?? 100,
        })),
      })),
    });
  },

  deleteSavedMeal: async (id) => {
    await supabase.from('user_saved_meals').delete().eq('id', id);
    set((s) => ({ savedMeals: s.savedMeals.filter((m) => m.id !== id) }));
  },

  // ── Recent & favorites ────────────────────────────────────────────────────

  fetchRecentFoods: async () => {
    const { data } = await supabase
      .from('user_food_preferences')
      .select('*')
      .order('last_logged_at', { ascending: false })
      .limit(20);
    if (!data) return;
    set({
      recentFoods: data.map((r) => ({
        food_name: r.food_name,
        calories: r.calories ?? 0,
        protein_g: r.protein_g ?? 0,
        carbs_g: r.carbs_g ?? 0,
        fat_g: r.fat_g ?? 0,
        fiber_g: r.fiber_g ?? 0,
        is_favorite: r.is_favorite ?? false,
        log_count: r.log_count ?? 1,
        source: r.source,
      })),
    });
  },

  toggleFavorite: async (food_name) => {
    const food = get().recentFoods.find((f) => f.food_name === food_name);
    if (!food) return;
    const newVal = !food.is_favorite;
    await supabase
      .from('user_food_preferences')
      .update({ is_favorite: newVal })
      .eq('food_name', food_name);
    set((s) => ({
      recentFoods: s.recentFoods.map((f) =>
        f.food_name === food_name ? { ...f, is_favorite: newVal } : f,
      ),
    }));
  },

  // ── Custom foods ──────────────────────────────────────────────────────────

  fetchCustomFoods: async () => {
    const { data } = await supabase
      .from('user_custom_foods')
      .select('*')
      .order('created_at', { ascending: false });
    set({ customFoods: data ?? [] });
  },

  addCustomFood: async (food) => {
    set({ loading: true });
    const { data } = await supabase
      .from('user_custom_foods')
      .insert(food as any)
      .select()
      .single();
    if (data) {
      set((s) => ({ customFoods: [data, ...s.customFoods], loading: false }));
    } else {
      set({ loading: false });
    }
  },

  deleteCustomFood: async (id) => {
    await supabase.from('user_custom_foods').delete().eq('id', id);
    set((s) => ({ customFoods: s.customFoods.filter((f) => f.id !== id) }));
  },
}));
