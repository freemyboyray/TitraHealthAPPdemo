import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo, useState } from 'react';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { usePreferencesStore } from '@/stores/preferences-store';
import { useRemindersStore } from '@/stores/reminders-store';
import { useHealthKitStore } from '@/stores/healthkit-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';


export default function PreferencesScreen() {
  const { colors } = useAppTheme();
  const { themeMode, setThemeMode, appleHealthEnabled } = usePreferencesStore();
  const { masterEnabled } = useRemindersStore();
  const { lastRefreshed, liveCategories } = useHealthKitStore();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const toggle = (key: string) => {
    setExpandedRow(prev => prev === key ? null : key);
  };
  const enter = FadeIn.duration(220).easing(Easing.bezier(0.4, 0, 0.2, 1) as any);
  const exit = FadeOut.duration(160);
  const layout = LinearTransition.duration(220).easing(Easing.bezier(0.4, 0, 0.2, 1) as any);

  const themeModes = ['system', 'light', 'dark'] as const;
  const themeLabels: Record<string, string> = { system: 'System', light: 'Light', dark: 'Dark' };

  return (
    <View style={s.safe}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
            <IconSymbol name="chevron.left" size={22} color={colors.orange} />
          </Pressable>
          <Text style={s.headerTitle}>Preferences</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Animated.View style={s.card} layout={layout}>
            {/* Appearance */}
            <Pressable style={s.cardRow} onPress={() => toggle('appearance')} accessibilityLabel="Appearance" accessibilityRole="button">
              <View style={s.rowLeft}>
                <View style={s.iconBadge}>
                  <IconSymbol name={themeMode === 'light' ? 'sun.max' : themeMode === 'dark' ? 'moon' : 'circle.lefthalf.filled'} size={18} color={colors.textPrimary} />
                </View>
                <Text style={s.rowLabel}>Appearance</Text>
              </View>
              <View style={s.rowRight}>
                <Text style={s.rowValue}>{themeLabels[themeMode]}</Text>
                <IconSymbol name={expandedRow === 'appearance' ? 'chevron.down' : 'chevron.right'} size={16} color={colors.textMuted} />
              </View>
            </Pressable>
            {expandedRow === 'appearance' && (
              <Animated.View style={s.expandedContent} entering={enter} exiting={exit}>
                {themeModes.map((mode) => (
                  <Pressable key={mode} style={s.optionRow} onPress={() => setThemeMode(mode)} accessibilityLabel={themeLabels[mode]} accessibilityRole="button" accessibilityState={{ selected: themeMode === mode }}>
                    <Text style={[s.optionLabel, themeMode === mode && { color: colors.orange, fontWeight: '700' }]}>{themeLabels[mode]}</Text>
                    {themeMode === mode && <IconSymbol name="checkmark" size={16} color={colors.orange} />}
                  </Pressable>
                ))}
              </Animated.View>
            )}

            <View style={s.divider} />

            {/* Reminders */}
            <Pressable style={s.cardRow} onPress={() => router.push('/settings/reminders')} accessibilityLabel="Reminders" accessibilityRole="button">
              <View style={s.rowLeft}>
                <View style={s.iconBadge}>
                  <IconSymbol name="bell" size={18} color={colors.textPrimary} />
                </View>
                <Text style={s.rowLabel}>Reminders</Text>
              </View>
              <View style={s.rowRight}>
                <Text style={s.rowValue}>{masterEnabled ? 'On' : 'Off'}</Text>
                <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
              </View>
            </Pressable>

            <View style={s.divider} />

            {/* Health Data Sync */}
            <Pressable style={s.cardRow} onPress={() => router.push(Platform.OS === 'ios' ? '/settings/apple-health' as any : '/settings/health-connect' as any)} accessibilityLabel={Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'} accessibilityRole="button">
              <View style={s.rowLeft}>
                <View style={s.iconBadge}>
                  <IconSymbol name="heart" size={18} color={colors.textPrimary} />
                </View>
                <Text style={s.rowLabel}>{Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect'}</Text>
              </View>
              <View style={s.rowRight}>
                <Text style={s.rowValue}>{appleHealthEnabled ? 'Connected' : 'Off'}</Text>
                <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    content: { padding: 16, paddingBottom: 60 },
    card: {
      backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderTopColor: c.border, borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle, borderBottomColor: c.borderSubtle,
    },
    cardRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    iconBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { color: c.textPrimary, fontSize: 17, fontWeight: '600' },
    rowValue: { color: c.textSecondary, fontSize: 15, fontWeight: '500' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginLeft: 64, marginRight: 16 },
    expandedContent: {
      marginLeft: 64, marginRight: 16, marginBottom: 12,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderRadius: 10, overflow: 'hidden',
    },
    optionRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
    },
    optionLabel: { color: c.textPrimary, fontSize: 16, fontWeight: '500' },
  });
}
