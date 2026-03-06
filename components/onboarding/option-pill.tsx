import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';

const FF = 'Helvetica Neue';

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
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#000000',
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
    color: '#FFFFFF',
    fontFamily: FF,
  },
  labelSelected: {
    color: '#FF742A',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 1,
    fontFamily: FF,
  },
  subtitleSelected: {
    color: 'rgba(255,116,42,0.65)',
  },
});
