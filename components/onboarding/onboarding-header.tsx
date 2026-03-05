import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

type Props = {
  step: number;
  total: number;
  onBack?: () => void;
};

export function OnboardingHeader({ step, total, onBack }: Props) {
  const progressStyle = useAnimatedStyle(() => ({
    width: withTiming(`${(step / total) * 100}%` as `${number}%`, { duration: 300 }),
  }));

  return (
    <View style={s.container}>
      <View style={s.row}>
        {step > 1 && onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={12} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
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

const s = StyleSheet.create({
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
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
  },
});
