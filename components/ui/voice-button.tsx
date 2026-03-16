import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Alert, Pressable, Text, ViewStyle } from 'react-native';
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
  const { isRecording, isProcessing, startRecording, stopAndTranscribe, error } = useVoiceInput();
  const scale = useSharedValue(1);
  const dim = size === 'sm' ? 36 : 44;
  const activeRef = useRef(false);

  useEffect(() => {
    if (isRecording) {
      scale.value = withRepeat(
        withSequence(withTiming(1.18, { duration: 450 }), withTiming(1, { duration: 450 })),
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

  // Surface recording/transcription errors
  useEffect(() => {
    if (error) {
      Alert.alert('Voice Input', error);
    }
  }, [error]);

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

  const labelText = isProcessing
    ? 'Processing'
    : isRecording
    ? 'Release'
    : 'Hold';

  async function handlePressIn() {
    if (isProcessing) return;
    activeRef.current = true;
    await startRecording();
  }

  async function handlePressOut() {
    if (!activeRef.current) return;
    activeRef.current = false;
    const text = await stopAndTranscribe();
    if (text) onTranscription(text);
  }

  return (
    <Animated.View style={[{ alignItems: 'center', gap: 3 }, style, animStyle]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isProcessing}
        style={({ pressed }) => ({
          width: dim,
          height: dim,
          borderRadius: dim / 2,
          backgroundColor: isRecording
            ? 'rgba(229,62,62,0.15)'
            : pressed
            ? 'rgba(196,120,75,0.2)'
            : 'rgba(196,120,75,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Ionicons name={iconName as any} size={size === 'sm' ? 18 : 22} color={iconColor} />
      </Pressable>
      <Text
        style={{
          fontSize: 8,
          fontWeight: '700',
          color: isRecording ? RED : 'rgba(196,120,75,0.7)',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {labelText}
      </Text>
    </Animated.View>
  );
}
