import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ChevronLeft } from 'lucide-react-native';

import { CircleIconButton } from '@/components/ui/circle-icon-button';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { useLogStore } from '@/stores/log-store';
import { useProfile } from '@/contexts/profile-context';
import { scheduleWeeklyCheckinReminderAt } from '@/lib/notifications';
import {
  currentWeekWindow,
  getWeekWindow,
  getProgramWeekNumber,
  resolveEngagementStart,
  isWithinWindow,
} from '@/lib/program-week';
import { LucideIconByName } from '@/lib/lucide-icon-map';
import {
  CHECKIN_DOMAINS,
  CHECKIN_ASSETS,
  CHECKIN_QUESTIONS as QUESTIONS,
  CHECKIN_SCALE_LABELS as SCALE_LABELS,
  makeStatus,
  STATUS_GOOD, STATUS_OKAY, STATUS_MID, STATUS_BAD,
  type CheckinDomainKey,
  type CheckinDomainMeta,
} from '@/constants/checkin-domains';

const FF = 'System';

// The form layers daily-drug question variants onto the shared base questions.
type DomainConfig = CheckinDomainMeta & { questions: readonly string[] };

function toScore100(sum: number, higherIsBetter: boolean): number {
  return Math.round(higherIsBetter ? (sum / 12) * 100 : (1 - sum / 12) * 100);
}

// Build the domain list, adapted for daily vs weekly/bi-weekly drugs.
function buildDomains(isDaily: boolean): DomainConfig[] {
  const base: DomainConfig[] = CHECKIN_DOMAINS.map((d) => {
    let questions = QUESTIONS[d.key];
    if (d.key === 'gi_burden' && isDaily) {
      questions = [
        'I felt nauseous, vomited, or had acid reflux.',
        'GI symptoms occurred at a predictable time each day.',
        'GI issues disrupted my eating or daily routine.',
      ];
    }
    if (d.key === 'appetite' && isDaily) {
      questions = [
        'I struggled to eat enough or skipped meals.',
        'My hunger noticeably increased before my next dose.',
        'My appetite varied significantly throughout the day.',
      ];
    }
    return { ...d, questions };
  });

  if (isDaily) {
    const doseDomain: DomainConfig = {
      key: 'gi_burden', // reuse key for submission compat — prepended, won't replace
      label: 'Dose Consistency',
      icon: 'Calendar',
      color: '#5AC8FA',
      higherIsBetter: false,
      getStatus: (s) => makeStatus(s,
        ['Excellent', 'Good', 'Fair', 'Poor'],
        [STATUS_GOOD, STATUS_OKAY, STATUS_MID, STATUS_BAD]),
      questions: [
        'I missed one or more doses this week.',
        'I took my dose at an inconsistent time each day.',
        'I took my dose with food/water when it should be on an empty stomach.',
      ],
    };
    if (!base.some((d) => d.label === 'Dose Consistency')) base.unshift(doseDomain);
  }
  return base;
}

// Dose Consistency reuses the gi_burden key — resolve its asset by label so it
// doesn't borrow the stomach illustration.
function assetForDomain(domain: DomainConfig): ImageSourcePropType | undefined {
  if (domain.label === 'Dose Consistency') return undefined;
  return CHECKIN_ASSETS[domain.key];
}

// ─── 1–5 draggable slider ───────────────────────────────────────────────────────

const THUMB_R = 15;
const STOP_R = 5;

