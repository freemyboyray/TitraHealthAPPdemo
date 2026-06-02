import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const FF = 'System';

type Section = {
  title: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  items: { label: string; detail: string }[];
};

const SECTIONS: Section[] = [
  {
    title: 'Home Screen',
    icon: 'house.fill',
    iconColor: '#FF742A',
    iconBg: 'rgba(255,116,42,0.15)',
    items: [
      { label: 'Medication Card', detail: 'Shows your current injection cycle phase (Shot Day, Peak, Balance, Reset) with a visual arc gauge. Tap "View" to see the full cycle timeline.' },
      { label: 'Daily Focuses', detail: 'Three ring indicators (Eat, Move, Rest) track your daily progress. Each ring fills as you log meals, activity, and rest throughout the day.' },
      { label: 'Energy Bank', detail: 'A composite score combining your sleep, hydration, side effects, and activity into a single energy level. Helps you understand how your body is responding to medication.' },
      { label: 'Viewing Past Dates', detail: 'Tap the calendar icon or swipe the week strip to view any past date. A banner shows which date you\'re viewing with a "Back to today" button.' },
    ],
  },
  {
    title: 'Your Cycle',
    icon: 'arrow.triangle.2.circlepath',
    iconColor: '#27AE60',
    iconBg: 'rgba(39,174,96,0.15)',
    items: [
      { label: 'Shot Day', detail: 'The day you take your injection. Your body is absorbing the medication. Focus on hydration and light, protein-rich meals.' },
      { label: 'Peak', detail: 'GLP-1 levels are at their highest. Appetite suppression is strongest. Make every bite count with protein and stay hydrated.' },
      { label: 'Balance', detail: 'Medication levels are stable. Great window to build habits around protein intake, fiber, and activity goals.' },
      { label: 'Reset', detail: 'Levels are tapering toward your next dose. Hunger may return — this is normal pharmacology. Lean on your habits to stay consistent.' },
    ],
  },
  {
    title: 'Logging',
    icon: 'plus.circle.fill',
    iconColor: '#FF742A',
    iconBg: 'rgba(255,116,42,0.15)',
    items: [
      { label: 'Describe Food', detail: 'Type a description of what you ate (e.g., "grilled chicken salad with ranch") and AI will estimate the nutrition breakdown.' },
      { label: 'Capture Food', detail: 'Take a photo of your meal. AI vision analyzes the image to identify foods and estimate macros automatically.' },
      { label: 'Scan Food', detail: 'Scan a barcode on packaged food to pull nutrition data from the OpenFoodFacts database.' },
      { label: 'Search Food', detail: 'Search for specific foods by name to find nutrition information from our database.' },
      { label: 'Log Weight', detail: 'Record your weight manually or sync from a connected smart scale via Apple Health.' },
      { label: 'Log Water', detail: 'Track hydration by adding glasses, bottles, or custom amounts. Syncs bidirectionally with Apple Health.' },
      { label: 'Log Activity', detail: 'Record workouts and exercise manually, or let Apple Health sync activities from your watch automatically.' },
      { label: 'Log Injection', detail: 'Record when you take your dose, including the injection site for rotation tracking.' },
      { label: 'Side Effects', detail: 'Track symptoms like nausea, fatigue, or appetite changes with severity sliders. Helps identify patterns across your cycle.' },
    ],
  },
  {
    title: 'Lifestyle Tab',
    icon: 'list.bullet.rectangle.fill',
    iconColor: '#3B9AE1',
    iconBg: 'rgba(59,154,225,0.15)',
    items: [
      { label: 'Overview', detail: 'The Lifestyle tab shows your daily nutrition, activity, and vitals in one place. Data comes from both your in-app logs and Apple Health.' },
      { label: 'Vitals', detail: 'Heart rate variability (HRV), resting heart rate, sleep duration, blood glucose, SpO2, blood pressure, and respiratory rate — all pulled from Apple Health.' },
      { label: 'Body Composition', detail: 'Body fat percentage, lean mass, waist circumference, and BMI from Apple Health-connected devices like smart scales.' },
      { label: 'Activity', detail: 'Steps, exercise minutes, distance, flights climbed, VO2 max, and total daily energy expenditure (TDEE) from your Apple Watch or phone.' },
      { label: 'Workouts', detail: 'Structured workout sessions synced from Apple Health, showing activity type, duration, calories burned, and source app.' },
    ],
  },
  {
    title: 'Insights',
    icon: 'chart.line.uptrend.xyaxis',
    iconColor: '#F5A623',
    iconBg: 'rgba(245,166,35,0.15)',
    items: [
      { label: 'Nutrition Insights', detail: 'Trends in your protein, calorie, fiber, and water intake over time. See daily averages and how they compare to your targets.' },
      { label: 'Activity Insights', detail: 'Step trends, exercise patterns, and how your activity levels change across your injection cycle.' },
      { label: 'Vitals Insights', detail: 'How your HRV, resting heart rate, and sleep change over time and across cycle phases.' },
      { label: 'Side Effect Patterns', detail: 'Discover which side effects are most common during each phase of your cycle, and track severity trends over time.' },
    ],
  },
  {
    title: 'Apple Health Sync',
    icon: 'heart.fill',
    iconColor: '#FF2D55',
    iconBg: 'rgba(255,45,85,0.15)',
    items: [
      { label: 'What We Read', detail: 'Steps, calories, heart rate, HRV, sleep, weight, body composition, VO2 max, blood glucose, workouts, and more — over 30 data types from Apple Health.' },
      { label: 'What We Write', detail: 'Weight, nutrition (protein, calories, carbs, fat, fiber), and water logged in Titra are pushed back to Apple Health so everything stays in sync.' },
      { label: 'How Often', detail: 'Data refreshes automatically every 60 seconds while the app is open, plus whenever you switch tabs or return from another app.' },
      { label: 'Privacy', detail: 'All health data stays on your device and in your private account. We never sell or share your health data with third parties.' },
    ],
  },
  {
    title: 'Premium Features',
    icon: 'crown.fill',
    iconColor: '#FF742A',
    iconBg: 'rgba(255,116,42,0.15)',
    items: [
      { label: 'What\'s Included', detail: 'Titra Pro unlocks AI coaching, cycle intelligence, clinical benchmarks, advanced weight projections, provider reports, unlimited food logging, and all guided courses.' },
      { label: 'Free Trial', detail: 'Every new user gets a 7-day free trial of all Pro features. You won\'t be charged until the trial ends.' },
      { label: 'Pricing', detail: '$4.99/month or $49.99/year (save 17%). Cancel anytime from your device\'s subscription settings.' },
    ],
  },
  {
    title: 'Courses',
    icon: 'graduationcap.fill',
    iconColor: '#5856D6',
    iconBg: 'rgba(88,86,214,0.15)',
    items: [
      { label: 'Guided Learning', detail: 'Step-by-step courses on topics like nutrition on GLP-1s, managing side effects, exercise optimization, and building lasting habits.' },
      { label: 'Progress Tracking', detail: 'Each course tracks your progress through lessons. Pick up where you left off anytime.' },
    ],
  },
];

