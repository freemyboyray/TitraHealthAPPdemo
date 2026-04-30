import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/theme-context';
import { useLogStore, type FoodLog, type ActivityLog, type InjectionLog, type WeightLog, type SideEffectLog } from '@/stores/log-store';
import { GradientBackground } from '@/components/ui/gradient-background';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { localDateStr } from '@/lib/date-utils';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const ORANGE = '#FF742A';

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtDateOnly(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSectionDate(dateStr: string): string {
  const today = localDateStr();
  if (dateStr === today) return 'Today';
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ─── Log entry type ──────────────────────────────────────────────────────────

type Status = 'positive' | 'negative' | 'neutral';

type LogEntry = {
  id: string;
  timestamp: string;
  rawDate: string;
  title: string;
  details: string;
  impact: string;
  impactStatus: Status;
  icon: React.ReactElement;
  logType: FilterType;
};

const statusStyle: Record<Status, { bg: string; text: string }> = {
  positive: { bg: 'rgba(43,148,80,0.15)', text: '#2B9450' },
  negative: { bg: 'rgba(220,50,50,0.15)', text: '#DC3232' },
  neutral: { bg: 'rgba(150,150,150,0.10)', text: '#9A9490' },
};

// ─── Converters ──────────────────────────────────────────────────────────────

function foodToEntry(f: FoodLog): LogEntry {
  const details = `${Math.round(f.calories)} cal · ${Math.round(f.protein_g)}g protein · ${Math.round(f.fiber_g)}g fiber`;
  return {
    id: f.id, timestamp: fmtDateTime(f.logged_at), rawDate: localDateStr(new Date(f.logged_at)),
    title: f.food_name, details,
    impact: `+${Math.round(f.protein_g)}g protein`, impactStatus: 'positive',
    icon: <IconSymbol name="fork.knife" size={20} color={ORANGE} />,
    logType: 'food',
  };
}

function activityIcon(type: string | null) {
  let name: string = 'directions-run';
  const t = (type ?? '').toLowerCase();
  if (t.includes('walk')) name = 'directions-walk';
  else if (t.includes('cycl') || t.includes('bike')) name = 'directions-bike';
  else if (t.includes('swim')) name = 'pool';
  else if (t.includes('yoga')) name = 'self-improvement';
  else if (t.includes('strength') || t.includes('weight') || t.includes('lift')) name = 'fitness-center';
  else if (t.includes('hike')) name = 'terrain';
  return <MaterialIcons name={name as any} size={20} color={ORANGE} />;
}

function activityToEntry(a: ActivityLog): LogEntry {
  const parts = [
    a.duration_min ? `${a.duration_min} min` : '',
    a.steps ? `${a.steps.toLocaleString()} steps` : '',
    a.active_calories ? `${a.active_calories} cal burned` : '',
  ].filter(Boolean);
  return {
    id: a.id, timestamp: fmtDateOnly(a.date), rawDate: a.date,
    title: a.exercise_type ?? 'Activity', details: parts.join(' · ') || 'Activity logged',
    impact: a.steps ? `+${a.steps.toLocaleString()} steps` : 'Logged', impactStatus: 'positive',
    icon: activityIcon(a.exercise_type),
    logType: 'activity',
  };
}

function injectionToEntry(inj: InjectionLog): LogEntry {
  const medName = inj.medication_name ?? 'Injection';
  const siteStr = inj.site ? `Site: ${inj.site} · ` : '';
  return {
    id: inj.id, timestamp: fmtDateOnly(inj.injection_date), rawDate: inj.injection_date,
    title: `${medName} ${inj.dose_mg}mg`, details: `${siteStr}Dose: ${inj.dose_mg}mg`,
    impact: 'Dose logged', impactStatus: 'neutral',
    icon: <FontAwesome5 name="syringe" size={18} color={ORANGE} />,
    logType: 'medication',
  };
}

function weightToEntry(log: WeightLog, prevLog?: WeightLog): LogEntry {
  const delta = prevLog ? Math.round((log.weight_lbs - prevLog.weight_lbs) * 10) / 10 : 0;
  const deltaStr = delta < 0 ? `Down ${Math.abs(delta)} lbs` : delta > 0 ? `Up ${delta} lbs` : 'Steady';
  return {
    id: log.id, timestamp: fmtDateTime(log.logged_at), rawDate: localDateStr(new Date(log.logged_at)),
    title: `Weight - ${log.weight_lbs} lbs`, details: `${log.weight_lbs} lbs · ${deltaStr}`,
    impact: delta <= 0 ? deltaStr : `Up ${Math.abs(delta)} lbs`,
    impactStatus: delta < 0 ? 'positive' : delta > 0 ? 'negative' : 'neutral',
    icon: <IconSymbol name="scalemass.fill" size={20} color={ORANGE} />,
    logType: 'weight',
  };
}

function sideEffectToEntry(se: SideEffectLog): LogEntry {
  const label = se.effect_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const sevLabel = se.severity <= 3 ? 'Mild' : se.severity <= 6 ? 'Moderate' : 'Severe';
  return {
    id: se.id, timestamp: fmtDateTime(se.logged_at), rawDate: localDateStr(new Date(se.logged_at)),
    title: label, details: `Severity: ${se.severity}/10${se.notes ? ` · ${se.notes}` : ''}`,
    impact: sevLabel, impactStatus: se.severity <= 3 ? 'neutral' : 'negative',
    icon: <MaterialIcons name="sick" size={20} color={ORANGE} />,
    logType: 'side_effect',
  };
}

// ─── Filter types ────────────────────────────────────────────────────────────

type FilterType = 'all' | 'food' | 'activity' | 'weight' | 'medication' | 'side_effect';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'food', label: 'Food' },
  { key: 'activity', label: 'Activity' },
  { key: 'weight', label: 'Weight' },
  { key: 'medication', label: 'Medication' },
  { key: 'side_effect', label: 'Side Effects' },
];

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function LogHistoryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { foodLogs, activityLogs, weightLogs, injectionLogs, sideEffectLogs } = useLogStore();
  const [filter, setFilter] = useState<FilterType>('all');

  const allEntries = useMemo(() => {
    const entries: LogEntry[] = [
      ...foodLogs.map(foodToEntry),
      ...activityLogs.map(activityToEntry),
      ...weightLogs.map((log, i) => weightToEntry(log, weightLogs[i + 1])),
      ...injectionLogs.map(injectionToEntry),
      ...sideEffectLogs.map(sideEffectToEntry),
    ];
    return entries.sort((a, b) => b.rawDate.localeCompare(a.rawDate) || b.timestamp.localeCompare(a.timestamp));
  }, [foodLogs, activityLogs, weightLogs, injectionLogs, sideEffectLogs]);

  const filtered = filter === 'all' ? allEntries : allEntries.filter(e => e.logType === filter);

  const sections = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const e of filtered) {
      const list = map.get(e.rawDate) ?? [];
      list.push(e);
      map.set(e.rawDate, list);
    }
    return Array.from(map.entries()).map(([date, data]) => ({
      title: formatSectionDate(date),
      data,
    }));
  }, [filtered]);

  return (
    <View style={s.root}>
      <GradientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </Pressable>
          <Text style={s.headerTitle}>Log History</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={s.filterRow}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <TouchableOpacity
                key={key}
                style={[s.filterChip, active && s.filterChipActive]}
                onPress={() => setFilter(key)}
                activeOpacity={0.7}
              >
                <Text style={[s.filterLabel, active && s.filterLabelActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={s.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item, index, section }) => (
            <View style={s.entryCard}>
              <View style={s.entryRow}>
                <View style={s.entryIconWrap}>{item.icon}</View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={s.entryTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.entryTime}>{item.timestamp}</Text>
                  </View>
                  <Text style={s.entryDetails}>{item.details}</Text>
                  <View style={[s.impactTag, { backgroundColor: statusStyle[item.impactStatus].bg }]}>
                    <Text style={[s.impactText, { color: statusStyle[item.impactStatus].text }]}>
                      {item.impact}
                    </Text>
                  </View>
                </View>
              </View>
              {index < section.data.length - 1 && <View style={s.divider} />}
            </View>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 16, fontFamily: FF }}>No logs found</Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const muted = c.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 12,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', fontFamily: FF },
    filterRow: {
      flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 8, flexWrap: 'wrap',
    },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    filterChipActive: {
      backgroundColor: ORANGE,
    },
    filterLabel: { fontSize: 13, fontWeight: '600', color: muted, fontFamily: FF },
    filterLabelActive: { color: '#FFFFFF' },
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    sectionHeader: {
      fontSize: 15, fontWeight: '700', color: c.textPrimary,
      paddingTop: 20, paddingBottom: 8, fontFamily: FF,
    },
    entryCard: {
      backgroundColor: c.surface, borderRadius: 16,
      marginBottom: 1, paddingHorizontal: 16, paddingVertical: 12,
      borderWidth: 0.5, borderColor: c.border,
    },
    entryRow: { flexDirection: 'row', gap: 12 },
    entryIconWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center', justifyContent: 'center',
    },
    entryTitle: { fontSize: 15, fontWeight: '600', color: c.textPrimary, flex: 1, fontFamily: FF },
    entryTime: { fontSize: 12, color: muted, fontFamily: FF },
    entryDetails: { fontSize: 13, color: muted, marginTop: 2, fontFamily: FF },
    impactTag: {
      marginTop: 6, alignSelf: 'flex-start',
      paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
    },
    impactText: { fontSize: 12, fontWeight: '600', fontFamily: FF },
    divider: { height: 0.5, backgroundColor: c.border, marginVertical: 8 },
  });
};
