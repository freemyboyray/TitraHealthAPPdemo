import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { useAppTheme } from '@/contexts/theme-context';
import { cardElevation, type AppColors } from '@/constants/theme';
import type { SideEffectLog } from '@/stores/log-store';
import { computePairSeries, type CoOccurrencePair } from '@/lib/side-effect-insights';
import { useExpandToFullscreen, ExpandOverlay } from '@/components/ui/expand-in-place';
import { SeverityLineChart } from '@/components/insights/severity-line-chart';
import { EffectIcon, effectLabel } from '@/components/insights/effect-icon';

const FF = 'System';
const PAIR_A_COLOR = '#FF742A';
const PAIR_B_COLOR = '#5B8BF5';

const PAIR_NOTES: Record<string, string> = {
  'fatigue::nausea':           'Often a dehydration signal',
  'headache::nausea':          'Often a dehydration signal',
  'fatigue::headache':         'Often a dehydration signal',
  'bloating::constipation':    'A reduced gut-motility cluster',
  'constipation::nausea':      'A slowed-digestion cluster',
  'appetite_loss::fatigue':    'Low intake may be a factor',
  'appetite_loss::nausea':     'A GI-suppression cluster',
  'food_noise::appetite_loss': 'A strong appetite-suppression response',
};

function pairNote(a: string, b: string): string | null {
  return PAIR_NOTES[[a, b].sort().join('::')] ?? null;
}

// What each symptom is + what their co-occurrence may mean. Shown after the
// overlap graph in the expanded view.
const PAIR_MEANINGS: Record<string, string> = {
  'fatigue::nausea': "Nausea is the queasy, off-food feeling that tends to peak early in your cycle, and fatigue is the low-energy drag that often trails it. Showing up together usually points to dehydration and low intake: when you're too queasy to eat or drink, you end up under-fueled and tired. Steady fluids and easy protein often take the edge off both.",
  'headache::nausea': "Nausea is that early-cycle queasiness, and headaches on a GLP-1 are most often a dehydration or low-intake signal rather than the drug itself. When they land on the same day, fluids are usually the common thread, since the same dip that brings on the headache can deepen the nausea. Hydrating early in the day tends to help both.",
  'fatigue::headache': 'Fatigue is a general low-energy drag, and headaches here usually trace back to dehydration or eating less. Together they often mean your fluids and food are running low, leaving the body short on the basics it needs to feel steady. Topping up water and regular balanced meals usually eases the pair.',
  'bloating::constipation': "Both come from the slower digestion these medications cause: food and gas sit in the gut longer, which shows up as bloating and as harder, less frequent stools. When they cluster, it's the same reduced motility behind both. Fiber, fluids, and movement are what tend to get things moving again.",
  'constipation::nausea': "Constipation comes from slowed gut movement, and that same backed-up, slow-emptying stomach can also leave you queasy. Seeing them together points to digestion running sluggish overall rather than two separate issues. Gentle fiber, hydration, and lighter meals often relieve both at once.",
  'appetite_loss::fatigue': "Suppressed appetite is the intended effect of these medications, but paired with fatigue it can mean you're simply not eating enough to keep your energy up. The link is usually under-fueling. Prioritizing protein even when you're not hungry tends to lift the fatigue.",
  'appetite_loss::nausea': "Nausea and a dropped appetite often travel together early on, since feeling queasy naturally makes food less appealing. Together they're a sign your gut is adjusting to the medication. The risk is under-eating, so small, bland, protein-forward meals help you keep intake up while the nausea settles.",
  'appetite_loss::food_noise': 'Food noise is the constant background pull of food thoughts and cravings; suppressed appetite is reduced hunger. When both move together it usually means the medication is quieting your appetite signals strongly, often a welcome pattern. The thing to watch is that very low intake can make hitting your protein and nutrition targets harder.',
};

function clusterMeaning(a: string, b: string): string {
  const specific = PAIR_MEANINGS[[a, b].sort().join('::')];
  if (specific) return specific;
  const A = effectLabel(a);
  const B = effectLabel(b);
  return `${A} and ${B} keep landing on the same days. When two symptoms move together like this, it usually points to a shared trigger, such as a peak in your medication level, a dip in hydration, or a heavier meal, rather than two unrelated problems. Easing the common driver often calms both at once.`;
}

