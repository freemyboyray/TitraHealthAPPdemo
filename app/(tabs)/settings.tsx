import { ScrollTitle } from '@/components/ui/scroll-title';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePreferencesStore } from '@/stores/preferences-store';
import { useRemindersStore } from '@/stores/reminders-store';
import { useUserStore } from '@/stores/user-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { useLogStore } from '@/stores/log-store';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { isOnTreatment } from '@/constants/user-profile';
import type { AppColors } from '@/constants/theme';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput } from 'react-native';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { supabase } from '@/lib/supabase';

const BRAND_LABEL: Record<string, string> = {
  zepbound: 'Zepbound', mounjaro: 'Mounjaro', wegovy: 'Wegovy', ozempic: 'Ozempic',
  trulicity: 'Trulicity', saxenda: 'Saxenda', victoza: 'Victoza', rybelsus: 'Rybelsus',
  oral_wegovy: 'Oral Wegovy', orforglipron: 'Foundayo',
  compounded_semaglutide: 'Compounded (Sema)', compounded_tirzepatide: 'Compounded (Tirz)',
  compounded_liraglutide: 'Compounded (Lira)',
  other_injection: 'Other injection', other_oral: 'Other oral', other: 'Other',
};

const SEX_DISPLAY: Record<string, string> = {
  male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say',
};
const ACTIVITY_DISPLAY: Record<string, string> = {
  sedentary: 'Sedentary', light: 'Light', active: 'Active', very_active: 'Very Active',
};


