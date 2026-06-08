import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useUserStore } from '@/stores/user-store';
import { useProfile } from '@/contexts/profile-context';
import { lightColors } from '@/constants/theme';
import { AppThemeProvider } from '@/contexts/theme-context';

export default function AuthLayout() {
  const session = useUserStore((s) => s.session);
  const sessionLoaded = useUserStore((s) => s.sessionLoaded);
  const { profile, isLoading } = useProfile();

  // Once session is confirmed and profile has finished loading,
  // redirect away from auth screens.
  if (sessionLoaded && session && !isLoading && profile) {
    if (!profile.onboardingCompletedAt) {
      return <Redirect href="/onboarding" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  // Show auth screens while session/profile are still loading.
  // Auth (welcome, login, name, intro slides) is always presented in light mode.
  return (
    <AppThemeProvider force="light">
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 500,
          contentStyle: { backgroundColor: lightColors.bg },
        }}
      />
    </AppThemeProvider>
  );
}
