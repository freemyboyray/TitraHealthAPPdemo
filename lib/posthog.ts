export { PostHogProvider, usePostHog } from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

if (!POSTHOG_API_KEY) {
  console.warn('[PostHog] Missing EXPO_PUBLIC_POSTHOG_API_KEY — analytics disabled');
}

// Config is spread onto <PostHogProvider {...posthogConfig}>. `apiKey` and
// `autocapture` are provider PROPS; everything else lives under `options`.
export const posthogConfig = {
  apiKey: POSTHOG_API_KEY,

  // Autocapture = automatic events with no manual instrumentation.
  // We keep touch capture (which button/element was tapped) but DISABLE the
  // built-in screen capture: our own <ScreenTracker> in _layout already calls
  // posthog.screen(pathname) with clean expo-router paths, so leaving this on
  // would double-count every screen view.
  autocapture: {
    captureTouches: true,
    captureScreens: false,
  },

  options: {
    host: POSTHOG_HOST,
    // App opened / backgrounded / installed / updated — engagement + retention.
    captureNativeAppLifecycleEvents: true,
    captureDeepLinks: true,

    // ── Session Replay ───────────────────────────────────────────────────
    // Records real user sessions you can play back. This is a HEALTH app, so
    // masking defaults to ON: every text input and image is obscured in the
    // recording (PHI never leaves the device in the replay). Requires a dev/
    // production build — Session Replay does NOT run in Expo Go.
    enableSessionReplay: true,
    sessionReplayConfig: {
      maskAllTextInputs: true, // hide everything typed (weights, notes, doses…)
      maskAllImages: true,     // hide progress photos, food photos, etc.
      captureLog: true,        // Android: include console logs in the replay
      captureNetworkTelemetry: true, // iOS: timing of network calls (no bodies)
      // sampleRate: 1.0,      // record 100% of sessions. Lower (e.g. 0.5) later
                               // to stay inside the free-tier recording quota.
    },

    // ── Error Tracking ───────────────────────────────────────────────────
    // Auto-capture crashes and unhandled promise rejections so they show up in
    // PostHog → Error tracking with a stack trace. We intentionally do NOT
    // forward console.warn/error as errors — too noisy and they can contain
    // PHI-adjacent strings.
    errorTracking: {
      autocapture: {
        uncaughtExceptions: true,
        unhandledRejections: true,
      },
    },
  },
};
