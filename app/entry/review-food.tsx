import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFoodTaskStore, type ParsedDish } from '../../stores/food-task-store';
import { parseDescriptionToDishes } from '../../lib/food-parse';
import { useMealTrayStore } from '../../stores/meal-tray-store';
import { useHealthKitStore } from '../../stores/healthkit-store';
import { useHealthData } from '@/contexts/health-data';
import { useUiStore } from '@/stores/ui-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import {
  MACRO_COLORS,
  EMPTY,
  componentMacros,
  addMacros,
  dishMacros,
  r0,
  r1,
  type Macros,
} from '@/lib/food-macros';
import { NutritionLabelModal } from '@/components/food/nutrition-label-modal';
import { FoodNotIdentifiedModal } from '@/components/food/food-not-identified-modal';
import { DescribeFoodSheet } from '@/components/describe-food-sheet';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CupSoda,
  Droplet,
  Dumbbell,
  EggFried,
  ImagePlus,
  Leaf,
  Pencil,
  Trash2,
  Utensils,
  X,
} from 'lucide-react-native';
import { classifyBeverage, hydrationMl, mlToOz, type BeverageInfo } from '@/lib/beverage';

// Map a task source to the DB food_source enum.
const SOURCE_MAP: Record<string, 'manual' | 'barcode' | 'photo_ai' | 'search_db'> = {
  camera: 'photo_ai',
  describe: 'manual',
  voice: 'manual',
  search: 'search_db',
  barcode: 'barcode',
  manual: 'manual',
};

// Classify a dish as a beverage (only single-item dishes can be a drink).
function dishBeverage(dish: { name: string; components: { results: any[]; selectedIdx: number }[] }): BeverageInfo {
  if (dish.components.length !== 1) return { isBeverage: false, kind: 'other', hydrationFactor: 0 };
  const food = dish.components[0].results[dish.components[0].selectedIdx];
  return classifyBeverage(food?.name ?? dish.name, food?.category_name);
}

// A single dish's user-facing serving label for the card row.
// The unitLabel already names ONE serving (e.g. "1 miniature (8g)", "100g"), so
// qty is a multiplier — render it as "N ×", never juxtaposed (which read as a
// duplicate number like "1 1 miniature").
function dishServingLabel(dish: { components: { qty: string; unitLabel: string }[]; portion: number }): string {
  let base: string;
  if (dish.components.length === 1) {
    const c = dish.components[0];
    const q = parseFloat(c.qty) || 1;
    base = c.unitLabel === 'g'
      ? `${r0(q)} g`
      : q === 1 ? c.unitLabel : `${r1(q)} × ${c.unitLabel}`;
  } else {
    base = `${dish.components.length} ingredients`;
  }
  return dish.portion !== 1 ? `${r1(dish.portion)} × ${base}` : base;
}

// ─── Animated number (JS count-up; renders as plain Text) ────────────────────
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

