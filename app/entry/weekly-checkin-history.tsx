import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowDown, ArrowUp, ChevronLeft, ClipboardList, Trash2 } from 'lucide-react-native';

import { CircleIconButton } from '@/components/ui/circle-icon-button';
import { SolidCard } from '@/components/ui/solid-card';
import { useLogStore, type WeeklyCheckinRow } from '@/stores/log-store';
import { usePersonalizationStore } from '@/stores/personalization-store';
import { useHealthData } from '@/contexts/health-data';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { CHECKIN_ASSETS, CHECKIN_DOMAINS } from '@/constants/checkin-domains';
import { buildAdjustmentRows, ADJUSTMENT_IMAGE } from '@/lib/checkin-target-rows';

const BLUE = '#5AC8FA';
const FF = 'System';

function rowSum(answers: Record<string, number>): number {
  return (answers.q1 ?? 0) + (answers.q2 ?? 0) + (answers.q3 ?? 0);
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyCheckinHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const weeklyCheckins = useLogStore((st) => st.weeklyCheckins);
  const deleteWeeklyCheckinSession = useLogStore((st) => st.deleteWeeklyCheckinSession);
  const fetchAndRecompute = usePersonalizationStore((st) => st.fetchAndRecompute);

  const sessions = useMemo(() => {
    const allRows: WeeklyCheckinRow[] = Object.values(weeklyCheckins).flat();
    const byDate: Record<string, WeeklyCheckinRow[]> = {};
    for (const row of allRows) {
      const date = (row.logged_at as string).slice(0, 10);
      (byDate[date] ??= []).push(row);
    }
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
  }, [weeklyCheckins]);

  function confirmDelete(date: string) {
    Alert.alert('Delete Check-In', 'Remove this check-in session? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteWeeklyCheckinSession(date); fetchAndRecompute(); } },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <CircleIconButton icon={ChevronLeft} onPress={() => router.back()} accessibilityLabel="Go back" />
        <Text style={s.headerTitle}>Past Check-Ins</Text>
        <View style={{ width: 40 }} />
      </View>

      {sessions.length === 0 ? (
        <View style={s.empty}>
          <ClipboardList size={48} color={colors.textMuted} style={{ marginBottom: 14, opacity: 0.5 }} />
          <Text style={s.emptyTitle}>No past check-ins yet</Text>
          <Text style={s.emptyBody}>Complete your first weekly check-in to see history here.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {sessions.map(([date, rows]) => (
            <SessionCard key={date} date={date} rows={rows} onDelete={() => confirmDelete(date)} colors={colors} s={s} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ date, rows, onDelete, colors, s }: {
  date: string; rows: WeeklyCheckinRow[]; onDelete: () => void; colors: AppColors; s: ReturnType<typeof createStyles>;
}) {
  const { profile } = useHealthData();
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const rowsByType = useMemo(() => {
    const map: Record<string, WeeklyCheckinRow> = {};
    for (const r of rows) map[r.checkin_type as string] = r;
    return map;
  }, [rows]);

  // Recompute the target changes this session produced (against current base targets).
  const adjustments = useMemo(() => {
    const scores: Record<string, number> = {};
    for (const r of rows) scores[r.checkin_type as string] = r.score ?? 0;
    return buildAdjustmentRows(profile, scores);
  }, [rows, profile]);

  return (
    <SolidCard radius={24} style={{ marginBottom: 14 }}>
      <View style={{ padding: 18 }}>
        <View style={s.cardHead}>
          <Text style={s.cardDate}>{formatDate(date)}</Text>
          <TouchableOpacity
            onPress={onDelete} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.deleteBtn} accessibilityRole="button" accessibilityLabel="Delete check-in"
          >
            <Trash2 size={16} color="#E53E3E" />
          </TouchableOpacity>
        </View>

        {CHECKIN_DOMAINS.map((domain, i) => {
          const row = rowsByType[domain.key];
          const answers = row ? (row.answers as Record<string, number>) : null;
          const status = answers ? domain.getStatus(rowSum(answers)) : null;
          return (
            <View key={domain.key} style={[s.domainRow, { borderBottomWidth: i < CHECKIN_DOMAINS.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: w(0.07) }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[s.assetWrap, { backgroundColor: domain.color + '1A' }]}>
                  <Image source={CHECKIN_ASSETS[domain.key]} style={s.assetImg} resizeMode="contain" accessibilityIgnoresInvertColors />
                </View>
                <Text style={s.domainLabel}>{domain.label}</Text>
              </View>
              {status ? (
                <View style={[s.statusBadge, { backgroundColor: `${status.color}22` }]}>
                  <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              ) : (
                <Text style={s.dash}>—</Text>
              )}
            </View>
          );
        })}

        {/* Target changes this check-in produced */}
        {adjustments.length > 0 && (
          <View style={s.adjSection}>
            <Text style={s.adjHeader}>Target changes</Text>
            {adjustments.map((row) => {
              const accent = row.increased ? colors.orange : BLUE;
              return (
                <View key={row.key} style={s.adjRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={[s.adjAssetWrap, { backgroundColor: w(0.05) }]}>
                      <Image source={ADJUSTMENT_IMAGE[row.imageKey]} style={s.adjAssetImg} resizeMode="contain" accessibilityIgnoresInvertColors />
                    </View>
                    <Text style={s.adjLabel}>{row.label}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[s.adjVals, { color: w(0.4) }]}>{row.beforeStr} → <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>{row.afterStr}</Text></Text>
                    <View style={[s.deltaPill, { backgroundColor: row.increased ? 'rgba(255,116,42,0.12)' : 'rgba(90,200,250,0.12)' }]}>
                      {row.increased ? <ArrowUp size={10} color={accent} /> : <ArrowDown size={10} color={accent} />}
                      <Text style={[s.deltaText, { color: accent }]}>{row.delta}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </SolidCard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.4 },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.textSecondary, fontFamily: FF },
    emptyBody: { fontSize: 15, color: c.textMuted, fontFamily: FF, marginTop: 6, textAlign: 'center', lineHeight: 20 },

    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    cardDate: { fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3 },
    deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(229,62,62,0.12)', alignItems: 'center', justifyContent: 'center' },

    domainRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 },
    assetWrap: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    assetImg: { width: 26, height: 26 },
    domainLabel: { fontSize: 15, fontWeight: '600', color: c.textPrimary, fontFamily: FF },
    statusBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
    statusText: { fontSize: 13, fontWeight: '700', fontFamily: FF },
    dash: { fontSize: 14, color: c.textMuted, fontFamily: FF },

    adjSection: { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: w(0.09) },
    adjHeader: { fontSize: 12, fontWeight: '800', color: w(0.4), fontFamily: FF, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10 },
    adjRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
    adjAssetWrap: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    adjAssetImg: { width: 23, height: 23 },
    adjLabel: { fontSize: 14.5, fontWeight: '600', color: c.textPrimary, fontFamily: FF },
    adjVals: { fontSize: 13, fontWeight: '600', fontFamily: FF },
    deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    deltaText: { fontSize: 12.5, fontWeight: '800', fontFamily: FF },
  });
};
