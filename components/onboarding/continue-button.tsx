import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const FF = 'Inter_400Regular';

type Props = {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
};

export function ContinueButton({ onPress, disabled, label = 'Continue' }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[s.wrapper, { paddingBottom: Math.max(insets.bottom, 24) }]}>
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        style={[s.btn, disabled && s.btnDisabled]}>
        <Text style={s.label}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  wrapper: {
    paddingTop: 16,
    backgroundColor: c.bg,
  },
  btn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: c.isDark ? '#FFFFFF' : '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: c.isDark ? '#000000' : '#FFFFFF',
    letterSpacing: 0.2,
    fontFamily: FF,
  },
});
