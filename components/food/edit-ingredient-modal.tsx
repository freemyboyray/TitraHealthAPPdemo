import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { useFoodTaskStore } from '@/stores/food-task-store';
import { componentMacros, MACRO_COLORS, r0, r1 } from '@/lib/food-macros';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { MacroRing } from './macro-ring';

// Focused editor for one ingredient (component) of a dish. Reads the component
// live from the store so background serving-option updates don't go stale.
export function EditIngredientModal({
  visible,
  onClose,
  taskId,
  dishIdx,
  compIdx,
}: {
  visible: boolean;
  onClose: () => void;
  taskId: string;
  dishIdx: number;
  compIdx: number | null;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(colors), [colors]);

  const comp = useFoodTaskStore((st) =>
    compIdx == null ? undefined : st.tasks.find((t) => t.id === taskId)?.dishes[dishIdx]?.components[compIdx],
  );
  const router = useRouter();
  const updateComponent = useFoodTaskStore((st) => st.updateComponent);
  const removeComponent = useFoodTaskStore((st) => st.removeComponent);

  // Locally-editable copy of the amount so typing feels responsive; commits to
  // the store on blur / submit. Re-syncs when the store value changes (e.g.
  // the +/- steppers, or async serving-option loads).
  const [qtyText, setQtyText] = useState(comp?.qty ?? '1');
  useEffect(() => {
    if (comp?.qty != null) setQtyText(comp.qty);
  }, [comp?.qty]);

  if (compIdx == null || !comp) {
    return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} />;
  }

  const food = comp.results[comp.selectedIdx];
  const m = componentMacros(comp);
  const cal = Math.max(1, m.calories);
  const pPct = Math.round(((m.protein * 4) / cal) * 100);
  const cPct = Math.round(((m.carbs * 4) / cal) * 100);
  const fPct = Math.round(((m.fat * 9) / cal) * 100);
  const isGrams = comp.unitLabel === 'g';
  // The serving label (e.g. "2 tenders (94g)") already names one serving, so
  // qty is a multiplier — show it as "× N", never juxtaposed (which read as a
  // duplicate number like "2 2 tenders").
  const unitSuffix = isGrams ? 'g' : `× ${comp.unitLabel}`;

  const adjust = (dir: 1 | -1) => {
    const step = isGrams ? 5 : 1;
    const min = step;
    const cur = parseFloat(comp.qty) || 1;
    const next = Math.max(min, cur + dir * step);
    updateComponent(taskId, dishIdx, compIdx, { qty: String(next % 1 === 0 ? next : r1(next)) });
  };

  const commitQty = (val: string) => {
    const n = parseFloat(val);
    if (!isFinite(n) || n <= 0) {
      setQtyText(comp.qty); // reject invalid input — revert to last good value
      return;
    }
    const norm = n % 1 === 0 ? String(n) : String(r1(n));
    updateComponent(taskId, dishIdx, compIdx, { qty: norm });
    setQtyText(norm);
  };

  // "Customize" → open a database search to swap this ingredient for a better
  // match, instead of AI-regenerating it. The picked result replaces the
  // component (see add-food-search → replaceComponentWithResult).
  const handleCustomize = () => {
    onClose();
    router.push(`/entry/add-food-search?taskId=${taskId}&dishIdx=${dishIdx}&compIdx=${compIdx}` as any);
  };

  const handleRemove = () => {
    removeComponent(taskId, dishIdx, compIdx);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.header}>
            <Pressable onPress={onClose} hitSlop={12} style={s.iconBtn}>
              <ChevronLeft size={22} color={colors.textPrimary} />
            </Pressable>
            <Text style={s.headerTitle}>Edit Ingredient</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            <Text style={s.name} numberOfLines={2}>
              {food?.name ?? comp.item}
            </Text>
            <Text style={s.sub}>{food?.brand || 'Common'}</Text>

            {/* Nutrition Facts + ring */}
            <View style={s.factsRow}>
              <View style={s.factsCols}>
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

            {/* Amount */}
            <Text style={s.sectionLabel}>Amount</Text>
            <View style={s.amountRow}>
              <View style={s.amountField}>
                <TextInput
                  style={s.amountInput}
                  value={qtyText}
                  onChangeText={setQtyText}
                  onEndEditing={(e) => commitQty(e.nativeEvent.text)}
                  onSubmitEditing={(e) => commitQty(e.nativeEvent.text)}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  selectTextOnFocus
                />
                <Text style={s.amountUnit} numberOfLines={1}>
                  {unitSuffix}
                </Text>
              </View>
              <Pressable style={s.stepBtn} onPress={() => adjust(-1)} hitSlop={6}>
                <Minus size={18} color={colors.textPrimary} />
              </Pressable>
              <Pressable style={s.stepBtn} onPress={() => adjust(1)} hitSlop={6}>
                <Plus size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* Remove · Customize (search the database for a better match) */}
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.actionBtn, s.removeBtn]} onPress={handleRemove} activeOpacity={0.8}>
                <Text style={s.removeText}>Remove</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.customizeBtn]} onPress={handleCustomize} activeOpacity={0.8}>
                <Text style={s.customizeText}>Customize</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.saveBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={s.saveText}>Save</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MacroCol({ label, grams, pct, color, s }: { label: string; grams: number; pct: number; color: string; s: any }) {
  return (
    <View style={s.macroCol}>
      <Text style={[s.macroColLabel, { color }]}>{label}</Text>
      <Text style={s.macroColValue}>{r0(grams)}g</Text>
      <Text style={s.macroColPct}>{pct}%</Text>
    </View>
  );
}

function createStyles(c: AppColors) {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { maxHeight: '90%', backgroundColor: c.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3 },
    iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.4, marginTop: 8 },
    sub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    factsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, gap: 16 },
    factsCols: { flex: 1 },
    factsTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginBottom: 12 },
    macroCols: { flexDirection: 'row', gap: 18 },
    macroCol: {},
    macroColLabel: { fontSize: 13, fontWeight: '700' },
    macroColValue: { fontSize: 18, fontWeight: '800', color: c.textPrimary, marginTop: 4 },
    macroColPct: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginTop: 26, marginBottom: 10 },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    amountField: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: c.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8, backgroundColor: w(0.02) },
    amountInput: { fontSize: 15, fontWeight: '700', color: c.textPrimary, minWidth: 32, padding: 0 },
    amountUnit: { flex: 1, fontSize: 15, fontWeight: '600', color: c.textMuted },
    stepBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    btnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    actionBtn: { flex: 1, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    removeBtn: { backgroundColor: c.isDark ? 'rgba(231,76,60,0.14)' : 'rgba(231,76,60,0.10)' },
    removeText: { fontSize: 16, fontWeight: '700', color: '#E74C3C' },
    customizeBtn: { backgroundColor: c.borderSubtle },
    customizeText: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
    saveBtn: { height: 54, borderRadius: 27, backgroundColor: c.isDark ? '#1A1A1A' : '#111111', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
    saveText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  });
}
