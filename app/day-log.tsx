import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import type { AppColors } from '@/constants/theme';
import { isOralDrug, doseIconName } from '@/constants/drug-pk';
import { fetchDailySnapshot, useHealthData, type DailySnapshot } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import { localDateStr } from '@/lib/date-utils';

const FF = 'System';
const ORANGE = '#FF742A';
const DAYS_PER_PAGE = 10;

// ─── Date helpers ──────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDateHeading(d: Date): string {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function formatDateSub(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Icon helpers ──────────────────────────────────────────────────────────────

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>['name'];

const MEAL_ICON: Record<string, MaterialIconName> = {
  breakfast: 'free-breakfast',
  lunch:     'lunch-dining',
  dinner:    'dinner-dining',
  snack:     'local-cafe',
};

function MealIcon({ mealType, size = 16, color }: { mealType: string; size?: number; color: string }) {
  const name = MEAL_ICON[(mealType ?? 'snack').toLowerCase()] ?? 'restaurant';
  return <MaterialIcons name={name} size={size} color={color} />;
}

function activityIconName(exerciseType: string | null | undefined): MaterialIconName {
  const t = (exerciseType ?? '').toLowerCase();
  if (t.includes('run') || t.includes('jog'))      return 'directions-run';
  if (t.includes('walk'))                           return 'directions-walk';
  if (t.includes('cycl') || t.includes('bike'))    return 'directions-bike';
  if (t.includes('swim'))                           return 'pool';
  if (t.includes('yoga') || t.includes('stretch'))  return 'self-improvement';
  if (t.includes('strength') || t.includes('weight') || t.includes('lift')) return 'fitness-center';
  if (t.includes('hike'))                           return 'terrain';
  if (t.includes('dance'))                          return 'music-note';
  if (t.includes('sport') || t.includes('tennis') || t.includes('basketball') || t.includes('soccer')) return 'sports';
  return 'flash-on';
}

function sectionLabelStyle(w: (a: number) => string) {
  return {
    fontSize: 12, fontWeight: '700' as const, color: w(0.35),
    letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 4, fontFamily: FF,
  };
}

// ─── DayCard ───────────────────────────────────────────────────────────────────

type DayCardData = {
  dateStr: string;
  date: Date;
  snapshot: DailySnapshot;
  waterOz: number;
};

