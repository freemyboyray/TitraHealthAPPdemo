import { useRouter } from 'expo-router';

import { RecapCard } from '@/components/home/recap-card';

export type WeeklyCheckinCardProps = {
  /** ISO date string of the last time the unified weekly check-in was completed */
  lastLoggedAt: string | null;
  /** Whether the CURRENT program week's check-in is already done (gates re-takes). */
  currentWeekComplete: boolean;
  /** ISO date the next program week begins — when the check-in unlocks again. */
  nextAvailableAt?: string | null;
  /** When true, the card shows "Weekly Review" instead of "Weekly Check-In" */
  isDaily?: boolean;
  onDismiss?: () => void;
};

export function WeeklyCheckinCard({ currentWeekComplete, isDaily, onDismiss }: WeeklyCheckinCardProps) {
  const cardTitle = isDaily ? 'Weekly Review' : 'Weekly Check-In';
  const router = useRouter();

  if (!currentWeekComplete) {
    return (
      <RecapCard
        badge="CHECK-IN"
        title={cardTitle}
        headline="Your weekly check-in is ready."
        onPress={() => router.push('/entry/weekly-checkin' as any)}
        onDismiss={onDismiss}
        compact
      />
    );
  }

  return (
    <RecapCard
      badge="DONE"
      title={cardTitle}
      headline="You're all checked in this week."
      onPress={() => router.push('/entry/weekly-checkin-history' as any)}
      onDismiss={onDismiss}
      compact
    />
  );
}
