import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { callOpenAI, estimateMacrosWithAI } from '../../lib/openai';
import { searchUSDA, getFatSecretFood, lookupFatSecretBarcode, type FoodResult, type ServingOption } from '../../lib/usda';
import { useMealTrayStore, type RecentFood, type SavedMeal } from '../../stores/meal-tray-store';
import { useHealthKitStore } from '../../stores/healthkit-store';
import { useFoodTaskStore } from '../../stores/food-task-store';
import { VoiceButton } from '../../components/ui/voice-button';
import { VoiceFoodChat } from '../../components/voice-food-chat';
import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import { useUiStore } from '@/stores/ui-store';
import type { AppColors } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';
type Mode = 'search' | 'scan' | 'describe' | 'camera';

const PARSE_SYSTEM = `You are a food logging assistant. Extract each distinct food item from the user's input.
Return ONLY a valid JSON array, no other text:
[{"item": "specific food name", "estimated_g": 150}]
Estimate typical portion size in grams if not specified. Be specific (e.g. "scrambled eggs" not "eggs").`;

// ─── Types ────────────────────────────────────────────────────────────────────

type OFFProduct = {
  name: string;
  brand: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

type DescribeItem = {
  item: string;
  estimated_g: number;
  results: FoodResult[];
  selectedIdx: number;
  servingG: string;
  selectedServingIdx: number;
  servingOptionsLoading: boolean;
  qty: string;              // user-facing quantity in the selected unit
  unitGrams: number;        // grams per 1 unit (e.g. 28.35 for oz)
  unitLabel: string;        // display label (e.g. "oz", "cup", "g")
  showUnitPicker: boolean;
};

type PendingFood = {
  food_name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  source: 'search_db' | 'manual' | 'barcode';
  serving_options?: ServingOption[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, { cache: 'no-store' });
    const json = await res.json();
    if (json.status !== 1 || !json.product) return null;
    const p = json.product;
    const n = p.nutriments ?? {};
    return {
      name: p.product_name ?? p.product_name_en ?? 'Unknown Product',
      brand: p.brands ?? '',
      calories: Math.round(n['energy-kcal_100g'] ?? n['energy-kcal'] ?? 0),
      protein_g: parseFloat((n['proteins_100g'] ?? 0).toFixed(1)),
      carbs_g: parseFloat((n['carbohydrates_100g'] ?? 0).toFixed(1)),
      fat_g: parseFloat((n['fat_100g'] ?? 0).toFixed(1)),
      fiber_g: parseFloat((n['fiber_100g'] ?? 0).toFixed(1)),
    };
  } catch {
    return null;
  }
}

