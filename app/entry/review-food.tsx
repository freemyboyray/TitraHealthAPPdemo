import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoodTaskStore, type Component as FoodComponent, type Dish } from '../../stores/food-task-store';
import { useMealTrayStore } from '../../stores/meal-tray-store';
import { useHealthKitStore } from '../../stores/healthkit-store';
import { useHealthData } from '@/contexts/health-data';
import { useUiStore } from '@/stores/ui-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  Droplet,
  Dumbbell,
  Flame,
  Leaf,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';

// ─── Macro icon colors (semantic, theme-independent) ────────────────────────
const MACRO_COLORS = {
  cal: '#FF742A',
  protein: '#E74C6F',
  carbs: '#F6A623',
  fat: '#5B8BF5',
  fiber: '#34C759',
};

type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  grams: number;
  saturated_fat?: number;
  sugar?: number;
  sodium?: number;
  cholesterol?: number;
  trans_fat?: number;
  polyunsaturated_fat?: number;
  monounsaturated_fat?: number;
  potassium?: number;
  added_sugars?: number;
  vitamin_a?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  calcium?: number;
  iron?: number;
};

const EMPTY: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, grams: 0 };

// Grams currently selected for a component (qty × grams-per-unit).
function componentGrams(comp: FoodComponent): number {
  const q = parseFloat(comp.qty) || 1;
  return q * comp.unitGrams;
}

// Macros for a single component at its selected serving.
function componentMacros(comp: FoodComponent): Macros {
  const food = comp.results[comp.selectedIdx];
  if (!food) return { ...EMPTY };
  const g = componentGrams(comp);
  const scale = g / 100;
  const opt = (v?: number) => (v == null ? undefined : v * scale);
  return {
    calories: food.calories * scale,
    protein: food.protein_g * scale,
    carbs: food.carbs_g * scale,
    fat: food.fat_g * scale,
    fiber: food.fiber_g * scale,
    grams: g,
    saturated_fat: opt(food.saturated_fat_g),
    sugar: opt(food.sugar_g),
    sodium: opt(food.sodium_mg),
    cholesterol: opt(food.cholesterol_mg),
    trans_fat: opt(food.trans_fat_g),
    polyunsaturated_fat: opt(food.polyunsaturated_fat_g),
    monounsaturated_fat: opt(food.monounsaturated_fat_g),
    potassium: opt(food.potassium_mg),
    added_sugars: opt(food.added_sugars_g),
    vitamin_a: opt(food.vitamin_a_mcg),
    vitamin_c: opt(food.vitamin_c_mg),
    vitamin_d: opt(food.vitamin_d_mcg),
    calcium: opt(food.calcium_mg),
    iron: opt(food.iron_mg),
  };
}

function addMacros(a: Macros, b: Macros): Macros {
  const add = (x?: number, y?: number) =>
    x == null && y == null ? undefined : (x ?? 0) + (y ?? 0);
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    grams: a.grams + b.grams,
    saturated_fat: add(a.saturated_fat, b.saturated_fat),
    sugar: add(a.sugar, b.sugar),
    sodium: add(a.sodium, b.sodium),
    cholesterol: add(a.cholesterol, b.cholesterol),
    trans_fat: add(a.trans_fat, b.trans_fat),
    polyunsaturated_fat: add(a.polyunsaturated_fat, b.polyunsaturated_fat),
    monounsaturated_fat: add(a.monounsaturated_fat, b.monounsaturated_fat),
    potassium: add(a.potassium, b.potassium),
    added_sugars: add(a.added_sugars, b.added_sugars),
    vitamin_a: add(a.vitamin_a, b.vitamin_a),
    vitamin_c: add(a.vitamin_c, b.vitamin_c),
    vitamin_d: add(a.vitamin_d, b.vitamin_d),
    calcium: add(a.calcium, b.calcium),
    iron: add(a.iron, b.iron),
  };
}

