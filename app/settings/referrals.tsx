import { IconSymbol } from '@/components/ui/icon-symbol';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useSubscriptionStore } from '@/stores/subscription-store';

const NEW_ACCOUNT_WINDOW_DAYS = 7;

type ReferralRow = { status: string };

export default function ReferralsScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const isPremium = useSubscriptionStore((st) => st.isPremium);

  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [eligibleToRedeem, setEligibleToRedeem] = useState(false);
  const [loading, setLoading] = useState(true);

  const [redeemInput, setRedeemInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [justApplied, setJustApplied] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const [codeRes, refRes, profileRes] = await Promise.all([
      supabase.rpc('get_or_create_referral_code'),
      supabase.from('referrals').select('status').eq('referrer_id', user.id),
      supabase.from('profiles').select('created_at').eq('id', user.id).single(),
    ]);

    setCode((codeRes.data as string | null) ?? null);
    setReferrals((refRes.data as ReferralRow[] | null) ?? []);

    // Redeem entry shows only for genuinely new, not-yet-premium accounts.
    const createdAt = profileRes.data?.created_at
      ? new Date(profileRes.data.created_at as string).getTime()
      : 0;
    const ageDays = createdAt ? (Date.now() - createdAt) / 86_400_000 : Infinity;
    setEligibleToRedeem(ageDays < NEW_ACCOUNT_WINDOW_DAYS && !isPremium);

    setLoading(false);
  }, [isPremium]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const earned = referrals.filter((r) => r.status === 'rewarded' || r.status === 'qualified').length;

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message:
          `Join me on Titra, the GLP-1 companion that tracks your medication, food, and progress. ` +
          `Use my code ${code} and we'll each get a free month of Titra Pro when you subscribe.`,
      });
    } catch {
      /* user dismissed share sheet */
    }
  };

  const handleRedeem = async () => {
    const trimmed = redeemInput.trim();
    if (!trimmed || applying) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('redeem-referral', {
        body: { code: trimmed },
      });
      if (error || !data?.success) {
        const message =
          (data as { error?: string } | null)?.error ??
          "We couldn't apply that code.";
        Alert.alert('Referral code', message);
        return;
      }
      setJustApplied(true);
      setEligibleToRedeem(false);
      setRedeemInput('');
      Alert.alert(
        'Code applied',
        "You're all set. You and your friend will each get a free month of Titra Pro once you subscribe.",
      );
    } catch {
      Alert.alert('Error', 'Could not apply that code right now. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const statusLine = (status: string): string | null => {
    switch (status) {
      case 'pending':
        return 'A friend joined, waiting for them to start their free trial';
      case 'trialing':
        return 'A friend is on their free trial, your free month unlocks when their subscription begins';
      case 'qualified':
      case 'rewarded':
        return 'A friend subscribed, free month earned!';
      default:
        return null; // void / unknown — hide
    }
  };
  const visibleReferrals = referrals.filter((r) => statusLine(r.status) !== null);

  return (
    <View style={s.safe}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
            <IconSymbol name="chevron.left" size={22} color={colors.orange} />
          </Pressable>
          <Text style={s.headerTitle}>Referrals</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.textMuted} />
          ) : (
            <>
              {/* Redeem (new accounts only) */}
              {eligibleToRedeem && !justApplied && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>Have a referral code?</Text>
                  <Text style={s.cardSubtitle}>
                    Enter a friend’s code. You’ll both get a free month of Titra Pro when you subscribe.
                  </Text>
                  <View style={s.redeemRow}>
                    <TextInput
                      style={s.input}
                      placeholder="TITRA-XXXXXX"
                      placeholderTextColor={colors.textMuted}
                      value={redeemInput}
                      onChangeText={(t) => setRedeemInput(t.slice(0, 20))}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!applying}
                      maxLength={20}
                    />
                    <TouchableOpacity
                      style={[s.redeemBtn, (!redeemInput.trim() || applying) && { opacity: 0.4 }]}
                      onPress={handleRedeem}
                      disabled={!redeemInput.trim() || applying}
                    >
                      <Text style={s.redeemBtnText}>{applying ? '…' : 'Apply'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Invite */}
              <View style={s.card}>
                <Text style={s.cardTitle}>Invite friends</Text>
                <Text style={s.cardSubtitle}>
                  Give a month, get a month. When a friend you invite subscribes, you both get a free month of
                  Titra Pro.
                </Text>

                <View style={s.codePill}>
                  <Text style={s.codeText}>{code ?? '—'}</Text>
                </View>

                <TouchableOpacity style={s.shareBtn} onPress={handleShare} disabled={!code}>
                  <IconSymbol name="square.and.arrow.up" size={18} color="#FFFFFF" />
                  <Text style={s.shareBtnText}>Share your code</Text>
                </TouchableOpacity>

                {earned > 0 && (
                  <Text style={s.earnedText}>
                    {earned} free {earned === 1 ? 'month' : 'months'} earned
                  </Text>
                )}
              </View>

              {/* How it works */}
              <View style={s.card}>
                <Text style={s.cardTitle}>How it works</Text>
                {[
                  'Share your code. Your friend enters it when they sign up, or later from their settings.',
                  'They subscribe to Titra Pro. A free trial alone does not count yet, the month is earned once their paid subscription begins.',
                  'You each get one additional month of Pro inside the app. If you are already subscribed it is added on and starts when your current period ends, so the full month always counts. It unlocks automatically, nothing to claim.',
                ].map((step, i) => (
                  <View key={i} style={s.stepRow}>
                    <View style={s.stepNum}>
                      <Text style={s.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={s.stepText}>{step}</Text>
                  </View>
                ))}
              </View>

              {/* Status */}
              <View style={s.card}>
                <Text style={s.cardTitle}>Your referrals</Text>
                {visibleReferrals.length === 0 ? (
                  <Text style={s.emptyText}>No referrals yet. Share your code to get started.</Text>
                ) : (
                  visibleReferrals.map((r, i) => {
                    const earnedRow = r.status === 'rewarded' || r.status === 'qualified';
                    return (
                      <View key={i} style={s.statusRow}>
                        <View style={[s.statusDot, { backgroundColor: earnedRow ? '#34C759' : colors.orange }]} />
                        <Text style={s.statusText}>{statusLine(r.status)}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              <Text style={s.disclaimer}>
                A referral month is free Titra Pro access inside the app, not a refund or a discount on your
                bill. If you are not subscribed, it starts right away. If you are already subscribed, it is
                saved and starts automatically once your current subscription ends, so you are never charged
                for that month. Your App Store subscription is never changed or paused.
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    content: { padding: 16, paddingBottom: 60, gap: 12 },

    card: {
      backgroundColor: c.surface, borderRadius: 16, padding: 16,
      borderWidth: 1, borderTopColor: c.border, borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle, borderBottomColor: c.borderSubtle,
    },
    cardTitle: { color: c.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 6 },
    cardSubtitle: { color: c.textSecondary, fontSize: 15, lineHeight: 20, marginBottom: 14 },

    redeemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    input: {
      flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 14,
      color: c.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: 1,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderWidth: 1, borderColor: c.borderSubtle,
    },
    redeemBtn: {
      height: 48, paddingHorizontal: 20, borderRadius: 12,
      backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center',
    },
    redeemBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    codePill: {
      borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12,
      backgroundColor: 'rgba(255,116,42,0.12)',
      borderWidth: 1, borderColor: 'rgba(255,116,42,0.35)', borderStyle: 'dashed',
    },
    codeText: { color: c.orange, fontSize: 22, fontWeight: '800', letterSpacing: 3 },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 50, borderRadius: 25, backgroundColor: c.orange,
    },
    shareBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    earnedText: { color: '#34C759', fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 12 },

    stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7 },
    stepNum: {
      width: 24, height: 24, borderRadius: 12, marginTop: 1,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
    },
    stepNumText: { color: c.textPrimary, fontSize: 13, fontWeight: '800' },
    stepText: { color: c.textSecondary, fontSize: 15, lineHeight: 21, flex: 1 },

    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { color: c.textSecondary, fontSize: 15, flex: 1, lineHeight: 20 },
    emptyText: { color: c.textMuted, fontSize: 15 },

    disclaimer: { color: c.textMuted, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },
  });
}
