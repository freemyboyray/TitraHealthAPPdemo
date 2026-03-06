import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';

const ORANGE = '#FF742A';
const BG = '#000000';
const FF = 'Helvetica Neue';

const glassShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.3,
  shadowRadius: 24,
  elevation: 8,
};

// ─── Education content ────────────────────────────────────────────────────────

type Section = {
  id: string;
  icon: string;
  iconSet: 'Ionicons' | 'MaterialIcons';
  title: string;
  items: { q: string; a: string }[];
};

const SECTIONS: Section[] = [
  {
    id: 'medication',
    icon: 'medical',
    iconSet: 'Ionicons',
    title: 'Understanding Your Medication',
    items: [
      {
        q: 'How do GLP-1 agonists work?',
        a: 'GLP-1 receptor agonists mimic the glucagon-like peptide-1 hormone. They slow gastric emptying, signal fullness to the brain, and help regulate blood sugar — resulting in reduced appetite and significant weight loss over time.',
      },
      {
        q: 'Tirzepatide vs Semaglutide',
        a: 'Tirzepatide (Zepbound/Mounjaro) is a dual GIP + GLP-1 agonist, activating two incretin pathways. Clinical trials show it may produce greater weight loss (up to 22%) vs semaglutide (up to 15%). Both are weekly injections; tirzepatide tends to have a faster weight loss curve.',
      },
      {
        q: 'What is dose escalation?',
        a: 'Both medications start at a low "starter" dose to minimize side effects, then increase every 4 weeks. This ramp period is when nausea is most common. Never skip ahead — your body needs time to adjust to each dose.',
      },
      {
        q: 'How long does it take to work?',
        a: 'Most people notice reduced appetite within 1–2 weeks. Significant weight loss typically begins at 4–8 weeks. Peak efficacy is usually reached at the maintenance dose after 5–20 months of consistent use.',
      },
    ],
  },
  {
    id: 'nutrition',
    icon: 'restaurant',
    iconSet: 'MaterialIcons',
    title: 'Nutrition Guide',
    items: [
      {
        q: 'Why is protein so critical on GLP-1s?',
        a: 'GLP-1 medications suppress appetite broadly — including protein. Without intentional protein intake, your body can lose muscle mass alongside fat. Aim for 0.7–1g protein per pound of body weight daily. Prioritize protein at every meal.',
      },
      {
        q: 'How much water should I drink?',
        a: 'GLP-1s slow gastric emptying, which can increase dehydration risk and worsen constipation. Aim for at least 0.5–0.6 oz per pound of body weight daily (more if you experience constipation or are on semaglutide).',
      },
      {
        q: 'What foods work best on GLP-1s?',
        a: 'High-protein, nutrient-dense foods: Greek yogurt, eggs, lean meats, fish, legumes, cottage cheese. Eat small, frequent meals. Avoid high-fat or spicy foods near injection day — they can worsen nausea. Fiber-rich vegetables reduce constipation.',
      },
      {
        q: 'Should I track calories?',
        a: 'GLP-1s naturally reduce caloric intake — many people eat 30–40% less. Focus on hitting protein and hydration targets first. If you do track, a deficit of 500–750 kcal/day is sustainable. Avoid going below 1,200 kcal (women) or 1,500 kcal (men) without medical guidance.',
      },
    ],
  },
  {
    id: 'lifestyle',
    icon: 'directions-run',
    iconSet: 'MaterialIcons',
    title: 'Lifestyle & Exercise',
    items: [
      {
        q: 'What exercise is best?',
        a: 'A combination of resistance training (2–3x/week) and daily walking is optimal. Resistance training preserves muscle mass that GLP-1 medications can reduce. Even 20–30 minutes of walking daily significantly improves insulin sensitivity and cardiovascular health.',
      },
      {
        q: 'Why does sleep matter?',
        a: 'Poor sleep (under 6 hours) blunts GLP-1 appetite control by up to 30% and increases cortisol, which can counteract weight loss. Aim for 7–9 hours. Good sleep hygiene is as important as diet on GLP-1 therapy.',
      },
      {
        q: 'How does stress affect my results?',
        a: 'Chronic stress elevates cortisol, which promotes fat storage and increases hunger — partially overriding the appetite-suppressing effects of GLP-1 medications. Mindfulness, regular movement, and adequate sleep are the best stress management tools.',
      },
    ],
  },
  {
    id: 'side-effects',
    icon: 'warning-outline',
    iconSet: 'Ionicons',
    title: 'Managing Side Effects',
    items: [
      {
        q: 'How do I manage nausea?',
        a: 'Nausea is most common in the first 4–8 weeks or after a dose increase. Eat slowly, take small bites, avoid lying down after eating, and stay hydrated. Ginger tea, peppermint, and anti-nausea foods (crackers, bland rice) can help. Contact your doctor if it\'s severe or persistent.',
      },
      {
        q: 'Tips for constipation',
        a: 'GLP-1s slow gut motility, making constipation common. Increase fiber (aim for 30–35g/day), drink extra water, and stay active. Psyllium husk, magnesium citrate, or prune juice can help. Your doctor may recommend a gentle laxative if symptoms persist.',
      },
      {
        q: 'Why do I feel fatigued?',
        a: 'Fatigue is common in early weeks, especially at the starter dose. Your body is adapting to reduced caloric intake and metabolic changes. Ensure adequate protein, iron, and B12. Fatigue usually resolves by week 4–6. If it persists, discuss with your doctor.',
      },
      {
        q: 'What about hair loss?',
        a: 'Temporary hair shedding (telogen effluvium) can occur 3–6 months into treatment due to rapid caloric restriction or nutritional deficiency. Prioritize protein, biotin, zinc, and iron intake. Hair typically grows back after 6–12 months once nutrition stabilizes.',
      },
    ],
  },
  {
    id: 'faq',
    icon: 'help-circle-outline',
    iconSet: 'Ionicons',
    title: 'Frequently Asked Questions',
    items: [
      {
        q: 'What if I miss a dose?',
        a: 'For weekly injections (semaglutide/tirzepatide): take the missed dose within 5 days of your scheduled day. If more than 5 days have passed, skip it and resume your regular schedule. Never double-dose. Note your next injection date and set a reminder.',
      },
      {
        q: 'Can I drink alcohol?',
        a: 'Alcohol is not prohibited, but it can worsen nausea and dehydration on GLP-1 therapy. Alcohol is also calorie-dense and can undermine weight loss progress. If you drink, do so in moderation and ensure adequate hydration beforehand.',
      },
      {
        q: 'Why did my weight loss plateau?',
        a: 'Weight loss plateaus are normal and expected, typically occurring at 6–12 months. Your body adapts its metabolism. Strategies: increase protein, add or intensify exercise, review caloric intake, ensure adequate sleep, and discuss with your doctor whether a dose adjustment is appropriate.',
      },
      {
        q: 'Is GLP-1 therapy permanent?',
        a: 'GLP-1s are most effective as long-term therapies. Studies show that stopping medication typically leads to weight regain within 12 months. Lifestyle habits built during treatment significantly affect long-term outcomes. Discuss a long-term plan with your prescriber.',
      },
    ],
  },
];