// ─── Failed-state describe fallback ──────────────────────────────────────────
function FailedStateWithDescribe({
  taskId,
  error,
  insets,
  colors,
  s,
}: {
  taskId: string;
  error?: string;
  insets: { top: number };
  colors: AppColors;
  s: any;
}) {
  // Surface the real reason when we have a user-meaningful one (e.g. an
  // unsupported image format), stripping any technical "OpenAI API error NNN:"
  // prefix. Fall back to the generic describe prompt otherwise.
  const cleaned = error?.replace(/^OpenAI API error \d+:\s*/i, '').trim();
  const isImageError = !!cleaned && /image|format|unsupported|heic/i.test(cleaned);
  const failMessage = isImageError
    ? cleaned!
    : "We couldn't identify the food in your photo. Describe what you're eating below.";
  const [description, setDescription] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(true);
  const [describeOpen, setDescribeOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { isDark } = useAppTheme();
  const { startTask, retryTask, removeTask } = useFoodTaskStore();
  const router = useRouter();

  const handleLookup = async () => {
    if (!description.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const parsed: ParsedDish[] = await parseDescriptionToDishes(description.trim());
      removeTask(taskId);
      const newId = startTask({ source: 'describe', parsedDishes: parsed });
      router.setParams({ taskId: newId });
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Something went wrong');
      setParsing(false);
    }
  };

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Log food</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
        <View style={s.failIllu}>
          <Utensils size={32} color={colors.textMuted} />
          <Text style={s.failTitle}>{isImageError ? 'Image not supported' : 'Food not identified'}</Text>
          <Text style={s.failSub}>{failMessage}</Text>
        </View>

        <TextInput
          ref={inputRef}
          style={s.failInput}
          placeholder={`e.g. "2 fried eggs and toast"`}
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          editable={!parsing}
        />

        {parseError && <Text style={s.failError}>{parseError}</Text>}

        <TouchableOpacity
          onPress={handleLookup}
          disabled={parsing || !description.trim()}
          activeOpacity={0.85}
          style={[s.failBtn, { opacity: parsing || !description.trim() ? 0.45 : 1 }]}
        >
          {parsing ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.failBtnText}>Look it up</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => retryTask(taskId)} style={{ alignSelf: 'center', marginTop: 20, paddingVertical: 10 }} disabled={parsing}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Retry photo analysis</Text>
        </TouchableOpacity>
      </ScrollView>

      <FoodNotIdentifiedModal
        visible={modalVisible}
        colors={colors}
        isDark={isDark}
        title={isImageError ? 'Image not supported' : 'Food not identified'}
        message={
          isImageError
            ? failMessage
            : "We couldn't identify the food in your photo. Try a clearer photo, or describe your meal instead."
        }
        primaryLabel="Describe it instead"
        onPrimary={() => {
          setModalVisible(false);
          setTimeout(() => setDescribeOpen(true), 280);
        }}
        onDismiss={() => router.back()}
      />

      <DescribeFoodSheet
        visible={describeOpen}
        onClose={() => {
          setDescribeOpen(false);
          router.back();
        }}
      />
    </View>
  );
}

