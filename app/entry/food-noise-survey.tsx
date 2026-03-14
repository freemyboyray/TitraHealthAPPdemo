import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLogStore } from '@/stores/log-store';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

const ORANGE = '#FF742A';

const QUESTIONS = [
  'I found myself thinking about food when I wasn\'t hungry this week.',
  'Thoughts about food interrupted what I was doing.',
  'I felt like I couldn\'t stop thinking about food, even when I wanted to.',
  'Food thoughts made it harder to focus on other things in my life.',
  'I felt distressed by how much I thought about food.',
] as const;

const DOT_LABELS = ['Not at all', 'A little', 'Sometimes', 'Often', 'Extremely'];

function scoreInterpretation(score: number): { label: string; color: string } {
  if (score <= 4)  return { label: 'Minimal',  color: '#27AE60' };
  if (score <= 9)  return { label: 'Mild',      color: '#F6CB45' };
  if (score <= 14) return { label: 'Moderate',  color: '#E8960C' };
  return             { label: 'High',       color: '#E53E3E' };
}

function GlassBorder({ r = 20 }: { r?: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: r, borderWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.13)',
        borderLeftColor: 'rgba(255,255,255,0.08)',
        borderRightColor: 'rgba(255,255,255,0.03)',
        borderBottomColor: 'rgba(255,255,255,0.02)',
      }}
    />
  );
}

function DotScale({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const { colors: dotColors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'center' }}>
      {[0, 1, 2, 3, 4].map((v) => (
        <TouchableOpacity
          key={v}
          onPress={() => onChange(v)}
          activeOpacity={0.7}
          style={{ alignItems: 'center', gap: 4 }}
        >
          <View
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: value === v ? ORANGE : (dotColors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
              borderWidth: 1.5,
              borderColor: value === v ? ORANGE : (dotColors.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'),
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 15, fontWeight: '700',
                color: value === v ? '#FFF' : (dotColors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'),
              }}
            >
              {v}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 9, color: dotColors.isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
              letterSpacing: 0.2, textAlign: 'center', width: 44,
            }}
            numberOfLines={2}
          >
            {DOT_LABELS[v]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function FoodNoiseSurveyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addFoodNoiseLog } = useLogStore();
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [answers, setAnswers] = useState<number[]>([0, 0, 0, 0, 0]);
  const [loading, setLoading] = useState(false);

  const score = answers.reduce((s, v) => s + v, 0);
  const allAnswered = answers.every(v => v !== undefined);
  const interpretation = scoreInterpretation(score);

  // Plasticity window message (weeks 5–16, score 0–4)
  const lowNoiseMessage =
    score <= 4
      ? 'Your food noise is low — this is your prime window to build lasting habits.'
      : null;

  async function handleSave() {
    if (!allAnswered || loading) return;
    setLoading(true);
    try {
      await addFoodNoiseLog({
        score,
        q1: answers[0], q2: answers[1], q3: answers[2],
        q4: answers[3], q5: answers[4],
      });
      const displayScore = Math.round((1 - score / 20) * 100);
      router.replace({
        pathname: '/entry/checkin-summary',
        params: {
          type: 'food_noise',
          score: String(displayScore),
          rawScore: String(score),
          label: interpretation.label,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
        }}
      >
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <BlurView intensity={75} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.borderSubtle }]} />
          <GlassBorder r={20} />
          <Ionicons name="chevron-back" size={22} color={colors.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary }}>Food Noise Check-In</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>Weekly · 5 questions</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Score display */}
        <View style={[s.card, { marginBottom: 16 }]}>
          <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
          <GlassBorder r={20} />
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 48, fontWeight: '800', color: colors.textPrimary, lineHeight: 52 }}>
              {score}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, letterSpacing: 1.5, marginTop: 2 }}>
              OUT OF 20
            </Text>
            <View style={[s.badge, { backgroundColor: `${interpretation.color}22`, marginTop: 10 }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: interpretation.color, letterSpacing: 0.5 }}>
                {interpretation.label} Food Noise
              </Text>
            </View>
            {lowNoiseMessage && (
              <Text style={{ fontSize: 13, color: colors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', textAlign: 'center', marginTop: 10, lineHeight: 18 }}>
                {lowNoiseMessage}
              </Text>
            )}
          </View>
        </View>

        {/* Questions */}
        {QUESTIONS.map((q, idx) => (
          <View key={idx} style={[s.card, { marginBottom: 12 }]}>
            <BlurView intensity={78} tint={colors.blurTint} style={StyleSheet.absoluteFillObject} />
            <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: colors.glassOverlay }]} />
            <GlassBorder r={20} />
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 2 }}>
                <View style={s.qNumber}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: ORANGE }}>Q{idx + 1}</Text>
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary, lineHeight: 20 }}>
                  {q}
                </Text>
              </View>
              <DotScale
                value={answers[idx]}
                onChange={(v) => setAnswers(prev => {
                  const next = [...prev];
                  next[idx] = v;
                  return next;
                })}
              />
            </View>
          </View>
        ))}

        {/* Context note */}
        <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 17 }}>
          Answer for this past week. Your score is tracked over time to measure GLP-1 effectiveness.
        </Text>
      </ScrollView>

      {/* CTA */}
      <View
        style={{
          paddingHorizontal: 20, paddingTop: 12,
          paddingBottom: insets.bottom + 16,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <TouchableOpacity
          style={{
            backgroundColor: ORANGE,
            borderRadius: 28, paddingVertical: 17,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
          }}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.4 }}>
              Save Score · {score}/20
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  card: {
    borderRadius: 20, overflow: 'hidden', backgroundColor: c.surface,
    shadowColor: c.shadowColor, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },
  badge: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
  },
  qNumber: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,116,42,0.15)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
});
