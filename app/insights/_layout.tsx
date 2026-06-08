import { Stack } from 'expo-router';

export default function InsightsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="side-effects" />
      <Stack.Screen name="nutrition" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="vitals" />
      <Stack.Screen name="wellness" />
      <Stack.Screen name="micros" />
      <Stack.Screen name="metric/[id]" />
    </Stack>
  );
}
