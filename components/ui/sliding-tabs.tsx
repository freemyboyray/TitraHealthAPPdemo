import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { AppColors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

type Tab<T extends string> = { key: T; label: string };

type Props<T extends string> = {
  tabs: Tab<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  height?: number;
  borderRadius?: number;
  padding?: number;
};

export function SlidingTabs<T extends string>({
  tabs, activeKey, onChange,
  height = 36, borderRadius = 10, padding = 2,
}: Props<T>) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors, height, borderRadius, padding), [colors, height, borderRadius, padding]);

  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useSharedValue(0);

  const tabCount = tabs.length;
  const tabWidth = containerWidth > 0 ? (containerWidth - padding * 2) / tabCount : 0;
  const activeIndex = tabs.findIndex(t => t.key === activeKey);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerWidth(w);
    const tw = (w - padding * 2) / tabCount;
    translateX.value = activeIndex * tw;
  }, [activeIndex, tabCount, padding]);

  // Sync when activeKey changes externally
  useEffect(() => {
    if (containerWidth > 0 && activeIndex >= 0) {
      translateX.value = withTiming(activeIndex * tabWidth, {
        duration: 250,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [activeKey, containerWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: tabWidth,
  }));

  const handleSelect = (key: T, index: number) => {
    translateX.value = withTiming(index * tabWidth, {
      duration: 250,
      easing: Easing.out(Easing.cubic),
    });
    Haptics.selectionAsync();
    onChange(key);
  };

  const innerRadius = Math.max(borderRadius - padding, 4);

  return (
    <View style={s.container} onLayout={onLayout}>
      {containerWidth > 0 && (
        <Animated.View style={[s.indicator, indicatorStyle]}>
          <View style={[s.indicatorInner, { borderRadius: innerRadius }]} />
        </Animated.View>
      )}

      {tabs.map((tab, i) => (
        <TouchableOpacity
          key={tab.key}
          style={s.tab}
          activeOpacity={0.7}
          onPress={() => handleSelect(tab.key, i)}
        >
          <Text style={[s.tabText, activeKey === tab.key && s.tabTextActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (c: AppColors, height: number, borderRadius: number, padding: number) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      height,
      borderRadius,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
      padding,
      position: 'relative',
    },
    indicator: {
      position: 'absolute',
      top: padding,
      bottom: padding,
      left: padding,
    },
    indicatorInner: {
      flex: 1,
      backgroundColor: c.orange,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    tabText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.85)',
      fontFamily: 'System',
    },
    tabTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
