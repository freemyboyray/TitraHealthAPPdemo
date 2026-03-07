import { Redirect, Stack } from 'expo-router';
import { useUserStore } from '@/stores/user-store';

export default function AuthLayout() {
  const session = useUserStore((s) => s.session);
  const sessionLoaded = useUserStore((s) => s.sessionLoaded);

  // Once session is confirmed, redirect away from auth
  if (sessionLoaded && session) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom' }} />
  );
}
