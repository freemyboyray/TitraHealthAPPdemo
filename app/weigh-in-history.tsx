import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import type { AppColors } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { useLogStore } from '@/stores/log-store';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Scale, Trash2 } from 'lucide-react-native';

const FF = 'System';
const PAGE_SIZE = 20;

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

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function daysAgo(iso: string): number {
  const ms = new Date(iso).setHours(0, 0, 0, 0);
  const todayMs = new Date().setHours(0, 0, 0, 0);
  return Math.floor((todayMs - ms) / 86400000);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type WeightRow = {
  id: string;
  weight_lbs: number;
  logged_at: string;
  notes: string | null;
  body_fat_pct: number | null;
  lean_mass_lbs: number | null;
  muscle_mass_lbs: number | null;
  body_water_pct: number | null;
  waist_inches: number | null;
};

// ─── WeightCard ───────────────────────────────────────────────────────────────

function WeightCard({
  row, prev, isLatest, colors, onDelete,
}: {
  row: WeightRow; prev: WeightRow | undefined; isLatest: boolean; colors: AppColors;
  onDelete: (row: WeightRow) => void;
}) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const s = useMemo(() => createStyles(colors), [colors]);

  const date = new Date(row.logged_at);
  const dAgo = daysAgo(row.logged_at);
  const time = fmtTime(date);

  // Delta vs the previous (older) entry — down is good.
  const delta = prev ? round1(row.weight_lbs - prev.weight_lbs) : null;
  const deltaColor = delta == null || delta === 0 ? w(0.5)
    : delta < 0 ? '#2B9450' : '#E0533A';
  const deltaLabel = delta == null ? null
    : delta === 0 ? 'No change'
    : delta < 0 ? `Down ${Math.abs(delta)} lbs` : `Up ${delta} lbs`;

  return (
    <View style={[s.cardWrap, { marginBottom: 14 }]}>
      <View style={[s.cardBody, { backgroundColor: colors.surface, padding: 18 }]}>

        {/* ── Header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={s.dayHeading}>{formatDateHeading(date)}</Text>
              {isLatest && (
                <View style={s.latestBadge}>
                  <Text style={s.latestBadgeText}>LATEST</Text>
                </View>
              )}
            </View>
            <Text style={s.daySub}>
              {formatDateSub(date)}
              {` · ${time}`}
              {dAgo > 0 ? ` · ${dAgo}d ago` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={s.weightBadge}>
              <Scale size={11} color={colors.orange} />
              <Text style={s.weightBadgeText}>{round1(row.weight_lbs)} lbs</Text>
            </View>
            <Pressable
              onPress={() => onDelete(row)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Delete weigh-in of ${round1(row.weight_lbs)} pounds`}
              style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.5 }]}
            >
              <Trash2 size={16} color={w(0.4)} />
            </Pressable>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={{ gap: 8 }}>
          {deltaLabel && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={s.rowLabel}>Change</Text>
              <Text style={[s.rowValue, { color: deltaColor, fontWeight: '700' }]}>{deltaLabel}</Text>
            </View>
          )}
          {row.notes && (
            <Row label="Notes" value={row.notes} colors={colors} multiline />
          )}
        </View>

      </View>
    </View>
  );
}

function Row({ label, value, colors, multiline }: { label: string; value: string; colors: AppColors; multiline?: boolean }) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return (
    <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 12 }}>
      <Text style={{ fontSize: 13, color: w(0.45), fontFamily: FF, fontWeight: '600', width: 78 }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 15, color: w(0.85), fontFamily: FF }} numberOfLines={multiline ? 0 : 1}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeighInHistoryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const deleteWeightLog = useLogStore(st => st.deleteWeightLog);

  const [rows, setRows] = useState<WeightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('weight_logs')
      .select('id,weight_lbs,logged_at,notes,body_fat_pct,lean_mass_lbs,muscle_mass_lbs,body_water_pct,waist_inches')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.warn('weigh-in-history: fetch failed', error);
      return;
    }
    const fetched = (data ?? []) as WeightRow[];
    setHasMore(fetched.length === PAGE_SIZE);
    setRows(prev => replace ? fetched : [...prev, ...fetched]);
  }, []);

  useEffect(() => {
    (async () => {
      try { await fetchPage(0, true); } finally { setLoading(false); }
    })();
  }, [fetchPage]);

  useFocusEffect(useCallback(() => {
    // Refresh latest page on focus so newly-logged weigh-ins show up immediately
    fetchPage(0, true);
  }, [fetchPage]));

  const handleDelete = useCallback((row: WeightRow) => {
    Alert.alert('Delete Weigh-In', `Are you sure you want to delete the ${round1(row.weight_lbs)} lbs weigh-in?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await deleteWeightLog(row.id);
          setRows(prev => prev.filter(r => r.id !== row.id));
        },
      },
    ]);
  }, [deleteWeightLog]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(rows.length, false);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, rows.length, loadingMore, hasMore]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
          <ChevronLeft size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.topTitle}>Weigh-In History</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.orange} />
          </View>
        ) : rows.length === 0 ? (
          <View style={s.emptyWrap}>
            <Scale size={28} color={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'} />
            <Text style={s.emptyTitle}>No weigh-ins logged yet</Text>
            <Text style={s.emptySub}>Your weight history will appear here.</Text>
          </View>
        ) : (
          <>
            {rows.map((row, i) => (
              <WeightCard
                key={row.id}
                row={row}
                prev={rows[i + 1]}
                isLatest={i === 0}
                colors={colors}
                onDelete={handleDelete}
              />
            ))}

            {hasMore && (
              <Pressable
                onPress={loadMore}
                disabled={loadingMore}
                style={({ pressed }) => [s.loadMoreBtn, { opacity: pressed || loadingMore ? 0.6 : 1 }]}
                accessibilityLabel="Load more"
                accessibilityRole="button"
              >
                {loadingMore
                  ? <ActivityIndicator color={colors.orange} />
                  : <Text style={s.loadMoreText}>Load More</Text>
                }
              </Pressable>
            )}
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
    borderRadius: 22,
    ...(c.isDark
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 }),
  },
  cardBody: { borderRadius: 22, overflow: 'hidden', borderWidth: 0.5, borderColor: c.border },
  dayHeading: { fontSize: 18, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3 },
  daySub: { fontSize: 13, color: c.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', marginTop: 2, fontFamily: FF },
  rowLabel: { fontSize: 13, color: c.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', fontFamily: FF, fontWeight: '600', width: 78 },
  rowValue: { flex: 1, fontSize: 15, color: c.isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)', fontFamily: FF },
  latestBadge: {
    backgroundColor: 'rgba(255,116,42,0.13)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  latestBadgeText: { fontSize: 10, fontWeight: '800', color: c.orange, letterSpacing: 0.8, fontFamily: FF },
  weightBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,116,42,0.10)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  weightBadgeText: { fontSize: 14, fontWeight: '700', color: c.orange, fontFamily: FF },
  deleteBtn: { padding: 6 },
  loadMoreBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  loadMoreText: { fontSize: 15, fontWeight: '700', color: c.orange, fontFamily: FF, letterSpacing: 0.3 },
  emptyWrap: {
    marginTop: 60, alignItems: 'center', gap: 12,
    padding: 24,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
  emptySub: { fontSize: 14, color: c.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: FF, textAlign: 'center' },
});
