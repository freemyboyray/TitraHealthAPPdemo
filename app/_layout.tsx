import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// expo-notifications requires a dev build; guard so Expo Go doesn't crash.
let Notifications: typeof import('expo-notifications') | undefined;
try { Notifications = require('expo-notifications'); } catch {}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PostHogProvider, usePostHog, posthogConfig } from '@/lib/posthog';

import { MOCK_PROFILE } from '@/constants/mock-profile';
import { cancelAllReminders } from '@/lib/notifications';
import { HealthProvider } from '@/contexts/health-data';
import { ProfileProvider, useProfile } from '@/contexts/profile-context';
import { AppThemeProvider, useAppTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/user-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useLogStore } from '@/stores/log-store';
import { useMedicationsStore } from '@/stores/medications-store';
import { syncNotifications } from '@/stores/reminders-store';
// react-native-iap requires a dev build; guard so Expo Go doesn't crash.
let iapModule: typeof import('@/lib/storekit') | undefined;
try { iapModule = require('@/lib/storekit'); } catch {}
import { AiChatOverlay } from '@/components/ai-chat-overlay';
import { AiConsentModal } from '@/components/ai-consent-modal';
import { TourProvider } from '@/contexts/tour-context';
import { TourOverlay } from '@/components/tour/tour-overlay';
import { HealthSyncToast } from '@/components/ui/health-sync-toast';
import { AchievementCongrats } from '@/components/achievement-congrats';
import { PhotoMilestonePrompt } from '@/components/photo-milestone-prompt';
import * as StoreReview from 'expo-store-review';
import { useAchievementDetector } from '@/hooks/useAchievementDetector';
import { useReviewPrompt } from '@/hooks/useReviewPrompt';

export const unstable_settings = {
  anchor: 'index',
};

function AppWithHealth({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const { hrv, restingHR, sleepHours, spo2, respiratoryRate } = useHealthKitStore();
  const liveWearable = {
    ...(hrv != null && { hrvMs: hrv }),
    ...(restingHR != null && { restingHR }),
    ...(sleepHours != null && { sleepMinutes: Math.round(sleepHours * 60) }),
    ...(spo2 != null && { spo2Pct: spo2 }),
    ...(respiratoryRate != null && { respRateRpm: respiratoryRate }),
  };
  return (
    <HealthProvider profile={profile ?? MOCK_PROFILE} wearable={liveWearable}>
      {children}
    </HealthProvider>
  );
}

// Lives inside ProfileProvider so it can call resetProfile() on sign-out.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { setSession, setSessionLoaded, loadProfile } = useUserStore();
  const { resetProfile, reloadProfile } = useProfile();
  const loadSubscription = useSubscriptionStore((s) => s.loadSubscription);
  const router = useRouter();
  const posthog = usePostHog();

  // Track app opens for review prompt eligibility (once per session) and advance
  // the daily streak. updateStreakOnOpen is a no-op if already counted today, so
  // it's safe to fire on every launch; it continues the streak from yesterday,
  // resets to 1 after a gap, or holds steady within the same day.
  useEffect(() => {
    const prefs = usePreferencesStore.getState();
    prefs.incrementAppOpen();
    prefs.updateStreakOnOpen();
  }, []);

  // Restore food-database (FatSecret) consent for returning users on a fresh
  // install/device so core food search keeps working. AI (OpenAI) consent is
  // deliberately NOT auto-granted here: under App Store Guideline 5.1.1(i) it
  // must be explicitly granted by the user (onboarding opt-in or the
  // point-of-use prompt), and `ai_accepted_at` only means the user READ the AI
  // disclosure — not that they consented to send data. Auto-granting it would
  // override a user who tapped "Not now".
  useEffect(() => {
    async function migrateConsent() {
      const prefs = usePreferencesStore.getState();
      if (prefs.foodDbConsent) {
        useUserStore.setState({ consentMigrationDone: true });
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        useUserStore.setState({ consentMigrationDone: true });
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('ai_accepted_at')
        .eq('id', user.id)
        .single();
      if (data?.ai_accepted_at) {
        prefs.setFoodDbConsent(true);
      }
      useUserStore.setState({ consentMigrationDone: true });
    }
    migrateConsent().catch(() => {
      useUserStore.setState({ consentMigrationDone: true });
    });
  }, []);

  // Initialize IAP connection on mount (no-op in Expo Go — native module unavailable)
  useEffect(() => {
    if (!iapModule) return;
    iapModule.initIAP();
    return () => iapModule?.teardownIAP();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile();
        reloadProfile();
        loadSubscription();
        useMedicationsStore.getState().fetchMedications();
        // Identify user for analytics — no PHI, only account-level metadata
        if (posthog && session.user) {
          posthog.identify(session.user.id, {
            ...(session.user.email && { email: session.user.email }),
          });
        }
      } else if (_event === 'SIGNED_OUT') {
        cancelAllReminders().catch(() => {});
        AsyncStorage.clear().catch(() => {});
        resetProfile();
        usePreferencesStore.getState().reset();
        useLogStore.getState().resetAll();
        useMedicationsStore.getState().resetMedications();
        posthog?.reset();
        router.replace('/auth/welcome');
      }
    });

    // Retry wrapper for transient network failures on app start / simulator reload.
    // Without this, a single failed fetch signs the user out even though the token
    // is perfectly valid — the server was just momentarily unreachable.
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1500;

    async function initSession(attempt = 0): Promise<void> {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || !user) {
            // Distinguish network errors from genuine auth failures.
            // Auth errors have HTTP status codes (401, 403); network errors don't.
            const isNetworkError = error && !('status' in error && (error as any).status >= 400);
            if (isNetworkError && attempt < MAX_RETRIES) {
              await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
              return initSession(attempt + 1);
            }
            // Genuine auth failure — clear everything
            await AsyncStorage.clear().catch(() => {});
            await supabase.auth.signOut().catch(() => {});
            setSession(null);
          } else {
            setSession(session);
            loadProfile();
            reloadProfile();
            loadSubscription();
            useMedicationsStore.getState().fetchMedications();
            if (posthog && user) {
              posthog.identify(user.id, {
                ...(user.email && { email: user.email }),
              });
            }
          }
        }
        setSessionLoaded(true);
      } catch (err) {
        // Network-level failure (fetch threw) — retry before giving up
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
          return initSession(attempt + 1);
        }
        // Exhausted retries — let the user through without signing out.
        // They'll see stale/cached data but won't lose their session.
        setSessionLoaded(true);
      }
    }

    initSession();

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}

