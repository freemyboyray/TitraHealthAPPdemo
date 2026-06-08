import type { ImageSourcePropType } from 'react-native';

export type ArticleSection = {
  heading?: string;
  body: string;
};

export type Article = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  readingTime: number;
  coverImage: ImageSourcePropType;
  /** Pastel card/background color. For legacy (baked-background) art this MUST match the
   *  baked-in background of coverImage. For transparentArt this is an unused fallback —
   *  the card color comes from the parent section's bgColor instead. */
  bgColor: string;
  /** When true, coverImage is a transparent PNG illustration rendered (contained, with
   *  padding) over the section's identity color. When false/undefined, coverImage fills
   *  the card edge-to-edge on its own bgColor (legacy behavior). */
  transparentArt?: boolean;
  sections: ArticleSection[];
  sources: string[];
};

export const ARTICLES: Article[] = [
  {
    id: 'how-glp1s-work',
    title: 'How GLP-1s Work',
    subtitle: 'What happens in your body and why appetite changes feel different.',
    category: 'medication',
    readingTime: 5,
    coverImage: require('@/assets/images/articles/how-glp1s-work.png'),
    bgColor: '#E6E3FB',
    transparentArt: true,
    sections: [
      {
        heading: 'A Hormone Your Body Already Makes',
        body: 'GLP-1 stands for glucagon-like peptide-1. It\'s a hormone your gut naturally releases after you eat. Its job is to tell your brain that food has arrived, trigger insulin release, and slow down digestion so you feel full longer.\n\nYour body breaks down natural GLP-1 within minutes. GLP-1 medications are designed to last much longer (hours to days instead of minutes), giving your body a sustained version of a signal it already knows.',
      },
      {
        heading: 'Three Things That Change',
        body: 'Research suggests GLP-1 medications work through three main pathways:\n\n- **Appetite signals**: They activate receptors in the brain\'s satiety center, reducing the drive to eat. Many people describe this as feeling satisfied sooner and thinking about food less often.\n\n- **Digestion pace**: Food stays in your stomach longer, which extends the feeling of fullness after meals.\n\n- **Blood sugar response**: They support your body\'s natural insulin response, which may help reduce energy crashes and cravings tied to blood sugar swings.',
      },
      {
        heading: 'Why This Feels Different Than Dieting',
        body: 'If you\'ve tried to manage your weight through willpower alone, you may have experienced what many people call "food noise," a constant mental loop of thinking about what to eat, when to eat, or resisting cravings.\n\nResearch suggests this isn\'t a lack of discipline. It\'s driven by reward circuits in the brain that respond to food cues. GLP-1 medications appear to reduce the intensity of those signals. Many people describe it as "the volume being turned down." Food is still enjoyable, but the mental preoccupation quiets.',
      },
      {
        heading: 'What to Realistically Expect',
        body: 'Everyone\'s experience is different, and timelines vary. Generally:\n\n- **Early weeks**: Some people notice appetite changes quickly; others feel very little at first. Digestive adjustments like nausea are most common during this period and tend to improve.\n\n- **First few months**: As the dose gradually increases, appetite changes typically become more noticeable. This is also when many people start to see changes on the scale.\n\n- **Over time**: The best results tend to come with consistency, both with the medication and with supportive habits like adequate protein, hydration, and movement.\n\nThere\'s no universal timeline. Your healthcare provider can help you understand what to expect based on your situation.',
      },
      {
        heading: 'Common Misconceptions',
        body: '- **"It\'s just an appetite suppressant."** GLP-1 medications work through multiple pathways, including brain reward signaling and digestion, not just hunger reduction.\n\n- **"Everyone sees results right away."** Many people see minimal change in the first month during initial dosing. This is normal.\n\n- **"It removes all enjoyment of food."** Research suggests these medications reduce the preoccupation with food, not the pleasure of eating itself.\n\n- **"You can stop anytime and keep results."** Most studies suggest that the body\'s appetite regulation returns to its previous state after discontinuation. Building sustainable habits during this time may help support long-term outcomes.',
      },
    ],
    sources: [
      'Cleveland Clinic: GLP-1 Agonists Overview',
      'Mayo Clinic: How Semaglutide Works',
      'NIH/PMC: GLP-1 Receptor Agonists Mechanism of Action',
      'Scientific American: How GLP-1s Affect Brain Reward Circuits',
    ],
  },
  {
    id: 'managing-side-effects',
    title: 'Your First Weeks',
    subtitle: 'Why side effects happen and practical ways to manage them.',
    category: 'side-effects',
    readingTime: 5,
    coverImage: require('@/assets/images/articles/your-first-weeks.png'),
    bgColor: '#FBE3EC',
    transparentArt: true,
    sections: [
      {
        heading: 'Why Your Body Is Adjusting',
        body: 'GLP-1 medications work by mimicking a hormone your gut naturally releases after eating. One of its key effects is slowing how quickly your stomach empties. Food stays longer, and fullness lasts longer.\n\nIn the early weeks, your body hasn\'t recalibrated to this new pace. The stomach receives signals that it\'s fuller than expected, even from normal-sized meals. That mismatch is what drives most of the common digestive effects people experience early on.',
      },
      {
        heading: 'What Many People Experience',
        body: 'The most commonly reported effects during the first weeks include:\n\n- **Nausea**: Reported by roughly 40–50% of people. It tends to be most noticeable in the first week or two at a new dose and generally improves as the body adapts.\n\n- **Constipation**: Slowed digestion can slow everything downstream. Around 20% of people notice this, and it may take a bit longer to resolve than nausea.\n\n- **Bloating or early fullness**: Feeling full faster than expected is common. It\'s directly related to the stomach emptying more slowly.\n\n- **Fatigue or headache**: Some people feel more tired than usual or notice mild headaches, especially in the first few weeks. Staying hydrated and eating enough may help.\n\nThese effects are generally mild to moderate and tend to ease as the body adjusts to each dose level.',
      },
      {
        heading: 'Practical Things That May Help',
        body: 'Many people find these approaches helpful during the adjustment period:\n\n- **Eat smaller, more frequent meals**: Three to five smaller meals spread across the day can be easier to tolerate than two or three large ones.\n\n- **Go slow**: Eating more slowly gives your body time to process. Rushing meals when digestion is already slowed can intensify discomfort.\n\n- **Keep it simple**: Fried, greasy, or heavily spiced foods tend to be harder to digest during dose adjustments. Lighter options may sit better.\n\n- **Stay hydrated**: Nausea and digestive changes can increase the risk of dehydration. Sipping water throughout the day, even when you\'re not thirsty, is a habit many people find valuable.\n\n- **Ginger or peppermint tea**: Both have a long history of use for digestive comfort, and some clinical guidance supports their use for nausea relief.',
      },
      {
        heading: 'The Dose Escalation Pattern',
        body: 'GLP-1 medications follow a gradual dosing schedule for a reason: the body needs time to adapt at each level.\n\nMany people notice a pattern: side effects may briefly reappear or intensify when moving to a higher dose, then settle within one to two weeks as the body recalibrates. This is expected.\n\nIf the adjustment feels difficult, it\'s worth discussing with your healthcare provider. Spending extra time at a dose before moving up is a common and well-supported approach.',
      },
      {
        heading: 'When to Reach Out to Your Provider',
        body: 'Most early side effects are a normal part of the adjustment process. However, some signs suggest it\'s time to check in with your healthcare team:\n\n- Nausea or vomiting that prevents you from keeping fluids down\n\n- Symptoms that aren\'t improving after two to three weeks at the same dose\n\n- Severe abdominal pain, especially in the upper abdomen\n\n- Signs of dehydration like dark urine, dizziness, or a rapid heartbeat\n\n- Any symptom that interferes with your ability to eat, drink, or go about your day\n\nThese don\'t necessarily mean something is wrong, but they\'re worth a conversation with someone who knows your full health picture.',
      },
    ],
    sources: [
      'NIH/PMC: Adverse Effects of GLP-1 Receptor Agonists',
      'NIH/PMC: Dietary Recommendations for GI Symptom Management',
      'Cleveland Clinic: GLP-1 Agonists: Side Effects',
      'NIH/PMC: Multidisciplinary Expert Consensus on GI Management',
    ],
  },
  {
    id: 'protein-priority',
    title: 'The Protein Priority',
    subtitle: 'Why protein matters more now and how to get enough of it.',
    category: 'nutrition',
    readingTime: 5,
    coverImage: require('@/assets/images/articles/protein-priority.png'),
    bgColor: '#FBEED0',
    transparentArt: true,
    sections: [
      {
        heading: 'Why Protein Matters More Right Now',
        body: 'When the body loses weight quickly, it doesn\'t only lose fat. Research consistently shows that without intentional effort, roughly 25–40% of weight lost during rapid reduction can come from lean mass: muscle, bone density, and other non-fat tissue.\n\nGLP-1 medications can drive significant changes on the scale, which makes this even more relevant. Reduced appetite also means fewer total meals and smaller portions, making it easy to fall short on protein without realizing it.\n\nAdequate protein supports the body\'s ability to preserve muscle during this process. It\'s one of the most well-supported nutritional strategies in the research.',
      },
      {
        heading: 'How Much Protein Are We Talking About?',
        body: 'A 2025 joint advisory from four major nutrition and obesity organizations recommended a range of **1.2 to 2.0 grams of protein per kilogram of body weight per day** during active weight reduction.\n\nIn practical terms, that often translates to roughly **25–40 grams of protein per meal**, spread across three to four eating occasions throughout the day.\n\nDistributing protein evenly matters, because the body can only use so much at once for muscle maintenance. One large protein-heavy meal is less effective than consistent intake across the day.',
      },
      {
        heading: 'The Protein-First Approach',
        body: 'When appetite is reduced, many people find they can only eat a limited amount before feeling full. The protein-first strategy means starting each meal with the protein-rich portion before moving on to other foods.\n\nThis works for a straightforward reason: if fullness arrives before the plate is empty, at least the most important macronutrient has been consumed. Research also suggests that eating protein before carbohydrates may help sustain satiety and support more stable blood sugar after meals.\n\nIt\'s a simple reorder, not a restrictive diet, just prioritizing what goes on the fork first.',
      },
      {
        heading: 'Practical Sources Worth Knowing',
        body: 'Some foods deliver more protein per bite than others. A few examples:\n\n- **Chicken or turkey breast**: roughly 30g per palm-sized portion\n\n- **Fish and shrimp**: 25–27g per similar portion\n\n- **Eggs**: about 6–7g each; three eggs provide roughly 20g\n\n- **Greek yogurt**: around 15–20g per cup\n\n- **Cottage cheese**: about 14g per half cup\n\n- **Lentils or black beans**: 8–9g per cooked cup\n\n- **Tofu or tempeh**: 10–19g per serving depending on type\n\nProtein shakes or powder added to smoothies, oatmeal, or soups can also help on days when solid food feels like too much.',
      },
      {
        heading: 'When Appetite Makes It Hard',
        body: 'Reduced appetite is the whole point of GLP-1 medications, but it can make meeting protein targets genuinely challenging. A few approaches many people find helpful:\n\n- **Schedule meals** rather than waiting for hunger. Appetite cues may not arrive, but the body still needs fuel.\n\n- **Choose protein-dense, low-volume foods.** Greek yogurt, eggs, nut butter, and cottage cheese pack a lot of protein into a small amount of food.\n\n- **Spread it out.** Three to four smaller protein-rich meals tend to be more tolerable than trying to pack everything into one or two sittings.\n\n- **Track it, at least at first.** Many people are surprised by how far their actual intake falls from their target. Even a week of tracking can build helpful awareness.\n\nPairing adequate protein with regular resistance exercise is one of the most well-supported combinations for preserving lean mass during weight changes. Your healthcare provider or a registered dietitian can help tailor targets to your situation.',
      },
    ],
    sources: [
      'ACLM/ASN/OMA/TOS: 2025 Joint Advisory on Nutritional Priorities',
      'NIH/PMC: Resistance Training and Lean Mass Preservation',
      'ADA Diabetes Care: Food Order and Satiety Response',
      'Cleveland Clinic: Protein Deficiency Signs',
    ],
  },
  {
    id: 'staying-hydrated',
    title: 'Staying Hydrated',
    subtitle: 'The overlooked essential, and why thirst alone isn\'t enough.',
    category: 'hydration',
    readingTime: 5,
    coverImage: require('@/assets/images/articles/staying-hydrated-drop.png'),
    transparentArt: true,
    bgColor: '#D9EDFB',
    sections: [
      {
        heading: 'Why Hydration Deserves Extra Attention',
        body: 'Most people rely on thirst to tell them when to drink. But research suggests that GLP-1 medications can reduce thirst signals independently of their appetite effects, meaning the body may need more fluid at the same time it\'s asking for less.\n\nOn top of that, digestive adjustments like nausea or loose stools in the early weeks can increase fluid loss. The combination of drinking less and losing more creates a gap that\'s easy to miss.\n\nStudies have identified dehydration as one of the most common contributing factors to serious outcomes reported during GLP-1 therapy, often because it developed gradually and wasn\'t recognized early.',
      },
      {
        heading: 'How Much Fluid Are We Talking About?',
        body: 'A commonly referenced clinical guideline is roughly **30 mL per kilogram of body weight per day**, which works out to about half an ounce per pound.\n\nFor someone who weighs 180 lbs, that\'s approximately 90 ounces per day. About 20% of daily fluid typically comes from food (soups, fruits, vegetables), with the rest from beverages.\n\nThese are general reference points, not rigid targets. Activity level, climate, and individual health factors all play a role. Your healthcare provider can help determine what makes sense for you.',
      },
      {
        heading: 'Scheduled Sipping vs. Waiting for Thirst',
        body: 'When thirst signals are blunted, waiting until you feel thirsty may mean you\'re already behind. Research from exercise science shows that thirst is often satisfied before the body is fully rehydrated, even in people with normal thirst signaling.\n\nMany people find it helpful to build hydration into their routine rather than relying on cues:\n\n- **Drink a glass upon waking**: the body loses fluid overnight\n\n- **Sip with each meal or snack**: pairing water with eating creates a natural reminder\n\n- **Set a few gentle reminders** throughout the day, especially in the afternoon when intake tends to drop off\n\n- **Keep water visible**: a bottle on the desk or counter serves as a passive prompt\n\nSmall, frequent sips tend to be better tolerated than large volumes at once, especially when digestion is already adjusting.',
      },
      {
        heading: 'When Electrolytes Matter',
        body: 'Water alone doesn\'t always replace what\'s lost, especially during episodes of vomiting or diarrhea, which can deplete sodium, potassium, and magnesium along with fluid.\n\nResearch suggests that people on GLP-1 medications may be more likely to develop shortfalls in certain minerals over time, partly due to reduced food intake and partly due to digestive changes.\n\nAdding electrolytes doesn\'t need to be complicated. Broth, coconut water, or a simple electrolyte drink can help during digestive adjustment periods. Your healthcare provider can check mineral levels if symptoms like cramping, fatigue, or dizziness persist.',
      },
      {
        heading: 'Symptoms That Might Actually Be Dehydration',
        body: 'Several common complaints that people attribute to their medication may actually be signs of inadequate hydration:\n\n- **Headaches**: dehydration is a well-established trigger, and often the simplest one to address\n\n- **Constipation**: reduced fluid intake directly worsens it, compounding the digestive slowdown\n\n- **Fatigue**: even mild dehydration can cause noticeable tiredness and difficulty concentrating\n\n- **Dizziness**: especially when standing up quickly, which can result from lower fluid volume\n\nBefore assuming a symptom is a medication effect, it\'s worth checking whether hydration has been adequate. A simple daily self-check is urine color: pale yellow generally suggests good hydration, while dark yellow may indicate it\'s time to drink more.\n\nIf you experience persistent dizziness, very dark urine, rapid heartbeat, or confusion, reach out to your healthcare team, as these can be signs of more significant dehydration.',
      },
    ],
    sources: [
      'NIH/PMC: GLP-1 RAs and Fluid Intake Suppression',
      'NIH/PMC: Acute Kidney Injury Pharmacovigilance Analysis',
      'Mayo Clinic: Daily Water Intake Guidelines',
      'Cleveland Clinic: Dehydration Signs and Prevention',
    ],
  },
  {
    id: 'exercise-on-glp1s',
    title: 'Movement That Matters',
    subtitle: 'Why resistance training is so important right now.',
    category: 'lifestyle',
    readingTime: 5,
    coverImage: require('@/assets/images/articles/movement-that-matters.png'),
    transparentArt: true,
    bgColor: '#D9F2E3',
    sections: [
      {
        heading: 'Why Exercise Matters More During Weight Loss',
        body: 'When the body loses weight, it doesn\'t distinguish perfectly between fat and muscle. Without intervention, research suggests that 25–40% of weight lost during rapid reduction can come from lean tissue: muscle, connective tissue, and bone density.\n\nExercise, particularly resistance training, is one of the most effective ways to shift that ratio toward fat loss while preserving muscle. A 2025 systematic review found "high certainty of evidence" that adding resistance exercise during caloric restriction results in greater fat loss, preservation of lean mass, and greater muscle strength compared to diet alone.\n\nThis isn\'t about aesthetics. Muscle supports metabolic rate, joint stability, bone density, and everyday function.',
      },
      {
        heading: 'Resistance Training: The Priority',
        body: 'If there\'s one form of exercise that research consistently highlights during GLP-1 therapy, it\'s resistance training, exercises that challenge muscles against some form of resistance.\n\nThis doesn\'t require a gym membership or heavy barbells. Research shows that progressive bodyweight exercises can produce meaningful strength and muscle gains, especially for people who are new to training. Some examples:\n\n- **Squats**: bodyweight, then adding weight as strength builds\n\n- **Lunges**: forward, reverse, or walking variations\n\n- **Push-ups**: wall push-ups, knee push-ups, or standard\n\n- **Rows**: using resistance bands, dumbbells, or even filled water bottles\n\nStarting with two to three sessions per week, with a focus on all major muscle groups, aligns with guidance from both the Mayo Clinic and Cleveland Clinic. Even 10–15 minutes per session is a meaningful starting point.',
      },
      {
        heading: 'Walking and Aerobic Activity',
        body: 'Major health organizations recommend roughly **150 minutes per week of moderate-intensity aerobic activity**, and walking is one of the simplest ways to accumulate that.\n\nWalking supports cardiovascular health, improves mood, and helps with digestion, all relevant during GLP-1 therapy. It\'s also low-impact enough to do daily without adding recovery burden.\n\nThe key is consistency over intensity. A 20–30 minute walk most days of the week adds up quickly and complements resistance training well.',
      },
      {
        heading: 'Adjusting During Dose Changes',
        body: 'Energy levels can dip during dose escalation periods, and nausea may make intense exercise unappealing. This is normal and temporary.\n\nRather than stopping entirely, many people find it helpful to scale back: shorter sessions, lighter intensity, or swapping a gym workout for a walk. Clinical guidance supports this approach: maintaining some movement through adjustment periods is more beneficial than stopping and restarting.\n\nAs the body adapts to each dose level (usually within one to two weeks), energy and tolerance typically return. Building back gradually from there tends to work better than jumping back to full intensity.',
      },
      {
        heading: 'Beyond the Scale',
        body: 'One of the most common frustrations during exercise is when the scale doesn\'t move, or even goes up slightly. This can happen because muscle is denser than fat. Research has documented cases where people simultaneously lost fat and gained lean mass with no change in total body weight.\n\nBetter indicators of progress include how clothes fit, strength improvements, energy levels, and overall how you feel. Body composition is changing even when the number on the scale isn\'t.\n\nRest days matter too, especially when caloric intake is reduced. The body\'s ability to recover is somewhat diminished during caloric restriction, so building in adequate rest between resistance sessions supports better long-term progress. Most guidance suggests at least one to two rest days per week.\n\nYour healthcare provider or a qualified trainer can help you find an approach that fits your current fitness level and energy.',
      },
    ],
    sources: [
      'NIH/PMC: Resistance Training During Dietary Weight Loss (2025 Meta-Analysis)',
      'Cleveland Clinic: Exercise for GLP-1 Use',
      'Mayo Clinic: Strength Training Guidelines',
      'ACLM/ASN/OMA/TOS: 2025 Joint Advisory on GLP-1 Therapy',
    ],
  },
  {
    id: 'what-to-eat',
    title: 'What to Eat (and What to Rethink)',
    subtitle: 'Nutrition strategies that work with your body, not against it.',
    category: 'nutrition',
    readingTime: 6,
    coverImage: require('@/assets/images/articles/what-to-eat.png'),
    bgColor: '#FBE2D2',
    transparentArt: true,
    sections: [
      {
        heading: 'The Order on Your Plate Matters',
        body: 'Research published in Diabetes Care found that eating protein and vegetables before starches can meaningfully improve blood sugar stability after meals. The idea is simple: when protein and fiber arrive first, they slow carbohydrate absorption and support a more gradual energy curve.\n\nThis pairs naturally with GLP-1 medications, which already slow digestion. The food order complements that effect, helping nutrients arrive in a sequence the body handles well.\n\nIn practice, it looks like this: start with your protein, move to vegetables, and finish with grains or starches. It\'s not a restrictive rule, just a reorder that many people find makes meals more comfortable.',
      },
      {
        heading: 'Foods That Tend to Sit Better',
        body: 'When digestion is moving more slowly, certain foods tend to be better tolerated:\n\n- **Lean proteins**: chicken, fish, eggs, Greek yogurt, and cottage cheese are generally well tolerated and deliver essential amino acids\n\n- **Cooked vegetables**: softer textures are easier on the digestive system than raw; roasted or steamed broccoli, zucchini, spinach, and sweet potatoes work well\n\n- **Whole grains in moderate portions**: rice, oats, and quinoa provide sustained energy without overwhelming the stomach\n\n- **Healthy fats in small amounts**: olive oil, avocado, and nuts support nutrient absorption (vitamins A, D, E, and K need dietary fat to be absorbed) without adding digestive burden when portions are modest',
      },
      {
        heading: 'Foods Worth Rethinking (At Least for Now)',
        body: 'Some foods are harder to digest when gastric emptying is already slowed. Common triggers that clinical teams highlight:\n\n- **Fried or greasy foods**: high fat content further delays stomach emptying, compounding the medication\'s effect and often intensifying nausea\n\n- **Carbonated drinks**: gas in a slow-emptying stomach amplifies bloating and discomfort\n\n- **Very spicy foods**: can irritate the stomach lining, which is exposed to food contents for longer than usual\n\n- **Large portions**: the stomach simply has less tolerance for volume when emptying is slowed\n\nThis doesn\'t mean these foods are off-limits forever. Many people find that foods that triggered discomfort during dose adjustments become tolerable again once the body adapts. It\'s about timing more than permanent restriction.',
      },
      {
        heading: 'Fiber: Helpful but Worth Being Gradual About',
        body: 'Fiber plays an important role in digestive health, particularly for managing constipation, one of the more common effects during GLP-1 therapy.\n\nNot all fiber is the same, though:\n\n- **Soluble fiber** (oats, chia seeds, berries, legumes) tends to be gentler; it forms a gel-like substance that softens stool and supports regularity without adding aggressive bulk\n\n- **Insoluble fiber** (wheat bran, raw vegetables, whole grain husks) adds bulk and stimulates motility, but introducing too much too quickly can worsen bloating\n\nThe practical approach: start with soluble fiber sources and increase gradually. Pairing fiber with adequate fluid is essential, because without enough water, fiber can actually make constipation worse.',
      },
      {
        heading: 'Every Bite Counts More Now',
        body: 'When appetite is reduced and total food intake is lower, the nutritional quality of each meal matters more than usual. Research from 2024 and 2025 has identified several nutrients that people on GLP-1 medications are more likely to fall short on over time, including vitamin D, iron, B12, calcium, and magnesium.\n\nRather than counting calories, many people find it more useful to focus on nutrient density, choosing foods that deliver the most vitamins, minerals, and protein per bite. Colorful vegetables, quality proteins, whole grains, and small amounts of healthy fats cover a lot of ground.\n\nDuring dose adjustment periods when appetite is especially low, lighter options like broth-based soups, yogurt, eggs, or smoothies can help maintain intake without requiring large volumes. The goal is to return to balanced, protein-forward meals as quickly as the body allows.\n\nYour healthcare provider or a registered dietitian can help identify whether specific supplements make sense based on your individual needs.',
      },
    ],
    sources: [
      'ADA Diabetes Care: Food Order and Postprandial Glucose',
      'NIH/PMC: Dietary Recommendations for GI Symptoms on GLP-1 RAs',
      'ACLM/ASN/OMA/TOS: 2025 Joint Advisory on Nutritional Priorities',
      'NIH/PMC: Micronutrient Deficiencies During GLP-1 RA Therapy',
    ],
  },
  {
    id: 'quieting-food-noise',
    title: 'Quieting Food Noise',
    subtitle: 'What "food noise" really is and why it often quiets down.',
    category: 'medication',
    readingTime: 4,
    coverImage: require('@/assets/images/articles/quieting-food-noise.png'),
    bgColor: '#E6E3FB',
    transparentArt: true,
    sections: [
      {
        heading: 'What "Food Noise" Actually Means',
        body: '"Food noise" is the term many people use for the constant background chatter about food: thinking about the next meal, replaying what\'s in the fridge, or fighting the urge to snack even when you\'re not hungry.\n\nResearch suggests this isn\'t a character flaw or a lack of willpower. It\'s driven by reward and craving circuits in the brain that respond strongly to food cues, the smell of something cooking, an ad, or just the time of day. For some people these signals are unusually loud, which makes eating feel like a battle of attention.',
      },
      {
        heading: 'Why GLP-1s Turn the Volume Down',
        body: 'GLP-1 receptors aren\'t only in the gut. They\'re also present in regions of the brain involved in appetite and reward. By acting on those areas, GLP-1 medications appear to reduce the intensity of food-related thoughts, not just physical hunger.\n\nMany people describe the change as the mental volume being turned down. Food is still enjoyable, but it stops occupying so much mental space. That freed-up attention is one of the most commonly reported and most valued effects.',
      },
      {
        heading: 'Making the Most of a Quieter Mind',
        body: 'The reduction in food noise is an opportunity, not a guarantee of long-term change. A few ways people use it:\n\n- **Build the habits now**: With cravings quieter, it\'s easier to establish protein-forward meals, regular movement, and consistent hydration that can outlast the medication.\n\n- **Notice your real cues**: Without constant noise, genuine hunger and fullness signals become easier to recognize.\n\n- **Don\'t skip meals just because you can**: A quiet appetite can lead to under-eating. Scheduled, balanced meals matter even when you don\'t feel driven to eat.\n\nIf food thoughts remain overwhelming or tip into distress, that\'s worth raising with your healthcare provider.',
      },
    ],
    sources: [
      'Scientific American: How GLP-1s Affect Brain Reward Circuits',
      'NIH/PMC: GLP-1 Receptors and Central Appetite Regulation',
      'Cleveland Clinic: GLP-1 Agonists Overview',
    ],
  },
  {
    id: 'managing-constipation',
    title: 'The Constipation Fix',
    subtitle: 'Why digestion slows down and the habits that get things moving.',
    category: 'side-effects',
    readingTime: 4,
    coverImage: require('@/assets/images/articles/managing-constipation.png'),
    transparentArt: true,
    bgColor: '#FBEADF',
    sections: [
      {
        heading: 'Why It Happens',
        body: 'Constipation is one of the more common digestive effects of GLP-1 medications, reported by roughly one in five people. The cause is the same mechanism that helps with appetite: slowed gastric emptying and slower movement through the digestive tract.\n\nWhen food moves more slowly, more water is reabsorbed along the way, which can leave stool harder and less frequent. Reduced overall food and fluid intake, common when appetite drops, can compound the effect.',
      },
      {
        heading: 'The Three Levers That Help Most',
        body: 'Most people see improvement by working on three things together:\n\n- **Fluid**: Slowed digestion plus low intake is the main driver. Sipping water steadily through the day, rather than waiting for thirst, makes a real difference.\n\n- **Fiber, increased gradually**: Soluble fiber (oats, chia, berries, legumes) tends to be gentler than insoluble fiber. Add it slowly, and always with enough water, since fiber without fluid can make things worse.\n\n- **Movement**: Even a short daily walk stimulates the natural muscle contractions that move things along.',
      },
      {
        heading: 'When to Check In',
        body: 'Mild constipation usually responds to fluid, fiber, and movement within a week or two. Some over-the-counter options can help short-term, but it\'s worth asking your pharmacist or provider what fits your situation before starting one.\n\nReach out to your healthcare team if you experience severe or persistent abdominal pain, no bowel movement for several days alongside bloating and discomfort, or symptoms that don\'t improve with the basics. These are worth a conversation rather than waiting it out.',
      },
    ],
    sources: [
      'NIH/PMC: Adverse Effects of GLP-1 Receptor Agonists',
      'Cleveland Clinic: GLP-1 Agonists: Side Effects',
      'NIH/PMC: Dietary Fiber and GI Symptom Management',
    ],
  },
  {
    id: 'protein-on-low-appetite-days',
    title: 'Protein on Low-Appetite Days',
    subtitle: 'How to hit your protein goal when you can barely finish a meal.',
    category: 'nutrition',
    readingTime: 4,
    coverImage: require('@/assets/images/articles/protein-on-low-appetite-days.png'),
    bgColor: '#FBEED0',
    transparentArt: true,
    sections: [
      {
        heading: 'The Low-Appetite Challenge',
        body: 'Protein matters most during weight loss precisely when it\'s hardest to eat. Reduced appetite means smaller portions and fewer meals, and protein-rich foods can feel heavy or unappealing when nausea is present.\n\nThe goal on these days isn\'t a perfect plate. It\'s getting enough quality protein, spread out, to help protect the muscle your body would otherwise be tempted to break down.',
      },
      {
        heading: 'Protein-Dense, Low-Volume Foods',
        body: 'When you can only manage a little, choose foods that pack the most protein into the smallest amount:\n\n- **Greek yogurt or skyr**: 15–20g per cup, easy to eat when solids feel like too much\n\n- **Cottage cheese**: about 14g per half cup\n\n- **Eggs**: 6–7g each, soft and simple to prepare\n\n- **Protein shakes or powder**: a reliable fallback when nothing solid appeals; can be added to smoothies, oatmeal, or soup\n\n- **Bone broth or protein-fortified soups**: warm, gentle, and hydrating at the same time',
      },
      {
        heading: 'Practical Tactics',
        body: 'A few habits make low-appetite days easier:\n\n- **Lead with protein**: Eat the protein portion first, so if fullness arrives early, the most important part is already in.\n\n- **Sip, don\'t force**: A protein drink over 20–30 minutes is often more tolerable than a full meal at once.\n\n- **Eat on a schedule**: Appetite cues may not come, so use the clock instead of waiting to feel hungry.\n\n- **Keep easy options stocked**: Having yogurt, eggs, or ready-to-drink shakes on hand removes the decision when you don\'t feel like cooking.\n\nIf you regularly struggle to eat enough, a registered dietitian can help build a plan around your tolerance.',
      },
    ],
    sources: [
      'ACLM/ASN/OMA/TOS: 2025 Joint Advisory on Nutritional Priorities',
      'NIH/PMC: Protein Intake and Lean Mass Preservation',
      'Cleveland Clinic: Protein Deficiency Signs',
    ],
  },
  {
    id: 'electrolytes-explained',
    title: 'Electrolytes, Explained',
    subtitle: "When plain water isn't enough and what your body needs.",
    category: 'hydration',
    readingTime: 4,
    coverImage: require('@/assets/images/articles/electrolytes.png'),
    transparentArt: true,
    bgColor: '#D9EDFB',
    sections: [
      {
        heading: 'What Electrolytes Do',
        body: 'Electrolytes are minerals, mainly sodium, potassium, and magnesium, that carry small electrical charges your body uses for nerve signals, muscle contractions, and fluid balance.\n\nHydration isn\'t only about water volume. It\'s about water and these minerals being in the right balance. Drinking a lot of plain water while minerals run low can actually leave you feeling worse, not better.',
      },
      {
        heading: 'Why GLP-1s Can Tip the Balance',
        body: 'A few factors can lower electrolyte levels during GLP-1 therapy. Episodes of vomiting or diarrhea, especially during dose changes, flush out minerals along with fluid. Reduced food intake means fewer minerals coming in to begin with. And blunted thirst can lead to drinking less overall.\n\nResearch suggests people on these medications may be more prone to mineral shortfalls over time, which can show up as cramping, fatigue, headaches, or dizziness, symptoms easy to mistake for the medication itself.',
      },
      {
        heading: 'When and How to Add Them',
        body: 'Most people don\'t need electrolytes with every glass of water. They matter most during digestive upset, hot weather, heavier activity, or stretches of very low food intake.\n\nSimple options include broth, coconut water, electrolyte tablets or powders, or naturally mineral-rich foods. Many sports drinks are high in added sugar, so a low-sugar electrolyte option is often a better fit. If you have kidney concerns, heart conditions, or take blood pressure medication, check with your provider first, since sodium and potassium needs can be very individual. Persistent cramping, dizziness, or fatigue is worth getting checked.',
      },
    ],
    sources: [
      'NIH/PMC: Electrolyte Balance and Fluid Regulation',
      'Mayo Clinic: Dehydration and Electrolytes',
      'NIH/PMC: Micronutrient Deficiencies During GLP-1 RA Therapy',
    ],
  },
  {
    id: 'walking-counts',
    title: 'Why Walking Counts',
    subtitle: 'The most underrated movement for steady, sustainable progress.',
    category: 'lifestyle',
    readingTime: 4,
    coverImage: require('@/assets/images/articles/walking-counts.png'),
    transparentArt: true,
    bgColor: '#D9F2E3',
    sections: [
      {
        heading: 'Simple, but Far From Trivial',
        body: 'Walking is easy to dismiss because it feels too simple to matter. But major health organizations recommend roughly 150 minutes per week of moderate activity, and walking is one of the most accessible ways to get there.\n\nIt supports cardiovascular health, mood, digestion, and blood sugar regulation, all relevant during GLP-1 therapy, and it\'s low-impact enough to do nearly every day without adding recovery burden.',
      },
      {
        heading: 'Why It Fits GLP-1 Therapy So Well',
        body: 'Energy can dip during dose escalations, and intense workouts may feel unappealing when nausea is present. Walking bridges that gap: it keeps you moving when harder exercise feels like too much.\n\nA short walk after meals can also ease the bloating and slowed digestion many people notice, and gentle movement helps with the constipation that GLP-1s can cause. It complements resistance training rather than competing with it.',
      },
      {
        heading: 'Building the Habit',
        body: 'Consistency matters more than intensity. A few ways to make walking stick:\n\n- **Anchor it to something**: a walk after lunch, or a loop before your first meeting, is easier to keep than a vague intention.\n\n- **Start where you are**: even 10 minutes counts, and short walks add up across the day.\n\n- **Stack it**: phone calls, podcasts, or a friend can turn a walk into time you look forward to.\n\n- **Watch the trend**: small, steady increases beat occasional long efforts followed by burnout.\n\nIf you have joint issues or cardiovascular concerns, your provider can help you find a safe starting point.',
      },
    ],
    sources: [
      'Mayo Clinic: Walking for Health',
      'NIH/PMC: Physical Activity Guidelines and Cardiometabolic Health',
      'Cleveland Clinic: Exercise for GLP-1 Use',
    ],
  },
  {
    id: 'preserving-muscle',
    title: 'Protecting Your Muscle',
    subtitle: "Lean mass is easy to lose and worth defending. Here's how.",
    category: 'lifestyle',
    readingTime: 5,
    coverImage: require('@/assets/images/articles/preserving-muscle.png'),
    transparentArt: true,
    bgColor: '#D9F2E3',
    sections: [
      {
        heading: 'Why Muscle Is on the Line',
        body: 'When the body loses weight quickly, it doesn\'t only shed fat. Research consistently shows that without intentional effort, roughly 25–40% of weight lost during rapid reduction can come from lean mass: muscle, connective tissue, and bone density.\n\nGLP-1 medications can drive significant weight change, which makes this more relevant, not less. Muscle supports metabolic rate, joint stability, balance, and everyday strength, so protecting it is about long-term function, not just appearance.',
      },
      {
        heading: 'The Two Pillars',
        body: 'Two strategies have the strongest evidence behind them, and they work best together:\n\n- **Adequate protein**: Spreading 25–40g of protein across three to four eating occasions gives the body the raw material to maintain muscle. Distribution matters; the body can only use so much at once.\n\n- **Resistance training**: A 2025 systematic review found high-certainty evidence that adding resistance exercise during caloric restriction preserves lean mass and strength compared with diet alone. Bodyweight movements count, no gym required.',
      },
      {
        heading: 'Making It Sustainable',
        body: 'You don\'t need to overhaul your life. A realistic baseline:\n\n- **Two to three short resistance sessions a week**, hitting the major muscle groups. Even 10–15 minutes is a meaningful start.\n\n- **Protein at every meal**, prioritized first on the plate when appetite is low.\n\n- **Enough rest**: recovery is slightly impaired during caloric restriction, so one to two rest days a week supports better progress.\n\n- **Track non-scale wins**: strength gains and how clothes fit reveal the body composition changes the scale can hide.\n\nA qualified trainer or your healthcare provider can help tailor this to your fitness level and energy.',
      },
    ],
    sources: [
      'NIH/PMC: Resistance Training During Dietary Weight Loss (2025 Meta-Analysis)',
      'ACLM/ASN/OMA/TOS: 2025 Joint Advisory on Nutritional Priorities',
      'Mayo Clinic: Strength Training Guidelines',
    ],
  },
];

