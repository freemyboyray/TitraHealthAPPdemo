import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Barcode, Copy, ScanLine, X, Zap } from 'lucide-react-native';
import { resolveBarcodeToFood } from '@/lib/barcode';
import { useFoodTaskStore } from '../../stores/food-task-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import type { FoodResult } from '@/lib/fatsecret';

// Product barcode symbologies — restricting the decoder to these keeps it from
// locking onto QR codes / random labels and speeds up recognition.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] as const;

export default function ScanBarcodeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();

  const [multiMode, setMultiMode] = useState(false);
  const [flash, setFlash] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [captured, setCaptured] = useState<FoodResult[]>([]);

  // Guards against the native decoder re-firing the same frame mid-lookup, and
  // against re-adding a barcode that's already in the batch.
  const lockRef = useRef(false);
  const seenRef = useRef<Set<string>>(new Set());

  const buildTaskAndGo = useCallback(
    async (items: FoodResult[]) => {
      if (items.length === 0) return;
      setNavigating(true);
      const addReadyDish = useFoodTaskStore.getState().addReadyDish;
      let taskId: string | undefined;
      try {
        for (const food of items) {
          taskId = await addReadyDish({
            source: 'barcode',
            result: food,
            photoUri: food.image_url,
            taskId,
          });
        }
      } catch {
        setNavigating(false);
        return;
      }
      router.replace(`/entry/review-food?taskId=${taskId}` as any);
    },
    [router],
  );

  const handleBarcode = useCallback(
    async ({ data }: { data: string }) => {
      if (lockRef.current || resolving || navigating) return;
      // Already in this batch → silently ignore re-scans of the same product.
      if (seenRef.current.has(data)) return;
      lockRef.current = true;
      setResolving(true);

      const food = await resolveBarcodeToFood(data);

      setResolving(false);
      if (!food) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        // Hold the lock so the decoder stops hammering the same missing code;
        // the "Scan again" button releases it.
        setNotFound(true);
        return;
      }

      seenRef.current.add(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (multiMode) {
        setCaptured((prev) => [...prev, food]);
        lockRef.current = false; // keep scanning for the next item
      } else {
        // Single scan: append (so anything already batched isn't lost) and go.
        buildTaskAndGo([...captured, food]);
      }
    },
    [resolving, navigating, multiMode, captured, buildTaskAndGo],
  );

  function handleScanAgain() {
    setNotFound(false);
    lockRef.current = false;
  }

  function removeCaptured(idx: number) {
    setCaptured((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Permission gate ─────────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <View style={[s.root, s.permCentered, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[s.iconBtn, { position: 'absolute', top: insets.top + 12, left: 20 }]}
          activeOpacity={0.8}
        >
          <X size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Barcode size={60} color={colors.orange} />
        <Text style={s.permTitle}>Camera access needed</Text>
        <Text style={s.permDesc}>Allow camera access to scan product barcodes.</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={s.permBtnText}>Allow camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const showContinue = captured.length > 0;

  return (
    <View style={s.root}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flash}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES as unknown as any }}
        onBarcodeScanned={lockRef.current || resolving || navigating || notFound ? undefined : handleBarcode}
      />

      {/* Top controls */}
      <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn} activeOpacity={0.8}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          <X size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={s.grabber} />
        <TouchableOpacity
          onPress={() => setFlash((f) => !f)}
          style={[s.iconBtn, flash && s.iconBtnActive]}
          activeOpacity={0.8}
        >
          {!flash && <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />}
          <Zap size={20} color={flash ? '#000000' : '#FFFFFF'} fill={flash ? '#000000' : 'transparent'} />
        </TouchableOpacity>
      </View>

      {/* Title + frame */}
      <View style={s.centerBlock} pointerEvents="none">
        <Text style={s.title}>Scan barcode</Text>
        <Text style={s.subtitle}>Focus on the barcode to scan it automatically.</Text>
        <View style={s.frame}>
          <View style={[s.corner, s.cornerTL]} />
          <View style={[s.corner, s.cornerTR]} />
          <View style={[s.corner, s.cornerBL]} />
          <View style={[s.corner, s.cornerBR]} />
        </View>
      </View>

      {/* Resolving / navigating overlay */}
      {(resolving || navigating) && (
        <View style={[StyleSheet.absoluteFillObject, s.loadingOverlay]} pointerEvents="none">
          <ActivityIndicator size="large" color={colors.orange} />
          <Text style={s.loadingText}>{navigating ? 'Loading…' : 'Looking up product…'}</Text>
        </View>
      )}

      {/* Bottom bar */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        {notFound && (
          <View style={s.notFoundCard}>
            <Text style={s.notFoundText}>We couldn’t find that product.</Text>
            <TouchableOpacity onPress={handleScanAgain} style={s.notFoundBtn} activeOpacity={0.85}>
              <Text style={s.notFoundBtnText}>Scan again</Text>
            </TouchableOpacity>
          </View>
        )}

        {captured.length > 0 && (
          <View style={s.thumbRow}>
            {captured.map((f, i) => (
              <TouchableOpacity key={i} onPress={() => removeCaptured(i)} style={s.thumb} activeOpacity={0.8}>
                {f.image_url ? (
                  <Image source={{ uri: f.image_url }} style={s.thumbImg} />
                ) : (
                  <Barcode size={22} color="rgba(0,0,0,0.4)" />
                )}
                <View style={s.thumbRemove}>
                  <X size={12} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {showContinue && (
          <TouchableOpacity
            style={s.continueBtn}
            onPress={() => buildTaskAndGo(captured)}
            activeOpacity={0.85}
            disabled={navigating}
          >
            <Text style={s.continueText}>Continue ({captured.length})</Text>
          </TouchableOpacity>
        )}

        <View style={s.toggleRow}>
          <TouchableOpacity
            style={s.togglePill}
            onPress={() => setMultiMode((m) => !m)}
            activeOpacity={0.85}
          >
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            {multiMode ? (
              <ScanLine size={18} color="#FFFFFF" />
            ) : (
              <Copy size={18} color="#FFFFFF" />
            )}
            <Text style={s.toggleText}>{multiMode ? 'Single scan' : 'Multi-scan'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#000000' },

    // Permission gate
    permCentered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    permTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 16, marginBottom: 8 },
    permDesc: { fontSize: 15, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginBottom: 24, lineHeight: 21 },
    permBtn: { height: 52, paddingHorizontal: 28, borderRadius: 26, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center' },
    permBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

    // Top controls
    topBar: {
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    iconBtn: {
      width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    iconBtnActive: { backgroundColor: '#FFFFFF' },
    grabber: { position: 'absolute', top: 8, left: '50%', marginLeft: -20, width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },

    // Title + frame
    centerBlock: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.4, textAlign: 'center' },
    subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 8, marginBottom: 36, paddingHorizontal: 48, lineHeight: 22, fontWeight: '600' },
    frame: { width: '76%', aspectRatio: 1.7, borderRadius: 24 },
    corner: { position: 'absolute', width: 38, height: 38, borderColor: '#FFFFFF' },
    cornerTL: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 24 },
    cornerTR: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 24 },
    cornerBL: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 24 },
    cornerBR: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 24 },

    // Loading
    loadingOverlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
    loadingText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 14 },

    // Bottom bar
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, gap: 14 },

    notFoundCard: {
      backgroundColor: 'rgba(20,20,20,0.92)', borderRadius: 18, padding: 16,
      alignItems: 'center', gap: 12,
    },
    notFoundText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    notFoundBtn: { height: 44, paddingHorizontal: 24, borderRadius: 22, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center' },
    notFoundBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    thumb: {
      width: 64, height: 64, borderRadius: 14, backgroundColor: '#E6E6E6',
      alignItems: 'center', justifyContent: 'center', overflow: 'visible',
      borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
    },
    thumbImg: { width: '100%', height: '100%', borderRadius: 12 },
    thumbRemove: {
      position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
      backgroundColor: '#E74C3C', alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: '#000000',
    },

    continueBtn: { height: 56, borderRadius: 28, backgroundColor: c.orange, alignItems: 'center', justifyContent: 'center' },
    continueText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },

    toggleRow: { alignItems: 'center' },
    togglePill: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      height: 52, paddingHorizontal: 28, borderRadius: 26, overflow: 'hidden',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    toggleText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
