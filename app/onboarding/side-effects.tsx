import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ContinueButton } from '@/components/onboarding/continue-button';
import { OnboardingHeader } from '@/components/onboarding/onboarding-header';
import { OptionPill } from '@/components/onboarding/option-pill';
import { SideEffect } from '@/constants/user-profile';
import { useProfile } from '@/contexts/profile-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

type IconSet = 'Ionicons' | 'MaterialIcons';
const OPTION_DATA: { value: SideEffect; label: string; iconSet: IconSet; iconName: string }[] = [
  { value: 'nausea',       label: 'Nausea',        iconSet: 'MaterialIcons', iconName: 'sick' },
  { value: 'fatigue',      label: 'Fatigue',        iconSet: 'Ionicons',      iconName: 'bed-outline' },
  { value: 'hair_loss',    label: 'Hair Loss',      iconSet: 'MaterialIcons', iconName: 'face' },
  { value: 'constipation', label: 'Constipation',   iconSet: 'MaterialIcons', iconName: 'accessibility' },
  { value: 'bloating',     label: 'Bloating',       iconSet: 'MaterialIcons', iconName: 'air' },
  { value: 'sulfur_burps', label: 'Sulfur Burps',   iconSet: 'MaterialIcons', iconName: 'air' },
];

export default function SideEffectsScreen() {
  const router = useRouter();
  const { updateDraft, completeOnboarding } = useProfile();
  const [selected, setSelected] = useState<SideEffect[]>([]);
  const [saving, setSaving] = useState(false);
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const iconColor = colors.isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)';

  const toggle = (effect: SideEffect) => {
    setSelected((prev) =>
      prev.includes(effect) ? prev.filter((e) => e !== effect) : [...prev, effect],
    );
  };

  const handleComplete = async () => {
    if (saving) return;
    setSaving(true);
    updateDraft({ sideEffects: selected });
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <OnboardingHeader step={14} total={14} onBack={() => router.back()} />
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.title}>What side effects are giving you the most trouble?</Text>
          <Text style={s.subtitle}>Let us know so we can help you manage them better.</Text>

          <View style={s.options}>
            {OPTION_DATA.map((o) => {
              const Icon = o.iconSet === 'Ionicons' ? Ionicons : MaterialIcons;
              return (
                <OptionPill
                  key={o.value}
                  label={o.label}
                  icon={<Icon name={o.iconName as any} size={20} color={iconColor} />}
                  selected={selected.includes(o.value)}
                  onPress={() => toggle(o.value)}
                />
              );
            })}
          </View>
        </ScrollView>

        <ContinueButton
          onPress={handleComplete}
          disabled={saving}
          label={saving ? 'Saving...' : selected.length > 0 ? 'Done' : "None \u2014 I'm doing great!"}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1, paddingHorizontal: 24 },
  content: { paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: c.textPrimary, marginBottom: 8, lineHeight: 34, fontFamily: 'Helvetica Neue' },
  subtitle: { fontSize: 15, color: c.textSecondary, marginBottom: 32, lineHeight: 22, fontFamily: 'Helvetica Neue' },
  options: {},
});
