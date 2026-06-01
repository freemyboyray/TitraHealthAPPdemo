import { create } from 'zustand';
import { AppState } from 'react-native';
import { searchUSDA, getFatSecretFood } from '../lib/usda';
import { estimateMacrosWithAI, callGPT4oMiniVision, generateSearchVariants, selectBestFoodMatches } from '../lib/openai';
import { scheduleFoodReadyNotification } from '../lib/notifications';
import type { FoodResult } from '../lib/fatsecret';

// Vision now groups what it sees into DISHES (composite entities) made of
// component ingredients — e.g. a bacon-egg-cheese bagel is ONE dish with four
// components, not four separate logs.
const VISION_SYSTEM = `You are a food logging assistant. Look at the photo and identify the distinct DISHES on the plate.
A "dish" is one thing a person eats as a unit — a sandwich, a bowl, a salad, a drink, a piece of fruit.
Group the ingredients that make up a single dish into its "components". Keep clearly separate foods as separate dishes
(e.g. a sandwich, a side of fries, and a soda are THREE dishes).
For each component:
- "item": a SINGULAR name (e.g. "apple", "fried egg", not "3 apples").
- "quantity": how many identical units there are (default 1). If you see 3 apples, that's ONE component with quantity 3 — never three separate components.
- "estimated_g": grams of ONE unit, from visual context (plate size, utensils).
Give each dish a short natural name a person would say (e.g. "Bacon Egg & Cheese Bagel", "Side Salad").
Return ONLY a valid JSON array, no other text:
[{"name":"Bacon Egg & Cheese Bagel","components":[{"item":"bacon","quantity":2,"estimated_g":15},{"item":"fried egg","quantity":1,"estimated_g":50},{"item":"american cheese","quantity":1,"estimated_g":20},{"item":"plain bagel","quantity":1,"estimated_g":85}]}]`;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'processing' | 'ready' | 'failed';

// A single ingredient inside a dish. Carries its candidate matches so the user
// can later inspect/swap it from the composition view.
export type Component = {
  item: string;            // AI label, e.g. "fried egg"
  estimated_g: number;     // AI's per-unit portion guess (grams of ONE unit)
  quantity: number;        // detected count of identical units (e.g. 3 apples → 3)
  results: FoodResult[];   // candidate matches (top one is selected by default)
  selectedIdx: number;     // index into results
  qty: string;             // user-facing quantity in the selected unit
  unitGrams: number;       // grams per 1 unit (e.g. 50 for "1 egg")
  unitLabel: string;       // display label ("egg", "cup", "g")
  resolving?: boolean;     // true while a re-describe swap is in flight
};

// A composite entity the user eats as a unit. Macros = sum of components.
export type Dish = {
  name: string;
  components: Component[];
};

export type ParsedComponent = { item: string; estimated_g: number; quantity?: number };

export type ParsedDish = {
  name: string;
  components: ParsedComponent[];
};

export type FoodTask = {
  id: string;
  status: TaskStatus;
  source: 'describe' | 'voice' | 'camera';
  createdAt: number;
  dishes: Dish[];
  parsedDishes: ParsedDish[];
  error?: string;
};

type FoodTaskStore = {
  tasks: FoodTask[];

  startTask: (params: {
    source: 'describe' | 'voice' | 'camera';
    parsedDishes?: ParsedDish[];
    photoBase64?: string;
    description?: string;
  }) => string;

  updateComponent: (taskId: string, dishIdx: number, compIdx: number, patch: Partial<Component>) => void;
  removeComponent: (taskId: string, dishIdx: number, compIdx: number) => void;
  swapComponent: (taskId: string, dishIdx: number, compIdx: number, newDescription: string) => void;
  removeTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  clearStaleTasks: () => void;
};

// ─── UUID helper ──────────────────────────────────────────────────────────────

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Resolve worker (operates on a flat list of ingredients) ───────────────────
// Takes parsed {item, estimated_g} ingredients and resolves each to a Component
// with candidate matches + a default serving. Order is preserved 1:1.

