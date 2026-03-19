import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
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

import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useLogStore } from '@/stores/log-store';
import { useProfile } from '@/contexts/profile-context';
import { scheduleCheckinReminder } from '@/lib/notifications';

const ORANGE = '#FF742A';
const FF = 'Helvetica Neue';

// ─── Types ────────────────────────────────────────────────────────────────────

type DomainKey =
  | 'gi_burden'
  | 'energy_mood'
  | 'appetite'
  | 'food_noise'
  | 'sleep_quality'
  | 'activity_quality'
  | 'mental_health';

type StatusResult = { label: string; color: string };

type DomainConfig = {
  key: DomainKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  questions: readonly string[];
  /** When true, higher sum = better (activity). All other domains: higher sum = worse. */
  higherIsBetter: boolean;
  getStatus: (sum: number) => StatusResult;
};

// ─── Status helpers ───────────────────────────────────────────────────────────

/**
 * Labels are ordered by raw sum ascending (0 = lowest sum, 3 = highest sum).
 * For "higher is worse" domains: labels[0] = best (low symptoms), labels[3] = worst.
 * For "higher is better" domains (activity): labels[0] = worst (low activity), labels[3] = best.
 */
function makeStatus(
  sum: number,
  labels: [string, string, string, string],
  colors: [string, string, string, string],
): StatusResult {
  if (sum <= 2) return { label: labels[0], color: colors[0] };
  if (sum <= 5) return { label: labels[1], color: colors[1] };
  if (sum <= 8) return { label: labels[2], color: colors[2] };
  return           { label: labels[3], color: colors[3] };
}

// ─── Domain definitions ───────────────────────────────────────────────────────

const DOMAINS: DomainConfig[] = [
  {
    key: 'gi_burden',
    label: 'GI Symptoms',
    icon: 'medical-outline',
    questions: [
      'I felt nauseous, vomited, or had acid reflux.',
      'I had stomach pain, cramping, or bloating.',
      'GI issues disrupted my eating or daily routine.',
    ],
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Minimal', 'Mild', 'Moderate', 'Severe'],
      ['#27AE60', '#F6CB45', '#E8960C', '#E53E3E'],
    ),
  },
  {
    key: 'energy_mood',
    label: 'Energy & Mood',
    icon: 'flash-outline',
    questions: [
      'My energy levels were low or inconsistent.',
      'I felt mentally foggy or drained.',
      'I felt irritable, down, or emotionally flat.',
    ],
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Excellent', 'Good', 'Fair', 'Low'],
      ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E'],
    ),
  },
  {
    key: 'appetite',
    label: 'Appetite',
    icon: 'restaurant-outline',
    questions: [
      'I struggled to eat enough or skipped meals.',
      'Food felt unappealing for most of the day.',
      'My appetite felt unpredictable or out of control.',
    ],
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Excellent', 'Good', 'Fair', 'Low'],
      ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E'],
    ),
  },
  {
    key: 'food_noise',
    label: 'Food Noise',
    icon: 'volume-medium-outline',
    questions: [
      'I had frequent, intrusive thoughts about food.',
      'Food cravings made it hard to focus on other things.',
      "I thought about eating even when I wasn't hungry.",
    ],
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Quiet', 'Mild', 'Moderate', 'High'],
      ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E'],
    ),
  },
  {
    key: 'sleep_quality',
    label: 'Sleep',
    icon: 'moon-outline',
    questions: [
      'I had trouble falling or staying asleep.',
      'I woke up feeling unrefreshed or tired.',
      'Poor sleep affected how I felt during the day.',
    ],
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Excellent', 'Good', 'Fair', 'Poor'],
      ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E'],
    ),
  },
  {
    key: 'activity_quality',
    label: 'Activity',
    icon: 'barbell-outline',
    questions: [
      'I completed exercise or movement sessions.',
      'I felt physically capable and strong.',
      'I hit my step or activity goals most days.',
    ],
    higherIsBetter: true,
    getStatus: (s) => makeStatus(s,
      ['Low', 'Fair', 'Good', 'Excellent'],
      ['#E53E3E', '#F6CB45', '#5AC8FA', '#27AE60'],
    ),
  },
  {
    key: 'mental_health',
    label: 'Mental Health',
    icon: 'heart-outline',
    questions: [
      'I felt anxious, worried, or on edge.',
      'I felt sad, hopeless, or unmotivated.',
      'Emotional challenges affected my eating or routine.',
    ],
    higherIsBetter: false,
    getStatus: (s) => makeStatus(s,
      ['Stable', 'Mild', 'Moderate', 'High'],
      ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E'],
    ),
  },
];