export function ClusterCard({
  pairs, logs, totalLogs,
}: {
  pairs: CoOccurrencePair[];
  logs: SideEffectLog[];
  totalLogs: number;
}) {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const lead = pairs.length === 0
    ? (totalLogs < 4 ? 'Clusters appear as you log more variety.' : 'Your symptoms tend to appear on their own.')
    : 'Symptoms that tend to rise on the same days. Tap a pair to see them side by side.';

  return (
    <View style={s.card}>
      <Text style={s.lead}>{lead}</Text>
      {pairs.length > 0 && (
        <View style={{ marginTop: 6 }}>
          {pairs.map((p, i) => (
            <View key={`${p.a}::${p.b}`}>
              {i > 0 && <View style={[s.divider, { backgroundColor: w(0.06) }]} />}
              <ClusterRow pair={p} logs={logs} colors={colors} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ClusterRow({ pair, logs, colors }: { pair: CoOccurrencePair; logs: SideEffectLog[]; colors: AppColors }) {
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  const exp = useExpandToFullscreen({ mode: 'card', cardHeight: 620 });
  const [chartW, setChartW] = useState(0);

  const nameA = effectLabel(pair.a);
  const nameB = effectLabel(pair.b);
  const note = pairNote(pair.a, pair.b);
  const series = useMemo(() => computePairSeries(logs, pair.a, pair.b, 30), [logs, pair.a, pair.b]);

  const onChartLayout = (e: LayoutChangeEvent) => setChartW(e.nativeEvent.layout.width);

  return (
    <>
      <Pressable
        ref={exp.cardRef}
        onPress={exp.open}
        accessibilityRole="button"
        accessibilityLabel={`${nameA} and ${nameB} cluster. Tap to expand`}
        style={s.row}
      >
        <View style={s.iconStack}>
          <View style={[s.iconCircle, { backgroundColor: w(0.06) }]}>
            <EffectIcon type={pair.a} size={14} color={colors.textPrimary} />
          </View>
          <View style={[s.iconCircle, s.iconCircleOverlap, { backgroundColor: w(0.06), borderColor: colors.surface }]}>
            <EffectIcon type={pair.b} size={14} color={colors.textPrimary} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.rowName}>{nameA} + {nameB}</Text>
          <Text style={[s.rowSub, { color: w(0.45) }]}>
            {pair.daysTogether} shared {pair.daysTogether === 1 ? 'day' : 'days'}{note ? `, ${note.toLowerCase()}` : ''}
          </Text>
        </View>
        <View style={s.miniGraph}>
          <SeverityLineChart
            series={[
              { points: series.a, color: PAIR_A_COLOR },
              { points: series.b, color: PAIR_B_COLOR },
            ]}
            width={80}
            height={40}
            colors={colors}
            compact
          />
        </View>
      </Pressable>

      <ExpandOverlay exp={exp}>
        <View style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={s.expHeader}>
            <Text style={s.expTitle}>{nameA} + {nameB}</Text>
            <Pressable onPress={exp.close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <X size={24} color={w(0.45)} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
            <Text style={s.lead}>
              These two landed on {pair.daysTogether} of the same {pair.daysTogether === 1 ? 'day' : 'days'} this month.
            </Text>

            <View style={{ marginTop: 14 }} onLayout={onChartLayout}>
              {chartW > 0 && (
                <SeverityLineChart
                  series={[
                    { points: series.a, color: PAIR_A_COLOR },
                    { points: series.b, color: PAIR_B_COLOR },
                  ]}
                  width={chartW}
                  height={190}
                  colors={colors}
                />
              )}
            </View>

            <View style={s.legendRow}>
              <View style={s.legendItem}>
                <View style={[s.legendLine, { backgroundColor: PAIR_A_COLOR }]} />
                <Text style={[s.legendText, { color: w(0.5) }]}>{nameA}</Text>
              </View>
              <View style={s.legendItem}>
                <View style={[s.legendLine, { backgroundColor: PAIR_B_COLOR }]} />
                <Text style={[s.legendText, { color: w(0.5) }]}>{nameB}</Text>
              </View>
            </View>

            <Text style={[s.explainer, { color: w(0.62) }]}>
              {clusterMeaning(pair.a, pair.b)}
            </Text>
          </ScrollView>
        </View>
      </ExpandOverlay>
    </>
  );
}

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    card: {
      borderRadius: 24,
      backgroundColor: c.surface,
      borderWidth: c.isDark ? 0 : 0.5,
      borderColor: c.border,
      padding: 18,
      ...cardElevation(c.isDark),
    },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },

    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
    iconStack: { flexDirection: 'row', alignItems: 'center' },
    iconCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    iconCircleOverlap: { marginLeft: -10, borderWidth: 2 },
    rowName: { fontSize: 15.5, fontWeight: '700', color: c.textPrimary, fontFamily: FF, letterSpacing: -0.2 },
    rowSub: { fontSize: 12.5, fontFamily: FF, marginTop: 2 },
    miniGraph: { width: 80, height: 40, alignItems: 'center', justifyContent: 'center' },

    expHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10,
    },
    expTitle: { fontSize: 21, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.4, fontFamily: FF, flex: 1 },
    lead: { fontSize: 14.5, color: w(0.6), lineHeight: 21, fontFamily: FF },
    explainer: { fontSize: 13.5, lineHeight: 19, fontFamily: FF, marginTop: 18 },
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 14 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    legendLine: { width: 16, height: 3, borderRadius: 1.5 },
    legendText: { fontSize: 13, fontWeight: '600', fontFamily: FF },
  });
};
