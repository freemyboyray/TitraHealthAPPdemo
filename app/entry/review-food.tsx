import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoodTaskStore, type ResolvedItem } from '../../stores/food-task-store';
import { useMealTrayStore } from '../../stores/meal-tray-store';
import { useHealthKitStore } from '../../stores/healthkit-store';
import { useHealthData } from '@/contexts/health-data';
import { useUiStore } from '@/stores/ui-store';
import { useAppTheme } from '@/contexts/theme-context';

const ORANGE = '#FF742A';

function GlassBorder({ r = 16 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: r,
          borderWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.13)',
          borderLeftColor: 'rgba(255,255,255,0.08)',
          borderRightColor: 'rgba(255,255,255,0.03)',
          borderBottomColor: 'rgba(255,255,255,0.02)',
        },
      ]}
    />
  );
}

export default function ReviewFoodScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const task = useFoodTaskStore((s) => s.tasks.find((t) => t.id === taskId));
  const updateTaskItem = useFoodTaskStore((s) => s.updateTaskItem);
  const removeTask = useFoodTaskStore((s) => s.removeTask);
  const retryTask = useFoodTaskStore((s) => s.retryTask);

  const { addToTray, logMeal } = useMealTrayStore();
  const hkStore = useHealthKitStore();
  const { refreshActuals } = useHealthData();
  const setInsightsDefaultTab = useUiStore((s) => s.setInsightsDefaultTab);

  const [checkedItems, setCheckedItems] = useState<Set<number>>(
    new Set(task?.resolvedItems.map((_, i) => i) ?? []),
  );
  const [logging, setLogging] = useState(false);

  // Sync checked set when task transitions from processing → ready
  React.useEffect(() => {
    if (task?.status === 'ready') {
      setCheckedItems(new Set(task.resolvedItems.map((_, i) => i)));
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
      // Add checked items to tray
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

      // Log the meal
      await logMeal('snack');
      hkStore.writeNutrition(totals);
      refreshActuals();

      // Cleanup and navigate
      removeTask(taskId);
      setInsightsDefaultTab('lifestyle');
      router.replace('/(tabs)/log' as any);
    } catch {
      setLogging(false);
    }
  }, [task, taskId, checkedItems, totals]);

  // ── Loading / Error states ──────────────────────────────────────────────────

  if (!task) {
    return (
      <View style={[styles.screen, { backgroundColor: '#000', paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>Task not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (task.status === 'processing') {
    return (
      <View style={[styles.screen, { backgroundColor: '#000', paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Analyzing...</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={[styles.emptyText, { marginTop: 16 }]}>
            Looking up nutrition data...
          </Text>
        </View>
      </View>
    );
  }

  if (task.status === 'failed') {
    return (
      <View style={[styles.screen, { backgroundColor: '#000', paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Analysis Failed</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#E74C3C" />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>
            {task.error ?? 'Something went wrong'}
          </Text>
          <TouchableOpacity
            onPress={() => { retryTask(taskId!); }}
            style={[styles.backBtn, { backgroundColor: ORANGE }]}
          >
            <Text style={styles.backBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Ready state — show items for review ─────────────────────────────────────

  const items = task.resolvedItems;

  return (
    <View style={[styles.screen, { backgroundColor: '#000' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Review Food</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 180 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>
          {items.length} ITEM{items.length !== 1 ? 'S' : ''} FOUND
        </Text>

        {items.map((item, idx) => {
          const food = item.results[item.selectedIdx];
          if (!food) return null;
          const q = parseFloat(item.qty) || 1;
          const g = q * item.unitGrams;
          const isChecked = checkedItems.has(idx);

          // Build unit options from serving_options
          const unitOptions: { label: string; grams: number }[] = [{ label: 'g', grams: 1 }];
          const topFood = item.results[item.selectedIdx];
          if (topFood?.serving_options) {
            topFood.serving_options.forEach((so) => {
              if (so.label !== 'g') unitOptions.push({ label: so.label, grams: so.grams });
            });
          }

          return (
            <View key={idx} style={styles.itemCard}>
              <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16 }]} />
              <GlassBorder />

              {/* Checkbox + name */}
              <View style={styles.itemHeader}>
                <TouchableOpacity onPress={() => toggleCheck(idx)} style={styles.checkbox}>
                  <Ionicons
                    name={isChecked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isChecked ? ORANGE : 'rgba(255,255,255,0.3)'}
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={2}>{food.name}</Text>
                  {food.brand ? (
                    <Text style={styles.itemBrand}>{food.brand}</Text>
                  ) : null}
                </View>
              </View>

              {/* Match selection (if multiple results) */}
              {item.results.length > 1 && (
                <View style={styles.matchRow}>
                  {item.results.slice(0, 3).map((r, ri) => (
                    <TouchableOpacity
                      key={ri}
                      onPress={() => {
                        updateTaskItem(taskId!, idx, { selectedIdx: ri });
                      }}
                      style={[
                        styles.matchPill,
                        ri === item.selectedIdx && { borderColor: ORANGE, backgroundColor: 'rgba(255,116,42,0.12)' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.matchPillText,
                          ri === item.selectedIdx && { color: ORANGE, fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {r.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Amount input */}
              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={item.qty}
                  onChangeText={(text) => {
                    const newG = (parseFloat(text) || 0) * item.unitGrams;
                    updateTaskItem(taskId!, idx, {
                      qty: text,
                      servingG: String(Math.round(newG)),
                    });
                  }}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                {/* Unit selector */}
                {unitOptions.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexShrink: 1 }}>
                    {unitOptions.map((opt, oi) => (
                      <TouchableOpacity
                        key={oi}
                        onPress={() => {
                          const newQ = item.unitLabel === 'g' && opt.label !== 'g'
                            ? String(Math.round((parseFloat(item.qty) || 0) * item.unitGrams / opt.grams * 10) / 10)
                            : item.qty;
                          const newG = (parseFloat(newQ) || 0) * opt.grams;
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          updateTaskItem(taskId!, idx, {
                            unitLabel: opt.label,
                            unitGrams: opt.grams,
                            qty: newQ,
                            servingG: String(Math.round(newG)),
                          });
                        }}
                        style={[
                          styles.unitPill,
                          item.unitLabel === opt.label && { backgroundColor: 'rgba(255,116,42,0.15)', borderColor: ORANGE },
                        ]}
                      >
                        <Text style={[
                          styles.unitPillText,
                          item.unitLabel === opt.label && { color: ORANGE, fontWeight: '700' },
                        ]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.unitLabel}>g</Text>
                )}
              </View>

              {/* Macro pills */}
              <View style={styles.macroRow}>
                {[
                  { label: 'Cal', value: Math.round(food.calories * g / 100), color: ORANGE },
                  { label: 'P', value: parseFloat((food.protein_g * g / 100).toFixed(1)), color: '#5B8BF5' },
                  { label: 'C', value: parseFloat((food.carbs_g * g / 100).toFixed(1)), color: '#F6CB45' },
                  { label: 'F', value: parseFloat((food.fat_g * g / 100).toFixed(1)), color: '#E74C3C' },
                ].map(({ label, value, color }) => (
                  <View key={label} style={[styles.macroPill, { borderColor: `${color}33` }]}>
                    <Text style={[styles.macroPillLabel, { color: `${color}99` }]}>{label}</Text>
                    <Text style={[styles.macroPillValue, { color }]}>{value}{label === 'Cal' ? '' : 'g'}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />

        {/* Totals */}
        <View style={styles.totalsRow}>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{totals.calories}</Text>
            <Text style={styles.totalLabel}>cal</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{totals.protein}g</Text>
            <Text style={styles.totalLabel}>protein</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{totals.carbs}g</Text>
            <Text style={styles.totalLabel}>carbs</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalValue}>{totals.fat}g</Text>
            <Text style={styles.totalLabel}>fat</Text>
          </View>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          style={[styles.confirmBtn, (checkedItems.size === 0 || logging) && { opacity: 0.4 }]}
          onPress={handleConfirm}
          disabled={checkedItems.size === 0 || logging}
          activeOpacity={0.85}
        >
          {logging ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.confirmBtnText}>
              Confirm & Log ({checkedItems.size} item{checkedItems.size !== 1 ? 's' : ''})
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: 'Inter_400Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFF',
    fontFamily: 'Inter_400Regular',
    letterSpacing: -0.3,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  itemCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  checkbox: {
    marginTop: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    fontFamily: 'Inter_400Regular',
  },
  itemBrand: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  matchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
    marginLeft: 34,
  },
  matchPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  matchPillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
    fontWeight: '500',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    marginLeft: 34,
  },
  amountInput: {
    width: 60,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  unitLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
    fontFamily: 'Inter_400Regular',
  },
  unitPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginRight: 6,
  },
  unitPillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_400Regular',
    fontWeight: '500',
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 34,
  },
  macroPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  macroPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Inter_400Regular',
    letterSpacing: 0.5,
  },
  macroPillValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
    fontFamily: 'Inter_400Regular',
  },
  totalLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '600',
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  confirmBtn: {
    backgroundColor: ORANGE,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
    fontFamily: 'Inter_400Regular',
  },
});
