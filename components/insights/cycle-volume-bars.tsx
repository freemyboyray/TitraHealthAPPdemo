import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { AppColors } from '@/constants/theme';
import { SEVERITY_TIERS } from '@/constants/side-effects';
import type { VolumeBucket } from '@/lib/side-effect-insights';

const FF = 'System';
const CHART_H = 132;          // tallest a bar can grow
const MIN_BAR = 10;           // a logged bucket always reads above the axis

// Stacked bottom→top: mild (green) → moderate (amber) → severe (red), so the
// bar visibly "rises into" severity.
const TIER_ORDER: { key: 'mild' | 'moderate' | 'severe'; color: string }[] = [
  { key: 'severe',   color: SEVERITY_TIERS.severe.color },
  { key: 'moderate', color: SEVERITY_TIERS.moderate.color },
  { key: 'mild',     color: SEVERITY_TIERS.mild.color },
];

/**
 * The cycle-volume hero: one stacked bar per dose-cycle bucket. Bar height
 * encodes volume (number of symptom logs); the colored segments encode the
 * severity mix. Bars animate up from the axis on mount.
 */
export function CycleVolumeBars({
  buckets, maxTotal, peakIndex, colors,
}: {
  buckets: VolumeBucket[];
  maxTotal: number;
  peakIndex: number;
  colors: AppColors;
}) {
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const denom = Math.max(1, maxTotal);

  return (
    <View>
      <View style={[styles.row, { height: CHART_H }]}>
        {buckets.map((b, i) => {
          const colH = b.total > 0 ? Math.max(MIN_BAR, (b.total / denom) * CHART_H) : 0;
          const isPeak = i === peakIndex && b.total > 0;
          return (
            <View key={i} style={styles.col}>
              {b.total > 0 && (
                <Text style={[styles.count, { color: isPeak ? colors.textPrimary : w(0.4), fontWeight: isPeak ? '800' : '600' }]}>
                  {b.total}
                </Text>
              )}
              {colH > 0 ? (
                <Bar bucket={b} height={colH} progress={progress} dim={isPeak ? 1 : 0.82} />
              ) : (
                <View style={[styles.nub, { backgroundColor: w(0.08) }]} />
              )}
            </View>
          );
        })}
      </View>

      {/* Bucket labels */}
      <View style={styles.row}>
        {buckets.map((b, i) => (
          <View key={i} style={styles.col}>
            <Text
              style={[
                styles.label,
                { color: i === peakIndex && b.total > 0 ? colors.textPrimary : w(0.4) },
              ]}
              numberOfLines={1}
            >
              {b.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Bar({
  bucket, height, progress, dim,
}: {
  bucket: VolumeBucket;
  height: number;
  progress: SharedValue<number>;
  dim: number;
}) {
  const animStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [0, height]),
  }));

  return (
    <Reanimated.View style={[styles.bar, animStyle]}>
      {TIER_ORDER.map(({ key, color }) => {
        const seg = bucket[key];
        if (!seg) return null;
        const segH = (seg / bucket.total) * height;
        return <View key={key} style={{ height: segH, backgroundColor: color, opacity: dim }} />;
      })}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  count: { fontSize: 11, fontFamily: FF, marginBottom: 4 },
  bar: {
    width: '64%',
    maxWidth: 30,
    borderRadius: 7,
    overflow: 'hidden',
    flexDirection: 'column',
    justifyContent: 'flex-end', // grow/reveal bottom-up: mild first, severe last
  },
  nub: { width: '64%', maxWidth: 30, height: 4, borderRadius: 2 },
  label: { fontSize: 11, fontFamily: FF, marginTop: 8, fontWeight: '600' },
});
