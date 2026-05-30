import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Syringe, TrendingUp, Scale, TrendingDown } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation, focusCategoryColor } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import type { FocusCategory, FocusItem } from '@/constants/scoring';

const PHASE_ICONS: Record<string, React.ComponentType<any>> = {
  'Shot Day': Syringe,
  'Peak Phase': TrendingUp,
  'Steady State': Scale,
  'Winding Down': TrendingDown,
};

// ─── Bar chart focus IDs (in display order) ─────────────────────────────────

const BAR_FOCUS_IDS: FocusCategory[] = ['hydration', 'protein', 'fiber', 'activity'];

const BAR_LABELS: Record<string, string> = {
  hydration: 'Water',
  protein: 'Protein',
  fiber: 'Fiber',
  activity: 'Steps',
};

const BAR_HEIGHT = 120;
const BAR_WIDTH = 44;
const BAR_RADIUS = 12;

// ─── Phase Banner ────────────────────────────────────────────────────────────

function PhaseBanner({ text, colors }: { text: string; colors: AppColors }) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return (
    <View style={{
      borderLeftWidth: 3,
      borderLeftColor: colors.orange,
      paddingLeft: 12,
      paddingVertical: 8,
      marginBottom: 16,
      backgroundColor: colors.isDark ? 'rgba(255,116,42,0.05)' : 'rgba(232,101,42,0.04)',
      borderRadius: 8,
      borderTopRightRadius: 8,
      borderBottomRightRadius: 8,
    }}>
      <Text style={{
        fontSize: 13,
        fontWeight: '500',
        color: w(0.6),
        lineHeight: 18,
        fontFamily: 'System',
      }}>
        {text}
      </Text>
    </View>
  );
}

// ─── Bar Column ──────────────────────────────────────────────────────────────

function BarColumn({
  item,
  color,
  onTap,
  onLongPress,
  colors,
}: {
  item: FocusItem;
  color: string;
  onTap: (item: FocusItem) => void;
  onLongPress: (item: FocusItem) => void;
  colors: AppColors;
}) {
  const pct = Math.min(item.progressPct ?? 0, 100);
  const fillH = (pct / 100) * BAR_HEIGHT;
  const isDone = item.status === 'completed';
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  // Shorten long value labels (e.g. "0 / 10,000 steps" → "0 / 10k")
  const shortValue = (item.valueLabel ?? '')
    .replace(/,000 steps/, 'k')
    .replace(/,000/, 'k');

  return (
    <Pressable
      style={{ alignItems: 'center', flex: 1 }}
      onPress={() => onTap(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={400}
      accessibilityLabel={`${BAR_LABELS[item.id]}, ${item.valueLabel ?? ''}`}
      accessibilityRole="button"
    >
      {/* Bar */}
      <View style={{
        width: BAR_WIDTH,
        height: BAR_HEIGHT,
        borderRadius: BAR_RADIUS,
        backgroundColor: color + '12',
        justifyContent: 'flex-end',
        overflow: 'hidden',
      }}>
        <View style={{
          width: BAR_WIDTH,
          height: Math.max(fillH, fillH > 0 ? BAR_RADIUS : 0),
          borderRadius: BAR_RADIUS,
          backgroundColor: isDone ? '#4CAF50' : color,
          opacity: isDone ? 0.7 : 1,
        }} />
      </View>

      {/* Name */}
      <Text numberOfLines={1} style={{
        fontSize: 12,
        fontWeight: '600',
        color: w(0.6),
        marginTop: 8,
        fontFamily: 'System',
      }}>
        {BAR_LABELS[item.id]}
      </Text>

      {/* Value */}
      <Text numberOfLines={1} style={{
        fontSize: 11,
        fontWeight: '500',
        color: w(0.35),
        marginTop: 2,
        fontFamily: 'System',
      }}>
        {shortValue}
      </Text>
    </Pressable>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export type DailyActionCardsProps = {
  focuses: FocusItem[];
  sectionLabel: string;
  phaseBannerText: string | null;
  phaseBannerTitle?: string | null;
  isToday: boolean;
  onFocusTap: (item: FocusItem) => void;
  onFocusLongPress: (item: FocusItem) => void;
};

export function DailyActionCards({
  focuses,
  sectionLabel,
  phaseBannerText,
  phaseBannerTitle,
  isToday,
  onFocusTap,
  onFocusLongPress,
}: DailyActionCardsProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  // Filter to the 4 bar focuses in display order
  const barItems = useMemo(() => {
    return BAR_FOCUS_IDS
      .map(id => focuses.find(f => f.id === id))
      .filter(Boolean) as FocusItem[];
  }, [focuses]);

  return (
    <View>
      {/* Bar chart card */}
      <View style={s.card}>
        {/* Phase message — today only */}
        {isToday && phaseBannerText && (
          <View style={s.phaseMessage}>
            {phaseBannerTitle && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                {PHASE_ICONS[phaseBannerTitle] && React.createElement(PHASE_ICONS[phaseBannerTitle], { size: 14, color: colors.textPrimary })}
                <Text style={s.phaseTitle}>{phaseBannerTitle}</Text>
              </View>
            )}
            <Text style={s.phaseBody}>{phaseBannerText}</Text>
          </View>
        )}

        <View style={s.barRow}>
          {barItems.map(item => (
            <BarColumn
              key={item.id}
              item={item}
              color={focusCategoryColor(colors.isDark, item.id)}
              onTap={onFocusTap}
              onLongPress={onFocusLongPress}
              colors={colors}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function createStyles(c: AppColors) {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const elevation = cardElevation(c.isDark);

  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
      marginTop: 12,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: c.textPrimary,
      letterSpacing: -0.3,
      lineHeight: 28,
      fontFamily: 'System',
    },
    badge: {
      backgroundColor: c.borderSubtle,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: w(0.50),
      letterSpacing: 1,
      textTransform: 'uppercase',
      fontFamily: 'System',
    },
    card: {
      borderRadius: 20,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      marginBottom: 10,
      paddingVertical: 20,
      paddingHorizontal: 12,
      ...elevation,
    },
    barRow: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'flex-end',
    },
    phaseMessage: {
      marginBottom: 16,
      paddingHorizontal: 6,
    },
    phaseTitle: {
      fontSize: 19,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'System',
    },
    phaseBody: {
      fontSize: 13,
      fontWeight: '400',
      color: w(0.55),
      lineHeight: 18,
      fontFamily: 'System',
    },
  });
}
