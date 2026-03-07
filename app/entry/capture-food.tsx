import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { callGPT4oMiniVision } from '../../lib/openai';
import { searchUSDA, type FoodResult } from '../../lib/usda';
import { useLogStore, type MealType } from '../../stores/log-store';

// ─── Constants ────────────────────────────────────────────────────────────────

const BG = '#F0EAE4';
const TERRACOTTA = '#C4784B';
const DARK = '#1C0F09';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(28,15,9,0.45)';
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const VISION_SYSTEM = `You are a food logging assistant. Identify ALL food items visible in this photo.
For each, estimate the portion size in grams based on visual context (plate size, utensils, etc).
Return ONLY a valid JSON array, no other text:
[{"item": "specific food name", "estimated_g": 200}]
Be specific. For mixed dishes, break into components if visible.`;

// ─── Types ────────────────────────────────────────────────────────────────────

type ParsedItem = {
  item: string;
  estimated_g: number;
  results: FoodResult[];
  selectedIdx: number;
  servingG: string;
};

type Phase = 'intro' | 'camera' | 'preview' | 'analyzing' | 'confirm' | 'error';

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
          borderTopColor: 'rgba(255,255,255,0.65)',
          borderLeftColor: 'rgba(255,255,255,0.42)',
          borderRightColor: 'rgba(255,255,255,0.14)',
          borderBottomColor: 'rgba(255,255,255,0.08)',
        },
      ]}
    />
  );
}

