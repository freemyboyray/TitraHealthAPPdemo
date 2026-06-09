import { IconSymbol } from '@/components/ui/icon-symbol';
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
import { TourTarget } from '@/components/tour/tour-target';
import { TOUR_IDS } from '@/lib/tour';
import { WaterLogSheet } from '@/components/water-log-sheet';
import { DescribeFoodSheet } from '@/components/describe-food-sheet';
import { SearchFoodSheet } from '@/components/search-food-sheet';
import { UpgradePrompt } from '@/components/ui/upgrade-prompt';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import { parseFoodDescription, ParsedFood } from '@/lib/openai';
import { ensureAiConsent } from '@/lib/ai-consent';
import { useUiStore } from '@/stores/ui-store';
import { useProfile } from '@/contexts/profile-context';
import { isOralDrug } from '@/constants/drug-pk';
import { isOnTreatment } from '@/constants/user-profile';

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
  const foodSheetPending = useUiStore((st) => st.foodSheetPending);
  const setFoodSheetPending = useUiStore((st) => st.setFoodSheetPending);
  const { dispatch, profile, actuals } = useHealthData();
  const { profile: fullProfile } = useProfile();
  const oral = isOralDrug(fullProfile?.glp1Type);
  const { addFoodLog, checkFoodLogQuota } = useLogStore();

  const [activeEntry, setActiveEntry] = useState<EntryType>(null);
  const [waterLogVisible, setWaterLogVisible] = useState(false);
  const [describeVisible, setDescribeVisible] = useState(false);

  // A deep link / focus tap / CTA can request the describe-food modal by setting
  // foodSheetPending (the old log-food hub's replacement). AddEntrySheet is always
  // mounted at the tab layout, so it can honor the request from anywhere. Close
  // the FAB grid first so only the modal is showing, then clear the one-shot flag.
  useEffect(() => {
    if (!foodSheetPending) return;
    setFoodSheetPending(false);
    onClose();
    setDescribeVisible(true);
  }, [foodSheetPending]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [upgradeVisible, setUpgradeVisible] = useState(false);
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

  // Gate the AI food-logging entry points (describe / capture / scan) behind the
  // free 5-logs-per-day quota. If the user is out of logs, show the upgrade
  // prompt instead of opening the page — so they never type a meal only to be
  // blocked at the end. Premium users always pass (checkFoodLogQuota returns
  // limited:false for them).
  const gateFood = async (proceed: () => void, requiresAi = false) => {
    // AI food features (Describe / Capture) send data to OpenAI — confirm consent
    // up front, before opening the input, so the user gets a clear prompt instead
    // of typing a meal and hitting a raw "needs consent" error. Showing it here
    // (over the add-entry sheet, not over a nested RN Modal) also sidesteps the
    // iOS limitation where one Modal can't present another. Scan = barcode lookup
    // via FatSecret, not AI, so it doesn't pass requiresAi.
    if (requiresAi && !(await ensureAiConsent())) return;
    const q = await checkFoodLogQuota(1);
    if (!q.allowed && q.limited) {
      setUpgradeVisible(true);
      return;
    }
    proceed();
  };

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
    // Describe Food sends the description to OpenAI — prompt for consent first.
    if (!(await ensureAiConsent())) return;
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
      if (parsedFood.fiberG > 0 || parsedFood.calories > 0) dispatch({ type: 'MERGE_ACTUALS', updates: { fiberG: actuals.fiberG + (parsedFood.fiberG ?? 0), caloriesKcal: actuals.caloriesKcal + (parsedFood.calories ?? 0) } });
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

  type GridItem = {
    label: string;
    tourId?: string;
    icon: React.ReactNode;
    onPress: () => void;
  };

  const FOOD_ITEMS: GridItem[] = [
    {
      label: 'DESCRIBE FOOD',
      tourId: TOUR_IDS.entryDescribeFood,
      icon: <IconSymbol name="fork.knife" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => gateFood(() => { closeSheet(); setTimeout(() => setDescribeVisible(true), 300); }, true),
    },
    {
      label: 'CAPTURE FOOD',
      icon: <IconSymbol name="camera.fill" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => gateFood(() => { closeSheet(); setTimeout(() => router.push('/entry/capture-food' as any), 300); }, true),
    },
    {
      label: 'SCAN FOOD',
      icon: <IconSymbol name="barcode.viewfinder" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => gateFood(() => { closeSheet(); setTimeout(() => router.push('/entry/scan-barcode' as any), 300); }),
    },
    {
      label: 'SEARCH FOOD',
      icon: <IconSymbol name="magnifyingglass" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => { closeSheet(); setTimeout(() => setSearchVisible(true), 300); },
    },
  ];

  const LOG_ITEMS: GridItem[] = [
    ...(onTreatment ? [{
      label: oral ? 'LOG DOSE' : 'LOG INJECTION',
      tourId: TOUR_IDS.entryLogDose,
      icon: <IconSymbol name={oral ? 'pills.fill' : 'syringe.fill'} size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: handleLogDose,
    }] : []),
    {
      label: 'LOG WEIGHT',
      icon: <IconSymbol name="scalemass.fill" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => { closeSheet(); router.push('/entry/log-weight'); },
    },
    {
      label: 'LOG ACTIVITY',
      icon: <IconSymbol name="figure.run" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => { closeSheet(); router.push('/entry/log-activity'); },
    },
    {
      label: 'LOG WATER',
      icon: <IconSymbol name="drop.fill" size={ICON_SIZE} color={colors.textPrimary} />,
      onPress: () => {
        closeSheet();
        setTimeout(() => setWaterLogVisible(true), 300);
      },
    },
  ];

  const SECTIONS: { title: string; items: GridItem[] }[] = [
    { title: 'FOOD', items: FOOD_ITEMS },
    { title: 'LOG', items: LOG_ITEMS },
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
          <Text style={f.parsedEditHint} onPress={() => setAiParsingState('idle')} accessibilityLabel="Edit manually instead" accessibilityRole="button">Edit manually instead</Text>
        </View>
      ) : aiParsingState === 'loading' ? (
        /* Loading state */
        <View style={f.aiLoadingWrap}>
          <ActivityIndicator size="large" color={colors.orange} />
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
          <TouchableOpacity style={f.aiParseBtn} onPress={handleParseFood} activeOpacity={0.8} accessibilityLabel="Parse food with AI" accessibilityRole="button">
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

  const upgradePrompt = (
    <UpgradePrompt
      visible={upgradeVisible}
      onClose={() => setUpgradeVisible(false)}
      onUpgrade={() => { setUpgradeVisible(false); router.push('/upgrade' as any); }}
      title="Daily food log limit reached"
      description="You've logged 5 foods today on the free plan. Upgrade to Titra Pro for unlimited food logging."
      feature="food_log"
    />
  );

  if (!rendered) {
    return (
      <>
        <WaterLogSheet visible={waterLogVisible} onClose={() => setWaterLogVisible(false)} />
        <DescribeFoodSheet visible={describeVisible} onClose={() => setDescribeVisible(false)} />
        <SearchFoodSheet visible={searchVisible} onClose={() => setSearchVisible(false)} />
        {upgradePrompt}
      </>
    );
  }

  return (
    <>
    {/* Full-screen overlay positioned absolutely — does NOT block tab bar FAB */}
    <View style={s.container} pointerEvents="box-none">

      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={closeSheet} accessibilityLabel="Close add entry sheet" accessibilityRole="button" />
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
                      <TouchableOpacity onPress={handleBackFromForm} style={f.backBtn} activeOpacity={0.7} accessibilityLabel="Go back" accessibilityRole="button">
                        <IconSymbol name="chevron.left" size={22} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <Text style={s.title}>{formConfig[activeEntry].title}</Text>
                      <View style={{ width: 36 }} />
                    </View>
                    <View style={f.formBody}>
                      {formConfig[activeEntry].content}
                    </View>
                    <TouchableOpacity style={f.confirmBtn} onPress={formConfig[activeEntry].onConfirm} activeOpacity={0.8} accessibilityLabel={`Confirm ${formConfig[activeEntry].title}`} accessibilityRole="button">
                      <Text style={f.confirmText}>Confirm</Text>
                    </TouchableOpacity>
                    <View style={{ height: 8 }} />
                  </>
                ) : (
                  /* ── Sectioned view: all groups visible at once ── */
                  <>
                    {SECTIONS.map((section) => (
                      <View key={section.title} style={s.section}>
                        <Text style={s.sectionLabel}>{section.title}</Text>
                        <View style={s.sectionCard}>
                          <GlassBorder r={22} />
                          <View style={s.sectionRow}>
                            {section.items.map((item) => {
                              const tile = (
                                <TouchableOpacity style={s.gridItemBtn} activeOpacity={0.7} onPress={item.onPress} accessibilityLabel={item.label} accessibilityRole="button">
                                  <View style={s.iconCircle}>
                                    <GlassBorder r={28} />
                                    {item.icon}
                                  </View>
                                  <Text style={s.gridLabel}>{item.label.replace(' ', '\n')}</Text>
                                </TouchableOpacity>
                              );
                              return item.tourId
                                ? <TourTarget key={item.label} id={item.tourId} style={s.gridItem}>{tile}</TourTarget>
                                : <View key={item.label} style={s.gridItem}>{tile}</View>;
                            })}
                          </View>
                        </View>
                      </View>
                    ))}

                    {/* Side Effects — full-width row */}
                    {onTreatment && (
                      <TouchableOpacity style={s.aiRow} activeOpacity={0.8} onPress={() => { closeSheet(); router.push('/entry/side-effects'); }} accessibilityLabel="Log side effects" accessibilityRole="button">
                        <GlassBorder r={22} />
                        <View style={s.aiRowIcon}>
                          <IconSymbol name="exclamationmark.triangle.fill" size={20} color={colors.textPrimary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.aiRowTitle}>Side Effects</Text>
                          <Text style={s.aiRowSubtitle}>Track how your medication feels</Text>
                        </View>
                        <IconSymbol name="chevron.right" size={18} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
                      </TouchableOpacity>
                    )}

                    {/* Ask AI — full-width row that opens the chat */}
                    <TourTarget id={TOUR_IDS.entryAskAi}>
                      <TouchableOpacity style={s.aiRow} activeOpacity={0.8} onPress={handleAskAI} accessibilityLabel="Ask AI" accessibilityRole="button">
                        <GlassBorder r={22} />
                        <View style={s.aiRowIcon}>
                          <IconSymbol name="bubble.left.fill" size={20} color={colors.textPrimary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.aiRowTitle}>Ask AI</Text>
                          <Text style={s.aiRowSubtitle}>Your GLP-1 coach, ask anything</Text>
                        </View>
                        <IconSymbol name="chevron.right" size={18} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'} />
                      </TouchableOpacity>
                    </TourTarget>
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
    <DescribeFoodSheet visible={describeVisible} onClose={() => setDescribeVisible(false)} />
    <SearchFoodSheet visible={searchVisible} onClose={() => setSearchVisible(false)} />
    {upgradePrompt}
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
    fontSize: 19,
    fontWeight: '600',
    color: c.textPrimary,
    fontFamily: 'System',
  },
  unit: {
    fontSize: 17,
    fontWeight: '700',
    color: w(0.35),
    minWidth: 32,
    fontFamily: 'System',
  },
  confirmBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FF742A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    fontFamily: 'System',
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
    fontSize: 17,
    fontWeight: '700',
    color: '#FF742A',
    fontFamily: 'System',
  },

  // AI loading
  aiLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 14,
  },
  aiLoadingText: {
    fontSize: 16,
    color: w(0.45),
    fontWeight: '500',
    fontFamily: 'System',
  },
  aiErrorText: {
    fontSize: 15,
    color: '#F39C12',
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 19,
    fontFamily: 'System',
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
    fontSize: 20,
    fontWeight: '800',
    color: c.textPrimary,
    marginBottom: 2,
    fontFamily: 'System',
  },
  parsedServing: {
    fontSize: 14,
    color: w(0.40),
    marginBottom: 14,
    fontFamily: 'System',
  },
  parsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  parsedStat: { alignItems: 'center' },
  parsedStatVal: {
    fontSize: 18,
    fontWeight: '800',
    color: c.textPrimary,
    fontFamily: 'System',
  },
  parsedStatLabel: {
    fontSize: 12,
    color: w(0.40),
    fontWeight: '500',
    fontFamily: 'System',
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'System',
  },
  parsedEditHint: {
    fontSize: 14,
    color: w(0.30),
    fontFamily: 'System',
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
    fontSize: 13,
    color: w(0.30),
    fontWeight: '500',
    fontFamily: 'System',
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
  title: { fontSize: 24, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.5, marginBottom: 4, fontFamily: 'System' },
  subtitle: { fontSize: 16, color: w(0.35), fontWeight: '400', marginBottom: 18, fontFamily: 'System' },

  // Section cards (all groups visible at once)
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: w(0.4), letterSpacing: 1.2, marginBottom: 8, marginLeft: 4, fontFamily: 'System' },
  sectionCard: { borderRadius: 22, backgroundColor: w(0.05), overflow: 'hidden', paddingVertical: 18, paddingHorizontal: 6 },
  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', rowGap: 18 },

  // Grid items inside a section card
  gridItem: { width: '25%', alignItems: 'center' },
  gridItemBtn: { width: '100%', alignItems: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.borderSubtle, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  gridLabel: { fontSize: 11, fontWeight: '700', color: c.textPrimary, letterSpacing: 0.3, lineHeight: 14, textAlign: 'center', fontFamily: 'System' },

  // Ask AI row
  aiRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 22, backgroundColor: w(0.05), overflow: 'hidden', paddingVertical: 14, paddingHorizontal: 16, gap: 14, marginTop: 10 },
  aiRowIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.borderSubtle, alignItems: 'center', justifyContent: 'center' },
  aiRowTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: 'System' },
  aiRowSubtitle: { fontSize: 13, color: w(0.4), fontFamily: 'System', marginTop: 1 },

  });
};