function dishMacros(dish: Dish): Macros {
  return dish.components.reduce((acc, c) => addMacros(acc, componentMacros(c)), { ...EMPTY });
}

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => parseFloat(n.toFixed(1));

// ─── Animated number (JS count-up; renders as plain Text) ────────────────────
// Tweens the displayed value toward `target` with easeOutCubic. Each instance
// only re-renders itself, so a handful animating at once stays cheap.
function useCountUp(target: number, duration = 350): number {
  const [val, setVal] = useState(target);
  const displayed = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = displayed.current;
    if (Math.abs(from - target) < 0.005) {
      displayed.current = target;
      setVal(target);
      return;
    }
    let start: number | null = null;
    const tick = (ts: number) => {
      if (start == null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (target - from) * eased;
      displayed.current = cur;
      setVal(cur);
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        displayed.current = target;
        setVal(target);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return val;
}

function AnimatedNumber({
  value,
  decimals = 0,
  suffix = '',
  style,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  style?: any;
}) {
  const v = useCountUp(value);
  return <Text style={style}>{`${v.toFixed(decimals)}${suffix}`}</Text>;
}

function ExpandChevron({ open, color }: { open: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(open ? '180deg' : '0deg', { duration: 200 }) }],
  }));
  return (
    <Animated.View style={style}>
      <ChevronDown size={16} color={color} />
    </Animated.View>
  );
}

