import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useHealthData } from '@/contexts/health-data';
import { useLogStore } from '@/stores/log-store';
import {
  computeEnergyBank,
  computeSideEffectBurden,
  daysSinceInjection,
  type EnergyComponent,
} from '@/constants/scoring';
import { MEDICAL_DISCLAIMER } from '@/constants/medical-sources';
import { pkConcentrationPct } from '@/constants/drug-pk';
import { useUiStore } from '@/stores/ui-store';

const FF = 'System';

function energyColor(pct: number): string {
  if (pct >= 70) return '#27AE60';
  if (pct >= 45) return '#F6CB45';
  if (pct >= 20) return '#E8960C';
  return '#E53E3E';
}

const COMPONENT_COLORS: Record<string, string> = {
  sleep: '#5856D6',
  drugLevel: '#FF742A',
  hrv: '#AF52DE',
  nutrition: '#34C759',
  hydration: '#5AC8FA',
  sideEffects: '#FF3B30',
};

const COMPONENT_ICONS: Record<string, string> = {
  sleep: 'moon',
  drugLevel: 'medical',
  hrv: 'pulse',
  nutrition: 'restaurant',
  hydration: 'water',
  sideEffects: 'alert-circle',
};

function BatteryIcon({ pct, color, isDark }: { pct: number; color: string; isDark: boolean }) {
  const W = 120;
  const H = 52;
  const R = 12;
  const tipW = 6;
  const tipH = 20;
  const pad = 4;
  const fillW = Math.max(0, ((W - pad * 2) * pct) / 100);
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
  const bgColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Svg width={W} height={H}>
        <Rect x={0} y={0} width={W} height={H} rx={R} ry={R}
          stroke={borderColor} strokeWidth={2} fill={bgColor} />
        {fillW > 0 && (
          <Rect x={pad} y={pad} width={fillW} height={H - pad * 2}
            rx={R - 2} ry={R - 2} fill={color} opacity={0.85} />
        )}
      </Svg>
      <View style={{
        width: tipW, height: tipH, borderTopRightRadius: 3, borderBottomRightRadius: 3,
        backgroundColor: borderColor, marginLeft: 2,
      }} />
    </View>
  );
}

function ComponentRow({ component, isDark }: { component: EnergyComponent; isDark: boolean }) {
  const w = (a: number) => isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  const color = component.available ? (COMPONENT_COLORS[component.id] ?? '#999') : w(0.2);
  const iconName = COMPONENT_ICONS[component.id];
  const weightPct = Math.round(component.baseWeight * 100);

  return (
    <View style={{
      gap: 10, paddingVertical: 16, opacity: component.available ? 1 : 0.6,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: w(0.08),
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: component.available ? `${COMPONENT_COLORS[component.id]}18` : w(0.06),
            alignItems: 'center', justifyContent: 'center',
          }}>
            {iconName && <Ionicons name={iconName as any} size={18} color={color} />}
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: isDark ? '#FFF' : '#1A1A1A', fontFamily: FF }}>
                {component.label}
              </Text>
              {!component.available && (
                <View style={{
                  backgroundColor: w(0.08), borderRadius: 4,
                  paddingHorizontal: 6, paddingVertical: 2,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: w(0.35), fontFamily: FF }}>
                    NOT TRACKED
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 12, color: w(0.35), fontFamily: FF }}>
              {component.available
                ? `${weightPct}% of total score`
                : `Normally ${weightPct}% — excluded from score`}
            </Text>
          </View>
        </View>
        {component.available ? (
          <Text style={{ fontSize: 20, fontWeight: '800', color, fontFamily: FF }}>
            {component.score}
          </Text>
        ) : (
          <Ionicons name="remove-circle-outline" size={22} color={w(0.2)} />
        )}
      </View>

      {/* Score bar — only for available components */}
      {component.available ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: w(0.06), overflow: 'hidden' }}>
          <View style={{
            height: '100%', borderRadius: 3,
            width: `${component.score}%`, backgroundColor: COMPONENT_COLORS[component.id], opacity: 0.8,
          }} />
        </View>
      ) : (
        <View style={{
          height: 6, borderRadius: 3, backgroundColor: w(0.06),
          overflow: 'hidden',
        }}>
          {/* Dashed/empty bar for unavailable */}
        </View>
      )}

      {/* Detail text */}
      <Text style={{ fontSize: 14, color: w(component.available ? 0.5 : 0.35), fontFamily: FF, lineHeight: 20 }}>
        {component.detail}
      </Text>
    </View>
  );
}

