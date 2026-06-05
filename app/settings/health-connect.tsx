import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { openHealthConnectSettings } from '@/lib/health-connect';
import { ChevronLeft, ExternalLink, Heart, RefreshCw } from 'lucide-react-native';

const HC_BLUE = '#4285F4';

type CategoryRow = { label: string; sub: string };
type Group = { title: string; rows: CategoryRow[] };

const GROUPS: Group[] = [
  {
    title: 'Activity',
    rows: [
      { label: 'Steps', sub: 'Daily step count' },
      { label: 'Active Calories', sub: 'Calories burned during activity' },
    ],
  },
  {
    title: 'Body Measurements',
    rows: [
      { label: 'Weight', sub: 'Body weight (read & write)' },
    ],
  },
  {
    title: 'Vitals',
    rows: [
      { label: 'Heart Rate Variability', sub: 'RMSSD measurement' },
      { label: 'Resting Heart Rate', sub: 'Beats per minute at rest' },
    ],
  },
  {
    title: 'Sleep',
    rows: [
      { label: 'Sleep Sessions', sub: 'Duration and sleep stages' },
    ],
  },
  {
    title: 'Nutrition',
    rows: [
      { label: 'Nutrition', sub: 'Protein, carbs, fat, fiber, calories (read & write)' },
      { label: 'Blood Glucose', sub: 'Blood sugar readings' },
    ],
  },
];

export default function HealthConnectScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { appleHealthEnabled, setAppleHealthEnabled } = usePreferencesStore();
  const { permissionsGranted, lastRefreshed, requestPermissions, fetchAll } = useHealthKitStore();
  const [refreshing, setRefreshing] = useState(false);

  const totalRowCount = GROUPS.reduce((n, g) => n + g.rows.length, 0);

  const handleMasterToggle = useCallback(async (value: boolean) => {
    if (!value) {
      setAppleHealthEnabled(false);
      return;
    }
    const granted = await requestPermissions();
    if (granted) {
      setAppleHealthEnabled(true);
      await fetchAll();
    } else {
      Alert.alert(
        'Health Connect Unavailable',
        'Health Connect could not be initialized. Make sure Health Connect is installed on your device (pre-installed on Android 14+, available from Play Store for older versions).',
        [{ text: 'OK' }],
      );
    }
  }, [fetchAll, requestPermissions, setAppleHealthEnabled]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

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
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>HEALTH CONNECT</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Master toggle card */}
        <View style={s.masterCard}>
          <View style={s.masterLeft}>
            <View style={s.masterIcon}>
              <Heart size={18} color={HC_BLUE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.masterLabel}>Connect Health Connect</Text>
              <Text style={s.masterSub}>{syncSubtitle}</Text>
            </View>
          </View>
          <Switch
            value={appleHealthEnabled}
            onValueChange={handleMasterToggle}
            trackColor={{ false: '#333', true: HC_BLUE }}
            thumbColor="#FFFFFF"
          />
        </View>

        {appleHealthEnabled && (
          <>
            {/* Sync status */}
            <View style={s.summaryCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.summaryNumber}>{totalRowCount}</Text>
                <Text style={s.summarySub}>categories requested</Text>
              </View>
              <TouchableOpacity
                style={s.refreshBtn}
                onPress={handleRefresh}
                disabled={refreshing}
                activeOpacity={0.7}
              >
                {refreshing
                  ? <ActivityIndicator size="small" color={colors.orange} />
                  : <RefreshCw size={18} color={colors.orange} />
                }
              </TouchableOpacity>
            </View>

            {/* Manage in Health Connect */}
            <TouchableOpacity onPress={openHealthConnectSettings} style={s.manageCard} activeOpacity={0.7}>
              <View style={s.manageIcon}>
                <ExternalLink size={18} color={colors.orange} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.manageLabel}>Manage in Health Connect</Text>
                <Text style={s.manageSub}>
                  Open Health Connect to review or change which categories Titra Health can access.
                </Text>
              </View>
              <ChevronLeft size={16} color={colors.textMuted} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>

            {/* Category list */}
            {GROUPS.map((g) => (
              <View key={g.title} style={s.group}>
                <Text style={s.groupTitle}>{g.title}</Text>
                {g.rows.map((row) => (
                  <View key={row.label} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowLabel}>{row.label}</Text>
                      <Text style={s.rowSub}>{row.sub}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}

            {/* Info note */}
            <Text style={s.infoNote}>
              Health Connect permissions can be managed in the Health Connect app on your device.
              Categories not listed here may become available in future updates.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 40 },
  headerTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: c.textSecondary,
    fontFamily: 'System',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  masterLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  masterIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(66,133,244,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterLabel: { fontSize: 17, fontWeight: '600', color: c.textPrimary, fontFamily: 'System' },
  masterSub: { fontSize: 13, color: c.textSecondary, fontFamily: 'System', marginTop: 2 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  summaryNumber: { fontSize: 28, fontWeight: '800', color: c.textPrimary, fontFamily: 'System' },
  summarySub: { fontSize: 13, color: c.textSecondary, fontFamily: 'System', marginTop: 2 },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  manageIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageLabel: { fontSize: 15, fontWeight: '600', color: c.textPrimary, fontFamily: 'System' },
  manageSub: { fontSize: 13, color: c.textSecondary, fontFamily: 'System', lineHeight: 18, marginTop: 2 },
  group: { marginBottom: 20 },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: c.textSecondary,
    fontFamily: 'System',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
  },
  rowLabel: { fontSize: 15, fontWeight: '600', color: c.textPrimary, fontFamily: 'System' },
  rowSub: { fontSize: 13, color: c.textSecondary, fontFamily: 'System', marginTop: 2 },
  infoNote: {
    fontSize: 13,
    color: c.textMuted,
    fontFamily: 'System',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
  },
});
