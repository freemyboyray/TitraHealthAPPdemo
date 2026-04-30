import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  LayoutAnimation,
  Pressable,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/ui/gradient-background';
import { ScrollTitle } from '@/components/ui/scroll-title';
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';
import { contentCategoryColor } from '@/constants/theme';
import { useTabBarVisibility } from '@/contexts/tab-bar-visibility';
import { useProfile } from '@/contexts/profile-context';
import { getEscalationPhase } from '@/lib/escalation-phase';
import { TabScreenWrapper } from '@/components/ui/tab-screen-wrapper';
import { useCoursesStore } from '@/stores/courses-store';
import { CourseCard } from '@/components/courses/course-card';

type ArticleRow = {
  id: string;
  title: string;
  subtitle: string | null;
  category: string;
  reading_time_minutes: number;
  published_at: string;
};

const ORANGE = '#FF742A';
const FF = 'System';

const glassShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
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
        a: 'GLP-1 receptor agonists mimic the glucagon-like peptide-1 hormone. They slow gastric emptying, signal fullness to the brain, and help regulate blood sugar, resulting in reduced appetite and significant weight loss over time.',
      },
      {
        q: 'Tirzepatide vs Semaglutide',
        a: 'Tirzepatide (Zepbound/Mounjaro) is a dual GIP + GLP-1 agonist, activating two incretin pathways. Clinical trials show it may produce greater weight loss (up to 22%) vs semaglutide (up to 15%). Both are weekly injections; tirzepatide tends to have a faster weight loss curve.',
      },
      {
        q: 'What is dose escalation and why does it matter?',
        a: 'Both medications start at a low "starter" dose to minimize side effects, then increase every 4 weeks. This ramp period is when nausea is most common. Never skip ahead. Your body needs time to adapt. Rushing escalation is the #1 cause of early dropout from GLP-1 therapy.',
      },
      {
        q: 'How long does it take to work?',
        a: 'Most people notice reduced appetite within 1–2 weeks. Significant weight loss typically begins at 4–8 weeks. Peak efficacy is usually reached at the maintenance dose after 5–20 months of consistent use.',
      },
      {
        q: 'What happens to my metabolism on GLP-1?',
        a: 'GLP-1 medications slow gastric emptying (food stays in your stomach longer), reduce glucagon secretion (less blood sugar spikes), and act on brain receptors to reduce hunger signals. Over time, they also improve insulin sensitivity and may reduce chronic inflammation markers.',
      },
      {
        q: 'Can I take GLP-1s long-term?',
        a: 'Yes, and for most people, long-term use is both safe and necessary. GLP-1 medications are treating a chronic condition. The SUSTAIN and SURMOUNT trials showed benefits persisted with continued use. Stopping typically leads to weight regain within 12 months, as the underlying biology doesn\'t change.',
      },
    ],
  },
  {
    id: 'injection',
    icon: 'medkit-outline',
    iconSet: 'Ionicons',
    title: 'Injection Technique & Storage',
    items: [
      {
        q: 'Where are the best injection sites?',
        a: 'The three approved sites are: (1) Abdomen (at least 2 inches from your navel), (2) Upper thigh (outer/front area), (3) Upper arm (outer area). Rotate sites with each injection to prevent lipohypertrophy (hardened fatty lumps). Never inject into hardened, bruised, or scarred tissue.',
      },
      {
        q: 'How do I inject correctly?',
        a: 'Steps: (1) Let pen warm to room temp for 30 min, (2) Check the medication window (it should be clear and colorless), (3) Clean site with alcohol swab and let dry, (4) Pinch skin lightly for thin people, (5) Insert at 90°, (6) Press button and hold for 5–10 seconds, (7) Don\'t rub the site. Rubbing can cause bruising and affect absorption.',
      },
      {
        q: 'How should I store my medication?',
        a: 'Unopened pens: refrigerate at 36–46°F (2–8°C), away from the freezer element. Never freeze. Frozen medication is ruined. In-use pens: can be kept at room temperature (below 77°F/25°C) for up to 56 days (Ozempic), 42 days (Wegovy), or 21 days (Zepbound). Keep away from direct heat and light.',
      },
      {
        q: 'What if my pen was left out overnight?',
        a: 'If below 77°F (25°C): it\'s still usable. Just resume your room-temp use window. If above 77°F or left in a hot car: discard the pen. Heat degrades the peptide and the medication becomes less effective or ineffective. Don\'t risk injecting degraded medication.',
      },
      {
        q: 'My injection site is red or has a lump. Is this normal?',
        a: 'Mild redness, swelling, or a small lump at the injection site is common and typically resolves within 1–3 days. It\'s usually a normal immune response. Persistent lumps (lipohypertrophy) form from injecting the same spot repeatedly. Always rotate. A warm, spreading redness that grows could indicate infection; contact your doctor.',
      },
      {
        q: 'What is a needle cap/flow check error?',
        a: 'For the semaglutide pen: always perform a flow check (prime) before your first use of a new pen. Hold upright, press button, check that medication appears at the needle tip. Skipping this can result in getting a partial or empty dose. Subsequent injections from the same pen don\'t need a flow check.',
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
        a: 'GLP-1 medications suppress appetite broadly, including protein. Without intentional protein intake, your body loses muscle mass alongside fat (up to 25–40% of weight lost can be lean mass). Aim for 0.7–1g protein per pound of body weight daily. Prioritize protein at every meal. It\'s the single most important dietary intervention on GLP-1 therapy.',
      },
      {
        q: 'How much water should I drink?',
        a: 'GLP-1s slow gastric emptying and reduce thirst signals, increasing dehydration and constipation risk. Aim for at least 0.5–0.6 oz per pound of body weight daily. Add electrolytes (sodium, potassium, magnesium) if you\'re exercising or experiencing vomiting. Dehydration is a common cause of headaches and dizziness on GLP-1s.',
      },
      {
        q: 'What are the best foods to eat?',
        a: 'High-protein, nutrient-dense choices: Greek yogurt, eggs, lean meats, fish, shrimp, legumes, cottage cheese, edamame, tofu. Eat small, slow meals. Avoid high-fat or spicy foods near injection day, as they slow gastric emptying further and worsen nausea. Fiber-rich vegetables (broccoli, leafy greens) reduce constipation.',
      },
      {
        q: 'What foods tend to trigger nausea?',
        a: 'Common nausea triggers on GLP-1s: very greasy/fried foods, high-fat dairy, raw onions/garlic, spicy dishes, alcohol, carbonated drinks, and large portion sizes. A practical approach: keep a mental log of what made you feel sick in week 1–2 and temporarily avoid those foods during dose escalation weeks.',
      },
      {
        q: 'Should I take vitamins or supplements?',
        a: 'Yes, significantly reduced food intake means micronutrient gaps are common. Priority supplements: (1) Multivitamin daily, (2) B12 (deficiency causes fatigue and nerve issues, especially on low-calorie diets), (3) Vitamin D3 + K2, (4) Iron (especially for women), (5) Zinc (for hair health and immune function), (6) Magnesium citrate (eases constipation and muscle cramps). Discuss with your doctor before starting any supplement.',
      },
      {
        q: 'Should I track calories?',
        a: 'GLP-1s naturally reduce caloric intake. Many people eat 30–40% less. Focus on hitting protein and hydration targets first. If you do track, a deficit of 500–750 kcal/day is sustainable. Avoid going below 1,200 kcal (women) or 1,500 kcal (men) without medical guidance, as too-low intake accelerates muscle loss and micronutrient deficiency.',
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
        q: 'What exercise is best on GLP-1s?',
        a: 'Resistance training (2–3x/week) is the highest priority. It directly counters the muscle loss that GLP-1-driven caloric restriction can cause. Studies show people who lift while on GLP-1s preserve significantly more lean mass. Add daily walking (7,000–10,000 steps) for cardiovascular health. Even light bodyweight exercises (squats, push-ups) count.',
      },
      {
        q: 'Why does sleep matter so much?',
        a: 'Poor sleep (under 6 hours) blunts GLP-1 appetite control by up to 30%, increases cortisol (which promotes fat storage and cravings), and impairs muscle protein synthesis. Aim for 7–9 hours. Sleep quality is as important as diet on GLP-1 therapy. If you have untreated sleep apnea, GLP-1 therapy may actually help. Significant weight loss often resolves OSA.',
      },
      {
        q: 'How does stress affect my results?',
        a: 'Chronic stress elevates cortisol, which promotes abdominal fat storage and increases hunger, partially overriding the appetite-suppressing effects of GLP-1 medications. It also disrupts sleep and can trigger emotional eating patterns. Mindfulness, regular movement, and adequate sleep are the best stress management tools.',
      },
      {
        q: 'Will I lose muscle mass?',
        a: 'It\'s a real risk, but largely preventable. During rapid weight loss, 25–40% of lost weight can be lean mass (muscle, bone density) without intervention. The solution: (1) Eat 0.7–1g protein per lb body weight daily, (2) Do resistance training 2–3x/week, (3) Avoid going below your protein target even on days you\'re nauseous. Track protein intake. It\'s the single best muscle preservation predictor.',
      },
      {
        q: 'Can I drink alcohol on GLP-1s?',
        a: 'GLP-1 medications significantly lower alcohol tolerance. Many people are surprised to feel drunk from 1–2 drinks. This is because slowed gastric emptying changes alcohol absorption kinetics. Alcohol also worsens nausea, dehydration, and can undermine weight loss. If you do drink: start with very small amounts, always eat first, and never drink on an empty stomach.',
      },
    ],
  },
  {
    id: 'mental',
    icon: 'happy-outline',
    iconSet: 'Ionicons',
    title: 'Mental Health & Food Noise',
    items: [
      {
        q: 'What is "food noise" and why does it go quiet?',
        a: '"Food noise" refers to the constant mental preoccupation with food: thinking about what to eat next, craving specific foods, difficulty resisting urges. GLP-1 receptors exist in the brain\'s reward and appetite centers. When activated, many people report that food noise quiets dramatically, sometimes described as a mental silence they\'ve never experienced before. This is a direct pharmacological effect.',
      },
      {
        q: 'Why do I feel emotionally different about food?',
        a: 'GLP-1 meds often change your relationship with food in ways that go beyond just eating less. Foods that felt like emotional comfort may lose their appeal. This can be disorienting, especially if food was a primary coping mechanism. It\'s worth exploring this with a therapist. Many patients find GLP-1 therapy an unexpected window into their emotional eating patterns.',
      },
      {
        q: 'Body image concerns after weight loss',
        a: 'Rapid weight loss can create unexpected challenges: loose skin, feeling disconnected from your body, or not recognizing yourself in the mirror. Body dysmorphia can actually worsen for some patients during rapid loss. Others struggle with "will people treat me differently?" or feelings of identity shift. These are normal and important to process. A therapist familiar with weight loss can be invaluable.',
      },
      {
        q: 'GLP-1s and addiction / reduced cravings',
        a: 'Emerging research suggests GLP-1 receptors are involved in the brain\'s reward pathways beyond food, including alcohol and other substance cravings. Several studies show GLP-1 therapy reduces addictive behaviors broadly. This isn\'t fully understood yet, but many patients report reduced cravings for alcohol, smoking, and even compulsive behaviors. Discuss with your doctor if you have a history of addiction.',
      },
      {
        q: 'What if I feel anxious or depressed on GLP-1s?',
        a: 'Some patients report mood changes, both positive (reduced depression from weight loss) and negative (anxiety, low mood, especially during dose escalation). Rapid metabolic changes and caloric restriction can affect mood. If you notice persistent mood changes, especially depressive thoughts or unusual anxiety, discuss with your prescriber. Don\'t adjust doses without medical guidance.',
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
        a: 'Nausea is most common in the first 4–8 weeks or after a dose increase. Practical strategies: eat slowly, take small bites, avoid lying down after eating, stay hydrated, eat a light snack before or after injection. Ginger tea, peppermint, and bland foods (crackers, plain rice) help. If nausea is severe, discuss delaying your dose escalation. This is a valid medical strategy.',
      },
      {
        q: 'Tips for constipation',
        a: 'GLP-1s slow gut motility significantly. Constipation is one of the most underreported side effects. Increase fiber (aim for 30–35g/day), drink extra water (at least 64 oz), and stay active. Psyllium husk, magnesium citrate (400mg at bedtime), or prune juice can help. Your doctor may recommend a gentle osmotic laxative (MiraLAX) if symptoms persist beyond 1 week.',
      },
      {
        q: 'Why do I feel fatigued?',
        a: 'Fatigue is common in early weeks as your body adapts to reduced caloric intake, slower digestion, and metabolic changes. Ensure adequate protein, iron, B12, and vitamin D. Fatigue usually resolves by week 4–6. If it persists at higher doses or is severe, discuss with your doctor. It can sometimes indicate you\'re in a caloric deficit that\'s too aggressive.',
      },
      {
        q: 'What about hair loss?',
        a: 'Temporary hair shedding (telogen effluvium) occurs in 10–30% of patients, typically 3–6 months into treatment, due to rapid caloric restriction or nutritional deficiency, not a direct drug effect. Prioritize protein (the #1 factor), biotin (2,500–5,000 mcg/day), zinc, and iron. Hair typically regrows fully after 6–12 months once nutrition stabilizes.',
      },
      {
        q: 'Heartburn and acid reflux',
        a: 'Because GLP-1s slow gastric emptying, acid reflux worsens for some patients. Strategies: don\'t eat within 3 hours of lying down, elevate the head of your bed slightly, avoid large meals, reduce coffee and alcohol. Over-the-counter antacids (omeprazole, famotidine) can be used short-term. Persistent severe GERD warrants a conversation with your doctor.',
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
        q: 'What exactly do I do if I miss a dose?',
        a: 'For weekly injections (semaglutide/tirzepatide): inject the missed dose ONLY if within 5 days of your scheduled day. If more than 5 days have passed, skip it entirely and resume your regular weekly schedule on the original day. Never take two doses within 48 hours. Set a recurring calendar reminder to prevent this.',
      },
      {
        q: 'Why did my weight loss plateau?',
        a: 'Weight loss plateaus are normal and expected, typically at 6–12 months. Your body adapts metabolic rate downward during caloric restriction (adaptive thermogenesis). Strategies: increase protein to 1g/lb body weight, add resistance training, review caloric intake, ensure 7+ hours sleep, and discuss with your doctor whether a dose adjustment is appropriate.',
      },
      {
        q: 'Can GLP-1s affect fertility?',
        a: 'GLP-1 medications may actually improve fertility, particularly for women with PCOS. Weight loss and improved insulin sensitivity often restore ovulatory cycles. Importantly: if you\'re not intending pregnancy, use effective contraception. GLP-1s are not safe during pregnancy. If you become pregnant while on GLP-1 therapy, stop immediately and contact your OB.',
      },
      {
        q: 'Will I have loose skin after weight loss?',
        a: 'Skin elasticity varies by age, genetics, speed of loss, and hydration. Slower weight loss (1–2 lbs/week, which GLP-1s typically produce) causes less loose skin than surgical weight loss. Resistance training builds muscle underneath, which fills out skin. Staying well-hydrated and maintaining collagen-supporting nutrients (vitamin C, zinc) supports skin health.',
      },
      {
        q: 'What happens when I stop GLP-1 therapy?',
        a: 'The STEP and SURMOUNT extension trials are unambiguous: most people regain 2/3 of lost weight within 12 months of stopping. The underlying biology (set point, appetite regulation) reverts when medication stops. This is not a failure of willpower. It\'s biology. Long-term treatment is the evidence-based standard. Discuss a maintenance strategy with your prescriber before stopping.',
      },
      {
        q: 'Drug interactions I should know about',
        a: 'Important interactions: (1) Oral medications (including birth control pills): GLP-1s slow absorption, potentially reducing effectiveness; take oral meds 1 hour before or 4 hours after injection. (2) Insulin/sulfonylureas: GLP-1s increase hypoglycemia risk; doses may need adjustment. (3) Warfarin: monitor INR more closely. (4) Alcohol: significantly lower tolerance. Always disclose all medications to your prescriber.',
      },
    ],
  },
];

