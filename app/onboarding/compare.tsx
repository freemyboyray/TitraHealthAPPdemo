import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Check, Minus } from 'lucide-react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { usePostHog } from '@/lib/posthog';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const GREEN = '#34C759';

const WITHOUT = [
  'Guessing at your doses',
  'Unsure what to eat',
  'Losing track of progress',
  'Side effects catch you off guard',
];

const WITH = [
  'Never miss a dose',
  'Know exactly what to eat',
  'See your progress clearly',
  'Stay ahead of side effects',
];

export default function CompareScreen() {
  const router = useRouter();
  const { profile, draft } = useProfile();
  const { colors } = useAppTheme();
  const posthog = usePostHog();
  const s = useMemo(() => createStyles(colors), [colors]);

  const name = (profile?.username || draft.username || '').trim();

  const handleNext = () => {
    posthog?.capture('onboarding_compare_next');
    router.replace('/upgrade?from=onboarding');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.headline}>
            {name ? `${name}, here's the difference ` : 'Here’s the difference '}
            <Text style={s.accent}>Titra Health</Text> makes
          </Text>

          <View style={s.cards}>
            {/* Without Titra */}
            <View style={[s.card, s.cardWithout]}>
              <Text style={[s.cardTitle, s.cardTitleWithout]}>Without Titra</Text>
              <View style={s.rows}>
                {WITHOUT.map((t) => (
                  <View key={t} style={s.row}>
                    <View style={[s.badge, s.badgeWithout]}>
                      <Minus size={11} color="#FFFFFF" strokeWidth={3} />
                    </View>
                    <Text style={[s.rowText, s.rowTextWithout]}>{t}</Text>
                  </View>
                ))}
              </View>
              <Image source={require('@/assets/images/compare-without.png')} style={s.cardImg} resizeMode="contain" />
            </View>

            {/* Titra Members */}
            <View style={[s.card, s.cardWith]}>
              <Text style={[s.cardTitle, s.cardTitleWith]}>Titra Members</Text>
              <View style={s.rows}>
                {WITH.map((t) => (
                  <View key={t} style={s.row}>
                    <View style={[s.badge, s.badgeWith]}>
                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                    </View>
                    <Text style={s.rowText}>{t}</Text>
                  </View>
                ))}
              </View>
              <Image source={require('@/assets/images/compare-with.png')} style={s.cardImg} resizeMode="contain" />
            </View>
          </View>
        </ScrollView>

        <ContinueButton onPress={handleNext} label="Next" />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },

    headline: {
      fontSize: 26,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      textAlign: 'center',
      lineHeight: 33,
      letterSpacing: -0.4,
      marginBottom: 28,
    },
    accent: { color: c.orange },

    cards: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 12,
    },
    card: {
      flex: 1,
      borderRadius: 20,
      padding: 14,
      overflow: 'hidden',
    },
    cardWithout: {
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#EEECE8',
    },
    cardWith: {
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.12)' : '#FFF1E9',
      borderWidth: 1.5,
      borderColor: c.orange,
    },

    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
      fontFamily: FF,
      marginBottom: 14,
      letterSpacing: -0.2,
    },
    cardTitleWithout: { color: c.textMuted },
    cardTitleWith: { color: c.orange },

    rows: { gap: 12 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    badge: {
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    badgeWithout: { backgroundColor: c.isDark ? 'rgba(255,255,255,0.25)' : '#B9B5AE' },
    badgeWith: { backgroundColor: GREEN },

    rowText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: FF,
      lineHeight: 17,
    },
    rowTextWithout: { color: c.textSecondary, fontWeight: '500' },

    cardImg: {
      width: '100%',
      height: 96,
      marginTop: 14,
    },
  });
