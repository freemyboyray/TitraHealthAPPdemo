import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const ORANGE = '#FF742A';

type Props = {
  label: string;
  value?: string;
  onDismiss: () => void;
};

export function ContextPill({ label, value, onDismiss }: Props) {
  return (
    <View style={s.pill}>
      <View style={s.dot} />
      <Text style={s.text} numberOfLines={1}>
        {label}
        {value ? <Text style={s.value}> · {value}</Text> : null}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={10} style={s.closeBtn}>
        <Ionicons name="close" size={13} color={ORANGE} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255,116,42,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,116,42,0.30)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    gap: 6,
    maxWidth: '85%',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
    flexShrink: 0,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    color: ORANGE,
    letterSpacing: 0.5,
    flex: 1,
  },
  value: {
    fontWeight: '500',
    color: 'rgba(255,116,42,0.75)',
  },
  closeBtn: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
