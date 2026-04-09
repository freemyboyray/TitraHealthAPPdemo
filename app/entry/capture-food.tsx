import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFoodTaskStore } from '../../stores/food-task-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'camera' | 'preview' | 'error';

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassBorder({ r = 16 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: r,
          borderWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.13)',
          borderLeftColor: 'rgba(255,255,255,0.08)',
          borderRightColor: 'rgba(255,255,255,0.03)',
          borderBottomColor: 'rgba(255,255,255,0.02)',
        },
      ]}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CaptureFoodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  async function handleTakePhoto() {
    if (!camPermission?.granted) {
      await requestCamPermission();
      return;
    }
    setPhase('camera');
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

  function handleAnalyze() {
    if (!photoBase64) return;
    // Dispatch everything to background — vision + USDA lookup happen in the store
    useFoodTaskStore.getState().startTask({ source: 'camera', photoBase64 });
    router.dismissTo('/(tabs)');
  }

  // ── Camera phase ───────────────────────────────────────────────────────────
  if (phase === 'camera') {
    return (
      <View style={s.root}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => setPhase('intro')}
            style={s.circleBtn}
            activeOpacity={0.75}
          >
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.camTitle}>Take Photo</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[s.shutterWrapper, { paddingBottom: insets.bottom + 30 }]}>
          <TouchableOpacity onPress={handleCaptureShutter} style={s.shutterBtn} activeOpacity={0.85}>
            <View style={s.shutterInner} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Preview phase ──────────────────────────────────────────────────────────
  if (phase === 'preview' && photoUri) {
    return (
      <View style={s.root}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <View style={[s.previewOverlay, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => setPhase('intro')} style={s.circleBtn} activeOpacity={0.75}>
            <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={[s.previewBottom, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={s.analyzeBtn} onPress={handleAnalyze} activeOpacity={0.85}>
            <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={s.analyzeBtnText}>Analyze with AI</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Error phase ────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View style={[s.root, s.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtnLight, { position: 'absolute', top: insets.top + 12, left: 20 }]}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Ionicons name="alert-circle-outline" size={56} color={ORANGE} />
        <Text style={s.errTitle}>Couldn't Identify</Text>
        <Text style={s.errDesc}>AI couldn't identify food in this photo. Try describing it instead.</Text>
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
          <TouchableOpacity style={s.errSecBtn} onPress={() => setPhase('intro')} activeOpacity={0.8}>
            <Text style={s.errSecBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.errPrimBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={s.errPrimBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Intro phase (default) ─────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backShadow} activeOpacity={0.75}>
          <View style={s.backClip}>
            <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.backOverlay]} />
            <GlassBorder r={20} />
            <Ionicons name="chevron-back" size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
          </View>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Capture Food</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.introCentered}>
        <View style={s.introIconWrapper}>
          <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,116,42,0.15)', borderRadius: 40 }]} />
          <Ionicons name="camera-outline" size={56} color={ORANGE} />
        </View>
        <Text style={s.introTitle}>Photo Food Log</Text>
        <Text style={s.introDesc}>
          Take or choose a photo of your meal. AI will identify foods and estimate portions.
        </Text>

        <TouchableOpacity style={s.introBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
          <Ionicons name="camera" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
          <Text style={s.introBtnText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.introSecBtn} onPress={handlePickLibrary} activeOpacity={0.8}>
          <Ionicons name="images-outline" size={20} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} style={{ marginRight: 10 }} />
          <Text style={s.introSecBtnText}>Choose from Library</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backShadow: {
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  backClip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backOverlay: { borderRadius: 20, backgroundColor: w(0.12) },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: -0.3,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },

  cardShadow: {
    borderRadius: 20,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  cardClip: { borderRadius: 20, overflow: 'hidden', backgroundColor: c.surface },
  cardOverlay: { borderRadius: 20, backgroundColor: c.borderSubtle },
  cardContent: { padding: 18 },

  itemName: { fontSize: 15, fontWeight: '700', color: c.textPrimary, marginBottom: 10 },
  noMatch: { fontSize: 13, color: c.textSecondary, fontStyle: 'italic' },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: c.glassOverlay,
  },
  matchRowActive: { backgroundColor: 'rgba(255,116,42,0.15)' },
  matchRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.textSecondary, alignItems: 'center', justifyContent: 'center' },
  matchRadioActive: { borderColor: ORANGE },
  matchRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE },
  matchName: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
  matchBrand: { fontSize: 11, color: c.textSecondary },
  matchCal: { fontSize: 12, color: c.textSecondary },

  servingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 8 },
  servingLabel: { fontSize: 13, color: c.textPrimary, fontWeight: '500', marginRight: 10 },
  servingInputWrap: { width: 72, height: 36, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  servingInput: { width: 72, textAlign: 'center', fontSize: 15, fontWeight: '600', color: c.textPrimary },
  servingUnit: { fontSize: 13, color: c.textSecondary },

  macroRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  macroPill: { backgroundColor: c.glassOverlay, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, fontSize: 12, fontWeight: '600', color: c.textPrimary },

  btnWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12 },
  primaryBtnFull: {
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
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // Camera phase
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  camTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  shutterWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutterBtn: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: w(0.15),
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },

  // Preview phase
  previewOverlay: { paddingHorizontal: 20 },
  previewBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, alignItems: 'center' },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center',
    height: 56, paddingHorizontal: 32, borderRadius: 28,
    backgroundColor: ORANGE,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 18, elevation: 8,
  },
  analyzeBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // Error phase
  backBtnLight: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.borderSubtle },
  errTitle: { fontSize: 20, fontWeight: '700', color: c.textPrimary, marginTop: 14, marginBottom: 8 },
  errDesc: { fontSize: 14, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 32, marginBottom: 24, lineHeight: 20 },
  errSecBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: c.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  errSecBtnText: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  errPrimBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  errPrimBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Intro phase
  introCentered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  introIconWrapper: {
    width: 100, height: 100, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 20,
    shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  introTitle: { fontSize: 24, fontWeight: '800', color: c.textPrimary, marginBottom: 10, textAlign: 'center' },
  introDesc: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  introBtn: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', height: 56, borderRadius: 28,
    backgroundColor: ORANGE, justifyContent: 'center', marginBottom: 12,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 18, elevation: 8,
  },
  introBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  introSecBtn: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', height: 52, borderRadius: 28,
    backgroundColor: c.borderSubtle, justifyContent: 'center',
  },
  introSecBtnText: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
  });
};
