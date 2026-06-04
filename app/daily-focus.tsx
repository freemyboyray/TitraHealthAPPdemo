import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Check, ChevronRight, Minus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/contexts/theme-context';
import { categoryColor, focusCategoryColor } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import type { FocusCategory, FocusItem } from '@/constants/scoring';
import { usePreferencesStore } from '@/stores/preferences-store';
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

// Focus categories that can ONLY be populated from Apple Health / a wearable —
// there is no manual logging path for these. When the data is missing we keep the
// row visible but render its checkbox as an inert dash (it can't be hand-completed),
// and tapping it routes to the Apple Health connect screen instead of doing nothing.
const HEALTH_ONLY_FOCUS: FocusCategory[] = ['sleep'];

// A focus item plus a UI-only flag marking it as a non-completable placeholder
// (health-only focus with no data yet). Lives here rather than on FocusItem so the
// shared scoring type stays purely about real, computed focuses.
type RenderFocus = FocusItem & { placeholder?: boolean };

// Build the stand-in sleep row shown when no sleep value is available today.
// The discriminator is whether Apple Health is *connected* — NOT whether sleep
// data is flowing. A connected user with no sleep data just needs to wear a device
// to bed; only a disconnected user should be told to connect. (Keying this off the
// "data flowing" signal would wrongly tell connected-but-no-data users to reconnect.)
function makeSleepPlaceholder(connected: boolean): RenderFocus {
  return {
    id: 'sleep',
    label: 'Prioritize sleep tonight',
    subtitle: connected
      ? 'No sleep data yet — wear your device to bed to track it.'
      : 'Connect Apple Health to track sleep automatically.',
    status: 'pending',
    lucideIcon: 'Moon',
    progressPct: 0,
    valueLabel: '—',
    placeholder: true,
  };
}

// ─── Focus Row ──────────────────────────────────────────────────────────────

function FocusRow({
  item, accent, onTap, colors, isLast,
}: {
  item: RenderFocus; accent: string; onTap: (item: RenderFocus) => void;
  colors: AppColors; isLast: boolean;
}) {
  const done = item.status === 'completed';
  const placeholder = item.placeholder === true;
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
      accessibilityLabel={
        placeholder
          ? `${item.label}, no data yet, tap to connect Apple Health`
          : `${item.label}, ${done ? 'completed' : 'incomplete'}`
      }
      accessibilityRole="button"
    >
      {/* Label row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 10 }}>
        {placeholder ? (
          // Inert dash — this row can't be hand-completed; data has to sync from a wearable.
          <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
            <Minus size={14} color={w(0.2)} strokeWidth={2.5} />
          </View>
        ) : (
          <View style={{
            width: 20, height: 20, borderRadius: 10,
            borderWidth: done ? 0 : 1.5, borderColor: w(0.15),
            backgroundColor: done ? '#4CAF50' : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}>
            {done && <Check size={11} color="#fff" strokeWidth={3} />}
          </View>
        )}
        <Text style={{
          fontSize: 15, fontWeight: '600', flex: 1,
          color: placeholder ? w(0.4) : done ? w(0.35) : colors.textPrimary, fontFamily: FF,
          textDecorationLine: done ? 'line-through' : 'none',
        }}>
          {item.label}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '500', color: w(0.35), fontFamily: FF }}>
          {shortValue}
        </Text>
        <ChevronRight size={14} color={w(0.15)} />
      </View>

      {/* Subtitle / hint — only the placeholder surfaces it inline, as its affordance text */}
      {placeholder && !!item.subtitle && (
        <Text style={{ fontSize: 13, color: w(0.4), fontFamily: FF, marginLeft: 30, marginBottom: 8 }}>
          {item.subtitle}
        </Text>
      )}

      {/* Progress bar — muted, fill-less track for placeholders */}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: barColor + (placeholder ? '0D' : '15'), overflow: 'hidden', marginLeft: 30 }}>
        {!placeholder && (
          <View style={{
            width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` as any,
            height: 6, borderRadius: 3,
            backgroundColor: done ? '#4CAF50' : barColor,
            opacity: done ? 0.6 : 1,
          }} />
        )}
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
  section: TaskSection; items: RenderFocus[];
  onFocusTap: (item: RenderFocus) => void; colors: AppColors;
}) {
  const accent = categoryColor(colors.isDark, section.colorKey);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  // Counter + progress reflect only actionable rows — a data-pending placeholder
  // (e.g. sleep with no wearable sync) isn't something the user can check off.
  const countable = items.filter(i => !i.placeholder);
  const completedCount = countable.filter(i => i.status === 'completed').length;
  const total = countable.length;
  const avgPct = total > 0
    ? Math.round(countable.reduce((sum, i) => sum + (i.progressPct ?? (i.status === 'completed' ? 100 : 0)), 0) / total)
    : 0;

  // Overall progress bar
  const overallBarPct = Math.min(avgPct, 100);

  // No countable items (e.g. Rest with only a data-pending sleep row) → suppress the
  // misleading "0/0 DONE" counter and progress bar, but keep the section + its row.
  const headerOnly = total === 0;

  return (
    <View style={{ marginBottom: 32 }}>
      {/* Section header — Apple Fitness style */}
      <Text style={{ fontSize: 22, fontWeight: '400', color: w(0.85), fontFamily: FF, marginBottom: headerOnly ? 4 : 2 }}>
        {section.label}
      </Text>

      {!headerOnly && (
        <>
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
        </>
      )}

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
  // Connect-vs-"wear your device" wording keys off whether Apple Health is
  // connected at all — a connected user with no sleep data shouldn't be told to
  // reconnect; they just haven't synced a night yet.
  const appleHealthEnabled = usePreferencesStore(s => s.appleHealthEnabled);
  const [waterLogVisible, setWaterLogVisible] = useState(false);

  const focusMap = useMemo(() => {
    const map = new Map<string, FocusItem>();
    for (const f of focuses) map.set(f.id, f);
    return map;
  }, [focuses]);

  const sectionData = useMemo(() => {
    return SECTIONS.map(section => {
      const items: RenderFocus[] = [];
      for (const id of section.focusIds) {
        const f = focusMap.get(id);
        if (f) { items.push(f); continue; }
        // A health-only focus (e.g. sleep) with no data → keep the row visible as
        // an inert placeholder rather than dropping it from the section.
        if (HEALTH_ONLY_FOCUS.includes(id) && id === 'sleep') {
          items.push(makeSleepPlaceholder(appleHealthEnabled));
        }
      }
      return { section, items };
    });
  }, [focusMap, appleHealthEnabled]);

  const handleFocusTap = useCallback((item: RenderFocus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // A data-pending health row routes to the Apple Health connect screen so the
    // user can see/fix their connection rather than tapping a dead checkbox.
    if (item.placeholder) { router.push('/settings/apple-health' as any); return; }
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
