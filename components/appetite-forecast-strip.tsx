import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useUiStore } from '@/stores/ui-store';
import type { ForecastDay } from '@/lib/cycle-intelligence';

const STATE_COLORS: Record<ForecastDay['state'], string> = {
  peak_suppression:    '#E74C3C',
  moderate_suppression: '#FF742A',
  returning:           '#F39C12',
  near_baseline:       '#27AE60',
};

type ForecastPillProps = {
  day: ForecastDay;
  onPress: () => void;
};

function ForecastPill({ day, onPress }: ForecastPillProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const dotColor = STATE_COLORS[day.state];

  return (
    <Pressable
      style={[s.pill, day.isToday && s.pillToday]}
      onPress={onPress}
    >
      <View style={[s.stateDot, { backgroundColor: dotColor }]} />
      <Text style={[s.dayLabel, day.isToday && s.dayLabelToday]}>
        D{day.cycleDay}
      </Text>
      <Text style={[s.suppression, day.isToday && s.suppressionToday]}>
        {day.appetiteSuppressionPct}%
      </Text>
    </Pressable>
  );
}

type AppetiteForecastStripProps = {
  forecastDays: ForecastDay[];
  appleHealthEnabled: boolean;
  drugName: string;
};

export function AppetiteForecastStrip({
  forecastDays,
  drugName,
}: AppetiteForecastStripProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { openAiChat } = useUiStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDayPress = (day: ForecastDay) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const stateDesc =
      day.state === 'peak_suppression'    ? 'Peak suppression — appetite is significantly reduced' :
      day.state === 'moderate_suppression' ? 'Moderate suppression — appetite below normal' :
      day.state === 'returning'            ? 'Appetite is returning toward baseline' :
      'Appetite near baseline';
    const chipContext = day.isToday
      ? `Day ${day.cycleDay} of your cycle — Appetite ~${day.appetiteSuppressionPct}% suppressed. ${stateDesc}.`
      : `Day ${day.cycleDay} forecast — Appetite ~${day.appetiteSuppressionPct}% suppressed. ${stateDesc}.`;
    const mealTip =
      day.state === 'peak_suppression'    ? 'Focus on protein-dense foods. Small, frequent meals work better than large ones.' :
      day.state === 'moderate_suppression' ? 'Good day for protein meals. Plan your highest-protein meal for this window.' :
      day.state === 'returning'            ? 'Appetite returning — good day for a larger protein meal.' :
      'Appetite near baseline — great day for a complete, satisfying meal.';

    openAiChat({
      contextLabel: day.isToday ? 'Today\'s Appetite' : `Day ${day.cycleDay} Forecast`,
      contextValue: chipContext,
      seedMessage: `${chipContext} ${mealTip}`,
      chips: JSON.stringify([
        'What should I eat today?',
        'How do I hit my protein target?',
        'Why is my appetite changing?',
        'Meal ideas for this phase',
      ]),
    });
  };

  const buildForecastContext = () => {
    const today = forecastDays.find(d => d.isToday);
    const lines = forecastDays.map(d => `Day ${d.cycleDay}: ${d.appetiteSuppressionPct}%`).join(', ');
    const todayLine = today
      ? `Today (Day ${today.cycleDay}): ~${today.appetiteSuppressionPct}% appetite suppressed.`
      : '';
    return `Today is Day ${today?.cycleDay ?? '?'} of your ${drugName} cycle.\n7-day appetite suppression forecast:\n${lines}\n${todayLine}`;
  };

  const handleCardPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(e => !e);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    openAiChat({
      contextLabel: 'Appetite Forecast',
      contextValue: buildForecastContext(),
      seedMessage: buildForecastContext(),
      chips: JSON.stringify([
        'Why does appetite change?',
        'What should I eat today?',
        'How does GLP-1 affect hunger?',
        'Day-by-day meal strategy',
      ]),
    });
  };

  const handleAskAi = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openAiChat({
      contextLabel: 'Appetite Forecast',
      contextValue: buildForecastContext(),
      seedMessage: buildForecastContext(),
      chips: JSON.stringify([
        'Why does appetite change?',
        'What should I eat today?',
        'How does GLP-1 affect hunger?',
        'Day-by-day meal strategy',
      ]),
    });
  };

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (forecastDays.length === 0) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Appetite Forecast</Text>
          <Text style={s.subtitle}>7-day cycle</Text>
        </View>
        <Text style={s.emptyBody}>
          Log your first injection to unlock your 7-day forecast.
        </Text>
        <Text style={s.emptyNote}>
          {'How it works: This forecast uses the pharmacokinetic (PK) model for '}
          {drugName}
          {' to predict appetite suppression across your injection cycle.'}
        </Text>
      </View>
    );
  }

  // ── Populated state ──────────────────────────────────────────────────────────
  const injectionDate = (() => {
    const today = forecastDays.find(d => d.isToday);
    if (!today) return null;
    const d = new Date();
    d.setDate(d.getDate() - (today.cycleDay - 1));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  })();

  return (
    <Pressable
      style={s.container}
      onPress={handleCardPress}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Appetite Forecast</Text>
        <View style={s.headerRight}>
          <Text style={s.chevron}>{isExpanded ? '↑ Details' : '↓ Details'}</Text>
          <Text style={s.subtitle}>  7-day cycle</Text>
        </View>
      </View>

      {/* Pills */}
      <View style={s.pills}>
        {forecastDays.map(day => (
          <ForecastPill
            key={day.cycleDay}
            day={day}
            onPress={() => handleDayPress(day)}
          />
        ))}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {(['peak_suppression', 'moderate_suppression', 'returning', 'near_baseline'] as const).map(state => (
          <View key={state} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: STATE_COLORS[state] }]} />
            <Text style={s.legendLabel}>
              {state === 'peak_suppression' ? 'Peak' :
               state === 'moderate_suppression' ? 'Moderate' :
               state === 'returning' ? 'Returning' : 'Baseline'}
            </Text>
          </View>
        ))}
      </View>

      {/* Expanded panel */}
      {isExpanded && (
        <View>
          <View style={s.expandDivider} />
          <View style={s.expandSection}>
            <Text style={s.expandSectionTitle}>HOW THIS WORKS</Text>
            <View style={s.expandRow}>
              <Text style={s.expandIcon}>📊</Text>
              <Text style={s.expandText}>
                {'Data source: Based on your last logged injection'}
                {injectionDate ? ` (${injectionDate})` : ''}
                {` and the FDA-validated pharmacokinetic model for ${drugName}.`}
              </Text>
            </View>
            <View style={s.expandRow}>
              <Text style={s.expandIcon}>🍽</Text>
              <Text style={s.expandText}>
                Appetite connection: GLP-1 receptor activity follows the drug concentration curve. At peak concentration (typically Day 2–3 for weekly injectables), appetite suppression reaches 50–60%. By injection day, it returns toward baseline.
              </Text>
            </View>
          </View>

          <Pressable style={s.askAiBtn} onPress={handleAskAi}>
            <Text style={s.askAiText}>Ask AI about this forecast</Text>
          </Pressable>
        </View>
      )}

      {/* Bottom hint */}
      {!isExpanded && (
        <Text style={s.hintText}>Tap for details · Hold for AI</Text>
      )}
    </Pressable>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    container: {
      marginBottom: 16,
      backgroundColor: c.surface,
      borderRadius: 24,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 18,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'Helvetica Neue',
    },
    subtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.35),
      letterSpacing: 0.5,
      fontFamily: 'Helvetica Neue',
    },
    chevron: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.4),
      fontFamily: 'Helvetica Neue',
    },
    pills: {
      flexDirection: 'row',
      gap: 4,
    },
    pill: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 14,
      backgroundColor: c.borderSubtle,
      borderWidth: 1,
      borderColor: c.border,
      gap: 4,
    },
    pillToday: {
      backgroundColor: '#FF742A',
      borderColor: '#FF742A',
      paddingVertical: 14,
    },
    stateDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    dayLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: w(0.6),
      fontFamily: 'Helvetica Neue',
    },
    dayLabelToday: {
      color: '#FFFFFF',
    },
    suppression: {
      fontSize: 11,
      fontWeight: '700',
      color: w(0.45),
      fontFamily: 'Helvetica Neue',
    },
    suppressionToday: {
      color: 'rgba(255,255,255,0.9)',
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      flexWrap: 'wrap',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    legendDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    legendLabel: {
      fontSize: 11,
      color: w(0.45),
      fontFamily: 'Helvetica Neue',
    },
    expandDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 14,
    },
    expandSection: {
      gap: 10,
    },
    expandSectionTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.4),
      letterSpacing: 0.8,
      fontFamily: 'Helvetica Neue',
    },
    expandRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'flex-start',
    },
    expandIcon: {
      fontSize: 14,
    },
    expandText: {
      flex: 1,
      fontSize: 13,
      color: w(0.65),
      lineHeight: 19,
      fontFamily: 'Helvetica Neue',
    },
    askAiBtn: {
      backgroundColor: 'rgba(255,116,42,0.12)',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignSelf: 'flex-start',
      marginTop: 12,
    },
    askAiText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FF742A',
      fontFamily: 'Helvetica Neue',
    },
    hintText: {
      fontSize: 11,
      color: w(0.3),
      textAlign: 'center',
      marginTop: 8,
      fontFamily: 'Helvetica Neue',
    },
    emptyBody: {
      fontSize: 13,
      color: w(0.6),
      fontFamily: 'Helvetica Neue',
      lineHeight: 19,
      marginBottom: 8,
    },
    emptyNote: {
      fontSize: 12,
      color: w(0.4),
      fontFamily: 'Helvetica Neue',
      lineHeight: 17,
    },
  });
};
