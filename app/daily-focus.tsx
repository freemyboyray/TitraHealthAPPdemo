import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/contexts/theme-context';
import { categoryColor, focusCategoryColor } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import type { FocusCategory, FocusItem } from '@/constants/scoring';
import { WaterLogSheet } from '@/components/water-log-sheet';

const FF = 'System';

// ─── Section definitions ────────────────────────────────────────────────────

type TaskSection = {
  key: string;
  label: string;
  colorKey: string;
  focusIds: FocusCategory[];
};

const SECTIONS: TaskSection[] = [
  { key: 'eat',  label: 'Eat',  colorKey: 'nutrition', focusIds: ['protein', 'hydration', 'fiber'] },
  { key: 'move', label: 'Move', colorKey: 'activity',  focusIds: ['activity'] },
  { key: 'rest', label: 'Rest', colorKey: 'sleep',     focusIds: ['sleep'] },
];

const FALLBACK_ITEMS: Record<string, FocusItem> = {
  sleep: {
    id: 'sleep',
    label: 'Get 7–9 hours of sleep',
    subtitle: 'Connect Apple Health to track',
    lucideIcon: 'Moon',
    status: 'pending',
    progressPct: 0,
    valueLabel: '— / 7–9h',
  },
};

// ─── Focus Row ──────────────────────────────────────────────────────────────

function FocusRow({
  item, accent, onTap, colors, isLast,
}: {
  item: FocusItem; accent: string; onTap: (item: FocusItem) => void;
  colors: AppColors; isLast: boolean;
}) {
  const done = item.status === 'completed';
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const pct = Math.min(item.progressPct ?? 0, 100);
  const barColor = focusCategoryColor(colors.isDark, item.id);

  const shortValue = (item.valueLabel ?? '')
    .replace(/,000 steps/, 'k')
    .replace(/,000/, 'k');

  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onTap(item); }}
      style={{ paddingVertical: 14 }}
      accessibilityLabel={`${item.label}, ${done ? 'completed' : 'incomplete'}`}
      accessibilityRole="button"
    >
      {/* Label row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 10 }}>
        <View style={{
          width: 20, height: 20, borderRadius: 10,
          borderWidth: done ? 0 : 1.5, borderColor: w(0.15),
          backgroundColor: done ? '#4CAF50' : 'transparent',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {done && <Check size={11} color="#fff" strokeWidth={3} />}
        </View>
        <Text style={{
          fontSize: 15, fontWeight: '600', flex: 1,
          color: done ? w(0.35) : colors.textPrimary, fontFamily: FF,
          textDecorationLine: done ? 'line-through' : 'none',
        }}>
          {item.label}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '500', color: w(0.35), fontFamily: FF }}>
          {shortValue}
        </Text>
        <ChevronRight size={14} color={w(0.15)} />
      </View>

      {/* Progress bar */}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: barColor + '15', overflow: 'hidden', marginLeft: 30 }}>
        <View style={{
          width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` as any,
          height: 6, borderRadius: 3,
          backgroundColor: done ? '#4CAF50' : barColor,
          opacity: done ? 0.6 : 1,
        }} />
      </View>

      {/* Separator */}
      {!isLast && (
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: w(0.06), marginTop: 14, marginLeft: 30 }} />
      )}
    </Pressable>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

function Section({
  section, items, onFocusTap, colors,
}: {
  section: TaskSection; items: FocusItem[];
  onFocusTap: (item: FocusItem) => void; colors: AppColors;
}) {
  const accent = categoryColor(colors.isDark, section.colorKey);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  // Aggregate progress for the big value display
  const completedCount = items.filter(i => i.status === 'completed').length;
  const total = items.length;
  const avgPct = total > 0
    ? Math.round(items.reduce((sum, i) => sum + (i.progressPct ?? (i.status === 'completed' ? 100 : 0)), 0) / total)
    : 0;

  // Overall progress bar
  const overallBarPct = Math.min(avgPct, 100);

  return (
    <View style={{ marginBottom: 32 }}>
      {/* Section header — Apple Fitness style */}
      <Text style={{ fontSize: 22, fontWeight: '400', color: w(0.85), fontFamily: FF, marginBottom: 2 }}>
        {section.label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 }}>
        <Text style={{ fontSize: 34, fontWeight: '800', color: accent, fontFamily: FF, letterSpacing: -1 }}>
          {completedCount}/{total}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: accent, fontFamily: FF, marginLeft: 2, textTransform: 'uppercase' }}>
          done
        </Text>
      </View>

      {/* Overall progress bar */}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: accent + '18', overflow: 'hidden', marginBottom: 8 }}>
        <View style={{
          width: `${Math.max(overallBarPct, overallBarPct > 0 ? 2 : 0)}%` as any,
          height: 6, borderRadius: 3, backgroundColor: accent,
        }} />
      </View>

      {/* Focus items */}
      {items.map((item, i) => (
        <FocusRow
          key={item.id}
          item={item}
          accent={accent}
          onTap={onFocusTap}
          colors={colors}
          isLast={i === items.length - 1}
        />
      ))}
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function DailyFocusScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { focuses } = useHealthData();
  const [waterLogVisible, setWaterLogVisible] = useState(false);

  const focusMap = useMemo(() => {
    const map = new Map<string, FocusItem>();
    for (const f of focuses) map.set(f.id, f);
    return map;
  }, [focuses]);

  const sectionData = useMemo(() => {
    return SECTIONS.map(section => {
      const items = section.focusIds
        .map(id => focusMap.get(id) ?? FALLBACK_ITEMS[id])
        .filter(Boolean) as FocusItem[];
      return { section, items };
    });
  }, [focusMap]);

  const handleFocusTap = useCallback((item: FocusItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (item.id === 'hydration') { setWaterLogVisible(true); return; }
    const routes: Record<string, string> = {
      protein: '/entry/log-food',
      fiber: '/entry/log-food',
      activity: '/entry/log-activity',
    };
    const route = routes[item.id];
    if (route) router.push(route as any);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
      }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={12}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>
          Today's Focus
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 80 }}
      >
        {sectionData.map(({ section, items }) => (
          <Section
            key={section.key}
            section={section}
            items={items}
            onFocusTap={handleFocusTap}
            colors={colors}
          />
        ))}
      </ScrollView>

      <WaterLogSheet visible={waterLogVisible} onClose={() => setWaterLogVisible(false)} />
    </View>
  );
}
