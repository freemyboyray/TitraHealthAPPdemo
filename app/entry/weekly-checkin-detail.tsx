import { router, useLocalSearchParams } from 'expo-router';
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
import { ChevronLeft, Trash2 } from 'lucide-react-native';

import { CircleIconButton } from '@/components/ui/circle-icon-button';
import { CheckinResponsesCard } from '@/components/insights/checkin-responses-card';
import { CheckinTargetsCard } from '@/components/insights/checkin-targets-card';
import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import type { AppColors } from '@/constants/theme';
import { useLogStore, type WeeklyCheckinRow } from '@/stores/log-store';
import { usePersonalizationStore } from '@/stores/personalization-store';
import { buildAdjustmentRows } from '@/lib/checkin-target-rows';
import { DOMAIN_ORDER } from '@/constants/checkin-domains';

const FF = 'System';

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

export default function WeeklyCheckinDetailScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { date } = useLocalSearchParams<{ date: string }>();
  const weeklyCheckins = useLogStore((st) => st.weeklyCheckins);
  const deleteWeeklyCheckinSession = useLogStore((st) => st.deleteWeeklyCheckinSession);
  const fetchAndRecompute = usePersonalizationStore((st) => st.fetchAndRecompute);
  const { profile } = useHealthData();

  // This session's rows, keyed by domain.
  const session = useMemo(() => {
    const rowsByType: Record<string, WeeklyCheckinRow> = {};
    for (const arr of Object.values(weeklyCheckins)) {
      for (const r of arr) {
        if ((r.logged_at as string).startsWith(date ?? '')) rowsByType[r.checkin_type as string] = r;
      }
    }
    return rowsByType;
  }, [weeklyCheckins, date]);

  const presentDomains = DOMAIN_ORDER.filter((k) => session[k] != null);

  const adjustments = useMemo(() => {
    const scores: Record<string, number> = {};
    for (const k of presentDomains) scores[k] = session[k].score ?? 0;
    return buildAdjustmentRows(profile, scores);
  }, [presentDomains, session, profile]);

  function confirmDelete() {
    Alert.alert('Delete Check-In', 'Remove this check-in? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteWeeklyCheckinSession(date ?? ''); fetchAndRecompute(); router.back(); },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <CircleIconButton icon={ChevronLeft} onPress={() => router.back()} accessibilityLabel="Go back" />
        <Text style={s.headerTitle} numberOfLines={1}>{date ? formatDate(date) : 'Check-In'}</Text>
        <TouchableOpacity
          onPress={confirmDelete} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={s.deleteBtn} accessibilityRole="button" accessibilityLabel="Delete check-in"
        >
          <Trash2 size={16} color="#E53E3E" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.sectionHeader}>Responses</Text>
        {presentDomains.map((key) => (
          <CheckinResponsesCard
            key={key}
            domainKey={key}
            answers={session[key].answers as Record<string, number>}
            colors={colors}
          />
        ))}

        {adjustments.length > 0 && (
          <>
            <Text style={[s.sectionHeader, { marginTop: 6 }]}>Target changes</Text>
            <CheckinTargetsCard rows={adjustments} colors={colors} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.3, marginHorizontal: 8 },
    deleteBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(229,62,62,0.12)', alignItems: 'center', justifyContent: 'center' },

    sectionHeader: { fontSize: 18, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2, marginBottom: 12, marginLeft: 2 },
  });
};
