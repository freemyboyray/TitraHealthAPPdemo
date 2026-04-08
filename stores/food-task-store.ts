import { create } from 'zustand';
import { AppState } from 'react-native';
import { searchUSDA, getFatSecretFood } from '../lib/usda';
import { estimateMacrosWithAI, callGPT4oMiniVision } from '../lib/openai';
import { scheduleFoodReadyNotification } from '../lib/notifications';
import type { FoodResult } from '../lib/fatsecret';

const VISION_SYSTEM = `You are a food logging assistant. Identify ALL food items visible in this photo.
For each, estimate the portion size in grams based on visual context (plate size, utensils, etc).
Return ONLY a valid JSON array, no other text:
[{"item": "specific food name", "estimated_g": 200}]
Be specific. For mixed dishes, break into components if visible.`;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'processing' | 'ready' | 'failed';

export type ResolvedItem = {
  item: string;
  estimated_g: number;
  results: FoodResult[];
  selectedIdx: number;
  servingG: string;
  selectedServingIdx: number;
  qty: string;
  unitGrams: number;
  unitLabel: string;
};

export type FoodTask = {
  id: string;
  status: TaskStatus;
  source: 'describe' | 'voice' | 'camera';
  createdAt: number;
  resolvedItems: ResolvedItem[];
  parsedItems: { item: string; estimated_g: number }[];
  error?: string;
};

type FoodTaskStore = {
  tasks: FoodTask[];

  startTask: (params: {
    source: 'describe' | 'voice' | 'camera';
    parsedItems?: { item: string; estimated_g: number }[];
    photoBase64?: string;
  }) => string;

  updateTaskItem: (taskId: string, itemIdx: number, patch: Partial<ResolvedItem>) => void;
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

// ─── Resolve worker ───────────────────────────────────────────────────────────

async function resolveItems(
  parsedItems: { item: string; estimated_g: number }[],
): Promise<ResolvedItem[]> {
  return Promise.all(
    parsedItems.map(async (p) => {
      let results = await searchUSDA(p.item);
      results = results.filter(
        (r) => r.calories > 0 || r.protein_g > 0 || r.carbs_g > 0 || r.fat_g > 0,
      );
      if (results.length === 0) {
        const aiResult = await estimateMacrosWithAI(p.item);
        if (aiResult) results = [aiResult as FoodResult];
      }
      return {
        item: p.item,
        estimated_g: p.estimated_g,
        results,
        selectedIdx: 0,
        servingG: String(Math.round(p.estimated_g)),
        selectedServingIdx: -1,
        qty: String(Math.round(p.estimated_g)),
        unitGrams: 1,
        unitLabel: 'g',
      };
    }),
  );
}

async function fetchServingOptions(
  items: ResolvedItem[],
  taskId: string,
  set: (fn: (s: FoodTaskStore) => Partial<FoodTaskStore>) => void,
) {
  items.forEach(async (wi, idx) => {
    const top = wi.results[0];
    if (!top || top.fdcId === -1) return;
    const detail = await getFatSecretFood(top.fdcId);
    if (!detail) return;
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const hasNutrition =
          detail.calories > 0 || detail.protein_g > 0 || detail.carbs_g > 0 || detail.fat_g > 0;
        return {
          ...t,
          resolvedItems: t.resolvedItems.map((it, i) => {
            if (i !== idx) return it;
            return {
              ...it,
              results: it.results.map((r, ri) =>
                ri === 0
                  ? {
                      ...r,
                      ...(hasNutrition
                        ? {
                            calories: detail.calories,
                            protein_g: detail.protein_g,
                            carbs_g: detail.carbs_g,
                            fat_g: detail.fat_g,
                            fiber_g: detail.fiber_g,
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
    }));
  });
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useFoodTaskStore = create<FoodTaskStore>((set, get) => ({
  tasks: [],

  startTask: ({ source, parsedItems, photoBase64 }) => {
    const id = uuid();
    const task: FoodTask = {
      id,
      status: 'processing',
      source,
      createdAt: Date.now(),
      resolvedItems: [],
      parsedItems: parsedItems ?? [],
    };

    set((s) => ({ tasks: [...s.tasks, task] }));

    // Fire-and-forget background processing
    (async () => {
      try {
        // If we have a photo, run vision first to get parsed items
        let itemsToResolve = parsedItems ?? [];
        if (photoBase64 && itemsToResolve.length === 0) {
          const raw = await callGPT4oMiniVision(
            VISION_SYSTEM,
            photoBase64,
            'Identify all food items in this image.',
          );
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          if (!jsonMatch) throw new Error('No JSON in vision response');
          const parsed: { item: string; estimated_g: number }[] = JSON.parse(jsonMatch[0]);
          if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('No food items identified');
          itemsToResolve = parsed;

          // Update stored parsedItems so retry works
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, parsedItems: itemsToResolve } : t,
            ),
          }));
        }

        const resolved = await resolveItems(itemsToResolve);

        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, status: 'ready' as const, resolvedItems: resolved } : t,
          ),
        }));

        // Background-fetch serving options (non-blocking)
        fetchServingOptions(resolved, id, set);

        // Send push notification if app is backgrounded
        if (AppState.currentState !== 'active') {
          scheduleFoodReadyNotification(id);
        }
      } catch (err) {
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

  updateTaskItem: (taskId, itemIdx, patch) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          resolvedItems: t.resolvedItems.map((it, i) =>
            i === itemIdx ? { ...it, ...patch } : it,
          ),
        };
      }),
    }));
  },

  removeTask: (taskId) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
  },

  retryTask: (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    // Remove old task and start fresh with the same parsed items
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== taskId) }));
    get().startTask({ source: task.source, parsedItems: task.parsedItems });
  },

  clearStaleTasks: () => {
    const oneHourAgo = Date.now() - 3600000;
    set((s) => ({
      tasks: s.tasks.filter((t) => t.status === 'processing' || t.createdAt > oneHourAgo),
    }));
  },
}));
