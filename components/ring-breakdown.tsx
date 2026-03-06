import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { height: SCREEN_H } = Dimensions.get('window');
const ORANGE = '#FF742A';

type BreakdownRow = { label: string; actual: number; max: number };

type RingBreakdownProps = {
  visible: boolean;
  title: string;
  color: string;
  rows: BreakdownRow[];
  rowNotes?: string[];
  coachNote?: string;
  onClose: () => void;
};

export function RingBreakdown({ visible, title, color, rows, rowNotes, coachNote, onClose }: RingBreakdownProps) {
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, {
        toValue: 0,
        damping: 22,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: SCREEN_H,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const total = rows.reduce((sum, r) => sum + r.max, 0);
  const actual = rows.reduce((sum, r) => sum + r.actual, 0);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={[styles.totalScore, { color }]}>{actual} / {total}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Rows */}
          {rows.map((row, i) => {
            const pct = row.max > 0 ? row.actual / row.max : 0;
            const note = rowNotes?.[i];
            return (
              <View key={row.label} style={styles.rowGroup}>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
                  </View>
                  <Text style={[styles.rowScore, { color }]}>{row.actual}<Text style={styles.rowMax}>/{row.max}</Text></Text>
                </View>
                {note && <Text style={styles.rowNote}>{note}</Text>}
              </View>
            );
          })}

          {/* Coach section */}
          {coachNote && (
            <View style={styles.coachSection}>
              <Text style={styles.coachLabel}>WHAT MOVES THIS SCORE</Text>
              <Text style={styles.coachText}>{coachNote}</Text>
            </View>
          )}

          <Text style={styles.footer}>Tap outside to dismiss</Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111111',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 48,
    maxHeight: SCREEN_H * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  totalScore: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  rowGroup: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    width: 76,
    fontSize: 13,
    fontWeight: '600',
    color: '#9A9490',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 10,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
  rowScore: {
    width: 36,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  rowMax: {
    fontSize: 11,
    fontWeight: '400',
    color: '#5A5754',
  },
  rowNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#6A6764',
    marginTop: 3,
    marginBottom: 8,
    lineHeight: 17,
    paddingLeft: 76 + 10,
  },
  coachSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  coachLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: ORANGE,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  coachText: {
    fontSize: 13,
    color: '#9A9490',
    lineHeight: 20,
  },
  footer: {
    fontSize: 11,
    color: '#5A5754',
    textAlign: 'center',
    marginTop: 16,
  },
});
