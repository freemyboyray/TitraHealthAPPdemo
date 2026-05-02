-- ─── Articles table ────────────────────────────────────────────────────────────
-- Stores educational articles displayed in the Education screen.
-- body_markdown is rendered by the article detail screen.

CREATE TABLE IF NOT EXISTS articles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  subtitle              TEXT,
  category              TEXT NOT NULL CHECK (category IN ('nutrition', 'medication', 'lifestyle', 'mindset', 'exercise')),
  body_markdown         TEXT NOT NULL,
  reading_time_minutes  INT NOT NULL DEFAULT 3,
  published_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  phase_focus           TEXT,  -- optional: 'initiation' | 'titration' | 'maintenance' | null (all phases)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public read access; no auth required for article content
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Articles are publicly readable"
  ON articles FOR SELECT
  USING (true);

-- ─── Seed: 10 evidence-based articles ─────────────────────────────────────────

INSERT INTO articles (id, title, subtitle, category, reading_time_minutes, phase_focus, published_at, body_markdown) VALUES

(
  gen_random_uuid(),
  'Why Protein Is Your Most Important Macro on GLP-1 Therapy',
  'How to protect muscle mass while losing weight rapidly',
  'nutrition',
  5,
  NULL,
  '2026-03-10 00:00:00+00',
  '## Why Protein Matters More Than Anything Else

GLP-1 medications are among the most powerful appetite suppressants available — and that creates a problem most patients don''t anticipate.

When your appetite drops by 40–60%, you eat less of everything. That includes protein. And without adequate protein, your body doesn''t just lose fat during rapid weight loss — it breaks down muscle tissue too.

Research from the SURMOUNT-1 trial found that without specific intervention, 25–40% of weight lost on GLP-1 therapy can be lean mass (muscle and bone), not fat. That''s a serious concern.

## The Consequences of Muscle Loss

Losing muscle mass:
- Slows your metabolic rate (making future weight management harder)
- Reduces strength and physical function
- Increases risk of falls and fractures, especially as you age
- Makes rebound weight gain more likely if you stop medication

## How Much Protein Do You Actually Need?

The evidence-based target for people losing weight rapidly: **0.7–1.0 grams per pound of body weight per day** (1.6–2.2g/kg).

For a 200 lb person, that''s 140–200g of protein daily. For context, a typical American diet provides 50–80g.

## Hitting Your Target: Practical Strategies

**Priority foods:**
- Greek yogurt (17–20g per cup)
- Cottage cheese (25g per cup)
- Chicken breast (31g per 4 oz)
- Canned tuna or salmon (25g per can)
- Eggs (6g per egg; 3-egg omelet = 18g)
- Edamame (17g per cup)
- Protein powder (20–25g per scoop)

**The "protein first" rule:** At every meal, eat your protein source before anything else. This ensures you hit your target even when appetite is low.

**Spread it out:** Aim for 30–40g protein per meal across 3–4 meals. The body can only optimally use ~30–40g of protein for muscle synthesis per sitting.

## The Bottom Line

On GLP-1 therapy, protein intake is not optional — it''s the single most important nutritional factor for preserving the muscle you''ve spent years building. Track it daily until hitting your target becomes automatic.'
),

