# GLP-1 Companion App — Software Design Document

**Project:** TitraHealthAPPdemo
**Platform:** iOS / Android (React Native + Expo)
**Last Updated:** March 6, 2026

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Navigation Structure](#4-navigation-structure)
5. [Design System](#5-design-system)
6. [Screens](#6-screens)
   - [Splash Gate](#60-splash-gate)
   - [Onboarding](#61-onboarding-flow-14-screens)
   - [Home](#62-home-screen)
   - [Insights](#63-insights-screen)
   - [Education](#64-education-screen)
   - [Add Entry Sheet](#65-add-entry-sheet)
7. [Data Models](#7-data-models)
8. [State Management](#8-state-management)
9. [Component Inventory](#9-component-inventory)
10. [Feature Status](#10-feature-status)
11. [Planned Integrations](#11-planned-integrations)
12. [Open Questions & Future Work](#12-open-questions--future-work)

---

## 1. Product Overview

The **GLP-1 Companion** is a behavior-guidance and tracking app for users on GLP-1 medications (e.g., Ozempic, Wegovy, Mounjaro). It integrates medication timing, lifestyle behaviors, and progress tracking into a single daily experience.

### Core Value Propositions

| Pillar | What the App Does |
|---|---|
| **Medication Adherence** | Tracks injection history, dose level, and next-dose countdowns |
| **Lifestyle Optimization** | Monitors protein, hydration, fiber, steps, and sleep to maximize GLP-1 effectiveness |
| **Progress Visibility** | Weight trend charts, BMI, goal progress, total weight lost |
| **Daily Guidance** | Contextual, personalized action cards driven by real user data |
| **Education** | Structured content on GLP-1 usage, nutrition, and lifestyle best practices |

### Differentiator

Most GLP-1 apps focus on one dimension (food log *or* injection tracker *or* weight chart). This app ties all three together through the **Lifestyle Effectiveness Score** — a single number that reflects how well a user's daily behaviors are supporting their medication.

---

## 2. Tech Stack

| Category | Library | Version |
|---|---|---|
| Framework | React Native | `0.81.5` |
| JS Runtime | React | `19.1.0` |
| Navigation / Routing | Expo Router | `~6.0.23` |
| Navigation Core | React Navigation | `^7.x` |
| Animations | react-native-reanimated | `~4.1.1` |
| Animation Worklets | react-native-worklets | `0.5.1` |
| Gesture Handling | react-native-gesture-handler | `~2.28.0` |
| Glass / Blur Effects | expo-blur | `~15.0.8` |
| Haptic Feedback | expo-haptics | `~15.0.8` |
| Icon Library | @expo/vector-icons | `^15.0.3` |
| Safe Area | react-native-safe-area-context | `~5.6.0` |
| Platform Icons (iOS) | expo-symbols | `~1.0.8` |
| Image Handling | expo-image | `~3.0.11` |
| Web Support | react-native-web | `~0.21.0` |
| Local Persistence | @react-native-async-storage/async-storage | `^2.1.2` |
| Language | TypeScript | `~5.9.2` |
| Linting | ESLint + eslint-config-expo | `^9.25.0` |

### Icon Packs in Use

- `Ionicons` — navigation, camera, barcode, search, warnings, water, body
- `MaterialIcons` — food, activity, AI, chart/fitness
- `FontAwesome5` — syringe
- `MaterialCommunityIcons` — scale/weight

---

## 3. Architecture Overview

```
TitraHealthAPPdemo/
├── app/
│   ├── _layout.tsx              # Root Stack + GestureHandlerRootView + ProfileProvider
│   ├── index.tsx                # Splash gate — redirects to /onboarding or /(tabs)
│   ├── modal.tsx                # Generic modal screen
│   ├── ai-chat.tsx              # AI Chat modal screen
│   ├── score-detail.tsx         # Score drill-down screen (Recovery / GLP-1 Amplifier)
│   ├── onboarding/
│   │   ├── _layout.tsx          # Stack navigator (slide_from_right, no header)
│   │   ├── index.tsx            # Step 1: GLP-1 journey stage
│   │   ├── medication.tsx       # Step 2: Medication brand
│   │   ├── dose.tsx             # Step 3: Current dose
│   │   ├── schedule.tsx         # Step 4: Injection frequency + last shot date
│   │   ├── sex.tsx              # Step 5: Biological sex
│   │   ├── birthday.tsx         # Step 6: Birthday (wheel picker)
│   │   ├── body.tsx             # Step 7: Height + Weight (wheels, unit toggle)
│   │   ├── health-sync.tsx      # Step 8: Apple Health (optional)
│   │   ├── start.tsx            # Step 9: Starting weight + start date
│   │   ├── goal-weight.tsx      # Step 10: Goal weight (horizontal ruler picker)
│   │   ├── goal-speed.tsx       # Step 11: Weekly loss target (snap selector)
│   │   ├── activity.tsx         # Step 12: Activity level
│   │   ├── cravings.tsx         # Step 13: Craving days (multi-select)
│   │   └── side-effects.tsx     # Step 14: Side effects → save → redirect
│   └── (tabs)/
│       ├── _layout.tsx          # Tab navigator + CustomTabBar + FAB + AddEntrySheet
│       ├── index.tsx            # Home screen (dashboard)
│       ├── log.tsx              # Insights screen (3-tab: Medication / Lifestyle / Progress)
│       └── explore.tsx          # Education screen (placeholder)
├── components/
│   ├── add-entry-sheet.tsx      # FAB-triggered bottom sheet for all logging
│   ├── score-ring.tsx           # Animated SVG ring (Reanimated + react-native-svg)
│   ├── ring-breakdown.tsx       # Tap-to-expand score breakdown sheet
│   ├── onboarding/
│   │   ├── onboarding-header.tsx  # Progress bar (Reanimated width) + back button
│   │   ├── option-pill.tsx        # Single/multi-select pill button
│   │   ├── continue-button.tsx    # Full-width dark CTA pinned to bottom
│   │   └── wheel-picker.tsx       # Snap-scroll FlatList wheel picker
│   └── ui/
│       ├── collapsible.tsx      # Expand/collapse section
│       ├── icon-symbol.tsx      # Cross-platform icon bridge
│       └── icon-symbol.ios.tsx  # iOS SF Symbols version
├── contexts/
│   ├── profile-context.tsx      # ProfileProvider — AsyncStorage load/save, draft, completeOnboarding
│   ├── health-data.tsx          # HealthProvider(profile) — useReducer scores + dispatch
│   └── tab-bar-visibility.tsx   # Scroll-aware tab bar hide/show (Animated.spring)
├── constants/
│   ├── user-profile.ts          # FullUserProfile type, ProfileDraft, BRAND_TO_GLP1_TYPE, helpers
│   ├── mock-profile.ts          # MOCK_PROFILE (FullUserProfile shape, fallback when no onboarding)
│   ├── scoring.ts               # getDailyTargets, computeRecovery, computeGlp1Support, insights, breakdown data, coach notes
│   └── theme.ts                 # Color tokens + Font definitions
├── hooks/
│   ├── use-color-scheme.ts
│   ├── use-color-scheme.web.ts
│   └── use-theme-color.ts
└── assets/
    └── images/
```

### Key Architectural Decisions

- **File-based routing via Expo Router** — screens map directly to files under `app/`.
- **ProfileProvider at root** — wraps everything in `_layout.tsx`. Loads `FullUserProfile` from AsyncStorage on mount. `profile === null` means onboarding not complete.
- **Splash gate** — `app/index.tsx` checks `isLoading` + `profile` and redirects to `/onboarding` or `/(tabs)`. Fresh install always hits onboarding; returning users go straight to tabs.
- **HealthProvider accepts profile prop** — `(tabs)/_layout.tsx` reads `useProfile()` and passes `profile ?? MOCK_PROFILE` to `HealthProvider`. All scoring is personalized from day one.
- **GestureHandlerRootView at root** — wraps entire app in `_layout.tsx` so gesture-based components (sliders, drag handles) work everywhere.
- **AddEntrySheet rendered at tab layout level** — sibling of `<Tabs>`, overlays entire UI including nav bar.
- **Scroll-aware tab bar** — `TabBarVisibilityProvider` exposes `onScroll` handler, `Animated.spring` slide.
- **AsyncStorage key:** `@titrahealth_profile`

---

## 4. Navigation Structure

```
Root Stack (GestureHandlerRootView > ProfileProvider > ThemeProvider)
├── index                         ← Splash gate (instant redirect)
├── onboarding/                   ← 14-screen Stack (slide_from_right)
│   ├── index    (Step 1)
│   ├── medication … side-effects (Steps 2–14)
└── (tabs)                        ← No header
    ├── index       [Home]
    ├── log         [Insights]    ← Rename to insights.tsx pending
    └── explore     [Education]   ← Rename to education.tsx pending

Overlays (rendered outside tab navigator):
└── AddEntrySheet                 ← Modal, slide animation, transparent
```

### Custom Tab Bar

The default React Navigation tab bar is replaced with `CustomTabBar`:

1. **Glass Pill** — frosted glass capsule (`BlurView` intensity 75, dark tint) with three tab icon buttons. Active tab renders a 46×46 orange circle (`#E8831A`) behind a white icon. Inactive icons use `#5A5754`.
2. **FAB** — floating circular button, orange glass overlay (`rgba(232,131,26,0.70–0.92)`). Toggles `add` ↔ `close`. Opens/closes `AddEntrySheet`.

### Scroll-Aware Behavior

Auto-hides on scroll down, restores on scroll up. `Animated.spring` animation.

---

## 5. Design System

### Dark-First Design (current)

All screens use a unified dark palette. Tokens are exported from `constants/theme.ts`.

| Token | Hex | Usage |
|---|---|---|
| `BG_BASE` | `#141210` | All screen backgrounds |
| `BG_SURFACE` | `#1E1B17` | Card / sheet surface |
| `BG_SURFACE2` | `#252219` | Elevated / active surface, input bg |
| `ORANGE` | `#FF742A` | Primary brand accent — FAB, active tab, accents, progress bars, score rings |
| `ORANGE_DIM` | `rgba(255,116,42,0.15)` | Icon bg tint, selected pill bg |
| `TEXT_PRIMARY` | `#FFFFFF` | All primary text |
| `TEXT_SECONDARY` | `#9A9490` | Subtitles, labels, secondary text |
| `TEXT_MUTED` | `#5A5754` | Placeholders, disabled, section labels |
| `BORDER_SUBTLE` | `rgba(255,255,255,0.08)` | Dividers, card borders |
| `GLASS_OVERLAY` | `rgba(255,255,255,0.04)` | BlurView overlay on dark bg |
| `SHADOW_COLOR` | `#000000` | Drop shadows |

**Status colors (semantic, unchanged):**
- Good: `#27AE60` | Low: `#F39C12` | Bad: `#E74C3C`

Glass card pattern:
```
Container (shadow + borderRadius)
└── backgroundColor: '#1E1B17'
└── BlurView (intensity 55–80, tint: "dark") — absolute fill
    └── rgba(255,255,255, 0.04) overlay
        └── GlassBorder: top rgba(255,255,255,0.13), left 0.08, right 0.03, bottom 0.02
```

Shadow: `shadowColor '#000000', offset {0,8}, opacity 0.08–0.12, radius 24, elevation 8`

### Onboarding — Dark, consistent with main app

Shares the same dark palette (no longer a separate "clean/clinical" aesthetic):

| Token | Value |
|---|---|
| Background | `#141210` |
| Title | `#FFFFFF`, 28px, weight 800 |
| Subtitle | `#9A9490`, 15px, weight 400 |
| Option pill unselected | `#252219` bg, `rgba(255,255,255,0.10)` border, white text |
| Option pill selected | `rgba(232,131,26,0.15)` bg, `#E8831A` border + text |
| Continue button | `#FFFFFF` bg, 56px height, 28px radius, `#141210` text (inverted CTA) |
| Progress bar track | `rgba(255,255,255,0.12)`, 3px height |
| Progress bar fill | `#E8831A`, animated with Reanimated `withTiming` |
| Wheel picker center | full opacity; ±1 = 0.55; ±2 = 0.25; selected highlight `rgba(232,131,26,0.10)` |

---

## 6. Screens

### 6.0 Splash Gate

**File:** `app/index.tsx`
**Status:** ✅ Built

Checks `ProfileContext.isLoading` + `profile`. Shows brand wordmark while AsyncStorage loads (~instant), then redirects:
- `profile === null` → `/onboarding`
- `profile !== null` → `/(tabs)`

---

### 6.1 Onboarding Flow (14 Screens)

**Files:** `app/onboarding/index.tsx` … `side-effects.tsx`
**Status:** ✅ Built

All 14 screens use `ProfileContext.updateDraft()` to accumulate data. The final screen (`side-effects.tsx`) calls `completeOnboarding()` which computes derived metrics, saves the full `FullUserProfile` to AsyncStorage, sets `profile` in context, then navigates to `/(tabs)`.

Each screen shares the same shell: white background, `SafeAreaView`, `<OnboardingHeader>` (step N / 14 + animated progress bar), title, subtitle, content, `<ContinueButton>` pinned to bottom.

| Step | File | Input Collected |
|---|---|---|
| 1 | `index.tsx` | `glp1Status` (active / starting) |
| 2 | `medication.tsx` | `medicationBrand`, `glp1Type` (auto-mapped) |
| 3 | `dose.tsx` | `doseMg` (preset or custom) |
| 4 | `schedule.tsx` | `injectionFrequencyDays`, `lastInjectionDate` |
| 5 | `sex.tsx` | `sex` |
| 6 | `birthday.tsx` | `birthday` (wheel picker — Month / Day / Year columns) |
| 7 | `body.tsx` | `unitSystem`, `heightFt/In/Cm`, `weightLbs/Kg` (imperial/metric toggle) |
| 8 | `health-sync.tsx` | `appleHealthEnabled` (skip-able) |
| 9 | `start.tsx` | `startWeightLbs`, `startDate` |
| 10 | `goal-weight.tsx` | `goalWeightLbs/Kg` (horizontal ruler picker) |
| 11 | `goal-speed.tsx` | `targetWeeklyLossLbs` (7 snap values; live forecast date) |
| 12 | `activity.tsx` | `activityLevel` |
| 13 | `cravings.tsx` | `cravingDays` (multi-select, skip-able) |
| 14 | `side-effects.tsx` | `sideEffects` → `completeOnboarding()` → `/(tabs)` |

**Onboarding → App Effects:**

| Input | Effect |
|---|---|
| `glp1Type = tirzepatide` | `proteinG *= 1.1` |
| `glp1Type = semaglutide` | `waterMl *= 1.1` |
| `doseMg >= 5` | `proteinG *= 1.1`, `waterMl *= 1.1` |
| `doseMg >= 7.5` | `proteinG *= 1.15`, `waterMl *= 1.15` |
| `activityLevel` | Steps target: sedentary 6k / light 8k / active 10k / very_active 12k |
| `sideEffects: constipation` | `fiberG = 35` (vs 30), `waterMl *= 1.1` |
| `weightLbs` | Protein baseline `* 0.8`, hydration baseline `* 0.6 oz` |
| `glp1Status = starting` | Protein goal ramps over first 3 weeks (week 1: ×0.75, week 3+: ×1.0) |

---

### 6.2 Home Screen

**File:** `app/(tabs)/index.tsx`
**Status:** ✅ Built — data-driven via `HealthContext` (personalized from `FullUserProfile`)

Vertically scrollable daily dashboard. Four sections:

1. **Header** — date + day label (Shot Day / Recovery Day / etc.)
2. **Score Card** — inline `DualRingArc` component: two concentric animated SVG arcs (Reanimated `withTiming`, 1200ms cubic ease-out). Outer ring = Recovery (0–100), inner ring = GLP-1 Amplifier (0–100). Tapping either ring navigates to `score-detail?type=recovery` or `score-detail?type=support`.
3. **Insights Card** — 1–3 contextual insight bullets driven by `generateInsights()` from `scoring.ts`
4. **Focus Cards** — action items (hardcoded; will be driven by data layer)

---

### 6.2.1 Score Detail Screen

**File:** `app/score-detail.tsx`
**Status:** ✅ Built — fully data-driven via `HealthContext`

Dedicated full-screen drill-down for each score type, pushed from home via `router.push('score-detail?type=recovery|support')`.

**Structure:**
- **Nav bar** — back chevron + title (Recovery / GLP-1 Amplifier) + today's date
- **Hero ring** — large `ScoreRing` (180px, strokeWidth 14) with gradient colors and phase label (Shot Day, Recovery Day N, Shot Overdue, etc.)
- **Score Breakdown** — per-metric `MetricCard` list:
  - Recovery type: Sleep (h m), HRV (ms), Resting HR (bpm), SpO₂ (%)
  - GLP-1 Amplifier type: Protein (g), Hydration (oz), Movement (steps), Fiber (g), Medication (logged ✓ / not logged)
  - Each card shows pts earned / pts max, a labeled progress bar, and a coaching note
- **Coach Note** — glass card with `RECOVERY_COACH_NOTE` or `GLP1_COACH_NOTE` from `scoring.ts`

**New exports added to `constants/scoring.ts`:**
- `recoveryBreakdown(wearable)` → `{ actual, max }[]` for 4 wearable rows
- `supportBreakdown(actuals, targets)` → `{ actual, max }[]` for 5 lifestyle rows
- `RECOVERY_ROW_NOTES` / `GLP1_ROW_NOTES` — per-row coaching copy arrays
- `RECOVERY_COACH_NOTE` / `GLP1_COACH_NOTE` — full-paragraph coaching text
- `daysSinceInjection` now accepts optional `refDate?: Date` for testability

---

### 6.3 Insights Screen

**File:** `app/(tabs)/log.tsx` *(rename to `insights.tsx` pending)*
**Status:** ✅ Built (static/hardcoded data) — all 3 tabs fully rendered

Three-tab segmented control (Medication | Lifestyle | Progress). Each tab has cards + collapsible Recent Logs. See previous SD version for full card inventory.

---

### 6.4 Education Screen

**File:** `app/(tabs)/explore.tsx` *(rename to `education.tsx` pending)*
**Status:** ⬜ Expo boilerplate — not yet designed

---

### 6.5 Add Entry Sheet

**File:** `components/add-entry-sheet.tsx`
**Status:** ✅ Built — LOG INJECTION + DESCRIBE FOOD wired to `HealthContext` dispatch

Bottom sheet modal triggered by FAB. 9-item grid. LOG INJECTION dispatches `LOG_INJECTION` action; DESCRIBE FOOD opens AI Chat modal.

---

## 7. Data Models

### FullUserProfile (implemented — persisted to AsyncStorage)

```typescript
// constants/user-profile.ts

export type FullUserProfile = {
  glp1Status: 'active' | 'starting';
  medicationBrand: MedicationBrand;   // zepbound | mounjaro | ozempic | wegovy | trulicity | compounded_* | other
  glp1Type: 'semaglutide' | 'tirzepatide' | 'dulaglutide';
  doseMg: number;
  injectionFrequencyDays: number;     // 1 | 7 | 14 | custom
  lastInjectionDate: string;          // YYYY-MM-DD
  sex: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  birthday: string;                   // YYYY-MM-DD
  age: number;                        // computed at completeOnboarding
  unitSystem: 'imperial' | 'metric';
  heightCm: number;
  heightFt: number;
  heightIn: number;
  weightLbs: number;
  weightKg: number;
  appleHealthEnabled: boolean;
  startWeightLbs: number;
  startDate: string;                  // YYYY-MM-DD
  goalWeightLbs: number;
  goalWeightKg: number;
  targetWeeklyLossLbs: number;        // 0.2 | 0.5 | 1.0 | 1.5 | 2.0 | 2.5 | 3.0
  activityLevel: 'sedentary' | 'light' | 'active' | 'very_active';
  cravingDays: string[];              // ['monday', 'wednesday', ...]
  sideEffects: SideEffect[];          // nausea | fatigue | hair_loss | constipation | bloating | sulfur_burps
  onboardingCompletedAt: string;      // ISO datetime
};
```

`MOCK_PROFILE` in `constants/mock-profile.ts` satisfies `FullUserProfile` and is used as a fallback in `(tabs)/_layout.tsx` when `profile === null`.

### Scoring Types (implemented)

```typescript
// constants/scoring.ts

type DailyTargets = { proteinG: number; waterMl: number; fiberG: number; steps: number };
type DailyActuals = { proteinG: number; waterMl: number; fiberG: number; steps: number; injectionLogged: boolean };
type WearableData  = { sleepMinutes: number; hrvMs: number; restingHR: number; spo2Pct: number };
```

### Scoring Formulas (implemented)

```typescript
// Protein: weight-based + medication/dose multipliers
let proteinG = profile.weightLbs * 0.8;
if (glp1Type === 'tirzepatide') proteinG *= 1.1;
if (doseMg >= 7.5) proteinG *= 1.15; else if (doseMg >= 5) proteinG *= 1.1;

// Hydration: oz → ml
let waterOz = profile.weightLbs * 0.6;
if (glp1Type === 'semaglutide') waterOz *= 1.1;
// same dose multipliers as protein
if (sideEffects.includes('constipation')) waterOz *= 1.1;
const waterMl = Math.round(waterOz * 29.5735);

// Fiber
let fiberG = sideEffects.includes('constipation') ? 35 : 30;
if (daysSinceShot <= 3) fiberG += 5;

// Steps: activity-level driven
const steps = { sedentary: 6000, light: 8000, active: 10000, very_active: 12000 }[activityLevel];
```

### LogEntry (implemented — mock data only)

```typescript
type LogEntry = {
  id: string; timestamp: string; title: string;
  details: string; impact: string;
  impactStatus: 'positive' | 'negative' | 'neutral';
  icon: React.ReactElement;
};
```

### Planned Schemas (not yet implemented)

- `InjectionLog` — date, doseMg, site rotation, notes
- `FoodEntry` — inputMethod, macros, serving
- `DailyLog` — water, steps, activityMinutes, weightKg, foodEntries, sideEffects
- `SideEffectEntry` — type, severity 1–5, notes
- `EffectivenessScore` — score 0–100, breakdown by protein/hydration/exercise/recovery

---

## 8. State Management

### Current State

| Layer | Mechanism | What It Holds |
|---|---|---|
| Profile | `ProfileContext` (AsyncStorage) | `FullUserProfile` persisted across sessions; `draft` accumulated during onboarding |
| Health / Scores | `HealthContext` (useReducer) | Daily actuals, targets, wearable data, recovery + support scores |
| Tab bar visibility | `TabBarVisibilityContext` | `Animated.Value` for scroll-driven show/hide |
| UI (local) | `useState` | Sheet open, active tab, chart width |

### ProfileContext API

```typescript
{
  profile: FullUserProfile | null;   // null = onboarding not complete
  draft: ProfileDraft;               // Partial<FullUserProfile> built during onboarding
  updateDraft(fields): void;         // merge fields into draft
  completeOnboarding(): Promise<void>; // derive metrics, save to AsyncStorage, set profile
  resetProfile(): Promise<void>;     // clear AsyncStorage + state (dev/testing)
  isLoading: boolean;                // true while AsyncStorage.getItem is pending
}
```

### HealthContext API

```typescript
{
  profile: FullUserProfile;
  wearable: WearableData;
  actuals: DailyActuals;
  targets: DailyTargets;
  recoveryScore: number;    // 0–100
  supportScore: number;     // 0–100
  lastLogAction: 'water' | 'protein' | 'injection' | null;
  dispatch: Dispatch<Action>;
}
// Actions: LOG_WATER | LOG_PROTEIN | LOG_INJECTION | LOG_STEPS | CLEAR_ACTION
```

### Planned State Architecture

**Recommendation: Zustand** for when real data logging is introduced.

```
stores/
├── userStore.ts         # Profile, preferences, auth state
├── logStore.ts          # Daily entries (food, injections, water, weight)
├── insightsStore.ts     # Computed metrics, score breakdown
└── uiStore.ts           # Sheet open state, active tab, loading states
```

---

## 9. Component Inventory

| Component | File | Status | Notes |
|---|---|---|---|
| `CustomTabBar` | `app/(tabs)/_layout.tsx` | ✅ Complete | Glass pill + FAB + scroll-aware hide/show |
| `TabBarVisibilityProvider` | `contexts/tab-bar-visibility.tsx` | ✅ Complete | Animated.spring scroll handler |
| `ProfileProvider` | `contexts/profile-context.tsx` | ✅ Complete | AsyncStorage persistence, onboarding draft |
| `HealthProvider` | `contexts/health-data.tsx` | ✅ Complete | Accepts `profile` prop, useReducer scoring |
| `OnboardingHeader` | `components/onboarding/onboarding-header.tsx` | ✅ Complete | Reanimated progress bar + back button |
| `OptionPill` | `components/onboarding/option-pill.tsx` | ✅ Complete | Single/multi-select pill |
| `ContinueButton` | `components/onboarding/continue-button.tsx` | ✅ Complete | Full-width dark CTA |
| `WheelPicker` | `components/onboarding/wheel-picker.tsx` | ✅ Complete | Snap-scroll FlatList, opacity gradients |
| Onboarding Screens 1–14 | `app/onboarding/*.tsx` | ✅ Complete | All 14 steps, back navigation, draft wiring |
| Splash Gate | `app/index.tsx` | ✅ Complete | AsyncStorage gate, brand splash |
| `ScoreRing` | `components/score-ring.tsx` | ✅ Complete | Animated SVG arc (Reanimated + react-native-svg) |
| `RingBreakdown` | `components/ring-breakdown.tsx` | ✅ Complete | Tap-to-expand breakdown sheet |
| Home Dashboard | `app/(tabs)/index.tsx` | ✅ Built | Data-driven via HealthContext |
| `AddEntrySheet` | `components/add-entry-sheet.tsx` | ✅ Built | LOG INJECTION + DESCRIBE FOOD wired |
| Insights Screen | `app/(tabs)/log.tsx` | ✅ Built | Static data, all 3 tabs |
| AI Chat | `app/ai-chat.tsx` | ✅ Built | Modal screen |
| `GlassBorder` | `components/ui/glass-border.tsx` | ✅ Extracted | Dark-mode border values; still inline-duplicated in entry screens |
| `ScoreRings` | inline in `index.tsx` | ⚠️ Inline | Extract to `components/score-rings.tsx` |
| `InsightsCard` | inline in `index.tsx` | ⚠️ Inline | Extract to `components/insights-card.tsx` |
| `FocusCard` | inline in `index.tsx` | ⚠️ Inline | Extract to `components/focus-card.tsx` |
| Education Screen | `app/(tabs)/explore.tsx` | ⬜ Boilerplate | Needs full build |
| `BodyDiagram` | Not built | ⬜ Planned | Injection site rotation map |
| `FoodLogForm` | Not built | ⬜ Planned | All input methods |
| `InjectionLogForm` | Not built | ⬜ Planned | From AddEntrySheet |

---

## 10. Feature Status

### Completed

- [x] App shell — root layout, routing, tab navigation
- [x] Custom glass pill tab bar with FAB
- [x] Scroll-aware tab bar (auto-hide on scroll down, restore on scroll up)
- [x] Home screen — personalized score rings + insights (data-driven via HealthContext)
- [x] Score rings — animated SVG arcs, micro-interactions, breakdown sheets
- [x] Add Entry Sheet — 9-item grid; LOG INJECTION + DESCRIBE FOOD wired
- [x] Insights screen — all 3 tabs (Medication, Lifestyle, Progress) with mock data
- [x] Collapsible Recent Logs card across all Insights tabs
- [x] **14-screen onboarding flow** — collects full metabolic profile
- [x] **ProfileProvider** — AsyncStorage persistence, draft accumulation, `completeOnboarding`
- [x] **Splash gate** — redirects new users to onboarding, returning users to tabs
- [x] **FullUserProfile data model** — replaces old minimal UserProfile
- [x] **Personalized scoring engine** — weight-based protein/hydration, activity-driven steps, dose/medication multipliers, side effect adjustments
- [x] **GestureHandlerRootView** at root — fixes gesture-in-gesture crashes
- [x] **Dark-first UI redesign** — unified dark palette (`#141210` bg, `#FF742A` orange accent, `#FFFFFF` text) across all 20+ files; BlurView tint `"dark"` throughout; orange circle active tab indicator; `constants/theme.ts` exports design tokens
- [x] **Score Detail Screen** — dedicated drill-down for Recovery + GLP-1 Amplifier scores; per-metric breakdown cards with progress bars + pts earned; phase-aware labels; coach note; navigated from home via `expo-router` push
- [x] **DualRingArc** on home screen — replaced separate `ScoreRing` + `RingBreakdown` pattern with inline concentric SVG arcs (Reanimated `withTiming`); ring taps navigate to score-detail
- [x] **Scoring engine expanded** — `recoveryBreakdown`, `supportBreakdown`, `RECOVERY_ROW_NOTES`, `GLP1_ROW_NOTES`, `RECOVERY_COACH_NOTE`, `GLP1_COACH_NOTE` exported from `scoring.ts`; `daysSinceInjection` accepts optional `refDate` for testability

### In Progress / Partially Done

- [ ] Home screen — wire focus cards to real profile data
- [ ] Insights screen — wire real data to all cards (currently all hardcoded)
- [ ] Tab bar — rename `log` → `insights`, `explore` → `education`
- [ ] Extract `GlassBorder` to shared component (currently duplicated in 3 files)

### Not Started

- [ ] Education screen — content structure and articles
- [ ] Food logging flow (describe, search, scan, photo, AI)
- [ ] Injection logging form + site rotation logic
- [ ] Weight logging (wire Add Entry sheet → store → Progress tab)
- [ ] Water / fiber / steps tracking (live, not seed data)
- [ ] Side effects logging
- [ ] Lifestyle Effectiveness Score computation engine
- [ ] Notification system (injection reminders, daily check-in, craving-day alerts)
- [ ] AI food description parsing
- [ ] Barcode scanning
- [ ] Photo-based food recognition
- [ ] Zustand store setup
- [ ] Apple Health integration (live HRV/sleep/steps — currently seed data)
- [ ] User account / cloud sync

---

## 11. Planned Integrations

| Integration | Purpose | Library / Service |
|---|---|---|
| Health data (steps, HRV, sleep) | Apple Health / Google Fit | `expo-health` (HealthKit) |
| Barcode scanning | Food product lookup | `expo-camera` + Open Food Facts |
| Food database | Nutritional info lookup | USDA FoodData Central or Nutritionix |
| AI food description | Parse text/photo into nutrients | OpenAI Vision API or custom model |
| Charts | Weight trend, macro charts | `victory-native` or `react-native-gifted-charts` |
| Push notifications | Injection reminders, craving-day alerts | `expo-notifications` |
| Local persistence | ✅ Implemented for profile | `@react-native-async-storage/async-storage` |
| Auth (future) | User accounts + cloud sync | Supabase Auth or Clerk |
| Backend (future) | Data sync across devices | Supabase (Postgres + REST) or Firebase |

---

## 12. Open Questions & Future Work

### Design / UX

- Should the Home screen show a different layout on injection day vs. recovery day?
- What does the first-launch experience look like after onboarding completes? (empty state vs. seeded goals)
- Should water intake use oz or mL — or follow the `unitSystem` from the profile?
- Should `RecentLogsCard` entries be paginated once real data is wired?
- Craving-day alerts: push notification or in-app banner?

### Technical

- Decide on charting library (`victory-native` vs. `react-native-gifted-charts`) before wiring real weight data.
- Extract `GlassBorder` into `components/ui/glass-border.tsx` — currently duplicated in 3 files.
- Extract inline components from `index.tsx` (`ScoreRings`, `InsightsCard`, `FocusCard`).
- Confirm Zustand vs. Context for log store before implementing food/injection logging.
- Apple Health stub in `health-sync.tsx` needs real HealthKit permission call (`expo-health`).
- `LayoutAnimation` on Android requires `UIManager.setLayoutAnimationEnabledExperimental(true)` in app entry point.
- `app/ai-chat.tsx` has a pre-existing TypeScript error (`maxHeight` on `TextInput`) — fix before next release.

### Product

- Does the app support dose titration tracking (changing dose over time)?
- Will there be a provider-facing dashboard, or is this purely consumer?
- Should side effects be shareable with a care team (HIPAA implications)?
- Monetization model: freemium, subscription, or healthcare B2B?
- Should `resetProfile()` be exposed in Settings for users who want to redo onboarding?

---

*This document reflects the state of the codebase as of March 6, 2026. It should be updated as features are built and decisions are made.*
