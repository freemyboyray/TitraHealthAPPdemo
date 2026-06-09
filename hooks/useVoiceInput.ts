import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { transcribeAudio } from '../lib/whisper';
import { UsageLimitError } from '../lib/openai';
import { ensureAiConsent } from '../lib/ai-consent';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recording = any;

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));

// Recordings shorter than this almost always produce an empty/garbled clip that
// Whisper rejects with a generic 502. Catch it client-side with a friendlier hint.
const MIN_RECORDING_MS = 700;

export function useVoiceInput() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Imperative resource handle — a ref avoids stale-closure reads between the
  // start tap and the stop tap (and lets us clean up synchronously on errors).
  const recordingRef = useRef<Recording | null>(null);

  // Tear down any lingering Recording so a fresh one can be prepared. iOS only
  // allows a single prepared Recording at a time; a leftover from a failed
  // attempt is the usual cause of the intermittent "could not start" error.
  async function unloadCurrent() {
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
    } catch {
      // already stopped/unloaded — ignore
    }
  }

  async function startRecording() {
    setError(null);
    // Voice transcription sends audio to OpenAI — get explicit consent before
    // we even engage the microphone. Bails silently if the user declines.
    if (!(await ensureAiConsent())) return;
    try {
      // Dynamic import to avoid crashing if expo-av not linked
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Audio } = require('expo-av');
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Microphone permission denied');
        return;
      }

      // Clear out any recording left over from a previous failed cycle.
      await unloadCurrent();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // prepare/start can throw if the AVAudioSession is still transitioning
      // from a prior session. Retry once after a short settle — this is the
      // "retry works" case, just done automatically with a fresh Recording.
      let rec: Recording | null = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          rec = new Audio.Recording();
          await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
          await rec.startAsync();
          break;
        } catch (prepErr) {
          try {
            await rec?.stopAndUnloadAsync();
          } catch {
            // ignore — instance never fully prepared
          }
          rec = null;
          if (attempt === 0) {
            await sleep(250);
            continue;
          }
          throw prepErr;
        }
      }

      recordingRef.current = rec;
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      await unloadCurrent();
      setError('Could not start recording. Please try again.');
      console.warn('startRecording error:', e);
    }
  }

  async function stopAndTranscribe(): Promise<string> {
    const rec = recordingRef.current;
    if (!rec) return '';
    setIsRecording(false);
    setIsProcessing(true);
    setError(null);
    try {
      // Capture duration before unloading so we can reject empty clips early.
      let durationMillis = 0;
      try {
        const status = await rec.getStatusAsync();
        durationMillis = status?.durationMillis ?? 0;
      } catch {
        // status unavailable — fall through and let the server decide
      }

      await rec.stopAndUnloadAsync();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Audio } = require('expo-av');
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No audio URI');

      if (durationMillis > 0 && durationMillis < MIN_RECORDING_MS) {
        setError('That recording was too short. Hold a moment longer and try again.');
        return '';
      }

      const text = await transcribeAudio(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return text;
    } catch (e) {
      // Make sure a failed transcription never strands a loaded recording.
      await unloadCurrent();
      if (e instanceof UsageLimitError) {
        setError(
          e.isPremium
            ? `You've hit today's daily limit (${e.limit} voice transcriptions). Please try again tomorrow.`
            : `You've reached your ${e.limit} voice transcriptions for today. Upgrade to Titra Pro for unlimited voice logging.`,
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

  /** Tap-to-toggle: starts recording on first call, stops & transcribes on second. */
  async function toggleRecording(): Promise<string | null> {
    if (isRecording) {
      return await stopAndTranscribe() || null;
    } else {
      await startRecording();
      return null; // recording started, no text yet
    }
  }

  return { isRecording, isProcessing, startRecording, stopAndTranscribe, toggleRecording, error };
}
