import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Search as SearchIcon, X } from 'lucide-react-native';
import { searchUSDA } from '../../lib/usda';
import type { FoodResult } from '../../lib/fatsecret';
import { useFoodTaskStore } from '../../stores/food-task-store';
import { useMealTrayStore, type CustomFood } from '../../stores/meal-tray-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

// Convert a user's custom food (per-100g) into a FoodResult so it flows through
// the same addReadyDish / addComponentToDish path as DB search results.
function customToResult(cf: CustomFood): FoodResult {
  const serving = cf.serving_size_g ?? 100;
  return {
    fdcId: -1, // custom: no FatSecret id → addReadyDish skips hydration
    name: cf.name,
    brand: cf.brand || 'My Foods',
    calories: cf.calories_per_100g,
    protein_g: cf.protein_per_100g,
    carbs_g: cf.carbs_per_100g,
    fat_g: cf.fat_per_100g,
    fiber_g: cf.fiber_per_100g,
    serving_size_g: serving,
    serving_options:
      cf.serving_size_g != null
        ? [
            { label: '1 serving', grams: serving, isDefault: true },
            { label: '100 g', grams: 100 },
          ]
        : [{ label: '100 g', grams: 100, isDefault: true }],
  };
}

type Tab = 'search' | 'myfoods';

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

  const [tab, setTab] = useState<Tab>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchCustomFoods();
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const r = await searchUSDA(q);
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

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

  const data: FoodResult[] = tab === 'search' ? results : customFoods.map(customToResult);

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={s.cancel}>Cancel</Text>
        </Pressable>
        <Text style={s.headerTitle}>
          {compIdx != null ? 'Replace ingredient' : dishIdx != null ? 'Add ingredient' : 'Add food'}
        </Text>
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

      {tab === 'search' && (
        <View style={s.searchBar}>
          <SearchIcon size={18} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search foods"
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
      )}

      <FlatList
        data={data}
        keyExtractor={(item, i) => `${item.fdcId}-${i}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}
        ListEmptyComponent={
          searching ? (
            <View style={s.emptyWrap}>
              <ActivityIndicator color={colors.orange} />
            </View>
          ) : tab === 'search' ? (
            <Text style={s.emptyText}>{query.trim().length < 2 ? 'Type to search foods.' : 'No results.'}</Text>
          ) : (
            <Text style={s.emptyText}>No custom foods yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={s.rowSub} numberOfLines={1}>
                {Math.round(item.calories)} calories{item.brand ? ` · ${item.brand}` : ''}
              </Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={() => onPick(item)} disabled={adding} hitSlop={8}>
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginTop: 12,
      marginBottom: 8,
      paddingHorizontal: 14,
      height: 44,
      borderRadius: 14,
      backgroundColor: w(0.05),
    },
    searchInput: { flex: 1, fontSize: 16, color: c.textPrimary },
    emptyWrap: { paddingTop: 40, alignItems: 'center' },
    emptyText: { textAlign: 'center', color: c.textMuted, fontSize: 14, paddingTop: 40 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowName: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
    rowSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.orangeDim, alignItems: 'center', justifyContent: 'center' },
  });
}