(
  gen_random_uuid(),
  'The Complete Injection Technique Guide',
  'Step-by-step instructions for confident, comfortable injections',
  'medication',
  6,
  'initiation',
  '2026-03-11 00:00:00+00',
  '## Before You Start: What You''ll Need

- Your GLP-1 pen (at room temperature — see below)
- An alcohol swab
- A clean, well-lit surface
- Your sharps disposal container

## Step 1: Temperature Matters

Remove your pen from the refrigerator **30 minutes before** injecting. Cold medication causes more discomfort and can affect absorption.

Never use a pen that has been frozen — frozen GLP-1 medication is denatured and ineffective. If your pen was accidentally frozen, discard it.

## Step 2: Inspect the Medication

Look through the medication window. It should be:
- **Clear or slightly yellow** (normal)
- **Colorless to pale yellow** (normal)

Do NOT use the pen if the medication is:
- Cloudy or discolored
- Contains particles or lumps
- Has changed since last use

## Step 3: Choose Your Injection Site

Three approved sites, all subcutaneous (under the skin, not into muscle):

**Abdomen:** The easiest site for most people. Inject at least 2 inches away from your navel in any direction. Avoid the beltline area. The abdomen has the most predictable absorption.

**Upper thigh:** Outer front of the thigh, midway between hip and knee. Easier to reach than the abdomen for some.

**Upper arm:** Outer area, middle third of the upper arm. Usually requires assistance or a mirror injection technique.

**Site rotation is mandatory.** Injecting the same spot repeatedly causes lipohypertrophy — hardened fatty lumps that can significantly reduce medication absorption.

## Step 4: Clean and Dry

Wipe the site with an alcohol swab using a circular motion. Let it **air dry completely** (30 seconds). Injecting through wet skin drives alcohol into the tissue, which stings and can irritate.

## Step 5: The Injection

1. Pinch the skin lightly if you are lean (not necessary for most people)
2. Insert the needle at a **90° angle** — straight in, not at an angle
3. Press and hold the injection button until the dose counter shows 0, then continue holding for a few more seconds before removing (the exact hold time varies by pen — follow your specific medication''s instructions for use)
4. **Do not rub the site** after removing — rubbing can cause bruising and alter absorption

## Step 6: Disposal

Place the used needle directly into your sharps disposal container. Never recap needles. Never dispose of needles in regular trash.

## Common Mistakes to Avoid

- **Injecting into scar tissue or lumps** — always inspect before injecting
- **Skipping the prime/flow check** on a new pen (semaglutide) — you may get a partial or empty first dose
- **Rushing the button press** — holding the button until the dose counter reaches 0 and then keeping the needle in place is not optional; releasing too quickly means you may not get the full dose
- **Storing the in-use pen in the fridge** — most pens can and should stay at room temperature during their use period (check your pen''s prescribing information for the exact room-temperature window)

## Tracking Your Sites

A simple system: mentally divide your abdomen into 8 zones (4 on each side). Move clockwise each week. Keep an injection log in the app — noting the site prevents accidental repeat injection.'
),

(
  gen_random_uuid(),
  'Understanding the GLP-1 Weight Loss Plateau',
  'Why weight loss slows — and what actually works',
  'medication',
  5,
  NULL,
  '2026-03-12 00:00:00+00',
  '## Every Patient Hits a Plateau — Here''s Why

Almost everyone on GLP-1 therapy experiences a period where weight loss slows dramatically or stops entirely, typically at 6–12 months of treatment. This is not a sign that the medication stopped working.

It is biology.

## Adaptive Thermogenesis: Your Body''s Defense System

When you lose weight, your body fights back. This is called adaptive thermogenesis — your metabolic rate drops by more than can be explained by the reduction in body mass alone.

Research shows that after significant weight loss, resting energy expenditure can be 15–20% lower than predicted for your new body size. This means you now burn fewer calories at rest than someone who was always your current weight.

GLP-1 medications can partially counteract this through mechanisms beyond appetite suppression (they improve insulin sensitivity, reduce inflammation, and have direct metabolic effects), but they cannot fully override the body''s weight-defense systems.

## What''s Actually Happening at a Plateau

1. **Caloric equilibrium:** As you lose weight, you need fewer calories to maintain that smaller body. The deficit that once produced 1–2 lbs/week of loss no longer creates the same deficit.

2. **Metabolic adaptation:** Your body has downregulated its energy expenditure in response to reduced intake.

3. **Hormonal changes:** Leptin (satiety hormone) falls with weight loss, increasing hunger signals — even on GLP-1 therapy.

4. **Behavioral drift:** After months of reduced appetite, some patients gradually increase portion sizes or food quality without realizing it.

## What Actually Helps Break a Plateau

**Recalibrate protein first.** As you lose weight, your protein target should be recalculated based on your current weight — not your starting weight. Many patients are unknowingly under-eating protein months into treatment.

**Add or intensify resistance training.** Muscle is metabolically active tissue. Every pound of muscle added burns an additional 6–10 calories per day at rest. Over time, this significantly shifts the equation.

**Re-evaluate caloric intake honestly.** Appetite suppression can drift. A few days of accurate food logging often reveals a gradual creep in intake. Track for 5–7 days with full accuracy.

**Sleep quality.** Even one night of poor sleep reduces metabolic rate and increases cortisol, which promotes fat storage. At the plateau phase, sleep hygiene becomes disproportionately impactful.

**Discuss dose with your prescriber.** If you''re not at maximum dose, a medically supervised escalation may re-establish weight loss momentum. This is a valid and well-supported clinical approach.

## What Does NOT Help

- Dramatically cutting calories below 1,200 kcal (accelerates muscle loss and further reduces metabolic rate)
- Adding excessive cardio without resistance training (can worsen muscle loss)
- Taking a "drug holiday" (almost always triggers rapid regain)

## Reframing the Plateau

The plateau is often a signal that your lifestyle infrastructure needs updating — not that the medication has failed. The patients who navigate it best treat it as an optimization opportunity, not a defeat.'
),

