# Personalized Onboarding v2 — Implementation Record

## What We're Trying to Do

TitraHealth is a GLP-1 companion app. The core thesis is that the app should know exactly who the user is at a clinical level — what drug they're on, what dose they started at, how far into their titration they are — and use that to drive personalized coaching, phase-aware insights, and accurate behavioral guidance.

The onboarding flow collects all of this. But the original implementation had a fundamental data loss problem: 4 critical fields collected during onboarding were never persisted to Supabase. The user went through 14 screens and told us things we immediately threw away. Additionally, the dose screen showed generic, un-filtered dose options regardless of which medication was selected — Saxenda (0.6–3.0 mg daily) and Ozempic (0.25–2.0 mg weekly) showed the same pills. The phase engine that drives coaching also only knew about semaglutide and tirzepatide — liraglutide and oral semaglutide users got fallback behavior.

---

## The Job

Fix all data loss. Make the dose screen medication-aware. Add initial dose capture (what they started on vs. what they're on now — these are different things and both matter clinically). Expand the phase engine to cover all major brands. Add a test reset mechanism.

Specifically:

1. Apply a DB migration adding 6 missing columns to `profiles`
2. Fix `completeOnboarding()` to write all fields to Supabase
3. Fix `mapSupabaseToProfile()` to reconstruct all fields from Supabase on cold start
4. Rewrite the dose screen with brand-filtered dose pills and a two-question layout
5. Add dose start date capture to the schedule screen
6. Expand the escalation phase engine with liraglutide and oral semaglutide tables
7. Add brand-specific dose + titration constants
8. Add a dev reset button on the home screen
9. Regenerate TypeScript types

---

## What Was Done

### Database

**Migration:** `supabase/migrations/20260311_profiles_medication_brand.sql`

Added 6 columns to `profiles`:

| Column | Type | Purpose |
|---|---|---|
| `medication_brand` | TEXT | Brand name: `'ozempic'`, `'wegovy'`, `'zepbound'`, etc. |
| `route_of_administration` | TEXT | `'injection'` or `'oral'` |
| `glp1_status` | TEXT | `'active'` (already on it) or `'starting'` (just beginning) |
| `unit_system` | TEXT (default `'imperial'`) | `'imperial'` or `'metric'` |
| `initial_dose_mg` | NUMERIC | The dose they started the program on |
| `dose_start_date` | DATE | When they started their current dose |

Applied via Supabase MCP. TypeScript types regenerated and written to `lib/database.types.ts`.

---

### Type System (`constants/user-profile.ts`)

`FullUserProfile` now includes two new fields:

```typescript
initialDoseMg: number | null;   // what they started at
doseStartDate: string;          // YYYY-MM-DD
```

Three new exported constants added:

**`BRAND_DOSES`** — per-brand filtered dose pill arrays:
```typescript
ozempic:    [0.25, 0.5, 1.0, 2.0]
wegovy:     [0.25, 0.5, 1.0, 1.7, 2.4]
mounjaro:   [2.5, 5, 7.5, 10, 12.5, 15]
zepbound:   [2.5, 5, 7.5, 10, 12.5, 15]
saxenda:    [0.6, 1.2, 1.8, 2.4, 3.0]
rybelsus:   [3, 7, 14]
oral_wegovy:[1.5, 3, 7, 14, 25]
// + trulicity, victoza, compounded variants, fallback generic list
```

**`BRAND_TITRATION_SUMMARY`** — human-readable titration strings for the dose screen banner:
```
ozempic: "Starts at 0.25 mg · escalates every 4 weeks · max 2 mg/wk"
saxenda: "Starts at 0.6 mg/day · escalates weekly · max 3 mg/day"
// etc.
```

**`BRAND_STARTING_DOSE`** — the default starting dose for each brand, used to pre-select the initial dose pill:
```typescript
ozempic: 0.25, mounjaro: 2.5, saxenda: 0.6, rybelsus: 3, ...
```

Helper function `getBrandDoses(brand)` returns the filtered array or falls back to a generic list.

---

### Profile Context (`contexts/profile-context.tsx`)

**`completeOnboarding()`** — upsert now includes all 6 new fields. Previously these were collected in the draft but silently dropped. Fixed.

**`mapSupabaseToProfile()`** — was hardcoding `glp1Status: 'active'`, `medicationBrand: 'other'`, `unitSystem: 'imperial'`, `routeOfAdministration: 'injection'`. Now reads all of them from the Supabase row. This matters on cold restart — if AsyncStorage is cleared, the app reconstructs the profile from Supabase and it will now be accurate.

**`resetProfile()`** — now also NULLs `program_start_date` in Supabase in addition to clearing AsyncStorage. This is the key: the init logic checks `row.program_start_date` to decide whether to reconstruct the profile. Without this Supabase null, the reset button would clear local state but the app would immediately reconstruct the profile on next start and skip onboarding again.

---

### Dose Screen (`app/onboarding/dose.tsx`)

Completely rewritten. Before: one question, generic 7-item dose list, saved only `doseMg`.

After: two-question layout separated by a divider.

**Question 1 — "What dose did you start with?"**
- Pills filtered from `getBrandDoses(brand)` — the user only sees doses that exist for their specific medication
- Pre-selected to `BRAND_STARTING_DOSE[brand]` so most users just confirm
- Titration summary banner below (orange bordered card) showing the escalation schedule for their brand
- Saves `initialDoseMg`

**Question 2 — "What's your current dose?"**
- Only shown if `glp1Status === 'active'` (they're already on the medication)
- Hidden and auto-set to `initialDoseMg` if `glp1Status === 'starting'`
- Same filtered pill list
- Saves `doseMg`

Both values go to `updateDraft({ doseMg, initialDoseMg })`.

---

### Schedule Screen (`app/onboarding/schedule.tsx`)

For `glp1Status === 'active'` users, a second date picker appears below the "last injection date" picker:

- Label: "When did you start your current dose?"
- Subtitle: "The date you first took this specific dose amount."
- Saves `doseStartDate` to draft
- Validation: both date pickers must be complete before Continue is enabled

For `glp1Status === 'starting'` users: skipped, `doseStartDate` defaults to the last injection/start date.

---

### Escalation Phase Engine (`lib/escalation-phase.ts`)

Previously: `getEscalationPhase()` dispatched to `TIZE_PHASES` for tirzepatide, `SEMA_PHASES` for everything else. Liraglutide and oral semaglutide users fell through to semaglutide behavior (wrong week windows, wrong behavioral emphasis, wrong expected doses).

Now dispatches to 4 tables:

```typescript
const phases =
  medicationType === 'tirzepatide'      ? TIZE_PHASES      :
  medicationType === 'liraglutide'      ? LIRA_PHASES      :
  medicationType === 'oral_semaglutide' ? ORAL_SEMA_PHASES :
  SEMA_PHASES;
```

**`LIRA_PHASES`** (Saxenda/Victoza/liraglutide) — 5 phases, week-by-week titration:
- Initiation: Week 1, 0.6 mg/day
- Low Therapeutic: Week 2, 1.2 mg/day
- Mid Therapeutic: Week 3, 1.8 mg/day
- High Therapeutic: Week 4, 2.4 mg/day
- Maintenance: Week 5+, 3.0 mg/day

Behavioral emphasis focuses on the 13h half-life — daily injection consistency is the primary lever, not weekly timing. Food noise responds faster. Missed doses are not forgiven the way they are with semaglutide's 7-day half-life.

**`ORAL_SEMA_PHASES`** (Rybelsus/oral Wegovy) — 4 phases, 30-day titration steps:
- Initiation: Weeks 1–4, 3 mg/day (Rybelsus) or 1.5 mg/day (oral Wegovy)
- Low Therapeutic: Weeks 5–8, 7 mg / 3 mg
- Mid Therapeutic: Weeks 9–16, 14 mg / 7–14 mg
- Maintenance: Week 17+, 14 mg / 25 mg

Behavioral emphasis focuses on the fasting absorption window — oral semaglutide bioavailability drops 90% with food or >4oz water. The coaching framing is different from injectable: the primary compliance lever is morning routine, not injection site rotation.

---

### Reset Button (`app/(tabs)/index.tsx`)

Small, semi-transparent "Reset Onboarding" text button added to the home screen above the Health Monitor section. Styled to be unobtrusive (`rgba(255,255,255,0.2)`, 11px font) — a dev/testing utility, not a feature.

On press:
1. Calls `resetProfile()` → clears AsyncStorage + NULLs `program_start_date` in Supabase
2. Navigates to `/onboarding` via `router.replace`

Cold restart after reset: no AsyncStorage profile, Supabase row has no `program_start_date` → init logic does not reconstruct → `isLoading` resolves with `profile === null` → tab layout redirects to `/auth/sign-in` or onboarding as expected.

---

## The Two-Signal Personalization Model

Everything downstream in TitraHealth — targets, scoring, coaching, AI context — ultimately derives from two inputs that the app now reliably knows:

**Signal 1: Specific medication + where they are in it**
**Signal 2: What phase they're in**

These are not the same thing, and the distinction matters.

### Signal 1 — Medication Identity + Titration Position

Knowing the medication brand (`ozempic`, `zepbound`, `saxenda`, etc.) tells us the pharmacokinetic profile of what's in the patient's body. Different drugs have fundamentally different behavior:

- Semaglutide (Ozempic/Wegovy): 7-day half-life, weekly dosing, peak plasma at ~72h post-injection
- Tirzepatide (Mounjaro/Zepbound): 5-day half-life, weekly dosing, dual GIP+GLP-1 action — stronger appetite suppression, more pronounced insulin sensitivity effect
- Liraglutide (Saxenda): 13h half-life, daily dosing — no forgiveness for missed doses, faster feedback loop, nausea pattern is different
- Oral semaglutide (Rybelsus/oral Wegovy): same molecule as injectable semaglutide but ~1% bioavailability without fasting — the administration behavior is the drug's primary lever

Knowing where they are within that medication — `initialDoseMg`, `doseMg`, `doseStartDate` — tells us their titration position. The gap between where they started and where they are now tells us escalation velocity. A patient on Ozempic at 1.0 mg who started 8 weeks ago is on-schedule. The same patient at 0.25 mg is a slow titrator. The same patient at 2.0 mg is an accelerated escalator. These three patients need different targets and different coaching emphasis even though they're on the same drug.

This titration position is what feeds `getEscalationPhase()` — and that phase is Signal 2.

### Signal 2 — Escalation Phase

The phase isn't just a label. Each phase has a specific clinical meaning:

- **Initiation** — the drug isn't doing much yet. This is a behavioral window: the habits being built now (protein-forward eating, consistent logging, injection routine) are what will anchor the patient when appetite suppression kicks in. Targets here should be achievable and habit-forming, not aggressive.
- **Low/Mid Therapeutic** — appetite suppression is active. This is the plasticity window (roughly weeks 5–16). The behavioral patterns formed during this window have the highest retention rate after medication ends. Targets should push the patient toward their ceiling, not just their floor.
- **High Therapeutic / Max Dose** — the drug is doing the heavy lifting on appetite. The clinical priority shifts to lean mass protection. Protein targets are at their highest. Movement targets emphasize resistance training over cardio. Scoring should weight protein compliance more heavily than calorie compliance at this phase.
- **Maintenance** — the patient is at max dose, weight loss is plateauing or stabilizing. The focus shifts from weight loss behavior to maintenance behavior. Targets should reflect that.

### How These Two Signals Combine to Set Targets

The personalization pipeline looks like this:

```
medication brand + dose + doseStartDate
        ↓
getEscalationPhase(programWeek, doseMg, medicationType)
        ↓
PhaseRow { weeklyFocus, behavioralEmphasis, isPlasticityWindow, ... }
        ↓
getDailyTargets(profile, daysSinceInjection)
        ↓
{ proteinG, fiberG, steps, calories }  ← phase-aware, patient-specific
```

These targets are not static. A patient who is 60 kg vs 100 kg needs different protein targets. A patient in initiation phase needs different step targets than one at max dose. A liraglutide patient who missed yesterday's dose has different recovery coaching than a semaglutide patient who missed theirs. The two signals together — who the drug is and where the patient is in it — are what allow the targets to be precise rather than generic.

### What This Feeds Into: The Scoring System

The targets produced by this pipeline feed directly into the scoring system. The scoring system's job is to:

1. Collect the patient's actual behavioral data (food logs → protein, activity logs → steps, injection logs → adherence)
2. Compare actuals to the personalized targets
3. Map that comparison to a score

The score is only meaningful if the targets it's measuring against are accurate for that specific patient at that specific phase. A generic "eat 120g protein" target scored against a patient who should be at 90g (because they're in initiation phase, low body weight, sedentary) will systematically underperform — the patient can never hit the target, the score stays low, the feedback loop breaks down.

With the two signals correctly captured and persisted:

- **Readiness score** — maps recovery data (HRV, RHR, sleep) against what's expected given the drug's pharmacodynamic effect at this phase. GLP-1s measurably decrease HRV at higher doses — a "low" HRV reading at max dose is different from the same reading at initiation.
- **Routine score** — maps behavioral data (protein, steps, injection adherence) against phase-aware targets. Protein weight is higher at high therapeutic phase. Injection adherence weight is higher for liraglutide users (13h half-life means a miss is more consequential).
- **Composite score** — the weighted output that drives the home dashboard, the weekly check-in baseline, and the AI context snapshot.

### What This Enables Downstream

With these two signals reliably captured, the following downstream features become possible:

**Adaptive target recalibration** — as the patient moves from initiation to therapeutic phase, targets automatically escalate. The patient doesn't need to do anything. The system knows their dose changed (from injection logs) and recomputes.

**Dose escalation prediction** — `doseStartDate` + the brand's titration schedule = when the patient is likely eligible for their next dose increase. This can surface as a reminder, a clinical alert, or an AI coaching prompt.

**Comparative analytics** — because we now store `initialDoseMg` separately from `doseMg`, we can track escalation velocity as a longitudinal metric. Fast escalators may need different GI tolerance coaching. Slow titrators may need reassurance and expectation-setting.

**Cross-medication scoring normalization** — a liraglutide patient at week 3 (max dose for that drug) and a tirzepatide patient at week 3 (still in initiation) are at very different clinical points. The phase engine now correctly identifies them as such, so the scoring system can apply the right weights for each.

**AI coaching personalization** — the context snapshot injected into every AI conversation will now correctly say "Saxenda, 3.0 mg/day, Week 6, Maintenance Phase, daily injection, 13h half-life" instead of "other, 0 mg." Every AI response is grounded in the correct pharmacology.

---

## What This Means for Other Agents

### Context Snapshot / AI Coaching

`lib/context-snapshot.ts` builds the system prompt injected into every AI conversation. It currently reads `profile.medicationBrand` and `profile.glp1Status` — but those were always `'other'` and `'active'` because `mapSupabaseToProfile()` was hardcoding them. Now they'll reflect the user's actual medication. The AI prompt will say "Ozempic 1.0 mg" instead of "other 0 mg".

`initialDoseMg` and `doseStartDate` are now available on the profile and can be added to the context snapshot to give the AI a clearer picture of how far into titration the user is relative to where they started.

### Personalization Engine (`stores/personalization-store.ts`, `lib/personalization.ts`)

The personalization engine uses `getEscalationPhase()` to compute `programWeek`, `weeklyFocus`, and `behavioralEmphasis`. With the expanded phase tables, Saxenda and oral semaglutide users now get clinically accurate weekly focuses and behavioral emphasis — not semaglutide fallback text.

`initialDoseMg` enables a future escalation velocity calculation: how fast is the user titrating relative to the standard schedule? This is a meaningful personalization signal.

### Injection Log Screen

`log-injection.tsx` lets users log injections. It currently pre-fills dose from `profile.doseMg`. It could now also reference `profile.initialDoseMg` to validate that the logged dose is within the expected titration range for their brand — or surface a note when the user logs a dose escalation.

### Phase Engine Callers

Any component that calls `getEscalationPhase(week, dose, type)` — currently `lib/personalization.ts` and `lib/context-snapshot.ts` — now gets correct behavior for all 4 medication types without any changes needed on their end. The dispatch is internal to the phase engine.

### Future: Dose Escalation Reminders

`doseStartDate` + `injectionFrequencyDays` + `initialDoseMg` + the brand's titration schedule = the ability to calculate when the user is due for a dose escalation. A reminders system or push notification could use this to surface: "Based on your Ozempic schedule, you may be ready to discuss a dose increase with your provider in 2 weeks."

---

## Layer 2: Phase-Aware Dynamic Target Pipeline

### What This Layer Does

Layer 1 (above) gave us reliable signal capture: we know the patient's drug, brand, starting dose, current dose, and start date. Layer 2 closes the loop from that classification to actual daily numbers the patient sees. The escalation phase engine already classifies patients correctly into `initiation`, `low_therapeutic`, `mid_therapeutic`, `high_therapeutic`, `high_plus`, and `max_dose`. Layer 2 maps those 6 states to a 3-tier **ProgramPhase** (`initiation` | `titration` | `maintenance`) and uses it to drive differentiated targets for protein, calories, macros, and activity.

### The 3-Tier Mapping

| EscalationPhaseName | ProgramPhase |
|---|---|
| `initiation` | `initiation` |
| `low_therapeutic`, `mid_therapeutic`, `high_therapeutic`, `high_plus` | `titration` |
| `max_dose` | `maintenance` |

This grouping reflects clinical reality: the titration window (any sub-max dose) is when dose escalation is actively happening, appetite suppression is still intensifying, and lean mass loss risk is rising. Once the patient reaches max dose, weight loss plateaus and the goal shifts from aggressive intervention to metabolic adaptation defense.

### Clinical Basis for Phase-Specific Protein Targets

Per 2025 joint guidance from ACLM, ASN, OMA, and TOS for GLP-1 patients:

- **Initiation (1.0× multiplier):** 1.2 g/kg/day. Habit-forming, achievable, not aggressive. Patient is adjusting to the drug.
- **Titration (1.15× multiplier):** ~1.38 g/kg/day before dose-based boosts. Dose escalation suppresses appetite progressively — intentional protein intake is increasingly critical to prevent muscle loss. The multiplier stacks with existing dose-based boosts (sema ≥1.0 mg = +10%, ≥1.7 mg = +15%; tize ≥7.5 mg = +10%, ≥10 mg = +15%).
- **Maintenance (1.25× multiplier):** ~1.5 g/kg/day. At max dose, weight loss is decelerating. Lean mass protection is the primary nutritional goal. Hard cap of 2.0 g/kg/day still applies at all phases.

### How Calories and Macros Close the Loop

Previously, `getDailyTargets()` returned protein, water, fiber, and steps — but no calorie or macro targets. Those are the numbers patients actually see on food trackers. Layer 2 adds:

- **`caloriesTarget`**: Uses the stored `user_goals.daily_calories_target` (TDEE − 500, set at onboarding) for initiation and titration. For maintenance, applies a conservative metabolic adaptation correction: every kg of body weight lost reduces TDEE by ~22 kcal (literature estimate); we apply 10 kcal/kg lost (conservative) to avoid aggressive restriction. Floor: 1,200 kcal/day.
- **`fatG`**: 28% of calories from fat (ACLM guidelines), rounded to integer grams.
- **`carbsG`**: Residual after protein and fat, minimum 50g/day to prevent hypoglycemia risk.
- **`activeCaloriesTarget`**: Activity-level base (sedentary 200, light 300, active 400, very_active 500 kcal) with titration reduction (×0.9 — side effect burden may reduce exercise capacity) and maintenance boost (×1.05 — counter metabolic adaptation).
- **`steps`**: Maintenance phase adds a 10% boost to counter the reduced caloric expenditure at plateau weight.

### The `proteinPriority` Flag

`proteinPriority: boolean` is true when `programPhase === 'titration'`. This flag is designed for downstream consumption by:

1. **Focus ranking** — `generateFocuses()` multiplies the protein deficit score by 1.5 when `programPhase === 'titration'`, ensuring protein surfaces in the top 3 daily focuses even when hydration or fiber deficits are numerically higher. At peak therapeutic dose, this is clinically correct: protein is the single highest-impact daily action.
2. **UI emphasis** — consumers of `PersonalizedPlan` can use `proteinPriority` to render a protein card with elevated visual weight on the home dashboard during titration.
3. **AI coaching** — context snapshot can surface this flag so Claude's coaching responses prioritize protein advice during dose escalation.

### What This Enables Downstream

- **Accurate scoring**: `computeGlp1AdherenceScore()` now operates on protein targets that reflect the actual clinical risk level for that patient at that dose.
- **Coaching articles**: Article recommendations can filter/rank content by `programPhase` — titration patients see protein strategy articles, maintenance patients see metabolic adaptation and weight maintenance content.
- **AI context calibration**: `buildContextSnapshot()` receives enriched targets; the AI sees that this patient is in titration with a 138g protein target (vs initiation's 120g) and calibrates coaching advice accordingly.
- **Progress charting**: `programPhase` is now exposed on `PersonalizedPlan`, enabling the UI to annotate timeline charts at phase transitions.

### Backwards Compatibility

`getDailyTargets()` accepts an optional `opts` parameter. All existing callers that don't pass opts receive `programPhase: 'initiation'` by default — identical behavior to before Layer 2. `generateFocuses()` accepts `programPhase` as an optional 5th argument; existing callers unaffected. No DB migration required.

---

## Layer 3: Rolling Score + Optional HealthKit Ring

### What This Layer Does

Layer 1 gave us reliable signal capture. Layer 2 converted those signals into accurate, phase-aware daily targets. Layer 3 addresses a structural problem in how those targets are scored and displayed: the score was volatile in the wrong ways, the formula ignored phase context during scoring, and the UI punished users who hadn't connected a wearable.

Three specific problems this layer fixes:

1. **Score volatility** — the home screen ROUTINE score was a snapshot of today's data only. One missed injection on a day the user forgot to log dropped the score by 35 points. One meal logged bumped it up 25 points. The score was responding to logging events, not to actual behavior. A patient who had been perfectly adherent for 13 days would see a 40-point score on the 14th because they hadn't logged food yet. This creates a negative feedback loop: low score → discouragement → less engagement → lower score.

2. **Phase-blind scoring** — the scoring formula used hardcoded weights (Medication 35%, SideEffects 25%, Protein 25%, Activity 15%) regardless of where the patient was in treatment. Those weights are appropriate for titration, but wrong for initiation (where GI tolerance establishment matters more than calorie optimization) and wrong for maintenance (where lifestyle sustainability is the primary predictor of long-term outcome). Layer 2 defined these clinical distinctions; Layer 3 closes the loop by wiring them into the score formula.

3. **Wearable dependency** — users without Apple Health connected saw an empty outer ring, a "—" where their readiness score would be, and a "Connect Apple Health to unlock" hint inside the ring area. The design implied the app was incomplete without a wearable. The outer ring arc was always rendered (just empty), which made the UI look broken. For most users, especially early in their journey, wearables are not connected and this framing is discouraging.

---

### What Was Built

#### `computeRollingAdherenceScore()` — `constants/scoring.ts`

A 14-day linear weighted average of per-day adherence scores. Today's score has weight 14. Yesterday's has weight 13. 13 days ago has weight 1. Days where the user logged nothing at all are excluded from the average entirely (a day with no data is not a bad day — it's an absence of signal).

Per-day computation:
1. Slice injection, food, and activity logs to that calendar date
2. If no data at all → skip that day
3. Reconstruct `DailyActuals` (protein, fiber, steps from logs; water hardcoded to neutral 1100 ml since there's no historical water data)
4. Find the last injection on or before that day to compute `daysSinceShot` and `shotPhase`
5. Call `getDailyTargets()` with `programPhase` — same phase-aware targets the live score uses
6. Compute a 7-day side-effect burden window ending that day
7. Call `computeGlp1AdherenceScore()` with phase weights and `proteinPriority`
8. Accumulate weighted score

The result is a score that moves slowly — about 10–15 points per day rather than 40 — and reflects the patient's actual behavioral pattern over the last two weeks, not just whether they've logged anything today.

**The clinical rationale:** Behavioral adherence to a GLP-1 protocol has a compounding effect. The patient who is 80% adherent for 14 days straight is not equivalent to the patient who scored 100% one day and 30% the next 13. The rolling score rewards consistency, which is the actual outcome predictor, not today's logging completeness.

#### `getPhaseWeights()` + `PhaseComponentWeights` — `constants/scoring.ts`

Maps the 3-tier `ProgramPhase` to score component weights:

| Phase | Medication | Side Effects | Nutrition | Activity |
|---|---|---|---|---|
| `initiation` | 45% | 30% | 15% | 10% |
| `titration` | 35% | 25% | 25% | 15% |
| `maintenance` | 30% | 20% | 30% | 20% |

**Initiation weights** — The drug isn't doing much yet. The single most important behavioral action is establishing the injection routine and managing first-exposure GI side effects. Medication adherence at 45% and GI tolerance at 30% reflects this: the score rewards the patient for staying on schedule and not abandoning treatment due to nausea, not for optimizing macros they can barely eat.

**Titration weights** — The default (previously hardcoded). Appetite suppression is active, nutrition compliance is increasingly achievable and increasingly important. Balanced.

**Maintenance weights** — At max dose, injection schedule is established (lower weight needed as a reinforcer), side effects have typically stabilized, and the primary challenge shifts to lifestyle sustainability. Nutrition at 30% and Activity at 20% reflect that this is now a long-term behavior maintenance problem, not a medication tolerance problem.

#### Enhanced `computeSideEffectBurden()` — `constants/scoring.ts`

Updated formula incorporates **frequency** (how many days had effects, not just how severe today's were):

```
days_with_effects / windowDays × 0.4   (frequency component)
+ weighted_avg_severity × 0.6           (severity component)
= burden (0–100)
```

Effect type multipliers:
- GI effects (nausea, vomiting, sulfur_burps): ×1.3 — these are the effects most likely to break adherence
- Low-concern effects (fatigue, hair_loss): ×0.8 — real but less likely to cause treatment discontinuation
- Everything else: ×1.0

The thiamine risk flag (severity ≥6 nausea/vomiting within 72h) is unchanged.

**Why frequency matters:** A patient who had mild nausea every single day for two weeks has a higher functional side effect burden than a patient who had one severe nausea episode and nothing else. The original formula only saw severity — a single severe log produced the same burden as daily moderate logs. This produced under-estimates for patients with chronic low-grade GI symptoms (the most common GLP-1 presentation) and over-estimates for patients who logged a single bad day.

`windowDays` and `refDate` are now optional params, defaulting to 14 days and `Date.now()`. This is what allows the rolling score to call it with a 7-day window and a historical `dayRef` for per-day calculations without changing any existing callers.

#### `computeGlp1AdherenceScore()` — updated — `constants/scoring.ts`

Two new optional params (9th param: `phaseWeights`, 9th param: `proteinPriority`). When provided, replaces hardcoded 35/25/25/15 weights with the phase weights. Protein score gets a 1.5× multiplier when `proteinPriority` is true, capped at 100. All existing callers (no new args) receive identical behavior.

#### `rollingAdherenceScore` on `PersonalizedPlan` — `lib/personalization.ts`

Computed after the daily `adherenceScore` in `computePersonalizedPlan()`. Uses the full log history passed to the orchestrator, so it always reflects the most recent data without additional DB calls. Added to the return object.

The AI context snapshot (`buildContextSnapshot`) now receives `rollingAdherenceScore` as `score.total` instead of `adherenceScore`. This means the AI's view of "how the patient is doing" is the smoothed signal, not today's snapshot. Better calibrated coaching.

#### Optional Wearable Ring — `app/(tabs)/index.tsx`

`DualRingArc` now accepts `appleHealthEnabled: boolean`. When false:

- Only the inner white ring is rendered (no outer orange ring, no empty arc, no background orange arc)
- The READINESS row and its divider are removed from the info panel entirely
- A subtle `"Connect a wearable for recovery insights"` hint sits below the score card at 45% opacity

When true: existing dual-ring behavior is fully preserved.

The ROUTINE score now uses `plan?.rollingAdherenceScore ?? plan?.adherenceScore ?? supportScore`.

---

### How the Three Layers Connect

The three layers are sequential: each one assumes the previous layer's work is correct, and each one would produce wrong outputs if the layer below it was missing.

```
Layer 1: Who is the patient?
         medication brand, route, dose, starting dose, dose start date
                 ↓
Layer 2: What are the correct targets for this patient today?
         escalation phase → ProgramPhase → protein/calorie/macro/activity targets
                 ↓
Layer 3: How well has this patient been hitting those targets, smoothed over time?
         14-day rolling score with phase-aware weights → home dashboard → AI context
```

Without Layer 1, the phase engine gets wrong inputs — a Saxenda patient treated as Ozempic, an oral semaglutide patient with no phase structure. Without Layer 2, the score is measured against generic targets — a patient at max dose getting scored on initiation-phase protein numbers. Without Layer 3, the targets are correct but the measurement is fragile — a patient who had a perfect 13-day run gets penalized for logging nothing at 8am on day 14.

The end state: a patient opens the app, sees a ROUTINE score that reflects two weeks of their real behavior, measured against targets that are calibrated to their specific drug and phase, and if they have a wearable, can also see a READINESS score that captures their physiological recovery state. If they don't have a wearable, the app doesn't look broken — it just shows them what it knows.

### Backwards Compatibility

`computeSideEffectBurden()` new params are optional with defaults matching prior behavior. `computeGlp1AdherenceScore()` new params are optional with defaults producing identical output to all existing callers. `SideEffectEntry` type is now exported (was private) — no behavioral change, purely an accessibility fix. No DB migration required.
