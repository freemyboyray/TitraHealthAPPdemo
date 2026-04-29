import { create } from 'zustand';
import { AppState } from 'react-native';
import { searchUSDA, getFatSecretFood } from '../lib/usda';
import { estimateMacrosWithAI, callGPT4oMiniVision, generateSearchVariants, selectBestFoodMatches } from '../lib/openai';
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
  // ── Layer 1: Generate search variants via GPT ──────────────────────────
  if (__DEV__) console.log('[FoodTask] resolveItems: generating search variants for', parsedItems.length, 'items');
  const variantData = await generateSearchVariants(parsedItems.map((p) => p.item));
  if (__DEV__) console.log('[FoodTask] resolveItems: variants generated:', JSON.stringify(variantData));

  // ── Layer 2: Fan-out FatSecret searches per variant, deduplicate ───────
  const itemsWithCandidates = await Promise.all(
    parsedItems.map(async (p, idx) => {
      const variants = variantData[idx]?.variants ?? [p.item];
      if (__DEV__) console.log('[FoodTask] resolveItems: searching variants for', p.item, '→', variants);

      // Search all variants in parallel
      const allSearches = await Promise.all(
        variants.map(async (v) => {
          const results = await searchUSDA(v);
          return results.filter(
            (r) => r.calories > 0 || r.protein_g > 0 || r.carbs_g > 0 || r.fat_g > 0,
          );
        }),
      );

      // Flatten and deduplicate by fdcId, keeping first occurrence
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

      if (__DEV__) console.log('[FoodTask] resolveItems: found', candidates.length, 'unique candidates for', p.item);

      // Fallback to AI estimation if no database results at all
      if (candidates.length === 0) {
        if (__DEV__) console.log('[FoodTask] resolveItems: no FatSecret results, falling back to AI estimation for', p.item);
        const aiResult = await estimateMacrosWithAI(p.item);
        if (aiResult) candidates.push(aiResult as FoodResult);
      }

      return { parsed: p, candidates };
    }),
  );

  // ── Layer 3: GPT selects the best match per item ───────────────────────
  // Only run selection if we have candidates to choose from
  const needsSelection = itemsWithCandidates.filter((ic) => ic.candidates.length > 1);
  let selectedIndices: number[] = itemsWithCandidates.map(() => 0);

  if (needsSelection.length > 0) {
    if (__DEV__) console.log('[FoodTask] resolveItems: running GPT selection for', needsSelection.length, 'items');
    const selectInput = itemsWithCandidates.map((ic) => ({
      originalItem: ic.parsed.item,
      candidates: ic.candidates.slice(0, 8).map((c) => ({
        name: c.name,
        brand: c.brand,
        calories: c.calories,
      })),
    }));

    selectedIndices = await selectBestFoodMatches(selectInput);
    if (__DEV__) console.log('[FoodTask] resolveItems: GPT selected indices:', selectedIndices);
  }

  // ── Build resolved items with top candidates kept for user override ────
  return itemsWithCandidates.map((ic, idx) => {
    const top = ic.candidates[selectedIndices[idx] ?? 0];
    const firstServing = top?.serving_options?.[0];
    const useServing = top?.fdcId === -1 && firstServing && firstServing.label !== 'g';

    return {
      item: ic.parsed.item,
      estimated_g: ic.parsed.estimated_g,
      results: ic.candidates.slice(0, 5), // Keep top 5 for user to override
      selectedIdx: selectedIndices[idx] ?? 0,
      servingG: useServing ? String(firstServing.grams) : String(Math.round(ic.parsed.estimated_g)),
      selectedServingIdx: -1,
      qty: useServing ? '1' : String(Math.round(ic.parsed.estimated_g)),
      unitGrams: useServing ? firstServing.grams : 1,
      unitLabel: useServing ? firstServing.label : 'g',
    };
  });
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
            const firstOpt = detail.serving_options?.[0];
            const autoSwitch = firstOpt && it.unitLabel === 'g';
            return {
              ...it,
              ...(autoSwitch ? { unitLabel: firstOpt.label, unitGrams: firstOpt.grams, qty: '1', servingG: String(firstOpt.grams) } : {}),
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
          if (__DEV__) console.log('[FoodTask] Starting vision analysis, base64 length:', photoBase64.length);
          const raw = await callGPT4oMiniVision(
            VISION_SYSTEM,
            photoBase64,
            'Identify all food items in this image.',
          );
          if (__DEV__) console.log('[FoodTask] Vision raw response:', raw);
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          if (!jsonMatch) {
            console.error('[FoodTask] No JSON array found in vision response');
            throw new Error('No JSON in vision response');
          }
          const parsed: { item: string; estimated_g: number }[] = JSON.parse(jsonMatch[0]);
          if (__DEV__) console.log('[FoodTask] Vision parsed items:', JSON.stringify(parsed));
          if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('No food items identified');
          itemsToResolve = parsed;

          // Update stored parsedItems so retry works
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === id ? { ...t, parsedItems: itemsToResolve } : t,
            ),
          }));
        }

        if (__DEV__) console.log('[FoodTask] Resolving', itemsToResolve.length, 'items via FatSecret/USDA...');
        const resolved = await resolveItems(itemsToResolve);
        if (__DEV__) console.log('[FoodTask] Resolved items:', resolved.map((r) => ({
          item: r.item,
          matchCount: r.results.length,
          topMatch: r.results[0]?.name ?? 'none',
        })));

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
