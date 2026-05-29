import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import type { WeeklySummaryRow } from '@/stores/log-store';

const ORANGE = '#FF742A';
const FF = 'System';

export type WeeklySummaryCardProps = {
  latestSummary: WeeklySummaryRow | null;
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function WeeklySummaryCard({ latestSummary }: WeeklySummaryCardProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const handleView = () => router.push('/entry/weekly-summary' as any);
  const handleHistory = () => router.push('/entry/weekly-summary-history' as any);

  // No snapshot yet → "first run" state mirroring WeeklyCheckinCard's due state.
  if (!latestSummary) {
    return (
      <TouchableOpacity
        style={s.wrap}
        onPress={handleView}
        activeOpacity={0.8}
        accessibilityLabel="View Weekly Summary"
        accessibilityRole="button"
        accessibilityHint="Generates and opens your weekly recap"
      >
        <View style={s.inner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={s.iconWrap}>
              <Ionicons name="sparkles-outline" size={20} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.dueBadge}>
                <Text style={s.dueText}>READY TO VIEW</Text>
              </View>
              <Text style={s.title}>Weekly Summary</Text>
              <Text style={s.subtitle}>Recap of your last 7 days · AI insight</Text>
            </View>
          </View>
          <View style={s.ctaBtn}>
            <Text style={s.ctaText}>View</Text>
            <Ionicons name="arrow-forward" size={13} color="#FFF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  // Snapshot exists → "completed" state mirroring the check-in done state.
  const daysAgo = daysSince(latestSummary.created_at);
  const subtitle =
    daysAgo === 0 ? 'Generated today'
    : daysAgo === 1 ? 'Generated yesterday'
    : `Generated ${daysAgo} days ago`;

  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={handleView}
      activeOpacity={0.85}
      accessibilityLabel="Weekly Summary"
      accessibilityRole="button"
      accessibilityHint="Opens this week's recap"
    >
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(39,174,96,0.06)' }]} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 20, borderWidth: 1, borderColor: 'rgba(39,174,96,0.25)',
        }}
      />
      <View style={s.inner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={[s.iconWrap, { backgroundColor: 'rgba(39,174,96,0.15)' }]}>
            <Ionicons name="sparkles" size={20} color="#27AE60" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Weekly Summary</Text>
            <Text style={s.subtitle}>{subtitle}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <TouchableOpacity
            style={s.viewBtn}
            onPress={handleView}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="View weekly summary"
            accessibilityRole="button"
          >
            <Text style={s.viewBtnText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handleHistory();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel="View summary history"
            accessibilityRole="button"
          >
            <Text style={s.viewPastLink}>View History</Text>
          </TouchableOpacity>
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
      backgroundColor: c.isDark ? c.surface : '#FFFFFF',
      ...cardElevation(c.isDark),
    },
    inner: {
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 88,
    },
    iconWrap: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: 'rgba(255,116,42,0.15)',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    dueBadge: {
      backgroundColor: 'rgba(255,116,42,0.15)',
      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
      alignSelf: 'flex-start', marginBottom: 4,
    },
    dueText: {
      fontSize: 11, fontWeight: '800', color: ORANGE,
      fontFamily: FF, letterSpacing: 1,
    },
    ctaBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: ORANGE, borderRadius: 16,
      paddingHorizontal: 14, paddingVertical: 9, marginLeft: 12, flexShrink: 0,
    },
    ctaText: { fontSize: 15, fontWeight: '700', color: '#FFF', fontFamily: FF },
    title: {
      fontSize: 17, fontWeight: '800', color: c.textPrimary,
      fontFamily: FF, letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 14, color: w(0.4), fontFamily: FF, marginTop: 2,
    },
    viewBtn: {
      borderWidth: 1.5, borderColor: ORANGE, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 6,
    },
    viewBtnText: {
      fontSize: 14, fontWeight: '700', color: ORANGE, fontFamily: FF,
    },
    viewPastLink: {
      fontSize: 13, fontWeight: '600', color: w(0.35), fontFamily: FF,
    },
  });
};
