import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react-native';

import { CircleIconButton } from '@/components/ui/circle-icon-button';
import { SolidCard } from '@/components/ui/solid-card';
import { useLogStore, type WeeklyCheckinRow } from '@/stores/log-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { overallScoreLabel, scoreColor } from '@/constants/checkin-domains';

const FF = 'System';

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

  const sessions = useMemo(() => {
    const allRows: WeeklyCheckinRow[] = Object.values(weeklyCheckins).flat();
    const byDate: Record<string, WeeklyCheckinRow[]> = {};
    for (const row of allRows) {
      const date = (row.logged_at as string).slice(0, 10);
      (byDate[date] ??= []).push(row);
    }
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
  }, [weeklyCheckins]);

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
            <SessionCard key={date} date={date} rows={rows} colors={colors} s={s} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Session Card (overall score, tap to view details) ────────────────────────

function SessionCard({ date, rows, colors, s }: {
  date: string; rows: WeeklyCheckinRow[]; colors: AppColors; s: ReturnType<typeof createStyles>;
}) {
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const overall = useMemo(() => {
    if (!rows.length) return 0;
    return Math.round(rows.reduce((a, r) => a + (r.score ?? 0), 0) / rows.length);
  }, [rows]);
  const overallColor = scoreColor(overall);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/entry/weekly-checkin-detail', params: { date } })}
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(date)} check-in, overall score ${overall}`}
    >
      <SolidCard radius={24} style={{ marginBottom: 14 }}>
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.cardDate}>{formatDate(date)}</Text>
            <Text style={[s.overallLabel, { color: overallColor }]}>{overallScoreLabel(overall)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.score, { color: overallColor }]}>{overall}</Text>
            <Text style={[s.scoreMax, { color: w(0.3) }]}>/100</Text>
            <ChevronRight size={20} color={w(0.3)} style={{ marginLeft: 2 }} />
          </View>
        </View>
      </SolidCard>
    </TouchableOpacity>
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

    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
    cardDate: { fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3 },
    overallLabel: { fontSize: 14, fontWeight: '700', fontFamily: FF, marginTop: 2 },
    score: { fontSize: 30, fontWeight: '800', fontFamily: FF, letterSpacing: -1 },
    scoreMax: { fontSize: 13, fontWeight: '600', fontFamily: FF, marginBottom: 4 },
  });
};
