import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import type { LeanPreservationResult } from '@/lib/body-composition';

const ORANGE = '#FF742A';

// Clinical trial benchmarks for lean mass loss as % of total weight lost
const BENCHMARKS = [
  { label: 'STEP 1 (Semaglutide)', leanPct: 39 },
  { label: 'SURMOUNT (Tirzepatide)', leanPct: 33 },
];

type Props = {
  result: LeanPreservationResult;
  medicationBrand?: string;
};

export function LeanMassPreservationCard({ result, medicationBrand }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const preserved = Math.round(result.preservationPct * 10) / 10;
  const lostLbs = Math.round(result.leanLostLbs * 10) / 10;

  // Status color based on preservation
  const statusColor = preserved >= 95 ? '#34C759'
    : preserved >= 90 ? '#FF9500'
    : preserved >= 85 ? '#FF6B00'
    : '#FF3B30';

  const statusLabel = preserved >= 95 ? 'Excellent'
    : preserved >= 90 ? 'Good'
    : preserved >= 85 ? 'Fair'
    : 'Low';

  return (
    <View style={s.card}>
      <Text style={s.title}>Lean Mass Preservation</Text>

      {/* Hero metric */}
      <View style={s.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={[s.heroValue, { color: statusColor }]}>{preserved}%</Text>
          <Text style={s.heroLabel}>lean mass preserved</Text>
        </View>
        <View style={[s.badge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[s.badgeText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.stat}>
          <Text style={s.statValue}>{result.startLeanLbs.toFixed(1)}</Text>
          <Text style={s.statLabel}>Start (lbs)</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: w(0.08) }]} />
        <View style={s.stat}>
          <Text style={s.statValue}>{result.currentLeanLbs.toFixed(1)}</Text>
          <Text style={s.statLabel}>Current (lbs)</Text>
        </View>
        <View style={[s.statDivider, { backgroundColor: w(0.08) }]} />
        <View style={s.stat}>
          <Text style={[s.statValue, { color: lostLbs > 0 ? '#FF9500' : '#34C759' }]}>
            {lostLbs > 0 ? `-${lostLbs}` : `+${Math.abs(lostLbs)}`}
          </Text>
          <Text style={s.statLabel}>Change (lbs)</Text>
        </View>
      </View>

      {/* Clinical benchmarks */}
      <View style={s.benchSection}>
        <Text style={s.benchTitle}>vs. Clinical Trials</Text>
        {BENCHMARKS.map((b, i) => {
          // Our user's lean loss as % of total weight lost
          const totalWeightLost = (result.startLeanLbs + (result.startLeanLbs / (result.preservationPct / 100) * (100 - result.preservationPct) / 100)) - result.currentLeanLbs;
          const userLeanPct = totalWeightLost > 0 ? (result.leanLostLbs / totalWeightLost) * 100 : 0;
          const betterThanTrial = userLeanPct < b.leanPct;
          return (
            <View key={i} style={s.benchRow}>
              <Text style={s.benchLabel}>{b.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={s.benchValue}>{b.leanPct}% lean loss</Text>
                {betterThanTrial && (
                  <View style={[s.badge, { backgroundColor: '#34C75920', paddingHorizontal: 6, paddingVertical: 2 }]}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#34C759' }}>Better</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Recommendations */}
      <View style={[s.recsSection, { backgroundColor: w(0.03) }]}>
        <Text style={s.recsTitle}>How to Preserve Lean Mass</Text>
        <Text style={s.recItem}>Protein: 1.2-1.6 g per kg body weight daily</Text>
        <Text style={s.recItem}>Resistance training: 2-3 sessions per week</Text>
        <Text style={s.recItem}>Adequate sleep: 7-9 hours for muscle recovery</Text>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 20,
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.3,
      marginBottom: 16,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    heroValue: {
      fontSize: 40,
      fontWeight: '800',
      letterSpacing: -2,
      lineHeight: 44,
    },
    heroLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: w(0.5),
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
    },
    badgeText: {
      fontSize: 13,
      fontWeight: '700',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statDivider: {
      width: 1,
      height: 28,
    },
    statValue: {
      fontSize: 18,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.3,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: '500',
      color: w(0.4),
      marginTop: 2,
    },
    benchSection: {
      marginBottom: 14,
    },
    benchTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: w(0.5),
      marginBottom: 8,
    },
    benchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    benchLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: w(0.6),
      flex: 1,
    },
    benchValue: {
      fontSize: 13,
      fontWeight: '600',
      color: w(0.45),
    },
    recsSection: {
      borderRadius: 14,
      padding: 14,
    },
    recsTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: ORANGE,
      marginBottom: 8,
    },
    recItem: {
      fontSize: 13,
      fontWeight: '400',
      color: w(0.55),
      lineHeight: 20,
      paddingLeft: 4,
    },
  });
};
