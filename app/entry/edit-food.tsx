import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Minus, Plus, Star } from 'lucide-react-native';
import { useFoodTaskStore } from '../../stores/food-task-store';
import {
  componentMacros,
  componentGrams,
  dishMacros,
  MACRO_COLORS,
  r0,
  r1,
} from '@/lib/food-macros';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { MacroRing } from '@/components/food/macro-ring';
import { EditIngredientModal } from '@/components/food/edit-ingredient-modal';

// Bevel "Edit food details": whole-dish portion + editable ingredient list.
export default function EditFoodScreen() {
  const { taskId, dishIdx: dishIdxParam } = useLocalSearchParams<{ taskId: string; dishIdx: string }>();
  const dishIdx = parseInt(dishIdxParam ?? '0', 10);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const dish = useFoodTaskStore((st) => st.tasks.find((t) => t.id === taskId)?.dishes[dishIdx]);
  const updateDish = useFoodTaskStore((st) => st.updateDish);
  const removeDish = useFoodTaskStore((st) => st.removeDish);

  const [editComp, setEditComp] = useState<number | null>(null);
  const [favorite, setFavorite] = useState(false);

  if (!dish || !taskId) {
    return (
      <View style={[s.screen, s.centered, { paddingTop: insets.top }]}>
        <Text style={s.emptyText}>Food not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const m = dishMacros(dish);
  const cal = Math.max(1, m.calories);
  const pPct = Math.round(((m.protein * 4) / cal) * 100);
  const cPct = Math.round(((m.carbs * 4) / cal) * 100);
  const fPct = Math.round(((m.fat * 9) / cal) * 100);

  const adjustPortion = (dir: 1 | -1) => {
    const step = 0.25;
    const next = Math.max(0.25, parseFloat((dish.portion + dir * step).toFixed(2)));
    updateDish(taskId, dishIdx, { portion: next });
  };

  const handleRemove = () => {
    removeDish(taskId, dishIdx);
    router.back();
  };

  const handleAddIngredient = () => {
    router.push(`/entry/add-food-search?taskId=${taskId}&dishIdx=${dishIdx}` as any);
  };

  return (
    <View style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.iconBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Edit food details</Text>
        <Pressable onPress={() => setFavorite((v) => !v)} hitSlop={12} style={s.iconBtn}>
          <Star size={20} color={favorite ? colors.orange : colors.textMuted} fill={favorite ? colors.orange : 'transparent'} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
        <Text style={s.name} numberOfLines={2}>
          {dish.name}
        </Text>
        <Text style={s.sub}>Common</Text>

        {/* Nutrition Facts + ring */}
        <View style={s.factsRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.factsTitle}>Nutrition Facts</Text>
            <View style={s.macroCols}>
              <MacroCol label="Fat" grams={m.fat} pct={fPct} color={MACRO_COLORS.fat} s={s} />
              <MacroCol label="Carbs" grams={m.carbs} pct={cPct} color={MACRO_COLORS.carbs} s={s} />
              <MacroCol label="Protein" grams={m.protein} pct={pPct} color={MACRO_COLORS.protein} s={s} />
            </View>
          </View>
          <MacroRing
            protein={m.protein}
            carbs={m.carbs}
            fat={m.fat}
            calories={m.calories}
            trackColor={colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
            textColor={colors.textPrimary}
          />
        </View>

        {/* Portion size */}
        <Text style={s.sectionLabel}>Portion size</Text>
        <View style={s.amountRow}>
          <View style={s.amountField}>
            <Text style={s.amountText}>
              {dish.portion % 1 === 0 ? dish.portion : r1(dish.portion)} × serving
            </Text>
          </View>
          <Pressable style={s.stepBtn} onPress={() => adjustPortion(-1)} hitSlop={6}>
            <Minus size={18} color={colors.textPrimary} />
          </Pressable>
          <Pressable style={s.stepBtn} onPress={() => adjustPortion(1)} hitSlop={6}>
            <Plus size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Ingredients */}
        <View style={s.ingHeader}>
          <Text style={s.sectionLabel}>Ingredients</Text>
          <Pressable onPress={handleAddIngredient} hitSlop={10} style={s.addIngBtn}>
            <Plus size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
        <Text style={s.ingHint}>The listed ingredient amounts are measured for a single serving.</Text>

        {dish.components.map((comp, ci) => {
          const food = comp.results[comp.selectedIdx];
          const cm = componentMacros(comp);
          const servingLabel = comp.unitLabel !== 'g' ? `${comp.qty} × ${comp.unitLabel}` : `${r0(componentGrams(comp))} g`;
          return (
            <TouchableOpacity key={ci} style={s.ingRow} onPress={() => setEditComp(ci)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.ingName} numberOfLines={1}>
                  {food?.name ?? comp.item}
                </Text>
                <Text style={s.ingSub}>
                  {servingLabel} · {r0(cm.calories)} calories
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={[s.actionBtn, s.removeBtn]} onPress={handleRemove} activeOpacity={0.85}>
          <Text style={s.removeText}>Remove</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionBtn, s.saveBtn]} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={s.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <EditIngredientModal
        visible={editComp != null}
        onClose={() => setEditComp(null)}
        taskId={taskId}
        dishIdx={dishIdx}
        compIdx={editComp}
      />
    </View>
  );
}

function MacroCol({ label, grams, pct, color, s }: { label: string; grams: number; pct: number; color: string; s: any }) {
  return (
    <View>
      <Text style={[s.macroColLabel, { color }]}>{label}</Text>
      <Text style={s.macroColValue}>{r0(grams)}g</Text>
      <Text style={s.macroColPct}>{pct}%</Text>
    </View>
  );
}

function createStyles(c: AppColors) {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    centered: { alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontSize: 17, color: c.textSecondary },
    backBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: c.borderSubtle },
    backBtnText: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3 },
    iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 24, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.4 },
    sub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    factsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, gap: 16 },
    factsTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginBottom: 12 },
    macroCols: { flexDirection: 'row', gap: 18 },
    macroColLabel: { fontSize: 13, fontWeight: '700' },
    macroColValue: { fontSize: 18, fontWeight: '800', color: c.textPrimary, marginTop: 4 },
    macroColPct: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginTop: 26, marginBottom: 10 },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    amountField: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: c.border, justifyContent: 'center', paddingHorizontal: 16, backgroundColor: w(0.02) },
    amountText: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
    stepBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    ingHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    addIngBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    ingHint: { fontSize: 13, color: c.textMuted, marginBottom: 12, lineHeight: 18 },
    ingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.cardBg, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, borderWidth: 1, borderColor: c.borderSubtle },
    ingName: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    ingSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12, backgroundColor: c.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    actionBtn: { flex: 1, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
    removeBtn: { backgroundColor: c.isDark ? 'rgba(231,76,60,0.14)' : 'rgba(231,76,60,0.10)' },
    removeText: { fontSize: 16, fontWeight: '700', color: '#E74C3C' },
    saveBtn: { backgroundColor: c.isDark ? '#1A1A1A' : '#111111' },
    saveText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  });
}
