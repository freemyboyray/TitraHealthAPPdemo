import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';

const MEAL_TIPS: Record<ForecastDay['state'], string> = {
  peak_suppression:    'Focus on protein-dense foods. Small, frequent meals work better than large ones on peak days.',
  moderate_suppression:'Good window for protein. Plan your highest-protein meal during this phase.',
  returning:           'Appetite returning. Good day for a fuller, higher-protein meal.',
  near_baseline:       'Appetite near baseline. Aim for a satisfying, balanced meal today.',
};

function formatDayDetailDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation } from '@/constants/theme';
import type { AppColors } from '@/constants/theme';
import { useUiStore } from '@/stores/ui-store';
import type { ForecastDay, HourBlock } from '@/lib/cycle-intelligence';

function hungerLevelLabel(state: ForecastDay['state']): string {
  switch (state) {
    case 'peak_suppression':     return 'LOW';
    case 'moderate_suppression': return 'BELOW NORMAL';
    case 'returning':            return 'MODERATE';
    case 'near_baseline':        return 'NORMAL';
  }
}

function hungerLevelFromPhase(phase: HourBlock['phase']): string {
  switch (phase) {
    case 'peak':      return 'LOW';
    case 'post_dose': return 'BELOW NORMAL';
    case 'trough':    return 'NORMAL';
  }
}

const STATE_COLORS: Record<ForecastDay['state'], string> = {
  peak_suppression:    '#E74C3C',
  moderate_suppression: '#D4850A',   // amber — distinct from pillToday orange (#FF742A)
  returning:           '#C9A227',    // golden yellow
  near_baseline:       '#27AE60',
};

type ForecastPillProps = {
  day: ForecastDay;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
};

function ForecastPill({ day, selected, onPress, compact }: ForecastPillProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const stateColor = STATE_COLORS[day.state];

  return (
    <Pressable
      style={[
        s.pill,
        compact && { paddingHorizontal: 2, paddingVertical: 8 },
        day.isToday && {
          backgroundColor: stateColor,
          borderColor: '#FF742A',
          borderWidth: 2,
          paddingVertical: 14,
        },
        selected && !day.isToday && {
          borderColor: '#FF742A',
          borderWidth: 1.5,
        },
      ]}
      onPress={onPress}
    >
      <View style={[s.stateDot, { backgroundColor: day.isToday ? 'rgba(255,255,255,0.85)' : stateColor }]} />
      <Text style={[s.dayLabel, day.isToday && s.dayLabelToday, compact && { fontSize: 9 }]}>
        {day.isToday
          ? (day.isShotDay ? 'SHOT\nDAY' : 'TODAY')
          : `D${day.cycleDay}`}
      </Text>
    </Pressable>
  );
}

type AppetiteForecastStripProps = {
  forecastDays: ForecastDay[];
  appleHealthEnabled: boolean;
  drugName: string;
  /** Intraday hour blocks — when provided, renders the daily drug view instead of day-pills */
  hourBlocks?: HourBlock[];
  injFreqDays?: number;
};

const PHASE_BLOCK_COLORS: Record<HourBlock['phase'], string> = {
  post_dose: '#D4850A',
  peak:      '#E74C3C',
  trough:    '#27AE60',
};

