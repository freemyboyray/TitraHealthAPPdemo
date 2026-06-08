import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation, type AppColors } from '@/constants/theme';
import { SEVERITY_TIERS } from '@/constants/side-effects';
import type { CycleVolume } from '@/lib/side-effect-insights';
import { CycleVolumeBars } from '@/components/insights/cycle-volume-bars';

const FF = 'System';

// ─── Headline ────────────────────────────────────────────────────────────────

function describePeak(
  vol: CycleVolume, freqDays: number, oral: boolean, weekday: number | null,
): string {
  const dose = oral ? 'dose' : 'injection';
  const { buckets, peakIndex } = vol;
  if (peakIndex < 0) return `Most symptoms haven't settled into a clear window yet.`;

  // Contiguous run of busy buckets around the peak (≥60% of the peak's volume).
  const peakTotal = buckets[peakIndex].total;
  let lo = peakIndex, hi = peakIndex;
  while (lo - 1 >= 0 && buckets[lo - 1].total > 0 && buckets[lo - 1].total >= 0.6 * peakTotal) lo--;
  while (hi + 1 < buckets.length && buckets[hi + 1].total > 0 && buckets[hi + 1].total >= 0.6 * peakTotal) hi++;
  const labelLo = buckets[lo].label;
  const labelHi = buckets[hi].label;

  if (freqDays <= 1) return `Most symptoms land ${labelLo} after your ${dose}.`;

  if (freqDays === 7 && weekday != null) {
    return lo === hi
      ? `Most symptoms land on ${labelLo}.`
      : `Most symptoms land between ${labelLo} and ${labelHi}.`;
  }

  const dayWord = (lbl: string) =>
    lbl === 'Next' ? `the day before your next ${dose}` : lbl.replace(/^D/, 'Day ');
  if (lo === hi) return `Most symptoms land on ${dayWord(labelLo)} of your cycle.`;
  if (labelLo.startsWith('D') && labelHi.startsWith('D')) {
    return `Most symptoms land on Day ${labelLo.slice(1)}–${labelHi.slice(1)} of your cycle.`;
  }
  return `Most symptoms land around ${dayWord(labelLo)} of your cycle.`;
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function CyclePatternCard({
  volume, freqDays, oral, weekday, hasInjections, meaningfulCycle,
}: {
  volume: CycleVolume;
  freqDays: number;
  oral: boolean;
  weekday: number | null;
  hasInjections: boolean;
  meaningfulCycle: boolean;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  // Long-half-life daily orals stay near-flat across the day — an intraday
  // breakdown would be misleading, so explain rather than chart.
  if (!meaningfulCycle) {
    return (
      <View style={s.card}>
        <Text style={s.lead}>Your dose stays steady all day.</Text>
        <View style={s.placeholder}>
          <Text style={s.placeholderText}>
            With a daily dose this long-lasting, your medication level barely changes hour to hour,
            so symptoms track your overall dose level and how long you&apos;ve been adjusting, not the
            time since your last pill. See the trends below.
          </Text>
        </View>
      </View>
    );
  }

  if (!hasInjections) {
    return (
      <View style={s.card}>
        <Text style={s.lead}>Map symptoms to your cycle.</Text>
        <View style={s.placeholder}>
          <Text style={s.placeholderText}>
            Log {oral ? 'a dose' : 'an injection'} and a few symptoms after it, and we&apos;ll show
            when in your cycle they tend to land.
          </Text>
        </View>
      </View>
    );
  }

  if (volume.totalPoints < 2) {
    const remaining = 2 - volume.totalPoints;
    return (
      <View style={s.card}>
        <Text style={s.lead}>Your cycle pattern is taking shape.</Text>
        <View style={s.placeholder}>
          <Text style={s.placeholderText}>
            Log {remaining} more {remaining === 1 ? 'symptom' : 'symptoms'} after {oral ? 'a dose' : 'an injection'} to
            map your pattern.
          </Text>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${(volume.totalPoints / 2) * 100}%` }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <Text style={s.lead}>{describePeak(volume, freqDays, oral, weekday)}</Text>

      <View style={{ marginTop: 18 }}>
        <CycleVolumeBars
          buckets={volume.buckets}
          maxTotal={volume.maxTotal}
          peakIndex={volume.peakIndex}
          colors={colors}
        />
      </View>

      <View style={s.legend}>
        {(['mild', 'moderate', 'severe'] as const).map(tier => (
          <View key={tier} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: SEVERITY_TIERS[tier].color }]} />
            <Text style={[s.legendText, { color: w(0.5) }]}>{SEVERITY_TIERS[tier].label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: c.isDark ? 0 : 0.5,
      borderColor: c.border,
      padding: 18,
      ...cardElevation(c.isDark),
    },
    lead: { fontSize: 14.5, fontWeight: '500', color: w(0.62), fontFamily: FF, letterSpacing: -0.1, lineHeight: 20 },
    placeholder: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: w(0.04), gap: 10 },
    placeholderText: { fontSize: 13.5, color: w(0.55), fontFamily: FF, lineHeight: 19 },
    progressTrack: { height: 5, borderRadius: 3, backgroundColor: w(0.08), overflow: 'hidden' },
    progressFill: { height: 5, borderRadius: 3, backgroundColor: c.orange },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 18 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 9, height: 9, borderRadius: 4.5 },
    legendText: { fontSize: 12.5, fontWeight: '600', fontFamily: FF },
  });
};
