import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Sparkles } from 'lucide-react-native';

import { useAiConsentStore } from '@/stores/ai-consent-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const PRIVACY_URL = 'https://titrahealth.io/privacy-policy';

/**
 * Point-of-first-use AI consent dialog. Mounted once at the app root; opened
 * imperatively via `ensureAiConsent()` (lib/ai-consent.ts). Tapping Allow
 * resolves the awaiting promise as granted and persists consent; Not now /
 * dismiss resolves as denied.
 */
export function AiConsentModal() {
  const { colors } = useAppTheme();
  const visible = useAiConsentStore((s) => s.visible);
  const allow = useAiConsentStore((s) => s.allow);
  const deny = useAiConsentStore((s) => s.deny);
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={deny}>
      <Pressable style={s.backdrop} onPress={deny}>
        {/* Stop propagation so taps inside the card don't dismiss. */}
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.iconBadge}>
            <Sparkles size={24} color={colors.orange} />
          </View>

          <Text style={s.title}>Enable AI features?</Text>

          <Text style={s.body}>
            To power Ask AI, food analysis, and voice logging, Titra sends the data for the
            feature you use to{' '}
            <Text style={s.bodyStrong}>OpenAI, a third-party AI provider</Text>:
          </Text>

          <View style={s.list}>
            <Text style={s.listItem}>• Your chat messages and food descriptions</Text>
            <Text style={s.listItem}>• Food photos you capture</Text>
            <Text style={s.listItem}>• Voice recordings (for transcription)</Text>
            <Text style={s.listItem}>
              • Wellness context: medication, dose, weight progress, scores, and side effects
            </Text>
          </View>

          <Text style={s.body}>
            <Text style={s.bodyStrong}>Never sent:</Text> your name, email, or account ID. OpenAI
            doesn't train on this data and deletes it within 30 days. You can turn this off anytime
            in Settings → Privacy &amp; Data.
          </Text>

          <Pressable
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
            hitSlop={8}
            accessibilityRole="link"
          >
            <Text style={s.link}>View Privacy Policy</Text>
          </Pressable>

          <Pressable
            onPress={allow}
            style={({ pressed }) => [s.allowBtn, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Allow AI features"
          >
            <Text style={s.allowText}>Allow</Text>
          </Pressable>

          <Pressable
            onPress={deny}
            style={({ pressed }) => [s.denyBtn, pressed && s.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={s.denyText}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: c.surface,
      borderRadius: 22,
      padding: 24,
      borderWidth: 1,
      borderTopColor: c.border,
      borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle,
      borderBottomColor: c.borderSubtle,
    },
    iconBadge: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: 'rgba(255,116,42,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: c.textPrimary,
      marginBottom: 12,
      fontFamily: 'System',
    },
    body: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 20,
      fontFamily: 'System',
      marginBottom: 12,
    },
    bodyStrong: { color: c.textPrimary, fontWeight: '700' },
    list: { gap: 6, marginBottom: 12 },
    listItem: { fontSize: 14, color: c.textSecondary, lineHeight: 20, fontFamily: 'System' },
    link: {
      fontSize: 14,
      color: c.orange,
      fontWeight: '600',
      marginBottom: 20,
      fontFamily: 'System',
    },
    allowBtn: {
      backgroundColor: c.orange,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: 'center',
      marginBottom: 10,
    },
    allowText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', fontFamily: 'System' },
    denyBtn: { borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    denyText: { color: c.textSecondary, fontSize: 16, fontWeight: '600', fontFamily: 'System' },
    pressed: { opacity: 0.85 },
  });
