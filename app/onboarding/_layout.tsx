import { Stack } from 'expo-router';
import React from 'react';

import { useAppTheme } from '@/contexts/theme-context';

export default function OnboardingLayout() {
  const { colors } = useAppTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
