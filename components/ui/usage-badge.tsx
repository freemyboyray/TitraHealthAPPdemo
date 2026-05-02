import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '../../contexts/theme-context';
import { useSubscriptionStore, type FeatureKey } from '../../stores/subscription-store';
import { ORANGE } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

type Props = {
  feature: FeatureKey;
};

/** Shows remaining free quota for a metered feature, or a "PRO" pill for premium users. */
export function UsageBadge({ feature }: Props) {
  const { colors } = useAppTheme();
  const isPremium = useSubscriptionStore((s) => s.isPremium);
  const limit = useSubscriptionStore((s) => s.getFeatureLimit(feature));
  const [used, setUsed] = useState<number | null>(null);

  const fetchUsage = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('usage_tracking')
      .select('count')
      .eq('user_id', user.id)
      .eq('feature_key', feature)
      .eq('date', today)
      .maybeSingle();
    setUsed(data?.count ?? 0);
  }, [feature]);

  useFocusEffect(useCallback(() => { fetchUsage(); }, [fetchUsage]));

  // Poll periodically so the count updates after sending a message
  useEffect(() => {
    if (isPremium) return;
    const interval = setInterval(fetchUsage, 10_000);
    return () => clearInterval(interval);
  }, [isPremium, fetchUsage]);

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

  const remaining = used != null ? Math.max(0, limit - used) : limit;
  const label = remaining === 1 ? '1 message remaining' : `${remaining} messages remaining`;

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ color: remaining === 0 ? '#E74C3C' : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
        {remaining === 0 ? 'No messages left' : label}
      </Text>
      <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '600', marginTop: 1 }}>
        Upgrade for unlimited
      </Text>
    </View>
  );
}