const ANIM = { duration: 280, easing: Easing.out(Easing.cubic) };

function SectionCard({ section, isOpen, onToggle, s, colors }: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
  s: ReturnType<typeof createStyles>;
  colors: AppColors;
}) {
  const progress = useSharedValue(isOpen ? 1 : 0);
  const [bodyHeight, setBodyHeight] = useState(0);

  // Drive the animation from the open state.
  progress.value = withTiming(isOpen ? 1 : 0, ANIM);

  const onBodyLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setBodyHeight(h);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    height: bodyHeight === 0 ? undefined : progress.value * bodyHeight,
    opacity: progress.value,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
  }));

  return (
    <View style={s.sectionCard}>
      <Pressable
        style={s.sectionHeader}
        onPress={onToggle}
        accessibilityLabel={`${section.title}, ${isOpen ? 'collapse' : 'expand'}`}
        accessibilityRole="button"
      >
        <View style={s.sectionLeft}>
          <View style={[s.iconBadge, { backgroundColor: section.iconBg }]}>
            <IconSymbol name={section.icon as any} size={18} color={section.iconColor} />
          </View>
          <Text style={s.sectionTitle}>{section.title}</Text>
        </View>
        <Animated.View style={chevronStyle}>
          <IconSymbol name="chevron.down" size={14} color={colors.textMuted} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[s.sectionClip, containerStyle]}>
        {/* Absolutely positioned so its height can be measured independent of the clip. */}
        <View style={s.sectionMeasure} onLayout={onBodyLayout}>
          <View style={s.sectionBody}>
            {section.items.map((item, iIdx) => (
              <View key={item.label} style={[s.itemRow, iIdx > 0 && s.itemDivider]}>
                <Text style={s.itemLabel}>{item.label}</Text>
                <Text style={s.itemDetail}>{item.detail}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export default function TutorialScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = useCallback((idx: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  return (
    <View style={s.safe}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back" accessibilityRole="button">
            <IconSymbol name="chevron.left" size={22} color={colors.orange} />
          </Pressable>
          <Text style={s.headerTitle}>App Tutorial</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.intro}>
            Learn how to get the most out of Titra. Tap any section below to expand.
          </Text>

          {SECTIONS.map((section, sIdx) => (
            <SectionCard
              key={section.title}
              section={section}
              isOpen={expanded.has(sIdx)}
              onToggle={() => toggle(sIdx)}
              s={s}
              colors={colors}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function createStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSubtle,
    },
    headerTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
    content: { padding: 16, paddingBottom: 60 },
    intro: {
      fontSize: 15, color: c.textSecondary, fontFamily: FF,
      lineHeight: 21, marginBottom: 16,
    },

    sectionCard: {
      backgroundColor: c.surface, borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderTopColor: c.border, borderLeftColor: c.borderSubtle,
      borderRightColor: c.borderSubtle, borderBottomColor: c.borderSubtle,
      marginBottom: 12,
    },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    iconBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    sectionTitle: { fontSize: 17, fontWeight: '600', color: c.textPrimary, fontFamily: FF },

    sectionClip: { overflow: 'hidden' },
    sectionMeasure: { position: 'absolute', left: 0, right: 0, top: 0 },
    sectionBody: {
      paddingHorizontal: 16, paddingBottom: 16,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle,
    },
    itemRow: { paddingTop: 12 },
    itemDivider: {
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSubtle,
      marginTop: 12,
    },
    itemLabel: {
      fontSize: 15, fontWeight: '700', color: c.textPrimary, fontFamily: FF,
      marginBottom: 4,
    },
    itemDetail: {
      fontSize: 14, color: c.textSecondary, fontFamily: FF,
      lineHeight: 20,
    },
  });
}
