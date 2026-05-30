import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GlassBorder } from '@/components/ui/glass-border';
import { BRAND_DISPLAY_NAMES, MedicationBrand } from '@/constants/user-profile';
import { ORANGE } from '@/constants/theme';
import { AlertCircle } from 'lucide-react-native';

const FF = 'System';

type TreatmentCheckModalProps = {
  visible: boolean;
  onClose: () => void;
  daysSinceLastShot: number;
  medicationBrand: MedicationBrand | null | undefined;
  medicationCustomName?: string | null;
  isOral?: boolean;
  onLogRecentShot: () => void;
  onStopMedication: () => Promise<void>;
  onSnooze: () => Promise<void>;
};

function brandLabel(
  brand: MedicationBrand | null | undefined,
  customName: string | null | undefined,
): string {
  if (!brand) return 'your medication';
  if (brand === 'other') return customName || 'your medication';
  return BRAND_DISPLAY_NAMES[brand] ?? 'your medication';
}

export function TreatmentCheckModal({
  visible,
  onClose,
  daysSinceLastShot,
  medicationBrand,
  medicationCustomName,
  isOral = false,
  onLogRecentShot,
  onStopMedication,
  onSnooze,
}: TreatmentCheckModalProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState<null | 'log' | 'stop' | 'snooze'>(null);

  useEffect(() => {
    if (visible) {
      setLoading(null);
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  function dismiss() {
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      onClose();
    });
  }

  function handleLog() {
    setLoading('log');
    onLogRecentShot();
    dismiss();
  }

  function handleStop() {
    Alert.alert(
      `Stop ${isOral ? 'Medication' : 'Treatment'}`,
      "You'll still have access to weight, food, and activity tracking. You can resume anytime from Settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOral ? 'Stop Medication' : 'Stop Treatment',
          style: 'destructive',
          onPress: async () => {
            setLoading('stop');
            try {
              await onStopMedication();
            } finally {
              setLoading(null);
              dismiss();
            }
          },
        },
      ],
    );
  }

  async function handleSnooze() {
    setLoading('snooze');
    try {
      await onSnooze();
    } finally {
      setLoading(null);
      dismiss();
    }
  }

  const medLabel = brandLabel(medicationBrand, medicationCustomName);
  const doseNoun = isOral ? 'dose' : 'shot';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity }]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />

        <View style={s.centered}>
          <View style={s.card}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)' },
              ]}
            />
            <GlassBorder r={24} />

            <View style={s.content}>
              <AlertCircle
                size={40}
                color={ORANGE}
                style={{ alignSelf: 'center', marginBottom: 12 }} />
              <Text style={s.title}>OFF SCHEDULE</Text>
              <Text style={s.body}>
                It's been {daysSinceLastShot} days since your last {doseNoun}
              </Text>
              <Text style={s.subtext}>Are you still taking {medLabel}?</Text>

              <View style={s.divider} />

              <TouchableOpacity
                style={[s.btn, s.btnPrimary]}
                onPress={handleLog}
                disabled={loading !== null}
                activeOpacity={0.8}
                accessibilityLabel={`Log a recent ${doseNoun}`}
                accessibilityRole="button"
              >
                {loading === 'log' ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={s.btnPrimaryText}>Log a recent {doseNoun}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.btn, s.btnSecondary]}
                onPress={handleStop}
                disabled={loading !== null}
                activeOpacity={0.8}
                accessibilityLabel="I stopped this medication"
                accessibilityRole="button"
              >
                {loading === 'stop' ? (
                  <ActivityIndicator color={ORANGE} />
                ) : (
                  <Text style={s.btnSecondaryText}>I stopped this medication</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.btn, s.btnGhost]}
                onPress={handleSnooze}
                disabled={loading !== null}
                activeOpacity={0.7}
                accessibilityLabel="Remind me later"
                accessibilityRole="button"
              >
                {loading === 'snooze' ? (
                  <ActivityIndicator color="rgba(255,255,255,0.6)" />
                ) : (
                  <Text style={s.btnGhostText}>Remind me later</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </Modal>
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
    fontSize: 15,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 3.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: FF,
  },
  body: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
    fontFamily: FF,
  },
  subtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
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
    fontSize: 17,
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
    fontSize: 17,
    fontWeight: '600',
    color: ORANGE,
    fontFamily: FF,
  },
  btnGhost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnGhostText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: FF,
  },
});
