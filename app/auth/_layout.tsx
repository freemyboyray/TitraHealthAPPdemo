import { Redirect, Stack } from 'expo-router';
import { useUserStore } from '@/stores/user-store';
import { useProfile } from '@/contexts/profile-context';

export default function AuthLayout() {
  const session = useUserStore((s) => s.session);
  const sessionLoaded = useUserStore((s) => s.sessionLoaded);
  const { profile } = useProfile();

  // Once session is confirmed, redirect away from auth —
  // but send to onboarding if they haven't completed it yet
  if (sessionLoaded && session) {
    if (!profile || !profile.onboardingCompletedAt) {
      return <Redirect href="/onboarding" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }} />
  );
}
