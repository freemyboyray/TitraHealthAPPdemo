import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLogStore, type MealType } from '../../stores/log-store';

// ─── Constants ────────────────────────────────────────────────────────────────

const TERRACOTTA = '#C4784B';
const DARK = '#1C0F09';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(28,15,9,0.45)';
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// ─── Types ────────────────────────────────────────────────────────────────────

type OFFProduct = {
  name: string;
  brand: string;
  calories: number;   // per 100g
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
};

// ─── Open Food Facts lookup ───────────────────────────────────────────────────

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

function MacroPill({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <View style={s.macroPill}>
      <Text style={s.macroPillValue}>
        {value}
        <Text style={s.macroPillUnit}>{unit}</Text>
      </Text>
      <Text style={s.macroPillLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScanFoodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { loading, addFoodLog } = useLogStore();

  const [scanned, setScanned] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [product, setProduct] = useState<OFFProduct | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [servingG, setServingG] = useState('100');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const scanLockRef = useRef(false);

  async function handleBarcode({ data }: { data: string }) {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setScanned(true);
    setFetching(true);
    setNotFound(false);
    setProduct(null);
    const result = await lookupBarcode(data);
    setFetching(false);
    if (result) {
      setProduct(result);
    } else {
      setNotFound(true);
    }
  }

  function handleScanAgain() {
    scanLockRef.current = false;
    setScanned(false);
    setProduct(null);
    setNotFound(false);
    setServingG('100');
  }

  async function handleLog() {
    if (!product) return;
    const g = parseFloat(servingG) || 100;
    await addFoodLog({
      food_name: product.name + (product.brand ? ` (${product.brand})` : ''),
      calories: Math.round(product.calories * g / 100),
      protein_g: parseFloat((product.protein_g * g / 100).toFixed(1)),
      carbs_g: parseFloat((product.carbs_g * g / 100).toFixed(1)),
      fat_g: parseFloat((product.fat_g * g / 100).toFixed(1)),
      fiber_g: parseFloat((product.fiber_g * g / 100).toFixed(1)),
      meal_type: mealType,
      source: 'barcode',
    });
    router.back();
  }

  // ── Permission not granted ─────────────────────────────────────────────────
  if (!permission) {
    return <View style={s.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[s.root, s.centered, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={[s.backBtn, { position: 'absolute', top: insets.top + 12, left: 20 }]}>
          <Ionicons name="chevron-back" size={22} color={DARK} />
        </TouchableOpacity>
        <Ionicons name="camera-outline" size={64} color={MUTED} />
        <Text style={s.permTitle}>Camera Access Needed</Text>
        <Text style={s.permDesc}>Grant camera access to scan barcodes.</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={s.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const g = parseFloat(servingG) || 100;

  return (
    <View style={s.root}>
      {/* Full-screen camera */}
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerEnabled={!scanned}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
      />

      {/* Scanning overlay */}
      {!product && !notFound && (
        <>
          {/* Top bar */}
          <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.75}>
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
              <Ionicons name="chevron-back" size={22} color={WHITE} />
            </TouchableOpacity>
            <Text style={s.scanTitle}>Scan Barcode</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Viewfinder cutout */}
          <View style={s.viewfinderWrapper}>
            <View style={s.viewfinder}>
              {/* Corner brackets */}
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
            </View>
            {fetching ? (
              <ActivityIndicator size="large" color={TERRACOTTA} style={{ marginTop: 20 }} />
            ) : (
              <Text style={s.scanHint}>Point at a barcode</Text>
            )}
          </View>
        </>
      )}

      {/* Not found card */}
      {notFound && (
        <View style={[s.bottomPanel, { paddingBottom: insets.bottom + 20 }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={s.panelOverlay} />
          <GlassBorder topOnly />

          <Ionicons name="alert-circle-outline" size={36} color={TERRACOTTA} style={{ marginBottom: 8 }} />
          <Text style={s.notFoundTitle}>Product Not Found</Text>
          <Text style={s.notFoundDesc}>This barcode isn't in the Open Food Facts database.</Text>

          <View style={s.notFoundBtns}>
            <TouchableOpacity style={s.secondaryBtn} onPress={handleScanAgain} activeOpacity={0.8}>
              <Text style={s.secondaryBtnText}>Scan Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => router.replace('/entry/search-food' as any)}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>Search Manually</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Product found panel */}
      {product && (
        <View style={[s.bottomPanel, { paddingBottom: insets.bottom + 16 }]}>
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />
          <View style={s.panelOverlay} />
          <GlassBorder topOnly />

          <Text style={s.productName} numberOfLines={2}>{product.name}</Text>
          {!!product.brand && <Text style={s.productBrand}>{product.brand}</Text>}

          {/* Serving */}
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

          {/* Macros */}
          <View style={s.macroRow}>
            <MacroPill label="Calories" value={Math.round(product.calories * g / 100)} unit=" kcal" />
            <MacroPill label="Protein" value={(product.protein_g * g / 100).toFixed(1)} unit="g" />
            <MacroPill label="Carbs" value={(product.carbs_g * g / 100).toFixed(1)} unit="g" />
            <MacroPill label="Fat" value={(product.fat_g * g / 100).toFixed(1)} unit="g" />
          </View>

          {/* Meal type */}
          <View style={s.mealRow}>
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

          {/* Buttons */}
          <View style={s.panelBtns}>
            <TouchableOpacity style={s.secondaryBtn} onPress={handleScanAgain} activeOpacity={0.8}>
              <Text style={s.secondaryBtnText}>Scan Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={handleLog}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={WHITE} size="small" />
              ) : (
                <Text style={s.primaryBtnText}>Log Food</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  scanTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -0.3,
  },

  viewfinderWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: 260,
    height: 160,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: TERRACOTTA,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 4 },
  scanHint: {
    marginTop: 20,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    overflow: 'hidden',
  },
  panelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    marginBottom: 6,
    textAlign: 'center',
  },
  notFoundDesc: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  notFoundBtns: { flexDirection: 'row', gap: 10 },

  productName: {
    fontSize: 18,
    fontWeight: '700',
    color: DARK,
    marginBottom: 2,
    lineHeight: 24,
  },
  productBrand: { fontSize: 13, color: MUTED, marginBottom: 14 },

  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  servingLabel: { fontSize: 14, color: DARK, fontWeight: '500', marginRight: 12 },
  servingInputWrap: {
    width: 80,
    height: 38,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  servingInput: {
    width: 80,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: DARK,
  },
  servingUnit: { fontSize: 14, color: MUTED },

  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  macroPill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  macroPillValue: { fontSize: 15, fontWeight: '700', color: DARK },
  macroPillUnit: { fontSize: 11, fontWeight: '400', color: MUTED },
  macroPillLabel: {
    fontSize: 10,
    color: MUTED,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  mealRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  mealChip: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,15,9,0.06)',
  },
  mealChipActive: { backgroundColor: TERRACOTTA },
  mealChipText: { fontSize: 12, fontWeight: '600', color: MUTED },
  mealChipTextActive: { color: WHITE },

  panelBtns: { flexDirection: 'row', gap: 10 },

  primaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TERRACOTTA,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: WHITE },
  secondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(28,15,9,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: DARK },

  // Permission screen
  permTitle: { fontSize: 20, fontWeight: '700', color: DARK, marginTop: 16, marginBottom: 8 },
  permDesc: { fontSize: 14, color: MUTED, textAlign: 'center', marginBottom: 24, paddingHorizontal: 32 },
  permBtn: {
    height: 52,
    paddingHorizontal: 32,
    borderRadius: 16,
    backgroundColor: TERRACOTTA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permBtnText: { fontSize: 15, fontWeight: '700', color: WHITE },
});
