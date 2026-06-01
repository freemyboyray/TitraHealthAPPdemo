import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from '@/contexts/theme-context';

const { width: SW, height: SH } = Dimensions.get('window');
const FF = 'System';

// Theme-specific colors
const THEME = {
  dark: {
    bg: '#1A1410',
    gradient: ['#1A1410', '#2A1E14', '#1A1410'] as [string, string, string],
    overlay: ['transparent', 'rgba(26,20,16,0.6)', 'rgba(26,20,16,0.95)', '#1A1410'] as [string, string, string, string],
    text: '#FFFFFF',
    statusBar: 'light' as const,
  },
  light: {
    bg: '#F5F3EF',
    gradient: ['#C4785A', '#DC8E5A', '#EDAB78', '#F5F3EF'] as [string, string, string, string],
    overlay: ['transparent', 'rgba(245,243,239,0.5)', 'rgba(245,243,239,0.92)', '#F5F3EF'] as [string, string, string, string],
    text: '#1C1816',
    statusBar: 'dark' as const,
  },
};

// ── Photo card data ──
// Each card: source, width, height, x (% of screen width), y (absolute from top),
// rotation in degrees. Arranged in a scattered mosaic.
const PHOTOS: { src: any; w: number; h: number; x: number; y: number; rot: number }[] = [
  { src: require('@/assets/images/welcome/hiking-trail.jpg'),     w: 130, h: 175, x: 0.52, y: 0,    rot: 3 },
  { src: require('@/assets/images/welcome/healthy-bowl.jpg'),     w: 120, h: 150, x: 0.02, y: 30,   rot: -4 },
  { src: require('@/assets/images/welcome/beach-run.jpg'),        w: 125, h: 160, x: 0.74, y: 50,   rot: 2 },
  { src: require('@/assets/images/welcome/cooking-together.jpg'), w: 140, h: 170, x: 0.30, y: 200,  rot: -2 },
  { src: require('@/assets/images/welcome/friends-dinner.jpg'),   w: 115, h: 150, x: 0.68, y: 240,  rot: 4 },
  { src: require('@/assets/images/welcome/stretch-field.jpg'),    w: 130, h: 165, x: 0.05, y: 260,  rot: -3 },
  { src: require('@/assets/images/welcome/yoga-grass.jpg'),       w: 120, h: 155, x: 0.42, y: 420,  rot: 3 },
  { src: require('@/assets/images/welcome/walking-dogs.jpg'),     w: 125, h: 160, x: 0.08, y: 460,  rot: -2 },
];

// Height of one set of photos — must match where the last photo ends so the
// second (duplicate) set tiles seamlessly. Last photo: y=460 + h=160 = 620.
const MOSAIC_H = 620;

const HEADLINES = [
  { top: 'Welcome to', accent: 'Titra Health' },
  { top: 'The Smartest Way to Track Your', accent: 'GLP-1 Journey' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors: c } = useAppTheme();
  const t = c.isDark ? THEME.dark : THEME.light;

  // ── Continuous upward carousel ──
  // Starts offset upward so photos already fill the screen, then scrolls
  // upward by one full MOSAIC_H before resetting seamlessly.
  const startOffset = -120;
  const drift = useRef(new Animated.Value(startOffset)).current;
  useEffect(() => {
    const scroll = () => {
      drift.setValue(startOffset);
      Animated.timing(drift, {
        toValue: startOffset - MOSAIC_H,
        duration: 45000,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) scroll();
      });
    };
    scroll();
  }, [drift]);

  // ── Text fade animation ──
  const textIdx = useRef(0);
  const textOpacity = useRef(new Animated.Value(1)).current;
  const [headline, setHeadline] = useState(HEADLINES[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        textIdx.current = (textIdx.current + 1) % HEADLINES.length;
        setHeadline(HEADLINES[textIdx.current]);
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[s.root, { backgroundColor: t.bg }]}>
      <StatusBar style={t.statusBar} />

      {/* Gradient background */}
      <LinearGradient
        colors={t.gradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Floating photo mosaic — rendered twice for seamless loop */}
      <Animated.View
        style={[s.mosaicContainer, { height: MOSAIC_H * 2, transform: [{ translateY: drift }] }]}
        pointerEvents="none"
      >
        {/* First set */}
        {PHOTOS.map((p, i) => (
          <Image
            key={`a-${i}`}
            source={p.src}
            style={[
              s.photoCard,
              {
                width: p.w,
                height: p.h,
                left: p.x * SW,
                top: p.y,
                transform: [{ rotate: `${p.rot}deg` }],
              },
              !c.isDark && s.photoCardLight,
            ]}
            resizeMode="cover"
          />
        ))}
        {/* Second set (offset by MOSAIC_H) */}
        {PHOTOS.map((p, i) => (
          <Image
            key={`b-${i}`}
            source={p.src}
            style={[
              s.photoCard,
              {
                width: p.w,
                height: p.h,
                left: p.x * SW,
                top: p.y + MOSAIC_H,
                transform: [{ rotate: `${p.rot}deg` }],
              },
              !c.isDark && s.photoCardLight,
            ]}
            resizeMode="cover"
          />
        ))}
      </Animated.View>

      {/* Gradient overlay for text readability */}
      <LinearGradient
        colors={t.overlay}
        locations={[0, 0.3, 0.55, 0.75]}
        style={s.overlay}
        pointerEvents="none"
      />

      {/* Content */}
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1 }} />

        {/* Headline text with fade animation */}
        <Animated.View style={[s.textContainer, { opacity: textOpacity }]}>
          <Text style={[s.headline, { color: t.text }]}>
            {headline.top}{'\n'}
            <Text style={s.headlineAccent}>{headline.accent}</Text>
          </Text>
        </Animated.View>

        {/* Get Started button */}
        <Pressable
          style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          onPress={() => router.navigate('/auth/sign-in' as any)}
          accessibilityLabel="Get Started"
          accessibilityRole="button"
        >
          <Text style={s.ctaBtnText}>Get Started</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A1410',
  },
  mosaicContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MOSAIC_H,
  },
  photoCard: {
    position: 'absolute',
    borderRadius: 16,
    overflow: 'hidden',
  },
  photoCardLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SH * 0.65,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 24,
  },
  textContainer: {
    marginBottom: 32,
  },
  headline: {
    fontSize: 34,
    fontWeight: '300',
    color: '#FFFFFF',
    lineHeight: 42,
    letterSpacing: -0.5,
    fontFamily: FF,
    textAlign: 'center',
  },
  headlineAccent: {
    color: '#FF742A',
    fontWeight: '800',
  },
  ctaBtn: {
    backgroundColor: '#FF742A',
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  ctaBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FF,
    letterSpacing: -0.3,
  },
});
