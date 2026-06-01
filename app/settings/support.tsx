import { IconSymbol } from '@/components/ui/icon-symbol';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMemo } from 'react';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';


export default function SupportScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={s.safe}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
            <IconSymbol name="chevron.left" size={22} color={colors.orange} />
          </Pressable>
          <Text style={s.headerTitle}>Support & Legal</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.card}>
            <Pressable style={s.cardRow} onPress={() => WebBrowser.openBrowserAsync('https://embed-245422884.sleekplan.app/?hide_elements[]=footer#/feedback/')} accessibilityLabel="Send Feedback" accessibilityRole="button">
              <View style={s.rowLeft}>
                <View style={[s.iconBadge, { backgroundColor: 'rgba(50,173,230,0.15)' }]}>
                  <IconSymbol name="exclamationmark.bubble.fill" size={18} color="#32ADE6" />
                </View>
                <Text style={s.rowLabel}>Send Feedback</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
            </Pressable>

            <View style={s.divider} />

            <Pressable style={s.cardRow} onPress={() => router.push('/settings/legal' as any)} accessibilityLabel="Terms & Privacy" accessibilityRole="button">
              <View style={s.rowLeft}>
                <View style={[s.iconBadge, { backgroundColor: 'rgba(88,86,214,0.15)' }]}>
                  <IconSymbol name="doc.text.fill" size={18} color="#5856D6" />
                </View>
                <Text style={s.rowLabel}>Terms & Privacy</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
            </Pressable>

            <View style={s.divider} />

            <Pressable style={s.cardRow} onPress={() => router.push('/settings/medical-sources' as any)} accessibilityLabel="Medical Sources" accessibilityRole="button">
              <View style={s.rowLeft}>
                <View style={[s.iconBadge, { backgroundColor: 'rgba(52,199,89,0.15)' }]}>
                  <IconSymbol name="book.fill" size={18} color="#34C759" />
                </View>
                <Text style={s.rowLabel}>Medical Sources</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
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
    iconBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { color: c.textPrimary, fontSize: 17, fontWeight: '600' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.borderSubtle, marginLeft: 64, marginRight: 16 },
  });
}