(
  gen_random_uuid(),
  'Vitamins and Supplements on GLP-1 Therapy',
  'Which micronutrients matter, and why deficiency is almost inevitable without supplementation',
  'nutrition',
  5,
  NULL,
  '2026-03-13 00:00:00+00',
  '## The Hidden Cost of Eating Less

GLP-1 medications are remarkably effective at reducing caloric intake — often by 30–50%. But food is not just calories. It is also the delivery mechanism for vitamins, minerals, and micronutrients that your body cannot produce on its own.

When you eat 40% less food for months, micronutrient intake drops proportionally. The consequences are often subtle at first: fatigue, hair shedding, brittle nails, poor wound healing, brain fog. Left unaddressed, deficiencies can cause serious health problems.

## Priority 1: Vitamin B12

**Why it matters:** B12 is essential for nerve function, red blood cell production, and cognitive health. Deficiency causes peripheral neuropathy (tingling/numbness), fatigue, anemia, and in severe cases, irreversible nerve damage.

**The risk:** B12 is found almost exclusively in animal products. Reduced food intake combined with GLP-1-induced changes in gastric acid (needed for B12 absorption) creates a significant deficiency risk.

**Recommendation:** 1,000 mcg methylcobalamin daily, or 2,500 mcg sublingual B12 three times per week.

## Priority 2: Vitamin D3 + K2

**Why it matters:** Vitamin D regulates calcium absorption, immune function, and mood. Deficiency is already endemic in the general population (>40% of Americans are deficient). Weight loss accelerates depletion from adipose tissue.

**Recommendation:** 2,000–5,000 IU D3 daily with K2 (100–200 mcg MK-7) to direct calcium into bones rather than soft tissue.

## Priority 3: Iron

**The risk:** Particularly for women, iron deficiency is the most common nutritional deficiency worldwide and worsens significantly during rapid weight loss. Symptoms: fatigue, weakness, shortness of breath, hair loss, cold intolerance.

**Recommendation:** Get a ferritin level tested before supplementing — excess iron is harmful. If ferritin is below 30 ng/mL, discuss iron supplementation with your doctor.

## Priority 4: Zinc

**Why it matters:** Zinc is critical for immune function, wound healing, taste perception, and hair growth. It is frequently depleted during rapid weight loss.

**Connection to hair loss:** Zinc deficiency is a direct contributor to telogen effluvium. In studies, zinc supplementation reduced GLP-1-associated hair shedding severity.

**Recommendation:** 15–25 mg zinc (as picolinate or glycinate for best absorption) daily with food. Note: zinc competes with copper absorption; supplement copper (1–2 mg) if taking zinc long-term.

## Priority 5: Magnesium

**Why it matters:** Magnesium is involved in 300+ enzymatic reactions, including muscle function, sleep quality, and constipation relief. Most people are already mildly deficient.

**Recommendation:** 300–400 mg magnesium glycinate or citrate at bedtime. Citrate has the added benefit of softening stool (helpful for GLP-1-induced constipation).

## What About a Multivitamin?

A high-quality multivitamin covers many bases but typically provides inadequate amounts of B12, D3, and magnesium. Use it as a foundation, not a complete solution.

## The Critical Warning: Thiamine (B1)

Patients with very rapid weight loss combined with persistent vomiting are at risk for thiamine (B1) deficiency, which can cause Wernicke''s encephalopathy — a serious neurological emergency. Symptoms: confusion, difficulty walking, abnormal eye movements.

If you have experienced frequent vomiting or have been severely restricting intake for more than 2–3 weeks, discuss thiamine supplementation with your prescriber immediately.

## A Simple Supplementation Starter Stack

- Multivitamin (with minerals) — daily
- B12 (methylcobalamin 1,000 mcg) — daily
- Vitamin D3 (2,000–5,000 IU) + K2 (100 mcg) — daily
- Magnesium glycinate (300–400 mg) — bedtime
- Zinc picolinate (15–25 mg) — with food
- Iron: only if deficiency confirmed by blood test

Always discuss your supplement plan with your healthcare provider, especially if you take prescription medications.'
),

