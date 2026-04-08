-- ─── Guided Courses: courses, lessons, progress tracking ──────────────────────

CREATE TABLE courses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  subtitle          TEXT,
  icon_name         TEXT NOT NULL,
  icon_set          TEXT NOT NULL DEFAULT 'Ionicons',
  accent_color      TEXT NOT NULL DEFAULT '#FF742A',
  category          TEXT NOT NULL CHECK (category IN ('medical', 'nutrition', 'mental_health', 'lifestyle')),
  lesson_count      INT NOT NULL DEFAULT 0,
  estimated_minutes INT NOT NULL DEFAULT 0,
  sort_order        INT NOT NULL DEFAULT 0,
  phase_unlock      TEXT,  -- null = always available; matches EscalationPhaseName
  is_published      BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lessons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug              TEXT NOT NULL,
  title             TEXT NOT NULL,
  subtitle          TEXT,
  sort_order        INT NOT NULL DEFAULT 0,
  estimated_minutes INT NOT NULL DEFAULT 3,
  content_type      TEXT NOT NULL DEFAULT 'article',  -- article, checklist, exercise, breathing
  body_markdown     TEXT,
  content_json      JSONB,
  is_published      BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(course_id, slug)
);

CREATE TABLE lesson_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id     UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

CREATE INDEX idx_lesson_progress_user_course ON lesson_progress(user_id, course_id);

CREATE TABLE journal_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_type    TEXT NOT NULL DEFAULT 'freeform',
  prompt_id     TEXT,
  content_json  JSONB NOT NULL,
  mood_before   INT,
  mood_after    INT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_user ON journal_entries(user_id, logged_at DESC);

CREATE TABLE mindfulness_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_type     TEXT NOT NULL,
  duration_seconds INT NOT NULL,
  context          TEXT,
  logged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE mindfulness_sessions ENABLE ROW LEVEL SECURITY;

-- Courses and lessons: public read
CREATE POLICY "Courses are publicly readable" ON courses FOR SELECT USING (true);
CREATE POLICY "Lessons are publicly readable" ON lessons FOR SELECT USING (true);

-- User data: own rows only
CREATE POLICY "Users own lesson progress" ON lesson_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own journal entries" ON journal_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own mindfulness sessions" ON mindfulness_sessions FOR ALL USING (auth.uid() = user_id);

-- ─── Seed: 4 courses ─────────────────────────────────────────────────────────

INSERT INTO courses (slug, title, subtitle, icon_name, icon_set, category, lesson_count, estimated_minutes, sort_order, is_published) VALUES
('injection-mastery', 'Injection Mastery', 'Confident, comfortable injections from day one', 'colorize', 'MaterialIcons', 'medical', 5, 22, 1, true),
('side-effect-survival', 'Side Effect Survival Kit', 'Manage every common side effect like a pro', 'shield-outline', 'Ionicons', 'medical', 7, 28, 2, true),
('protein-muscle-defense', 'Protein & Muscle Defense', 'Protect your muscle mass while losing weight', 'restaurant', 'MaterialIcons', 'nutrition', 6, 24, 3, true),
('mind-and-body', 'Mind & Body', 'Navigate the emotional side of GLP-1 therapy', 'brain', 'MaterialCommunityIcons', 'mental_health', 8, 32, 4, true);

-- ─── Seed: Injection Mastery lessons (5) ─────────────────────────────────────

INSERT INTO lessons (course_id, slug, title, subtitle, sort_order, estimated_minutes, content_type, is_published, body_markdown) VALUES

