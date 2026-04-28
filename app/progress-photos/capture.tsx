import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useProgressPhotoStore } from '@/stores/progress-photo-store';
import { useProfile } from '@/contexts/profile-context';

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'camera' | 'preview';
type CameraFacing = 'front' | 'back';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CaptureProgressPhotoScreen() {
  const { milestone, isStarting } = useLocalSearchParams<{
    milestone?: string;
    isStarting?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { profile } = useProfile();

  const [phase, setPhase] = useState<Phase>('camera');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraFacing>('front');
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleFlipCamera() {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  }

  async function handleCaptureShutter() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.6,
        imageType: 'jpg',
      });
      if (photo?.base64 && photo.uri) {
        setPhotoBase64(photo.base64);
        setPhotoUri(photo.uri);
        setPhase('preview');
      }
    } catch {
      // camera error - stay in camera phase
    }
  }

  async function handlePickLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      base64: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]?.base64 && result.assets[0]?.uri) {
      setPhotoBase64(result.assets[0].base64);
      setPhotoUri(result.assets[0].uri);
      setPhase('preview');
    }
  }

  function handleRetake() {
    setPhotoBase64(null);
    setPhotoUri(null);
    setPhase('camera');
  }

  async function handleSave() {
    if (!photoBase64 || saving) return;
    setSaving(true);
    try {
      const weightLbs = profile?.currentWeightLbs ?? 0;
      await useProgressPhotoStore.getState().uploadPhoto(photoBase64, weightLbs, {
        milestone: milestone ? parseInt(milestone, 10) : undefined,
        isStarting: isStarting === 'true',
      });
      router.back();
    } catch {
      setSaving(false);
    }
  }

  // ── Permission request ────────────────────────────────────────────────────
  if (!camPermission?.granted) {
    return (
      <View style={[s.root, s.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.backBtnLight, { position: 'absolute', top: insets.top + 12, left: 20 }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Ionicons name="camera-outline" size={56} color={ORANGE} />
        <Text style={s.permTitle}>Camera Access</Text>
        <Text style={s.permDesc}>
          We need camera access to take your progress photo.
        </Text>
        <TouchableOpacity style={s.permBtn} onPress={requestCamPermission} activeOpacity={0.85}>
          <Text style={s.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Preview phase ─────────────────────────────────────────────────────────
  if (phase === 'preview' && photoUri) {
    return (
      <View style={s.root}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <View style={[s.previewOverlay, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={handleRetake} style={s.circleBtn} activeOpacity={0.75}>
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={[s.previewBottom, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={s.retakeBtn} onPress={handleRetake} activeOpacity={0.8}>
            <Text style={s.retakeBtnText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={s.saveBtnText}>Save Photo</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Camera phase (default) ────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing={facing} />
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={s.circleBtn}
          activeOpacity={0.75}
        >
          <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.camTitle}>Progress Photo</Text>
        <TouchableOpacity onPress={handleFlipCamera} style={s.circleBtn} activeOpacity={0.75}>
          <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <Ionicons name="camera-reverse-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={[s.shutterWrapper, { paddingBottom: insets.bottom + 30 }]}>
        <View style={s.bottomControls}>
          <TouchableOpacity onPress={handlePickLibrary} style={s.galleryBtn} activeOpacity={0.75}>
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="images-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCaptureShutter} style={s.shutterBtn} activeOpacity={0.85}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
          <View style={{ width: 44 }} />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

    // Camera phase
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    circleBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    camTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.3,
    },
    shutterWrapper: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    bottomControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      paddingHorizontal: 40,
    },
    galleryBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    shutterBtn: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 4,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: w(0.15),
    },
    shutterInner: {
      width: 62,
      height: 62,
      borderRadius: 31,
      backgroundColor: '#FFFFFF',
    },

    // Preview phase
    previewOverlay: { paddingHorizontal: 20 },
    previewBottom: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      flexDirection: 'row',
      gap: 12,
    },
    retakeBtn: {
      flex: 1,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    retakeBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    saveBtn: {
      flex: 1,
      height: 56,
      borderRadius: 28,
      backgroundColor: ORANGE,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 8,
    },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },

    // Permission screen
    backBtnLight: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    permTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: c.textPrimary,
      marginTop: 14,
      marginBottom: 8,
    },
    permDesc: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    permBtn: {
      width: '100%',
      height: 56,
      borderRadius: 28,
      backgroundColor: ORANGE,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: ORANGE,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 18,
      elevation: 8,
    },
    permBtnText: {
      fontSize: 16,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
  });
};
