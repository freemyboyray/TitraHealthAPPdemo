import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  Alert,
  Image,
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
import { HEALTH_SERVICE_NAME } from '@/lib/health-service';
import type { AppColors } from '@/constants/theme';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { openHealthSettings } from '@/lib/healthkit';
import {
  Activity,
  ChevronLeft,
  ExternalLink,
  HeartPulse,
  Scale,
  Settings,
  Utensils,
  type LucideIcon,
} from 'lucide-react-native';

const APPLE_HEALTH_LOGO = require('@/assets/images/apple-health-icon.png');

// The handful of things syncing actually does for the user. We surface the
// value, not the raw 30-category plumbing behind it.
type Benefit = { icon: LucideIcon; title: string; desc: string };
const BENEFITS: Benefit[] = [
  { icon: HeartPulse, title: 'Heart rate & recovery', desc: 'See how GLP-1s shift your HRV and resting heart rate.' },
  { icon: Scale,      title: 'Weight, hands-free',     desc: 'Smart-scale readings log themselves.' },
  { icon: Activity,   title: 'Activity & sleep',       desc: 'Steps, workouts, and sleep sync from your watch.' },
  { icon: Utensils,   title: 'Nutrition & hydration',  desc: 'Protein and water carry over from your food apps.' },
];

export default function AppleHealthSettingsScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { appleHealthEnabled, setAppleHealthEnabled } = usePreferencesStore();
  const { permissionsGranted, lastRefreshed, requestPermissions, fetchAll } = useHealthKitStore();

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

  const handleManageInSettings = useCallback(async () => {
    await openHealthSettings();
  }, []);

  const syncSubtitle = appleHealthEnabled
    ? lastRefreshed
      ? `Last synced ${lastRefreshed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : permissionsGranted ? 'Syncing in the background' : 'Connecting…'
    : 'Sync your health data automatically';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{HEALTH_SERVICE_NAME}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Master toggle */}
        <View style={s.masterCard}>
          <View style={s.masterLeft}>
            <Image source={APPLE_HEALTH_LOGO} style={s.masterIcon} resizeMode="contain" />

            <View style={{ flex: 1 }}>
              <Text style={s.masterLabel}>Connect {HEALTH_SERVICE_NAME}</Text>
              <Text style={s.masterSub}>{syncSubtitle}</Text>
            </View>
          </View>
          <Switch
            value={appleHealthEnabled}
            onValueChange={handleMasterToggle}
            trackColor={{ false: colors.isDark ? '#333' : '#D1D1D6', true: colors.orange }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={colors.isDark ? '#333' : '#D1D1D6'}
          />
        </View>

        {/* Why connect / what you're getting */}
        <Text style={s.sectionTitle}>
          {appleHealthEnabled ? 'What you’re getting' : 'Why connect'}
        </Text>
        <View style={s.card}>
          {BENEFITS.map((b, i) => {
            const Icon = b.icon;
            return (
              <View key={b.title}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.row}>
                  <Icon size={18} color={colors.textSecondary} style={s.rowIcon} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>{b.title}</Text>
                    <Text style={s.rowSub}>{b.desc}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Manage declined categories (only relevant once connected) */}
        {appleHealthEnabled && (
          <Pressable onPress={handleManageInSettings} style={s.manageRow}>
            <Settings size={18} color={colors.textSecondary} style={s.rowIcon} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>Manage in iOS Settings</Text>
              <Text style={s.rowSub}>Choose exactly what {HEALTH_SERVICE_NAME} shares.</Text>
            </View>
            <ExternalLink size={16} color={colors.textMuted} />
          </Pressable>
        )}

        <Text style={s.footerNote}>
          Your health data stays private to your account and is never sold.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700' },

    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 80 },

    /* Master toggle (no outline, black & white heart) */
    masterCard: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: c.surface,
      borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16,
      marginBottom: 24,
    },
    masterLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    masterIcon: {
      width: 32, height: 32,
    },
    masterLabel: { color: c.textPrimary, fontSize: 18, fontWeight: '700' },
    masterSub: { color: c.textMuted, fontSize: 14, marginTop: 2 },

    /* Benefits */
    sectionTitle: {
      color: c.textPrimary, fontSize: 16, fontWeight: '700',
      marginBottom: 10, marginLeft: 4,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingHorizontal: 16, paddingVertical: 14,
    },
    rowIcon: { width: 22, textAlign: 'center' },
    rowLabel: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
    rowSub: { color: c.textMuted, fontSize: 13, lineHeight: 17, marginTop: 2 },

    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginLeft: 52 },

    /* Manage row */
    manageRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingHorizontal: 16, paddingVertical: 14,
      marginTop: 12,
    },

    footerNote: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 24,
      paddingHorizontal: 4,
    },
  });
};
