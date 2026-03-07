import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { useMealTrayStore } from '../../stores/meal-tray-store';
import { type MealType } from '../../stores/log-store';

// ─── Constants ────────────────────────────────────────────────────────────────

const BG = '#F0EAE4';
const TERRACOTTA = '#C4784B';
const DARK = '#1C0F09';
const WHITE = '#FFFFFF';
const MUTED = 'rgba(28,15,9,0.45)';
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const PARSE_SYSTEM = `You are a food logging assistant. Extract each distinct food item from the user's input.
Return ONLY a valid JSON array, no other text:
[{"item": "specific food name", "estimated_g": 150}]
Estimate typical portion size in grams if not specified. Be specific (e.g. "scrambled eggs" not "eggs").`;

// ─── Types ────────────────────────────────────────────────────────────────────

type ParsedItem = {
  item: string;
  estimated_g: number;
  results: FoodResult[];
  selectedIdx: number;
  servingG: string;
};

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

export default function DescribeFoodScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addToTray } = useMealTrayStore();

  const [text, setText] = useState('');
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [items, setItems] = useState<ParsedItem[] | null>(null);

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    setParseError('');
    setItems(null);
    try {
      const raw = await callHaiku(PARSE_SYSTEM, [
        { type: 'text', text: `User input: "${text}"` },
      ]);
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('No JSON array found');
      const parsed: { item: string; estimated_g: number }[] = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty result');

      // search USDA for each item in parallel
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
    } catch {
      setParseError("Couldn't parse — try being more specific.");
    } finally {
      setParsing(false);
    }
  }

  function handleLogAll() {
    if (!items) return;
    for (const item of items) {
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
    router.back();
  }

  function updateItem(idx: number, patch: Partial<ParsedItem>) {
    setItems((prev) => prev ? prev.map((it, i) => i === idx ? { ...it, ...patch } : it) : prev);
  }

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backShadow} activeOpacity={0.75}>
          <View style={s.backClip}>
            <BlurView intensity={76} tint="light" style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, s.backOverlay]} />
            <GlassBorder r={20} />
            <Ionicons name="chevron-back" size={22} color={DARK} />
          </View>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Describe Food</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Meal type chips */}
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

        {/* Text input */}
        {!items && (
          <GlassCard>
            <Text style={s.sectionLabel}>WHAT DID YOU EAT?</Text>
            <TextInput
              style={s.textArea}
              placeholder={'e.g. "two scrambled eggs and whole wheat toast with butter"'}
              placeholderTextColor={MUTED}
              value={text}
              onChangeText={setText}
              multiline
              textAlignVertical="top"
              returnKeyType="done"
              blurOnSubmit
            />
          </GlassCard>
        )}

        {/* Parse error */}
        {!!parseError && (
          <View style={s.errorRow}>
            <Ionicons name="alert-circle-outline" size={16} color={TERRACOTTA} />
            <Text style={s.errorText}>{parseError}</Text>
          </View>
        )}

        {/* Parsed items */}
        {items && items.map((item, idx) => (
          <GlassCard key={idx}>
            <View style={s.itemHeader}>
              <Text style={s.itemRawName}>{item.item}</Text>
              <TouchableOpacity
                onPress={() => updateItem(idx, { item: item.item })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              />
            </View>

            {item.results.length === 0 ? (
              <Text style={s.noMatch}>No USDA match — will skip</Text>
            ) : (
              <>
                {/* Top 3 matches picker */}
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
                      {!!r.brand && <Text style={s.matchBrand} numberOfLines={1}>{r.brand}</Text>}
                    </View>
                    <Text style={s.matchCal}>{r.calories} kcal/100g</Text>
                  </TouchableOpacity>
                ))}

                {/* Serving size */}
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

                {/* Macro preview */}
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

        {/* Reset link when items shown */}
        {items && (
          <TouchableOpacity
            onPress={() => { setItems(null); setParseError(''); }}
            style={s.retryRow}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={15} color={MUTED} />
            <Text style={s.retryText}>Try different description</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={[s.btnWrapper, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        {items ? (
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={handleLogAll}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>Add {items.length} Item{items.length !== 1 ? 's' : ''} to Meal</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.primaryBtn, (!text.trim() || parsing) && s.primaryBtnDisabled]}
            onPress={handleParse}
            activeOpacity={0.85}
            disabled={!text.trim() || parsing}
          >
            {parsing ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color={WHITE} size="small" />
                <Text style={s.primaryBtnText}>Analyzing…</Text>
              </View>
            ) : (
              <Text style={s.primaryBtnText}>Parse & Log</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

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
  backOverlay: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
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

  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: TERRACOTTA,
    letterSpacing: 2,
    marginBottom: 12,
  },

  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,15,9,0.06)',
  },
  chipActive: { backgroundColor: TERRACOTTA },
  chipText: { fontSize: 13, fontWeight: '600', color: MUTED },
  chipTextActive: { color: WHITE },

  textArea: {
    fontSize: 15,
    color: DARK,
    minHeight: 90,
    lineHeight: 22,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  errorText: { fontSize: 13, color: TERRACOTTA },

  itemHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itemRawName: { flex: 1, fontSize: 15, fontWeight: '700', color: DARK },

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
  matchRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchRadioActive: { borderColor: TERRACOTTA },
  matchRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TERRACOTTA },
  matchName: { fontSize: 13, fontWeight: '600', color: DARK },
  matchBrand: { fontSize: 11, color: MUTED },
  matchCal: { fontSize: 12, color: MUTED },

  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  servingLabel: { fontSize: 13, color: DARK, fontWeight: '500', marginRight: 10 },
  servingInputWrap: {
    width: 72,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  servingInput: {
    width: 72,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: DARK,
  },
  servingUnit: { fontSize: 13, color: MUTED },

  macroRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  macroPill: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '600',
    color: DARK,
  },

  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  retryText: { fontSize: 13, color: MUTED },

  btnWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  primaryBtn: {
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
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '800', color: WHITE, letterSpacing: 0.3 },
});
