import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FF = 'Helvetica Neue';

type Props = {
  onPress: () => void;
  disabled?: boolean;
  label?: string;
};

export function ContinueButton({ onPress, disabled, label = 'Continue' }: Props) {
  const insets = useSafeAreaInsets();

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

const s = StyleSheet.create({
  wrapper: {
    paddingTop: 16,
    backgroundColor: '#000000',
  },
  btn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.2,
    fontFamily: FF,
  },
});