// ─── Myth vs. Fact data ───────────────────────────────────────────────────────

type MythItem = {
  myth: string;
  fact: string;
  icon: React.ReactNode;
};

const MYTHS: MythItem[] = [
  {
    icon: <IconSymbol name="brain.head.profile" size={26} color="#FF742A" />,
    myth: '"GLP-1s are the easy way out. Real weight loss takes willpower."',
    fact: 'Obesity is a chronic metabolic disease driven by biology, not willpower. GLP-1 medications correct a hormonal dysfunction, just as insulin treats diabetes. Studies show GLP-1 therapy is more effective than lifestyle intervention alone for sustained weight loss.',
  },
  {
    icon: <IconSymbol name="fork.knife" size={26} color="#FF742A" />,
    myth: '"I can eat whatever I want since the medication controls my appetite."',
    fact: 'Poor nutrition on GLP-1s leads to muscle loss, micronutrient deficiency, and rebound weight gain. The medication reduces quantity. What you eat determines quality of your results. Protein intake is especially critical for preserving muscle mass.',
  },
  {
    icon: <IconSymbol name="scalemass.fill" size={26} color="#FF742A" />,
    myth: '"The weight will stay off permanently once I lose it."',
    fact: 'Weight regain occurs in ~70% of patients within 12 months of stopping GLP-1 therapy. The brain\'s appetite regulation and metabolic set point revert without the medication. Long-term treatment is the evidence-based approach for sustained results.',
  },
  {
    icon: <IconSymbol name="face.smiling" size={26} color="#FF742A" />,
    myth: '"Hair loss on GLP-1s is permanent and keeps getting worse."',
    fact: 'Hair shedding (telogen effluvium) is temporary, caused by rapid caloric restriction, not a direct drug effect. It typically peaks at 3–4 months and fully reverses by 9–12 months. Prioritizing protein and micronutrients (zinc, iron, biotin) significantly reduces severity.',
  },
  {
    icon: <IconSymbol name="exclamationmark.triangle.fill" size={26} color="#FF742A" />,
    myth: '"Nausea means the medication is working. More nausea = faster weight loss."',
    fact: 'Nausea is a side effect of the medication\'s gut effects, not an indicator of efficacy. Severe nausea often means you\'re eating too much or too fast, or escalating doses too quickly. It has no correlation with weight loss rate.',
  },
  {
    icon: <IconSymbol name="cross.case.fill" size={26} color="#FF742A" />,
    myth: '"GLP-1s are only for people with type 2 diabetes."',
    fact: 'Semaglutide (Wegovy) and tirzepatide (Zepbound) are FDA-approved for chronic weight management in adults with BMI ≥30, or ≥27 with a weight-related condition, regardless of diabetes status. The majority of GLP-1 prescriptions for obesity are written for non-diabetic patients.',
  },
  {
    icon: <IconSymbol name="cross.case.fill" size={26} color="#FF742A" />,
    myth: '"GLP-1 medications damage your thyroid or pancreas."',
    fact: 'The thyroid tumor signal seen in rodent studies has not been observed in humans in any clinical trial. The FDA requires a warning on labeling as a precaution, but human evidence for this risk is not established. Pancreatitis risk exists but is rare (~0.1%) and not higher than in the general population with obesity-related risk factors.',
  },
];