function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <View style={[s.cardShadow, style]}>
      <View style={s.cardClip}>
        <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, s.cardOverlay]} />
        <GlassBorder r={20} />
        <View style={s.cardContent}>{children}</View>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CaptureFoodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const { loading, addFoodLog } = useLogStore();

  const [phase, setPhase] = useState<Phase>('intro');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [logging, setLogging] = useState(false);
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
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      if (photo?.base64 && photo.uri) {
        setPhotoBase64(photo.base64);
        setPhotoUri(photo.uri);
        setPhase('preview');
      }
    } catch {
      // camera error — stay in camera phase
    }
  }

  async function handlePickLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]?.base64 && result.assets[0]?.uri) {
      setPhotoBase64(result.assets[0].base64);
      setPhotoUri(result.assets[0].uri);
      setPhase('preview');
    }
  }

  async function handleAnalyze() {
    if (!photoBase64) return;
    setPhase('analyzing');
    try {
      const raw = await callGPT4oMiniVision(
        VISION_SYSTEM,
        photoBase64,
        'Identify all food items in this image.',
      );

      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON');
      const parsed: { item: string; estimated_g: number }[] = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty');

      const withResults = await Promise.all(
        parsed.map(async (p) => {
          const results = await searchUSDA(p.item);
          return {
            item: p.item,
            estimated_g: p.estimated_g,
            results,
            selectedIdx: 0,
            servingG: String(Math.round(p.estimated_g)),
          } as ParsedItem;
        }),
      );
      setItems(withResults);
      setPhase('confirm');
    } catch {
      setPhase('error');
    }
  }

  function updateItem(idx: number, patch: Partial<ParsedItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  async function handleLogAll() {
    setLogging(true);
    try {
      for (const item of items) {
        const food = item.results[item.selectedIdx];
        if (!food) continue;
        const g = parseFloat(item.servingG) || item.estimated_g;
        await addFoodLog({
          food_name: food.name + (food.brand ? ` (${food.brand})` : ''),
          calories: Math.round(food.calories * g / 100),
          protein_g: parseFloat((food.protein_g * g / 100).toFixed(1)),
          carbs_g: parseFloat((food.carbs_g * g / 100).toFixed(1)),
          fat_g: parseFloat((food.fat_g * g / 100).toFixed(1)),
          fiber_g: parseFloat((food.fiber_g * g / 100).toFixed(1)),
          meal_type: mealType,
          source: 'photo_ai',
          raw_ai_response: items.map((it) => ({ item: it.item, estimated_g: it.estimated_g })),
        });
      }
      router.back();
    } finally {
      setLogging(false);
    }
  }

  // ── Camera phase ───────────────────────────────────────────────────────────
  if (phase === 'camera') {
    return (
      <View style={s.root}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
        {/* Top bar */}
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity
            onPress={() => setPhase('intro')}
            style={s.circleBtn}
            activeOpacity={0.75}
          >
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="chevron-back" size={22} color={WHITE} />
          </TouchableOpacity>
          <Text style={s.camTitle}>Take Photo</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Shutter */}
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
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
            <Ionicons name="chevron-back" size={22} color={WHITE} />
          </TouchableOpacity>
        </View>
        <View style={[s.previewBottom, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={s.analyzeBtn} onPress={handleAnalyze} activeOpacity={0.85}>
            <Ionicons name="sparkles-outline" size={18} color={WHITE} style={{ marginRight: 8 }} />
            <Text style={s.analyzeBtnText}>Analyze with AI</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Analyzing phase ────────────────────────────────────────────────────────
  if (phase === 'analyzing' && photoUri) {
    return (
      <View style={s.root}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={TERRACOTTA} />
          <Text style={{ color: WHITE, fontSize: 15, fontWeight: '600', marginTop: 14, letterSpacing: 0.3 }}>
            Identifying food items…
          </Text>
        </View>
      </View>
    );
  }

  // ── Error phase ────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <View style={[s.root, s.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtnLight, { position: 'absolute', top: insets.top + 12, left: 20 }]}>
          <Ionicons name="chevron-back" size={22} color={DARK} />
        </TouchableOpacity>
        <Ionicons name="alert-circle-outline" size={56} color={TERRACOTTA} />
        <Text style={s.errTitle}>Couldn't Identify</Text>
        <Text style={s.errDesc}>AI couldn't identify food in this photo. Try describing it instead.</Text>
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
          <TouchableOpacity style={s.errSecBtn} onPress={() => setPhase('intro')} activeOpacity={0.8}>
            <Text style={s.errSecBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.errPrimBtn}
            onPress={() => router.replace('/entry/describe-food' as any)}
            activeOpacity={0.85}
          >
            <Text style={s.errPrimBtnText}>Describe Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Confirm phase ──────────────────────────────────────────────────────────
  if (phase === 'confirm') {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setPhase('intro')} style={s.backShadow} activeOpacity={0.75}>
            <View style={s.backClip}>
              <BlurView intensity={76} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, s.backOverlay]} />
              <GlassBorder r={20} />
              <Ionicons name="chevron-back" size={22} color={DARK} />
            </View>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Confirm Items</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Meal type */}
          <GlassCard>
            <Text style={s.sectionLabel}>MEAL TYPE</Text>
            <View style={s.chipRow}>
              {MEAL_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt}
                  onPress={() => setMealType(mt)}
                  style={[s.chip, mealType === mt && s.chipActive]}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipText, mealType === mt && s.chipTextActive]}>
                    {mt.charAt(0).toUpperCase() + mt.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </GlassCard>

          {items.map((item, idx) => (
            <GlassCard key={idx}>
              <Text style={s.itemName}>{item.item}</Text>
              {item.results.length === 0 ? (
                <Text style={s.noMatch}>No USDA match — will skip</Text>
              ) : (
                <>
                  {item.results.slice(0, 3).map((r, ri) => (
                    <TouchableOpacity
                      key={r.fdcId}
                      onPress={() => updateItem(idx, { selectedIdx: ri })}
                      style={[s.matchRow, item.selectedIdx === ri && s.matchRowActive]}
                      activeOpacity={0.75}
                    >
                      <View style={[s.matchRadio, item.selectedIdx === ri && s.matchRadioActive]}>
                        {item.selectedIdx === ri && <View style={s.matchRadioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.matchName} numberOfLines={1}>{r.name}</Text>
                        {!!r.brand && <Text style={s.matchBrand}>{r.brand}</Text>}
                      </View>
                      <Text style={s.matchCal}>{r.calories} kcal/100g</Text>
                    </TouchableOpacity>
                  ))}

                  <View style={s.servingRow}>
                    <Text style={s.servingLabel}>Amount</Text>
                    <View style={s.servingInputWrap}>
                      <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
                      <GlassBorder />
                      <TextInput
                        style={s.servingInput}
                        value={item.servingG}
                        onChangeText={(v) => updateItem(idx, { servingG: v })}
                        keyboardType="numeric"
                        selectTextOnFocus
                      />
                    </View>
                    <Text style={s.servingUnit}>g</Text>
                  </View>

                  {item.results[item.selectedIdx] && (() => {
                    const g = parseFloat(item.servingG) || 100;
                    const f = item.results[item.selectedIdx];
                    return (
                      <View style={s.macroRow}>
                        <Text style={s.macroPill}>{Math.round(f.calories * g / 100)} kcal</Text>
                        <Text style={s.macroPill}>{(f.protein_g * g / 100).toFixed(1)}g P</Text>
                        <Text style={s.macroPill}>{(f.carbs_g * g / 100).toFixed(1)}g C</Text>
                        <Text style={s.macroPill}>{(f.fat_g * g / 100).toFixed(1)}g F</Text>
                      </View>
                    );
                  })()}
                </>
              )}
            </GlassCard>
          ))}
        </ScrollView>

        <View style={[s.btnWrapper, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <TouchableOpacity
            style={s.primaryBtnFull}
            onPress={handleLogAll}
            activeOpacity={0.85}
            disabled={logging || loading}
          >
            {logging || loading ? (
              <ActivityIndicator color={WHITE} />
            ) : (
              <Text style={s.primaryBtnText}>Log {items.length} Item{items.length !== 1 ? 's' : ''}</Text>
            )}
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
            <BlurView intensity={76} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.backOverlay]} />
            <GlassBorder r={20} />
            <Ionicons name="chevron-back" size={22} color={DARK} />
          </View>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Capture Food</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.introCentered}>
        <View style={s.introIconWrapper}>
          <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 40 }]} />
          <Ionicons name="camera-outline" size={56} color={TERRACOTTA} />
        </View>
        <Text style={s.introTitle}>Photo Food Log</Text>
        <Text style={s.introDesc}>
          Take or choose a photo of your meal. AI will identify foods and estimate portions.
        </Text>

        <TouchableOpacity style={s.introBtn} onPress={handleTakePhoto} activeOpacity={0.85}>
          <Ionicons name="camera" size={20} color={WHITE} style={{ marginRight: 10 }} />
          <Text style={s.introBtnText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.introSecBtn} onPress={handlePickLibrary} activeOpacity={0.8}>
          <Ionicons name="images-outline" size={20} color={DARK} style={{ marginRight: 10 }} />
          <Text style={s.introSecBtnText}>Choose from Library</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  centered: { alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  backShadow: {
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
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
  backOverlay: { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: DARK,
    letterSpacing: -0.3,
  },

  scroll: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },

  cardShadow: {
    borderRadius: 20,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  cardClip: { borderRadius: 20, overflow: 'hidden' },
  cardOverlay: { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.35)' },
  cardContent: { padding: 18 },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: TERRACOTTA, letterSpacing: 2, marginBottom: 12 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,15,9,0.06)' },
  chipActive: { backgroundColor: TERRACOTTA },
  chipText: { fontSize: 13, fontWeight: '600', color: MUTED },
  chipTextActive: { color: WHITE },

  itemName: { fontSize: 15, fontWeight: '700', color: DARK, marginBottom: 10 },
  noMatch: { fontSize: 13, color: MUTED, fontStyle: 'italic' },

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(28,15,9,0.04)',
  },
  matchRowActive: { backgroundColor: 'rgba(196,120,75,0.12)' },
  matchRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: MUTED, alignItems: 'center', justifyContent: 'center' },
  matchRadioActive: { borderColor: TERRACOTTA },
  matchRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TERRACOTTA },
  matchName: { fontSize: 13, fontWeight: '600', color: DARK },
  matchBrand: { fontSize: 11, color: MUTED },
  matchCal: { fontSize: 12, color: MUTED },

  servingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 8 },
  servingLabel: { fontSize: 13, color: DARK, fontWeight: '500', marginRight: 10 },
  servingInputWrap: { width: 72, height: 36, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  servingInput: { width: 72, textAlign: 'center', fontSize: 15, fontWeight: '600', color: DARK },
  servingUnit: { fontSize: 13, color: MUTED },

  macroRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  macroPill: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10, fontSize: 12, fontWeight: '600', color: DARK },

  btnWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12 },
  primaryBtnFull: {
    height: 56,
    borderRadius: 28,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TERRACOTTA,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: WHITE, letterSpacing: 0.3 },

  // Camera phase
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  circleBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  camTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: WHITE, letterSpacing: -0.3 },
  shutterWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutterBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: WHITE },

  // Preview phase
  previewOverlay: { paddingHorizontal: 20 },
  previewBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, alignItems: 'center' },
  analyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 28,
    backgroundColor: TERRACOTTA,
    shadowColor: TERRACOTTA,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  analyzeBtnText: { fontSize: 16, fontWeight: '800', color: WHITE, letterSpacing: 0.3 },

  // Error phase
  backBtnLight: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,15,9,0.08)' },
  errTitle: { fontSize: 20, fontWeight: '700', color: DARK, marginTop: 14, marginBottom: 8 },
  errDesc: { fontSize: 14, color: MUTED, textAlign: 'center', paddingHorizontal: 32, marginBottom: 24, lineHeight: 20 },
  errSecBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: 'rgba(28,15,9,0.08)', alignItems: 'center', justifyContent: 'center' },
  errSecBtnText: { fontSize: 15, fontWeight: '600', color: DARK },
  errPrimBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: TERRACOTTA, alignItems: 'center', justifyContent: 'center' },
  errPrimBtnText: { fontSize: 15, fontWeight: '700', color: WHITE },

  // Intro phase
  introCentered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  introIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: DARK,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  introTitle: { fontSize: 24, fontWeight: '800', color: DARK, marginBottom: 10, textAlign: 'center' },
  introDesc: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  introBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: TERRACOTTA,
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: TERRACOTTA,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  introBtnText: { fontSize: 16, fontWeight: '800', color: WHITE, letterSpacing: 0.3 },
  introSecBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 52,
    borderRadius: 28,
    backgroundColor: 'rgba(28,15,9,0.08)',
    justifyContent: 'center',
  },
  introSecBtnText: { fontSize: 15, fontWeight: '600', color: DARK },
});
