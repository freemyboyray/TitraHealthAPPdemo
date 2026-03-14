import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { searchUSDA, type FoodResult } from '../../lib/usda';
import { useLogStore, MealType } from '../../stores/log-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = '#FF742A';

// ─── GlassBorder ─────────────────────────────────────────────────────────────

function GlassBorder({ topOnly = false }: { topOnly?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          borderWidth: 1,
          borderRadius: topOnly ? 0 : 16,
          borderTopColor: 'rgba(255,255,255,0.65)',
          borderLeftColor: topOnly ? 'transparent' : 'rgba(255,255,255,0.42)',
          borderRightColor: topOnly ? 'transparent' : 'rgba(255,255,255,0.14)',
          borderBottomColor: topOnly ? 'transparent' : 'rgba(255,255,255,0.08)',
        },
      ]}
    />
  );
}

// ─── MacroPill ────────────────────────────────────────────────────────────────

function MacroPill({ label, value, unit, colors }: { label: string; value: string | number; unit: string; colors: AppColors }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.macroPill}>
      <Text style={styles.macroPillValue}>
        {value}
        <Text style={styles.macroPillUnit}>{unit}</Text>
      </Text>
      <Text style={styles.macroPillLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SearchFoodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { loading, addFoodLog } = useLogStore();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<FoodResult | null>(null);
  const [servingG, setServingG] = useState('100');
  const [mealType, setMealType] = useState<MealType>('lunch');

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  async function doSearch(q: string) {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const r = await searchUSDA(q);
    setResults(r);
    setSearching(false);
  }

  function handleQueryChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 500);
  }

  function handleSelectItem(item: FoodResult) {
    setSelected(item);
    setServingG('100');
  }

  async function handleLogFood() {
    if (!selected) return;
    const g = parseFloat(servingG) || 100;
    await addFoodLog({
      food_name: selected.name + (selected.brand ? ` (${selected.brand})` : ''),
      calories: Math.round(selected.calories * g / 100),
      protein_g: parseFloat((selected.protein_g * g / 100).toFixed(1)),
      carbs_g: parseFloat((selected.carbs_g * g / 100).toFixed(1)),
      fat_g: parseFloat((selected.fat_g * g / 100).toFixed(1)),
      fiber_g: parseFloat((selected.fiber_g * g / 100).toFixed(1)),
      meal_type: mealType,
      source: 'search_db',
    });
    setSelected(null);
    router.back();
  }

  const g = parseFloat(servingG) || 100;

  function renderResultItem({ item }: { item: FoodResult }) {
    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => handleSelectItem(item)}
        style={styles.resultCard}
      >
        <View style={styles.resultCardInner}>
          <View style={styles.resultLeft}>
            <Text style={styles.resultName} numberOfLines={2}>
              {item.name}
            </Text>
            {!!item.brand && (
              <Text style={styles.resultBrand} numberOfLines={1}>
                {item.brand}
              </Text>
            )}
            <Text style={styles.per100g}>per 100 g</Text>
          </View>

          <View style={styles.resultRight}>
            <Text style={styles.resultCalories}>{item.calories} kcal</Text>
            <Text style={styles.resultMacros}>
              {item.protein_g}p · {item.carbs_g}c · {item.fat_g}f
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  function renderListEmpty() {
    if (searching) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      );
    }
    if (query.trim()) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { marginTop: 12 }]}>Search for a food to get started</Text>
      </View>
    );
  }

  const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={styles.backBtnOverlay} />
          <GlassBorder />
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Search Food</Text>

        <View style={styles.backBtn} />
      </View>

      {/* ── Search bar ─────────────────────────────────────────────────────── */}
      <View style={styles.searchBarWrapper}>
        <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
        <View style={styles.searchBarOverlay} />
        <GlassBorder />
        <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search foods…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={handleQueryChange}
          onSubmitEditing={() => doSearch(query)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {!!query && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setResults([]);
              if (debounceRef.current) clearTimeout(debounceRef.current);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Results ────────────────────────────────────────────────────────── */}
      <FlatList
        data={searching ? [] : results}
        keyExtractor={(item) => String(item.fdcId)}
        renderItem={renderResultItem}
        ListEmptyComponent={renderListEmpty}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: selected ? 340 + insets.bottom : 16 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {/* ── Selected food panel ────────────────────────────────────────────── */}
      {selected && (
        <View style={[styles.panel, { paddingBottom: insets.bottom + 16 }]}>
          <BlurView intensity={80} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={styles.panelOverlay} />
          <GlassBorder topOnly />

          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => setSelected(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={styles.panelName} numberOfLines={2}>
            {selected.name}
          </Text>
          {!!selected.brand && (
            <Text style={styles.panelBrand}>{selected.brand}</Text>
          )}

          <View style={styles.servingRow}>
            <Text style={styles.servingLabel}>Serving size</Text>
            <View style={styles.servingInputWrapper}>
              <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
              <View style={styles.servingInputOverlay} />
              <GlassBorder />
              <TextInput
                style={styles.servingInput}
                value={servingG}
                onChangeText={setServingG}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
            <Text style={styles.servingUnit}>g</Text>
          </View>

          <View style={styles.macroRow}>
            <MacroPill label="Calories" value={Math.round(selected.calories * g / 100)} unit=" kcal" colors={colors} />
            <MacroPill label="Protein" value={(selected.protein_g * g / 100).toFixed(1)} unit="g" colors={colors} />
            <MacroPill label="Carbs" value={(selected.carbs_g * g / 100).toFixed(1)} unit="g" colors={colors} />
            <MacroPill label="Fat" value={(selected.fat_g * g / 100).toFixed(1)} unit="g" colors={colors} />
          </View>

          <View style={styles.mealTypeRow}>
            {MEAL_TYPES.map((mt) => (
              <TouchableOpacity
                key={mt}
                onPress={() => setMealType(mt)}
                style={[
                  styles.mealChip,
                  mealType === mt && styles.mealChipActive,
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.mealChipText,
                    mealType === mt && styles.mealChipTextActive,
                  ]}
                >
                  {mt.charAt(0).toUpperCase() + mt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.logBtn}
            onPress={handleLogFood}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.logBtnText}>Log Food</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backBtnOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.borderSubtle,
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textPrimary,
    letterSpacing: 0.3,
  },

  // Search bar
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 14,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  searchBarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.borderSubtle,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: c.textPrimary,
    paddingVertical: 0,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: 'center',
  },

  // Result cards
  resultCard: {
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: c.surface,
    shadowColor: c.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  resultCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
  },
  resultLeft: {
    flex: 1,
    paddingRight: 12,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: c.textPrimary,
    lineHeight: 20,
    marginBottom: 2,
  },
  resultBrand: {
    fontSize: 12,
    color: c.textSecondary,
    marginBottom: 4,
  },
  per100g: {
    fontSize: 11,
    color: c.textSecondary,
    fontStyle: 'italic',
  },
  resultRight: {
    alignItems: 'flex-end',
  },
  resultCalories: {
    fontSize: 16,
    fontWeight: '700',
    color: ORANGE,
    marginBottom: 4,
  },
  resultMacros: {
    fontSize: 12,
    color: c.textSecondary,
  },

  // Selected food panel
  panel: {
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
    backgroundColor: c.glassOverlay,
  },
  dismissBtn: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
  },
  panelName: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 2,
    paddingRight: 32,
    lineHeight: 24,
  },
  panelBrand: {
    fontSize: 13,
    color: c.textSecondary,
    marginBottom: 14,
  },

  // Serving row
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  servingLabel: {
    fontSize: 14,
    color: c.textPrimary,
    fontWeight: '500',
    marginRight: 12,
  },
  servingInputWrapper: {
    width: 80,
    height: 38,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  servingInputOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.borderSubtle,
  },
  servingInput: {
    width: 80,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: c.textPrimary,
  },
  servingUnit: {
    fontSize: 14,
    color: c.textSecondary,
  },

  // Macro pills
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 8,
  },
  macroPill: {
    flex: 1,
    backgroundColor: c.borderSubtle,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  macroPillValue: {
    fontSize: 15,
    fontWeight: '700',
    color: c.textPrimary,
  },
  macroPillUnit: {
    fontSize: 11,
    fontWeight: '400',
    color: c.textSecondary,
  },
  macroPillLabel: {
    fontSize: 10,
    color: c.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Meal type chips
  mealTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  mealChip: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.glassOverlay,
  },
  mealChipActive: {
    backgroundColor: ORANGE,
  },
  mealChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textSecondary,
  },
  mealChipTextActive: {
    color: '#FFFFFF',
  },

  // Log button
  logBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  logBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