// ─── Side Effect Decoder data ─────────────────────────────────────────────────

type SymptomCategory = 'expected' | 'monitor' | 'call_doctor';

type SymptomItem = {
  name: string;
  detail: string;
  category: SymptomCategory;
};

const SYMPTOMS: SymptomItem[] = [
  { category: 'expected', name: 'Nausea', detail: 'Very common in weeks 1–8 and at dose increases. Typically improves with time. Manage with small meals and bland foods.' },
  { category: 'expected', name: 'Reduced appetite', detail: 'A primary therapeutic effect. Expected to be significant, especially at therapeutic doses.' },
  { category: 'expected', name: 'Constipation', detail: 'GLP-1s slow gut motility. Increase fiber, water, and activity. Magnesium citrate helps.' },
  { category: 'expected', name: 'Fatigue (early)', detail: 'Common in weeks 1–6 as your body adapts to caloric restriction. Ensure protein and micronutrient intake.' },
  { category: 'expected', name: 'Injection site redness', detail: 'Mild local reaction, usually resolves in 1–3 days. Rotate injection sites.' },
  { category: 'expected', name: 'Burping / bloating', detail: 'Slowed gastric emptying causes this. Eat slowly, avoid carbonated drinks.' },
  { category: 'expected', name: 'Headache (mild)', detail: 'Often dehydration-related. Increase water and electrolytes before escalating other concerns.' },
  { category: 'monitor', name: 'Vomiting (>2x/day)', detail: 'Some vomiting is expected, but frequent or forceful vomiting warrants monitoring. Can cause dehydration. Contact doctor if persistent >48 hours.' },
  { category: 'monitor', name: 'Severe constipation', detail: 'No bowel movement for 5+ days, or significant pain. Try MiraLAX. Contact your doctor if no relief after 2–3 days.' },
  { category: 'monitor', name: 'Diarrhea', detail: 'Less common than constipation but occurs in some patients. Monitor for dehydration. Contact doctor if bloody or lasting >3 days.' },
  { category: 'monitor', name: 'Heartburn / GERD', detail: 'Slowed emptying worsens acid reflux in some patients. OTC antacids can help. Tell your doctor if frequent.' },
  { category: 'monitor', name: 'Mood changes', detail: 'Some patients report low mood or anxiety, especially during dose changes. Monitor and discuss with your prescriber.' },
  { category: 'monitor', name: 'Hair shedding', detail: 'Telogen effluvium peaks at 3–6 months. Usually temporary. Prioritize protein, zinc, iron, biotin.' },
  { category: 'call_doctor', name: 'Severe abdominal pain', detail: 'Persistent, severe mid-upper abdominal pain radiating to the back may indicate pancreatitis. Stop medication and go to the ER or call your doctor immediately.' },
  { category: 'call_doctor', name: 'Yellowing skin/eyes', detail: 'Jaundice can indicate gallbladder disease, which is more common with rapid weight loss. Requires same-day medical evaluation.' },
  { category: 'call_doctor', name: 'Difficulty swallowing', detail: 'Gastroparesis (severe stomach paralysis) can cause this. If you cannot keep liquids down or feel food "stuck," contact your doctor immediately.' },
  { category: 'call_doctor', name: 'Neck lump / throat symptoms', detail: 'While thyroid cancer risk in humans is not established, any new neck lump, difficulty swallowing, or persistent hoarseness should be evaluated by your doctor.' },
  { category: 'call_doctor', name: 'Signs of hypoglycemia', detail: 'Shakiness, sweating, confusion, rapid heartbeat, especially if you take insulin or sulfonylureas alongside GLP-1. Treat with 15g fast-acting carbs and call your doctor.' },
  { category: 'call_doctor', name: 'Severe allergic reaction', detail: 'Facial swelling, hives, difficulty breathing. Call 911. Rare but serious. Discontinue medication.' },
];

