import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation, categoryColor } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import type { FocusItem } from '@/constants/scoring';

// ─── Section definitions ────────────────────────────────────────────────────

const SECTIONS = [
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

// ─── Progress Ring ──────────────────────────────────────────────────────────

const RING_SIZE = 64;
const STROKE_WIDTH = 5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ProgressRing({
  pct, accent, allDone,
}: {
  pct: number; accent: string; allDone: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const dashArray = `${(clamped / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
          fill="none" stroke={accent + '20'} strokeWidth={STROKE_WIDTH}
        />
        <Circle
          cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
          fill="none" stroke={allDone ? '#4CAF50' : accent}
          strokeWidth={STROKE_WIDTH} strokeDasharray={dashArray}
          strokeLinecap="round" rotation={-90}
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <View style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }}>
        {allDone ? (
          <Check size={18} color="#4CAF50" strokeWidth={2.5} />
        ) : (
          <Text style={{ fontSize: 15, fontWeight: '700', color: accent, fontFamily: 'System' }}>
            {Math.round(clamped)}%
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export type DailyTaskCardsProps = {
  focuses: FocusItem[];
};

export function DailyTaskCards({ focuses }: DailyTaskCardsProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const elevation = useMemo(() => cardElevation(colors.isDark), [colors.isDark]);

  const focusMap = useMemo(() => {
    const map = new Map<string, FocusItem>();
    for (const f of focuses) map.set(f.id, f);
    return map;
  }, [focuses]);

  const sectionItems = useMemo(() => {
    return SECTIONS.map(section => {
      const items = section.focusIds
        .map(id => focusMap.get(id) ?? FALLBACK_ITEMS[id])
        .filter(Boolean) as FocusItem[];
      return { section, items };
    });
  }, [focusMap]);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/daily-focus' as any);
      }}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, ...elevation }]}
      accessibilityLabel="Today's Focus. Tap to see details."
      accessibilityRole="button"
    >
      <Text style={[styles.header, { color: w(0.4) }]}>Today's Focus</Text>
      <View style={styles.ringRow}>
        {sectionItems.map(({ section, items }) => {
          const accent = categoryColor(colors.isDark, section.colorKey);
          const allDone = items.length > 0 && items.every(i => i.status === 'completed');
          const avgPct = items.length > 0
            ? items.reduce((sum, i) => sum + (i.progressPct ?? (i.status === 'completed' ? 100 : 0)), 0) / items.length
            : 0;

          return (
            <View key={section.key} style={{ alignItems: 'center' }}>
              <ProgressRing pct={avgPct} accent={accent} allDone={allDone} />
              <Text style={[styles.ringLabel, { color: w(0.65) }]}>{section.label}</Text>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 0.5,
    marginBottom: 16,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  header: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
    fontFamily: 'System',
  },
  ringRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  ringLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    fontFamily: 'System',
  },
});
