import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import type { AppColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF742A';

const CONSENT_TEXT =
  'I consent to my clinician reviewing the health data I log in TitraHealth.';

export default function RtmLinkScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile, updateProfile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);

  const linked = profile?.rtmEnabled ?? false;
  const clinicianId = profile?.rtmClinicianId ?? null;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clinicianName, setClinicianName] = useState<string | null>(null);
  const [linkedAt, setLinkedAt] = useState<string | null>(null);

  // Hydrate clinician name + linked timestamp from supabase when linked
  useEffect(() => {
    if (!linked || !clinicianId) {
      setClinicianName(null);
      setLinkedAt(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: clin }, { data: { user } }] = await Promise.all([
        supabase.from('clinicians').select('display_name, practice_name').eq('id', clinicianId).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      if (cancelled) return;
      if (clin) setClinicianName(clin.practice_name ? `${clin.display_name} · ${clin.practice_name}` : clin.display_name);
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('rtm_linked_at')
          .eq('id', user.id)
          .maybeSingle();
        if (!cancelled && prof?.rtm_linked_at) setLinkedAt(prof.rtm_linked_at);
      }
    })();
    return () => { cancelled = true; };
  }, [linked, clinicianId]);

  async function handleLink() {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Enter a provider code.');
      return;
    }
    setBusy(true);
    const { data, error: lookupErr } = await supabase
      .from('clinicians')
      .select('id, display_name')
      .eq('code', trimmed)
      .eq('active', true)
      .maybeSingle();

    if (lookupErr || !data) {
      setBusy(false);
      setError("Code not found. Double-check with your clinician.");
      return;
    }

    await updateProfile({
      rtmEnabled: true,
      rtmClinicianId: data.id,
      rtmConsentText: CONSENT_TEXT,
    });
    setBusy(false);
    setCode('');
  }

  function handleUnlink() {
    Alert.alert(
      'Unlink Clinician',
      'You will no longer be able to generate the Provider Report. You can re-link any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            await updateProfile({
              rtmEnabled: false,
              rtmClinicianId: null,
              rtmConsentText: null,
            });
            setBusy(false);
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Clinician</Text>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={s.intro}>
            Linking with your clinician unlocks the Provider Report — a clinical
            summary you can generate and share at appointments. Your clinician
            will see the health data you log in TitraHealth.
          </Text>

          {linked ? (
            <View style={s.card}>
              <View style={s.linkedHeader}>
                <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                  <Ionicons name="medkit" size={20} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.linkedTitle}>{clinicianName ?? 'Linked'}</Text>
                  <Text style={s.linkedSub}>Provider Report unlocked</Text>
                </View>
              </View>
              {linkedAt && (
                <Text style={s.linkedDate}>
                  Linked on {new Date(linkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              )}
              <Pressable
                style={[s.btn, s.btnDestructive, busy && s.btnDisabled]}
                onPress={handleUnlink}
                disabled={busy}
              >
                <Text style={s.btnDestructiveText}>Unlink Clinician</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.codeLabel}>PROVIDER CODE</Text>
              <TextInput
                style={s.codeInput}
                value={code}
                onChangeText={(t) => { setCode(t); setError(null); }}
                placeholder="e.g. TITRA-SMITH-A4F2"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
              />
              {error && <Text style={s.error}>{error}</Text>}
              <Text style={s.consent}>{CONSENT_TEXT}</Text>
              <Pressable
                style={[s.btn, s.btnPrimary, (busy || !code.trim()) && s.btnDisabled]}
                onPress={handleLink}
                disabled={busy || !code.trim()}
              >
                <Text style={s.btnPrimaryText}>{busy ? 'Linking…' : 'Link Clinician'}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borderSubtle,
    },
    backBtn: { padding: 8, width: 36, alignItems: 'center' },
    headerTitle: { flex: 1, color: c.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' },

    content: { padding: 20, paddingBottom: 60 },
    intro: { color: c.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: 20 },

    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
      backgroundColor: 'rgba(255,255,255,0.04)',
      padding: 18,
    },

    iconBadge: {
      width: 40, height: 40, borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
    },

    // Linked state
    linkedHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    linkedTitle: { color: c.textPrimary, fontSize: 17, fontWeight: '700' },
    linkedSub: { color: ORANGE, fontSize: 12, fontWeight: '600', marginTop: 2, letterSpacing: 0.5 },
    linkedDate: { color: c.textMuted, fontSize: 12, marginBottom: 18 },

    // Code input state
    codeLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: c.textMuted,
      marginBottom: 8,
    },
    codeInput: {
      height: 56,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      backgroundColor: '#000000',
      paddingHorizontal: 18,
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    },
    error: { marginTop: 10, color: '#FF453A', fontSize: 13, fontWeight: '600' },
    consent: { marginTop: 14, fontSize: 12, lineHeight: 17, color: c.textMuted },

    btn: {
      marginTop: 18,
      height: 50,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: ORANGE },
    btnPrimaryText: { color: '#000000', fontSize: 15, fontWeight: '700' },
    btnDestructive: { backgroundColor: 'rgba(255,69,58,0.12)', borderWidth: 1, borderColor: 'rgba(255,69,58,0.4)' },
    btnDestructiveText: { color: '#FF453A', fontSize: 15, fontWeight: '700' },
    btnDisabled: { opacity: 0.4 },
  });
}