(
  gen_random_uuid(),
  'The Science of Food Noise — and Why GLP-1 Silences It',
  'Understanding the neurological mechanism behind reduced food obsession',
  'mindset',
  4,
  NULL,
  '2026-03-14 00:00:00+00',
  '## What Is Food Noise?

Most people on GLP-1 therapy describe a phenomenon they weren''t expecting: the mental chatter about food simply... quiets.

The constant background thoughts — "What should I eat for lunch?", "I want something sweet", "I shouldn''t have that but I really want it" — become muted or disappear entirely. Patients often describe it as one of the most surprising and transformative aspects of GLP-1 therapy.

This is not placebo. It is neuroscience.

## The Neuroscience Behind It

GLP-1 receptors are not only in the gut and pancreas. They are heavily expressed throughout the brain, particularly in the:

**Hypothalamus:** The brain''s primary hunger and satiety control center. GLP-1 activation here reduces appetite signals and increases satiety.

**Nucleus accumbens and ventral tegmental area:** These are the brain''s reward circuitry — the same pathways involved in cravings, addiction, and dopamine-driven behavior. GLP-1 receptor activation in these areas directly reduces the reward value of highly palatable foods (sugar, fat, ultra-processed foods).

**Prefrontal cortex:** Involved in decision-making and impulse control. GLP-1 signaling here may improve the ability to make deliberate food choices rather than acting on impulse.

The result: foods that previously triggered compulsive eating behavior lose their neurological "pull." Many patients describe looking at previously irresistible foods and feeling genuinely indifferent — not white-knuckling willpower, but actual lack of desire.

## What This Means for Your Relationship With Food

For many patients, food noise reduction creates an unexpected psychological space. Eating can shift from an emotionally driven behavior to a functional one. Some patients find this liberating. Others find it disorienting — especially if food has long been a primary comfort or coping mechanism.

Common experiences worth knowing:
- Social eating may feel different; food-centered social events can feel less compelling
- Emotional eating urges may persist even when physical hunger is absent — GLP-1 reduces appetite drive but doesn''t automatically resolve emotional patterns
- The reduced food noise may reveal the underlying emotional needs that food was previously masking

## The Addiction Connection

Emerging research suggests GLP-1 receptors are involved in addictive behavior more broadly. Multiple studies show GLP-1 therapy reduces:
- Alcohol cravings and consumption
- Tobacco cravings and smoking behavior
- Gambling and other compulsive behaviors in animal models

This is not coincidental — it reflects the fact that GLP-1 modulates dopamine reward circuits that underlie all addictive behavior, not just food.

## Using This Window Intentionally

The food noise reduction window is an opportunity, not just a relief. Patients who use it to:
- Actively rebuild their relationship with food (eating for hunger and nutrition, not emotion)
- Work with a therapist to address underlying emotional eating patterns
- Establish new food habits that don''t depend on willpower

...tend to have significantly better long-term outcomes than those who simply enjoy the quieter mind without doing the underlying behavioral work.'
),

