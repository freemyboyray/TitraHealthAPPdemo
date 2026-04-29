import { GradientBackground } from '@/components/ui/gradient-background';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
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
import { useEffect, useMemo, useState } from 'react';
import { TextInput } from 'react-native';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { supabase } from '@/lib/supabase';

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
  const { profile } = useProfile();
  const { masterEnabled } = useRemindersStore();
  const { themeMode, setThemeMode, appleHealthEnabled, useGradientHeader, setUseGradientHeader } = usePreferencesStore();
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

  return (
    <TabScreenWrapper>
    <View style={s.safe}>
      <GradientBackground />
      <SafeAreaView edges={['top']} style={{ zIndex: 1 }}>
        <View style={s.header}>
          <Text style={s.headerTitle}>SETTINGS</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Profile card */}
        <Pressable style={s.profileCard} onPress={() => { setNameInput(displayName); setEditingName(true); }}>
          <View style={s.avatar}>
            <Text style={s.avatarLetter}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {editingName ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={[s.profileName, { flex: 1, borderBottomWidth: 1, borderBottomColor: ORANGE, paddingBottom: 4 }]}
                  value={nameInput}
                  onChangeText={setNameInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={saveUsername}
                  onBlur={saveUsername}
                />
              </View>
            ) : (
              <Text style={s.profileName}>{displayName}</Text>
            )}
            {displayEmail ? <Text style={s.profileEmail}>{displayEmail}</Text> : null}
          </View>
          {!editingName && <IconSymbol name="pencil" size={16} color={colors.textMuted} />}
        </Pressable>

        {/* SUBSCRIPTION */}
        <Pressable style={[s.card, { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20 }]} onPress={() => router.push('/settings/subscription' as any)}>
          <View style={s.rowLeft}>
            <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
              <IconSymbol name="bolt.fill" size={18} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{isPremium ? 'Titra Pro' : 'Upgrade to Pro'}</Text>
              <Text style={s.rowSub}>{isPremium ? 'Manage your subscription' : '$4.99/month \u00b7 7-day free trial'}</Text>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
        </Pressable>

        {/* MY PLAN section */}
        <Text style={s.sectionLabel}>MY PLAN</Text>

        <View style={s.card}>
          {/* Treatment Plan */}
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/edit-treatment')}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <IconSymbol name="syringe.fill" size={18} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Treatment Plan</Text>
                <Text style={s.rowSub}>{treatmentLine1}</Text>
                {treatmentLine2 ? <Text style={s.rowSub}>{treatmentLine2}</Text> : null}
              </View>
            </View>
            <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          {/* Body & Goals */}
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/edit-profile')}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(10,132,255,0.15)' }]}>
                <IconSymbol name="figure.stand" size={18} color="#0A84FF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Body & Goals</Text>
                <Text style={s.rowSub}>{bodyLine}</Text>
                {goalsLine ? <Text style={s.rowSub}>{goalsLine}</Text> : null}
              </View>
            </View>
            <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
          </Pressable>

          {isPremium && (
            <>
              <View style={s.divider} />
              <Pressable style={s.cardRow} onPress={() => router.push('/settings/export-report' as any)}>
                <View style={s.rowLeft}>
                  <View style={[s.iconBadge, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                    <IconSymbol name="doc.text.fill" size={18} color="#34C759" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowLabel}>Provider Report</Text>
                    <Text style={s.rowSub}>Export PDF for your doctor</Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
              </Pressable>
            </>
          )}
        </View>

        {/* PREFERENCES section */}
        <Text style={s.sectionLabel}>PREFERENCES</Text>

        <View style={s.card}>
          {/* Appearance */}
          <View style={s.cardRow}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <IconSymbol name={themeMode === 'light' ? 'sun.max.fill' : themeMode === 'dark' ? 'moon.fill' : 'circle.lefthalf.filled'} size={18} color={ORANGE} />
              </View>
              <Text style={s.rowLabel}>Appearance</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setThemeMode(mode)}
                style={{
                  flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10,
                  backgroundColor: themeMode === mode ? ORANGE : 'transparent',
                }}
              >
                <Text style={{
                  fontSize: 13, fontWeight: '600',
                  color: themeMode === mode ? '#FFF' : colors.textSecondary,
                }}>
                  {mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={s.divider} />

          {/* Gradient Header */}
          <View style={s.cardRow}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <IconSymbol name="paintbrush.fill" size={18} color={ORANGE} />
              </View>
              <Text style={s.rowLabel}>Gradient Header</Text>
            </View>
            <Switch
              value={useGradientHeader}
              onValueChange={setUseGradientHeader}
              trackColor={{ false: colors.isDark ? '#333' : '#DDD', true: ORANGE }}
            />
          </View>

          <View style={s.divider} />

          {/* Reminders */}
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/reminders')}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                <IconSymbol name="bell.fill" size={18} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Reminders</Text>
                <Text style={s.rowSub}>{masterEnabled ? 'On' : 'Off'}</Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* CONNECTIONS section */}
        <Text style={s.sectionLabel}>CONNECTIONS</Text>

        <View style={s.card}>
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/apple-health' as any)}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,59,48,0.15)' }]}>
                <IconSymbol name="heart.fill" size={18} color="#FF3B30" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>Apple Health</Text>
                <Text style={s.rowSub}>
                  {appleHealthEnabled
                    ? `${liveCategories.size} categories live${lastRefreshed ? ` · Synced ${lastRefreshed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}`
                    : 'Not connected'}
                </Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* LEGAL & ACCOUNT section */}
        <Text style={s.sectionLabel}>LEGAL & ACCOUNT</Text>

        <View style={s.card}>
          <Pressable style={s.cardRow} onPress={() => router.push('/settings/legal' as any)}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(88,86,214,0.15)' }]}>
                <IconSymbol name="doc.text.fill" size={18} color="#5856D6" />
              </View>
              <Text style={s.rowLabel}>Terms & Privacy</Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
          </Pressable>

          <View style={s.divider} />

          <Pressable
            style={s.cardRow}
            onPress={handleDeleteAccount}
          >
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,69,58,0.15)' }]}>
                <IconSymbol name="trash.fill" size={18} color="#FF453A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.rowLabel, { color: '#FF453A' }]}>Delete Account</Text>
                <Text style={s.rowSub}>Permanently delete all your data</Text>
              </View>
            </View>
            <IconSymbol name="chevron.right" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={{ flex: 1, minHeight: 40 }} />

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <IconSymbol name="rectangle.portrait.and.arrow.right" size={18} color="#FF453A" style={{ marginRight: 8 }} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* Delete account */}
        <TouchableOpacity
          style={s.deleteBtn}
          onPress={handleDeleteAccount}
          activeOpacity={0.8}
          disabled={deleting}
        >
          <IconSymbol name="trash.fill" size={18} color="#FF453A" style={{ marginRight: 8 }} />
          <Text style={s.signOutText}>{deleting ? 'Deleting...' : 'Delete Account'}</Text>
        </TouchableOpacity>

      </ScrollView>
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
    profileName: { color: c.textPrimary, fontSize: 18, fontWeight: '600' },
    profileEmail: { color: c.textSecondary, fontSize: 15, marginTop: 2 },

    sectionLabel: {
      color: c.textMuted, fontSize: 11, fontWeight: '600',
      letterSpacing: 1, marginTop: 12, marginBottom: 6, marginLeft: 4,
      textTransform: 'uppercase',
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
      width: 36, height: 36, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },
    rowLabel: { color: c.textPrimary, fontSize: 17, fontWeight: '600', lineHeight: 22 },
    rowSub: { color: c.textSecondary, fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 2 },
    chevronBtn: { padding: 4 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginLeft: 64, marginRight: 16 },

    signOutBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(255,69,58,0.1)',
      borderRadius: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: 'rgba(255,69,58,0.2)',
    },
    signOutText: { color: '#FF453A', fontSize: 17, fontWeight: '600' },
    deleteBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      paddingVertical: 14, marginTop: 12,
    },
  });
}
