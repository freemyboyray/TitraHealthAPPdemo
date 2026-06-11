import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
// Matches the Titra logo's background orange (sampled from titra-logo.png).
const ORANGE = '#FC560B';

// Compact, solid-orange upsell banner (white badge · headline · chevron). The
// whole card is the tap target → /upgrade, where the full trial/pricing lives.
export function PremiumUpsellCard() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const onPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/upgrade?source=upsell_card' as any);
  };

  return (
    <View style={s.wrapper}>
      <Pressable
        style={({ pressed }) => [s.card, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Ready to try Titra Pro for free? Start your free trial."
      >
        <View style={s.badge}>
          <Image
            source={require('@/assets/images/titra-logo.png')}
            style={s.logo}
            resizeMode="cover"
          />
        </View>

        <View style={s.textCol}>
          <Text style={s.headline}>Ready to Try Titra Pro for Free?</Text>
          <Text style={s.subtitle}>Start your free trial with no commitment.</Text>
        </View>

        <ChevronRight size={26} color="rgba(255,255,255,0.95)" />
      </Pressable>
    </View>
  );
}

function createStyles(_colors: AppColors) {
  return StyleSheet.create({
    wrapper: {
      paddingTop: 12,
      paddingBottom: 18,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      backgroundColor: ORANGE,
      borderRadius: 22,
      paddingVertical: 14,
      paddingHorizontal: 18,
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 14,
      elevation: 4,
    },
    badge: {
      width: 46,
      height: 46,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      width: 36,
      height: 36,
      borderRadius: 9,
    },
    textCol: {
      flex: 1,
    },
    headline: {
      fontSize: 20,
      fontWeight: '800',
      color: '#FFFFFF',
      fontFamily: FF,
      letterSpacing: -0.3,
      lineHeight: 25,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.92)',
      fontFamily: FF,
      lineHeight: 19,
      marginTop: 4,
    },
  });
}
