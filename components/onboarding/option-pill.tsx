import React, { useMemo } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'System';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  subtitle?: string;
  // Opt-in: when selected, fill solid orange with white text (instead of the
  // default light orange tint). Used on the medication screen.
  solidSelect?: boolean;
};

export function OptionPill({ label, selected, onPress, icon, subtitle, solidSelect }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[s.pill, selected && (solidSelect ? s.pillSolid : s.pillSelected)]}>
      <View style={s.inner}>
        {icon && <View style={s.iconWrap}>{icon}</View>}
        <View style={s.textWrap}>
          <Text style={[s.label, selected && (solidSelect ? s.labelSolid : s.labelSelected)]}>{label}</Text>
          {subtitle && (
            <Text style={[s.subtitle, selected && (solidSelect ? s.subtitleSolid : s.subtitleSelected)]}>{subtitle}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    pill: {
      minHeight: 56,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: w(0.12),
      backgroundColor: c.bg,
      justifyContent: 'center',
      paddingHorizontal: 18,
      paddingVertical: 12,
      marginBottom: 10,
    },
    pillSelected: {
      backgroundColor: 'rgba(255,116,42,0.12)',
      borderColor: '#FF742A',
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    iconWrap: {
      marginRight: 12,
    },
    textWrap: {
      flex: 1,
    },
    label: {
      fontSize: 18,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: FF,
    },
    labelSelected: {
      color: '#FF742A',
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      marginTop: 1,
      fontFamily: FF,
    },
    subtitleSelected: {
      color: 'rgba(255,116,42,0.65)',
    },
    pillSolid: {
      backgroundColor: '#FF742A',
      borderColor: '#FF742A',
    },
    labelSolid: {
      color: '#FFFFFF',
    },
    subtitleSolid: {
      color: 'rgba(255,255,255,0.85)',
    },
  });
};
