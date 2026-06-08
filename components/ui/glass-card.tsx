import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GlassBorder } from '@/components/ui/glass-border';
import { cardElevation } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

/**
 * The standard theme-honest glass card: surface fill + blur + glassOverlay +
 * GlassBorder + soft elevation. Works in dark and light (DESIGN.md "Elevation &
 * glass"). Replaces the per-screen inline GlassCard copies.
 */
export function GlassCard({
  children,
  style,
  radius = 20,
  intensity = 78,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', backgroundColor: colors.surface },
        cardElevation(colors.isDark),
        style,
      ]}
    >
      <BlurView intensity={intensity} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: radius, backgroundColor: colors.glassOverlay }]} />
      <GlassBorder r={radius} isDark={colors.isDark} />
      {children}
    </View>
  );
}
