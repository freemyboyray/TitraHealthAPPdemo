import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestNotificationPermission } from '@/lib/notifications';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useRemindersStore } from '@/stores/reminders-store';
import { useUserStore } from '@/stores/user-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import type { AppColors } from '@/constants/theme';
import { useMemo } from 'react';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';

const BRAND_LABEL: Record<string, string> = {
  zepbound: 'Zepbound', mounjaro: 'Mounjaro', wegovy: 'Wegovy', ozempic: 'Ozempic',
  trulicity: 'Trulicity', saxenda: 'Saxenda', victoza: 'Victoza', rybelsus: 'Rybelsus',
  oral_wegovy: 'Oral Wegovy', orforglipron: 'Orforglipron',
  compounded_semaglutide: 'Compounded (Sema)', compounded_tirzepatide: 'Compounded (Tirz)',
  compounded_liraglutide: 'Compounded (Lira)', other: 'Other',
};
const SEX_DISPLAY: Record<string, string> = {
  male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say',
};
const ACTIVITY_DISPLAY: Record<string, string> = {
  sedentary: 'Sedentary', light: 'Light', active: 'Active', very_active: 'Very Active',
};

const ORANGE = '#FF742A';

export default function SettingsScreen() {
  const { profile: authProfile, session, signOut } = useUserStore();
  const { profile } = useProfile();
  const { masterEnabled, setMasterEnabled } = useRemindersStore();
  const { isLightMode, toggleLightMode, appleHealthEnabled, setAppleHealthEnabled } = usePreferencesStore();
  const { permissionsGranted, requestPermissions, fetchAll, lastRefreshed } = useHealthKitStore();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const p = profile;
  const medSummary = p ? `${BRAND_LABEL[p.medicationBrand] ?? p.medicationBrand} · ${p.doseMg} mg` : '-';
  const bodySummary = p
    ? p.unitSystem === 'imperial'
      ? `${p.heightFt}'${p.heightIn}" · ${p.weightLbs} lbs`
      : `${p.heightCm} cm · ${p.weightKg} kg`
    : '-';
  const goalsSummary = p ? `Goal: ${p.goalWeightLbs} lbs · ${p.targetWeeklyLossLbs} lbs/wk` : '-';
  const personalSummary = p
    ? `${SEX_DISPLAY[p.sex] ?? p.sex} · Born ${p.birthday?.slice(0,4)} · ${ACTIVITY_DISPLAY[p.activityLevel] ?? p.activityLevel}`
    : '-';

  async function handleMasterToggle(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert(
          'Notifications Blocked',
          'Enable notifications in Settings → TitraHealth → Notifications.',
        );
        return;
      }
    }
    setMasterEnabled(value);
  }

  async function handleAppleHealthToggle(value: boolean) {
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
      fetchAll();
    } else {
      Alert.alert(
        'Permission Required',
        'Please allow access in Settings → Privacy & Security → Health → Titra, then try again.',
        [{ text: 'OK' }],
      );
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => { signOut(); },
      },
    ]);
  }

  const displayName = authProfile?.full_name ?? 'You';
  const displayEmail = session?.user.email ?? '';

  return (
    <TabScreenWrapper>
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>SETTINGS</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{displayName}</Text>
            {displayEmail ? <Text style={s.profileEmail}>{displayEmail}</Text> : null}
          </View>
        </View>

        {/* MY PROFILE section */}
        <Text style={s.sectionLabel}>MY PROFILE</Text>

        <View style={s.card}>
          {/* Medication */}
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/edit-medication')}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <Ionicons name="flask-outline" size={18} color={ORANGE} />
              </View>
              <View>
                <Text style={s.rowLabel}>Medication</Text>
                <Text style={s.rowSub}>{medSummary}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          {/* Body */}
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/edit-body')}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                <Ionicons name="body-outline" size={18} color="#34C759" />
              </View>
              <View>
                <Text style={s.rowLabel}>Body</Text>
                <Text style={s.rowSub}>{bodySummary}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          {/* Goals */}
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/edit-goals')}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(10,132,255,0.15)' }]}>
                <Ionicons name="flag-outline" size={18} color="#0A84FF" />
              </View>
              <View>
                <Text style={s.rowLabel}>Goals</Text>
                <Text style={s.rowSub}>{goalsSummary}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          {/* Personal */}
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/edit-personal')}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <Ionicons name="person-outline" size={18} color={ORANGE} />
              </View>
              <View>
                <Text style={s.rowLabel}>Personal</Text>
                <Text style={s.rowSub}>{personalSummary}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Section label */}
        <Text style={s.sectionLabel}>APPEARANCE</Text>

        {/* Light mode toggle */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <Ionicons name={isLightMode ? 'sunny' : 'moon'} size={18} color={ORANGE} />
              </View>
              <Text style={s.rowLabel}>Light Mode</Text>
            </View>
            <Switch
              value={isLightMode}
              onValueChange={toggleLightMode}
              trackColor={{ false: '#333', true: ORANGE }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#333"
            />
          </View>
        </View>

        {/* Section label */}
        <Text style={s.sectionLabel}>NOTIFICATIONS</Text>

        {/* Reminders row */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <Ionicons name="notifications-outline" size={18} color={ORANGE} />
              </View>
              <Text style={s.rowLabel}>Reminders</Text>
            </View>
            <View style={s.rowRight}>
              <Switch
                value={masterEnabled}
                onValueChange={handleMasterToggle}
                trackColor={{ false: '#333', true: ORANGE }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#333"
              />
              <TouchableOpacity onPress={() => router.push('/settings/reminders')} style={s.chevronBtn}>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section label */}
        <Text style={s.sectionLabel}>INTEGRATIONS</Text>

        {/* Apple Health row */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,59,48,0.15)' }]}>
                <Ionicons name="heart" size={18} color="#FF3B30" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Apple Health</Text>
                {appleHealthEnabled && (
                  <Text style={s.rowSub}>
                    {lastRefreshed
                      ? `Synced ${lastRefreshed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                      : 'Syncing…'}
                  </Text>
                )}
              </View>
            </View>
            <Switch
              value={appleHealthEnabled}
              onValueChange={handleAppleHealthToggle}
              trackColor={{ false: '#333', true: '#FF3B30' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#333"
            />
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 40 }} />

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#FF453A" style={{ marginRight: 8 }} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
    </TabScreenWrapper>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      paddingHorizontal: 20, paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    headerTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '700', letterSpacing: 3.5 },

    scroll: { flex: 1 },
    content: { padding: 16, gap: 8, paddingBottom: 120 },

    profileCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.glassOverlay,
      borderRadius: 16, padding: 16, marginBottom: 8,
      borderWidth: 1,
      borderTopColor: c.border,
      borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle,
      borderBottomColor: c.borderSubtle,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
    },
    avatarLetter: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
    profileName: { color: c.textPrimary, fontSize: 16, fontWeight: '600' },
    profileEmail: { color: c.textSecondary, fontSize: 13, marginTop: 2 },

    sectionLabel: {
      color: c.textMuted, fontSize: 11, fontWeight: '700',
      letterSpacing: 2, marginTop: 8, marginBottom: 4, marginLeft: 4,
    },

    card: {
      backgroundColor: c.glassOverlay,
      borderRadius: 16,
      borderWidth: 1,
      borderTopColor: c.border,
      borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle,
      borderBottomColor: c.borderSubtle,
      overflow: 'hidden',
    },
    cardRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    iconBadge: {
      width: 34, height: 34, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    rowLabel: { color: c.textPrimary, fontSize: 15, fontWeight: '500' },
    rowSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    chevronBtn: { padding: 4 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginHorizontal: 16 },

    signOutBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,69,58,0.1)',
      borderRadius: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: 'rgba(255,69,58,0.2)',
    },
    signOutText: { color: '#FF453A', fontSize: 15, fontWeight: '600' },
  });
}
