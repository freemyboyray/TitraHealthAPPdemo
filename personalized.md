# TitraHealth — Personalized Plan System

> Research-backed framework for generating individualized GLP-1 plans. This document defines the
> data model, plan generation logic, behavioral pillars, and integration surfaces.
> Last updated: 2026-03-09

---

## Overview

The personalized plan is the backbone of TitraHealth. It is not a static document generated once at
onboarding — it is a living, adaptive context that updates daily, responds to logged behaviors,
wearable data, medication phase, and side effects. It powers:

- **Daily focus cards** (top 3 priorities, ranked by phase-weighted deficit)
- **Weekly program summaries** (habit streaks, trend deltas, weekly focus shift)
- **AI chat context** (system prompt injection for every LLM call)
- **Insights tabs** (Medication / Lifestyle / Progress — all driven by personalized targets)
- **Weight projections** (individualized trajectory based on medication, dose, and early response)
- **Coaching articles** (phase-matched daily reading schedule)
- **Smart notifications** (adaptive reminders tied to deficit patterns)

The goal is that every user feels the app was built specifically for them. A 52-year-old woman on
Wegovy 1.0mg with constipation and low activity sees a completely different plan than a 34-year-old
man on Zepbound 10mg with high activity and nausea. Both plans are grounded in the same clinical
evidence but expressed in language and priorities unique to each person.

---

## Part 1: Data Inputs

### 1.1 Onboarding Profile (Static — Collected Once)

| Field | Type | Use in Plan |
|---|---|---|
| `glp1Type` | semaglutide / tirzepatide / liraglutide | Dose escalation schedule, weight projection model, protein multiplier |
| `medicationBrand` | Wegovy / Ozempic / Zepbound / Mounjaro / etc. | Display language, dosage schedule reference |
| `doseMg` | number | Escalation phase determination, protein/hydration targets |
| `injectionFrequencyDays` | number (7 default) | Injection cycle phase calculation |
| `lastInjectionDate` | ISO date | Current cycle day → phase (shot/peak/balance/reset) |
| `sex` | male / female / other | Protein targets, plateau timing (females plateau later → more total loss) |
| `age` | number | Plateau timing (younger → later plateau), hormonal context |
| `heightCm` | number | BMI calculation |
| `startWeightLbs` | number | Baseline for projection, % change tracking |
| `weightLbs` | number | Current weight → protein target (per kg), hydration target |
| `goalWeightLbs` | number | Projection endpoint, milestone calculation |
| `targetWeeklyLossLbs` | number (0.2–3.0) | Pacing, caloric guidance |
| `activityLevel` | sedentary / light / active / very_active | Step target, resistance training urgency |
| `cravingDays` | string[] | Pre-injection craving pattern alerts |
| `sideEffects` (onboarding) | string[] | Fiber/hydration adjustments, early coaching content |
| `startDate` | ISO date | Program week calculation, escalation phase estimation |

### 1.2 Ongoing Logged Data (Dynamic — Updates Daily)

| Source | Data Points | Frequency |
|---|---|---|
| `weight_logs` | weight_lbs, notes | Daily (ideally morning) |
| `food_logs` | calories, protein_g, carbs_g, fat_g, fiber_g, meal_type, source | Per meal |
| `injection_logs` | dose_mg, injection_date, site, medication_name, batch_number | Per injection |
| `activity_logs` | exercise_type, duration_min, steps, active_calories, intensity | Per session |
| `side_effect_logs` | effect_type, severity (1–10), phase_at_log | As experienced |
| `chat_messages` | AI conversation history | Per session |

### 1.3 Wearable / HealthKit Data (Dynamic — Pulled Each Session)

| Metric | Identifier | Plan Use |
|---|---|---|
| Steps | HKQuantityTypeIdentifierStepCount | Activity score, step target progress |
| HRV (SDNN) | HKQuantityTypeIdentifierHeartRateVariability | Recovery score (with GLP-1 offset) |
| Resting HR | HKQuantityTypeIdentifierRestingHeartRate | Recovery score (with GLP-1 offset) |
| Sleep hours | HKCategoryTypeIdentifierSleepAnalysis | Sleep score, leptin/ghrelin context |
| Blood glucose | HKQuantityTypeIdentifierBloodGlucose | T2D tracking, meal impact visibility |
| SpO₂ | HKQuantityTypeIdentifierOxygenSaturation | Sleep apnea outcome tracking |
| Respiratory rate | HKQuantityTypeIdentifierRespiratoryRate | Recovery score supplemental |
| Active calories | HKQuantityTypeIdentifierActiveEnergyBurned | Caloric context |

### 1.4 Derived / Computed Signals (No User Input Required)

| Signal | Derivation | Use |
|---|---|---|
| `injectionCycleDay` | today − lastInjectionDate | Determines phase (shot/peak/balance/reset) |
| `injectionPhase` | cycleDay + frequency | Focus card weighting, coaching tone |
| `programWeek` | today − startDate | Escalation phase, new-starter ramp |
| `escalationPhase` | programWeek + dose + medicationType | Dose phase label, behavioral emphasis |
| `weightLossToDate` | startWeight − currentWeight | Projection progress |
| `weeklyLossRate` | regression over last 4 weight entries | Trajectory assessment |
| `earlyResponderFlag` | ≥5% loss by Week 12 | Projection confidence level |
| `bmiClass` | weight + height | Plateau timing, projection model |
| `daysToGoal` | projection model output | Milestone display |

---

## Part 2: The Two-Phase System

TitraHealth uses **two independent phase systems** that operate simultaneously. Both affect the plan.

### 2.1 Injection Cycle Phase (7-day window, repeating)

Divides the injection cycle into 4 biological contexts. The medication concentration in blood is
highest 24–48 hours post-injection (semaglutide peaks at ~24h, tirzepatide at ~8–72h with a broader
peak). This creates predictable windows of:
- Peak appetite suppression (days 1–3 post-injection)
- GI sensitivity (days 1–5, variable)
- Waning suppression and potential "reset cravings" (days 5–7)

| Phase | Days in Cycle | What's Happening | Plan Priorities |
|---|---|---|---|
| **Shot Day** | Day 0–2 | Injection day + absorption surge | Log injection, hydrate aggressively, light movement only, protein shake > solid meal if nausea, electrolytes |
| **Peak Phase** | Day 3–4 | Max drug concentration, max appetite suppression | Rest prioritized, electrolytes, anti-nausea foods (ginger, bland), ample hydration, light walks only |
| **Balance Phase** | Day 5–6 | Plateau concentration, stable window | Resume normal activity, increase fiber, hit protein target, meal structure, strength training optimal window |
| **Reset Phase** | Day 7+ | Waning concentration, approaching next injection | Anticipate returning appetite, protein front-load, resistance training, prep for craving day patterns |

**Phase-Aware Score Multipliers (for focus card ranking):**
```
shot:    injection×3.0, hydration×1.5, protein×1.2, sleep×1.2, activity×0.8
peak:    hydration×2.0, rest×2.5, recovery×2.0, sleep×1.8, activity×0.4
balance: activity×1.4, fiber×1.3, protein×1.1
reset:   protein×1.3, activity×1.3, hydration×1.2, sleep×1.1
```

