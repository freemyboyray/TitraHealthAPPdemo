import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useFoodTaskStore } from '../../stores/food-task-store';
import { resizeImageForVision } from '@/lib/image';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { AlertCircle, Camera, ChevronLeft, Images, Plus, Sparkles, X } from 'lucide-react-native';

// ─── Constants ────────────────────────────────────────────────────────────────


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
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Multi-capture session: photos staged before they're sent to vision together.
  const [captured, setCaptured] = useState<{ uri: string; base64: string; description: string }[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const previewScrollRef = useRef<ScrollView>(null);
  // Preview photo shrinks while the description input is focused so the meal stays
  // visible (as a thumbnail) above the keyboard instead of scrolling fully away.
  const photoHeight = useSharedValue(220);
  const previewImageStyle = useAnimatedStyle(() => ({ height: photoHeight.value }));

  function resetCurrentPhoto() {
    setPhotoBase64(null);
    setPhotoUri(null);
    setDescription('');
  }

  function removeCaptured(idx: number) {
    setCaptured((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleTakePhoto() {
    if (!camPermission?.granted) {
      await requestCamPermission();
      return;
    }
    setPhase('camera');
  }

  // Always re-encode the captured image to a resized JPEG before sending it on.
  // iPhone photos are HEIC, which OpenAI's vision API rejects — resizeImageForVision
  // converts to JPEG. If it can't, we surface an error rather than uploading an
  // unsupported format that would silently fail downstream.
  async function preparePhoto(uri: string): Promise<boolean> {
    const base64 = await resizeImageForVision(uri);
    if (!base64) {
      setErrorMsg("We couldn't process this image. Please try a different photo (formats like HEIC aren't supported).");
      setPhase('error');
      return false;
    }
    setPhotoBase64(base64);
    setPhotoUri(uri);
    setPhase('preview');
    return true;
  }

  async function handleCaptureShutter() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (photo?.uri) await preparePhoto(photo.uri);
    } catch {
      // camera error - stay in camera phase
    }
  }

  async function handlePickLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await preparePhoto(result.assets[0].uri);
    }
  }

  // The current preview photo, packaged for the session list.
  function currentItem() {
    if (!photoBase64 || !photoUri) return null;
    return { uri: photoUri, base64: photoBase64, description };
  }

  // Stage the current photo and return to the camera to capture another.
  function handleAddAnother() {
    const cur = currentItem();
    if (cur) setCaptured((prev) => [...prev, cur]);
    resetCurrentPhoto();
    setPhase('camera');
  }

  // Send every staged photo (plus the current preview, if any) to vision as one
  // task — their dishes merge into a single review, like barcode multi-scan.
  function finalize(items: { uri: string; base64: string; description: string }[]) {
    if (items.length === 0) return;
    useFoodTaskStore.getState().startTask({
      source: 'camera',
      photos: items.map((p) => ({ base64: p.base64, description: p.description.trim() || undefined })),
      photoUris: items.map((p) => p.uri),
    });
    router.dismissTo('/(tabs)');
  }

  function handleAnalyze() {
    const cur = currentItem();
    finalize(cur ? [...captured, cur] : captured);
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
            <ChevronLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={s.camTitle}>Take Photo</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[s.shutterWrapper, { paddingBottom: insets.bottom + 30 }]}>
          {captured.length > 0 && (
            <View style={s.camBatchBar}>
              <View style={s.thumbRow}>
                {captured.map((p, i) => (
                  <TouchableOpacity key={i} onPress={() => removeCaptured(i)} style={s.thumb} activeOpacity={0.8}>
                    <Image source={{ uri: p.uri }} style={s.thumbImg} />
                    <View style={s.thumbRemove}>
                      <X size={11} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.camContinueBtn} onPress={() => finalize(captured)} activeOpacity={0.85}>
                <Text style={s.camContinueText}>Continue ({captured.length})</Text>
              </TouchableOpacity>
            </View>
          )}
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
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.header, { paddingTop: insets.top + 4 }]}>
          <TouchableOpacity onPress={() => { resetCurrentPhoto(); setPhase(captured.length > 0 ? 'camera' : 'intro'); }} style={s.backShadow} activeOpacity={0.75}>
            <View style={s.backClip}>
              <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.backOverlay]} />
              <GlassBorder r={20} />
              <ChevronLeft size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
            </View>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Preview</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          ref={previewScrollRef}
          style={s.previewScroll}
          contentContainerStyle={s.previewContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Photo preview */}
          <Animated.Image source={{ uri: photoUri }} style={[s.previewImage, previewImageStyle]} resizeMode="cover" />

          {/* What are you eating? */}
          <Text style={s.previewHeading}>What are you eating?</Text>

          {/* Description input */}
          <TextInput
            style={s.descriptionInput}
            placeholder="Add an optional description to improve AI accuracy."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            returnKeyType="done"
            blurOnSubmit
            // Collapse the photo to a thumbnail and ride the page up so the input
            // clears the keyboard and never collides with the docked button below.
            onFocus={() => {
              photoHeight.value = withTiming(90, { duration: 220 });
              setTimeout(() => previewScrollRef.current?.scrollToEnd({ animated: true }), 80);
            }}
            onBlur={() => {
              photoHeight.value = withTiming(220, { duration: 220 });
            }}
          />
        </ScrollView>

        {/* Continue / Add another */}
        <View style={[s.previewBottom, { paddingBottom: insets.bottom + 20 }]}>
          {captured.length > 0 && (
            <View style={s.thumbRow}>
              {captured.map((p, i) => (
                <TouchableOpacity key={i} onPress={() => removeCaptured(i)} style={s.thumb} activeOpacity={0.8}>
                  <Image source={{ uri: p.uri }} style={s.thumbImg} />
                  <View style={s.thumbRemove}>
                    <X size={11} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity style={s.addAnotherBtn} onPress={handleAddAnother} activeOpacity={0.8}>
            <Plus size={18} color={colors.orange} style={{ marginRight: 8 }} />
            <Text style={s.addAnotherBtnText}>Add another photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.analyzeBtn} onPress={handleAnalyze} activeOpacity={0.85}>
            <Text style={s.analyzeBtnText}>
              {captured.length > 0 ? `Continue (${captured.length + 1})` : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Error phase ────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View style={[s.root, s.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtnLight, { position: 'absolute', top: insets.top + 12, left: 20 }]}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <AlertCircle size={56} color={colors.orange} />
        <Text style={s.errTitle}>{errorMsg ? 'Image Not Supported' : "Couldn't Identify"}</Text>
        <Text style={s.errDesc}>
          {errorMsg ?? "AI couldn't identify food in this photo. Try describing it instead."}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
          <TouchableOpacity style={s.errSecBtn} onPress={() => { setErrorMsg(null); setPhase('intro'); }} activeOpacity={0.8}>
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
            <ChevronLeft size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
          </View>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Capture Food</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.introCentered}>
        <View style={s.introIconWrapper}>
          <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,116,42,0.15)', borderRadius: 40 }]} />
          <Camera size={56} color={colors.orange} />
        </View>
        <Text style={s.introTitle}>Photo Food Log</Text>
        <Text style={s.introDesc}>
          Take or choose a photo of your meal. AI will identify foods and estimate portions.
        </Text>

        <TouchableOpacity style={s.introBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
          <Camera size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
          <Text style={s.introBtnText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.introSecBtn} onPress={handlePickLibrary} activeOpacity={0.8}>
          <Images size={20} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} style={{ marginRight: 10 }} />
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
    fontSize: 20,
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

  itemName: { fontSize: 17, fontWeight: '700', color: c.textPrimary, marginBottom: 10 },
  noMatch: { fontSize: 15, color: c.textSecondary, fontStyle: 'italic' },

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
  matchRadioActive: { borderColor: c.orange },
  matchRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.orange },
  matchName: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  matchBrand: { fontSize: 13, color: c.textSecondary },
  matchCal: { fontSize: 14, color: c.textSecondary },

  servingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 8 },
  servingLabel: { fontSize: 15, color: c.textPrimary, fontWeight: '500', marginRight: 10 },
  servingInputWrap: { width: 72, height: 36, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  servingInput: { width: 72, textAlign: 'center', fontSize: 17, fontWeight: '600', color: c.textPrimary },
  servingUnit: { fontSize: 15, color: c.textSecondary },

  macroRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  macroPill: { backgroundColor: c.glassOverlay, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, fontSize: 14, fontWeight: '600', color: c.textPrimary },

  btnWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12 },
  primaryBtnFull: {
    height: 56,
    borderRadius: 28,
    backgroundColor: c.orange,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.orange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  primaryBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // Camera phase
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  camTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 },
  shutterWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutterBtn: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 4, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: w(0.15),
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },

  // Preview phase
  previewScroll: { flex: 1 },
  previewContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  previewImage: { width: '100%', borderRadius: 20, marginBottom: 20, backgroundColor: w(0.06) },
  previewHeading: { fontSize: 24, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3, marginBottom: 12, fontFamily: 'System' },
  descriptionInput: {
    fontSize: 16, color: c.textPrimary, fontFamily: 'System', lineHeight: 22,
    minHeight: 60, maxHeight: 120,
    padding: 0,
  },
  previewBottom: { paddingHorizontal: 20, gap: 12 },
  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 28,
    backgroundColor: c.orange,
    shadowColor: c.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 18, elevation: 8,
  },
  analyzeBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  addAnotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,116,42,0.12)',
    borderWidth: 1, borderColor: 'rgba(255,116,42,0.35)',
  },
  addAnotherBtnText: { fontSize: 16, fontWeight: '700', color: c.orange, letterSpacing: 0.2 },

  // Staged-capture thumbnails (shared by camera + preview phases)
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  thumb: {
    width: 56, height: 56, borderRadius: 12, backgroundColor: w(0.06),
    alignItems: 'center', justifyContent: 'center', overflow: 'visible',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
  },
  thumbImg: { width: '100%', height: '100%', borderRadius: 10 },
  thumbRemove: {
    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#E74C3C', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#000000',
  },

  // Camera-phase batch bar (above the shutter)
  camBatchBar: { width: '100%', paddingHorizontal: 20, gap: 12, marginBottom: 18, alignItems: 'center' },
  camContinueBtn: {
    width: '100%', height: 52, borderRadius: 26, backgroundColor: c.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  camContinueText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // Error phase
  backBtnLight: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.borderSubtle },
  errTitle: { fontSize: 20, fontWeight: '700', color: c.textPrimary, marginTop: 14, marginBottom: 8 },
  errDesc: { fontSize: 16, color: c.textSecondary, textAlign: 'center', paddingHorizontal: 32, marginBottom: 24, lineHeight: 20 },
  errSecBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: c.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  errSecBtnText: { fontSize: 17, fontWeight: '600', color: c.textPrimary },
  errPrimBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center' },
  errPrimBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

  // Intro phase
  introCentered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  introIconWrapper: {
    width: 100, height: 100, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 20,
    shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  introTitle: { fontSize: 24, fontWeight: '800', color: c.textPrimary, marginBottom: 10, textAlign: 'center' },
  introDesc: { fontSize: 16, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  introBtn: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', height: 56, borderRadius: 28,
    backgroundColor: c.orange, justifyContent: 'center', marginBottom: 12,
    shadowColor: c.orange, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 18, elevation: 8,
  },
  introBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  introSecBtn: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', height: 52, borderRadius: 28,
    backgroundColor: c.borderSubtle, justifyContent: 'center',
  },
  introSecBtnText: { fontSize: 17, fontWeight: '600', color: c.textSecondary },
  });
};