function computeNextDose(lastDate: string | undefined, freqDays: number | undefined): string | null {
  if (!lastDate || !freqDays) return null;
  const last = new Date(lastDate + 'T12:00:00');
  const next = new Date(last.getTime() + freqDays * 86400000);
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  if (next.getTime() < today.getTime()) return 'Overdue';
  if (next.toDateString() === today.toDateString()) return 'Today';

  const diff = Math.ceil((next.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return next.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SettingsScreen() {
  const { profile: authProfile, session, signOut, deleteAccount } = useUserStore();
  const [deleting, setDeleting] = useState(false);
  const { profile, reloadProfile } = useProfile();
  const { masterEnabled } = useRemindersStore();
  const { themeMode, setThemeMode, appleHealthEnabled, headerStyle, setHeaderStyle, aiDataConsent, setAiDataConsent, foodDbConsent, setFoodDbConsent } = usePreferencesStore();
  const { lastRefreshed, liveCategories } = useHealthKitStore();
  const { colors } = useAppTheme();
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const s = useMemo(() => createStyles(colors), [colors]);

  const p = profile;

  // Treatment summary
  const brandName = p ? (BRAND_LABEL[p.medicationBrand] ?? p.medicationBrand) : '-';
  const freqLabel = p
    ? p.injectionFrequencyDays === 1 ? 'daily'
    : p.injectionFrequencyDays === 7 ? 'weekly'
    : p.injectionFrequencyDays === 14 ? 'biweekly'
    : `every ${p.injectionFrequencyDays}d`
    : '';
  // If there's a pending transition, show that as the next dose instead of the stale cycle
  const hasPendingTransition = p?.pendingFirstDoseDate != null;
  const nextDose = hasPendingTransition
    ? (() => {
        const d = new Date(p!.pendingFirstDoseDate! + 'T12:00:00');
        const today = new Date(); today.setHours(12, 0, 0, 0);
        if (d.toDateString() === today.toDateString()) return 'Today';
        const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
        if (diff === 1) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      })()
    : p ? computeNextDose(p.lastInjectionDate, p.injectionFrequencyDays) : null;

  const pendingBrandName = p?.pendingMedicationBrand ? (BRAND_LABEL[p.pendingMedicationBrand] ?? p.pendingMedicationBrand) : null;
  const onTreatment = isOnTreatment(p);
  const treatmentLine1 = !p ? '-' : onTreatment ? `${brandName} ${p.doseMg} mg · ${freqLabel}` : 'Not on medication';
  const treatmentLine2 = !onTreatment
    ? 'Tap to start or resume a GLP-1'
    : hasPendingTransition
      ? `Switching to ${pendingBrandName} ${p!.pendingDoseMg}mg · Next dose: ${nextDose}`
      : nextDose ? `Next dose: ${nextDose}` : '';

  // Body & Goals summary — prefer latest weight log over profile
  const latestWeightLog = useLogStore((s) => s.weightLogs[0]);
  const displayWeightLbs = latestWeightLog?.weight_lbs ?? p?.weightLbs ?? 0;
  const displayWeightKg = Math.round(displayWeightLbs * 0.453592 * 10) / 10;
  const bodyLine = p
    ? p.unitSystem === 'imperial'
      ? `${p.heightFt}'${p.heightIn}" · ${displayWeightLbs} lbs`
      : `${p.heightCm} cm · ${displayWeightKg} kg`
    : '-';
  const goalsLine = p ? `Goal: ${p.goalWeightLbs} lbs · ${p.targetWeeklyLossLbs} lbs/wk` : '';


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

  function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all health data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'All your medication logs, weight history, food logs, and health data will be permanently erased.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete My Account',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await deleteAccount();
                    } catch (e: any) {
                      setDeleting(false);
                      Alert.alert('Error', e.message ?? 'Failed to delete account. Please try again.');
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }

  const displayName = authProfile?.username ?? 'You';
  const displayEmail = session?.user.email ?? '';
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(displayName);
  const [savingName, setSavingName] = useState(false);

  // Keep nameInput in sync when profile reloads (e.g. after save)
  useEffect(() => { if (!editingName) setNameInput(displayName); }, [displayName, editingName]);

  const saveUsername = async () => {
    if (savingName) return;
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === displayName) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('profiles').update({ username: trimmed }).eq('id', user.id);
      if (error) console.warn('settings: username update failed:', error);
      else await useUserStore.getState().loadProfile();
    }
    setSavingName(false);
    setEditingName(false);
  };

  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <TabScreenWrapper>
    <View style={s.safe}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} onScroll={(e) => scrollY.setValue(e.nativeEvent.contentOffset.y)} scrollEventThrottle={16}>
          <View style={s.header}>
            <Text style={s.headerTitle}>SETTINGS</Text>
          </View>

        {/* Profile card */}
        <Pressable style={s.profileCard} onPress={() => { setNameInput(displayName); setEditingName(true); }} accessibilityLabel="Edit display name" accessibilityRole="button">
          <View style={s.avatar}>
            <Text style={s.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {editingName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={[s.profileName, { flex: 1, borderBottomWidth: 1, borderBottomColor: colors.orange, paddingBottom: 4 }]}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveUsername}
                  onBlur={saveUsername}
                  accessibilityLabel="Display name"
                />
              </View>
            ) : (
              <Text style={s.profileName}>{displayName}</Text>
            )}
            {displayEmail ? <Text style={s.profileEmail}>{displayEmail}</Text> : null}
          </View>
          {!editingName && <IconSymbol name="pencil" size={16} color={colors.textMuted} />}
        </Pressable>

        {/* ── Categories ── */}
        <View style={s.card}>
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/plan' as any)} accessibilityLabel="My Plan" accessibilityRole="button">
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <IconSymbol name="syringe.fill" size={18} color={colors.orange} />
              </View>
              <Text style={s.rowLabel}>My Plan</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          <Pressable style={s.cardRow} onPress={() => router.push('/upgrade' as any)} accessibilityLabel="Subscription" accessibilityRole="button">
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <IconSymbol name="bolt.fill" size={18} color={colors.orange} />
              </View>
              <Text style={s.rowLabel}>Subscription</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          <Pressable style={s.cardRow} onPress={() => router.push('/settings/referrals' as any)} accessibilityLabel="Refer friends" accessibilityRole="button">
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                <IconSymbol name="gift.fill" size={18} color="#34C759" />
              </View>
              <Text style={s.rowLabel}>Refer Friends</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={s.card}>
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/preferences' as any)} accessibilityLabel="Preferences" accessibilityRole="button">
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <IconSymbol name="gearshape.fill" size={18} color={colors.orange} />
              </View>
              <Text style={s.rowLabel}>Preferences</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          <Pressable style={s.cardRow} onPress={() => router.push('/settings/privacy' as any)} accessibilityLabel="Privacy & Data" accessibilityRole="button">
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(10,132,255,0.15)' }]}>
                <IconSymbol name="hand.raised.fill" size={18} color="#0A84FF" />
              </View>
              <Text style={s.rowLabel}>Privacy & Data</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          <Pressable style={s.cardRow} onPress={() => router.push('/settings/support' as any)} accessibilityLabel="Help & Support" accessibilityRole="button">
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(50,173,230,0.15)' }]}>
                <IconSymbol name="questionmark.circle.fill" size={18} color="#32ADE6" />
              </View>
              <Text style={s.rowLabel}>Help & Support</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          <Pressable style={s.cardRow} onPress={() => router.push('/settings/legal' as any)} accessibilityLabel="Legal" accessibilityRole="button">
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(88,86,214,0.15)' }]}>
                <IconSymbol name="doc.text.fill" size={18} color="#5856D6" />
              </View>
              <Text style={s.rowLabel}>Legal</Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={s.card}>
          <Pressable style={s.cardRow} onPress={handleSignOut} accessibilityLabel="Sign out" accessibilityRole="button">
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,69,58,0.15)' }]}>
                <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="#FF453A" />
              </View>
              <Text style={s.rowLabel}>Sign Out</Text>
            </View>
          </Pressable>

          <View style={s.divider} />

          <Pressable style={s.cardRow} onPress={handleDeleteAccount} disabled={deleting} accessibilityLabel="Delete account" accessibilityRole="button">
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,69,58,0.15)' }]}>
                <IconSymbol name="trash.fill" size={18} color="#FF453A" />
              </View>
              <Text style={[s.rowLabel, { color: '#FF453A' }]}>{deleting ? 'Deleting...' : 'Delete Account'}</Text>
            </View>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />

        </ScrollView>
      </SafeAreaView>
      <ScrollTitle title="Settings" scrollY={scrollY} />
    </View>
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
    headerTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 3.5 },

    scroll: { flex: 1 },
    content: { padding: 16, gap: 8, paddingBottom: 120 },

    profileCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: c.surface,
      borderRadius: 16, padding: 16, marginBottom: 8,
      borderWidth: 1,
      borderTopColor: c.border,
      borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle,
      borderBottomColor: c.borderSubtle,
    },
    avatar: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center',
    },
    avatarLetter: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
    profileName: { color: c.textPrimary, fontSize: 18, fontWeight: '600' },
    profileEmail: { color: c.textSecondary, fontSize: 15, marginTop: 2 },

    sectionLabel: {
      color: c.textMuted, fontSize: 11, fontWeight: '600',
      letterSpacing: 1, marginTop: 12, marginBottom: 6, marginLeft: 4,
      textTransform: 'uppercase',
    },

    card: {
      backgroundColor: c.surface,
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
      width: 36, height: 36, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    rowLabel: { color: c.textPrimary, fontSize: 17, fontWeight: '600', lineHeight: 22 },
    rowValue: { color: c.textSecondary, fontSize: 15, fontWeight: '500' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginLeft: 64, marginRight: 16 },

  });
}
