import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { GlassBorder } from '@/components/ui/glass-border';
import { useAppTheme } from '@/contexts/theme-context';

/**
 * Circular glass chrome button (back / close / info) — DESIGN.md "Circular icon
 * button". Translucent glass fill + centered lucide icon, themed for dark+light.
 */
export function CircleIconButton({
  icon: Icon,
  onPress,
  size = 40,
  iconSize = 22,
  accessibilityLabel,
  style,
}: {
  icon: LucideIcon;
  onPress: () => void;
  size?: number;
  iconSize?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: colors.shadowColor, shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
        },
        style,
      ]}
    >
      <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: size / 2, backgroundColor: w(0.05) }]} />
      <GlassBorder r={size / 2} isDark={colors.isDark} />
      <Icon size={iconSize} color={w(0.65)} />
    </TouchableOpacity>
  );
}
