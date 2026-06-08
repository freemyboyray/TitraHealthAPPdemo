import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { lightColors } from '@/constants/theme';
import { AppThemeProvider } from '@/contexts/theme-context';

export default function OnboardingLayout() {
  // Onboarding is always presented in light mode, regardless of the user's
  // theme preference or system setting.
  return (
    <AppThemeProvider force="light">
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          // Each step fades in while sliding up from the bottom, and fades up
          // and away toward the top on push — a calm, vertical onboarding flow.
          // Slowed to 500ms so the upward fade reads clearly.
          animation: 'fade_from_bottom',
          animationDuration: 500,
          contentStyle: { backgroundColor: lightColors.bg },
        }}
      />
    </AppThemeProvider>
  );
}
