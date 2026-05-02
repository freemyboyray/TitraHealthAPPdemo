import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoodTaskStore } from '../../stores/food-task-store';
import { useMealTrayStore } from '../../stores/meal-tray-store';
import { useHealthKitStore } from '../../stores/healthkit-store';
import { useHealthData } from '@/contexts/health-data';
import { useUiStore } from '@/stores/ui-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { GlassBorder } from '@/components/ui/glass-border';
import { computeMealScore } from '@/constants/meal-score';
import { daysSinceInjection, getShotPhase } from '@/constants/scoring';

// ─── Macro icon colors (semantic, theme-independent) ────────────────────────
const MACRO_COLORS = {
  cal: '#FF742A',
  protein: '#E74C6F',
  carbs: '#F6A623',
  fat: '#5B8BF5',
  fiber: '#34C759',
};

export default function ReviewFoodScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const task = useFoodTaskStore((s) => s.tasks.find((t) => t.id === taskId));
  const updateTaskItem = useFoodTaskStore((s) => s.updateTaskItem);
  const removeTask = useFoodTaskStore((s) => s.removeTask);
  const retryTask = useFoodTaskStore((s) => s.retryTask);

  const { addToTray, logMeal } = useMealTrayStore();
  const hkStore = useHealthKitStore();
  const healthData = useHealthData();
  const { refreshActuals } = healthData;
  const setInsightsDefaultTab = useUiStore((s) => s.setInsightsDefaultTab);

  const shotPhase = getShotPhase(daysSinceInjection(healthData.profile.lastInjectionDate));
  const sideEffects = healthData.profile.sideEffects ?? [];

  const [checkedItems, setCheckedItems] = useState<Set<number>>(
    new Set(
      task?.resolvedItems.flatMap((it, i) => (it.results[it.selectedIdx] ? [i] : [])) ?? [],
    ),
  );
  const [logging, setLogging] = useState(false);

  useEffect(() => {
    if (task?.status === 'ready') {
      setCheckedItems(
        new Set(
          task.resolvedItems.flatMap((it, i) => (it.results[it.selectedIdx] ? [i] : [])),
        ),
      );
    }
  }, [task?.status]);

  const toggleCheck = useCallback((idx: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const totals = useMemo(() => {
    if (!task?.resolvedItems) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
    let cal = 0, pro = 0, carb = 0, fat = 0, fib = 0;
    for (const idx of Array.from(checkedItems)) {
      const item = task.resolvedItems[idx];
      if (!item) continue;
      const food = item.results[item.selectedIdx];
      if (!food) continue;
      const q = parseFloat(item.qty) || 1;
      const g = q * item.unitGrams;
      cal += food.calories * g / 100;
      pro += food.protein_g * g / 100;
      carb += food.carbs_g * g / 100;
      fat += food.fat_g * g / 100;
      fib += food.fiber_g * g / 100;
    }
    return {
      calories: Math.round(cal),
      protein: parseFloat(pro.toFixed(1)),
      carbs: parseFloat(carb.toFixed(1)),
      fat: parseFloat(fat.toFixed(1)),
      fiber: parseFloat(fib.toFixed(1)),
    };
  }, [task?.resolvedItems, checkedItems]);

  const handleConfirm = useCallback(async () => {
    if (!task || !taskId) return;
    setLogging(true);
    try {
      for (const idx of Array.from(checkedItems)) {
        const item = task.resolvedItems[idx];
        if (!item) continue;
        const food = item.results[item.selectedIdx];
        if (!food) continue;
        const q = parseFloat(item.qty) || 1;
        const g = q * item.unitGrams;
        addToTray({
          food_name: food.name + (food.brand ? ` (${food.brand})` : ''),
          calories: Math.round(food.calories * g / 100),
          protein_g: parseFloat((food.protein_g * g / 100).toFixed(1)),
          carbs_g: parseFloat((food.carbs_g * g / 100).toFixed(1)),
          fat_g: parseFloat((food.fat_g * g / 100).toFixed(1)),
          fiber_g: parseFloat((food.fiber_g * g / 100).toFixed(1)),
          serving_g: g,
          source: task.source === 'camera' ? 'photo_ai' : 'manual',
          serving_description: item.unitLabel !== 'g' ? `${item.qty} ${item.unitLabel}` : undefined,
        });
      }
      await logMeal('snack');
      const synced = await hkStore.writeNutrition(totals);
      if (synced) useUiStore.getState().showHealthSyncToast('Nutrition saved to Apple Health');
      refreshActuals();
      removeTask(taskId);
      setInsightsDefaultTab('lifestyle');
      router.replace('/(tabs)/log' as any);
    } catch {
      setLogging(false);
    }
  }, [task, taskId, checkedItems, totals]);

  // ── Stepper helper ─────────────────────────────────────────────────────────
  const adjustQty = useCallback((idx: number, delta: number) => {
    if (!task || !taskId) return;
    const item = task.resolvedItems[idx];
    if (!item) return;
    const current = parseFloat(item.qty) || 1;
    const next = Math.max(0.5, current + delta);
    const newG = next * item.unitGrams;
    updateTaskItem(taskId, idx, {
      qty: String(next % 1 === 0 ? next : parseFloat(next.toFixed(1))),
      servingG: String(Math.round(newG)),
    });
  }, [task, taskId, updateTaskItem]);

  // ── Loading / Error states ────────────────────────────────────────────────

  if (!task) {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
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
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Analyzing...</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={colors.orange} />
          <Text style={[s.emptyText, { marginTop: 16 }]}>Looking up nutrition data...</Text>
        </View>
      </View>
    );
  }

  if (task.status === 'failed') {
    return (
      <View style={[s.screen, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Analysis Failed</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={s.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#E74C3C" />
          <Text style={[s.emptyText, { marginTop: 12 }]}>{task.error ?? 'Something went wrong'}</Text>
          <TouchableOpacity onPress={() => retryTask(taskId!)} style={[s.backBtn, { backgroundColor: colors.orange }]}>
            <Text style={s.backBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Ready state ───────────────────────────────────────────────────────────

  const items = task.resolvedItems;

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Review Food</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item, idx) => {
          const food = item.results[item.selectedIdx];

          // Unresolved item — DB miss + AI fallback returned no data.
          // Render a warning card so the screen isn't blank.
          if (!food) {
            return (
              <View key={idx} style={[s.card, { borderColor: '#E74C3C' }]}>
                <View style={s.unresolvedHeader}>
                  <Ionicons name="alert-circle" size={20} color="#E74C3C" />
                  <Text style={s.unresolvedTitle}>Couldn't find nutrition data</Text>
                </View>
                <Text style={s.unresolvedItemName}>{item.item}</Text>
                <Text style={s.unresolvedHint}>
                  Try describing this more specifically, or remove it and search manually.
                </Text>
                <TouchableOpacity
                  style={s.unresolvedRetryBtn}
                  onPress={() => retryTask(taskId!)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={16} color={colors.orange} />
                  <Text style={s.unresolvedRetryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            );
          }

          const q = parseFloat(item.qty) || 1;
          const g = q * item.unitGrams;
          const isChecked = checkedItems.has(idx);

          // Macros for this serving
          const cal = Math.round(food.calories * g / 100);
          const pro = parseFloat((food.protein_g * g / 100).toFixed(1));
          const carbs = parseFloat((food.carbs_g * g / 100).toFixed(1));
          const fat = parseFloat((food.fat_g * g / 100).toFixed(1));
          const fiber = parseFloat((food.fiber_g * g / 100).toFixed(1));

          // Score
          const mealMacros = { calories: cal, protein_g: pro, carbs_g: carbs, fat_g: fat, fiber_g: fiber };
          const mealScore = computeMealScore(mealMacros, shotPhase, sideEffects);

          // Serving label
          const servingLabel = item.unitLabel !== 'g' ? item.unitLabel : `${Math.round(g)}g`;

          // Build contextual prompt chips based on score
          const macroSummary = `${cal} cal, ${pro}g protein, ${carbs}g carbs, ${fat}g fat, ${fiber}g fiber`;
          const contextLabel = `${food.name} — ${macroSummary}`;
          const promptChips = mealScore.score < 5
            ? ['How can I boost this meal?', 'Suggest a healthier swap', "What should I eat next?"]
            : ['What should I eat next?', 'Suggest a swap', "How's my day going?"];

          const openChat = (seedMessage: string) => {
            router.push({
              pathname: '/ai-chat' as any,
              params: {
                type: 'focus',
                contextLabel: food.name,
                contextValue: macroSummary,
                seedMessage,
                chips: JSON.stringify(promptChips),
              },
            });
          };

          return (
            <View key={idx} style={s.card}>
              {/* Serving label chip */}
              <View style={s.servingChip}>
                <Text style={s.servingChipText}>{servingLabel}</Text>
              </View>

              {/* Food name + stepper row */}
              <View style={s.nameRow}>
                <TouchableOpacity onPress={() => toggleCheck(idx)} style={{ marginTop: 2 }}>
                  <Ionicons
                    name={isChecked ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={isChecked ? colors.orange : colors.textMuted}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={s.foodName} numberOfLines={2}>{food.name}</Text>
                  {food.brand ? <Text style={s.foodBrand}>{food.brand}</Text> : null}
                </View>

                {/* +/- Stepper */}
                <View style={s.stepper}>
                  <Pressable onPress={() => adjustQty(idx, -1)} style={s.stepperBtn} hitSlop={6}>
                    <Ionicons name="remove" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={s.stepperValue}>{item.qty}</Text>
                  <Pressable onPress={() => adjustQty(idx, 1)} style={s.stepperBtn} hitSlop={6}>
                    <Ionicons name="add" size={18} color={colors.textPrimary} />
                  </Pressable>
                </View>
              </View>

              {/* Match selection (if multiple results) */}
              {item.results.length > 1 && (
                <View style={s.matchRow}>
                  {item.results.slice(0, 3).map((r, ri) => (
                    <TouchableOpacity
                      key={ri}
                      onPress={() => updateTaskItem(taskId!, idx, { selectedIdx: ri })}
                      style={[s.matchPill, ri === item.selectedIdx && { borderColor: colors.orange, backgroundColor: colors.orangeDim }]}
                    >
                      <Text style={[s.matchPillText, ri === item.selectedIdx && { color: colors.orange, fontWeight: '700' }]} numberOfLines={1}>
                        {r.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 2x2 Macro Grid */}
              <View style={s.macroGrid}>
                <View style={s.macroCell}>
                  <View style={[s.macroIcon, { backgroundColor: `${MACRO_COLORS.cal}15` }]}>
                    <Ionicons name="flame-outline" size={18} color={MACRO_COLORS.cal} />
                  </View>
                  <View>
                    <Text style={s.macroCellLabel}>Calories</Text>
                    <Text style={s.macroCellValue}>{cal}</Text>
                  </View>
                </View>
                <View style={s.macroCell}>
                  <View style={[s.macroIcon, { backgroundColor: `${MACRO_COLORS.carbs}15` }]}>
                    <Ionicons name="leaf-outline" size={18} color={MACRO_COLORS.carbs} />
                  </View>
                  <View>
                    <Text style={s.macroCellLabel}>Carbs</Text>
                    <Text style={s.macroCellValue}>{carbs}g</Text>
                  </View>
                </View>
                <View style={s.macroCell}>
                  <View style={[s.macroIcon, { backgroundColor: `${MACRO_COLORS.protein}15` }]}>
                    <Ionicons name="fitness-outline" size={18} color={MACRO_COLORS.protein} />
                  </View>
                  <View>
                    <Text style={s.macroCellLabel}>Protein</Text>
                    <Text style={s.macroCellValue}>{pro}g</Text>
                  </View>
                </View>
                <View style={s.macroCell}>
                  <View style={[s.macroIcon, { backgroundColor: `${MACRO_COLORS.fat}15` }]}>
                    <Ionicons name="water-outline" size={18} color={MACRO_COLORS.fat} />
                  </View>
                  <View>
                    <Text style={s.macroCellLabel}>Fats</Text>
                    <Text style={s.macroCellValue}>{fat}g</Text>
                  </View>
                </View>
              </View>

              {/* Fiber row (5th macro, spans full width) */}
              <View style={s.fiberRow}>
                <View style={[s.macroIcon, { backgroundColor: `${MACRO_COLORS.fiber}15` }]}>
                  <Ionicons name="nutrition-outline" size={18} color={MACRO_COLORS.fiber} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.macroCellLabel}>Fiber</Text>
                  <Text style={s.macroCellValue}>{fiber}g</Text>
                </View>
              </View>

              {/* Fit Score — bar + number only, no label text */}
              <View style={[s.scoreRow, { backgroundColor: `${mealScore.color}10` }]}>
                <View style={[s.scoreIcon, { backgroundColor: `${mealScore.color}20` }]}>
                  <Ionicons name="heart-outline" size={18} color={mealScore.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.scoreTitle}>Fit Score</Text>
                  <View style={s.scoreBarTrack}>
                    <View style={[s.scoreBarFill, { width: `${mealScore.score * 10}%`, backgroundColor: mealScore.color }]} />
                  </View>
                </View>
                <Text style={[s.scoreValue, { color: mealScore.color }]}>{mealScore.score}/10</Text>
              </View>

              {/* Contextual AI prompt chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.promptChipScroll} contentContainerStyle={s.promptChipRow}>
                {promptChips.map((chip) => (
                  <TouchableOpacity key={chip} style={s.promptChip} onPress={() => openChat(chip)} activeOpacity={0.7}>
                    <Ionicons name="chatbubble-outline" size={13} color={colors.orange} />
                    <Text style={s.promptChipText} numberOfLines={1}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <BlurView intensity={85} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)' }]} />

        <TouchableOpacity
          style={[s.confirmBtn, (checkedItems.size === 0 || logging) && { opacity: 0.4 }]}
          onPress={handleConfirm}
          disabled={checkedItems.size === 0 || logging}
          activeOpacity={0.85}
        >
          {logging ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={s.confirmBtnText}>
              Done ({checkedItems.size} item{checkedItems.size !== 1 ? 's' : ''})
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { fontSize: 17, color: c.textSecondary, textAlign: 'center' },
    backBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: c.borderSubtle },
    backBtnText: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingBottom: 12,
    },
    headerTitle: { fontSize: 19, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3 },

    // ─── Card ─────────────────────────────────────────────────────
    card: {
      backgroundColor: c.cardBg,
      borderRadius: 20,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    servingChip: {
      alignSelf: 'flex-start',
      backgroundColor: w(0.05),
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 10,
    },
    servingChipText: {
      fontSize: 12, fontWeight: '600', color: c.textSecondary, letterSpacing: 0.3,
    },

    // ─── Name + Stepper ───────────────────────────────────────────
    nameRow: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14,
    },
    foodName: { fontSize: 20, fontWeight: '700', color: c.textPrimary, lineHeight: 26 },
    foodBrand: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    stepper: {
      flexDirection: 'row', alignItems: 'center',
      borderRadius: 12, borderWidth: 1, borderColor: c.border,
      overflow: 'hidden',
    },
    stepperBtn: {
      width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    },
    stepperValue: {
      fontSize: 16, fontWeight: '700', color: c.textPrimary,
      minWidth: 28, textAlign: 'center',
    },

    // ─── Match pills ──────────────────────────────────────────────
    matchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    matchPill: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
      borderWidth: 1, borderColor: c.border,
    },
    matchPillText: { fontSize: 13, color: c.textSecondary, fontWeight: '500' },

    // ─── 2x2 Macro Grid ──────────────────────────────────────────
    macroGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10,
    },
    macroCell: {
      width: '47%' as any,
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: w(0.03),
      borderRadius: 14, padding: 12,
    },
    macroIcon: {
      width: 36, height: 36, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    macroCellLabel: {
      fontSize: 12, fontWeight: '500', color: c.textMuted, letterSpacing: 0.2,
    },
    macroCellValue: {
      fontSize: 18, fontWeight: '800', color: c.textPrimary, marginTop: 1,
    },

    // ─── Fiber row ────────────────────────────────────────────────
    fiberRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: w(0.03), borderRadius: 14, padding: 12, marginBottom: 10,
    },

    // ─── Fit Score ────────────────────────────────────────────────
    scoreRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 14, padding: 12, marginBottom: 4,
    },
    scoreIcon: {
      width: 36, height: 36, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    scoreTitle: {
      fontSize: 13, fontWeight: '600', color: c.textPrimary, marginBottom: 4,
    },
    scoreBarTrack: {
      height: 5, borderRadius: 3, backgroundColor: w(0.08), overflow: 'hidden',
    },
    scoreBarFill: { height: 5, borderRadius: 3 },
    scoreValue: { fontSize: 16, fontWeight: '800' },

    // ─── Prompt Chips ───────────────────────────────────────────
    promptChipScroll: {
      marginTop: 10,
    },
    promptChipRow: {
      flexDirection: 'row', gap: 8, paddingVertical: 2,
    },
    promptChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: w(0.04),
      borderRadius: 20, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 12, paddingVertical: 8,
    },
    promptChipText: {
      fontSize: 13, fontWeight: '600', color: c.textPrimary,
    },

    // ─── Unresolved item card ────────────────────────────────────
    unresolvedHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
    },
    unresolvedTitle: {
      fontSize: 14, fontWeight: '700', color: '#E74C3C', letterSpacing: 0.2,
    },
    unresolvedItemName: {
      fontSize: 18, fontWeight: '700', color: c.textPrimary, marginBottom: 6,
    },
    unresolvedHint: {
      fontSize: 13, color: c.textMuted, lineHeight: 18, marginBottom: 12,
    },
    unresolvedRetryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 12, borderWidth: 1, borderColor: c.orange,
      backgroundColor: c.orangeDim,
    },
    unresolvedRetryText: {
      fontSize: 14, fontWeight: '700', color: c.orange,
    },

    // ─── Footer ───────────────────────────────────────────────────
    footer: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden',
      paddingTop: 16, paddingHorizontal: 20,
    },
    confirmBtn: {
      backgroundColor: c.isDark ? '#1A1A1A' : '#111111',
      borderRadius: 28, paddingVertical: 16,
      alignItems: 'center', justifyContent: 'center',
    },
    confirmBtnText: {
      fontSize: 17, fontWeight: '700', color: '#FFF', letterSpacing: 0.3,
    },
  });
}
