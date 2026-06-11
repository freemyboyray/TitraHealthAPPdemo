import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { usePostHog } from '@/lib/posthog';
import { computeBaseTargets } from '@/lib/targets';
import { mlToOz } from '@/lib/checkin-target-rows';
import { computeProfileDerivedMetrics } from '@/constants/user-profile';
import type { FullUserProfile } from '@/constants/user-profile';
import type { AppColors } from '@/constants/theme';

const FF = 'System';

// Card illustrations are rendered as flat monochrome silhouettes (tinted to the
// text color) so the targets reveal reads as a clean black-and-white plan.
const HERO_ART = {
  calories: require('@/assets/images/cards/calories.png'),
  protein: require('@/assets/images/cards/protein.png'),
  steps: require('@/assets/images/cards/steps.png'),
  water: require('@/assets/images/cards/hydration.png'),
} as const;

const MACRO_ART = {
  carbs: require('@/assets/images/cards/carbs.png'),
  fat: require('@/assets/images/cards/fat.png'),
  fiber: require('@/assets/images/cards/fiber.png'),
} as const;

export default function YourTargetsScreen() {
  const router = useRouter();
  const { profile, draft } = useProfile();
  const { colors } = useAppTheme();
  const posthog = usePostHog();
  const s = useMemo(() => createStyles(colors), [colors]);

  // completeOnboarding() (run on the previous screen) sets `profile`, but fall
  // back to the draft in case we land here before that state settles.
  const effective: FullUserProfile = useMemo(
    () =>
      profile ??
      ({ ...draft, ...computeProfileDerivedMetrics(draft) } as FullUserProfile),
    [profile, draft],
  );

  const t = useMemo(() => computeBaseTargets(effective), [effective]);
  const imperial = effective.unitSystem !== 'metric';

  const heroCards = useMemo(
    () => [
      { key: 'calories', img: HERO_ART.calories, value: t.caloriesTarget.toLocaleString(), unit: 'cal', label: 'Calories' },
      { key: 'protein', img: HERO_ART.protein, value: String(t.proteinG), unit: 'g', label: 'Protein' },
      { key: 'steps', img: HERO_ART.steps, value: t.steps.toLocaleString(), unit: 'steps', label: 'Movement' },
      imperial
        ? { key: 'water', img: HERO_ART.water, value: String(mlToOz(t.waterMl)), unit: 'oz', label: 'Water' }
        : { key: 'water', img: HERO_ART.water, value: (t.waterMl / 1000).toFixed(1), unit: 'L', label: 'Water' },
    ],
    [t, imperial],
  );

  const macros = useMemo(
    () => [
      { key: 'protein', img: MACRO_ART.fiber, value: t.fiberG, label: 'Fiber' },
      { key: 'carbs', img: MACRO_ART.carbs, value: t.carbsG, label: 'Carbs' },
      { key: 'fat', img: MACRO_ART.fat, value: t.fatG, label: 'Fat' },
    ],
    [t],
  );

  const goalValue = imperial ? effective.goalWeightLbs : effective.goalWeightKg;
  const goalUnit = imperial ? 'lbs' : 'kg';

  const handleContinue = () => {
    posthog?.capture('onboarding_targets_viewed');
    router.replace('/onboarding/commitment');
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Your plan is ready</Text>
        <Text style={s.subtitle}>
          These are your recommended daily targets. Hitting them helps you stay on track
          and protect lean muscle as you lose weight.
        </Text>

        {goalValue ? (
          <View style={s.goalChip}>
            <Text style={s.goalChipText}>
              Tuned to your goal of {goalValue.toLocaleString()} {goalUnit}
            </Text>
          </View>
        ) : null}

        {/* Hero targets */}
        <View style={s.grid}>
          {heroCards.map((c) => (
            <View key={c.key} style={s.card}>
              <Image
                source={c.img}
                style={s.cardArt}
                resizeMode="contain"
                tintColor={colors.textPrimary}
                accessibilityIgnoresInvertColors
              />
              <View style={s.valueRow}>
                <Text style={s.value}>{c.value}</Text>
                <Text style={s.unit}>{c.unit}</Text>
              </View>
              <Text style={s.cardLabel}>{c.label}</Text>
            </View>
          ))}
        </View>

        {/* Macro breakdown */}
        <View style={s.macroRow}>
          {macros.map((m) => (
            <View key={m.key} style={s.macroCell}>
              <Image
                source={m.img}
                style={s.macroArt}
                resizeMode="contain"
                tintColor={colors.textPrimary}
                accessibilityIgnoresInvertColors
              />
              <Text style={s.macroValue}>{m.value}g</Text>
              <Text style={s.macroLabel}>{m.label}</Text>
            </View>
          ))}
        </View>

        <Text style={s.footnote}>
          We'll fine-tune these as you log meals and complete your weekly check-ins.
          You can adjust them anytime in settings.
        </Text>
      </ScrollView>

      <ContinueButton onPress={handleContinue} label="Looks good" />
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => {
  const cardBg = c.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.025)';
  const cardBorder = c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 16,
    },

    title: {
      fontSize: 30,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: -0.5,
      marginBottom: 10,
    },
    subtitle: {
      fontSize: 16,
      color: c.textSecondary,
      fontFamily: FF,
      lineHeight: 23,
      marginBottom: 20,
    },

    goalChip: {
      alignSelf: 'flex-start',
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.12)' : 'rgba(255,116,42,0.08)',
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginBottom: 22,
    },
    goalChipText: {
      fontSize: 13.5,
      fontWeight: '600',
      color: c.orange,
      fontFamily: FF,
    },

    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: 12,
    },
    card: {
      width: '48.5%',
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: cardBorder,
      borderRadius: 20,
      paddingVertical: 20,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    cardArt: {
      width: 44,
      height: 44,
      marginBottom: 12,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
    },
    value: {
      fontSize: 28,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: -0.6,
    },
    unit: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textSecondary,
      fontFamily: FF,
    },
    cardLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textSecondary,
      fontFamily: FF,
      marginTop: 2,
    },

    macroRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: cardBg,
      borderWidth: 1,
      borderColor: cardBorder,
      borderRadius: 20,
      paddingVertical: 18,
      paddingHorizontal: 8,
      marginTop: 12,
    },
    macroCell: {
      flex: 1,
      alignItems: 'center',
    },
    macroArt: {
      width: 28,
      height: 28,
      marginBottom: 8,
    },
    macroValue: {
      fontSize: 18,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: -0.3,
    },
    macroLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textSecondary,
      fontFamily: FF,
      marginTop: 2,
    },

    footnote: {
      fontSize: 13.5,
      color: c.textMuted,
      fontFamily: FF,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 22,
      paddingHorizontal: 4,
    },
  });
};
