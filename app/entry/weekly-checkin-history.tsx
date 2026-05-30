import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLogStore, type WeeklyCheckinRow } from '@/stores/log-store';
import { usePersonalizationStore } from '@/stores/personalization-store';
import { useAppTheme } from '@/contexts/theme-context';
import { ChevronLeft, ClipboardList, Trash2 } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';

const FF = 'System';

// ─── Domain config (mirrors weekly-checkin.tsx) ────────────────────────────────

type DomainKey =
  | 'gi_burden'
  | 'energy_mood'
  | 'appetite'
  | 'food_noise'
  | 'sleep_quality'
  | 'activity_quality'
  | 'mental_health';

function makeStatus(
  sum: number,
  labels: [string, string, string, string],
  colors: [string, string, string, string],
): { label: string; color: string } {
  if (sum <= 2) return { label: labels[0], color: colors[0] };
  if (sum <= 5) return { label: labels[1], color: colors[1] };
  if (sum <= 8) return { label: labels[2], color: colors[2] };
  return           { label: labels[3], color: colors[3] };
}

const DOMAINS: {
  key: DomainKey;
  label: string;
  icon: string;
  higherIsBetter: boolean;
  getStatus: (sum: number) => { label: string; color: string };
}[] = [
  {
    key: 'gi_burden', label: 'GI Symptoms', icon: 'Hospital',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s, ['Minimal', 'Mild', 'Moderate', 'Severe'], ['#27AE60', '#F6CB45', '#E8960C', '#E53E3E']),
  },
  {
    key: 'energy_mood', label: 'Energy & Mood', icon: 'Zap',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s, ['Excellent', 'Good', 'Fair', 'Low'], ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E']),
  },
  {
    key: 'appetite', label: 'Appetite', icon: 'Utensils',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s, ['Excellent', 'Good', 'Fair', 'Low'], ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E']),
  },
  {
    key: 'food_noise', label: 'Food Noise', icon: 'Volume2',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s, ['Quiet', 'Mild', 'Moderate', 'High'], ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E']),
  },
  {
    key: 'sleep_quality', label: 'Sleep', icon: 'Moon',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s, ['Excellent', 'Good', 'Fair', 'Poor'], ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E']),
  },
  {
    key: 'activity_quality', label: 'Activity', icon: 'Dumbbell',
    higherIsBetter: true,
    getStatus: (s) => makeStatus(s, ['Low', 'Fair', 'Good', 'Excellent'], ['#E53E3E', '#F6CB45', '#5AC8FA', '#27AE60']),
  },
  {
    key: 'mental_health', label: 'Mental Health', icon: 'Heart',
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s, ['Stable', 'Mild', 'Moderate', 'High'], ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E']),
  },
];

function rowSum(answers: Record<string, number>): number {
  return (answers.q1 ?? 0) + (answers.q2 ?? 0) + (answers.q3 ?? 0);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}, ${y}`;
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyCheckinHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const weeklyCheckins = useLogStore(s => s.weeklyCheckins);
  const deleteWeeklyCheckinSession = useLogStore(s => s.deleteWeeklyCheckinSession);
  const fetchAndRecompute = usePersonalizationStore(s => s.fetchAndRecompute);

  // Group all rows by date (YYYY-MM-DD), sorted newest first
  const sessions = useMemo(() => {
    const allRows: WeeklyCheckinRow[] = Object.values(weeklyCheckins).flat();
    const byDate: Record<string, WeeklyCheckinRow[]> = {};
    for (const row of allRows) {
      const date = (row.logged_at as string).slice(0, 10);
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(row);
    }
    return Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
  }, [weeklyCheckins]);

  function confirmDelete(date: string) {
    Alert.alert(
      'Delete Check-In',
      'Remove this check-in session? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteWeeklyCheckinSession(date);
            fetchAndRecompute();
          },
        },
      ],
    );
  }

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
          <ChevronLeft size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <Text style={{ fontSize: 20, fontWeight: '800', color: '#FFF', fontFamily: FF }}>Past Check-Ins</Text>

        <View style={{ width: 40 }} />
      </View>

      {sessions.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
          <ClipboardList size={48} color="rgba(255,255,255,0.15)" style={{ marginBottom: 14 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.35)', fontFamily: FF }}>
            No past check-ins yet
          </Text>
          <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.2)', fontFamily: FF, marginTop: 6 }}>
            Complete your first weekly check-in to see history here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32 }}
          showsVerticalScrollIndicator={false}
        >
          {sessions.map(([date, rows]) => (
            <SessionCard
              key={date}
              date={date}
              rows={rows}
              onDelete={() => confirmDelete(date)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  date,
  rows,
  onDelete,
}: {
  date: string;
  rows: WeeklyCheckinRow[];
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  const rowsByType = useMemo(() => {
    const map: Record<string, WeeklyCheckinRow> = {};
    for (const r of rows) {
      map[r.checkin_type as string] = r;
    }
    return map;
  }, [rows]);

  return (
    <View style={[s.card, { marginBottom: 16 }]}>
      <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
      <GlassBorder r={20} />

      <View style={{ padding: 18 }}>
        {/* Card header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#FFF', fontFamily: FF }}>
            {formatDate(date)}
          </Text>
          <TouchableOpacity
            onPress={onDelete}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 32, height: 32, borderRadius: 16,
              backgroundColor: 'rgba(229,62,62,0.12)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Trash2 size={16} color="#E53E3E" />
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 12 }} />

        {/* Domain rows */}
        {DOMAINS.map((domain, i) => {
          const row = rowsByType[domain.key];
          const answers = row ? (row.answers as Record<string, number>) : null;
          const sum = answers ? rowSum(answers) : 0;
          const status = answers ? domain.getStatus(sum) : null;

          return (
            <View
              key={domain.key}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                paddingVertical: 7,
                borderBottomWidth: i < DOMAINS.length - 1 ? StyleSheet.hairlineWidth : 0,
                borderBottomColor: 'rgba(255,255,255,0.05)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 28, height: 28, borderRadius: 14,
                  backgroundColor: 'rgba(255,116,42,0.12)',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <LucideIconByName name={domain.icon} size={14} color={colors.orange} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.85)', fontFamily: FF }}>
                  {domain.label}
                </Text>
              </View>

              {status ? (
                <View style={{
                  backgroundColor: `${status.color}22`,
                  borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
                }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: status.color, fontFamily: FF }}>
                    {status.label}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', fontFamily: FF }}>—</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
