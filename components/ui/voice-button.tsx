import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { TouchableOpacity, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useVoiceInput } from '../../hooks/useVoiceInput';

type Props = {
  onTranscription(text: string): void;
  onProcessingChange?(processing: boolean): void;
  size?: 'sm' | 'md';
  style?: ViewStyle;
};

const TERRACOTTA = '#C4784B';
const RED = '#E53E3E';

export function VoiceButton({ onTranscription, onProcessingChange, size = 'md', style }: Props) {
  const { isRecording, isProcessing, startRecording, stopAndTranscribe } = useVoiceInput();
  const scale = useSharedValue(1);
  const dim = size === 'sm' ? 36 : 44;

  useEffect(() => {
    if (isRecording) {
      scale.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 500 }), withTiming(1, { duration: 500 })),
        -1,
        false,
      );
    } else {
      scale.value = withTiming(1, { duration: 150 });
    }
  }, [isRecording]);

  useEffect(() => {
    onProcessingChange?.(isProcessing);
  }, [isProcessing]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const iconName = isProcessing
    ? 'hourglass-outline'
    : isRecording
    ? 'mic'
    : 'mic-outline';
  const iconColor = isProcessing
    ? 'rgba(255,255,255,0.3)'
    : isRecording
    ? RED
    : TERRACOTTA;

  async function handlePress() {
    if (isProcessing) return;
    if (isRecording) {
      const text = await stopAndTranscribe();
      if (text) onTranscription(text);
    } else {
      await startRecording();
    }
  }

  return (
    <Animated.View style={[animStyle, style]}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.75}
        disabled={isProcessing}
        style={{
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: isRecording ? 'rgba(229,62,62,0.12)' : 'rgba(196,120,75,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={iconName as any} size={size === 'sm' ? 18 : 22} color={iconColor} />
      </TouchableOpacity>
    </Animated.View>
  );
}
