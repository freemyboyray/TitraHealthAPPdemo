import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useMemo, useState } from 'react';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { usePreferencesStore } from '@/stores/preferences-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';

export default function PrivacyScreen() {
  const { colors } = useAppTheme();
  const { aiDataConsent, setAiDataConsent, foodDbConsent, setFoodDbConsent } = usePreferencesStore();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    chevronRotation.value = withTiming(detailsOpen ? 1 : 0, {
      duration: 220,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [detailsOpen]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 180}deg` }],
  }));

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

          <Pressable
            style={s.disclosureRow}
            onPress={() => setDetailsOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="What am I sharing?"
            accessibilityState={{ expanded: detailsOpen }}
            hitSlop={8}
          >
            <IconSymbol name="info.circle" size={16} color={ORANGE} />
            <Text style={s.disclosureLabel}>What am I sharing?</Text>
            <Animated.View style={chevronStyle}>
              <IconSymbol name="chevron.down" size={14} color={colors.textSecondary} />
            </Animated.View>
          </Pressable>

          {detailsOpen && (
            <Animated.View
              style={s.detailsCard}
              entering={FadeIn.duration(220).easing(Easing.bezier(0.4, 0, 0.2, 1) as any)}
              exiting={FadeOut.duration(160)}
            >
              <View style={s.detailSection}>
                <View style={s.detailHeader}>
                  <View style={[s.iconBadge, { backgroundColor: 'rgba(255,116,42,0.15)' }]}>
                    <IconSymbol name="sparkles" size={16} color={ORANGE} />
                  </View>
                  <Text style={s.detailTitle}>AI Data (OpenAI)</Text>
                </View>
                <Text style={s.detailBody}>
                  When enabled, the app sends meal descriptions, food photos, voice transcripts, and chat messages to OpenAI to power Ask AI, voice logging, and AI meal capture.
                </Text>
                <Text style={s.detailBody}>
                  <Text style={s.detailBodyStrong}>Not shared:</Text> your name, email, weight, injection history, or other identifying health data.
                </Text>
              </View>

              <View style={s.detailDivider} />

              <View style={s.detailSection}>
                <View style={s.detailHeader}>
                  <View style={[s.iconBadge, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                    <IconSymbol name="fork.knife" size={16} color="#34C759" />
                  </View>
                  <Text style={s.detailTitle}>Food Database (FatSecret)</Text>
                </View>
                <Text style={s.detailBody}>
                  When enabled, food search queries and scanned barcodes are sent to FatSecret to return nutrition data.
                </Text>
                <Text style={s.detailBody}>
                  <Text style={s.detailBodyStrong}>Not shared:</Text> your account, meals you've logged, or any personal information.
                </Text>
              </View>
            </Animated.View>
          )}
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
    disclosureRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 16, marginHorizontal: 4, paddingVertical: 6,
    },
    disclosureLabel: { flex: 1, color: c.textPrimary, fontSize: 14, fontWeight: '600' },
    detailsCard: {
      backgroundColor: c.glassOverlay, borderRadius: 14, padding: 16, marginTop: 8,
      borderWidth: 1, borderTopColor: c.border, borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle, borderBottomColor: c.borderSubtle,
    },
    detailSection: { gap: 8 },
    detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
    detailTitle: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
    detailBody: { color: c.textSecondary, fontSize: 13, fontWeight: '400', lineHeight: 19 },
    detailBodyStrong: { color: c.textPrimary, fontWeight: '600' },
    detailDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginVertical: 14 },
  });
}
