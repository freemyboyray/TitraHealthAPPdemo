import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Text, View, ViewStyle } from 'react-native';
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
  const { isRecording, isProcessing, toggleRecording, error } = useVoiceInput();
  const scale = useSharedValue(1);
  const dim = size === 'sm' ? 36 : 44;
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation while recording
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

  // Elapsed timer while recording
  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(t => t + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  useEffect(() => {
    onProcessingChange?.(isProcessing);
  }, [isProcessing]);

  useEffect(() => {
    if (error) Alert.alert('Voice Input', error);
  }, [error]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  async function handleTap() {
    if (isProcessing) return;
    const text = await toggleRecording();
    if (text) onTranscription(text);
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <>
      {/* Mic trigger button */}
      <View style={[{ alignItems: 'center', gap: 3 }, style]}>
        <Pressable
          onPress={handleTap}
          disabled={isProcessing}
          style={({ pressed }) => ({
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: isProcessing
              ? 'rgba(196,120,75,0.08)'
              : pressed
              ? 'rgba(196,120,75,0.2)'
              : 'rgba(196,120,75,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons
            name={isProcessing ? 'hourglass-outline' : 'mic-outline'}
            size={size === 'sm' ? 18 : 22}
            color={isProcessing ? 'rgba(255,255,255,0.3)' : TERRACOTTA}
          />
        </Pressable>
        <Text
          style={{
            fontSize: 10,
            fontWeight: '700',
            color: isProcessing ? 'rgba(196,120,75,0.5)' : 'rgba(196,120,75,0.7)',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {isProcessing ? 'Processing' : 'Voice'}
        </Text>
      </View>

      {/* Recording overlay modal */}
      <Modal visible={isRecording} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.75)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Animated.View style={[{
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: 'rgba(229,62,62,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: RED,
          }, animStyle]}>
            <Ionicons name="mic" size={56} color={RED} />
          </Animated.View>

          <Text style={{
            color: '#FFFFFF',
            fontSize: 22,
            fontWeight: '700',
            marginTop: 28,
            fontFamily: 'System',
          }}>
            Recording...
          </Text>

          <Text style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 36,
            fontWeight: '300',
            marginTop: 8,
            fontVariant: ['tabular-nums'],
            fontFamily: 'System',
          }}>
            {formatTime(elapsed)}
          </Text>

          <Pressable
            onPress={handleTap}
            style={({ pressed }) => ({
              marginTop: 40,
              paddingHorizontal: 36,
              paddingVertical: 14,
              borderRadius: 28,
              backgroundColor: pressed ? 'rgba(229,62,62,0.9)' : RED,
            })}
          >
            <Text style={{
              color: '#FFFFFF',
              fontSize: 17,
              fontWeight: '700',
              fontFamily: 'System',
            }}>
              Tap to Stop
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
