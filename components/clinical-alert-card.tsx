import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import type { ClinicalFlag } from '@/lib/clinical-alerts';

const DISMISSED_KEY = 'titra_dismissed_flags';

export async function dismissFlag(flagType: string): Promise<void> {
  const raw = await AsyncStorage.getItem(DISMISSED_KEY);
  const dismissed: string[] = raw ? JSON.parse(raw) : [];
  if (!dismissed.includes(flagType)) {
    dismissed.push(flagType);
    await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  }
}

export async function getDismissedFlags(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(DISMISSED_KEY);
  return raw ? JSON.parse(raw) : [];
}

function getSeverityStyle(isDark: boolean): Record<
  ClinicalFlag['severity'],
  { border: string; icon: string; iconColor: string; badgeBg: string; badgeText: string }
> {
  const w = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return {
    action_required: {
      border: 'rgba(231,76,60,0.5)',
      icon: 'warning-outline',
      iconColor: '#E74C3C',
      badgeBg: 'rgba(231,76,60,0.15)',
      badgeText: '#E74C3C',
    },
    warning: {
      border: 'rgba(230,126,34,0.4)',
      icon: 'alert-circle-outline',
      iconColor: '#E67E22',
      badgeBg: 'rgba(230,126,34,0.12)',
      badgeText: '#E67E22',
    },
    info: {
      border: w(0.1),
      icon: 'information-circle-outline',
      iconColor: w(0.5),
      badgeBg: w(0.08),
      badgeText: w(0.55),
    },
  };
}

type Props = {
  flag: ClinicalFlag;
  onDismiss?: (type: string) => void;
};

export function ClinicalAlertCard({ flag, onDismiss }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const router = useRouter();
  const sty = getSeverityStyle(colors.isDark)[flag.severity];
  const [localDismissed, setLocalDismissed] = useState(false);

  if (localDismissed) return null;

  function handleDismiss() {
    dismissFlag(flag.type);
    setLocalDismissed(true);
    onDismiss?.(flag.type);
  }

  return (
    <View style={[s.wrap, { borderColor: sty.border }]}>
      <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />

      <View style={s.inner}>
        {/* Header row */}
        <View style={s.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Ionicons name={sty.icon as any} size={20} color={sty.iconColor} />
            <Text style={s.title} numberOfLines={2}>{flag.title}</Text>
          </View>
          {flag.dismissible && (
            <TouchableOpacity onPress={handleDismiss} hitSlop={10} style={s.closeBtn}>
              <Ionicons name="close" size={16} color={colors.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
            </TouchableOpacity>
          )}
        </View>

        {/* Body */}
        <Text style={s.body}>{flag.body}</Text>

        {/* Action button */}
        {flag.actionLabel && flag.actionRoute && (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => router.push(flag.actionRoute as any)}
            activeOpacity={0.8}
          >
            <Text style={s.actionText}>{flag.actionLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color="#FF742A" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
  wrap: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: c.surface,
    borderWidth: 1,
    marginBottom: 10,
    ...cardElevation(c.isDark),
  },
  inner: { padding: 18 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  title: {
    fontSize: 14, fontWeight: '700', color: c.textPrimary, flex: 1, lineHeight: 19,
  },
  body: {
    fontSize: 13, color: w(0.55), lineHeight: 19,
  },
  closeBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: w(0.06),
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, alignSelf: 'flex-start',
  },
  actionText: {
    fontSize: 13, fontWeight: '700', color: '#FF742A',
  },
  });
};
