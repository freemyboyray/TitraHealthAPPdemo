import { Ionicons } from '@expo/vector-icons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import ReAnimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppColors } from '@/constants/theme';

import { AddEntrySheet } from '@/components/add-entry-sheet';
import { GlassSurface } from '@/components/glass-surface';
import { FoodProcessingBanner } from '@/components/food-processing-banner';
import { useAppTheme } from '@/contexts/theme-context';

import { TabBarVisibilityProvider, useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';
import { useInsightsAiStore } from '@/stores/insights-ai-store';

const ORANGE = '#FF742A';

type CustomTabBarProps = BottomTabBarProps & {
  fabOpen: boolean;
  onFabPress: () => void;
};

function CustomTabBar({ state, navigation, fabOpen, onFabPress }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { minimized, expand } = useTabBarVisibility();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const activeIndex = state.index;

  // Track whether pill is past halfway so we can disable its touch handling
  const [pillInteractive, setPillInteractive] = useState(true);
  useEffect(() => {
    const id = minimized.addListener(({ value }) => {
      setPillInteractive(value < 0.05);
    });
    return () => minimized.removeListener(id);
  }, [minimized]);

  // Full pill fades out + scales down as a whole unit
  const pillOpacity = minimized.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const pillScale   = minimized.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });

  // Mini circle (active tab only) fades in + scales up
  const miniOpacity = minimized.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const miniScale   = minimized.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });

  const ICON_DEFS = [
    { focused: <IconSymbol name="house.fill" size={24} color="#FFFFFF" weight="semibold" />, unfocused: <IconSymbol name="house" size={24} color={colors.textMuted} /> },
    { focused: <IconSymbol name="list.bullet" size={26} color="#FFFFFF" weight="semibold" />, unfocused: <IconSymbol name="list.bullet" size={26} color={colors.textMuted} /> },
    { focused: <IconSymbol name="book.fill" size={24} color="#FFFFFF" weight="semibold" />, unfocused: <IconSymbol name="book" size={24} color={colors.textMuted} /> },
    { focused: <IconSymbol name="gearshape.fill" size={24} color="#FFFFFF" weight="semibold" />, unfocused: <IconSymbol name="gearshape" size={24} color={colors.textMuted} /> },
  ];

  return (
    <View style={[s.wrapper, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>

      {/* Left slot holds full pill + mini circle, overlaid */}
      <View style={s.pillOuter}>

        {/* Full pill — scales + fades as a whole unit */}
        <Animated.View
          style={[s.pillShadow, StyleSheet.absoluteFill, {
            opacity: pillOpacity,
            transform: [{ scale: pillScale }],
          }]}
          pointerEvents={pillInteractive ? 'box-none' : 'none'}
        >
          <View style={s.pillInner}>
            <GlassSurface fallbackColors={colors} />
            <View style={s.pillContent}>
              {state.routes.map((route, index) => {
                const isFocused = index === activeIndex;
                return (
                  <TouchableOpacity
                    key={route.key}
                    style={s.tabBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (!isFocused) navigation.navigate(route.name);
                    }}
                    activeOpacity={0.7}
                  >
                    {isFocused
                      ? <View style={s.activeIconWrap}>{ICON_DEFS[index].focused}</View>
                      : ICON_DEFS[index].unfocused
                    }
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* Mini circle — active tab icon, fades in as pill collapses; tap to expand */}
        <Animated.View
          style={[s.miniCircle, {
            opacity: miniOpacity,
            transform: [{ scale: miniScale }],
          }]}
        >
          <GlassSurface fallbackColors={colors} />
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); expand(); }}
            activeOpacity={0.7}
          />
          {ICON_DEFS[activeIndex]?.focused}
        </Animated.View>

        {/* Full-area tap target when collapsed — covers entire pill width */}
        {!pillInteractive && (
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 20 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); expand(); }}
          />
        )}

        {/* Height spacer */}
        <View style={{ height: 66 }} pointerEvents="none" />
      </View>

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onFabPress(); }}
        activeOpacity={0.85}
      >
        <View style={s.fabInner}>
          <IconSymbol name={fabOpen ? 'xmark' : 'plus'} size={32} color="#FFFFFF" weight="semibold" />
        </View>
      </TouchableOpacity>

    </View>
  );
}