// ─── Phase-aware focus card ───────────────────────────────────────────────────

const PHASE_TIPS: Record<string, { title: string; tips: string[] }> = {
  initiation: {
    title: 'Building Your Foundation',
    tips: [
      'Focus on injection consistency. Same day, same time each week',
      'Start tracking protein now even if intake is low. The habit matters',
      'Log every side effect you notice — patterns early on are valuable',
      'Nausea is common early on. Small, frequent meals can help',
    ],
  },
  low_therapeutic: {
    title: 'Harness the Appetite Window',
    tips: [
      'Appetite suppression is kicking in. A great time to establish protein-first eating habits',
      'Consider adding resistance training if you haven\'t — it helps preserve muscle during weight loss',
      'Hydration often falls off as hunger decreases. Keep tracking your water intake',
      'Fiber-rich foods can help with digestive comfort',
    ],
  },
  mid_therapeutic: {
    title: 'Optimize Your Routine',
    tips: [
      'Many people find this phase is when food noise is quietest. Use the clarity to build new habits',
      'Prioritize protein at every meal to support muscle preservation',
      'Watch for signs of low energy — it may be worth checking in with your provider about vitamin levels',
      'Sleep and stress management can significantly support your progress',
    ],
  },
  high_therapeutic: {
    title: 'Sustain and Protect',
    tips: [
      'At higher doses, GI comfort may fluctuate. Smaller portions and slower eating can help',
      'Lean mass preservation remains the priority — keep up resistance training',
      'This is a good time for a check-in with your healthcare provider',
      'Focus on building habits that feel sustainable long-term: meal planning, regular movement, rest',
    ],
  },
  high_plus: {
    title: 'Think Long-Term',
    tips: [
      'Focus on sustainable lifestyle habits that will support you long-term',
      'Weight-bearing exercise supports bone density — important at every stage',
      'Re-evaluate protein targets as your body weight changes',
      'Talk to your provider about your long-term plan',
    ],
  },
  max_dose: {
    title: 'Maintenance Mindset',
    tips: [
      'Focus shifts from active loss to sustainable maintenance',
      'Lifestyle habits now are your strongest foundation going forward',
      'Prioritize body composition over scale weight — muscle and bone density matter',
      'A proactive conversation with your provider about next steps is always valuable',
    ],
  },
};

