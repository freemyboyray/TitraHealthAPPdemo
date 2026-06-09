import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { useFoodTaskStore } from '@/stores/food-task-store';
import { parseDescriptionToDishes, describeErrorMessage } from '@/lib/food-parse';
import { resizeImageForVision } from '@/lib/image';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const SCREEN_H = Dimensions.get('window').height;

// Bevel-style "What are you eating?" sheet, rendered as a transparent Modal so
// the home screen stays visible (dimmed) behind it and slides away on dismiss.
export function DescribeFoodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const startTask = useFoodTaskStore((st) => st.startTask);

  const [text, setText] = useState('');
  // Several photos can be attached; they're sent to vision together as one meal
  // (the store merges their dishes into a single review).
  const [photos, setPhotos] = useState<{ base64: string; uri: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Reset whenever the sheet opens.
  useEffect(() => {
    if (visible) {
      setText('');
      setPhotos([]);
      setBusy(false);
      setError('');
    }
  }, [visible]);

  async function applyPhoto(asset: ImagePicker.ImagePickerAsset) {
    // Always re-encode to a resized JPEG. iPhone photos are HEIC, which OpenAI's
    // vision API rejects — never fall back to the raw asset.base64, or an
    // attached HEIC photo gets sent as-is and fails ("unsupported image format")
    // even though a live capture (already JPEG) works.
    const base64 = await resizeImageForVision(asset.uri);
    if (base64) {
      setPhotos((prev) => [...prev, { base64, uri: asset.uri }]);
      setError('');
    } else {
      setError("We couldn't process one of those photos. Please try a different image.");
    }
  }

  function removePhoto(idx: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCapture() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!result.canceled && result.assets[0]) await applyPhoto(result.assets[0]);
  }

  async function handleImport() {
    // allowsMultipleSelection lets the user grab several shots of one meal in a
    // single trip to the library; each is appended to the batch.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.6,
    });
    if (!result.canceled) {
      for (const asset of result.assets) await applyPhoto(asset);
    }
  }

  const canContinue = !busy && (photos.length > 0 || text.trim().length > 0);

  async function handleContinue() {
    if (!canContinue) return;
    setBusy(true);
    setError('');
    try {
      if (photos.length > 0) {
        // One shared description for the meal: attach it to the first photo only
        // so the store's per-photo hint join doesn't repeat it N times.
        const desc = text.trim() || undefined;
        startTask({
          source: 'camera',
          photos: photos.map((p, i) => ({ base64: p.base64, description: i === 0 ? desc : undefined })),
          photoUris: photos.map((p) => p.uri),
        });
      } else {
        const dishes = await parseDescriptionToDishes(text.trim());
        startTask({ source: 'describe', parsedDishes: dishes });
      }
      onClose();
    } catch (err) {
      console.error('[DescribeFoodSheet] parse failed:', err);
      setError(describeErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav} pointerEvents="box-none">
          <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.grabber} />

            <View style={s.headerRow}>
              <Text style={s.title}>What are you eating?</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10} style={s.closeBtn}>
                <X size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={s.input}
              placeholder="e.g. breakfast waffles with 2 eggs"
              placeholderTextColor={colors.textMuted}
              value={text}
              onChangeText={setText}
              multiline
              autoFocus
              editable={!busy}
              textAlignVertical="top"
            />

            {photos.length > 0 && (
              <View style={s.thumbRow}>
                {photos.map((p, i) => (
                  <View key={`${p.uri}-${i}`} style={s.thumbWrap}>
                    <Image source={{ uri: p.uri }} style={s.thumb} />
                    <TouchableOpacity
                      style={s.thumbRemove}
                      onPress={() => removePhoto(i)}
                      hitSlop={8}
                    >
                      <X size={13} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={s.photoRow}>
              <TouchableOpacity style={s.photoBtn} onPress={handleCapture} activeOpacity={0.7} disabled={busy}>
                <Camera size={18} color={colors.textSecondary} />
                <Text style={s.photoBtnText}>{photos.length > 0 ? 'Add photo' : 'Capture photo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.photoBtn} onPress={handleImport} activeOpacity={0.7} disabled={busy}>
                <ImagePlus size={18} color={colors.textSecondary} />
                <Text style={s.photoBtnText}>Import photos</Text>
              </TouchableOpacity>
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.continueBtn, !canContinue && { opacity: 0.45 }]}
              onPress={handleContinue}
              disabled={!canContinue}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.continueText}>Continue</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function createStyles(c: AppColors) {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    kav: { width: '100%' },
    sheet: {
      // Hug content so the sheet sits low; the keyboard lift won't push the
      // top past the screen edge the way a tall fixed-height sheet did.
      maxHeight: Math.round(SCREEN_H * 0.85),
      backgroundColor: c.cardBg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: c.borderSubtle,
    },
    grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: w(0.18), marginBottom: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 23, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.4 },
    closeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: w(0.06), alignItems: 'center', justifyContent: 'center' },
    input: { marginTop: 18, fontSize: 17, color: c.textPrimary, minHeight: 96, maxHeight: 180, lineHeight: 24 },
    thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    thumbWrap: { width: 76, height: 76 },
    thumb: { width: 76, height: 76, borderRadius: 14, backgroundColor: w(0.06) },
    thumbRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
    photoBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: w(0.02),
    },
    photoBtnText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    error: { fontSize: 13, color: '#E74C3C', marginTop: 12, fontWeight: '600' },
    continueBtn: { marginTop: 18, backgroundColor: c.orange, borderRadius: 28, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
    continueText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  });
}
