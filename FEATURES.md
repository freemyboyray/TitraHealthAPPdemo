# TitraHealth — Advanced Features & Integrations Roadmap

**App:** GLP-1 Companion for users on Ozempic, Wegovy, Mounjaro, Zepbound
**Stack:** React Native 0.81.5 · Expo SDK 54 · Expo Router 6 · TypeScript
**Last Updated:** March 2026

This document covers every significant feature category beyond the current build, including consumer integrations, clinical data pipelines, AI capabilities, behavioral science mechanics, social determinants of health, and the full package ecosystem needed to build them. Each section includes specific technical implementation guidance for the Expo/RN stack.

---

## Table of Contents

1. [Consumer Wearable & Health Platform Integrations](#1-consumer-wearable--health-platform-integrations)
2. [Continuous Glucose Monitoring (CGM)](#2-continuous-glucose-monitoring-cgm)
3. [Body Composition & Smart Scales](#3-body-composition--smart-scales)
4. [Food, Nutrition & Barcode Scanning](#4-food-nutrition--barcode-scanning)
5. [Clinical & Healthcare Integrations](#5-clinical--healthcare-integrations)
6. [Social Determinants of Health (SDOH)](#6-social-determinants-of-health-sdoh)
7. [Mental Health & Neurological Tracking](#7-mental-health--neurological-tracking)
8. [Women's Health Features](#8-womens-health-features)
9. [Advanced Biomarkers & Cardiovascular Monitoring](#9-advanced-biomarkers--cardiovascular-monitoring)
10. [AI & Machine Learning Features](#10-ai--machine-learning-features)
11. [Medication Management & Clinical Adherence](#11-medication-management--clinical-adherence)
12. [Behavioral Science & Engagement Mechanics](#12-behavioral-science--engagement-mechanics)
13. [Provider & Care Team Integration](#13-provider--care-team-integration)
14. [React Native / Expo Package Ecosystem](#14-react-native--expo-package-ecosystem)
15. [Oral GLP-1 Support](#15-oral-glp-1-support)
16. [Drug Interaction & Safety Alerts](#16-drug-interaction--safety-alerts)

---

## 1. Consumer Wearable & Health Platform Integrations

### 1.1 Apple HealthKit (iOS)

**Clinical Relevance for GLP-1 Users:** HealthKit is the single highest-leverage integration for the Lifestyle Effectiveness Score. Steps, sleep stages, resting heart rate, HRV, and body weight can all be read passively without any manual user logging, directly populating the exercise, recovery, and weight sub-scores.

**Key GLP-1-specific finding:** A 12-week wearable study (2024, *American Journal of Physiology*) found that GLP-1 RA users had resting heart rate 6.2 ms lower HRV and significantly increased RHR compared to controls — meaning the app can use HealthKit HR/HRV data not just for fitness tracking but as a direct biomarker of GLP-1 pharmacodynamic effect.

**Data Types to Pull:**
| HealthKit Type | Identifier | Relevance |
|---|---|---|
| Steps | `HKQuantityTypeIdentifierStepCount` | Exercise sub-score |
| Active Energy | `HKQuantityTypeIdentifierActiveEnergyBurned` | Calorie burn |
| Resting HR | `HKQuantityTypeIdentifierRestingHeartRate` | GLP-1 effect marker |
| HRV (SDNN) | `HKQuantityTypeIdentifierHeartRateVariabilitySDNN` | Recovery sub-score |
| Sleep Analysis | `HKCategoryTypeIdentifierSleepAnalysis` | Recovery sub-score (stages: REM, deep, core) |
| Body Weight | `HKQuantityTypeIdentifierBodyMass` | Progress tab |
| Body Fat % | `HKQuantityTypeIdentifierBodyFatPercentage` | Lean mass tracking |
| VO2 Max | `HKQuantityTypeIdentifierVO2Max` | Fitness improvement over time |
| Blood Glucose | `HKQuantityTypeIdentifierBloodGlucose` | Synced from CGM apps |
| Dietary Protein | `HKQuantityTypeIdentifierDietaryProtein` | Food log cross-check |
| Dietary Fiber | `HKQuantityTypeIdentifierDietaryFiber` | GI side effect management |
| Blood Pressure | `HKCorrelationTypeIdentifierBloodPressure` | Cardiovascular progress |
| Menstrual Flow | `HKCategoryTypeIdentifierMenstrualFlow` | Women's health module |
| Mindful Minutes | `HKCategoryTypeIdentifierMindfulSession` | Stress/mental wellness |

**Implementation:**
- **Primary package:** `@kingstinct/react-native-healthkit` — TypeScript-native, Nitro Modules-based, actively maintained, Expo managed workflow compatible with config plugin
- **Alternative:** `react-native-health` (AE Studio) — broader adoption but being rewritten in Swift; requires bare workflow or custom dev client
- **Expo Managed Workflow:** Requires custom development build (not Expo Go); add config plugin to `app.json`
- **Background delivery:** HealthKit supports background delivery for real-time updates; requires `enableBackgroundDelivery()` on each data type
- **Permissions model:** Each data type requires explicit user consent shown in a native HealthKit sheet

**Priority: P0** — Implement before any other wearable integration.

---

### 1.2 Google Health Connect (Android)

**Overview:** Android's equivalent of HealthKit, introduced in Android 13 and built into the OS in Android 14+. Required for GLP-1 companion parity on Android.

**Available Data Types (mirrors HealthKit):** Steps, sleep, heart rate, HRV, body weight, body fat, calories, nutrition data, blood glucose, blood pressure, SpO2.

**Implementation:**
- **Package:** `react-native-health-connect` (maintained by matinzd) with `expo-health-connect` config plugin
- **Expo setup:** Add to `app.json` plugins; requires `compileSdkVersion 34`, `targetSdkVersion 34`, `minSdkVersion 26`
- **Cannot be tested in Expo Go** — requires custom development build
- Health Connect is part of Android Framework from Android 14 (API 34) onward; older devices need the standalone Health Connect app installed

**Priority: P0** — Build in parallel with HealthKit for cross-platform parity.

---

### 1.3 Oura Ring

**Clinical Relevance:** Oura's readiness score is a composite of HRV, resting HR, sleep quality, and body temperature. For GLP-1 users, this directly maps to the "recovery" sub-score in the Lifestyle Effectiveness Score. The medication causes predictable weekly cycles of side effects (nausea peaks ~24–48h post-injection), which Oura's readiness score will reflect — enabling injection-phase correlation analysis.

**API Details:**
- **Base URL:** `https://api.ouraring.com/v2`
- **Auth:** OAuth 2.0 (Authorization Code + PKCE flow) — no partner program required for personal data
- **Membership requirement:** Gen 3 and Ring 4 users without active Oura Membership can no longer access their data through the API (as of 2025)
- **Key endpoints:**
  | Endpoint | Data |
  |---|---|
  | `/usercollection/daily_readiness` | Readiness score (0–100), HRV balance, recovery index, resting HR |
  | `/usercollection/daily_sleep` | Sleep score, total sleep, sleep efficiency, REM/deep/light durations |
  | `/usercollection/daily_activity` | Activity score, steps, active calories, sedentary time, met_minutes |
  | `/usercollection/heartrate` | Minute-level HR data |
  | `/usercollection/daily_spo2` | SpO2 average |
  | `/usercollection/daily_stress` | Stress balance score, daytime stress, recovery time |
  | `/usercollection/daily_resilience` | Long-term resilience score |
  | `/usercollection/vo2_max` | VO2 max estimate |
- **No webhooks** — polling required; daily data is best fetched at app open
- **No official React Native SDK** — use standard `fetch` with OAuth 2.0 PKCE via `expo-auth-session`

**Priority: P1** — High user overlap with GLP-1 population (biohacker-adjacent early adopters).

---

### 1.4 WHOOP

**Clinical Relevance:** WHOOP's Strain and Recovery scores are ideal for GLP-1 users who are exercising more as they lose weight. The Strain score helps ensure users aren't overtraining on top of GLP-1 side effect days. Recovery score correlates directly with readiness for physical activity.

**API Details:**
- **Developer portal:** `developer.whoop.com` — publicly accessible, free to join (requires WHOOP device + membership)
- **Auth:** OAuth 2.0 with per-user access and refresh tokens
- **Developer limit:** Up to 5 apps per developer account
- **Key endpoints:**
  | Endpoint | Data |
  |---|---|
  | `/developer/v1/cycle` | Strain score, kilojoules, average/max HR, daytime recovery status |
  | `/developer/v1/recovery` | Recovery score (%), HRV (RMSSD ms), resting HR, SpO2, skin temperature |
  | `/developer/v1/sleep` | Sleep performance %, disturbances, stages, need, debt |
  | `/developer/v1/workout` | Workout strain, sport ID, duration, HR zone breakdown |
- **Implementation:** REST polling via `fetch`; OAuth via `expo-auth-session`

**Priority: P2** — Niche but passionate user segment.

---

### 1.5 Fitbit Web API

**API Details:**
- **Auth:** OAuth 2.0 (now under Google)
- **Data:** Steps, sleep, heart rate, weight, food log, body fat, active minutes
- **Concern:** Post-Google acquisition (2021), Fitbit API access has become increasingly restricted. Some endpoints have been deprecated. Long-term availability is uncertain.
- **Recommendation:** Prioritize Google Health Connect over Fitbit API for Android users going forward

**Priority: P3** — Declining ecosystem; use Health Connect instead where possible.

---

### 1.7 Samsung Health

**Status:** Samsung Health SDK is available for Android but is not publicly open — requires Samsung partnership application. Data is increasingly accessible via Google Health Connect on Samsung devices, which is the recommended path.

**Priority: P3** — Route through Health Connect instead.

---

## 2. Continuous Glucose Monitoring (CGM)

**Why CGM is the most clinically unique integration for TitraHealth:**
GLP-1 receptor agonists work primarily by enhancing glucose-dependent insulin secretion and reducing glucagon. Blood glucose response is the *direct pharmacodynamic readout* of the medication working. No other consumer health app category has a more direct reason to incorporate CGM data than a GLP-1 companion.

**Key glucose metrics for GLP-1 users:**
- **Time in Range (TIR):** % of readings 70–180 mg/dL; target >70%
- **Mean Glucose:** Trending down as medication takes effect
- **Glucose Variability (CV%):** Reduces as GLP-1 improves insulin sensitivity; target <36%
- **Post-meal spikes:** GLP-1s blunt the post-prandial spike — visible in CGM data as medication takes effect
- **Fasting glucose trend:** Steady decrease over weeks/months

---

### 2.1 Dexcom API (Official)

**Access model:** Requires applying to Dexcom Strategic Partnerships for API access. Not a self-serve developer program — requires business justification and Dexcom approval.

**API Details (V3):**
- **Rate limit:** 60,000 calls/app/hour
- **Auth:** OAuth 2.0
- **Supported devices:** G6, G7, G7 15-day, Dexcom ONE, ONE+
- **Key endpoints:**
  - `GET /v3/users/self/egvs` — Estimated Glucose Values (historical, 5-min intervals)
  - `GET /v3/users/self/events` — Exercise, meals, insulin events logged by user
  - `GET /v3/users/self/devices` — Device and sensor info
  - `GET /v3/users/self/statistics` — Aggregate stats (mean glucose, TIR, GMI)

**Implementation path:** Apply for partnership → OAuth flow → REST API via `fetch` + token storage in `expo-secure-store`

---

### 2.2 Dexcom Share (Unofficial)

An undocumented but widely-used API used by Nightscout and third-party apps that reads from the Dexcom Share real-time sharing feature. Provides near-real-time glucose readings (~5-min latency).

- **npm package:** `dexcom-share-api` — lightweight JS wrapper
- **Risk:** Unsupported by Dexcom; may break without notice
- **Use case:** Rapid prototyping or early beta before official partnership

---

### 2.3 Abbott FreeStyle Libre / LibreLink Up

**Access model:** Abbott does not have a public developer API as of 2026. However:
- Libre CGM data flows into **Apple Health** via the LibreLink app on iOS — readable by third-party apps via HealthKit's `HKQuantityTypeIdentifierBloodGlucose`
- **LibreView** (the cloud platform) has a partner API but requires direct partnership with Abbott

**Practical approach:** Read Libre glucose data through HealthKit — no direct API partnership required. This covers the majority of use cases for consumer GLP-1 users.

---

### 2.4 Nightscout (Open-Source CGM Middleware)

Nightscout is an open-source personal diabetes data platform. CGM users (especially T1D patients also on GLP-1s) may self-host a Nightscout instance as a data aggregator.

- **REST API:** `GET /api/v1/entries` — returns glucose entries with timestamps
- **Auth:** Optional API key
- **Use case:** Power-user integration; allow users to enter their Nightscout URL in settings
- **Implementation:** Simple REST fetch; no OAuth required

---

### 2.5 Stelo (Dexcom OTC CGM)

Stelo is the first FDA-cleared over-the-counter CGM (no prescription needed), launched by Dexcom in 2024. Targeting the exact GLP-1 user population (non-diabetic adults managing weight and metabolic health).

- **Data access:** Stelo data flows into Apple Health and Dexcom app; accessible via HealthKit `HKQuantityTypeIdentifierBloodGlucose`
- **Direct API:** Not yet available (routes through Dexcom developer program)

**Strategy:** HealthKit glucose data capture covers Stelo, Libre, and Dexcom G6/G7 without any direct CGM partnership. This is the recommended starting point.

---

### 2.6 CGM Display Recommendations

For the Progress tab, display:
- **Glucose sparkline** — 24-hour glucose trace (line chart, green band for 70–180 mg/dL range)
- **TIR ring** — similar to Apple Watch Activity rings
- **Post-meal overlay** — show glucose spike 0–2h after each logged meal to close the feedback loop between food choices and GLP-1 effectiveness
- **Injection phase correlation** — overlay glucose curve with injection day marker to visualize pharmacodynamic effect

---

## 3. Body Composition & Smart Scales

**Why body composition matters more than weight alone for GLP-1 users:**
Research from 2024–2025 shows that 26–40% of weight lost on GLP-1s comes from lean mass (muscle + bone). Tracking weight alone creates a misleading picture. A user who loses 20 lbs but 8 lbs of that is muscle is in a worse metabolic position than the scale suggests. Body fat % + lean mass trending over time is the only way to know if the high-protein, resistance-training protocol is preserving muscle.

---

### 3.1 Withings Health Mate API

**Body composition data available (Body+, Body Comp, Body Scan scales):**
- Weight, BMI, body fat %, muscle mass, bone mass, visceral fat index
- Body Scan adds: nerve health index (ECG), vascular age, arterial stiffness
- Water %, segmental body composition (Body Scan)

**API Details:**
- **Developer portal:** `developer.withings.com` — free public API registration
- **Auth:** OAuth 2.0
- **Key measurement types:**
  - `meastype=1` — Weight (kg)
  - `meastype=6` — Body fat %
  - `meastype=76` — Muscle mass (kg)
  - `meastype=88` — Bone mass (kg)
  - `meastype=170` — Visceral fat index
- **Webhook support:** Yes — Withings pushes new measurements to a registered URL
- **Implementation:** OAuth via `expo-auth-session`; webhook requires Supabase edge function backend

**Priority: P1** — High clinical value; clean REST API; no partner approval needed.

---

### 3.2 InBody Scale Integration

InBody makes clinical-grade body composition analyzers (used in hospitals and gyms). Consumer models (InBody Dial, InBody H20N) are increasingly popular.

**Integration options:**
- **LookinBody Web API:** Server-side REST API for pulling InBody measurement results; requires API key setup through InBody USA portal (paid service)
- **Bluetooth SDK:** InBody provides a mobile SDK for direct BLE connection to home-use devices, available for React Native/iOS/Android
- **Terra API:** Third-party aggregator (`tryterra.co`) that handles InBody OAuth and data normalization alongside 60+ other health platforms

**Priority: P2** — Niche but high-value for serious users.

---

### 3.3 Bluetooth Smart Scale (Generic BLE)

Many smart scales (Xiaomi, Renpho, Eufy, Etekcity) broadcast body composition data over BLE without any cloud API.

- **Package:** `react-native-ble-plx` — BLE library for React Native (Expo bare workflow or custom build)
- **Protocol:** Scales broadcast data via GATT characteristics; each brand has a custom protocol requiring reverse-engineering (open-source projects document protocols for popular models)
- **Use case:** Allow users with non-Withings/InBody scales to still get body composition data

**Priority: P3** — Complex; pursue after name-brand scale APIs.

---

### 3.4 Apple Health Body Composition Data

HealthKit stores `HKQuantityTypeIdentifierBodyFatPercentage`, `HKQuantityTypeIdentifierLeanBodyMass`, and `HKQuantityTypeIdentifierBodyMass` from any app that writes to it (Withings, InBody, Renpho, Apple Watch). Reading this via HealthKit is the zero-effort path to body composition data without any direct scale integration.

**Recommendation:** Read body composition from HealthKit first; offer direct Withings/InBody OAuth for users who want more detail.

---

## 4. Food, Nutrition & Barcode Scanning

### 4.1 Nutritionix API

**Overview:** The largest restaurant + branded food database (1.9M+ items, 202K+ restaurant menus, 991K+ grocery foods).

**Key endpoints:**
- `POST /v2/natural/nutrients` — Natural language food parsing: `"3 oz grilled salmon with asparagus"` → structured nutrition data
- `GET /v2/search/instant` — Type-ahead food search with branded results
- `POST /v2/natural/exercise` — Natural language exercise parsing for activity logging
- `GET /v2/item?upc={barcode}` — Barcode lookup

**Pricing (2025):** No longer free. Starter plan $299/month; enterprise from $1,850/month. Free tier removed due to abuse.

**Recommendation:** Use Nutritionix for restaurant/natural language parsing (highest-value use case). Supplement with USDA for home cooking and Open Food Facts for barcode scanning (both free) to minimize costs.

**Priority: P1** — Required for the "DESCRIBE FOOD" and "SEARCH FOOD" entry methods.

---

### 4.2 USDA FoodData Central API

**Free, no authentication required.**

- **Base URL:** `https://api.nal.usda.gov/fdc/v1`
- **Best database types for this app:**
  - **SR Legacy** — Standard Reference, whole foods (chicken breast, broccoli, oats)
  - **Foundation Foods** — Most complete nutrient profiles
  - **Branded Foods** — ~1M branded grocery products (UPC barcode lookup available)
- **Key nutrient IDs:** Protein (1003), Fiber (1079), Total Fat (1004), Carbohydrates (1005), Calories (1008)
- **No cost:** Free API key from `fdc.nal.usda.gov`

**Priority: P1** — Primary data source for home cooking; free.

---

### 4.3 Open Food Facts API

**Overview:** Open-source, 4M+ products database (as of 2025), community-contributed. Best for barcode scanning of packaged foods, particularly in international markets.

**Key features for GLP-1 users:**
- **Nutri-Score (A–E):** Overall nutritional quality score
- **NOVA group (1–4):** Ultra-processed food classification — GLP-1 users should minimize NOVA group 4 foods (ultra-processed) as they undermine medication effectiveness
- **Additives list:** Flagging potentially problematic additives

**Key endpoint:**
- `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json`

**Cost:** Completely free and open-source.

**Use case in TitraHealth:** When user taps "SCAN FOOD" → camera scans barcode → query Open Food Facts → show nutrition + Nutri-Score + NOVA group + a contextual nudge if NOVA 4 ("Ultra-processed foods can blunt GLP-1 effectiveness")

**Priority: P1** — Required for "SCAN FOOD" entry method; free.

---

### 4.4 Edamam Food Database API

- **Strengths:** Excellent recipe analysis, meal planning, semantic food search
- **Pricing:** Freemium (limited free tier)
- **Best use case:** Recipe ingredient analysis for home cooking entries

**Priority: P3** — Nice to have for recipe logging.

---

### 4.5 Passio Nutrition AI SDK

**Overview:** Purpose-built nutrition AI SDK with a dedicated React Native package. Combines image recognition, barcode scanning, voice logging, and a nutrition database in one SDK.

**React Native package:** `@passiolife/nutritionai-react-native-sdk-v3`
- **Requirements:** React Native ≥ 0.68; iOS 13+; Android minSdkVersion 26
- **Features:** Camera food recognition, barcode scan, text search, voice logging, nutrition data
- **Pricing:** Credit-based model; contact for pricing
- **Use cases in TitraHealth:**
  - "CAPTURE FOOD" — point camera at plate, get nutrition breakdown
  - "DESCRIBE FOOD" — voice/text input processed by AI
  - "SCAN FOOD" — barcode scanning with nutrition data

**Note on Expo managed workflow:** Requires `pod install` on iOS and native build — custom dev client needed.

**Priority: P1** — Best single-SDK solution for multiple food logging entry methods (camera + barcode + text + voice).

---

### 4.6 AI Vision Food Logging (Claude / GPT-4o)

**GPT-4o Vision approach:**
- User takes a photo → encode as base64 → send to OpenAI Vision API with a structured prompt
- Prompt template: `"Analyze this food image. Return JSON: {foods: [{name, quantity_g, calories, protein_g, carbs_g, fat_g, fiber_g}]}"`
- Accuracy: Good for recognizable restaurant dishes; struggles with home-cooked mixed dishes
- Cost: ~$0.003–0.01 per image analysis
- Latency: 2–5 seconds

**Claude Vision approach:**
- Equivalent capability using Anthropic's `claude-sonnet-4-6` with vision
- Potential advantage: More natural language follow-up ("How much protein would this have if I added more chicken?")

**Hybrid recommended approach:** Passio SDK for quick, structured recognition; Claude/GPT-4o for complex meals or description-based logging where user provides context.

---

### 4.7 Camera & Barcode Scanning — Package Decision

**expo-camera (built into Expo SDK 54):**
- Supports barcode/QR scanning natively
- Cannot scan GS1 DataBar barcodes (less common but exists on some food products)
- Updates follow Expo SDK release cadence (~3x/year)
- Simplest integration for managed workflow

**react-native-vision-camera v4:**
- Most versatile and actively maintained barcode scanner
- Supports all barcode symbologies including GS1 DataBar
- Requires native build (compatible with Expo custom dev clients)
- Supports frame processors (needed for real-time food recognition with Passio SDK)
- **Required** if using Passio SDK (Passio's camera integration is built on VisionCamera)

**Recommendation:** Use `react-native-vision-camera` v4 with the Passio SDK — one camera component handles photo capture, real-time food recognition, and barcode scanning. Use `expo-camera` only as a fallback for users who decline the full SDK.

---

### 4.8 GLP-1 Specific Food Metrics (Beyond Standard Macros)

Based on clinical evidence, track these additional fields for GLP-1 users:

| Metric | Why It Matters for GLP-1 |
|---|---|
| Meal timing (time of day) | GLP-1s slow gastric emptying; late-night meals increase nausea risk |
| Eating speed (meal duration) | Eating too fast on GLP-1s causes nausea; track meal start/end time |
| NOVA group | Ultra-processed foods reduce GLP-1 effectiveness |
| Anti-nausea foods flag | Ginger, bland foods, cold foods — helpful on shot day |
| Soft/liquid meal flag | Useful on high-side-effect days |
| Protein per meal | GLP-1s reduce appetite; users must distribute protein across meals for muscle preservation |

---

## 5. Clinical & Healthcare Integrations

### 5.1 SMART on FHIR / Apple Health Records

**Overview:** Apple Health can aggregate FHIR R4 health records from Epic, Cerner, Meditech, and hundreds of other EHR systems via patient-authorized OAuth. Third-party apps can read these records from HealthKit's `ClinicalRecord` types.

**Lab results relevant to GLP-1 users (FHIR Observation resources):**

| Lab Test | LOINC Code | GLP-1 Relevance |
|---|---|---|
| HbA1c | `4548-4` | Primary T2D outcome marker; decreases on GLP-1 |
| Fasting glucose | `76629-5` | Improves within weeks of starting |
| LDL Cholesterol | `2089-1` | Often improves on GLP-1 |
| Triglycerides | `2571-8` | Significantly reduced by GLP-1s |
| HDL Cholesterol | `2085-9` | Increases on GLP-1 |
| eGFR | `33914-3` | Kidney function — important for T2D patients |
| ALT (liver enzyme) | `1742-6` | GLP-1s improve fatty liver (NAFLD/NASH) |
| Systolic BP | `8480-6` | GLP-1s reduce blood pressure |
| Body weight | `29463-7` | Progress tracking |

**Implementation for Apple Health Records:**
- Request `HKClinicalTypeIdentifierLabResultRecord` permission
- Parse FHIR JSON resources from HealthKit
- Display lab trends alongside weight/score timeline in Progress tab
- Overlay HbA1c improvements with medication milestones

**Epic on FHIR (direct integration):**
- Developer sandbox: `open.epic.com` — no EHR partnership required for sandbox
- SMART on FHIR OAuth registration available for patient-facing apps
- Scopes: `patient/Observation.read`, `patient/MedicationRequest.read`, `patient/Condition.read`

**Priority: P2** — Extremely high clinical value; moderate implementation complexity.

---

### 5.2 CommonHealth (Android FHIR Health Records)

Android equivalent of Apple Health Records, used on non-Google Android devices (Samsung, etc.). Supports FHIR R4 records from health systems.

- **Package:** `react-native-common-health` (community-maintained)
- **Priority: P3** — Build after iOS Health Records integration.

---

### 5.3 GoodRx API

**Relevance:** GLP-1 medications are extremely expensive ($900–$1,400/month list price). Insurance coverage varies wildly. GoodRx integration lets users find the best cash pay price at nearby pharmacies, directly addressing the #1 adherence barrier.

- **API:** GoodRx Affiliate API (requires partner application)
- **Use case:** On the Medication tab — show cheapest GLP-1 price at pharmacies near user's location
- **Implementation:** `GET /drugs/prices?name=semaglutide&zip={userZip}` → display pharmacy list with prices

**Priority: P2** — High user value; directly addresses medication cost barrier.

---

### 5.4 Pharmacy Refill Reminders

**Approach without an API:** Calculate refill date from injection frequency + prescription quantity in `userStore`. Schedule a local push notification (via `expo-notifications`) 7 days before estimated run-out.

**No external API required** for basic functionality. More advanced: deep-link into pharmacy apps (CVS, Walgreens, Amazon Pharmacy) via app URL schemes.

**Priority: P1** — Can be implemented without any external API.

---

## 6. Social Determinants of Health (SDOH)

**Why SDOH matters for a GLP-1 app:**
Research published in *The Lancet* (2025) found that the main limitation of access to semaglutide and tirzepatide is economic — insurance coverage is variable and out-of-pocket costs are high. Studies show significant disparities: adjusted odds ratios for receiving semaglutide prescriptions were 0.8 for Black patients, 0.6 for Hispanic patients, and 0.6 for NH/PI patients compared to White patients. Neighborhood deprivation index and vacant address percentage in a neighborhood significantly predict lower GLP-1 prescription rates.

TitraHealth has an opportunity to be explicitly equity-aware — not just tracking health behaviors but contextualizing them against the user's real-world environment.

---

### 6.1 CDC PLACES API

**What it provides:** Local health outcome estimates at the ZCTA (zip code), census tract, county, and city level — including obesity rates, diabetes prevalence, physical inactivity rates, and access to care metrics.

**2025 Release:** ZCTA-level and census tract data available via Socrata Open Data API.

**API endpoint:**
```
GET https://data.cdc.gov/resource/qnzd-25i4.json?locationname={zip_code}
```

**Use cases in TitraHealth:**
- Contextual benchmarking: "In your area, 38% of adults have obesity — you're working against the grain, and that's commendable"
- Identify users in high-deprivation areas where specialized support messaging is warranted
- Aggregate anonymized app data against PLACES data for population health insights (if provider dashboard is built)

**Privacy approach:** Request zip code during onboarding (not GPS); use ZCTA-level data only; never expose individual SDOH scores to the user in a stigmatizing way.

---

### 6.2 Walk Score API

**What it provides:** Walkability score (0–100), transit score, and bike score for any US address or lat/lng.

**Relevance:** Walkability directly predicts step count potential. A user in a Walk Score 20 (car-dependent suburban area) needs different exercise recommendations than a Walk Score 90 (urban walker). The app should adjust step goals and suggestion copy based on the user's built environment.

**API:** REST API at `api.walkscore.com` — requires API key (free tier available for low volume).

**Use cases:**
- Adjust default step goal: Walk Score <40 → suggest 6,000 steps; Walk Score >70 → suggest 10,000 steps
- "Today's Focus" cards: high walkability → "20 min neighborhood walk"; low walkability → "15 min treadmill or indoor walk"
- Show walkability score in user profile with context

---

### 6.3 USDA Food Access Research Atlas API

**What it provides:** Census-tract-level food desert classification — identifies areas where >1/3 of the population lives >1 mile from a supermarket (urban) or >10 miles (rural).

**API:** USDA ERS Geospatial REST API — free and open.

**Use cases:**
- If user is in a food desert: surface "healthy eating on a budget" content in Education tab; suggest online grocery delivery; adjust nutrition recommendations to use more shelf-stable proteins (canned fish, legumes, protein powder)
- Avoid recommending fresh produce-heavy meal plans to users without realistic access

**Privacy:** Use zip code or allow user to manually indicate food access challenges.

---

### 6.4 Area Deprivation Index (ADI)

**What it provides:** Neighborhood-level socioeconomic deprivation index based on 17 census-derived indicators (income, education, employment, housing quality). Published by University of Wisconsin.

**API/Data:** Available for download by state from `neighborhoodatlas.medicine.wisc.edu`; can be preprocessed into a local lookup table.

**Use case:** Identify users in high-deprivation areas (ADI decile 8–10) to:
- Proactively surface medication cost assistance resources (patient assistance programs, GoodRx)
- Adjust lifestyle recommendations to be more resource-realistic
- Flag higher churn risk (SDOH barriers correlate with medication discontinuation)

---

### 6.5 Weather API (Contextual Activity Suggestions)

**Relevance:** Weather directly affects outdoor activity, which is the most accessible exercise for GLP-1 users. "Today's Focus" cards should be weather-aware.

**API:** OpenWeatherMap API (free tier: 1,000 calls/day)

**Use cases:**
- Raining / extreme heat → "Indoor resistance training" focus card instead of walk
- Post-injection day + hot weather → hydration warning (GLP-1 nausea + heat = high dehydration risk)
- Beautiful weather day → prompt outdoor activity with extra motivation

**Implementation:** `GET https://api.openweathermap.org/data/2.5/weather?zip={zip}&units=imperial`

---

### 6.6 Health Equity Score (Composite)

**Proposed feature:** A contextual layer in the app that combines SDOH signals to produce an internal "contextual difficulty score" — used to calibrate the Lifestyle Effectiveness Score, not shown to the user directly.

Logic: A user in a food desert with low walkability getting 7,500 steps/day and meeting protein goals is performing at a higher effective level than the raw numbers suggest. The scoring algorithm should account for environmental barriers so users in harder circumstances see their relative progress validated.

---

## 7. Mental Health & Neurological Tracking

**Clinical background:**
GLP-1 receptors are expressed throughout the brain, including the hypothalamus, hippocampus, and brainstem. This explains both the appetite suppression ("food noise" reduction) and the emerging psychiatric effects. Research findings as of 2025:

- **Food noise reduction:** ~65–80% of GLP-1 users report significant reduction in obsessive food thoughts — one of the most impactful quality-of-life benefits, distinct from weight loss
- **Depression:** Evidence is mixed; some studies show protective effect, others show increased risk. A large 2024 pharmacovigilance study found GLP-1 users had increased risk of major depression reporting; however, meta-analyses of RCTs do not show increased suicidal behavior
- **Anxiety:** 11% of adverse event reports are anxiety-related; but some users report reduced anxiety (especially eating-disorder-adjacent anxiety around food)
- **Addiction reduction:** Emerging evidence that GLP-1s reduce alcohol consumption, drug cravings, and compulsive behaviors — GLP-1 receptors in the nucleus accumbens (reward center) are implicated
- **Cognitive function:** Some users report improved cognitive clarity ("brain fog" lifting); emerging research on GLP-1s for Alzheimer's prevention (Phase 3 trials ongoing)

---

### 7.1 Mood & Mental Wellness Tracking

**Feature: Daily mood check-in**
- Display on Home screen as a frictionless one-tap input (5 emoji faces or color gradient)
- Clinical standard: PHQ-2 (2-question depression screener) monthly; GAD-2 (anxiety) monthly
- Track correlation between mood and: injection day, protein intake, sleep quality, side effect severity
- **Data model addition:**
  ```typescript
  type MoodEntry = {
    timestamp: string;
    valence: 1 | 2 | 3 | 4 | 5;        // sad → happy
    energy: 1 | 2 | 3 | 4 | 5;          // exhausted → energized
    foodNoise: 1 | 2 | 3 | 4 | 5;       // GLP-1 specific: intensity of food thoughts
    notes?: string;
  };
  ```

**Feature: Food Noise Tracker**
Unique to GLP-1 apps. Daily 1–5 rating of food thought intensity. Correlate with: dose week (noise decreases after injection, creeps back before next dose), dose level (higher doses → lower food noise), and lifestyle factors. This data point would be uniquely valuable and is tracked by no other consumer app.

**Feature: Emotional eating pattern tracking**
When logging food, optional tag: "hungry" / "emotional" / "social" / "habit" / "bored". Does not require meal timing judgment — just a single-tap tag. Build correlation report between emotional eating tags and weight progress over time.

---

### 7.2 Mental Health Red Flags & Safety

Given the mixed evidence on GLP-1s and psychiatric adverse events, the app should:
- Include monthly PHQ-2 screening (2 questions, validated): "Over the last 2 weeks, how often have you felt down, depressed, or hopeless?" with a resource link if score ≥ 3
- Include a persistent "Get Support" resource in Education tab (NAMI helpline, Crisis Text Line)
- **Never interpret mood trends as clinical diagnoses** — frame as "patterns you might want to discuss with your doctor"

---

### 7.3 Woebot / Headspace / Calm Integration

- **Woebot:** Cognitive behavioral therapy (CBT)-based conversational AI; no public API; potential partnership
- **Headspace:** Has a business API for enterprise wellness programs; could integrate mindfulness minutes into recovery score
- **Calm:** No public API
- **Recommended approach:** Deep link to specific Headspace/Calm programs from the Education tab with contextual recommendations (e.g., injection day → link to "Relaxation for medical procedures" audio)

---

## 8. Women's Health Features

**Clinical context:**
The GLP-1 user population skews 70% female. Semaglutide has documented effects on reproductive health:
- 80% of women with PCOS taking 0.5mg weekly semaglutide for 3 months normalized menstrual cycle lengths
- Women on GLP-1s are 72% more likely to achieve natural pregnancy (via weight loss, HPG axis improvement, insulin sensitivity)
- GLP-1s are **contraindicated during pregnancy** (Category X equivalent) — critical safety feature
- Menstrual cycle irregularity is common in early weeks (due to rapid weight loss, hormonal shifts)

---

### 8.1 Menstrual Cycle Tracking

**Integration with Apple Health cycle data:**
- Read `HKCategoryTypeIdentifierMenstrualFlow` from HealthKit
- Read `HKCategoryTypeIdentifierOvulationTestResult` if available
- Display cycle phase overlay on the Home screen header (follicular / ovulatory / luteal / menstrual) with phase-specific GLP-1 guidance

**Phase-specific GLP-1 guidance (content feature):**
- Luteal phase: Increased cravings are hormonally driven, not GLP-1 failure; increase protein by 5–10g
- Menstrual phase: Higher nausea sensitivity — injection timing guidance; anti-nausea food suggestions
- Follicular phase: Optimal time for higher-intensity exercise

**PCOS module:**
- Track cycle regularity over time as a PCOS marker
- Correlate cycle normalization with weight loss milestones
- Display: "Your cycles have been regular for X months" as a non-scale victory

---

### 8.2 Pregnancy Safety Screening

**Critical feature:** The app should prompt users who report pregnancy (or use a positive pregnancy OPK) to contact their prescriber immediately, as GLP-1s are contraindicated in pregnancy. This is not medical advice — it is a documented contraindication.

- Monthly reminder: "Are you currently pregnant or planning to become pregnant? If yes, contact your prescriber before your next injection"
- If user reports pregnancy: Show full-screen alert with prescriber contact prompt

---

### 8.3 Integration with Clue / Flo (Period Tracker Apps)

Neither Clue nor Flo has a public user data API. The best path is Apple Health cycle data (which both apps write to). Reading `HKCategoryTypeIdentifierMenstrualFlow` from HealthKit captures data from whichever period tracking app the user already uses.

---

## 9. Advanced Biomarkers & Cardiovascular Monitoring

### 9.1 HRV as a GLP-1 Pharmacodynamic Marker

**Clinical finding (2024, *American Journal of Physiology*):**
GLP-1 receptor agonists cause a measurable, statistically significant decrease in HRV (−6.2 ms SDNN at 12 weeks) and increase in resting heart rate. This is a direct autonomic effect: GLP-1 receptors depress parasympathetic modulation of the heart. Physical activity partially offsets the RHR increase.

**Feature implication:** HRV and RHR trending in the app are not just fitness metrics — they are direct biomarkers of GLP-1 pharmacological effect. The app can contextualize HRV changes as expected ("Your HRV has decreased slightly — this is a known effect of GLP-1 medications and not a cause for concern. Exercise helps counteract this.") rather than alarming users.

**Display:** HRV trend chart in the Progress tab alongside weight — show 30-day rolling average with injection day markers.

---

### 9.2 Blood Pressure Monitoring

**Clinical relevance:** The SELECT trial (2024) demonstrated semaglutide reduces MACE (heart attack, stroke) events by 20% in patients with CVD. Blood pressure reduction is a key mechanism. Tracking BP over time gives users visible evidence of cardiovascular benefit beyond weight.

**Data sources:**
- Apple Health: `HKCorrelationTypeIdentifierBloodPressure` (reads from any BP app or smart cuff)
- Omron Connect API (partner program available)
- QardioArm API (free public API)
- Withings BP monitors (via Withings Health Mate API)

**Display:** Systolic/diastolic trend in Progress tab; highlight if user crosses below a clinically meaningful threshold (e.g., "Your average BP has moved from Stage 1 hypertension to normal range")

---

### 9.3 SpO2 (Blood Oxygen)

**Relevance:** GLP-1s significantly reduce sleep apnea severity (tirzepatide received FDA approval for OSA in June 2024; the SURMOUNT-OSA trial showed 51% reduction in apnea severity). SpO2 during sleep is a proxy marker for sleep apnea improvement.

**Data sources:** Apple Health (Apple Watch SpO2), Oura Ring daily_spo2 endpoint, Fitbit SpO2 endpoint, WHOOP recovery SpO2

**Feature:** Track average SpO2 over time; correlate with weight loss milestones; include message when SpO2 trends improve: "Your average sleep oxygen levels have improved — consistent with the sleep apnea benefits that GLP-1 research has documented"

---

### 9.4 VO2 Max Tracking

**Relevance:** As users lose weight and increase exercise on GLP-1s, VO2 max (cardiorespiratory fitness) improves. This is a powerful non-scale victory. Apple Watch estimates VO2 max during outdoor walks/runs.

**Data source:** `HKQuantityTypeIdentifierVO2Max` from HealthKit

**Display:** VO2 max trend in Progress tab alongside weight; show fitness age equivalent; milestone alerts ("You've crossed into 'Good' fitness category for your age")

---

### 9.5 Body Temperature (Skin Temperature)

**Availability:** Oura Ring and Fitbit Sense/Charge 6 provide nightly skin temperature deviation from baseline.

**Relevance for women:** Skin temperature is a validated ovulation marker (rises 0.2–0.5°C in luteal phase). Integrating with menstrual cycle tracking.

**Relevance for all users:** Fever detection; infection can worsen GLP-1 side effects.

**Data sources:** Oura `/usercollection/daily_spo2` (includes temperature), HealthKit `HKQuantityTypeIdentifierAppleSleepingWristTemperature` (Apple Watch Series 8+)

---

## 10. AI & Machine Learning Features

### 10.1 Conversational AI Coach ("ASK AI" Feature)

**Current state:** The "ASK AI" button exists in the Add Entry sheet but is not wired.

**Recommended implementation:**
- **Model:** Claude (`claude-sonnet-4-6`) via Anthropic API — best for nuanced health coaching conversations with strong safety guardrails
- **Architecture:** RAG (Retrieval-Augmented Generation) with a curated GLP-1 knowledge base (clinical guidelines, medication guides, nutritional science, SURMOUNT/SELECT/STEP trial summaries)
- **Persona:** "Your GLP-1 companion" — answers questions about medication, nutrition, lifestyle, side effect management; explicitly declines to provide medical diagnoses or replace physician guidance
- **Key capabilities:**
  - Natural language food logging: "I had a chicken caesar salad for lunch" → extracts and logs nutrition
  - Side effect guidance: "I'm feeling very nauseous after my injection, what should I do?" → evidence-based management tips
  - Contextual coaching: Reads user's current data (score, injection day, recent sleep) and gives personalized recommendations
  - Injection technique: Explains site rotation, pen priming, storage
  - Dose escalation questions: Explains what to expect at each dose level

**Safety guardrails (required):**
- System prompt must include: clear non-medical-advice disclaimer, instruction to refer to prescriber for dose changes, emergency redirect for severe symptoms
- Never advise on dose adjustments or medication changes
- Log all AI conversations for safety audit

**SDK:** `@anthropic-ai/sdk` — fully compatible with React Native (REST-based)

---

### 10.2 AI-Powered Food Recognition Pipeline

**Multi-method food logging pipeline (for all 5 entry methods in AddEntrySheet):**

| Entry Method | Primary AI | Fallback |
|---|---|---|
| DESCRIBE FOOD (text) | Nutritionix NLP API → structured nutrition | Claude function calling + USDA FDB |
| CAPTURE FOOD (camera) | Passio SDK real-time recognition | GPT-4o Vision |
| SCAN FOOD (barcode) | Open Food Facts barcode API | USDA Branded Foods barcode |
| SEARCH FOOD (text search) | Nutritionix instant search | USDA FoodData Central search |
| ASK AI (conversation) | Claude with food logging function call | — |

---

### 10.3 Predictive Features

**Side effect prediction engine:**
Using logistic regression or a gradient boosted model trained on the app's logged data:
- Inputs: Dose level, injection day (hours since injection), hydration level, last meal timing, recent sleep quality, historical side effect pattern
- Output: Nausea risk probability for next 24 hours
- Use case: "High nausea risk today — consider lighter meals and extra hydration" on Home screen

**Weight plateau detection:**
- Detect when weight loss rate has slowed below 0.3 lbs/week for >3 consecutive weeks
- Trigger: "Plateau detected" card with evidence-based interventions (protein recalculation, activity increase, sleep focus)
- Based on research: 60% of weight lost during GLP-1 treatment is regained within 18 months of stopping; behavioral habits during treatment predict long-term outcomes

**Protein gap alarm:**
- Daily calculation: Current logged protein ÷ lean body mass target (1.6–2.3 g/kg fat-free mass per SURMOUNT trial guidance)
- If protein deficit >20g by 4pm → "High protein meal" focus card

---

### 10.4 Personalization Engine

**Rule-based personalization (Phase 1):**
Based on injection phase, lifestyle score breakdown, and user profile:

```typescript
type PersonalizationContext = {
  injectionPhase: 'peak' | 'mid' | 'trough';  // based on hours since injection
  worstScoreComponent: 'protein' | 'hydration' | 'exercise' | 'recovery';
  doseLevel: number;
  weightTrendLastWeek: 'losing' | 'plateau' | 'gaining';
  sideEffectSeverityToday: 0 | 1 | 2 | 3;
};
```

The "Insights" card and "Today's Focuses" list are generated from this context object. This is a deterministic algorithm, not ML, but produces meaningfully personalized output.

**ML personalization (Phase 2):** After 90+ days of user data, build a Bayesian model per user to predict which focus tasks correlate with best score improvements.

---

### 10.5 Phase-Aware AI Persona

Three distinct coaching modes keyed to injection phase — the AI system prompt context (built on `lib/context-snapshot.ts`) changes per phase:

| Phase | Weeks | Coaching Focus |
|---|---|---|
| **Titration** | 1–16 | Side effect management, gradual food adjustment, expectation setting, dose normalizing |
| **Steady State** | 16+ | Habit building, lean mass protection, behavioral anchoring, fitness progression |
| **Maintenance / Transition** | Post-maintenance dose | Preparing for potential stop, behavioral habit independence, relapse prevention |

The AI tone and suggestions shift automatically — no user configuration required.

---

### 10.6 Weekly Injection Day Briefing

On injection day, Claude generates a 2-sentence personalized briefing incorporating current dose, estimated medication level, and the user's biggest lifestyle gap:

> *"You're starting Week 12 at 1.0 mg. Your estimated medication level is at steady state — this week, protein intake is your biggest opportunity at 68% of your goal."*

Delivered as a push notification + an expanded in-app card on the Home screen.

---

### 10.7 Phenomix / MyPhenome Response Score Integration

Allow user to input their MyPhenome CTS-GRS (Cardiometabolic Type Score — Genetic Response Score) result, commercially available at ~400 clinics (AUC 0.76–0.84 for predicting semaglutide response, per *Cell Metabolism* 2025 / Mayo Clinic study).

- **High responder band:** >15% body weight loss expected — progress charts show optimistic trajectory
- **Average responder band:** 10–15% — standard trajectory
- **Lower responder band:** <10% — app messaging emphasizes non-weight benefits (metabolic, cardiovascular) and behavioral habits to maximize response

The score is user-entered (no API); stored in profile; adjusts expected weight loss range displayed in Progress tab.

---

### 10.8 Weight Stall Context Intelligence

When a 2-week plateau is detected, the AI differentiates between stall types before surfacing a response — reducing alarm fatigue:

| Stall Type | Condition | Response |
|---|---|---|
| **Escalation-step plateau** | Weight loss stalled at a dose transition | "This is expected — weight often stabilizes at each new dose before resuming" |
| **Protein deficit stall** | Protein <70% of goal for 5+ days | "Low protein during weight loss increases lean mass loss — add 1–2 high-protein meals" |
| **Activity decline stall** | Activity score declining for 2 weeks | "Reduced activity during a plateau is a common pattern — a short resistance session can restart progress" |
| **True stall** | None of the above explain plateau | "Consider discussing dose escalation readiness with your prescriber" |

---

## 11. Medication Management & Clinical Adherence

### 11.1 Dose Escalation Schedule Manager

GLP-1 dose escalation follows strict protocols that vary by medication:

| Medication | Escalation Schedule |
|---|---|
| Wegovy (semaglutide) | 0.25 → 0.5 → 1.0 → 1.7 → 2.4 mg (every 4 weeks) |
| Ozempic (semaglutide) | 0.25 → 0.5 → 1.0 → 2.0 mg (every 4 weeks) |
| Mounjaro (tirzepatide) | 2.5 → 5 → 7.5 → 10 → 12.5 → 15 mg (every 4 weeks) |
| Zepbound (tirzepatide) | Same as Mounjaro |
| Saxenda (liraglutide) | Daily escalation over 5 weeks |

**Features:**
- Auto-calculate next dose level and date from start date and current dose
- Notification: "You're eligible to escalate to X mg in 7 days — confirm with your prescriber"
- Side effect diary auto-linked to dose level: "You were on 1.0mg during these nausea entries"
- Dose escalation decision support: Show average side effect burden at current dose; "Many users find side effects stabilize after 4–6 weeks at each dose level"

---

### 11.2 Injection Site Rotation System

**Body diagram implementation:**
- SVG body outline with 6 injection sites (abdomen-left, abdomen-right, thigh-left, thigh-right, arm-left, arm-right)
- Each injection log records site; diagram highlights recommended next site based on rotation algorithm
- Sites should not be reused for ≥2 consecutive weeks
- Within-site rotation: Suggest specific sub-quadrant within zone

**Storage guidance feature:**
- Unopened: Store at 36–46°F (refrigerated)
- In-use: Can be stored at room temperature (<86°F) for 28–56 days (varies by product)
- Push notification: "Is your Ozempic pen still in use? Check storage temperature"

**Pen priming reminder:** First injection from each new pen requires priming — step-by-step guide with animation

---

### 11.3 GLP-1 "Medication Holiday" Tracking

Some patients take planned breaks from GLP-1 due to cost, side effects, or medical procedures. The app should:
- Allow user to record a medication pause start date
- During pause: Switch Home screen to a "Maintenance Mode" — focus on behavioral habits that preserve weight
- Provide evidence-based warning: "Research shows ~60% of lost weight is regained within 18 months of stopping — maintaining protein intake and exercise is critical during your break"
- Track weight trajectory during pause (rebound rate)

---

### 11.4 Side Effect Pattern Analysis

Beyond simple logging, build a pattern-recognition layer:

- Side effects by: Injection site (do certain sites cause more reactions?), dose level, time post-injection, food consumed before injection, hydration level
- Insight: "Your nausea tends to be highest 18–24 hours after injection when you've eaten fewer than 60g of protein. Hitting protein goals may help reduce side effect severity."
- Exportable side effect report for prescriber visits

---

### 11.5 Missed Dose Intelligence (Drug-Specific)

Generic "missed dose" alerts are inadequate — each drug has distinct pharmacokinetics that dictate the correct recovery action:

| Drug | Window to take missed dose | After window: action |
|---|---|---|
| Semaglutide (Ozempic / Wegovy) | Up to 5 days after scheduled date | Skip; resume on original day next week |
| Tirzepatide (Mounjaro / Zepbound) | Up to 4 days (96h) after scheduled date | Skip; resume on original day next week |
| Rybelsus (oral daily semaglutide) | Same calendar day only | Skip if past midday; resume tomorrow morning |

**Implementation:**
- Missed dose notification fires T+4h after the scheduled injection/dose time
- In-app decision tree: "Did you miss your dose?" → branching instructions based on drug and days elapsed
- Multi-week gap detector: if user has not logged for ≥4 consecutive weeks → mandatory advisory: *"Talk to your prescriber before resuming — re-titration may be needed at a lower dose"*
- Log skipped doses as `status: 'skipped'` (not just absence) so adherence % is accurate

---

### 11.6 Day-Shift Assistant (Pharmacologically Correct)

When a user wants to move their injection day (e.g., Sunday → Wednesday for a trip), the app calculates whether the shift is pharmacologically safe:

- **Semaglutide:** Minimum 48 hours since last dose
- **Tirzepatide:** Minimum 72 hours since last dose (never within 3 days)

**UI:** Calendar picker → app shows "Safe to shift to [new day]" or "Earliest safe shift: [date]". Shift is recorded; future injection day updates accordingly.

---

### 11.7 PK-Based Medication Level Model

Real-time estimated plasma drug level curve using validated pharmacokinetic parameters:

| Parameter | Semaglutide | Tirzepatide |
|---|---|---|
| Half-life | ~7 days | ~5 days |
| Time to steady state | ~4 weeks (4–5 half-lives) | ~4 weeks |
| Accumulation ratio at steady state | ~2× | ~1.6× |
| Tmax (peak after injection) | ~24–72h | ~24–48h |

**Chart features:**
- X-axis: days since therapy start; Y-axis: estimated % of steady-state level
- "Approaching steady state" milestone badge at week 4
- Missed dose impact visualization: level drop shown as a dip in the curve
- Current level highlighted with a "You are here" marker

This is the same concept as Shotsy's estimated levels chart — TitraHealth's version adds the missed dose visualization and steady state milestone framing.

---

### 11.8 Escalation Readiness Check

Before the app suggests the next dose level (at the 4-week minimum threshold), it surfaces a readiness checklist:

- [ ] Have GI side effects resolved or become manageable?
- [ ] Have you been consistent with injections this month?
- [ ] Has your prescriber approved the next dose level?

**Logic:**
- If side effect severity ≥3/10 in the last 7 days → recommend staying at current dose: *"The Wegovy label explicitly supports staying at your current dose if side effects are still bothersome"*
- Soft-lock: the app does not offer the next dose until minimum 4 weeks; user can override with *"My prescriber changed my schedule"* confirmation
- Full escalation history timeline available on the Profile screen

---

## 12. Behavioral Science & Engagement Mechanics

### 12.1 Notification Architecture

**Tool:** `expo-notifications` — supports local scheduled notifications, push notifications via Expo Push Service, and background tasks.

**Critical notification flows for GLP-1 adherence:**

| Notification | Trigger | Content |
|---|---|---|
| Injection reminder | Day-of + configurable time | "It's your shot day. 💪 Log your injection when done." |
| Pre-injection prep | Night before | "Injection tomorrow — make sure your pen is at room temp if needed" |
| Protein check-in | Daily at 4pm if <60% protein goal met | "You're 32g short of your protein goal — one more serving can close the gap" |
| Water reminder | Every 2 hours if daily goal <50% met | "Staying hydrated helps manage GLP-1 side effects" |
| Weight log prompt | Weekly (configurable day) | "Weekly weigh-in — same time, same conditions for the most accurate trend" |
| Side effect check-in | 24h post injection | "How are you feeling today? Log any side effects to track your patterns" |
| Dose escalation countdown | 7 days before eligibility | "In 1 week, you'll be eligible to discuss escalating to X mg with your prescriber" |
| Medication refill alert | 7 days before estimated run-out | "You may be running low — time to refill your prescription" |

**Smart notification scheduling:**
- Learn user's typical wake time from first screen unlock time (no special API needed — just track when notifications are opened)
- Reduce notification frequency for highly engaged users (already logging daily)
- Pause non-critical notifications on high-side-effect days (detected from side effect log)

---

### 12.2 Streak & Achievement System

**Evidence basis:** Streak mechanics increase app engagement but must be designed carefully — harsh streak-breaking (one missed day = reset) increases anxiety and quit rates. Use "grace periods" and "streak freezes" (proven effective by Duolingo).

**Streak types:**
- Injection logging streak (weekly — critical adherence behavior)
- Daily check-in streak (opens app)
- Protein goal streak (hits protein goal every day)
- "Consistency" streak (completes at least 3 of 5 daily goals)

**Achievement milestones (non-scale victories — critical for GLP-1 users whose weight loss plateaus):**
- First injection logged
- 30/60/90 days on medication
- 10/25/50 lbs lost
- 100 protein-goal days
- Sleep apnea improvement (if SpO2 data available)
- VO2 max category improvement
- 1,000 steps over previous weekly average
- HbA1c into normal range (if FHIR lab data available)
- First plateau overcome
- Dose level reached (each escalation step)

---

### 12.3 Non-Scale Victory Emphasis

GLP-1 research shows weight plateaus are common and expected. Users who quit during plateaus miss significant non-weight benefits that are accumulating. The app should aggressively surface non-scale victories:

- Energy level improvement (tracked via mood/energy check-in)
- Sleep quality improvement (HealthKit sleep data trend)
- Resting HR decrease (HealthKit)
- Blood pressure improvement (if tracked)
- Clothing size / physical measurement entries
- "Food noise" reduction score trend
- Menstrual cycle regularity (for women)
- Reduced side effect severity over time (dose tolerance improving)

---

### 12.4 Community & Social Features

**Evidence:** Social support significantly improves GLP-1 adherence, but the mechanisms that help are normalization (not feeling alone), information sharing, and accountability — not competitive comparison, which can backfire.

**Feature options:**
- Anonymous peer groups by medication type and dose level ("Others on 1.0mg semaglutide, Week 8")
- "Celebration feed" — opt-in milestone sharing (not weights, just milestones: "Day 60 achieved!")
- Buddy system — two users paired for mutual check-ins
- Content contribution — users can submit their "what helped my nausea" tips (moderated)

**Technical implementation options:**
- Supabase Realtime for in-app community feed
- Push notifications for buddy activity

---

### 12.5 Progress Framing & Behavioral Economics

**Reference point effects:** Frame progress relative to the user's personal baseline, not external comparisons. "You've lost 18 lbs since starting" is more motivating than "You need to lose 12 more lbs."

**Loss aversion for adherence (positive framing):** "You've maintained a 14-day injection streak — don't lose your momentum" (loss framing for streaks) is more effective than "Nice work on 14 days!" (gain framing) according to behavioral economics research.

**Anticipated regret:** "Users who maintain protein goals during plateaus are 3x more likely to break through within 3 weeks" — preemptive motivation before a plateau, not during it.

---

### 12.6 Implementation Intentions

At onboarding, prompt the user with structured if/then planning (validated by behavioral science to significantly improve medication adherence):

> *"When will you inject? Where will you be? What will you do right afterward?"*

The responses are saved as a personalized **Plan Card** displayed on the Home screen on injection day:

> *"Your plan: Sunday, 9am, at home after morning coffee → inject right thigh → take a 10-minute walk"*

This technique reduces decision friction on injection day and creates habit-anchoring context.

---

### 12.7 Motivation Mode Selector

At onboarding and surfaced periodically (every 4–6 weeks), present a single-choice prompt:

> *"What matters most to you right now?"*

| Option | AI + Home Screen Adaptation |
|---|---|
| Weight loss | Caloric focus, weekly weight trend prominence |
| Blood sugar control | Glucose logging prompts, carb tracking emphasis |
| Energy & vitality | Sleep quality focus, activity score emphasis |
| Joint pain relief | Low-impact activity suggestions, NSV tracking |
| Sleep apnea | SpO2 trend display, sleep duration focus |
| Confidence & mood | Mood tracking, NSV milestones, food noise trends |

The AI coaching system prompt and home screen focus cards adapt accordingly. Motivation mode can be changed at any time from Profile settings.

---

### 12.8 Habit Stacking Suggestions

Context-aware pairing suggestions shown during onboarding and after injection logging:

- **Injection users:** *"Pair your Sunday injection with meal prep — fill your syringes while your food is in the oven"*
- **Oral pill users (Rybelsus):** *"Take your pill before your morning alarm — place it on your nightstand with a small glass of water tonight so it's ready the moment you wake up"*
- **Escalation step:** *"You just moved to a new dose — anchor it to a new ritual so the habit stays strong"*

Habit stacking significantly improves medication adherence by eliminating the "what do I do next?" friction from the routine.

---

### 12.9 GLP-1 Calendar View & Export

**Monthly calendar view:**
- Past injections displayed with dose-level color coding (gradient from lightest to darkest dose)
- Future scheduled injections
- Escalation milestone markers (e.g., *"Week 4 — Escalation eligible"*)
- Side effect severity heat-map overlay (day color intensity reflects logged severity)

**iCal / Google Calendar export:**
- Export injection schedule as a recurring calendar event (ICS format)
- Export escalation milestone dates as standalone calendar events

**Travel Mode:**
- User indicates travel dates + destination timezone
- App recalculates injection day/time relative to new timezone
- Guidance: *"Your Sunday injection in PST becomes Saturday 10pm PST when traveling to EST — shift it?"*
- Shows minimum spacing check before confirming shift

---

## 13. Provider & Care Team Integration

### 13.1 Progress Report Generation

A shareable PDF or structured data report for prescriber appointments:
- Last 90 days of weight trend (chart)
- Injection adherence (% of scheduled injections logged)
- Side effect summary by dose level
- Lifestyle score trend
- Lab values if FHIR data available
- Medication timeline (doses, escalations, any holidays)

**Implementation:** `react-native-pdf-lib` or `expo-print` to generate PDF from a React Native view; shareable via iOS/Android share sheet.

**Priority: P2** — High clinical value; strengthens relationship between app and prescriber.

---

### 13.2 Telehealth Platform Deep Links

**Target platforms:** Hims & Hers, Ro Health, Found, Calibrate, Sequence — these platforms prescribe the majority of GLP-1s outside traditional endocrinology.

**Feature:** "Message your care team" button that deep-links to the user's telehealth app or opens a pre-filled email summary of their recent progress.

**Implementation:** Store user's telehealth provider; use URL scheme deep links or mailto: with pre-populated body.

---

### 13.3 Provider Dashboard (Future — B2B Feature)

A separate web dashboard (not mobile) for prescribers or care coordinators to view their patient panel:
- Aggregate adherence rates
- Side effect burden by dose level
- Patients approaching refill dates
- Patients with declining Lifestyle Effectiveness Scores (at-risk alerts)

**Technology:** Supabase + Next.js web dashboard; row-level security ensures provider can only see their patients; patient opt-in consent required.

---

### 13.4 Prescriber Notes Field

After each appointment, the user logs prescriber guidance as structured data:
- Dose change approved (new dose + date)
- Re-titration plan (if returning from a break)
- Special instructions or follow-up date
- Free-text notes field

All notes are searchable and displayed in chronological order in a dedicated "Appointments" section of the Profile screen.

---

### 13.5 Dose Change Log

Every dose change is tracked with:
- Date of change
- Old dose → new dose
- Reason: prescriber-directed / escalation schedule / re-titration / side effects / other
- Associated prescriber note (linked from 13.4)

Full dose history is displayed as a timeline on the Profile screen — enabling the user and provider to see the complete medication journey at a glance.

---

## 14. React Native / Expo Package Ecosystem

Complete package recommendations for all features in this document, organized by category.

---

### 14.1 Charting

| Package | Use Case | Expo Managed? | Notes |
|---|---|---|---|
| `victory-native` (XL version with Skia) | Weight trend, macro charts, score history | Yes (with Skia peer dep) | Reanimated v3 + Skia-powered; 60fps animations; recommended choice |
| `react-native-gifted-charts` | Quick bar/line/pie charts | Yes | Simpler API; less customizable than victory-native; good for MVP |
| `@shopify/react-native-skia` | Custom glucose sparkline, score rings | Custom build needed | Maximum performance and flexibility; use for the main score visualization |
| `react-native-svg` + `d3` | Complex custom data visualizations | Yes | Flexible; verbose; for highly custom charts |

**Recommendation:** Use `react-native-gifted-charts` for the Insights screen MVP; upgrade to `victory-native` XL (Skia) for the Lifestyle Score visualization and glucose sparkline.

---

### 14.2 Health Data

| Package | Platform | Notes |
|---|---|---|
| `@kingstinct/react-native-healthkit` | iOS HealthKit | TypeScript-native, Nitro Modules, Expo config plugin |
| `react-native-health-connect` + `expo-health-connect` | Android Health Connect | Expo config plugin; requires SDK 34 |

---

### 14.3 Camera & Vision

| Package | Use Case | Notes |
|---|---|---|
| `react-native-vision-camera` v4 | Food photo capture, real-time Passio SDK, barcode | Required for Passio SDK; best barcode scanner overall |
| `expo-camera` | Basic barcode scan fallback | Built into Expo SDK 54; simpler setup for barcode-only |
| `@passiolife/nutritionai-react-native-sdk-v3` | AI food recognition | Requires VisionCamera; native build needed |

---

### 14.4 Storage & Persistence

| Package | Use Case | Notes |
|---|---|---|
| `expo-sqlite` (v2 API) | Structured health data (food logs, injections, weights) | 246K weekly downloads; new API in Expo SDK 51+; recommended primary store |
| `expo-secure-store` | Sensitive data (auth tokens, user ID) | 2KB per-item limit — do not store large data |
| `@react-native-async-storage/async-storage` | Simple key-value (user preferences, app state) | Standard; no size limit |
| `@nozbe/watermelondb` | High-performance reactive queries on large datasets | Expo managed workflow via `@morrowdigital/watermelondb-expo-plugin`; best for >10K logged entries |
| `react-native-mmkv` | Fastest key-value storage (synchronous) | Requires native build; use for hot-path state (current score, today's totals) |

---

### 14.5 State Management & Server State

| Package | Purpose | Notes |
|---|---|---|
| `zustand` | Global client state (user profile, daily logs, UI state) | Lightweight; React 19 compatible; recommended per SD.md |
| `@tanstack/react-query` | Server state (API calls to Nutritionix, USDA, Dexcom, Oura) | Background refetch, caching, loading/error states; essential for API-heavy screens |
| `jotai` | Atomic state for fine-grained reactivity | Optional; good for real-time glucose display |

---

### 14.6 Backend & Auth

| Package | Purpose | Notes |
|---|---|---|
| `@supabase/supabase-js` | Database, auth, realtime, storage | Full Expo support; use `expo-secure-store` adapter for auth token storage |
| `expo-auth-session` | OAuth 2.0 PKCE for wearable APIs (Oura, WHOOP, Withings, Dexcom) | Built into Expo; handles PKCE flow; returns auth code for backend exchange |
| `@clerk/clerk-expo` | User auth with Apple/Google sign-in | Simple setup; use if Supabase auth is insufficient |

---

### 14.7 Notifications & Background Tasks

| Package | Purpose | Notes |
|---|---|---|
| `expo-notifications` | All push + local + scheduled notifications | Full Expo managed workflow support; handles injection reminders, protein alerts, refill reminders |
| `expo-task-manager` | Background tasks (health data sync) | Register background fetch tasks for wearable data polling |
| `expo-background-fetch` | Periodic background API polling | Trigger wearable data sync when app is not in foreground |
| `expo-location` | Location for Walk Score / weather APIs | Requires permission; consider zip code input as privacy-respecting alternative |

---

### 14.8 UI/UX Components

| Package | Purpose | Notes |
|---|---|---|
| `@gorhom/bottom-sheet` v5 | Replace current Modal-based AddEntrySheet | Performant; Reanimated v3; Expo compatible — known issues with Expo SDK 53+, check GitHub issues for SDK 54 status |
| `moti` | Declarative animations (Reanimated 3) | Great for card enter/exit animations, score ring fill animations |
| `@shopify/flash-list` | High-performance list rendering | Replace FlatList for food log, side effect list; significant performance gain on large lists |
| `expo-image` (already installed) | Image caching and display | Use for food photos, education content images |
| `react-native-reanimated` v4 (already installed) | Animation worklets | Already in project; use for custom score ring animation |

---

### 14.9 Utilities

| Package | Purpose | Notes |
|---|---|---|
| `date-fns` | Date calculations (injection countdown, streak tracking, dose escalation) | Lightweight; no dependencies |
| `zod` | Runtime type validation for API responses | Critical for FHIR/health API response validation |
| `@tanstack/react-query` | API data fetching, caching | Also listed in state management |
| `expo-print` | PDF generation for provider reports | Built into Expo |
| `react-native-svg` | SVG body diagram for injection site rotation | Required for injection site map feature |

---

### 14.10 Development & Testing

| Package | Purpose | Notes |
|---|---|---|
| `@shopify/react-native-skia` dev tools | Skia performance profiling | |
| `react-query devtools` | Inspect API cache state | Web-only during development |
| `zustand devtools` | Inspect global state | |
| `detox` | End-to-end testing for health data flows | |

---

## 15. Oral GLP-1 Support

**Market context:** Rybelsus (oral semaglutide) is already FDA-approved and in active use. Orforglipron (Eli Lilly, once-daily oral GLP-1) is under FDA NDA review with a decision expected ~April 2026. Danuglipron (Pfizer) is in Phase 3. Daily-oral is a fundamentally different adherence problem than weekly injectables — and no existing app handles both modalities with clinical-grade intelligence.

---

### 15.1 Daily Oral Medication Mode

**Supported medications:**
| Drug | Doses | Fasting Required? |
|---|---|---|
| Rybelsus (oral semaglutide) | 3 mg / 7 mg / 14 mg | Yes — strict 30-minute fast after dose |
| Orforglipron | 6–45 mg (escalation schedule) | No |
| Danuglipron | TBD (Phase 3) | TBD |

**UI paradigm:** Daily streak calendar replaces the weekly countdown ring used for injectable users. The home screen shows a 30-day pill adherence grid (green = taken, gray = missed, red = missed 2+ consecutive days).

**Dual oral + injectable support:** Some users take oral semaglutide for T2D while also self-injecting for obesity. The app allows concurrent logging of both modalities with separate tracking widgets.

**Onboarding:** New medication type picker — "Weekly Injection" vs. "Daily Pill" — shown at the medication step. Selecting "Daily Pill" routes to the oral-specific setup flow.

---

### 15.2 Rybelsus Critical-Timing Protocol

Rybelsus has strict absorption requirements that determine whether *any* drug reaches the system (~1% oral bioavailability; the timing rules are pharmacologically non-negotiable, not arbitrary):

**Morning protocol sequence:**
1. **Smart wake alarm:** Fires within 5 minutes of the user's historical wake-up time (inferred from first phone unlock or HealthKit sleep-end time)
2. **Dose reminder card:** Shows a visual diagram of exactly 120 mL water (not "4 oz" — a visual cup calibration) with the instruction to take the pill immediately
3. **30-minute fasting countdown timer:** Starts the moment user taps "Dose taken" — displayed as:
   - In-app countdown widget on the home screen
   - iOS Live Activity on the lock screen (via `expo-activity-kit` or native Activity API)
4. **Food log block:** During the 30-minute window, any attempt to log food shows an explanation banner: *"Rybelsus needs 30 minutes to absorb — food logging is paused until [time]"*
5. **T+30 notification:** *"Your fasting window is complete — you can now eat and take other medications"*

**Evening prep notification (night before):** *"Set up for Rybelsus success — place your pill and a small glass (120 mL) of water on your nightstand tonight"*

---

### 15.3 Orforglipron Mode

Orforglipron has no meaningful food effect (~20% AUC reduction with food, not clinically significant per FDA review):

- **Simple once-daily reminder** at user-chosen time (no fasting restrictions)
- **Education card on setup:** *"Unlike Rybelsus, orforglipron can be taken with or without food — timing is flexible"*
- **Auto-switch logic:** If a user changes medication from Rybelsus to orforglipron in Profile settings, the app automatically removes all fasting UI elements, countdowns, and food log blocks

---

### 15.4 Oral Adherence Score

A 30-day adherence percentage displayed prominently on the Home screen and in the Progress tab:

- **≥80%:** Green indicator — "Great consistency"
- **60–79%:** Yellow — "Irregular timing reduces drug exposure — try the nightstand prep reminder"
- **<60%:** Red — *"Oral GLP-1s work best with consistent daily dosing. Irregular timing or food co-ingestion can dramatically reduce the amount of drug that reaches your system."*

The adherence score is also included in the provider progress report (§13.1).

---

### 15.5 Oral Bioavailability Education

An in-app explainer card (surfaced once during onboarding, accessible anytime from the Education tab):

**Key facts to communicate:**
- Rybelsus oral bioavailability: ~1% vs. ~89% for subcutaneous injection
- This is why Rybelsus 14 mg daily (~1 mg SC equivalent) requires strict dosing conditions
- The 30-minute fasting rule is not arbitrary: food, coffee, and other beverages (except plain water) can reduce drug absorption by up to 75%
- SALCAPROZATE SODIUM (SNAC) in Rybelsus tablets creates a temporary pH window in the stomach for absorption — anything that disrupts gastric pH disrupts absorption

Framing: educational, not alarming — *"These rules exist because scientists engineered a clever workaround for oral peptide absorption. Following them means the drug actually reaches your bloodstream."*

---

### 15.6 Nightstand Preparation Card

**Evening-before push notification** (fires at 9pm or user-configured bedtime minus 1 hour):

> *"Tomorrow morning: Set up for Rybelsus success — place your pill blister pack and a small glass of plain water (about ½ cup) on your nightstand tonight. When you wake up, take it immediately before anything else."*

This habit-stacking intervention (§12.8) is evidence-based: removing the friction of finding the pill in the morning is one of the highest-impact adherence interventions for oral medications.

---

## 16. Drug Interaction & Safety Alerts

**Design principle:** Drug interactions are surfaced as educational alerts, not medical advice. All alerts include: *"Discuss with your prescriber at your next appointment"* and never instruct the user to change their medication independently.

---

### 16.1 Tirzepatide + Oral Contraceptive Alert (Highest Clinical Priority)

**Clinical basis:** Published pharmacokinetic studies and the Mounjaro/Zepbound FDA prescribing label include an explicit warning that tirzepatide co-administration significantly reduces oral contraceptive exposure (ethinyl estradiol AUC reduced ~40%; norgestimate active metabolite AUC reduced ~29–51%). The clinical recommendation is to switch to non-oral contraception during initiation and for 4 weeks after each dose escalation step.

**Implementation:**
- **Onboarding question:** "Do you take birth control pills?" (Yes / No / Prefer not to say)
- If Yes + tirzepatide: **RED alert card** — *"Tirzepatide may reduce the effectiveness of birth control pills during initiation and each dose increase. The FDA label recommends using non-oral contraception (patch, IUD, condom) during these periods. Please discuss with your prescriber."*
- Alert resurfaces at every dose escalation step (§11.8 escalation check)
- Alert is dismissible but remains accessible in the Safety section of the Education tab

---

### 16.2 Levothyroxine + Rybelsus Alert

**Clinical basis:** Rybelsus co-administration increases levothyroxine exposure by approximately 33% (T4 AUC). This can cause over-replacement symptoms (palpitations, anxiety, weight loss) and warrants TSH monitoring.

**Implementation:**
- Onboarding medication list includes "Thyroid medication (levothyroxine/Synthroid)" as a checkbox
- If checked + Rybelsus: yellow advisory card: *"Rybelsus may increase the amount of thyroid medication absorbed. Let your prescriber know so they can monitor your TSH levels."*

---

### 16.3 Insulin / Sulfonylurea Hypoglycemia Watch

**Clinical basis:** GLP-1 RAs increase the hypoglycemia risk of concurrent insulin or sulfonylurea (glipizide, glimepiride, glyburide) therapy, particularly during dose escalation.

**Implementation:**
- Onboarding prompt: "Do you take insulin or a diabetes pill like glipizide or glimepiride?"
- If Yes: recurring **Hypoglycemia Watch Mode** banner on the Home screen during escalation phases
- Blood glucose logging prompt: *"Log your glucose readings during escalation — hypoglycemia risk is highest in the first 4 weeks at each new dose"*
- Alert linked to a blood glucose logging shortcut (§2 CGM integration or manual entry)

---

### 16.4 Narrow-Therapeutic-Index Drug Monitor

**Clinical basis:** GLP-1 RAs slow gastric emptying, which can alter the absorption rate (though not usually total bioavailability) of narrow-therapeutic-index (NTI) drugs. Some PBPK modeling (*Pharmacotherapy* 2025) suggests monitoring is prudent for drugs where small exposure changes are clinically meaningful.

**Drugs to flag (user-entered, optional medication list):**
- Warfarin (Coumadin) — INR monitoring recommendation
- Cyclosporine / Tacrolimus — trough level monitoring
- Digoxin — level monitoring
- Levothyroxine (also covered in 16.2)

**Implementation:**
- Optional concurrent medication list in Profile
- If NTI drug entered: soft advisory: *"GLP-1 medications can affect how quickly some medications are absorbed. Ask your prescriber if you need more frequent monitoring for [drug name]."*

---

### 16.5 Alcohol Interaction Card

**Clinical basis:** GLP-1 RAs compound alcohol-induced nausea (additive effect on gastric motility and the vomiting center). Additionally, reduced gastric emptying delays alcohol absorption — users may feel less intoxicated initially, then experience a delayed peak effect.

**Trigger:** Fired contextually after any alcohol entry in the food log.

**Card content:**
- *"Heads up: Alcohol and GLP-1 medications can both cause nausea, and the effects compound. Alcohol may also hit you harder or later than expected — drink slowly and eat before or with alcohol."*
- Dismissible; frequency-capped to once per week to avoid alarm fatigue

---

## Feature Priority Summary

### P0 — Foundation (Build with core data layer)
- Apple HealthKit integration (`@kingstinct/react-native-healthkit`)
- Google Health Connect integration
- `expo-sqlite` v2 data layer
- `zustand` stores (userStore, logStore, insightsStore)
- `expo-notifications` injection reminders + protein alerts
- Dose escalation schedule manager
- **Oral GLP-1 support** (§15 — market timing; orforglipron FDA decision ~Apr 2026)
- **Drug interaction alerts** (§16 — safety-critical; tirzepatide + OCP alert is clinically urgent)
- **Missed dose intelligence** (§11.5 — drug-specific pharmacology; no competitor does this)

### P1 — Core Differentiators (Next sprint cycle)
- Nutritionix natural language + USDA FoodData food logging
- Open Food Facts barcode scanning
- Passio SDK food photo recognition
- Withings body composition API
- HealthKit glucose reading (covers Dexcom/Libre/Stelo via Apple Health)
- Injection site rotation body diagram (SVG + react-native-svg)
- Side effect pattern analysis
- Supabase backend + auth
- Food noise tracker (unique GLP-1 feature)
- **PK-based medication level model** (§11.7 — Shotsy has this; must match and exceed)
- **Phase-aware AI persona** (§10.5 — coaching message changes across titration / steady state / maintenance)
- **Escalation readiness check** (§11.8 — checklist + side effect threshold delay logic)

### P2 — High Value Features
- Oura Ring API
- WHOOP API
- FHIR / Apple Health Records (lab results)
- GoodRx medication pricing
- CDC PLACES + Walk Score (SDOH contextual personalization)
- Mood + mental wellness check-in
- Provider progress report PDF
- CGM glucose display (via HealthKit first)
- HRV/RHR contextualization for GLP-1 pharmacodynamics
- Claude conversational AI coach
- Blood pressure tracking
- Women's health module (menstrual cycle, PCOS)
- **Phenomix / MyPhenome response score integration** (§10.7 — personalized expected outcomes from genetics)
- **GLP-1 Calendar view + export** (§12.9 — dose color-coding, escalation milestones, iCal export, Travel Mode)
- **Implementation intentions** (§12.6 — if/then habit planning; Plan Card on home screen)
- **Motivation mode selector** (§12.7 — AI + home screen adapts to user priority)
- **Day-shift assistant** (§11.6 — pharmacologically correct injection day recalculation)
- **Prescriber notes + dose change log** (§13.4–13.5)

### P3 — Ecosystem Expansion
- Dexcom official API partnership
- InBody scale API
- FHIR Epic direct integration
- SDOH equity score (composite contextual calibration)
- Provider/care team B2B dashboard
- Community/peer support features
- Medication holiday mode
- VO2 max trending
- SpO2 sleep apnea improvement tracking
- **Weekly injection day AI briefing** (§10.6)
- **Weight stall context intelligence** (§10.8 — differentiate normal plateau from true stall)
- **Home screen widgets** (iOS/Android — next injection countdown, protein progress, streak)

---

*Document reflects research current as of March 2026. Clinical findings, API availability, and package maintenance status should be re-verified at implementation time.*
