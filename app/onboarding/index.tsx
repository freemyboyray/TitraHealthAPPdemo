import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { AccessibilityInfo, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { FlaskConical } from 'lucide-react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation, type AppColors } from '@/constants/theme';

const FF = 'System';

const STATS = [
  { number: '60+', label: 'Studies' },
  { number: '9', label: 'Trials' },
  { number: '10+', label: 'Brands' },
];

// Research cards riffled through in the hero animation. Real GLP-1 evidence base.
const CARDS = [
  { tag: 'TRIAL', name: 'SURMOUNT-1', sub: 'Tirzepatide' },
  { tag: 'TRIAL', name: 'STEP-3', sub: 'Semaglutide' },
  { tag: 'TRIAL', name: 'SELECT', sub: 'Cardiovascular' },
  { tag: 'TRIAL', name: 'SUSTAIN-7', sub: 'Semaglutide' },
  { tag: 'STUDY', name: 'PIONEER', sub: 'Oral therapy' },
  { tag: 'DATA', name: 'Pharmacokinetics', sub: 'Dose-response' },
];
const N = CARDS.length;
const STEP_MS = 1500; // dwell per card at the front

const CARD_W = 250;
const CARD_H = 165;
const DECK_H = 215;

// ── A single riffling card ──
// Reads the shared `progress` (0..N, looping). Each card's slot position `sp`
// is derived modulo N, then mapped to a backward-fanning stack: front (sp=0) is
// readable, higher slots recede up + shrink + fade, and the just-passed card
// (sp in (-1,0)) slides down and out. Because positions are modulo N, the
// 0→N loop restart is visually seamless.
function RiffleCard({
  index,
  progress,
  data,
  c,
  s,
}: {
  index: number;
  progress: SharedValue<number>;
  data: (typeof CARDS)[number];
  c: AppColors;
  s: ReturnType<typeof createStyles>;
}) {
  const animStyle = useAnimatedStyle(() => {
    let sp = (((index - progress.value) % N) + N) % N; // 0..N
    if (sp > N - 1) sp -= N; // shift wrap into the (-1, N-1] exit zone

    const ty = interpolate(sp, [-1, 0, 1, 2, 3], [70, 0, -16, -30, -42], Extrapolation.CLAMP);
    const scale = interpolate(sp, [-1, 0, 1, 2, 3], [0.84, 1, 0.95, 0.9, 0.86], Extrapolation.CLAMP);
    const opacity = interpolate(
      sp,
      [-1, -0.35, 0, 1, 2, 3, 3.5],
      [0, 0, 1, 0.92, 0.68, 0.42, 0],
      Extrapolation.CLAMP,
    );
    const rot = interpolate(sp, [0, 1, 2, 3], [0, -2.5, -4.5, -6.5], Extrapolation.CLAMP);
    const zIndex = Math.round(
      interpolate(sp, [-1, 0, 1, 2, 3], [90, 100, 80, 70, 60], Extrapolation.CLAMP),
    );

    return {
      opacity,
      zIndex,
      transform: [
        { translateX: -CARD_W / 2 },
        { translateY: ty },
        { scale },
        { rotateZ: `${rot}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[s.card, animStyle]}>
      <FlaskConical size={18} color={c.orange} strokeWidth={2} style={s.cardIcon} />
      <View style={s.cardTab}>
        <Text style={s.cardTabText}>{data.tag}</Text>
      </View>
      <Text style={s.cardName} numberOfLines={1} allowFontScaling={false}>
        {data.name}
      </Text>
      <Text style={s.cardSub} numberOfLines={1}>
        {data.sub}
      </Text>
      <View style={s.cardRule} />
      <View style={[s.cardRule, { width: '58%' }]} />
    </Animated.View>
  );
}

// ── The riffling deck ──
function RiffleDeck({ c, s }: { c: AppColors; s: ReturnType<typeof createStyles> }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (reduce) {
        progress.value = 0; // static fanned stack
      } else {
        progress.value = withRepeat(
          withTiming(N, { duration: N * STEP_MS, easing: Easing.linear }),
          -1,
          false,
        );
      }
    });
    return () => {
      active = false;
      cancelAnimation(progress);
    };
  }, [progress]);

  return (
    <View style={s.deck} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {CARDS.map((card, i) => (
        <RiffleCard key={card.name} index={i} progress={progress} data={card} c={c} s={s} />
      ))}
    </View>
  );
}

export default function ResearchScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={1} total={16} onBack={() => router.back()} />

        <View style={s.center}>
          {/* Hero: research cards riffling through, like flipping a card catalog */}
          <RiffleDeck c={colors} s={s} />

          {/* Hero text */}
          <Text style={s.title} accessibilityRole="header">
            Backed by science.{'\n'}
            <Text style={s.titleAccent}>Built for you.</Text>
          </Text>

          {/* Stats */}
          <View style={s.statsCard}>
            {STATS.map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <View style={s.divider} />}
                <View style={s.statItem}>
                  <Text style={s.statNumber}>{stat.number}</Text>
                  <Text style={s.statLabel}>{stat.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Descriptor */}
          <Text style={s.body}>
            Every recommendation is grounded in{' '}
            <Text style={s.bodyBold}>peer-reviewed research</Text> and major clinical trials.
          </Text>
        </View>

        <ContinueButton onPress={() => router.push('/onboarding/journey')} label="Get Started" />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },

    center: {
      flex: 1,
      justifyContent: 'center',
    },

    // ── Riffle deck ──
    deck: {
      width: '100%',
      height: DECK_H,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    card: {
      position: 'absolute',
      left: '50%',
      top: (DECK_H - CARD_H) / 2,
      width: CARD_W,
      height: CARD_H,
      borderRadius: 18,
      backgroundColor: c.isDark ? c.cardBg : '#FFFFFF',
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingHorizontal: 18,
      paddingVertical: 16,
      ...cardElevation(c.isDark),
    },
    cardIcon: {
      position: 'absolute',
      top: 16,
      right: 16,
    },
    cardTab: {
      alignSelf: 'flex-start',
      backgroundColor: c.orangeDim,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 7,
      marginBottom: 12,
    },
    cardTabText: {
      fontSize: 11,
      fontWeight: '800',
      color: c.orange,
      letterSpacing: 1.2,
      fontFamily: FF,
    },
    cardName: {
      fontSize: 22,
      fontWeight: '800',
      color: c.textPrimary,
      letterSpacing: -0.4,
      fontFamily: FF,
    },
    cardSub: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textSecondary,
      marginTop: 3,
      fontFamily: FF,
    },
    cardRule: {
      height: 4,
      width: '85%',
      borderRadius: 2,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
      marginTop: 11,
    },

    // ── Hero text ──
    title: {
      fontSize: 34,
      fontWeight: '800',
      color: c.textPrimary,
      lineHeight: 41,
      fontFamily: FF,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 28,
    },
    titleAccent: {
      color: c.orange,
    },

    // ── Stats card ──
    statsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
      borderRadius: 20,
      paddingVertical: 24,
      marginBottom: 24,
      ...(c.isDark
        ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }
        : {
            shadowColor: 'rgba(0,0,0,0.06)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 1,
            shadowRadius: 16,
            elevation: 2,
          }),
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 36,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FF,
      letterSpacing: -1,
    },
    statLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: c.textSecondary,
      fontFamily: FF,
      marginTop: 4,
    },
    divider: {
      width: 1,
      height: 36,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },

    // ── Body ──
    body: {
      fontSize: 16,
      fontWeight: '400',
      color: c.textSecondary,
      lineHeight: 24,
      fontFamily: FF,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    bodyBold: {
      fontWeight: '600',
      color: c.textPrimary,
    },
  });
