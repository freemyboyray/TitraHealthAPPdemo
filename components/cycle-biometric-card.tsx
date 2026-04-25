import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { GlassBorder } from '@/components/ui/glass-border';
import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useUiStore } from '@/stores/ui-store';
import { usePreferencesStore } from '@/stores/preferences-store';
import { useBiometricStore } from '@/stores/biometric-store';
import type { BiometricClassification, CycleIntelligenceResult, MetricInterpretation } from '@/lib/cycle-intelligence';

const BOOTSTRAP_MIN_DAYS = 14;

const BADGE_COLORS: Record<BiometricClassification, { bg: string; text: string }> = {
  expected_glp1:     { bg: 'rgba(39,174,96,0.15)',   text: '#27AE60' },
  expected_positive: { bg: 'rgba(39,174,96,0.2)',    text: '#27AE60' },
  mild_unusual:      { bg: 'rgba(243,156,18,0.15)',  text: '#F39C12' },
  concerning:        { bg: 'rgba(231,76,60,0.15)',   text: '#E74C3C' },
  insufficient_data: { bg: 'rgba(120,120,128,0.12)', text: 'rgba(120,120,128,0.7)' },
};

type MetricRowProps = {
  label: string;
  actual: number | null;
  baseline: number | null;
  delta: number | null;
  unit: string;
  interpretation: MetricInterpretation;
  formatFn?: (v: number) => string;
};

function MetricRow({ label, actual, baseline, delta, unit, interpretation, formatFn }: MetricRowProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const badge = BADGE_COLORS[interpretation.classification];
  const fmtVal = (v: number | null) => v != null ? (formatFn ? formatFn(v) : `${Math.round(v)}`) : '--';

  return (
    <View style={s.metricRow}>
      <View style={s.metricLeft}>
        <Text style={s.metricLabel}>{label}</Text>
        <View style={s.metricValues}>
          <Text style={s.metricActual}>{fmtVal(actual)}<Text style={s.metricUnit}>{actual != null ? unit : ''}</Text></Text>
          {baseline != null && (
            <Text style={s.metricBaseline}>
              baseline {fmtVal(baseline)}{unit}
              {delta != null && (
                <Text style={{ color: delta < 0 ? '#E74C3C' : '#27AE60' }}>
                  {' '}{delta > 0 ? '+' : ''}{Math.round(delta)}{unit}
                </Text>
              )}
            </Text>
          )}
        </View>
      </View>
      <View style={[s.badge, { backgroundColor: badge.bg }]}>
        <Text style={[s.badgeText, { color: badge.text }]}>{interpretation.label}</Text>
      </View>
    </View>
  );
}

type CycleBiometricCardProps = {
  result: CycleIntelligenceResult;
  cycleiqContext: string;
};

