import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddEntrySheet } from '@/components/add-entry-sheet';
import { MOCK_PROFILE } from '@/constants/mock-profile';
import { HealthProvider } from '@/contexts/health-data';
import { useProfile } from '@/contexts/profile-context';
import { TabBarVisibilityProvider, useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { useLogStore } from '@/stores/log-store';

const TERRACOTTA = '#C4784B';

type CustomTabBarProps = BottomTabBarProps & {
  fabOpen: boolean;
  onFabPress: () => void;
};

function CustomTabBar({ state, navigation, fabOpen, onFabPress }: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { translateY } = useTabBarVisibility();

  const icons = [
    { focused: <Ionicons name="home" size={24} color={TERRACOTTA} />, unfocused: <Ionicons name="home-outline" size={24} color="#AAAAAA" /> },
    { focused: <MaterialIcons name="menu" size={26} color={TERRACOTTA} />, unfocused: <MaterialIcons name="menu" size={26} color="#AAAAAA" /> },
    { focused: <Ionicons name="document" size={24} color={TERRACOTTA} />, unfocused: <Ionicons name="document-outline" size={24} color="#AAAAAA" /> },
  ];

  return (
    <Animated.View style={[s.wrapper, { paddingBottom: Math.max(insets.bottom, 8) + 8 }, { transform: [{ translateY }] }]}>

      {/* Glass pill */}
      <View style={s.pillShadow}>
        <View style={s.pillInner}>
          <BlurView intensity={85} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, s.pillOverlay]} />
          {/* Top specular shine — liquid glass refraction strip */}
          <View pointerEvents="none" style={s.pillShine} />
          {/* Glass highlight border */}
          <View pointerEvents="none" style={s.pillBorder} />
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
                  {isFocused ? icons[index].focused : icons[index].unfocused}
                  {isFocused && <View style={s.activeDot} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      {/* FAB — liquid glass terracotta */}
      <TouchableOpacity style={s.fab} onPress={onFabPress} activeOpacity={0.85}>
        <View style={s.fabInner}>
          <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, s.fabOverlay]} />
          {/* Specular highlight — top-left bright dot */}
          <View pointerEvents="none" style={s.fabShine} />
          <View pointerEvents="none" style={s.fabShineSm} />
          <View pointerEvents="none" style={s.fabBorder} />
          <Ionicons name={fabOpen ? 'close' : 'add'} size={32} color={WHITE} />
        </View>
      </TouchableOpacity>

    </Animated.View>
  );
}

const WHITE = '#FFFFFF';

export default function TabLayout() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const fetchInsightsData = useLogStore(s => s.fetchInsightsData);
  useEffect(() => { fetchInsightsData(); }, []);
  const { profile } = useProfile();
  const effectiveProfile = profile ?? MOCK_PROFILE;

  return (
    <HealthProvider profile={effectiveProfile}>
      <TabBarVisibilityProvider>
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
        </Tabs>
        <AddEntrySheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
      </TabBarVisibilityProvider>
    </HealthProvider>
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingTop: 8,
  },

  // Pill
  pillShadow: { flex: 1, marginRight: 14, borderRadius: 36, shadowColor: '#1C0F09', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.14, shadowRadius: 28, elevation: 10 },
  pillInner: { borderRadius: 36, overflow: 'hidden' },
  pillOverlay: { borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.22)' },
  // Top specular shine strip — simulates liquid glass light refraction
  pillShine: { position: 'absolute', top: 0, left: 16, right: 16, height: 1.5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.90)' },
  pillBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 36, borderWidth: 1, borderTopColor: 'rgba(255,255,255,0.75)', borderLeftColor: 'rgba(255,255,255,0.50)', borderRightColor: 'rgba(255,255,255,0.10)', borderBottomColor: 'rgba(255,255,255,0.04)' },
  pillContent: { flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 10 },

  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  activeDot: { position: 'absolute', bottom: -6, width: 4, height: 4, borderRadius: 2, backgroundColor: TERRACOTTA },

  // FAB — liquid glass terracotta (blur shows through, not solid)
  fab: { width: 62, height: 62, borderRadius: 31, shadowColor: TERRACOTTA, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.55, shadowRadius: 18, elevation: 10, marginBottom: 2 },
  fabInner: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fabOverlay: { borderRadius: 31, backgroundColor: 'rgba(196,90,48,0.70)' },
  // Specular highlights — sphere-like refraction
  fabShine: { position: 'absolute', top: 9, left: 11, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,220,190,0.35)' },
  fabShineSm: { position: 'absolute', top: 20, left: 20, width: 9, height: 9, borderRadius: 4.5, backgroundColor: 'rgba(255,255,255,0.22)' },
  fabBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 31, borderWidth: 1.5, borderTopColor: 'rgba(255,220,185,0.80)', borderLeftColor: 'rgba(255,210,170,0.50)', borderRightColor: 'rgba(0,0,0,0.10)', borderBottomColor: 'rgba(0,0,0,0.20)' },
});
