import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { ChevronLeft } from 'lucide-react-native';
import { useAppTheme } from '@/contexts/theme-context';
import { useProfile } from '@/contexts/profile-context';
import { cardElevation, type AppColors } from '@/constants/theme';

const FONT = 'System';
const { width: SW } = Dimensions.get('window');

// Value-proposition carousel shown after the name screen (/auth/get-started).
// Three slides, manual Next-to-advance (swipe also works). Finishing (or Skip)
// persists the collected name into the onboarding draft and goes straight into
// the /onboarding flow (starting with the research screen). Account creation is
// a later screen, so we no longer route through /auth/sign-in here.
//
// PHOTOS: currently scaffolded with existing welcome-screen images as
// placeholders so the screen runs today. Swap in the final shots at
// assets/images/intro/{step-1,step-2,step-3}.jpg — generation prompts for
// each are in the handoff notes. line2 renders in the orange accent.
const SLIDES: {
  img: any;
  line1: string;
  line2: string;
  body: string;
}[] = [
  {
    img: require('@/assets/images/intro/step-1.jpg'),
    line1: 'You showed up.',
    line2: "That's the hardest part.",
    body: 'Titra takes it from here.',
  },
  {
    img: require('@/assets/images/intro/step-2.jpg'),
    line1: 'Your body.',
    line2: 'Your pace.',
    body: 'Track your doses, energy, and how you feel. See what actually works for you.',
  },
  {
    img: require('@/assets/images/intro/step-3.jpg'),
    line1: 'Always know',
    line2: 'your next step.',
    body: 'As your dose changes, your plan changes with you.',
  },
];

const LAST = SLIDES.length - 1;

export default function IntroScreen() {
  const router = useRouter();
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);

  // The name collected on /auth/get-started arrives as a route param. Persist it
  // into the onboarding draft (draft.username) so it survives into account
  // creation (a later screen) and pre-fills the onboarding name step. Account
  // sign-up no longer happens here — the slides lead straight into /onboarding.
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { updateDraft } = useProfile();

  const goToOnboarding = () => {
    if (typeof name === 'string' && name.trim()) {
      updateDraft({ username: name.trim() });
    }
    router.navigate('/onboarding' as any);
  };

  const scrollRef = useRef<Animated.FlatList<any>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);

  // Respect Reduce Motion — jump instead of glide.
  const reduceMotion = useRef(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) reduceMotion.current = v;
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      reduceMotion.current = v;
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const goTo = (i: number) => {
    scrollRef.current?.scrollToOffset({
      offset: i * SW,
      animated: !reduceMotion.current,
    });
    setIndex(i);
  };

  const onNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (index < LAST) {
      goTo(index + 1);
    } else {
      goToOnboarding();
    }
  };

  const onBack = () => {
    if (index > 0) {
      goTo(index - 1);
    } else {
      router.back();
    }
  };

  const onSkip = () => goToOnboarding();

  const onMomentumEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (i !== index) setIndex(i);
  };

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <StatusBar style={c.statusBar} />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Top bar: back + skip */}
        <View style={s.topBar}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={26} color={c.textPrimary} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            onPress={onSkip}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text style={s.skip}>Skip</Text>
          </Pressable>
        </View>

        {/* Slides */}
        <Animated.FlatList
          ref={scrollRef}
          data={SLIDES}
          keyExtractor={(_, i) => `slide-${i}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false },
          )}
          onMomentumScrollEnd={onMomentumEnd}
          scrollEventThrottle={16}
          renderItem={({ item }) => (
            <View style={s.slide}>
              {/* Photo mat — warm framed card, echoes the reference layout */}
              <View style={[s.mat, cardElevation(c.isDark)]}>
                <Image source={item.img} style={s.photo} resizeMode="cover" />
                <LinearGradient
                  colors={['transparent', c.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(40,30,20,0.10)']}
                  style={s.photoWash}
                  pointerEvents="none"
                />
              </View>

              {/* Headline */}
              <Text style={s.headline} accessibilityRole="header">
                {item.line1}
                {'\n'}
                <Text style={s.headlineAccent}>{item.line2}</Text>
              </Text>

              {/* Body */}
              <Text style={s.body}>{item.body}</Text>
            </View>
          )}
        />

        {/* Page dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => {
            const width = scrollX.interpolate({
              inputRange: [(i - 1) * SW, i * SW, (i + 1) * SW],
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange: [(i - 1) * SW, i * SW, (i + 1) * SW],
              outputRange: [0.28, 1, 0.28],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={`dot-${i}`}
                style={[s.dot, { width, opacity, backgroundColor: c.orange }]}
              />
            );
          })}
        </View>

        {/* Next / Get Started */}
        <Pressable
          style={({ pressed }) => [s.cta, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          onPress={onNext}
          accessibilityRole="button"
          accessibilityLabel={index === LAST ? 'Get Started' : 'Next'}
        >
          <Text style={s.ctaText}>{index === LAST ? 'Get Started' : 'Next'}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const MAT = SW - 56; // 28pt page padding each side
const PHOTO = MAT - 28; // 14pt mat padding each side

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    safe: { flex: 1 },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 8,
      minHeight: 44,
    },
    backBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      marginLeft: -8,
    },
    skip: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textSecondary,
      fontFamily: FONT,
      letterSpacing: -0.2,
    },

    // One full-width page
    slide: {
      width: SW,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },

    mat: {
      width: MAT,
      height: MAT,
      borderRadius: 32,
      padding: 14,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
      borderWidth: c.isDark ? 1 : 0,
      borderColor: c.cardBorder,
      marginBottom: 40,
    },
    photo: {
      width: PHOTO,
      height: PHOTO,
      borderRadius: 22,
    },
    photoWash: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 14,
      height: PHOTO * 0.4,
      borderBottomLeftRadius: 22,
      borderBottomRightRadius: 22,
    },

    headline: {
      fontSize: 30,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: FONT,
      lineHeight: 38,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 16,
    },
    headlineAccent: {
      color: c.orange,
    },
    body: {
      fontSize: 16,
      fontWeight: '400',
      color: c.textSecondary,
      fontFamily: FONT,
      lineHeight: 24,
      textAlign: 'center',
      paddingHorizontal: 8,
    },

    dots: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 8,
      marginBottom: 28,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },

    cta: {
      height: 56,
      borderRadius: 28,
      backgroundColor: c.orange,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 28,
      marginBottom: 8,
    },
    ctaText: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      fontFamily: FONT,
      letterSpacing: -0.3,
    },
  });
