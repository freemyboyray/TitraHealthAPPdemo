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
import { ChevronLeft, ChevronRight, Sparkles, TrendingDown, TrendingUp } from 'lucide-react-native';

import { CircleIconButton } from '@/components/ui/circle-icon-button';
import { GlassCard } from '@/components/ui/glass-card';
import { useLogStore, type WeeklySummaryRow } from '@/stores/log-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import type { WeeklySummaryData } from '@/lib/weekly-summary';

const GREEN = '#27AE60';
const RED = '#E53E3E';
const FF = 'System';

function formatDateShort(d: string) {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return d; }
}

export default function WeeklySummaryHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const weeklySummaries = useLogStore((st) => st.weeklySummaries);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <CircleIconButton icon={ChevronLeft} onPress={() => router.back()} accessibilityLabel="Go back" />
        <Text style={s.headerTitle}>Past Summaries</Text>
        <View style={{ width: 40 }} />
      </View>

      {weeklySummaries.length === 0 ? (
        <View style={s.empty}>
          <Sparkles size={48} color={colors.textMuted} style={{ marginBottom: 14, opacity: 0.5 }} />
          <Text style={s.emptyTitle}>No past summaries yet</Text>
          <Text style={s.emptyBody}>Your first weekly summary will appear here on your next shot day or weekly cycle.</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {weeklySummaries.map((row) => (
            <SummaryRowCard key={row.id} row={row} colors={colors} s={s} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SummaryRowCard({ row, colors, s }: {
  row: WeeklySummaryRow; colors: AppColors; s: ReturnType<typeof createStyles>;
}) {
  const data = row.summary_data as unknown as WeeklySummaryData;
  const range = `${formatDateShort(row.window_start)} – ${formatDateShort(row.window_end)}`;
  const delta = data?.weight?.delta ?? null;
  const insight = (row.ai_insight ?? '').trim();
  const truncated = insight.length > 110 ? insight.slice(0, 110).replace(/\s+\S*$/, '') + '…' : insight;
  const down = (delta ?? 0) <= 0;
  const dColor = down ? GREEN : RED;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/entry/weekly-summary' as any, params: { snapshot_id: row.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Summary for ${range}`}
      style={{ marginBottom: 14 }}
    >
      <GlassCard radius={24}>
        <View style={{ padding: 18 }}>
          <View style={s.cardHead}>
            <Text style={s.range}>{range}</Text>
            {delta != null && (
              <View style={[s.deltaPill, { backgroundColor: dColor + '1F' }]}>
                {down ? <TrendingDown size={12} color={dColor} /> : <TrendingUp size={12} color={dColor} />}
                <Text style={[s.deltaText, { color: dColor }]}>{delta > 0 ? '+' : ''}{delta.toFixed(1)} lbs</Text>
              </View>
            )}
          </View>

          {truncated.length > 0 ? (
            <Text style={s.insight}>{truncated}</Text>
          ) : (
            <Text style={s.insightEmpty}>No AI insight saved for this week.</Text>
          )}

          <View style={s.ctaRow}>
            <Text style={s.ctaText}>View summary</Text>
            <ChevronRight size={14} color={colors.orange} />
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.4 },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.textSecondary, fontFamily: FF },
    emptyBody: { fontSize: 15, color: c.textMuted, fontFamily: FF, marginTop: 6, textAlign: 'center', lineHeight: 20 },

    cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    range: { fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3 },
    deltaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    deltaText: { fontSize: 13, fontWeight: '700', fontFamily: FF },

    insight: { fontSize: 14, color: w(0.6), fontFamily: FF, lineHeight: 19 },
    insightEmpty: { fontSize: 14, color: w(0.3), fontFamily: FF, fontStyle: 'italic' },

    ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
    ctaText: { fontSize: 13, fontWeight: '700', color: c.orange, fontFamily: FF },
  });
};