// ─── Phase-aware focus card component ────────────────────────────────────────

const PHASE_KEYS = Object.keys(PHASE_TIPS) as (keyof typeof PHASE_TIPS)[];

function PhaseCard() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createPhaseCardStyles(colors), [colors]);

  // Rotate through all 6 topic sets weekly based on calendar week number
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const calendarWeek = Math.ceil(((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000) + startOfYear.getDay() + 1) / 7);
  const rotationIndex = (calendarWeek - 1) % PHASE_KEYS.length;
  const focusTips = PHASE_TIPS[PHASE_KEYS[rotationIndex]];

  return (
    <View style={[s.wrap, glassShadow]}>
      <View style={s.body}>
        <View style={s.topRow}>
          <View style={s.pill}>
            <Text style={s.pillText}>THIS WEEK'S FOCUS</Text>
          </View>
        </View>
        <Text style={s.phaseTitle}>{focusTips.title}</Text>
        <View style={s.divider} />
        {focusTips.tips.map((tip, i) => (
          <View key={i} style={s.tipRow}>
            <View style={s.tipDot} />
            <Text style={s.tipText}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createPhaseCardStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: { borderRadius: 24, marginBottom: 16 },
    body: {
      borderRadius: 24, overflow: 'hidden',
      backgroundColor: c.bg,
      borderWidth: 0.5, borderColor: c.border,
      padding: 18,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    pill: {
      backgroundColor: `${ORANGE}18`,
      borderRadius: 20, borderWidth: 1,
      borderColor: `${ORANGE}40`,
      paddingHorizontal: 10, paddingVertical: 4,
    },
    pillText: { fontSize: 11, fontWeight: '800', color: ORANGE, letterSpacing: 1.2, fontFamily: FF },
    weekLabel: { fontSize: 14, fontWeight: '600', color: w(0.35), fontFamily: FF },
    phaseTitle: { fontSize: 19, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3, marginBottom: 4, fontFamily: 'System' },
    phaseSub: { fontSize: 15, color: w(0.5), lineHeight: 19, marginBottom: 14, fontFamily: FF },
    divider: { height: 1, backgroundColor: w(0.07), marginBottom: 14 },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE, marginTop: 7, flexShrink: 0 },
    tipText: { fontSize: 15, color: w(0.65), lineHeight: 19, flex: 1, fontFamily: FF },
  });
};

// ─── Myth vs. Fact component ──────────────────────────────────────────────────

function MythCard({ item }: { item: MythItem }) {
  const [revealed, setRevealed] = useState(false);
  const { colors } = useAppTheme();
  const s = useMemo(() => createMythCardStyles(colors), [colors]);

  const handlePress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRevealed(r => !r);
  };

  return (
    <Pressable style={[s.wrap, glassShadow]} onPress={handlePress}>
      <View style={s.body}>
        <View style={s.iconWrap}>{item.icon}</View>
        <View style={s.labelRow}>
          <View style={[s.labelChip, { backgroundColor: revealed ? 'rgba(39,174,96,0.12)' : 'rgba(231,76,60,0.12)' }]}>
            <Text style={[s.labelText, { color: revealed ? '#27AE60' : '#E74C3C' }]}>
              {revealed ? 'FACT' : 'MYTH'}
            </Text>
          </View>
        </View>
        <Text style={s.mythText} numberOfLines={revealed ? undefined : 3}>
          {revealed ? item.fact : item.myth}
        </Text>
        <Text style={s.tapHint}>{revealed ? 'Tap to see myth' : 'Tap to reveal fact'}</Text>
      </View>
    </Pressable>
  );
}

const createMythCardStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: { borderRadius: 20, width: 220, marginRight: 12 },
    body: {
      borderRadius: 20, overflow: 'hidden',
      backgroundColor: c.bg,
      borderWidth: 0.5, borderColor: c.border,
      padding: 16, minHeight: 180,
    },
    iconWrap: { marginBottom: 10 },
    labelRow: { flexDirection: 'row', marginBottom: 8 },
    labelChip: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
    labelText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, fontFamily: FF },
    mythText: { fontSize: 15, color: w(0.7), lineHeight: 20, fontFamily: FF, flex: 1 },
    tapHint: { fontSize: 13, color: w(0.3), marginTop: 10, fontFamily: FF },
  });
};

function MythFactRow() {
  const { colors } = useAppTheme();
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: ORANGE, letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: FF }}>
          MYTH VS. FACT
        </Text>
        <Text style={{ fontSize: 13, color: w(0.35), fontFamily: FF }}>Tap a card to reveal</Text>
      </View>
      <FlatList
        horizontal
        data={MYTHS}
        keyExtractor={(_, i) => `myth-${i}`}
        renderItem={({ item }) => <MythCard item={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
      />
    </View>
  );
}

// ─── Side Effect Decoder ──────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  expected: { label: 'Expected', color: '#27AE60', bg: 'rgba(39,174,96,0.10)' },
  monitor:  { label: 'Monitor',  color: '#F39C12', bg: 'rgba(243,156,18,0.10)' },
  call_doctor: { label: 'Call Doctor', color: '#E74C3C', bg: 'rgba(231,76,60,0.10)' },
};

