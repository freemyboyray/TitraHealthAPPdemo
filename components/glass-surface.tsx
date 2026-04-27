import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { AppColors } from '@/constants/theme';

type Props = {
  fallbackColors: AppColors;
};

export function GlassSurface({ fallbackColors: colors }: Props) {
  return (
    <>
      <BlurView
        intensity={80}
        tint={colors.blurTint}
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.glassOverlay }]} />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderWidth: 1,
            borderTopColor: colors.border,
            borderLeftColor: colors.borderSubtle,
            borderRightColor: colors.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            borderBottomColor: colors.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          },
        ]}
      />
    </>
  );
}
