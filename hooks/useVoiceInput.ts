import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { transcribeAudio } from '../lib/whisper';
import { UsageLimitError } from '../lib/openai';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recording = any;

export function useVoiceInput() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingRef, setRecordingRef] = useState<Recording | null>(null);

  async function startRecording() {
    setError(null);
    try {
      // Dynamic import to avoid crashing if expo-av not linked
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Audio } = require('expo-av');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microphone permission denied');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecordingRef(rec);
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      setError('Could not start recording');
      console.warn('startRecording error:', e);
    }
  }

  async function stopAndTranscribe(): Promise<string> {
    if (!recordingRef) return '';
    setIsRecording(false);
    setIsProcessing(true);
    setError(null);
    try {
      await recordingRef.stopAndUnloadAsync();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.getURI();
      if (!uri) throw new Error('No audio URI');
      const text = await transcribeAudio(uri);
      setRecordingRef(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return text;
    } catch (e) {
      if (e instanceof UsageLimitError) {
        setError(
          `You've reached your ${e.limit} voice transcriptions for today. Upgrade to Titra Pro for unlimited voice logging.`,
        );
      } else {
        setError('Transcription failed');
      }
      console.warn('stopAndTranscribe error:', e);
      return '';
    } finally {
      setIsProcessing(false);
    }
  }

  return { isRecording, isProcessing, startRecording, stopAndTranscribe, error };
}