export default function ReviewFoodScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const task = useFoodTaskStore((st) => st.tasks.find((t) => t.id === taskId));
  const removeDish = useFoodTaskStore((st) => st.removeDish);
  const removeTask = useFoodTaskStore((st) => st.removeTask);

  const { addToTray, logMeal } = useMealTrayStore();
  const hkStore = useHealthKitStore();
  const { refreshActuals, dispatch } = useHealthData();
  const setInsightsDefaultTab = useUiStore((st) => st.setInsightsDefaultTab);

  const dishes = task?.dishes ?? [];

  const [logging, setLogging] = useState(false);
  const [loggedDate, setLoggedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  // Review-only photos: seeded from the task, addable in-screen, never persisted.
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (task?.photoUris) setPhotos(task.photoUris);
  }, [task?.id]);

  // Meal total across all dishes (each already portion-scaled by dishMacros).
  const total = useMemo(() => {
    let acc: Macros = { ...EMPTY };
    for (const dish of dishes) acc = addMacros(acc, dishMacros(dish));
    return acc;
  }, [dishes]);

  const handleRemoveDish = useCallback(
    (di: number) => {
      if (!taskId) return;
      if (dishes.length <= 1) {
        removeTask(taskId);
        router.back();
        return;
      }
      removeDish(taskId, di);
    },
    [taskId, dishes.length, removeDish, removeTask, router],
  );

  const handleEditDish = useCallback(
    (di: number) => {
      router.push(`/entry/edit-food?taskId=${taskId}&dishIdx=${di}` as any);
    },
    [taskId, router],
  );

  const handleAddFood = useCallback(() => {
    router.push(`/entry/add-food-search?taskId=${taskId}` as any);
  }, [taskId, router]);

  const handleDiscard = useCallback(() => {
    if (taskId) removeTask(taskId);
    router.back();
  }, [taskId, removeTask, router]);

  const handleAttachPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!task || !taskId) return;
    setLogging(true);
    try {
      let hydrationCredit = 0; // mL credited to daily water from beverages
      for (const dish of dishes) {
        if (!dish || dish.components.length === 0) continue;

        const m = dishMacros(dish);
        const bev = dishBeverage(dish);
        if (bev.isBeverage && bev.hydrationFactor > 0) {
          hydrationCredit += hydrationMl(m.grams, bev.hydrationFactor);
        }
        // Components are stored at portion=1 (the base recipe); the flat dish
        // row carries the portion-scaled truth. Persist a per-component scale so
        // raw_ai_response reflects the logged amount.
        const composition = dish.components.map((c) => {
          const food = c.results[c.selectedIdx];
          const cm = componentMacros(c);
          const p = dish.portion;
          return {
            item: c.item,
            matched_name: food?.name ?? c.item,
            brand: food?.brand || undefined,
            qty: c.qty,
            unit: c.unitLabel,
            portion: p,
            grams: r0(cm.grams * p),
            calories: r0(cm.calories * p),
            protein_g: r1(cm.protein * p),
            carbs_g: r1(cm.carbs * p),
            fat_g: r1(cm.fat * p),
            fiber_g: r1(cm.fiber * p),
            saturated_fat_g: cm.saturated_fat != null ? r1(cm.saturated_fat * p) : undefined,
            sugar_g: cm.sugar != null ? r1(cm.sugar * p) : undefined,
            sodium_mg: cm.sodium != null ? r0(cm.sodium * p) : undefined,
            cholesterol_mg: cm.cholesterol != null ? r0(cm.cholesterol * p) : undefined,
            trans_fat_g: cm.trans_fat != null ? r1(cm.trans_fat * p) : undefined,
            polyunsaturated_fat_g: cm.polyunsaturated_fat != null ? r1(cm.polyunsaturated_fat * p) : undefined,
            monounsaturated_fat_g: cm.monounsaturated_fat != null ? r1(cm.monounsaturated_fat * p) : undefined,
            potassium_mg: cm.potassium != null ? r0(cm.potassium * p) : undefined,
            added_sugars_g: cm.added_sugars != null ? r1(cm.added_sugars * p) : undefined,
            vitamin_a_mcg: cm.vitamin_a != null ? r1(cm.vitamin_a * p) : undefined,
            vitamin_c_mg: cm.vitamin_c != null ? r1(cm.vitamin_c * p) : undefined,
            vitamin_d_mcg: cm.vitamin_d != null ? r1(cm.vitamin_d * p) : undefined,
            calcium_mg: cm.calcium != null ? r0(cm.calcium * p) : undefined,
            iron_mg: cm.iron != null ? r1(cm.iron * p) : undefined,
            fatsecret_food_id: food && Number.isFinite(food.fdcId) && food.fdcId > 0 ? food.fdcId : undefined,
          };
        });

        const food0 = dish.components[0]?.results[dish.components[0]?.selectedIdx];

        addToTray({
          food_name: dish.name,
          calories: r0(m.calories),
          protein_g: r1(m.protein),
          carbs_g: r1(m.carbs),
          fat_g: r1(m.fat),
          fiber_g: r1(m.fiber),
          serving_g: r0(m.grams),
          source: SOURCE_MAP[task.source] ?? 'manual',
          serving_description: dishServingLabel(dish),
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
          image_url: food0?.image_url,
          raw_ai_response: { kind: 'composite', dish: dish.name, portion: dish.portion, components: composition },
        });
      }

      await logMeal('snack', loggedDate.toISOString());
      const synced = await hkStore.writeNutrition({
        calories: r0(total.calories),
        protein: r1(total.protein),
        carbs: r1(total.carbs),
        fat: r1(total.fat),
        fiber: r1(total.fiber),
      });
      if (synced) useUiStore.getState().showHealthSyncToast('Nutrition saved to Apple Health');

      // Credit beverage fluid to today's hydration (drinks add water too). Only
      // for meals logged today — water is tracked per calendar day.
      const isToday = loggedDate.toDateString() === new Date().toDateString();
      if (hydrationCredit > 0 && isToday) {
        dispatch({ type: 'LOG_WATER', ml: hydrationCredit });
        hkStore.writeWater(hydrationCredit);
      }

      refreshActuals();
      removeTask(taskId);
      setInsightsDefaultTab('lifestyle');
      router.replace('/(tabs)/log' as any);
    } catch {
      setLogging(false);
    }
  }, [task, taskId, dishes, total, loggedDate]);

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
    return <FailedStateWithDescribe taskId={taskId!} error={task.error} insets={insets} colors={colors} s={s} />;
  }

  // ── Ready state (Bevel "Log food") ───────────────────────────────────────
  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleDiscard} hitSlop={12} style={s.headerIconBtn}>
          <Trash2 size={20} color="#E74C3C" />
        </Pressable>
        <Text style={s.headerTitle}>Log food</Text>
        <Pressable onPress={handleAddFood} hitSlop={12} style={s.headerIconBtn}>
          <Text style={s.headerPlus}>＋</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Photo row (review-only) ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoRow}>
          {photos.map((uri, i) => (
            <Image key={i} source={{ uri }} style={s.photoThumb} />
          ))}
          <TouchableOpacity style={s.photoAttach} onPress={handleAttachPhoto} activeOpacity={0.7}>
            <ImagePlus size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </ScrollView>

        {/* ── Food cards ── */}
        {dishes.map((dish, di) => {
          const m = dishMacros(dish);
          const food0 = dish.components[0]?.results[dish.components[0]?.selectedIdx];
          const img = food0?.image_url;
          const bev = dishBeverage(dish);
          const hydrOz = bev.isBeverage && bev.hydrationFactor > 0 ? Math.round(mlToOz(hydrationMl(m.grams, bev.hydrationFactor))) : 0;
          return (
            <Animated.View key={di} layout={LinearTransition.duration(220)} style={s.card}>
              <View style={s.cardTop}>
                <View style={s.cardThumb}>
                  {img ? (
                    <Image source={{ uri: img }} style={s.cardThumbImg} />
                  ) : bev.isBeverage ? (
                    <CupSoda size={20} color={colors.textMuted} />
                  ) : (
                    <Utensils size={20} color={colors.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardName} numberOfLines={2}>
                    {dish.name}
                  </Text>
                  <Text style={s.cardSub}>
                    {food0?.brand || 'Common'} · {r0(m.calories)} calories
                  </Text>
                  {hydrOz > 0 && (
                    <View style={s.hydrChip}>
                      <Droplet size={12} color="#3FA9F5" fill="#3FA9F5" />
                      <Text style={s.hydrChipText}>+{hydrOz} oz hydration</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Serving selector → opens edit */}
              <TouchableOpacity style={s.servingRow} onPress={() => handleEditDish(di)} activeOpacity={0.7}>
                <Text style={s.servingText}>{dishServingLabel(dish)}</Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </TouchableOpacity>

              {/* Remove / Edit */}
              <View style={s.cardActions}>
                <TouchableOpacity style={s.cardAction} onPress={() => handleRemoveDish(di)} activeOpacity={0.7}>
                  <X size={15} color="#E74C3C" />
                  <Text style={[s.cardActionText, { color: '#E74C3C' }]}>Remove</Text>
                </TouchableOpacity>
                <View style={s.cardActionDivider} />
                <TouchableOpacity style={s.cardAction} onPress={() => handleEditDish(di)} activeOpacity={0.7}>
                  <Pencil size={14} color={colors.textSecondary} />
                  <Text style={s.cardActionText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}

        {/* ── When did you eat this? ── */}
        <View style={s.dateCard}>
          <TouchableOpacity style={s.dateRow} onPress={() => setShowDatePicker((v) => !v)} activeOpacity={0.7}>
            <CalendarDays size={18} color={colors.textMuted} />
            <Text style={s.dateLabel}>Date</Text>
            <Text style={s.dateValue}>
              {loggedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' at '}
              {loggedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <View style={s.datePickerWrap}>
              <DateTimePicker
                value={loggedDate}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={(_, date) => {
                  if (Platform.OS !== 'ios') setShowDatePicker(false);
                  if (date) setLoggedDate(date);
                }}
                themeVariant={colors.isDark ? 'dark' : 'light'}
                style={{ alignSelf: 'center' }}
              />
            </View>
          )}
        </View>
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

        {/* Tappable summary → nutrition label */}
        <TouchableOpacity style={s.summaryRow} onPress={() => setLabelOpen(true)} activeOpacity={0.7}>
          <AnimatedNumber value={total.calories} suffix=" calories" style={s.summaryCal} />
          <View style={s.summaryPills}>
            <SummaryPill icon={<Dumbbell size={12} color={MACRO_COLORS.protein} />} value={total.protein} s={s} />
            <SummaryPill icon={<Leaf size={12} color={MACRO_COLORS.carbs} />} value={total.carbs} s={s} />
            <SummaryPill icon={<EggFried size={12} color={MACRO_COLORS.fat} />} value={total.fat} s={s} />
            <ChevronRight size={16} color={colors.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.confirmBtn, (dishes.length === 0 || logging) && { opacity: 0.4 }]}
          onPress={handleConfirm}
          disabled={dishes.length === 0 || logging}
          activeOpacity={0.85}
        >
          {logging ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={s.confirmBtnText}>Add to log</Text>}
        </TouchableOpacity>
      </View>

      <NutritionLabelModal visible={labelOpen} onClose={() => setLabelOpen(false)} macros={total} />
    </View>
  );
}

// ─── Small presentational helpers ───────────────────────────────────────────

function SummaryPill({ icon, value, s }: { icon: React.ReactNode; value: number; s: any }) {
  return (
    <View style={s.summaryPill}>
      {icon}
      <AnimatedNumber value={value} decimals={0} suffix="g" style={s.summaryPillText} />
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
      marginTop: 20,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 20,
      backgroundColor: c.borderSubtle,
    },
    backBtnText: { fontSize: 16, fontWeight: '700', color: c.textPrimary },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    headerTitle: { fontSize: 19, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3 },
    headerIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerPlus: { fontSize: 26, fontWeight: '500', color: c.textPrimary, lineHeight: 28 },

    // ─── Photo row ────────────────────────────────────────────────
    photoRow: { gap: 10, paddingBottom: 18, alignItems: 'center' },
    photoThumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: w(0.06) },
    photoAttach: {
      width: 64,
      height: 64,
      borderRadius: 14,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ─── Food card ────────────────────────────────────────────────
    card: {
      backgroundColor: c.cardBg,
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardThumb: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: w(0.06),
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    cardThumbImg: { width: 44, height: 44 },
    cardName: { fontSize: 16, fontWeight: '700', color: c.textPrimary, lineHeight: 21 },
    cardSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    hydrChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start' },
    hydrChipText: { fontSize: 12, fontWeight: '700', color: '#3FA9F5' },

    servingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: w(0.02),
    },
    servingText: { fontSize: 14, fontWeight: '600', color: c.textPrimary },

    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingTop: 4,
    },
    cardAction: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
    cardActionDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: c.border },
    cardActionText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },

    // ─── Date card ────────────────────────────────────────────────
    dateCard: {
      backgroundColor: c.cardBg,
      borderRadius: 18,
      marginTop: 2,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      overflow: 'hidden',
    },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 16 },
    dateLabel: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
    dateValue: { flex: 1, textAlign: 'right', fontSize: 15, fontWeight: '600', color: c.textSecondary },
    datePickerWrap: { borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingVertical: 8 },

    // ─── Footer ───────────────────────────────────────────────────
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
      paddingTop: 14,
      paddingHorizontal: 20,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 4,
      marginBottom: 6,
    },
    summaryCal: { fontSize: 18, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3 },
    summaryPills: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    summaryPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    summaryPillText: { fontSize: 14, fontWeight: '700', color: c.textSecondary },
    confirmBtn: {
      backgroundColor: c.isDark ? '#1A1A1A' : '#111111',
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF', letterSpacing: 0.3 },

    // ─── Failed state ─────────────────────────────────────────────
    failIllu: { alignItems: 'center', paddingVertical: 24 },
    failTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, marginTop: 14, marginBottom: 8 },
    failSub: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
    failInput: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      fontSize: 16,
      color: c.textPrimary,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    failError: { fontSize: 13, color: '#E74C3C', marginTop: 8 },
    failBtn: { backgroundColor: c.orange, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
    failBtnText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  });
}
