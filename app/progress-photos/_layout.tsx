import { Stack } from 'expo-router';

export default function ProgressPhotosLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="capture" />
      <Stack.Screen name="compare" />
    </Stack>
  );
}
