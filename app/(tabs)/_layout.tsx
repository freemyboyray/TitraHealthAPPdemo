import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import ReAnimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppColors } from '@/constants/theme';

import { AddEntrySheet } from '@/components/add-entry-sheet';
import { useAppTheme } from '@/contexts/theme-context';

import { TabBarVisibilityProvider, useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { useLogStore } from '@/stores/log-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useUiStore } from '@/stores/ui-store';

const ORANGE = '#FF742A';

type CustomTabBarProps = BottomTabBarProps & {
  fabOpen: boolean;
  onFabPress: () => void;
};

function CustomTabBar({ state, navigation, fabOpen, onFabPress }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { translateY } = useTabBarVisibility();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const icons = [
    { focused: <Ionicons name="home" size={24} color={colors.textPrimary} />, unfocused: <Ionicons name="home-outline" size={24} color={colors.textMuted} /> },
    { focused: <MaterialIcons name="menu" size={26} color={colors.textPrimary} />, unfocused: <MaterialIcons name="menu" size={26} color={colors.textMuted} /> },
    { focused: <Ionicons name="document" size={24} color={colors.textPrimary} />, unfocused: <Ionicons name="document-outline" size={24} color={colors.textMuted} /> },
    { focused: <Ionicons name="settings" size={24} color={colors.textPrimary} />, unfocused: <Ionicons name="settings-outline" size={24} color={colors.textMuted} /> },
  ];

  return (
    <Animated.View style={[s.wrapper, { paddingBottom: Math.max(insets.bottom, 8) + 8 }, { transform: [{ translateY }] }]}>

      {/* Glass pill */}
      <View style={s.pillShadow}>
        <View style={s.pillInner}>
          <BlurView intensity={85} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, s.pillOverlay, { backgroundColor: colors.glassOverlay }]} />
          {/* Top specular shine */}
          <View pointerEvents="none" style={[s.pillShine, { backgroundColor: colors.ringTrack }]} />
          {/* Glass highlight border */}
          <View pointerEvents="none" style={[s.pillBorder, { borderTopColor: colors.border, borderLeftColor: colors.borderSubtle, borderRightColor: colors.isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderBottomColor: colors.isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]} />
          {/* Tab icons */}
          <View style={s.pillContent}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;
              return (
                <TouchableOpacity
                  key={route.key}
                  style={s.tabBtn}
                  onPress={() => !isFocused && navigation.navigate(route.name)}
                  activeOpacity={0.7}>
                  {isFocused ? (
                    <View style={s.activeIconWrap}>
                      {icons[index].focused}
                    </View>
                  ) : (
                    icons[index].unfocused
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* FAB — solid orange */}
      <TouchableOpacity style={s.fab} onPress={onFabPress} activeOpacity={0.85}>
        <View style={s.fabInner}>
          <Ionicons name={fabOpen ? 'close' : 'add'} size={32} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

    </Animated.View>
  );
}

export default function TabLayout() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const fetchInsightsData = useLogStore(s => s.fetchInsightsData);
  const fetchHealthData = useHealthKitStore(s => s.fetchAll);
  const { appleHealthEnabled } = usePreferencesStore();
  const { aiChatOpen } = useUiStore();

  const bgScale = useSharedValue(1);
  const bgOpacity = useSharedValue(1);

  useEffect(() => {
    fetchInsightsData();
    if (appleHealthEnabled) fetchHealthData();
  }, []);

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
  },

  // Pill
  pillShadow: { flex: 1, marginRight: 14, borderRadius: 36, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 28, elevation: 10 },
  pillInner: { borderRadius: 36, overflow: 'hidden' },
  pillOverlay: { borderRadius: 36 },
  pillShine: { position: 'absolute', top: 0, left: 16, right: 16, height: 1.5, borderRadius: 1 },
  pillBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 36, borderWidth: 1 },
  pillContent: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10 },

  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 46 },
  activeIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // FAB — solid orange
  fab: { width: 62, height: 62, borderRadius: 31, shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 10, marginBottom: 2 },
  fabInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
});