((SELECT id FROM courses WHERE slug = 'injection-mastery'),
 'your-first-injection', 'Your First Injection', 'Step-by-step with pain management tips', 1, 5, 'article', true,
 '## Before You Start

Remove your pen from the refrigerator **30 minutes before** injecting. Cold medication is the single most common cause of unnecessary injection pain.

**What you''ll need:**
- Your GLP-1 pen (at room temperature)
- An alcohol swab
- Your sharps disposal container

## Step 1: Inspect the Medication

Look through the pen window. The medication should be **clear and colorless to pale yellow**. Do NOT use if cloudy, discolored, or contains particles.

## Step 2: Prime the Pen

Attach a new needle and dial to the flow-check dose (usually 2 units for semaglutide pens). Point up, press — you should see a drop at the needle tip. **Never skip this step** with a new pen or cartridge — air in the pen means a partial or empty first dose.

## Step 3: Clean Your Site

Swab the injection area with alcohol in a circular motion. **Let it air dry completely** (about 30 seconds). Injecting through wet alcohol drives it into the tissue — that''s what causes stinging, not the needle itself.

## Step 4: Inject

1. Pinch the skin lightly (especially on thighs or if lean)
2. Insert the needle at **90 degrees** — straight in, with a quick confident motion
3. Press the dose button and **hold for 6–10 seconds** until the counter shows 0
4. Wait 5 more seconds, then withdraw
5. **Do not rub the site** — rubbing causes bruising and can alter absorption

## Step 5: Dispose Safely

Place the used needle directly into your sharps container. Never recap. Never leave needles attached to the pen between uses.

## Pain Management Tips

- **Temperature is #1** — room-temp medication hurts dramatically less than cold
- **Confident insertion** — a quick, decisive motion hurts less than slow, hesitant insertion
- **Ice the site** 30–60 seconds before for additional numbing
- **Higher-gauge needles** (32G vs 30G) are thinner and less painful
- Most patients report injections become barely noticeable after 4–6 weeks'),

((SELECT id FROM courses WHERE slug = 'injection-mastery'),
 'rotation-map', 'The Rotation Map', 'Master injection site rotation to protect absorption', 2, 5, 'article', true,
 '## Why Rotation Matters

Injecting the same spot repeatedly causes **lipohypertrophy** — hardened fatty lumps under the skin. This isn''t just cosmetic: scar tissue can reduce medication absorption by up to 15%, meaning you''re getting less of your prescribed dose.

## Three Approved Sites

### Abdomen (Most Popular)
- Largest rotation area, most consistent fat depth
- Stay **2+ inches from the navel** in any direction
- Avoid the beltline and any scars
- Best absorption consistency of all three sites

### Upper Thighs
- Outer front surface, between hip and knee
- **Always pinch** — fat depth varies more than abdomen
- Avoid the inner thigh (more nerve endings, more pain)
- Good option when you want to alternate with abdomen weeks

### Upper Arms
- Back/outer area of the upper arm
- Thinnest fat layer — pinching is essential
- Usually needs a partner or mirror technique
- Some patients find this the least painful site

## The Clock Method

Divide your abdomen into **12 zones** arranged like a clock face around your navel:

- Positions 12, 1, 2, 3 (upper right quadrant)
- Positions 4, 5 (lower right)
- Positions 6, 7, 8 (lower left)
- Positions 9, 10, 11 (upper left)

Advance one position each injection. This gives you **12 weeks** before returning to the same spot — more than enough time for complete tissue recovery.

## Multi-Site Rotation

For even more spacing, alternate entire body regions:
- **Week A:** Right abdomen
- **Week B:** Left thigh
- **Week C:** Left abdomen
- **Week D:** Right thigh

## Track It

Use the injection log in TitraHealth to record your site each time. The app will remind you where you last injected and suggest the next rotation position.'),

((SELECT id FROM courses WHERE slug = 'injection-mastery'),
 'dose-escalation', 'Dose Escalation', 'What to expect at each step up', 3, 4, 'article', true,
 '## Why Doses Increase Gradually

GLP-1 medications start at a low dose and increase over weeks or months. This is called titration, and it serves two purposes:

1. **Reduces side effect severity** — your GI tract needs time to adapt to slower gastric emptying
2. **Finds your effective dose** — some patients respond well at lower doses; others need the maximum

Skipping steps or escalating faster than prescribed almost always increases side effects without improving outcomes.

## Semaglutide Escalation Schedule

**Ozempic (diabetes):** 0.25mg → 0.5mg → 1mg → 2mg
**Wegovy (obesity):** 0.25mg → 0.5mg → 1mg → 1.7mg → 2.4mg

Each step is typically **4 weeks**. Your prescriber may extend a step if side effects are significant.

## Tirzepatide Escalation Schedule

**Mounjaro / Zepbound:** 2.5mg → 5mg → 7.5mg → 10mg → 12.5mg → 15mg

Each step is typically **4 weeks**. Tirzepatide has more dose options, allowing finer adjustments.

## What to Expect After Each Increase

- **Days 1–3:** Side effects often peak (nausea, reduced appetite, fatigue)
- **Days 4–14:** Side effects begin to settle as your body adjusts
- **Weeks 2–4:** You reach a "new normal" at this dose level
- **Week 4+:** If side effects have resolved and weight loss has plateaued, your prescriber may recommend the next step

## When to Stay at Your Current Dose

Tell your prescriber if:
- You''re losing weight consistently at your current dose (no need to escalate)
- Side effects haven''t resolved by week 3–4 (stay until they do)
- You''re experiencing concerning symptoms (persistent vomiting, severe fatigue)

Slower titration is a valid medical strategy, not a failure.

## The Plateau-Escalation Decision

If weight loss stalls for 4+ weeks AND side effects are minimal, dose escalation is often the right next step. But always confirm with your prescriber — there are other factors (protein intake, activity level, sleep) worth optimizing first.'),

((SELECT id FROM courses WHERE slug = 'injection-mastery'),
 'troubleshooting', 'Troubleshooting', 'Fix common issues before they derail your treatment', 4, 4, 'article', true,
 '## Missed a Dose?

**The 5-day rule (semaglutide):** If less than 5 days late, take it as soon as you remember. If more than 5 days late, skip it and take your next scheduled dose.

**Tirzepatide:** If less than 4 days late, take it as soon as you remember. If more than 4 days, skip and resume your regular schedule.

**Never double dose** to make up for a missed injection.

## Pen Isn''t Working

**No click when pressing the button:**
- Check that a needle is properly attached
- Ensure the pen isn''t empty (check the dose counter window)
- Try a new needle — bent or clogged needles are common

**Dose counter didn''t reach 0:**
- You received a partial dose. Note how much you received
- Do NOT re-inject the remainder — contact your prescriber for guidance

**Medication leaking from the site after injection:**
- You likely removed the needle too quickly. Next time, hold for the full 10 seconds after the counter reaches 0
- A small drop at the surface is normal and doesn''t mean you lost significant medication

## Lipohypertrophy (Lumps at Injection Sites)

If you feel firm or rubbery lumps under the skin at previous injection sites:
- **Stop injecting in that area** immediately
- Switch to a different body region
- The lumps typically resolve over weeks to months
- Medication injected into lipohypertrophy is poorly absorbed — this may explain a perceived drop in effectiveness

## Bruising

Minor bruising is common and harmless. To reduce it:
- Don''t rub the site after injection
- Avoid aspirin/NSAIDs on injection day if possible
- Apply gentle pressure (not rubbing) for 30 seconds after withdrawal

## Medication Looks Different

If the solution has changed color, become cloudy, or contains particles — **do not use it**. Contact your pharmacy for a replacement. This may indicate the pen was exposed to extreme temperatures.'),

((SELECT id FROM courses WHERE slug = 'injection-mastery'),
 'travel-and-storage', 'Travel & Storage', 'Keep your routine on the go', 5, 4, 'article', true,
 '## Storage Rules

### Before First Use (Unopened)
- Refrigerate at **36–46°F (2–8°C)**
- **Never freeze** — frozen GLP-1 medication is destroyed and must be discarded
- Check expiration date on the box

### After First Use (In-Use Pen)
- **Room temperature** is fine — most pens can be kept at up to 86°F (30°C) for their use period
- **Semaglutide pens:** 56 days at room temp after first use
- **Tirzepatide pens:** 21 days at room temp after first use
- Keep the pen cap on when not in use to protect from light
- **Never store with a needle attached** — temperature changes cause medication to leak or air to enter

### Heat and Cold
- Do not leave in a car (temperatures can exceed 120°F)
- Do not place in direct sunlight
- Do not pack in checked luggage (cargo holds can reach freezing temperatures)

## Flying with GLP-1 Medication

**TSA allows injectable medications** in carry-on bags without size restrictions. Tips:
- Keep medication in original packaging with the pharmacy label
- Carry a copy of your prescription or a letter from your prescriber (rarely needed but good to have)
- You do NOT need to declare it at security, but you may if you prefer
- Needles are permitted when accompanied by injectable medication

## Travel Cooling

For trips where you''ll be away from refrigeration:
- **Insulated cooling cases** (like FRIO or MedAngel) keep pens at safe temperatures for 24–48 hours
- Avoid direct contact with ice packs — wrap the pen in a cloth barrier to prevent accidental freezing
- Hotel mini-fridges are fine, but avoid the freezer compartment and areas directly near the cooling element

## Time Zone Changes

If you cross time zones:
- **Weekly injections:** Shift your injection day to match your local schedule. A day early or late is fine
- **Daily oral (Rybelsus):** Take at your usual time in the new time zone. Consistency of the fasting window (30 min before food) matters more than exact clock time

## Emergency Planning

Always carry a backup plan:
- Keep your prescriber''s contact information accessible
- Know where a pharmacy is at your destination
- If traveling internationally, check whether your medication brand is available locally (names may differ by country)
- Consider bringing an extra pen if your trip is longer than your current pen''s supply');

-- ─── Seed: Side Effect Survival Kit lessons (7) ──────────────────────────────

INSERT INTO lessons (course_id, slug, title, subtitle, sort_order, estimated_minutes, content_type, is_published, body_markdown, content_json) VALUES

((SELECT id FROM courses WHERE slug = 'side-effect-survival'),
 'nausea-101', 'Nausea 101', 'Your first 4 weeks playbook', 1, 4, 'article', true,
 '## Why Nausea Happens

GLP-1 medications slow gastric emptying — food sits in your stomach longer than usual. When you eat too much or eat the wrong things, that delayed stomach creates fullness, pressure, and nausea signals.

This is worst in **weeks 1–4** and after **each dose increase**. For most patients, nausea resolves or becomes very manageable by week 6–8 at a stable dose.

## The Playbook

### Eating Strategy
- **Small, frequent meals** — 5–6 mini-meals instead of 3 large ones
- **Protein first, then vegetables, then carbs** — this order reduces nausea
- **Stop eating before you feel full** — on GLP-1, "satisfied" comes before "full," and "full" means nauseous
- **Eat slowly** — put the fork down between bites

### Foods That Help
- Plain crackers, dry toast, rice
- Greek yogurt (also high protein)
- Clear broth and soups
- Ginger tea, ginger chews, or ginger capsules (clinically proven)
- Peppermint tea
- Cold foods (less aromatic, less nausea-triggering than hot)

### Foods to Avoid (Especially Near Injection Day)
- Greasy, fried foods (fat slows emptying the most)
- Spicy foods
- Very sweet foods
- Large portions of anything
- Carbonated beverages (add gas to an already slow stomach)

### Timing Trick
**Inject before bedtime** — many patients find that sleeping through the peak nausea window (first 8–12 hours post-injection) dramatically reduces symptoms.

### When It''s Not Normal
Contact your prescriber if:
- You can''t keep **any fluids** down for 24+ hours
- You''re vomiting multiple times per day for several days
- You see blood in vomit
- You develop severe abdominal pain', NULL),

((SELECT id FROM courses WHERE slug = 'side-effect-survival'),
 'eating-when-nothing-sounds-good', 'Eating When Nothing Sounds Good', 'High-protein foods organized by what you can tolerate', 2, 4, 'checklist', true,
 '## When Appetite Is Gone But Nutrition Isn''t Optional

On GLP-1 therapy, there will be days when nothing sounds appealing. But skipping meals entirely — especially protein — accelerates muscle loss and can worsen fatigue and nausea (low blood sugar makes nausea worse).

The goal: **get protein in, even when appetite is minimal.**

## By Symptom

### When Nauseous
Pick cold, bland, protein-dense foods that don''t require cooking (less aroma):
- Greek yogurt (17–20g protein per cup)
- String cheese (7g per stick)
- Protein shake — blend with ice, sip slowly over 30+ minutes
- Cottage cheese (25g per cup)
- Cold deli turkey slices (8g per 2 oz)

### When Everything Tastes Wrong
GLP-1s can alter taste perception. Try:
- Different temperatures (cold vs hot versions of the same food)
- Adding lemon or lime (brightens flat flavors)
- Smoothies (texture change can help)
- Foods you didn''t eat before GLP-1 — your preferences may have shifted

### When Exhausted
Zero-prep, grab-and-go options:
- Pre-made protein shakes (Fairlife, Premier Protein — 30g protein)
- Hard-boiled eggs (prep a batch weekly)
- Nut butter packets + apple
- Jerky (10–15g per serving)
- Canned tuna/chicken pouches',
 '{"items": ["Greek yogurt (17-20g protein)", "Protein shake — sip slowly over 30 min", "Cottage cheese (25g protein/cup)", "String cheese sticks", "Hard-boiled eggs (prep weekly)", "Pre-made protein shakes (30g protein)", "Nut butter + apple", "Cold deli turkey slices", "Canned tuna/chicken pouches", "Jerky (10-15g/serving)"]}'),

((SELECT id FROM courses WHERE slug = 'side-effect-survival'),
 'gi-management', 'GI Management', 'Constipation, GERD, and bloating solutions', 3, 4, 'article', true,
 '## Constipation

Reported in 20–40% of patients. GLP-1s slow the entire GI tract, not just the stomach.

### Solutions (layer these)
1. **Fiber** — aim for 30–35g daily. Start with soluble fiber (oats, chia seeds, psyllium husk). Increase gradually to avoid gas.
2. **Hydration** — dehydrated stool is hard stool. Minimum 64oz water daily.
3. **Movement** — a 15-minute walk after meals accelerates GI transit significantly.
4. **Magnesium citrate** — 300–400mg at bedtime. Acts as a gentle osmotic laxative.
5. **MiraLAX** — safe for daily short-term use. Discuss with prescriber for long-term.

**Red flag:** No bowel movement for 5+ days with abdominal pain or distension — contact your doctor.

## GERD / Heartburn

Slower gastric emptying increases stomach pressure and acid exposure.

### Solutions
- Don''t eat within **3 hours of lying down**
- Elevate the head of your bed 6–8 inches
- Reduce coffee, alcohol, and carbonated beverages
- Eat smaller, more frequent meals
- **Famotidine (Pepcid)** before meals for immediate relief
- **Omeprazole (Prilosec)** 30 min before breakfast for ongoing symptoms

**Red flag:** Severe heartburn unresponsive to OTC treatment, or difficulty swallowing — seek medical evaluation.

## Bloating

The "GLP-1 bloat" is real and caused by delayed gastric emptying. It typically peaks in weeks 2–6 and improves as your body adjusts.

### What helps
- Smaller meals (the #1 factor)
- Avoid carbonation
- Peppermint tea after meals
- Gentle movement after eating
- Avoid chewing gum (swallowing air worsens bloating)', NULL),

((SELECT id FROM courses WHERE slug = 'side-effect-survival'),
 'hair-loss', 'Hair Loss', 'Why it happens, why it stops, and what helps', 4, 4, 'article', true,
 '## The Reality

Hair shedding on GLP-1 therapy is **real, common, and almost always temporary**. It''s called telogen effluvium — a stress response triggered by rapid weight loss, not by the medication directly.

## How It Works

Your hair has a growth cycle:
- **Anagen (growth):** 2–6 years — 85–90% of hairs are normally here
- **Catagen (transition):** 2–3 weeks
- **Telogen (resting/shedding):** 2–3 months

Rapid weight loss, caloric restriction, and nutritional stress push a large percentage of hairs from anagen into telogen simultaneously. **2–3 months later**, those hairs fall out at once.

This is why hair loss typically starts **2–4 months after beginning GLP-1 therapy** — it''s a delayed reaction to the initial rapid weight loss phase.

## Why It Stops

Telogen effluvium is self-limiting. Once your weight loss stabilizes and nutritional intake normalizes:
- Shedding slows over 2–4 months
- New growth begins from the same follicles
- Full recovery typically takes 6–12 months
- **Hair follicles are not damaged** — this is not permanent hair loss

## What Helps

### Nutritional Priorities
- **Protein** — inadequate protein directly worsens hair loss. Aim for your full target (1–1.5g/kg).
- **Iron** — get ferritin tested. If below 30 ng/mL, supplement with your doctor''s guidance.
- **Zinc** — 15–25mg daily (as picolinate or glycinate)
- **Biotin** — 2,500–5,000 mcg daily. Evidence is modest but risk is minimal.
- **Vitamin D** — deficiency worsens telogen effluvium

### What Doesn''t Help
- Expensive topical treatments (this is not pattern baldness — minoxidil won''t accelerate regrowth)
- Stopping GLP-1 therapy (the shedding has already been triggered; stopping won''t reverse it)
- Panic (stress worsens hair loss — ironic but true)

## When to See a Dermatologist
If shedding continues beyond 6 months at a stable weight, or if you notice patchy loss (rather than diffuse thinning), see a dermatologist to rule out other causes.', NULL),

((SELECT id FROM courses WHERE slug = 'side-effect-survival'),
 'energy-and-fatigue', 'Energy & Fatigue', 'Find and fix the real cause', 5, 4, 'article', true,
 '## Fatigue Is Multi-Factorial

Feeling tired on GLP-1 therapy? It''s rarely one cause — it''s usually a combination of factors that compound.

## The Most Common Causes

### 1. Insufficient Calories
Your appetite dropped dramatically, but your body still needs fuel. Many patients unknowingly eat under 1,000 calories — well below what''s needed for basic function.

**Fix:** Track your intake for 3 days. If consistently below 1,200 kcal, you need to eat more — even without hunger. Protein shakes are an efficient way to add calories and protein simultaneously.

### 2. Dehydration
GLP-1s can reduce thirst sensation. Dehydration causes fatigue, brain fog, headaches, and dizziness before you feel thirsty.

**Fix:** Set a timer to drink water every 60–90 minutes. Aim for 64+ oz daily. Add electrolytes if plain water doesn''t help.

### 3. Micronutrient Deficiency
- **B12 deficiency** → fatigue, weakness, brain fog
- **Iron deficiency** → fatigue, shortness of breath, cold intolerance
- **Vitamin D deficiency** → fatigue, mood changes, muscle weakness

**Fix:** Get blood work. The most impactful panel: ferritin, B12, vitamin D, and CBC.

### 4. Poor Sleep Quality
GLP-1 therapy can improve sleep apnea but may also cause restless nights during the adjustment period (nausea, acid reflux while lying down).

**Fix:** Elevate your bed head, don''t eat within 3 hours of bedtime, and maintain consistent sleep/wake times.

### 5. Muscle Loss
Less muscle = less energy capacity. If you haven''t started resistance training, fatigue may be partly a muscle mass issue.

**Fix:** Start the Protein & Muscle Defense course.

## The Fatigue Timeline

- **Weeks 1–4:** Fatigue is most common during initiation and dose increases
- **Weeks 4–8:** Energy usually improves as your body adapts
- **Beyond 8 weeks:** Persistent fatigue likely has a correctable cause (see above)

If fatigue is severe and persists beyond 8 weeks at a stable dose, discuss with your prescriber — it may warrant blood work or dose adjustment.', NULL),

((SELECT id FROM courses WHERE slug = 'side-effect-survival'),
 'food-aversions', 'Food Aversions', 'Adapting when tastes change overnight', 6, 3, 'article', true,
 '## The Taste Shift Is Real

Many GLP-1 users experience sudden, dramatic food aversions — foods you loved become repulsive, seemingly overnight. This is a known phenomenon tied to GLP-1''s effect on the brain''s reward circuitry.

## Common Patterns

Foods most likely to trigger aversions:
- **Highly processed foods** (chips, fast food, candy)
- **Very sweet foods** (many patients report sugar tastes "sickeningly sweet")
- **Greasy/fried foods** (often trigger nausea just from smell)
- **Red meat** (a commonly reported aversion)
- **Coffee** (taste or smell becomes unpleasant for some)

Foods that tend to become more appealing:
- Fresh fruits and vegetables
- Simple, whole foods
- Bland proteins (chicken, fish, eggs)
- Cold foods (less aromatic)

## Adapting Your Diet

### Embrace the Change
Food aversions on GLP-1 therapy often align with healthier eating patterns. Your brain is literally reducing the reward value of ultra-processed foods. Work with it, not against it.

### Find New Proteins
If your usual protein sources (like red meat) now repulse you, pivot:
- Greek yogurt, cottage cheese
- Chicken, turkey, fish
- Eggs in different preparations
- Plant proteins: edamame, lentils, tofu
- Protein shakes (experiment with flavors — vanilla often works better than chocolate on GLP-1)

### Experiment With Temperature
The same food served cold vs hot can trigger completely different reactions. A warm chicken breast may be unappealing while cold chicken salad is fine.

### Don''t Force It
Trying to push through a strong aversion usually backfires with nausea. Accept the change and find alternatives. Most aversions moderate over months as your body adjusts.

## When Aversions Become a Problem

If aversions are so severe that you can''t maintain adequate nutrition (especially protein), discuss with your prescriber. This may indicate the need for:
- A slower titration pace
- Temporary meal replacement strategies
- Dietitian referral for specialized meal planning', NULL),

((SELECT id FROM courses WHERE slug = 'side-effect-survival'),
 'red-flags', 'When to Call Your Doctor', 'Know the warning signs that need medical attention', 7, 3, 'checklist', true,
 '## Most Side Effects Are Manageable — But Some Need Urgent Attention

The vast majority of GLP-1 side effects are uncomfortable but not dangerous. However, certain symptoms require prompt medical evaluation.

## Call Your Doctor Immediately If You Experience:

### Severe Abdominal Pain
Persistent, intense abdominal pain — especially in the upper abdomen radiating to the back — could indicate pancreatitis. This is rare but serious.

### Jaundice
Yellowing of the skin or whites of the eyes could indicate gallbladder problems (gallstones are more common during rapid weight loss).

### Can''t Keep Fluids Down
If you cannot keep any fluids down for 24+ hours, you''re at risk for dehydration, electrolyte imbalance, and potentially thiamine (B1) deficiency.

### Severe Allergic Reaction
Difficulty breathing, swelling of face/tongue/throat, severe rash, rapid heartbeat. **Call 911 for anaphylaxis.**

### Signs of Hypoglycemia
Shaking, sweating, confusion, rapid heartbeat, dizziness — especially if you also take insulin or sulfonylureas. Eat fast-acting sugar immediately.

### Neck Lump or Difficulty Swallowing
A lump or swelling in the neck, hoarseness, or difficulty swallowing could indicate a thyroid issue. GLP-1 medications carry a boxed warning about thyroid C-cell tumors (observed in rodents; risk in humans is uncertain but monitored).

### Persistent Severe Vomiting
Vomiting multiple times daily for more than 2–3 days, or inability to take medications orally.

### Vision Changes
Sudden changes in vision, especially if you have diabetes, could indicate diabetic retinopathy changes.

### Kidney Pain
Flank pain with changes in urine output — dehydration from GLP-1 therapy can rarely contribute to kidney issues.

## For Emergencies
**Severe allergic reactions or difficulty breathing: Call 911.** Do not drive yourself.',
 '{"items": ["Severe or persistent abdominal pain", "Yellowing of skin or eyes (jaundice)", "Cannot keep fluids down for 24+ hours", "Swelling of face, tongue, or throat", "Shaking, confusion, rapid heartbeat (hypoglycemia)", "Neck lump or difficulty swallowing", "Vomiting multiple times daily for 2+ days", "Sudden vision changes", "Kidney/flank pain with reduced urine output"]}');

-- ─── Seed: Protein & Muscle Defense lessons (6) ──────────────────────────────

INSERT INTO lessons (course_id, slug, title, subtitle, sort_order, estimated_minutes, content_type, is_published, body_markdown) VALUES

((SELECT id FROM courses WHERE slug = 'protein-muscle-defense'),
 'why-muscle-loss-matters', 'Why Muscle Loss Matters', 'The 26-40% problem nobody talks about enough', 1, 4, 'article', true,
 '## The Hidden Cost of Rapid Weight Loss

The headlines celebrate dramatic weight loss on GLP-1 therapy. But body composition analysis tells a more nuanced story.

In the SURMOUNT-1 and STEP clinical trials, when researchers measured what patients actually lost:
- **25–40% of total weight lost was lean mass** (muscle + bone) in patients who didn''t exercise
- Patients who combined GLP-1 therapy with resistance training lost significantly more fat and preserved significantly more muscle

This means a person who loses 50 lbs without exercise may have lost 12–20 lbs of muscle. That''s not a rounding error — it''s a fundamental change to your body''s metabolic machinery.

## Why This Matters Long-Term

### Metabolic Rate
Every pound of muscle burns 6–10 calories per day at rest. Lose 15 lbs of muscle and your daily metabolic rate drops by 90–150 calories — permanently (unless you rebuild it). This makes weight regain more likely and weight maintenance harder.

### Functional Strength
Muscle loss reduces your ability to carry groceries, climb stairs, play with kids, and maintain independence as you age. Rapid muscle loss on GLP-1 therapy accelerates functional decline that normally takes decades.

### Bone Density
Rapid weight loss, especially with inadequate protein and calcium, reduces bone mineral density. Combined with muscle loss, this increases fracture risk — a serious concern for post-menopausal women.

### The Regain Trap
If you stop GLP-1 therapy and regain weight, you''re more likely to regain fat than muscle. The result: worse body composition than where you started ("skinny fat"). This is called the "fat overshooting" phenomenon.

## The Good News

This is **almost entirely preventable**. The combination of adequate protein (1–1.5g/kg) and regular resistance training (2–3x/week) preserves the vast majority of lean mass during GLP-1 therapy.

The next lessons in this course will show you exactly how.'),

((SELECT id FROM courses WHERE slug = 'protein-muscle-defense'),
 'protein-math', 'Protein Math', 'Your personalized target and how to hit it', 2, 4, 'article', true,
 '## Your Daily Target

The evidence-based protein target for people losing weight on GLP-1 therapy:

**1.0–1.5 grams per kilogram of body weight per day**

Or in simpler terms: **0.7–1.0 grams per pound of current body weight.**

For a 200 lb person: **140–200g protein daily.**
For a 160 lb person: **112–160g protein daily.**

For context, the average American eats 50–80g. You likely need to **double or triple** your current intake.

## Distribution Matters

Your body can only optimally use ~30–40g of protein for muscle synthesis per meal. Eating 100g at dinner and 20g at lunch is less effective than eating 40g at each of 3–4 meals.

**Optimal pattern:** 30–40g protein at each of 3–4 meals/snacks, spread evenly through the day.

## Top Protein Sources (Ranked by Protein-Per-Calorie)

| Food | Protein | Calories | Ratio |
|------|---------|----------|-------|
| Chicken breast (4 oz) | 31g | 130 | 24% |
| Greek yogurt (1 cup) | 17–20g | 100–130 | 15–17% |
| Cottage cheese (1 cup) | 25g | 180 | 14% |
| Canned tuna (3 oz) | 20g | 90 | 22% |
| Eggs (2 large) | 12g | 140 | 9% |
| Protein powder (1 scoop) | 20–25g | 100–130 | 18–20% |
| Edamame (1 cup) | 17g | 190 | 9% |
| Lentils (1 cup cooked) | 18g | 230 | 8% |

## The Protein-First Rule

At every meal, eat your protein source **before** anything else. When appetite is suppressed, you may only eat half your plate — make sure the protein half gets eaten first.

## When Appetite Is Minimal

High-protein, low-volume options for days when eating feels impossible:
- **Protein shake** (blend with ice, sip over 30 minutes) — 25–30g
- **Greek yogurt + scoop of protein powder** — 40g in one small bowl
- **Jerky** — portable, 10–15g per serving
- **Protein bar** — choose ones with 20g+ protein and <5g sugar

## Track Until It''s Automatic

Use the food logging feature in TitraHealth to track protein for at least 2–3 weeks. Most patients are shocked at how far below target they are. Once you internalize which foods deliver protein efficiently, tracking becomes less necessary.'),

((SELECT id FROM courses WHERE slug = 'protein-muscle-defense'),
 'meal-planning-low-appetite', 'Meal Planning on Low Appetite', 'Maximum nutrition in minimum volume', 3, 4, 'article', true,
 '## The Challenge

Your appetite is suppressed. Eating large meals is uncomfortable or impossible. But your body still needs 100–150g+ of protein, adequate calories, and micronutrients.

The solution: **nutrient-dense, small-volume, protein-first meals.**

## Breakfast Ideas (25–35g protein each)

**Protein smoothie bowl:**
1 scoop protein powder + 1 cup Greek yogurt + handful of berries. Blend thick, eat with a spoon. ~40g protein in a small bowl.

**Egg scramble:**
3 eggs + 1 oz cheese + handful spinach. Quick, 22g protein.

**Overnight protein oats:**
1/3 cup oats + 1 scoop protein powder + 1 cup milk, mixed the night before. ~30g protein ready to eat cold.

## Lunch Ideas (30–40g protein each)

**Chicken salad lettuce wraps:**
4 oz canned chicken + Greek yogurt (instead of mayo) + celery + lettuce wraps. 35g protein, very light feeling.

**Cottage cheese power bowl:**
1 cup cottage cheese + cucumber + tomato + everything bagel seasoning. 25g protein. Add a hard-boiled egg for 31g.

**Tuna packet + crackers:**
One tuna pouch (20g protein) + whole grain crackers. Easy, no cooking required.

## Dinner Ideas (30–40g protein each)

**Simple baked fish:**
5 oz salmon or white fish + roasted vegetables. 35g protein, easy to digest.

**Turkey meatballs:**
Prep a batch weekly. 4 oz ground turkey formed into small balls. Pairs with any sauce. 28g protein.

**Stir-fry (small portion):**
4 oz chicken or tofu + vegetables + minimal rice. Prioritize the protein portion.

## Snack Arsenal (10–20g protein each)

Keep these stocked and visible:
- String cheese (7g each — eat 2–3)
- Hard-boiled eggs (6g each)
- Protein bars (choose 20g+ protein)
- Greek yogurt cups
- Jerky pouches
- Protein shake (pre-made, keep in fridge)

## The Cardinal Rule

**Something is always better than nothing.** If you can only manage a protein shake today, that''s 25–30g of protein your muscles desperately need. Don''t let the perfect be the enemy of the good.'),

((SELECT id FROM courses WHERE slug = 'protein-muscle-defense'),
 'resistance-training-101', 'Resistance Training 101', 'Minimum effective dose for maximum muscle preservation', 4, 5, 'article', true,
 '## You Don''t Need a Gym

The goal of resistance training on GLP-1 therapy is **preservation**, not bodybuilding. The minimum effective dose is surprisingly achievable — even from home with minimal equipment.

## The Minimum: 2x Per Week

Research shows that **2 full-body resistance training sessions per week** provides the vast majority of muscle-preservation benefit during weight loss. This is not negotiable — it''s the single most impactful thing you can do alongside protein intake.

## The "Big 4" Movements

These four movement patterns work all major muscle groups:

### 1. Squat (Legs + Core)
**Beginner:** Sit-to-stand from a chair (use a chair until you build strength)
**Intermediate:** Bodyweight squat
**Advanced:** Goblet squat holding a dumbbell or filled water jug

3 sets of 10–12 repetitions. Rest 60–90 seconds between sets.

### 2. Push (Chest + Shoulders + Triceps)
**Beginner:** Wall push-up (standing, hands on wall)
**Intermediate:** Incline push-up (hands on counter or sturdy table)
**Advanced:** Floor push-up

3 sets of as many as you can do with good form. Rest 60–90 seconds.

### 3. Pull (Back + Biceps)
**Beginner:** Doorframe row (hold doorframe, lean back, pull yourself in)
**Intermediate:** Resistance band row
**Advanced:** Dumbbell row

3 sets of 10–12 repetitions per side.

### 4. Hip Hinge (Glutes + Hamstrings + Lower Back)
**Beginner:** Glute bridge (lie on back, push hips up)
**Intermediate:** Single-leg glute bridge
**Advanced:** Romanian deadlift with dumbbells

3 sets of 10–12 repetitions.

## A Complete Session

1. Warm up: 3–5 minutes of walking or marching in place
2. Squats: 3 × 10–12
3. Push-ups (your level): 3 × max reps
4. Rows (your level): 3 × 10–12 per side
5. Hip hinges (your level): 3 × 10–12
6. Cool down: 2–3 minutes of stretching

**Total time: 20–25 minutes.**

## Progression

Every 1–2 weeks, aim to either:
- Add 1–2 more reps per set, OR
- Move to the next difficulty level, OR
- Add a small amount of weight

Progressive overload (gradually increasing demand) is what signals your muscles to maintain and grow.

## On Nausea Days

If GI symptoms are rough, scale the intensity — don''t skip entirely:
- Reduce to 2 sets instead of 3
- Choose the easier progression level
- Focus on the hip hinge and squat (least likely to aggravate nausea)
- Even 10 minutes counts

**Consistency beats intensity.** A mediocre workout you do is infinitely better than a perfect workout you skip.'),

((SELECT id FROM courses WHERE slug = 'protein-muscle-defense'),
 'micronutrient-gaps', 'Micronutrient Gaps', 'What GLP-1s deplete and how to fill the gaps', 5, 4, 'article', true,
 '## The Hidden Cost of Eating Less

When you eat 30–50% less food, you get 30–50% fewer vitamins and minerals. Your body can''t manufacture most of these — they must come from food or supplements.

## Priority Nutrients

### Vitamin B12 (Critical)
**Risk:** B12 is found mainly in animal products. Reduced intake + GLP-1-altered gastric acid production impair absorption.
**Symptoms of deficiency:** Fatigue, numbness/tingling in hands/feet, brain fog, anemia
**Supplement:** 1,000 mcg methylcobalamin daily

### Vitamin D3 + K2 (High Priority)
**Risk:** 40%+ of Americans are already deficient. Weight loss releases stored vitamin D from fat tissue unpredictably.
**Symptoms:** Fatigue, mood changes, muscle weakness, poor bone health
**Supplement:** 2,000–5,000 IU D3 daily + 100 mcg K2 (MK-7)

### Iron (Test First)
**Risk:** Especially critical for menstruating women. Reduced food intake dramatically increases deficiency risk.
**Symptoms:** Fatigue, weakness, cold intolerance, hair loss, shortness of breath
**Action:** Get ferritin tested. Only supplement if below 30 ng/mL. Excess iron is harmful.

### Zinc (Important)
**Risk:** Zinc is depleted during rapid weight loss and directly contributes to hair loss and immune dysfunction.
**Supplement:** 15–25 mg zinc picolinate or glycinate daily, with food. Add 1–2 mg copper if taking zinc long-term.

### Magnesium (Dual Benefit)
**Risk:** Most people are already mildly deficient. Magnesium supports 300+ enzymatic reactions.
**Bonus:** Magnesium citrate form also helps with GLP-1-induced constipation.
**Supplement:** 300–400 mg magnesium glycinate or citrate at bedtime.

## The Starter Stack

A practical daily supplement routine:
1. **Morning with food:** Multivitamin + B12 + D3/K2 + Zinc
2. **Bedtime:** Magnesium
3. **If indicated by blood work:** Iron (take separately from other supplements)

## When to Get Blood Work

Request a panel at:
- Before starting GLP-1 therapy (baseline)
- 3 months after starting
- Every 6 months thereafter

Key tests: Ferritin, B12, Vitamin D (25-OH), CBC, Comprehensive Metabolic Panel.

## The Thiamine Warning

Patients with prolonged vomiting or severe caloric restriction are at risk for thiamine (B1) deficiency, which can cause **Wernicke''s encephalopathy** — a neurological emergency with confusion, vision problems, and difficulty walking. If you''ve been vomiting frequently for more than 2 weeks, tell your prescriber immediately.'),

((SELECT id FROM courses WHERE slug = 'protein-muscle-defense'),
 'hydration', 'Hydration When You''re Not Thirsty', 'Why GLP-1s make you forget to drink — and how to fix it', 6, 3, 'article', true,
 '## The Thirst Problem

GLP-1 medications can reduce your thirst sensation. You may not feel thirsty even when you''re significantly dehydrated. This is dangerous because dehydration:
- Worsens nausea and fatigue
- Causes constipation
- Impairs kidney function
- Reduces exercise performance
- Causes headaches and brain fog

## Your Daily Target

**Minimum: 64 oz (about 2 liters) per day.**
**Optimal: 0.5–0.6 oz per pound of body weight.** For a 180 lb person, that''s 90–108 oz (~3 liters).

## Timer-Based Drinking Strategy

Since you can''t rely on thirst, use a system:
- **Set a phone timer** for every 60–90 minutes
- Drink 8–12 oz at each timer
- Use a marked water bottle to visualize progress
- Front-load hydration in the morning (drink 16 oz within 30 minutes of waking)

## What Counts

- Water (still or sparkling)
- Herbal tea
- Broth
- Infused water (cucumber, lemon, berries)

## What Doesn''t Help

- Coffee and caffeinated tea (mild diuretic — count only half)
- Alcohol (net dehydrating)
- Sugary drinks (counterproductive to GLP-1 therapy goals)

## Electrolytes

Plain water isn''t always enough, especially if you''re eating less. Signs you need electrolytes:
- Muscle cramps
- Dizziness when standing
- Headaches despite adequate water intake
- Heart palpitations

Options: electrolyte packets (LMNT, Liquid IV), a pinch of salt in water, coconut water, or sugar-free sports drinks.

## Signs of Dehydration

Watch for:
- Dark yellow urine (should be pale straw-colored)
- Dry mouth or cracked lips
- Headache
- Fatigue
- Dizziness

**If symptoms persist despite increased fluids, contact your prescriber** — dehydration can be more serious on GLP-1 therapy due to reduced food and fluid intake.');

-- ─── Seed: Mind & Body lessons (8) ───────────────────────────────────────────

INSERT INTO lessons (course_id, slug, title, subtitle, sort_order, estimated_minutes, content_type, is_published, body_markdown, content_json) VALUES

((SELECT id FROM courses WHERE slug = 'mind-and-body'),
 'food-noise', 'Food Noise', 'Understanding your cognitive reset', 1, 4, 'article', true,
 '## What Is Food Noise?

Most people on GLP-1 therapy describe something unexpected: the constant mental chatter about food simply... quiets.

The background thoughts — *"What should I eat?"*, *"I want something sweet"*, *"I shouldn''t have that but I really want it"* — become muted or disappear entirely.

Patients often describe it as the single most transformative aspect of GLP-1 therapy — more life-changing than the weight loss itself.

## The Neuroscience

This is not placebo. A 2025 study published in PMC showed that GLP-1 receptor agonists modulate the **Default Mode Network (DMN)** and reward circuits in the brain — the same pathways affected by mindfulness meditation.

GLP-1 receptors in the brain''s reward circuitry (nucleus accumbens, ventral tegmental area) directly reduce the **dopamine-driven reward value** of highly palatable foods. Foods that previously triggered compulsive desire lose their neurological "pull."

The prefrontal cortex (decision-making) also receives GLP-1 signaling, improving impulse control — eating becomes a **deliberate choice** rather than a compulsive reaction.

## The Window of Opportunity

Here''s what most people miss: food noise reduction is a **window**, not a cure.

The 6–12 months of quiet are an opportunity to:
1. Rebuild your relationship with food on rational terms
2. Establish habits that don''t depend on willpower
3. Address the emotional patterns that food noise was masking
4. Develop new coping mechanisms for stress and emotions

Patients who use this window intentionally — working with therapists, building new habits, doing the emotional work — have **significantly better long-term outcomes** than those who simply enjoy the quiet without building new foundations.

## What the Quiet May Reveal

When food noise fades, other things get louder:
- Emotions you were eating to avoid
- Boredom you were filling with food
- Social patterns built entirely around eating
- Anxiety, sadness, or loneliness that food was numbing

This can be disorienting. It''s also an enormous opportunity for growth. The next lessons in this course will help you navigate each of these.', NULL),

((SELECT id FROM courses WHERE slug = 'mind-and-body'),
 'grief-and-food', 'Grief & Food', 'Mourning your old relationship with eating', 2, 4, 'exercise', true,
 '## This Grief Is Real

Many patients experience genuine grief when their relationship with food changes. This isn''t weakness — it''s a natural response to losing something that provided real comfort, connection, and joy.

## What You Might Be Grieving

- **Nightly ice cream with your partner** — that wasn''t just food, it was intimacy
- **Happy hour with coworkers** — that wasn''t just drinking, it was belonging
- **Mom''s cooking on Sunday** — that wasn''t just a meal, it was love and identity
- **The comfort of eating after a hard day** — that wasn''t just calories, it was self-soothing

When GLP-1 therapy removes the desire for these foods, it can feel like losing the experiences they represented — even though the experiences themselves are still available.

## Why This Matters

If you don''t acknowledge food grief, it tends to emerge as:
- Resentment toward the medication
- Sabotaging your progress to "get back to normal"
- Depression or emptiness that seems to come from nowhere
- Conflict with partners or friends who don''t understand

## A Path Forward

### 1. Name It
Simply naming "I am grieving my old relationship with food" is powerful. It validates your experience and removes the shame of feeling sad about something others might dismiss.

### 2. Separate the Food from the Experience
The ice cream wasn''t the intimacy — the partner was. Happy hour wasn''t the alcohol — the connection was. Can you build new rituals that preserve the experience without depending on the food?

### 3. Allow Yourself to Miss It
You don''t have to be grateful for every change. It''s okay to miss things. Grief and progress can coexist.

### 4. Build New Rituals
What new sources of comfort, connection, and joy can you explore? This is the work of the "Finding New Joy" lesson later in this course.

## Guided Reflection

Take a few minutes to journal on this prompt:

> **What food-related experience do you miss most? What was that experience really giving you — and how might you get that same thing in a new way?**

Write freely. There are no wrong answers.',
 '{"journalPrompt": "What food-related experience do you miss most? What was that experience really giving you — and how might you get that same thing in a new way?", "promptTheme": "food_relationship"}'),

((SELECT id FROM courses WHERE slug = 'mind-and-body'),
 'identity-shift', 'The Identity Shift', 'Who am I without food thoughts?', 3, 4, 'exercise', true,
 '## The Unexpected Question

When food noise quiets and your body changes rapidly, many patients encounter an identity crisis they didn''t anticipate:

*"My self-talk hasn''t improved — I still feel like the same person in a different body."*

*"I don''t know how to eat when I''m not hungry. Eating was such a big part of who I was."*

*"People treat me differently now, and I don''t know how to handle it."*

These experiences are common, well-documented, and worth taking seriously.

## The Gap Between Inside and Outside

Weight loss changes how the world sees you. But it doesn''t automatically change:
- How you see yourself
- Your internal narrative about your worth
- Your coping mechanisms
- Your deeply held beliefs about your body

Psychologists call this the **"lag effect"** — external changes outpace internal adaptation. Your body may be 50 lbs lighter, but your self-image, habits, and emotional patterns were built over years or decades.

## Common Identity Challenges

### "Phantom Fat"
Many patients report still *feeling* large despite objective weight loss — reaching for larger clothes, being surprised by mirrors, avoiding tight spaces that would easily fit their new body. Your brain''s body map updates slowly.

### Attention You Didn''t Ask For
Compliments can feel complicated. "You look great!" can land as: *"So I looked terrible before?"* Increased romantic or social attention can feel disorienting or unwanted.

### Loss of an Armor
For some, a larger body served a protective function — deflecting attention, maintaining boundaries, keeping certain people at a distance. Losing that "armor" can feel vulnerable.

## Thought Record Exercise

Identify a negative self-belief that hasn''t changed despite your progress. Use this CBT format:

**Automatic Thought:** *(What''s the critical voice saying?)*
**Evidence For:** *(What supports this thought?)*
**Evidence Against:** *(What contradicts it?)*
**Balanced Thought:** *(A more accurate, compassionate version)*

Example:
- **Thought:** "I''m only losing weight because of a drug — I have no discipline."
- **Evidence For:** "I tried and failed diets before."
- **Evidence Against:** "I show up every day: logging food, exercising, managing side effects. That IS discipline."
- **Balanced:** "I''m using a medical tool AND applying real effort. Both are true."',
 '{"thoughtRecordTemplate": {"automaticThought": "I''m only losing weight because of a drug — I have no discipline.", "evidenceFor": "", "evidenceAgainst": "", "balancedThought": ""}, "commonThoughts": ["I''m taking the easy way out", "People will judge me if they find out", "I don''t deserve to feel this good", "My body doesn''t match how I feel inside", "What if I regain all the weight?"]}'),

((SELECT id FROM courses WHERE slug = 'mind-and-body'),
 'body-image', 'Body Image', 'When your brain hasn''t caught up', 4, 4, 'breathing', true,
 '## The Mirror Problem

Rapid weight loss creates a unique body image challenge: your reflection changes faster than your brain''s internal body map can update.

Many patients report:
- Not recognizing themselves in photos
- Reaching for clothes several sizes too large
- Being surprised when they fit into smaller spaces
- Feeling "fake" in their new body
- Avoiding mirrors entirely

This isn''t vanity — it''s a well-documented neurological phenomenon.

## Why Your Brain Lags

Your brain maintains a **body schema** — an internal map of your body''s size, shape, and boundaries. This schema is built from years of sensory feedback and updates slowly.

After rapid weight loss, the schema and reality are mismatched. Your brain literally has not caught up with your body. This creates cognitive dissonance that can feel deeply unsettling.

## Body Appreciation vs. Body Satisfaction

Research shows that **body appreciation** (gratitude for what your body does) is a stronger predictor of well-being than body satisfaction (liking how you look).

The shift:
- From: *"I''ll be happy when my body looks like X"*
- To: *"My body carried me through today, managed medications, healed from my last injection, and got me here"*

This isn''t toxic positivity — it''s a genuine reorientation toward function over form.

## Body Scan Meditation

This 3-minute practice helps reconnect your brain''s body schema with reality:

1. **Sit comfortably.** Close your eyes.
2. **Bring attention to your feet.** Notice the sensations — weight, temperature, contact with the floor. These are your feet, in this body, right now.
3. **Move up through your legs.** Notice your calves, knees, thighs. Don''t judge — just notice.
4. **Notice your core.** Breathe into your belly. Feel it expand and contract.
5. **Move through your arms, shoulders, neck.** Notice without evaluation.
6. **Rest at the top of your head.** Take three slow breaths.

The goal is not to love every part of your body. The goal is to **inhabit it** — to close the gap between your internal map and your actual body.

## Daily Practice

Try this body scan once daily for a week — ideally in the morning before the day''s judgments and comparisons begin. Even 2 minutes makes a measurable difference in body schema updating.',
 '{"breathingPhases": [{"instruction": "Sit comfortably and close your eyes", "durationSec": 10}, {"instruction": "Bring attention to your feet — notice weight, temperature, contact", "durationSec": 20}, {"instruction": "Move up through your legs — calves, knees, thighs", "durationSec": 20}, {"instruction": "Notice your core — breathe into your belly", "durationSec": 20, "breathPattern": "4-4"}, {"instruction": "Move through your arms, shoulders, neck", "durationSec": 20}, {"instruction": "Rest at the top of your head — three slow breaths", "durationSec": 20, "breathPattern": "4-4"}, {"instruction": "Gently open your eyes", "durationSec": 10}]}'),

((SELECT id FROM courses WHERE slug = 'mind-and-body'),
 'stigma', 'The Stigma Game', 'Handling judgment from both sides', 5, 4, 'article', true,
 '## The Dual Stigma

GLP-1 users face judgment from two directions simultaneously:

**From people who think it''s cheating:** *"That''s the easy way out."* *"Why can''t you just eat less and exercise?"* Research by psychologist A. Janet Tomiyama found that people who lost weight via GLP-1 medications were **evaluated more negatively** than those who lost weight via diet and exercise — driven by the belief that medication is a "shortcut."

**From people who judge weight loss itself:** *"You were fine before."* *"You''re buying into diet culture."* GLP-1 medications have the potential to increase weight stigma — shaming people for both taking the perceived "easy way out" AND for not taking it.

## Why It Hurts

Stigma hits differently because:
- It invalidates real effort (managing side effects, changing habits, showing up daily)
- It reduces a complex medical decision to a moral judgment
- It isolates — many users don''t discuss GLP-1 use openly, creating loneliness
- It can trigger shame, which undermines the very behavioral changes the medication enables

## Scripts for Common Conversations

### "Isn''t that the easy way out?"
*"There''s nothing easy about managing daily side effects, restructuring my diet, and showing up for exercise while nauseous. I''m using a medical tool AND doing the work."*

### "You were fine before."
*"This was a medical decision between me and my doctor, based on health factors that aren''t visible."*

### "What happens when you stop?"
*"I''m building sustainable habits while the medication gives me the bandwidth to do so. And that''s a conversation I have with my prescriber, not the internet."*

### When you don''t want to disclose at all:
*"I''ve been working on my health."* (Complete. No elaboration needed.)

## Setting Boundaries

You are **not obligated** to:
- Disclose your medication to anyone
- Justify your medical decisions
- Educate people about GLP-1 therapy
- Accept unsolicited opinions about your body

## The Inner Stigma

Often the harshest judgment comes from yourself. If you catch yourself thinking *"I''m cheating"* or *"I should be able to do this without help"*:

Would you say the same to someone taking blood pressure medication? Insulin? Antidepressants? GLP-1 medications treat a chronic metabolic condition. Using them is not a character flaw.', NULL),

((SELECT id FROM courses WHERE slug = 'mind-and-body'),
 'relationship-changes', 'Relationship Changes', 'Navigating how others treat you differently', 6, 4, 'article', true,
 '## The Social Shift

Weight loss changes how the world interacts with you. This can be:
- Flattering and affirming
- Deeply uncomfortable
- Confusing
- All three at once

Understanding what''s happening helps you navigate it with less emotional whiplash.

## Common Patterns

### Increased Attention
People may be friendlier, more attentive, or more interested in you socially and romantically. This can feel validating — but also raise painful questions: *"Where were you when I was heavier?"*

### Workplace Changes
Research consistently shows that thinner people receive more favorable treatment in professional settings. You may notice subtle shifts: more invitations, more credibility, more opportunities. This is real, documented weight bias — and recognizing it doesn''t mean you''re imagining things.

### Family Dynamics
Family members may:
- Express pride in ways that feel backhanded (*"You finally did it!"*)
- Feel threatened if your weight loss shifts family dynamics
- Project their own body insecurities onto your journey
- Offer constant unsolicited dietary advice

### Intimate Relationships
GLP-1 therapy can affect relationships through:
- **Body changes** affecting physical intimacy and self-consciousness
- **Emotional flattening** — some patients report reduced emotional intensity (the same dopamine-dampening that quiets food noise can affect other pleasures)
- **Shifted social patterns** — if your relationship was built around shared food experiences, those rituals may need reinvention
- **Partner insecurity** — your changes may trigger your partner''s own body image concerns

## How to Navigate

### Name the Change
Discuss the dynamic shift openly with trusted people. *"I''ve noticed people treat me differently since losing weight, and it brings up complicated feelings."*

### Protect Your Inner Circle
The people who loved you before GLP-1 therapy are the ones who matter. Prioritize those relationships. New attention from people who only value your appearance is informative — but not necessarily meaningful.

### Give Yourself Permission to Feel Complicated
You can simultaneously appreciate compliments AND feel angry that you weren''t treated this well before. Both feelings are valid. You don''t have to choose.

### Communicate with Your Partner
If GLP-1 therapy is affecting your relationship, honest conversation is essential. Topics worth discussing: changes in appetite for food and intimacy, emotional changes, evolving social dynamics, fears about the future.', NULL),

((SELECT id FROM courses WHERE slug = 'mind-and-body'),
 'regain-fear', 'The Regain Fear', 'Building confidence in maintenance', 7, 4, 'article', true,
 '## The Fear That Follows Progress

Almost every GLP-1 patient carries a background anxiety:

*"What if this stops working?"*
*"What happens when I stop the medication?"*
*"Will I regain everything?"*

This fear is understandable — and the data is honest.

## What the Data Shows

- **50% of GLP-1 users** prescribed for obesity stop the medication within 1 year (JAMA Network Open)
- Among those who stop, approximately **60% of lost weight is regained within 18 months**
- Cardiometabolic improvements (blood pressure, lipids, blood sugar) also partially reverse

This is not personal failure. GLP-1 medications treat a chronic biological condition. Stopping treatment allows the underlying biology to reassert itself — just as stopping blood pressure medication allows blood pressure to rise.

## Reframing: Chronic Management, Not a Course of Treatment

The single most important mindset shift: **obesity is a chronic disease, and GLP-1 therapy is ongoing management** — not a temporary fix.

This means:
- Long-term or indefinite treatment is medically appropriate for many patients
- Stopping is a decision to make collaboratively with your prescriber, not a goal
- "Success" is not reaching a weight and stopping medication — it''s sustained health

## What Actually Protects You

Whether you continue medication long-term or eventually stop, these factors make the biggest difference:

### 1. Muscle Mass
Every pound of muscle you built during treatment maintains your metabolic rate. This is why resistance training is so critical — it''s literally building your metabolic safety net.

### 2. Behavioral Habits
Protein-first eating, regular meal patterns, hydration habits, exercise routines — these don''t evaporate when medication stops. They become your behavioral infrastructure.

### 3. Self-Awareness
Understanding your hunger signals, emotional eating triggers, and food noise patterns gives you tools to respond consciously rather than reactively.

### 4. Lower Maintenance Doses
Some patients can maintain results on lower doses than needed for active weight loss. Discuss step-down protocols with your prescriber.

## Acting on Fear vs. Planning from Wisdom

Fear says: *"I better enjoy this while it lasts because it''ll all come back."*
Wisdom says: *"I''m using this window to build the strongest possible foundation — regardless of what happens with medication."*

The work you do now — the habits, the muscle, the emotional growth — is yours to keep, no matter what.', NULL),

((SELECT id FROM courses WHERE slug = 'mind-and-body'),
 'finding-new-joy', 'Finding New Joy', 'Replacing food-based pleasure with lasting fulfillment', 8, 4, 'exercise', true,
 '## The Pleasure Gap

When food noise quiets and eating becomes functional rather than recreational, many patients discover a void:

*"Food used to be my reward after a hard day. What do I do now?"*
*"I used to look forward to meals. Now they feel like a chore."*
*"What do I do with all this mental space that food used to fill?"*

This isn''t emptiness — it''s an invitation to discover (or rediscover) sources of joy that food was substituting for.

## The Neuroscience of Pleasure

GLP-1 medications reduce the dopamine reward from food. But dopamine is not a single-purpose neurotransmitter — it responds to many sources of reward:

- **Movement and exercise** — especially the post-workout "glow"
- **Social connection** — deep conversations, laughter, physical touch
- **Creative expression** — music, art, writing, cooking (yes, even cooking)
- **Nature** — sunlight, fresh air, green spaces
- **Learning** — the satisfaction of understanding something new
- **Accomplishment** — completing a project, reaching a goal
- **Helping others** — volunteering, mentoring, supporting someone

The key insight: food may have been your *primary* dopamine source. Now it''s time to build a diversified portfolio.

## Building Your Joy Inventory

### Step 1: Audit Your Pleasure Sources
Before GLP-1 therapy, how much of your daily pleasure came from food? 50%? 80%? There''s no judgment — food is genuinely pleasurable and has been a primary human joy since the beginning of our species.

### Step 2: Explore Broadly
Try new activities without pressure to love them immediately. Some ideas organized by dopamine pathway:

**Physical:** Walking in nature, swimming, dancing, yoga, gardening
**Social:** Game nights, book clubs, volunteering, coffee dates (you can still enjoy coffee)
**Creative:** Drawing, journaling, photography, cooking new recipes (food can still be creative even if appetite is reduced)
**Learning:** Podcasts, online courses, new languages, puzzles
**Sensory:** Aromatherapy, music, warm baths, massage

### Step 3: Schedule Joy
Don''t wait for joy to find you. Put pleasurable activities in your calendar with the same intentionality you give to protein tracking and exercise.

## Guided Reflection

> **Make a list of 10 things — not involving food — that bring you genuine pleasure or satisfaction. Circle the three you haven''t done in the past month. Schedule one this week.**

This isn''t about replacing food with willpower. It''s about expanding your capacity for joy beyond a single source.',
 '{"journalPrompt": "Make a list of 10 things — not involving food — that bring you genuine pleasure or satisfaction. Circle the three you haven''t done in the past month. Schedule one this week.", "promptTheme": "identity"}');
