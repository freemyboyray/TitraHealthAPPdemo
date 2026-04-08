import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OptionPill } from '@/components/onboarding/option-pill';
import type { AppColors } from '@/constants/theme';
import {
  BRAND_DEFAULT_FREQ_DAYS, BRAND_DISPLAY_NAMES, BRAND_TO_GLP1_TYPE, BRAND_TO_ROUTE,
  MedicationBrand, getBrandDoses, toDateString,
} from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import { DRUG_IS_ORAL, DRUG_WASHOUT_DAYS, DRUG_WASHOUT_LABEL } from '@/constants/drug-pk';
import { computeBaseTargets } from '@/lib/targets';
import { scheduleDoseReminder } from '@/lib/notifications';

const ORANGE = '#FF742A';

const BRAND_LABEL: Record<string, string> = {
  zepbound: 'Zepbound', mounjaro: 'Mounjaro', wegovy: 'Wegovy', ozempic: 'Ozempic',
  trulicity: 'Trulicity', saxenda: 'Saxenda', victoza: 'Victoza', rybelsus: 'Rybelsus',
  oral_wegovy: 'Oral Wegovy', orforglipron: 'Orforglipron',
  compounded_semaglutide: 'Compounded (Sema)', compounded_tirzepatide: 'Compounded (Tirz)',
  compounded_liraglutide: 'Compounded (Lira)', other: 'Other',
};

type BrandOption = { value: MedicationBrand; label: string; note?: string };
type BrandGroup = { heading: string; subheading: string; brands: BrandOption[] };

const BRAND_GROUPS: BrandGroup[] = [
  {
    heading: 'Weekly Injection',
    subheading: 'Administered once a week by subcutaneous injection',
    brands: [
      { value: 'zepbound',               label: 'Zepbound®',              note: 'Tirzepatide' },
      { value: 'mounjaro',               label: 'Mounjaro®',              note: 'Tirzepatide' },
      { value: 'wegovy',                 label: 'Wegovy®',                note: 'Semaglutide' },
      { value: 'ozempic',                label: 'Ozempic®',               note: 'Semaglutide (off-label wt loss)' },
      { value: 'trulicity',              label: 'Trulicity®',             note: 'Dulaglutide' },
      { value: 'compounded_semaglutide', label: 'Compounded Semaglutide', note: 'Weekly' },
      { value: 'compounded_tirzepatide', label: 'Compounded Tirzepatide', note: 'Weekly' },
    ],
  },
  {
    heading: 'Daily Injection',
    subheading: 'Administered once a day by subcutaneous injection',
    brands: [
      { value: 'saxenda',                label: 'Saxenda®',               note: 'Liraglutide 3 mg' },
      { value: 'victoza',                label: 'Victoza®',               note: 'Liraglutide (off-label wt loss)' },
      { value: 'compounded_liraglutide', label: 'Compounded Liraglutide', note: 'Daily' },
    ],
  },
  {
    heading: 'Daily Oral Pill',
    subheading: 'Taken by mouth once a day - no injections',
    brands: [
      { value: 'oral_wegovy',  label: 'Oral Wegovy®',  note: 'Semaglutide 25 mg · FDA approved Dec 2025' },
      { value: 'rybelsus',     label: 'Rybelsus®',     note: 'Semaglutide 3/7/14 mg · T2D approved' },
      { value: 'orforglipron', label: 'Orforglipron',  note: 'Eli Lilly · NDA filed - FDA decision Q2 2026' },
    ],
  },
  {
    heading: 'Other',
    subheading: '',
    brands: [{ value: 'other', label: 'Other / Not listed' }],
  },
];

const INJECTABLE_FREQUENCIES = [
  { label: 'Every day',                  days: 1 as number | 'custom' },
  { label: 'Every 7 days (most common)', days: 7 as number | 'custom' },
  { label: 'Every 14 days',             days: 14 as number | 'custom' },
  { label: 'Custom',                     days: 'custom' as number | 'custom' },
];

