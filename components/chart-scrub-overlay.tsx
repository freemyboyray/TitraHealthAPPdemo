import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { useAppTheme } from '@/contexts/theme-context';
import Animated, {
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';

type TooltipData = {
  title: string;
  subtitle: string;
  badge?: { text: string; color: string };
};

type ChartScrubOverlayProps = {
  activeIndex: SharedValue<number>;
  isActive: SharedValue<boolean>;
  crosshairX: SharedValue<number>;
  crosshairY: SharedValue<number>;
  chartHeight: number;
  chartWidth: number;
  color: string;
  formatTooltip: (index: number) => TooltipData;
};

const TOOLTIP_W = 120;
const TOOLTIP_H_EST = 54;
const DOT_R = 6;

export function ChartScrubOverlay({
  activeIndex,
  isActive,
  crosshairX,
  crosshairY,
  chartHeight,
  chartWidth,
  color,
  formatTooltip,
}: ChartScrubOverlayProps) {
  const { colors } = useAppTheme();
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const updateTooltip = useCallback(
    (idx: number) => {
      if (idx < 0) {
        setTooltip(null);
      } else {
        setTooltip(formatTooltip(idx));
      }
    },
    [formatTooltip],
  );

  useAnimatedReaction(
    () => activeIndex.value,
    (idx) => {
      runOnJS(updateTooltip)(idx);
    },
    [updateTooltip],
  );

  // Crosshair vertical line
  const lineStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isActive.value ? 1 : 0, { duration: 100 }),
    transform: [{ translateX: crosshairX.value - 0.5 }],
  }));

  // Dot on the curve
  const dotStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isActive.value ? 1 : 0, { duration: 100 }),
    transform: [
      { translateX: crosshairX.value - DOT_R },
      { translateY: crosshairY.value - DOT_R },
    ],
  }));

  // Dot glow ring
  const glowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isActive.value ? 1 : 0, { duration: 100 }),
    transform: [
      { translateX: crosshairX.value - DOT_R * 2 },
      { translateY: crosshairY.value - DOT_R * 2 },
    ],
  }));

  // Tooltip container — flips above/below based on y position
  const tooltipStyle = useAnimatedStyle(() => {
    const showAbove = crosshairY.value > TOOLTIP_H_EST + 16;
    const tooltipY = showAbove
      ? crosshairY.value - TOOLTIP_H_EST - 12
      : crosshairY.value + DOT_R * 2 + 8;
    // Keep tooltip within chart bounds
    const rawX = crosshairX.value - TOOLTIP_W / 2;
    const clampedX = Math.max(4, Math.min(chartWidth - TOOLTIP_W - 4, rawX));
    return {
      opacity: withTiming(isActive.value ? 1 : 0, { duration: 100 }),
      transform: [{ translateX: clampedX }, { translateY: tooltipY }],
    };
  });

  return (
    <View style={[StyleSheet.absoluteFill, styles.container]} pointerEvents="none">
      {/* Vertical crosshair line */}
      <Animated.View
        style={[
          styles.crosshairLine,
          { height: chartHeight, backgroundColor: `${color}55` },
          lineStyle,
        ]}
      />

      {/* Glow ring */}
      <Animated.View
        style={[
          styles.glowRing,
          { backgroundColor: `${color}25`, width: DOT_R * 4, height: DOT_R * 4, borderRadius: DOT_R * 2 },
          glowStyle,
        ]}
      />

      {/* Dot */}
      <Animated.View
        style={[
          styles.dot,
          {
            backgroundColor: colors.isDark ? '#FFFFFF' : colors.cardBg,
            borderColor: color,
            width: DOT_R * 2,
            height: DOT_R * 2,
            borderRadius: DOT_R,
          },
          dotStyle,
        ]}
      />

      {/* Tooltip */}
      <Animated.View style={[styles.tooltip, { width: TOOLTIP_W }, tooltipStyle]}>
        {tooltip && (
          <View
            style={[
              styles.tooltipInner,
              {
                backgroundColor: colors.isDark
                  ? 'rgba(30,30,30,0.92)'
                  : '#FFFFFF',
                borderColor: colors.isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(0,0,0,0.12)',
                ...(colors.isDark
                  ? {}
                  : {
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 8,
                      elevation: 4,
                    }),
              },
            ]}
          >
            <Text
              style={[styles.tooltipTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {tooltip.title}
            </Text>
            <Text
              style={[
                styles.tooltipSubtitle,
                {
                  color: colors.isDark
                    ? 'rgba(255,255,255,0.6)'
                    : colors.textSecondary,
                },
              ]}
              numberOfLines={1}
            >
              {tooltip.subtitle}
            </Text>
            {tooltip.badge && (
              <View
                style={[
                  styles.tooltipBadge,
                  { backgroundColor: `${tooltip.badge.color}22` },
                ]}
              >
                <Text
                  style={[styles.tooltipBadgeText, { color: tooltip.badge.color }]}
                >
                  {tooltip.badge.text}
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'visible',
  },
  crosshairLine: {
    position: 'absolute',
    width: 1,
    top: 0,
  },
  glowRing: {
    position: 'absolute',
  },
  dot: {
    position: 'absolute',
    borderWidth: 2.5,
  },
  tooltip: {
    position: 'absolute',
  },
  tooltipInner: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 0.5,
  },
  tooltipTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'System',
  },
  tooltipSubtitle: {
    fontSize: 13,
    fontFamily: 'System',
    marginTop: 1,
  },
  tooltipBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  tooltipBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'System',
  },
});