async function resolveComponents(
  parsed: ParsedComponent[],
): Promise<Component[]> {
  if (parsed.length === 0) return [];

  // ── Layer 1: Generate search variants via GPT ──────────────────────────
  const variantData = await generateSearchVariants(parsed.map((p) => p.item));

  // ── Layer 2: Fan-out FatSecret searches per variant, deduplicate ───────
  const itemsWithCandidates = await Promise.all(
    parsed.map(async (p, idx) => {
      const variants = variantData[idx]?.variants ?? [p.item];

      const allSearches = await Promise.all(
        variants.map(async (v) => {
          const results = await searchUSDA(v);
          return results.filter(
            (r) => r.calories > 0 || r.protein_g > 0 || r.carbs_g > 0 || r.fat_g > 0,
          );
        }),
      );

      const seen = new Set<number>();
      const candidates: FoodResult[] = [];
      for (const batch of allSearches) {
        for (const r of batch) {
          if (!seen.has(r.fdcId)) {
            seen.add(r.fdcId);
            candidates.push(r);
          }
        }
      }

      // Fallback to AI estimation if no database results at all
      if (candidates.length === 0) {
        const aiResult = await estimateMacrosWithAI(p.item);
        if (aiResult) candidates.push(aiResult as FoodResult);
      }

      return { parsed: p, candidates };
    }),
  );

  // ── Layer 3: GPT selects the best match per item ───────────────────────
  const needsSelection = itemsWithCandidates.filter((ic) => ic.candidates.length > 1);
  let selectedIndices: number[] = itemsWithCandidates.map(() => 0);

  if (needsSelection.length > 0) {
    const selectInput = itemsWithCandidates.map((ic) => ({
      originalItem: ic.parsed.item,
      candidates: ic.candidates.slice(0, 8).map((c) => ({
        name: c.name,
        brand: c.brand,
        calories: c.calories,
      })),
    }));
    selectedIndices = await selectBestFoodMatches(selectInput);
  }

  // ── Build components, keeping top candidates for user override ─────────
  return itemsWithCandidates.map((ic, idx) => {
    const top = ic.candidates[selectedIndices[idx] ?? 0];
    const firstServing = top?.serving_options?.[0];
    const useServing = top?.fdcId === -1 && firstServing && firstServing.label !== 'g';
    const quantity = Math.max(1, Math.round(ic.parsed.quantity ?? 1));

    return {
      item: ic.parsed.item,
      estimated_g: ic.parsed.estimated_g,
      quantity,
      results: ic.candidates.slice(0, 5),
      selectedIdx: selectedIndices[idx] ?? 0,
      // When a per-unit serving is in play, qty is the count; otherwise qty is
      // total grams = count × per-unit grams. (Serving options load async and
      // flip a 'g' component over to count-based in fetchServingOptions.)
      qty: useServing ? String(quantity) : String(Math.round(quantity * ic.parsed.estimated_g)),
      unitGrams: useServing ? firstServing.grams : 1,
      unitLabel: useServing ? firstServing.label : 'g',
    };
  });
}

// Resolve a list of dishes by flattening their components, resolving in one
// batch, then regrouping back into the original dish structure.
async function resolveDishes(parsedDishes: ParsedDish[]): Promise<Dish[]> {
  const flat: { item: string; estimated_g: number }[] = [];
  for (const d of parsedDishes) {
    for (const c of d.components) flat.push(c);
  }

  const resolvedFlat = await resolveComponents(flat);

  let cursor = 0;
  return parsedDishes.map((d) => {
    const components = d.components.map(() => resolvedFlat[cursor++]).filter(Boolean);
    return { name: d.name, components };
  });
}

