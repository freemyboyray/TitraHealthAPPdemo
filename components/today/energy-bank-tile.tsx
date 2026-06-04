import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { EnergyBankCard } from '@/components/energy-bank-card';
import { useSubscriptionStore } from '@/stores/subscription-store';
import type { EnergyBankResult } from '@/constants/scoring';

type Props = {
  result: EnergyBankResult;
  phase: string;
};

export function EnergyBankTile({ result, phase }: Props) {
  const router = useRouter();
  const isPremium = useSubscriptionStore(st => st.isPremium);

  const onPress = () => {
    if (isPremium) router.push('/energy-detail' as any);
    else router.push('/settings/subscription' as any);
  };

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={onPress}
      accessibilityLabel={isPremium
        ? `Energy Bank ${result.score}%, ${result.label}`
        : 'Energy Bank: premium feature, tap to unlock'}
      accessibilityRole="button"
    >
      <EnergyBankCard result={result} phase={phase} bare />
    </Pressable>
  );
}
