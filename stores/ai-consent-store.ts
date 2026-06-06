import { create } from 'zustand';

/**
 * Drives the point-of-first-use AI consent modal. The modal component
 * (`components/ai-consent-modal.tsx`) is mounted once at the app root and
 * subscribes to this store; `lib/ai-consent.ts#ensureAiConsent()` opens it and
 * awaits the user's choice.
 *
 * Kept separate from the persisted `preferences-store` because this is
 * transient UI state (a one-shot promise), not a saved preference.
 */
type AiConsentStore = {
  visible: boolean;
  _resolve: ((granted: boolean) => void) | null;
  /** Show the modal and resolve true (Allow) or false (Not now). */
  open: () => Promise<boolean>;
  /** Called by the modal's Allow button. */
  allow: () => void;
  /** Called by the modal's Not-now button / dismiss. */
  deny: () => void;
};

export const useAiConsentStore = create<AiConsentStore>((set, get) => ({
  visible: false,
  _resolve: null,
  open: () =>
    new Promise<boolean>((resolve) => {
      // If a prompt is somehow already open, resolve the stale one as denied.
      get()._resolve?.(false);
      set({ visible: true, _resolve: resolve });
    }),
  allow: () => {
    get()._resolve?.(true);
    set({ visible: false, _resolve: null });
  },
  deny: () => {
    get()._resolve?.(false);
    set({ visible: false, _resolve: null });
  },
}));
