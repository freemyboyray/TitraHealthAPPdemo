import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useUiStore } from '@/stores/ui-store';
import type { MetabolicAdaptationResult } from '@/lib/cycle-intelligence';

const PLATEAU_BADGE = {
  none:       { bg: 'transparent',              text: 'transparent' },
  approaching: { bg: 'rgba(243,156,18,0.15)',   text: '#F39C12' },
  detected:   { bg: 'rgba(231,76,60,0.15)',     text: '#E74C3C' },
};

const PLATEAU_LABEL = {
  none:       '',
  approaching: 'Adaptation Signal',
  detected:   'Plateau Detected',
};

type MiniBarChartProps = {
  data: number[];
  labels: string[];
  color: string;
  height?: number;
};

function MiniBarChart({ data, labels, color, height = 60 }: MiniBarChartProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const valid = data.filter(v => v > 0);
  if (valid.length === 0) return null;
  const max = Math.max(...valid);

  // Show last 8 bars max
  const displayData   = data.slice(-8);
  const displayLabels = labels.slice(-8);

  return (
    <View style={{ gap: 4 }}>
      <View style={[s.barChartRow, { height }]}>
        {displayData.map((v, i) => {
          const fillH = max > 0 ? Math.round((v / max) * height) : 0;
          return (
            <View key={i} style={[s.barCol, { height }]}>
              <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                <View style={[
                  s.bar,
                  { height: fillH, backgroundColor: i === displayData.length - 1 ? color : `${color}60` },
                ]} />
              </View>
            </View>
          );
        })}
      </View>
      <View style={s.barLabels}>
        {displayLabels.map((label, i) => (
          <Text key={i} style={s.barLabel} numberOfLines={1}>{label}</Text>
        ))}
      </View>
    </View>
  );
}

type MetabolicAdaptationCardProps = {
  result: MetabolicAdaptationResult;
};

export function MetabolicAdaptationCard({ result }: MetabolicAdaptationCardProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { openAiChat } = useUiStore();
  const plateau = PLATEAU_BADGE[result.plateauRisk];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const context = result.adaptationMessage ?? 'Metabolic adaptation monitoring is active.';
    openAiChat({
      contextLabel: 'Metabolic Adaptation',
      contextValue: context,
      seedMessage: context,
      chips: JSON.stringify([
        'What is metabolic adaptation?',
        'How do I break a plateau?',
        'Should I adjust my calories?',
        'What does this mean for my GLP-1 journey?',
      ]),
    });
  };

  if (!result.hasEnoughData) {
    return (
      <View style={[s.card, s.emptyCard]}>
        <Text style={s.cardTitle}>Metabolic Adaptation</Text>
        <Text style={s.emptyText}>
          Log 4+ weeks of activity to see metabolic trends and plateau risk.
        </Text>
      </View>
    );
  }

  return (
    <Pressable style={s.card} onLongPress={handlePress}>
      {/* Header */}
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Metabolic Adaptation</Text>
        {result.plateauRisk !== 'none' && (
          <View style={[s.plateauBadge, { backgroundColor: plateau.bg }]}>
            <Text style={[s.plateauBadgeText, { color: plateau.text }]}>
              {PLATEAU_LABEL[result.plateauRisk]}
            </Text>
          </View>
        )}
      </View>

      {/* RHR improvement */}
      {result.rhrImprovementBpm != null && (
        <View style={s.statRow}>
          <Text style={s.statLabel}>Cardiovascular Progress</Text>
          <Text style={[
            s.statValue,
            { color: result.rhrImprovementBpm > 0 ? '#27AE60' : result.rhrImprovementBpm < 0 ? '#E74C3C' : colors.textSecondary },
          ]}>
            {result.rhrImprovementBpm > 0 ? `↓ ${result.rhrImprovementBpm} bpm RHR` :
             result.rhrImprovementBpm < 0 ? `↑ ${Math.abs(result.rhrImprovementBpm)} bpm RHR` :
             'No change'}
          </Text>
        </View>
      )}

      {/* Calorie efficiency chart */}
      {result.calPerStepTrend.some(v => v > 0) && (
        <View style={s.chartSection}>
          <Text style={s.chartTitle}>Calorie Efficiency (cal/1k steps)</Text>
          <MiniBarChart
            data={result.calPerStepTrend}
            labels={result.weekLabels}
            color="#FF742A"
            height={56}
          />
        </View>
      )}

      {/* RHR trend chart */}
      {result.rhrTrend.some(v => v > 0) && (
        <View style={s.chartSection}>
          <Text style={s.chartTitle}>Resting HR Trend (bpm)</Text>
          <MiniBarChart
            data={result.rhrTrend}
            labels={result.weekLabels}
            color="#5B8BF5"
            height={56}
          />
        </View>
      )}

      {/* Adaptation message */}
      {result.adaptationMessage && (
        <View style={[s.alertBox, { backgroundColor: plateau.bg, borderColor: plateau.text + '33' }]}>
          <Text style={[s.alertText, { color: plateau.text }]}>{result.adaptationMessage}</Text>
        </View>
      )}

      <Text style={s.tapHint}>Hold to discuss with AI coach</Text>
    </Pressable>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 20,
      marginBottom: 16,
      ...cardElevation(c.isDark),
    },
    emptyCard: {
      gap: 10,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'Helvetica Neue',
    },
    plateauBadge: {
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    plateauBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'Helvetica Neue',
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    statLabel: {
      fontSize: 13,
      color: w(0.5),
      fontFamily: 'Helvetica Neue',
    },
    statValue: {
      fontSize: 13,
      fontWeight: '700',
      fontFamily: 'Helvetica Neue',
    },
    chartSection: {
      marginBottom: 14,
      gap: 10,
    },
    chartTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.4),
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      fontFamily: 'Helvetica Neue',
    },
    barChartRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    barCol: {
      flex: 1,
    },
    bar: {
      borderRadius: 4,
      minHeight: 2,
    },
    barLabels: {
      flexDirection: 'row',
      gap: 4,
    },
    barLabel: {
      flex: 1,
      fontSize: 9,
      color: w(0.3),
      textAlign: 'center',
      fontFamily: 'Helvetica Neue',
    },
    alertBox: {
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      marginBottom: 10,
    },
    alertText: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: 'Helvetica Neue',
    },
    emptyText: {
      fontSize: 13,
      color: w(0.45),
      lineHeight: 19,
      fontFamily: 'Helvetica Neue',
    },
    tapHint: {
      fontSize: 11,
      color: w(0.3),
      textAlign: 'center',
      marginTop: 8,
      fontFamily: 'Helvetica Neue',
    },
  });
};