const DOT_LABELS = ['Not at all', 'A little', 'Sometimes', 'Often', 'Always'];

function toScore100(sum: number, higherIsBetter: boolean): number {
  return Math.round(higherIsBetter ? (sum / 12) * 100 : (1 - sum / 12) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function DotScale({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'space-between' }}>
      {[0, 1, 2, 3, 4].map((v) => (
        <TouchableOpacity
          key={v}
          onPress={() => onChange(v)}
          activeOpacity={0.7}
          style={{ alignItems: 'center', gap: 4, flex: 1 }}
        >
          <View
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: value === v ? ORANGE : 'rgba(255,255,255,0.08)',
              borderWidth: 1.5,
              borderColor: value === v ? ORANGE : 'rgba(255,255,255,0.15)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: value === v ? '#FFF' : 'rgba(255,255,255,0.35)' }}>
              {v}
            </Text>
          </View>
          <Text
            style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textAlign: 'center', width: 44 }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {DOT_LABELS[v]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

// Build domain list adapted for daily vs weekly/bi-weekly drugs.
function buildDomains(isDaily: boolean): DomainConfig[] {
  const base = DOMAINS.map(d => {
    if (d.key === 'gi_burden' && isDaily) {
      return {
        ...d,
        questions: [
          'I felt nauseous, vomited, or had acid reflux.',
          'GI symptoms (nausea, stomach pain) occurred at a predictable time each day.',
          'GI issues disrupted my eating or daily routine.',
        ] as const,
      };
    }
    if (d.key === 'appetite' && isDaily) {
      return {
        ...d,
        questions: [
          'I struggled to eat enough or skipped meals.',
          'My hunger noticeably increased toward the end of the day (before my next dose).',
          'My appetite felt unpredictable or varied significantly throughout the day.',
        ] as const,
      };
    }
    return d;
  });
  // For daily drugs: add a dose consistency domain
  if (isDaily) {
    const doseDomain: DomainConfig = {
      key: 'gi_burden' as DomainKey, // reuse an existing key for submission compat — prepended, won't replace
      label: 'Dose Consistency',
      icon: 'calendar-outline',
      questions: [
        'I missed one or more doses this week.',
        'I took my dose at an inconsistent time (different hour each day).',
        'I took my dose with food or water when I should have taken it on an empty stomach.',
      ],
      higherIsBetter: false,
      getStatus: (s) => makeStatus(s,
        ['Excellent', 'Good', 'Fair', 'Poor'],
        ['#27AE60', '#5AC8FA', '#F6CB45', '#E53E3E'],
      ),
    };
    // Only add if not already there (avoid duplicate)
    if (!base.some(d => d.label === 'Dose Consistency')) {
      base.unshift(doseDomain);
    }
  }
  return base;
}

export default function WeeklyCheckinScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { addWeeklyCheckin } = useLogStore();
  const { profile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);

  const isDaily = (profile?.injectionFrequencyDays ?? 7) === 1;
  const domains = useMemo(() => buildDomains(isDaily), [isDaily]);

  // answers[domainIndex][questionIndex] = 0–4
  const [answers, setAnswers] = useState<number[][]>(
    domains.map((d) => d.questions.map(() => 0)),
  );
  const [loading, setLoading] = useState(false);

  function setAnswer(domainIdx: number, qIdx: number, val: number) {
    setAnswers((prev) => {
      const next = prev.map((row) => [...row]);
      next[domainIdx][qIdx] = val;
      return next;
    });
  }

  const domainSums = answers.map((row) => row.reduce((a, b) => a + b, 0));

  async function handleSave() {
    if (loading) return;
    setLoading(true);
    try {
      const scoresMap: Record<string, number> = {};
      const labelsMap: Record<string, string> = {};

      const savedAt = new Date().toISOString();

      await Promise.all(
        domains.map(async (domain, i) => {
          const sum = domainSums[i];
          const score100 = toScore100(sum, domain.higherIsBetter);
          const answersMap: Record<string, number> = {};
          answers[i].forEach((v, qi) => { answersMap[`q${qi + 1}`] = v; });
          await addWeeklyCheckin(domain.key as any, answersMap, score100);
          scoresMap[domain.key] = score100;
          labelsMap[domain.key] = domain.getStatus(sum).label;
        }),
      );

      await scheduleCheckinReminder(savedAt);

      router.replace({
        pathname: '/entry/weekly-checkin-result',
        params: {
          scores: JSON.stringify(scoresMap),
          labels: JSON.stringify(labelsMap),
        },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: insets.top + 10, paddingBottom: 14,
      }}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)' }]} />
          <GlassBorder r={20} />
          <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFF', fontFamily: FF }}>Weekly Check-In</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>7 areas · ~3 min</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {domains.map((domain, domainIdx) => {
          const sum = domainSums[domainIdx];
          const status = domain.getStatus(sum);
          return (
            <View key={domain.key} style={[s.card, { marginBottom: 16 }]}>
              <BlurView intensity={78} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={[StyleSheet.absoluteFillObject, { borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.04)' }]} />
              <GlassBorder r={20} />

              <View style={{ padding: 18 }}>
                {/* Domain header */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center',
                  justifyContent: 'space-between', marginBottom: 16,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{
                      width: 34, height: 34, borderRadius: 17,
                      backgroundColor: 'rgba(255,116,42,0.15)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name={domain.icon} size={18} color={ORANGE} />
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFF', fontFamily: FF }}>
                      {domain.label}
                    </Text>
                  </View>

                  {/* Live status badge — updates as user answers */}
                  <View style={{
                    backgroundColor: `${status.color}22`,
                    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: status.color, fontFamily: FF }}>
                      {status.label}
                    </Text>
                  </View>
                </View>

                {/* Questions */}
                {domain.questions.map((q, qIdx) => (
                  <View
                    key={qIdx}
                    style={{ marginBottom: qIdx < domain.questions.length - 1 ? 18 : 4 }}
                  >
                    <Text style={{
                      fontSize: 13, fontWeight: '600',
                      color: 'rgba(255,255,255,0.85)', fontFamily: FF, lineHeight: 18, marginBottom: 4,
                    }}>
                      {q}
                    </Text>
                    <DotScale
                      value={answers[domainIdx][qIdx]}
                      onChange={(v) => setAnswer(domainIdx, qIdx, v)}
                    />
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        <Text style={{
          fontSize: 12, color: 'rgba(255,255,255,0.28)',
          textAlign: 'center', marginTop: 4, lineHeight: 17,
        }}>
          Answer for this past week. Your responses automatically adjust this week's targets.
        </Text>
      </ScrollView>

      {/* CTA */}
      <View style={{
        paddingHorizontal: 20, paddingTop: 12,
        paddingBottom: insets.bottom + 16,
        backgroundColor: '#000',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.06)',
      }}>
        <TouchableOpacity
          style={{
            backgroundColor: ORANGE, borderRadius: 28, paddingVertical: 17,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
          }}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.4, fontFamily: FF }}>
                Complete Check-In
              </Text>
          }
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (_c: AppColors) => StyleSheet.create({
  headerBtn: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  card: {
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },
});
