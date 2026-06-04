import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'System';

export function PremiumUpsellCard() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const onPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/upgrade' as any);
  };

  return (
    <View style={s.wrapper}>
      <View style={s.card}>
        {/* Logo + Pro badge */}
        <View style={s.logoRow}>
          <Image
            source={require('@/assets/images/titra-logo.png')}
            style={s.logo}
            resizeMode="cover"
          />
          <Text style={s.proBadge}>Pro</Text>
        </View>

        {/* Headline */}
        <Text style={s.headline}>Level Up with Titra Pro</Text>

        {/* Description */}
        <Text style={s.description}>
          Unlock AI coaching, cycle intelligence, weight projections, and unlimited food logging — everything you need to optimize your journey.
        </Text>

        {/* CTA Button */}
        <Pressable
          style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          onPress={onPress}
          accessibilityLabel="Try Titra Pro for free"
          accessibilityRole="button"
        >
          <Text style={s.ctaText}>TRY PRO FOR FREE</Text>
        </Pressable>

        {/* Pricing details */}
        <Text style={s.pricingMain}>7 days free, then $4.99/month</Text>
        <Text style={s.pricingFine}>Cancel anytime.</Text>
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  const dark = colors.isDark;
  return StyleSheet.create({
    wrapper: {
      paddingTop: 12,
      paddingBottom: 8,
    },
    card: {
      backgroundColor: dark ? '#1C1816' : colors.surface,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: dark ? '#FF742A' : 'rgba(255,116,42,0.35)',
      padding: 24,
    },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 18,
    },
    logo: {
      width: 52,
      height: 52,
      borderRadius: 14,
    },
    proBadge: {
      fontSize: 22,
      fontWeight: '700',
      color: '#FF742A',
      fontFamily: FF,
      letterSpacing: -0.3,
    },
    headline: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
      fontFamily: FF,
      letterSpacing: -0.3,
      marginBottom: 10,
    },
    description: {
      fontSize: 16,
      fontWeight: '400',
      color: colors.textSecondary,
      fontFamily: FF,
      lineHeight: 23,
      marginBottom: 24,
    },
    ctaBtn: {
      backgroundColor: '#FF742A',
      borderRadius: 28,
      paddingVertical: 18,
      alignItems: 'center',
      marginBottom: 16,
    },
    ctaText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: FF,
      letterSpacing: 1,
    },
    pricingMain: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.textSecondary,
      fontFamily: FF,
      textAlign: 'center',
      marginBottom: 4,
    },
    pricingFine: {
      fontSize: 13,
      fontWeight: '500',
      color: '#FF742A',
      fontFamily: FF,
      textAlign: 'center',
    },
  });
}
