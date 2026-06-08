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
  /** Stretch to fill height (for the side-by-side recap carousel). */
  fill?: boolean;
};

export function WeeklyCheckinCard({ currentWeekComplete, isDaily, fill }: WeeklyCheckinCardProps) {
  const cardTitle = isDaily ? 'Weekly Review' : 'Weekly Check-In';
  const router = useRouter();

  if (!currentWeekComplete) {
    return (
      <RecapCard
        badge="Check-in"
        tone="orange"
        eyebrow={cardTitle}
        headline="How was your week?"
        caption="7 quick areas · about 3 minutes. Your answers fine-tune this week’s targets."
        cta="Start check-in"
        onPress={() => router.push('/entry/weekly-checkin' as any)}
        fill={fill}
      />
    );
  }

  return (
    <RecapCard
      badge="Completed"
      tone="positive"
      eyebrow={cardTitle}
      headline="You’re all checked in."
      caption="Nicely done — your targets are tuned for the week."
      cta="Review answers"
      onPress={() => router.push('/entry/weekly-checkin-history' as any)}
      fill={fill}
    />
  );
}
