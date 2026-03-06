import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MOCK_PROFILE } from '@/constants/mock-profile';
import { HealthProvider } from '@/contexts/health-data';
import { ProfileProvider, useProfile } from '@/contexts/profile-context';

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProfileProvider>
        <AppWithHealth>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
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
