import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { cardElevation } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

/**
 * A plain, solid card — pure `cardBg` (white in light, elevated dark surface in
 * dark) + soft elevation, no blur/glass tint. Use when a card should read as a
 * clean white surface rather than the warm translucent `GlassCard`.
 */
export function SolidCard({
  children,
  style,
  radius = 24,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', backgroundColor: colors.cardBg },
        cardElevation(colors.isDark),
        style,
      ]}
    >
      {children}
    </View>
  );
}
