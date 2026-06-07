import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { cardElevation, type AppColors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { smoothPath } from '@/lib/chart-utils';
import { usePostHog } from '@/lib/posthog';

const FF = 'System';

// Illustrative cumulative weight-loss (0 = starting weight, larger = more loss).
// "With Titra Health" descends further and keeps going; "Without tracking" tapers off.
const WITH_TITRA = [0, 0.18, 0.42, 0.66, 0.85, 0.96];
const WITHOUT = [0, 0.1, 0.2, 0.3, 0.37, 0.42];

const CHART_H = 168;
const PAD_T = 10;
const PAD_B = 10;
const PAD_L = 8;
const PAD_R = 10;

// ─── Chart ──────────────────────────────────────────────────────────────────────

function ResultsChart({ colors }: { colors: AppColors }) {
  const [width, setWidth] = useState(0);
  const plotW = Math.max(width - PAD_L - PAD_R, 1);
  const plotH = CHART_H - PAD_T - PAD_B;

  const muted = colors.textMuted;
  const grid = colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  const toPts = (data: number[]) =>
    data.map((frac, i) => ({
      x: PAD_L + (i / (data.length - 1)) * plotW,
      y: PAD_T + frac * plotH,
    }));

  const titraPts = toPts(WITH_TITRA);
  const withoutPts = toPts(WITHOUT);
  const titraEnd = titraPts[titraPts.length - 1];
  const withoutEnd = withoutPts[withoutPts.length - 1];

  // Closed path for the soft area fill under the orange curve.
  const areaPath =
    smoothPath(titraPts) +
    ` L ${titraEnd.x} ${PAD_T + plotH} L ${titraPts[0].x} ${PAD_T + plotH} Z`;

  return (
    <View style={{ height: CHART_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={CHART_H}>
          <Defs>
            <LinearGradient id="titraFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.orange} stopOpacity={0.18} />
              <Stop offset="1" stopColor={colors.orange} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Horizontal gridlines */}
          {[0, 0.5, 1].map((g) => (
            <Line
              key={g}
              x1={PAD_L}
              x2={width - PAD_R}
              y1={PAD_T + g * plotH}
              y2={PAD_T + g * plotH}
              stroke={grid}
              strokeWidth={1}
              strokeDasharray="3 5"
            />
          ))}

          {/* Area fill under the orange curve */}
          <Path d={areaPath} fill="url(#titraFill)" />

          {/* Without tracking (muted, dashed) */}
          <Path
            d={smoothPath(withoutPts)}
            stroke={muted}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray="5 5"
          />
          {/* With Titra Health (orange, solid) */}
          <Path
            d={smoothPath(titraPts)}
            stroke={colors.orange}
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />

          {/* Endpoint dots */}
          <Circle cx={withoutEnd.x} cy={withoutEnd.y} r={5} fill={colors.surface} stroke={muted} strokeWidth={2} />
          <Circle cx={titraEnd.x} cy={titraEnd.y} r={6} fill={colors.surface} stroke={colors.orange} strokeWidth={3} />
        </Svg>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────────

export default function WeightResultsScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const posthog = usePostHog();
  const s = useMemo(() => createStyles(colors), [colors]);

  React.useEffect(() => {
    posthog?.capture('onboarding_results_viewed');
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={s.back} hitSlop={10} activeOpacity={0.7}>
          <ChevronLeft size={28} color={colors.textPrimary} />
        </TouchableOpacity>

        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.title}>Titra Health creates long-term results</Text>

          {/* Chart card */}
          <View style={[s.card, cardElevation(isDark)]}>
            {/* Header: title + legend */}
            <View style={s.cardHeader}>
              <Text style={s.cardTitle}>Projected{'\n'}weight loss</Text>

              <View style={s.legend}>
                <View style={s.legendRow}>
                  <Image source={require('@/assets/images/titra-logo.png')} style={s.legendLogo} />
                  <Text style={s.legendTitra}>With Titra Health</Text>
                </View>
                <View style={s.legendRow}>
                  <View style={s.legendDash} />
                  <Text style={s.legendMuted}>Without tracking</Text>
                </View>
              </View>
            </View>

            <ResultsChart colors={colors} />

            {/* X axis */}
            <View style={s.axisRow}>
              <Text style={s.axisLabel}>MONTH 1</Text>
              <Text style={s.axisLabel}>MONTH 6</Text>
            </View>

            <Text style={s.caption}>
              GLP-1 medication works best alongside daily habits. Titra Health helps you build the
              routine that makes your results last.
            </Text>
          </View>
        </ScrollView>

        <ContinueButton onPress={() => router.push('/onboarding/sex')} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },

    back: {
      width: 40,
      height: 40,
      marginLeft: -8,
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginTop: 4,
    },

    scroll: { flex: 1 },
    scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 12 },

    title: {
      fontSize: 30,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      lineHeight: 37,
      letterSpacing: -0.5,
      marginBottom: 24,
    },

    card: {
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 18,
    },

    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textSecondary,
      fontFamily: FF,
      lineHeight: 19,
    },

    legend: {
      alignItems: 'flex-end',
      gap: 5,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendLogo: {
      width: 15,
      height: 15,
      borderRadius: 4,
    },
    legendTitra: {
      fontSize: 13,
      fontWeight: '700',
      color: c.orange,
      fontFamily: FF,
    },
    legendDash: {
      width: 14,
      height: 2,
      borderRadius: 1,
      backgroundColor: c.textMuted,
    },
    legendMuted: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textMuted,
      fontFamily: FF,
    },

    axisRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
      marginBottom: 14,
    },
    axisLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      fontFamily: FF,
      letterSpacing: 0.5,
    },

    caption: {
      fontSize: 15,
      color: c.textSecondary,
      fontFamily: FF,
      lineHeight: 21,
      textAlign: 'center',
    },
    finePrint: {
      fontSize: 12,
      color: c.textMuted,
      fontFamily: FF,
      textAlign: 'center',
      marginTop: 10,
    },
  });
