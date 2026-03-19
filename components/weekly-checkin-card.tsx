import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { GlassBorder } from '@/components/ui/glass-border';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';
const FF = 'Helvetica Neue';

export type WeeklyCheckinCardProps = {
  /** ISO date string of the last time the unified weekly check-in was completed */
  lastLoggedAt: string | null;
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function WeeklyCheckinCard({ lastLoggedAt }: WeeklyCheckinCardProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const isDone = lastLoggedAt != null && daysSince(lastLoggedAt) <= 6;
  const daysAgo = lastLoggedAt != null ? daysSince(lastLoggedAt) : null;

  if (!isDone) {
    return (
      <TouchableOpacity
        style={[s.wrap, { shadowColor: ORANGE, shadowOpacity: 0.1 }]}
        onPress={() => router.push('/entry/weekly-checkin' as any)}
        activeOpacity={0.8}
      >
        <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
        <GlassBorder r={20} />
        <View style={s.inner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={s.iconWrap}>
              <Ionicons name="clipboard-outline" size={20} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={s.dueBadge}>
                <Text style={s.dueText}>DUE THIS WEEK</Text>
              </View>
              <Text style={s.title}>Weekly Check-In</Text>
              <Text style={s.subtitle}>7 areas · takes about 3 min</Text>
            </View>
          </View>
          <View style={s.ctaBtn}>
            <Text style={s.ctaText}>Start</Text>
            <Ionicons name="arrow-forward" size={13} color="#FFF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[s.wrap, { shadowColor: '#27AE60', shadowOpacity: 0.12 }]}>
      <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
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
            <Ionicons name="checkmark-circle" size={20} color="#27AE60" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Weekly Check-In</Text>
            <Text style={s.subtitle}>
              {daysAgo === 0 ? 'Completed today' : daysAgo === 1 ? 'Completed yesterday' : `Completed ${daysAgo} days ago`}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={s.doneLabel}>Done ✓</Text>
          <TouchableOpacity
            onPress={() => router.push('/entry/weekly-checkin-history' as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={s.viewPastLink}>View Past</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: {
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: c.surface,
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 20,
      elevation: 6,
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
      backgroundColor: 'rgba(255,116,42,0.12)',
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    dueBadge: {
      backgroundColor: 'rgba(255,116,42,0.15)',
      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
      alignSelf: 'flex-start', marginBottom: 4,
    },
    dueText: {
      fontSize: 9, fontWeight: '800', color: ORANGE,
      fontFamily: FF, letterSpacing: 1,
    },
    title: {
      fontSize: 15, fontWeight: '800', color: c.textPrimary,
      fontFamily: FF, letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 12, color: w(0.4), fontFamily: FF, marginTop: 2,
    },
    ctaBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: ORANGE, borderRadius: 16,
      paddingHorizontal: 14, paddingVertical: 9, marginLeft: 12, flexShrink: 0,
    },
    ctaText: { fontSize: 13, fontWeight: '700', color: '#FFF', fontFamily: FF },
    doneLabel: {
      fontSize: 13, fontWeight: '700', color: '#27AE60', fontFamily: FF,
    },
    viewPastLink: {
      fontSize: 11, fontWeight: '600', color: ORANGE, fontFamily: FF,
    },
  });
};