// Background-fetch full serving options for the top match of every component.
// Patches in place via the store setter, keyed by dish + component index.
function fetchServingOptions(
  dishes: Dish[],
  taskId: string,
  set: (fn: (s: FoodTaskStore) => Partial<FoodTaskStore>) => void,
) {
  dishes.forEach((dish, di) => {
    dish.components.forEach((comp, ci) => {
      fetchComponentServingOptions(taskId, di, ci, comp, set);
    });
  });
}

async function fetchComponentServingOptions(
  taskId: string,
  dishIdx: number,
  compIdx: number,
  comp: Component,
  set: (fn: (s: FoodTaskStore) => Partial<FoodTaskStore>) => void,
) {
  const top = comp.results[comp.selectedIdx] ?? comp.results[0];
  if (!top || top.fdcId === -1) return;
  const detail = await getFatSecretFood(top.fdcId);
  if (!detail) return;
  const topIdx = comp.results.indexOf(top);

  set((s) => ({
    tasks: s.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const hasNutrition =
        detail.calories > 0 || detail.protein_g > 0 || detail.carbs_g > 0 || detail.fat_g > 0;
      return {
        ...t,
        dishes: t.dishes.map((dish, i) => {
          if (i !== dishIdx) return dish;
          return {
            ...dish,
            components: dish.components.map((it, j) => {
              if (j !== compIdx) return it;
              const firstOpt = detail.serving_options?.[0];
              const autoSwitch = firstOpt && it.unitLabel === 'g';
              return {
                ...it,
                ...(autoSwitch
                  ? { unitLabel: firstOpt.label, unitGrams: firstOpt.grams, qty: String(it.quantity ?? 1) }
                  : {}),
                results: it.results.map((r, ri) =>
                  ri === (topIdx >= 0 ? topIdx : 0)
                    ? {
                        ...r,
                        ...(hasNutrition
                          ? {
                              calories: detail.calories,
                              protein_g: detail.protein_g,
                              carbs_g: detail.carbs_g,
                              fat_g: detail.fat_g,
                              fiber_g: detail.fiber_g,
                              // Extended nutrients only exist on the food.get
                              // detail (the search payload omits them), so this
                              // merge is the only place they reach the result.
                              saturated_fat_g: detail.saturated_fat_g,
                              sugar_g: detail.sugar_g,
                              sodium_mg: detail.sodium_mg,
                              cholesterol_mg: detail.cholesterol_mg,
                              trans_fat_g: detail.trans_fat_g,
                              polyunsaturated_fat_g: detail.polyunsaturated_fat_g,
                              monounsaturated_fat_g: detail.monounsaturated_fat_g,
                              potassium_mg: detail.potassium_mg,
                              added_sugars_g: detail.added_sugars_g,
                              vitamin_a_mcg: detail.vitamin_a_mcg,
                              vitamin_c_mg: detail.vitamin_c_mg,
                              vitamin_d_mcg: detail.vitamin_d_mcg,
                              calcium_mg: detail.calcium_mg,
                              iron_mg: detail.iron_mg,
                            }
                          : {}),
                        serving_options: detail.serving_options,
                      }
                    : r,
                ),
              };
            }),
          };
        }),
      };
    }),
  }));
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useFoodTaskStore = create<FoodTaskStore>((set, get) => ({
  tasks: [],

  startTask: ({ source, parsedDishes, photoBase64, description }) => {
    const id = uuid();
    const task: FoodTask = {
      id,
      status: 'processing',
      source,
      createdAt: Date.now(),
      dishes: [],
      parsedDishes: parsedDishes ?? [],
    };

    set((s) => ({ tasks: [...s.tasks, task] }));

    // Fire-and-forget background processing
    (async () => {
      try {
        let dishesToResolve = parsedDishes ?? [];

        // If we have a photo, run vision first to get dishes + components
        if (photoBase64 && dishesToResolve.length === 0) {
          if (__DEV__) console.log('[FoodTask] Starting vision analysis, base64 length:', photoBase64.length);
          const userPrompt = description
            ? `Identify the dishes in this image and their components. The user describes this as: "${description}"`
            : 'Identify the dishes in this image and their components.';
          const raw = await callGPT4oMiniVision(
            VISION_SYSTEM,
            photoBase64,
            userPrompt,
          );
          if (__DEV__) console.log('[FoodTask] Vision raw response:', raw);
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          if (!jsonMatch) throw new Error('No JSON in vision response');
          const parsed: ParsedDish[] = JSON.parse(jsonMatch[0]);
          if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('No food items identified');
          // Defensive: drop malformed dishes / empty component lists
          dishesToResolve = parsed
            .filter((d) => d && Array.isArray(d.components) && d.components.length > 0)
            .map((d) => ({ name: d.name || 'Meal', components: d.components }));
          if (dishesToResolve.length === 0) throw new Error('No food items identified');

          // Persist for retry
          set((s) => ({
            tasks: s.tasks.map((t) => (t.id === id ? { ...t, parsedDishes: dishesToResolve } : t)),
          }));
        }

        const resolved = await resolveDishes(dishesToResolve);

        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, status: 'ready' as const, dishes: resolved } : t,
          ),
        }));

        // Background-fetch serving options (non-blocking)
        fetchServingOptions(resolved, id, set);

        // Push notification if app is backgrounded
        if (AppState.currentState !== 'active') {
          scheduleFoodReadyNotification(id);
        }
      } catch (err) {
        console.error('[FoodTask] Task failed:', err);
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id
              ? { ...t, status: 'failed' as const, error: err instanceof Error ? err.message : 'Unknown error' }
              : t,
          ),
        }));
      }
    })();

    return id;
  },

  updateComponent: (taskId, dishIdx, compIdx, patch) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          dishes: t.dishes.map((dish, i) =>
            i === dishIdx
              ? {
                  ...dish,
                  components: dish.components.map((c, j) => (j === compIdx ? { ...c, ...patch } : c)),
                }
              : dish,
          ),
        };
      }),
    }));
  },

  removeComponent: (taskId, dishIdx, compIdx) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          dishes: t.dishes.map((dish, i) =>
            i === dishIdx
              ? { ...dish, components: dish.components.filter((_, j) => j !== compIdx) }
              : dish,
          ),
        };
      }),
    }));
  },

  // Re-describe a single ingredient ("2 fried eggs") → re-resolve just it and
  // splice the new match back into the dish, recomputing happens in the UI.
  swapComponent: (taskId, dishIdx, compIdx, newDescription) => {
    const text = newDescription.trim();
    if (!text) return;
    get().updateComponent(taskId, dishIdx, compIdx, { resolving: true });

    (async () => {
      try {
        const prev = get().tasks
          .find((t) => t.id === taskId)?.dishes[dishIdx]?.components[compIdx];
        const estimated_g = prev?.estimated_g ?? 100;
        const [resolved] = await resolveComponents([{ item: text, estimated_g }]);
        if (!resolved) {
          get().updateComponent(taskId, dishIdx, compIdx, { resolving: false });
          return;
        }
        get().updateComponent(taskId, dishIdx, compIdx, { ...resolved, resolving: false });
        // Pull full serving options for the new match
        fetchComponentServingOptions(taskId, dishIdx, compIdx, resolved, set);
      } catch (err) {
        console.error('[FoodTask] swapComponent failed:', err);
        get().updateComponent(taskId, dishIdx, compIdx, { resolving: false });
      }
    })();
  },

  removeTask: (taskId) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
  },

  retryTask: (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
    get().startTask({ source: task.source, parsedDishes: task.parsedDishes });
  },

  clearStaleTasks: () => {
    const oneHourAgo = Date.now() - 3600000;
    set((s) => ({
      tasks: s.tasks.filter((t) => t.status === 'processing' || t.createdAt > oneHourAgo),
    }));
  },
}));
