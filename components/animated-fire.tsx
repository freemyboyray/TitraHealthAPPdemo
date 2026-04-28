import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Ellipse } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

// Duolingo-style flat flame colors
const OUTER = '#F0932B';   // warm orange body
const INNER = '#F7C948';   // golden yellow core
const BASE  = '#FDE8A0';   // light cream base

const ease = Easing.inOut(Easing.sin);

type Props = {
  size: number;
  streak?: number;
  showNumber?: boolean;
  active?: boolean;
};

export function AnimatedFire({ size, streak = 0, showNumber = false, active = true }: Props) {
  // Core glow — gentle opacity breathing
  const coreOpacity = useSharedValue(1);
  // Core size — subtle scale that follows opacity
  const coreScale = useSharedValue(1);
  // Hot center — slow fade in/out
  const hotOpacity = useSharedValue(0);
  // Tip — gentle horizontal sway via translateX
  const tipX = useSharedValue(0);
  // Base glow
  const baseOpacity = useSharedValue(0.8);

  useEffect(() => {
    if (!active) return;

    // Core glow — SLOW, smooth breathing. Never goes below 0.6 so it
    // always looks lit. Long durations (800-1400ms) prevent jittery feel.
    coreOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6,  { duration: 1200, easing: ease }),
        withTiming(1,    { duration: 1000, easing: ease }),
        withTiming(0.7,  { duration: 1400, easing: ease }),
        withTiming(0.95, { duration: 800,  easing: ease }),
        withTiming(0.65, { duration: 1100, easing: ease }),
        withTiming(1,    { duration: 900,  easing: ease }),
      ),
      -1, false,
    );

    // Core scale — very subtle, mirrors opacity rhythm.
    // Grows to 1.04 at brightest, shrinks to 0.95 at dimmest.
    coreScale.value = withRepeat(
      withSequence(
        withTiming(0.95, { duration: 1200, easing: ease }),
        withTiming(1.04, { duration: 1000, easing: ease }),
        withTiming(0.96, { duration: 1400, easing: ease }),
        withTiming(1.02, { duration: 800,  easing: ease }),
        withTiming(0.95, { duration: 1100, easing: ease }),
        withTiming(1.03, { duration: 900,  easing: ease }),
      ),
      -1, false,
    );

    // Hot center — very slow, gentle appearance. Stays mostly invisible,
    // occasionally blooms into view and fades back out.
    hotOpacity.value = withDelay(1000, withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1500, easing: ease }),
        withTiming(0,   { duration: 2000, easing: ease }),
        withTiming(0,   { duration: 1500 }), // rest
        withTiming(0.4, { duration: 1800, easing: ease }),
        withTiming(0,   { duration: 1200, easing: ease }),
        withTiming(0,   { duration: 2000 }), // longer rest
      ),
      -1, false,
    ));

    // Tip sway — gentle horizontal drift. Uses translateX instead of
    // rotation so the tip slides naturally like a candle in a draft.
    // Asymmetric timing and distances so it never feels mechanical.
    tipX.value = withDelay(300, withRepeat(
      withSequence(
        withTiming(1.5,  { duration: 1800, easing: ease }),
        withTiming(-2,   { duration: 2200, easing: ease }),
        withTiming(0.5,  { duration: 1400, easing: ease }),
        withTiming(-1.2, { duration: 1600, easing: ease }),
        withTiming(1.8,  { duration: 2000, easing: ease }),
        withTiming(-0.5, { duration: 1200, easing: ease }),
        withTiming(0,    { duration: 1000, easing: ease }),
      ),
      -1, false,
    ));

    // Base glow — slow warm pulse
    baseOpacity.value = withRepeat(
      withSequence(
        withTiming(1,   { duration: 1800, easing: ease }),
        withTiming(0.6, { duration: 2200, easing: ease }),
        withTiming(0.9, { duration: 1400, easing: ease }),
        withTiming(0.5, { duration: 1600, easing: ease }),
      ),
      -1, false,
    );
  }, [active]);

  const coreStyle = useAnimatedStyle(() => ({
    opacity: coreOpacity.value,
    transform: [{ scale: coreScale.value }],
  }));

  const hotStyle = useAnimatedStyle(() => ({
    opacity: hotOpacity.value,
  }));

  const tipStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tipX.value }],
  }));

  const baseStyle = useAnimatedStyle(() => ({
    opacity: baseOpacity.value,
  }));

  const w = size;
  const h = size * (100 / 80);
  const numberSize = Math.max(11, size * 0.28);
  const numberTop = h * 0.44;

  if (!active) {
    return (
      <View style={[styles.container, { width: w, height: h }]}>
        <Svg width={w} height={h} viewBox="0 0 80 100">
          <Path
            d="M40 8 C40 8 44 16 48 22 C54 32 62 38 66 50 C70 62 68 74 60 82 C54 88 48 90 40 90 C32 90 26 88 20 82 C12 74 10 62 14 50 C18 38 26 32 32 22 C36 16 40 8 40 8Z"
            fill="#D5D5D5"
          />
        </Svg>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: w, height: h }]}>

      {/* Base glow — pulsing warm ellipse at bottom */}
      <Animated.View style={[{ position: 'absolute', width: w, height: h }, baseStyle]}>
        <Svg width={w} height={h} viewBox="0 0 80 100">
          <Ellipse cx="40" cy="88" rx="18" ry="7" fill={BASE} />
        </Svg>
      </Animated.View>

      {/* Outer flame body — static anchor */}
      <Svg width={w} height={h} viewBox="0 0 80 100" style={{ position: 'absolute' }}>
        <Path
          d="M40 8 C40 8 44 16 48 22 C54 32 62 38 66 50 C70 62 68 74 60 82 C54 88 48 90 40 90 C32 90 26 88 20 82 C12 74 10 62 14 50 C18 38 26 32 32 22 C36 16 40 8 40 8Z"
          fill={OUTER}
        />
      </Svg>

      {/* Inner core — slow opacity + scale breathing */}
      <Animated.View style={[{ position: 'absolute', width: w, height: h }, coreStyle]}>
        <Svg width={w} height={h} viewBox="0 0 80 100">
          <Path
            d="M40 40 C40 40 43 46 46 52 C49 58 50 64 48 70 C46 76 44 78 40 80 C36 78 34 76 32 70 C30 64 31 58 34 52 C37 46 40 40 40 40Z"
            fill={INNER}
          />
        </Svg>
      </Animated.View>

      {/* Hot center — occasional bright bloom */}
      <Animated.View style={[{ position: 'absolute', width: w, height: h }, hotStyle]}>
        <Svg width={w} height={h} viewBox="0 0 80 100">
          <Path
            d="M40 52 C40 52 42 56 43 60 C44 64 43 68 40 70 C37 68 36 64 37 60 C38 56 40 52 40 52Z"
            fill="#FFF3C4"
          />
        </Svg>
      </Animated.View>

      {/* Tip — gentle horizontal drift like a candle */}
      <Animated.View style={[{ position: 'absolute', width: w, height: h }, tipStyle]}>
        <Svg width={w} height={h} viewBox="0 0 80 100">
          <Path
            d="M40 8 C40 8 42 13 43 17 C44 21 44 23 43 25 C42 27 41 27 40 27 C39 27 38 27 37 25 C36 23 36 21 37 17 C38 13 40 8 40 8Z"
            fill="#E8872A"
            opacity={0.6}
          />
        </Svg>
      </Animated.View>

      {/* Streak number */}
      {showNumber && streak > 0 && (
        <View style={[styles.numberWrap, { width: w, top: numberTop }]}>
          <Text style={[styles.number, { fontSize: numberSize }]}>{streak}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  number: {
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'System',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