(
  gen_random_uuid(),
  'Muscle Preservation: The Most Overlooked Priority in GLP-1 Therapy',
  'Why resistance training is non-negotiable — and how to start',
  'exercise',
  6,
  NULL,
  '2026-03-15 00:00:00+00',
  '## The Problem Nobody Talks About Enough

The headlines about GLP-1 medications focus on dramatic weight loss. What gets far less attention: a significant portion of that weight can be muscle, bone density, and lean tissue — not just fat.

In the SURMOUNT and STEP clinical trials, when body composition was analyzed:
- Patients who didn''t exercise lost approximately 25–40% of their total weight as lean mass
- Patients who combined GLP-1 therapy with resistance training preserved significantly more muscle — and lost more fat proportionally

This distinction matters enormously for long-term health, metabolic rate, physical function, and how you feel in your body.

## Why GLP-1 Therapy Creates Muscle Loss Risk

Three mechanisms converge:

1. **Caloric deficit:** To lose weight, you''re consuming less energy. But muscle protein synthesis requires both amino acids (protein) and sufficient energy. Deep deficits impair both.

2. **Appetite suppression reduces protein intake:** Protein is the most satiating macronutrient. When appetite drops, protein intake often falls disproportionately.

3. **Reduced physical activity:** Some patients, especially in the nausea-heavy initiation phase, reduce activity levels. This accelerates muscle atrophy.

## The Solution: Resistance Training

Resistance training (also called strength training or weight lifting) provides a direct anabolic stimulus that counteracts the muscle loss driven by caloric restriction.

When you perform resistance exercise, your muscles receive a signal to maintain and build mass — a signal powerful enough to partially offset the catabolic effects of rapid weight loss.

**Evidence:** A 2024 study comparing GLP-1 + resistance training vs. GLP-1 alone showed the exercise group preserved 85% more lean mass over 16 weeks, despite similar total weight loss.

## How Much Exercise Do You Need?

**Minimum effective dose:** 2 resistance training sessions per week, 20–30 minutes each, targeting all major muscle groups.

**Optimal:** 3 sessions per week + daily walking (7,000–10,000 steps).

You do not need a gym membership. Bodyweight exercises — squats, push-ups, rows (using a resistance band or countertop), lunges, hip hinges — are highly effective.

## Practical Starting Routine for GLP-1 Patients

**The "Big 4" movements (can be done at home):**

1. **Squat** (bodyweight → goblet squat with a dumbbell or filled water jug) — 3 sets of 10–12
2. **Hip hinge / Romanian deadlift** (with dumbbells or a resistance band) — 3 sets of 10–12
3. **Push-up** (wall → incline → full) — 3 sets of max reps
4. **Row** (resistance band or dumbbell) — 3 sets of 10–12

Rest 60–90 seconds between sets. Increase resistance or reps every 1–2 weeks.

## What If You''re Too Nauseous to Exercise?

In the early initiation phase, exercise tolerance varies. Even 10–15 minutes of light walking after meals has measurable benefits. Light resistance work (stretching, bodyweight movements) can be done even on lower-energy days.

The goal is to keep the habit alive — intensity can be scaled dramatically; what matters is consistency.

## Protein + Training: The Combination That Changes Everything

Neither protein nor exercise alone is as effective as the combination. When protein intake is high (0.7–1g/lb) AND resistance training stimulus is present, muscle protein synthesis significantly outpaces muscle protein breakdown — even during a caloric deficit.

This is the formula: **GLP-1 therapy + adequate protein + resistance training = fat loss that preserves the body composition you want.**'
),

