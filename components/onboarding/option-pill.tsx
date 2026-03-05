import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  subtitle?: string;
};

export function OptionPill({ label, selected, onPress, icon, subtitle }: Props) {
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

const s = StyleSheet.create({
  pill: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  pillSelected: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
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
    color: '#1A1A1A',
  },
  labelSelected: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#888888',
    marginTop: 1,
  },
  subtitleSelected: {
    color: 'rgba(255,255,255,0.65)',
  },
});
