import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MOCK_PROFILE } from '@/constants/mock-profile';
import { HealthProvider } from '@/contexts/health-data';
import { ProfileProvider, useProfile } from '@/contexts/profile-context';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/user-store';

export const unstable_settings = {
  anchor: 'index',
};

function AppWithHealth({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  return (
    <HealthProvider profile={profile ?? MOCK_PROFILE}>
      {children}
    </HealthProvider>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { setSession, setSessionLoaded, loadProfile } = useUserStore();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile();
    });

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (session) {
          setSession(session);
          loadProfile();
          setSessionLoaded(true);
        } else {
          setSessionLoaded(true);
        }
      })
      .catch(() => {
        setSessionLoaded(true);
      });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProfileProvider>
        <AppWithHealth>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="auth" options={{ headerShown: false }} />
              <Stack.Screen name="entry" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              <Stack.Screen name="ai-chat" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="score-detail" options={{ presentation: 'modal', headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
          </ThemeProvider>
        </AppWithHealth>
      </ProfileProvider>
    </GestureHandlerRootView>
  );
}