(
  gen_random_uuid(),
  'Alcohol and GLP-1 Medications: What You Need to Know',
  'Why your alcohol tolerance changes — and the safety risks to understand',
  'lifestyle',
  4,
  NULL,
  '2026-03-16 00:00:00+00',
  '## Why GLP-1 Changes Your Relationship with Alcohol

One of the more surprising experiences on GLP-1 therapy: alcohol hits much harder, much faster.

Patients who previously drank 2–3 drinks with no significant effect find themselves impaired after a single drink. This is not psychological — it''s pharmacology.

## The Mechanism

GLP-1 medications slow gastric emptying — food and liquids pass from your stomach to your small intestine more slowly than usual. This dramatically changes alcohol absorption kinetics:

**Normal gastric emptying:** Alcohol enters the small intestine quickly, is absorbed into the bloodstream, and the liver processes it at a predictable rate.

**On GLP-1 therapy:** Alcohol sits in the stomach longer, then releases into the small intestine in a more concentrated bolus. Blood alcohol concentration (BAC) rises faster than expected, peaks higher, and the curve is less predictable.

The practical result: one drink on GLP-1 can feel like two or three.

## The Safety Implications

This isn''t merely about feeling tipsy faster. The risks:

**Hypoglycemia risk:** Alcohol inhibits gluconeogenesis (your liver''s ability to produce glucose). GLP-1 medications already improve insulin sensitivity. The combination, especially without food, can produce dangerous blood sugar drops — particularly if you also take insulin or sulfonylureas.

**Aspiration risk:** GLP-1-induced gastroparesis combined with alcohol increases the risk of vomiting and aspiration (inhaling vomit) — particularly during sleep. This is rare but serious.

**Nutritional interaction:** Alcohol is nutrient-poor and calorie-dense (7 kcal/g). It also impairs protein synthesis, disrupts sleep quality, and increases cortisol — directly counteracting your GLP-1 therapy goals.

## Practical Guidance

If you choose to drink while on GLP-1 therapy:

1. **Always eat before drinking** — never drink on an empty stomach
2. **Start with half your usual amount** and assess your response before continuing
3. **Drink slowly** — slower intake gives your body more time to process
4. **Alternate with water** — alcohol dehydrates; GLP-1 already impairs thirst sensation
5. **Avoid drinking near bedtime** — the aspiration risk is higher while lying down
6. **Never drink to the point of heavy intoxication** — your body''s response is fundamentally less predictable than it was before starting GLP-1 therapy

## The Unexpected Benefit

Interestingly, many patients on GLP-1 therapy report significantly reduced alcohol cravings. This is consistent with the research showing GLP-1 receptor activation in the brain''s reward circuitry reduces the perceived reward value of alcohol — the same mechanism that reduces food cravings.

Some patients find GLP-1 therapy naturally leads them to drink less, without effort. This appears to be a genuine pharmacological effect, not willpower.'
),

(
  gen_random_uuid(),
  'What Happens When You Stop GLP-1 Therapy',
  'The evidence on weight regain, and how to build a long-term strategy',
  'medication',
  5,
  'maintenance',
  '2026-03-17 00:00:00+00',
  '## The Honest Answer About Stopping

The most important thing to understand about GLP-1 therapy is that it treats the biology of obesity — but it does not cure it.

When you stop taking GLP-1 medication, the physiological effects reverse: gastric emptying returns to normal, appetite signals re-emerge, and the brain''s suppressed reward response to food gradually returns.

The clinical data is unambiguous.

## What the Trials Show

The STEP 1 Extension trial (semaglutide 2.4mg) followed patients for one year after stopping medication. The results:

- Average weight regain: **two-thirds of lost weight within 12 months**
- Cardiometabolic improvements (blood pressure, lipids, blood sugar) largely reversed
- Waist circumference returned toward baseline

The SURMOUNT-4 trial (tirzepatide) showed similar patterns: patients who stopped regained significant weight rapidly while those who continued lost more.

This is not a personal failure. It is the expected biological response to removing a medication that was correcting a chronic metabolic condition.

## Why the Weight Returns

Your body has a defended set point — a weight range your brain''s hypothalamus actively tries to maintain. GLP-1 medications work by shifting the signals that maintain that set point. When the medication stops, those signals reassert themselves.

Additionally:
- Ghrelin (hunger hormone) rebounds after stopping
- Leptin sensitivity (satiety signaling) may be partially reduced after weight loss
- Gastric emptying normalizes, reducing the satiating effect of meals

## What Protects You If You Have to Stop

**Lifestyle infrastructure built during treatment** is the single best predictor of long-term outcomes after stopping:

1. **Muscle mass preserved through resistance training** — every pound of muscle you built during treatment helps maintain metabolic rate after stopping
2. **Behavioral habits** — protein-first eating, regular meal patterns, portion awareness — don''t evaporate when the medication stops
3. **Starting body weight** — patients who lost more weight have more buffer; those who stopped early have less

**Lower maintenance doses:** Some patients can maintain results on lower doses than they used to lose weight. Discuss with your prescriber whether a step-down rather than stop is appropriate.

## Planning Your Long-Term Strategy

The best time to think about what happens when you stop is *before* you need to stop. Discuss with your prescriber:

- Is long-term therapy appropriate for you?
- What does a responsible step-down protocol look like?
- How will you monitor for regain?
- What triggers would prompt restarting?

GLP-1 therapy is most effective as a chronic disease management tool — not a short-term intervention. The patients with the best long-term outcomes treat it accordingly.'
),

