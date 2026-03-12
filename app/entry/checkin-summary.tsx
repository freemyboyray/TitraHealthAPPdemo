import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLogStore } from '@/stores/log-store';

const BG     = '#000000';
const ORANGE = '#FF742A';
const FF     = 'Helvetica Neue';

type CheckinType = 'food_noise' | 'energy_mood' | 'appetite';

const TYPE_LABELS: Record<CheckinType, string> = {
  food_noise:   'Food Noise',
  energy_mood:  'Energy & Mood',
  appetite:     'Appetite & Satiety',
};

function scoreColor(score: number): string {
  if (score >= 70) return '#27AE60';
  if (score >= 50) return '#F6CB45';
  if (score >= 30) return '#E8960C';
  return '#E53E3E';
}

function getExplanation(type: CheckinType, score: number): string {
  if (type === 'food_noise') {
    if (score >= 80) return 'Your food noise is at its lowest — GLP-1 is effectively quieting food cravings. This is your prime window to build lasting habits.';
    if (score >= 55) return 'Mild food thoughts are present. This is common in early weeks as the medication builds up.';
    if (score >= 30) return 'Moderate food noise suggests the medication may still be titrating, or a dose adjustment may help.';
    return 'High food noise can indicate the medication hasn\'t fully taken effect yet. Discuss with your prescriber if this persists.';
  }
  if (type === 'energy_mood') {
    if (score >= 75) return 'Your energy and mood are strong this week. Consistent sleep and protein intake help maintain this through GLP-1 treatment.';
    if (score >= 50) return 'Energy and mood are in a typical range for GLP-1 therapy. Sleep quality and protein intake are the biggest levers.';
    if (score >= 25) return 'Low energy is common during dose-escalation. Prioritize sleep and protein — both directly affect GLP-1 outcomes.';
    return 'Very low energy or mood for multiple weeks warrants a conversation with your care team.';
  }
  // appetite
  if (score >= 75) return 'Excellent appetite control this week. GLP-1 is working well — stay consistent with protein targets to protect lean mass.';
  if (score >= 50) return 'Appetite is moderately controlled — normal for early treatment weeks.';
  if (score >= 25) return 'Smaller, more frequent meals help GLP-1\'s gastric emptying mechanism work better.';
  return 'Low appetite control may reflect early treatment. Note your injection timing and discuss with your prescriber if persistent.';
}

function SparkDot({ score, isLatest }: { score: number; isLatest: boolean }) {
  const color = scoreColor(score);
  const size  = isLatest ? 10 : 7;
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: isLatest ? 1 : 0.55,
    }} />
  );
}

function GlassBorder({ r = 20 }: { r?: number }) {
  return (
    <View pointerEvents="none" style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      borderRadius: r, borderWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.13)',
      borderLeftColor: 'rgba(255,255,255,0.08)',
      borderRightColor: 'rgba(255,255,255,0.03)',
      borderBottomColor: 'rgba(255,255,255,0.02)',
    }} />
  );
}

export default function CheckinSummaryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    type: string;
    score: string;
    rawScore: string;
    label: string;
  }>();

  const logStore = useLogStore();

  const type     = (params.type ?? 'food_noise') as CheckinType;
  const score    = parseInt(params.score ?? '0', 10);
  const rawScore = parseInt(params.rawScore ?? '0', 10);
  const label    = params.label ?? '';

  const typeLabel  = TYPE_LABELS[type] ?? type;
  const color      = scoreColor(score);
  const explanation = getExplanation(type, score);

  // Build sparkline from store
  let sparkScores: number[] = [];
  if (type === 'food_noise') {
    const logs = (logStore.foodNoiseLogs ?? []) as { score: number }[];
    sparkScores = logs.slice(0, 3).map(l => Math.round((1 - l.score / 20) * 100)).reverse();
  } else {
    const logs = (logStore.weeklyCheckins?.[type === 'energy_mood' ? 'energy_mood' : 'appetite'] ?? []) as { score: number }[];
    sparkScores = logs.slice(0, 3).map(l => l.score).reverse();
  }

  // Ensure current score is always the last dot
  if (sparkScores.length === 0 || sparkScores[sparkScores.length - 1] !== score) {
    sparkScores = [...sparkScores.slice(-2), score];
  }

  const showTrend = sparkScores.length >= 2;

  // Fetch checkins for trend if needed
  useEffect(() => {
    if (type === 'energy_mood' || type === 'appetite') {
      logStore.fetchWeeklyCheckins(type === 'energy_mood' ? 'energy_mood' : 'appetite');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
      }}>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.7}
        >
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' }]} />
          <GlassBorder r={20} />
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <View style={s.pill}>
          <Text style={s.pillText}>Weekly Check-In  ·  {typeLabel}</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Score card */}
        <View style={[s.card, { marginBottom: 16 }]}>
          <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
          <GlassBorder r={20} />
          <View style={{ padding: 28, alignItems: 'center' }}>
            <Text style={[s.scoreLarge, { color }]}>{score}</Text>
            <Text style={s.scoreDenom}>/100</Text>
            {type === 'food_noise' && (
              <Text style={s.rawScoreNote}>Raw score: {rawScore}/20</Text>
            )}
            <View style={[s.badge, { backgroundColor: `${color}22`, marginTop: 12 }]}>
              <Text style={[s.badgeText, { color }]}>{label}</Text>
            </View>
            {showTrend && (
              <View style={s.sparkRow}>
                {sparkScores.map((v, i) => (
                  <SparkDot key={i} score={v} isLatest={i === sparkScores.length - 1} />
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Explanation card */}
        <View style={s.card}>
          <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
          <GlassBorder r={20} />
          <View style={{ padding: 20 }}>
            <Text style={s.explanationTitle}>What This Means</Text>
            <Text style={s.explanationBody}>{explanation}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Done CTA */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 12,
        paddingBottom: insets.bottom + 16,
        backgroundColor: BG,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
      }}>
        <TouchableOpacity
          style={s.doneBtn}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  pill: {
    backgroundColor: 'rgba(255,116,42,0.15)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
  },
  pillText: {
    fontSize: 12, fontWeight: '700', color: ORANGE, fontFamily: FF,
  },
  card: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: '#111111',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
    marginBottom: 12,
  },
  scoreLarge: {
    fontSize: 72, fontWeight: '800', lineHeight: 76, fontFamily: FF,
  },
  scoreDenom: {
    fontSize: 13, color: 'rgba(255,255,255,0.35)', fontFamily: FF, marginTop: 2,
  },
  rawScoreNote: {
    fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: FF, marginTop: 4,
  },
  badge: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
  },
  badgeText: {
    fontSize: 14, fontWeight: '700', fontFamily: FF, letterSpacing: 0.5,
  },
  sparkRow: {
    flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 14,
  },
  explanationTitle: {
    fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)',
    fontFamily: FF, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10,
  },
  explanationBody: {
    fontSize: 15, fontWeight: '500', color: '#FFFFFF',
    fontFamily: FF, lineHeight: 22,
  },
  doneBtn: {
    backgroundColor: ORANGE, borderRadius: 28, paddingVertical: 17,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
  },
  doneBtnText: {
    fontSize: 16, fontWeight: '800', color: '#FFF', fontFamily: FF, letterSpacing: 0.4,
  },
});
