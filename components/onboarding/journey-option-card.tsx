import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'System';
const ORANGE = '#FF742A';

type Props = {
  emoji: string;
  label: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
};

// Journey-screen-only option card (see app/onboarding/journey.tsx). Unselected:
// compact grey card showing title + emoji. Selected: grows, fills solid orange
// with white text, and reveals its description. Kept separate from the shared
// OptionPill so the ~14 other onboarding screens are unaffected.
export function JourneyOptionCard({ emoji, label, subtitle, selected, onPress }: Props) {
  const { colors: c } = useAppTheme();
  const s = useMemo(() => createStyles(c), [c]);

  const greyBg = c.bg;
  const greyBorder = c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';

  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, {
      duration: 200,
      easing: Easing.out(Easing.quad),
    });
  }, [selected, progress]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [greyBg, ORANGE]),
    borderColor: interpolateColor(progress.value, [0, 1], [greyBorder, ORANGE]),
    transform: [{ scale: 1 + progress.value * 0.02 }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [c.textPrimary, '#FFFFFF']),
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
    >
      <Animated.View style={[s.card, containerStyle]}>
        <View style={s.row}>
          <Animated.Text style={[s.label, labelStyle]}>{label}</Animated.Text>
          <Text style={s.emoji}>{emoji}</Text>
        </View>
        {selected && <Text style={s.subtitle}>{subtitle}</Text>}
      </Animated.View>
    </Pressable>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 14,
      borderWidth: 1,
      paddingHorizontal: 18,
      paddingVertical: 14,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    label: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      fontFamily: FF,
    },
    emoji: {
      fontSize: 20,
      marginLeft: 10,
    },
    subtitle: {
      fontSize: 15,
      color: '#FFFFFF',
      opacity: 0.92,
      marginTop: 6,
      lineHeight: 20,
      fontFamily: FF,
    },
  });