export function CycleBiometricCard({ result, cycleiqContext }: CycleBiometricCardProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { appleHealthEnabled } = usePreferencesStore();
  const { isBootstrapped, history } = useBiometricStore();
  const { openAiChat } = useUiStore();

  const [isExpanded, setIsExpanded] = useState(false);

  const eligibleCount = history.filter(h => h.shotPhase !== 'peak' && h.shotPhase !== 'shot').length;
  const progressPct = Math.min(1, eligibleCount / BOOTSTRAP_MIN_DAYS);

  const handleCardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(e => !e);
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({
      contextLabel: 'Biometric Intelligence',
      contextValue: cycleiqContext.slice(0, 100),
      seedMessage: cycleiqContext,
      chips: JSON.stringify([
        'Is this normal for my phase?',
        'Why is my HRV low?',
        'How does GLP-1 affect my heart rate?',
        'What can I do to improve my recovery?',
      ]),
    });
  };

  return (
    <Pressable style={s.wrap} onPress={handleCardPress} onLongPress={handlePress}>
      <BlurView intensity={65} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
      <GlassBorder r={24} isDark={colors.isDark} />
      <View style={[s.inner, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Biometric Intelligence</Text>
          {isBootstrapped && appleHealthEnabled && (
            <Text style={s.chevron}>{isExpanded ? '↑ Details' : '↓ Details'}</Text>
          )}
        </View>
        <Text style={s.subheader} numberOfLines={2}>{result.headerLabel}</Text>

        {!appleHealthEnabled ? (
          // Apple Health not enabled
          <View style={s.emptyState}>
            <Text style={s.emptyText}>Enable Apple Health in Settings to see cycle-aware biometric insights.</Text>
            <Pressable onPress={() => router.push('/settings')} style={s.enableBtn}>
              <Text style={s.enableBtnText}>Go to Settings</Text>
            </Pressable>
          </View>
        ) : !isBootstrapped ? (
          // Still bootstrapping baseline
          <View style={s.bootstrapState}>
            <Text style={s.bootstrapText}>
              Building your personal baseline: {eligibleCount}/{BOOTSTRAP_MIN_DAYS} non-peak days recorded
            </Text>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${progressPct * 100}%` as any }]} />
            </View>
            <Text style={s.bootstrapHint}>
              CycleIQ needs 14 days of data (excluding injection & peak days) to establish your baseline.
            </Text>
          </View>
        ) : (
          // Full metric rows
          <>
            <View style={s.metrics}>
              <MetricRow
                label="HRV"
                actual={result.hrv.actual}
                baseline={result.hrv.baseline}
                delta={result.hrv.delta}
                unit="ms"
                interpretation={result.hrv}
              />
              <View style={s.divider} />
              <MetricRow
                label="Resting HR"
                actual={result.rhr.actual}
                baseline={result.rhr.baseline}
                delta={result.rhr.delta}
                unit=" bpm"
                interpretation={result.rhr}
              />
              <View style={s.divider} />
              <MetricRow
                label="Sleep"
                actual={result.sleep.actual}
                baseline={result.sleep.baseline}
                delta={result.sleep.delta}
                unit="min"
                interpretation={result.sleep}
                formatFn={(v) => {
                  const h = Math.floor(v / 60);
                  const m = Math.round(v % 60);
                  return `${h}h ${m}m`;
                }}
              />
            </View>

            {isExpanded && (
              <View style={s.expandSection}>
                <View style={s.expandDivider} />

                <Text style={s.expandSectionTitle}>HOW THIS WORKS</Text>

                <View style={s.expandRow}>
                  <MaterialIcons name="analytics" size={14} color="rgba(255,255,255,0.5)" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.expandText, { fontWeight: '700' }]}>Your baseline</Text>
                    <Text style={s.expandText}>
                      Built from {eligibleCount} days of non-peak, non-injection data using an exponential moving average (EMA). Updates automatically as your body adapts to medication.
                    </Text>
                  </View>
                </View>

                <View style={s.expandDivider} />

                <View style={s.expandRow}>
                  <Ionicons name="heart" size={14} color="#FF2D55" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.expandText, { fontWeight: '700' }]}>HRV (Heart Rate Variability)</Text>
                    <Text style={s.expandText}>
                      Measures milliseconds of variability between heartbeats. Higher = better autonomic recovery. GLP-1 meds transiently suppress HRV at peak concentration (Day 2–3). This is expected and shown in green.
                    </Text>
                  </View>
                </View>

                <View style={s.expandRow}>
                  <Ionicons name="heart-outline" size={14} color="rgba(255,255,255,0.5)" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.expandText, { fontWeight: '700' }]}>Resting HR</Text>
                    <Text style={s.expandText}>
                      Your heart rate at rest. GLP-1 meds mildly elevate RHR by 2–4 bpm at peak drug concentration, a known pharmacological effect, not a concern when classified as "Expected GLP-1 Effect."
                    </Text>
                  </View>
                </View>

                <View style={s.expandRow}>
                  <Ionicons name="bed-outline" size={14} color="rgba(255,255,255,0.5)" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.expandText, { fontWeight: '700' }]}>Sleep</Text>
                    <Text style={s.expandText}>
                      Total sleep duration vs. your personal baseline. GLP-1 has no established direct effect on sleep duration, so large deviations likely reflect lifestyle factors rather than medication.
                    </Text>
                  </View>
                </View>

                <View style={s.expandDivider} />

                <Text style={s.expandSectionTitle}>WHAT THE BADGES MEAN</Text>

                <View style={s.badgeGuideRow}>
                  <View style={[s.badgeDot, { backgroundColor: '#27AE60' }]} />
                  <Text style={s.expandText}>Expected GLP-1 Effect: within the predicted range for your cycle phase</Text>
                </View>
                <View style={s.badgeGuideRow}>
                  <View style={[s.badgeDot, { backgroundColor: '#27AE60' }]} />
                  <Text style={s.expandText}>Better Than Expected: improved beyond typical GLP-1 response</Text>
                </View>
                <View style={s.badgeGuideRow}>
                  <View style={[s.badgeDot, { backgroundColor: '#F39C12' }]} />
                  <Text style={s.expandText}>Mildly Unusual: slightly outside expected range; monitor</Text>
                </View>
                <View style={s.badgeGuideRow}>
                  <View style={[s.badgeDot, { backgroundColor: '#E74C3C' }]} />
                  <Text style={s.expandText}>Concerning: significantly outside expected range; ask AI</Text>
                </View>
                <View style={s.badgeGuideRow}>
                  <View style={[s.badgeDot, { backgroundColor: 'rgba(120,120,128,0.5)' }]} />
                  <Text style={s.expandText}>Insufficient Data: not enough history yet</Text>
                </View>

                <Pressable style={s.askAiBtn} onPress={handlePress}>
                  <Text style={s.askAiText}>Ask AI about my biometrics</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {!(isBootstrapped && appleHealthEnabled && isExpanded) && (
          <Text style={s.tapHint}>
            {isBootstrapped && appleHealthEnabled
              ? 'Tap for details · Hold for AI'
              : 'Hold to ask AI about your biometrics'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: {
      borderRadius: 24,
      overflow: 'hidden',
      marginBottom: 16,
      ...cardElevation(c.isDark),
    },
    inner: {
      borderRadius: 24,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    chevron: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.4),
      fontFamily: 'Inter_400Regular',
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'Inter_700Bold',
    },
    subheader: {
      fontSize: 12,
      fontWeight: '500',
      color: '#FF742A',
      letterSpacing: 0.2,
      marginBottom: 18,
      fontFamily: 'Inter_400Regular',
    },
    metrics: {
      gap: 0,
    },
    metricRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    metricLeft: {
      flex: 1,
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.45),
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      fontFamily: 'Inter_400Regular',
      marginBottom: 4,
    },
    metricValues: {
      gap: 2,
    },
    metricActual: {
      fontSize: 20,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'Inter_400Regular',
    },
    metricUnit: {
      fontSize: 13,
      fontWeight: '500',
    },
    metricBaseline: {
      fontSize: 12,
      color: w(0.45),
      fontFamily: 'Inter_400Regular',
    },
    badge: {
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      alignSelf: 'center',
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'Inter_400Regular',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    emptyState: {
      paddingVertical: 12,
      alignItems: 'center',
      gap: 12,
    },
    emptyText: {
      fontSize: 14,
      color: w(0.55),
      textAlign: 'center',
      lineHeight: 20,
      fontFamily: 'Inter_400Regular',
    },
    enableBtn: {
      backgroundColor: 'rgba(255,116,42,0.12)',
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    enableBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF742A',
      fontFamily: 'Inter_400Regular',
    },
    bootstrapState: {
      paddingVertical: 8,
      gap: 10,
    },
    bootstrapText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
      fontFamily: 'Inter_400Regular',
    },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderSubtle,
      overflow: 'hidden',
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: '#FF742A',
    },
    bootstrapHint: {
      fontSize: 12,
      color: w(0.4),
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
    },
    tapHint: {
      fontSize: 11,
      color: w(0.3),
      textAlign: 'center',
      marginTop: 14,
      fontFamily: 'Inter_400Regular',
    },
    expandDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 14,
    },
    expandSection: {
      gap: 12,
      marginTop: 4,
    },
    expandSectionTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.4),
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      fontFamily: 'Inter_400Regular',
    },
    expandRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
    },
    expandIcon: {
      fontSize: 14,
    },
    expandText: {
      fontSize: 13,
      color: w(0.65),
      lineHeight: 19,
      fontFamily: 'Inter_400Regular',
      flex: 1,
    },
    badgeGuideRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      marginVertical: 2,
    },
    badgeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    askAiBtn: {
      backgroundColor: 'rgba(255,116,42,0.12)',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignSelf: 'flex-start',
      marginTop: 8,
    },
    askAiText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF742A',
      fontFamily: 'Inter_400Regular',
    },
  });
};
