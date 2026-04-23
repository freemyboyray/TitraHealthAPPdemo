import { Ionicons } from '@expo/vector-icons';
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
import type { AppColors } from '@/constants/theme';
import { useSubscriptionStore } from '@/stores/subscription-store';
// react-native-iap requires a dev build; guard so Expo Go doesn't crash.
let storekit: typeof import('@/lib/storekit') | undefined;
try { storekit = require('@/lib/storekit'); } catch {}

type ProductSubscription = { localizedPrice?: string; subscriptionOfferDetails?: any[] };

const ORANGE = '#FF742A';

export default function SubscriptionScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const status = useSubscriptionStore((s) => s.status);
  const currentPeriodEnd = useSubscriptionStore((s) => s.currentPeriodEnd);
  const trialEndsAt = useSubscriptionStore((s) => s.trialEndsAt);
  const refreshPremiumStatus = useSubscriptionStore((s) => s.refreshPremiumStatus);

  const [products, setProducts] = useState<ProductSubscription[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [demoCode, setDemoCode] = useState('');
  const setPremium = useSubscriptionStore((s) => s.setPremium);

  useEffect(() => {
    storekit?.getProducts().then((p: any[]) => setProducts(p));
    refreshPremiumStatus();
  }, []);

  const product = products[0];
  const priceLabel = product && storekit ? storekit.formatSubscriptionPrice(product) : '$9.99/month';

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
      case 'canceled': return 'Canceled (active until period end)';
      case 'expired': return 'Expired';
      default: return 'Free';
    }
  })();

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      await storekit?.purchaseMonthly();
      // Purchase listener in storekit.ts handles the state update
    } catch (err: any) {
      if (err?.code !== 'E_USER_CANCELLED') {
        Alert.alert('Purchase Error', err?.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await storekit?.restorePurchases() ?? false;
      if (restored) {
        Alert.alert('Restored', 'Your Titra Pro subscription has been restored.');
      } else {
        Alert.alert('No Subscription Found', 'We could not find an active subscription for this account.');
      }
    } catch {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleRedeemDemo = () => {
    if (demoCode.trim().toLowerCase() === 'demo123') {
      setPremium(true);
      Alert.alert('Demo Activated', 'Premium features are now unlocked for this session.');
      setDemoCode('');
    } else {
      Alert.alert('Invalid Code', 'Please enter a valid demo code.');
    }
  };

  const handleManageSubscription = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Subscription</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Status Card */}
        <View style={s.statusCard}>
          <View style={[s.statusIcon, { backgroundColor: isPremium ? 'rgba(255,116,42,0.15)' : 'rgba(150,150,150,0.15)' }]}>
            <Ionicons
              name={isPremium ? 'flash' : 'lock-closed'}
              size={28}
              color={isPremium ? ORANGE : colors.textMuted}
            />
          </View>
          <Text style={s.planName}>
            {isPremium ? 'Titra Pro' : 'Titra Free'}
          </Text>
          <Text style={s.statusText}>{statusLabel}</Text>
          {status === 'trialing' && trialEndDate && (
            <Text style={s.periodText}>Trial ends {trialEndDate}</Text>
          )}
          {status === 'active' && periodEndDate && (
            <Text style={s.periodText}>Renews {periodEndDate}</Text>
          )}
          {status === 'canceled' && periodEndDate && (
            <Text style={s.periodText}>Access until {periodEndDate}</Text>
          )}
        </View>

        {/* Pro Benefits */}
        {!isPremium && (
          <View style={s.benefitsCard}>
            <Text style={s.benefitsTitle}>Titra Pro includes:</Text>
            {BENEFITS.map((b) => (
              <View key={b} style={s.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color={ORANGE} />
                <Text style={s.benefitText}>{b}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Buttons */}
        {!isPremium && (
          <TouchableOpacity
            style={s.purchaseBtn}
            onPress={handlePurchase}
            activeOpacity={0.8}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={s.purchaseBtnText}>
                Start 7-Day Free Trial — {priceLabel}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {isPremium && (
          <TouchableOpacity style={s.manageBtn} onPress={handleManageSubscription}>
            <Text style={s.manageBtnText}>Manage Subscription</Text>
            <Ionicons name="open-outline" size={16} color={ORANGE} />
          </TouchableOpacity>
        )}

        {/* Restore */}
        <TouchableOpacity
          style={s.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator color={colors.textMuted} size="small" />
          ) : (
            <Text style={s.restoreBtnText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        {/* Demo Code */}
        {!isPremium && (
          <View style={s.demoCard}>
            <Text style={s.demoTitle}>Have a demo code?</Text>
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
                style={[s.demoBtn, !demoCode.trim() && { opacity: 0.5 }]}
                onPress={handleRedeemDemo}
                disabled={!demoCode.trim()}
              >
                <Text style={s.demoBtnText}>Redeem</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Fine print */}
        {!isPremium && (
          <Text style={s.finePrint}>
            After your 7-day free trial, you'll be charged {priceLabel}. Cancel anytime in your {Platform.OS === 'ios' ? 'App Store' : 'Play Store'} settings. Payment will be charged to your {Platform.OS === 'ios' ? 'Apple ID' : 'Google Play'} account.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const BENEFITS = [
  'Unlimited AI coaching & food analysis',
  'Cycle Intelligence & appetite forecasting',
  'Extended HealthKit (HRV, CGM, SpO₂, BP)',
  'Provider reports & clinician linking',
  'Peer comparison benchmarks',
  'All guided courses',
  'Weight projection & metabolic adaptation',
];

function createStyles(c: AppColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: 20, paddingBottom: 60 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
    backBtn: { width: 32 },
    headerTitle: { fontSize: 17, fontWeight: '600', color: c.textPrimary },

    statusCard: {
      backgroundColor: c.cardBg,
      borderRadius: 20,
      padding: 28,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.borderSubtle,
      marginBottom: 20,
    },
    statusIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    planName: { fontSize: 22, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
    statusText: { fontSize: 14, color: c.textSecondary, marginBottom: 4 },
    periodText: { fontSize: 12, color: c.textMuted },

    benefitsCard: {
      backgroundColor: c.cardBg,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      marginBottom: 24,
    },
    benefitsTitle: { fontSize: 14, fontWeight: '600', color: c.textPrimary, marginBottom: 14 },
    benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    benefitText: { fontSize: 13, color: c.textPrimary, flex: 1 },

    purchaseBtn: {
      backgroundColor: ORANGE,
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    purchaseBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },

    manageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.cardBg,
      borderRadius: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      marginBottom: 16,
    },
    manageBtnText: { color: ORANGE, fontSize: 15, fontWeight: '600' },

    restoreBtn: { alignItems: 'center', paddingVertical: 14, marginBottom: 16 },
    restoreBtnText: { color: c.textMuted, fontSize: 14 },

    demoCard: {
      backgroundColor: c.cardBg,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: c.borderSubtle,
      marginBottom: 20,
    },
    demoTitle: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 10 },
    demoRow: { flexDirection: 'row', gap: 10 },
    demoInput: {
      flex: 1,
      backgroundColor: c.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: c.textPrimary,
      borderWidth: 1,
      borderColor: c.borderSubtle,
    },
    demoBtn: {
      backgroundColor: ORANGE,
      borderRadius: 12,
      paddingHorizontal: 18,
      justifyContent: 'center',
    },
    demoBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

    finePrint: { fontSize: 11, color: c.textMuted, textAlign: 'center', lineHeight: 16, paddingHorizontal: 12 },
  });
}
