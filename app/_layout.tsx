import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
// expo-notifications requires a dev build; guard so Expo Go doesn't crash.
let Notifications: typeof import('expo-notifications') | undefined;
try { Notifications = require('expo-notifications'); } catch {}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MOCK_PROFILE } from '@/constants/mock-profile';
import { cancelAllReminders } from '@/lib/notifications';
import { HealthProvider } from '@/contexts/health-data';
import { ProfileProvider, useProfile } from '@/contexts/profile-context';
import { AppThemeProvider, useAppTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/user-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { AiChatOverlay } from '@/components/ai-chat-overlay';

export const unstable_settings = {
  anchor: 'index',
};

function AppWithHealth({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const { hrv, restingHR, sleepHours } = useHealthKitStore();
  const liveWearable = {
    ...(hrv != null && { hrvMs: hrv }),
    ...(restingHR != null && { restingHR }),
    ...(sleepHours != null && { sleepMinutes: Math.round(sleepHours * 60) }),
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
  const { resetProfile } = useProfile();
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile();
      } else if (_event === 'SIGNED_OUT') {
        cancelAllReminders().catch(() => {});
        AsyncStorage.clear().catch(() => {});
        resetProfile();
        router.replace('/auth/sign-in');
      }
    });

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session) {
          // Verify the user still exists before trusting the cached session
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || !user) {
            // User was deleted or token is invalid — clear everything
            await AsyncStorage.clear().catch(() => {});
            await supabase.auth.signOut().catch(() => {});
            setSession(null);
          } else {
            setSession(session);
            loadProfile();
          }
        }
        setSessionLoaded(true);
      })
      .catch(async () => {
        // Stale/invalid token (e.g. user deleted) — sign out to clear it
        await supabase.auth.signOut().catch(() => {});
        setSession(null);
        setSessionLoaded(true);
      });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const { colors } = useAppTheme();
  const router = useRouter();

  // Handle notification deep-link taps (no-op in Expo Go — native module unavailable)
  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (url) router.push(url as any);
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProfileProvider>
        <AuthGate>
          <AppWithHealth>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
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
                <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
                <Stack.Screen name="courses" options={{ headerShown: false, animation: 'slide_from_right' }} />
              </Stack>
              <StatusBar style={colors.statusBar} />
              <AiChatOverlay />
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
