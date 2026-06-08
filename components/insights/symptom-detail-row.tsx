import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowDown, ArrowUp, Minus, X } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation, type AppColors } from '@/constants/theme';
import { severityColor } from '@/constants/side-effects';
import { symptomAbout } from '@/constants/side-effect-education';
import type { SideEffectLog } from '@/stores/log-store';
import { computeSymptomDailySeries, type SymptomTrend } from '@/lib/side-effect-insights';
import { useUiStore } from '@/stores/ui-store';
import { useExpandToFullscreen, ExpandOverlay } from '@/components/ui/expand-in-place';
import { SeverityLineChart } from '@/components/insights/severity-line-chart';
import { Sparkline } from '@/components/insights/sparkline';
import { EffectIcon, effectLabel } from '@/components/insights/effect-icon';

const FF = 'System';

type TrendStyle = { label: string; color: string; Icon: typeof ArrowDown | null };

function trendStyle(t: SymptomTrend['trend'], colors: AppColors): TrendStyle {
  const muted = colors.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  if (t === 'improving') return { label: 'Improving', color: '#27AE60', Icon: ArrowDown };
  if (t === 'worsening') return { label: 'Worsening', color: '#E74C3C', Icon: ArrowUp };
  if (t === 'insufficient') return { label: 'New', color: muted, Icon: null };
  return { label: 'Steady', color: muted, Icon: Minus };
}

function distributionLine(b: SymptomTrend['breakdown']): string {
  const parts: string[] = [];
  if (b.mild) parts.push(`${b.mild} mild`);
  if (b.moderate) parts.push(`${b.moderate} moderate`);
  if (b.severe) parts.push(`${b.severe} severe`);
  return parts.join(', ');
}

/**
 * A single symptom on the Symptom Changes page — a HealthSummaryCard-style row
 * (icon + name + count + trend + sparkline, no chevron) that morphs in place into
 * a blurred detail card (the PK-graph pattern): why it matters → 30-day graph →
 * personalized line. No explicit expand icon; tapping the row is the affordance.
 */
export function SymptomDetailRow({
  trend, logs, aiText,
}: {
  trend: SymptomTrend;
  logs: SideEffectLog[];
  aiText: string;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const exp = useExpandToFullscreen({ mode: 'card', cardHeight: 680 });
  const { openAiChat } = useUiStore();
  const [chartW, setChartW] = useState(0);

  const color = severityColor(trend.avgSev);
  const iconColor = colors.textPrimary; // glyphs stay neutral; the line carries the color
  const name = effectLabel(trend.type);
  const ts = trendStyle(trend.trend, colors);
  const distribution = distributionLine(trend.breakdown);

  const series = useMemo(() => computeSymptomDailySeries(logs, trend.type, 30), [logs, trend.type]);
  // Compact to logged points only so the sparkline spans the full width rather
  // than clustering wherever the dates happen to fall in the 30-day window.
  const sparkValues = useMemo(() => series.map(p => p.worst).filter((v): v is number => v != null), [series]);

  const onChartLayout = (e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width);

  const askAi = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({
      type: 'metric',
      contextLabel: `${name} pattern`,
      contextValue: `${trend.count} logs in 30 days, trend ${ts.label}.`,
      chips: JSON.stringify([
        `Is my ${name.toLowerCase()} normal for my phase?`,
        `How can I ease ${name.toLowerCase()}?`,
        'Should I contact my care team?',
      ]),
    });
  };

  return (
    <>
      <Pressable
        ref={exp.cardRef}
        onPress={exp.open}
        onLongPress={askAi}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${trend.count} logs, ${ts.label}. Tap for the full pattern`}
        style={({ pressed }) => [s.row, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
      >
        <View style={s.rowHeader}>
          <View style={s.rowHeaderLeft}>
            <EffectIcon type={trend.type} size={15} color={iconColor} />
            <Text style={s.rowLabel} numberOfLines={1}>{name}</Text>
          </View>
        </View>
        <View style={s.rowBody}>
          <View style={{ flex: 1 }}>
            <View style={s.valueRow}>
              <Text style={s.value}>{trend.count}</Text>
              <Text style={s.unit}>{trend.count === 1 ? 'log' : 'logs'}</Text>
            </View>
            <View style={s.trendRow}>
              {ts.Icon && <ts.Icon size={12} color={ts.color} />}
              <Text style={[s.trendText, { color: ts.color }]}>{ts.label}</Text>
            </View>
          </View>
          <Sparkline values={sparkValues} color={color} />
        </View>
      </Pressable>

      <ExpandOverlay exp={exp}>
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={s.expHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <EffectIcon type={trend.type} size={22} color={iconColor} />
              <View style={{ flex: 1 }}>
                <Text style={s.expTitle}>{name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  {ts.Icon && <ts.Icon size={12} color={ts.color} />}
                  <Text style={[s.expTrend, { color: ts.color }]}>{ts.label}</Text>
                </View>
              </View>
            </View>
            <Pressable onPress={exp.close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={24} color={w(0.45)} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            <Text style={[s.countLine, { color: w(0.45) }]}>
              {trend.count} {trend.count === 1 ? 'log' : 'logs'} in 30 days{distribution ? `  (${distribution})` : ''}
            </Text>

            <Text style={s.lead}>{symptomAbout(trend.type)}</Text>

            <View style={{ marginTop: 14 }} onLayout={onChartLayout}>
              {chartW > 0 && (
                <SeverityLineChart
                  series={[{ points: series, color }]}
                  width={chartW}
                  height={190}
                  colors={colors}
                  showArea
                />
              )}
            </View>

            {!!aiText && (
              <View style={s.aiBlock}>
                <Text style={s.aiEyebrow}>Personalized for you</Text>
                <Text style={s.aiBody}>{aiText}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </ExpandOverlay>
    </>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    row: {
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
      ...cardElevation(c.isDark),
    },
    rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    rowHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
    rowLabel: { fontSize: 14, fontWeight: '600', color: c.textPrimary, letterSpacing: -0.2, fontFamily: FF, flexShrink: 1 },
    rowBody: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
    valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
    value: { fontSize: 28, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.6, fontFamily: FF },
    unit: { fontSize: 14, fontWeight: '600', color: c.textSecondary, marginBottom: 3, fontFamily: FF },
    trendRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    trendText: { fontSize: 13, fontWeight: '700', fontFamily: FF },

    // Expanded
    expHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10,
    },
    expTitle: { fontSize: 21, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.4, fontFamily: FF },
    expTrend: { fontSize: 13, fontWeight: '700', fontFamily: FF },
    countLine: { fontSize: 13, fontFamily: FF, marginBottom: 12 },
    lead: { fontSize: 14.5, color: w(0.6), lineHeight: 21, fontFamily: FF },
    aiBlock: { marginTop: 18, padding: 14, borderRadius: 16, backgroundColor: c.orange + (c.isDark ? '14' : '0E') },
    aiEyebrow: { fontSize: 13, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
    aiBody: { fontSize: 14.5, color: w(0.72), lineHeight: 21, marginTop: 8, fontFamily: FF },
  });
};