// estimateMacrosWithAI is now imported from lib/openai.ts

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

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: '800', color: ORANGE, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 }}>{children}</Text>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogFoodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const {
    trayItems, addToTray, removeFromTray, clearTray, logMeal, saveAsMeal,
    loadSavedMeal, savedMeals, fetchSavedMeals, deleteSavedMeal,
    recentFoods, fetchRecentFoods, toggleFavorite,
    customFoods, fetchCustomFoods, addCustomFood,
    loading,
  } = useMealTrayStore();
  const hkStore = useHealthKitStore();
  const { refreshActuals } = useHealthData();
  const startFoodTask = useFoodTaskStore((s) => s.startTask);
  const setInsightsDefaultTab = useUiStore((s) => s.setInsightsDefaultTab);

  // ── Mode ──────────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>((modeParam as Mode) ?? 'search');

  // ── Search state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Scan state ────────────────────────────────────────────────────────────
  const [scanned, setScanned] = useState(false);
  const [scanFetching, setScanFetching] = useState(false);
  const [scanProduct, setScanProduct] = useState<OFFProduct | null>(null);
  const [scanNotFound, setScanNotFound] = useState(false);
  const scanLockRef = useRef(false);
  const lastBarcodeRef = useRef<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [scanServingG, setScanServingG] = useState('100');

  // ── Camera (photo) state ──────────────────────────────────────────────────
  const photoCameraRef = useRef<CameraView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [cameraPhotoKey, setCameraPhotoKey] = useState(0);

  // ── Describe state ────────────────────────────────────────────────────────
  const [describeText, setDescribeText] = useState('');
  const [describeItems, setDescribeItems] = useState<DescribeItem[] | null>(null);
  const [describing, setDescribing] = useState(false);
  const [describeError, setDescribeError] = useState('');
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [showVoiceChat, setShowVoiceChat] = useState(false);

  // ── Add-to-meal panel ─────────────────────────────────────────────────────
  const [pendingFood, setPendingFood] = useState<PendingFood | null>(null);
  const [servingG, setServingG] = useState('100');
  const [selectedServingIdx, setSelectedServingIdx] = useState(0);
  const [showNutritionInfo, setShowNutritionInfo] = useState(false);
  const [detailLoading, setDetailLoading] = useState<number | null>(null);

  // ── Tray UI ───────────────────────────────────────────────────────────────
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveMealName, setSaveMealName] = useState('');

  // ── Custom food modal ─────────────────────────────────────────────────────
  const [expandedTrayItemId, setExpandedTrayItemId] = useState<string | null>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [cfName, setCfName] = useState('');
  const [cfBrand, setCfBrand] = useState('');
  const [cfCal, setCfCal] = useState('');
  const [cfProtein, setCfProtein] = useState('');
  const [cfCarbs, setCfCarbs] = useState('');
  const [cfFat, setCfFat] = useState('');
  const [cfFiber, setCfFiber] = useState('');
  const [cfServing, setCfServing] = useState('100');

  useEffect(() => {
    fetchRecentFoods();
    fetchSavedMeals();
    fetchCustomFoods();
  }, []);

  // ── Mode switch helpers ───────────────────────────────────────────────────

  async function switchToScan() {
    if (!camPermission?.granted) await requestCamPermission();
    setScanProduct(null);
    setScanNotFound(false);
    setScanned(false);
    scanLockRef.current = false;
    lastBarcodeRef.current = null;
    setCameraKey((k) => k + 1);
    setMode('scan');
  }

  function switchMode(m: Mode) {
    if (m === 'scan') { switchToScan(); return; }
    if (m === 'camera') {
      setPhotoUri(null);
      setPhotoBase64(null);
      setCameraPhotoKey((k) => k + 1);
      if (!camPermission?.granted) requestCamPermission();
    }
    setMode(m);
  }

  // ── Camera (photo) helpers ───────────────────────────────────────────────

  async function handleCaptureShutter() {
    if (!photoCameraRef.current) return;
    try {
      const photo = await photoCameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.6,
        imageType: 'jpg',
      });
      if (photo?.base64 && photo.uri) {
        setPhotoBase64(photo.base64);
        setPhotoUri(photo.uri);
      }
    } catch {
      // camera error
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
    }
  }

  function handleAnalyzePhoto() {
    if (!photoBase64) return;
    startFoodTask({ source: 'camera', photoBase64 });
    router.dismissTo('/(tabs)');
  }

  function handleRetakePhoto() {
    setPhotoUri(null);
    setPhotoBase64(null);
    setCameraPhotoKey((k) => k + 1);
  }

  // ── Search ────────────────────────────────────────────────────────────────

  function handleQueryChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      let r = await searchUSDA(text);
      if (r.length === 0) {
        const aiResult = await estimateMacrosWithAI(text);
        if (aiResult) r = [aiResult];
      }
      setSearchResults(r);
      setSearching(false);
    }, 400);
  }

  async function openPendingFromResult(item: FoodResult) {
    // Show the panel immediately with search-result data, then enrich with full serving options
    setPendingFood({
      food_name: item.name + (item.brand ? ` (${item.brand})` : ''),
      calories_per_100g: item.calories,
      protein_per_100g: item.protein_g,
      carbs_per_100g: item.carbs_g,
      fat_per_100g: item.fat_g,
      fiber_per_100g: item.fiber_g,
      source: 'search_db',
      serving_options: item.serving_options,
    });
    setSelectedServingIdx(0);
    setServingG(String(Math.round(item.serving_options?.[0]?.grams ?? 100)));

    // Lazy-load full serving options from FatSecret food.get.v4 (skip for AI estimates)
    if (item.fdcId === -1) return;
    setDetailLoading(item.fdcId);
    const detail = await getFatSecretFood(item.fdcId);
    setDetailLoading(null);
    if (detail) {
      setPendingFood((prev) => prev ? {
        ...prev,
        calories_per_100g: detail.calories,
        protein_per_100g: detail.protein_g,
        carbs_per_100g: detail.carbs_g,
        fat_per_100g: detail.fat_g,
        fiber_per_100g: detail.fiber_g,
        serving_options: detail.serving_options,
      } : prev);
      const firstG = detail.serving_options?.[0]?.grams ?? 100;
      setServingG(String(Math.round(firstG)));
    }
  }

  function openPendingFromRecent(item: RecentFood) {
    setPendingFood({
      food_name: item.food_name,
      calories_per_100g: item.calories,
      protein_per_100g: item.protein_g,
      carbs_per_100g: item.carbs_g,
      fat_per_100g: item.fat_g,
      fiber_per_100g: item.fiber_g,
      source: 'manual',
    });
    setSelectedServingIdx(0);
    setServingG('100');
  }

  function openPendingFromCustom(item: typeof customFoods[0]) {
    setPendingFood({
      food_name: item.name + (item.brand ? ` (${item.brand})` : ''),
      calories_per_100g: item.calories_per_100g,
      protein_per_100g: item.protein_per_100g,
      carbs_per_100g: item.carbs_per_100g,
      fat_per_100g: item.fat_per_100g,
      fiber_per_100g: item.fiber_per_100g,
      source: 'manual',
    });
    setSelectedServingIdx(0);
    setServingG(String(item.serving_size_g ?? 100));
  }

  function handleServingPillSelect(opt: ServingOption, idx: number) {
    setSelectedServingIdx(idx);
    setServingG(String(Math.round(opt.grams)));
  }

  function handleAddPendingToTray() {
    if (!pendingFood) return;
    const g = parseFloat(servingG) || 100;
    addToTray({
      food_name: pendingFood.food_name,
      calories: Math.round(pendingFood.calories_per_100g * g / 100),
      protein_g: parseFloat((pendingFood.protein_per_100g * g / 100).toFixed(1)),
      carbs_g: parseFloat((pendingFood.carbs_per_100g * g / 100).toFixed(1)),
      fat_g: parseFloat((pendingFood.fat_per_100g * g / 100).toFixed(1)),
      fiber_g: parseFloat((pendingFood.fiber_per_100g * g / 100).toFixed(1)),
      serving_g: g,
      serving_description: pendingFood.serving_options?.[selectedServingIdx]?.label,
      source: pendingFood.source,
    });
    setPendingFood(null);
    setShowNutritionInfo(false);
  }

  // ── Scan ──────────────────────────────────────────────────────────────────

  async function handleBarcode({ data }: { data: string }) {
    if (scanLockRef.current) return;
    // Reject re-fires of the same barcode (expo-camera native buffer re-emit)
    if (data === lastBarcodeRef.current) return;
    scanLockRef.current = true;
    lastBarcodeRef.current = data;
    setScanned(true);
    setScanFetching(true);
    setScanNotFound(false);
    setScanProduct(null);

    // Try Open Food Facts first, then FatSecret as fallback
    let offResult = await lookupBarcode(data);
    if (offResult) {
      setScanFetching(false);
      setScanProduct(offResult);
      setScanServingG('100');
    } else {
      const fsResult = await lookupFatSecretBarcode(data);
      setScanFetching(false);
      if (fsResult) {
        setScanProduct({
          name: fsResult.name,
          brand: fsResult.brand,
          calories: fsResult.calories,
          protein_g: fsResult.protein_g,
          carbs_g: fsResult.carbs_g,
          fat_g: fsResult.fat_g,
          fiber_g: fsResult.fiber_g,
        });
        setScanServingG('100');
      } else {
        setScanNotFound(true);
      }
    }
  }

  function handleScanAgain() {
    scanLockRef.current = false;
    lastBarcodeRef.current = null;
    setScanned(false);
    setScanProduct(null);
    setScanNotFound(false);
    // Force CameraView remount so native decoder fully resets
    setCameraKey((k) => k + 1);
  }

  function handleAddScanProduct() {
    if (!scanProduct) return;
    const g = parseFloat(scanServingG) || 100;
    addToTray({
      food_name: scanProduct.name + (scanProduct.brand ? ` (${scanProduct.brand})` : ''),
      calories: Math.round(scanProduct.calories * g / 100),
      protein_g: parseFloat((scanProduct.protein_g * g / 100).toFixed(1)),
      carbs_g: parseFloat((scanProduct.carbs_g * g / 100).toFixed(1)),
      fat_g: parseFloat((scanProduct.fat_g * g / 100).toFixed(1)),
      fiber_g: parseFloat((scanProduct.fiber_g * g / 100).toFixed(1)),
      serving_g: g,
      source: 'barcode',
    });
    handleScanAgain();
  }

  // ── Describe ──────────────────────────────────────────────────────────────

  // Shared: take parsed items [{item, estimated_g}] → resolve via USDA/AI → set describeItems
  async function resolveAndSetItems(parsed: { item: string; estimated_g: number }[]) {
    const withResults = await Promise.all(
      parsed.map(async (p) => {
        let results = await searchUSDA(p.item);
        results = results.filter((r) => r.calories > 0 || r.protein_g > 0 || r.carbs_g > 0 || r.fat_g > 0);
        if (results.length === 0) {
          const aiResult = await estimateMacrosWithAI(p.item);
          if (aiResult) results = [aiResult];
        }
        return {
          item: p.item,
          estimated_g: p.estimated_g,
          results,
          selectedIdx: 0,
          servingG: String(Math.round(p.estimated_g)),
          selectedServingIdx: -1,
          servingOptionsLoading: false,
          qty: String(Math.round(p.estimated_g)),
          unitGrams: 1,
          unitLabel: 'g',
          showUnitPicker: false,
        } as DescribeItem;
      }),
    );
    setDescribeItems(withResults);
    setCheckedItems(new Set(withResults.map((_, i) => i)));

    // Background-fetch serving options
    withResults.forEach(async (wi, idx) => {
      const top = wi.results[0];
      if (!top || top.fdcId === -1) return;
      setDescribeItems((prev) => prev ? prev.map((it, i) => i === idx ? { ...it, servingOptionsLoading: true } : it) : prev);
      const detail = await getFatSecretFood(top.fdcId);
      setDescribeItems((prev) => {
        if (!prev) return prev;
        return prev.map((it, i) => {
          if (i !== idx) return it;
          if (!detail) return { ...it, servingOptionsLoading: false };
          const hasNutrition = detail.calories > 0 || detail.protein_g > 0 || detail.carbs_g > 0 || detail.fat_g > 0;
          return {
            ...it,
            servingOptionsLoading: false,
            results: it.results.map((r, ri) =>
              ri === 0 ? {
                ...r,
                ...(hasNutrition ? { calories: detail.calories, protein_g: detail.protein_g, carbs_g: detail.carbs_g, fat_g: detail.fat_g, fiber_g: detail.fiber_g } : {}),
                serving_options: detail.serving_options,
              } : r
            ),
          };
        });
      });
    });
  }

  async function handleParse() {
    if (!describeText.trim()) return;
    setDescribing(true);
    setDescribeError('');
    try {
      const raw = await callOpenAI([{ role: 'user', content: `User input: "${describeText}"` }], PARSE_SYSTEM);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON');
      const parsed: { item: string; estimated_g: number }[] = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty');
      // Dispatch to background processing and navigate away
      startFoodTask({ source: 'describe', parsedItems: parsed });
      router.back();
    } catch {
      setDescribeError("Couldn't parse - try being more specific.");
      setDescribing(false);
    }
  }

  // Voice chat completed — dispatch to background processing
  function handleVoiceChatComplete(items: { item: string; estimated_g: number }[]) {
    setShowVoiceChat(false);
    startFoodTask({ source: 'voice', parsedItems: items });
    router.back();
  }

  function toggleCheck(idx: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function updateDescribeItem(idx: number, patch: Partial<DescribeItem>) {
    setDescribeItems((prev) => prev ? prev.map((it, i) => i === idx ? { ...it, ...patch } : it) : prev);
  }

  function handleAddChecked() {
    if (!describeItems) return;
    for (const idx of Array.from(checkedItems)) {
      const item = describeItems[idx];
      if (!item) continue;
      const food = item.results[item.selectedIdx];
      if (!food) continue;
      const q = parseFloat(item.qty) || 1;
      const g = q * item.unitGrams;
      addToTray({
        food_name: food.name + (food.brand ? ` (${food.brand})` : ''),
        calories: Math.round(food.calories * g / 100),
        protein_g: parseFloat((food.protein_g * g / 100).toFixed(1)),
        carbs_g: parseFloat((food.carbs_g * g / 100).toFixed(1)),
        fat_g: parseFloat((food.fat_g * g / 100).toFixed(1)),
        fiber_g: parseFloat((food.fiber_g * g / 100).toFixed(1)),
        serving_g: g,
        source: 'manual',
        serving_description: item.unitLabel !== 'g' ? `${item.qty} ${item.unitLabel}` : undefined,
      });
    }
    setDescribeItems(null);
    setDescribeText('');
    setCheckedItems(new Set());
  }

  // ── Tray actions ──────────────────────────────────────────────────────────

  async function handleLogMeal() {
    // Capture totals before clearing tray
    const totals = {
      protein: parseFloat(trayItems.reduce((s, it) => s + it.protein_g, 0).toFixed(1)),
      calories: Math.round(trayItems.reduce((s, it) => s + it.calories, 0)),
      carbs: parseFloat(trayItems.reduce((s, it) => s + it.carbs_g, 0).toFixed(1)),
      fat: parseFloat(trayItems.reduce((s, it) => s + it.fat_g, 0).toFixed(1)),
      fiber: parseFloat(trayItems.reduce((s, it) => s + it.fiber_g, 0).toFixed(1)),
    };
    await logMeal('snack');
    const synced = await hkStore.writeNutrition(totals);
    if (synced) useUiStore.getState().showHealthSyncToast('Nutrition saved to Apple Health');
    refreshActuals();
    setInsightsDefaultTab('lifestyle');
    router.replace('/(tabs)/log' as any);
  }

  async function handleSaveAsMeal() {
    if (!saveMealName.trim()) return;
    await saveAsMeal(saveMealName.trim());
    setShowSaveInput(false);
    setSaveMealName('');
  }

  // ── Custom food ───────────────────────────────────────────────────────────

  async function handleSaveCustomFood() {
    if (!cfName.trim()) return;
    await addCustomFood({
      name: cfName.trim(),
      brand: cfBrand.trim() || null,
      calories_per_100g: parseFloat(cfCal) || 0,
      protein_per_100g: parseFloat(cfProtein) || 0,
      carbs_per_100g: parseFloat(cfCarbs) || 0,
      fat_per_100g: parseFloat(cfFat) || 0,
      fiber_per_100g: parseFloat(cfFiber) || 0,
      serving_size_g: parseFloat(cfServing) || 100,
    });
    setShowCustomModal(false);
    setCfName(''); setCfBrand(''); setCfCal(''); setCfProtein('');
    setCfCarbs(''); setCfFat(''); setCfFiber(''); setCfServing('100');
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const trayTotal = {
    calories: trayItems.reduce((s, it) => s + it.calories, 0),
    protein_g: parseFloat(trayItems.reduce((s, it) => s + it.protein_g, 0).toFixed(1)),
    carbs_g: parseFloat(trayItems.reduce((s, it) => s + it.carbs_g, 0).toFixed(1)),
    fat_g: parseFloat(trayItems.reduce((s, it) => s + it.fat_g, 0).toFixed(1)),
    fiber_g: parseFloat(trayItems.reduce((s, it) => s + it.fiber_g, 0).toFixed(1)),
  };

  const filteredCustomFoods = customFoods.filter((cf) =>
    !query.trim() || cf.name.toLowerCase().includes(query.toLowerCase()),
  );

  const g = parseFloat(servingG) || 100;

  // ─────────────────────────────────────────────────────────────────────────

  const MODE_ICONS: Record<Mode, string> = {
    search: 'search-outline',
    scan: 'barcode-outline',
    describe: 'create-outline',
    camera: 'camera-outline',
  };
  const MODE_LABELS: Record<Mode, string> = {
    search: 'Search',
    scan: 'Scan',
    describe: 'Describe',
    camera: 'Camera',
  };

  const trayFooterHeight = trayItems.length > 0 ? (showSaveInput ? 260 : expandedTrayItemId ? 340 : 220) : 0;

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 22, backgroundColor: colors.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }]} />
          <GlassBorder r={22} />
          <Ionicons name="chevron-back" size={20} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
        </TouchableOpacity>

        <Text style={s.headerTitle}>LOG MEALS</Text>

        {/* Mode pills */}
        <View style={s.modePills}>
          {(['search', 'scan', 'describe', 'camera'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => switchMode(m)}
              style={[s.modePill, mode === m && s.modePillActive]}
              activeOpacity={0.75}
            >
              <Ionicons
                name={MODE_ICONS[m] as any}
                size={15}
                color={mode === m ? colors.textPrimary : (colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Content area ───────────────────────────────────────────────────── */}

      {/* SCAN MODE - full body camera */}
      {mode === 'scan' ? (
        <View style={{ flex: 1 }}>
          {camPermission?.granted ? (
            <View style={{ flex: 1 }}>
              <CameraView
                key={cameraKey}
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarcode}
              />
              {/* Barcode frame overlay */}
              <View style={s.barcodeFrame} pointerEvents="none">
                <View style={s.barcodeCornerTL} />
                <View style={s.barcodeCornerTR} />
                <View style={s.barcodeCornerBL} />
                <View style={s.barcodeCornerBR} />
              </View>
              {!scanned && (
                <View style={s.scanHintWrap} pointerEvents="none">
                  <Text style={s.scanHint}>Point at a barcode</Text>
                </View>
              )}
              {scanFetching && (
                <View style={[StyleSheet.absoluteFillObject, s.scanLoadingOverlay]}>
                  <ActivityIndicator size="large" color={ORANGE} />
                  <Text style={s.scanLoadingText}>Looking up product…</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={s.centered}>
              <Ionicons name="barcode-outline" size={60} color={ORANGE} />
              <Text style={s.permTitle}>Camera Access Needed</Text>
              <Text style={s.permDesc}>Allow camera access to scan barcodes.</Text>
              <TouchableOpacity style={s.permBtn} onPress={requestCamPermission} activeOpacity={0.8}>
                <Text style={s.permBtnText}>Allow Camera</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scan product panel */}
          {(scanProduct || scanNotFound) && (
            <View style={[s.scanPanel, { paddingBottom: insets.bottom + 16 }]}>
              <BlurView intensity={85} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
              <GlassBorder r={0} />
              {scanProduct ? (
                <View style={{ padding: 20 }}>
                  <Text style={s.scanProductName} numberOfLines={2}>{scanProduct.name}</Text>
                  {!!scanProduct.brand && <Text style={s.scanProductBrand}>{scanProduct.brand}</Text>}
                  <View style={s.macroRow}>
                    <Text style={s.macroPill}>{Math.round(scanProduct.calories * (parseFloat(scanServingG) || 100) / 100)} cal</Text>
                    <Text style={s.macroPill}>{(scanProduct.protein_g * (parseFloat(scanServingG) || 100) / 100).toFixed(1)}g P</Text>
                    <Text style={s.macroPill}>{(scanProduct.carbs_g * (parseFloat(scanServingG) || 100) / 100).toFixed(1)}g C</Text>
                    <Text style={s.macroPill}>{(scanProduct.fat_g * (parseFloat(scanServingG) || 100) / 100).toFixed(1)}g F</Text>
                  </View>
                  <View style={s.scanServingRow}>
                    <Text style={s.servingLabel}>Amount</Text>
                    <View style={s.servingInputWrap}>
                      <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
                      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
                      <GlassBorder />
                      <TextInput
                        style={s.servingInput}
                        value={scanServingG}
                        onChangeText={setScanServingG}
                        keyboardType="numeric"
                        selectTextOnFocus
                      />
                    </View>
                    <Text style={s.servingUnit}>g</Text>
                  </View>
                  <View style={s.scanBtns}>
                    <TouchableOpacity style={s.scanSecBtn} onPress={handleScanAgain} activeOpacity={0.8}>
                      <Text style={s.scanSecBtnText}>Scan Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.scanPrimBtn} onPress={handleAddScanProduct} activeOpacity={0.85}>
                      <Text style={s.scanPrimBtnText}>Add to Meal</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Ionicons name="alert-circle-outline" size={36} color={ORANGE} style={{ marginBottom: 8 }} />
                  <Text style={s.scanProductName}>Product Not Found</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 16, textAlign: 'center' }}>
                    This barcode wasn't in the database. Try searching manually.
                  </Text>
                  <TouchableOpacity style={s.scanPrimBtn} onPress={handleScanAgain} activeOpacity={0.8}>
                    <Text style={s.scanPrimBtnText}>Scan Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      ) : mode === 'camera' ? (
        /* CAMERA MODE - full body camera (photo) */
        <View style={{ flex: 1 }}>
          {photoUri ? (
            /* ── Preview ── */
            <View style={{ flex: 1 }}>
              <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              <View style={[s.cameraBottomBar, { paddingBottom: insets.bottom + 30 }]}>
                <TouchableOpacity onPress={handleRetakePhoto} style={s.cameraLibraryBtn} activeOpacity={0.75}>
                  <Ionicons name="refresh-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={s.cameraAnalyzeBtn} onPress={handleAnalyzePhoto} activeOpacity={0.85}>
                  <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={s.cameraAnalyzeBtnText}>Analyze with AI</Text>
                </TouchableOpacity>
                <View style={{ width: 48 }} />
              </View>
            </View>
          ) : camPermission?.granted ? (
            /* ── Live camera ── */
            <View style={{ flex: 1 }}>
              <CameraView
                ref={photoCameraRef}
                key={cameraPhotoKey}
                style={StyleSheet.absoluteFillObject}
                facing="back"
              />
              {/* Square viewfinder frame */}
              <View style={s.photoFrame} pointerEvents="none">
                <View style={s.photoCornerTL} />
                <View style={s.photoCornerTR} />
                <View style={s.photoCornerBL} />
                <View style={s.photoCornerBR} />
              </View>
              <View style={s.photoHintWrap} pointerEvents="none">
                <Text style={s.scanHint}>Point at your food</Text>
              </View>
              {/* Shutter + library buttons */}
              <View style={[s.cameraBottomBar, { paddingBottom: insets.bottom + 30 }]}>
                <TouchableOpacity onPress={handlePickLibrary} style={s.cameraLibraryBtn} activeOpacity={0.75}>
                  <Ionicons name="images-outline" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCaptureShutter} style={s.shutterBtn} activeOpacity={0.85}>
                  <View style={s.shutterInner} />
                </TouchableOpacity>
                <View style={{ width: 48 }} />
              </View>
            </View>
          ) : (
            /* ── Permission prompt ── */
            <View style={s.centered}>
              <Ionicons name="camera-outline" size={60} color={ORANGE} />
              <Text style={s.permTitle}>Camera Access Needed</Text>
              <Text style={s.permDesc}>Allow camera access to take food photos.</Text>
              <TouchableOpacity style={s.permBtn} onPress={requestCamPermission} activeOpacity={0.8}>
                <Text style={s.permBtnText}>Allow Camera</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            s.scroll,
            { paddingBottom: trayFooterHeight + insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── SEARCH MODE ──────────────────────────────────────────────── */}
          {mode === 'search' && (
            <>
              {/* Search bar */}
              <View style={s.searchBarWrapper}>
                <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, s.searchBarOverlay]} />
                <GlassBorder r={16} />
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={{ marginRight: 10 }} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search foods, restaurants…"
                  placeholderTextColor={colors.textSecondary}
                  value={query}
                  onChangeText={handleQueryChange}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {!!query && (
                  <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={17} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Recent Items */}
              {!query.trim() && recentFoods.length > 0 && (
                <>
                  <SectionLabel>RECENT ITEMS</SectionLabel>
                  {recentFoods.slice(0, 8).map((item) => (
                    <TouchableOpacity
                      key={item.food_name}
                      style={s.resultRow}
                      onPress={() => openPendingFromRecent(item)}
                      activeOpacity={0.75}
                    >
                      <View style={s.resultLeft}>
                        <Text style={s.resultName} numberOfLines={1}>{item.food_name}</Text>
                        <Text style={s.resultSub}>{item.log_count}× logged</Text>
                      </View>
                      <View style={s.resultRight}>
                        <Text style={s.resultCal}>{item.calories} cal</Text>
                        <TouchableOpacity
                          onPress={() => toggleFavorite(item.food_name)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons
                            name={item.is_favorite ? 'star' : 'star-outline'}
                            size={16}
                            color={item.is_favorite ? ORANGE : (colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)')}
                          />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Custom Recipes */}
              {!query.trim() && customFoods.length > 0 && (
                <>
                  <SectionLabel>CUSTOM RECIPES</SectionLabel>
                  {customFoods.slice(0, 5).map((cf) => (
                    <TouchableOpacity
                      key={cf.id}
                      style={s.resultRow}
                      onPress={() => openPendingFromCustom(cf)}
                      activeOpacity={0.75}
                    >
                      <View style={s.resultLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={s.customBadge}><Text style={s.customBadgeText}>Custom</Text></View>
                          <Text style={s.resultName} numberOfLines={1}>{cf.name}</Text>
                        </View>
                        {!!cf.brand && <Text style={s.resultSub}>{cf.brand}</Text>}
                      </View>
                      <View style={s.resultRight}>
                        <Text style={s.resultCal}>{cf.calories_per_100g} cal</Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Saved Meals */}
              {!query.trim() && savedMeals.length > 0 && (
                <>
                  <SectionLabel>SAVED MEALS</SectionLabel>
                  {savedMeals.slice(0, 5).map((meal) => (
                    <TouchableOpacity
                      key={meal.id}
                      style={s.resultRow}
                      onPress={() => loadSavedMeal(meal)}
                      activeOpacity={0.75}
                    >
                      <View style={s.resultLeft}>
                        <Text style={s.resultName} numberOfLines={1}>{meal.name}</Text>
                        <Text style={s.resultSub}>{meal.items.length} items</Text>
                      </View>
                      <View style={s.resultRight}>
                        <Text style={s.resultCal}>{meal.total_calories} cal</Text>
                        <Ionicons name="play-circle-outline" size={18} color={ORANGE} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Empty state — no query, no data yet */}
              {!query.trim() && recentFoods.length === 0 && customFoods.length === 0 && savedMeals.length === 0 && (
                <View style={s.centered}>
                  <Ionicons name="restaurant-outline" size={40} color={colors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} />
                  <Text style={[s.emptyText, { marginTop: 12 }]}>Search for a food or restaurant above</Text>
                  <Text style={[s.emptyText, { fontSize: 14, marginTop: 4 }]}>Your recent items and saved meals will appear here</Text>
                  <TouchableOpacity style={[s.createFoodBtn, { marginTop: 16 }]} onPress={() => setShowCustomModal(true)} activeOpacity={0.8}>
                    <Ionicons name="add-circle-outline" size={16} color={ORANGE} />
                    <Text style={s.createFoodText}>Create Custom Food</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Custom foods matching query */}
              {!!query.trim() && filteredCustomFoods.length > 0 && (
                <>
                  <SectionLabel>CUSTOM</SectionLabel>
                  {filteredCustomFoods.map((cf) => (
                    <TouchableOpacity
                      key={cf.id}
                      style={s.resultRow}
                      onPress={() => openPendingFromCustom(cf)}
                      activeOpacity={0.75}
                    >
                      <View style={s.resultLeft}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={s.customBadge}><Text style={s.customBadgeText}>Custom</Text></View>
                          <Text style={s.resultName} numberOfLines={1}>{cf.name}</Text>
                        </View>
                        {!!cf.brand && <Text style={s.resultSub}>{cf.brand}</Text>}
                      </View>
                      <View style={s.resultRight}>
                        <Text style={s.resultCal}>{cf.calories_per_100g} cal</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Search results */}
              {!!query.trim() && (
                searching ? (
                  <View style={s.centered}>
                    <ActivityIndicator size="large" color={ORANGE} />
                  </View>
                ) : searchResults.length > 0 ? (
                  <>
                    <SectionLabel>SEARCH RESULTS</SectionLabel>
                    {searchResults.map((item) => (
                      <TouchableOpacity
                        key={item.fdcId}
                        style={s.resultRow}
                        onPress={() => openPendingFromResult(item)}
                        activeOpacity={0.75}
                        disabled={detailLoading !== null}
                      >
                        <View style={s.resultLeft}>
                          <Text style={s.resultName} numberOfLines={2}>{item.name}</Text>
                          {!!item.brand && <Text style={s.resultSub}>{item.brand}</Text>}
                        </View>
                        <View style={s.resultRight}>
                          {detailLoading === item.fdcId ? (
                            <ActivityIndicator size="small" color={ORANGE} />
                          ) : (
                            <>
                              <Text style={s.resultCal}>{item.calories} cal</Text>
                              <Text style={s.resultPer}>/ 100g</Text>
                            </>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={s.createFoodBtn} onPress={() => setShowCustomModal(true)} activeOpacity={0.8}>
                      <Ionicons name="add-circle-outline" size={16} color={ORANGE} />
                      <Text style={s.createFoodText}>Create Custom Food</Text>
                    </TouchableOpacity>
                  </>
                ) : filteredCustomFoods.length === 0 ? (
                  <View style={s.centered}>
                    <Text style={s.emptyText}>No results - try a different name</Text>
                    <TouchableOpacity style={[s.createFoodBtn, { marginTop: 12 }]} onPress={() => setShowCustomModal(true)} activeOpacity={0.8}>
                      <Ionicons name="add-circle-outline" size={16} color={ORANGE} />
                      <Text style={s.createFoodText}>Create Custom Food</Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              )}
            </>
          )}

          {/* ── DESCRIBE MODE ────────────────────────────────────────────── */}
          {mode === 'describe' && (
            <>
              {!describeItems ? (
                <>
                  <View style={s.describeCard}>
                    <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
                    <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
                    <GlassBorder r={20} />
                    <View style={{ padding: 18 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: ORANGE, letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 10, marginTop: 4 }}>DESCRIBE YOUR MEAL</Text>
                        <TouchableOpacity
                          onPress={() => setShowVoiceChat(true)}
                          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,116,42,0.12)', alignItems: 'center', justifyContent: 'center' }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="mic-outline" size={18} color={ORANGE} />
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={s.describeInput}
                        placeholder={'e.g. "Big Mac and large fries" or "chicken stir fry with rice"'}
                        placeholderTextColor={colors.textSecondary}
                        value={describeText}
                        onChangeText={setDescribeText}
                        multiline
                        textAlignVertical="top"
                        autoFocus
                      />
                    </View>
                  </View>
                  {!!describeError && (
                    <View style={s.errorRow}>
                      <Ionicons name="alert-circle-outline" size={15} color={ORANGE} />
                      <Text style={s.errorText}>{describeError}</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[s.describeAddBtn, (!describeText.trim() || describing) && { opacity: 0.4 }]}
                    onPress={handleParse}
                    disabled={!describeText.trim() || describing}
                    activeOpacity={0.85}
                  >
                    {describing ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <ActivityIndicator color={colors.textPrimary} size="small" />
                        <Text style={s.describeAddBtnText}>Analyzing…</Text>
                      </View>
                    ) : (
                      <Text style={s.describeAddBtnText}>Add</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={[{ fontSize: 12, fontWeight: '800', color: ORANGE, letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 10, marginTop: 4 }, { marginBottom: 12 }]}>CONFIRM ITEMS</Text>
                  {describeItems.map((item, idx) => {
                    const q = parseFloat(item.qty) || 0;
                    const g2 = q * item.unitGrams;
                    const f = item.results.length > 0 ? item.results[item.selectedIdx] : null;
                    const servingOpts = f?.serving_options;

                    // Build unit list: always start with grams, then add FatSecret serving options
                    const unitOptions: { label: string; grams: number }[] = [{ label: 'g', grams: 1 }];
                    if (servingOpts) {
                      for (const opt of servingOpts) {
                        // Extract short label (e.g. "1 cup (200g)" → "cup", "100g" → skip since we have g)
                        const short = opt.label.replace(/\s*\(.*\)/, '').replace(/^1\s+/, '').trim();
                        if (short && short !== 'g' && short !== '100g') {
                          unitOptions.push({ label: short, grams: opt.grams });
                        }
                      }
                    }

                    return (
                    <View key={idx} style={s.describeItemCard}>
                      <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
                      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 18, backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
                      <GlassBorder r={18} />
                      <View style={{ padding: 14 }}>
                        {/* Header: checkbox + name */}
                        <View style={s.describeItemHeader}>
                          <TouchableOpacity
                            onPress={() => toggleCheck(idx)}
                            style={[s.checkbox, checkedItems.has(idx) && s.checkboxChecked]}
                            activeOpacity={0.75}
                          >
                            {checkedItems.has(idx) && <Ionicons name="checkmark" size={14} color={colors.textPrimary} />}
                          </TouchableOpacity>
                          <Text style={s.describeItemName}>{item.item}</Text>
                        </View>

                        {f ? (
                          <View style={{ flexDirection: 'row', marginTop: 10 }}>
                            {/* LEFT: Mini nutrition label */}
                            <View style={{ flex: 1, marginRight: 14 }}>
                              <View style={{ height: 2, backgroundColor: colors.textPrimary, marginBottom: 4 }} />
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>Calories</Text>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>{Math.round(f.calories * g2 / 100)}</Text>
                              </View>
                              <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: 2 }} />
                              {([
                                ['Protein', f.protein_g],
                                ['Carbs', f.carbs_g],
                                ['Fat', f.fat_g],
                                ['Fiber', f.fiber_g],
                              ] as const).map(([label, per100]) => (
                                <View key={label}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>{(per100 * g2 / 100).toFixed(1)}g</Text>
                                  </View>
                                  <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: 2 }} />
                                </View>
                              ))}
                              <View style={{ height: 2, backgroundColor: colors.textPrimary, marginTop: 2 }} />
                            </View>

                            {/* RIGHT: Quantity input + unit dropdown */}
                            <View style={{ width: 110, alignItems: 'center', justifyContent: 'center' }}>
                              {/* Quantity input */}
                              <View style={{ width: 90, height: 44, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                                <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
                                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
                                <TextInput
                                  style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.textPrimary }}
                                  value={item.qty}
                                  onChangeText={(v) => {
                                    const newG = (parseFloat(v) || 0) * item.unitGrams;
                                    updateDescribeItem(idx, { qty: v, servingG: String(Math.round(newG)) });
                                  }}
                                  keyboardType="decimal-pad"
                                  selectTextOnFocus
                                />
                              </View>

                              {/* Unit dropdown */}
                              {item.servingOptionsLoading ? (
                                <ActivityIndicator size="small" color={ORANGE} />
                              ) : (
                                <TouchableOpacity
                                  onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    updateDescribeItem(idx, { showUnitPicker: !item.showUnitPicker });
                                  }}
                                  activeOpacity={0.7}
                                  style={{
                                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                                    paddingHorizontal: 12, paddingVertical: 8,
                                    borderRadius: 10, backgroundColor: colors.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                                    borderWidth: 1, borderColor: colors.borderSubtle,
                                  }}
                                >
                                  <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginRight: 4 }}>{item.unitLabel}</Text>
                                  <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ) : (
                          <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4, fontStyle: 'italic' }}>No match found</Text>
                        )}

                        {/* Unit picker dropdown */}
                        {item.showUnitPicker && unitOptions.length > 0 && (
                          <View style={{ marginTop: 8, backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 12, overflow: 'hidden' }}>
                            {unitOptions.map((opt, oi) => (
                              <TouchableOpacity
                                key={oi}
                                onPress={() => {
                                  const newQ = item.unitLabel === 'g' && opt.label !== 'g'
                                    ? String(Math.round((parseFloat(item.qty) || 0) * item.unitGrams / opt.grams * 10) / 10)
                                    : item.qty;
                                  const newG = (parseFloat(newQ) || 0) * opt.grams;
                                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                  updateDescribeItem(idx, {
                                    unitLabel: opt.label,
                                    unitGrams: opt.grams,
                                    qty: newQ,
                                    servingG: String(Math.round(newG)),
                                    showUnitPicker: false,
                                  });
                                }}
                                activeOpacity={0.7}
                                style={{
                                  paddingVertical: 10, paddingHorizontal: 14,
                                  borderBottomWidth: oi < unitOptions.length - 1 ? 1 : 0,
                                  borderBottomColor: colors.borderSubtle,
                                  backgroundColor: item.unitLabel === opt.label ? (colors.isDark ? 'rgba(255,116,42,0.15)' : 'rgba(255,116,42,0.1)') : 'transparent',
                                }}
                              >
                                <Text style={{ fontSize: 16, fontWeight: item.unitLabel === opt.label ? '700' : '500', color: item.unitLabel === opt.label ? ORANGE : colors.textPrimary }}>
                                  {opt.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>
                    );
                  })}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <TouchableOpacity
                      style={s.describeRetryBtn}
                      onPress={() => { setDescribeItems(null); setCheckedItems(new Set()); }}
                      activeOpacity={0.75}
                    >
                      <Text style={s.describeRetryText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.describeAddBtn, { flex: 1, marginTop: 0 }, checkedItems.size === 0 && { opacity: 0.4 }]}
                      onPress={handleAddChecked}
                      disabled={checkedItems.size === 0}
                      activeOpacity={0.85}
                    >
                      <Text style={s.describeAddBtnText}>
                        Add to Meal ({checkedItems.size})
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}

        </ScrollView>
      )}

      {/* ── Tray Footer ────────────────────────────────────────────────────── */}
      {trayItems.length > 0 && (
        <View style={[s.trayFooter, { paddingBottom: insets.bottom + 8 }]}>
          <BlurView intensity={85} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.55)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }]} />
          <GlassBorder r={0} />

          <View style={{ padding: 16 }}>

            {/* Tray items */}
            {trayItems.map((item) => {
              const isExpanded = expandedTrayItemId === item.id;
              return (
                <View key={item.id}>
                  <TouchableOpacity
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpandedTrayItemId(isExpanded ? null : item.id);
                    }}
                    activeOpacity={0.7}
                    style={s.trayItemRow}
                  >
                    <Text style={s.trayItemName} numberOfLines={isExpanded ? undefined : 1}>{item.food_name}</Text>
                    <Text style={s.trayItemCal}>{item.calories} cal</Text>
                    <TouchableOpacity onPress={() => removeFromTray(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close" size={16} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={{ marginLeft: 4, marginRight: 4, marginBottom: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                      <View style={{ height: 1.5, backgroundColor: colors.textPrimary, marginBottom: 4 }} />
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>Calories</Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>{item.calories}</Text>
                      </View>
                      <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: 2 }} />
                      {([
                        ['Protein', item.protein_g],
                        ['Carbs', item.carbs_g],
                        ['Fat', item.fat_g],
                        ['Fiber', item.fiber_g],
                      ] as const).map(([label, val]) => (
                        <View key={label}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{label}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{val.toFixed(1)}g</Text>
                          </View>
                          <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginVertical: 2 }} />
                        </View>
                      ))}
                      <View style={{ height: 1.5, backgroundColor: colors.textPrimary, marginTop: 2 }} />
                      {item.serving_description ? (
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Serving: {item.serving_description}</Text>
                      ) : (
                        <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>Serving: {item.serving_g}g</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Totals */}
            <View style={s.trayTotals}>
              <Text style={s.trayTotalText}>{trayTotal.calories} cal</Text>
              <Text style={s.trayTotalSep}>·</Text>
              <Text style={s.trayTotalText}>{trayTotal.protein_g}g protein</Text>
              <Text style={s.trayTotalSep}>·</Text>
              <Text style={s.trayTotalText}>{trayTotal.carbs_g}g carbs</Text>
              <Text style={s.trayTotalSep}>·</Text>
              <Text style={s.trayTotalText}>{trayTotal.fat_g}g fat</Text>
              <Text style={s.trayTotalSep}>·</Text>
              <Text style={s.trayTotalText}>{trayTotal.fiber_g}g fiber</Text>
            </View>

            {/* Save as Recipe input */}
            {showSaveInput && (
              <View style={s.saveInputRow}>
                <TextInput
                  style={s.saveInput}
                  placeholder="Recipe name…"
                  placeholderTextColor={colors.textSecondary}
                  value={saveMealName}
                  onChangeText={setSaveMealName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSaveAsMeal}
                />
                <TouchableOpacity onPress={handleSaveAsMeal} style={s.saveInputBtn} activeOpacity={0.8}>
                  <Text style={s.saveInputBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowSaveInput(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Actions */}
            <View style={s.trayActions}>
              {trayItems.length >= 2 && !showSaveInput && (
                <TouchableOpacity style={s.traySaveBtn} onPress={() => setShowSaveInput(true)} activeOpacity={0.8}>
                  <Text style={s.traySaveBtnText}>Save as Recipe</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.trayLogBtn, loading && { opacity: 0.7 }]}
                onPress={handleLogMeal}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={colors.textPrimary} size="small" />
                ) : (
                  <Text style={s.trayLogBtnText}>Log Meal →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Voice Food Chat ────────────────────────────────────────────────── */}
      <Modal
        visible={showVoiceChat}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowVoiceChat(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <VoiceFoodChat
            onComplete={handleVoiceChatComplete}
            onCancel={() => setShowVoiceChat(false)}
          />
        </View>
      </Modal>

      {/* ── Add-to-meal overlay ─────────────────────────────────────────────── */}
      <Modal
        visible={!!pendingFood}
        transparent
        animationType="slide"
        onRequestClose={() => setPendingFood(null)}
      >
        <View style={s.overlayContainer}>
          <TouchableOpacity style={s.overlayBackdrop} onPress={() => setPendingFood(null)} activeOpacity={1} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[s.overlaySheet, { paddingBottom: insets.bottom + 16 }]}>
              <BlurView intensity={85} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'rgba(0,0,0,0.6)' }]} />
              <GlassBorder r={0} />

              <View style={{ padding: 20 }}>
                <View style={s.overlayHandle} />

                {pendingFood && (
                  <>
                    {/* Food name + info button */}
                    <View style={s.overlayTitleRow}>
                      <Text style={[s.overlayFoodName, { flex: 1, marginBottom: 0 }]} numberOfLines={2}>
                        {pendingFood.food_name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setShowNutritionInfo((v) => !v)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={s.infoIconBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={showNutritionInfo ? 'close-circle' : 'information-circle-outline'}
                          size={22}
                          color={showNutritionInfo ? ORANGE : colors.textSecondary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Inline italic macros */}
                    <Text style={s.macroInlineText}>
                      {Math.round(pendingFood.calories_per_100g * g / 100)} calories
                      {'  ·  '}{(pendingFood.protein_per_100g * g / 100).toFixed(1)}g protein
                      {'  ·  '}{(pendingFood.carbs_per_100g * g / 100).toFixed(1)}g carbs
                      {'  ·  '}{(pendingFood.fat_per_100g * g / 100).toFixed(1)}g fat
                    </Text>

                    {/* Nutrition label panel */}
                    {showNutritionInfo && (
                      <View style={s.nutritionLabel}>
                        <Text style={s.nutritionTitle}>Nutrition Facts</Text>
                        <Text style={s.nutritionServing}>
                          Per {
                            selectedServingIdx >= 0 && pendingFood.serving_options?.[selectedServingIdx]
                              ? pendingFood.serving_options[selectedServingIdx].label
                              : `${g}g`
                          }
                        </Text>
                        <View style={s.nutritionDividerThick} />
                        <View style={s.nutritionRow}>
                          <Text style={s.nutritionLabelBold}>Calories</Text>
                          <Text style={s.nutritionValueBold}>{Math.round(pendingFood.calories_per_100g * g / 100)}</Text>
                        </View>
                        <View style={s.nutritionDivider} />
                        <View style={s.nutritionRow}>
                          <Text style={s.nutritionLabelText}>Total Fat</Text>
                          <Text style={s.nutritionValueText}>{(pendingFood.fat_per_100g * g / 100).toFixed(1)}g</Text>
                        </View>
                        <View style={s.nutritionRow}>
                          <Text style={s.nutritionLabelText}>Total Carbohydrate</Text>
                          <Text style={s.nutritionValueText}>{(pendingFood.carbs_per_100g * g / 100).toFixed(1)}g</Text>
                        </View>
                        <View style={[s.nutritionRow, { paddingLeft: 14 }]}>
                          <Text style={[s.nutritionLabelText, { color: colors.textSecondary }]}>Dietary Fiber</Text>
                          <Text style={[s.nutritionValueText, { color: colors.textSecondary }]}>{(pendingFood.fiber_per_100g * g / 100).toFixed(1)}g</Text>
                        </View>
                        <View style={s.nutritionRow}>
                          <Text style={s.nutritionLabelText}>Protein</Text>
                          <Text style={s.nutritionValueText}>{(pendingFood.protein_per_100g * g / 100).toFixed(1)}g</Text>
                        </View>
                        <View style={s.nutritionDivider} />
                        <Text style={s.nutritionFootnote}>Values are per 100g unless a serving is selected above.</Text>
                      </View>
                    )}

                    {/* Serving size */}
                    <Text style={[{ fontSize: 12, fontWeight: '800', color: ORANGE, letterSpacing: 3, textTransform: 'uppercase' as const, marginBottom: 10, marginTop: 4 }, { marginTop: 16, marginBottom: 10 }]}>SERVING SIZE</Text>

                    {/* Serving option pills - spinner while fetching detail */}
                    {detailLoading !== null ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <ActivityIndicator size="small" color={ORANGE} />
                        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading serving sizes…</Text>
                      </View>
                    ) : pendingFood.serving_options && pendingFood.serving_options.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                        {pendingFood.serving_options.map((opt, idx) => (
                          <TouchableOpacity
                            key={idx}
                            onPress={() => handleServingPillSelect(opt, idx)}
                            style={[s.servingPill, selectedServingIdx === idx && s.servingPillActive]}
                            activeOpacity={0.75}
                          >
                            <Text style={[s.servingPillText, selectedServingIdx === idx && s.servingPillTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}

                    {/* Custom grams */}
                    <View style={s.servingRow}>
                      <Text style={s.servingLabel}>Custom</Text>
                      <View style={s.servingInputWrap}>
                        <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
                        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]} />
                        <GlassBorder />
                        <TextInput
                          style={s.servingInput}
                          value={servingG}
                          onChangeText={(v) => { setServingG(v); setSelectedServingIdx(-1); }}
                          keyboardType="numeric"
                          selectTextOnFocus
                        />
                      </View>
                      <Text style={s.servingUnit}>g</Text>
                    </View>

                    <TouchableOpacity style={s.overlayAddBtn} onPress={handleAddPendingToTray} activeOpacity={0.85}>
                      <Text style={s.overlayAddBtnText}>Add to Meal</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Custom Food Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={showCustomModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <View style={s.overlayContainer}>
          <TouchableOpacity style={s.overlayBackdrop} onPress={() => setShowCustomModal(false)} activeOpacity={1} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[s.overlaySheet, { paddingBottom: insets.bottom + 16 }]}>
              <BlurView intensity={85} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'rgba(0,0,0,0.6)' }]} />
              <GlassBorder r={0} />
              <View style={{ padding: 20 }}>
                <View style={s.overlayHandle} />
                <Text style={s.overlayFoodName}>Create Custom Food</Text>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {[
                    { val: cfName, set: setCfName, ph: 'Name *', kb: 'default' as const },
                    { val: cfBrand, set: setCfBrand, ph: 'Brand (optional)', kb: 'default' as const },
                    { val: cfCal, set: setCfCal, ph: 'Calories / 100g', kb: 'numeric' as const },
                    { val: cfProtein, set: setCfProtein, ph: 'Protein g / 100g', kb: 'numeric' as const },
                    { val: cfCarbs, set: setCfCarbs, ph: 'Carbs g / 100g', kb: 'numeric' as const },
                    { val: cfFat, set: setCfFat, ph: 'Fat g / 100g', kb: 'numeric' as const },
                    { val: cfFiber, set: setCfFiber, ph: 'Fiber g / 100g', kb: 'numeric' as const },
                    { val: cfServing, set: setCfServing, ph: 'Serving size (g)', kb: 'numeric' as const },
                  ].map(({ val, set, ph, kb }) => (
                    <TextInput
                      key={ph}
                      style={s.cfInput}
                      placeholder={ph}
                      placeholderTextColor={colors.textSecondary}
                      value={val}
                      onChangeText={set}
                      keyboardType={kb}
                    />
                  ))}
                  <TouchableOpacity
                    style={[s.overlayAddBtn, !cfName.trim() && { opacity: 0.5 }]}
                    onPress={handleSaveCustomFood}
                    disabled={!cfName.trim()}
                    activeOpacity={0.85}
                  >
                    <Text style={s.overlayAddBtnText}>Save Food</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: c.textPrimary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  modePills: {
    flexDirection: 'row',
    gap: 6,
  },
  modePill: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modePillActive: {
    backgroundColor: ORANGE,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 2,
  },

  // Search bar
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 14,
    height: 48,
    backgroundColor: c.surface,
    marginBottom: 16,
  },
  searchBarOverlay: {
    borderRadius: 16,
    backgroundColor: c.borderSubtle,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: c.textPrimary,
    fontWeight: '500',
  },

  // Result rows
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.glassOverlay,
  },
  resultLeft: { flex: 1, marginRight: 10 },
  resultRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultName: { fontSize: 16, fontWeight: '600', color: c.textPrimary, marginBottom: 2 },
  resultSub: { fontSize: 13, color: c.textSecondary },
  resultCal: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  resultPer: { fontSize: 12, color: c.textSecondary },

  // Custom badge
  customBadge: {
    backgroundColor: 'rgba(255,116,42,0.2)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  customBadgeText: { fontSize: 11, fontWeight: '800', color: ORANGE, letterSpacing: 0.5 },

  // Create food
  createFoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  createFoodText: { fontSize: 15, color: ORANGE, fontWeight: '600' },
  emptyText: { fontSize: 16, color: c.textSecondary, textAlign: 'center' },

  // Describe mode
  describeCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: c.surface,
    marginBottom: 12,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  describeInput: {
    fontSize: 17,
    color: c.textPrimary,
    minHeight: 90,
    lineHeight: 22,
  },
  describeAddBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  describeAddBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  describeItemCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: c.surface,
    marginBottom: 10,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  describeItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  describeItemName: { flex: 1, fontSize: 16, fontWeight: '600', color: c.textPrimary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: ORANGE, borderColor: ORANGE },
  describeRetryBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: c.borderSubtle,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  describeRetryText: { fontSize: 16, fontWeight: '600', color: c.textSecondary },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  errorText: { fontSize: 15, color: ORANGE },

  // Camera (photo) mode
  photoFrame: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    right: '10%',
    aspectRatio: 1,
  },
  photoCornerTL: { position: 'absolute', top: 0, left: 0, width: 32, height: 32, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#FFFFFF', borderTopLeftRadius: 8 },
  photoCornerTR: { position: 'absolute', top: 0, right: 0, width: 32, height: 32, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#FFFFFF', borderTopRightRadius: 8 },
  photoCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 32, height: 32, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#FFFFFF', borderBottomLeftRadius: 8 },
  photoCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#FFFFFF', borderBottomRightRadius: 8 },
  photoHintWrap: { position: 'absolute', top: '68%', left: 0, right: 0, alignItems: 'center' },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
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
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  cameraLibraryBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraAnalyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 32,
    borderRadius: 28,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  cameraAnalyzeBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // Scan mode
  barcodeFrame: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    right: '10%',
    height: '20%',
  },
  barcodeCornerTL: { position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#FFFFFF', borderTopLeftRadius: 6 },
  barcodeCornerTR: { position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#FFFFFF', borderTopRightRadius: 6 },
  barcodeCornerBL: { position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#FFFFFF', borderBottomLeftRadius: 6 },
  barcodeCornerBR: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#FFFFFF', borderBottomRightRadius: 6 },
  scanHintWrap: { position: 'absolute', top: '55%', left: 0, right: 0, alignItems: 'center' },
  scanHint: { color: w(0.7), fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  scanLoadingOverlay: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  scanLoadingText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 12 },
  scanPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  scanProductName: { fontSize: 18, fontWeight: '700', color: c.textPrimary, marginBottom: 4 },
  scanProductBrand: { fontSize: 14, color: c.textSecondary, marginBottom: 10 },
  scanServingRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  scanBtns: { flexDirection: 'row', gap: 10 },
  scanSecBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: c.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  scanSecBtnText: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
  scanPrimBtn: { flex: 1, height: 48, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  scanPrimBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  // Tray footer
  trayFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  trayItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  trayItemName: { flex: 1, fontSize: 15, color: c.textPrimary, fontWeight: '500' },
  trayItemCal: { fontSize: 14, color: c.textSecondary, fontWeight: '600' },
  trayTotals: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  trayTotalText: { fontSize: 14, fontWeight: '700', color: ORANGE },
  trayTotalSep: { fontSize: 14, color: c.textSecondary },
  trayActions: { flexDirection: 'row', gap: 10 },
  traySaveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: c.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  traySaveBtnText: { fontSize: 15, fontWeight: '700', color: c.textSecondary },
  trayLogBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  trayLogBtnText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  saveInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  saveInput: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: c.borderSubtle,
    paddingHorizontal: 12, fontSize: 16, color: c.textPrimary,
  },
  saveInputBtn: {
    paddingHorizontal: 14, height: 40, borderRadius: 10,
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
  },
  saveInputBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  // Add-to-meal overlay
  overlayContainer: { flex: 1, justifyContent: 'flex-end' },
  overlayBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  overlaySheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  overlayHandle: { width: 44, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  overlayTitleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 8 },
  overlayFoodName: { fontSize: 19, fontWeight: '700', color: c.textPrimary, marginBottom: 14, lineHeight: 22 },
  infoIconBtn: { paddingTop: 2 },
  macroInlineText: {
    fontSize: 15,
    color: c.textSecondary,
    fontStyle: 'italic',
    lineHeight: 19,
    marginBottom: 2,
  },

  // Nutrition label
  nutritionLabel: {
    backgroundColor: c.glassOverlay,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: c.borderSubtle,
  },
  nutritionTitle: { fontSize: 20, fontWeight: '900', color: c.textPrimary, letterSpacing: -0.5, marginBottom: 2 },
  nutritionServing: { fontSize: 14, color: c.textSecondary, marginBottom: 8 },
  nutritionDividerThick: { height: 8, backgroundColor: c.border, marginVertical: 8, borderRadius: 2 },
  nutritionDivider: { height: 1, backgroundColor: c.borderSubtle, marginVertical: 5 },
  nutritionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  nutritionLabelBold: { fontSize: 17, fontWeight: '800', color: c.textPrimary },
  nutritionValueBold: { fontSize: 17, fontWeight: '800', color: c.textPrimary },
  nutritionLabelText: { fontSize: 15, fontWeight: '500', color: c.textPrimary },
  nutritionValueText: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  nutritionFootnote: { fontSize: 12, color: c.textMuted, marginTop: 8, fontStyle: 'italic' },

  // Serving size pills
  servingPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: c.borderSubtle,
  },
  servingPillActive: { backgroundColor: ORANGE },
  servingPillText: { fontSize: 15, fontWeight: '600', color: c.textSecondary },
  servingPillTextActive: { color: '#FFFFFF' },

  // Shared: serving row
  servingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  servingLabel: { fontSize: 15, color: c.textPrimary, fontWeight: '500', marginRight: 10 },
  servingInputWrap: {
    width: 80, height: 40, borderRadius: 12,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  servingInput: { width: 80, textAlign: 'center', fontSize: 18, fontWeight: '700', color: c.textPrimary },
  servingUnit: { fontSize: 15, color: c.textSecondary },

  // Shared: macros
  macroRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  macroPill: {
    backgroundColor: c.glassOverlay,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '600',
    color: c.textPrimary,
  },

  overlayAddBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  overlayAddBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },

  // Custom food inputs
  cfInput: {
    height: 46,
    borderRadius: 12,
    backgroundColor: c.borderSubtle,
    paddingHorizontal: 14,
    fontSize: 16,
    color: c.textPrimary,
    marginBottom: 10,
  },

  // Camera permissions
  permTitle: { fontSize: 20, fontWeight: '700', color: c.textPrimary, marginTop: 14, marginBottom: 8, textAlign: 'center' },
  permDesc: { fontSize: 15, color: c.textSecondary, textAlign: 'center', marginBottom: 20 },
  permBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  });
};
