import { Stack } from 'expo-router';

export default function CoursesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="[courseSlug]/index" />
      <Stack.Screen name="[courseSlug]/[lessonSlug]" />
    </Stack>
  );
}
