import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Search } from 'lucide-react-native';

import { MedicationCard } from '@/components/treatment/MedicationCard';
import { MedicationCategoryTabs } from '@/components/treatment/MedicationCategoryTabs';
import { MedicationGroupSection } from '@/components/treatment/MedicationGroupSection';
import type { AppColors } from '@/constants/theme';
import { TYPE } from '@/constants/theme';
import type { MedicationBrand } from '@/constants/user-profile';
import { useAppTheme } from '@/contexts/theme-context';

type BrandOption = { value: MedicationBrand; label: string; note?: string; klass: string };
type BrandGroup = { heading: string; subheading: string; brands: BrandOption[] };

// `klass` is the active ingredient — used to group brands into native-style
// sections (Tirzepatide, Semaglutide, …). The display order of those sections.
const CLASS_ORDER = ['Tirzepatide', 'Semaglutide', 'Dulaglutide', 'Liraglutide', 'Orforglipron', 'Other'];

// Grouped by route (Injection vs Oral) to match onboarding. Each group ends in
// its own catch-all (other_injection / other_oral) so an unlisted drug still
// pins the route. Frequency is confirmed separately, not implied by the group.
const BRAND_GROUPS: BrandGroup[] = [
  {
    heading: 'Injection',
    subheading: 'Given by subcutaneous injection',
    brands: [
      { value: 'zepbound',               label: 'Zepbound®',              note: 'Tirzepatide',              klass: 'Tirzepatide' },
      { value: 'mounjaro',               label: 'Mounjaro®',              note: 'Tirzepatide',              klass: 'Tirzepatide' },
      { value: 'compounded_tirzepatide', label: 'Compounded Tirzepatide',      note: 'Tirzepatide',              klass: 'Tirzepatide' },
      { value: 'wegovy',                 label: 'Wegovy®',                note: 'Semaglutide',              klass: 'Semaglutide' },
      { value: 'ozempic',                label: 'Ozempic®',               note: 'Semaglutide (off-label)',  klass: 'Semaglutide' },
      { value: 'compounded_semaglutide', label: 'Compounded Semaglutide',      note: 'Semaglutide',              klass: 'Semaglutide' },
      { value: 'trulicity',              label: 'Trulicity®',             note: 'Dulaglutide',              klass: 'Dulaglutide' },
      { value: 'saxenda',                label: 'Saxenda®',               note: 'Liraglutide 3 mg',         klass: 'Liraglutide' },
      { value: 'victoza',                label: 'Victoza®',               note: 'Liraglutide (off-label)',  klass: 'Liraglutide' },
      { value: 'compounded_liraglutide', label: 'Compounded Liraglutide',      note: 'Liraglutide',              klass: 'Liraglutide' },
      { value: 'other_injection',        label: 'Other injection',             note: 'Not listed',               klass: 'Other' },
    ],
  },
  {
    heading: 'Oral Pill',
    subheading: 'Taken by mouth — no injections',
    brands: [
      { value: 'rybelsus',     label: 'Rybelsus®',     note: 'Semaglutide 3/7/14 mg', klass: 'Semaglutide' },
      { value: 'oral_wegovy',  label: 'Oral Wegovy®',  note: 'Semaglutide 25 mg',     klass: 'Semaglutide' },
      { value: 'orforglipron', label: 'Foundayo®',     note: 'Orforglipron',          klass: 'Orforglipron' },
      { value: 'other_oral',   label: 'Other oral',          note: 'Not listed',            klass: 'Other' },
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
  const [query, setQuery] = useState('');
  const activeGroup = BRAND_GROUPS[tabIndex];

  // Filter by search, then bucket into class sections in CLASS_ORDER.
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = activeGroup.brands.filter(
      b => !q || b.label.toLowerCase().includes(q) || (b.note ?? '').toLowerCase().includes(q),
    );
    const byClass = new Map<string, BrandOption[]>();
    for (const b of matched) {
      const list = byClass.get(b.klass) ?? [];
      list.push(b);
      byClass.set(b.klass, list);
    }
    return CLASS_ORDER
      .filter(k => byClass.has(k))
      .map(k => ({ klass: k, brands: byClass.get(k)! }));
  }, [activeGroup, query]);

  return (
    <View>
      <Text style={s.question}>Which medication are you on?</Text>
      <Text style={s.hint}>Select the brand prescribed by your provider.</Text>

      <MedicationCategoryTabs selectedIndex={tabIndex} onSelect={setTabIndex} />

      {/* Search */}
      <View style={s.searchWrap}>
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search medications"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {!!activeGroup.subheading && <Text style={s.routeCaption}>{activeGroup.subheading}</Text>}

      <Animated.View key={`${tabIndex}-${sections.length}`} entering={FadeIn.duration(180)}>
        {sections.length === 0 ? (
          <Text style={s.empty}>No medications match “{query.trim()}”.</Text>
        ) : (
          sections.map((section) => (
            <View key={section.klass} style={s.section}>
              <Text style={s.classHeading}>{section.klass}</Text>
              <MedicationGroupSection>
                {section.brands.map((b, i) => (
                  <MedicationCard
                    key={b.value}
                    brand={b.value}
                    label={b.label}
                    note={b.note}
                    selected={selectedBrand === b.value}
                    isCurrent={currentBrand === b.value}
                    isFirst={i === 0}
                    isLast={i === section.brands.length - 1}
                    onPress={() => onSelectBrand(b.value)}
                  />
                ))}
              </MedicationGroupSection>
            </View>
          ))
        )}
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginTop: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: c.textPrimary,
    fontFamily: 'System',
    paddingVertical: 0,
  },
  routeCaption: {
    ...TYPE.caption1,
    color: c.textSecondary,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  section: {
    marginTop: 6,
  },
  classHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: 'System',
    marginTop: 12,
    marginBottom: -4,
    marginLeft: 4,
  },
  empty: {
    ...TYPE.body,
    color: c.textSecondary,
    textAlign: 'center',
    marginTop: 28,
    fontFamily: 'System',
  },
});
