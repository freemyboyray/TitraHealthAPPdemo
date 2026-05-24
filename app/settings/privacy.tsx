import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';

import { usePreferencesStore } from '@/stores/preferences-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';

export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const { aiDataConsent, setAiDataConsent, foodDbConsent, setFoodDbConsent } = usePreferencesStore();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={s.safe}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
            <IconSymbol name="chevron.left" size={22} color={ORANGE} />
          </Pressable>
          <Text style={s.headerTitle}>Privacy & Data</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <View style={s.cardRow}>
              <View style={s.rowLeft}>
                <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                  <IconSymbol name="sparkles" size={18} color={ORANGE} />
                </View>
                <Text style={s.rowLabel}>AI Data</Text>
              </View>
              <Switch value={aiDataConsent} onValueChange={setAiDataConsent} trackColor={{ true: ORANGE }} accessibilityLabel="AI Data Processing" />
            </View>

            <View style={s.divider} />

            <View style={s.cardRow}>
              <View style={s.rowLeft}>
                <View style={[s.iconBadge, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                  <IconSymbol name="fork.knife" size={18} color="#34C759" />
                </View>
                <Text style={s.rowLabel}>Food Database</Text>
              </View>
              <Switch value={foodDbConsent} onValueChange={setFoodDbConsent} trackColor={{ true: ORANGE }} accessibilityLabel="Food Database" />
            </View>
          </View>

          <Text style={s.footer}>
            These features are optional. Disabling them will prevent the app from sending data to third-party services.
          </Text>
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
      backgroundColor: c.glassOverlay, borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderTopColor: c.border, borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle, borderBottomColor: c.borderSubtle,
    },
    cardRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    iconBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { color: c.textPrimary, fontSize: 17, fontWeight: '600' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginLeft: 64, marginRight: 16 },
    footer: { color: c.textSecondary, fontSize: 13, fontWeight: '500', marginTop: 12, marginHorizontal: 4, lineHeight: 18 },
  });
}
