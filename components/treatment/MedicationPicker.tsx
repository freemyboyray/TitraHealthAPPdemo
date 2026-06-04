import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { MedicationCard } from '@/components/treatment/MedicationCard';
import { MedicationCategoryTabs } from '@/components/treatment/MedicationCategoryTabs';
import { MedicationGroupSection } from '@/components/treatment/MedicationGroupSection';
import type { AppColors } from '@/constants/theme';
import { TYPE } from '@/constants/theme';
import type { MedicationBrand } from '@/constants/user-profile';
import { useAppTheme } from '@/contexts/theme-context';

type BrandOption = { value: MedicationBrand; label: string; note?: string };
type BrandGroup = { heading: string; subheading: string; brands: BrandOption[] };

// Grouped by route (Injection vs Oral) to match onboarding. Each group ends in
// its own catch-all (other_injection / other_oral) so an unlisted drug still
// pins the route. Frequency is confirmed separately, not implied by the group.
const BRAND_GROUPS: BrandGroup[] = [
  {
    heading: 'Injection',
    subheading: 'Given by subcutaneous injection',
    brands: [
      { value: 'zepbound',               label: 'Zepbound\u00AE',              note: 'Tirzepatide' },
      { value: 'mounjaro',               label: 'Mounjaro\u00AE',              note: 'Tirzepatide' },
      { value: 'wegovy',                 label: 'Wegovy\u00AE',                note: 'Semaglutide' },
      { value: 'ozempic',                label: 'Ozempic\u00AE',               note: 'Semaglutide (off-label)' },
      { value: 'trulicity',              label: 'Trulicity\u00AE',             note: 'Dulaglutide' },
      { value: 'saxenda',                label: 'Saxenda\u00AE',               note: 'Liraglutide 3 mg' },
      { value: 'victoza',                label: 'Victoza\u00AE',               note: 'Liraglutide (off-label)' },
      { value: 'compounded_semaglutide', label: 'Compounded Semaglutide',      note: 'Semaglutide' },
      { value: 'compounded_tirzepatide', label: 'Compounded Tirzepatide',      note: 'Tirzepatide' },
      { value: 'compounded_liraglutide', label: 'Compounded Liraglutide',      note: 'Liraglutide' },
      { value: 'other_injection',        label: 'Other injection',             note: 'Not listed' },
    ],
  },
  {
    heading: 'Oral Pill',
    subheading: 'Taken by mouth \u2014 no injections',
    brands: [
      { value: 'rybelsus',     label: 'Rybelsus\u00AE',     note: 'Semaglutide 3/7/14 mg' },
      { value: 'oral_wegovy',  label: 'Oral Wegovy\u00AE',  note: 'Semaglutide 25 mg' },
      { value: 'orforglipron', label: 'Foundayo\u00AE',     note: 'Orforglipron' },
      { value: 'other_oral',   label: 'Other oral',          note: 'Not listed' },
    ],
  },
];

type Props = {
  currentBrand: MedicationBrand | null | undefined;
  selectedBrand: MedicationBrand | null;
  onSelectBrand: (brand: MedicationBrand) => void;
};

export function MedicationPicker({ currentBrand, selectedBrand, onSelectBrand }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  // Default to the tab that contains the current or selected brand
  const initialTab = (() => {
    const target = selectedBrand ?? currentBrand;
    if (!target) return 0;
    const idx = BRAND_GROUPS.findIndex(g => g.brands.some(b => b.value === target));
    return idx >= 0 ? idx : 0;
  })();

  const [tabIndex, setTabIndex] = useState(initialTab);
  const activeGroup = BRAND_GROUPS[tabIndex];

  return (
    <View>
      <Text style={s.question}>Which medication are you on?</Text>
      <Text style={s.hint}>Select the brand prescribed by your provider.</Text>

      <MedicationCategoryTabs
        selectedIndex={tabIndex}
        onSelect={setTabIndex}
      />

      <Animated.View key={tabIndex} entering={FadeIn.duration(200)}>
        <MedicationGroupSection description={activeGroup.subheading || undefined}>
          {activeGroup.brands.map((b, i) => (
            <MedicationCard
              key={b.value}
              brand={b.value}
              label={b.label}
              note={b.note}
              selected={selectedBrand === b.value}
              isCurrent={currentBrand === b.value}
              isFirst={i === 0}
              isLast={i === activeGroup.brands.length - 1}
              onPress={() => onSelectBrand(b.value)}
            />
          ))}
        </MedicationGroupSection>
      </Animated.View>
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
    marginBottom: 20,
    lineHeight: 20,
    fontFamily: 'System',
  },
});
