import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MedicationGroupSection } from '@/components/treatment/MedicationGroupSection';
import type { AppColors } from '@/constants/theme';
import { TYPE } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import { CircleCheck } from 'lucide-react-native';

const INJECTABLE_FREQUENCIES = [
  { label: 'Every day', days: 1 as number | 'custom' },
  { label: 'Every 7 days (most common)', days: 7 as number | 'custom' },
  { label: 'Every 14 days', days: 14 as number | 'custom' },
  { label: 'Custom', days: 'custom' as number | 'custom' },
];

type Props = {
  isOral: boolean;
  isDaily: boolean;
  wasOffTreatment?: boolean;
  freq: number | 'custom';
  customFreq: string;
  doseTime: Date;
  lastInjDate?: Date;
  doseStartDate?: Date;
  onFreqChange: (freq: number | 'custom') => void;
  onCustomFreqChange: (value: string) => void;
  onDoseTimeChange: (date: Date) => void;
  onLastInjDateChange?: (date: Date) => void;
  onDoseStartDateChange?: (date: Date) => void;
};

export function ScheduleSelector({
  isOral, isDaily,
  freq, customFreq, doseTime,
  onFreqChange, onCustomFreqChange, onDoseTimeChange,
}: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  // "I'm not sure" → default to a midday (12:00 PM) reminder for people who take
  // it at a rough time rather than a fixed minute.
  const [unsureTime, setUnsureTime] = useState(false);

  const pickMidday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const noon = new Date(doseTime);
    noon.setHours(12, 0, 0, 0);
    onDoseTimeChange(noon);
    setUnsureTime(true);
  };

  return (
    <View>
      {/* Frequency selection — hide for oral (auto-set to daily) */}
      {!isOral && (
        <>
          <Text style={s.question}>How often do you take it?</Text>
          <Text style={s.hint}>Select the frequency prescribed by your provider.</Text>

          <MedicationGroupSection>
            {INJECTABLE_FREQUENCIES.map((f, i) => {
              const isSelected = freq === f.days;
              const isLast = i === INJECTABLE_FREQUENCIES.length - 1;

              return (
                <TouchableOpacity
                  key={String(f.days)}
                  activeOpacity={0.7}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onFreqChange(f.days);
                    if (f.days !== 'custom') onCustomFreqChange('');
                  }}
                  style={[
                    s.freqRow,
                    isSelected && s.freqRowSelected,
                    i === 0 && s.rowFirst,
                    isLast && s.rowLast,
                    !isLast && s.rowDivider,
                  ]}
                >
                  <Text style={[s.freqLabel, isSelected && { color: colors.orange }]}>
                    {f.label}
                  </Text>
                  {isSelected && (
                    <Animated.View entering={FadeIn.duration(150)}>
                      <CircleCheck size={22} color={colors.orange} />
                    </Animated.View>
                  )}
                </TouchableOpacity>
              );
            })}
          </MedicationGroupSection>

          {freq === 'custom' && (
            <TextInput
              style={s.input}
              placeholder="Frequency in days (e.g. 10)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={customFreq}
              onChangeText={onCustomFreqChange}
              autoFocus
            />
          )}
        </>
      )}

      {/* Daily dose time */}
      {isDaily && (
        <View style={[!isOral && { marginTop: 24 }]}>
          <Text style={s.sectionTitle}>
            {isOral ? 'What time do you take your pill?' : 'Daily Dose Time'}
          </Text>
          <Text style={s.sectionHint}>
            Used for reminders and tracking your medication cycle.
          </Text>

          {unsureTime ? (
            <TouchableOpacity
              style={s.middayRow}
              activeOpacity={0.7}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setUnsureTime(false); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.middayTitle}>Midday reminder · 12:00 PM</Text>
                <Text style={s.midToggleLink}>Set a specific time instead</Text>
              </View>
              <CircleCheck size={22} color={colors.orange} />
            </TouchableOpacity>
          ) : (
            <>
              <DateTimePicker
                value={doseTime}
                mode="time"
                display="spinner"
                themeVariant={colors.isDark ? 'dark' : 'light'}
                onChange={(_, date) => { if (date) onDoseTimeChange(date); }}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              />
              <TouchableOpacity onPress={pickMidday} activeOpacity={0.7} style={s.unsureBtn}>
                <Text style={s.midToggleLink}>I'm not sure — just remind me midday</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Last dose + dose start removed — confirmation modal handles these */}
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  question: {
    ...TYPE.title1,
    color: c.textPrimary,
    marginBottom: 6,
    fontFamily: 'System',
  },
  hint: {
    ...TYPE.body,
    fontSize: 16,
    color: c.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'System',
  },
  freqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  freqRowSelected: {
    backgroundColor: c.orangeDim,
  },
  rowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  rowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSubtle,
  },
  freqLabel: {
    ...TYPE.title3,
    color: c.textPrimary,
    fontFamily: 'System',
  },
  input: {
    height: 52,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 18,
    color: c.textPrimary,
    marginTop: 12,
    backgroundColor: c.bg,
    fontFamily: 'System',
  },
  sectionTitle: {
    ...TYPE.title3,
    fontSize: 18,
    color: c.textPrimary,
    marginBottom: 8,
    fontFamily: 'System',
  },
  sectionHint: {
    ...TYPE.body,
    color: c.textSecondary,
    lineHeight: 18,
    fontFamily: 'System',
  },
  datePickerWrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  datePicker: {
    alignSelf: 'flex-start',
  },
  unsureBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginTop: 4,
  },
  midToggleLink: {
    fontSize: 14,
    fontWeight: '600',
    color: c.orange,
    fontFamily: 'System',
  },
  middayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.orange,
    backgroundColor: 'rgba(255,116,42,0.06)',
  },
  middayTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: c.textPrimary,
    fontFamily: 'System',
    marginBottom: 2,
  },
});
