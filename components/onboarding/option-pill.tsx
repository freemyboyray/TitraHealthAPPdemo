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
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#252219',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  pillSelected: {
    backgroundColor: 'rgba(232,131,26,0.15)',
    borderColor: '#E8831A',
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
    color: '#FFFFFF',
  },
  labelSelected: {
    color: '#E8831A',
  },
  subtitle: {
    fontSize: 13,
    color: '#9A9490',
    marginTop: 1,
  },
  subtitleSelected: {
    color: 'rgba(232,131,26,0.65)',
  },
});
