import { useRouter } from 'expo-router';

import { RecapCard } from '@/components/home/recap-card';
import type { WeeklySummaryRow } from '@/stores/log-store';

export type WeeklySummaryCardProps = {
  latestSummary: WeeklySummaryRow | null;
  onDismiss?: () => void;
};

export function WeeklySummaryCard({ latestSummary, onDismiss }: WeeklySummaryCardProps) {
  const router = useRouter();
  const handleView = () => router.push('/entry/weekly-summary' as any);

  if (!latestSummary) {
    return (
      <RecapCard
        badge="SOON"
        title="Weekly Summary"
        headline="Your first recap lands after week 1."
        onPress={handleView}
        onDismiss={onDismiss}
        compact
      />
    );
  }

  return (
    <RecapCard
      badge="NEW"
      title="Weekly Summary"
      headline="Your week, recapped."
      onPress={handleView}
      onDismiss={onDismiss}
    />
  );
}