(
  gen_random_uuid(),
  'Managing GI Side Effects: Nausea, Constipation, and GERD',
  'Evidence-based strategies to reduce the most common side effects without stopping therapy',
  'medication',
  6,
  'initiation',
  '2026-03-18 00:00:00+00',
  '## Understanding Why GI Side Effects Happen

GLP-1 medications produce GI side effects because GLP-1 receptors are densely distributed throughout the gastrointestinal tract. Activation slows gastric emptying (food leaving the stomach), reduces gut motility (movement through the intestines), and affects the enteric nervous system.

These are not random side effects — they are a direct consequence of how the medication works. Understanding the mechanism helps you manage them more intelligently.

## Nausea: The Most Common, Most Manageable

**When it''s worst:** Weeks 1–8, and for 2–3 days after each dose increase. Peak nausea typically occurs on injection day and the following day.

**Why it happens:** Food sitting in the stomach longer than normal creates fullness, distension, and nausea signals.

**Strategies that work:**

*Eating adjustments:*
- Eat very small portions — overfilling a stomach that empties slowly is the primary nausea trigger
- Eat slowly (put the fork down between bites)
- Avoid lying down for 2–3 hours after eating
- Avoid high-fat foods near injection day (fat slows emptying the most)
- Avoid spicy foods on injection day
- Cold or room-temperature foods cause less nausea than hot foods for many patients

*Foods that help:*
- Plain crackers, dry toast, plain rice, clear broth
- Ginger (tea, chews, or capsules) has clinical evidence for nausea reduction
- Peppermint tea
- Cold water sipped slowly

*Medical options:*
- Ondansetron (Zofran) — prescription anti-nausea, very effective, discuss with your doctor
- Vitamin B6 (25mg three times daily) — has evidence for pregnancy nausea and may help

**Red flag:** Nausea with severe vomiting that prevents keeping any fluids down for 24+ hours requires medical evaluation. Dehydration can develop quickly.

## Constipation: The Underreported Problem

Constipation is reported in 20–40% of patients but is likely underreported because patients don''t always connect it to their medication. GLP-1 slows the entire GI tract — not just the stomach.

**Strategies that work:**

*Fiber:* Aim for 30–35g daily. Soluble fiber (oats, beans, apples, chia seeds, psyllium husk) is particularly effective. Insoluble fiber (whole grains, vegetables) adds bulk. Increase fiber gradually to avoid gas.

*Hydration:* Constipation is dramatically worsened by inadequate hydration. The stool in a dehydrated bowel becomes hard and difficult to pass. Increase water to at least 64 oz daily, more if possible.

*Movement:* Even a 15-minute walk after meals accelerates GI transit significantly.

*Supplements:*
- Magnesium citrate (300–400mg at bedtime) — effective osmotic laxative that draws water into the bowel
- MiraLAX (polyethylene glycol) — safe, gentle, can be used daily short-term

**Red flag:** No bowel movement for 5+ days with abdominal pain or distension — contact your doctor.

## GERD and Heartburn

Acid reflux worsens for some patients because gastric emptying delay increases stomach pressure and acid exposure to the lower esophageal sphincter.

**Strategies:**
- Do not eat within 3 hours of lying down
- Elevate the head of your bed 6–8 inches
- Avoid large meals; prefer frequent small portions
- Reduce coffee, alcohol, and carbonated beverages
- OTC options: famotidine (Pepcid) before meals, omeprazole (Prilosec) 30 minutes before breakfast

**Red flag:** Severe heartburn unresponsive to OTC medications, or difficulty swallowing — these warrant prompt medical evaluation. Severe gastroparesis (food not leaving the stomach for many hours) is rare but serious.

## The Most Important Principle

GI side effects are the #1 reason patients discontinue GLP-1 therapy unnecessarily. In most cases, they can be managed and resolve significantly as dose escalation slows and your GI tract adapts.

If side effects are severe, the first intervention is usually slowing the titration pace — not stopping the medication. Discuss this option with your prescriber before discontinuing.'
),

