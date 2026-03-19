import { useFocusEffect } from 'expo-router';
import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = { children: React.ReactNode; style?: object };

export function TabScreenWrapper({ children, style }: Props) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.97);

  useFocusEffect(
    useCallback(() => {
      opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      scale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      return () => {
        opacity.value = 0;   // instant reset on blur
        scale.value = 0.97;
      };
    }, []),
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.fill, animStyle, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
