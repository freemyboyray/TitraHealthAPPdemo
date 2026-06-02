import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { CircleCheck, ClipboardList, X } from 'lucide-react-native';

const FF = 'System';

export type WeeklyCheckinCardProps = {
  /** ISO date string of the last time the unified weekly check-in was completed */
  lastLoggedAt: string | null;
  /** Whether the CURRENT program week's check-in is already done (gates re-takes). */
  currentWeekComplete: boolean;
  /** ISO date the next program week begins — when the check-in unlocks again. */
  nextAvailableAt?: string | null;
  /** When true, the card shows "Weekly Review" instead of "Weekly Check-In" */
  isDaily?: boolean;
  onDismiss?: () => void;
};

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function daysUntil(dateStr: string): number {
  return Math.max(0, Math.round((startOfLocalDay(new Date(dateStr)) - startOfLocalDay(new Date())) / 86400000));
}

export function WeeklyCheckinCard({ lastLoggedAt, currentWeekComplete, nextAvailableAt, isDaily, onDismiss }: WeeklyCheckinCardProps) {
  const cardTitle = isDaily ? 'Weekly Review' : 'Weekly Check-In';
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  const hasHistory = lastLoggedAt != null;
  const daysAgo = lastLoggedAt != null ? daysSince(lastLoggedAt) : null;

  const ViewPastLink = hasHistory ? (
    <TouchableOpacity
      onPress={(e) => { e.stopPropagation(); router.push('/entry/weekly-checkin-history' as any); }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityLabel="View past check-ins"
      accessibilityRole="button"
      style={{ flexShrink: 0 }}
    >
      <Text style={s.viewPastLink}>View past</Text>
    </TouchableOpacity>
  ) : null;

  // ── Available: current week not yet completed → opens the questionnaire ──────
  if (!currentWeekComplete) {
    return (
      <TouchableOpacity
        style={s.wrap}
        onPress={() => router.push('/entry/weekly-checkin' as any)}
        activeOpacity={0.8}
        accessibilityLabel={`Start ${cardTitle}`}
        accessibilityRole="button"
        accessibilityHint="Opens the weekly check-in questionnaire"
      >
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,116,42,0.06)' }]} />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,116,42,0.25)',
          }}
        />
        {onDismiss && (
          <TouchableOpacity
            onPress={(e) => { e.stopPropagation(); onDismiss(); }}
            style={s.dismissBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={`Dismiss ${cardTitle}`}
            accessibilityRole="button"
          >
            <X size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <View style={s.inner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={s.iconWrap}>
              <ClipboardList size={20} color={colors.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{cardTitle}</Text>
              <Text style={s.subtitle}>Takes about 3 min</Text>
            </View>
          </View>
          {ViewPastLink}
        </View>
      </TouchableOpacity>
    );
  }

  // ── Locked: already done this week → view-only until the next week begins ────
  const nextDays = nextAvailableAt ? daysUntil(nextAvailableAt) : null;
  const nextStr =
    nextDays == null ? null
    : nextDays === 0 ? 'available today'
    : nextDays === 1 ? 'next check-in tomorrow'
    : `next check-in in ${nextDays} days`;
  const completedStr =
    daysAgo === 0 ? 'Completed today'
    : daysAgo === 1 ? 'Completed yesterday'
    : daysAgo != null ? `Completed ${daysAgo} days ago`
    : 'Completed';

  return (
    <TouchableOpacity
      style={s.wrap}
      onPress={() => router.push('/entry/weekly-checkin-history' as any)}
      activeOpacity={0.85}
      accessibilityLabel={`${cardTitle} completed`}
      accessibilityRole="button"
      accessibilityHint="Opens your past check-ins"
    >
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,116,42,0.06)' }]} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,116,42,0.25)',
        }}
      />
      {onDismiss && (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onDismiss(); }}
          style={s.dismissBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Dismiss ${cardTitle}`}
          accessibilityRole="button"
        >
          <X size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
      <View style={s.inner}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={[s.iconWrap, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
            <CircleCheck size={20} color={colors.orange} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{cardTitle}</Text>
            <Text style={s.subtitle}>
              {nextStr ? `${completedStr} · ${nextStr}` : completedStr}
            </Text>
          </View>
        </View>
        {ViewPastLink}
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
      fontSize: 11, fontWeight: '800', color: c.orange,
      fontFamily: FF, letterSpacing: 1,
    },
    title: {
      fontSize: 17, fontWeight: '800', color: c.textPrimary,
      fontFamily: FF, letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 14, color: w(0.4), fontFamily: FF, marginTop: 2,
    },
    ctaBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: c.orange, borderRadius: 16,
      paddingHorizontal: 14, paddingVertical: 9, marginLeft: 12, flexShrink: 0,
    },
    ctaText: { fontSize: 15, fontWeight: '700', color: '#FFF', fontFamily: FF },
    dismissBtn: {
      position: 'absolute' as const, top: 10, right: 10, zIndex: 10,
      width: 26, height: 26, borderRadius: 13,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    retakeBtn: {
      borderWidth: 1.5, borderColor: c.orange, borderRadius: 14,
      paddingHorizontal: 14, paddingVertical: 6,
    },
    retakeText: {
      fontSize: 14, fontWeight: '700', color: c.orange, fontFamily: FF,
    },
    viewPastLink: {
      fontSize: 13, fontWeight: '600', color: w(0.35), fontFamily: FF,
    },
  });
};
