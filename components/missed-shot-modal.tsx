import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassBorder } from '@/components/ui/glass-border';

const ORANGE = '#FF742A';
const FF = 'Helvetica Neue';

type MissedShotModalProps = {
  visible: boolean;
  onClose: () => void;
  expectedShotDate: string;   // YYYY-MM-DD
  overdueDays: number;        // Math.abs(rawDaysUntil)
  lastDoseMg: number;
  addInjectionLog: (dose_mg: number, injection_date: string) => Promise<void>;
  isOral?: boolean;
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
}

export function MissedShotModal({
  visible,
  onClose,
  expectedShotDate,
  overdueDays,
  lastDoseMg,
  addInjectionLog,
  isOral = false,
}: MissedShotModalProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState<'question' | 'latePicker'>('question');
  const [lateDateValue, setLateDateValue] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setMode('question');
      setLateDateValue(new Date(expectedShotDate + 'T12:00:00'));
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  function dismiss() {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      onClose();
    });
  }

  async function handleLogExpected() {
    setLoading(true);
    try {
      await addInjectionLog(lastDoseMg, expectedShotDate);
    } finally {
      setLoading(false);
      dismiss();
    }
  }

  async function handleLogLate() {
    const dateStr = lateDateValue.toISOString().split('T')[0];
    setLoading(true);
    try {
      await addInjectionLog(lastDoseMg, dateStr);
    } finally {
      setLoading(false);
      dismiss();
    }
  }

  if (!visible) return null;

  const minDate = new Date(expectedShotDate + 'T00:00:00');
  const maxDate = new Date();

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { zIndex: 9998, opacity }]}>
      {/* Backdrop */}
      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

      {/* Card */}
      <View style={s.centered}>
        <View style={s.card}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)' }]} />
          <GlassBorder r={24} />

          <View style={s.content}>
            {/* Icon + header */}
            <Ionicons name="time-outline" size={40} color={ORANGE} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={s.title}>{isOral ? 'MISSED DOSE' : 'MISSED SHOT'}</Text>
            <Text style={s.body}>
              Your {isOral ? 'dose' : 'injection'} was due {overdueDays} day{overdueDays !== 1 ? 's' : ''} ago
            </Text>
            <Text style={s.expected}>Expected: {formatDateLabel(expectedShotDate)}</Text>

            <View style={s.divider} />

            {mode === 'question' ? (
              <>
                <TouchableOpacity
                  style={[s.btn, s.btnPrimary]}
                  onPress={handleLogExpected}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={s.btnPrimaryText}>
                    Yes, I took it on {formatDateLabel(expectedShotDate)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.btn, s.btnSecondary]}
                  onPress={() => {
                    setMode('latePicker');
                    setLateDateValue(new Date(expectedShotDate + 'T12:00:00'));
                  }}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={s.btnSecondaryText}>Yes, but I took it late</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.btn, s.btnGhost]}
                  onPress={dismiss}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={s.btnGhostText}>I haven't taken it yet</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.pickerLabel}>When did you take it?</Text>
                <DateTimePicker
                  value={lateDateValue}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={minDate}
                  maximumDate={maxDate}
                  onChange={(_, date) => { if (date) setLateDateValue(date); }}
                  themeVariant="dark"
                  style={{ alignSelf: 'stretch' }}
                />
                <View style={s.pickerRow}>
                  <TouchableOpacity
                    style={[s.btn, s.btnGhost, { flex: 1 }]}
                    onPress={() => setMode('question')}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Text style={s.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.btn, s.btnPrimary, { flex: 1 }]}
                    onPress={handleLogLate}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={s.btnPrimaryText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '88%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  content: {
    padding: 28,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: FF,
  },
  body: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: FF,
  },
  expected: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    fontFamily: FF,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 20,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimary: {
    backgroundColor: ORANGE,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FF,
    textAlign: 'center',
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,116,42,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,116,42,0.4)',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: ORANGE,
    fontFamily: FF,
  },
  btnGhost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: FF,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    fontFamily: FF,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