export default function TabLayout() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const fetchInsightsData = useLogStore(s => s.fetchInsightsData);
  const logLoading = useLogStore(s => s.loading);
  const fetchHealthData = useHealthKitStore(s => s.fetchAll);
  const { appleHealthEnabled } = usePreferencesStore();
  const { aiChatOpen } = useUiStore();
  const health = useHealthData();
  const prefetchInsightsAi = useInsightsAiStore(s => s.prefetchAll);
  const aiPrefetchFired = useRef(false);

  const bgScale = useSharedValue(1);
  const bgOpacity = useSharedValue(1);

  useEffect(() => {
    fetchInsightsData();
    if (appleHealthEnabled) fetchHealthData();
  }, []);

  // Fire AI prefetch once, right after the initial Supabase data load completes.
  // logLoading transitions false→true (fetch start) then true→false (fetch done).
  // We wait for the first false-after-true to ensure health data is populated.
  const seenLoading = useRef(false);
  useEffect(() => {
    if (logLoading) { seenLoading.current = true; return; }
    if (seenLoading.current && !aiPrefetchFired.current) {
      aiPrefetchFired.current = true;
      prefetchInsightsAi(health);
    }
  }, [logLoading]);

  useEffect(() => {
    bgScale.value = withTiming(aiChatOpen ? 0.92 : 1, { duration: 380, easing: Easing.out(Easing.cubic) });
    bgOpacity.value = withTiming(aiChatOpen ? 0.72 : 1, { duration: 340 });
  }, [aiChatOpen]);

  const bgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bgScale.value }],
    opacity: bgOpacity.value,
    borderRadius: withTiming(aiChatOpen ? 20 : 0, { duration: 380 }),
  }));

  return (
    <TabBarVisibilityProvider>
      <FoodProcessingBanner />
      <ReAnimated.View style={[{ flex: 1, overflow: 'hidden' }, bgStyle]}>
        <Tabs
          tabBar={(props) => (
            <CustomTabBar
              {...props}
              fabOpen={sheetOpen}
              onFabPress={() => setSheetOpen((v) => !v)}
            />
          )}
          screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="log" />
          <Tabs.Screen name="explore" />
          <Tabs.Screen name="settings" />
        </Tabs>
      </ReAnimated.View>
      <AddEntrySheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </TabBarVisibilityProvider>
  );
}

const createStyles = (_c: AppColors) => StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingTop: 8,
    zIndex: 10,
  },

  // Left slot: full pill + mini circle overlaid
  pillOuter: {
    flex: 1,
    marginRight: 14,
  },

  // Full pill (absolute-fills pillOuter, scales as a whole)
  pillShadow: {
    borderRadius: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 28, elevation: 10,
  },
  pillInner: { borderRadius: 36, overflow: 'hidden' },
  pillOverlay: { borderRadius: 36 },
  pillShine: { position: 'absolute', top: 0, left: 16, right: 16, height: 1.5, borderRadius: 1 },
  pillBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 36, borderWidth: 1 },
  pillContent: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10 },

  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 46 },
  activeIconWrap: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: ORANGE,
    alignItems: 'center', justifyContent: 'center',
  },

  // Mini circle shown when pill is collapsed
  miniCircle: {
    position: 'absolute',
    left: 0, bottom: 0,
    width: 62, height: 62, borderRadius: 31,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
    zIndex: 10,
  },

  // FAB - solid orange
  fab: { width: 62, height: 62, borderRadius: 31, marginBottom: 2 },
  fabInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
});
