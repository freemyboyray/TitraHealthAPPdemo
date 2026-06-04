import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import type { Macros } from '@/lib/food-macros';

// FDA-style "Log summary" nutrition label. Built from a summed Macros object.
// Optional micros render "—" (NOT 0) when undefined so partial data reads
// honestly.

type Row = {
  label: string;
  value?: number;
  unit: string;
  decimals?: number;
  indent?: boolean;
  bold?: boolean;
  rule?: 'thick' | 'thin' | 'none';
};

function fmt(value: number | undefined, unit: string, decimals: number): string {
  if (value == null) return '—';
  const n = decimals === 0 ? Math.round(value) : parseFloat(value.toFixed(decimals));
  return `${n}${unit}`;
}

export function NutritionLabelModal({
  visible,
  onClose,
  macros,
  title = 'Log summary',
}: {
  visible: boolean;
  onClose: () => void;
  macros: Macros | null;
  title?: string;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => createStyles(colors), [colors]);

  const m = macros;
  const rows: Row[] = m
    ? [
        { label: 'Total Fat', value: m.fat, unit: 'g', decimals: 1, bold: true, rule: 'thick' },
        { label: 'Saturated Fat', value: m.saturated_fat, unit: 'g', decimals: 1, indent: true, rule: 'thin' },
        { label: 'Trans Fat', value: m.trans_fat, unit: 'g', decimals: 1, indent: true, rule: 'thin' },
        { label: 'Polyunsaturated Fat', value: m.polyunsaturated_fat, unit: 'g', decimals: 1, indent: true, rule: 'thin' },
        { label: 'Monounsaturated Fat', value: m.monounsaturated_fat, unit: 'g', decimals: 1, indent: true, rule: 'thin' },
        { label: 'Cholesterol', value: m.cholesterol, unit: 'mg', decimals: 1, bold: true, rule: 'thin' },
        { label: 'Sodium', value: m.sodium, unit: 'mg', decimals: 1, bold: true, rule: 'thin' },
        { label: 'Total Carbohydrates', value: m.carbs, unit: 'g', decimals: 1, bold: true, rule: 'thick' },
        { label: 'Dietary Fiber', value: m.fiber, unit: 'g', decimals: 1, indent: true, rule: 'thin' },
        { label: 'Total Sugars', value: m.sugar, unit: 'g', decimals: 1, indent: true, rule: 'thin' },
        { label: 'Added Sugars', value: m.added_sugars, unit: 'g', decimals: 1, indent: true, rule: 'thin' },
        { label: 'Protein', value: m.protein, unit: 'g', decimals: 1, bold: true, rule: 'thick' },
        { label: 'Potassium', value: m.potassium, unit: 'mg', decimals: 1, rule: 'thick' },
        { label: 'Vitamin A', value: m.vitamin_a, unit: 'µg', decimals: 1, rule: 'thin' },
        { label: 'Vitamin C', value: m.vitamin_c, unit: 'mg', decimals: 1, rule: 'thin' },
        { label: 'Vitamin D', value: m.vitamin_d, unit: 'µg', decimals: 1, rule: 'thin' },
        { label: 'Calcium', value: m.calcium, unit: 'mg', decimals: 1, rule: 'thin' },
        { label: 'Iron', value: m.iron, unit: 'mg', decimals: 1, rule: 'thin' },
      ]
    : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={[s.header, { paddingTop: insets.top + 6 }]}>
            <Pressable onPress={onClose} hitSlop={12} style={s.closeBtn}>
              <X size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={s.headerTitle}>{title}</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <View style={s.card}>
              {/* Calories */}
              <View style={s.calRow}>
                <Text style={s.calLabel}>Calories</Text>
                <Text style={s.calValue}>{m ? `${Math.round(m.calories)}` : '—'}</Text>
              </View>
              <View style={s.thickRule} />

              {rows.map((r, i) => (
                <View key={i}>
                  <View style={[s.row, r.indent && s.rowIndent]}>
                    <Text style={[s.rowLabel, r.bold && s.rowLabelBold]}>{r.label}</Text>
                    <Text style={[s.rowValue, r.bold && s.rowLabelBold]}>
                      {fmt(r.value, r.unit, r.decimals ?? 1)}
                    </Text>
                  </View>
                  {r.rule === 'thick' ? <View style={s.thickRule} /> : r.rule !== 'none' ? <View style={s.thinRule} /> : null}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      maxHeight: '92%',
      backgroundColor: c.bg,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3 },
    card: {
      backgroundColor: c.cardBg,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    calRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    calLabel: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.4 },
    calValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
    rowIndent: { paddingLeft: 18 },
    rowLabel: { fontSize: 15, color: c.textSecondary },
    rowLabelBold: { fontWeight: '700', color: c.textPrimary },
    rowValue: { fontSize: 15, color: c.textSecondary },
    thickRule: { height: 4, backgroundColor: c.isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.82)', borderRadius: 2, marginVertical: 1 },
    thinRule: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  });
}
