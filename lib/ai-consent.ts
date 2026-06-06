import { usePreferencesStore } from '@/stores/preferences-store';
import { useAiConsentStore } from '@/stores/ai-consent-store';

/**
 * Gate user-initiated AI features behind explicit consent.
 *
 * Returns true if the user has already granted AI data consent. Otherwise it
 * shows the point-of-first-use consent modal and resolves to the user's choice,
 * persisting consent when they tap Allow.
 *
 * Call this from interactive entry points (Ask AI, voice, food AI) BEFORE
 * kicking off the request, so the user sees a clear prompt instead of a thrown
 * `DataConsentError`. The proxy-level `requireAiConsent()` in lib/openai.ts and
 * lib/whisper.ts remains the hard backstop that guarantees no data is sent
 * without consent even if an entry point forgets to call this.
 */
export async function ensureAiConsent(): Promise<boolean> {
  if (usePreferencesStore.getState().aiDataConsent) return true;
  const granted = await useAiConsentStore.getState().open();
  if (granted) {
    usePreferencesStore.getState().setAiDataConsent(true);
  }
  return granted;
}
