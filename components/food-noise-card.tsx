import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GlassBorder } from '@/components/ui/glass-border';
import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';

type FoodNoiseLog = {
  score: number;
  logged_at: string;
};

type Props = {
  logs: FoodNoiseLog[];
};

function scoreColor(score: number): string {
  if (score <= 4)  return '#27AE60';
  if (score <= 9)  return '#F6CB45';
  if (score <= 14) return '#E8960C';
  return '#E53E3E';
}

function scoreLabel(score: number): string {
  if (score <= 4)  return 'Minimal';
  if (score <= 9)  return 'Mild';
  if (score <= 14) return 'Moderate';
  return 'High';
}

function SparkDot({ score, isLatest }: { score: number; isLatest: boolean }) {
  const color = scoreColor(score);
  const size  = isLatest ? 10 : 7;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color,
        opacity: isLatest ? 1 : 0.55,
      }}
    />
  );
}

/**
 * FoodNoiseCard - renders on Sundays or when ≥6 days since last FNQ.
 * Shows last score + 3-dot sparkline, or a "Check In" CTA if no score this week.
 */
export function FoodNoiseCard({ logs }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const router = useRouter();

  if (!logs || logs.length === 0) {
    return (
      <TouchableOpacity
        style={s.wrap}
        onPress={() => router.push('/entry/food-noise-survey' as any)}
        activeOpacity={0.8}
      >
        <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
        <GlassBorder r={20} isDark={colors.isDark} />
        <View style={s.inner}>
          <View style={s.leftRow}>
            <View style={s.iconWrap}>
              <Ionicons name="pulse-outline" size={20} color={ORANGE} />
            </View>
            <View>
              <Text style={s.title}>Food Noise Check-In</Text>
              <Text style={s.subtitle}>Weekly survey · 2 min</Text>
            </View>
          </View>
          <View style={s.ctaBtn}>
            <Text style={s.ctaText}>Check In</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  const sorted = [...logs].sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  const latest = sorted[0];
  const spark  = sorted.slice(0, 3).reverse(); // oldest → newest for left-to-right
  const latestColor = scoreColor(latest.score);
  const latestLabel = scoreLabel(latest.score);

  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={() => router.push('/entry/food-noise-survey' as any)}
      activeOpacity={0.8}
    >
      <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
      <GlassBorder r={20} isDark={colors.isDark} />
      <View style={s.inner}>
        <View style={s.leftRow}>
          <View style={s.iconWrap}>
            <Ionicons name="pulse-outline" size={20} color={ORANGE} />
          </View>
          <View>
            <Text style={s.title}>Food Noise</Text>
            <View style={[s.labelBadge, { backgroundColor: `${latestColor}22` }]}>
              <Text style={[s.labelText, { color: latestColor }]}>{latestLabel}</Text>
            </View>
          </View>
        </View>
        <View style={s.rightCol}>
          <Text style={[s.scoreText, { color: latestColor }]}>{latest.score}</Text>
          <Text style={s.scoreDenom}>/20</Text>
          {spark.length > 1 && (
            <View style={s.sparkRow}>
              {spark.map((l, i) => (
                <SparkDot key={i} score={l.score} isLatest={i === spark.length - 1} />
              ))}
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: c.surface,
    marginHorizontal: 0,
    marginBottom: 12,
    ...cardElevation(c.isDark),
  },
  inner: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,116,42,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginBottom: 3 },
  subtitle: { fontSize: 12, color: w(0.4) },
  labelBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  labelText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  ctaBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  ctaText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  rightCol: { alignItems: 'flex-end', gap: 2 },
  scoreText: { fontSize: 26, fontWeight: '800', lineHeight: 28 },
  scoreDenom: { fontSize: 12, color: w(0.35), marginTop: -2 },
  sparkRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 },
  });
};