**GLP-1 Biometric Offsets (don't penalize users for medication effects):**
- HRV: Peak phase −6ms SDNN, shot day −3ms (expected pharmacodynamic suppression)
- Resting HR: Peak phase +3 bpm, shot day +2 bpm (expected autonomic effect)

### 2.2 Dose Escalation Phase (program-duration, non-repeating)

Each dose level represents a distinct clinical and behavioral phase. This is separate from the
weekly injection cycle — it determines the *overall program stage* and what behavioral skills to
emphasize. Tirzepatide escalates in 2.5 mg increments; semaglutide in irregular steps.

#### Semaglutide Escalation Phases

| Phase | Dose | Duration | Primary Focus |
|---|---|---|---|
| **Initiation** | 0.25 mg | Weeks 1–4 | Tolerability, GI adaptation, build protein habit, hydration, app engagement |
| **Low Therapeutic** | 0.5 mg | Weeks 5–8 | First appetite suppression window begins; establish meal structure, food logging habit |
| **Mid Therapeutic** | 1.0 mg | Weeks 9–12 | Food noise reduction kicks in; capitalize on behavioral plasticity window, start resistance training |
| **High Therapeutic** | 1.7 mg | Weeks 13–16 | Solidify new behaviors as automaticity, body composition focus, check early-response flag |
| **Maintenance** | 2.4 mg | Week 17+ | Long-term sustainability, lean mass protection, mindset shift from loss to optimization |

#### Tirzepatide Escalation Phases

| Phase | Dose | Duration | Primary Focus |
|---|---|---|---|
| **Initiation** | 2.5 mg | Weeks 1–4 | GI adaptation, hydration, protein baseline, food logging onboarding |
| **Low Therapeutic** | 5 mg | Weeks 5–8 | Appetite suppression begins, hunger cue awareness, reduce ultra-processed foods |
| **Mid Therapeutic** | 7.5 mg | Weeks 9–12 | Eating behavior restructuring, protein prioritization, resistance training start |
| **High Therapeutic** | 10 mg | Weeks 13–16 | Accelerated weight loss phase; body composition focus, lean mass monitoring |
| **High+** | 12.5 mg | Weeks 17–20 | Maximize lean tissue preservation, activity escalation, micronutrient review |
| **Max Dose** | 15 mg | Week 21+ | Maintenance mindset, behavior permanence, sustainability planning |

**Escalation Phase Implementation:**
The `escalationPhase` is determined from `programWeek` + `doseMg`. If the user's actual dose is
higher than the expected dose for their program week, they are an accelerated escalator (flag for
coaching). If lower, they may be a slow titrator (flag for tolerability coaching).

**Behavioral Plasticity Window:**
Weeks 5–16 (across both medications) represent the highest food noise suppression and the prime
window for behavioral habit formation. The app should deliver the most intensive habit-building
coaching content during this window. Clinical evidence (Penn Medicine) shows tirzepatide may only
temporarily suppress food noise — what you build during the window determines long-term success.

---

## Part 3: Personalized Daily Targets

### 3.1 Protein Target

**Clinical basis:** 2025 Joint Advisory (ACLM / ASN / OMA / TOS) recommends 1.2–1.6 g/kg/day for
active weight loss on GLP-1s. 26–40% of GLP-1 weight loss is lean mass without intervention;
adequate protein + resistance training reduces this to <10% or eliminates it.

```
baseProtein = currentWeightKg × 1.2

Medication multipliers:
  tirzepatide: ×1.1 (stronger appetite suppression → easier to underconsume)
  semaglutide: ×1.0

Dose multipliers:
  semaglutide ≥1.7mg:  ×1.15
  semaglutide ≥1.0mg:  ×1.1
  tirzepatide ≥10mg:   ×1.15
  tirzepatide ≥7.5mg:  ×1.1

New-starter ramp (prevents overwhelming new users):
  Week 1:    ×0.75
  Weeks 2–3: ×0.875
  Week 4+:   ×1.0

Activity boost:
  active / very_active: ×1.1 (resistance training requirement)

Distribution guidance: spread evenly across 3–4 meals (25–40g per meal)
Maximum recommended: 2.0 g/kg/day (prolonged)
```

### 3.2 Hydration Target

**Clinical basis:** GI side effects (nausea, vomiting, diarrhea) create acute dehydration risk.
Electrolyte balance is critical during peak phase.

```
baseHydrationMl = weightLbs × 0.6 oz × 29.5735 (to mL)

Medication multipliers:
  semaglutide: ×1.1 (higher nausea incidence)
  tirzepatide: ×1.05

Dose multipliers:
  ≥high therapeutic dose: ×1.15
  ≥mid therapeutic dose:  ×1.1

Side effect adjustments:
  nausea severity ≥5: ×1.15 (acute dehydration risk)
  constipation present: ×1.1
  vomiting logged today: ×1.2

Phase:
  peak phase: ×1.1 (highest GI sensitivity window)
  shot day:   ×1.1
```

### 3.3 Fiber Target

```
baseFiberG = 30g (general guideline)

Side effect adjustments:
  constipation severity ≥4: base = 35g
  diarrhea severity ≥4: base = 25g (reduce temporarily)

Phase:
  peak/shot phase: −5g (nausea-sparing; reduce bulk temporarily)
  balance phase: +5g (optimal window)
  reset phase: base
```

### 3.4 Step / Activity Target

```
stepTargets = {
  sedentary:   6,000
  light:       8,000
  active:      10,000
  very_active: 12,000
}

New starter ramp (prevent injury, build habit):
  Weeks 1–2: ×0.7
  Weeks 3–4: ×0.85
  Week 5+:   ×1.0

Phase:
  shot/peak phase: ×0.7 (active recovery, not pushing)
  balance/reset:   ×1.0

Resistance training flag:
  If activityLevel is sedentary or light AND program week ≥ 5:
  → Escalate to "start resistance training" focus (highest priority)
```

### 3.5 Caloric Context (Informational, Not Prescriptive)

TitraHealth does not assign a calorie target (this medicalizes and can harm). Instead, caloric
intake is displayed as informational context against a calculated TDEE estimate:

```
TDEE (Mifflin-St Jeor):
  Male:   (10 × weightKg) + (6.25 × heightCm) − (5 × age) + 5
  Female: (10 × weightKg) + (6.25 × heightCm) − (5 × age) − 161
  Other:  average of male/female

Activity multiplier:
  sedentary: ×1.2
  light: ×1.375
  active: ×1.55
  very_active: ×1.725

Display: "You've had X kcal today. Your estimated TDEE is Y kcal."
Deficit context: shown as "~Z kcal below TDEE" — not as a target.
```

---

## Part 4: Weight Projection Model

### 4.1 Expected Trajectory (Clinical Benchmarks)

| Medication | Dose | Expected Loss at 72 wks | ≥15% Loss Rate | ≥25% Loss Rate |
|---|---|---|---|---|
| Semaglutide | 0.5–1.0 mg | ~8–12% | ~40% | ~10% |
| Semaglutide | 2.4 mg | ~14.9–15.2% | ~55% | ~15% |
| Tirzepatide | 5 mg | ~15.0% | ~55% | ~15% |
| Tirzepatide | 10 mg | ~19.5% | ~67% | ~25% |
| Tirzepatide | 15 mg | ~20.9% | ~70% | ~36% |

**Head-to-head (SURMOUNT-5, 2025):** Tirzepatide −20.2% vs. Semaglutide −13.7% at 72 weeks
(max tolerated dose). Tirzepatide advantage: +6.5 percentage points (p<0.001).

### 4.2 Projection Curve Logic

```
Inputs:
  startWeight, currentWeight, programWeeks, medication, dose, sex, bmiClass

Step 1 — Select expected total loss %:
  Look up clinical expected % from table above for current medication + dose

Step 2 — BMI class adjustment:
  Class III obesity (BMI ≥40): plateau at ~36 weeks (slower start, similar endpoint)
  Class I/II:                  plateau at ~24–26 weeks
  Overweight (BMI 27–30):      plateau at ~24 weeks

Step 3 — Sex adjustment:
  Female: plateau timing is later → project slightly more total loss at max dose
  Male: earlier plateau, but same % if on max dose

Step 4 — Generate sigmoid curve:
  Use logistic growth model: y = L / (1 + e^(-k(t−t0)))
  L = expected total loss
  k = rate parameter (calibrated from SURMOUNT/STEP trial data)
  t0 = inflection point (midpoint of plateau timing for their BMI class)

Step 5 — Early responder calibration (Week 12+ only):
  IF weeklyLossRate at Week 12 is tracking at ≥5% total loss:
    earlyResponderFlag = true
    scale projection up by 1.1x (early responders exceed trial averages)
  ELSE:
    Still project success — 90% of late responders still achieve ≥5% by Week 72
    Show message: "Responses vary — your trajectory is still on track."

Step 6 — Output:
  projectedGoalDate: date when current trajectory intersects goalWeight
  projectedTotalLoss: expected lbs from start weight
  weeksToGoal: integer
  confidenceLevel: "high" (early responder) / "on track" / "monitoring"
```

### 4.3 Display

- Show as a smooth curve on the Progress tab
- Mark **milestone dots** at every 5% loss increment
- Shade a **range band** (±15% of projection) to show realistic variance
- Include a vertical line at "Week 12 check-in" with label "Your response is confirmed here"
- Do NOT show a scary "you'll gain it back" projection — only show the active treatment arc
- Only mention maintenance/regain risk in educational articles (not in the UI chart)

---

## Part 5: Food Noise Tracking

### 5.1 Clinical Definition (2024 — Formally Validated)

Food noise: *persistent thoughts about food that are unwanted and/or dysphoric, and which may cause
social, mental, or physical harm.* Validated at the American Society of Nutrition expert panel,
June 28, 2024.

**This is the most GLP-1-specific psychological metric** — no other consumer health app tracks it.
It is a primary mechanism of GLP-1 action and a leading indicator of medication efficacy.

### 5.2 Food Noise Questionnaire (FNQ — 5 Items, Weekly)

```
Rate each item 0–4 (0 = not at all, 4 = extremely):

1. "I found myself thinking about food when I wasn't hungry this week."
2. "Thoughts about food interrupted what I was doing."
3. "I felt like I couldn't stop thinking about food, even when I wanted to."
4. "Food thoughts made it harder for me to focus on other things in my life."
5. "I felt distressed by how much I thought about food."

Total score: 0–20
  0–4:  Minimal food noise (GLP-1 working well)
  5–8:  Mild food noise
  9–14: Moderate food noise
  15–20: High food noise (pre-treatment or medication waning)
```

**Weekly check-in prompt:** Surface the FNQ every Sunday as a card on the home screen (or in
side effects entry flow). Store results in a new `food_noise_logs` table.

### 5.3 GLP-1 Impact on Food Noise (Survey Evidence)

| Measure | Before GLP-1 | After GLP-1 |
|---|---|---|
| "Spending too much time thinking about food" | 63% | 15% |
| "Uncontrollable food thoughts" | 53% | 15% |
| "Food thoughts negatively affecting life" | 60% | 20% |

### 5.4 The Behavioral Plasticity Window

GLP-1s temporarily suppress food noise, creating a **window of opportunity** for habit formation
(Weeks 5–16 across most dose escalation paths). If the app does not actively coach habits during
this window, the patient risks regression when the medication is paused, reduced, or discontinued.

**App strategy:**
- Track FNQ weekly. When scores drop to 0–4, trigger a "behavioral plasticity" coaching prompt:
  *"Your food noise is low this week — this is your best window to build new habits. Here's what to focus on."*
- When FNQ rises (potential medication waning or stress), trigger a different message:
  *"Your food thoughts are picking up this week. Let's review your strategies for managing cravings."*
- Link FNQ trends to dose escalation events. Rising FNQ between doses is expected and can be
  pre-addressed: *"You may feel more hunger in the days before your next injection. Here's a plan."*

---

## Part 6: Late-Phase Clinical Phenomena (Weeks 12+)

Behavioral plasticity is only one of many clinically significant changes that occur as GLP-1
therapy progresses. Every phenomenon below has a direct implication for what the app should track,
display, and coach. These are not edge cases — most patients on long-term GLP-1 therapy will
experience several of them simultaneously.

### 6.1 Metabolic Adaptation (Adaptive Thermogenesis)

**What happens:** As weight falls, the body reduces total energy expenditure (TEE) beyond what body
size reduction alone predicts. Mathematical modeling (Hall et al., 2024) shows TEE decreases
~15% for every 10% weight lost:
- ~60% explained by reduced body mass
- ~40% is true adaptive thermogenesis — a "penalty" the body imposes to resist further loss

GLP-1s do not confer a thermogenic advantage. REE adjusted for lean mass does not differ between
semaglutide and placebo. The metabolic adaptation is essentially identical to caloric restriction
alone. At any given body weight, a GLP-1 patient who lost 15% of body weight has a measurably
lower RMR than someone who was always at that weight.

**App implication:**
- After week 8, TDEE estimates should recalibrate downward as weight loss accumulates
- A patient near plateau (week 28–36+) is not failing — their body has reached metabolic equilibrium
- When plateau is detected (3+ weeks without weight change), trigger "Plateau Protocol" guidance:
  1. Dose increase (if not at max) — most effective
  2. Resistance training — the only behavioral intervention that counters adaptation by preserving muscle
  3. Protein increase — thermic effect + muscle preservation
  4. Recalibrate expectations — plateau is biology, not failure

**Rebound mechanism:** When the drug stops, appetite rebounds fully while metabolic rate stays
suppressed. This is the biological basis of the ~60% weight regain after discontinuation.

### 6.2 Body Composition Changes — Lean Mass Loss Over Time

**Trial data:**
- Semaglutide (STEP 1, 68 weeks): 40% of weight lost was lean mass (−6.9 kg lean, −10.4 kg fat)
- Tirzepatide (SURMOUNT-1, 72 weeks): 25% lean mass, 75% fat — tirzepatide preserves lean mass
  better than semaglutide, likely due to dual GIP/GLP-1 agonism
- Both medications are "among the least effective in preserving lean mass" compared to lower-weight-
  loss agents (network meta-analysis, 2024)

**Critical mechanic:** At the weight loss plateau, the proportion of lean mass relative to total
body mass actually *increases* (the body burns remaining fat), but the absolute lean mass loss is
already locked in by then. Lean mass protection requires intervention before the plateau, not at it.

**App implication:**
- Escalate resistance training urgency at weeks 9–12 (mid-therapeutic phase), before lean mass loss accelerates
- Protein target should use current weight but re-evaluate every 4 weeks as weight changes
- A "lean mass preservation score" (composite of protein compliance + resistance training frequency)
  is a distinct, valuable metric for the Progress tab — separate from the weight scale

### 6.3 Bone Density Decline

**Evidence:**
- Significant weight loss (≥7–10%) increases bone resorption markers regardless of GLP-1 use
- Semaglutide RCT in adults with elevated fracture risk: significant BMD declines at lumbar spine,
  femoral neck, and total hip
- The magnitude of BMD decline correlates directly with amount of weight lost
- Real-world TriNetX cohort: tirzepatide associated with HR 1.44 for new-onset osteoporosis or
  fragility fracture vs. other GLP-1 RAs — the aggressive weight loss may carry greater bone cost

**Counterforce:** GLP-1 receptors exist on osteoblasts (bone-forming cells). GLP-1 agonism tips
mesenchymal stem cells toward bone formation and reduces osteoclast-mediated resorption via
calcitonin pathways. This is bone-protective — but appears to be outweighed by mechanical unloading
from rapid weight loss and potential calcium/vitamin D insufficiency.

**Exercise as mitigation:** A 2024 RCT showed that exercise combined with GLP-1 therapy preserved
bone at hip and spine, while GLP-1 therapy alone led to reduced BMD at both sites. This is the
strongest, most actionable finding in the bone category.

**High-risk groups:** Postmenopausal women, patients achieving >20% total weight loss, low calcium
or vitamin D intake, patients not doing weight-bearing exercise.

**App implication:**
- At week 16+, introduce "Bone Health" as a tracked concern alongside lean mass
- Prompt weight-bearing exercise (not just aerobic) as bone-specific intervention
- Recommend vitamin D + calcium adequacy review by week 12
- Add bone health to comorbidity profile (high risk: postmenopausal female, Class III obesity,
  prior fracture, on tirzepatide achieving >20% loss)
- Suggest BMD screening discussion at 1-year mark for high-risk users

### 6.4 Micronutrient Deficiencies

Three mechanisms drive deficiencies: (1) severe appetite suppression → reduced total food volume,
(2) delayed gastric emptying → altered absorption, (3) nausea/vomiting → dietary monotony.

**Prevalence and timeline:**

| Nutrient | Prevalence / Signal | Peak Risk | Severity |
|---|---|---|---|
| **Vitamin D** | 7.5% deficient at 6 months → 13.6% at 12 months | Months 6–12 | Common, manageable |
| **Iron / Ferritin** | 26–30% lower ferritin than SGLT2i users; reduced intestinal absorption confirmed at 10 weeks | Months 2–6 | High clinical significance |
| **Thiamine (B1)** | 15 documented Wernicke cases (semaglutide, tirzepatide, liraglutide); dry beriberi cases | Acute — days to weeks with vomiting | CRITICAL — body stores last 18–20 days |
| **Vitamin B12** | Risk increases with food volume reduction | Months 6–18 | Clinically significant long-term |
| **Calcium** | Most GLP-1 users fail RDA in dietary analyses | Chronic | Compounds bone risk |
| **Zinc** | Reduced with dietary restriction | Months 2–6 | Wound healing, immune function |
| **Vitamins A, E, K** | Risk with reduced dietary fat | Longer term | Accumulates |

**Thiamine is the most urgent clinical signal.** Body stores last only 18–20 days. Patients with
severe or persistent vomiting can develop Wernicke encephalopathy in weeks. There are no current
consensus monitoring guidelines for GLP-1 micronutrient screening — this is a documented clinical
gap the app can address by flagging risk patterns.

**App implication:**
- At week 8, introduce "Lab Check Reminder" card suggesting vitamin D, iron/ferritin, CBC review
- Any side effect log with nausea or vomiting severity ≥6 should trigger: "Persistent vomiting
  can deplete B1 (thiamine) quickly. Please contact your prescriber if this continues."
- Maintain a running "nutrient adequacy" signal based on food log diversity and volume trends
- Add micronutrient supplements as a trackable field (alongside medication logging)

### 6.5 Hair Loss (Telogen Effluvium)

**Clinical picture:**
- Incidence: 2.5% of Wegovy users vs. 1.0% placebo; aOR 1.76 at 12 months in real-world cohort
- Primarily driven by rate and magnitude of weight loss, not direct GLP-1 receptor effects
  (not observed with once-daily liraglutide at same timeframe)
- Onset: months 3–6 after initiation or after a major weight loss event
- Peak: months 4–6
- Resolution: mostly self-limiting; most see regrowth by 6–12 months

**Management:** Reassurance is primary. Correct underlying micronutrient deficiencies (especially
iron and vitamin D), which both cause and exacerbate telogen effluvium.

**App implication:**
- Add "hair loss" to the side effects entry options (currently missing from enum)
- When hair loss is logged at months 3–6, trigger a dedicated supportive card:
  *"Hair shedding at this stage is a known and temporary response to rapid weight loss, not a sign
  the medication is wrong for you. Iron and vitamin D levels are worth checking. It typically
  resolves by month 9–12."*
- This is a top-5 discontinuation risk factor — proactive reassurance during this window reduces
  dropout. No other app does this.

### 6.6 Medication Adherence and Dropout Risk

**Real-world persistence data:**
- Only 14% remain on Wegovy after 3 years (Prime Therapeutics, June 2025)
- 46% discontinue by month 5 — early dropout is the primary problem
- Patients lasting 3 months average 3.6% weight loss; patients lasting 3–12 months average 6.8%

**Highest-risk windows:**
1. **Months 1–2**: GI side effects before the body adapts
2. **Months 4–6**: Cost shock ("Is this worth $2,350/month?") + GI side effects peak + hair loss starts
3. **Month 10–12**: First major plateau → perceived medication failure

**Primary discontinuation reasons:**
1. Cost/access (most common)
2. GI side effects (64% cited nausea/vomiting)
3. Perceived goal achievement (self-defined stopping point)
4. Prior psychiatric medication history (+12% risk)
5. Prior cardiovascular history (+10% risk)

**What the evidence says about stopping:**
- Abrupt stop → +5.63 kg mean regain (meta-analysis, 2025)
- Gradual 9-week taper + lifestyle coaching (ECO 2024) → only 1.5% average weight gain
- Every-2-week dosing (de-escalation) → maintains weight and metabolic improvements
- The behavioral habits built during active treatment are the primary predictor of post-
  discontinuation outcomes

**App implication:**
- Build dropout-risk detection: flag users who haven't logged in 5+ days AND are in months 4–6
- "Continuity card" at month 4 check-in: reinforce the dose-response relationship with their own data
- Add a "Taking a break from medication" pathway — guides users through a taper plan with lifestyle
  bridge content rather than abrupt stop
- Cost/access support content: manufacturer savings programs, compounding pharmacy context
  (for physician discussion), insurance appeals guidance

### 6.7 The Weight Loss Plateau — What's Actually Happening

**Timeline (STEP trial + Hall 2024 modeling):**
- Weeks 12–16: First minor plateau (coincides with dose escalation, resolves)
- Weeks 28–36: Second, more significant plateau
- ~Week 60: Major physiological plateau — weight loss essentially halts even at full maintenance dose

**Key biological distinction:** GLP-1 efficacy does NOT wane. GLP-1 receptors do not desensitize at
therapeutic doses. The plateau is a new metabolic equilibrium — not pharmacological tachyphylaxis.
The drug is still working; the body has found a new setpoint that the drug's appetite suppression
and the body's hunger counterresponse have agreed on.

**Contributing factors:**
1. Adaptive thermogenesis (15% TEE reduction per 10% weight lost)
2. Cumulative lean mass loss (−13 kcal/day REE per kg lean mass lost)
3. Increased ghrelin and NPY countering GLP-1 signal at new lower weight
4. Lower body mass = lower absolute caloric requirement

**App implication:**
- Week 60+ / major plateau detected → trigger "Maintenance Phase" transition in the app framework
- Shift language from "weight loss" to "body composition optimization"
- New primary metrics: lean mass preservation score, bone health indicators, metabolic vitals
- Introduce "Plateau Protocol" card with evidence-ordered interventions

### 6.8 Cardiovascular Improvements — Specific Numbers and Timeline

| Marker | Change | Timeline |
|---|---|---|
| Systolic BP | −3.71 mmHg (meta-analysis) | Visible weeks 12–26 |
| Diastolic BP | −1.10 mmHg | Weeks 12–26 |
| Triglycerides | −38.4 mg/dL at 52 weeks | Fastest responder — by week 12 |
| LDL-C | −8.1 mg/dL at 52 weeks | Visible by week 26 |
| HDL-C | +1.82 mg/dL | Weeks 26–52 |
| MACE reduction | 20% (SELECT trial) | 3+ year horizon |
| Resting HR | +1–3 bpm (pharmacodynamic) | Persistent throughout treatment |

Tirzepatide provided greater SBP reductions than semaglutide at 72 weeks (SURMOUNT-5 post-hoc).

Critically: The 20% MACE reduction in SELECT trial appeared **independent of degree of weight loss**
in prespecified analysis — suggesting direct GLP-1 receptor cardioprotective effects beyond weight.

The resting HR increase (+1–3 bpm) is the opposite of what weight loss alone would cause. This is
a direct SA node pharmacodynamic effect and persists throughout treatment. It is a clinical marker
of drug activity, not a health concern — but it means BP improvement + weight loss is not
accompanied by expected HR reduction. The app's recovery score already accounts for this.

**App implication:**
- After week 12, surface "Cardiovascular Progress" in the Insights Medication tab
- BP and lipid labs as optional trackable inputs — visible improvement is a strong retention motivator
- Flag: "Your resting HR may be slightly elevated by the medication — this is expected and not a concern"

### 6.9 Hormonal Changes

**Men:**
- Average total testosterone increased **18%** after ~18 months on GLP-1 (Endocrine Society 2025)
- Sperm morphology improvement: 2% → 4% normal at 24 weeks semaglutide (Gregorič et al., 2025)
- Improvement correlates strongly with visceral fat loss
- Note: one cohort found higher newly diagnosed ED incidence in non-diabetic obese men — likely
  increased testing rather than causal harm; requires context in any app messaging

**Women:**
- Testosterone reduction: −0.29 nmol/L in women treated 3 months
- Menstrual cycle regularization (improved frequency/ovulation) documented with exenatide +/- metformin
- Low-dose semaglutide in PCOS → weight reduction + glucose improvement + menstrual normalization
- GLP-1 prescribing in PCOS: 2.4% (2021) → 17.6% (2025) — rapidly becoming standard of care

**Insulin sensitivity:**
- Improvements begin within weeks 1–4 (direct incretin effect, before weight loss)
- HOMA-IR continues improving through months 6–12
- HbA1c improvements plateau at weeks 26–52
- Mean HbA1c reduction for T2D on semaglutide: −1.5 to −2.0%

**App implication:**
- For women: menstrual cycle tracking as a GLP-1 outcome metric (add to side effects or as separate log)
- For men: energy/mood/libido symptom improvement as trackable outcomes after 3+ months
- For T2D users: HbA1c as a trackable progress field alongside weight

### 6.10 Psychological Trajectory — Beyond Food Noise

**Reward system remodeling (neuroscience):**
- GLP-1 receptors in nucleus tractus solitarius → ventral tegmental area → dopamine modulation
- Semaglutide reduces motivated reward-seeking behavior but enhances dopamine signaling *during*
  eating (restores satisfaction from appropriate portions — not just suppression)
- Cross-addiction effects documented: reduced cravings for alcohol, nicotine, opioids, and
  compulsive behaviors alongside food noise reduction
- Opioid craving reduced 40% over 3 weeks in Brown University/Stanford data (small study)

**Complex psychological territory at 6–18 months:**

1. **"Ozempic personality" / anhedonia signal**: Some patients report reduced motivation, emotional
   blunting, general reward quieting extending beyond food. The broad dopamine modulation is
   biologically plausible. Not yet formally characterized in RCTs but documented in qualitative data.

2. **Body image does not automatically improve with weight loss**: Patients can achieve significant
   loss and remain dissatisfied. "Ozempic face" (facial volume loss from rapid weight loss),
   skin laxity, and shifting fixations are documented. Active psychological work on body image is
   required — weight loss alone doesn't resolve it.

3. **Fear-of-regain as dominant psychological state**: Social media and qualitative analysis show
   this is the most common late-phase emotional theme. Creates psychological dependency distinct
   from physiological need. Most underserved emotional domain in GLP-1 apps.

4. **Disordered eating risk**: GLP-1s can help (reducing binge eating) and harm (triggering
   restriction patterns in vulnerable individuals, unmasking underlying anorexia). VigiBase
   pharmacovigilance data found eating disorder signals across all three GLP-1 RAs.

5. **Mood signals (mixed evidence)**: Novo Nordisk-funded trial found small reduction in depressive
   symptoms. Large population study found lower suicidal ideation with semaglutide vs. other anti-
   obesity medications. Current consensus: no meaningful increase in suicide risk; potential benefit.

**App implication:**
- Late-phase coaching content should directly address:
  - Fear of regain: normalize it, give evidence-based tools (taper strategies, habit consolidation)
  - Body image transformation as an active goal, not an automatic outcome of weight loss
  - "Food relationship transformation" — consolidate new relationship with food as identity, not habit
- Weekly psychological check-in (separate from FNQ) at 6+ months: mood, body image, fear-of-regain
- Eating disorder risk screen: if food logs show <600 kcal/day consistently, prompt physician review

### 6.11 Maintenance Phase Transition (Week 60+)

The maintenance dose phase is not truly "maintenance of behavior." It is maintenance of drug signal
intensity enforcing a new metabolic setpoint. The patient has not biologically adapted to their new
weight — the drug is holding them there. This is the Vanderbilt research (2026) framing.

**What shifts at the maintenance transition:**

| Before Plateau | After Plateau (Maintenance Phase) |
|---|---|
| Primary metric: body weight | Primary metric: body composition ratio |
| Goal: lose weight | Goal: protect lean mass, bone, cardiovascular health |
| Targets: caloric deficit | Targets: protein adequacy, resistance training frequency |
| Focus: appetite management | Focus: habit permanence, psychological consolidation |
| Risk: GI side effects, early dropout | Risk: lean mass loss, micronutrient deficiency, bone, fear-of-regain |

**Evidence-based transition strategies:**
- Gradual dose taper + lifestyle bridge → only 1.5% avg weight gain after full withdrawal (ECO 2024)
- Every-2-week dosing de-escalation → maintains weight and metabolic improvements (Obesity Week 2025)
- Behavioral habits formed during active treatment are the primary predictor of post-discontinuation outcomes

### 6.12 Phase Phenomena Timeline (Master Reference)

| Phenomenon | Onset | Peak/Critical Window | App Trigger |
|---|---|---|---|
| Behavioral plasticity window | Week 5 | Weeks 5–16 | FNQ drops to 0–4 |
| Metabolic adaptation | Week 4–8 | Accumulates → week 60 | Plateau detected |
| Lean mass loss (absolute) | Immediate | Throughout; locks in by plateau | Weeks 8+ protein/resistance tracking |
| Bone density decline | Months 3–6 | Correlates with weight lost | Week 16+ bone health card |
| Vitamin D deficiency | Months 3–6 | 13.6% deficient at 12 months | Week 12 lab reminder |
| Iron/ferritin depletion | Weeks 6–10 | Weeks 10–26 | Week 8 lab reminder |
| Thiamine (B1) critical | Any time with vomiting | Acute — days to weeks | Nausea/vomiting severity ≥6 |
| Hair loss (telogen effluvium) | Months 3–4 | Months 4–6 | Side effect log: hair loss |
| Adherence/dropout risk | Month 1 | Months 4–6 | Engagement drop detection |
| Weight loss plateau (major) | Week 28–36 first | Week 60 major | 3+ weeks no change |
| Testosterone improvement (men) | Months 3–6 | Month 18 | 6-month check-in |
| PCOS/menstrual normalization | Months 1–3 | Month 3–6 | Cycle tracking opt-in |
| Cardiovascular improvement | Weeks 4–12 | Months 6–18 | BP/lipid lab tracking |
| Psychological identity shift | Months 6–12 | Year 1–2 | Maintenance phase entry |
| Rebound risk | Immediately on stopping | Weeks 4–16 post-stop | Discontinuation signal |

---

## Part 7: Personalized Plan Structure (The Actual Plan Object)

The `PersonalizedPlan` is a computed object that gets rebuilt daily (or when new data arrives).
It summarizes the user's current state and what to focus on.

### 6.1 Plan Schema (Proposed)

```typescript
type PersonalizedPlan = {
  // Identity
  userId: string
  generatedAt: string // ISO timestamp

  // Current Medication Phase
  injectionPhase: 'shot' | 'peak' | 'balance' | 'reset'
  injectionCycleDay: number
  daysUntilNextInjection: number
  escalationPhase: EscalationPhase // see dose escalation table above
  programWeek: number

  // Daily Targets (personalized)
  targets: {
    proteinG: number
    hydrationMl: number
    fiberG: number
    steps: number
    tdeeEstimate: number
  }

  // Today's Actuals
  actuals: {
    proteinG: number
    hydrationMl: number
    fiberG: number
    steps: number
    calories: number
    injectionLogged: boolean
  }

  // Score
  recoveryScore: number         // 0–100, wearable-based
  glp1SupportScore: number      // 0–100, habits-based
  compositeScore: number        // weighted blend

  // Top Focus Cards (ranked by phase-weighted deficit)
  focuses: FocusCard[]          // top 3

  // Weight Projection
  projection: {
    startWeight: number
    currentWeight: number
    goalWeight: number
    projectedGoalDate: string
    projectedTotalLossLbs: number
    weeksToGoal: number
    weeklyLossRate: number       // from last 4 entries
    earlyResponderFlag: boolean
    confidenceLevel: 'high' | 'on_track' | 'monitoring'
    lossToDateLbs: number
    lossToDatePct: number
  }

  // Food Noise
  latestFoodNoiseScore: number | null  // 0–20 FNQ, last Sunday
  foodNoiseTrend: 'improving' | 'stable' | 'rising' | null

  // Side Effects (recent 7 days)
  activeSideEffects: {
    type: string
    avgSeverity: number
    phasePattern: string | null  // "typically peaks on shot day"
  }[]

  // Weekly Focus (longer arc than daily)
  weeklyFocus: {
    title: string              // e.g., "Build Your Protein Habit"
    why: string                // clinical rationale
    habits: string[]           // 2–3 concrete actions
    escalationContext: string  // which escalation phase this maps to
  }

  // Context Snapshot (for AI injection)
  contextSnapshot: string      // natural language summary (existing buildContextSnapshot())
}
```

### 6.2 Weekly Focus Templates (by Escalation Phase)

These are pre-written, clinically grounded weekly focuses. They get surfaced on the Insights tab
and injected into AI context.

**Initiation Phase (Weeks 1–4):**
> Title: "Your Foundation Week — Build the Basics"
> Why: "The first weeks are about tolerability, not speed. Building protein and hydration habits
> now makes every subsequent phase more effective."
> Habits: Log your food even on hard days | Aim for 20g protein per meal | Drink water before
> every meal | Note any side effects so we can adapt

**Low Therapeutic (Weeks 5–8 sema / 5–8 zep):**
> Title: "Your Appetite is Changing — Let's Use It"
> Why: "Appetite suppression is kicking in. This is your window to restructure meals without
> feeling deprived. The habits you build now will feel effortless."
> Habits: Stop eating when 80% full (not 100%) | Try one new high-protein meal this week |
> Notice when food cravings are emotional vs. physical

**Mid Therapeutic (Weeks 9–12):**
> Title: "Food Noise Is Fading — Time to Build"
> Why: "This is the behavioral plasticity window. Your brain's relationship with food is
> rewiring. What you practice now can become permanent."
> Habits: Add one resistance training session this week | Hit your protein target 5/7 days |
> Complete your weekly Food Noise check-in

**High Therapeutic (Weeks 13–16):**
> Title: "Lean Mass Is Your Priority Now"
> Why: "26–40% of GLP-1 weight loss can be lean muscle — but only if you're not protecting it.
> Protein + resistance training is the intervention."
> Habits: 2+ resistance sessions this week | 1.2g protein per kg body weight daily |
> Review your step trend — are you moving enough?

**High Therapeutic / High+ (Weeks 13–20):**
> Title: "Protect What You're Building"
> Why: "Up to 40% of weight lost on GLP-1s can be lean muscle — only if you don't protect it. At
> your current dose and weight loss rate, resistance training is now a clinical necessity, not a bonus.
> Your bones are also adapting to your new weight — weight-bearing exercise protects them."
> Habits: 2+ resistance training sessions this week | Hit protein target 5/7 days |
> Are you getting vitamin D and calcium? | Schedule lab check (iron, vitamin D, B12) if not done

**Maintenance Dose (Week 21+):**
> Title: "You're at the Plateau — The Goal Has Shifted"
> Why: "Your body has reached metabolic equilibrium. This is biology — not a failure. The focus
> now moves from weight loss to body composition, bone health, and permanence. The scale may not
> move much. Your lean mass score and cardiovascular health are the metrics that matter most now."
> Habits: Prioritize strength over cardio | Set a performance goal (not a weight goal) |
> Review micronutrient labs with your prescriber | Practice one meal per week without logging

**Late Maintenance / Fear of Regain (Month 12+):**
> Title: "The Hardest Part Isn't Losing — It's Staying"
> Why: "Fear of regain is the most common emotional state at this stage, and it's completely normal.
> Your body has adapted to a lower setpoint enforced by the medication. The habits you've built
> are the bridge that crosses the gap if/when the dose changes. This is about identity now, not habits."
> Habits: Name 3 food behaviors that now feel automatic | Consider one meal per week intuitive eating |
> Talk to your prescriber about a long-term plan (taper, maintenance dose, break) |
> Check in on how you feel about your body — not just your weight

---

## Part 8: AI Integration Surfaces

All AI surfaces receive the `contextSnapshot` + relevant plan sections. Here's how each surface
uses the personalized plan:

### 7.1 Home Screen Insights (GPT-4o-mini, ~3 bullets)

System prompt receives:
- Full `contextSnapshot`
- Current `injectionPhase` + `escalationPhase`
- Today's `focuses` array
- `projection.lossToDateLbs` + `projection.weeklyLossRate`
- `latestFoodNoiseScore` (if available)
- `activeSideEffects`

Generates: 2–3 context-aware insight bullets shown beneath the score ring.

Example output for a user on tirzepatide 7.5mg, peak phase, low protein:
> "You're in peak phase today — your appetite suppression is at its highest. Use this window to
> prioritize protein, even if you're not hungry. A 25g shake counts."
> "You've lost 8.4 lbs in 6 weeks — your rate suggests you're an early responder. Keep the
> momentum."

### 7.2 AI Chat (Full Plan Context)

System prompt receives the full `contextSnapshot` plus:
- `weeklyFocus` (title + why + habits)
- `projection` object
- `foodNoiseTrend`
- Last 3 `activeSideEffects`

This lets the chatbot answer questions like:
- "Is it normal to feel hungrier on day 6?" → Knows they're in reset phase
- "Why am I losing slower this week?" → Knows their rate + BMI class + escalation phase
- "What should I eat tonight?" → Knows their protein deficit + meal type gaps + craving day patterns

### 7.3 Insights Tab — Medication Tab

Uses:
- `injectionPhase`, `escalationPhase`, `programWeek`
- `injection_logs` history
- Side effect frequency / phase correlation

Shows: Injection calendar, dose phase timeline, side effect phase correlation chart,
"What to expect this week" card (phase-specific).

### 7.4 Insights Tab — Lifestyle Tab

Uses:
- `targets` vs `actuals` for all metrics
- `weeklyFocus`
- `projection.weeklyLossRate`
- `foodNoiseTrend` (if tracked)

Shows: Protein/hydration/fiber/steps trend charts, streak counters, food noise trend (if enabled),
resistance training frequency.

### 7.5 Insights Tab — Progress Tab

Uses:
- `projection` object
- `weight_logs` history
- `bmiClass` + `escalationPhase`

Shows: Weight loss curve with projection band, milestone markers, lean mass preservation score
(protein + resistance training compliance), "Time to goal" estimate.

### 7.6 Coaching Articles

Article schedule is already phase-aware (`daily_article_schedule` table links `phase` → `article_id`).
Personalize further by:
- Prioritizing articles related to the user's active side effects
- Featuring "Behavioral Plasticity Window" article series during Weeks 9–16
- Queuing "Food Noise" article when FNQ score first drops to 0–4

---

## Part 9: Personalization by Comorbidity (Future Layer)

These are not in the current onboarding flow but should be added as optional Step 15 in onboarding
or as a "Health Profile" settings section.

| Comorbidity | App Adaptations |
|---|---|
| **Type 2 Diabetes** | Blood glucose card on home screen, food logs show glycemic context, A1c tracking field, alert when steps < 3,000 (insulin sensitivity) |
| **Obstructive Sleep Apnea** | SpO₂ card on home screen, "Your medication is FDA-approved to treat sleep apnea" framing, sleep quality as a progress metric |
| **PCOS** | Cycle regularity as an outcome metric, "GLP-1s reduce androgen levels with weight loss" in educational articles, note: expect slower initial weight loss |
| **Cardiovascular Disease** | Resting HR + HRV emphasized in recovery score, "GLP-1s reduce cardiovascular events by 20%" framing for motivation |
| **Hypothyroidism** | Lower projection expectations, note: dose may need adjustment, slower metabolic rate flag |
| **Osteoporosis / Fracture Risk** | Bone health card from week 16, weight-bearing exercise urgency, BMD screening at 1 year, calcium/vitamin D checklist |
| **PCOS** | Menstrual cycle tracking as outcome, testosterone normalization framing, GLP-1 as PCOS treatment context |
| **Male obesity-related hypogonadism** | Energy/libido/mood symptom tracking, testosterone improvement as motivator at 6+ months |

---

## Part 10: Food Noise Database Table (New Migration Required)

```sql
create table food_noise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  week_start date not null,  -- Sunday of the scored week
  score integer not null check (score >= 0 and score <= 20),
  item_1 integer check (item_1 >= 0 and item_1 <= 4),
  item_2 integer check (item_2 >= 0 and item_2 <= 4),
  item_3 integer check (item_3 >= 0 and item_3 <= 4),
  item_4 integer check (item_4 >= 0 and item_4 <= 4),
  item_5 integer check (item_5 >= 0 and item_5 <= 4),
  notes text,
  created_at timestamptz default now()
);

alter table food_noise_logs enable row level security;
create policy "users can manage own food noise logs"
  on food_noise_logs for all using (auth.uid() = user_id);
```

---

## Part 11: Implementation Priorities

### Phase A — Foundation (Build These First)

1. **`computePersonalizedPlan()`** — master function in `constants/personalized-plan.ts`
   - Inputs: `FullUserProfile`, `DailyActuals`, `WearableData`
   - Outputs: full `PersonalizedPlan` object
   - This replaces / consolidates `getDailyTargets()`, `generateFocuses()`, `computeScore()` into one
     deterministic function

2. **Escalation phase calculator** — `getEscalationPhase(programWeek, doseMg, medicationType)`
   - Returns: phase name, dose range, behavioral emphasis, weekly focus template

3. **Weight projection curve** — `computeWeightProjection(profile, weightLogs)`
   - Sigmoid model with trial-benchmarked parameters
   - Early responder flag after Week 12

4. **Updated `buildContextSnapshot()`** — inject escalation phase, weekly focus, food noise score,
   projection confidence into the AI context string

### Phase B — New UI Surfaces

5. **Weekly Focus card** on Insights screen — replaces or supplements current static AI cards
6. **Progress tab projection chart** — sigmoid curve with milestone dots and confidence band
7. **Food Noise weekly check-in** — Sunday card on home screen, FNQ 5-item flow, trend line

### Phase C — Behavioral Coaching Layer

8. **Behavioral plasticity window notifications** — triggered when FNQ drops to 0–4 or when
   entering mid-therapeutic escalation phase
9. **Phase-matched articles** — article series: Initiation / Behavioral Window / Lean Mass /
   Maintenance
10. **Comorbidity profile** — optional onboarding step 15, unlocks targeted tracking cards

### Phase D — Late-Phase Clinical Safety Layer

11. **Micronutrient lab reminder** — triggered at week 8 (iron/ferritin) and week 12 (vitamin D, B12)
    with language designed for physician discussion, not alarm
12. **Thiamine alert** — triggered when nausea/vomiting side effect is logged at severity ≥6:
    proactive B1 depletion warning with prescriber contact prompt
13. **Hair loss reassurance card** — triggered when hair loss is logged at months 3–6:
    normalizes telogen effluvium, links to micronutrient checklist, reduces dropout
14. **Bone health card + weight-bearing exercise prompt** — triggered at week 16+ for high-risk
    users (postmenopausal, >20% loss, tirzepatide, no resistance training logged)
15. **Dropout risk detection** — engagement drop in months 4–6 → proactive re-engagement card
    with the user's own loss data and retention benefit framing

### Phase E — Maintenance Phase Transition

16. **Plateau detection → phase transition** — when weight stagnates 3+ weeks near week 60,
    trigger the maintenance phase modal: new primary metrics, shifted language, new weekly focuses
17. **Lean mass preservation score** — composite of protein compliance + resistance training
    frequency, shown prominently on Progress tab at maintenance phase entry
18. **Fear-of-regain psychological support** — late-phase coaching content (months 6–12):
    normalize fear, evidence-based taper strategies, identity consolidation exercises
19. **Discontinuation bridge pathway** — guided taper plan with lifestyle coaching content,
    triggered if user signals they are stopping or pausing medication
20. **Eating disorder safety check** — if food logs show <600 kcal/day on 3+ consecutive days,
    surface a prompt to discuss with prescriber (not alarm language)

---

## Key Numbers Reference

| Metric | Value |
|---|---|
| Lean mass % of total loss without intervention | 25–40% |
| Lean mass loss with adequate protein + resistance | <10% (can be near 0%) |
| Optimal protein (active GLP-1 loss) | 1.2–1.6 g/kg/day |
| Protein distribution | evenly across 3–4 meals (25–40g each) |
| Semaglutide 72-week avg loss (2.4mg) | −14.9 to −15.2% |
| Tirzepatide 72-week avg loss (15mg) | −20.9% |
| Tirzepatide advantage over sema (SURMOUNT-5) | +6.5 percentage points |
| Early responder threshold (Week 12) | ≥5% total loss |
| Late responders who still succeed (by Week 72) | 90% |
| Food noise reduction (survey) | 63% → 15% intrusive thoughts |
| Sleep apnea AHI reduction (tirzepatide, SURMOUNT-OSA) | −27.34 events/hour |
| Digital engagement weight loss multiplier | 1.7× vs. low engagement |
| Time to plateau, Class III obesity | ~36 weeks |
| Time to plateau, overweight | ~24 weeks |
| HRV suppression (GLP-1 pharmacodynamic) | −6.2ms SDNN at 12 weeks |
| Resting HR increase (GLP-1 pharmacodynamic) | +2–4 bpm |
| Weight regain 18 months post-discontinuation | ~60% of lost weight |
| Mean weight regain on stopping (meta-analysis 2025) | +5.63 kg |
| Gradual taper + lifestyle coaching weight gain | only 1.5% avg (ECO 2024) |
| Lean mass % of loss: semaglutide (STEP 1) | 40% (−6.9 kg lean) |
| Lean mass % of loss: tirzepatide (SURMOUNT-1) | 25% (−better preservation) |
| Adaptive thermogenesis per 10% weight lost | ~15% TEE reduction total |
| TEE reduction beyond body size alone | ~40% is true thermogenesis |
| Vitamin D deficiency at 12 months | 13.6% of GLP-1 users |
| Iron/ferritin lower than SGLT2i users | 26–30% |
| Thiamine body stores duration | 18–20 days |
| Hair loss incidence (Wegovy vs placebo) | 2.5% vs 1.0% |
| Hair loss peak window | Months 4–6 |
| Adherence at 3 years (Wegovy, real-world) | 14% |
| Dropout by month 5 | 46% |
| Major plateau timing | ~Week 60 |
| Testosterone improvement at 18 months (obese men) | +18% |
| MACE reduction (SELECT trial, semaglutide) | 20% |
| Semaglutide systolic BP reduction | −3.71 mmHg |
| Triglyceride reduction at 52 weeks | −38.4 mg/dL |
| Tirzepatide-associated osteoporosis HR vs other GLP-1s | 1.44 |
| Exercise + GLP-1 bone preservation | Preserves hip + spine BMD vs drug alone |

---

## Clinical Sources

- SURMOUNT-5 (2025, NEJM) — tirzepatide vs semaglutide head-to-head
- STEP 1, STEP 4, STEP 5 (NEJM / JAMA) — semaglutide trials
- SURMOUNT-1, SURMOUNT-4 (NEJM) — tirzepatide obesity trials
- SURMOUNT-OSA — tirzepatide + sleep apnea, FDA approval June 2024
- 2025 Joint Advisory: ACLM/ASN/OMA/TOS — nutritional priorities for GLP-1 therapy
- Food Noise Questionnaire validation (Obesity journal, 2024)
- Penn Medicine food noise research (tirzepatide temporary suppression)
- Impact of Digital Engagement on Weight Loss (JMIR, 2025)
- Time to Weight Plateau analysis (PMC, SURMOUNT-1 and SURMOUNT-4 post hoc)
- Early weight loss response (PMC, 2025 SURMOUNT-1 post hoc)
- Lean mass preservation case series (PMC, 2025)
- Noom 2.5-year RCT protocol (PMC)
