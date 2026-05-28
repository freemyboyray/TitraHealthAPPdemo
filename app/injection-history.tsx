import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import type { AppColors } from '@/constants/theme';
import { isOralDrug, doseIconName, doseNoun } from '@/constants/drug-pk';
import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

const FF = 'System';
const ORANGE = '#FF742A';
const PAGE_SIZE = 20;

const SITE_ROTATION = [
  'Left Abdomen', 'Right Abdomen',
  'Left Thigh', 'Right Thigh',
  'Left Upper Arm', 'Right Upper Arm',
];

function nextSite(current: string | null): string | null {
  if (!current) return null;
  const idx = SITE_ROTATION.indexOf(current);
  return idx === -1 ? SITE_ROTATION[0] : SITE_ROTATION[(idx + 1) % SITE_ROTATION.length];
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
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

function daysAgo(dateStr: string): number {
  const ms = parseLocalDate(dateStr).getTime();
  const todayMs = new Date().setHours(0, 0, 0, 0);
  return Math.floor((todayMs - ms) / 86400000);
}

function nextDueLabel(dateStr: string, freqDays: number): string {
  const ms = parseLocalDate(dateStr).getTime();
  const nextMs = ms + freqDays * 86400000;
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const diff = Math.round((nextMs - todayMs) / 86400000);
  if (diff <= 0) return 'Due now';
  if (diff === 1) return 'Due tomorrow';
  return `Due in ${diff} days`;
}

function fmtTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type InjectionRow = {
  id: string;
  dose_mg: number;
  injection_date: string;
  injection_time: string | null;
  site: string | null;
  notes: string | null;
  medication_name: string | null;
  batch_number: string | null;
};

// ─── InjectionCard ────────────────────────────────────────────────────────────

function InjectionCard({
  row, isLatest, freqDays, oral, colors,
}: {
  row: InjectionRow; isLatest: boolean; freqDays: number; oral: boolean; colors: AppColors;
}) {
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const s = useMemo(() => createStyles(colors), [colors]);

  const date = parseLocalDate(row.injection_date);
  const dAgo = daysAgo(row.injection_date);
  const time = fmtTime(row.injection_time);
  const rotation = !oral && row.site ? nextSite(row.site) : null;

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
              {time ? ` · ${time}` : ''}
              {dAgo > 0 ? ` · ${dAgo}d ago` : ''}
            </Text>
          </View>
          <View style={s.doseBadge}>
            <FontAwesome5 name={doseIconName(oral)} size={11} color={ORANGE} />
            <Text style={s.doseBadgeText}>{row.dose_mg}mg</Text>
          </View>
        </View>

        {/* ── Body ── */}
        <View style={{ gap: 8 }}>
          {row.medication_name && (
            <Row label="Medication" value={row.medication_name} colors={colors} />
          )}
          {!oral && row.site && (
            <Row label="Site" value={row.site} colors={colors} />
          )}
          {row.batch_number && (
            <Row label="Batch" value={row.batch_number} colors={colors} />
          )}
          {row.notes && (
            <Row label="Notes" value={row.notes} colors={colors} multiline />
          )}
        </View>

        {/* ── Latest-only footer: next due + rotation ── */}
        {isLatest && (
          <View style={[s.footer, { borderTopColor: w(0.07) }]}>
            <View style={s.footerRow}>
              <IconSymbol name="calendar" size={14} color={w(0.5)} />
              <Text style={s.footerText}>{nextDueLabel(row.injection_date, freqDays)}</Text>
            </View>
            {rotation && (
              <View style={s.footerRow}>
                <IconSymbol name="arrow.triangle.2.circlepath" size={14} color={w(0.5)} />
                <Text style={s.footerText}>
                  Rotate to <Text style={{ color: ORANGE, fontWeight: '700' }}>{rotation}</Text>
                </Text>
              </View>
            )}
          </View>
        )}

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

export default function InjectionHistoryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile } = useHealthData();
  const oral = isOralDrug(profile?.glp1Type);
  const freqDays = profile?.injectionFrequencyDays ?? 7;
  const s = useMemo(() => createStyles(colors), [colors]);

  const [rows, setRows] = useState<InjectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('injection_logs')
      .select('id,dose_mg,injection_date,injection_time,site,notes,medication_name,batch_number')
      .eq('user_id', user.id)
      .order('injection_date', { ascending: false })
      .order('injection_time', { ascending: false, nullsFirst: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.warn('injection-history: fetch failed', error);
      return;
    }
    const fetched = (data ?? []) as InjectionRow[];
    setHasMore(fetched.length === PAGE_SIZE);
    setRows(prev => replace ? fetched : [...prev, ...fetched]);
  }, []);

  useEffect(() => {
    (async () => {
      try { await fetchPage(0, true); } finally { setLoading(false); }
    })();
  }, [fetchPage]);

  useFocusEffect(useCallback(() => {
    // Refresh latest page on focus so newly-logged shots show up immediately
    fetchPage(0, true);
  }, [fetchPage]));

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchPage(rows.length, false);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, rows.length, loadingMore, hasMore]);

  const title = oral ? 'Dose History' : 'Injection History';

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.topTitle}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={ORANGE} />
          </View>
        ) : rows.length === 0 ? (
          <View style={s.emptyWrap}>
            <FontAwesome5 name={doseIconName(oral)} size={28} color={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'} />
            <Text style={s.emptyTitle}>No {doseNoun(oral)}s logged yet</Text>
            <Text style={s.emptySub}>Your {doseNoun(oral)} history will appear here.</Text>
          </View>
        ) : (
          <>
            {rows.map((row, i) => (
              <InjectionCard
                key={row.id}
                row={row}
                isLatest={i === 0}
                freqDays={freqDays}
                oral={oral}
                colors={colors}
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
                  ? <ActivityIndicator color={ORANGE} />
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
  latestBadge: {
    backgroundColor: 'rgba(255,116,42,0.13)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  latestBadgeText: { fontSize: 10, fontWeight: '800', color: ORANGE, letterSpacing: 0.8, fontFamily: FF },
  doseBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,116,42,0.10)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5,
  },
  doseBadgeText: { fontSize: 14, fontWeight: '700', color: ORANGE, fontFamily: FF },
  footer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { fontSize: 14, color: c.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)', fontFamily: FF },
  loadMoreBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    alignItems: 'center',
  },
  loadMoreText: { fontSize: 15, fontWeight: '700', color: ORANGE, fontFamily: FF, letterSpacing: 0.3 },
  emptyWrap: {
    marginTop: 60, alignItems: 'center', gap: 12,
    padding: 24,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
  emptySub: { fontSize: 14, color: c.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', fontFamily: FF, textAlign: 'center' },
});
