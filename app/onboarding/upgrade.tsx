import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppTheme } from '@/contexts/theme-context';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { usePostHog } from '@/lib/posthog';
import type { AppColors } from '@/constants/theme';
import { LucideIconByName } from '@/lib/lucide-icon-map';

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

export default function UpgradeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const refreshPremiumStatus = useSubscriptionStore((st) => st.refreshPremiumStatus);

  const posthog = usePostHog();
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState('$4.99/mo');
  const [annualPrice, setAnnualPrice] = useState('$49.99/yr');

  useEffect(() => {
    if (!storekit) return;
    storekit.getProducts().then((products: any[]) => {
      const monthly = products.find((p: any) => p.productId?.includes('monthly'));
      const annual = products.find((p: any) => p.productId?.includes('annual'));
      if (monthly) setMonthlyPrice(storekit!.formatSubscriptionPrice(monthly as any));
      if (annual) setAnnualPrice(storekit!.formatSubscriptionPrice(annual as any));
    }).catch(() => {});
  }, []);

  const handlePurchase = async () => {
    posthog?.capture('purchase_tapped', { plan: selectedPlan, source: 'onboarding' });
    if (!storekit) {
      router.replace('/(tabs)');
      return;
    }
    setPurchasing(true);
    try {
      if (selectedPlan === 'annual') {
        await storekit.purchaseAnnual();
      } else {
        await storekit.purchaseMonthly();
      }
      await refreshPremiumStatus();
      posthog?.capture('purchase_completed', { plan: selectedPlan, source: 'onboarding' });
    } catch {}
    setPurchasing(false);
    router.replace('/(tabs)');
  };

  const handleSkip = () => {
    posthog?.capture('upgrade_skipped', { source: 'onboarding' });
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.badge}>
            <Text style={s.badgeText}>PRO</Text>
          </View>
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
              <View style={s.saveBadge}>
                <Text style={s.saveText}>Save 17%</Text>
              </View>
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
      </ScrollView>

      {/* Bottom buttons */}
      <View style={s.bottom}>
        <TouchableOpacity
          style={s.purchaseBtn}
          activeOpacity={0.8}
          onPress={handlePurchase}
          disabled={purchasing}
          accessibilityLabel={purchasing ? 'Purchasing' : 'Start Free Trial'}
          accessibilityRole="button"
          accessibilityState={{ disabled: purchasing }}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={s.purchaseBtnText}>Start Free Trial</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={s.skipBtn} accessibilityLabel="Maybe later" accessibilityRole="button">
          <Text style={s.skipText}>Maybe later</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 },

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
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.isDark ? 'rgba(255,116,42,0.1)' : 'rgba(255,116,42,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: c.textPrimary,
    fontFamily: FF,
  },
  featureDesc: {
    fontSize: 13,
    color: c.textSecondary,
    fontFamily: FF,
    marginTop: 1,
  },

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
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    color: c.textSecondary,
    fontFamily: FF,
  },
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
  saveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34C759',
    fontFamily: FF,
  },

  // Bottom
  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  purchaseBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: c.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchaseBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FF,
    letterSpacing: 0.2,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipText: {
    fontSize: 16,
    color: c.textMuted,
    fontFamily: FF,
    fontWeight: '500',
  },
});
