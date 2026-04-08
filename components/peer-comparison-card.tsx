import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { type DimensionValue, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useUiStore } from '@/stores/ui-store';
import { useLogStore, type PeerComparisonData } from '@/stores/log-store';

const MIN_COHORT = 50;
const ORANGE = '#FF742A';

const MED_DISPLAY: Record<string, string> = {
  semaglutide: 'semaglutide',
  tirzepatide: 'tirzepatide',
  liraglutide: 'liraglutide',
  dulaglutide: 'dulaglutide',
  oral_semaglutide: 'oral semaglutide',
  orforglipron: 'orforglipron',
};

type Props = {
  data: PeerComparisonData | null;
  isOptedIn: boolean;
};

export function PeerComparisonCard({ data, isOptedIn }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { openAiChat } = useUiStore();
  const updatePeerOptIn = useLogStore(s => s.updatePeerOptIn);

  const handleOptIn = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updatePeerOptIn(true);
  };

  const handlePress = () => {
    if (!data || data.insufficientData) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const medName = MED_DISPLAY[data.medicationName] ?? data.medicationName;
    const context = `User's weight loss is at the ${data.percentile}th percentile among ${medName} users at a similar treatment stage (week ${data.treatmentWeek}). Individual results vary based on genetics, diet, activity, and starting weight.`;
    openAiChat({
      contextLabel: 'Progress Context',
      contextValue: context,
      seedMessage: context,
      chips: JSON.stringify([
        'What factors affect my progress?',
        'Is my progress typical for this stage?',
        'How does this metric work?',
        'What healthy habits support progress?',
      ]),
    });
  };

  // State 1: Not opted in — invitation
  if (!isOptedIn) {
    return (
      <View style={[s.card, s.emptyCard]}>
        <Text style={s.cardTitle}>Peer Comparison</Text>
        <Text style={s.bodyText}>
          See how your progress compares to others on the same medication at a similar treatment stage. Results vary based on individual factors including genetics, diet, and starting weight.
        </Text>
        <Text style={s.privacyText}>
          By joining, you agree to contribute your anonymized, de-identified weight-loss progress to aggregate statistics. Your individual data is never shared — only group-level summaries (e.g. percentiles across 50+ users) are displayed. You can opt out at any time in Settings, and your data will be removed from future aggregations.
        </Text>
        <Pressable style={s.joinButton} onPress={handleOptIn}>
          <Text style={s.joinButtonText}>Join Peer Comparison</Text>
        </Pressable>
      </View>
    );
  }

  // State 2: Opted in but insufficient data
  if (!data || data.insufficientData) {
    return (
      <View style={[s.card, s.emptyCard]}>
        <Text style={s.cardTitle}>Peer Comparison</Text>
        <Text style={s.bodyText}>
          Building your cohort — we need more participants on your medication and treatment stage before comparisons are available. Check back soon!
        </Text>
      </View>
    );
  }

  // State 3: Active with data
  const medName = MED_DISPLAY[data.medicationName] ?? data.medicationName;

  // Percentile marker position
  const markerLeft: DimensionValue = `${Math.max(2, Math.min(98, data.percentile))}%`;

  return (
    <Pressable style={s.card} onLongPress={handlePress}>
      {/* Header */}
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Peer Comparison</Text>
        <View style={[s.weekBadge]}>
          <Text style={s.weekBadgeText}>Week {data.treatmentWeek}</Text>
        </View>
      </View>

      {/* Hero stat */}
      <Text style={s.heroLine}>
        <Text style={[s.heroPct, { color: ORANGE }]}>{data.percentile}th</Text>
        <Text style={s.heroSuffix}> percentile</Text>
      </Text>

      <Text style={s.comparisonText}>
        Your progress among {medName} users at a similar treatment stage
      </Text>

      {/* Percentile bar */}
      <View style={s.percentileContainer}>
        <View style={s.percentileTrack}>
          {/* Quartile markers */}
          <View style={[s.quartileMark, { left: '25%' as DimensionValue }]} />
          <View style={[s.quartileMark, { left: '50%' as DimensionValue }]} />
          <View style={[s.quartileMark, { left: '75%' as DimensionValue }]} />
          {/* User marker */}
          <View style={[s.userMarker, { left: markerLeft, backgroundColor: ORANGE }]} />
        </View>
        <View style={s.percentileLabels}>
          <Text style={s.percentileLabel}>25th</Text>
          <Text style={s.percentileLabel}>50th</Text>
          <Text style={s.percentileLabel}>75th</Text>
        </View>
      </View>

      <Text style={s.disclaimer}>
        Individual results vary based on genetics, diet, activity level, and starting weight. This is not medical advice.
      </Text>

      <Text style={s.tapHint}>Hold to learn more</Text>
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
    weekBadge: {
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: w(0.06),
    },
    weekBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: w(0.5),
      fontFamily: 'Helvetica Neue',
    },
    heroLine: {
      marginBottom: 6,
    },
    heroPct: {
      fontSize: 32,
      fontWeight: '800',
      fontFamily: 'Helvetica Neue',
    },
    heroSuffix: {
      fontSize: 18,
      fontWeight: '600',
      color: w(0.5),
      fontFamily: 'Helvetica Neue',
    },
    comparisonText: {
      fontSize: 13,
      color: w(0.5),
      lineHeight: 18,
      marginBottom: 16,
      fontFamily: 'Helvetica Neue',
    },
    bodyText: {
      fontSize: 13,
      color: w(0.5),
      lineHeight: 19,
      fontFamily: 'Helvetica Neue',
    },
    privacyText: {
      fontSize: 12,
      color: w(0.35),
      lineHeight: 17,
      fontFamily: 'Helvetica Neue',
    },
    joinButton: {
      backgroundColor: ORANGE,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 4,
    },
    joinButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      fontFamily: 'Helvetica Neue',
    },
    disclaimer: {
      fontSize: 11,
      color: w(0.3),
      lineHeight: 15,
      textAlign: 'center',
      fontFamily: 'Helvetica Neue',
      marginBottom: 4,
    },
    percentileContainer: {
      marginBottom: 12,
      gap: 6,
    },
    percentileTrack: {
      height: 12,
      borderRadius: 6,
      backgroundColor: w(0.06),
      position: 'relative',
    },
    quartileMark: {
      position: 'absolute',
      top: 2,
      width: 1,
      height: 8,
      backgroundColor: w(0.15),
    },
    userMarker: {
      position: 'absolute',
      top: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      marginLeft: -8,
      borderWidth: 2,
      borderColor: c.surface,
    },
    percentileLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: '20%',
    },
    percentileLabel: {
      fontSize: 9,
      color: w(0.3),
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