// Must live inside ProfileProvider because useAchievementDetector calls useProfile
function MilestoneLayer() {
  const router = useRouter();
  const pathname = usePathname();
  const { pendingEvent, dismissEvent } = useAchievementDetector();

  // Don't show over the splash screen — let the loading animation finish first
  if (pathname === '/') return null;
  if (!pendingEvent) return null;

  if (pendingEvent.type === 'achievement') {
    return <AchievementCongrats achievement={pendingEvent.achievement} onDismiss={dismissEvent} />;
  }

  return (
    <PhotoMilestonePrompt
      lbs={pendingEvent.lbs}
      achievement={pendingEvent.achievement}
      onTakePhoto={() => {
        dismissEvent();
        router.push({
          pathname: '/progress-photos/capture',
          params: { milestone: String(pendingEvent.lbs) },
        });
      }}
      onDismiss={dismissEvent}
    />
  );
}

function ReviewPromptLayer() {
  const { pendingEvent } = useAchievementDetector();
  const { shouldShowReview, onDismiss } = useReviewPrompt();

  useEffect(() => {
    if (!shouldShowReview || pendingEvent) return;
    StoreReview.isAvailableAsync().then((available) => {
      if (available) {
        StoreReview.requestReview();
      }
      // Mark as shown regardless so we respect the cooldown
      onDismiss();
    });
  }, [shouldShowReview, pendingEvent]);

  return null;
}

function ScreenTracker() {
  const pathname = usePathname();
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog && pathname) {
      posthog.screen(pathname);
    }
  }, [pathname]);

  return null;
}

function RootLayoutInner() {
  const { colors } = useAppTheme();
  const router = useRouter();

  // Handle notification deep-link taps (no-op in Expo Go — native module unavailable)
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined;
      // Only allow internal relative paths to prevent malicious deep-link routing
      if (url && url.startsWith('/') && !url.startsWith('//')) router.push(url as any);
    });
    return () => sub.remove();
  }, []);

  // Re-sync scheduled notifications on app foreground so weekly dose reminders advance
  // and engagement-based back-off recomputes even when the user doesn't open Home.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncNotifications().catch(() => {});
        if (usePreferencesStore.getState().appleHealthEnabled) {
          useHealthKitStore.getState().fetchAll().catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProfileProvider>
        <AuthGate>
          <AppWithHealth>
            <ThemeProvider value={colors.isDark ? DarkTheme : DefaultTheme}>
              <TourProvider>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="tos-update" options={{ headerShown: false }} />
                <Stack.Screen name="entry" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                <Stack.Screen name="ai-chat" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="score-detail" options={{ presentation: 'modal', headerShown: false }} />
                <Stack.Screen name="streak" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="log-history" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="day-log" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="injection-history" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="weigh-in-history" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="upgrade" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="cycle-phase" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="medication-detail" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="insights" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="progress-photos" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="courses" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="articles" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="top-contributors" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="trends" options={{ headerShown: false, animation: 'slide_from_right' }} />
              </Stack>
              <StatusBar style={colors.statusBar} />
              <AiChatOverlay />
              <AiConsentModal />
              <HealthSyncToast />
              <MilestoneLayer />
              <ReviewPromptLayer />
              <TourOverlay />
              </TourProvider>
            </ThemeProvider>
          </AppWithHealth>
        </AuthGate>
      </ProfileProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <PostHogProvider {...posthogConfig}>
      <AppThemeProvider>
        <ScreenTracker />
        <RootLayoutInner />
      </AppThemeProvider>
    </PostHogProvider>
  );
}
