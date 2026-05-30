import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/contexts/theme-context';
import { useLogStore } from '@/stores/log-store';
import { ChevronRight } from 'lucide-react-native';


/**
 * Lifestyle-tab entry point that opens the full Top Contributors screen.
 * Compact preview row matching the app's standard card chrome.
 */
export function TopContributorsRow() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const tc = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const foodLogs = useLogStore(s => s.foodLogs);

  // Tiny preview: top 3 protein contributors over the last 7 days as a stacked bar.
  const preview = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    const groups = new Map<string, number>();
    let total = 0;
    for (const f of foodLogs) {
      if (!f.logged_at || new Date(f.logged_at).getTime() < cutoff) continue;
      const key = f.fatsecret_category_name ?? 'Uncategorized';
      const v = f.protein_g ?? 0;
      groups.set(key, (groups.get(key) ?? 0) + v);
      total += v;
    }
    if (total <= 0) return null;
    const sorted = Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
    const top3 = sorted.slice(0, 3);
    const otherTotal = total - top3.reduce((s, [, v]) => s + v, 0);
    const slices: { name: string; pct: number }[] = top3.map(([name, v]) => ({ name, pct: v / total }));
    if (otherTotal > 0) slices.push({ name: 'Other', pct: otherTotal / total });
    return slices;
  }, [foodLogs]);

  // Match LifestyleTrendCard's metric color palette so the preview reads as
  // "different categories" rather than arbitrary hues.
  const sliceColors = ['#FF742A', '#5B8BF5', '#27AE60', tc(0.18)];

  return (
    <Pressable
      onPress={() => router.push('/top-contributors')}
      style={({ pressed }) => ({
        marginTop: 28,
        marginBottom: 16,
        borderRadius: 24,
        backgroundColor: colors.surface,
        borderWidth: 0.5,
        borderColor: colors.border,
        padding: 18,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{
            fontSize: 17, fontWeight: '700', color: colors.textPrimary,
            fontFamily: 'System', letterSpacing: -0.2,
          }}>
            Top Contributors
          </Text>
          <Text style={{
            fontSize: 13, color: tc(0.5), fontFamily: 'System', marginTop: 3,
          }}>
            Where your protein, sodium, and fat come from
          </Text>
        </View>
        <ChevronRight size={20} color={tc(0.35)} />
      </View>
      {preview && (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: tc(0.06) }}>
            {preview.map((s, i) => (
              <View
                key={`${s.name}-${i}`}
                style={{ width: `${Math.max(2, s.pct * 100)}%`, backgroundColor: sliceColors[i] ?? sliceColors[3] }}
              />
            ))}
          </View>
        </View>
      )}
    </Pressable>
  );
}
