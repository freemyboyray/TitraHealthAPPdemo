import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

const FF = 'System';

// White "Monthly Recap"-style highlight card (matches the reference app).
// Black pill badge + title + optional close, then a big bold headline.
// `compact` shrinks it for half-width row placement (drops the title text).
export function RecapCard({
  badge,
  title,
  headline,
  onPress,
  onDismiss,
  compact = false,
}: {
  badge: string;
  title: string;
  headline: string;
  onPress: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      style={[s.card, compact && s.cardCompact]}
      onPress={onPress}
      accessibilityLabel={`${title}. ${headline}`}
      accessibilityRole="button"
    >
      {/* Decorative faint circles (reference flourish) */}
      <View pointerEvents="none" style={[s.circle, compact
        ? { width: 90, height: 90, right: -26, top: 14 }
        : { width: 120, height: 120, right: -28, top: 18 }]} />
      {!compact && <View pointerEvents="none" style={[s.circle, { width: 96, height: 96, right: 44, top: 30 }]} />}

      <View style={[s.topRow, compact && { marginBottom: 14 }]}>
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
        {!compact && <Text style={s.title}>{title}</Text>}
        <View style={{ flex: 1 }} />
        {onDismiss && (
          <Pressable
            onPress={(e) => { e.stopPropagation(); onDismiss(); }}
            hitSlop={10}
            accessibilityLabel={`Dismiss ${title}`}
            accessibilityRole="button"
          >
            <X size={20} color="rgba(0,0,0,0.4)" />
          </Pressable>
        )}
      </View>

      <Text style={[s.headline, compact && s.headlineCompact]}>{headline}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  cardCompact: {
    flex: 1,
    minHeight: 150,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.045)',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  badge: {
    backgroundColor: '#0A0A0A',
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', fontFamily: FF, letterSpacing: 0.5 },
  title: { fontSize: 18, fontWeight: '700', color: '#111111', fontFamily: FF, letterSpacing: -0.3 },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0A0A0A',
    fontFamily: FF,
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  headlineCompact: {
    fontSize: 20,
    letterSpacing: -0.5,
    lineHeight: 24,
  },
});