function RatingSlider({ value, touched, onChange, color, colors }: {
  value: number; touched: boolean; onChange: (v: number) => void; color: string; colors: AppColors;
}) {
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  // Fraction of the track the thumb sits at (0…1) and the live width of the track.
  const pos = useSharedValue(touched ? value / 4 : 0.5);
  const trackW = useSharedValue(0);
  const lastIdx = useSharedValue(touched ? value : -1);

  // Keep the thumb in sync if the value is changed from outside (e.g. on remount).
  useEffect(() => {
    if (touched) pos.value = withTiming(value / 4, { duration: 160 });
  }, [value, touched]);

  const commit = (i: number) => {
    Haptics.selectionAsync();
    onChange(i);
  };

  const handleAt = (x: number) => {
    'worklet';
    if (trackW.value <= 0) return;
    const f = Math.min(1, Math.max(0, x / trackW.value));
    pos.value = f;
    const i = Math.min(4, Math.max(0, Math.round(f * 4)));
    if (i !== lastIdx.value) {
      lastIdx.value = i;
      runOnJS(commit)(i);
    }
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => handleAt(e.x))
    .onUpdate((e) => handleAt(e.x))
    .onEnd(() => { pos.value = withTiming(lastIdx.value / 4, { duration: 120 }); });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * trackW.value - THUMB_R }],
    opacity: touched ? 1 : 0.55,
  }));
  const fillStyle = useAnimatedStyle(() => ({
    width: pos.value * trackW.value,
    opacity: touched ? 1 : 0,
  }));

  return (
    <View style={{ width: '100%' }}>
      {/* Current value read-out */}
      <View style={{ alignItems: 'center', marginBottom: 22, height: 58, justifyContent: 'center' }}>
        {touched ? (
          <>
            <Text style={{ fontSize: 40, fontWeight: '800', color, fontFamily: FF, letterSpacing: -1 }}>
              {value + 1}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: w(0.5), fontFamily: FF, marginTop: 2 }}>
              {SCALE_LABELS[value]}
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 16, fontWeight: '600', color: w(0.32), fontFamily: FF }}>
            Drag to rate
          </Text>
        )}
      </View>

      <GestureDetector gesture={pan}>
        <View style={{ paddingHorizontal: THUMB_R, paddingVertical: 16 }}>
          <View
            style={{ height: 6, borderRadius: 999, backgroundColor: w(0.1), justifyContent: 'center' }}
            onLayout={(e) => { trackW.value = e.nativeEvent.layout.width; }}
          >
            <Animated.View style={[{ position: 'absolute', left: 0, height: 6, borderRadius: 999, backgroundColor: color }, fillStyle]} />
            {/* Stop dots */}
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: `${i * 25}%`,
                  marginLeft: -STOP_R,
                  width: STOP_R * 2, height: STOP_R * 2, borderRadius: STOP_R,
                  backgroundColor: touched && i <= value ? color : w(0.22),
                }}
              />
            ))}
            {/* Thumb */}
            <Animated.View
              style={[
                {
                  position: 'absolute', left: 0,
                  width: THUMB_R * 2, height: THUMB_R * 2, borderRadius: THUMB_R,
                  backgroundColor: colors.bg, borderWidth: 3, borderColor: color,
                  shadowColor: color, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
                },
                thumbStyle,
              ]}
            />
          </View>
          {/* End labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
            <Text style={{ fontSize: 12.5, color: w(0.35), fontFamily: FF }}>{SCALE_LABELS[0]}</Text>
            <Text style={{ fontSize: 12.5, color: w(0.35), fontFamily: FF }}>{SCALE_LABELS[4]}</Text>
          </View>
        </View>
      </GestureDetector>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyCheckinScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { addWeeklyCheckin } = useLogStore();
  const { profile } = useProfile();
  const s = useMemo(() => createStyles(colors), [colors]);
  const w = (a: number) => (colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);

  const isDaily = (profile?.injectionFrequencyDays ?? 7) === 1;
  const domains = useMemo(() => buildDomains(isDaily), [isDaily]);

  // Flatten every section's questions into a single ordered page list.
  const pages = useMemo(
    () => domains.flatMap((d, di) => d.questions.map((_, qi) => ({ domainIdx: di, qIdx: qi }))),
    [domains],
  );

  // Gate: one check-in per program week. Redirect to history if already done.
  const guarded = useRef(false);
  useEffect(() => {
    if (guarded.current) return;
    guarded.current = true;
    const engagementStart = resolveEngagementStart(profile?.engagementStartDate);
    const cur = currentWeekWindow(engagementStart);
    if (!cur) return;
    const rows = Object.values(useLogStore.getState().weeklyCheckins).flat();
    if (rows.some((r) => isWithinWindow(r.logged_at as string, cur))) {
      router.replace('/entry/weekly-checkin-history');
    }
  }, [profile?.engagementStartDate]);

  const [answers, setAnswers] = useState<number[][]>(domains.map((d) => d.questions.map(() => 0)));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const page = pages[pageIndex];
  const domain = domains[page.domainIdx];
  const tkey = (di: number, qi: number) => `${di}-${qi}`;
  const curTouched = touched.has(tkey(page.domainIdx, page.qIdx));

  function setAnswer(val: number) {
    setAnswers((prev) => {
      const next = prev.map((row) => [...row]);
      next[page.domainIdx][page.qIdx] = val;
      return next;
    });
    setTouched((prev) => {
      const k = tkey(page.domainIdx, page.qIdx);
      if (prev.has(k)) return prev;
      return new Set(prev).add(k);
    });
  }

  // Per-section progress (0–1) for the segmented bar at the top.
  function sectionFill(di: number): number {
    if (di < page.domainIdx) return 1;
    if (di > page.domainIdx) return 0;
    const answered = domains[di].questions.filter((_, qi) => touched.has(tkey(di, qi))).length;
    return answered / domains[di].questions.length;
  }

  function goBack() {
    if (loading) return;
    if (pageIndex === 0) { router.back(); return; }
    Haptics.selectionAsync();
    setPageIndex((i) => i - 1);
  }

  function goNext() {
    if (!curTouched || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pageIndex < pages.length - 1) { setPageIndex((i) => i + 1); return; }
    void handleSave();
  }

  async function handleSave() {
    if (loading) return;
    setLoading(true);
    try {
      const domainSums = answers.map((row) => row.reduce((a, b) => a + b, 0));
      const scoresMap: Record<string, number> = {};
      const labelsMap: Record<string, string> = {};
      const engagementStart = resolveEngagementStart(profile?.engagementStartDate);
      const programWeek = getProgramWeekNumber(engagementStart) ?? undefined;

      await Promise.all(
        domains.map(async (d, i) => {
          const sum = domainSums[i];
          const score100 = toScore100(sum, d.higherIsBetter);
          const answersMap: Record<string, number> = {};
          answers[i].forEach((v, qi) => { answersMap[`q${qi + 1}`] = v; });
          await addWeeklyCheckin(d.key as any, answersMap, score100, programWeek);
          scoresMap[d.key] = score100;
          labelsMap[d.key] = d.getStatus(sum).label;
        }),
      );

      const cur = currentWeekWindow(engagementStart);
      const nextWin = cur ? getWeekWindow(engagementStart, cur.index + 1) : null;
      if (nextWin) await scheduleWeeklyCheckinReminderAt(nextWin.start);

      router.replace({
        pathname: '/entry/weekly-checkin-result',
        params: { scores: JSON.stringify(scoresMap), labels: JSON.stringify(labelsMap) },
      });
    } finally {
      setLoading(false);
    }
  }

  const asset = assetForDomain(domain);
  const isLast = pageIndex === pages.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View style={s.headerRow}>
          <CircleIconButton icon={ChevronLeft} onPress={goBack} accessibilityLabel="Go back" />
          <Text style={s.sectionCount}>Section {page.domainIdx + 1} of {domains.length}</Text>
          <View style={{ width: 40 }} />
        </View>
        {/* Segmented per-section progress */}
        <View style={s.segments}>
          {domains.map((d, di) => (
            <View key={`${d.label}-${di}`} style={s.segTrack}>
              <View style={[s.segFill, { width: `${Math.round(sectionFill(di) * 100)}%` }]} />
            </View>
          ))}
        </View>
      </View>

      {/* Body */}
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 40 }}>
        {/* Section hero — re-mounts (cross-fades) only when the section changes */}
        <Animated.View key={`asset-${page.domainIdx}`} entering={FadeIn.duration(420)} style={s.heroWrap}>
          {asset ? (
            <Image source={asset} style={s.heroImage} resizeMode="contain" accessibilityIgnoresInvertColors />
          ) : (
            <View style={[s.heroFallback, { backgroundColor: domain.color + '1F' }]}>
              <LucideIconByName name={domain.icon} size={128} color={domain.color} />
            </View>
          )}
          <Text style={[s.sectionLabel, { color: domain.color }]}>{domain.label}</Text>
        </Animated.View>

        {/* Question + slider — re-mounts (fades) on every page */}
        <Animated.View key={`q-${pageIndex}`} entering={FadeIn.duration(280)}>
          <Text style={s.question}>{domain.questions[page.qIdx]}</Text>
          <RatingSlider
            value={answers[page.domainIdx][page.qIdx]}
            touched={curTouched}
            onChange={setAnswer}
            color={domain.color}
            colors={colors}
          />
        </Animated.View>
      </View>

      {/* CTA */}
      <View style={[s.ctaWrap, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[s.cta, !curTouched && s.ctaDisabled]}
          onPress={goNext}
          activeOpacity={0.85}
          disabled={!curTouched || loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={s.ctaText}>{isLast ? 'Complete Check-In' : 'Continue'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: AppColors) => {
  const w = (a: number) => (c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`);
  return StyleSheet.create({
    header: { paddingHorizontal: 20, paddingBottom: 14 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionCount: { fontSize: 14, fontWeight: '700', color: c.textSecondary, fontFamily: FF, letterSpacing: 0.2 },

    segments: { flexDirection: 'row', gap: 6, marginTop: 14 },
    segTrack: {
      flex: 1, height: 5, borderRadius: 999, overflow: 'hidden',
      backgroundColor: c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
    },
    segFill: { height: 5, borderRadius: 999, backgroundColor: c.orange },

    heroWrap: { alignItems: 'center', marginBottom: 20 },
    heroImage: { width: 300, height: 300 },
    heroFallback: { width: 300, height: 300, borderRadius: 150, alignItems: 'center', justifyContent: 'center' },
    sectionLabel: {
      fontSize: 13, fontWeight: '800', fontFamily: FF, letterSpacing: 1.4,
      textTransform: 'uppercase', marginTop: 8,
    },

    question: {
      fontSize: 24, fontWeight: '800', color: c.textPrimary, fontFamily: FF,
      textAlign: 'center', lineHeight: 31, letterSpacing: -0.4, marginBottom: 34,
      paddingHorizontal: 4,
    },

    ctaWrap: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: c.bg },
    cta: {
      backgroundColor: c.orange, borderRadius: 999, paddingVertical: 17,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: c.orange, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
    },
    ctaDisabled: { backgroundColor: w(0.14), shadowOpacity: 0 },
    ctaText: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: 0.4, fontFamily: FF },
  });
};
