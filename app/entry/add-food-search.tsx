import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search as SearchIcon, Utensils, X } from 'lucide-react-native';
import { searchUSDA } from '../../lib/usda';
import type { FoodResult } from '../../lib/fatsecret';
import { customToResult, recentToResult } from '@/lib/food-search';
import { useFoodTaskStore } from '../../stores/food-task-store';
import { useMealTrayStore } from '../../stores/meal-tray-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

// Single-pick food search used by the task sub-flows: the review screen's "+"
// (add another food), and "Add / Replace ingredient" from Customize. Always
// presents as a modal over review-food. The top-level "log food via search"
// entry uses the multi-select SearchFoodSheet instead.
type Tab = 'search' | 'myfoods';
type MyFoodsFilter = 'favorites' | 'custom' | 'historical';

const MYFOODS_FILTERS: { key: MyFoodsFilter; label: string }[] = [
  { key: 'favorites', label: 'Favorites' },
  { key: 'custom', label: 'Custom' },
  { key: 'historical', label: 'Historical' },
];

export default function AddFoodSearchScreen() {
  const { taskId, dishIdx: dishIdxParam, compIdx: compIdxParam } = useLocalSearchParams<{ taskId?: string; dishIdx?: string; compIdx?: string }>();
  const dishIdx = dishIdxParam != null ? parseInt(dishIdxParam, 10) : null;
  // When compIdx is present we're REPLACING an existing ingredient (the
  // "Customize" flow) rather than adding a new one.
  const compIdx = compIdxParam != null ? parseInt(compIdxParam, 10) : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const addReadyDish = useFoodTaskStore((st) => st.addReadyDish);
  const addComponentToDish = useFoodTaskStore((st) => st.addComponentToDish);
  const replaceComponentWithResult = useFoodTaskStore((st) => st.replaceComponentWithResult);
  const customFoods = useMealTrayStore((st) => st.customFoods);
  const fetchCustomFoods = useMealTrayStore((st) => st.fetchCustomFoods);
  const recentFoods = useMealTrayStore((st) => st.recentFoods);
  const fetchRecentFoods = useMealTrayStore((st) => st.fetchRecentFoods);

  const [tab, setTab] = useState<Tab>('search');
  const [filter, setFilter] = useState<MyFoodsFilter>('favorites');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchCustomFoods();
    fetchRecentFoods();
  }, []);

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

  async function onPick(result: FoodResult) {
    if (adding) return;
    setAdding(true);
    try {
      if (taskId && dishIdx != null && compIdx != null) {
        await replaceComponentWithResult(taskId, dishIdx, compIdx, result);
        router.back();
      } else if (taskId && dishIdx != null) {
        await addComponentToDish(taskId, dishIdx, result);
        router.back();
      } else if (taskId) {
        await addReadyDish({ source: 'manual', result, taskId });
        router.back();
      } else {
        const id = await addReadyDish({ source: 'search', result });
        router.replace(`/entry/review-food?taskId=${id}` as any);
      }
    } catch {
      setAdding(false);
    }
  }

  const q = query.trim().toLowerCase();
  const matchesQuery = (name: string) => q.length < 2 || name.toLowerCase().includes(q);

  type Row = { key: string; result: FoodResult; sub: string };
  const rows: Row[] = useMemo(() => {
    if (tab === 'search') {
      if (q.length >= 2) {
        return results.map((r, i) => ({
          key: `s-${r.fdcId}-${i}`,
          result: r,
          sub: `${Math.round(r.calories)} kcal${r.brand ? ` · ${r.brand}` : ''}`,
        }));
      }
      return recentFoods.map((rf, i) => ({
        key: `r-${rf.food_name}-${i}`,
        result: recentToResult(rf),
        sub: `${Math.round(rf.calories)} kcal · 1 serving`,
      }));
    }
    if (filter === 'custom') {
      return customFoods.filter((cf) => matchesQuery(cf.name)).map((cf, i) => ({
        key: `c-${cf.id ?? i}`,
        result: customToResult(cf),
        sub: `${Math.round(cf.calories_per_100g)} kcal${cf.brand ? ` · ${cf.brand}` : ''}`,
      }));
    }
    const src = filter === 'favorites' ? recentFoods.filter((f) => f.is_favorite) : recentFoods;
    return src.filter((rf) => matchesQuery(rf.food_name)).map((rf, i) => ({
      key: `m-${rf.food_name}-${i}`,
      result: recentToResult(rf),
      sub: `${Math.round(rf.calories)} kcal · 1 serving`,
    }));
  }, [tab, filter, q, results, recentFoods, customFoods]);

  const emptyText =
    tab === 'search'
      ? q.length >= 2 ? 'No results.' : 'Recent foods will show here.'
      : filter === 'custom' ? 'No custom foods yet.'
        : filter === 'favorites' ? 'No favorites yet.'
          : 'Nothing logged yet.';

  const headerTitle = compIdx != null ? 'Replace ingredient' : dishIdx != null ? 'Add ingredient' : 'Add food';

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
        <Text style={s.headerTitle}>{headerTitle}</Text>
        <View style={{ width: 56 }} />
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={
          searching ? (
            <View style={s.emptyWrap}><ActivityIndicator color={colors.orange} /></View>
          ) : (
            <Text style={s.emptyText}>{emptyText}</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={s.thumb}>
              {item.result.image_url ? (
                <Image source={{ uri: item.result.image_url }} style={s.thumbImg} />
              ) : (
                <Utensils size={18} color={colors.textMuted} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowName} numberOfLines={1}>{item.result.name}</Text>
              <Text style={s.rowSub} numberOfLines={1}>{item.sub}</Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={() => onPick(item.result)} disabled={adding} hitSlop={8}>
              <Plus size={20} color={colors.orange} />
            </TouchableOpacity>
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(c: AppColors) {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
    cancel: { fontSize: 16, color: c.textSecondary, fontWeight: '600' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: c.textPrimary },
    tabs: { flexDirection: 'row', paddingHorizontal: 20, gap: 24, marginTop: 6 },
    tab: { paddingVertical: 8 },
    tabText: { fontSize: 15, fontWeight: '600', color: c.textMuted },
    tabTextActive: { color: c.textPrimary },
    tabUnderline: { height: 2, backgroundColor: c.textPrimary, borderRadius: 1, marginTop: 6 },
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginHorizontal: 20, marginTop: 12, marginBottom: 8,
      paddingHorizontal: 14, height: 44, borderRadius: 14, backgroundColor: w(0.05),
    },
    searchInput: { flex: 1, fontSize: 16, color: c.textPrimary },
    filterScroll: { maxHeight: 50, marginBottom: 4 },
    filterRow: { paddingHorizontal: 20, gap: 8, alignItems: 'center', paddingVertical: 4 },
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
  });
}