// ─── Expandable card component ────────────────────────────────────────────────

function EducationCard({ section }: { section: Section }) {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const icon =
    section.iconSet === 'Ionicons'
      ? <Ionicons name={section.icon as any} size={20} color={ORANGE} />
      : <MaterialIcons name={section.icon as any} size={20} color={ORANGE} />;

  return (
    <View style={[c.cardWrap, glassShadow]}>
      <View style={c.cardBody}>
        {/* Card header */}
        <View style={c.cardHeader}>
          <View style={c.iconWrap}>{icon}</View>
          <Text style={c.cardTitle}>{section.title}</Text>
        </View>

        <View style={c.divider} />

        {/* Expandable items */}
        {section.items.map((item, idx) => {
          const isOpen = expandedItem === idx;
          return (
            <View key={idx}>
              <TouchableOpacity
                style={c.itemHeader}
                onPress={() => setExpandedItem(isOpen ? null : idx)}
                activeOpacity={0.7}
              >
                <Text style={c.itemQ} numberOfLines={isOpen ? undefined : 2}>{item.q}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="rgba(255,255,255,0.35)"
                  style={{ marginLeft: 8, flexShrink: 0 }}
                />
              </TouchableOpacity>
              {isOpen && (
                <View style={c.itemBody}>
                  <Text style={c.itemA}>{item.a}</Text>
                </View>
              )}
              {idx < section.items.length - 1 && <View style={c.itemDivider} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EducationScreen() {
  const { onScroll } = useTabBarVisibility();

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {/* ── Header ── */}
          <Text style={s.headerTitle}>Education</Text>
          <Text style={s.headerSub}>Your guide to GLP-1 therapy</Text>

          {SECTIONS.map((section) => (
            <EducationCard key={section.id} section={section} />
          ))}

          <Text style={s.disclaimer}>
            This content is for informational purposes only. Always consult your healthcare provider before making any changes to your treatment.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },
  headerTitle: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginBottom: 4, fontFamily: FF },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '500', marginBottom: 28, fontFamily: FF },
  disclaimer: { fontSize: 11, color: 'rgba(255,255,255,0.30)', textAlign: 'center', lineHeight: 16, marginTop: 16, paddingHorizontal: 8, fontFamily: FF },
});

const c = StyleSheet.create({
  cardWrap: { borderRadius: 24, marginBottom: 16 },
  cardBody: {
    borderRadius: 24, overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.18)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14 },
  iconWrap: { marginRight: 12 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', flex: 1, letterSpacing: -0.3, fontFamily: FF },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 18 },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  itemQ: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flex: 1, lineHeight: 20, fontFamily: FF },
  itemBody: { paddingHorizontal: 18, paddingBottom: 14 },
  itemA: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 22, fontWeight: '400', fontFamily: FF },
  itemDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 18 },
});
