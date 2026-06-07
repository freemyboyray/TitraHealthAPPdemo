import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { usePostHog } from '@/lib/posthog';
import { supabase } from '@/lib/supabase';
import type { AppColors } from '@/constants/theme';
import { LucideIconByName } from '@/lib/lucide-icon-map';
import { ChevronLeft, ExternalLink } from 'lucide-react-native';

// Guard IAP for Expo Go
let storekit: typeof import('@/lib/storekit') | undefined;
try { storekit = require('@/lib/storekit'); } catch {}

const FF = 'System';

const FEATURES = [
  { icon: 'BarChart3' as const, title: 'AI Insights', desc: 'Personalized weekly analysis of your progress' },
  { icon: 'TrendingUp' as const, title: 'Advanced Projections', desc: 'Weight forecasting and metabolic tracking' },
  { icon: 'MessageCircle' as const, title: 'Unlimited AI Chat', desc: 'Ask anything about your medication journey' },
  { icon: 'HeartPulse' as const, title: 'Cycle Intelligence', desc: 'Deep pharmacokinetic insights for your dose' },
  { icon: 'FileText' as const, title: 'Provider Reports', desc: 'Shareable summaries for your doctor visits' },
  { icon: 'Images' as const, title: 'Progress Comparisons', desc: 'Side-by-side photo tracking over time' },
];

/**
 * The single canonical paywall / subscription screen.
 *
 * Reached from onboarding (`?from=onboarding`) and from everywhere else
 * (settings row, premium cards, premium-gate, AI chat, etc). Behaviour adapts
 * to the entry point:
 *   - onboarding  → no back chevron; "Maybe later" + post-purchase continue
 *                   into the app (replace to tabs).
 *   - everywhere  → back chevron returns you where you came from; premium users
 *                   see their status + manage/restore.
 */