function SideEffectDecoder() {
  const [selected, setSelected] = useState<SymptomItem | null>(null);
  const [activeCategory, setActiveCategory] = useState<SymptomCategory | 'all'>('all');
  const { colors } = useAppTheme();
  const s = useMemo(() => createDecoderStyles(colors), [colors]);
  const w = (a: number) => colors.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;

  const filtered = activeCategory === 'all'
    ? SYMPTOMS
    : SYMPTOMS.filter(sym => sym.category === activeCategory);

  const handleTap = (item: SymptomItem) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelected(selected?.name === item.name ? null : item);
  };

  return (
    <View style={[s.wrap, glassShadow]}>
      <View style={s.body}>
        <View style={s.header}>
          <IconSymbol name="magnifyingglass" size={18} color={ORANGE} />
          <Text style={s.title}>Side Effect Decoder</Text>
        </View>
        <Text style={s.subtitle}>Tap a symptom to understand if it's expected or needs attention.</Text>

        {/* Category filter */}
        <View style={s.filterRow}>
          {(['all', 'expected', 'monitor', 'call_doctor'] as const).map(cat => {
            const isActive = activeCategory === cat;
            const cfg = cat === 'all' ? null : CATEGORY_CONFIG[cat];
            return (
              <TouchableOpacity
                key={cat}
                style={[s.filterChip, isActive && { backgroundColor: cfg ? cfg.bg : `${ORANGE}15`, borderColor: cfg ? cfg.color : ORANGE }]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setActiveCategory(cat);
                  setSelected(null);
                }}
              >
                <Text style={[s.filterText, isActive && { color: cfg ? cfg.color : ORANGE, fontWeight: '700' }]}>
                  {cat === 'all' ? 'All' : cfg!.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.divider} />

        {/* Symptom chips */}
        <View style={s.chipGrid}>
          {filtered.map((item) => {
            const cfg = CATEGORY_CONFIG[item.category];
            const isSelected = selected?.name === item.name;
            return (
              <TouchableOpacity
                key={item.name}
                style={[s.symptomChip, { backgroundColor: isSelected ? cfg.bg : w(0.04) }, isSelected && { borderColor: cfg.color }]}
                onPress={() => handleTap(item)}
              >
                <Text style={[s.symptomText, isSelected && { color: cfg.color, fontWeight: '700' }]}>{item.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Detail panel */}
        {selected && (
          <View style={[s.detailPanel, { borderLeftColor: CATEGORY_CONFIG[selected.category].color }]}>
            <View style={s.detailHeader}>
              <View style={[s.detailBadge, { backgroundColor: CATEGORY_CONFIG[selected.category].bg }]}>
                <Text style={[s.detailBadgeText, { color: CATEGORY_CONFIG[selected.category].color }]}>
                  {CATEGORY_CONFIG[selected.category].label}
                </Text>
              </View>
              <Text style={s.detailName}>{selected.name}</Text>
            </View>
            <Text style={s.detailText}>{selected.detail}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const createDecoderStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: { borderRadius: 24, marginBottom: 16 },
    body: {
      borderRadius: 24, overflow: 'hidden',
      backgroundColor: c.bg,
      borderWidth: 0.5, borderColor: c.border,
      padding: 18,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    title: { fontSize: 18, fontWeight: '800', color: c.textPrimary, letterSpacing: -0.3, fontFamily: FF },
    subtitle: { fontSize: 15, color: w(0.45), lineHeight: 18, marginBottom: 14, fontFamily: FF },
    filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 14 },
    filterChip: {
      borderRadius: 20, borderWidth: 1, borderColor: w(0.12),
      paddingHorizontal: 12, paddingVertical: 5,
    },
    filterText: { fontSize: 13, fontWeight: '500', color: w(0.45), fontFamily: FF },
    divider: { height: 1, backgroundColor: w(0.07), marginBottom: 14 },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    symptomChip: {
      borderRadius: 20, borderWidth: 1, borderColor: w(0.10),
      paddingHorizontal: 12, paddingVertical: 6,
    },
    symptomText: { fontSize: 14, fontWeight: '500', color: w(0.6), fontFamily: FF },
    detailPanel: {
      marginTop: 14, borderLeftWidth: 3, paddingLeft: 12,
      backgroundColor: w(0.03), borderRadius: 8, padding: 12,
    },
    detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    detailBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
    detailBadgeText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3, fontFamily: FF },
    detailName: { fontSize: 16, fontWeight: '700', color: c.textPrimary, fontFamily: FF },
    detailText: { fontSize: 15, color: w(0.6), lineHeight: 20, fontFamily: FF },
  });
};

// ─── Safety / When to Call Doctor card ───────────────────────────────────────

function SafetyCard() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { colors } = useAppTheme();
  const s = useMemo(() => createSafetyStyles(colors), [colors]);

  const RED_FLAGS: { color: string; text: string }[] = [
    { color: '#E74C3C', text: 'Severe or persistent mid-upper abdominal pain (possible pancreatitis)' },
    { color: '#E74C3C', text: 'Yellowing of skin or eyes (jaundice, gallbladder concern)' },
    { color: '#E74C3C', text: 'Cannot keep any liquids down for 24+ hours (dehydration risk)' },
    { color: '#E74C3C', text: 'Signs of severe allergic reaction: facial swelling, hives, difficulty breathing' },
    { color: '#E74C3C', text: 'Shakiness, confusion, heart pounding (hypoglycemia, especially with insulin)' },
    { color: '#F39C12', text: 'Persistent vomiting lasting more than 2 days at a new dose' },
    { color: '#F39C12', text: 'No bowel movement for 5+ days with significant discomfort' },
    { color: '#F39C12', text: 'New neck lump, difficulty swallowing, or persistent hoarseness' },
    { color: '#F39C12', text: 'Significant mood changes, worsening depression, or unusual anxiety' },
  ];

  return (
    <View style={[s.wrap, glassShadow]}>
      <TouchableOpacity
        style={s.body}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsExpanded(e => !e);
        }}
        activeOpacity={0.9}
      >
        <View style={s.headerRow}>
          <View style={s.iconWrap}>
            <IconSymbol name="exclamationmark.triangle.fill" size={20} color="#E74C3C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>When to Call Your Doctor</Text>
            <Text style={s.subtitle}>Critical warning signs to know</Text>
          </View>
          <IconSymbol
            name={isExpanded ? 'chevron.up' : 'chevron.down'}
            size={16}
            color="rgba(231,76,60,0.6)"
          />
        </View>

        {isExpanded && (
          <View style={s.content}>
            <View style={s.divider} />
            {RED_FLAGS.map((flag, i) => (
              <View key={i} style={s.flagRow}>
                <View style={[s.flagDot, { backgroundColor: flag.color }]} />
                <Text style={s.flagText}>{flag.text}</Text>
              </View>
            ))}
            <View style={s.emergencyNote}>
              <Text style={s.emergencyText}>For severe allergic reactions or difficulty breathing. Call 911 immediately. Do not drive yourself.</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const createSafetyStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: { borderRadius: 20, marginBottom: 24 },
    body: {
      borderRadius: 20, overflow: 'hidden',
      backgroundColor: 'rgba(231,76,60,0.06)',
      borderWidth: 1, borderColor: 'rgba(231,76,60,0.25)',
      padding: 16,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(231,76,60,0.12)', alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 17, fontWeight: '800', color: '#E74C3C', letterSpacing: -0.2, fontFamily: FF },
    subtitle: { fontSize: 14, color: 'rgba(231,76,60,0.65)', fontFamily: FF, marginTop: 1 },
    content: {},
    divider: { height: 1, backgroundColor: 'rgba(231,76,60,0.15)', marginVertical: 12 },
    flagRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
    flagDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
    flagText: { fontSize: 15, color: w(0.65), lineHeight: 19, flex: 1, fontFamily: FF },
    emergencyNote: {
      marginTop: 8, borderRadius: 10,
      backgroundColor: 'rgba(231,76,60,0.10)',
      padding: 12,
    },
    emergencyText: { fontSize: 14, color: '#E74C3C', fontWeight: '600', lineHeight: 17, fontFamily: FF },
  });
};

// ─── Expandable card component ────────────────────────────────────────────────

function EducationCard({ section }: { section: Section }) {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const { colors } = useAppTheme();
  const c = useMemo(() => createCardStyles(colors), [colors]);

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
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setExpandedItem(isOpen ? null : idx);
                }}
                activeOpacity={0.7}
              >
                <Text style={c.itemQ} numberOfLines={isOpen ? undefined : 2}>{item.q}</Text>
                <IconSymbol
                  name={isOpen ? 'chevron.up' : 'chevron.down'}
                  size={16}
                  color={colors.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
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

function ArticleCard({ article }: { article: ArticleRow }) {
  const { colors } = useAppTheme();
  const ac = useMemo(() => createArticleCardStyles(colors), [colors]);
  const chipColor = contentCategoryColor(colors.isDark, article.category);

  return (
    <Pressable
      style={[ac.wrap, glassShadow]}
      onPress={() => router.push(`/articles/${article.id}` as any)}
    >
      <View style={ac.body}>
        <View style={ac.inner}>
          <View style={ac.topRow}>
            <View style={[ac.chip, { backgroundColor: chipColor + '20', borderColor: chipColor + '55' }]}>
              <Text style={[ac.chipText, { color: chipColor }]}>
                {article.category.charAt(0).toUpperCase() + article.category.slice(1)}
              </Text>
            </View>
            <Text style={ac.readTime}>{article.reading_time_minutes} min read</Text>
          </View>
          <Text style={ac.title} numberOfLines={2}>{article.title}</Text>
          {article.subtitle && (
            <Text style={ac.subtitle} numberOfLines={2}>{article.subtitle}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const createArticleCardStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    wrap: { borderRadius: 20, marginBottom: 12 },
    body: {
      borderRadius: 20, overflow: 'hidden',
      backgroundColor: c.bg,
      borderWidth: 0.5, borderColor: c.border,
    },
    inner: { padding: 18 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    chip: {
      borderRadius: 20, borderWidth: 1,
      paddingHorizontal: 8, paddingVertical: 3,
    },
    chipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, fontFamily: FF },
    readTime: { fontSize: 13, color: w(0.35), fontFamily: FF },
    title: { fontSize: 18, fontWeight: '700', color: c.textPrimary, lineHeight: 22, marginBottom: 4, fontFamily: FF },
    subtitle: { fontSize: 15, color: w(0.50), lineHeight: 19, fontFamily: FF },
  });
};

// ─── Guided Courses Row ───────────────────────────────────────────────────────

function GuidedCoursesRow() {
  const { colors } = useAppTheme();
  const courses = useCoursesStore((s) => s.courses);
  const progress = useCoursesStore((s) => s.progress);

  if (courses.length === 0) return null;

  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{
        fontSize: 11, fontWeight: '700', color: ORANGE,
        letterSpacing: 1.5, textTransform: 'uppercase',
        marginBottom: 14, fontFamily: FF,
      }}>GUIDED COURSES</Text>
      <FlatList
        horizontal
        data={courses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CourseCard
            course={item}
            completedCount={(progress[item.id] ?? []).length}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 4 }}
      />
    </View>
  );
}

export default function EducationScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const { onScroll: tabBarOnScroll, onScrollEnd } = useTabBarVisibility();
  const onScroll = useCallback((e: any) => { scrollY.setValue(e.nativeEvent.contentOffset.y); tabBarOnScroll(e); }, [tabBarOnScroll]);
  const { colors } = useAppTheme();
  const s = useMemo(() => createScreenStyles(colors), [colors]);

  const fetchCourses = useCoursesStore((s) => s.fetchCourses);

  useFocusEffect(useCallback(() => {
    fetchCourses();
  }, []));

  return (
    <TabScreenWrapper>
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          onScrollEndDrag={onScrollEnd}
          onMomentumScrollEnd={onScrollEnd}
          scrollEventThrottle={16}
        >
          <GradientBackground />
          <View style={s.heroHeader}>
            <Text style={s.heroTitle}>Education</Text>
          </View>

          {/* ── Phase-aware personalized card ── */}
          <PhaseCard />

          {/* ── Guided Courses ── */}
          <GuidedCoursesRow />

          {/* ── Side Effect Decoder ── */}
          <SideEffectDecoder />

          <Text style={s.disclaimer}>
            This content is for informational purposes only and does not constitute medical advice. Always consult your healthcare provider before making any changes to your treatment plan.
          </Text>
        </ScrollView>
      </SafeAreaView>
      <ScrollTitle title="Education" scrollY={scrollY} />
    </View>
    </TabScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createScreenStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 0, paddingBottom: 120 },

    // Hero header background
    heroBg: { backgroundColor: '#E8652A' },
    heroCurve: { height: 28, backgroundColor: c.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -1 },
    heroHeader: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
    heroTitle: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginBottom: 4, fontFamily: 'System' },
    heroSub: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500', fontFamily: FF },

    headerTitle: { fontSize: 36, fontWeight: '800', color: c.textPrimary, letterSpacing: -1, marginBottom: 4, fontFamily: 'System' },
    headerSub: { fontSize: 16, color: w(0.45), fontWeight: '500', marginBottom: 24, fontFamily: FF },
    disclaimer: { fontSize: 13, color: w(0.30), textAlign: 'center', lineHeight: 16, marginTop: 16, paddingHorizontal: 8, fontFamily: FF },
  });
};

const createCardStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    cardWrap: { borderRadius: 24, marginBottom: 16 },
    cardBody: {
      borderRadius: 24, overflow: 'hidden',
      backgroundColor: c.bg,
      borderWidth: 0.5, borderColor: c.border,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14 },
    iconWrap: { marginRight: 12 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: c.textPrimary, flex: 1, letterSpacing: -0.3, fontFamily: 'System' },
    divider: { height: 1, backgroundColor: c.borderSubtle, marginHorizontal: 18 },
    itemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
    },
    itemQ: { fontSize: 16, fontWeight: '600', color: c.textPrimary, flex: 1, lineHeight: 20, fontFamily: FF },
    itemBody: { paddingHorizontal: 18, paddingBottom: 14 },
    itemA: { fontSize: 16, color: w(0.55), lineHeight: 22, fontWeight: '400', fontFamily: FF },
    itemDivider: { height: 1, backgroundColor: w(0.06), marginHorizontal: 18 },
  });
};