export default function EnergyDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const healthData = useHealthData();
  const logStore = useLogStore();
  const { openAiChat } = useUiStore();

  const { actuals, targets, profile, wearable } = healthData;
  const freq = profile.injectionFrequencyDays ?? 7;
  const dayNum = daysSinceInjection(profile.lastInjectionDate, new Date(), freq);
  const phase = dayNum <= Math.round(freq * 0.15) ? 'shot' as const
    : dayNum <= Math.round(freq * 0.5) ? 'peak' as const
    : dayNum <= Math.round(freq * 0.85) ? 'balance' as const : 'reset' as const;

  const seLogs = (logStore.sideEffectLogs ?? []).map(l => ({
    effect_type: l.effect_type, severity: l.severity ?? 0, logged_at: l.logged_at, phase_at_log: l.phase_at_log ?? '',
  }));
  const { burden: seBurden } = computeSideEffectBurden(seLogs, phase, 14);
  const tHours = dayNum * 24;
  const glp1Type = profile.glp1Type;
  const intervalH = freq * 24;
  const pkPct = glp1Type && tHours > 0
    ? pkConcentrationPct(tHours, glp1Type as any, true, intervalH)
    : null;
  const fatigueLogs = seLogs.filter(l => l.effect_type === 'fatigue');
  const { burden: fatigueBurden } = fatigueLogs.length > 0
    ? computeSideEffectBurden(fatigueLogs, phase, 14)
    : { burden: 0 };
  const result = computeEnergyBank(wearable, actuals, targets, phase, seBurden, pkPct, fatigueBurden);

  const color = energyColor(result.score);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const phaseLabels: Record<string, string> = {
    shot: 'Dose Day', peak: 'Peak Phase', balance: 'Balance Phase', reset: 'Reset Phase',
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
      }}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Energy Bank</Text>
        <TouchableOpacity
          onPress={() => {
            const contextValue = `${result.score}% · ${result.label} · ${phaseLabels[phase] ?? phase}`;
            const chips = [
              'Why is my energy this level?',
              'How can I boost my energy today?',
              'How does my medication affect energy?',
              'What should I eat to feel more energized?',
            ];
            openAiChat({ type: 'energy', contextLabel: 'Energy Bank', contextValue, chips: JSON.stringify(chips) });
          }}
          activeOpacity={0.7}
          hitSlop={12}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 80 }}
      >
        {/* Hero battery */}
        <View style={[s.heroCard, { backgroundColor: colors.surface }]}>
          <View style={{ alignItems: 'center', gap: 16 }}>
            <BatteryIcon pct={result.score} color={color} isDark={colors.isDark} />
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={[s.heroScore, { color }]}>{result.score}</Text>
              <Text style={[s.heroPct, { color }]}>%</Text>
            </View>
            <Text style={[s.heroLabel, { color }]}>{result.label}</Text>
            <View style={s.phasePill}>
              <Ionicons name="medical" size={12} color={w(0.4)} />
              <Text style={s.phaseText}>{phaseLabels[phase] ?? 'Active'}</Text>
            </View>
          </View>
        </View>

        {/* Missing data disclaimer */}
        {result.disclaimer && (
          <View style={[s.disclaimerCard, { backgroundColor: colors.isDark ? 'rgba(255,149,0,0.08)' : 'rgba(255,149,0,0.06)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Ionicons name="information-circle" size={20} color="#FF9500" style={{ marginTop: 1 }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FF9500', fontFamily: FF }}>
                  Incomplete Data
                </Text>
                <Text style={{ fontSize: 13, color: w(0.5), fontFamily: FF, lineHeight: 19 }}>
                  {result.disclaimer}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* How it works */}
        <View style={[s.infoCard, { backgroundColor: colors.surface }]}>
          <Text style={s.sectionTitle}>How Energy Bank Works</Text>
          <Text style={s.infoText}>
            Your Energy Bank score is computed in real-time from 6 factors that directly impact how energized you feel on GLP-1 medication. It updates automatically as you log data and sync with Apple Health.
          </Text>
          <Text style={s.infoText}>
            The score combines objective biometrics (sleep, HRV from Apple Watch), real-time pharmacokinetic modeling of your drug concentration, and your daily nutrition and hydration intake. Each factor is weighted based on clinical evidence for its impact on energy during GLP-1 therapy.
          </Text>
        </View>

        {/* Component breakdown */}
        <Text style={s.breakdownTitle}>Score Breakdown</Text>
        <View style={[s.breakdownCard, { backgroundColor: colors.surface }]}>
          {result.components.map(c => (
            <ComponentRow key={c.id} component={c} isDark={colors.isDark} />
          ))}
        </View>

        {/* Methodology */}
        <View style={[s.infoCard, { backgroundColor: colors.surface }]}>
          <Text style={s.sectionTitle}>Methodology</Text>

          <Text style={[s.methodLabel, { color: COMPONENT_COLORS.sleep }]}>Sleep (30%)</Text>
          <Text style={s.methodText}>
            Scored from Apple Health sleep data. 7-9 hours is optimal (100%). Under 5 hours scores below 35%. Oversleeping (10+ hours) is also penalized as it correlates with fatigue.
          </Text>

          <Text style={[s.methodLabel, { color: COMPONENT_COLORS.drugLevel }]}>Drug Level (20%)</Text>
          <Text style={s.methodText}>
            Computed in real-time from your medication's pharmacokinetic profile. Higher drug concentration = more fatigue. The relationship is non-linear — energy drops steeply as concentration approaches peak. When Apple Health data isn't available, falls back to phase-based estimation.
          </Text>

          <Text style={[s.methodLabel, { color: COMPONENT_COLORS.hrv }]}>HRV (15%)</Text>
          <Text style={s.methodText}>
            Heart Rate Variability from Apple Watch is the strongest objective biomarker for recovery and fatigue. Higher HRV = more recovered = more energy. GLP-1 medications suppress HRV by ~6ms at peak concentration — your score is adjusted for this so you're not penalized for expected medication effects.
          </Text>

          <Text style={[s.methodLabel, { color: COMPONENT_COLORS.nutrition }]}>Nutrition (15%)</Text>
          <Text style={s.methodText}>
            Measures protein intake against your personalized daily target. GLP-1 appetite suppression often leads to under-eating, which causes fatigue and muscle loss. Hitting your protein target directly fuels energy production.
          </Text>

          <Text style={[s.methodLabel, { color: COMPONENT_COLORS.hydration }]}>Hydration (10%)</Text>
          <Text style={s.methodText}>
            Dehydration is one of the most common GLP-1 side effects and a leading cause of fatigue, dizziness, and headaches. Scored as water intake against your weight-based target (30ml/kg).
          </Text>

          <Text style={[s.methodLabel, { color: COMPONENT_COLORS.sideEffects }]}>Side Effects (10%)</Text>
          <Text style={s.methodText}>
            Active side effects drain energy. Fatigue logs are up-weighted (blended 50/50 with general burden) since they directly measure energy drain. Nausea and GI symptoms are also weighted heavily (1.3x). Uses your logged side effects from the past 14 days.
          </Text>
        </View>

        {/* Disclaimer */}
        <Text style={s.disclaimer}>
          {MEDICAL_DISCLAIMER}
        </Text>
      </ScrollView>

      {/* Floating Ask AI button */}
      <View style={{
        position: 'absolute', bottom: insets.bottom + 16, left: 20, right: 20,
      }}>
        <TouchableOpacity
          style={s.askAiBtn}
          activeOpacity={0.85}
          onPress={() => {
            const breakdown = result.components
              .filter(c => c.available)
              .map(c => `${c.label}: ${c.score}/100`)
              .join(', ');
            const contextValue = `${result.score}% (${result.label}) · ${phaseLabels[phase]} · Breakdown: ${breakdown}`;
            const chips = [
              'Why is my energy this level?',
              'How can I boost my energy today?',
              'How does my medication affect energy?',
              'What should I eat to feel more energized?',
            ];
            openAiChat({ type: 'energy', contextLabel: 'Energy Bank', contextValue, chips: JSON.stringify(chips) });
          }}
        >
          <Ionicons name="sparkles" size={18} color="#FFF" />
          <Text style={s.askAiText}>Ask AI about your energy</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    headerTitle: {
      fontSize: 18, fontWeight: '800', color: c.textPrimary, fontFamily: FF,
    },
    heroCard: {
      borderRadius: 24, padding: 28,
      ...cardElevation(c.isDark),
      marginBottom: 20,
    },
    disclaimerCard: {
      borderRadius: 16, padding: 16,
      borderWidth: 1, borderColor: 'rgba(255,149,0,0.2)',
      marginBottom: 20,
    },
    heroScore: {
      fontSize: 56, fontWeight: '800', fontFamily: FF,
    },
    heroPct: {
      fontSize: 28, fontWeight: '700', fontFamily: FF,
    },
    heroLabel: {
      fontSize: 18, fontWeight: '700', fontFamily: FF, textTransform: 'uppercase',
      letterSpacing: 1,
    },
    phasePill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: w(0.06), borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    phaseText: {
      fontSize: 13, fontWeight: '600', color: w(0.4), fontFamily: FF,
    },
    infoCard: {
      borderRadius: 20, padding: 20, gap: 12,
      ...cardElevation(c.isDark),
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 17, fontWeight: '800', color: c.textPrimary, fontFamily: FF,
      letterSpacing: -0.2,
    },
    infoText: {
      fontSize: 14, color: w(0.55), fontFamily: FF, lineHeight: 21,
    },
    breakdownTitle: {
      fontSize: 15, fontWeight: '700', color: w(0.5), fontFamily: FF,
      textTransform: 'uppercase', letterSpacing: 0.8,
      marginBottom: 12,
    },
    breakdownCard: {
      borderRadius: 20, paddingHorizontal: 20,
      ...cardElevation(c.isDark),
      marginBottom: 20,
    },
    methodLabel: {
      fontSize: 14, fontWeight: '800', fontFamily: FF, marginTop: 4,
    },
    methodText: {
      fontSize: 13, color: w(0.5), fontFamily: FF, lineHeight: 19,
    },
    disclaimer: {
      fontSize: 11, color: w(0.25), fontFamily: FF, lineHeight: 16,
      textAlign: 'center', marginTop: 8,
    },
    askAiBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: '#FF742A', borderRadius: 16,
      paddingVertical: 14,
      shadowColor: '#FF742A', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    askAiText: {
      fontSize: 16, fontWeight: '700', color: '#FFF', fontFamily: FF,
    },
  });
};
