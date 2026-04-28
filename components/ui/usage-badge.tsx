import { Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/theme-context';
import { useSubscriptionStore, type FeatureKey } from '../../stores/subscription-store';
import { ORANGE } from '../../constants/theme';

type Props = {
  feature: FeatureKey;
};

/** Shows remaining free quota for a metered feature, or a "PRO" pill for premium users. */
export function UsageBadge({ feature }: Props) {
  const { colors } = useAppTheme();
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const limit = useSubscriptionStore((s) => s.getFeatureLimit(feature));

  if (isPremium) {
    return (
      <View
        style={{
          backgroundColor: 'rgba(255,116,42,0.15)',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: ORANGE, fontSize: 13, fontWeight: '600' }}>PRO</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>{limit} free/day</Text>
    </View>
  );
}