(
  gen_random_uuid(),
  'GLP-1 Therapy and Cardiovascular Health: Beyond Weight Loss',
  'The direct heart benefits that go beyond pounds lost',
  'medication',
  4,
  NULL,
  '2026-03-18 00:00:00+00',
  '## More Than a Weight Loss Drug

GLP-1 medications were originally developed for type 2 diabetes management — and in that context, researchers made a remarkable discovery: these medications dramatically reduced major cardiovascular events, independent of their effects on blood sugar or body weight.

## The SELECT Trial: A Landmark Finding

In 2023, the SELECT trial enrolled 17,604 patients with established cardiovascular disease but without diabetes, and randomized them to semaglutide 2.4mg (Wegovy) or placebo.

The results after 3+ years of follow-up:
- **20% reduction** in major adverse cardiovascular events (MACE) — heart attack, stroke, or cardiovascular death
- This benefit was observed even in patients who lost minimal weight
- The effect was present within months of starting treatment

This was the first large-scale trial to demonstrate cardiovascular benefit from a weight loss medication in a non-diabetic population.

## SURPASS-CVOT: Tirzepatide''s Evidence

The SURPASS-CVOT trial for tirzepatide showed similar cardiovascular benefits in patients with type 2 diabetes. Tirzepatide cardiovascular outcome data in the obesity-without-diabetes population is still accumulating, but early data is consistent with semaglutide''s profile.

## The Mechanisms Behind Cardiovascular Benefit

Why do GLP-1 medications reduce cardiovascular events beyond weight loss? Multiple mechanisms are being studied:

**Direct cardiac effects:** GLP-1 receptors are present in the heart muscle. GLP-1 agonism appears to have cardioprotective effects, including improved cardiac function and reduced cardiac inflammation.

**Reduced inflammation:** Chronic low-grade inflammation is a major driver of atherosclerosis (plaque buildup in arteries). GLP-1 therapy significantly reduces inflammatory markers (CRP, IL-6), independent of weight loss.

**Blood pressure reduction:** GLP-1 therapy consistently reduces systolic blood pressure by 4–6 mmHg — a meaningful reduction that is only partially explained by weight loss.

**Improved lipid profile:** Triglycerides fall substantially (often 20–30%), HDL cholesterol improves, and LDL particle size shifts favorably.

**Reduced visceral adiposity:** Even with modest total weight loss, GLP-1 therapy preferentially reduces visceral (abdominal) fat — the metabolically active fat that drives cardiovascular risk.

## What This Means for You

If you have cardiovascular risk factors — hypertension, elevated triglycerides, family history of heart disease, previous cardiac event, or metabolic syndrome — GLP-1 therapy may be providing significant cardiovascular protection beyond any weight you''re losing.

Discuss your cardiovascular risk profile with your prescriber. The decision about long-term GLP-1 therapy is not just about weight — for many patients, the cardiovascular risk reduction justifies continued treatment independent of scale progress.'
);
