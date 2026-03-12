# TitraHealth — Scoring Framework: Research & Recommended Architecture

**Status:** Research complete — recommendation ready for implementation
**Last Updated:** March 2026
**Research Sources:** 4 parallel deep-research agents covering clinical literature, wearable scoring methodology, nutrition science, and competitor landscape. Full citations inline.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Scoring System Critique](#2-current-scoring-system-critique)
3. [Research Findings: Clinical Literature](#3-research-findings-clinical-literature)
4. [Research Findings: Composite Score Methodology](#4-research-findings-composite-score-methodology)
5. [Research Findings: Nutrition & Lifestyle Evidence](#5-research-findings-nutrition--lifestyle-evidence)
6. [Research Findings: Competitor Landscape](#6-research-findings-competitor-landscape)
7. [Architecture Decision: How Many Scores?](#7-architecture-decision-how-many-scores)
8. [Recommended Score Architecture](#8-recommended-score-architecture)
9. [Partial Data Handling Strategy](#9-partial-data-handling-strategy)
10. [GLP-1 Phase Adjustments (Clinical Evidence)](#10-glp-1-phase-adjustments-clinical-evidence)
11. [Implementation Notes & Migration Path](#11-implementation-notes--migration-path)

---

## 1. Executive Summary

### What the research says about the current system

The current two-score model (Recovery Ring + Readiness Ring) is **directionally correct but has four critical problems:**

1. **Medication is grossly underweighted.** Clinical literature shows medication adherence is the single highest-leverage predictor of GLP-1 outcomes — yet it contributes only 15 points to the current Readiness score. Real-world 1-year persistence is only 32%. The app's #1 clinical job is medication adherence.

2. **Side effects are not scored at all.** No current scoring component represents the patient's side effect burden. Every major GLP-1 trial (STEP, SURMOUNT) tracks side effects as a primary endpoint. Side effects drive 60%+ of early discontinuation. This is the largest clinical gap.

3. **The Recovery score is entirely seed data.** Sleep (443 min), HRV (45ms), RHR (58 bpm), SpO2 (98%) are hardcoded constants — the Recovery ring doesn't reflect any real patient data until HealthKit is wired in.

4. **Fiber scoring is evidence-contra during titration.** The 2024–2025 clinical consensus is that high fiber is counterproductive during dose-escalation (worsens GI side effects). Scoring fiber as a positive during titration is pharmacologically incorrect.

### Recommended Architecture

**Keep 2 rings. Redesign the second ring entirely.**

| Ring | Name | Data Source | What Changes |
|------|------|-------------|--------------|
| Ring 1 (orange) | **Recovery Score** | HealthKit (wearable) | Minor: weight HRV more heavily (30→35 pts), drop SpO2 weight slightly when HRV present |
| Ring 2 (white) | **GLP-1 Adherence Score** | App logs (injections, side effects, food, activity) | Major redesign: medication 35%, side effects 25%, protein 25%, activity 15%. Remove fiber. Reduce hydration to informational only. |

**One new mandatory indicator (not a ring):** A side-effect severity badge/pill on the home screen that shows current clinical burden, phase-contextualized. This does not need to be part of the ring score but must be visually present.

---

## 2. Current Scoring System Critique

### Recovery Score (`computeRecovery` in `constants/scoring.ts`)

**Formula:**
```
Recovery = Sleep×40 + HRV×25 + RHR×20 + SpO2×15 (or 5 if resp rate present)
```

**Evidence assessment:**

| Component | Weight | Evidence Base | Verdict |
|-----------|--------|---------------|---------|
| Sleep | 40 pts | Strong — SURMOUNT-OSA RCT confirms sleep is a direct GLP-1 outcome; sleep deprivation raises ghrelin, blocking GLP-1 efficacy | ✅ Appropriate weight |
| HRV (RMSSD/SDNN) | 25 pts | Strong — but GLP-1 causes −6.2ms SDNN decrease (AJP-Heart wearable study 2024, n=66) and liraglutide RCT showed −33.9ms SDNN (Diabetes Care). Current weight may over-penalize expected medication effects even with phase offsets | ⚠️ Weight OK; phase offset approach is clinically justified but offsets may be too small (+3–6ms, when RCT shows up to −33.9ms) |
| RHR | 20 pts | Moderate — GLP-1 causes +2–4 bpm RHR increase as a class effect (FDA labels for all four drugs). The current −2 to −3 bpm offset is directionally correct but conservative vs RCT data (+8.1 bpm in liraglutide crossover study) | ⚠️ Directionally correct, offsets may need expansion |
| SpO2 | 15 pts | Moderate — tirzepatide is FDA-approved for sleep apnea (Dec 2024, SURMOUNT-OSA). SpO2 is legitimate. But weight of 15 pts is high for a metric most users won't have passively tracked | ⚠️ Reduce to 10 pts; add to HealthKit read list |

**Critical problem:** The entire Recovery score runs on hardcoded seed data (`SEED_WEARABLE` in `contexts/health-data.tsx`). The score is not real until HealthKit is wired into the HealthProvider context.

**Scoring logic quality:** The `scoreSleep()`, `scoreHRV()`, `scoreRHR()`, `scoreSPO2()` curves and the phase offset model (`glp1HrvOffset`, `glp1RhrOffset`) are well-designed and clinically grounded. The framework is sound — the implementation gap is the data feed.

---

### Readiness/Support Score (`computeGlp1Support` in `constants/scoring.ts`)

**Formula:**
```
Readiness = Protein×30 + Hydration×20 + Fiber×15 + Movement×20 + Medication×15
```

**Evidence assessment:**

| Component | Weight | Evidence Base | Verdict |
|-----------|--------|---------------|---------|
| Protein | 30 pts | Strongest evidence in the entire scoring system. 2025 ACLM/ASN/OMA/TOS joint advisory: 1.2–2.0 g/kg adjusted BW/day. Resistance training + protein preserved 60% more lean mass (2024 RCT). Protein is the single highest-impact daily GLP-1 action. | ✅ Keep. Consider raising to 35 pts. |
| Hydration | 20 pts | Weakest evidence. Expert consensus says hydrate, but no GLP-1-specific RCT-level hydration targets exist. GLP-1 suppresses thirst (underappreciated dehydration risk). Target is currently seeded at 1100ml — never updated. | ❌ Remove from scoring. Make informational. Data is fake (seed only). |
| Fiber | 15 pts | Evidence-contra during titration. Multiple clinical guidelines (PMC 2024, TandF 2021, Mayo Clinic Proceedings 2025) explicitly recommend LOW fiber during dose-escalation to avoid worsening GI side effects. | ❌ Remove or invert during titration phase. Counter-productive scoring. |
| Movement | 20 pts | Strong observational evidence. JAMA 2020/2022, Lancet Public Health 2022 meta-analysis: 8,000 steps/day validated all-cause mortality threshold across 15 cohorts. 150 min/week moderate exercise per WHO Dec 2025 GLP-1 guideline. | ✅ Keep at 20 pts (or raise to 25). |
| Medication | 15 pts | Critically underweighted. Real-world 1-year persistence: only 32%. Early response by week 4–12 predicts long-term adherence. Medication adherence is the single highest-leverage metric per all clinical literature reviewed. | ❌ Raise significantly to 35 pts. |

**Also missing:** Side effect burden. No component represents how the patient is feeling on the medication. This is a primary clinical endpoint in all GLP-1 trials and the primary driver of early discontinuation.

---

## 3. Research Findings: Clinical Literature

### 3.1 Side Effect Burden

**No validated GLP-1-specific side effect scale currently exists.** All major trials (STEP 1–4, SURMOUNT 1–4, SELECT) use MedDRA adverse event coding with NCI CTCAE v5.0 severity grades:
- **Grade 1 (Mild):** Asymptomatic or mild, no intervention needed
- **Grade 2 (Moderate):** Minimal intervention indicated
- **Grade 3 (Severe):** Hospitalization or IV hydration required

Key trial incidence data:

| Side Effect | Semaglutide (STEP) | Tirzepatide (SURMOUNT) | Placebo |
|-------------|-------------------|------------------------|---------|
| Nausea | 43.9% | up to 32% | 16.1% |
| Diarrhea | 29.7% | ~23% | 15.9% |
| Vomiting | 24.5% | ~12% | 6.3% |
| Constipation | 24.2% | ~11% | 11.1% |

**98.1% of all GI adverse events are mild-to-moderate.** Only 0.5% are serious.

**Critical timing finding (Rubino et al. 2025, pooled SURMOUNT 1–4):** GI adverse events cluster during dose-escalation periods, not at maintenance dose. This means a side effect score must be indexed to escalation phase, not just time on drug.

**Practical instrument for app use:** A simplified 3-tier severity entry per symptom (None / Mild / Moderate / Severe) maps directly to CTCAE grading and has face validity. This is what clinical trials measure. No app currently implements it.

**Sources:**
- Wharton 2022 (GI tolerability STEP 1–4), PubMed 34514682
- Rubino 2025 (SURMOUNT pooled), DOM doi:10.1111/dom.16176
- Frontiers Endocrinology 2026 — managing nausea in GLP-1 obesity therapies

---

### 3.2 Medication Adherence

**Real-world persistence in adults with obesity (no diabetes):**
- At 180 days: **46.3%**
- At 1 year: **32.3%**
- PDC ≥ 80% at 1 year: **27.2%**

By drug at 1 year:
- Semaglutide: highest at **47.1%** persistence
- Liraglutide: lowest at **19.2%** persistence

**Once-weekly is 11% less likely to be non-adherent** than daily dosing (meta-analysis, PubMed 33527605).

**Early response predicts adherence:** Weight or HbA1c reduction by weeks 4–12 is independently associated with higher long-term adherence (PMC10397904). The app can surface this milestone actively.

**Clinical standard:** PDC ≥ 80% = adherent. The app should track this internally and show streak/consistency visually.

**Sources:**
- PMC11293763 (real-world persistence, obese non-diabetic adults)
- PubMed 33527605 (weekly vs daily meta-analysis)
- PMC10397904 (early response and adherence)

---

### 3.3 Injection Cycle Pharmacodynamics

**Semaglutide PK profile:**
- Tmax: 24–77.8 hours, central estimate ~72 hours (day 3 post-injection)
- Half-life: 145–165 hours (~7 days)
- Steady state: achieved at ~4–5 weeks

**The weekly symptom cycle (mechanistically established, not formally validated as a named framework):**

| Days Post-Injection | Drug Level | Expected Pattern |
|--------------------|------------|------------------|
| Day 1 (injection day) | Rising | Injection logging, starting absorption |
| Days 2–3 | Rising toward peak | Nausea peaks (mediated by area postrema GLP-1 receptors), max appetite suppression |
| Day 4–5 (peak phase) | At or near Tmax | Maximum GI side effect burden, maximum efficacy |
| Days 5–6 | Beginning to fall | Side effects improving, appetite partially returning |
| Day 7 (trough/due) | Falling toward trough | Lowest drug level, lowest side effect burden, next dose approaching |

**Tirzepatide Tmax is 8–72 hours (shorter than sema)** — sharper peak explains higher nausea incidence in comparative trials despite lower overall GI burden in SURMOUNT vs STEP.

**Implication for scoring:** The GLP-1 Adherence Score should be phase-aware. Nausea severity on day 3 is expected and should not penalize the score. But nausea severity on day 7 (trough) is unusual and clinically meaningful.

**Sources:**
- PMC9272494 (semaglutide PK)
- PMC11215664 (semaglutide PK systematic review)

---

### 3.4 HRV and RHR as GLP-1 Pharmacodynamic Markers

**The core study:** "Heart and health behavior responses to GLP-1 receptor agonists: a 12-wk study using wearable technology" — AJP-Heart (Dec 2024, PMID 39705534, n=66).

**Quantified findings:**
- HRV decrease (SDNN): **−6.2 ± 1.4 ms**
- RHR increase: **+3.2 ± 0.8 bpm**
- Causal inference: RHR increase is mediated by HRV decrease (parasympathetic withdrawal)
- Physical activity partially offsets the RHR increase

**Liraglutide RCT (Diabetes Care, PMID 27797930):** More extreme effects in a controlled crossover study (n=27, CAD+T2D patients):
- SDNN: **−33.9 ms** (p<0.001)
- Mean HR: **+8.1 bpm** (p=0.003)
- Reduced HF power (−0.7 log-ms²; p=0.026)

**Mechanism:** GLP-1 receptor activation in cardiac vagal neurons depresses parasympathetic tone (PMC3002870). This is a direct pharmacodynamic effect, not a fitness or health decline.

**Current phase offset values (±3–6ms HRV, ±2–3 bpm RHR)** are directionally correct but conservative relative to the evidence. The liraglutide RCT suggests effects could be 5–8× larger in sensitive patients. The wearable study's ±1.4ms SD indicates high inter-individual variability.

**Design implication:** The phase adjustment should be framed not as a precise correction but as a qualitative safeguard: scores during peak phase should not be penalized for HRV/RHR changes within expected clinical range, and the user should see a clear explanation that this is a known medication effect.

---

## 4. Research Findings: Composite Score Methodology

### 4.1 How Consumer Wearables Build Their Scores

**WHOOP Recovery:**
- Inputs: HRV (RMSSD), RHR, respiratory rate, sleep performance
- Weights: HRV dominates ("the algorithm's biggest input is HRV... RHR and sleep are most of the time redundant to HRV")
- Methodology: Normalizes each metric against the user's personal 30-day rolling baseline
- Key design: Adaptive weights — if HRV has been volatile 3+ days, its weight temporarily increases
- Categories: Green (67–100%), Yellow (34–66%), Red (0–33%)

**Oura Readiness:**
- 9 contributors across two temporal windows
- Overnight (acute): RHR, body temperature, recovery index, sleep score, sleep regularity, previous day activity
- Long-term (trend, 14-day weighted avg): HRV Balance, Sleep Balance, Activity Balance
- Key design: "Balance" contributors compare recent to long-term baseline — sensitive to *change*, not absolute levels

**Garmin Body Battery:**
- Continuous energy accounting model (not daily snapshot)
- Replenishment: HRV during sleep (primary), sleep quality, recovery periods
- Depletion: Activity intensity, continuous stress score
- Uses Firstbeat Technologies HRV algorithm — the most transparent scientific basis in wearables

**2025 Doherty & Altini Systematic Review (DOAJ, 14 composite health scores evaluated):**
- Most common inputs: HRV (86%), RHR (79%), physical activity (71%), sleep duration (71%)
- **None of 14 manufacturers disclose their exact formulas**
- Few provide empirical validation or peer-reviewed evidence
- Conclusion: "While composite health scores represent a promising innovation, their scientific validity, transparency, and clinical applicability remain uncertain."

### 4.2 The Double-Counting Problem

Marco Altini (HRV researcher, DOAJ 2025 co-author): "Poor sleep often lowers HRV, so if both sleep and HRV are included separately, the same stressor may influence the score more than once, amplifying its effect."

Sleep and HRV are correlated inputs. When both degrade simultaneously (e.g., a bad night's sleep), a composite score that includes both can produce a severely deflated score from what is a single underlying event. This is the most important methodological problem with multi-input composite scores.

**Mitigation options:**
1. Use HRV OR sleep as the primary input, not both at equal weight (WHOOP approach — HRV dominates)
2. Use "balance" comparison (Oura approach — recent vs. baseline avoids amplification)
3. Accept the correlation and frame it as: "both are low because recovery was poor" — the correlation is signal, not noise

For TitraHealth, approach 3 is pragmatic: keep both sleep and HRV in the Recovery score (clinically motivated by the SURMOUNT-OSA sleep apnea data and the AJP-Heart HRV pharmacodynamics data), but document the correlation and ensure users see explanatory text, not just a number.

### 4.3 Partial Data Handling

Four dominant patterns in production systems:

| Pattern | Description | When to Use |
|---------|-------------|-------------|
| **Score Suppression** | Don't show score if below data completeness threshold | WHOOP: requires minimum sleep wear time. Best for clinical trust. |
| **Conditional Scoring + Confidence Indicator** | Compute score, flag with data completeness indicator | Medium data — show score but label confidence |
| **LOCF (Last Observation Carried Forward)** | Use previous value for short gaps in trend metrics | HRV Balance, Sleep Balance — gaps of ≤2 days |
| **Adaptive Exclusion** | Drop missing metric, renormalize remaining weights | Garmin: runs on activity + daytime HRV when sleep data unavailable |

**Critical psychological finding:** Users who receive **deflated feedback** (score lowered by missing data) show worse mood, lower self-esteem, and worse dietary behavior. This is strong evidence **against penalizing users for not logging a metric** — the score should assume the population median for missing inputs, not 0.

**The "X of Y" approach** (e.g., "Score based on 3 of 5 inputs") has no published controlled trial evidence — the literature identifies it as a genuine research gap. The safer approach is to show a grey/muted state for missing contributors with a prompt to unlock them, rather than a numerical data completeness label.

### 4.4 Single vs. Multi-Domain Scores

**Research synthesis:**
- **For engagement:** A single headline number creates a cleaner goal-gradient effect and reduces cognitive load
- **For behavior change:** Component scores are needed to identify which behavior to target
- **For clinical utility:** CMS guidelines state "composite measures must be used in conjunction with component measures to find opportunities for improvement"
- **Best practice:** A hybrid model — one headline with drilldown domain scores — is validated by both the behavioral science literature and the Noom real-world engagement data (D30 retention 43.6%, 10× industry average)

**BRIGHT Trial finding (JAHA 2024):** Task completion rate (logging injection, articles, coach interaction) was more predictive of clinical outcomes than composite physiological scores. This is the strongest evidence that **behavioral adherence metrics should anchor the score**, not physiological readouts.

---

## 5. Research Findings: Nutrition & Lifestyle Evidence

### 5.1 Protein (Strongest evidence component)

**2025 Joint Advisory (ACLM/ASN/OMA/TOS, published AJCN):**
- Target: **1.2–2.0 g/kg adjusted body weight/day** during active weight reduction
- Minimum floor: 0.4–0.5 g/kg/day (below this: muscle atrophy and functional impairment)
- Practical absolute target: **80–120 g/day**
- Distribution: 25–30 g per meal (even distribution increased muscle protein synthesis 25% vs skewed intake)

**Lean mass loss by drug:**
- Semaglutide (STEP 1): ~40–45% of total weight lost is lean mass
- Tirzepatide (SURMOUNT-1): ~26% of total weight lost is lean mass

**Resistance training effect:** A 2024 RCT found GLP-1 users doing resistance training preserved **60% more lean mass** than non-exercising patients.

**Endocrine Society ENDO 2025:** "Consuming more protein may protect patients taking anti-obesity drugs from muscle loss" — protein intake was directly associated with attenuated lean mass loss.

**Scoring implication:** Protein is the single most clinically validated nutrition metric for GLP-1 patients. It should have the highest weight in any lifestyle scoring component.

### 5.2 Physical Activity

**Step count evidence (strongest observational data):**
- JAMA 2020 (Saint-Maurice et al.): 8,000 steps/day vs 4,000 → significantly lower all-cause mortality (HR ~0.49–0.51)
- Lancet Public Health 2022 (meta-analysis, 15 cohorts): mortality benefit plateaus at **8,000–12,000 steps/day**
- JACC 2023: curvilinear dose-response — even 1–2 days/week at 8,000+ steps reduced CVD/all-cause mortality

**GLP-1-specific exercise guidance:**
- WHO Dec 2025 global GLP-1 guideline: minimum **150 min/week moderate-intensity exercise**
- Frontiers in Clinical Diabetes 2025: exercise should be prioritized alongside GLP-1 therapy for synergistic lean mass, cardiometabolic, and long-term maintenance effects
- 8,000 step target is an extrapolation from general population mortality data — no GLP-1-specific step RCT exists, but the evidence quality is strong

### 5.3 Sleep

**SURMOUNT-OSA (NEJM 2024):** Tirzepatide reduced AHI by **62.8%** vs 6.4% placebo. FDA-approved for OSA Dec 2024. Sleep is a direct GLP-1 treatment outcome.

**Hormonal mechanism (multiple studies):** Sleep deprivation → elevated ghrelin + reduced leptin + reduced afternoon GLP-1 levels. Ghrelin systemically blocks GLP-1 satiety signaling — a sleep-deprived patient on semaglutide is pharmacologically working against their medication.

**Japanese observational study (PMC 2025):** First direct evidence that sleep improvement during GLP-1 treatment (oral semaglutide) was associated with improved weight reduction outcomes.

**Scoring implication:** 7+ hours is the validated threshold. Sleep scoring in the Recovery ring is clinically justified, not just fitness-motivated.

### 5.4 Hydration

**Evidence quality: Low for specific targets.**
- Clinical consensus: increase fluid intake, especially during titration
- Mechanism: GLP-1 suppresses thirst signals centrally — users are at silent dehydration risk
- No GLP-1-specific RCT for hydration targets. General adult guidelines (~2–2.5L/day) are applied by clinicians
- Practical guidance: small sips, 1 hour before/after meals (not during — worsens nausea)

**Scoring implication:** Do not score hydration as a primary component. Show as an informational metric only (data is fake seed anyway). Replace in the scoring formula with a more evidence-backed metric.

### 5.5 Fiber

**Evidence: Nuanced and phase-dependent — currently scored incorrectly.**

During titration/dose-escalation:
- Multiple clinical guidelines (PMC 2024, TandF 2021, Mayo Clinic Proceedings 2025) explicitly recommend **avoiding high-fiber foods** as they worsen GI side effects
- GLP-1 slows gastric emptying — fiber further slows transit, compounding nausea and bloating
- Scoring fiber positively during dose-escalation is clinically incorrect

During maintenance (stable dose, minimal side effects):
- Fiber for constipation management: first-line intervention
- Fiber for gut microbiome health: reasonable guidance
- General population guidelines (25–35g/day) apply

**Scoring implication:** Remove fiber as a positive-scoring component. Either: (a) remove entirely, or (b) make it phase-aware (neutral during escalation, positive during maintenance). Option (a) is simpler.

---

## 6. Research Findings: Competitor Landscape

### 6.1 Market Overview (2024–2026)

- GLP-1 market: **$62.8 billion in 2025**, projected to reach **$325 billion by 2035**
- Companion app market: projected to grow **10× to $20B revenue uplift by 2029** (Research2Guidance)
- ~300 active companion apps today, projected **3,000+ by 2029** as FDA PDURS regulatory pathway opens
- UK NHS has already launched a tender for a GLP-1 companion app

### 6.2 Competitor Composite Score Analysis

| App | Composite Score | Components | Notes |
|-----|----------------|------------|-------|
| **WeightWatchers (GLP-1 Med+)** | ✅ Yes — "Weight Health Score" 0–100 | Nutrition consistency, Movement (≥150min/wk), Sleep (≥7h), Weekly weigh-in | Only app with a documented daily composite score. Launched Dec 2025. |
| **Noom GLP-1 Companion** | ❌ No user-facing score | Tracks engagement internally. Lesson completion + meal logging drive algorithm | Most-engaged users lose 25.2% more weight. D30 retention: 43.6% (10× industry avg) |
| **Shotsy** | ❌ No composite score | PK medication level model, injection tracking, side effect log | Market leader for injection tracking. Unique: estimated circulating drug level chart |
| **Calibrate** | ❌ No score | 4 pillars: food, sleep, exercise, emotional | Coach-centric; no numeric patient score |
| **Found** | ❌ No score | Community + AI Q&A | No numeric tracking scores |
| **MeAgain** | ❌ No score | Injections, side effects, nutrition, weight, photos | All-in-one but no composite |

### 6.3 What No Current App Does

These are genuine product differentiation opportunities:

1. **Pharmacokinetic-aware scoring** — adjusting expected side effects, behavioral targets, and score weights to the injection cycle phase (days 1–7)
2. **Medication-weighted composite score** — medication adherence as 30–35% of a composite score (not WW's 25% on weigh-in habit)
3. **Side effect burden as a scored clinical component** — CTCAE-aligned 3-tier severity entry per symptom, feeding into the composite score
4. **HRV as GLP-1 pharmacodynamic marker** — using HealthKit HRV not just as fitness recovery but as a visible indicator of medication activity, with phase context
5. **Lean mass preservation index** — protein + resistance training specifically calibrated to preserve lean mass during GLP-1-driven weight loss
6. **Food noise tracking** — no app tracks this GLP-1-specific quality-of-life metric (65–80% of users report significant food thought reduction)

### 6.4 FDA PDURS Regulatory Tailwind

The FDA's expected Prescription Drug Use-Related Software (PDURS) model allows pharmaceutical companies to pair software with their drugs on the label for approved patient outcome indications. Noom updated its app specifically to prepare for this (Jan 2025). This means **validated scoring methodology tied to clinical trial endpoints** (IWQOL-Lite-CT, CTCAE) is a strategic requirement, not just UX. TitraHealth's scoring system should be designed to defensibly reference these clinical instruments.

---

## 7. Architecture Decision: How Many Scores?

### Option A: Two Rings (Current — Redesigned)

| Ring | Name | Score |
|------|------|-------|
| Orange | Recovery | Wearable: sleep + HRV + RHR + SpO₂ |
| White | GLP-1 Adherence | App logs: medication + side effects + protein + activity |

**Pros:** Minimal UI change. Current ring visual works. Proven two-domain framework (analogous to WHOOP Strain + Recovery).
**Cons:** Medication and lifestyle compete in the same ring.

### Option B: Three Rings

| Ring | Name | Score |
|------|------|-------|
| Orange | Recovery | Wearable data |
| White | Medication | Injection adherence + side effects |
| New color | Lifestyle | Protein + activity |

**Pros:** Separates clinical (medication/side effects) from behavioral (protein/steps). Cleaner signal.
**Cons:** Three rings is cognitively heavier. Apple Watch "Activity Rings" works at 3 but is universally known. For a niche app, 3 rings may be overwhelming.

### Option C: Two Rings + One Standalone Indicator

| Element | Name | Score |
|---------|------|-------|
| Orange ring | Recovery | Wearable: sleep + HRV + RHR + SpO₂ |
| White ring | Lifestyle | Protein + activity + medication |
| Pill/badge | Side Effect Index | Current severity level (not in ring) |

**Pros:** Keeps ring visual familiar. Makes side effects a dedicated visual element without burying them in a ring component.
**Cons:** Side effects feel secondary if not in the ring.

### Recommendation: **Option A (Two Rings, Redesigned)**

Rationale:
- The ring visual is already built and users understand it
- Medication (35%) + side effects (25%) combined = **60% of Ring 2** — medication is effectively the dominant signal
- A separately displayed side effect severity indicator (the "phase pill" on the home screen header) handles the clinical visibility need without a third ring
- This matches WW's approach (one composite + components) and is most consistent with the BRIGHT trial finding that behavioral engagement metrics predict outcomes better than physiological metrics

---

## 8. Recommended Score Architecture

### Ring 1: Recovery Score (0–100) — Wearable-Gated

**Data source:** HealthKit (iOS) / Health Connect (Android). If no wearable data available: show "—" (suppressed), not a score computed from seeds.

**Formula:**

```
Recovery = Sleep×40 + HRV×35 + RHR×15 + SpO₂×10
```

Note: Raise HRV weight from 25→35 (matches WHOOP finding that "HRV dominates"), reduce RHR from 20→15 and SpO₂ from 15→10.

**Component scorers (keep existing `scoreSleep`, `scoreHRV`, `scoreRHR`, `scoreSPO2` curves — they are clinically reasonable):**

```
scoreSleep(minutes):
  7–9h (420–540 min) → 1.0    [optimal]
  6–7h (360–420 min) → 0.75   [acceptable]
  5–6h (300–360 min) → 0.50   [below goal]
  >9h (540–600 min)  → 0.85   [slightly long]
  <5h or >10h        → linear decline to 0

scoreHRV(ms):  [Ln RMSSD or SDNN — Ln RMSSD preferred]
  ≥60ms → 1.0
  ≥50ms → 0.9
  ≥40ms → 0.75
  ≥30ms → 0.55
  ≥20ms → 0.35
  <20ms → 0.10

scoreRHR(bpm):
  <55 → 1.0
  <65 → 0.85
  <75 → 0.65
  <85 → 0.40
  ≥85 → 0.15

scoreSPO2(pct):
  ≥98% → 1.0
  ≥96% → 0.80
  ≥94% → 0.50
  ≥90% → 0.20
  <90%  → 0.0
```

**GLP-1 Phase Adjustments (apply before scoring, display raw values unchanged):**

| Phase | Days Post-Injection | HRV Offset | RHR Offset | Notes |
|-------|--------------------|-----------|-----------|----|
| shot | Day 1 | +3ms | −2 bpm | Drug absorption beginning |
| peak | Days 2–4 | +6ms | −3 bpm | Tmax ~72h; maximum HRV suppression |
| balance | Days 5–6 | +2ms | −1 bpm | Levels declining |
| reset | Day 7 | 0 | 0 | Trough; expected baseline |

*Offsets are conservative relative to RCT data (liraglutide: −33.9ms, +8.1 bpm). They are not corrections — they are protections against false negative scoring of a normal pharmacological effect. Expand if user feedback indicates chronic under-scoring during peak phase.*

**Data availability rules:**

| Data Available | Score Behavior |
|----------------|----------------|
| All 4 metrics | Full score, all components shown |
| Sleep only (no HRV/RHR) | Score = `Sleep×80 + SPO₂×20` (renormalized). Show HRV/RHR as grey/locked. |
| HRV + RHR, no sleep | Score = `HRV×55 + RHR×35 + SPO₂×10`. Flag sleep as missing with unlock prompt. |
| Nothing from HealthKit | Score suppressed. Show "Connect Apple Health to unlock Recovery" CTA. |
| < 4 hours sleep tracked | Suppress sleep component. Score on HRV + RHR + SpO₂ if available. |

---

### Ring 2: GLP-1 Adherence Score (0–100) — App Log-Gated

**Data source:** App logs (injection_logs, side_effect_logs, food_logs, activity_logs). This ring is about what the user *does*, not what their body passively reports.

**Formula:**

```
Adherence = Medication×35 + SideEffectManagement×25 + Protein×25 + Activity×15
```

#### Component 1: Medication (35 pts max)

```
medicationScore = injectOnTime×20 + streakBonus×10 + onCycleBonus×5

injectOnTime (0–20 pts):
  Injection logged on scheduled day          → 20 pts
  Logged 1 day late (within window)          → 15 pts
  Logged 2–3 days late                       → 8 pts
  Logged 4–5 days late (last valid day sema) → 3 pts
  Not logged / >5 days late                  → 0 pts

streakBonus (0–10 pts):
  Current injection streak:
    ≥8 consecutive on-time injections        → 10 pts
    ≥4 consecutive                           → 6 pts
    ≥2 consecutive                           → 3 pts
    1 (current)                              → 0 pts

onCycleBonus (0–5 pts):
  Injection logged within 12h of scheduled time → 5 pts
  Logged on scheduled day but >12h off          → 2 pts
  Other                                         → 0 pts
```

*Rationale: Medication adherence is the single highest-leverage outcome predictor (real-world 1-year persistence: 32%). Early injection logging by week 4 predicts long-term adherence. The streak mechanic drives this behavior. The 5-day window aligns with Ozempic/Wegovy FDA label guidelines.*

#### Component 2: Side Effect Management (25 pts max)

Side effect management is an **inverse burden score** — lower side effects = higher score — but **phase-contextualized** so expected post-injection nausea does not penalize the score.

```
sideEffectScore = 100 - (phaseAdjustedBurden × 100)

phaseAdjustedBurden = rawBurden × phaseTolerance

rawBurden = weighted average severity of logged symptoms:
  None     → 0
  Mild     → 0.25   [CTCAE Grade 1]
  Moderate → 0.60   [CTCAE Grade 2]
  Severe   → 1.0    [CTCAE Grade 3]

phaseTolerance (reduces expected burden during normal peak phase):
  Phase: shot  → multiply burden by 0.6  (early rising, some nausea expected)
  Phase: peak  → multiply burden by 0.4  (peak drug conc, nausea expected)
  Phase: balance → multiply burden by 0.8
  Phase: reset → multiply burden by 1.0  (trough; side effects unusual here)

Lookback window: last 7 days (not just today)
If no side effects logged: score = 75 (neutral, not penalized for absence)
If side effects logged with all None: score = 100
```

*Rationale: Side effects drive 60%+ of early GLP-1 discontinuation. There is no validated GLP-1-specific PRO instrument (Frontiers Endocrinology 2026 confirms this gap). The CTCAE 3-tier grading used in all major trials maps directly to None/Mild/Moderate/Severe entry. Phase-weighting ensures expected post-injection nausea on day 2–3 doesn't devastate the score. The 75-point neutral default for no logs prevents penalizing patients who are asymptomatic and don't log side effects.*

#### Component 3: Protein (25 pts max)

```
proteinScore = min(1.0, actualProtein / proteinTarget) × 100

proteinTarget = dynamic based on profile:
  Base: weight_lbs × 0.73  [≈ 1.6 g/kg adjusted BW — midpoint of 1.2–2.0 g/kg range from 2025 joint advisory]
  If tirzepatide: × 1.1    [tirzepatide-specific higher lean mass preservation support]
  If dose ≥ 7.5mg: × 1.15
  If semaglutide + dose ≥ 1.7mg: × 1.1

Cap: no penalty beyond 100% (eating more protein than target is fine)
If no food logs today: score = 0 (conservative — but show grey with "Log meals to track protein" prompt, not a red indicator)
```

*Rationale: 2025 ACLM/ASN/OMA/TOS joint advisory establishes 1.2–2.0 g/kg adjusted BW/day as the evidence-based range. Tirzepatide users have better lean mass preservation per SURMOUNT-1, but still need intentional protein targets. Even distribution across meals (25–30g/meal) increased muscle protein synthesis 25% — future enhancement could score meal-level protein distribution.*

#### Component 4: Activity (15 pts max)

```
activityScore = min(1.0, steps / stepsTarget) × 70
              + min(1.0, exerciseMinutes / 30) × 30

stepsTarget = activity-level adjusted:
  sedentary  → 6,000 steps
  light      → 8,000 steps
  active     → 10,000 steps
  very_active → 12,000 steps

exerciseMinutes = today's logged activity_logs duration

Data source priority:
  1. HealthKit step count (passive — best)
  2. activity_logs.steps (manually logged)
  3. If neither: score = 0 (show grey "Track activity" prompt)
```

*Rationale: 8,000 steps is validated by 15-cohort meta-analysis as the all-cause mortality threshold. WHO Dec 2025 global GLP-1 guideline specifies 150 min/week moderate exercise. Activity is secondary to medication and protein for GLP-1 outcomes specifically (Noom data: meal logging is stronger engagement predictor than activity logging).*

---

### Removed Components

| Component | Old Weight | Reason for Removal |
|-----------|-----------|-------------------|
| Hydration | 20 pts | No GLP-1-specific RCT hydration targets. Data is fake seed (1100ml, never updated). Show as informational metric only with general reminder. |
| Fiber | 15 pts | Clinically counterproductive during titration/dose-escalation. Multiple guidelines recommend LOW fiber during active GI side effects. Remove from scoring; add education note instead. |

---

### Side Effect Index (Standalone Indicator — Not a Ring)

The side effect component score should also feed a **standalone clinical indicator** on the home screen — a status pill/badge that shows the current side effect burden clearly without requiring the user to tap into the ring breakdown. This addresses the user requirement to "emphasize the clinical/medication piece more."

```
sideEffectIndex: {
  level: 'none' | 'mild' | 'moderate' | 'severe'
  phaseNote: string     // "Expected at day 3" or "Unusual for trough week — consider logging"
  primarySymptom: string // "Nausea" or "Constipation" — the most severe current symptom
  daysActive: number    // How many days the current level has persisted
}
```

Display:
- Green pill: "No symptoms" or "Mild — Day 3 expected"
- Yellow pill: "Moderate" with primary symptom
- Red pill: "Severe" with prescriber contact prompt if CTCAE Grade 3 equivalent

---

## 9. Partial Data Handling Strategy

### Design Principles (evidence-based)

1. **Never penalize absence.** The psychological research on deflated feedback is clear: users shown they're underperforming (even artificially) eat worse, feel worse, and disengage. Assume population median for missing inputs.

2. **Suppress rather than degrade.** When data completeness is below a meaningful threshold, show a suppressed state ("Connect Health app") rather than a falsely low score.

3. **Show contributor states visually.** Grey/locked indicators with unlock CTAs are more motivating than numerical data completeness labels ("3/5 inputs"). The latter has no evidence base and may cause confusion.

4. **LOCF for short gaps.** For trend-based metrics (7-day rolling HRV average), carry the last valid observation forward for gaps ≤ 2 days. Flag gaps > 2 days as stale.

### Full Data Availability Matrix

| Scenario | Recovery Score | Adherence Score | Notes |
|----------|---------------|-----------------|-------|
| Full HealthKit + full app logs | Full both | Full both | Ideal state |
| HealthKit connected, no food logs | Full Recovery | Medication (35) + Activity via HK (15) = 50/100 max possible | Grey protein component with CTA |
| No HealthKit, full app logs | Recovery suppressed ("Connect Apple Health") | Full Adherence score | Common early-user state |
| No HealthKit, no food logs | Recovery suppressed | Medication-only (35 pts max) + Activity (0) | Minimal logging state. Show score as "Medication Score" not "Adherence Score" |
| No injection logged (new user) | — | Side effects (75 neutral) + Protein + Activity = 40/100 max | Show injection CTA prominently |
| Partial day (morning only) | Depends on HK overnight data | Full available | Mid-day scores are always partial; note "Updates throughout the day" |

### Missing Data Defaults

| Input | Default if Missing | Rationale |
|-------|-------------------|-----------|
| Injection log | 0 pts (not neutral) | Absence of logging is clinically significant. Show prominent CTA. |
| Side effect log | 75 pts (neutral) | Absence may mean asymptomatic — do not penalize |
| Protein log | 0 pts | Absence means no meal tracking. Show grey CTA, not penalty language. |
| Activity log / steps | 0 pts from manual; HealthKit if available | HealthKit passive data is preferred |
| HealthKit sleep | Suppress sleep component; score on other wearable data | Per WHOOP suppression pattern |
| HealthKit HRV | Drop from composite; score on RHR + SpO₂ + sleep if available | Per Garmin adaptive exclusion pattern |

---

## 10. GLP-1 Phase Adjustments (Clinical Evidence)

### Phase Model (justified by PK data)

| Phase | Days Post-Injection | Drug Level | Clinical Pattern | Score Adjustments |
|-------|--------------------|-----------|-----------------|--------------------|
| **shot** | Day 1 | Rising | Injection day. Low drug level initially. Absorption begins. | HRV +3ms, RHR −2bpm |
| **peak** | Days 2–4 | At/near Tmax (~72h) | Maximum nausea/GI burden, maximum appetite suppression, maximum HRV suppression | HRV +6ms, RHR −3bpm. Side effect CTCAE tolerance 0.4 |
| **balance** | Days 5–6 | Declining | Side effects reducing, appetite partially returning | HRV +2ms, RHR −1bpm. Side effect tolerance 0.8 |
| **reset** | Day 7 | Near trough | Lowest drug level. Next injection approaching. | No adjustments |

### Phase-Aware UI Messages

The phase label on the home screen header should update to reflect this model:

```
Day 1:     "Shot Day · Injection logged"
Day 2:     "Peak Phase · Day 2 — Some nausea is expected"
Day 3:     "Peak Phase · Day 3 — Drug at maximum"
Day 4:     "Peak Phase · Day 4"
Day 5–6:   "Balance Phase · Day 5/6 — Side effects should be easing"
Day 7:     "Reset Phase · Day 7 — Injection due tomorrow"
Overdue:   "Injection Overdue — Consider logging your dose"
```

### Tirzepatide vs. Semaglutide Phase Differences

Tirzepatide's Tmax is 8–72 hours (vs. 24–77.8h for semaglutide). The sharper concentration peak means:
- Nausea onset is earlier (hours 8–24 rather than 24–48)
- The "peak phase" may start at Day 1–2 rather than Day 2–3
- Consider a drug-specific phase calculator: if medication = tirzepatide, shift peak phase start by −1 day

---

## 11. Implementation Notes & Migration Path

### Current Code Files to Modify

| File | Change Required | Priority |
|------|----------------|----------|
| `constants/scoring.ts` | New `computeGlp1Adherence()` replacing `computeGlp1Support()`. New `SideEffectIndex` type and `computeSideEffectIndex()`. Updated weights in `computeRecovery()`. | P0 |
| `contexts/health-data.tsx` | Remove `SEED_WEARABLE` — replace with null/undefined defaults. Wire HealthKit store into wearable state. Add partial-data logic (suppression, adaptive exclusion). Add `sideEffectIndex` to context value. | P0 |
| `stores/healthkit-store.ts` | Feed live HK data into `health-data.tsx` context (currently fetched but not wired to scoring). | P0 |
| `app/(tabs)/index.tsx` | Add Side Effect Index pill to home screen header. Update ring labels from "READINESS" to "ADHERENCE". Handle suppressed score state for Recovery when no HealthKit. | P1 |
| `stores/log-store.ts` | Ensure side effect logs include per-symptom severity + timestamp for score computation. | P1 |
| `app/score-detail.tsx` | Update breakdown rows to reflect new component weights. Add "Why is this component grey?" explanations for missing data. | P2 |

### New Types Needed

```typescript
// In constants/scoring.ts

export type SideEffectSeverity = 'none' | 'mild' | 'moderate' | 'severe';

export type SideEffectIndex = {
  level: SideEffectSeverity;
  phaseNote: string;
  primarySymptom: string | null;
  daysActive: number;
  score: number; // 0–100
};

export type AdherenceBreakdown = {
  total: number;           // 0–100
  medication: number;      // 0–35
  sideEffects: number;     // 0–25
  protein: number;         // 0–25
  activity: number;        // 0–15
  dataCompleteness: {      // which inputs were available
    injectionLogged: boolean;
    sideEffectsLogged: boolean;
    foodLogged: boolean;
    stepsAvailable: boolean;
  };
};

// Update RecoveryBreakdown to include data availability
export type RecoveryBreakdown = {
  total: number | null;    // null = suppressed (no wearable data)
  sleep: number | null;
  hrv: number | null;
  rhr: number | null;
  spo2: number | null;
};
```

### Migration: Backward Compatibility

The existing `computeScore()` in `insights-store.ts` (the old 4-pillar score) should be **deprecated** once the new two-ring system is fully implemented. It is not shown on the home screen but may be referenced in the log/insights tab. Mark it as deprecated and route callers to the new functions.

### Phase 2 Enhancements (after HealthKit wired)

Once real wearable data flows:
1. **Baseline calibration:** Compute the user's personal 30-day rolling baseline for HRV and RHR (Oura/WHOOP approach). Score relative to personal baseline, not population norms. This is more actionable and reduces false negatives for users with naturally low/high HRV.
2. **LOCF for HRV trend:** Implement the 7-day rolling RMSSD average (Ln RMSSD). Compare daily value to 7-day average for the trend signal (Kubios/Altini validated approach).
3. **SpO2 sleep apnea tracking:** Trend SpO2 over time as a SURMOUNT-OSA outcome proxy. Show improvement as a non-scale victory.

### Food Noise Tracker (Unmet Clinical Need — Future)

No app currently tracks food noise (intrusive food-related thoughts). GLP-1 reduces this in 65–80% of users. A 1–5 daily tap rating (added to side effects logging or as a standalone 1-tap prompt on home screen) would be a genuine clinical differentiator. This feeds into wellbeing scoring in a future Phase 3.

---

## Summary: Before and After

| | Current System | Recommended System |
|-|----------------|-------------------|
| Ring 2 name | "READINESS" | "ADHERENCE" |
| Medication weight | 15% | 35% |
| Side effects | Not scored | 25% (CTCAE-aligned, phase-adjusted) |
| Protein weight | 30% | 25% |
| Hydration weight | 20% | Removed (informational) |
| Fiber weight | 15% | Removed (counterproductive during titration) |
| Activity weight | 20% | 15% |
| HRV weight in Recovery | 25% | 35% (HRV dominates per evidence) |
| Recovery data | Hardcoded seed | HealthKit-gated (suppress if no data) |
| Partial data | Penalizes absence (0 for unlogged) | Population median for missing, suppression for wearable, grey CTA prompts |
| Phase model | 4 phases (Shot Day/Peak/Mid/Waning/Due/Overdue) | 4 phases with PK-based boundaries, drug-specific Tmax offsets |
| Side effect index | Not present on home screen | Standalone clinical pill on home screen header |

---

*Research conducted March 2026. Clinical findings, API availability, and package maintenance status should be re-verified at implementation time. All scoring weights represent the research team's evidence-based interpretation — individual clinician review is recommended before production deployment.*