export default function EditTreatmentScreen() {
  const { profile, updateProfile, isLoading } = useProfile();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [brand, setBrand] = useState<MedicationBrand>(profile?.medicationBrand ?? 'ozempic');
  const [dose, setDose] = useState<number | 'custom'>(
    () => {
      const doses = getBrandDoses(profile?.medicationBrand ?? 'ozempic');
      return doses.includes(profile?.doseMg ?? 0) ? (profile?.doseMg ?? doses[0]) : 'custom';
    }
  );
  const [customDose, setCustomDose] = useState(() => {
    const doses = getBrandDoses(profile?.medicationBrand ?? 'ozempic');
    return doses.includes(profile?.doseMg ?? 0) ? '' : String(profile?.doseMg ?? '');
  });
  const [freq, setFreq] = useState<number | 'custom'>(
    () => {
      const validFreqs = [1, 7, 14];
      const pFreq = profile?.injectionFrequencyDays ?? 7;
      return validFreqs.includes(pFreq) ? pFreq : 'custom';
    }
  );
  const [customFreq, setCustomFreq] = useState(() => {
    const validFreqs = [1, 7, 14];
    const pFreq = profile?.injectionFrequencyDays ?? 7;
    return validFreqs.includes(pFreq) ? '' : String(pFreq);
  });
  const [lastInjDate, setLastInjDate] = useState(() =>
    profile?.lastInjectionDate
      ? new Date(profile.lastInjectionDate + 'T12:00:00')
      : new Date()
  );
  const [doseStartDate, setDoseStartDate] = useState(() =>
    profile?.doseStartDate
      ? new Date(profile.doseStartDate + 'T12:00:00')
      : new Date()
  );
  const [doseTime, setDoseTime] = useState<Date>(() => {
    const rawTime = profile?.doseTime as string | undefined;
    const d = new Date();
    if (rawTime) {
      const [h, m] = rawTime.split(':').map(Number);
      d.setHours(h ?? 8, m ?? 0, 0, 0);
    } else {
      d.setHours(8, 0, 0, 0);
    }
    return d;
  });
  const [saving, setSaving] = useState(false);

  // ── Confirmation modal state ──
  type ConfirmStep = 'summary' | 'last_dose' | 'first_dose' | 'dose_time';
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmStep, setConfirmStep] = useState<ConfirmStep>('summary');
  // These track answers collected during the confirmation flow
  const [confirmLastDoseDate, setConfirmLastDoseDate] = useState<Date>(lastInjDate);
  const [confirmFirstDoseDate, setConfirmFirstDoseDate] = useState<Date>(new Date());
  const [confirmDoseTimeValue, setConfirmDoseTimeValue] = useState<Date>(doseTime);

  if (isLoading) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}><ActivityIndicator color={ORANGE} style={{ flex: 1 }} /></SafeAreaView>;
  }
  if (!profile) { router.back(); return null; }

  const glp1Type = BRAND_TO_GLP1_TYPE[brand];
  const isOral = DRUG_IS_ORAL[glp1Type] ?? false;
  const brandDoses = getBrandDoses(brand);
  const isDaily = (freq === 1) || (freq === 'custom' && customFreq === '1');

  // ── Change detection ──
  const oldGlp1Type = profile.glp1Type;
  const oldBrand = profile.medicationBrand;
  const oldFreqDays = profile.injectionFrequencyDays;
  const oldIsDaily = oldFreqDays === 1;

  function handleBrandChange(b: MedicationBrand) {
    setBrand(b);
    const newFreq = BRAND_DEFAULT_FREQ_DAYS[b];
    setFreq(newFreq);
    setCustomFreq('');
    const newDoses = getBrandDoses(b);
    if (!newDoses.includes(dose as number)) {
      setDose(newDoses[0]);
      setCustomDose('');
    }
  }

  const freqDays = freq === 'custom'
    ? (customFreq !== '' ? parseInt(customFreq, 10) : null)
    : freq;
  const doseMg = dose === 'custom'
    ? (customDose !== '' && !isNaN(parseFloat(customDose)) ? parseFloat(customDose) : null)
    : dose;
  const isValid = freqDays !== null && doseMg !== null;

  // Classify what kind of change this is
  function getChangeType(): 'drug_type' | 'freq_change' | 'brand_swap' | 'dose_only' | 'none' {
    const newGlp1Type = BRAND_TO_GLP1_TYPE[brand];
    if (newGlp1Type !== oldGlp1Type) return 'drug_type';
    if (freqDays !== oldFreqDays) return 'freq_change';
    if (brand !== oldBrand) return 'brand_swap';
    if (doseMg !== profile!.doseMg) return 'dose_only';
    return 'none';
  }

  // Determine which confirmation steps to show
  function getConfirmSteps(): ConfirmStep[] {
    const changeType = getChangeType();
    const steps: ConfirmStep[] = ['summary'];
    const newIsDaily = freqDays === 1;

    if (changeType === 'drug_type') {
      // Switching active ingredient — need last dose date of old drug + first dose date of new
      steps.push('last_dose', 'first_dose');
      if (newIsDaily) steps.push('dose_time');
    } else if (changeType === 'freq_change') {
      // Same drug, different frequency (e.g. weekly → daily or daily → weekly)
      steps.push('last_dose');
      if (newIsDaily && !oldIsDaily) steps.push('dose_time');
    } else if (changeType === 'brand_swap') {
      // Same drug type, different brand — lighter flow
      // (e.g. Ozempic → Wegovy, both semaglutide)
    }

    return steps;
  }

  async function doSave() {
    setSaving(true);
    const changeType = getChangeType();
    const newIsDaily = freqDays === 1;

    // Determine the right dates based on what the user answered
    let finalLastInjDate = lastInjDate;
    let finalDoseStartDate = doseStartDate;
    let finalDoseTime = doseTime;

    if (changeType === 'drug_type') {
      // User told us when they'll take the new drug
      finalLastInjDate = confirmFirstDoseDate;
      finalDoseStartDate = confirmFirstDoseDate;
      if (newIsDaily) finalDoseTime = confirmDoseTimeValue;
    } else if (changeType === 'freq_change') {
      finalLastInjDate = confirmLastDoseDate;
      finalDoseStartDate = new Date(); // starting new schedule today
      if (newIsDaily && !oldIsDaily) finalDoseTime = confirmDoseTimeValue;
    }

    const formattedDoseTime = newIsDaily
      ? `${String(finalDoseTime.getHours()).padStart(2, '0')}:${String(finalDoseTime.getMinutes()).padStart(2, '0')}`
      : '';

    const finalLastInjDateStr = toDateString(finalLastInjDate);

    await updateProfile({
      medicationBrand: brand,
      glp1Type: BRAND_TO_GLP1_TYPE[brand],
      routeOfAdministration: BRAND_TO_ROUTE[brand],
      injectionFrequencyDays: freqDays as number,
      doseMg: doseMg as number,
      lastInjectionDate: finalLastInjDateStr,
      doseStartDate: toDateString(finalDoseStartDate),
      doseTime: formattedDoseTime,
    });

    // Reschedule dose reminders for new medication schedule
    const brandDisplay = BRAND_DISPLAY_NAMES[brand] ?? brand;
    await scheduleDoseReminder(
      freqDays as number,
      formattedDoseTime || '09:00',
      brandDisplay,
      finalLastInjDateStr,
    ).catch(() => {}); // Don't block save on notification failure

    setConfirmVisible(false);
    router.back();
  }

  function handleSave() {
    if (saving || !isValid) return;

    const changeType = getChangeType();

    if (changeType === 'none') {
      // Nothing changed — just go back
      router.back();
      return;
    }

    // Reset confirmation state
    setConfirmLastDoseDate(lastInjDate);
    setConfirmFirstDoseDate(new Date());
    setConfirmDoseTimeValue(doseTime);

    const steps = getConfirmSteps();
    setConfirmStep(steps[0]);
    setConfirmVisible(true);
  }

  // Navigate confirmation modal steps
  function confirmNext() {
    const steps = getConfirmSteps();
    const idx = steps.indexOf(confirmStep);
    if (idx < steps.length - 1) {
      setConfirmStep(steps[idx + 1]);
    } else {
      doSave();
    }
  }

  function confirmBack() {
    const steps = getConfirmSteps();
    const idx = steps.indexOf(confirmStep);
    if (idx > 0) {
      setConfirmStep(steps[idx - 1]);
    } else {
      setConfirmVisible(false);
    }
  }

  // ── Confirmation modal content builders ──

  function renderSummaryStep() {
    const changeType = getChangeType();
    const newGlp1Type = BRAND_TO_GLP1_TYPE[brand];
    const brandName = BRAND_LABEL[brand] ?? brand;

    const currentTargets = computeBaseTargets(profile!);
    const proposed = {
      ...profile!,
      medicationBrand: brand,
      glp1Type: newGlp1Type,
      routeOfAdministration: BRAND_TO_ROUTE[brand],
      doseMg: doseMg as number,
      injectionFrequencyDays: freqDays as number,
    };
    const newTargets = computeBaseTargets(proposed);

    const targetsChanged =
      currentTargets.caloriesTarget !== newTargets.caloriesTarget ||
      currentTargets.proteinG !== newTargets.proteinG;

    // Washout warning for drug type changes
    const showWashout = changeType === 'drug_type' && oldGlp1Type !== newGlp1Type;
    const washoutLabel = showWashout ? DRUG_WASHOUT_LABEL[oldGlp1Type ?? 'semaglutide'] : null;
    const oldDrugName = BRAND_LABEL[oldBrand ?? 'other'] ?? oldGlp1Type;

    // Frequency change descriptions
    const freqChanging = freqDays !== oldFreqDays;
    const freqDesc = freqChanging
      ? `${oldFreqDays === 1 ? 'daily' : `every ${oldFreqDays} days`} → ${freqDays === 1 ? 'daily' : `every ${freqDays} days`}`
      : null;

    return (
      <>
        <Text style={ms.modalTitle}>CONFIRM CHANGES</Text>

        <View style={ms.changeRow}>
          <Text style={ms.changeLabel}>Medication</Text>
          <Text style={ms.changeValue}>{brandName} {doseMg}mg</Text>
        </View>

        {freqDesc && (
          <View style={ms.changeRow}>
            <Text style={ms.changeLabel}>Schedule</Text>
            <Text style={ms.changeValue}>{freqDesc}</Text>
          </View>
        )}

        {targetsChanged && (
          <View style={ms.targetBox}>
            <Text style={ms.targetTitle}>Daily targets will adjust</Text>
            <Text style={ms.targetLine}>
              Calories: {currentTargets.caloriesTarget} → {newTargets.caloriesTarget} kcal
            </Text>
            <Text style={ms.targetLine}>
              Protein: {currentTargets.proteinG}g → {newTargets.proteinG}g
            </Text>
          </View>
        )}

        {showWashout && (
          <View style={ms.washoutBox}>
            <Ionicons name="information-circle" size={18} color="#F5A623" style={{ marginRight: 8, marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={ms.washoutTitle}>Transition period</Text>
              <Text style={ms.washoutBody}>
                {oldDrugName} has a washout period of {washoutLabel}. Your provider may have specific guidance on when to start the new medication.
              </Text>
            </View>
          </View>
        )}
      </>
    );
  }

  function renderLastDoseStep() {
    const changeType = getChangeType();
    const isOldOral = DRUG_IS_ORAL[oldGlp1Type ?? 'semaglutide'] ?? false;
    const oldDrugName = BRAND_LABEL[oldBrand ?? 'other'] ?? oldGlp1Type;
    const question = changeType === 'drug_type'
      ? `When was your last dose of ${oldDrugName}?`
      : isOldOral
        ? 'When did you last take your pill?'
        : 'When was your last injection?';

    return (
      <>
        <Text style={ms.modalTitle}>LAST DOSE</Text>
        <Text style={ms.stepQuestion}>{question}</Text>
        <Text style={ms.stepHint}>
          This helps us accurately track your transition and schedule.
        </Text>
        <View style={{ alignSelf: 'center', marginTop: 16 }}>
          <DateTimePicker
            value={confirmLastDoseDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => { if (date) setConfirmLastDoseDate(date); }}
            themeVariant="dark"
          />
        </View>
      </>
    );
  }

  function renderFirstDoseStep() {
    const newBrandName = BRAND_LABEL[brand] ?? brand;
    const newIsOral = DRUG_IS_ORAL[glp1Type] ?? false;

    return (
      <>
        <Text style={ms.modalTitle}>NEW MEDICATION</Text>
        <Text style={ms.stepQuestion}>
          When {newIsOral ? 'will you take' : 'will you inject'} your first dose of {newBrandName}?
        </Text>
        <Text style={ms.stepHint}>
          Select today if you're starting now, or a future date if your provider recommended a gap.
        </Text>
        <View style={{ alignSelf: 'center', marginTop: 16 }}>
          <DateTimePicker
            value={confirmFirstDoseDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date(confirmLastDoseDate.getTime() - 86400000)} // Allow same day
            onChange={(_, date) => { if (date) setConfirmFirstDoseDate(date); }}
            themeVariant="dark"
          />
        </View>
      </>
    );
  }

  function renderDoseTimeStep() {
    return (
      <>
        <Text style={ms.modalTitle}>DAILY DOSE TIME</Text>
        <Text style={ms.stepQuestion}>
          What time will you take your daily dose?
        </Text>
        <Text style={ms.stepHint}>
          Used for reminders and tracking your medication cycle throughout the day.
        </Text>
        <View style={{ alignSelf: 'center', marginTop: 16 }}>
          <DateTimePicker
            value={confirmDoseTimeValue}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => { if (date) setConfirmDoseTimeValue(date); }}
            themeVariant="dark"
          />
        </View>
      </>
    );
  }

  function renderConfirmStep() {
    switch (confirmStep) {
      case 'summary':    return renderSummaryStep();
      case 'last_dose':  return renderLastDoseStep();
      case 'first_dose': return renderFirstDoseStep();
      case 'dose_time':  return renderDoseTimeStep();
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>TREATMENT PLAN</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Brand picker */}
        {BRAND_GROUPS.map((group) => (
          <View key={group.heading} style={s.group}>
            <Text style={s.groupHeading}>{group.heading}</Text>
            {group.subheading ? <Text style={s.groupSub}>{group.subheading}</Text> : null}
            {group.brands.map((b) => (
              <OptionPill
                key={b.value}
                label={b.note ? `${b.label}  ·  ${b.note}` : b.label}
                selected={brand === b.value}
                onPress={() => handleBrandChange(b.value)}
              />
            ))}
          </View>
        ))}

        {/* Dose */}
        <Text style={s.sectionLabel}>Current Dose</Text>
        {brandDoses.map((d) => (
          <OptionPill
            key={String(d)}
            label={`${d} mg`}
            selected={dose === d}
            onPress={() => { setDose(d); setCustomDose(''); }}
          />
        ))}
        <OptionPill
          label="Custom / Other"
          selected={dose === 'custom'}
          onPress={() => setDose('custom')}
        />
        {dose === 'custom' && (
          <TextInput
            style={s.input}
            placeholder="Enter dose in mg (e.g. 3.5)"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={customDose}
            onChangeText={setCustomDose}
            autoFocus
          />
        )}

        {/* Frequency - hide for oral */}
        {!isOral && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>Frequency</Text>
            {INJECTABLE_FREQUENCIES.map((f) => (
              <OptionPill
                key={String(f.days)}
                label={f.label}
                selected={freq === f.days}
                onPress={() => { setFreq(f.days); setCustomFreq(''); }}
              />
            ))}
            {freq === 'custom' && (
              <TextInput
                style={s.input}
                placeholder="Frequency in days (e.g. 10)"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={customFreq}
                onChangeText={setCustomFreq}
                autoFocus
              />
            )}
          </>
        )}

        {/* Daily dose time */}
        {isDaily && (
          <>
            <Text style={[s.sectionLabel, { marginTop: 24 }]}>Daily Dose Time</Text>
            <Text style={s.helperText}>
              When you usually take your medication. Used for reminders and PK tracking.
            </Text>
            <DateTimePicker
              value={doseTime}
              mode="time"
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              onChange={(_, date) => { if (date) setDoseTime(date); }}
              style={{ alignSelf: 'flex-start', marginTop: 8 }}
            />
          </>
        )}

        {/* Last dose date */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>
          {isOral ? 'When did you last take your pill?' : 'When was your last injection?'}
        </Text>
        <View style={s.datePickerWrap}>
          <DateTimePicker
            value={lastInjDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => { if (date) setLastInjDate(date); }}
            style={s.datePicker}
          />
        </View>

        {/* Dose start date */}
        <Text style={[s.sectionLabel, { marginTop: 24 }]}>When did you start this dose?</Text>
        <View style={s.datePickerWrap}>
          <DateTimePicker
            value={doseStartDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'compact' : 'default'}
            maximumDate={new Date()}
            onChange={(_, date) => { if (date) setDoseStartDate(date); }}
            style={s.datePicker}
          />
        </View>

      </ScrollView>

      <View style={s.footer}>
        <Pressable style={[s.saveBtn, (!isValid || saving) && s.saveBtnDisabled]} onPress={handleSave} disabled={!isValid || saving}>
          <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>
      </View>

      {/* ── Confirmation Modal ── */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={ms.backdrop}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

          <View style={ms.centered}>
            <View style={ms.card}>
              <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)' }]} />

              <ScrollView style={ms.cardScroll} contentContainerStyle={ms.cardContent} bounces={false}>
                {renderConfirmStep()}
              </ScrollView>

              {/* Step indicator */}
              {getConfirmSteps().length > 1 && (
                <View style={ms.dotsRow}>
                  {getConfirmSteps().map((step, i) => (
                    <View
                      key={step}
                      style={[ms.dot, confirmStep === step && ms.dotActive]}
                    />
                  ))}
                </View>
              )}

              {/* Action buttons */}
              <View style={ms.actionRow}>
                <TouchableOpacity
                  style={ms.btnCancel}
                  onPress={confirmBack}
                  activeOpacity={0.7}
                >
                  <Text style={ms.btnCancelText}>
                    {confirmStep === getConfirmSteps()[0] ? 'Cancel' : 'Back'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[ms.btnConfirm, saving && { opacity: 0.5 }]}
                  onPress={confirmNext}
                  disabled={saving}
                  activeOpacity={0.8}
                >
                  <Text style={ms.btnConfirmText}>
                    {saving
                      ? 'Saving...'
                      : confirmStep === getConfirmSteps()[getConfirmSteps().length - 1]
                        ? 'Confirm'
                        : 'Next'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: c.textPrimary, fontSize: 13, fontWeight: '700', letterSpacing: 3.5 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 4 },
  group: { marginBottom: 20 },
  groupHeading: {
    fontSize: 13, fontWeight: '700', color: ORANGE,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4,
  },
  groupSub: { fontSize: 12, color: c.textMuted, marginBottom: 10 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: c.textPrimary, marginBottom: 12 },
  helperText: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  input: {
    height: 52, borderWidth: 1.5, borderColor: c.border, borderRadius: 14,
    paddingHorizontal: 16, fontSize: 16, color: c.textPrimary,
    marginTop: 4, marginBottom: 4, backgroundColor: c.bg,
  },
  datePickerWrap: { marginBottom: 8 },
  datePicker: { alignSelf: 'flex-start' },
  footer: { padding: 16, paddingBottom: 8 },
  saveBtn: {
    backgroundColor: ORANGE, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

const FF = 'Helvetica Neue';

// ─── Confirmation Modal Styles ───────────────────────────────────────────────

const ms = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '92%',
    maxHeight: '80%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  cardScroll: {},
  cardContent: {
    padding: 28,
    paddingBottom: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    backgroundColor: ORANGE,
    width: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 28,
    paddingBottom: 28,
    paddingTop: 8,
  },
  btnCancel: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: FF,
  },
  btnConfirm: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: ORANGE,
  },
  btnConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FF,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: FF,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  changeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: FF,
  },
  changeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: FF,
  },
  targetBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
  },
  targetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
    fontFamily: FF,
  },
  targetLine: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 20,
    fontFamily: FF,
  },
  washoutBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,166,35,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.2)',
    padding: 14,
    marginTop: 16,
  },
  washoutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F5A623',
    marginBottom: 4,
    fontFamily: FF,
  },
  washoutBody: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 17,
    fontFamily: FF,
  },
  stepQuestion: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: FF,
  },
  stepHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: FF,
  },
});
