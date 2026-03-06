import { FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';

const ORANGE = '#FF742A';
const DARK = '#FFFFFF';
const ICON_SIZE = 24;
const ICON_COLOR = '#FFFFFF';

type EntryType = 'weight' | 'water' | 'activity' | 'food' | null;

// ─── Sheet ────────────────────────────────────────────────────────────────────

export function AddEntrySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { dispatch, profile } = useHealthData();
  const { addWeightLog, addInjectionLog, addActivityLog, addFoodLog } = useLogStore();

  const [activeEntry, setActiveEntry] = useState<EntryType>(null);
  const [weightInput, setWeightInput] = useState('');
  const [waterInput, setWaterInput] = useState('');
  const [activityType, setActivityType] = useState('');
  const [activityDuration, setActivityDuration] = useState('');
  const [foodName, setFoodName] = useState('');
  const [foodCalories, setFoodCalories] = useState('');
  const [foodProtein, setFoodProtein] = useState('');

  const isMetric = profile?.unitSystem === 'metric';

  const closeSheet = () => {
    setActiveEntry(null);
    onClose();
  };

  const resetForm = () => {
    setWeightInput('');
    setWaterInput('');
    setActivityType('');
    setActivityDuration('');
    setFoodName('');
    setFoodCalories('');
    setFoodProtein('');
  };

  const handleBackFromForm = () => {
    resetForm();
    setActiveEntry(null);
  };

  // ─── Action handlers ────────────────────────────────────────────────────────

  const handleAskAI = () => {
    closeSheet();
    setTimeout(() => router.push('/ai-chat'), 300);
  };

  const handleLogInjection = () => {
    dispatch({ type: 'LOG_INJECTION' });
    const today = new Date().toISOString().split('T')[0];
    addInjectionLog(profile.doseMg, today);
    closeSheet();
  };

  const handleConfirmWeight = () => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0) return;
    const lbs = isMetric ? val * 2.20462 : val;
    addWeightLog(lbs);
    resetForm();
    closeSheet();
  };

  const handleConfirmWater = () => {
    const val = parseFloat(waterInput);
    if (isNaN(val) || val <= 0) return;
    const ml = isMetric ? val : val * 29.5735;
    dispatch({ type: 'LOG_WATER', ml: Math.round(ml) });
    resetForm();
    closeSheet();
  };

  const handleConfirmActivity = () => {
    const minutes = parseInt(activityDuration, 10);
    if (!activityType.trim() || isNaN(minutes) || minutes <= 0) return;
    addActivityLog(activityType.trim(), minutes, 'moderate');
    const steps = Math.round(minutes * 90);
    dispatch({ type: 'LOG_STEPS', steps });
    resetForm();
    closeSheet();
  };

  const handleConfirmFood = () => {
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

  const GRID = [
    {
      label: 'DESCRIBE FOOD',
      icon: <MaterialIcons name="restaurant" size={ICON_SIZE} color={ICON_COLOR} />,
      onPress: () => setActiveEntry('food'),
    },
    {
      label: 'LOG INJECTION',
      icon: <FontAwesome5 name="syringe" size={ICON_SIZE} color={ICON_COLOR} />,
      onPress: handleLogInjection,
    },
    {
      label: 'CAPTURE FOOD',
      icon: <Ionicons name="camera-outline" size={ICON_SIZE} color={ICON_COLOR} />,
      onPress: () => { closeSheet(); router.push('/entry/capture-food' as any); },
    },
    {
      label: 'SCAN FOOD',
      icon: <Ionicons name="barcode-outline" size={ICON_SIZE} color={ICON_COLOR} />,
      onPress: () => { closeSheet(); router.push('/entry/scan-food' as any); },
    },
    {
      label: 'ASK AI',
      special: true,
      icon: null,
      onPress: handleAskAI,
    },
    {
      label: 'SEARCH FOOD',
      icon: <Ionicons name="search-outline" size={ICON_SIZE} color={ICON_COLOR} />,
      onPress: () => { closeSheet(); router.push('/entry/search-food' as any); },
    },
    {
      label: 'LOG WEIGHT',
      icon: <MaterialCommunityIcons name="scale-bathroom" size={ICON_SIZE} color={ICON_COLOR} />,
      onPress: () => setActiveEntry('weight'),
    },
    {
      label: 'LOG WATER',
      icon: <Ionicons name="water-outline" size={ICON_SIZE} color={ICON_COLOR} />,
      onPress: () => setActiveEntry('water'),
    },
    {
      label: 'LOG ACTIVITY',
      icon: <MaterialIcons name="directions-run" size={ICON_SIZE} color={ICON_COLOR} />,
      onPress: () => setActiveEntry('activity'),
    },
  ];

  // ─── Inline form config ──────────────────────────────────────────────────────

  const formConfig: Record<NonNullable<EntryType>, {
    title: string;
    onConfirm: () => void;
    content: React.ReactNode;
  }> = {
    weight: {
      title: 'Log Weight',
      onConfirm: handleConfirmWeight,
      content: (
        <View style={f.fieldRow}>
          <TextInput
            style={f.input}
            value={weightInput}
            onChangeText={setWeightInput}
            placeholder={isMetric ? 'e.g. 88.5' : 'e.g. 195'}
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="decimal-pad"
            autoFocus
          />
          <Text style={f.unit}>{isMetric ? 'kg' : 'lbs'}</Text>
        </View>
      ),
    },
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
            placeholderTextColor="rgba(255,255,255,0.25)"
            keyboardType="decimal-pad"
            autoFocus
          />
          <Text style={f.unit}>{isMetric ? 'ml' : 'oz'}</Text>
        </View>
      ),
    },
    activity: {
      title: 'Log Activity',
      onConfirm: handleConfirmActivity,
      content: (
        <>
          <TextInput
            style={[f.input, { marginBottom: 10 }]}
            value={activityType}
            onChangeText={setActivityType}
            placeholder="Exercise type (e.g. Walking)"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoFocus
          />
          <View style={f.fieldRow}>
            <TextInput
              style={f.input}
              value={activityDuration}
              onChangeText={setActivityDuration}
              placeholder="30"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="number-pad"
            />
            <Text style={f.unit}>min</Text>
          </View>
        </>
      ),
    },
    food: {
      title: 'Describe Food',
      onConfirm: handleConfirmFood,
      content: (
        <>
          <TextInput
            style={[f.input, { marginBottom: 10 }]}
            value={foodName}
            onChangeText={setFoodName}
            placeholder="Food name (e.g. Greek Yogurt)"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoFocus
          />
          <View style={f.fieldRow}>
            <TextInput
              style={f.input}
              value={foodCalories}
              onChangeText={setFoodCalories}
              placeholder="Calories"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="number-pad"
            />
            <TextInput
              style={[f.input, { marginLeft: 8 }]}
              value={foodProtein}
              onChangeText={setFoodProtein}
              placeholder="Protein g"
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType="decimal-pad"
            />
          </View>
        </>
      ),
    },
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeSheet}>
      <View style={s.container}>

        {/* Backdrop */}
        <Pressable style={s.backdrop} onPress={closeSheet} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* Sheet — dark frosted glass */}
          <View style={s.sheetShadow}>
            <View style={[s.sheetBody, { backgroundColor: '#000000' }]}>
              <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
              <View pointerEvents="none" style={s.sheetTopBorder} />

              <View style={s.sheetContent}>
                <View style={s.handle} />

                {activeEntry ? (
                  /* ── Inline form view ── */
                  <>
                    <View style={f.header}>
                      <TouchableOpacity onPress={handleBackFromForm} style={f.backBtn} activeOpacity={0.7}>
                        <Ionicons name="chevron-back" size={22} color={DARK} />
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
                    <Text style={s.title}>Add Entry</Text>
                    <Text style={s.subtitle}>What would you like to log today?</Text>
                    <View style={s.dash} />
                    <View style={s.grid}>
                      {GRID.map((item) => (
                        <TouchableOpacity key={item.label} style={s.gridItem} activeOpacity={0.7} onPress={item.onPress}>
                          {item.special ? (
                            <View style={s.specialCircle}>
                              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
                              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 32, backgroundColor: 'rgba(255,116,42,0.85)' }]} />
                              <GlassBorder r={32} />
                              <View style={s.sphereShine} />
                              <View style={s.sphereShineSmall} />
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

          {/* Bottom nav — glass pill + FAB X */}
          <View style={[s.navWrapper, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
            <View style={s.navPillShadow}>
              <View style={s.navPillInner}>
                <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, { borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
                <View pointerEvents="none" style={s.pillBorder} />
                <View style={s.navIcons}>
                  <Ionicons name="home-outline" size={24} color="rgba(255,255,255,0.25)" style={s.navIcon} />
                  <MaterialIcons name="menu" size={26} color="rgba(255,255,255,0.25)" style={s.navIcon} />
                  <Ionicons name="document-outline" size={24} color="rgba(255,255,255,0.25)" style={s.navIcon} />
                </View>
              </View>
            </View>
            <TouchableOpacity style={s.fabClose} onPress={closeSheet} activeOpacity={0.85}>
              <View style={s.fabInner}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={[StyleSheet.absoluteFillObject, { borderRadius: 31, backgroundColor: 'rgba(255,116,42,0.92)' }]} />
                <View pointerEvents="none" style={s.fabBorder} />
                <Ionicons name="close" size={32} color="#FFF" />
              </View>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

      </View>
    </Modal>
  );
}

// ─── Form styles ───────────────────────────────────────────────────────────────

const f = StyleSheet.create({
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Helvetica Neue',
  },
  unit: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    minWidth: 32,
    fontFamily: 'Helvetica Neue',
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
    fontFamily: 'Helvetica Neue',
  },
});

// ─── Sheet styles ──────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  // Sheet
  sheetShadow: { borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.4, shadowRadius: 28, elevation: 16 },
  sheetBody: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  sheetTopBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.10)' },
  sheetContent: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 },

  handle: { width: 44, height: 4, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, alignSelf: 'center', marginBottom: 22 },
  title: { fontSize: 24, fontWeight: '800', color: DARK, letterSpacing: -0.5, marginBottom: 4, fontFamily: 'Helvetica Neue' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: '400', marginBottom: 18, fontFamily: 'Helvetica Neue' },
  dash: { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(80,130,210,0.3)', marginBottom: 22 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '33.33%', alignItems: 'center', marginBottom: 24 },

  // Icon circles
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },

  // ASK AI sphere
  specialCircle: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 6 },
  sphereShine: { position: 'absolute', top: 10, right: 12, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)' },
  sphereShineSmall: { position: 'absolute', top: 22, right: 18, width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },

  gridLabel: { fontSize: 10, fontWeight: '700', color: DARK, letterSpacing: 0.4, textAlign: 'center', fontFamily: 'Helvetica Neue' },
  gridLabelSpecial: { color: ORANGE },

  // Bottom nav
  navWrapper: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8, backgroundColor: 'transparent' },
  navPillShadow: { flex: 1, marginRight: 14, borderRadius: 36, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10 },
  navPillInner: { borderRadius: 36, overflow: 'hidden' },
  pillBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 36, borderWidth: 1, borderTopColor: 'rgba(255,255,255,0.13)', borderLeftColor: 'rgba(255,255,255,0.08)', borderRightColor: 'rgba(255,255,255,0.03)', borderBottomColor: 'rgba(255,255,255,0.02)' },
  navIcons: { flexDirection: 'row', paddingVertical: 15, paddingHorizontal: 10 },
  navIcon: { flex: 1, textAlign: 'center' },

  fabClose: { width: 62, height: 62, borderRadius: 31, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.7, shadowRadius: 16, elevation: 10, marginBottom: 2 },
  fabInner: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fabBorder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 31, borderWidth: 1.5, borderTopColor: 'rgba(255,220,185,0.40)', borderLeftColor: 'rgba(255,200,160,0.25)', borderRightColor: 'rgba(0,0,0,0.15)', borderBottomColor: 'rgba(0,0,0,0.22)' },
});
