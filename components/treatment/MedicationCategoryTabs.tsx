import React from 'react';

import { SlidingTabs } from '@/components/ui/sliding-tabs';

const TABS = [
  { key: '0' as const, label: 'Weekly' },
  { key: '1' as const, label: 'Daily Inj.' },
  { key: '2' as const, label: 'Oral' },
  { key: '3' as const, label: 'Other' },
];

type Props = {
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export function MedicationCategoryTabs({ selectedIndex, onSelect }: Props) {
  return (
    <SlidingTabs
      tabs={TABS}
      activeKey={String(selectedIndex)}
      onChange={(key) => onSelect(Number(key))}
    />
  );
}
