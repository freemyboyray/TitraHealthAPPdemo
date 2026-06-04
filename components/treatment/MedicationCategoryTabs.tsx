import React from 'react';

import { SlidingTabs } from '@/components/ui/sliding-tabs';

const TABS = [
  { key: '0' as const, label: 'Injection' },
  { key: '1' as const, label: 'Oral' },
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
