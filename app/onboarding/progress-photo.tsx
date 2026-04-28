import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProgressPhotoStore } from '@/stores/progress-photo-store';

const ORANGE = '#FF742A';

export default function ProgressPhotoScreen() {
  const router = useRouter();
  const { draft } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 11 : 17;
  const step = total;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);

  const handleResult = (result: ImagePicker.ImagePickerResult) => {
    if (!result.canceled && result.assets?.[0]) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhotoUri(result.assets[0].uri);
      setPhotoBase64(result.assets[0].base64 ?? null);
    }
  };

  const takePhoto = async () => {
    Haptics.selectionAsync();
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      base64: true,
      quality: 0.6,
    });
    handleResult(result);
  };

  const chooseFromGallery = async () => {
    Haptics.selectionAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      base64: true,
      quality: 0.6,
    });
    handleResult(result);
  };

  const handleContinue = () => {
    if (photoBase64) {
      const weightLbs = draft.weightLbs ?? draft.currentWeightLbs ?? 0;
      // Fire and forget — don't block navigation
      useProgressPhotoStore.getState().uploadPhoto(photoBase64, weightLbs, { isStarting: true });
    }
    router.replace('/onboarding/building-plan');
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    router.replace('/onboarding/building-plan');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={step} total={total} onBack={() => router.back()} />

        <View style={s.content}>
          <View style={s.center}>
            <Ionicons name="camera-outline" size={64} color={ORANGE} style={s.icon} />
            <Text style={s.title}>Take Your Starting Photo</Text>
            <Text style={[s.subtitle, { color: w(0.5) }]}>
              Capture where you are today. As you hit milestones, you'll see your transformation side by side.
            </Text>

            {photoUri ? (
              <>
                <Image source={{ uri: photoUri }} style={s.preview} />
                <TouchableOpacity onPress={takePhoto} activeOpacity={0.7}>
                  <Text style={[s.retakeText, { color: ORANGE }]}>Retake</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={s.actions}>
                <TouchableOpacity style={s.primaryBtn} onPress={takePhoto} activeOpacity={0.8}>
                  <Text style={s.primaryBtnLabel}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.outlineBtn} onPress={chooseFromGallery} activeOpacity={0.8}>
                  <Text style={[s.outlineBtnLabel, { color: ORANGE }]}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <ContinueButton onPress={handleContinue} label="Continue" />
        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={s.skipWrapper}>
          <Text style={[s.skipText, { color: w(0.5) }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center' },
  icon: { marginBottom: 20 },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: c.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: 'Inter_800ExtraBold',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
    fontFamily: 'Inter_400Regular',
  },
  actions: { width: '100%', gap: 12 },
  primaryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryBtnLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_400Regular',
  },
  outlineBtn: {
    borderWidth: 2,
    borderColor: ORANGE,
    borderRadius: 28,
    paddingVertical: 17,
    alignItems: 'center',
  },
  outlineBtnLabel: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_400Regular',
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: 20,
    marginBottom: 16,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    fontFamily: 'Inter_400Regular',
  },
  skipWrapper: {
    alignItems: 'center',
    paddingBottom: 16,
    paddingTop: 8,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'Inter_400Regular',
  },
});
