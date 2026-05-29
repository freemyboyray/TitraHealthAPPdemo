import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { categoryColor } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useUiStore } from '@/stores/ui-store';

type CategoryKey = 'nutrition' | 'activity' | 'vitals';

type Props = {
  icon: React.ReactNode;
  label: string;
  categoryKey: CategoryKey;
  todayValue: string;
  onPress: () => void;
  aiChips?: string[];
};

export function CategoryRow({ icon, label, categoryKey, todayValue, onPress, aiChips }: Props) {
  const { colors } = useAppTheme();
  const dot = categoryColor(colors.isDark, categoryKey);
  const labelColor = colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const chevronColor = colors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const valueColor = colors.textPrimary;
  const glassShadow = useMemo(() => ({
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: colors.isDark ? 8 : 2 },
    shadowOpacity: colors.isDark ? 0.3 : 0.06,
    shadowRadius: colors.isDark ? 24 : 8,
    elevation: colors.isDark ? 8 : 2,
  }), [colors]);

  const { openAiChat } = useUiStore();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({
      type: 'metric',
      contextLabel: label,
      contextValue: todayValue,
      chips: aiChips ? JSON.stringify(aiChips) : undefined,
    });
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${todayValue} today. Tap for details, long press to ask AI`}
      style={[styles.wrap, glassShadow]}
    >
      <View
        style={[
          styles.body,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.left}>
          <View style={[styles.dot, { backgroundColor: dot }]} />
          <View style={styles.iconWrap}>{icon}</View>
          <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
            {todayValue}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={chevronColor} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    borderWidth: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iconWrap: { width: 22, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontFamily: 'System',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 15, fontWeight: '600', fontFamily: 'System' },
});
