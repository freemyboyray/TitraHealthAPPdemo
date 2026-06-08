import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';

import { RecapCard } from '@/components/home/recap-card';
import type { WeeklySummaryData } from '@/lib/weekly-summary';
import type { WeeklySummaryRow } from '@/stores/log-store';

const FF = 'System';
const GREEN = '#27AE60';
const RED = '#E53E3E';

export type WeeklySummaryCardProps = {
  latestSummary: WeeklySummaryRow | null;
  /** Whether the user has already opened this latest summary (hides the "New" badge). */
  viewed?: boolean;
  /** Called when the card is opened, so the parent can mark it viewed. */
  onView?: () => void;
  /** Stretch to fill height (for the side-by-side recap carousel). */
  fill?: boolean;
};

function formatDay(d: string) {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return d; }
}

/** Small weight-delta chip used as the card's real-data accent. */
function DeltaChip({ delta }: { delta: number }) {
  const down = delta <= 0;
  const color = down ? GREEN : RED;
  return (
    <View style={[styles.chip, { backgroundColor: color + '1F' }]}>
      {down ? <TrendingDown size={13} color={color} /> : <TrendingUp size={13} color={color} />}
      <Text style={[styles.chipText, { color }]}>
        {delta > 0 ? '+' : ''}{delta.toFixed(1)} lbs this week
      </Text>
    </View>
  );
}

export function WeeklySummaryCard({ latestSummary, viewed, onView, fill }: WeeklySummaryCardProps) {
  const router = useRouter();
  const handleView = () => {
    onView?.();
    router.push('/entry/weekly-summary' as any);
  };

  if (!latestSummary) {
    return (
      <RecapCard
        badge="Soon"
        tone="neutral"
        eyebrow="Weekly Summary"
        headline="Your first recap lands after week 1."
        caption="We’ll pull together your weight, nutrition, and activity automatically."
        cta="Preview"
        onPress={handleView}
        fill={fill}
      />
    );
  }

  const data = latestSummary.summary_data as unknown as WeeklySummaryData;
  const delta = data?.weight?.delta ?? null;
  const daysLogged = data?.nutrition?.daysLogged ?? null;
  const range = data?.windowStart && data?.windowEnd
    ? ` (${formatDay(data.windowStart)} – ${formatDay(data.windowEnd)})`
    : '';

  return (
    <RecapCard
      badge={viewed ? undefined : 'New'}
      tone="orange"
      eyebrow={`Weekly Summary${range}`}
      headline="Your week, recapped."
      caption={daysLogged != null ? `${daysLogged} of 7 days logged` : undefined}
      accent={delta != null ? <DeltaChip delta={delta} /> : undefined}
      cta="View summary"
      onPress={handleView}
      fill={fill}
    />
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  chipText: { fontSize: 13, fontWeight: '700', fontFamily: FF },
});
