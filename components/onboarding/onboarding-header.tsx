import React, { useMemo } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { ChevronLeft } from 'lucide-react-native';

type Props = {
  step: number;
  total: number;
  onBack?: () => void;
};

export function OnboardingHeader({ step, total, onBack }: Props) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const s = useMemo(() => createStyles(colors), [colors]);

  const progressStyle = useAnimatedStyle(() => ({
    width: withTiming(`${(step / total) * 100}%` as `${number}%`, { duration: 300 }),
  }));

  // Hide the back arrow when there's nothing to pop to — after sign-in we reach
  // onboarding via router.replace(), so the first screen is the stack root and
  // router.back() would fire an unhandled GO_BACK and dead-end the tap.
  const showBack = !!onBack && router.canGoBack();

  return (
    <View style={s.container}>
      <View style={s.row}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
            <ChevronLeft size={24} color={colors.isDark ? '#FFFFFF' : 'rgba(0,0,0,0.7)'} />
          </TouchableOpacity>
        ) : (
          <View style={s.backPlaceholder} />
        )}
      </View>
      <View style={s.trackContainer}>
        <View style={s.track}>
          <Animated.View style={[s.fill, progressStyle]} />
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    container: {
      paddingTop: 8,
      paddingBottom: 16,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      minHeight: 32,
    },
    backBtn: {
      padding: 4,
      backgroundColor: w(0.15),
      borderRadius: 18,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backPlaceholder: {
      width: 32,
      height: 32,
    },
    trackContainer: {
      paddingHorizontal: 0,
    },
    track: {
      height: 3,
      backgroundColor: w(0.12),
      borderRadius: 2,
      overflow: 'hidden',
    },
    fill: {
      height: 3,
      backgroundColor: '#FF742A',
      borderRadius: 2,
    },
  });
};
