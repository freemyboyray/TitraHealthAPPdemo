import { Redirect, Stack } from 'expo-router';
import { useUserStore } from '@/stores/user-store';
import { useProfile } from '@/contexts/profile-context';

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

  // Show auth screens while session/profile are still loading
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }} />
  );
}