export default function UpgradeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = params.from === 'onboarding';
  const source = fromOnboarding ? 'onboarding' : 'settings';

  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const isPremium = useSubscriptionStore((st) => st.isPremium);
  const status = useSubscriptionStore((st) => st.status);
  const currentPeriodEnd = useSubscriptionStore((st) => st.currentPeriodEnd);
  const trialEndsAt = useSubscriptionStore((st) => st.trialEndsAt);
  const refreshPremiumStatus = useSubscriptionStore((st) => st.refreshPremiumStatus);
  const setPremium = useSubscriptionStore((st) => st.setPremium);
  const posthog = usePostHog();

  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [demoCode, setDemoCode] = useState('');
  const [monthlyPrice, setMonthlyPrice] = useState('$4.99/mo');
  const [annualPrice, setAnnualPrice] = useState('$49.99/yr');
  const [monthlyProduct, setMonthlyProduct] = useState<any>(null);
  const [annualProduct, setAnnualProduct] = useState<any>(null);
  // Referral reward state: an active credit (free month running now) and/or banked
  // credits (earned, waiting to start once a paid subscription lapses).
  const [refCredit, setRefCredit] = useState<{ activeUntil: string | null; banked: number }>({
    activeUntil: null,
    banked: 0,
  });

  useEffect(() => {
    if (!storekit) return;
    storekit.getProducts().then((products: any[]) => {
      // react-native-iap v15 exposes the SKU as `id` (older versions used `productId`).
      const sku = (p: any) => p.id ?? p.productId ?? '';
      const monthly = products.find((p: any) => sku(p).includes('monthly'));
      const annual = products.find((p: any) => sku(p).includes('annual'));
      if (monthly) { const f = storekit!.formatSubscriptionPrice(monthly as any); if (f) setMonthlyPrice(f); setMonthlyProduct(monthly); }
      if (annual) { const f = storekit!.formatSubscriptionPrice(annual as any); if (f) setAnnualPrice(f); setAnnualProduct(annual); }
    }).catch(() => {});
    refreshPremiumStatus();
  }, []);

  // Load referral reward state so the premium view can surface "free month active"
  // and the banked-credit disclosure for paying users.
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('referral_credits')
        .select('status, expires_at')
        .eq('user_id', user.id)
        .in('status', ['active', 'banked']);
      const rows = data ?? [];
      const active = rows
        .filter((r) => r.status === 'active' && r.expires_at && new Date(r.expires_at) > new Date())
        .sort((a, b) => new Date(b.expires_at!).getTime() - new Date(a.expires_at!).getTime())[0];
      setRefCredit({
        activeUntil: active?.expires_at ?? null,
        banked: rows.filter((r) => r.status === 'banked').length,
      });
    })();
  }, []);

  // Trial / renewal terms for the *selected* plan, driven by the real StoreKit
  // introductory offer (never hardcoded) so the button text and disclosure can
  // never promise a trial the App Store won't actually grant.
  const selectedProduct = selectedPlan === 'annual' ? annualProduct : monthlyProduct;
  const selectedPrice = selectedPlan === 'annual' ? annualPrice : monthlyPrice;
  const intro = selectedProduct && storekit ? storekit.getIntroOfferInfo(selectedProduct) : null;
  const hasTrial = !!intro?.hasOffer;
  const ctaLabel = hasTrial ? 'Start Free Trial' : 'Subscribe';
  const termsText = hasTrial
    ? `${intro!.trialLabel}, then ${selectedPrice}. Auto-renews until canceled. Cancel anytime in your App Store settings.`
    : `Auto-renews at ${selectedPrice} until canceled. Cancel anytime in your App Store settings.`;

  // After onboarding (whether the user starts the trial or skips it) we route
  // through the first-run tutorial before the home screen, then land in the app.
  const continueFromOnboarding = () => router.replace('/settings/tutorial?firstRun=1' as any);

  // Leave the screen: onboarding continues into the app, everywhere else returns.
  const leave = () => {
    if (fromOnboarding) continueFromOnboarding();
    else router.back();
  };

  const handlePurchase = async () => {
    posthog?.capture('purchase_tapped', { plan: selectedPlan, source });
    if (!storekit) {
      // Expo Go / no native IAP — onboarding still needs to move forward.
      leave();
      return;
    }
    setPurchasing(true);
    try {
      const products = await storekit.getProducts();
      if (products.length === 0) {
        const d = storekit.getIAPDiagnostics?.() ?? { initialized: false, initError: null, fetchError: null };
        const Constants = require('expo-constants').default;
        const bundle = Constants?.expoConfig?.ios?.bundleIdentifier ?? Constants?.easConfig?.ios?.bundleIdentifier ?? 'unknown';
        const detail = [
          `init: ${d.initialized ? 'ok' : 'failed'}`,
          d.initError ? `initErr: ${d.initError}` : null,
          d.fetchError ? `fetchErr: ${d.fetchError}` : null,
          `bundle: ${bundle}`,
          `skus: ${storekit.PRODUCT_IDS.MONTHLY}, ${storekit.PRODUCT_IDS.ANNUAL}`,
        ].filter(Boolean).join('\n');
        Alert.alert('Not Available', `In-app purchases are not available right now.\n\n${detail}`);
        return;
      }
      if (selectedPlan === 'annual') await storekit.purchaseAnnual();
      else await storekit.purchaseMonthly();
      // Optimistically unlock so the screen flips to the premium view immediately.
      // The IAP purchase listener (storekit.ts) also fires setPremium(true) and then
      // re-confirms from the DB once Apple's server notification has reached the
      // webhook. Do NOT call refreshPremiumStatus() synchronously here — the webhook
      // hasn't run yet, so the DB still says "free" and it would clobber this unlock.
      setPremium(true);
      posthog?.capture('purchase_completed', { plan: selectedPlan, source });
      // Onboarding continues into the app; elsewhere we stay so the screen
      // flips to the premium-status view.
      if (fromOnboarding) continueFromOnboarding();
    } catch (err: any) {
      if (err?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Purchase Failed', err?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await storekit?.restorePurchases() ?? false;
      if (restored) Alert.alert('Restored', 'Your subscription has been restored.');
      else Alert.alert('Not Found', 'No active subscription found for this account.');
    } catch {
      Alert.alert('Error', 'Failed to restore. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleRedeemDemo = async () => {
    const code = demoCode.trim();
    if (!code) return;
    try {
      const { data, error } = await supabase.functions.invoke('redeem-demo', { body: { code } });
      if (error || !data?.success) { Alert.alert('Invalid Code', 'Please enter a valid demo code.'); return; }
      setPremium(true);
      Alert.alert('Activated', 'Premium features are now unlocked.');
      setDemoCode('');
    } catch {
      Alert.alert('Error', 'Could not redeem code.');
    }
  };

  const handleManage = () => {
    Linking.openURL(
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions',
    );
  };

  const periodEndDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const trialEndDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const refCreditEndDate = refCredit.activeUntil
    ? new Date(refCredit.activeUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const statusLabel = (() => {
    switch (status) {
      case 'active': return 'Active';
      case 'trialing': return 'Free Trial';
      case 'past_due': return 'Past Due';
      case 'canceled': return 'Canceled';
      case 'expired': return 'Expired';
      default: return 'Free';
    }
  })();

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      {/* Nav (hidden during onboarding — that flow uses "Maybe later") */}
      {!fromOnboarding && (
        <View style={s.nav}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>{isPremium ? 'Subscription' : 'Titra Pro'}</Text>
          <View style={{ width: 24 }} />
        </View>
      )}

      {isPremium ? (
        /* ── Premium-user view ── */
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <View style={s.premiumSection}>
            <View style={s.badge}><Text style={s.badgeText}>PRO</Text></View>
            <Text style={s.premiumHeadline}>You have Titra Pro</Text>
            <Text style={s.statusLabel}>{statusLabel}</Text>
            {status === 'trialing' && trialEndDate && (
              <Text style={s.statusDetail}>Trial ends {trialEndDate}</Text>
            )}
            {status === 'active' && periodEndDate && (
              <Text style={s.statusDetail}>Renews {periodEndDate}</Text>
            )}
            {status === 'canceled' && periodEndDate && (
              <Text style={s.statusDetail}>Access until {periodEndDate}</Text>
            )}

            {/* Referral reward: active free month */}
            {refCreditEndDate && (
              <View style={s.refBadge}>
                <Text style={s.refBadgeText}>🎁 Free referral month active — ends {refCreditEndDate}</Text>
              </View>
            )}

            {/* Referral reward: banked free month(s) for a paying user. Clear
                disclosure that we never touch the App Store subscription. */}
            {refCredit.banked > 0 && (
              <View style={s.refBadge}>
                <Text style={s.refBadgeText}>
                  🎁 {refCredit.banked} free {refCredit.banked === 1 ? 'month' : 'months'} earned from referrals
                </Text>
                <Text style={s.refBadgeSub}>
                  Your subscription keeps renewing as normal through the App Store — we don’t change or pause it.
                  Your free month starts automatically once your current subscription ends, so you won’t be charged
                  for that month.
                </Text>
              </View>
            )}

            <TouchableOpacity style={s.manageRow} onPress={handleManage} activeOpacity={0.7}>
              <Text style={s.manageText}>Manage Subscription</Text>
              <ExternalLink size={15} color={colors.orange} />
            </TouchableOpacity>

            <TouchableOpacity style={s.linkBtn} onPress={handleRestore} disabled={restoring}>
              {restoring ? <ActivityIndicator color={colors.textMuted} size="small" /> : <Text style={s.linkBtnText}>Restore Purchases</Text>}
            </TouchableOpacity>

            {fromOnboarding && (
              <TouchableOpacity style={s.purchaseBtn} onPress={continueFromOnboarding} activeOpacity={0.8}>
                <Text style={s.purchaseBtnText}>Continue</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : (
        /* ── Free-user paywall ── */
        <>
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={s.header}>
              <View style={s.badge}><Text style={s.badgeText}>PRO</Text></View>
              <Text style={s.title}>Unlock the full{'\n'}Titra Health experience</Text>
              <Text style={s.subtitle}>
                Get deeper insights, unlimited AI, and tools designed to maximize your results.
              </Text>
            </View>

            {/* Features */}
            <View style={s.features}>
              {FEATURES.map((f) => (
                <View key={f.title} style={s.featureRow}>
                  <View style={s.featureIcon}>
                    <LucideIconByName name={f.icon} size={20} color={colors.orange} />
                  </View>
                  <View style={s.featureText}>
                    <Text style={s.featureTitle}>{f.title}</Text>
                    <Text style={s.featureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Plan selector */}
            <View style={s.plans}>
              <TouchableOpacity
                style={[s.planCard, selectedPlan === 'annual' && s.planCardSelected]}
                activeOpacity={0.8}
                onPress={() => setSelectedPlan('annual')}
                accessibilityLabel={`Annual plan, ${annualPrice}`}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPlan === 'annual' }}
              >
                <View style={s.planHeader}>
                  <Text style={[s.planName, selectedPlan === 'annual' && s.planNameSelected]}>Annual</Text>
                  <View style={s.saveBadge}><Text style={s.saveText}>Save 17%</Text></View>
                </View>
                <Text style={[s.planPrice, selectedPlan === 'annual' && s.planPriceSelected]}>{annualPrice}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.planCard, selectedPlan === 'monthly' && s.planCardSelected]}
                activeOpacity={0.8}
                onPress={() => setSelectedPlan('monthly')}
                accessibilityLabel={`Monthly plan, ${monthlyPrice}`}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPlan === 'monthly' }}
              >
                <Text style={[s.planName, selectedPlan === 'monthly' && s.planNameSelected]}>Monthly</Text>
                <Text style={[s.planPrice, selectedPlan === 'monthly' && s.planPriceSelected]}>{monthlyPrice}</Text>
              </TouchableOpacity>
            </View>

            {/* Redeem a code (hidden in the onboarding funnel) */}
            {!fromOnboarding && (
              <View style={s.demoSection}>
                <Text style={s.demoLabel}>Redeem a code</Text>
                <View style={s.demoRow}>
                  <TextInput
                    style={s.demoInput}
                    placeholder="Enter code"
                    placeholderTextColor={colors.textMuted}
                    value={demoCode}
                    onChangeText={setDemoCode}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[s.demoBtn, !demoCode.trim() && { opacity: 0.4 }]}
                    onPress={handleRedeemDemo}
                    disabled={!demoCode.trim()}
                  >
                    <Text style={s.demoBtnText}>Redeem</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Bottom buttons */}
          <View style={s.bottom}>
            <TouchableOpacity
              style={s.purchaseBtn}
              activeOpacity={0.8}
              onPress={handlePurchase}
              disabled={purchasing}
              accessibilityLabel={purchasing ? 'Purchasing' : ctaLabel}
              accessibilityRole="button"
              accessibilityState={{ disabled: purchasing }}
            >
              {purchasing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={s.purchaseBtnText}>{ctaLabel}</Text>
              )}
            </TouchableOpacity>

            {/* Required subscription disclosure (trial length, renewal price, auto-renew, how to cancel) */}
            <Text style={s.termsText}>{termsText}</Text>

            {/* Required legal links for auto-renewing subscriptions (App Store Guideline 3.1.2) */}
            <View style={s.legalRow}>
              <TouchableOpacity onPress={() => router.push('/settings/legal?tab=tos' as any)} accessibilityRole="link">
                <Text style={s.legalLink}>Terms of Use</Text>
              </TouchableOpacity>
              <Text style={s.legalDot}>·</Text>
              <TouchableOpacity onPress={() => router.push('/settings/legal?tab=privacy' as any)} accessibilityRole="link">
                <Text style={s.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>

            {fromOnboarding ? (
              <TouchableOpacity onPress={leave} activeOpacity={0.7} style={s.skipBtn} accessibilityLabel="Maybe later" accessibilityRole="button">
                <Text style={s.skipText}>Maybe later</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.linkBtn} onPress={handleRestore} disabled={restoring}>
                {restoring ? <ActivityIndicator color={colors.textMuted} size="small" /> : <Text style={s.linkBtnText}>Restore Purchases</Text>}
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },

  // Nav
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  navTitle: { fontSize: 17, fontWeight: '600', color: c.textPrimary, fontFamily: FF },

  // Header
  header: { alignItems: 'center', marginBottom: 32 },
  badge: {
    backgroundColor: c.orange,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    fontFamily: FF,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: c.textPrimary,
    textAlign: 'center',
    lineHeight: 34,
    fontFamily: FF,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: FF,
    paddingHorizontal: 8,
  },

  // Features
  features: { gap: 16, marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.1)' : 'rgba(255,116,42,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary, fontFamily: FF },
  featureDesc: { fontSize: 13, color: c.textSecondary, fontFamily: FF, marginTop: 1 },

  // Plans
  plans: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  planCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
    padding: 16,
  },
  planCardSelected: {
    borderColor: c.orange,
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.08)' : 'rgba(255,116,42,0.04)',
  },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { fontSize: 16, fontWeight: '600', color: c.textSecondary, fontFamily: FF },
  planNameSelected: { color: c.textPrimary },
  planPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: c.textSecondary,
    fontFamily: FF,
    marginTop: 6,
    letterSpacing: -0.3,
  },
  planPriceSelected: { color: c.textPrimary },
  saveBadge: {
    backgroundColor: c.isDark ? 'rgba(52,199,89,0.15)' : 'rgba(52,199,89,0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saveText: { fontSize: 11, fontWeight: '700', color: '#34C759', fontFamily: FF },

  // Bottom
  bottom: { paddingHorizontal: 24, paddingBottom: 8 },
  purchaseBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: c.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  purchaseBtnText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', fontFamily: FF, letterSpacing: 0.2 },
  termsText: { fontSize: 12, lineHeight: 17, color: c.textMuted, fontFamily: FF, textAlign: 'center', marginTop: 10, paddingHorizontal: 8 },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, gap: 8 },
  legalLink: { fontSize: 12, color: c.textSecondary, fontFamily: FF, fontWeight: '600', textDecorationLine: 'underline' },
  legalDot: { fontSize: 12, color: c.textMuted, fontFamily: FF },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: 16, color: c.textMuted, fontFamily: FF, fontWeight: '500' },

  // Restore / links
  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  linkBtnText: { fontSize: 15, color: c.textMuted, fontFamily: FF },

  // Premium-user view
  premiumSection: { alignItems: 'center', paddingVertical: 40 },
  premiumHeadline: {
    fontSize: 22,
    fontWeight: '700',
    color: c.textPrimary,
    fontFamily: FF,
    textAlign: 'center',
    marginBottom: 6,
  },
  statusLabel: { fontSize: 15, fontWeight: '500', color: c.textSecondary, fontFamily: FF },
  statusDetail: { fontSize: 13, color: c.textMuted, fontFamily: FF, marginTop: 4 },
  refBadge: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(52,199,89,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.35)',
    alignSelf: 'stretch',
  },
  refBadgeText: { fontSize: 14, fontWeight: '700', color: '#34C759', fontFamily: FF, textAlign: 'center' },
  refBadgeSub: { fontSize: 12, color: c.textMuted, fontFamily: FF, marginTop: 6, lineHeight: 17, textAlign: 'center' },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    ...(c.isDark
      ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }
      : { shadowColor: 'rgba(0,0,0,0.04)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 8, elevation: 1 }),
  },
  manageText: { fontSize: 16, fontWeight: '600', color: c.orange, fontFamily: FF },

  // Demo
  demoSection: { marginTop: 20, marginBottom: 8 },
  demoLabel: { fontSize: 14, fontWeight: '600', color: c.textSecondary, fontFamily: FF, marginBottom: 8 },
  demoRow: { flexDirection: 'row', gap: 10 },
  demoInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    color: c.textPrimary,
    fontFamily: FF,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderWidth: 1,
    borderColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  demoBtn: { height: 44, paddingHorizontal: 18, borderRadius: 10, backgroundColor: c.orange, justifyContent: 'center' },
  demoBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', fontFamily: FF },
});
