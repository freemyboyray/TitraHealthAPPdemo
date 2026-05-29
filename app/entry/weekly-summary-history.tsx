import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLogStore, type WeeklySummaryRow } from '@/stores/log-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { WeeklySummaryData } from '@/lib/weekly-summary';

const ORANGE = '#FF742A';
const GREEN  = '#27AE60';
const RED    = '#E53E3E';
const FF     = 'System';

function formatDateShort(d: string) {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return d; }
}

function GlassBorder({ r = 20 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r, borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.13)',
        borderLeftColor: 'rgba(255,255,255,0.08)',
        borderRightColor: 'rgba(255,255,255,0.03)',
        borderBottomColor: 'rgba(255,255,255,0.02)',
      }}
    />
  );
}

export default function WeeklySummaryHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const weeklySummaries = useLogStore(s => s.weeklySummaries);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
      }}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
          <GlassBorder r={20} />
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFF', fontFamily: FF }}>Past Summaries</Text>

        <View style={{ width: 40 }} />
      </View>

      {weeklySummaries.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <Ionicons name="sparkles-outline" size={48} color="rgba(255,255,255,0.15)" style={{ marginBottom: 14 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.35)', fontFamily: FF }}>
            No past summaries yet
          </Text>
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.2)', fontFamily: FF, marginTop: 6, paddingHorizontal: 40, textAlign: 'center' }}>
            Your first weekly summary will appear here on your next shot day or weekly cycle.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {weeklySummaries.map(row => (
            <SummaryRowCard key={row.id} row={row} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SummaryRowCard({ row }: { row: WeeklySummaryRow }) {
  const data = row.summary_data as unknown as WeeklySummaryData;
  const range = `${formatDateShort(row.window_start)} – ${formatDateShort(row.window_end)}`;
  const delta = data?.weight?.delta ?? null;
  const insightSnippet = (row.ai_insight ?? '').trim();
  const truncated = insightSnippet.length > 110
    ? insightSnippet.slice(0, 110).replace(/\s+\S*$/, '') + '…'
    : insightSnippet;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/entry/weekly-summary' as any, params: { snapshot_id: row.id } })}
      style={[s.card, { marginBottom: 14 }]}
      accessibilityRole="button"
      accessibilityLabel={`Summary for ${range}`}
    >
      <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
      <GlassBorder r={20} />

      <View style={{ padding: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFF', fontFamily: FF }}>
            {range}
          </Text>
          {delta != null && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              backgroundColor: delta <= 0 ? 'rgba(39,174,96,0.12)' : 'rgba(229,62,62,0.12)',
              borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3,
            }}>
              <Ionicons
                name={delta <= 0 ? 'trending-down' : 'trending-up'}
                size={12}
                color={delta <= 0 ? GREEN : RED}
              />
              <Text style={{ fontSize: 13, fontWeight: '700', color: delta <= 0 ? GREEN : RED, fontFamily: FF }}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)} lbs
              </Text>
            </View>
          )}
        </View>

        {truncated.length > 0 ? (
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: FF, lineHeight: 19 }}>
            {truncated}
          </Text>
        ) : (
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', fontFamily: FF, fontStyle: 'italic' }}>
            No AI insight saved for this week.
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: ORANGE, fontFamily: FF }}>View summary</Text>
          <Ionicons name="chevron-forward" size={14} color={ORANGE} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  card: {
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },
});