export default function ReviewFoodScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const task = useFoodTaskStore((st) => st.tasks.find((t) => t.id === taskId));
  const updateComponent = useFoodTaskStore((st) => st.updateComponent);
  const removeComponent = useFoodTaskStore((st) => st.removeComponent);
  const swapComponent = useFoodTaskStore((st) => st.swapComponent);
  const removeTask = useFoodTaskStore((st) => st.removeTask);
  const retryTask = useFoodTaskStore((st) => st.retryTask);

  const { addToTray, logMeal } = useMealTrayStore();
  const hkStore = useHealthKitStore();
  const { refreshActuals } = useHealthData();
  const setInsightsDefaultTab = useUiStore((st) => st.setInsightsDefaultTab);

  const dishes = task?.dishes ?? [];

  // Which dishes will be logged (default: all)
  const [included, setIncluded] = useState<Set<number>>(new Set());
  // Which dish compositions are expanded
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  // Inline re-describe state: "di:ci" → draft text
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (task?.status === 'ready') {
      setIncluded(new Set(task.dishes.map((_, i) => i)));
    }
  }, [task?.status]);

  const toggleInclude = useCallback((idx: number) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const toggleExpand = useCallback((idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  // Meal total across included dishes
  const total = useMemo(() => {
    let acc: Macros = { ...EMPTY };
    for (const idx of Array.from(included)) {
      const dish = dishes[idx];
      if (dish) acc = addMacros(acc, dishMacros(dish));
    }
    return acc;
  }, [dishes, included]);

  // ── Quantity stepper (unit-aware) ──────────────────────────────────────────
  const adjustQty = useCallback(
    (dishIdx: number, compIdx: number, dir: 1 | -1) => {
      if (!taskId) return;
      const comp = dishes[dishIdx]?.components[compIdx];
      if (!comp) return;
      const step = comp.unitLabel === 'g' ? 5 : 1;
      const min = comp.unitLabel === 'g' ? 5 : 1;
      const current = parseFloat(comp.qty) || 1;
      const next = Math.max(min, current + dir * step);
      updateComponent(taskId, dishIdx, compIdx, {
        qty: String(next % 1 === 0 ? next : r1(next)),
      });
    },
    [taskId, dishes, updateComponent],
  );

  const openRedescribe = useCallback((dishIdx: number, compIdx: number) => {
    setEditing(`${dishIdx}:${compIdx}`);
    setEditText('');
  }, []);

  const submitRedescribe = useCallback(
    (dishIdx: number, compIdx: number) => {
      if (!taskId || !editText.trim()) return;
      swapComponent(taskId, dishIdx, compIdx, editText.trim());
      setEditing(null);
      setEditText('');
    },
    [taskId, editText, swapComponent],
  );

  const handleConfirm = useCallback(async () => {
    if (!task || !taskId) return;
    setLogging(true);
    try {
      for (const idx of Array.from(included)) {
        const dish = dishes[idx];
        if (!dish || dish.components.length === 0) continue;

        const m = dishMacros(dish);
        const composition = dish.components.map((c) => {
          const food = c.results[c.selectedIdx];
          const cm = componentMacros(c);
          return {
            item: c.item,
            matched_name: food?.name ?? c.item,
            brand: food?.brand || undefined,
            qty: c.qty,
            unit: c.unitLabel,
            grams: r0(cm.grams),
            calories: r0(cm.calories),
            protein_g: r1(cm.protein),
            carbs_g: r1(cm.carbs),
            fat_g: r1(cm.fat),
            fiber_g: r1(cm.fiber),
            // Full extended nutrients per ingredient, so Top Contributors and
            // future per-ingredient analysis can attribute micros (sodium, sat
            // fat, etc.) to the ingredient — not just the composite dish.
            saturated_fat_g: cm.saturated_fat != null ? r1(cm.saturated_fat) : undefined,
            sugar_g: cm.sugar != null ? r1(cm.sugar) : undefined,
            sodium_mg: cm.sodium != null ? r0(cm.sodium) : undefined,
            cholesterol_mg: cm.cholesterol != null ? r0(cm.cholesterol) : undefined,
            trans_fat_g: cm.trans_fat != null ? r1(cm.trans_fat) : undefined,
            polyunsaturated_fat_g: cm.polyunsaturated_fat != null ? r1(cm.polyunsaturated_fat) : undefined,
            monounsaturated_fat_g: cm.monounsaturated_fat != null ? r1(cm.monounsaturated_fat) : undefined,
            potassium_mg: cm.potassium != null ? r0(cm.potassium) : undefined,
            added_sugars_g: cm.added_sugars != null ? r1(cm.added_sugars) : undefined,
            vitamin_a_mcg: cm.vitamin_a != null ? r1(cm.vitamin_a) : undefined,
            vitamin_c_mg: cm.vitamin_c != null ? r1(cm.vitamin_c) : undefined,
            vitamin_d_mcg: cm.vitamin_d != null ? r1(cm.vitamin_d) : undefined,
            calcium_mg: cm.calcium != null ? r0(cm.calcium) : undefined,
            iron_mg: cm.iron != null ? r1(cm.iron) : undefined,
            fatsecret_food_id:
              food && Number.isFinite(food.fdcId) && food.fdcId > 0 ? food.fdcId : undefined,
          };
        });

        addToTray({
          food_name: dish.name,
          calories: r0(m.calories),
          protein_g: r1(m.protein),
          carbs_g: r1(m.carbs),
          fat_g: r1(m.fat),
          fiber_g: r1(m.fiber),
          serving_g: r0(m.grams),
          source: task.source === 'camera' ? 'photo_ai' : 'manual',
          serving_description:
            dish.components.length > 1 ? `${dish.components.length} ingredients` : undefined,
          saturated_fat_g: m.saturated_fat != null ? r1(m.saturated_fat) : undefined,
          sugar_g: m.sugar != null ? r1(m.sugar) : undefined,
          sodium_mg: m.sodium != null ? r0(m.sodium) : undefined,
          cholesterol_mg: m.cholesterol != null ? r0(m.cholesterol) : undefined,
          trans_fat_g: m.trans_fat != null ? r1(m.trans_fat) : undefined,
          polyunsaturated_fat_g: m.polyunsaturated_fat != null ? r1(m.polyunsaturated_fat) : undefined,
          monounsaturated_fat_g: m.monounsaturated_fat != null ? r1(m.monounsaturated_fat) : undefined,
          potassium_mg: m.potassium != null ? r0(m.potassium) : undefined,
          added_sugars_g: m.added_sugars != null ? r1(m.added_sugars) : undefined,
          vitamin_a_mcg: m.vitamin_a != null ? r1(m.vitamin_a) : undefined,
          vitamin_c_mg: m.vitamin_c != null ? r1(m.vitamin_c) : undefined,
          vitamin_d_mcg: m.vitamin_d != null ? r1(m.vitamin_d) : undefined,
          calcium_mg: m.calcium != null ? r0(m.calcium) : undefined,
          iron_mg: m.iron != null ? r1(m.iron) : undefined,
          raw_ai_response: { kind: 'composite', dish: dish.name, components: composition },
        });
      }

      await logMeal('snack');
      const synced = await hkStore.writeNutrition({
        calories: r0(total.calories),
        protein: r1(total.protein),
        carbs: r1(total.carbs),
        fat: r1(total.fat),
        fiber: r1(total.fiber),
      });
      if (synced) useUiStore.getState().showHealthSyncToast('Nutrition saved to Apple Health');
      refreshActuals();
      removeTask(taskId);
      setInsightsDefaultTab('lifestyle');
      router.replace('/(tabs)/log' as any);
    } catch {
      setLogging(false);
    }
  }, [task, taskId, included, dishes, total]);

  // ── Loading / Error / Not-found states ──────────────────────────────────────

  if (!task) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.centered}>
          <AlertCircle size={48} color={colors.textMuted} />
          <Text style={s.emptyText}>Task not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (task.status === 'processing') {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Analyzing…</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.orange} />
          <Text style={[s.emptyText, { marginTop: 16 }]}>Looking up nutrition data…</Text>
        </View>
      </View>
    );
  }

  if (task.status === 'failed') {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Analysis Failed</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.centered}>
          <AlertCircle size={48} color="#E74C3C" />
          <Text style={[s.emptyText, { marginTop: 12 }]}>{task.error ?? 'Something went wrong'}</Text>
          <TouchableOpacity
            onPress={() => retryTask(taskId!)}
            style={[s.backBtn, { backgroundColor: colors.orange }]}
          >
            <Text style={[s.backBtnText, { color: '#FFF' }]}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Ready state ──────────────────────────────────────────────────────────

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Review Meal</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Meal total ── */}
        <View style={s.totalCard}>
          <Text style={s.totalLabel}>MEAL TOTAL</Text>
          <View style={s.totalCalRow}>
            <Flame size={26} color={MACRO_COLORS.cal} />
            <AnimatedNumber value={total.calories} style={s.totalCalValue} />
            <Text style={s.totalCalUnit}>cal</Text>
          </View>
          <View style={s.totalMacroRow}>
            <TotalMacro label="Protein" value={total.protein} color={MACRO_COLORS.protein} s={s} />
            <TotalMacro label="Carbs" value={total.carbs} color={MACRO_COLORS.carbs} s={s} />
            <TotalMacro label="Fat" value={total.fat} color={MACRO_COLORS.fat} s={s} />
            <TotalMacro label="Fiber" value={total.fiber} color={MACRO_COLORS.fiber} s={s} />
          </View>
        </View>

        {/* ── Dishes ── */}
        {dishes.map((dish, di) => {
          const isIncluded = included.has(di);
          const isOpen = expanded.has(di);
          const m = dishMacros(dish);

          return (
            <Animated.View
              key={di}
              layout={LinearTransition.duration(220)}
              style={[s.card, !isIncluded && { opacity: 0.45 }]}
            >
              {/* Header: checkbox + name + dish calories */}
              <View style={s.dishHeader}>
                <TouchableOpacity onPress={() => toggleInclude(di)} hitSlop={8} style={{ marginTop: 2 }}>
                  <LucideIconByName
                    name={isIncluded ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isIncluded ? colors.orange : colors.textMuted}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={s.dishName} numberOfLines={2}>{dish.name}</Text>
                  <Text style={s.dishSub}>
                    {dish.components.length} ingredient{dish.components.length !== 1 ? 's' : ''} · {r0(m.grams)}g
                  </Text>
                </View>
                <View style={s.dishCal}>
                  <AnimatedNumber value={m.calories} style={s.dishCalValue} />
                  <Text style={s.dishCalUnit}>cal</Text>
                </View>
              </View>

              {/* Dish macro chips */}
              <View style={s.chipRow}>
                <MacroChip icon={<Dumbbell size={13} color={MACRO_COLORS.protein} />} value={m.protein} s={s} />
                <MacroChip icon={<Leaf size={13} color={MACRO_COLORS.carbs} />} value={m.carbs} s={s} />
                <MacroChip icon={<Droplet size={13} color={MACRO_COLORS.fat} />} value={m.fat} s={s} />
              </View>

              {/* What's this made of? */}
              <TouchableOpacity style={s.expandBtn} onPress={() => toggleExpand(di)} activeOpacity={0.7}>
                <Sparkles size={15} color={colors.orange} />
                <Text style={s.expandBtnText}>
                  {isOpen ? 'Hide ingredients' : "What's this made of?"}
                </Text>
                <ExpandChevron open={isOpen} color={colors.textMuted} />
              </TouchableOpacity>

              {/* ── Composition ── */}
              {isOpen && (
                <Animated.View
                  style={s.composition}
                  entering={FadeInDown.duration(200)}
                  exiting={FadeOutUp.duration(160)}
                >
                  {dish.components.map((comp, ci) => {
                    const food = comp.results[comp.selectedIdx];
                    const cm = componentMacros(comp);
                    const key = `${di}:${ci}`;
                    const isEditing = editing === key;
                    const servingLabel = comp.unitLabel !== 'g' ? comp.unitLabel : `${r0(componentGrams(comp))}g`;

                    return (
                      <Animated.View key={ci} layout={LinearTransition.duration(220)} style={s.compRow}>
                        {comp.resolving && (
                          <Animated.View
                            style={s.compLoading}
                            entering={FadeIn.duration(150)}
                            exiting={FadeOut.duration(150)}
                          >
                            <ActivityIndicator size="small" color={colors.orange} />
                          </Animated.View>
                        )}

                        {/* Top line: name + remove */}
                        <View style={s.compTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.compName} numberOfLines={2}>
                              {food ? food.name : comp.item}
                            </Text>
                            {food?.brand ? <Text style={s.compBrand}>{food.brand}</Text> : null}
                            {!food ? (
                              <Text style={s.compMissing}>No match — re-describe below</Text>
                            ) : null}
                          </View>
                          <Pressable onPress={() => removeComponent(taskId!, di, ci)} hitSlop={8} style={s.compRemove}>
                            <X size={16} color={colors.textMuted} />
                          </Pressable>
                        </View>

                        {/* Stepper + per-ingredient serving & macros */}
                        <View style={s.compMid}>
                          <View style={s.stepper}>
                            <Pressable onPress={() => adjustQty(di, ci, -1)} style={s.stepperBtn} hitSlop={6}>
                              <Minus size={16} color={colors.textPrimary} />
                            </Pressable>
                            <Text style={s.stepperValue}>{comp.qty}</Text>
                            <Pressable onPress={() => adjustQty(di, ci, 1)} style={s.stepperBtn} hitSlop={6}>
                              <Plus size={16} color={colors.textPrimary} />
                            </Pressable>
                          </View>
                          <View style={s.compInfo}>
                            <Text style={s.compUnit} numberOfLines={2}>{servingLabel}</Text>
                            <Text style={s.compMacro} numberOfLines={1}>
                              {r0(cm.calories)} cal · {r1(cm.protein)}P · {r1(cm.carbs)}C · {r1(cm.fat)}F
                            </Text>
                          </View>
                        </View>

                        {/* Alternatives (already-fetched matches) */}
                        {comp.results.length > 1 && (
                          <View style={s.altRow}>
                            {comp.results.slice(0, 4).map((alt, ai) => {
                              const sel = ai === comp.selectedIdx;
                              return (
                                <TouchableOpacity
                                  key={ai}
                                  onPress={() => updateComponent(taskId!, di, ci, { selectedIdx: ai })}
                                  style={[s.altPill, sel && { borderColor: colors.orange, backgroundColor: colors.orangeDim }]}
                                >
                                  <Text
                                    style={[s.altPillText, sel && { color: colors.orange, fontWeight: '700' }]}
                                    numberOfLines={1}
                                  >
                                    {alt.name}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}

                        {/* Re-describe */}
                        {isEditing ? (
                          <View style={s.redescribeRow}>
                            <TextInput
                              value={editText}
                              onChangeText={setEditText}
                              placeholder={`e.g. "2 fried eggs"`}
                              placeholderTextColor={colors.textMuted}
                              style={s.redescribeInput}
                              autoFocus
                              returnKeyType="search"
                              onSubmitEditing={() => submitRedescribe(di, ci)}
                            />
                            <TouchableOpacity
                              style={[s.redescribeBtn, !editText.trim() && { opacity: 0.4 }]}
                              disabled={!editText.trim()}
                              onPress={() => submitRedescribe(di, ci)}
                            >
                              <RefreshCw size={15} color="#FFF" />
                            </TouchableOpacity>
                            <Pressable onPress={() => setEditing(null)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
                              <X size={16} color={colors.textMuted} />
                            </Pressable>
                          </View>
                        ) : (
                          <TouchableOpacity style={s.changeBtn} onPress={() => openRedescribe(di, ci)}>
                            <Text style={s.changeBtnText}>Not right? Describe it</Text>
                          </TouchableOpacity>
                        )}
                      </Animated.View>
                    );
                  })}
                </Animated.View>
              )}
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <BlurView intensity={85} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)' },
          ]}
        />
        <TouchableOpacity
          style={[s.confirmBtn, (included.size === 0 || logging) && { opacity: 0.4 }]}
          onPress={handleConfirm}
          disabled={included.size === 0 || logging}
          activeOpacity={0.85}
        >
          {logging ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={s.confirmBtnText}>
              Log Meal · {r0(total.calories)} cal
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Small presentational helpers ───────────────────────────────────────────

function TotalMacro({ label, value, color, s }: { label: string; value: number; color: string; s: any }) {
  return (
    <View style={s.totalMacro}>
      <View style={[s.totalMacroDot, { backgroundColor: color }]} />
      <AnimatedNumber value={value} decimals={1} suffix="g" style={s.totalMacroValue} />
      <Text style={s.totalMacroLabel}>{label}</Text>
    </View>
  );
}

function MacroChip({ icon, value, s }: { icon: React.ReactNode; value: number; s: any }) {
  return (
    <View style={s.macroChip}>
      {icon}
      <AnimatedNumber value={value} decimals={1} suffix="g" style={s.macroChipText} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { fontSize: 17, color: c.textSecondary, textAlign: 'center' },
    backBtn: {
      marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20,
      backgroundColor: c.borderSubtle,
    },
    backBtnText: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 12,
    },
    headerTitle: { fontSize: 19, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3 },

    // ─── Meal total ───────────────────────────────────────────────
    totalCard: {
      backgroundColor: c.cardBg,
      borderRadius: 22,
      padding: 20,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    totalLabel: {
      fontSize: 11, fontWeight: '700', color: c.textMuted,
      letterSpacing: 2, marginBottom: 8,
    },
    totalCalRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
    totalCalValue: { fontSize: 42, fontWeight: '800', color: c.textPrimary, letterSpacing: -1, lineHeight: 44 },
    totalCalUnit: { fontSize: 16, fontWeight: '600', color: c.textMuted, marginBottom: 5 },
    totalMacroRow: { flexDirection: 'row', justifyContent: 'space-between' },
    totalMacro: { flex: 1, alignItems: 'flex-start' },
    totalMacroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
    totalMacroValue: { fontSize: 17, fontWeight: '800', color: c.textPrimary },
    totalMacroLabel: { fontSize: 11, fontWeight: '500', color: c.textMuted, marginTop: 1, letterSpacing: 0.2 },

    // ─── Dish card ────────────────────────────────────────────────
    card: {
      backgroundColor: c.cardBg,
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    dishHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    dishName: { fontSize: 19, fontWeight: '700', color: c.textPrimary, lineHeight: 25 },
    dishSub: { fontSize: 13, color: c.textMuted, marginTop: 3 },
    dishCal: { alignItems: 'flex-end' },
    dishCalValue: { fontSize: 22, fontWeight: '800', color: MACRO_COLORS.cal, letterSpacing: -0.5 },
    dishCalUnit: { fontSize: 11, fontWeight: '600', color: c.textMuted, marginTop: -2 },

    chipRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    macroChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: w(0.04), borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    },
    macroChipText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },

    expandBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 14, paddingVertical: 10, paddingHorizontal: 12,
      borderRadius: 12, borderWidth: 1, borderColor: c.border,
      backgroundColor: w(0.02),
    },
    expandBtnText: { flex: 1, fontSize: 14, fontWeight: '700', color: c.textPrimary },

    // ─── Composition ──────────────────────────────────────────────
    composition: { marginTop: 12, gap: 12 },
    compRow: {
      backgroundColor: w(0.03), borderRadius: 16, padding: 14,
      borderWidth: 1, borderColor: c.borderSubtle,
    },
    compLoading: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 16,
      backgroundColor: c.isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)',
      alignItems: 'center', justifyContent: 'center', zIndex: 2,
    },
    compTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    compName: { fontSize: 16, fontWeight: '700', color: c.textPrimary, lineHeight: 21 },
    compBrand: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    compMissing: { fontSize: 12, color: '#E74C3C', marginTop: 3, fontWeight: '600' },
    compRemove: { padding: 2 },

    compMid: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
    stepper: {
      flexDirection: 'row', alignItems: 'center',
      borderRadius: 10, borderWidth: 1, borderColor: c.border, overflow: 'hidden',
    },
    stepperBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    stepperValue: { fontSize: 15, fontWeight: '700', color: c.textPrimary, minWidth: 26, textAlign: 'center' },
    compInfo: { flex: 1, minWidth: 0 },
    compUnit: { fontSize: 13, fontWeight: '600', color: c.textSecondary, lineHeight: 17 },
    compMacro: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginTop: 3 },

    altRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    altPill: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9,
      borderWidth: 1, borderColor: c.border, maxWidth: '100%',
    },
    altPillText: { fontSize: 12, color: c.textSecondary, fontWeight: '500' },

    changeBtn: { marginTop: 10, alignSelf: 'flex-start' },
    changeBtnText: { fontSize: 13, fontWeight: '700', color: c.orange },

    redescribeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    redescribeInput: {
      flex: 1, height: 40, borderRadius: 12, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 12, color: c.textPrimary, fontSize: 14, backgroundColor: w(0.03),
    },
    redescribeBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: c.orange,
      alignItems: 'center', justifyContent: 'center',
    },

    // ─── Footer ───────────────────────────────────────────────────
    footer: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
      paddingTop: 16, paddingHorizontal: 20,
    },
    confirmBtn: {
      backgroundColor: c.isDark ? '#1A1A1A' : '#111111',
      borderRadius: 28, paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    },
    confirmBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },
  });
}