function DayCard({ data, colors, oral }: { data: DayCardData; colors: AppColors; oral: boolean }) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const s = useMemo(() => createStyles(colors), [colors]);

  const { foodLogs, activityLogs, weightLog, injectionLog, sideEffectLogs } = data.snapshot;
  const { waterOz, date } = data;
  const totalCals = foodLogs.reduce((sum, f) => sum + (f.calories ?? 0), 0);
  const isEmpty = foodLogs.length === 0 && activityLogs.length === 0 && !weightLog && !injectionLog && sideEffectLogs.length === 0 && waterOz === 0;

  return (
    <View style={[s.cardWrap, { marginBottom: 16 }]}>
      <View style={[s.cardBody, { backgroundColor: colors.surface, padding: 20 }]}>

        {/* ── Date header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEmpty ? 4 : 16 }}>
          <View>
            <Text style={s.dayHeading}>{formatDateHeading(date)}</Text>
            <Text style={s.daySub}>{formatDateSub(date)}</Text>
          </View>
          {totalCals > 0 && (
            <View style={{ backgroundColor: colors.borderSubtle, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: w(0.55), fontFamily: FF }}>{totalCals} cal</Text>
            </View>
          )}
        </View>

        {isEmpty ? (
          <Text style={{ fontSize: 14, color: w(0.4), fontFamily: FF, marginTop: 8 }}>Nothing logged.</Text>
        ) : (
          <>
            {/* ── Injection / Dose ── */}
            {injectionLog && (
              <View style={{ marginBottom: 14 }}>
                <Text style={sectionLabelStyle(w)}>{oral ? 'Dose' : 'Injection'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 }}>
                  <FontAwesome5 name={doseIconName(oral)} size={14} color={w(0.45)} />
                  <Text style={{ fontSize: 16, color: w(0.82), flex: 1, fontFamily: FF }}>
                    {injectionLog.medication_name ?? (oral ? 'Dose' : 'Injection')} · {injectionLog.dose_mg}mg
                  </Text>
                </View>
              </View>
            )}

            {/* ── Food ── */}
            {foodLogs.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={sectionLabelStyle(w)}>Food</Text>
                {foodLogs.map(f => (
                  <View key={f.id} style={{ paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.07) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                      <MealIcon mealType={f.meal_type ?? 'snack'} size={14} color={w(0.45)} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, color: w(0.82), fontFamily: FF }} numberOfLines={1}>{f.food_name}</Text>
                        <Text style={{ fontSize: 13, color: w(0.38), marginTop: 2, fontFamily: FF }}>
                          {f.calories} cal · P {f.protein_g}g · C {f.carbs_g}g · F {f.fat_g}g
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Activity ── */}
            {activityLogs.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={sectionLabelStyle(w)}>Activity</Text>
                {activityLogs.map(a => (
                  <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                    <MaterialIcons name={activityIconName(a.exercise_type)} size={16} color={w(0.45)} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, color: w(0.82), fontFamily: FF }}>{a.exercise_type || 'Activity'}</Text>
                      <Text style={{ fontSize: 13, color: w(0.38), marginTop: 2, fontFamily: FF }}>
                        {[
                          a.duration_min > 0 ? `${a.duration_min} min` : null,
                          a.steps > 0 ? `${a.steps.toLocaleString()} steps` : null,
                          a.active_calories > 0 ? `${a.active_calories} cal burned` : null,
                        ].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Weight ── */}
            {weightLog && (
              <View style={{ marginBottom: 14 }}>
                <Text style={sectionLabelStyle(w)}>Weight</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                  <IconSymbol name="scalemass.fill" size={16} color={w(0.45)} />
                  <Text style={{ fontSize: 16, color: w(0.82), flex: 1, fontFamily: FF }}>{weightLog.weight_lbs} lbs</Text>
                </View>
              </View>
            )}

            {/* ── Water ── */}
            {waterOz > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={sectionLabelStyle(w)}>Water</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                  <IconSymbol name="drop.fill" size={16} color="#5B8BF5" />
                  <Text style={{ fontSize: 16, color: w(0.82), flex: 1, fontFamily: FF }}>{waterOz} oz</Text>
                </View>
              </View>
            )}

            {/* ── Side Effects ── */}
            {sideEffectLogs.length > 0 && (
              <View>
                <Text style={sectionLabelStyle(w)}>Side Effects</Text>
                {sideEffectLogs.map(se => (
                  <View key={se.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 }}>
                    <MaterialIcons name="sick" size={16} color="#E74C3C" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, color: w(0.82), fontFamily: FF }}>{se.effect_type.replace(/_/g, ' ')}</Text>
                      <Text style={{ fontSize: 13, color: w(0.38), marginTop: 2, fontFamily: FF }}>Severity: {se.severity}/10</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DayLogScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useHealthData();
  const oral = isOralDrug(profile?.glp1Type);
  const s = useMemo(() => createStyles(colors), [colors]);

  const [days, setDays] = useState<DayCardData[]>([]);
  const [daysLoaded, setDaysLoaded] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchDays = useCallback(async (fromOffset: number, count: number): Promise<DayCardData[]> => {
    const today = new Date();
    const tasks: Promise<DayCardData>[] = [];
    for (let i = fromOffset; i < fromOffset + count; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = localDateStr(d);
      tasks.push(
        fetchDailySnapshot(dateStr).then(snap => ({
          dateStr,
          date: d,
          snapshot: snap,
          waterOz: Math.round(snap.actuals.waterMl / 29.5735),
        })),
      );
    }
    return Promise.all(tasks);
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    try {
      const count = Math.max(DAYS_PER_PAGE, daysLoaded);
      const fetched = await fetchDays(0, count);
      setDays(fetched);
      setDaysLoaded(count);
    } catch (err) {
      console.warn('day-log: load failed', err);
    } finally {
      setLoading(false);
    }
  }, [fetchDays, daysLoaded]);

  useEffect(() => {
    (async () => {
      try {
        const fetched = await fetchDays(0, DAYS_PER_PAGE);
        setDays(fetched);
        setDaysLoaded(DAYS_PER_PAGE);
      } catch (err) {
        console.warn('day-log: initial load failed', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchDays]);

  useFocusEffect(useCallback(() => {
    if (daysLoaded > 0) reloadAll();
  }, [reloadAll, daysLoaded]));

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const fetched = await fetchDays(daysLoaded, DAYS_PER_PAGE);
      setDays(prev => [...prev, ...fetched]);
      setDaysLoaded(prev => prev + DAYS_PER_PAGE);
    } catch (err) {
      console.warn('day-log: load more failed', err);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchDays, daysLoaded, loadingMore]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.topTitle}>Day Log</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={ORANGE} />
          </View>
        ) : (
          <>
            {days.map(d => (
              <DayCard key={d.dateStr} data={d} colors={colors} oral={oral} />
            ))}

            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              style={({ pressed }) => [s.loadMoreBtn, { opacity: pressed || loadingMore ? 0.6 : 1 }]}
              accessibilityLabel="Load more days"
              accessibilityRole="button"
            >
              {loadingMore
                ? <ActivityIndicator color={ORANGE} />
                : <Text style={s.loadMoreText}>Load More</Text>
              }
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  topTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
  cardWrap: {
    borderRadius: 24,
    ...(c.isDark
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }),
  },
  cardBody: { borderRadius: 24, overflow: 'hidden', borderWidth: 0.5, borderColor: c.border },
  dayHeading: { fontSize: 19, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3 },
  daySub: { fontSize: 13, color: c.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginTop: 2, fontFamily: FF },
  loadMoreBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  loadMoreText: { fontSize: 15, fontWeight: '700', color: ORANGE, fontFamily: FF, letterSpacing: 0.3 },
});
