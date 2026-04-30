import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// expo-notifications requires a dev build; guard so Expo Go doesn't crash.
let Notifications: typeof import('expo-notifications') | undefined;
try { Notifications = require('expo-notifications'); } catch {}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { MOCK_PROFILE } from '@/constants/mock-profile';
import { cancelAllReminders } from '@/lib/notifications';
import { HealthProvider } from '@/contexts/health-data';
import { ProfileProvider, useProfile } from '@/contexts/profile-context';
import { AppThemeProvider, useAppTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/user-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { useSubscriptionStore } from '@/stores/subscription-store';
// react-native-iap requires a dev build; guard so Expo Go doesn't crash.
let iapModule: typeof import('@/lib/storekit') | undefined;
try { iapModule = require('@/lib/storekit'); } catch {}
import { AiChatOverlay } from '@/components/ai-chat-overlay';
import { HealthSyncToast } from '@/components/ui/health-sync-toast';
import { AchievementCongrats } from '@/components/achievement-congrats';
import { useAchievementDetector } from '@/hooks/useAchievementDetector';

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
      } else if (_event === 'SIGNED_OUT') {
        cancelAllReminders().catch(() => {});
        AsyncStorage.clear().catch(() => {});
        resetProfile();
        router.replace('/auth/sign-in');
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
function AchievementLayer() {
  const { pendingAchievement, dismissAchievement } = useAchievementDetector();
  return <AchievementCongrats achievement={pendingAchievement} onDismiss={dismissAchievement} />;
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProfileProvider>
        <AuthGate>
          <AppWithHealth>
            <ThemeProvider value={colors.isDark ? DarkTheme : DefaultTheme}>
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
                <Stack.Screen name="daily-streak" options={{ headerShown: false, animation: 'fade' }} />
                <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="medication-detail" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="progress-photos" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="courses" options={{ headerShown: false, animation: 'slide_from_right' }} />
              </Stack>
              <StatusBar style={colors.statusBar} />
              <AiChatOverlay />
              <HealthSyncToast />
              <AchievementLayer />
            </ThemeProvider>
          </AppWithHealth>
        </AuthGate>
      </ProfileProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootLayoutInner />
    </AppThemeProvider>
  );
}
