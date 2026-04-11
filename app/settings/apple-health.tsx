import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { openHealthSettings } from '@/lib/healthkit';
import type { HKCategoryKey } from '@/lib/healthkit';

const ORANGE = '#FF742A';
const HEALTH_RED = '#FF3B30';

// Grouped view of the categories we read. Group order = display order on the
// detail screen. Each entry maps a user-facing label to one or more HK keys
// that light up the row. First key is the "primary" and drives the row icon.
type CategoryRow = {
  key: HKCategoryKey | HKCategoryKey[];
  label: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
};
type Group = { title: string; rows: CategoryRow[] };

const GROUPS: Group[] = [
  {
    title: 'CORE VITALS',
    rows: [
      { key: 'weight',       label: 'Weight',          sub: 'From your scale',            icon: 'scale-outline' },
      { key: 'hrv',          label: 'Heart Rate Variability', sub: 'GLP-1 pharmacodynamic marker', icon: 'pulse-outline' },
      { key: 'restingHR',    label: 'Resting Heart Rate', sub: '',                         icon: 'heart-outline' },
      { key: 'sleep',        label: 'Sleep',           sub: 'Last night\u2019s duration',  icon: 'moon-outline' },
      { key: 'steps',        label: 'Steps',           sub: 'Today',                       icon: 'footsteps-outline' },
      { key: 'activeEnergy', label: 'Active Calories', sub: 'Today',                       icon: 'flame-outline' },
    ],
  },
  {
    title: 'BODY COMPOSITION',
    rows: [
      { key: 'bodyFat',   label: 'Body Fat %',     sub: 'Lean mass preservation is the killer GLP-1 metric', icon: 'body-outline' },
      { key: 'leanMass',  label: 'Lean Body Mass', sub: '',                    icon: 'barbell-outline' },
      { key: 'waist',     label: 'Waist',          sub: '',                    icon: 'resize-outline' },
      { key: 'bmi',       label: 'BMI',            sub: '',                    icon: 'stats-chart-outline' },
    ],
  },
  {
    title: 'CARDIOVASCULAR',
    rows: [
      { key: 'vo2max',           label: 'VO₂ Max',        sub: 'Cardiorespiratory fitness',        icon: 'fitness-outline' },
      { key: 'spo2',             label: 'Blood Oxygen',   sub: 'Relevant for GLP-1 sleep apnea use', icon: 'water-outline' },
      { key: ['bpSystolic', 'bpDiastolic'], label: 'Blood Pressure', sub: '', icon: 'heart-circle-outline' },
      { key: 'walkingHR',        label: 'Walking Heart Rate', sub: '',                              icon: 'walk-outline' },
    ],
  },
  {
    title: 'NUTRITION',
    rows: [
      { key: 'water',    label: 'Hydration',   sub: 'Common GLP-1 issue',                    icon: 'water' },
      { key: 'calories', label: 'Calories',    sub: 'Only counted from other apps (e.g. MyFitnessPal)', icon: 'flame-outline' },
      { key: 'protein',  label: 'Protein',     sub: 'Critical for preserving lean mass',     icon: 'nutrition-outline' },
      { key: 'caffeine', label: 'Caffeine',    sub: '',                                       icon: 'cafe-outline' },
    ],
  },
  {
    title: 'GI SYMPTOMS',
    rows: [
      { key: 'symptomNausea',           label: 'Nausea',       sub: 'Auto-filled into your side-effects log', icon: 'sad-outline' },
      { key: 'symptomVomiting',         label: 'Vomiting',     sub: '', icon: 'alert-circle-outline' },
      { key: 'symptomDiarrhea',         label: 'Diarrhea',     sub: '', icon: 'warning-outline' },
      { key: 'symptomConstipation',     label: 'Constipation', sub: '', icon: 'remove-circle-outline' },
      { key: 'symptomHeartburn',        label: 'Heartburn',    sub: '', icon: 'flame-outline' },
      { key: 'symptomBloating',         label: 'Bloating',     sub: '', icon: 'ellipse-outline' },
      { key: 'symptomAbdominalCramps',  label: 'Stomach Pain', sub: '', icon: 'medkit-outline' },
      { key: 'symptomFatigue',          label: 'Fatigue',      sub: '', icon: 'battery-dead-outline' },
      { key: 'symptomHeadache',         label: 'Headache',     sub: '', icon: 'pulse-outline' },
      { key: 'symptomDizziness',        label: 'Dizziness',    sub: '', icon: 'refresh-outline' },
      { key: 'symptomAppetite',         label: 'Appetite Changes', sub: '', icon: 'restaurant-outline' },
      { key: 'symptomMood',             label: 'Mood Changes', sub: '', icon: 'happy-outline' },
    ],
  },
  {
    title: 'METABOLIC',
    rows: [
      { key: 'glucose', label: 'Blood Glucose', sub: 'Dexcom, Libre, Stelo sync automatically', icon: 'analytics-outline' },
      { key: 'bodyTemp', label: 'Body Temperature', sub: '', icon: 'thermometer-outline' },
    ],
  },
];

