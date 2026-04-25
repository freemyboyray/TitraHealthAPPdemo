import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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

import { GlassBorder } from '@/components/ui/glass-border';
import { WaterLogSheet } from '@/components/water-log-sheet';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import { parseFoodDescription, ParsedFood } from '@/lib/openai';
import { useUiStore } from '@/stores/ui-store';
import { useProfile } from '@/contexts/profile-context';
import { isOralDrug, doseIconName } from '@/constants/drug-pk';
import { isOnTreatment } from '@/constants/user-profile';

const ORANGE = '#FF742A';
const ICON_SIZE = 24;

type EntryType = 'water' | 'food' | null;

// ─── Sheet ────────────────────────────────────────────────────────────────────

export function AddEntrySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useAppTheme();
  const f = useMemo(() => createFormStyles(colors), [colors]);
  const s = useMemo(() => createSheetStyles(colors), [colors]);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openAiChat } = useUiStore();
  const { dispatch, profile } = useHealthData();
  const { profile: fullProfile } = useProfile();
  const oral = isOralDrug(fullProfile?.glp1Type);
  const { addFoodLog } = useLogStore();

  const [activeEntry, setActiveEntry] = useState<EntryType>(null);
  const [waterLogVisible, setWaterLogVisible] = useState(false);
  const [waterInput, setWaterInput] = useState('');
  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodDescription, setFoodDescription] = useState('');
  const [aiParsingState, setAiParsingState] = useState<'idle' | 'loading' | 'confirmed' | 'error'>('idle');
  const [parsedFood, setParsedFood] = useState<ParsedFood | null>(null);

  const isMetric = profile?.unitSystem === 'metric';

  const closeSheet = () => {
    setActiveEntry(null);
    onClose();
  };

  const resetForm = () => {
    setWaterInput('');
    setFoodName('');
    setFoodCalories('');
    setFoodProtein('');
    setFoodDescription('');
    setAiParsingState('idle');
    setParsedFood(null);
  };

  const handleBackFromForm = () => {
    resetForm();
    setActiveEntry(null);
  };

  // ─── Action handlers ────────────────────────────────────────────────────────

  const handleAskAI = () => {
    closeSheet();
    setTimeout(() => openAiChat(), 300);
  };

  const handleLogDose = () => {
    closeSheet();
    router.push('/entry/log-dose');
  };

  const handleConfirmWater = () => {
    const val = parseFloat(waterInput);
    if (isNaN(val) || val <= 0) return;
    const ml = isMetric ? val : val * 29.5735;
    dispatch({ type: 'LOG_WATER', ml: Math.round(ml) });
    resetForm();
    closeSheet();
  };

  const handleParseFood = async () => {
    if (!foodDescription.trim()) return;
    setAiParsingState('loading');
    try {
      const result = await parseFoodDescription(foodDescription, profile);
      setParsedFood(result);
      setAiParsingState('confirmed');
    } catch {
      setAiParsingState('error');
    }
  };

  const handleConfirmFood = () => {
    if (parsedFood && aiParsingState === 'confirmed') {
      addFoodLog({
        food_name: parsedFood.name,
        calories: parsedFood.calories,
        protein_g: parsedFood.proteinG,
        carbs_g: parsedFood.carbsG,
        fat_g: parsedFood.fatG,
        fiber_g: parsedFood.fiberG,
        meal_type: 'snack',
        source: 'manual',
      });
      if (parsedFood.proteinG > 0) dispatch({ type: 'LOG_PROTEIN', grams: parsedFood.proteinG });
      resetForm();
      closeSheet();
      return;
    }
    // Manual fallback
    const cal = parseInt(foodCalories, 10) || 0;
    const protein = parseFloat(foodProtein) || 0;
    if (!foodName.trim()) return;
    addFoodLog({
      food_name: foodName.trim(),
      calories: cal,
      protein_g: protein,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      meal_type: 'snack',
      source: 'manual',
    });
    if (protein > 0) dispatch({ type: 'LOG_PROTEIN', grams: protein });
    resetForm();
    closeSheet();
  };

  // ─── Grid items ─────────────────────────────────────────────────────────────

  const onTreatment = isOnTreatment(fullProfile);

  const GRID = [
    {
      label: 'DESCRIBE FOOD',
      icon: <MaterialIcons name="restaurant" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => { closeSheet(); setTimeout(() => router.push('/entry/log-food?mode=describe' as any), 300); },
    },
    ...(onTreatment ? [{
      label: oral ? 'LOG DOSE' : 'LOG INJECTION',
      icon: <FontAwesome5 name={doseIconName(oral)} size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: handleLogDose,
    }] : []),
    {
      label: 'CAPTURE FOOD',
      icon: <Ionicons name="camera-outline" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => { closeSheet(); setTimeout(() => router.push('/entry/log-food?mode=camera' as any), 300); },
    },
    {
      label: 'SCAN FOOD',
      icon: <Ionicons name="barcode-outline" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => { closeSheet(); setTimeout(() => router.push('/entry/log-food?mode=scan' as any), 300); },
    },
    {
      label: 'ASK AI',
      special: true,
      icon: null,
      onPress: handleAskAI,
    },
    ...(onTreatment ? [{
      label: 'SIDE EFFECTS',
      icon: <Ionicons name="warning-outline" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => { closeSheet(); router.push('/entry/side-effects'); },
    }] : []),
    {
      label: 'LOG WEIGHT',
      icon: <MaterialCommunityIcons name="scale-bathroom" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => { closeSheet(); router.push('/entry/log-weight'); },
    },
    {
      label: 'LOG WATER',
      icon: <Ionicons name="water-outline" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => {
        closeSheet();
        setTimeout(() => setWaterLogVisible(true), 300);
      },
    },
    {
      label: 'LOG ACTIVITY',
      icon: <MaterialIcons name="directions-run" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => { closeSheet(); router.push('/entry/log-activity'); },
    },
  ];

  // ─── Inline form config ──────────────────────────────────────────────────────

  const formConfig: Record<NonNullable<EntryType>, {
    title: string;
    onConfirm: () => void;
    content: React.ReactNode;
  }> = {
    water: {
      title: 'Log Water',
      onConfirm: handleConfirmWater,
      content: (
        <View style={f.fieldRow}>
          <TextInput
            style={f.input}
            value={waterInput}
            onChangeText={setWaterInput}
            placeholder={isMetric ? 'e.g. 500' : 'e.g. 16'}
            placeholderTextColor={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
            keyboardType="decimal-pad"
            autoFocus
          />
          <Text style={f.unit}>{isMetric ? 'ml' : 'oz'}</Text>
        </View>
      ),
    },
    food: {
      title: 'Describe Food',
      onConfirm: handleConfirmFood,
      content: aiParsingState === 'confirmed' && parsedFood ? (
        /* Parsed result card */
        <View style={f.parsedCard}>
          <Text style={f.parsedName}>{parsedFood.name}</Text>
          <Text style={f.parsedServing}>{parsedFood.servingSize}</Text>
          <View style={f.parsedRow}>
            <View style={f.parsedStat}><Text style={f.parsedStatVal}>{parsedFood.calories}</Text><Text style={f.parsedStatLabel}>cal</Text></View>
            <View style={f.parsedStat}><Text style={f.parsedStatVal}>{parsedFood.proteinG}g</Text><Text style={f.parsedStatLabel}>protein</Text></View>
            <View style={f.parsedStat}><Text style={f.parsedStatVal}>{parsedFood.carbsG}g</Text><Text style={f.parsedStatLabel}>carbs</Text></View>
            <View style={f.parsedStat}><Text style={f.parsedStatVal}>{parsedFood.fatG}g</Text><Text style={f.parsedStatLabel}>fat</Text></View>
            <View style={f.parsedStat}><Text style={f.parsedStatVal}>{parsedFood.fiberG}g</Text><Text style={f.parsedStatLabel}>fiber</Text></View>
          </View>
          <View style={[f.confidenceBadge, { backgroundColor: parsedFood.confidence === 'high' ? 'rgba(43,148,80,0.15)' : 'rgba(243,156,18,0.15)' }]}>
            <Text style={[f.confidenceText, { color: parsedFood.confidence === 'high' ? '#2B9450' : '#F39C12' }]}>
              {parsedFood.confidence === 'high' ? 'High confidence' : parsedFood.confidence === 'medium' ? 'Medium confidence' : 'Low confidence - verify before adding'}
            </Text>
          </View>
          <Text style={f.parsedEditHint} onPress={() => setAiParsingState('idle')}>Edit manually instead</Text>
        </View>
      ) : aiParsingState === 'loading' ? (
        /* Loading state */
        <View style={f.aiLoadingWrap}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={f.aiLoadingText}>Analyzing nutrition...</Text>
        </View>
      ) : (
        /* Description input - initial or error state */
        <>
          {aiParsingState === 'error' && (
            <Text style={f.aiErrorText}>Couldn't parse that - try being more specific, or enter manually below.</Text>
          )}
          <TextInput
            style={[f.input, { marginBottom: 12, minHeight: 64 }]}
            value={foodDescription}
            onChangeText={setFoodDescription}
            placeholder="Describe what you ate (e.g. 2 scrambled eggs with avocado toast)"
            placeholderTextColor={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
            multiline
            autoFocus={aiParsingState !== 'error'}
          />
          <TouchableOpacity style={f.aiParseBtn} onPress={handleParseFood} activeOpacity={0.8}>
            <Text style={f.aiParseBtnText}>Parse with AI</Text>
          </TouchableOpacity>
          {aiParsingState === 'error' && (
            <>
              <View style={f.orDivider}><View style={f.orLine} /><Text style={f.orText}>or enter manually</Text><View style={f.orLine} /></View>
              <TextInput
                style={[f.input, { marginBottom: 10 }]}
                value={foodName}
                onChangeText={setFoodName}
                placeholder="Food name"
                placeholderTextColor={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
              />
              <View style={f.fieldRow}>
                <TextInput
                  style={f.input}
                  value={foodCalories}
                  onChangeText={setFoodCalories}
                  placeholder="Calories"
                  placeholderTextColor={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[f.input, { marginLeft: 8 }]}
                  value={foodProtein}
                  onChangeText={setFoodProtein}
                  placeholder="Protein g"
                  placeholderTextColor={colors.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)'}
                  keyboardType="decimal-pad"
                />
              </View>
            </>
          )}
        </>
      ),
    },
  };

  // ─── Fade animation ────────────────────────────────────────────────────────
  const [rendered, setRendered] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.timing(fadeAnim, { toValue: 1, useNativeDriver: true, duration: 250 }).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, useNativeDriver: true, duration: 200 }).start(() => {
        setRendered(false);
      });
    }
  }, [visible]);

  if (!rendered) {
    return <WaterLogSheet visible={waterLogVisible} onClose={() => setWaterLogVisible(false)} />;
  }

  return (
    <>
    {/* Full-screen overlay positioned absolutely — does NOT block tab bar FAB */}
    <View style={s.container} pointerEvents="box-none">

      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeSheet} />
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim, flex: 1, justifyContent: 'flex-end' as const }} pointerEvents="box-none">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Sheet - frosted glass, fully rounded */}
        <View style={[s.sheetOuter, { paddingBottom: Math.max(insets.bottom, 8) + 80 }]}>
          <View style={s.sheetShadow}>
            <View style={[s.sheetBody, { backgroundColor: colors.bg }]}>
              <BlurView intensity={60} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 28, backgroundColor: colors.glassOverlay }]} />

              <View style={s.sheetContent}>

                {activeEntry ? (
                  /* ── Inline form view ── */
                  <>
                    <View style={f.header}>
                      <TouchableOpacity onPress={handleBackFromForm} style={f.backBtn} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <Text style={s.title}>{formConfig[activeEntry].title}</Text>
                      <View style={{ width: 36 }} />
                    </View>
                    <View style={f.formBody}>
                      {formConfig[activeEntry].content}
                    </View>
                    <TouchableOpacity style={f.confirmBtn} onPress={formConfig[activeEntry].onConfirm} activeOpacity={0.8}>
                      <Text style={f.confirmText}>Confirm</Text>
                    </TouchableOpacity>
                    <View style={{ height: 8 }} />
                  </>
                ) : (
                  /* ── Grid view ── */
                  <>
                    <View style={s.dash} />
                    <View style={s.grid}>
                      {GRID.map((item) => (
                        <TouchableOpacity key={item.label} style={s.gridItem} activeOpacity={0.7} onPress={item.onPress}>
                          {item.special ? (
                            <View style={s.specialCircle}>
                              <Ionicons name="chatbubble-ellipses-outline" size={ICON_SIZE} color="#FFF" />
                            </View>
                          ) : (
                            <View style={s.iconCircle}>
                              <GlassBorder r={32} />
                              {item.icon}
                            </View>
                          )}
                          <Text style={[s.gridLabel, item.special && s.gridLabelSpecial]}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>
      </Animated.View>

    </View>

    <WaterLogSheet visible={waterLogVisible} onClose={() => setWaterLogVisible(false)} />
    </>
  );
}

// ─── Form styles ───────────────────────────────────────────────────────────────

const createFormStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.borderSubtle,
    borderRadius: 18,
  },
  formBody: {
    marginBottom: 20,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: w(0.07),
    borderWidth: 1,
    borderColor: w(0.10),
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '600',
    color: c.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  unit: {
    fontSize: 15,
    fontWeight: '700',
    color: w(0.35),
    minWidth: 32,
    fontFamily: 'Inter_400Regular',
  },
  confirmBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FF742A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    fontFamily: 'Inter_400Regular',
  },

  // AI parse button
  aiParseBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,116,42,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,116,42,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  aiParseBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF742A',
    fontFamily: 'Inter_400Regular',
  },

  // AI loading
  aiLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 14,
  },
  aiLoadingText: {
    fontSize: 14,
    color: w(0.45),
    fontWeight: '500',
    fontFamily: 'Inter_400Regular',
  },
  aiErrorText: {
    fontSize: 13,
    color: '#F39C12',
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
  },

  // Parsed result card
  parsedCard: {
    backgroundColor: c.glassOverlay,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: w(0.10),
    padding: 16,
    marginBottom: 4,
  },
  parsedName: {
    fontSize: 18,
    fontWeight: '800',
    color: c.textPrimary,
    marginBottom: 2,
    fontFamily: 'Inter_400Regular',
  },
  parsedServing: {
    fontSize: 12,
    color: w(0.40),
    marginBottom: 14,
    fontFamily: 'Inter_400Regular',
  },
  parsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  parsedStat: { alignItems: 'center' },
  parsedStatVal: {
    fontSize: 16,
    fontWeight: '800',
    color: c.textPrimary,
    fontFamily: 'Inter_400Regular',
  },
  parsedStatLabel: {
    fontSize: 10,
    color: w(0.40),
    fontWeight: '500',
    fontFamily: 'Inter_400Regular',
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_400Regular',
  },
  parsedEditHint: {
    fontSize: 12,
    color: w(0.30),
    fontFamily: 'Inter_400Regular',
    textDecorationLine: 'underline',
  },

  // Or divider
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  orLine: { flex: 1, height: 1, backgroundColor: c.borderSubtle },
  orText: {
    fontSize: 11,
    color: w(0.30),
    fontWeight: '500',
    fontFamily: 'Inter_400Regular',
  },
  });
};

// ─── Sheet styles ──────────────────────────────────────────────────────────────

const createSheetStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 5 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  // Sheet outer wrapper (holds sheet + fab)
  sheetOuter: { paddingHorizontal: 10 },
  sheetShadow: { borderRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: c.isDark ? 0.4 : 0.12, shadowRadius: 20, elevation: 12 },
  sheetBody: { borderRadius: 28, overflow: 'hidden' },
  sheetContent: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, marginBottom: 4, fontFamily: 'Inter_800ExtraBold' },
  subtitle: { fontSize: 14, color: w(0.35), fontWeight: '400', marginBottom: 18, fontFamily: 'Inter_400Regular' },
  dash: { marginBottom: 22 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '33.33%', alignItems: 'center', marginBottom: 24 },

  // Icon circles
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.borderSubtle, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },

  // ASK AI sphere
  specialCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  sphereShine: { position: 'absolute', top: 10, right: 12, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)' },
  sphereShineSmall: { position: 'absolute', top: 22, right: 18, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },

  gridLabel: { fontSize: 10, fontWeight: '700', color: c.textPrimary, letterSpacing: 0.4, textAlign: 'center', fontFamily: 'Inter_400Regular' },
  gridLabelSpecial: { color: ORANGE },

  });
};
