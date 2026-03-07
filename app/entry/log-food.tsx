import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { callHaiku } from '../../lib/anthropic';
import { searchUSDA, type FoodResult } from '../../lib/usda';
import { useMealTrayStore, type RecentFood, type SavedMeal } from '../../stores/meal-tray-store';
import { type MealType } from '../../stores/log-store';

// ─── Constants ────────────────────────────────────────────────────────────────

const BG = '#F0EAE4';
const TERRACOTTA = '#C4784B';
const DARK = '#1C0F09';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(28,15,9,0.45)';
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

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
};

// Unified "pending food" type for the add-to-meal panel
type PendingFood = {
  food_name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g: number;
  source: 'search_db' | 'manual' | 'barcode';
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function lookupBarcode(barcode: string): Promise<OFFProduct | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function GlassBorder({ r = 16, topOnly = false }: { r?: number; topOnly?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderRadius: topOnly ? 0 : r,
          borderWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.65)',
          borderLeftColor: topOnly ? 'transparent' : 'rgba(255,255,255,0.42)',
          borderRightColor: topOnly ? 'transparent' : 'rgba(255,255,255,0.14)',
          borderBottomColor: topOnly ? 'transparent' : 'rgba(255,255,255,0.08)',
        },
      ]}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogFoodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [camPermission, requestCamPermission] = useCameraPermissions();

  const {
    trayItems, addToTray, removeFromTray, clearTray, logMeal, saveAsMeal,
    loadSavedMeal, savedMeals, fetchSavedMeals, deleteSavedMeal,
    recentFoods, fetchRecentFoods, toggleFavorite,
    customFoods, fetchCustomFoods, addCustomFood,
    loading,
  } = useMealTrayStore();

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

  // ── Describe state ────────────────────────────────────────────────────────
  const [describeText, setDescribeText] = useState('');
  const [describeItems, setDescribeItems] = useState<DescribeItem[] | null>(null);
  const [describing, setDescribing] = useState(false);
  const [describeError, setDescribeError] = useState('');

  // ── Add-to-meal panel ─────────────────────────────────────────────────────
  const [pendingFood, setPendingFood] = useState<PendingFood | null>(null);
  const [servingG, setServingG] = useState('100');

  // ── Tray UI ───────────────────────────────────────────────────────────────
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveMealName, setSaveMealName] = useState('');

  // ── Custom food modal ─────────────────────────────────────────────────────
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

  // ── Search ────────────────────────────────────────────────────────────────

  function handleQueryChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const r = await searchUSDA(text);
      setSearchResults(r);
      setSearching(false);
    }, 400);
  }

  function handleSelectSearchResult(item: FoodResult) {
    setPendingFood({
      food_name: item.name + (item.brand ? ` (${item.brand})` : ''),
      calories_per_100g: item.calories,
      protein_per_100g: item.protein_g,
      carbs_per_100g: item.carbs_g,
      fat_per_100g: item.fat_g,
      fiber_per_100g: item.fiber_g,
      source: 'search_db',
    });
    setServingG('100');
  }

  function handleSelectRecent(item: RecentFood) {
    setPendingFood({
      food_name: item.food_name,
      calories_per_100g: item.calories,
      protein_per_100g: item.protein_g,
      carbs_per_100g: item.carbs_g,
      fat_per_100g: item.fat_g,
      fiber_per_100g: item.fiber_g,
      source: 'manual',
    });
    setServingG('100');
  }

  function handleSelectCustomFood(item: typeof customFoods[0]) {
    setPendingFood({
      food_name: item.name + (item.brand ? ` (${item.brand})` : ''),
      calories_per_100g: item.calories_per_100g,
      protein_per_100g: item.protein_per_100g,
      carbs_per_100g: item.carbs_per_100g,
      fat_per_100g: item.fat_per_100g,
      fiber_per_100g: item.fiber_per_100g,
      source: 'manual',
    });
    setServingG(String(item.serving_size_g ?? 100));
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
      source: pendingFood.source,
    });
    setPendingFood(null);
  }

  // ── Scan ──────────────────────────────────────────────────────────────────

  async function handleSwitchToScan() {
    if (!camPermission?.granted) await requestCamPermission();
    setMode('scan');
    setScanProduct(null);
    setScanNotFound(false);
    setScanned(false);
    scanLockRef.current = false;
  }

  async function handleBarcode({ data }: { data: string }) {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setScanned(true);
    setScanFetching(true);
    setScanNotFound(false);
    setScanProduct(null);
    const result = await lookupBarcode(data);
    setScanFetching(false);
    if (result) {
      setScanProduct(result);
    } else {
      setScanNotFound(true);
    }
  }

  function handleScanAgain() {
    scanLockRef.current = false;
    setScanned(false);
    setScanProduct(null);
    setScanNotFound(false);
  }

  function handleAddScanProduct() {
    if (!scanProduct) return;
    const g = 100;
    addToTray({
      food_name: scanProduct.name + (scanProduct.brand ? ` (${scanProduct.brand})` : ''),
      calories: scanProduct.calories,
      protein_g: scanProduct.protein_g,
      carbs_g: scanProduct.carbs_g,
      fat_g: scanProduct.fat_g,
      fiber_g: scanProduct.fiber_g,
      serving_g: g,
      source: 'barcode',
    });
    handleScanAgain();
  }

  // ── Describe ──────────────────────────────────────────────────────────────

  async function handleParse() {
    if (!describeText.trim()) return;
    setDescribing(true);
    setDescribeError('');
    setDescribeItems(null);
    try {
      const raw = await callHaiku(PARSE_SYSTEM, [
        { type: 'text', text: `User input: "${describeText}"` },
      ]);
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
          } as DescribeItem;
        }),
      );
      setDescribeItems(withResults);
    } catch {
      setDescribeError("Couldn't parse — try being more specific.");
    } finally {
      setDescribing(false);
    }
  }

  function updateDescribeItem(idx: number, patch: Partial<DescribeItem>) {
    setDescribeItems((prev) => prev ? prev.map((it, i) => i === idx ? { ...it, ...patch } : it) : prev);
  }

  function handleAddAllDescribed() {
    if (!describeItems) return;
    for (const item of describeItems) {
      const food = item.results[item.selectedIdx];
      if (!food) continue;
      const g = parseFloat(item.servingG) || item.estimated_g;
      addToTray({
        food_name: food.name + (food.brand ? ` (${food.brand})` : ''),
        calories: Math.round(food.calories * g / 100),
        protein_g: parseFloat((food.protein_g * g / 100).toFixed(1)),
        carbs_g: parseFloat((food.carbs_g * g / 100).toFixed(1)),
        fat_g: parseFloat((food.fat_g * g / 100).toFixed(1)),
        fiber_g: parseFloat((food.fiber_g * g / 100).toFixed(1)),
        serving_g: g,
        source: 'manual',
      });
    }
    setDescribeItems(null);
    setDescribeText('');
  }

  // ── Tray actions ──────────────────────────────────────────────────────────

  async function handleLogMeal() {
    await logMeal(mealType);
    router.back();
  }

  async function handleSaveAsMeal() {
    if (!saveMealName.trim()) return;
    await saveAsMeal(saveMealName.trim());
    setShowSaveInput(false);
    setSaveMealName('');
  }

  function handleLoadSavedMeal(meal: SavedMeal) {
    loadSavedMeal(meal);
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
    protein_g: trayItems.reduce((s, it) => s + it.protein_g, 0),
  };

  const filteredCustomFoods = customFoods.filter((cf) =>
    !query.trim() || cf.name.toLowerCase().includes(query.toLowerCase()),
  );

  const g = parseFloat(servingG) || 100;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <BlurView intensity={75} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={s.backBtnOverlay} />
          <GlassBorder />
          <Ionicons name="chevron-back" size={20} color={DARK} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Log Food</Text>
        {trayItems.length > 0 ? (
          <View style={s.trayBadge}>
            <Text style={s.trayBadgeText}>{trayItems.length}</Text>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* ── Mode tabs ──────────────────────────────────────────────────────── */}
      <View style={s.modeTabs}>
        {(['search', 'scan', 'describe', 'camera'] as Mode[]).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => m === 'scan' ? handleSwitchToScan() : setMode(m)}
            style={[s.modeTab, mode === m && s.modeTabActive]}
            activeOpacity={0.75}
          >
            <Ionicons
              name={
                m === 'search' ? 'search-outline' :
                m === 'scan' ? 'barcode-outline' :
                m === 'describe' ? 'chatbubble-ellipses-outline' :
                'camera-outline'
              }
              size={16}
              color={mode === m ? WHITE : MUTED}
            />
            <Text style={[s.modeTabText, mode === m && s.modeTabTextActive]}>
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content area ───────────────────────────────────────────────────── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: trayItems.length > 0 ? 200 + insets.bottom : 16 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── SEARCH MODE ────────────────────────────────────────────────── */}
        {mode === 'search' && (
          <>
            {/* Search bar */}
            <View style={s.searchBarWrapper}>
              <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={s.searchBarOverlay} />
              <GlassBorder />
              <Ionicons name="search-outline" size={18} color={MUTED} style={{ marginRight: 10 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search foods…"
                placeholderTextColor={MUTED}
                value={query}
                onChangeText={handleQueryChange}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {!!query && (
                <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); }}>
                  <Ionicons name="close-circle" size={17} color={MUTED} />
                </TouchableOpacity>
              )}
            </View>

            {/* Custom foods (filtered) */}
            {filteredCustomFoods.length > 0 && (
              <>
                <Text style={s.sectionLabel}>CUSTOM</Text>
                {filteredCustomFoods.map((cf) => (
                  <TouchableOpacity
                    key={cf.id}
                    style={s.resultCard}
                    onPress={() => handleSelectCustomFood(cf)}
                    activeOpacity={0.75}
                  >
                    <View style={s.resultLeft}>
                      <View style={s.customBadgeRow}>
                        <View style={s.customBadge}><Text style={s.customBadgeText}>Custom</Text></View>
                        <Text style={s.resultName} numberOfLines={1}>{cf.name}</Text>
                      </View>
                      {!!cf.brand && <Text style={s.resultBrand}>{cf.brand}</Text>}
                      <Text style={s.per100g}>per 100 g</Text>
                    </View>
                    <View style={s.resultRight}>
                      <Text style={s.resultCalories}>{cf.calories_per_100g} kcal</Text>
                      <Text style={s.resultMacros}>
                        {cf.protein_per_100g}p · {cf.carbs_per_100g}c · {cf.fat_per_100g}f
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Search results (USDA) */}
            {query.trim() ? (
              <>
                {searching ? (
                  <View style={s.centered}>
                    <ActivityIndicator size="large" color={TERRACOTTA} />
                  </View>
                ) : searchResults.length > 0 ? (
                  <>
                    <Text style={s.sectionLabel}>RESULTS</Text>
                    {searchResults.map((item) => (
                      <TouchableOpacity
                        key={item.fdcId}
                        style={s.resultCard}
                        onPress={() => handleSelectSearchResult(item)}
                        activeOpacity={0.75}
                      >
                        <View style={s.resultLeft}>
                          <Text style={s.resultName} numberOfLines={2}>{item.name}</Text>
                          {!!item.brand && <Text style={s.resultBrand}>{item.brand}</Text>}
                          <Text style={s.per100g}>per 100 g</Text>
                        </View>
                        <View style={s.resultRight}>
                          <Text style={s.resultCalories}>{item.calories} kcal</Text>
                          <Text style={s.resultMacros}>
                            {item.protein_g}p · {item.carbs_g}c · {item.fat_g}f
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={s.createFoodBtn} onPress={() => setShowCustomModal(true)} activeOpacity={0.8}>
                      <Ionicons name="add-circle-outline" size={16} color={TERRACOTTA} />
                      <Text style={s.createFoodText}>Create Custom Food</Text>
                    </TouchableOpacity>
                  </>
                ) : filteredCustomFoods.length === 0 ? (
                  <View style={s.centered}>
                    <Text style={s.emptyText}>No results found</Text>
                    <TouchableOpacity style={[s.createFoodBtn, { marginTop: 12 }]} onPress={() => setShowCustomModal(true)} activeOpacity={0.8}>
                      <Ionicons name="add-circle-outline" size={16} color={TERRACOTTA} />
                      <Text style={s.createFoodText}>Create Custom Food</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                {/* Recent foods */}
                {recentFoods.length > 0 && (
                  <>
                    <Text style={s.sectionLabel}>RECENT</Text>
                    {recentFoods.map((item) => (
                      <TouchableOpacity
                        key={item.food_name}
                        style={s.resultCard}
                        onPress={() => handleSelectRecent(item)}
                        activeOpacity={0.75}
                      >
                        <View style={s.resultLeft}>
                          <Text style={s.resultName} numberOfLines={2}>{item.food_name}</Text>
                          <Text style={s.per100g}>{item.log_count}× logged · per 100 g</Text>
                        </View>
                        <View style={s.resultRight}>
                          <Text style={s.resultCalories}>{item.calories} kcal</Text>
                          <TouchableOpacity
                            onPress={() => toggleFavorite(item.food_name)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name={item.is_favorite ? 'star' : 'star-outline'}
                              size={18}
                              color={item.is_favorite ? TERRACOTTA : MUTED}
                            />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Saved meals */}
                {savedMeals.length > 0 && (
                  <>
                    <Text style={s.sectionLabel}>SAVED MEALS</Text>
                    {savedMeals.map((meal) => (
                      <View key={meal.id} style={s.savedMealCard}>
                        <View style={s.savedMealLeft}>
                          <Text style={s.savedMealName}>{meal.name}</Text>
                          <Text style={s.savedMealMacros}>
                            {Math.round(meal.total_calories)} kcal · {Math.round(meal.total_protein_g)}g protein · {meal.items.length} item{meal.items.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View style={s.savedMealActions}>
                          <TouchableOpacity
                            style={s.loadMealBtn}
                            onPress={() => handleLoadSavedMeal(meal)}
                            activeOpacity={0.8}
                          >
                            <Text style={s.loadMealBtnText}>Load</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => deleteSavedMeal(meal.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={16} color={MUTED} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {recentFoods.length === 0 && savedMeals.length === 0 && filteredCustomFoods.length === 0 && (
                  <View style={s.centered}>
                    <Ionicons name="nutrition-outline" size={48} color={MUTED} />
                    <Text style={[s.emptyText, { marginTop: 12 }]}>Search or scan to add foods</Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ── SCAN MODE ──────────────────────────────────────────────────── */}
        {mode === 'scan' && (
          <>
            {!camPermission?.granted ? (
              <View style={s.centered}>
                <Ionicons name="camera-outline" size={56} color={MUTED} />
                <Text style={[s.emptyText, { marginTop: 12, marginBottom: 20 }]}>Camera access needed</Text>
                <TouchableOpacity style={s.primaryBtn} onPress={requestCamPermission} activeOpacity={0.85}>
                  <Text style={s.primaryBtnText}>Allow Camera</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Inline camera */}
                <View style={s.cameraWrapper}>
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    barcodeScannerEnabled={!scanned}
                    onBarcodeScanned={scanned ? undefined : handleBarcode}
                  />
                  {/* Viewfinder */}
                  {!scanProduct && !scanNotFound && (
                    <View style={s.viewfinderBox}>
                      <View style={[s.corner, s.cTL]} />
                      <View style={[s.corner, s.cTR]} />
                      <View style={[s.corner, s.cBL]} />
                      <View style={[s.corner, s.cBR]} />
                    </View>
                  )}
                  {scanFetching && (
                    <View style={s.scanOverlay}>
                      <ActivityIndicator size="large" color={WHITE} />
                    </View>
                  )}
                </View>

                {/* Product found */}
                {scanProduct && (
                  <View style={s.scanResultCard}>
                    <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
                    <View style={s.cardOverlay} />
                    <GlassBorder r={20} />
                    <View style={s.cardContent}>
                      <Text style={s.scanProductName} numberOfLines={2}>{scanProduct.name}</Text>
                      {!!scanProduct.brand && <Text style={s.scanProductBrand}>{scanProduct.brand}</Text>}
                      <Text style={s.scanMacros}>
                        {scanProduct.calories} kcal · {scanProduct.protein_g}g P · {scanProduct.carbs_g}g C · {scanProduct.fat_g}g F
                      </Text>
                      <Text style={s.per100g}>per 100 g</Text>
                      <View style={s.rowGap12}>
                        <TouchableOpacity style={s.secondaryBtn} onPress={handleScanAgain} activeOpacity={0.8}>
                          <Text style={s.secondaryBtnText}>Scan Again</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.primaryBtn} onPress={handleAddScanProduct} activeOpacity={0.85}>
                          <Text style={s.primaryBtnText}>Add to Meal</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}

                {/* Not found */}
                {scanNotFound && (
                  <View style={s.scanResultCard}>
                    <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
                    <View style={s.cardOverlay} />
                    <GlassBorder r={20} />
                    <View style={s.cardContent}>
                      <Ionicons name="alert-circle-outline" size={32} color={TERRACOTTA} style={{ marginBottom: 8 }} />
                      <Text style={s.scanProductName}>Product Not Found</Text>
                      <Text style={s.scanProductBrand}>This barcode isn't in Open Food Facts.</Text>
                      <TouchableOpacity style={s.secondaryBtn} onPress={handleScanAgain} activeOpacity={0.8}>
                        <Text style={s.secondaryBtnText}>Scan Again</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {!scanProduct && !scanNotFound && !scanFetching && (
                  <Text style={s.scanHint}>Point camera at a barcode</Text>
                )}
              </>
            )}
          </>
        )}

        {/* ── DESCRIBE MODE ──────────────────────────────────────────────── */}
        {mode === 'describe' && (
          <>
            <View style={s.describeCard}>
              <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={s.cardOverlay} />
              <GlassBorder r={20} />
              <View style={s.cardContent}>
                <Text style={s.sectionLabelSmall}>DESCRIBE YOUR MEAL</Text>
                <TextInput
                  style={s.textArea}
                  placeholder={`e.g. "two scrambled eggs with whole wheat toast and avocado"`}
                  placeholderTextColor={MUTED}
                  value={describeText}
                  onChangeText={setDescribeText}
                  multiline
                  textAlignVertical="top"
                />
                {!!describeError && (
                  <Text style={s.errorText}>{describeError}</Text>
                )}
                <TouchableOpacity
                  style={[s.primaryBtn, (!describeText.trim() || describing) && s.primaryBtnDisabled]}
                  onPress={handleParse}
                  activeOpacity={0.85}
                  disabled={!describeText.trim() || describing}
                >
                  {describing ? (
                    <View style={s.rowGap8}>
                      <ActivityIndicator color={WHITE} size="small" />
                      <Text style={s.primaryBtnText}>Analyzing…</Text>
                    </View>
                  ) : (
                    <Text style={s.primaryBtnText}>Parse with AI</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {describeItems && describeItems.map((item, idx) => (
              <View key={idx} style={s.describeItemCard}>
                <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
                <View style={s.cardOverlay} />
                <GlassBorder r={20} />
                <View style={s.cardContent}>
                  <Text style={s.itemName}>{item.item}</Text>
                  {item.results.length === 0 ? (
                    <Text style={s.noMatch}>No USDA match — will skip</Text>
                  ) : (
                    <>
                      {item.results.slice(0, 3).map((r, ri) => (
                        <TouchableOpacity
                          key={r.fdcId}
                          onPress={() => updateDescribeItem(idx, { selectedIdx: ri })}
                          style={[s.matchRow, item.selectedIdx === ri && s.matchRowActive]}
                          activeOpacity={0.75}
                        >
                          <View style={[s.radio, item.selectedIdx === ri && s.radioActive]}>
                            {item.selectedIdx === ri && <View style={s.radioDot} />}
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
                            onChangeText={(v) => updateDescribeItem(idx, { servingG: v })}
                            keyboardType="numeric"
                            selectTextOnFocus
                          />
                        </View>
                        <Text style={s.servingUnit}>g</Text>
                      </View>
                      {item.results[item.selectedIdx] && (() => {
                        const f = item.results[item.selectedIdx];
                        const gv = parseFloat(item.servingG) || 100;
                        return (
                          <View style={s.macroRow}>
                            <Text style={s.macroPill}>{Math.round(f.calories * gv / 100)} kcal</Text>
                            <Text style={s.macroPill}>{(f.protein_g * gv / 100).toFixed(1)}g P</Text>
                            <Text style={s.macroPill}>{(f.carbs_g * gv / 100).toFixed(1)}g C</Text>
                            <Text style={s.macroPill}>{(f.fat_g * gv / 100).toFixed(1)}g F</Text>
                          </View>
                        );
                      })()}
                    </>
                  )}
                </View>
              </View>
            ))}

            {describeItems && (
              <TouchableOpacity style={s.primaryBtn} onPress={handleAddAllDescribed} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>Add All to Meal</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── CAMERA MODE ────────────────────────────────────────────────── */}
        {mode === 'camera' && (
          <View style={s.cameraModeCentered}>
            <View style={s.cameraIconWrap}>
              <BlurView intensity={78} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.3)' }]} />
              <Ionicons name="camera-outline" size={52} color={TERRACOTTA} />
            </View>
            <Text style={s.cameraModeTitle}>AI Photo Log</Text>
            <Text style={s.cameraModeDesc}>
              Take a photo of your meal. AI will identify foods and estimate portions.
            </Text>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => router.push('/entry/capture-food' as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={18} color={WHITE} style={{ marginRight: 8 }} />
              <Text style={s.primaryBtnText}>Open Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Add-to-meal overlay panel ───────────────────────────────────── */}
      {pendingFood && (
        <View style={[s.addPanel, { paddingBottom: insets.bottom + 16 }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={s.panelOverlay} />
          <GlassBorder topOnly />
          <TouchableOpacity
            style={s.dismissBtn}
            onPress={() => setPendingFood(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={MUTED} />
          </TouchableOpacity>
          <Text style={s.panelName} numberOfLines={2}>{pendingFood.food_name}</Text>
          <View style={s.servingRow}>
            <Text style={s.servingLabel}>Serving size</Text>
            <View style={s.servingInputWrap}>
              <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
              <GlassBorder />
              <TextInput
                style={s.servingInput}
                value={servingG}
                onChangeText={setServingG}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
            <Text style={s.servingUnit}>g</Text>
          </View>
          <View style={s.macroRow}>
            {[
              { label: 'Calories', val: Math.round(pendingFood.calories_per_100g * g / 100), unit: ' kcal' },
              { label: 'Protein', val: (pendingFood.protein_per_100g * g / 100).toFixed(1), unit: 'g' },
              { label: 'Carbs', val: (pendingFood.carbs_per_100g * g / 100).toFixed(1), unit: 'g' },
              { label: 'Fat', val: (pendingFood.fat_per_100g * g / 100).toFixed(1), unit: 'g' },
            ].map(({ label, val, unit }) => (
              <View key={label} style={s.macroPillLarge}>
                <Text style={s.macroPillLargeVal}>{val}<Text style={s.macroPillLargeUnit}>{unit}</Text></Text>
                <Text style={s.macroPillLargeLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={s.primaryBtn} onPress={handleAddPendingToTray} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>Add to Meal</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Tray footer ─────────────────────────────────────────────────── */}
      {trayItems.length > 0 && !pendingFood && (
        <View style={[s.trayFooter, { paddingBottom: insets.bottom + 8 }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={s.panelOverlay} />
          <GlassBorder topOnly />

          {/* Meal type */}
          <View style={s.mealTypeRow}>
            {MEAL_TYPES.map((mt) => (
              <TouchableOpacity
                key={mt}
                onPress={() => setMealType(mt)}
                style={[s.mealChip, mealType === mt && s.mealChipActive]}
                activeOpacity={0.75}
              >
                <Text style={[s.mealChipText, mealType === mt && s.mealChipTextActive]}>
                  {mt.charAt(0).toUpperCase() + mt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tray items */}
          <ScrollView
            style={{ maxHeight: 100 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {trayItems.map((item) => (
              <View key={item.id} style={s.trayItem}>
                <Text style={s.trayItemName} numberOfLines={1}>{item.food_name}</Text>
                <Text style={s.trayItemCal}>{item.calories} kcal</Text>
                <TouchableOpacity onPress={() => removeFromTray(item.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={15} color={MUTED} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* Total + actions */}
          <View style={s.trayTotal}>
            <Text style={s.trayTotalText}>
              {trayItems.length} item{trayItems.length !== 1 ? 's' : ''} · {Math.round(trayTotal.calories)} kcal · {trayTotal.protein_g.toFixed(0)}g P
            </Text>
            <TouchableOpacity onPress={clearTray}>
              <Text style={s.trayTotalClear}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Save as meal input */}
          {showSaveInput ? (
            <View style={s.saveRow}>
              <TextInput
                style={s.saveInput}
                placeholder="Meal name…"
                placeholderTextColor={MUTED}
                value={saveMealName}
                onChangeText={setSaveMealName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveAsMeal}
              />
              <TouchableOpacity style={s.saveConfirmBtn} onPress={handleSaveAsMeal} activeOpacity={0.8}>
                <Text style={s.saveConfirmText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSaveInput(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={18} color={MUTED} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.trayActions}>
              {trayItems.length >= 2 && (
                <TouchableOpacity style={s.saveAsMealBtn} onPress={() => setShowSaveInput(true)} activeOpacity={0.8}>
                  <Text style={s.saveAsMealText}>Save as Meal</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.logMealBtn, { flex: trayItems.length >= 2 ? 1 : undefined, alignSelf: trayItems.length < 2 ? 'stretch' : undefined }]}
                onPress={handleLogMeal}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={WHITE} size="small" />
                ) : (
                  <Text style={s.logMealBtnText}>Log Meal</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── Custom food modal ───────────────────────────────────────────── */}
      <Modal visible={showCustomModal} transparent animationType="slide" onRequestClose={() => setShowCustomModal(false)}>
        <View style={s.modalBackdrop}>
          <View style={[s.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.55)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }]} />
            <GlassBorder r={24} />
            <View style={s.modalContent}>
              <Text style={s.modalTitle}>Create Custom Food</Text>
              <TextInput style={s.modalInput} placeholder="Food name *" placeholderTextColor={MUTED} value={cfName} onChangeText={setCfName} />
              <TextInput style={s.modalInput} placeholder="Brand (optional)" placeholderTextColor={MUTED} value={cfBrand} onChangeText={setCfBrand} />
              <View style={s.modalRow}>
                <TextInput style={[s.modalInput, { flex: 1 }]} placeholder="Calories" placeholderTextColor={MUTED} value={cfCal} onChangeText={setCfCal} keyboardType="decimal-pad" />
                <TextInput style={[s.modalInput, { flex: 1 }]} placeholder="Protein g" placeholderTextColor={MUTED} value={cfProtein} onChangeText={setCfProtein} keyboardType="decimal-pad" />
              </View>
              <View style={s.modalRow}>
                <TextInput style={[s.modalInput, { flex: 1 }]} placeholder="Carbs g" placeholderTextColor={MUTED} value={cfCarbs} onChangeText={setCfCarbs} keyboardType="decimal-pad" />
                <TextInput style={[s.modalInput, { flex: 1 }]} placeholder="Fat g" placeholderTextColor={MUTED} value={cfFat} onChangeText={setCfFat} keyboardType="decimal-pad" />
              </View>
              <View style={s.modalRow}>
                <TextInput style={[s.modalInput, { flex: 1 }]} placeholder="Fiber g" placeholderTextColor={MUTED} value={cfFiber} onChangeText={setCfFiber} keyboardType="decimal-pad" />
                <TextInput style={[s.modalInput, { flex: 1 }]} placeholder="Serving g" placeholderTextColor={MUTED} value={cfServing} onChangeText={setCfServing} keyboardType="decimal-pad" />
              </View>
              <Text style={s.modalNote}>All values are per 100 g unless serving size set</Text>
              <View style={s.modalRow}>
                <TouchableOpacity style={[s.secondaryBtn, { flex: 1 }]} onPress={() => setShowCustomModal(false)} activeOpacity={0.8}>
                  <Text style={s.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.primaryBtn, { flex: 1 }, !cfName.trim() && s.primaryBtnDisabled]} onPress={handleSaveCustomFood} activeOpacity={0.85} disabled={!cfName.trim()}>
                  <Text style={s.primaryBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  backBtnOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: DARK },
  trayBadge: { width: 40, height: 24, borderRadius: 12, backgroundColor: TERRACOTTA, alignItems: 'center', justifyContent: 'center' },
  trayBadgeText: { fontSize: 12, fontWeight: '800', color: WHITE },

  modeTabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  modeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 36, borderRadius: 10, backgroundColor: 'rgba(28,15,9,0.07)',
  },
  modeTabActive: { backgroundColor: TERRACOTTA },
  modeTabText: { fontSize: 11, fontWeight: '700', color: MUTED },
  modeTabTextActive: { color: WHITE },

  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },

  searchBarWrapper: {
    flexDirection: 'row', alignItems: 'center',
    height: 50, borderRadius: 14, overflow: 'hidden',
    paddingHorizontal: 14,
    shadowColor: DARK, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  searchBarOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)' },
  searchInput: { flex: 1, fontSize: 15, color: DARK, paddingVertical: 0 },

  sectionLabel: { fontSize: 10, fontWeight: '800', color: TERRACOTTA, letterSpacing: 2, marginTop: 4 },
  sectionLabelSmall: { fontSize: 10, fontWeight: '800', color: TERRACOTTA, letterSpacing: 2, marginBottom: 10 },

  resultCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14, padding: 12,
    shadowColor: DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  resultLeft: { flex: 1, paddingRight: 10 },
  resultRight: { alignItems: 'flex-end', gap: 4 },
  resultName: { fontSize: 14, fontWeight: '600', color: DARK, lineHeight: 19, marginBottom: 2 },
  resultBrand: { fontSize: 11, color: MUTED, marginBottom: 2 },
  per100g: { fontSize: 10, color: MUTED, fontStyle: 'italic' },
  resultCalories: { fontSize: 15, fontWeight: '700', color: TERRACOTTA },
  resultMacros: { fontSize: 11, color: MUTED },

  customBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  customBadge: { backgroundColor: 'rgba(196,120,75,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  customBadgeText: { fontSize: 9, fontWeight: '800', color: TERRACOTTA, letterSpacing: 0.5 },

  createFoodBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, alignSelf: 'center' },
  createFoodText: { fontSize: 13, fontWeight: '600', color: TERRACOTTA },

  savedMealCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14, padding: 12,
    shadowColor: DARK, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  savedMealLeft: { flex: 1 },
  savedMealName: { fontSize: 15, fontWeight: '700', color: DARK, marginBottom: 3 },
  savedMealMacros: { fontSize: 12, color: MUTED },
  savedMealActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadMealBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, backgroundColor: TERRACOTTA },
  loadMealBtnText: { fontSize: 13, fontWeight: '700', color: WHITE },

  centered: { alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: MUTED, textAlign: 'center' },

  // Scan
  cameraWrapper: { height: 300, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  viewfinderBox: { position: 'absolute', top: '30%', left: '15%', width: '70%', height: '35%' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: TERRACOTTA, borderWidth: 3 },
  cTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 4 },
  cTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 4 },
  cBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 4 },
  cBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 4 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  scanHint: { textAlign: 'center', fontSize: 13, color: MUTED, paddingTop: 8 },
  scanResultCard: { borderRadius: 20, overflow: 'hidden', shadowColor: DARK, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 6 },
  cardOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)' },
  cardContent: { padding: 16, gap: 6 },
  scanProductName: { fontSize: 17, fontWeight: '700', color: DARK },
  scanProductBrand: { fontSize: 12, color: MUTED },
  scanMacros: { fontSize: 13, color: DARK, fontWeight: '500' },

  // Describe
  describeCard: { borderRadius: 20, overflow: 'hidden', shadowColor: DARK, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 6 },
  textArea: { fontSize: 15, color: DARK, minHeight: 90, lineHeight: 22, marginBottom: 12 },
  errorText: { fontSize: 12, color: TERRACOTTA, marginBottom: 8 },
  describeItemCard: { borderRadius: 20, overflow: 'hidden', shadowColor: DARK, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 6 },
  itemName: { fontSize: 15, fontWeight: '700', color: DARK, marginBottom: 8 },
  noMatch: { fontSize: 13, color: MUTED, fontStyle: 'italic' },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 10, marginBottom: 3, backgroundColor: 'rgba(28,15,9,0.04)' },
  matchRowActive: { backgroundColor: 'rgba(196,120,75,0.12)' },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 2, borderColor: MUTED, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: TERRACOTTA },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TERRACOTTA },
  matchName: { fontSize: 13, fontWeight: '600', color: DARK },
  matchBrand: { fontSize: 11, color: MUTED },
  matchCal: { fontSize: 12, color: MUTED },
  servingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 6 },
  servingLabel: { fontSize: 13, color: DARK, fontWeight: '500', marginRight: 10 },
  servingInputWrap: { width: 72, height: 34, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  servingInput: { width: 72, textAlign: 'center', fontSize: 14, fontWeight: '600', color: DARK },
  servingUnit: { fontSize: 13, color: MUTED },
  macroRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  macroPill: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 9, fontSize: 12, fontWeight: '600', color: DARK },

  // Camera mode
  cameraModeCentered: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  cameraIconWrap: { width: 96, height: 96, borderRadius: 40, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 18, shadowColor: DARK, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6 },
  cameraModeTitle: { fontSize: 22, fontWeight: '800', color: DARK, marginBottom: 8 },
  cameraModeDesc: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  // Add to meal panel
  addPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 18, paddingTop: 18, overflow: 'hidden' },
  panelOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)' },
  dismissBtn: { position: 'absolute', top: 14, right: 18, zIndex: 10 },
  panelName: { fontSize: 17, fontWeight: '700', color: DARK, marginBottom: 10, paddingRight: 32 },
  macroPillLarge: { flex: 1, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  macroPillLargeVal: { fontSize: 14, fontWeight: '700', color: DARK },
  macroPillLargeUnit: { fontSize: 10, fontWeight: '400', color: MUTED },
  macroPillLargeLabel: { fontSize: 10, color: MUTED, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Tray footer
  trayFooter: { overflow: 'hidden', paddingHorizontal: 16, paddingTop: 12 },
  mealTypeRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  mealChip: { flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,15,9,0.07)' },
  mealChipActive: { backgroundColor: TERRACOTTA },
  mealChipText: { fontSize: 12, fontWeight: '600', color: MUTED },
  mealChipTextActive: { color: WHITE },
  trayItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  trayItemName: { flex: 1, fontSize: 13, fontWeight: '500', color: DARK },
  trayItemCal: { fontSize: 12, color: MUTED, marginRight: 10 },
  trayTotal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(28,15,9,0.08)', marginTop: 4 },
  trayTotalText: { fontSize: 12, fontWeight: '700', color: DARK },
  trayTotalClear: { fontSize: 12, color: MUTED, textDecorationLine: 'underline' },
  trayActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  saveAsMealBtn: { height: 46, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: TERRACOTTA, alignItems: 'center', justifyContent: 'center' },
  saveAsMealText: { fontSize: 14, fontWeight: '700', color: TERRACOTTA },
  logMealBtn: { height: 46, borderRadius: 14, backgroundColor: TERRACOTTA, alignItems: 'center', justifyContent: 'center', shadowColor: TERRACOTTA, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5 },
  logMealBtnText: { fontSize: 15, fontWeight: '800', color: WHITE },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  saveInput: { flex: 1, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 12, fontSize: 14, color: DARK, borderWidth: 1, borderColor: 'rgba(28,15,9,0.1)' },
  saveConfirmBtn: { height: 42, paddingHorizontal: 16, borderRadius: 12, backgroundColor: TERRACOTTA, alignItems: 'center', justifyContent: 'center' },
  saveConfirmText: { fontSize: 14, fontWeight: '700', color: WHITE },

  // Shared
  primaryBtn: { height: 50, borderRadius: 14, backgroundColor: TERRACOTTA, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: TERRACOTTA, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 5 },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 15, fontWeight: '800', color: WHITE, letterSpacing: 0.2 },
  secondaryBtn: { height: 50, borderRadius: 14, backgroundColor: 'rgba(28,15,9,0.08)', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: DARK },
  rowGap8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowGap12: { flexDirection: 'row', gap: 10, marginTop: 4 },

  // Custom food modal
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalContent: { padding: 20, gap: 10 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: DARK, marginBottom: 4 },
  modalInput: { height: 46, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 14, fontSize: 14, color: DARK, borderWidth: 1, borderColor: 'rgba(28,15,9,0.1)' },
  modalRow: { flexDirection: 'row', gap: 10 },
  modalNote: { fontSize: 11, color: MUTED, textAlign: 'center' },
});
