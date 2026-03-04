import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React, { useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddEntrySheet } from '@/components/add-entry-sheet';
import { TabBarVisibilityProvider, useTabBarVisibility } from '@/contexts/tab-bar-visibility';

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
          <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, s.pillOverlay]} />
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

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={onFabPress} activeOpacity={0.85}>
        <View style={s.fabInner}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, s.fabOverlay]} />
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

  return (
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
  );
}

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingTop: 8,
  },

  // Pill
  pillShadow: { flex: 1, marginRight: 14, borderRadius: 36, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 10 },
  pillInner: { borderRadius: 36, overflow: 'hidden' },
  pillOverlay: { borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.18)' },
  pillBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 36, borderWidth: 1, borderTopColor: 'rgba(255,255,255,0.7)', borderLeftColor: 'rgba(255,255,255,0.45)', borderRightColor: 'rgba(255,255,255,0.12)', borderBottomColor: 'rgba(255,255,255,0.06)' },
  pillContent: { flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 10 },

  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  activeDot: { position: 'absolute', bottom: -6, width: 4, height: 4, borderRadius: 2, backgroundColor: TERRACOTTA },

  // FAB
  fab: { width: 62, height: 62, borderRadius: 31, shadowColor: TERRACOTTA, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.7, shadowRadius: 16, elevation: 10, marginBottom: 2 },
  fabInner: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fabOverlay: { borderRadius: 31, backgroundColor: 'rgba(196,90,48,0.92)' },
  fabBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 31, borderWidth: 1.5, borderTopColor: 'rgba(255,210,170,0.65)', borderLeftColor: 'rgba(255,200,160,0.4)', borderRightColor: 'rgba(0,0,0,0.12)', borderBottomColor: 'rgba(0,0,0,0.18)' },
});
