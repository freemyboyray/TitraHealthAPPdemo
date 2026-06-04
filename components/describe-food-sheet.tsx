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
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Reset whenever the sheet opens.
  useEffect(() => {
    if (visible) {
      setText('');
      setPhotoBase64(null);
      setPhotoUri(null);
      setBusy(false);
      setError('');
    }
  }, [visible]);

  async function applyPhoto(asset: ImagePicker.ImagePickerAsset) {
    let base64 = asset.base64 ?? '';
    try {
      const r = await resizeImageForVision(asset.uri);
      if (r) base64 = r;
    } catch {}
    if (base64) {
      setPhotoBase64(base64);
      setPhotoUri(asset.uri);
    }
  }

  async function handleCapture() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], base64: true, quality: 0.6 });
    if (!result.canceled && result.assets[0]) await applyPhoto(result.assets[0]);
  }

  async function handleImport() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      base64: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) await applyPhoto(result.assets[0]);
  }

  const canContinue = !busy && (!!photoBase64 || text.trim().length > 0);

  async function handleContinue() {
    if (!canContinue) return;
    setBusy(true);
    setError('');
    try {
      if (photoBase64) {
        startTask({
          source: 'camera',
          photoBase64,
          description: text.trim() || undefined,
          photoUris: photoUri ? [photoUri] : undefined,
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

            {photoUri && (
              <View style={s.thumbRow}>
                <Image source={{ uri: photoUri }} style={s.thumb} />
                <TouchableOpacity
                  style={s.thumbRemove}
                  onPress={() => {
                    setPhotoBase64(null);
                    setPhotoUri(null);
                  }}
                  hitSlop={8}
                >
                  <X size={13} color="#FFF" />
                </TouchableOpacity>
              </View>
            )}

            <View style={s.photoRow}>
              <TouchableOpacity style={s.photoBtn} onPress={handleCapture} activeOpacity={0.7} disabled={busy}>
                <Camera size={18} color={colors.textSecondary} />
                <Text style={s.photoBtnText}>Capture photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.photoBtn} onPress={handleImport} activeOpacity={0.7} disabled={busy}>
                <ImagePlus size={18} color={colors.textSecondary} />
                <Text style={s.photoBtnText}>Import photo</Text>
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
      // Taller sheet that sits higher up the screen.
      minHeight: Math.round(SCREEN_H * 0.5),
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
    input: { marginTop: 18, fontSize: 17, color: c.textPrimary, minHeight: 120, maxHeight: 220, lineHeight: 24, flexGrow: 1 },
    thumbRow: { flexDirection: 'row', marginTop: 8 },
    thumb: { width: 76, height: 76, borderRadius: 14, backgroundColor: w(0.06) },
    thumbRemove: {
      position: 'absolute',
      top: -6,
      left: 64,
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
