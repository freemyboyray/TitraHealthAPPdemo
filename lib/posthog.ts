import PostHog from 'posthog-react-native';

export { PostHogProvider, usePostHog } from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

if (!POSTHOG_API_KEY) {
  console.warn('[PostHog] Missing EXPO_PUBLIC_POSTHOG_API_KEY — analytics disabled');
}

export const posthogConfig = {
  apiKey: POSTHOG_API_KEY,
  options: {
    host: POSTHOG_HOST,
    captureNativeAppLifecycleEvents: true,
    captureDeepLinks: true,
  },
};
