import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { AnimatedFire } from '@/components/animated-fire';
import { GradientBackground } from '@/components/ui/gradient-background';
import { ACHIEVEMENTS, type Achievement } from '@/constants/achievements';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const ORANGE = '#FF742A';

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

export default function StreakScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useProfile();
  const logStore = useLogStore();
  const s = useMemo(() => createStyles(colors), [colors]);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // ── Streak (app-open based, stored in preferences) ──
  const streak = usePreferencesStore((s: { streakCount: number }) => s.streakCount);

  const freq = profile?.injectionFrequencyDays ?? 7;
  const lastInjDate = profile?.lastInjectionDate ?? null;

  // ── Weight lost ──
  const weightLost = useMemo(() => {
    const startWeight = profile?.startWeightLbs ?? 0;
    const latestLog = logStore.weightLogs[0];
    const currentWeight = latestLog?.weight_lbs ?? profile?.currentWeightLbs ?? 0;
    if (startWeight > 0 && currentWeight > 0 && startWeight > currentWeight) return startWeight - currentWeight;
    return 0;
  }, [profile, logStore.weightLogs]);

  // ── Days on treatment ──
  const daysOnTreatment = useMemo(() => {
    if (!profile?.startDate) return 0;
    const start = new Date(profile.startDate + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
  }, [profile?.startDate]);

  // ── Calendar data ──
  const injectionDates = useMemo(
    () => new Set(logStore.injectionLogs.map(l => l.injection_date?.slice(0, 10)).filter(Boolean)),
    [logStore.injectionLogs],
  );

  const logDates = useMemo(() => {
    const dates = new Set<string>();
    const toDate = (iso: string | null | undefined) => iso ? iso.slice(0, 10) : null;
    logStore.weightLogs.forEach(l => { const d = toDate(l.logged_at); if (d) dates.add(d); });
    logStore.foodLogs.forEach(l => { const d = toDate(l.logged_at); if (d) dates.add(d); });
    logStore.activityLogs.forEach(l => { const d = toDate(l.date); if (d) dates.add(d); });
    logStore.sideEffectLogs.forEach(l => { const d = toDate(l.logged_at); if (d) dates.add(d); });
    logStore.foodNoiseLogs.forEach(l => { const d = toDate(l.logged_at); if (d) dates.add(d); });
    return dates;
  }, [logStore.weightLogs, logStore.foodLogs, logStore.activityLogs, logStore.sideEffectLogs, logStore.foodNoiseLogs]);

  // ── Calendar grid ──
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

  const oral = profile?.routeOfAdministration === 'oral';

  return (
    <View style={s.root}>
      <GradientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle}>Streak & Schedule</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Fire Hero ── */}
          <View style={s.fireHero}>
            <AnimatedFire size={150} streak={streak} showNumber active={streak > 0} />
            <Text style={s.fireLabel}>
              {streak === 0 ? 'No streak yet' : streak === 1 ? '1 day streak' : `${streak} day streak`}
            </Text>
            <Text style={s.fireSubtext}>Log daily to build your streak</Text>
          </View>

          {/* ── Calendar ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Schedule</Text>
            <View style={s.calCard}>
              {/* Month nav */}
              <View style={s.monthRow}>
                <Pressable onPress={prevMonth} hitSlop={10}>
                  <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                </Pressable>
                <Text style={s.monthLabel}>{monthLabel}</Text>
                <Pressable onPress={nextMonth} hitSlop={10}>
                  <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              {/* Day headers */}
              <View style={s.weekRow}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <Text key={d} style={s.dayHeader}>{d}</Text>
                ))}
              </View>

              {/* Day grid */}
              {chunk(cells, 7).map((week, wi) => (
                <View key={wi} style={s.weekRow}>
                  {week.map((day, di) => {
                    if (!day) return <View key={di} style={s.cell} />;
                    const date = new Date(viewYear, viewMonth, day);
                    const dateStr = localDateStr(date);
                    const isTod = sameDay(date, today);
                    const isFuture = date > today;

                    const hasInjLog = injectionDates.has(dateStr);
                    const isScheduledInj = !hasInjLog && lastInjDate
                      ? (() => {
                          const diff = Math.round((date.getTime() - new Date(lastInjDate + 'T00:00:00').getTime()) / 86400000);
                          return diff > 0 && diff % freq === 0;
                        })()
                      : false;
                    const hasOtherLog = !isTod && logDates.has(dateStr);

                    return (
                      <View key={di} style={s.cell}>
                        <View style={[
                          s.dayCircle,
                          isTod && s.dayToday,
                          hasInjLog && !isTod && s.dayInjLogged,
                        ]}>
                          <Text style={[
                            s.dayNum,
                            isTod && s.dayNumToday,
                            isFuture && !isScheduledInj && s.dayFaded,
                            hasInjLog && !isTod && s.dayNumInjLogged,
                          ]}>
                            {day}
                          </Text>
                        </View>
                        {hasInjLog && !isTod && (
                          <View style={s.injDot} />
                        )}
                        {isScheduledInj && !isTod && (
                          <View style={s.scheduledDot} />
                        )}
                        {!hasInjLog && !isScheduledInj && hasOtherLog && !isTod && (
                          <View style={s.logDot} />
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* Legend */}
              <View style={s.legend}>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: ORANGE }]} />
                  <Text style={s.legendLabel}>{oral ? 'Dose day' : 'Injection'}</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: ORANGE, opacity: 0.4 }]} />
                  <Text style={s.legendLabel}>Scheduled</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: '#34C759' }]} />
                  <Text style={s.legendLabel}>Logged</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Achievements ── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Achievements</Text>
            <View style={s.achieveGrid}>
              {ACHIEVEMENTS.map((a) => {
                const current = a.category === 'streak' ? streak
                  : a.category === 'weight' ? weightLost
                  : daysOnTreatment;
                const earned = current >= a.threshold;
                const progress = Math.min(1, current / a.threshold);
                const remaining = Math.max(0, a.threshold - current);
                return (
                  <View key={a.id} style={s.achieveItem}>
                    <View style={[s.achieveCircle, earned && s.achieveCircleEarned]}>
                      {earned ? (
                        <Text style={s.achieveIcon}>{a.icon}</Text>
                      ) : (
                        <>
                          <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
                          {progress > 0 && (
                            <View style={[s.achieveProgress, { height: `${progress * 100}%` as any }]} />
                          )}
                        </>
                      )}
                    </View>
                    <Text style={[s.achieveName, earned && s.achieveNameEarned]} numberOfLines={1}>{a.name}</Text>
                    <Text style={s.achieveSub} numberOfLines={1}>
                      {earned
                        ? a.label
                        : a.category === 'streak' ? `${remaining} more day${remaining !== 1 ? 's' : ''}`
                        : a.category === 'weight' ? `${remaining.toFixed(0)} more lbs`
                        : `${remaining} more day${remaining !== 1 ? 's' : ''}`}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    headerTitle: {
      fontSize: 18, fontWeight: '700', color: c.textPrimary, fontFamily: FF,
    },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },

    // Fire hero
    fireHero: { alignItems: 'center', paddingVertical: 24 },
    fireLabel: {
      fontSize: 22, fontWeight: '800', color: c.textPrimary,
      marginTop: 12, letterSpacing: -0.5, fontFamily: FF,
    },
    fireSubtext: {
      fontSize: 14, color: c.textSecondary, marginTop: 4, fontFamily: FF,
    },

    // Sections
    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 18, fontWeight: '800', color: c.textPrimary,
      letterSpacing: -0.3, marginBottom: 10, fontFamily: FF,
    },

    // Calendar
    calCard: {
      backgroundColor: c.surface, borderRadius: 20,
      borderWidth: 0.5, borderColor: c.border, padding: 16,
    },
    monthRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 14,
    },
    monthLabel: {
      fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: FF,
    },
    weekRow: {
      flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4,
    },
    dayHeader: {
      width: 40, textAlign: 'center', fontSize: 12,
      fontWeight: '600', color: c.textMuted, fontFamily: FF,
    },
    cell: {
      width: 40, height: 44, alignItems: 'center',
      justifyContent: 'flex-start', paddingTop: 3,
    },
    dayCircle: {
      width: 34, height: 34, borderRadius: 17,
      alignItems: 'center', justifyContent: 'center',
    },
    dayToday: { backgroundColor: '#5AC8FA' },
    dayInjLogged: { backgroundColor: ORANGE + '22' },
    dayNum: {
      fontSize: 16, fontWeight: '600', color: c.textPrimary, fontFamily: FF,
    },
    dayNumToday: { fontWeight: '800', color: '#FFFFFF' },
    dayNumInjLogged: { fontWeight: '700' },
    dayFaded: { opacity: 0.35 },
    todayDot: {
      width: 5, height: 5, borderRadius: 2.5,
      backgroundColor: '#5AC8FA', marginTop: 1,
    },
    injDot: {
      width: 5, height: 5, borderRadius: 2.5,
      backgroundColor: ORANGE, marginTop: 1,
    },
    scheduledDot: {
      width: 5, height: 5, borderRadius: 2.5,
      backgroundColor: ORANGE, opacity: 0.4, marginTop: 1,
    },
    logDot: {
      width: 5, height: 5, borderRadius: 2.5,
      backgroundColor: '#34C759', marginTop: 1,
    },
    legend: {
      flexDirection: 'row', justifyContent: 'center', gap: 16,
      marginTop: 10, paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 6, height: 6, borderRadius: 3 },
    legendLabel: { fontSize: 12, color: c.textMuted, fontFamily: FF },

    // Achievements
    achieveGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    },
    achieveItem: {
      width: '30%' as any,
      alignItems: 'center',
      marginBottom: 8,
    },
    achieveCircle: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    achieveCircleEarned: {
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.15)' : 'rgba(255,116,42,0.10)',
    },
    achieveIcon: { fontSize: 26 },
    achieveProgress: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.06)',
    },
    achieveName: {
      fontSize: 12, fontWeight: '700', color: c.textMuted,
      fontFamily: FF, marginTop: 6, textAlign: 'center',
    },
    achieveNameEarned: { color: c.textPrimary },
    achieveSub: {
      fontSize: 10, color: c.textMuted, fontFamily: FF,
      textAlign: 'center', marginTop: 1,
    },
  });
};
