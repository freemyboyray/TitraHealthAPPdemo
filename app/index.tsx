import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProfile } from '@/contexts/profile-context';
import { useUserStore } from '@/stores/user-store';

export default function Index() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const { isLoading, profile } = useProfile();
  const { session, sessionLoaded, demoMode } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    if (!sessionLoaded) return;
    // Auth gate: no session and not in demo mode → sign-in
    if (!session && !demoMode) {
      router.replace('/auth/sign-in');
      return;
    }
    if (isLoading) return;
    if (profile) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  }, [sessionLoaded, session, isLoading, profile]);

  return (
    <View style={s.container}>
      <Text style={s.wordmark}>titra</Text>
      <Text style={s.tagline}>GLP-1 Companion</Text>
      {isLoading && <ActivityIndicator style={s.spinner} color="#FF742A" />}
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 48,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 15,
    color: c.textSecondary,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  spinner: {
    marginTop: 40,
  },
});
