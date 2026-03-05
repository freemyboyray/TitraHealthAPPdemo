import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Props ────────────────────────────────────────────────────────────────────

type ScoreRingProps = {
  score: number;
  size: number;
  strokeWidth: number;
  color: string;
  label: string;
  message: string;
  onTap: () => void;
  glowPulse?: boolean;
  ripple?: boolean;
  proteinPulse?: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ScoreRing({
  score,
  size,
  strokeWidth,
  color,
  label,
  message,
  onTap,
  glowPulse = false,
  ripple = false,
  proteinPulse = false,
}: ScoreRingProps) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  // Arc progress
  const animScore = useSharedValue(0);

  // Tap scale
  const ringScale = useSharedValue(1);

  // Micro-interaction: glow opacity
  const glowOpacity = useSharedValue(0);

  // Micro-interaction: ripple radius + opacity
  const rippleR = useSharedValue(r);
  const rippleOpacity = useSharedValue(0);

  // Micro-interaction: stroke width delta for protein pulse
  const strokeDelta = useSharedValue(0);

  // Low recovery pulse
  const lowPulseOpacity = useSharedValue(1);

  // Mount animation
  const isMounted = React.useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      // First mount: ease in from 0
      animScore.value = withTiming(score, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      });
      isMounted.current = true;
    } else {
      // Score update: overshoot then spring
      animScore.value = withSequence(
        withTiming(Math.min(score + 3, 100), { duration: 200 }),
        withSpring(score, { damping: 12, stiffness: 180 }),
      );
    }
  }, [score]);

  // Glow micro-interaction
  useEffect(() => {
    if (glowPulse) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 300 }),
          withTiming(0,   { duration: 300 }),
        ),
        3,
        false,
      );
    }
  }, [glowPulse]);

  // Ripple micro-interaction
  useEffect(() => {
    if (ripple) {
      rippleR.value = r;
      rippleOpacity.value = 0.7;
      rippleR.value = withTiming(r + 20, { duration: 600, easing: Easing.out(Easing.quad) });
      rippleOpacity.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.quad) });
    }
  }, [ripple]);

  // Protein pulse micro-interaction
  useEffect(() => {
    if (proteinPulse) {
      strokeDelta.value = withSequence(
        withTiming(3, { duration: 150 }),
        withTiming(0, { duration: 300 }),
      );
    }
  }, [proteinPulse]);

  // Low score continuous pulse
  useEffect(() => {
    if (score < 40) {
      lowPulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 750 }),
          withTiming(1.0, { duration: 750 }),
        ),
        -1,
        false,
      );
    } else {
      lowPulseOpacity.value = 1;
    }
  }, [score]);

  // Gesture
  const tap = Gesture.Tap()
    .onEnd(() => {
      ringScale.value = withSequence(
        withSpring(1.06, { damping: 10 }),
        withSpring(1.0,  { damping: 14 }),
      );
    })
    .runOnJS(true)
    .onEnd(onTap);

  // Animated props
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animScore.value / 100),
    strokeWidth: strokeWidth + strokeDelta.value,
  }));

  const glowProps = useAnimatedProps(() => ({
    opacity: glowOpacity.value,
    r: r + strokeWidth,
  }));

  const rippleProps = useAnimatedProps(() => ({
    r: rippleR.value,
    opacity: rippleOpacity.value,
  }));

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: lowPulseOpacity.value,
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <GestureDetector gesture={tap}>
        <Animated.View style={[styles.container, { width: size, height: size }, wrapStyle]}>
          <Svg width={size} height={size}>
            {/* Track */}
            <Circle
              cx={cx}
              cy={cy}
              r={r}
              strokeWidth={strokeWidth}
              stroke={color}
              fill="none"
              opacity={0.12}
            />
            {/* Progress arc */}
            <AnimatedCircle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeDasharray={circumference}
              animatedProps={arcProps}
              rotation="-90"
              origin={`${cx}, ${cy}`}
            />
            {/* Ripple circle */}
            <AnimatedCircle
              cx={cx}
              cy={cy}
              fill="none"
              stroke={color}
              strokeWidth={2}
              animatedProps={rippleProps}
            />
            {/* Glow ring */}
            <AnimatedCircle
              cx={cx}
              cy={cy}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth + 6}
              animatedProps={glowProps}
              strokeDasharray={`${2 * Math.PI * (r + strokeWidth)}`}
            />
          </Svg>

          {/* Center text overlay */}
          <View style={[styles.centerText, { width: size, height: size }]} pointerEvents="none">
            <Text style={[styles.scoreNum, { fontSize: size * 0.22, color }]}>{score}</Text>
            <Text style={[styles.labelText, { color }]}>{label}</Text>
          </View>
        </Animated.View>
      </GestureDetector>

      {/* Message below ring */}
      <Text style={[styles.message, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  centerText: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
    opacity: 0.75,
    marginTop: 1,
  },
  message: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    letterSpacing: 0.1,
    opacity: 0.8,
    textAlign: 'center',
  },
});
