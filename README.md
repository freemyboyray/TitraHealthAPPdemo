# titra — GLP-1 Companion App

A behavior-guidance and tracking app for people on GLP-1 medications (Ozempic, Wegovy, Mounjaro, Zepbound, Saxenda, Rybelsus, and more). Ties medication adherence, lifestyle behaviors, and progress tracking together through a single daily score.

**Platform:** iOS / Android (React Native + Expo)
**Stack:** Expo Router · Supabase · Zustand · GPT-4o-mini · Apple HealthKit

---

## Features

- **Lifestyle Effectiveness Score** — two animated score rings (Recovery + GLP-1 Amplifier) driven by real daily data
- **Personalized targets** — Mifflin-St Jeor BMR + evidence-based macro/hydration goals auto-calculated from your profile
- **Side-effect adjustment engine** — 13 GLP-1 side effects dynamically adjust daily nutrition and activity targets (severity + recency weighted)
- **Drug-aware PK chart** — FDA-sourced Bateman-equation pharmacokinetic model for all 6 GLP-1 drug classes; 28-point smooth cycle curve with cycle-anchored x-axis labels and a real-time "NOW" marker showing your current concentration position
- **AI coaching** — GPT-4o-mini contextual insights, coach notes, and food parsing with full health context
- **Food logging** — describe (AI NLP), photo (GPT-4o-mini vision), barcode scan (USDA), or search (USDA FoodData Central)
- **Activity logging with steps** — workout type picker, arc-gauge duration/intensity, auto-estimated steps (type × duration lookup), editable steps field, and calorie/steps data wired to Lifestyle tab cards; multiple workouts per day supported
- **Weekly check-in surveys** — 4 Likert-scale surveys (GI Burden, Activity Quality, Sleep Quality, Mental Health) that unlock sequentially across the injection cycle; scores normalized to 0–100 and stored for trend analysis
- **Weekly summary** — 7-day cycle recap with weight delta, average nutrition/activity metrics, check-in scores, and a GPT-4o-mini narrative insight; exportable as PDF
- **Side effect impact viewer** — shows exactly how your active side effects are adjusting each daily target (protein, water, fiber, steps, calories) with delta badges and evidence-based reasons
- **14-screen onboarding** — collects full metabolic profile, medication details, goals, and activity level
- **Accurate medication display** — brand name (e.g., "Mounjaro®") shown throughout; profile changes in Settings immediately update the PK chart drug and half-life
- **Smart focus cards** — phase-weighted daily focuses with completion state (strikethrough + orange checkmark when hit; plain gray ring when not)
- **CycleIQ biometric intelligence** — EMA-based personal baseline for HRV, resting HR, and sleep; drug-phase delta engine classifies deviations as Expected GLP-1 Effect / Better Than Expected / Mildly Unusual / Concerning; tap-to-expand card explains methodology and badge meanings
- **Education hub** — phase-aware personalized tips card; Myth vs. Fact swipeable deck; interactive Side Effect Decoder (20 symptoms, 3 tiers); "When to Call Your Doctor" safety card; 7 deep-dive accordion sections; Supabase article library with 10 seeded evidence-based articles
- **Light/dark mode** — persistent app-wide theme with orange `#FF742A` brand accent unchanged in both modes
- **Google + Apple Sign In** — OAuth via `expo-auth-session` + Supabase Auth

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/freemyboyray/TitraHealthAPPdemo.git
cd TitraHealthAPPdemo
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Supabase migrations

Apply the migrations in `supabase/migrations/` to your Supabase project in order.

### 4. Start the development server

```bash
# Standard (LAN, no OAuth)
npx expo start --clear

# With tunnel (required for Google OAuth in Expo Go)
npx expo start --tunnel --clear
```

Scan the QR code with **Expo Go** (iOS/Android) or press `i` for iOS Simulator.

> **Note:** Some features require a native build (`expo run:ios`) — camera, barcode scanner, Apple HealthKit, and Apple Sign In are not available in Expo Go.

---

## Project Structure

```
app/            # Expo Router screens (auth, onboarding, tabs, entry flows)
components/     # Shared UI components (add-entry-sheet, score-ring, etc.)
constants/      # Theme, drug PK model, scoring engine, user profile types
contexts/       # ProfileContext, HealthContext, ThemeContext
lib/            # Supabase client, OpenAI/Anthropic wrappers, targets engine
stores/         # Zustand stores (log, user, insights, preferences, ui)
supabase/       # Database migrations
```

See [SD.md](./SD.md) for the full Software Design Document.

---

## Key Libraries

| Purpose | Library |
|---|---|
| Framework | React Native + Expo |
| Routing | Expo Router |
| Backend / Auth | Supabase |
| State | Zustand |
| Health data | `@kingstinct/react-native-healthkit` |
| AI | OpenAI GPT-4o-mini + Anthropic Claude Haiku |
| Food data | USDA FoodData Central |
| Animations | Reanimated + react-native-svg |

---

## Google Sign-In Setup

See [GOOGLE_SIGNIN_SETUP.md](./GOOGLE_SIGNIN_SETUP.md) for the complete checklist covering Supabase Dashboard, Google Cloud Console, and redirect URI configuration.
