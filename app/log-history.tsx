import React, { useCallback, useMemo, useState } from 'react';
import {
  ActionSheetIOS, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  SectionList, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/contexts/theme-context';
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
import { ChevronLeft, Frown, MoreHorizontal, Syringe, X } from 'lucide-react-native';
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

const statusStyle: Record<Status, { bg: string; text: string }> = {
  positive: { bg: 'rgba(43,148,80,0.15)', text: '#2B9450' },
  negative: { bg: 'rgba(220,50,50,0.15)', text: '#DC3232' },
  neutral: { bg: 'rgba(150,150,150,0.10)', text: '#9A9490' },
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
  if (t.includes('walk')) name = 'Footprints';
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

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function LogHistoryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const store = useLogStore();
  const { foodLogs, activityLogs, weightLogs, injectionLogs, sideEffectLogs } = store;
  const [visibleDays, setVisibleDays] = useState(5);
  const [editState, setEditState] = useState<EditState>(null);

  const allEntries = useMemo(() => {
    const entries: LogEntry[] = [
      ...foodLogs.map(foodToEntry),
      ...activityLogs.map(activityToEntry),
      ...weightLogs.map((log, i) => weightToEntry(log, weightLogs[i + 1])),
      ...injectionLogs.map(injectionToEntry),
      ...sideEffectLogs.map(sideEffectToEntry),
    ];
    return entries.sort((a, b) => b.rawDate.localeCompare(a.rawDate) || b.timestamp.localeCompare(a.timestamp));
  }, [foodLogs, activityLogs, weightLogs, injectionLogs, sideEffectLogs]);

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
        },
      },
    ]);
  }, [store]);

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
            <ChevronLeft size={26} color="#FFFFFF" />
          </Pressable>
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
          renderItem={({ item, index, section }) => (
            <Pressable
              onLongPress={() => handleLongPress(item)}
              delayLongPress={400}
              style={({ pressed }) => [s.entryCard, pressed && { opacity: 0.7 }]}
            >
              <View style={s.entryRow}>
                <View style={s.entryIconWrap}>{item.icon}</View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={s.entryTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={s.entryTime}>{item.timestamp}</Text>
                  </View>
                  <Text style={s.entryDetails}>{item.details}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <View style={[s.impactTag, { backgroundColor: statusStyle[item.impactStatus].bg }]}>
                      <Text style={[s.impactText, { color: statusStyle[item.impactStatus].text }]}>
                        {item.impact}
                      </Text>
                    </View>
                    <MoreHorizontal size={16} color={colors.textMuted} />
                  </View>
                </View>
              </View>
              {index < section.data.length - 1 && <View style={s.divider} />}
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
      paddingHorizontal: 20, paddingVertical: 12,
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
    entryRow: { flexDirection: 'row', gap: 12 },
    entryIconWrap: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      alignItems: 'center', justifyContent: 'center',
    },
    entryTitle: { fontSize: 15, fontWeight: '600', color: c.textPrimary, flex: 1, fontFamily: FF },
    entryTime: { fontSize: 12, color: muted, fontFamily: FF },
    entryDetails: { fontSize: 13, color: muted, marginTop: 2, fontFamily: FF },
    impactTag: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12,
    },
    impactText: { fontSize: 12, fontWeight: '600', fontFamily: FF },
    divider: { height: 0.5, backgroundColor: c.border, marginVertical: 8 },
  });
};
