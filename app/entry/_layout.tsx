import { Stack } from 'expo-router';

export default function EntryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
      <Stack.Screen name="log-weight" />
      <Stack.Screen name="side-effects" />
      <Stack.Screen name="log-injection" />
      <Stack.Screen name="log-activity" />
      <Stack.Screen name="search-food" />
      <Stack.Screen name="describe-food" />
      <Stack.Screen name="scan-food" />
      <Stack.Screen name="capture-food" />
      <Stack.Screen name="ask-ai" />
      <Stack.Screen name="customize-side-effects" />
      <Stack.Screen name="food-noise-survey" />
      <Stack.Screen name="energy-mood-survey" />
      <Stack.Screen name="appetite-survey" />
      <Stack.Screen name="gi-burden-survey" />
      <Stack.Screen name="sleep-quality-survey" />
      <Stack.Screen name="activity-quality-survey" />
      <Stack.Screen name="mental-health-survey" />
      <Stack.Screen name="checkin-summary" />
      <Stack.Screen name="weekly-checkin" />
      <Stack.Screen name="weekly-checkin-result" />
      <Stack.Screen name="weekly-checkin-history" />
      <Stack.Screen name="weekly-summary" />
      <Stack.Screen name="provider-report" />
      <Stack.Screen name="report-preview" />
      <Stack.Screen name="review-food" />
    </Stack>
  );
}
