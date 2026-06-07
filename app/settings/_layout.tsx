import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="plan" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="referrals" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="support" />
      <Stack.Screen name="reminders" />
      <Stack.Screen name="edit-treatment" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="export-report" />
      <Stack.Screen name="apple-health" />
      <Stack.Screen name="health-connect" />
      <Stack.Screen name="connected-devices" />
      <Stack.Screen name="feedback" />
      <Stack.Screen name="tutorial" />
    </Stack>
  );
}
