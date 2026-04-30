import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MedicationGroupSection } from '@/components/treatment/MedicationGroupSection';
import type { AppColors } from '@/constants/theme';
import { TYPE } from '@/constants/theme';
import type { MedicationBrand } from '@/constants/user-profile';
import {
  BRAND_TITRATION_SUMMARY,
  getBrandDoses,
  BRAND_STARTING_DOSE,
} from '@/constants/user-profile';
import { useAppTheme } from '@/contexts/theme-context';

const BRAND_LABEL: Record<string, string> = {
  zepbound: 'Zepbound', mounjaro: 'Mounjaro', wegovy: 'Wegovy', ozempic: 'Ozempic',
  trulicity: 'Trulicity', saxenda: 'Saxenda', victoza: 'Victoza', rybelsus: 'Rybelsus',
  oral_wegovy: 'Oral Wegovy', orforglipron: 'Orforglipron',
  compounded_semaglutide: 'Compounded (Sema)', compounded_tirzepatide: 'Compounded (Tirz)',
  compounded_liraglutide: 'Compounded (Lira)', other: 'Other',
};

type Props = {
  brand: MedicationBrand | null;
  currentDose: number | undefined;
  selectedDose: number | 'custom' | null;
  customDose: string;
  onSelectDose: (dose: number | 'custom') => void;
  onCustomDoseChange: (value: string) => void;
};

export function DoseSelector({
  brand, currentDose, selectedDose, customDose, onSelectDose, onCustomDoseChange,
}: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  if (!brand) return null;

  const doses = getBrandDoses(brand);
  const titration = BRAND_TITRATION_SUMMARY[brand];
  const startingDose = BRAND_STARTING_DOSE[brand];
  const brandName = BRAND_LABEL[brand] ?? brand;

  return (
    <View>
      <Text style={s.question}>What dose of {brandName}?</Text>
      <Text style={s.hint}>Select your current prescribed dose.</Text>

      {/* Titration info card */}
      {titration && (
        <View style={s.titrationCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.orange} style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={s.titrationText}>{titration}</Text>
        </View>
      )}

      <MedicationGroupSection>
        {doses.map((d, i) => {
          const isSelected = selectedDose === d;
          const isCurrent = currentDose === d;
          const isStart = startingDose === d;
          const isLast = i === doses.length - 1 && selectedDose !== 'custom';

          return (
            <TouchableOpacity
              key={d}
              activeOpacity={0.7}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectDose(d);
              }}
              style={[
                s.doseRow,
                isSelected && s.doseRowSelected,
                i === 0 && s.rowFirst,
                isLast && s.rowLast,
                !isLast && s.rowDivider,
              ]}
            >
              <View style={s.doseLeft}>
                <Text style={[s.doseValue, isSelected && { color: colors.orange }]}>
                  {d} mg
                </Text>
                {isStart && (
                  <Text style={s.startLabel}>Starting dose</Text>
                )}
              </View>
              <View style={s.doseRight}>
                {isCurrent && !isSelected && (
                  <View style={s.currentBadge}>
                    <Text style={s.currentBadgeText}>Current</Text>
                  </View>
                )}
                {isSelected && (
                  <Animated.View entering={FadeIn.duration(150)}>
                    <Ionicons name="checkmark-circle" size={22} color={colors.orange} />
                  </Animated.View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Custom / Other row */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onSelectDose('custom');
          }}
          style={[
            s.doseRow,
            selectedDose === 'custom' && s.doseRowSelected,
            doses.length === 0 && s.rowFirst,
            s.rowLast,
          ]}
        >
          <Text style={[s.doseValue, selectedDose === 'custom' && { color: colors.orange }]}>
            Custom / Other
          </Text>
          {selectedDose === 'custom' && (
            <Animated.View entering={FadeIn.duration(150)}>
              <Ionicons name="checkmark-circle" size={22} color={colors.orange} />
            </Animated.View>
          )}
        </TouchableOpacity>
      </MedicationGroupSection>

      {/* Custom dose input */}
      {selectedDose === 'custom' && (
        <TextInput
          style={s.input}
          placeholder="Enter dose in mg (e.g. 3.5)"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={customDose}
          onChangeText={onCustomDoseChange}
          autoFocus
        />
      )}
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  question: {
    ...TYPE.title1,
    color: c.textPrimary,
    marginBottom: 6,
    fontFamily: 'System',
  },
  hint: {
    ...TYPE.body,
    fontSize: 16,
    color: c.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'System',
  },
  titrationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: c.orangeDim,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,116,42,0.2)' : 'rgba(232,101,42,0.15)',
  },
  titrationText: {
    ...TYPE.body,
    color: c.textSecondary,
    flex: 1,
    fontFamily: 'System',
  },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  doseRowSelected: {
    backgroundColor: c.orangeDim,
  },
  rowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  rowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSubtle,
  },
  doseLeft: {
    flex: 1,
  },
  doseValue: {
    ...TYPE.title3,
    color: c.textPrimary,
    fontFamily: 'System',
  },
  startLabel: {
    ...TYPE.caption2,
    color: c.textMuted,
    marginTop: 2,
    fontFamily: 'System',
  },
  doseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: c.orangeDim,
  },
  currentBadgeText: {
    ...TYPE.caption2,
    color: c.orange,
    fontFamily: 'System',
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    color: c.textPrimary,
    marginTop: 12,
    backgroundColor: c.bg,
    fontFamily: 'System',
  },
});
