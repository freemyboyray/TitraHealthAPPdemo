import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useProfile } from '@/contexts/profile-context';

export default function Index() {
  const { isLoading, profile } = useProfile();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (profile) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  }, [isLoading, profile]);

  return (
    <View style={s.container}>
      <Text style={s.wordmark}>titra</Text>
      <Text style={s.tagline}>GLP-1 Companion</Text>
      {isLoading && <ActivityIndicator style={s.spinner} color="#FF742A" />}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 15,
    color: '#9A9490',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  spinner: {
    marginTop: 40,
  },
});
