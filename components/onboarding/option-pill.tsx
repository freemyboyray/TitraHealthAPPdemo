import React, { useMemo } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'Inter_400Regular';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  subtitle?: string;
};

export function OptionPill({ label, selected, onPress, icon, subtitle }: Props) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[s.pill, selected && s.pillSelected]}>
      <View style={s.inner}>
        {icon && <View style={s.iconWrap}>{icon}</View>}
        <View style={s.textWrap}>
          <Text style={[s.label, selected && s.labelSelected]}>{label}</Text>
          {subtitle && (
            <Text style={[s.subtitle, selected && s.subtitleSelected]}>{subtitle}</Text>
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
      height: 56,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: w(0.12),
      backgroundColor: c.bg,
      justifyContent: 'center',
      paddingHorizontal: 18,
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
      fontSize: 16,
      fontWeight: '600',
      color: c.textPrimary,
      fontFamily: FF,
    },
    labelSelected: {
      color: '#FF742A',
    },
    subtitle: {
      fontSize: 13,
      color: c.textSecondary,
      marginTop: 1,
      fontFamily: FF,
    },
    subtitleSelected: {
      color: 'rgba(255,116,42,0.65)',
    },
  });
};
