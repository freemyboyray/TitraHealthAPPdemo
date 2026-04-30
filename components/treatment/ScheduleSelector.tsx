import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MedicationGroupSection } from '@/components/treatment/MedicationGroupSection';
import type { AppColors } from '@/constants/theme';
import { TYPE } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';

const INJECTABLE_FREQUENCIES = [
  { label: 'Every day', days: 1 as number | 'custom' },
  { label: 'Every 7 days (most common)', days: 7 as number | 'custom' },
  { label: 'Every 14 days', days: 14 as number | 'custom' },
  { label: 'Custom', days: 'custom' as number | 'custom' },
];

type Props = {
  isOral: boolean;
  isDaily: boolean;
  wasOffTreatment: boolean;
  freq: number | 'custom';
  customFreq: string;
  doseTime: Date;
  lastInjDate: Date;
  doseStartDate: Date;
  onFreqChange: (freq: number | 'custom') => void;
  onCustomFreqChange: (value: string) => void;
  onDoseTimeChange: (date: Date) => void;
  onLastInjDateChange: (date: Date) => void;
  onDoseStartDateChange: (date: Date) => void;
};

export function ScheduleSelector({
  isOral, isDaily, wasOffTreatment,
  freq, customFreq, doseTime, lastInjDate, doseStartDate,
  onFreqChange, onCustomFreqChange, onDoseTimeChange, onLastInjDateChange, onDoseStartDateChange,
}: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

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
                      <Ionicons name="checkmark-circle" size={22} color={colors.orange} />
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
          <DateTimePicker
            value={doseTime}
            mode="time"
            display="spinner"
            onChange={(_, date) => { if (date) onDoseTimeChange(date); }}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          />
        </View>
      )}

      {/* Last dose + dose start — only for on-treatment users */}
      {!wasOffTreatment && (
        <>
          <View style={{ marginTop: 24 }}>
            <Text style={s.sectionTitle}>
              {isOral ? 'When did you last take your pill?' : 'When was your last injection?'}
            </Text>
            <View style={s.datePickerWrap}>
              <DateTimePicker
                value={lastInjDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                maximumDate={new Date()}
                onChange={(_, date) => { if (date) onLastInjDateChange(date); }}
                style={s.datePicker}
              />
            </View>
          </View>

          <View style={{ marginTop: 24 }}>
            <Text style={s.sectionTitle}>When did you start this dose?</Text>
            <View style={s.datePickerWrap}>
              <DateTimePicker
                value={doseStartDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'compact' : 'default'}
                maximumDate={new Date()}
                onChange={(_, date) => { if (date) onDoseStartDateChange(date); }}
                style={s.datePicker}
              />
            </View>
          </View>
        </>
      )}
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
});
