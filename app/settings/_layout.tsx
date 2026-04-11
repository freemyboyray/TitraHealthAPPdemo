import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="reminders" />
      <Stack.Screen name="edit-treatment" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="legal" />
      <Stack.Screen name="export-report" />
      <Stack.Screen name="rtm-link" />
    </Stack>
  );
}