export function AppetiteForecastStrip({
  forecastDays,
  drugName,
  hourBlocks,
  injFreqDays = 7,
}: AppetiteForecastStripProps) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { openAiChat } = useUiStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const todayDay = forecastDays.find(d => d.isToday) ?? null;
  const [selectedDay, setSelectedDay] = useState<ForecastDay | null>(todayDay);

  const handleDayPress = (day: ForecastDay) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDay(prev => (prev?.cycleDay === day.cycleDay ? null : day));
  };

  const openDayAiChat = (day: ForecastDay) => {
    const stateDesc =
      day.state === 'peak_suppression'    ? 'Peak suppression: appetite is significantly reduced' :
      day.state === 'moderate_suppression' ? 'Moderate suppression: appetite below normal' :
      day.state === 'returning'            ? 'Appetite is returning toward baseline' :
      'Appetite near baseline';
    const chipContext = day.isToday
      ? `Day ${day.cycleDay} of your cycle. Appetite ~${day.appetiteSuppressionPct}% suppressed. ${stateDesc}.`
      : `Day ${day.cycleDay} forecast. Appetite ~${day.appetiteSuppressionPct}% suppressed. ${stateDesc}.`;
    const mealTip = MEAL_TIPS[day.state];
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
    if (hourBlocks && hourBlocks.length > 0) {
      const current = hourBlocks.find(b => b.isCurrent);
      const lines = hourBlocks.map(b => `${b.label}: ${b.appetiteSuppressionPct}%`).join(', ');
      return `Today's ${drugName} intraday appetite curve:\n${lines}\nCurrent window (${current?.label ?? 'unknown'}): ~${current?.appetiteSuppressionPct ?? '?'}% suppressed.`;
    }
    const today = forecastDays.find(d => d.isToday);
    const lines = forecastDays.map(d => `Day ${d.cycleDay}: ${d.appetiteSuppressionPct}%`).join(', ');
    const todayLine = today
      ? `Today (Day ${today.cycleDay}): ~${today.appetiteSuppressionPct}% appetite suppressed.`
      : '';
    return `Today is Day ${today?.cycleDay ?? '?'} of your ${drugName} ${injFreqDays}-day cycle.\n${injFreqDays}-day appetite suppression forecast:\n${lines}\n${todayLine}`;
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

  // ── Intraday (daily drug) mode ────────────────────────────────────────────────
  if (hourBlocks && hourBlocks.length > 0) {
    const currentBlock = hourBlocks.find(b => b.isCurrent) ?? null;
    const cycleLabel = 'Today\'s Appetite Curve';
    const cycleSubtitle = 'Daily dose · 4-hour windows';
    return (
      <Pressable
        style={s.container}
        onPress={handleCardPress}
        onLongPress={handleLongPress}
        delayLongPress={500}
      >
        <View style={s.header}>
          <Text style={s.title}>Appetite Forecast</Text>
          <View style={s.headerRight}>
            <Text style={s.chevron}>{isExpanded ? '↑ Details' : '↓ Details'}</Text>
            <Text style={s.subtitle}>  {cycleSubtitle}</Text>
          </View>
        </View>
        <View style={[s.pills, { gap: 3 }]}>
          {hourBlocks.map(block => {
            const blockColor = PHASE_BLOCK_COLORS[block.phase];
            return (
              <Pressable
                key={block.blockIndex}
                style={[
                  s.pill,
                  block.isCurrent && {
                    backgroundColor: blockColor,
                    borderColor: '#FF742A',
                    borderWidth: 2,
                    paddingVertical: 14,
                  },
                ]}
                onPress={() => {}}
              >
                <View style={[s.stateDot, { backgroundColor: block.isCurrent ? 'rgba(255,255,255,0.85)' : blockColor }]} />
                <Text style={[s.dayLabel, block.isCurrent && s.dayLabelToday, { fontSize: 9 }]}>
                  {block.isCurrent ? 'NOW' : block.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {currentBlock && (
          <View style={s.dayDetail}>
            <View style={s.dayDetailHeader}>
              <View style={[s.dayDetailDot, { backgroundColor: PHASE_BLOCK_COLORS[currentBlock.phase] }]} />
              <Text style={s.dayDetailTitle}>
                {'Now · '}{currentBlock.phase === 'post_dose' ? 'Post-Dose' : currentBlock.phase === 'peak' ? 'Peak Window' : 'Approaching Trough'}
              </Text>
            </View>
            <View style={s.dayDetailStats}>
              <View style={s.dayDetailStat}>
                <Text style={s.dayDetailStatVal}>{hungerLevelFromPhase(currentBlock.phase)}</Text>
                <Text style={s.dayDetailStatLbl}>Hunger level</Text>
              </View>
              <View style={s.dayDetailStatDivider} />
              <View style={s.dayDetailStat}>
                <Text style={s.dayDetailStatVal}>{currentBlock.pkConcentrationPct}%</Text>
                <Text style={s.dayDetailStatLbl}>Drug level</Text>
              </View>
            </View>
            <Text style={s.dayDetailSubNote}>~{currentBlock.appetiteSuppressionPct}% below your drug-free appetite</Text>
          </View>
        )}

        <View style={s.legend}>
          {(['post_dose', 'peak', 'trough'] as const).map(phase => (
            <View key={phase} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: PHASE_BLOCK_COLORS[phase] }]} />
              <Text style={s.legendLabel}>
                {phase === 'post_dose' ? 'Post-Dose' : phase === 'peak' ? 'Peak' : 'Trough'}
              </Text>
            </View>
          ))}
        </View>
        {!isExpanded && <Text style={s.hintText}>Tap for details · Hold for AI</Text>}
      </Pressable>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (forecastDays.length === 0) {
    const cycleLabel = injFreqDays === 1 ? '24-hour curve' : `${injFreqDays}-day cycle`;
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Appetite Forecast</Text>
          <Text style={s.subtitle}>{cycleLabel}</Text>
        </View>
        <Text style={s.emptyBody}>
          {injFreqDays === 1
            ? 'Log your first dose to unlock today\'s intraday forecast.'
            : `Log your first injection to unlock your ${injFreqDays}-day forecast.`}
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
  const cycleSubtitleLabel = `${injFreqDays}-day cycle`;
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
          <Text style={s.subtitle}>  {cycleSubtitleLabel}</Text>
        </View>
      </View>

      {/* Pills — compact for 14-day cycles */}
      <View style={[s.pills, injFreqDays > 7 && { gap: 2 }]}>
        {forecastDays.map(day => (
          <ForecastPill
            key={day.cycleDay}
            day={day}
            selected={selectedDay?.cycleDay === day.cycleDay}
            onPress={() => handleDayPress(day)}
            compact={injFreqDays > 7}
          />
        ))}
      </View>

      {/* Day Detail Panel */}
      {selectedDay && (
        <View style={s.dayDetail}>
          <View style={s.dayDetailHeader}>
            <View style={[s.dayDetailDot, { backgroundColor: STATE_COLORS[selectedDay.state] }]} />
            <Text style={s.dayDetailTitle}>
              {selectedDay.isToday ? 'Today' : formatDayDetailDate(selectedDay.dateStr)}
              {' · '}{selectedDay.label}
            </Text>
            <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setSelectedDay(null); }}>
              <Text style={s.dayDetailClose}>✕</Text>
            </Pressable>
          </View>

          <View style={s.dayDetailStats}>
            <View style={s.dayDetailStat}>
              <Text style={s.dayDetailStatVal}>{hungerLevelLabel(selectedDay.state)}</Text>
              <Text style={s.dayDetailStatLbl}>Hunger level</Text>
            </View>
            <View style={s.dayDetailStatDivider} />
            <View style={s.dayDetailStat}>
              <Text style={s.dayDetailStatVal}>{selectedDay.pkConcentrationPct}%</Text>
              <Text style={s.dayDetailStatLbl}>Drug level</Text>
            </View>
            <View style={s.dayDetailStatDivider} />
            <View style={s.dayDetailStat}>
              <Text style={s.dayDetailStatVal}>{selectedDay.energyForecastPct}%</Text>
              <Text style={s.dayDetailStatLbl}>Energy forecast</Text>
            </View>
          </View>
          <Text style={s.dayDetailSubNote}>~{selectedDay.appetiteSuppressionPct}% below your drug-free appetite</Text>

          {selectedDay.isProjected && (
            <Text style={s.dayDetailProjectedNote}>Projected (assumes injection today)</Text>
          )}
          <Text style={s.dayDetailTip}>{MEAL_TIPS[selectedDay.state]}</Text>

          <Pressable style={s.dayDetailAiBtn} onPress={() => openDayAiChat(selectedDay)}>
            <Text style={s.dayDetailAiBtnText}>Ask AI about this day →</Text>
          </Pressable>
        </View>
      )}

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
              <MaterialIcons name="analytics" size={14} color="rgba(255,255,255,0.5)" />
              <Text style={s.expandText}>
                {'Data source: Based on your last logged injection'}
                {injectionDate ? ` (${injectionDate})` : ''}
                {` and the FDA-validated pharmacokinetic model for ${drugName}.`}
              </Text>
            </View>
            <View style={s.expandRow}>
              <MaterialIcons name="restaurant" size={14} color="rgba(255,255,255,0.5)" />
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
      ...cardElevation(c.isDark),
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
      fontFamily: 'Inter_700Bold',
    },
    subtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.35),
      letterSpacing: 0.5,
      fontFamily: 'Inter_400Regular',
    },
    chevron: {
      fontSize: 11,
      fontWeight: '600',
      color: w(0.4),
      fontFamily: 'Inter_400Regular',
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
    stateDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
    },
    dayLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: w(0.6),
      fontFamily: 'Inter_400Regular',
    },
    dayLabelToday: {
      color: '#FFFFFF',
      fontSize: 9,
      letterSpacing: 0.3,
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
      fontFamily: 'Inter_400Regular',
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
      fontFamily: 'Inter_400Regular',
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
      fontFamily: 'Inter_400Regular',
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
      fontFamily: 'Inter_400Regular',
    },
    hintText: {
      fontSize: 11,
      color: w(0.3),
      textAlign: 'center',
      marginTop: 8,
      fontFamily: 'Inter_400Regular',
    },
    dayDetail: {
      marginTop: 10,
      padding: 14,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: 14,
      gap: 10,
    },
    dayDetailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    dayDetailDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    dayDetailTitle: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
      color: c.textPrimary,
      fontFamily: 'Inter_400Regular',
    },
    dayDetailClose: {
      fontSize: 13,
      color: c.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
      fontFamily: 'Inter_400Regular',
    },
    dayDetailStats: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dayDetailStat: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
    },
    dayDetailStatDivider: {
      width: StyleSheet.hairlineWidth,
      height: 28,
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
    },
    dayDetailStatVal: {
      fontSize: 17,
      fontWeight: '800',
      color: c.textPrimary,
      fontFamily: 'Inter_400Regular',
    },
    dayDetailStatLbl: {
      fontSize: 10,
      color: c.textSecondary,
      fontFamily: 'Inter_400Regular',
      textAlign: 'center',
    },
    dayDetailProjectedNote: {
      fontSize: 11,
      color: '#FF742A',
      fontFamily: 'Inter_400Regular',
      fontStyle: 'italic',
    },
    dayDetailTip: {
      fontSize: 12,
      color: c.textSecondary,
      lineHeight: 17,
      fontFamily: 'Inter_400Regular',
    },
    dayDetailSubNote: {
      fontSize: 11,
      color: c.textSecondary,
      fontFamily: 'Inter_400Regular',
      fontStyle: 'italic',
      opacity: 0.7,
    },
    dayDetailAiBtn: {
      alignSelf: 'flex-start',
    },
    dayDetailAiBtnText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FF742A',
      fontFamily: 'Inter_400Regular',
    },
    emptyBody: {
      fontSize: 13,
      color: w(0.6),
      fontFamily: 'Inter_400Regular',
      lineHeight: 19,
      marginBottom: 8,
    },
    emptyNote: {
      fontSize: 12,
      color: w(0.4),
      fontFamily: 'Inter_400Regular',
      lineHeight: 17,
    },
  });
};
