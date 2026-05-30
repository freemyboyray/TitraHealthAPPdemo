import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { usePostHog } from '@/lib/posthog';
import type { AppColors } from '@/constants/theme';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { supabase } from '@/lib/supabase';
import { Check, ChevronLeft, ExternalLink } from 'lucide-react-native';
let storekit: typeof import('@/lib/storekit') | undefined;
try { storekit = require('@/lib/storekit'); } catch {}

type ProductSubscription = { localizedPrice?: string; subscriptionOfferDetails?: any[] };

const FF = 'System';

const PRO_INCLUDES = [
  'Unlimited AI coaching & food analysis',
  'Energy bank & medication cycle tracking',
  'Appetite forecasting & side effect insights',
  'Provider reports for your doctor',
];

export default function SubscriptionScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const isPremium = useSubscriptionStore((st) => st.isPremium);
  const status = useSubscriptionStore((st) => st.status);
  const currentPeriodEnd = useSubscriptionStore((st) => st.currentPeriodEnd);
  const trialEndsAt = useSubscriptionStore((st) => st.trialEndsAt);
  const refreshPremiumStatus = useSubscriptionStore((st) => st.refreshPremiumStatus);
  const setPremium = useSubscriptionStore((st) => st.setPremium);
  const posthog = usePostHog();

  const [products, setProducts] = useState<ProductSubscription[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [demoCode, setDemoCode] = useState('');

  useEffect(() => {
    if (!storekit) return;
    storekit.getProducts().then((p: any[]) => setProducts(p)).catch(() => {});
    refreshPremiumStatus();
  }, []);

  const monthlyProduct = products.find((p: any) => p.productId?.includes('monthly'));
  const annualProduct = products.find((p: any) => p.productId?.includes('annual'));
  const monthlyPrice = monthlyProduct && storekit ? storekit.formatSubscriptionPrice(monthlyProduct as any) : '$4.99/mo';
  const annualPrice = annualProduct && storekit ? storekit.formatSubscriptionPrice(annualProduct as any) : '$49.99/yr';

  // Pull intro offer from Apple/Google product metadata
  const selectedProduct = selectedPlan === 'annual' ? annualProduct : monthlyProduct;
  const introOffer = selectedProduct && storekit?.getIntroOfferInfo
    ? storekit.getIntroOfferInfo(selectedProduct as any)
    : null;
  const trialLabel = introOffer?.hasOffer ? introOffer.trialLabel : '7-day free trial';

  const periodEndDate = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const trialEndDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
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

  const handlePurchase = async () => {
    posthog?.capture('purchase_tapped', { plan: selectedPlan, source: 'settings' });
    setPurchasing(true);
    try {
      if (!storekit) return;
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

  return (
    <View style={s.root}>
      {/* Subtle warm gradient at top */}
      <LinearGradient
        colors={colors.isDark
          ? ['rgba(255,116,42,0.06)', 'rgba(255,116,42,0.02)', colors.bg]
          : ['rgba(255,116,42,0.04)', 'rgba(255,116,42,0.01)', colors.bg]}
        style={s.topGradient}
      />

      <SafeAreaView style={s.safe}>
        {/* Nav */}
        <View style={s.nav}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.navTitle}>Subscription</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {isPremium ? (
            /* ── Premium user view ── */
            <View style={s.premiumSection}>
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

              <TouchableOpacity style={s.manageRow} onPress={handleManage} activeOpacity={0.7}>
                <Text style={s.manageText}>Manage Subscription</Text>
                <ExternalLink size={15} color={colors.orange} />
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Free user view ── */
            <>
              {/* Hero */}
              <View style={s.hero}>
                <Text style={s.heroWordmark}>TITRA PRO</Text>
                <Text style={s.heroHeadline}>Your GLP-1 journey,{'\n'}fully optimized.</Text>
                <Text style={s.heroSub}>
                  AI-powered coaching, medication tracking, energy insights, and personalized guidance — built for your GLP-1 journey.
                </Text>
              </View>

              {/* Checkmark list */}
              <View style={s.checkList}>
                {PRO_INCLUDES.map((item) => (
                  <View key={item} style={s.checkRow}>
                    <Check size={15} color={colors.orange} />
                    <Text style={s.checkLabel}>{item}</Text>
                  </View>
                ))}
              </View>

              {/* Plan selector */}
              <View style={s.planRow}>
                <TouchableOpacity
                  style={[s.planCard, selectedPlan === 'annual' && s.planCardActive]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedPlan('annual')}
                >
                  <Text style={[s.planLabel, selectedPlan === 'annual' && s.planLabelActive]}>Annual</Text>
                  <Text style={[s.planPrice, selectedPlan === 'annual' && s.planPriceActive]}>{annualPrice}</Text>
                  <Text style={[s.planSub, selectedPlan === 'annual' && s.planSubActive]}>Billed annually</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.planCard, selectedPlan === 'monthly' && s.planCardActive]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedPlan('monthly')}
                >
                  <Text style={[s.planLabel, selectedPlan === 'monthly' && s.planLabelActive]}>Monthly</Text>
                  <Text style={[s.planPrice, selectedPlan === 'monthly' && s.planPriceActive]}>{monthlyPrice}</Text>
                  <Text style={[s.planSub, selectedPlan === 'monthly' && s.planSubActive]}>Billed monthly</Text>
                </TouchableOpacity>
              </View>

              {/* CTA */}
              <TouchableOpacity style={s.ctaBtn} onPress={handlePurchase} activeOpacity={0.8} disabled={purchasing}>
                {purchasing ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={s.ctaBtnText}>{trialLabel ? 'Start Free Trial' : 'Subscribe'}</Text>
                )}
              </TouchableOpacity>

              <Text style={s.finePrint}>
                {trialLabel}, then {selectedPlan === 'annual' ? annualPrice : monthlyPrice}. Cancel anytime in {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} settings.
              </Text>
            </>
          )}

          {/* Restore */}
          <TouchableOpacity style={s.linkBtn} onPress={handleRestore} disabled={restoring}>
            {restoring ? (
              <ActivityIndicator color={colors.textMuted} size="small" />
            ) : (
              <Text style={s.linkBtnText}>Restore Purchases</Text>
            )}
          </TouchableOpacity>

          {/* Demo code */}
          {!isPremium && (
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
      </SafeAreaView>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    safe: { flex: 1 },
    topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },

    // Nav
    nav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    navTitle: { fontSize: 17, fontWeight: '600', color: c.textPrimary, fontFamily: FF },

    scroll: { paddingHorizontal: 20, paddingBottom: 60 },

    // ── Hero (free users) ──
    hero: {
      alignItems: 'center',
      paddingTop: 40,
      paddingBottom: 36,
    },
    heroWordmark: {
      fontSize: 13,
      fontWeight: '600',
      color: c.orange,
      letterSpacing: 1.5,
      marginBottom: 16,
      fontFamily: FF,
    },
    heroHeadline: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      textAlign: 'center',
      lineHeight: 34,
      letterSpacing: -0.5,
      fontFamily: FF,
      marginBottom: 12,
    },
    heroSub: {
      fontSize: 15,
      fontWeight: '400',
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      paddingHorizontal: 12,
      fontFamily: FF,
    },

    // ── Checkmark list ──
    checkList: {
      marginBottom: 32,
      paddingHorizontal: 4,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
    },
    checkLabel: {
      fontSize: 15,
      fontWeight: '400',
      color: c.textPrimary,
      fontFamily: FF,
    },

    // ── Plans ──
    planRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
    planCard: {
      flex: 1,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
      padding: 16,
    },
    planCardActive: {
      borderColor: c.orange,
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.06)' : 'rgba(255,116,42,0.03)',
    },
    planLabel: { fontSize: 15, fontWeight: '600', color: c.textSecondary, fontFamily: FF },
    planLabelActive: { color: c.textPrimary },
    planPrice: {
      fontSize: 24,
      fontWeight: '800',
      color: c.textSecondary,
      fontFamily: FF,
      marginTop: 8,
      letterSpacing: -0.5,
    },
    planPriceActive: { color: c.textPrimary },
    planSub: { fontSize: 13, color: c.textMuted, fontFamily: FF, marginTop: 2 },
    planSubActive: { color: c.textSecondary },

    // ── CTA ──
    ctaBtn: {
      height: 54,
      borderRadius: 14,
      backgroundColor: c.orange,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    ctaBtnText: {
      fontSize: 17,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: FF,
      letterSpacing: -0.2,
    },
    finePrint: {
      fontSize: 11,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 16,
      fontFamily: FF,
      marginBottom: 28,
    },

    // ── Premium user ──
    premiumSection: {
      alignItems: 'center',
      paddingVertical: 40,
    },
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
        : {
            shadowColor: 'rgba(0,0,0,0.04)',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 1,
            shadowRadius: 8,
            elevation: 1,
          }),
    },
    manageText: { fontSize: 16, fontWeight: '600', color: c.orange, fontFamily: FF },

    // ── Link buttons ──
    linkBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 24 },
    linkBtnText: { fontSize: 15, color: c.textMuted, fontFamily: FF },

    // ── Demo ──
    demoSection: { marginTop: 8, marginBottom: 16 },
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
    demoBtn: {
      height: 44,
      paddingHorizontal: 18,
      borderRadius: 10,
      backgroundColor: c.orange,
      justifyContent: 'center',
    },
    demoBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', fontFamily: FF },
  });
}
