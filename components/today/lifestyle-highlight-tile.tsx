import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { useHealthData } from '@/contexts/health-data';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { useLogStore } from '@/stores/log-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { localDateStr } from '@/lib/date-utils';
import { runLifestylePipeline } from '@/lib/lifestyle-insights';
import { LucideIconByName } from '@/lib/lucide-icon-map';

export function LifestyleHighlightTile() {
  const { colors } = useAppTheme();
  const foodLogs = useLogStore(s => s.foodLogs);
  const activityLogs = useLogStore(s => s.activityLogs);
  const sideEffectLogs = useLogStore(s => s.sideEffectLogs);
  const injectionLogs = useLogStore(s => s.injectionLogs);
  const hkSteps = useHealthKitStore(s => s.steps);
  const hkSleep = useHealthKitStore(s => s.sleepHours);
  const hkHrv = useHealthKitStore(s => s.hrv);
  const hkRhr = useHealthKitStore(s => s.restingHR);
  const appleHealthEnabled = usePreferencesStore(s => s.appleHealthEnabled);
  const { targets } = useHealthData();

  const todayStr = localDateStr();

  const card = useMemo(() => {
    const cards = runLifestylePipeline({
      foodLogs,
      activityLogs,
      sideEffectLogs,
      injectionLogs,
      hk: {
        enabled: appleHealthEnabled,
        steps: hkSteps,
        sleepHours: hkSleep,
        hrv: hkHrv,
        restingHR: hkRhr,
      },
      targets,
      todayStr,
    });
    return cards[0] ?? null;
  }, [foodLogs, activityLogs, sideEffectLogs, injectionLogs,
    appleHealthEnabled, hkSteps, hkSleep, hkHrv, hkRhr, targets, todayStr]);

  if (!card) return null;

  const tc = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const onCardPress = () => {
    Haptics.selectionAsync();
    if (card.cta) router.push(card.cta.route as never);
    else router.push('/(tabs)/log' as never);
  };

  return (
    <Pressable
      style={{ flex: 1, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 }}
      onPress={onCardPress}
      accessibilityLabel={`${card.tagline}: ${card.title}`}
      accessibilityRole="button"
    >
      {/* Tagline + icon row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <View style={{
          width: 32, height: 32, borderRadius: 10,
          backgroundColor: `${card.iconColor}22`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <LucideIconByName name={card.icon as never} size={18} color={card.iconColor} />
        </View>
        <Text style={{
          fontSize: 11, fontWeight: '800', color: card.iconColor,
          letterSpacing: 1.4, fontFamily: 'System',
        }}>
          {card.tagline}
        </Text>
      </View>

      {/* Title */}
      <Text
        style={{
          fontSize: 18, fontWeight: '800', color: colors.textPrimary,
          letterSpacing: -0.4, fontFamily: 'System', marginBottom: 6, lineHeight: 24,
        }}
        numberOfLines={2}
      >
        {card.title}
      </Text>

      {/* Body */}
      {card.body && (
        <Text
          style={{
            fontSize: 14, color: tc(0.6), fontFamily: 'System',
            lineHeight: 20, marginBottom: card.cta ? 12 : 0,
          }}
          numberOfLines={2}
        >
          {card.body}
        </Text>
      )}

      {/* CTA */}
      {card.cta && (
        <TouchableOpacity
          onPress={onCardPress}
          activeOpacity={0.85}
          style={{
            alignSelf: 'flex-start',
            paddingHorizontal: 14, paddingVertical: 9,
            borderRadius: 12, backgroundColor: card.iconColor,
          }}
        >
          <Text style={{
            fontSize: 14, fontWeight: '700', color: '#FFF',
            fontFamily: 'System',
          }}>
            {card.cta.label}
          </Text>
        </TouchableOpacity>
      )}
    </Pressable>
  );
}
