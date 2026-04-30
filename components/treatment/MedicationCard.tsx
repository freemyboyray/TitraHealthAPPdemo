import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { AppColors } from '@/constants/theme';
import { TYPE } from '@/constants/theme';
import type { MedicationBrand } from '@/constants/user-profile';
import { useAppTheme } from '@/contexts/theme-context';

// brand prop kept for caller compatibility (MedicationPicker passes it)

type Props = {
  brand: MedicationBrand;
  label: string;
  note?: string;
  selected: boolean;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
  onPress: () => void;
};

export function MedicationCard({
  brand, label, note, selected, isCurrent, isFirst, isLast, onPress,
}: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        s.row,
        selected && s.rowSelected,
        isFirst && s.rowFirst,
        isLast && s.rowLast,
        !isLast && s.rowDivider,
      ]}
    >
      {/* Current medication accent bar */}
      {isCurrent && <View style={s.accentBar} />}

      {/* Label + subtitle */}
      <View style={s.textWrap}>
        <Text style={[s.brandName, selected && { color: colors.orange }]} numberOfLines={1}>
          {label}
        </Text>
        {note ? (
          <Text style={s.note} numberOfLines={1}>{note}</Text>
        ) : null}
      </View>

      {/* Right side: current badge or checkmark */}
      <View style={s.rightZone}>
        {isCurrent && !selected && (
          <View style={s.currentBadge}>
            <Text style={s.currentBadgeText}>Current</Text>
          </View>
        )}
        {selected && (
          <Animated.View entering={FadeIn.duration(150)}>
            <Ionicons name="checkmark-circle" size={22} color={colors.orange} />
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  rowSelected: {
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
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 1.5,
    backgroundColor: c.orange,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  brandName: {
    ...TYPE.title3,
    color: c.textPrimary,
    fontFamily: 'System',
  },
  note: {
    ...TYPE.body,
    color: c.textSecondary,
    marginTop: 1,
    fontFamily: 'System',
  },
  rightZone: {
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
});
