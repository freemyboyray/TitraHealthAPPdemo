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
import { Camera, Images } from 'lucide-react-native';

const FF = 'System';

export default function ProgressPhotoScreen() {
  const router = useRouter();
  const { draft } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const isStarting = draft.glp1Status !== 'active';
  const total = isStarting ? 11 : 16;
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
      useProgressPhotoStore.getState().uploadPhoto(photoBase64, weightLbs, { isStarting: true });
    }
    router.replace('/onboarding/reminders');
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    router.replace('/onboarding/reminders');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={step} total={total} onBack={() => router.back()} />

        <View style={s.content}>
          {photoUri ? (
            /* ── Photo captured state ── */
            <View style={s.center}>
              <Image source={{ uri: photoUri }} style={s.preview} />
              <Text style={s.capturedLabel}>Looking great!</Text>
              <View style={s.retakeRow}>
                <TouchableOpacity onPress={takePhoto} activeOpacity={0.7} style={s.retakeBtn}>
                  <Camera size={16} color={colors.orange} />
                  <Text style={s.retakeText}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={chooseFromGallery} activeOpacity={0.7} style={s.retakeBtn}>
                  <Images size={16} color={colors.orange} />
                  <Text style={s.retakeText}>Choose Different</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ── Initial state ── */
            <View style={s.center}>
              {/* Icon */}
              <View style={s.iconCircle}>
                <Camera size={32} color={colors.orange} />
              </View>

              <Text style={s.title}>Starting Photo</Text>
              <Text style={[s.subtitle, { color: w(0.45) }]}>
                Capture where you are today. As you hit{'\n'}milestones, you'll see your transformation.
              </Text>

              {/* Action buttons */}
              <View style={s.actions}>
                <TouchableOpacity style={s.primaryBtn} onPress={takePhoto} activeOpacity={0.8}>
                  <Camera size={20} color="#FFFFFF" />
                  <Text style={s.primaryBtnLabel}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.secondaryBtn, { backgroundColor: w(0.06) }]} onPress={chooseFromGallery} activeOpacity={0.8}>
                  <Images size={20} color={colors.textPrimary} />
                  <Text style={[s.secondaryBtnLabel, { color: colors.textPrimary }]}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <ContinueButton onPress={handleContinue} label={photoUri ? 'Continue' : 'Continue without photo'} />
        {!photoUri && (
          <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={s.skipWrapper}>
            <Text style={[s.skipText, { color: w(0.35) }]}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, paddingHorizontal: 24 },
    content: { flex: 1, justifyContent: 'center' },
    center: { alignItems: 'center' },

    // Icon
    iconCircle: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: c.isDark ? 'rgba(255,116,42,0.12)' : 'rgba(255,116,42,0.08)',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 24,
    },

    // Text
    title: {
      fontSize: 28, fontWeight: '800', color: c.textPrimary,
      textAlign: 'center', marginBottom: 10, letterSpacing: -0.5,
      fontFamily: FF,
    },
    subtitle: {
      fontSize: 15, textAlign: 'center', lineHeight: 21,
      marginBottom: 36, fontFamily: FF,
    },

    // Buttons
    actions: { width: '100%', gap: 12 },
    primaryBtn: {
      backgroundColor: c.orange, borderRadius: 16,
      paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
      flexDirection: 'row', gap: 8,
    },
    primaryBtnLabel: {
      color: '#FFFFFF', fontSize: 17, fontWeight: '700', fontFamily: FF,
    },
    secondaryBtn: {
      borderRadius: 16, paddingVertical: 16,
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'row', gap: 8,
    },
    secondaryBtnLabel: {
      fontSize: 17, fontWeight: '600', fontFamily: FF,
    },

    // Photo captured state
    preview: {
      width: 220, height: 293, borderRadius: 20, marginBottom: 16,
    },
    capturedLabel: {
      fontSize: 18, fontWeight: '700', color: c.textPrimary,
      fontFamily: FF, marginBottom: 8,
    },
    retakeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    retakeBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 8, paddingHorizontal: 16,
      borderRadius: 10, backgroundColor: w(0.06),
    },
    retakeText: {
      fontSize: 15, fontWeight: '600', color: c.orange, fontFamily: FF,
    },

    // Skip
    skipWrapper: {
      alignItems: 'center', paddingBottom: 16, paddingTop: 10,
    },
    skipText: {
      fontSize: 15, fontWeight: '500', fontFamily: FF,
    },
  });
};