// ─── Section grouping (horizontal scroll rows on the Education tab) ────────────

export type ArticleRow = {
  /** Stable slug used for the "See All" route (/articles/section/[id]). */
  id: string;
  title: string;
  /** One-line description shown under the section title. */
  description: string;
  /** Section identity color. Cards whose article has transparentArt render their
   *  illustration over this color. Optional during the transition to transparent art. */
  bgColor?: string;
  articleIds: string[];
};

export const ARTICLE_SECTIONS: ArticleRow[] = [
  {
    id: 'essentials',
    title: 'The Essentials',
    description: 'Start here: how GLP-1 medications work and what your first weeks may feel like.',
    bgColor: '#F4F2FE',
    articleIds: [
      'how-glp1s-work',
      'managing-side-effects',
      'quieting-food-noise',
    ],
  },
  {
    id: 'food-nutrition',
    title: 'Food & Nutrition',
    description: 'Eat in a way that works with your medication, not against it.',
    bgColor: '#FDECEC',
    articleIds: [
      'protein-priority',
      'what-to-eat',
      'protein-on-low-appetite-days',
    ],
  },
  {
    id: 'hydration-comfort',
    title: 'Hydration & Comfort',
    description: 'Stay ahead of the most common bumps along the way.',
    articleIds: [
      'staying-hydrated',
      'electrolytes-explained',
      'managing-constipation',
    ],
  },
  {
    id: 'movement-body',
    title: 'Movement & Body',
    description: 'Protect muscle and keep moving as your body changes.',
    articleIds: [
      'exercise-on-glp1s',
      'walking-counts',
      'preserving-muscle',
    ],
  },
];

export function getArticleById(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}

/** Resolves the card/cover color for an article. Transparent-art articles take their
 *  parent section's identity color; legacy articles fall back to their own bgColor. */
export function getArticleColor(article: Article): string {
  if (article.transparentArt) {
    const section = ARTICLE_SECTIONS.find((s) => s.articleIds.includes(article.id));
    if (section?.bgColor) return section.bgColor;
  }
  return article.bgColor;
}

export function getSectionById(id: string): ArticleRow | undefined {
  return ARTICLE_SECTIONS.find((s) => s.id === id);
}
