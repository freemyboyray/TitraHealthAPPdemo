import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing, Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import {
  useLogStore,
  type FoodLog, type ActivityLog, type InjectionLog, type WeightLog, type SideEffectLog,
  type MealType,
} from '@/stores/log-store';
import { GradientBackground } from '@/components/ui/gradient-background';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { localDateStr } from '@/lib/date-utils';
import { ORANGE } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { ChevronLeft, Frown, Syringe, Trash2, X } from 'lucide-react-native';
import { LucideIconByName } from '@/lib/lucide-icon-map';

const FF = 'System';

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtDateOnly(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSectionDate(dateStr: string): string {
  const today = localDateStr();
  if (dateStr === today) return 'Today';
  const yesterday = localDateStr(new Date(Date.now() - 86400000));
  if (dateStr === yesterday) return 'Yesterday';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ─── Log entry type ──────────────────────────────────────────────────────────

type Status = 'positive' | 'negative' | 'neutral';

type FilterType = 'all' | 'food' | 'activity' | 'weight' | 'medication' | 'side_effect';

// Insights tab → categories it scopes to. Mirrors TAB_LOG_KINDS in app/(tabs)/log.tsx.
type ScopeTab = 'medication' | 'lifestyle' | 'progress';
const TAB_KINDS: Record<ScopeTab, FilterType[]> = {
  medication: ['medication', 'side_effect'],
  lifestyle: ['food', 'activity'],
  progress: ['weight'],
};
const TAB_TITLES: Record<ScopeTab, string> = {
  medication: 'Medication History',
  lifestyle: 'Lifestyle History',
  progress: 'Progress History',
};

// Single-category deep links (e.g. the Symptom Log card → side effects only).
const FILTER_TYPES: FilterType[] = ['food', 'activity', 'weight', 'medication', 'side_effect'];
const FILTER_TITLES: Record<FilterType, string> = {
  all: 'All Logs',
  food: 'Food History',
  activity: 'Activity History',
  weight: 'Weight History',
  medication: 'Dose History',
  side_effect: 'Symptom History',
};

type LogEntry = {
  id: string;
  timestamp: string;
  rawDate: string;
  title: string;
  details: string;
  impact: string;
  impactStatus: Status;
  icon: React.ReactElement;
  logType: FilterType;
};

// ─── Converters ──────────────────────────────────────────────────────────────

function foodToEntry(f: FoodLog): LogEntry {
  const details = `${Math.round(f.calories)} cal · ${Math.round(f.protein_g)}g protein · ${Math.round(f.fiber_g)}g fiber`;
  return {
    id: f.id, timestamp: fmtDateTime(f.logged_at), rawDate: localDateStr(new Date(f.logged_at)),
    title: f.food_name, details,
    impact: `+${Math.round(f.protein_g)}g protein`, impactStatus: 'positive',
    icon: <IconSymbol name="fork.knife" size={20} color={ORANGE} />,
    logType: 'food',
  };
}

function activityIcon(type: string | null) {
  let name: string = 'Activity';
  const t = (type ?? '').toLowerCase();
  if (t.includes('walk') || t.includes('step')) name = 'Footprints';
  else if (t.includes('cycl') || t.includes('bike')) name = 'Bike';
  else if (t.includes('swim')) name = 'Waves';
  else if (t.includes('yoga')) name = 'Brain';
  else if (t.includes('strength') || t.includes('weight') || t.includes('lift')) name = 'Dumbbell';
  else if (t.includes('hike')) name = 'Mountain';
  return <LucideIconByName name={name} size={20} color={ORANGE} />;
}

function activityToEntry(a: ActivityLog): LogEntry {
  const parts = [
    a.duration_min ? `${a.duration_min} min` : '',
    a.steps ? `${a.steps.toLocaleString()} steps` : '',
    a.active_calories ? `${a.active_calories} cal burned` : '',
  ].filter(Boolean);
  return {
    id: a.id, timestamp: fmtDateOnly(a.date), rawDate: a.date,
    title: a.exercise_type ?? 'Activity', details: parts.join(' · ') || 'Activity logged',
    impact: a.steps ? `+${a.steps.toLocaleString()} steps` : 'Logged', impactStatus: 'positive',
    icon: activityIcon(a.exercise_type),
    logType: 'activity',
  };
}

function injectionToEntry(inj: InjectionLog): LogEntry {
  const medName = inj.medication_name ?? 'Injection';
  const siteStr = inj.site ? `Site: ${inj.site} · ` : '';
  return {
    id: inj.id, timestamp: fmtDateOnly(inj.injection_date), rawDate: inj.injection_date,
    title: `${medName} ${inj.dose_mg}mg`, details: `${siteStr}Dose: ${inj.dose_mg}mg`,
    impact: 'Dose logged', impactStatus: 'neutral',
    icon: <Syringe size={18} color={ORANGE} />,
    logType: 'medication',
  };
}

function weightToEntry(log: WeightLog, prevLog?: WeightLog): LogEntry {
  const delta = prevLog ? Math.round((log.weight_lbs - prevLog.weight_lbs) * 10) / 10 : 0;
  const deltaStr = delta < 0 ? `Down ${Math.abs(delta)} lbs` : delta > 0 ? `Up ${delta} lbs` : 'Steady';
  return {
    id: log.id, timestamp: fmtDateTime(log.logged_at), rawDate: localDateStr(new Date(log.logged_at)),
    title: `Weight - ${log.weight_lbs} lbs`, details: `${log.weight_lbs} lbs · ${deltaStr}`,
    impact: delta <= 0 ? deltaStr : `Up ${Math.abs(delta)} lbs`,
    impactStatus: delta < 0 ? 'positive' : delta > 0 ? 'negative' : 'neutral',
    icon: <IconSymbol name="scalemass.fill" size={20} color={ORANGE} />,
    logType: 'weight',
  };
}

function sideEffectToEntry(se: SideEffectLog): LogEntry {
  const label = se.effect_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const sevLabel = se.severity <= 3 ? 'Mild' : se.severity <= 6 ? 'Moderate' : 'Severe';
  return {
    id: se.id, timestamp: fmtDateTime(se.logged_at), rawDate: localDateStr(new Date(se.logged_at)),
    title: label, details: `Severity: ${se.severity}/10${se.notes ? ` · ${se.notes}` : ''}`,
    impact: sevLabel, impactStatus: se.severity <= 3 ? 'neutral' : 'negative',
    icon: <Frown size={20} color={ORANGE} />,
    logType: 'side_effect',
  };
}

// ─── Edit Modal ─────────────────────────────────────────────────────────────

type EditState = {
  id: string;
  logType: FilterType;
  fields: Record<string, string>;
} | null;

function EditField({ label, value, onChangeText, keyboardType, colors }: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad'; colors: AppColors;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 4, fontFamily: FF }}>{label}</Text>
      <TextInput
        style={{
          height: 44, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 10,
          paddingHorizontal: 12, fontSize: 16, color: colors.textPrimary, backgroundColor: colors.surface, fontFamily: FF,
        }}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function EditModal({ editState, onSave, onClose, colors }: {
  editState: EditState; onSave: (id: string, logType: FilterType, fields: Record<string, string>) => void;
  onClose: () => void; colors: AppColors;
}) {
  const [fields, setFields] = useState<Record<string, string>>(editState?.fields ?? {});

  const updateField = (key: string, val: string) => setFields(prev => ({ ...prev, [key]: val }));

  if (!editState) return null;

  const renderFields = () => {
    switch (editState.logType) {
      case 'food':
        return (
          <>
            <EditField label="Food Name" value={fields.food_name ?? ''} onChangeText={v => updateField('food_name', v)} colors={colors} />
            <EditField label="Calories" value={fields.calories ?? ''} onChangeText={v => updateField('calories', v)} keyboardType="numeric" colors={colors} />
            <EditField label="Protein (g)" value={fields.protein_g ?? ''} onChangeText={v => updateField('protein_g', v)} keyboardType="decimal-pad" colors={colors} />
            <EditField label="Carbs (g)" value={fields.carbs_g ?? ''} onChangeText={v => updateField('carbs_g', v)} keyboardType="decimal-pad" colors={colors} />
            <EditField label="Fat (g)" value={fields.fat_g ?? ''} onChangeText={v => updateField('fat_g', v)} keyboardType="decimal-pad" colors={colors} />
            <EditField label="Fiber (g)" value={fields.fiber_g ?? ''} onChangeText={v => updateField('fiber_g', v)} keyboardType="decimal-pad" colors={colors} />
          </>
        );
      case 'weight':
        return (
          <EditField label="Weight (lbs)" value={fields.weight_lbs ?? ''} onChangeText={v => updateField('weight_lbs', v)} keyboardType="decimal-pad" colors={colors} />
        );
      case 'medication':
        return (
          <>
            <EditField label="Dose (mg)" value={fields.dose_mg ?? ''} onChangeText={v => updateField('dose_mg', v)} keyboardType="decimal-pad" colors={colors} />
            <EditField label="Site" value={fields.site ?? ''} onChangeText={v => updateField('site', v)} colors={colors} />
            <EditField label="Notes" value={fields.notes ?? ''} onChangeText={v => updateField('notes', v)} colors={colors} />
          </>
        );
      case 'activity':
        return (
          <>
            <EditField label="Exercise Type" value={fields.exercise_type ?? ''} onChangeText={v => updateField('exercise_type', v)} colors={colors} />
            <EditField label="Duration (min)" value={fields.duration_min ?? ''} onChangeText={v => updateField('duration_min', v)} keyboardType="numeric" colors={colors} />
            <EditField label="Steps" value={fields.steps ?? ''} onChangeText={v => updateField('steps', v)} keyboardType="numeric" colors={colors} />
            <EditField label="Calories Burned" value={fields.active_calories ?? ''} onChangeText={v => updateField('active_calories', v)} keyboardType="numeric" colors={colors} />
          </>
        );
      case 'side_effect':
        return (
          <>
            <EditField label="Severity (1-10)" value={fields.severity ?? ''} onChangeText={v => updateField('severity', v)} keyboardType="numeric" colors={colors} />
            <EditField label="Notes" value={fields.notes ?? ''} onChangeText={v => updateField('notes', v)} colors={colors} />
          </>
        );
      default:
        return null;
    }
  };

  const typeLabel = editState.logType === 'medication' ? 'Dose' : editState.logType === 'side_effect' ? 'Side Effect'
    : editState.logType.charAt(0).toUpperCase() + editState.logType.slice(1);

  return (
    <Modal visible transparent animationType="slide">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={onClose} />
        <View style={{
          backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
          paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, maxHeight: '80%',
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>Edit {typeLabel}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderFields()}
          </ScrollView>
          <TouchableOpacity
            style={{
              backgroundColor: ORANGE, borderRadius: 14, height: 50,
              alignItems: 'center', justifyContent: 'center', marginTop: 16,
            }}
            onPress={() => onSave(editState.id, editState.logType, fields)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFF', fontFamily: FF }}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Detail overlay (tap a log → blurred-backdrop card, reversible animation) ──

type Detail =
  | { kind: 'food'; food: FoodLog }
  | { kind: 'activity'; activity: ActivityLog };

// Gram-unit macros that share an axis, so they read as one bar graph. `core` ones
// always show (even at 0); the rest only when actually recorded.
const FOOD_BARS: { key: keyof FoodLog; label: string; color: string; core?: boolean }[] = [
  { key: 'protein_g', label: 'Protein', color: '#FF742A', core: true },
  { key: 'carbs_g',   label: 'Carbs',   color: '#5B9BD5', core: true },
  { key: 'fat_g',     label: 'Fat',     color: '#F5C542', core: true },
  { key: 'fiber_g',   label: 'Fiber',   color: '#2B9450' },
  { key: 'sugar_g',   label: 'Sugar',   color: '#C77DD6' },
];

// Everything else food_logs collects — shown as a list, only when present.
const FOOD_DETAILS: { key: keyof FoodLog; label: string; unit: string }[] = [
  { key: 'added_sugars_g',         label: 'Added Sugars',        unit: 'g' },
  { key: 'saturated_fat_g',        label: 'Saturated Fat',       unit: 'g' },
  { key: 'trans_fat_g',            label: 'Trans Fat',           unit: 'g' },
  { key: 'monounsaturated_fat_g',  label: 'Monounsaturated Fat', unit: 'g' },
  { key: 'polyunsaturated_fat_g',  label: 'Polyunsaturated Fat', unit: 'g' },
  { key: 'cholesterol_mg',         label: 'Cholesterol',         unit: 'mg' },
  { key: 'sodium_mg',              label: 'Sodium',              unit: 'mg' },
  { key: 'potassium_mg',           label: 'Potassium',           unit: 'mg' },
  { key: 'calcium_mg',             label: 'Calcium',             unit: 'mg' },
  { key: 'iron_mg',                label: 'Iron',                unit: 'mg' },
  { key: 'hydration_ml',           label: 'Hydration',           unit: 'ml' },
];

const BAR_MAX_H = 130;

function num(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

function DetailRow({ label, value, colors }: { label: string; value: string; colors: AppColors }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
      <Text style={{ fontSize: 14, color: colors.textMuted, fontFamily: FF }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontFamily: FF }}>{value}</Text>
    </View>
  );
}

function FoodBody({ food, colors }: { food: FoodLog; colors: AppColors }) {
  const bars = FOOD_BARS
    .map(b => ({ ...b, value: num(food[b.key]) }))
    .filter(b => b.core || (b.value != null && b.value > 0))
    .map(b => ({ ...b, value: Math.round(b.value ?? 0) }));
  const maxVal = Math.max(1, ...bars.map(b => b.value));

  const details = FOOD_DETAILS
    .map(d => ({ ...d, value: num(food[d.key]) }))
    .filter(d => d.value != null && d.value > 0);

  return (
    <>
      {/* Macro bar graph */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: BAR_MAX_H + 44 }}>
        {bars.map(b => {
          const h = Math.max(4, (b.value / maxVal) * BAR_MAX_H);
          return (
            <View key={b.key} style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary, fontFamily: FF, marginBottom: 6 }}>{b.value}g</Text>
              <View style={{ width: 34, height: h, borderRadius: 10, backgroundColor: b.color }} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted, fontFamily: FF, marginTop: 8 }}>{b.label}</Text>
            </View>
          );
        })}
      </View>

      {details.length > 0 && (
        <View style={{ marginTop: 18 }}>
          {details.map(d => (
            <DetailRow key={d.key} label={d.label} value={`${Math.round(d.value!)}${d.unit}`} colors={colors} />
          ))}
        </View>
      )}
    </>
  );
}

function ActivityBody({ activity, colors }: { activity: ActivityLog; colors: AppColors }) {
  const rows: { label: string; value: string }[] = [];
  if (activity.duration_min)    rows.push({ label: 'Duration',         value: `${activity.duration_min} min` });
  if (activity.steps)           rows.push({ label: 'Steps',            value: activity.steps.toLocaleString() });
  if (activity.active_calories) rows.push({ label: 'Calories Burned',  value: `${activity.active_calories} cal` });
  if (activity.exercise_minutes) rows.push({ label: 'Exercise Minutes', value: `${activity.exercise_minutes} min` });
  if (activity.intensity)       rows.push({ label: 'Intensity',        value: activity.intensity });

  if (rows.length === 0) {
    return <Text style={{ fontSize: 14, color: colors.textMuted, fontFamily: FF, paddingVertical: 8 }}>No details recorded.</Text>;
  }
  return (
    <View>
      {rows.map(r => <DetailRow key={r.label} label={r.label} value={r.value} colors={colors} />)}
    </View>
  );
}

function DetailModal({ detail, onClose, colors }: {
  detail: Detail | null; onClose: () => void; colors: AppColors;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (detail) progress.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [detail, progress]);

  const close = useCallback(() => {
    progress.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [onClose, progress]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.9, 1], Extrapolation.CLAMP) }],
  }));

  if (!detail) return null;

  const isFood = detail.kind === 'food';
  const title = isFood ? detail.food.food_name : (detail.activity.exercise_type ?? 'Activity');
  const subtitle = isFood
    ? `${fmtDateTime(detail.food.logged_at)} · ${Math.round(detail.food.calories)} cal`
    : fmtDateOnly(detail.activity.date);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
        <BlurView intensity={colors.isDark ? 40 : 28} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.12)' }]} />
      </Animated.View>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close" />

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }} pointerEvents="box-none">
        <Animated.View
          style={[cardStyle, {
            backgroundColor: colors.surface, borderRadius: 24, maxHeight: '82%',
            borderWidth: 0.5, borderColor: colors.border,
            shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 28, elevation: 8,
          }]}
        >
          <View style={{ padding: 24, paddingBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
              <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colors.textPrimary, fontFamily: FF, letterSpacing: -0.3 }}>
                {title}
              </Text>
              <TouchableOpacity onPress={close} hitSlop={12} style={{ marginLeft: 12 }}>
                <X size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: FF }}>{subtitle}</Text>
          </View>

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {isFood
              ? <FoodBody food={detail.food} colors={colors} />
              : <ActivityBody activity={detail.activity} colors={colors} />}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function LogHistoryScreen() {
  const router = useRouter();
  const { tab, filter } = useLocalSearchParams<{ tab?: string; filter?: string }>();
  const scopeTab = tab && tab in TAB_KINDS ? (tab as ScopeTab) : null;
  // A `filter` param scopes to a single category; otherwise fall back to the tab scope.
  const singleFilter = filter && FILTER_TYPES.includes(filter as FilterType) ? (filter as FilterType) : null;
  const scopeKinds = singleFilter ? [singleFilter] : scopeTab ? TAB_KINDS[scopeTab] : null;
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const store = useLogStore();
  const { refreshActuals } = useHealthData();
  const { foodLogs, activityLogs, weightLogs, injectionLogs, sideEffectLogs } = store;
  const [visibleDays, setVisibleDays] = useState(5);
  const [editState, setEditState] = useState<EditState>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  const allEntries = useMemo(() => {
    const entries: LogEntry[] = [
      ...foodLogs.map(foodToEntry),
      ...activityLogs.map(activityToEntry),
      ...weightLogs.map((log, i) => weightToEntry(log, weightLogs[i + 1])),
      ...injectionLogs.map(injectionToEntry),
      ...sideEffectLogs.map(sideEffectToEntry),
    ];
    const scoped = scopeKinds ? entries.filter(e => scopeKinds.includes(e.logType)) : entries;
    return scoped.sort((a, b) => b.rawDate.localeCompare(a.rawDate) || b.timestamp.localeCompare(a.timestamp));
  }, [foodLogs, activityLogs, weightLogs, injectionLogs, sideEffectLogs, scopeKinds]);

  const sections = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const e of allEntries) {
      const list = map.get(e.rawDate) ?? [];
      list.push(e);
      map.set(e.rawDate, list);
    }
    return Array.from(map.entries()).map(([date, data]) => ({
      title: formatSectionDate(date),
      data,
    }));
  }, [allEntries]);

  // Paginate by day: show the most recent N days, "Load More" reveals 5 more.
  const visibleSections = sections.slice(0, visibleDays);
  const hasMore = sections.length > visibleDays;

  const getEditFields = useCallback((id: string, logType: FilterType): Record<string, string> => {
    switch (logType) {
      case 'food': {
        const f = foodLogs.find(l => l.id === id);
        return f ? {
          food_name: f.food_name, calories: String(Math.round(f.calories)),
          protein_g: String(f.protein_g), carbs_g: String(f.carbs_g),
          fat_g: String(f.fat_g), fiber_g: String(f.fiber_g),
        } : {};
      }
      case 'weight': {
        const w = weightLogs.find(l => l.id === id);
        return w ? { weight_lbs: String(w.weight_lbs) } : {};
      }
      case 'medication': {
        const inj = injectionLogs.find(l => l.id === id);
        return inj ? {
          dose_mg: String(inj.dose_mg), site: inj.site ?? '', notes: inj.notes ?? '',
        } : {};
      }
      case 'activity': {
        const a = activityLogs.find(l => l.id === id);
        return a ? {
          exercise_type: a.exercise_type ?? '', duration_min: String(a.duration_min ?? ''),
          steps: String(a.steps ?? ''), active_calories: String(a.active_calories ?? ''),
        } : {};
      }
      case 'side_effect': {
        const se = sideEffectLogs.find(l => l.id === id);
        return se ? { severity: String(se.severity), notes: se.notes ?? '' } : {};
      }
      default: return {};
    }
  }, [foodLogs, weightLogs, injectionLogs, activityLogs, sideEffectLogs]);

  const handleDelete = useCallback((id: string, logType: FilterType, title: string) => {
    Alert.alert('Delete Entry', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          switch (logType) {
            case 'food': await store.deleteFoodLog(id); break;
            case 'weight': await store.deleteWeightLog(id); break;
            case 'medication': await store.deleteInjectionLog(id); break;
            case 'activity': await store.deleteActivityLog(id); break;
            case 'side_effect': await store.deleteSideEffectLog(id); break;
          }
          // Re-derive daily actuals (protein/water/etc.) so a deleted beverage's
          // hydration drops from the water total immediately.
          if (logType === 'food') refreshActuals();
        },
      },
    ]);
  }, [store, refreshActuals]);

  const handleSaveEdit = useCallback(async (id: string, logType: FilterType, fields: Record<string, string>) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    switch (logType) {
      case 'food':
        await store.updateFoodLog(id, {
          food_name: fields.food_name,
          calories: parseFloat(fields.calories) || 0,
          protein_g: parseFloat(fields.protein_g) || 0,
          carbs_g: parseFloat(fields.carbs_g) || 0,
          fat_g: parseFloat(fields.fat_g) || 0,
          fiber_g: parseFloat(fields.fiber_g) || 0,
        });
        break;
      case 'weight':
        await store.updateWeightLog(id, { weight_lbs: parseFloat(fields.weight_lbs) || 0 });
        break;
      case 'medication':
        await store.updateInjectionLog(id, {
          dose_mg: parseFloat(fields.dose_mg) || 0,
          site: fields.site || null,
          notes: fields.notes || null,
        });
        break;
      case 'activity':
        await store.updateActivityLog(id, {
          exercise_type: fields.exercise_type,
          duration_min: parseInt(fields.duration_min) || 0,
          steps: parseInt(fields.steps) || 0,
          active_calories: parseInt(fields.active_calories) || 0,
        });
        break;
      case 'side_effect':
        await store.updateSideEffectLog(id, {
          severity: Math.min(10, Math.max(1, parseInt(fields.severity) || 1)),
          notes: fields.notes || null,
        });
        break;
    }
    setEditState(null);
  }, [store]);

  // Tapping a meal or activity opens its breakdown over a blurred backdrop.
  const handlePress = useCallback((item: LogEntry) => {
    if (item.logType === 'food') {
      const f = foodLogs.find(l => l.id === item.id);
      if (f) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDetail({ kind: 'food', food: f }); }
    } else if (item.logType === 'activity') {
      const a = activityLogs.find(l => l.id === item.id);
      if (a) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDetail({ kind: 'activity', activity: a }); }
    }
  }, [foodLogs, activityLogs]);

  const handleLongPress = useCallback((item: LogEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const edit = () => setEditState({ id: item.id, logType: item.logType, fields: getEditFields(item.id, item.logType) });
    const del = () => handleDelete(item.id, item.logType, item.title);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Edit', 'Delete', 'Cancel'], destructiveButtonIndex: 1, cancelButtonIndex: 2, title: item.title },
        (i) => { if (i === 0) edit(); else if (i === 1) del(); },
      );
    } else {
      Alert.alert(item.title, undefined, [
        { text: 'Edit', onPress: edit },
        { text: 'Delete', style: 'destructive', onPress: del },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [getEditFields, handleDelete]);

  return (
    <View style={s.root}>
      <GradientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <ChevronLeft size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={s.headerTitle} numberOfLines={1}>
            {singleFilter ? FILTER_TITLES[singleFilter] : scopeTab ? TAB_TITLES[scopeTab] : 'All Logs'}
          </Text>
          <View style={{ width: 26 }} />
        </View>

        <SectionList
          sections={visibleSections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={s.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              onLongPress={() => handleLongPress(item)}
              delayLongPress={400}
              style={({ pressed }) => [s.entryCard, pressed && { opacity: 0.7 }]}
            >
              <View style={s.entryRow}>
                <View style={s.entryIconWrap}>{item.icon}</View>
                <View style={{ flex: 1 }}>
                  {/* Title + date/time together at the top */}
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <Text style={s.entryTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={s.entryTime}>{item.timestamp}</Text>
                  </View>
                  <Text style={s.entryDetails} numberOfLines={2}>{item.details}</Text>
                </View>
                <Pressable
                  onPress={() => handleDelete(item.id, item.logType, item.title)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.title}`}
                  style={({ pressed }) => [s.entryDeleteBtn, pressed && { opacity: 0.5 }]}
                >
                  <Trash2 size={17} color={colors.textMuted} />
                </Pressable>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 16, fontFamily: FF }}>No logs found</Text>
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={s.loadMoreBtn}
                onPress={() => setVisibleDays(d => d + 5)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Load more days"
              >
                <Text style={s.loadMoreText}>Load More</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </SafeAreaView>

      {editState && (
        <EditModal
          editState={editState}
          onSave={handleSaveEdit}
          onClose={() => setEditState(null)}
          colors={colors}
        />
      )}

      <DetailModal detail={detail} onClose={() => setDetail(null)} colors={colors} />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const muted = c.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 0, paddingBottom: 12, marginTop: -24,
    },
    headerTitle: {
      flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700',
      color: c.textPrimary, fontFamily: FF,
    },
    loadMoreBtn: {
      marginTop: 20, alignSelf: 'center',
      paddingHorizontal: 28, paddingVertical: 12, borderRadius: 22,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    },
    loadMoreText: { fontSize: 15, fontWeight: '600', color: c.orange, fontFamily: FF },
    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    sectionHeader: {
      fontSize: 15, fontWeight: '700', color: c.textPrimary,
      paddingTop: 20, paddingBottom: 8, fontFamily: FF,
    },
    entryCard: {
      backgroundColor: c.surface, borderRadius: 16,
      marginBottom: 1, paddingHorizontal: 16, paddingVertical: 12,
      borderWidth: 0.5, borderColor: c.border,
    },
    entryRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    entryDeleteBtn: { padding: 6, alignSelf: 'center' },
    entryIconWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center', justifyContent: 'center',
    },
    entryTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: c.textPrimary, fontFamily: FF },
    entryTime: { fontSize: 12, color: muted, fontFamily: FF, marginTop: 1 },
    entryDetails: { fontSize: 13, color: muted, marginTop: 4, fontFamily: FF },
  });
};
