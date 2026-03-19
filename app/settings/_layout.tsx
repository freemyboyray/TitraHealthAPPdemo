import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="reminders" />
      <Stack.Screen name="edit-medication" />
      <Stack.Screen name="edit-body" />
      <Stack.Screen name="edit-goals" />
      <Stack.Screen name="edit-personal" />
    </Stack>
  );
}
