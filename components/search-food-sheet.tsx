import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Plus, Search as SearchIcon, Utensils, X } from 'lucide-react-native';
import { searchUSDA } from '@/lib/usda';
import type { FoodResult } from '@/lib/fatsecret';
import { customToResult, recentToResult, savedMealToResults } from '@/lib/food-search';
import { useFoodTaskStore } from '@/stores/food-task-store';
import { useMealTrayStore, type SavedMeal } from '@/stores/meal-tray-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const SCREEN_H = Dimensions.get('window').height;

type Tab = 'search' | 'myfoods';
type MyFoodsFilter = 'favorites' | 'recipes' | 'custom' | 'historical';
type SelEntry = { key: string; label: string; result: FoodResult };

const MYFOODS_FILTERS: { key: MyFoodsFilter; label: string }[] = [
  { key: 'favorites', label: 'Favorites' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'custom', label: 'Custom' },
  { key: 'historical', label: 'Historical' },
];

// Multi-select food search, presented as a slide-up Modal (mirrors
// DescribeFoodSheet) so it rises from the bottom over the home screen. Selected
// foods accumulate as pills; "Next" funnels them all into the shared review
// screen, the same place barcode / camera / describe land.
export function SearchFoodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const addReadyDish = useFoodTaskStore((st) => st.addReadyDish);
  const customFoods = useMealTrayStore((st) => st.customFoods);
  const fetchCustomFoods = useMealTrayStore((st) => st.fetchCustomFoods);
  const recentFoods = useMealTrayStore((st) => st.recentFoods);
  const fetchRecentFoods = useMealTrayStore((st) => st.fetchRecentFoods);
  const savedMeals = useMealTrayStore((st) => st.savedMeals);
  const fetchSavedMeals = useMealTrayStore((st) => st.fetchSavedMeals);

  const [tab, setTab] = useState<Tab>('search');
  const [filter, setFilter] = useState<MyFoodsFilter>('favorites');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<SelEntry[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset + refresh whenever the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setTab('search');
    setFilter('favorites');
    setQuery('');
    setResults([]);
    setSelected([]);
    setAdding(false);
    fetchCustomFoods();
    fetchRecentFoods();
    fetchSavedMeals();
  }, [visible]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (tab !== 'search' || q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        setResults(await searchUSDA(q));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, tab]);

  function isSelected(key: string) {
    return selected.some((e) => e.key === key);
  }
  function toggle(key: string, label: string, result: FoodResult) {
    setSelected((prev) =>
      prev.some((e) => e.key === key)
        ? prev.filter((e) => e.key !== key)
        : [...prev, { key, label, result }],
    );
  }
  function addRecipe(m: SavedMeal) {
    const entries = savedMealToResults(m).map((r, i) => ({
      key: `recipe-${m.id}-${i}`,
      label: r.name,
      result: r,
    }));
    setSelected((prev) =>
      prev.some((e) => e.key.startsWith(`recipe-${m.id}-`))
        ? prev.filter((e) => !e.key.startsWith(`recipe-${m.id}-`))
        : [...prev, ...entries],
    );
  }
  function removeSelected(key: string) {
    setSelected((prev) => prev.filter((e) => e.key !== key));
  }

  async function handleNext() {
    if (adding || selected.length === 0) return;
    setAdding(true);
    let id: string | undefined;
    try {
      for (const e of selected) {
        id = await addReadyDish({ source: 'search', result: e.result, taskId: id });
      }
    } catch {
      setAdding(false);
      return;
    }
    onClose();
    router.push(`/entry/review-food?taskId=${id}` as any);
  }

  const q = query.trim().toLowerCase();
  const matchesQuery = (name: string) => q.length < 2 || name.toLowerCase().includes(q);

  type Row =
    | { kind: 'food'; key: string; result: FoodResult; sub: string }
    | { kind: 'recipe'; key: string; meal: SavedMeal; sub: string };

  const rows: Row[] = useMemo(() => {
    if (tab === 'search') {
      if (q.length >= 2) {
        return results.map((r, i) => ({
          kind: 'food' as const,
          key: `s-${r.fdcId}-${i}`,
          result: r,
          sub: `${Math.round(r.calories)} kcal${r.brand ? ` · ${r.brand}` : ''}`,
        }));
      }
      return recentFoods.map((rf, i) => ({
        kind: 'food' as const,
        key: `r-${rf.food_name}-${i}`,
        result: recentToResult(rf),
        sub: `${Math.round(rf.calories)} kcal · 1 serving`,
      }));
    }
    if (filter === 'recipes') {
      return savedMeals.filter((m) => matchesQuery(m.name)).map((m) => ({
        kind: 'recipe' as const,
        key: `recipe-${m.id}`,
        meal: m,
        sub: `${Math.round(m.total_calories)} kcal · ${m.items.length} items`,
      }));
    }
    if (filter === 'custom') {
      return customFoods.filter((cf) => matchesQuery(cf.name)).map((cf, i) => ({
        kind: 'food' as const,
        key: `c-${cf.id ?? i}`,
        result: customToResult(cf),
        sub: `${Math.round(cf.calories_per_100g)} kcal${cf.brand ? ` · ${cf.brand}` : ''}`,
      }));
    }
    const src = filter === 'favorites' ? recentFoods.filter((f) => f.is_favorite) : recentFoods;
    return src.filter((rf) => matchesQuery(rf.food_name)).map((rf, i) => ({
      kind: 'food' as const,
      key: `m-${rf.food_name}-${i}`,
      result: recentToResult(rf),
      sub: `${Math.round(rf.calories)} kcal · 1 serving`,
    }));
  }, [tab, filter, q, results, recentFoods, customFoods, savedMeals]);

  const emptyText =
    tab === 'search'
      ? q.length >= 2 ? 'No results.' : 'Recent foods will show here.'
      : filter === 'recipes' ? 'No saved recipes yet.'
        : filter === 'custom' ? 'No custom foods yet.'
          : filter === 'favorites' ? 'No favorites yet.'
            : 'Nothing logged yet.';

  function renderRow(row: Row) {
    const isRecipe = row.kind === 'recipe';
    const present = isRecipe
      ? selected.some((e) => e.key.startsWith(`recipe-${row.meal.id}-`))
      : isSelected(row.key);
    const name = isRecipe ? row.meal.name : row.result.name;
    const img = row.kind === 'food' ? row.result.image_url : undefined;

    return (
      <View style={s.row}>
        <View style={s.thumb}>
          {img ? <Image source={{ uri: img }} style={s.thumbImg} /> : <Utensils size={18} color={colors.textMuted} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.rowName} numberOfLines={1}>{name}</Text>
          <Text style={s.rowSub} numberOfLines={1}>{row.sub}</Text>
        </View>
        <TouchableOpacity
          style={[s.addBtn, present && s.addBtnActive]}
          onPress={() => (isRecipe ? addRecipe(row.meal) : toggle(row.key, row.result.name, row.result))}
          disabled={adding}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={present ? `Remove ${name}` : `Add ${name}`}
        >
          {present ? <Check size={20} color="#FFFFFF" /> : <Plus size={20} color={colors.orange} />}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={s.sheet}>
            <View style={s.grabber} />

            <View style={s.headerRow}>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={s.cancel}>Cancel</Text>
              </Pressable>
              <Text style={s.headerTitle}>Log food</Text>
              <Pressable onPress={handleNext} hitSlop={12} disabled={selected.length === 0 || adding}>
                {adding ? (
                  <ActivityIndicator color={colors.orange} style={{ width: 50 }} />
                ) : (
                  <Text style={[s.next, selected.length === 0 && s.nextDisabled]}>Next</Text>
                )}
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
              {(['search', 'myfoods'] as Tab[]).map((t) => (
                <TouchableOpacity key={t} style={s.tab} onPress={() => setTab(t)} activeOpacity={0.7}>
                  <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'search' ? 'Search' : 'My Foods'}</Text>
                  {tab === t && <View style={s.tabUnderline} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.searchBar}>
              <SearchIcon size={18} color={colors.textMuted} />
              <TextInput
                style={s.searchInput}
                placeholder="Search for foods & drinks"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <X size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Selected tray */}
            {selected.length === 0 ? (
              <View style={s.trayEmpty}>
                <Text style={s.trayEmptyText}>No items selected</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={s.pillRow}
                style={s.pillScroll}
              >
                {selected.map((e) => (
                  <TouchableOpacity key={e.key} style={s.pill} onPress={() => removeSelected(e.key)} activeOpacity={0.8}>
                    <Text style={s.pillText} numberOfLines={1}>{e.label}</Text>
                    <X size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* My Foods sub-filters */}
            {tab === 'myfoods' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow} style={s.filterScroll}>
                {MYFOODS_FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[s.filterPill, filter === f.key && s.filterPillActive]}
                    onPress={() => setFilter(f.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <FlatList
              data={rows}
              keyExtractor={(row) => row.key}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              style={{ flex: 1 }}
              ListEmptyComponent={
                searching ? (
                  <View style={s.emptyWrap}><ActivityIndicator color={colors.orange} /></View>
                ) : (
                  <Text style={s.emptyText}>{emptyText}</Text>
                )
              }
              renderItem={({ item }) => renderRow(item)}
            />
        </View>
      </View>
    </Modal>
  );
}

function createStyles(c: AppColors) {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      height: Math.round(SCREEN_H * 0.9),
      backgroundColor: c.cardBg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: c.borderSubtle,
    },
    grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, backgroundColor: w(0.18), marginBottom: 12 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    cancel: { fontSize: 16, color: c.textSecondary, fontWeight: '600', width: 56 },
    headerTitle: { fontSize: 17, fontWeight: '800', color: c.textPrimary },
    next: { fontSize: 16, color: c.orange, fontWeight: '700', width: 56, textAlign: 'right' },
    nextDisabled: { color: c.textMuted, opacity: 0.6 },
    tabs: { flexDirection: 'row', gap: 24, marginTop: 10 },
    tab: { paddingVertical: 8 },
    tabText: { fontSize: 15, fontWeight: '600', color: c.textMuted },
    tabTextActive: { color: c.textPrimary },
    tabUnderline: { height: 2, backgroundColor: c.textPrimary, borderRadius: 1, marginTop: 6 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8,
      paddingHorizontal: 14, height: 44, borderRadius: 14, backgroundColor: w(0.05),
    },
    searchInput: { flex: 1, fontSize: 16, color: c.textPrimary },
    trayEmpty: {
      marginBottom: 8, height: 44, borderRadius: 12,
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
    },
    trayEmptyText: { color: c.textMuted, fontSize: 14, fontWeight: '500' },
    pillScroll: { maxHeight: 44, marginBottom: 8 },
    pillRow: { gap: 8, alignItems: 'center' },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 200,
      paddingLeft: 12, paddingRight: 10, height: 34, borderRadius: 17, backgroundColor: w(0.06),
    },
    pillText: { fontSize: 14, fontWeight: '600', color: c.textPrimary, flexShrink: 1 },
    filterScroll: { maxHeight: 50, marginBottom: 4 },
    filterRow: { gap: 8, alignItems: 'center', paddingVertical: 4 },
    filterPill: { paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: w(0.06), alignItems: 'center', justifyContent: 'center' },
    filterPillActive: { backgroundColor: c.textPrimary },
    filterText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
    filterTextActive: { color: c.bg },
    emptyWrap: { paddingTop: 40, alignItems: 'center' },
    emptyText: { textAlign: 'center', color: c.textMuted, fontSize: 14, paddingTop: 40 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: w(0.06), alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    thumbImg: { width: '100%', height: '100%' },
    rowName: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
    rowSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.orangeDim, alignItems: 'center', justifyContent: 'center' },
    addBtnActive: { backgroundColor: c.orange },
  });
}
