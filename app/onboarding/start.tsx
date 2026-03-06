import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { useProfile } from '@/contexts/profile-context';
import { toDateString } from '@/constants/user-profile';

export default function StartScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useProfile();
  const unit = draft.unitSystem ?? 'imperial';

  const [weightInput, setWeightInput] = useState('');
  const [editingWeight, setEditingWeight] = useState(false);
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [editingDate, setEditingDate] = useState(false);

  const weightLabel = unit === 'imperial' ? 'lbs' : 'kg';
  const isValid =
    weightInput !== '' &&
    !isNaN(parseFloat(weightInput)) &&
    month !== '' && day !== '' && year.length === 4;

  const handleContinue = () => {
    if (!isValid) return;
    const lbs =
      unit === 'imperial'
        ? parseFloat(weightInput)
        : Math.round(parseFloat(weightInput) * 2.20462 * 10) / 10;
    const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    updateDraft({ startWeightLbs: lbs, startDate: toDateString(d) });
    router.push('/onboarding/goal-weight');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={9} total={14} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>Tell us where you started.</Text>
          <Text style={s.subtitle}>
            Add the weight you were at when you began GLP-1, along with your start date.
          </Text>

          {/* Start weight row */}
          <TouchableOpacity style={s.row} onPress={() => setEditingWeight(true)}>
            <Text style={s.rowLabel}>Start Weight</Text>
            {editingWeight ? (
              <View style={s.inlineInput}>
                <TextInput
                  style={s.inputText}
                  keyboardType="decimal-pad"
                  placeholder={`Weight in ${weightLabel}`}
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={weightInput}
                  onChangeText={setWeightInput}
                  autoFocus
                  onBlur={() => setEditingWeight(false)}
                />
                <Text style={s.unitHint}>{weightLabel}</Text>
              </View>
            ) : (
              <View style={s.rowRight}>
                <Text style={s.rowValue}>
                  {weightInput ? `${weightInput} ${weightLabel}` : `Tap to enter`}
                </Text>
                <Ionicons name="pencil" size={16} color="#9A9490" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>

          {/* Start date row */}
          <TouchableOpacity style={s.row} onPress={() => setEditingDate(true)}>
            <Text style={s.rowLabel}>Start Date</Text>
            {editingDate ? (
              <View style={s.dateRow}>
                <TextInput
                  style={s.dateInput}
                  placeholder="MM"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={month}
                  onChangeText={setMonth}
                  autoFocus
                />
                <TextInput
                  style={s.dateInput}
                  placeholder="DD"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="number-pad"
                  maxLength={2}
                  value={day}
                  onChangeText={setDay}
                />
                <TextInput
                  style={[s.dateInput, { flex: 1.5 }]}
                  placeholder="YYYY"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="number-pad"
                  maxLength={4}
                  value={year}
                  onChangeText={setYear}
                  onBlur={() => setEditingDate(false)}
                />
              </View>
            ) : (
              <View style={s.rowRight}>
                <Text style={s.rowValue}>
                  {month && day && year.length === 4
                    ? `${month}/${day}/${year}`
                    : 'Tap to enter'}
                </Text>
                <Ionicons name="pencil" size={16} color="#9A9490" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>
        </ScrollView>

        <ContinueButton onPress={handleContinue} disabled={!isValid} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#141210' },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: 15, color: '#9A9490', marginBottom: 32, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    minHeight: 64,
    gap: 12,
  },
  rowLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  rowRight: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 16, color: '#9A9490' },
  inlineInput: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inputText: { fontSize: 18, color: '#FFFFFF', minWidth: 80, textAlign: 'right' },
  unitHint: { fontSize: 14, color: '#9A9490' },
  dateRow: { flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'flex-end' },
  dateInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 15,
    textAlign: 'center',
    color: '#FFFFFF',
    backgroundColor: '#252219',
  },
});
