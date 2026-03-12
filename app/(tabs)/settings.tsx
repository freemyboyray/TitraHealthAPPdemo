import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestNotificationPermission } from '@/lib/notifications';
import { useRemindersStore } from '@/stores/reminders-store';
import { useUserStore } from '@/stores/user-store';

const ORANGE = '#FF742A';
const BG = '#000000';

export default function SettingsScreen() {
  const { profile, session, signOut } = useUserStore();
  const { masterEnabled, setMasterEnabled } = useRemindersStore();

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

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }

  const displayName = profile?.full_name ?? 'You';
  const displayEmail = session?.user.email ?? '';

  return (
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
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section label */}
        <Text style={s.sectionLabel}>INTEGRATIONS</Text>

        {/* Apple Health row */}
        <View style={s.card}>
          <TouchableOpacity style={s.cardRow} activeOpacity={0.7}>
            <View style={s.rowLeft}>
              <View style={[s.iconBadge, { backgroundColor: 'rgba(255,59,48,0.15)' }]}>
                <Ionicons name="heart-outline" size={18} color="#FF3B30" />
              </View>
              <Text style={s.rowLabel}>Apple Health</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1, minHeight: 40 }} />

        {/* Sign out */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#FF453A" style={{ marginRight: 8 }} />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 3.5 },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 8, paddingBottom: 120 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16, padding: 16, marginBottom: 8,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.13)',
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightColor: 'rgba(255,255,255,0.03)',
    borderBottomColor: 'rgba(255,255,255,0.02)',
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  profileName: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  profileEmail: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 2 },

  sectionLabel: {
    color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: '700',
    letterSpacing: 2, marginTop: 8, marginBottom: 4, marginLeft: 4,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.13)',
    borderLeftColor: 'rgba(255,255,255,0.08)',
    borderRightColor: 'rgba(255,255,255,0.03)',
    borderBottomColor: 'rgba(255,255,255,0.02)',
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
  rowLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  chevronBtn: { padding: 4 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.2)',
  },
  signOutText: { color: '#FF453A', fontSize: 15, fontWeight: '600' },
});