function isRowLive(live: Set<HKCategoryKey>, key: HKCategoryKey | HKCategoryKey[]): boolean {
  if (Array.isArray(key)) return key.some((k) => live.has(k));
  return live.has(key);
}

export default function AppleHealthSettingsScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { appleHealthEnabled, setAppleHealthEnabled } = usePreferencesStore();
  const { permissionsGranted, liveCategories, lastRefreshed, requestPermissions, fetchAll, refreshLive } = useHealthKitStore();
  const [refreshing, setRefreshing] = useState(false);

  const liveCount = liveCategories.size;
  const totalRowCount = GROUPS.reduce((n, g) => n + g.rows.length, 0);

  const handleMasterToggle = useCallback(async (value: boolean) => {
    if (!value) {
      setAppleHealthEnabled(false);
      return;
    }
    if (Platform.OS !== 'ios') {
      Alert.alert('Not Available', 'Apple Health is only available on iOS.');
      return;
    }
    const granted = await requestPermissions();
    if (granted) {
      setAppleHealthEnabled(true);
      await fetchAll();
    } else {
      Alert.alert(
        'Apple Health Unavailable',
        'The HealthKit module could not be loaded on this device. This usually means you are running in Expo Go, the device does not support HealthKit, or the native module failed to link in this build. Check the Metro console for [HealthKit] log lines.',
        [{ text: 'OK' }],
      );
    }
  }, [fetchAll, requestPermissions, setAppleHealthEnabled]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchAll(), refreshLive()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll, refreshLive]);

  const handleManageInSettings = useCallback(async () => {
    await openHealthSettings();
  }, []);

  const syncSubtitle = lastRefreshed
    ? `Last synced ${lastRefreshed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : permissionsGranted
      ? 'Not yet synced'
      : 'Not connected';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>APPLE HEALTH</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Master toggle card */}
        <View style={s.masterCard}>
          <View style={s.masterLeft}>
            <View style={s.masterIcon}>
              <Ionicons name="heart" size={18} color={HEALTH_RED} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.masterLabel}>Connect Apple Health</Text>
              <Text style={s.masterSub}>{syncSubtitle}</Text>
            </View>
          </View>
          <Switch
            value={appleHealthEnabled}
            onValueChange={handleMasterToggle}
            trackColor={{ false: '#333', true: HEALTH_RED }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#333"
          />
        </View>

        {appleHealthEnabled && (
          <>
            {/* Live count summary */}
            <View style={s.summaryCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.summaryNumber}>{liveCount}<Text style={s.summaryDenom}> / {totalRowCount}</Text></Text>
                <Text style={s.summarySub}>categories flowing data (last 30 days)</Text>
              </View>
              <TouchableOpacity
                style={s.refreshBtn}
                onPress={handleRefresh}
                disabled={refreshing}
                activeOpacity={0.7}
              >
                {refreshing
                  ? <ActivityIndicator size="small" color={ORANGE} />
                  : <Ionicons name="refresh" size={18} color={ORANGE} />
                }
              </TouchableOpacity>
            </View>

            {/* "Manage in iOS Settings" — the only way to change a declined category */}
            <Pressable onPress={handleManageInSettings} style={s.manageCard}>
              <View style={s.manageIcon}>
                <Ionicons name="settings-outline" size={18} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.manageLabel}>Manage in iOS Settings</Text>
                <Text style={s.manageSub}>
                  iOS won&apos;t let apps re-prompt for declined categories. Toggle them in{' '}
                  <Text style={{ fontWeight: '700' }}>Privacy → Health → Titra</Text>.
                </Text>
              </View>
              <Ionicons name="open-outline" size={16} color={colors.textMuted} />
            </Pressable>

            {/* Grouped category status */}
            {GROUPS.map((group) => {
              const groupLiveCount = group.rows.filter((r) => isRowLive(liveCategories, r.key)).length;
              return (
                <View key={group.title}>
                  <View style={s.groupHeader}>
                    <Text style={s.sectionLabel}>{group.title}</Text>
                    <Text style={s.groupCount}>{groupLiveCount}/{group.rows.length}</Text>
                  </View>
                  <View style={s.card}>
                    {group.rows.map((row, i) => {
                      const live = isRowLive(liveCategories, row.key);
                      return (
                        <View key={String(row.key)}>
                          {i > 0 && <View style={s.divider} />}
                          <View style={s.row}>
                            <View style={[s.rowIconWrap, !live && s.rowIconWrapDormant]}>
                              <Ionicons
                                name={row.icon}
                                size={16}
                                color={live ? ORANGE : colors.textMuted}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[s.rowLabel, !live && s.rowLabelDormant]}>{row.label}</Text>
                              {row.sub ? (
                                <Text style={s.rowSub}>{row.sub}</Text>
                              ) : null}
                            </View>
                            <View style={live ? s.statusPillLive : s.statusPillDormant}>
                              <Text style={live ? s.statusTextLive : s.statusTextDormant}>
                                {live ? 'LIVE' : 'DORMANT'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Footer note */}
            <Text style={s.footerNote}>
              A category is &quot;live&quot; if Apple Health has returned at least one sample in the last 30 days.
              Dormant categories either weren&apos;t granted or have no data — connect a device (scale, watch, CGM)
              or log the metric in the Apple Health app to bring them online.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '700', letterSpacing: 3.5 },

    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 80 },

    /* Master toggle */
    masterCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.glassOverlay,
      borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16,
      borderWidth: 1,
      borderTopColor: w(0.13), borderLeftColor: c.borderSubtle,
      borderRightColor: w(0.03), borderBottomColor: w(0.02),
      marginBottom: 8,
    },
    masterLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    masterIcon: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(255,59,48,0.15)',
      alignItems: 'center', justifyContent: 'center',
    },
    masterLabel: { color: c.textPrimary, fontSize: 16, fontWeight: '700' },
    masterSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },

    /* Summary card */
    summaryCard: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.glassOverlay,
      borderRadius: 16, padding: 16,
      borderWidth: 1,
      borderTopColor: w(0.13), borderLeftColor: c.borderSubtle,
      borderRightColor: w(0.03), borderBottomColor: w(0.02),
      marginTop: 8, marginBottom: 4,
    },
    summaryNumber: {
      color: ORANGE, fontSize: 32, fontWeight: '800', letterSpacing: -1,
    },
    summaryDenom: {
      color: c.textMuted, fontSize: 18, fontWeight: '600',
    },
    summarySub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    refreshBtn: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: 'rgba(255,116,42,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },

    /* Manage in Settings */
    manageCard: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: c.glassOverlay,
      borderRadius: 16, padding: 14,
      borderWidth: 1,
      borderTopColor: w(0.13), borderLeftColor: c.borderSubtle,
      borderRightColor: w(0.03), borderBottomColor: w(0.02),
      marginTop: 8, marginBottom: 4,
    },
    manageIcon: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: 'rgba(255,116,42,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    manageLabel: { color: c.textPrimary, fontSize: 14, fontWeight: '700' },
    manageSub: { color: c.textMuted, fontSize: 11, lineHeight: 15, marginTop: 2 },

    /* Group headers */
    groupHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 20, marginBottom: 6, paddingHorizontal: 4,
    },
    sectionLabel: {
      color: c.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 2,
    },
    groupCount: {
      color: c.textMuted, fontSize: 11, fontWeight: '700',
    },

    /* Category card */
    card: {
      backgroundColor: c.glassOverlay,
      borderRadius: 16, borderWidth: 1,
      borderTopColor: w(0.13), borderLeftColor: c.borderSubtle,
      borderRightColor: w(0.03), borderBottomColor: w(0.02),
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingLeft: 14, paddingRight: 12, paddingVertical: 12,
    },
    rowIconWrap: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: 'rgba(255,116,42,0.12)',
      alignItems: 'center', justifyContent: 'center',
    },
    rowIconWrapDormant: {
      backgroundColor: w(0.05),
    },
    rowLabel: { color: c.textPrimary, fontSize: 14, fontWeight: '600' },
    rowLabelDormant: { color: c.textMuted },
    rowSub: { color: c.textMuted, fontSize: 11, lineHeight: 14, marginTop: 2 },

    statusPillLive: {
      backgroundColor: 'rgba(93,184,123,0.14)',
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    },
    statusPillDormant: {
      backgroundColor: w(0.05),
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4,
    },
    statusTextLive: { color: '#5DB87B', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
    statusTextDormant: { color: c.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },

    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginLeft: 58 },

    footerNote: {
      color: c.textMuted,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 24,
      paddingHorizontal: 4,
    },
  });
};
