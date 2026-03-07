# TitraHealth — Integrations Master Plan

**App:** GLP-1 Companion (Ozempic · Wegovy · Mounjaro · Zepbound)
**Stack:** React Native 0.81.5 · Expo SDK 54 · Expo Router 6 · TypeScript · Supabase
**Last Updated:** March 2026

This document covers every third-party integration — what data flows in/out, exactly where each integration surfaces in the app, the clinical value for GLP-1 patients, implementation specifics, current API status, and build priority.

---

## Table of Contents

1. [Priority Tiers at a Glance](#priority-tiers)
2. [Apple HealthKit (iOS)](#1-apple-healthkit-ios)
3. [Google Health Connect (Android)](#2-google-health-connect-android)
4. [MyFitnessPal](#3-myfitnesspal)
5. [Oura Ring](#4-oura-ring)
6. [WHOOP](#5-whoop)
7. [Strava](#6-strava)
8. [Withings (Body Composition + Blood Pressure)](#7-withings)
9. [Continuous Glucose Monitoring (CGM)](#8-continuous-glucose-monitoring)
10. [SMART on FHIR / Apple Health Records](#9-smart-on-fhir--apple-health-records)
11. [GoodRx](#10-goodrx)
12. [OpenAI Whisper / Realtime API (Voice Logging)](#11-openai-voice-logging)
13. [Terra API (Wearable Aggregator)](#12-terra-api)
14. [Stelo (OTC CGM)](#included-via-healthkit)
15. [Apple Watch Complications](#13-apple-watch-complications)
16. [OpenWeatherMap](#14-openweathermap)
17. [CDC PLACES / Walk Score / USDA Food Access (SDOH)](#15-sdoh-apis)
18. [Walgreens Prescription Refill API](#16-walgreens-rx-api)
19. [Integrations With No Viable Path](#no-viable-path)
20. [App Surface Map](#app-surface-map)
21. [Implementation Roadmap](#implementation-roadmap)

---

## Priority Tiers

| Priority | Description |
|---|---|
| **P0** | Foundation — required before app is clinically differentiated |
| **P1** | High clinical value, achievable without partnership, ship in v1.x |
| **P2** | Significant user value, moderate complexity, ship in v2 |
| **P3** | Niche or complex, evaluate post-product-market-fit |

---

## 1. Apple HealthKit (iOS)

**Priority: P0**

### Why It Matters for GLP-1 Users

HealthKit is the single highest-leverage integration in the entire app. It enables:
- **Passive data collection** — weight, steps, sleep, HRV auto-populate without manual logging
- **MyFitnessPal bridge** — users who already log in MFP get their daily macros read passively (see section 3)
- **CGM bridge** — Dexcom, FreeStyle Libre, and Stelo all write glucose to HealthKit; TitraHealth reads it without any CGM partnership
- **Pharmacodynamic markers** — HRV and RHR measurably change on GLP-1s (−6.2ms SDNN at 12 weeks per *American Journal of Physiology* 2024); reading these contextualizes the changes for users

### Data We Read

| HK Identifier | Data | Where It Surfaces |
|---|---|---|
| `bodyMass` | Weight (lbs/kg) | Log tab → Progress → Weight chart; auto-fills weight logs |
| `bodyFatPercentage` | Body fat % | Log tab → Progress → Body composition card |
| `leanBodyMass` | Lean mass | Log tab → Progress → Muscle preservation trend |
| `heartRateVariabilitySDNN` | HRV (ms) | Home → Health Monitor card; Log → Readiness score |
| `restingHeartRate` | Resting HR (bpm) | Home → Health Monitor card |
| `oxygenSaturation` | SpO2 % | Log tab → Progress → Sleep apnea card |
| `sleepAnalysis` | Sleep stages (REM/deep/core/awake) | Home → Health Monitor; Log → Recovery sub-score |
| `appleSleepingWristTemperature` | Nightly wrist temp (iOS 17+) | Log → Recovery; women's cycle correlation |
| `stepCount` | Daily steps | Home → Activity ring; Log → Activity sub-score |
| `activeEnergyBurned` | Active calories burned | Log → Activity sub-score |
| `vo2Max` | VO2 max (Apple Watch estimate) | Log → Progress → Fitness card |
| `bloodGlucose` | Glucose mg/dL (from CGM apps) | Log → Progress → Glucose sparkline |
| `dietaryProtein` | Daily protein g | Home → Protein ring; also bridges MFP data |
| `dietaryEnergyConsumed` | Daily calories | Log → Nutrition; bridges MFP |
| `dietaryFiber` | Daily fiber g | Log → Nutrition |
| `dietaryCarbohydrates` | Daily carbs g | Log → Nutrition |
| `HKStateOfMind` | Emotional state (iOS 17+) | Log → Mood / Food Noise tracker |
| `HKClinicalTypeIdentifier.labResultRecord` | HbA1c, glucose, lipids (FHIR) | Log → Progress → Lab Results (requires entitlement) |
| `menstrualFlow` | Cycle phase | Home → Women's Health module |

### Data We Write Back

Writing food logs and weight back to Apple Health closes the loop — users see TitraHealth-logged data in Apple Health's Nutrition and Body Measurements sections.

| HK Identifier | When We Write | Notes |
|---|---|---|
| `bodyMass` | After log-weight screen submission | Bidirectional sync |
| `HKCorrelation(.food)` | After meal tray logged | Groups protein + calories + carbs + fat + fiber in one `.food` correlation event |
| `dietaryProtein` | Part of food correlation | Unit: grams |
| `dietaryEnergyConsumed` | Part of food correlation | Unit: kcal |
| `dietaryCarbohydrates` | Part of food correlation | Unit: grams |
| `dietaryFatTotal` | Part of food correlation | Unit: grams |
| `dietaryFiber` | Part of food correlation | Unit: grams |
| `HKStateOfMind` | After mood/food noise check-in | iOS 17+ only |

### Implementation

**Package:** `@kingstinct/react-native-healthkit` v13.2.3 (latest as of March 2026)
- Nitro Modules-based, TypeScript-native
- **Requires custom Dev Client** — does not work in Expo Go
- **Known issue:** `subscribeToChanges` does not work with New Architecture enabled (RN issue #106). Disable New Architecture until this is resolved, or use polling as fallback.

**App.json config plugin:**
```json
["@kingstinct/react-native-healthkit", {
  "healthSharePermission": "TitraHealth reads your health data to personalize your GLP-1 journey",
  "healthUpdatePermission": "TitraHealth writes your weight and food logs to Apple Health",
  "background": true
}]
```

**Permission request:** Batch-request all read + write types in a single call at onboarding (one HealthKit permission sheet). Apple does not let you detect which individual types were denied — handle gracefully by checking if data is available before displaying any card.

**Background delivery setup** (for weight and steps):
```ts
await HealthKit.enableBackgroundDelivery(HKQuantityTypeIdentifier.bodyMass, HKUpdateFrequency.immediate);
await HealthKit.subscribeToChanges(HKQuantityTypeIdentifier.bodyMass, () => { /* re-fetch */ });
```

**Writing a meal as a food correlation:**
```ts
await HealthKit.saveCorrelationSample(HKCorrelationTypeIdentifier.food, [
  { type: HKQuantityTypeIdentifier.dietaryProtein, quantity: 35, unit: 'g' },
  { type: HKQuantityTypeIdentifier.dietaryEnergyConsumed, quantity: 450, unit: 'kcal' },
  // ...
], startDate, endDate);
```

**FHIR / Clinical Records:** Requires `com.apple.developer.healthkit.clinical-records` entitlement (apply via Apple Developer Portal). The `@kingstinct/react-native-healthkit` library does not expose clinical records — use `rn-apple-healthkit-healthrecords` package or a custom native module for this.

---

## 2. Google Health Connect (Android)

**Priority: P0 (parallel with HealthKit)**

### Why

Android parity for all HealthKit functionality. Health Connect is now built into Android 14 (API 34) and is Google's only supported health data platform going forward — the Google Fit SDK is deprecated and shutting down in 2026.

### Data Types

Health Connect covers: Steps, sleep stages, heart rate, HRV (RMSSD), resting HR, body weight, body fat, blood glucose, blood pressure, SpO2, hydration, nutrition (protein/carbs/fat/energy), workout sessions, VO2 max, basal metabolic rate — equivalent coverage to HealthKit for this app's needs.

### Implementation

**Package:** `react-native-health-connect` (matinzd) v3.5.0
- v3.x breaking change: `readRecords` result includes `pageToken` in the returned object
- Android API 34 minimum; Android 9-13 users need the Health Connect app from Play Store
- **Background delivery:** Not yet implemented in the library (issue #83) — use foreground polling on app open for now

**Expo integration:** `expo-health-connect` community config plugin, or bare workflow with custom Dev Client.

**Cross-platform gating:**
```ts
import { Platform } from 'react-native';
const healthData = Platform.OS === 'ios'
  ? await readFromHealthKit()
  : await readFromHealthConnect();
```

### MyFitnessPal on Android

MFP integrated with Health Connect in mid-2023 — it writes daily nutrition totals (calories, protein, carbs, fat) to Health Connect. TitraHealth reading `NutritionRecord` from Health Connect passively ingests MFP data on Android — no MFP API required.

---

## 3. MyFitnessPal

**Priority: P1 (via HealthKit/Health Connect — no direct API)**

### Current API Status

**The MFP public API was deprecated ~2020 and is closed to new applications.** No new developer access is granted. All unofficial npm scrapers (mfp, mfp-api) are fragile ToS violations. Do not build direct MFP API dependency.

### What Is Actually Achievable

**Path 1 — Passive HealthKit/Health Connect bridge (recommended):**

MFP writes daily nutrition summaries to Apple Health and Google Health Connect. TitraHealth reading these via HealthKit/Health Connect automatically ingests MFP data for users who already log there.

What flows in (iOS via HealthKit / Android via Health Connect):
- `dietaryEnergyConsumed` — daily calories
- `dietaryProtein` — daily protein g (most critical for GLP-1 users)
- `dietaryCarbohydrates`
- `dietaryFatTotal`
- `dietaryFatSaturated`
- `dietaryFiber`
- `dietarySugar`
- `dietarySodium`
- `bodyMass` (bidirectional MFP ↔ HealthKit)

**Limitation:** These are daily aggregates, not individual food items. Meal timing, food names, and item-level detail are not accessible. But daily protein total correlated with injection timing is the highest-value use case anyway.

**Path 2 — CSV import on onboarding (one-time historical backfill):**

MFP users can export their full history via Settings > Download Data. The CSV export includes: date, meal type, calories, macros, and some micronutrients. Offer an "Import from MyFitnessPal" option during onboarding that parses this CSV and backfills `food_logs` and `weight_logs` Supabase tables. This removes the "start from scratch" barrier for long-time MFP users.

**Path 3 — Terra API (enterprise):**

Terra (`tryterra.co`) is an approved MFP integration partner and can relay MFP data via webhook to a backend. Cost is ~$399+/month. Appropriate at Series A scale, not for early-stage launch.

### Where It Surfaces

- Users who log in MFP see their protein and macro totals auto-populated in the Home protein ring and Log nutrition tab without any action required
- The word "MyFitnessPal" never needs to appear — it just works via Apple Health
- Onboarding: "Import past data from MyFitnessPal" CSV option

### GLP-1 Value

High. Many GLP-1 users have existing MFP habits and food databases they've curated over years. Reducing the friction of switching to TitraHealth's native food hub is important for retention. Passive macro ingestion means users can continue using both apps during their transition period.

---

## 4. Oura Ring

**Priority: P1**

### Why

Oura's readiness score is a composite of HRV, resting HR, sleep quality, and body temperature — a direct proxy for GLP-1 injection phase recovery. Nausea peaks 24-48h post-injection; Oura readiness will reflect this weekly cycle. This enables injection-phase correlation analysis that no other consumer app offers.

### API Details

- **Base URL:** `https://api.ouraring.com/v2`
- **Auth:** OAuth 2.0 Authorization Code + PKCE — no partner program required for personal data
- **Membership requirement:** As of 2025, Gen 3 and Ring 4 users without active Oura Membership cannot access their data via API
- **Polling:** No webhooks — fetch daily at app open

### Key Endpoints

| Endpoint | Data |
|---|---|
| `/usercollection/daily_readiness` | Readiness score (0-100), HRV balance, recovery index, resting HR |
| `/usercollection/daily_sleep` | Sleep score, total sleep, efficiency, REM/deep/light durations |
| `/usercollection/daily_activity` | Steps, active calories, sedentary time, met_minutes |
| `/usercollection/heartrate` | Minute-level HR |
| `/usercollection/daily_spo2` | SpO2 average |
| `/usercollection/daily_stress` | Stress balance score, daytime stress, recovery time |
| `/usercollection/daily_resilience` | Long-term resilience score |
| `/usercollection/vo2_max` | VO2 max estimate |

### Where It Surfaces

- **Home → Health Monitor cards:** Readiness score, sleep duration, HRV, SpO2, stress
- **Log → Readiness tab:** Full breakdown aligned with injection phase — "You're 2 days post-injection and your readiness score dropped to 62 — this is the expected trough period"
- **Score Detail:** Readiness sub-score pulls from Oura rather than just step count estimate
- **AI Context:** Oura readiness value auto-populates as context when user taps "Ask AI" from Readiness card

### Implementation

```ts
// OAuth via expo-auth-session
const discovery = { authorizationEndpoint: 'https://cloud.ouraring.com/oauth/authorize', tokenEndpoint: 'https://api.ouraring.com/oauth/token' };
// Fetch on app foreground
const readiness = await fetch('https://api.ouraring.com/v2/usercollection/daily_readiness?start_date=...', { headers: { Authorization: `Bearer ${token}` } });
```

Store tokens in `expo-secure-store`. Refresh token flow needed (access tokens expire in 24h).

---

## 5. WHOOP

**Priority: P2**

### Why

WHOOP's Strain and Recovery scores help GLP-1 users who are exercising more as they lose weight avoid overtraining on high-side-effect days. Recovery score (HRV + RHR + SpO2 + skin temp) correlates directly with injection phase readiness.

### API Details

- **Developer portal:** `developer.whoop.com` — free to join (requires WHOOP device + membership)
- **Auth:** OAuth 2.0 per-user tokens

### Key Endpoints

| Endpoint | Data |
|---|---|
| `/developer/v1/cycle` | Strain score, kilojoules, avg/max HR |
| `/developer/v1/recovery` | Recovery % (0-100), HRV RMSSD, resting HR, SpO2, skin temperature |
| `/developer/v1/sleep` | Sleep performance %, stages, debt |
| `/developer/v1/workout` | Workout strain, sport, HR zones |

### Where It Surfaces

Same surfaces as Oura — Health Monitor cards, Readiness score, and AI context. If both Oura and WHOOP are connected, prefer the user-selected primary device; fall back to HealthKit for users with neither.

### Implementation

Same pattern as Oura: OAuth via `expo-auth-session`, REST polling, secure token storage.

---

## 6. Strava

**Priority: P2**

### Why

Strava users are fitness-focused athletes — a key GLP-1 persona (active adults optimizing weight alongside training). Strava provides richer workout data than HealthKit alone: HR zones per workout, GPS routes, pace, power (cycling). For GLP-1 users, rising VO2 max and improving HR zone distribution over time are compelling non-scale victories.

### API Details

- **Developer portal:** `developers.strava.com` — public, no partner approval required
- **Auth:** OAuth 2.0, `expo-auth-session` + PKCE
- **Rate limits:** 200 requests/15 min, 2,000/day (default)
- **Scopes:** `activity:read_all` for workout history; `profile:read_all` for HR zones

### Key Data

- Activity type, distance, duration, elevation
- Average + max HR per workout
- HR zone breakdown (% time in each zone)
- Pace, power (cycling users)
- Route GPS (if athlete privacy allows)

### Where It Surfaces

- **Log → Activity sub-score:** Strava workouts auto-populate activity log with type, duration, and calorie burn
- **Log → Progress → Fitness card:** VO2 max trend, weekly training load, HR zone improvement over time
- **Add Entry sheet:** "LOG ACTIVITY" — if Strava is connected, offer "Import from Strava" to pull today's workouts automatically
- **AI Context:** When tapping "Ask AI" from Activity card, include recent Strava workout data in context

### Implementation

```ts
const strava = { authorizationEndpoint: 'https://www.strava.com/oauth/authorize', tokenEndpoint: 'https://www.strava.com/oauth/token' };
// Fetch recent activities
const activities = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', { headers: { Authorization: `Bearer ${token}` } });
```

Note: Strava vs. HealthKit are complementary. Strava is richer for workout sessions; HealthKit is better for passive 24/7 metrics (HRV, RHR, steps). Use both.

---

## 7. Withings

**Priority: P1**

### Why

26-40% of weight lost on GLP-1s comes from lean mass (muscle + bone). A user who loses 20 lbs but 8 lbs of it is muscle is in a worse metabolic position than the scale number suggests. Withings smart scales (Body+, Body Comp, Body Scan) provide body fat %, muscle mass, bone mass, and visceral fat index — the only way to track lean mass preservation.

Withings also makes blood pressure monitors, which is relevant: the SELECT trial (2024) showed semaglutide reduces MACE events by 20% in CVD patients via blood pressure reduction.

### API Details

- **Developer portal:** `developer.withings.com` — free registration, no partner approval
- **Auth:** OAuth 2.0
- **Webhook support:** Yes — Withings pushes new measurements to a registered URL (requires Supabase Edge Function to receive)

### Key Measurement Types

| meastype | Data |
|---|---|
| `1` | Weight (kg) |
| `6` | Body fat % |
| `76` | Muscle mass (kg) |
| `88` | Bone mass (kg) |
| `170` | Visceral fat index |
| `9` | Diastolic BP |
| `10` | Systolic BP |
| `11` | Heart rate (from BP cuff) |

### Where It Surfaces

- **Log → Progress → Body Composition card:** Body fat %, lean mass, visceral fat trend over time with "muscle preservation" framing specific to GLP-1 therapy
- **Log → Progress → Weight chart:** Weight readings auto-populate weight logs
- **Log → Progress → Blood Pressure trend:** Systolic/diastolic over time; milestone alert when BP moves below hypertension threshold
- **AI Context:** "Your lean mass has dropped X lbs this month alongside Ylbs of fat — here's how to optimize..."

### Implementation

OAuth via `expo-auth-session`. For polling: `GET https://wbsapi.withings.net/measure?action=getmeas`. For webhooks: register `POST` endpoint in Withings developer portal pointing to a Supabase Edge Function URL.

**Fallback:** HealthKit stores body fat % and lean body mass from any Withings/InBody/Renpho scale that writes to Apple Health. Read from HealthKit first; Withings direct OAuth gives more granular detail (visceral fat, bone mass).

---

## 8. Continuous Glucose Monitoring

**Priority: P1 (via HealthKit) / P2 (direct API)**

### Why CGM Is the Most Clinically Unique Integration for TitraHealth

GLP-1 receptor agonists work primarily by enhancing glucose-dependent insulin secretion and reducing glucagon. Blood glucose response is the *direct pharmacodynamic readout* of the medication working. Glucose Time in Range (TIR), mean glucose, and post-meal spike blunting are visible, real-time evidence that the medication is doing its job.

### Approach A: HealthKit (Recommended — No Partnership Required)

All major CGMs write blood glucose to Apple Health:
- Dexcom G6/G7/ONE/ONE+ (via Dexcom app)
- Abbott FreeStyle Libre / Libre 2/3 (via LibreLink app)
- Stelo (Dexcom OTC CGM, FDA-cleared 2024 — targets exactly the GLP-1 population)

TitraHealth reads `HKQuantityTypeIdentifierBloodGlucose` from HealthKit — no partnership needed. This covers 90%+ of CGM users.

### Approach B: Dexcom API (Direct, requires partnership)

The Dexcom API v3 requires applying to Dexcom Strategic Partnerships — not self-serve. Key endpoints: `GET /v3/users/self/egvs` (5-min interval glucose history), `/v3/users/self/statistics` (TIR, GMI, mean glucose). This unlocks CGM data for Android users and provides richer statistics than raw HealthKit samples.

### Where It Surfaces

- **Log → Progress → Glucose panel:**
  - 24-hour glucose trace (line chart, green band for 70-180 mg/dL TIR range)
  - Time in Range ring (target >70%)
  - Mean glucose and glucose variability (CV%) trending down as medication takes effect
- **Log tab → Medication tab:** Overlay injection day markers on glucose curve to show pharmacodynamic effect — this visualization is unique to TitraHealth
- **Home → Health Monitor card:** Current glucose + TIR summary
- **AI Context:** "Your TIR is 74% this week, up from 61% when you started — the medication is measurably improving your glucose control"

---

## 9. SMART on FHIR / Apple Health Records

**Priority: P2**

### Why

GLP-1 users have lab results that directly measure medication efficacy: HbA1c, fasting glucose, LDL, triglycerides, HDL. Reading these from Apple Health Records and displaying them alongside the weight and medication timeline gives users visible, clinical evidence of metabolic improvement beyond weight.

Key labs: HbA1c (LOINC `4548-4`), fasting glucose (`1558-6`), LDL (`13457-7`), HDL (`2085-9`), triglycerides (`2571-8`), eGFR (`33914-3`), ALT (`1742-6`), systolic BP (`8480-6`).

### How to Access

Apple Health Records aggregates FHIR R4 data from Epic, Cerner, Meditech, and hundreds of other EHR systems that users have connected.

**Entitlement required:** `com.apple.developer.healthkit.clinical-records` — must be applied for via Apple Developer Portal. Requires app review justification. Not automatically granted.

**React Native implementation:** The `@kingstinct/react-native-healthkit` library does not currently expose clinical records. Use `rn-apple-healthkit-healthrecords` (npm) which exposes `getLabRecords()` returning FHIR `Observation` JSON, or write a custom native Swift module.

### Where It Surfaces

- **Log → Progress → Lab Results section:** HbA1c trend chart with injection start date marker; "Your HbA1c has improved from 8.2% → 6.8% since starting Ozempic"
- **Log → Progress:** Triglyceride and LDL improvement cards with cardiovascular risk reduction framing
- **Profile screen:** Full lab history timeline synchronized with medication dose escalation timeline
- **AI Context:** Lab values auto-included in system prompt when relevant

---

## 10. GoodRx

**Priority: P2**

### Why

GLP-1 medications cost $900–$1,400/month at list price. Insurance coverage varies wildly. The #1 adherence barrier is cost — connecting users to the best available cash-pay price at nearby pharmacies is a high-value feature that requires minimal ongoing maintenance.

### API Details

- **Access:** GoodRx Affiliate API — requires partner application at developer.goodrx.com
- **Key endpoint:** `GET /drugs/prices?name=semaglutide&zip={userZip}` → pharmacy list with prices

### Where It Surfaces

- **Log → Medication tab:** "Check prices near you" card showing 3-5 lowest prices for user's specific GLP-1 at nearby pharmacies
- **Profile → Medication settings:** Price check available whenever viewing medication details
- **Injection reminder push notification (optional):** Deep link to GoodRx if user hasn't refilled recently

---

## 11. OpenAI Voice Logging

**Priority: P1**

### Why

Voice food logging is the highest-ROI interaction improvement possible. A user sitting down to lunch should be able to say "I had a grilled chicken burrito with guacamole and no sour cream" and have it parsed and added to the meal tray. Typing food descriptions is the biggest friction point in food logging apps.

### Implementation Options

**Option A — Whisper API (ship now):** `openai` npm package, `audio.transcriptions.create()`. Cost: $0.006/minute (~$0.001 for a 5-second food log). Record with `expo-av`, send audio file to Whisper API, pass returned text to existing GPT-4o-mini food parsing flow. No model download, works in Expo managed workflow.

**Option B — whisper.rn (offline, no API cost):** React Native binding of `whisper.cpp`. Runs entirely on-device. Requires custom Dev Client. Tiny model (39MB) is sufficient for food name transcription. iOS works well; Android needs `expo-av` + `ffmpeg-kit-react-native` for audio format conversion.

**Option C — OpenAI Realtime API (v2 conversational AI):** Full duplex speech-to-speech with function calling. User speaks conversationally; model calls `log_food`, `log_injection`, `ask_question` functions in real time and responds in voice. General availability as of August 2025. Cost: ~$0.06/min audio in + $0.24/min audio out. Ideal for the AI coach conversational interaction in ai-chat.tsx.

**Option D — expo-speech-recognition:** Native on-device speech recognition (iOS SFSpeechRecognizer / Android SpeechRecognizer). Free, no API key. Lower accuracy for food names but zero cost.

**Recommended path:** Ship Option A (Whisper API) for voice mode in `log-food.tsx` describe screen — minimal code addition, negligible cost per transcription. Plan Option C (Realtime API) for the AI coach voice interaction in `ai-chat.tsx` v2.

### Where It Surfaces

- **Log Food → Describe mode:** Microphone button in the text input area; tap-to-record; transcription auto-fills the describe field
- **AI Chat (v2):** Full voice conversation with GLP-1 coach
- **Log Injection (v2):** "Hey, I just did my shot in the left thigh" voice log

---

## 12. Terra API

**Priority: P2 (evaluate at Series A)**

### What It Is

Terra (`tryterra.co`) is a unified health data aggregator — "Plaid for wearables." Instead of maintaining individual OAuth integrations for 10+ wearable brands, Terra handles all of them and delivers normalized data to your backend via webhook.

### Coverage (2025)

Apple Watch/Health, Google Fit/Health Connect, Garmin, Fitbit, Oura, WHOOP, Samsung Health, Polar, Suunto, Cronometer, Withings, Dexcom, InBody, and 100+ total sources.

**React Native SDK:** Official at `github.com/tryterra`, documented at `docs.tryterra.co`.

### Data Types Delivered

Activity, sleep, body metrics, daily vitals, nutrition (Cronometer data), menstrual health — normalized across all source devices.

### Pricing (2025)

$399/month billed annually ($499/month billed monthly). Includes 100,000 credits/month.

### When to Use Terra

Terra is not appropriate for early-stage launch. Use direct device APIs (WHOOP, Oura, Strava, Withings) first. Migrate to Terra when:
- Supporting 10+ wearable brands is a key differentiator
- Maintaining individual integrations becomes a bandwidth constraint
- Enterprise/B2B plan customers require broad device support

### Cronometer via Terra

Cronometer does not have a public API — Terra is the only legitimate path to Cronometer nutrition data. Cronometer is better than MFP for micronutrients (82+ nutrients, amino acid profiles, B vitamins) but has a smaller food database. Surface micronutrient deficiencies (especially B12, vitamin D, magnesium — all relevant for GLP-1 users with appetite suppression) if Terra + Cronometer data is available.

---

## 13. Apple Watch Complications

**Priority: P3**

### What's Possible

Apple Watch complications and widgets require native Swift/SwiftUI code — they cannot run JavaScript or React Native directly. However, an Expo-managed app can include a watchOS extension:

- **`expo-apple-targets`** (Evan Bacon): Config plugin that sets up Apple targets including watchOS app and complications within EAS Build pipeline
- **`react-native-watch-connectivity`**: Bidirectional communication between RN iOS app and native watchOS extension via WatchConnectivity (WCSession)

### What to Show

A TitraHealth complication on the watch face could show:
- Days until/since last injection
- Today's protein progress (e.g., "84g / 120g")
- Current Lifestyle Score
- Current injection phase

Complications update up to 4 times per hour — sufficient for daily health metrics.

### Architecture

1. Write watchOS extension in Swift (ClockKit/SwiftUI Accessories for watchOS 9+)
2. Use `react-native-watch-connectivity` to push data from RN app to watch via WCSession
3. Wire through EAS Build using `expo-apple-targets`
4. Reference: `github.com/mpiannucci/eas-widget-watchos-example`

### Build Note

Requires EAS Build (no Expo Go). High implementation effort — appropriate for a polished v2 milestone after core features are established.

---

## 14. OpenWeatherMap

**Priority: P2**

### Why

Weather directly affects outdoor activity recommendations. "Today's Focus" cards should know whether it's raining, dangerously hot, or perfect for a walk. Post-injection days + extreme heat = high dehydration risk (GLP-1 nausea already increases dehydration; heat compounds it).

### API Details

- **Endpoint:** `GET https://api.openweathermap.org/data/2.5/weather?zip={zip}&units=imperial`
- **Free tier:** 1,000 calls/day — sufficient for daily app-open refresh
- **API key:** Free registration at openweathermap.org

### Where It Surfaces

- **Home → Today's Focuses:** Adapts activity suggestion based on weather ("90°F and humid today — indoor resistance training instead of a walk")
- **Home → Focuses:** On post-injection days with extreme heat, shows hydration warning card
- **Log → Activity suggestions:** Context-aware workout recommendations

---

## 15. SDOH APIs

**Priority: P2**

### CDC PLACES API

ZCTA-level (zip code) health outcome data — obesity rates, diabetes prevalence, physical inactivity rates.

- **Endpoint:** `GET https://data.cdc.gov/resource/qnzd-25i4.json?locationname={zip_code}`
- **Use:** Calibrate the Lifestyle Effectiveness Score for environmental context; show contextual benchmarking ("In your area, 38% of adults have obesity — you're working against the grain")
- **Privacy:** Request zip code at onboarding (not GPS); never expose SDOH scores in a stigmatizing way

### Walk Score API

Walkability score (0-100) for any US location.

- **API:** `api.walkscore.com` — free tier for low volume
- **Use:** Adjust step goal recommendations (Walk Score <40 → suggest 6,000 steps; Walk Score >70 → suggest 10,000); adapt Today's Focus activity suggestions

### USDA Food Access Research Atlas

Census-tract food desert classification.

- **Use:** If user is in a food desert — surface "healthy eating on a budget" content; adjust nutrition recommendations to use shelf-stable proteins (canned fish, legumes, protein powder) instead of assuming access to fresh produce

### Where SDOH Surfaces

- **Profile → Settings:** Zip code input; walkability badge display
- **Home → Today's Focuses:** Weather + walkability + food access context shapes daily focus cards
- **AI Context:** SDOH context included in system prompt so AI recommendations are environment-realistic

---

## 16. Walgreens Rx API

**Priority: P3**

### Status

Walgreens Developer Portal (`developer.walgreens.com`) has a Prescription Refill & Transfer API (`POST /v1/prescriptions/rxrefill`). Several consumer health apps have used it, but the portal is legacy/low-maintenance (limited activity since ~2016). Current approval status for new developers is unclear — requires direct inquiry.

### Where It Surfaces

- **Log → Medication tab:** "Refill at Walgreens" button on the injection log/medication screen — triggers refill or opens Walgreens app via deep link
- **Push notification:** 7 days before estimated pen run-out → prompt refill

### Fallback

Without Walgreens API access, calculate refill date from injection frequency + pen quantity in `userStore` and schedule a local push notification (via `expo-notifications`) 7 days before estimated run-out. No external API required for this basic version.

---

## No Viable Path

These were researched and confirmed non-viable for an independent developer in 2025-2026:

| Integration | Reason |
|---|---|
| MyFitnessPal direct API | Closed since 2020; not accepting new partners |
| Cronometer API | No public API; enterprise B2B only via Terra |
| Noom / Found / Calibrate | No developer APIs; closed consumer platforms |
| Hims & Hers / Ro / Sequence telehealth APIs | No developer APIs; FHIR is the indirect path |
| Lark Health / Omada Health APIs | Enterprise/payer-only; no developer access |
| Fitbit API (new integrations) | Post-Google acquisition, deprecated; use Health Connect instead |
| Samsung Health (direct SDK) | Requires Samsung partnership; route via Health Connect |
| Amazon Pharmacy API | No public developer API |
| Abbott FreeStyle Libre direct API | No public API; LibreView requires partnership; read via HealthKit instead |
| Alexa / Google Home voice skills | Technically possible but low-value compared to in-app voice; ship in-app voice first |

---

## App Surface Map

Where each integration surfaces across the four main tabs and supporting screens:

### Home Tab (`app/(tabs)/index.tsx`)
| Integration | Card / Element |
|---|---|
| HealthKit / Health Connect | Steps, active calories → Activity ring; protein → Protein ring |
| HealthKit / Health Connect | HRV, resting HR, SpO2 → Health Monitor cards |
| HealthKit / Health Connect | Sleep duration → Health Monitor |
| OpenWeatherMap | Today's Focuses — weather-aware activity suggestions |
| Walk Score | Today's Focuses — step goal adaptation |
| Oura Ring | Readiness score → Health Monitor card (replaces estimate if connected) |
| WHOOP | Recovery score → Health Monitor card |

### Log Tab (`app/(tabs)/log.tsx`)

#### Medication Tab
| Integration | Where |
|---|---|
| HealthKit | Injection phase correlation with HRV/RHR chart |
| CGM (via HealthKit or Dexcom) | Glucose overlay on injection timeline — pharmacodynamic visualization |
| GoodRx | "Check prices near you" card |
| Withings | Blood pressure trend |

#### Lifestyle Tab
| Integration | Where |
|---|---|
| HealthKit | Nutrition totals (bridges MFP data passively) |
| Strava | Activity details — HR zones, pace, distance from workouts |
| Apple Health Records | HbA1c, fasting glucose, lipid panel trend |

#### Progress Tab
| Integration | Where |
|---|---|
| Withings | Body composition — fat %, lean mass, visceral fat trend |
| HealthKit | VO2 max trend, body fat %, lean body mass |
| CGM | Glucose sparkline, TIR ring, mean glucose trend |
| Apple Health Records | Full lab results timeline |

### Profile / Settings
| Integration | Where |
|---|---|
| HealthKit | Connection status; what data is being read/written |
| Oura / WHOOP / Strava / Withings | Connected device list with OAuth connect/disconnect |
| MFP | "Import historical data" CSV import |
| Walk Score / CDC PLACES | Zip code input and walkability/health context |

### AI Chat (`app/ai-chat.tsx`)
All integrations that provide numeric data contribute to the `buildContextSnapshot()` system prompt. Contextual AI responses should reference: current readiness score (Oura/WHOOP), recent glucose trend (CGM), lean mass preservation status (Withings), recent lab values (FHIR), and workout load (Strava).

---

## Implementation Roadmap

### Phase 1 — Foundation (v1.0, current milestone)
*(Enables passive data for all iOS users, no partnerships required)*

1. **Apple HealthKit** — Read: bodyMass, HRV, RHR, sleepAnalysis, stepCount, activeEnergyBurned, bloodGlucose, dietaryProtein, dietaryEnergyConsumed. Write: bodyMass, food correlation samples. This single integration covers MFP bridge, Dexcom/Libre/Stelo CGM, and passive macro tracking.
2. **Google Health Connect** — Android parity for all Phase 1 HealthKit types.
3. **Voice logging (Whisper API)** — Microphone button in log-food describe mode. Ship immediately — high UX impact, minimal code.

### Phase 2 — Wearables + CGM Direct (v1.5)
*(Differentiates from basic trackers; enables injection-phase correlation)*

4. **Oura Ring** — OAuth connect; daily_readiness + daily_sleep + daily_spo2. Enables injection-phase recovery curve.
5. **Withings** — OAuth connect; body composition. Lean mass preservation visualization — the clinical story only possible with this data.
6. **Strava** — OAuth connect; activity import. HR zones, VO2 max trend, workout quality over time.
7. **OpenWeatherMap** — Today's Focuses weather awareness. Low effort, high polish.
8. **GoodRx** — Apply for affiliate API. High adherence value (medication cost is #1 barrier).

### Phase 3 — Clinical Data + Advanced (v2.0)
*(Clinical differentiation for serious users)*

9. **SMART on FHIR / Apple Health Records** — Apply for clinical records entitlement. HbA1c, glucose, lipid trends alongside medication timeline.
10. **Dexcom Partnership** — Apply for strategic API access. Enables Android CGM users and richer glucose statistics (TIR, GMI).
11. **WHOOP** — OAuth connect. Complementary to Oura for athlete users.
12. **OpenAI Realtime API** — Voice AI coach in ai-chat.tsx.
13. **SDOH APIs** — CDC PLACES + Walk Score + USDA Food Access. Context-aware goal setting.

### Phase 4 — Scale + Enterprise (v2.5+)
*(Series A milestones)*

14. **Terra API** — Replace individual wearable integrations; adds Garmin, Fitbit, Samsung Health, Cronometer, InBody support in one SDK.
15. **Apple Watch complications** — EAS Build native watchOS extension.
16. **Walgreens Rx API** — Direct refill trigger from app.
17. **Voice Alexa/Google Home** — Smart speaker skill for injection logging and check-ins.
18. **Provider Dashboard** — Supabase + Next.js web view for prescribers; Telehealth deep links.
