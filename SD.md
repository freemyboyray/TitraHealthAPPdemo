# GLP-1 Companion App — Software Design Document

**Project:** TitraHealthAPPdemo
**Platform:** iOS / Android (React Native + Expo)
**Last Updated:** March 7, 2026 (rev 4)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Navigation Structure](#4-navigation-structure)
5. [Design System](#5-design-system)
6. [Screens](#6-screens)
   - [Splash Gate](#60-splash-gate)
   - [Auth Flow](#601-auth-flow)
   - [Onboarding](#61-onboarding-flow-14-screens)
   - [Home](#62-home-screen)
   - [Score Detail](#621-score-detail-screen)
   - [Insights](#63-insights-screen)
   - [Education](#64-education-screen)
   - [AI Chat](#65-ai-chat-screen)
   - [Add Entry Sheet](#66-add-entry-sheet)
   - [Entry Screens](#67-entry-screens)
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
| Camera + Image Picker | expo-camera + expo-image-picker | `~17.0.x` |
| Web Browser | expo-web-browser | `~15.0.10` |
| App Constants | expo-constants | `~18.0.13` |
| Web Support | react-native-web | `~0.21.0` |
| SVG | react-native-svg | `15.12.1` |
| State Management | zustand | `^5.0.11` |
| Backend / Auth | @supabase/supabase-js | `^2.98.0` |
| Health Data (iOS) | @kingstinct/react-native-healthkit | `^13.2.3` |
| Local Persistence | @react-native-async-storage/async-storage | `2.2.0` |
| AI / LLM (primary) | OpenAI API (GPT-4o-mini) | REST via `lib/openai.ts` |
| AI / LLM (secondary) | Anthropic API (Claude Haiku) | REST via `lib/anthropic.ts` |
| Food Database | USDA FoodData Central | REST via `lib/usda.ts` |
| Language | TypeScript | `~5.9.2` |
| Linting | ESLint + eslint-config-expo | `^9.25.0` |
| Metro Config | Custom `metro.config.js` | — |

### Icon Packs in Use

- `Ionicons` — navigation, camera, barcode, search, warnings, water, body
- `MaterialIcons` — food, activity, AI, chart/fitness
- `FontAwesome5` — syringe
- `MaterialCommunityIcons` — scale/weight

### Environment Variables

All secret keys live in `.env` (gitignored). Each developer adds their own:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_OPENAI_API_KEY=
EXPO_PUBLIC_ANTHROPIC_API_KEY=
```

---

## 3. Architecture Overview

```
TitraHealthAPPdemo/
├── app/
│   ├── _layout.tsx              # Root Stack + GestureHandlerRootView + ProfileProvider
│   │                            # + AppWithHealth (HealthProvider at root) + Supabase auth
│   ├── index.tsx                # Splash gate — auth+session check → auth/onboarding/(tabs)
│   ├── modal.tsx                # Generic modal screen
│   ├── ai-chat.tsx              # AI Chat modal (GPT-4o-mini, full health context)
│   ├── score-detail.tsx         # Score drill-down modal (Recovery / GLP-1 Amplifier)
│   ├── auth/
│   │   ├── _layout.tsx          # Stack navigator for auth screens
│   │   ├── sign-in.tsx          # Email/password sign-in + OAuth
│   │   └── sign-up.tsx          # Email/password registration
│   ├── entry/
│   │   ├── _layout.tsx          # Stack navigator for entry flows
│   │   ├── log-injection.tsx    # Log a GLP-1 injection (dose, site, notes)
│   │   ├── describe-food.tsx    # AI natural language food description entry
│   │   ├── capture-food.tsx     # Photo food recognition (GPT-4o-mini vision)
│   │   ├── scan-food.tsx        # Barcode scanner (expo-camera)
│   │   ├── search-food.tsx      # USDA FoodData Central text search
│   │   ├── ask-ai.tsx           # Standalone AI query entry screen
│   │   ├── log-activity.tsx     # Log activity / steps
│   │   ├── log-weight.tsx       # Log weight entry
│   │   └── side-effects.tsx     # Log side effects entry
│   ├── onboarding/
│   │   ├── _layout.tsx          # Stack navigator (slide_from_right, no header)
│   │   ├── index.tsx            # Step 1: GLP-1 journey stage
│   │   ├── medication.tsx       # Step 2: Medication brand
│   │   ├── dose.tsx             # Step 3: Current dose
│   │   ├── schedule.tsx         # Step 4: Injection frequency + last shot date
│   │   ├── sex.tsx              # Step 5: Biological sex
│   │   ├── birthday.tsx         # Step 6: Birthday (wheel picker)
│   │   ├── body.tsx             # Step 7: Height + Weight (wheels, unit toggle)
│   │   ├── health-sync.tsx      # Step 8: Apple Health (optional, Expo Go guarded)
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
│       ├── collapsible.tsx        # Expand/collapse section
│       ├── glass-border.tsx       # Shared dark-glass border primitive (4-sided rgba values)
│       ├── icon-symbol.tsx        # Cross-platform icon bridge
│       └── icon-symbol.ios.tsx    # iOS SF Symbols version
├── contexts/
│   ├── profile-context.tsx      # ProfileProvider — in-memory load/save, draft, completeOnboarding
│   ├── health-data.tsx          # HealthProvider(profile) — useReducer scores + dispatch
│   └── tab-bar-visibility.tsx   # Scroll-aware tab bar hide/show (Animated.spring)
├── constants/
│   ├── user-profile.ts          # FullUserProfile type, ProfileDraft, BRAND_TO_GLP1_TYPE, helpers
│   ├── mock-profile.ts          # MOCK_PROFILE (FullUserProfile shape, fallback when no onboarding)
│   ├── scoring.ts               # getDailyTargets, computeRecovery, computeGlp1Support, insights,
│   │                            # breakdown data, coach notes, phase logic, focus cards
│   └── theme.ts                 # Color tokens + Font definitions
├── lib/
│   ├── supabase.ts              # Supabase client (MemoryStorageAdapter — no native AsyncStorage dep)
│   ├── openai.ts                # GPT-4o-mini: buildSystemPrompt, callOpenAI, parseFoodDescription,
│   │                            # generateDynamicInsights, generateCoachNote, generateLogInsight,
│   │                            # callGPT4oMiniVision (vision/photo flow)
│   ├── anthropic.ts             # Claude Haiku client: callHaiku(system, userContent[])
│   ├── usda.ts                  # USDA FoodData Central REST client: searchFoods, getFoodDetails
│   ├── context-snapshot.ts      # buildContextSnapshot() — natural language health summary for AI
│   └── database.types.ts        # Auto-generated Supabase TypeScript types
├── stores/                      # Zustand stores (all implemented)
│   ├── log-store.ts             # All log types + Supabase CRUD + fetchInsightsData
│   ├── insights-store.ts        # Score computation from real Supabase data
│   ├── user-store.ts            # Auth state, session, profile row, signOut
│   └── ui-store.ts              # Sheet open state, active tab, loading states
├── hooks/
│   ├── use-color-scheme.ts
│   ├── use-color-scheme.web.ts
│   └── use-theme-color.ts
├── metro.config.js              # Expo default + react-native-svg CommonJS redirect
│                                # + .claude worktree blockList
└── assets/
    └── images/
```

### Key Architectural Decisions

- **File-based routing via Expo Router** — screens map directly to files under `app/`.
- **Supabase auth at root** — `_layout.tsx` wires `onAuthStateChange` and `getSession` into `useUserStore`. Anonymous sign-in is used as a fallback so every user always has a Supabase session.
- **Auth gate in splash** — `app/index.tsx` checks `sessionLoaded` → if no session, redirects to `/auth/sign-in`; then checks `isLoading` + `profile` to route to `/onboarding` or `/(tabs)`.
- **ProfileProvider at root with in-memory storage** — wraps everything in `_layout.tsx`. Profile is stored in a JS `Map` (not AsyncStorage) to avoid native module issues in dev client. Resets on cold restart; persistent storage should be added in production via a proper native rebuild.
- **AppWithHealth at root** — `_layout.tsx` renders `<AppWithHealth>` (reads `useProfile()`, passes `profile ?? MOCK_PROFILE` to `HealthProvider`) around the full navigator tree. This replaces the previous pattern of `HealthProvider` living inside `(tabs)/_layout.tsx`.
- **GestureHandlerRootView at root** — wraps entire app in `_layout.tsx` so gesture-based components work everywhere.
- **AddEntrySheet rendered at tab layout level** — sibling of `<Tabs>`, overlays entire UI including nav bar.
- **Scroll-aware tab bar** — `TabBarVisibilityProvider` exposes `onScroll` handler, `Animated.spring` slide.
- **Zustand stores over Context for logs** — `log-store.ts`, `insights-store.ts`, and `user-store.ts` use Zustand with Supabase as the backend. These replace the "planned" state from rev 3.
- **Metro config** — `metro.config.js` redirects `react-native-svg` imports to its pre-compiled `lib/commonjs/` output (avoids TypeScript source resolution failures with Metro), and blocks `.claude/` worktree directories from being scanned.

---

## 4. Navigation Structure

```
Root Stack (GestureHandlerRootView > ProfileProvider > AppWithHealth > ThemeProvider)
├── index                         ← Splash gate (session check → auth or onboarding or tabs)
├── auth/                         ← Auth Stack (sign-in, sign-up)
│   ├── sign-in
│   └── sign-up
├── onboarding/                   ← 14-screen Stack (slide_from_right)
│   ├── index    (Step 1)
│   ├── medication … side-effects (Steps 2–14)
├── entry/                        ← Entry flow Stack (modal-style screens)
│   ├── log-injection
│   ├── describe-food
│   ├── capture-food
│   ├── scan-food
│   ├── search-food
│   ├── ask-ai
│   ├── log-activity
│   ├── log-weight
│   └── side-effects
├── score-detail                  ← Modal (Recovery / GLP-1 Amplifier drill-down)
├── ai-chat                       ← Modal (GPT-4o-mini chat)
└── (tabs)                        ← No header
    ├── index       [Home]
    ├── log         [Insights]
    └── explore     [Education]

Overlays (rendered outside tab navigator):
└── AddEntrySheet                 ← Modal, slide animation, transparent
```

### Custom Tab Bar

The default React Navigation tab bar is replaced with `CustomTabBar`:

1. **Glass Pill** — frosted glass capsule (`BlurView` intensity 85, dark tint) with three tab icon buttons. Active tab renders a 46×46 orange circle (`#FF742A`) behind a white icon. Inactive icons use `#5A5754`.
2. **FAB** — solid orange (`#FF742A`) circular button. Toggles `add` ↔ `close`. Opens/closes `AddEntrySheet`.

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

Three-stage redirect gate on mount:

1. Wait for `sessionLoaded` (Supabase auth resolved). If no session → `/auth/sign-in`.
2. Wait for `isLoading` (profile context resolved).
3. `profile === null` → `/onboarding`; `profile !== null` → `/(tabs)`.

Shows brand wordmark (`titra`, dark background) with an orange `ActivityIndicator` while resolving.

---

### 6.0.1 Auth Flow

**Files:** `app/auth/_layout.tsx`, `app/auth/sign-in.tsx`, `app/auth/sign-up.tsx`
**Status:** ✅ Built

- **sign-in.tsx** — email/password login via `supabase.auth.signInWithPassword`. OAuth placeholder. Navigates to `/(tabs)` on success.
- **sign-up.tsx** — email/password registration via `supabase.auth.signUp`. Navigates to `/onboarding` on success.
- Auth state is managed in `useUserStore` (session, profile row, signOut).
- The root `_layout.tsx` calls `supabase.auth.onAuthStateChange` to keep `useUserStore` in sync across the session lifecycle.

---

### 6.1 Onboarding Flow (14 Screens)

**Files:** `app/onboarding/index.tsx` … `side-effects.tsx`
**Status:** ✅ Built

All 14 screens use `ProfileContext.updateDraft()` to accumulate data. The final screen (`side-effects.tsx`) calls `completeOnboarding()` which computes derived metrics, saves the full `FullUserProfile` (in-memory), sets `profile` in context, then navigates to `/(tabs)`.

| Step | File | Input Collected |
|---|---|---|
| 1 | `index.tsx` | `glp1Status` (active / starting) |
| 2 | `medication.tsx` | `medicationBrand`, `glp1Type` (auto-mapped) |
| 3 | `dose.tsx` | `doseMg` (preset or custom) |
| 4 | `schedule.tsx` | `injectionFrequencyDays`, `lastInjectionDate` |
| 5 | `sex.tsx` | `sex` |
| 6 | `birthday.tsx` | `birthday` (wheel picker — Month / Day / Year columns) |
| 7 | `body.tsx` | `unitSystem`, `heightFt/In/Cm`, `weightLbs/Kg` (imperial/metric toggle) |
| 8 | `health-sync.tsx` | `appleHealthEnabled` (skip-able) — HealthKit native call guarded behind `Constants.appOwnership !== 'expo'` to prevent NitroModules crash in Expo Go |
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

1. **Header** — date + day label (Shot Day / Recovery Day / etc.) + `?` help icon (top-right)
2. **Score Card** — inline `DualRingArc` component: two concentric animated SVG arcs (Reanimated `withTiming`, 1200ms cubic ease-out) rendered as **quarter-circle (90°) arcs**. Outer ring = Recovery (0–100), inner ring = GLP-1 Amplifier (0–100). Tapping either ring navigates to `score-detail?type=recovery` or `score-detail?type=support`.
3. **Insights Card** — 1–3 contextual insight bullets. On mount, calls `generateDynamicInsights()` (GPT-4o-mini, cached per day) with a 5-second delayed trigger and shows skeleton loading rows while waiting. Falls back silently to the static `generateInsights()` from `scoring.ts` on error.
4. **Focus Cards** — data-driven from `HealthContext.focuses` (`FocusItem[]`). Each card shows an icon, label, subtitle, and a badge. Generated by `generateFocuses()` in `scoring.ts` using phase-weighted deficit scoring.

**Rings Explainer Modal** — tapping `?` opens a slide-up sheet explaining both rings, all 9 scored metrics, and the 4-phase shot cycle guide.

---

### 6.2.1 Score Detail Screen

**File:** `app/score-detail.tsx`
**Status:** ✅ Built — fully data-driven via `HealthContext`

Dedicated full-screen drill-down for each score type, pushed from home via `router.push('score-detail?type=recovery|support')`.

**Structure:**
- **Nav bar** — back chevron + title (Recovery / GLP-1 Amplifier) + today's date
- **Hero ring** — large `ScoreRing` (180px, strokeWidth 14) with gradient colors and phase label
- **Score Breakdown** — per-metric `MetricCard` list with pts earned / pts max, a progress bar (color tier-based: green ≥80%, amber ≥50%, red <50%), and a coaching note
- **Phase Interpretation Banner** — orange contextual banner below hero ring; text adapts to phase + score type
- **Coach Note** — on mount calls `generateCoachNote(type, health)` (GPT-4o-mini, cached per day per type). Shows skeleton loading state; falls back to static constants from `scoring.ts` on error.

---

### 6.3 Insights Screen

**File:** `app/(tabs)/log.tsx` *(rename to `insights.tsx` pending)*
**Status:** ✅ Built — all 3 tabs rendered; AI Insight cards are dynamic

Three-tab segmented control (Medication | Lifestyle | Progress). Each tab has cards + collapsible Recent Logs.

**AI Insight Cards (dynamic):** Each tab's "AI INSIGHTS" card calls `generateLogInsight(tab, health)` on mount (GPT-4o-mini, cached per day per tab). Shows `ActivityIndicator` + skeleton bars while loading; falls back to a hardcoded static string on error.

---

### 6.4 Education Screen

**File:** `app/(tabs)/explore.tsx` *(rename to `education.tsx` pending)*
**Status:** ⬜ Expo boilerplate — not yet designed

---

### 6.5 AI Chat Screen

**File:** `app/ai-chat.tsx`
**Status:** ✅ Built — fully wired to GPT-4o-mini via `lib/openai.ts`

Modal screen. Accepts optional `?type=recovery|support` route param (navigated from Score Detail).

**Features:**
- **Context strip** — orange badge at top showing score + phase when launched from a score detail screen
- **Type-aware prompt chips** — `RECOVERY_CHIPS`, `READINESS_CHIPS`, or `GENERIC_CHIPS` based on `type` param
- **Chat interface** — full message history with user (orange) / assistant (dark) bubbles, loading state, auto-scroll
- **`sendMessage()`** — calls `callOpenAI(messages, systemPrompt)` with `buildSystemPrompt(health, type?)`. Error shows user-facing fallback.

---

### 6.6 Add Entry Sheet

**File:** `components/add-entry-sheet.tsx`
**Status:** ✅ Built — LOG INJECTION + DESCRIBE FOOD + LOG WEIGHT / WATER / ACTIVITY wired

Bottom sheet modal triggered by FAB. 9-item grid. Each item navigates to its dedicated entry screen (via `router.push`) or opens an inline form.

- **LOG INJECTION** — navigates to `app/entry/log-injection.tsx`
- **DESCRIBE FOOD** — AI-powered natural language parser:
  1. User types description (e.g. "2 scrambled eggs with avocado toast")
  2. "Parse with AI" calls `parseFoodDescription(description, profile)` (GPT-4o-mini `json_object` mode)
  3. Confirmation card shows name, serving, cal/protein/carbs/fat/fiber, confidence badge
  4. "Confirm" logs via `addFoodLog()` and dispatches `LOG_PROTEIN` to HealthContext
  5. Error falls back to manual form; "Edit manually instead" resets from confirmation
- **SCAN FOOD** — navigates to `app/entry/scan-food.tsx`
- **SEARCH FOOD** — navigates to `app/entry/search-food.tsx`
- **PHOTO** — navigates to `app/entry/capture-food.tsx`
- **LOG WEIGHT / WATER / ACTIVITY** — inline forms wired to log store + HealthContext dispatch

---

### 6.7 Entry Screens

**Directory:** `app/entry/`
**Status:** ✅ Built (all screens)

| Screen | File | Description |
|---|---|---|
| Log Injection | `log-injection.tsx` | Dose (pre-filled from profile), injection date, site rotation, notes. Saves via `useLogStore.addInjectionLog()` |
| Describe Food | `describe-food.tsx` | Natural language food entry. Calls `parseFoodDescription()` → confirmation card → `addFoodLog()` |
| Capture Food | `capture-food.tsx` | Camera view (`expo-camera`) or gallery pick (`expo-image-picker`). Base64 image → `callGPT4oMiniVision()` for food identification → parsed macros → `addFoodLog()` |
| Scan Food | `scan-food.tsx` | Barcode scanner (`expo-camera` `CameraView`). Barcode → USDA lookup via `lib/usda.ts` → food result → `addFoodLog()` |
| Search Food | `search-food.tsx` | Text search via `lib/usda.ts`. Shows results list → select → `addFoodLog()` |
| Ask AI | `ask-ai.tsx` | Freeform AI query (opens AI chat modal with context) |
| Log Activity | `log-activity.tsx` | Activity type, duration, steps. Saves via `useLogStore.addActivityLog()` |
| Log Weight | `log-weight.tsx` | Current weight (lbs/kg with unit toggle). Saves via `useLogStore.addWeightLog()` |
| Side Effects | `side-effects.tsx` | Side effect type + severity slider. Saves via `useLogStore.addSideEffectLog()` |

---

## 7. Data Models

### FullUserProfile (implemented — in-memory via ProfileContext)

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

### Supabase Database Tables (implemented — via `lib/database.types.ts`)

| Table | Key Columns | Used By |
|---|---|---|
| `profiles` | `id`, `full_name`, `medication_type`, `injection_frequency_days`, `start_weight_lbs`, `goal_weight_lbs`, `program_start_date` | `user-store.ts`, `log-store.ts`, `insights-store.ts` |
| `user_goals` | `daily_calories_target`, `daily_protein_g_target`, `daily_fiber_g_target`, `daily_steps_target` | `log-store.ts`, `insights-store.ts` |
| `injection_logs` | `dose_mg`, `injection_date`, `injection_time`, `site`, `notes` | `log-store.ts` |
| `food_logs` | `name`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `serving_size`, `meal_type`, `source`, `logged_at` | `log-store.ts` |
| `weight_logs` | `weight_lbs`, `weight_kg`, `logged_at`, `notes` | `log-store.ts` |
| `activity_logs` | `activity_type`, `duration_min`, `steps`, `calories_burned`, `source`, `date` | `log-store.ts` |
| `side_effect_logs` | `effect_type`, `severity`, `phase_at_log`, `notes`, `logged_at` | `log-store.ts` |

### Scoring Types (implemented)

```typescript
// constants/scoring.ts

type DailyTargets = { proteinG: number; waterMl: number; fiberG: number; steps: number };
type DailyActuals = { proteinG: number; waterMl: number; fiberG: number; steps: number; injectionLogged: boolean };
type WearableData  = { sleepMinutes: number; hrvMs: number; restingHR: number; spo2Pct: number; respRateRpm?: number };
type ShotPhase     = 'shot' | 'peak' | 'balance' | 'reset';
type FocusItem     = { id: string; label: string; subtitle: string; badge: string; iconName: string; iconSet: 'Ionicons' | 'MaterialIcons' };
```

### Insights Store Types (implemented — `stores/insights-store.ts`)

```typescript
type ScoreBreakdown = {
  total: number;       // weighted composite 0–100
  medication: number;  // 30% weight
  nutrition: number;   // 30% weight
  activity: number;    // 25% weight
  sideEffect: number;  // 15% weight (inverse — high side effects lower score)
};

type InjectionPhase = 'Shot Day' | 'Peak Phase' | 'Mid Phase' | 'Waning Phase' | 'Due Soon' | 'Overdue' | 'Unknown';
type FocusItem = { iconLib: 'ionicons' | 'material'; icon: string; label: string; badge: string };
```

---

## 8. State Management

### Current State

| Layer | Mechanism | What It Holds |
|---|---|---|
| Profile | `ProfileContext` (in-memory Map) | `FullUserProfile`; `draft` accumulated during onboarding |
| Auth | `useUserStore` (Zustand + Supabase) | Session, sessionLoaded flag, profile row, signOut |
| Logs | `useLogStore` (Zustand + Supabase) | All daily log entries; CRUD actions; `fetchInsightsData` |
| Insights | `insightsStore` (Zustand) | Computed `ScoreBreakdown`, injection phase, focuses from real data |
| Health / Scores | `HealthContext` (useReducer) | Daily actuals, targets, wearable data, recovery + support scores |
| Tab bar visibility | `TabBarVisibilityContext` | `Animated.Value` for scroll-driven show/hide |
| UI (local) | `useState` | Sheet open, active tab, chart width |

### ProfileContext API

```typescript
{
  profile: FullUserProfile | null;   // null = onboarding not complete
  draft: ProfileDraft;               // Partial<FullUserProfile> built during onboarding
  updateDraft(fields): void;         // merge fields into draft
  completeOnboarding(): Promise<void>; // derive metrics, save in-memory, set profile
  resetProfile(): Promise<void>;     // clear in-memory store + state
  isLoading: boolean;                // always resolves quickly (no async native call)
}
```

### HealthContext API

```typescript
{
  profile: FullUserProfile;
  wearable: WearableData;
  actuals: DailyActuals;
  targets: DailyTargets;
  recoveryScore: number;    // 0–100; phase-adjusted via glp1HrvOffset / glp1RhrOffset
  supportScore: number;     // 0–100
  focuses: FocusItem[];     // top-3 phase-weighted focus cards from generateFocuses()
  lastLogAction: 'water' | 'protein' | 'injection' | null;
  dispatch: Dispatch<Action>;
}
// Actions: LOG_WATER | LOG_PROTEIN | LOG_INJECTION | LOG_STEPS | CLEAR_ACTION
```

### useUserStore API (Zustand)

```typescript
{
  session: Session | null;
  sessionLoaded: boolean;
  profile: ProfileRow | null;        // Supabase profiles table row
  setSession(s): void;
  setSessionLoaded(v): void;
  loadProfile(): Promise<void>;      // fetches/upserts profiles row from Supabase
  signOut(): Promise<void>;
}
```

### useLogStore API (Zustand)

```typescript
{
  loading: boolean;
  error: string | null;
  weightLogs: WeightLog[];
  injectionLogs: InjectionLog[];
  foodLogs: FoodLog[];
  activityLogs: ActivityLog[];
  sideEffectLogs: SideEffectLog[];
  userGoals: UserGoalsRow | null;
  fetchInsightsData(): Promise<void>; // fetches all logs + goals from Supabase for current user
  addWeightLog(entry): Promise<void>;
  addInjectionLog(entry): Promise<void>;
  addFoodLog(entry): Promise<void>;
  addActivityLog(entry): Promise<void>;
  addSideEffectLog(entry): Promise<void>;
}
```

---

## 9. Component Inventory

| Component | File | Status | Notes |
|---|---|---|---|
| `CustomTabBar` | `app/(tabs)/_layout.tsx` | ✅ Complete | Glass pill + solid orange FAB + scroll-aware hide/show |
| `TabBarVisibilityProvider` | `contexts/tab-bar-visibility.tsx` | ✅ Complete | Animated.spring scroll handler |
| `ProfileProvider` | `contexts/profile-context.tsx` | ✅ Complete | In-memory persistence, onboarding draft |
| `HealthProvider` | `contexts/health-data.tsx` | ✅ Complete | Accepts `profile` prop, useReducer scoring |
| `AppWithHealth` | inline in `app/_layout.tsx` | ✅ Complete | Bridges ProfileContext → HealthProvider at root |
| `OnboardingHeader` | `components/onboarding/onboarding-header.tsx` | ✅ Complete | Reanimated progress bar + back button |
| `OptionPill` | `components/onboarding/option-pill.tsx` | ✅ Complete | Single/multi-select pill |
| `ContinueButton` | `components/onboarding/continue-button.tsx` | ✅ Complete | Full-width dark CTA |
| `WheelPicker` | `components/onboarding/wheel-picker.tsx` | ✅ Complete | Snap-scroll FlatList, opacity gradients |
| Onboarding Screens 1–14 | `app/onboarding/*.tsx` | ✅ Complete | All 14 steps, back navigation, draft wiring |
| Auth Screens | `app/auth/sign-in.tsx`, `sign-up.tsx` | ✅ Complete | Supabase Auth email/password |
| Entry Screens (9) | `app/entry/*.tsx` | ✅ Complete | All entry flows built |
| Splash Gate | `app/index.tsx` | ✅ Complete | Session + profile gate, brand splash |
| `ScoreRing` | `components/score-ring.tsx` | ✅ Complete | Animated SVG arc; message text conditionally rendered |
| `RingBreakdown` | `components/ring-breakdown.tsx` | ✅ Complete | Tap-to-expand breakdown sheet |
| `GlassBorder` | `components/ui/glass-border.tsx` | ✅ Complete | Reusable dark-glass border primitive |
| Home Dashboard | `app/(tabs)/index.tsx` | ✅ Built | Data-driven; quarter-arc rings; AI insights; help button |
| `RingsExplainerModal` | inline in `app/(tabs)/index.tsx` | ✅ Built | "How Your Rings Work" slide-up modal |
| `AddEntrySheet` | `components/add-entry-sheet.tsx` | ✅ Built | All 9 items; each navigates to dedicated entry screen; DESCRIBE FOOD AI parser inline; activity inline form removed |
| Insights Screen | `app/(tabs)/log.tsx` | ✅ Built | All 3 tabs; dynamic AI insight cards |
| AI Chat | `app/ai-chat.tsx` | ✅ Built | GPT-4o-mini; full health context; type-aware chips |
| Score Detail | `app/score-detail.tsx` | ✅ Built | Per-metric breakdown; AI coach note; phase banner |
| `PhaseInterpretationBanner` | inline in `app/score-detail.tsx` | ✅ Built | Phase-aware orange banner |
| `DualRingArc` | inline in `app/(tabs)/index.tsx` | ⚠️ Inline | Extract to `components/dual-ring-arc.tsx` |
| `InsightsCard` | inline in `app/(tabs)/index.tsx` | ⚠️ Inline | Extract to `components/insights-card.tsx` |
| `FocusCard` | inline in `app/(tabs)/index.tsx` | ⚠️ Inline | Extract to `components/focus-card.tsx` |
| Education Screen | `app/(tabs)/explore.tsx` | ⬜ Boilerplate | Needs full build |
| `BodyDiagram` | Not built | ⬜ Planned | Injection site rotation map |

---

## 10. Feature Status

### Completed

- [x] App shell — root layout, routing, tab navigation
- [x] Custom glass pill tab bar with solid orange FAB
- [x] Scroll-aware tab bar (auto-hide on scroll down, restore on scroll up)
- [x] Home screen — personalized score rings + insights (data-driven via HealthContext)
- [x] Score rings — animated SVG arcs, micro-interactions, breakdown sheets
- [x] **DualRingArc** — concentric quarter-circle arcs (Reanimated); taps navigate to score-detail
- [x] **Score Detail Screen** — per-metric breakdown cards; tier badges (Optimal/Fair/Low); phase banner; AI coach note
- [x] Add Entry Sheet — 9-item grid; all items navigating to dedicated entry screens
- [x] **DESCRIBE FOOD AI parser** — natural language → GPT-4o-mini → macros confirmation card → manual fallback
- [x] **CAPTURE FOOD** — camera/gallery → GPT-4o-mini vision → food identification → log
- [x] **SCAN FOOD** — barcode scanner → USDA lookup → log
- [x] **SEARCH FOOD** — USDA FoodData Central text search → log
- [x] **LOG INJECTION** — dedicated entry screen with dose, date, site, notes
- [x] **LOG ACTIVITY** — dark-glass screen with SVG semi-circle arc gauges (PanResponder drag) for Intensity (1–10) and Duration (0–120 min); summary cards (Est. Calories, Duration); workout type picker sheet; dispatches `LOG_STEPS`; arc gauge replaces old inline text form
- [x] **LOG WEIGHT** — weight entry with unit toggle
- [x] **SIDE EFFECTS LOGGING** — entry screen with type + severity
- [x] Insights screen — all 3 tabs (Medication, Lifestyle, Progress) with mock data + AI cards
- [x] **14-screen onboarding flow** — collects full metabolic profile
- [x] **ProfileProvider** — in-memory persistence, draft accumulation, `completeOnboarding`
- [x] **Splash gate** — session + profile check; routes to auth / onboarding / tabs
- [x] **Auth flow** — sign-in / sign-up screens wired to Supabase Auth
- [x] **Supabase integration** — `lib/supabase.ts` (MemoryStorageAdapter); `useUserStore` (session); `useLogStore` (all CRUD); `lib/database.types.ts`
- [x] **Zustand stores** — `log-store`, `insights-store`, `user-store` all implemented
- [x] **FullUserProfile data model** — replaces old minimal UserProfile
- [x] **Personalized scoring engine** — weight-based protein/hydration, activity-driven steps, dose/medication multipliers, side effect adjustments
- [x] **Dark-first UI redesign** — unified dark palette (`#141210` bg, `#FF742A` orange, `#FFFFFF` text)
- [x] **Scoring engine expanded** — `ShotPhase`; `getShotPhase()`; medication-phase biometric offsets; `scoreRespRate()`; phase-aware row notes; `FocusItem`; `generateFocuses()`
- [x] **Data-driven Focus Cards** — phase-weighted scoring ranks top-3 gaps
- [x] **Rings Explainer Modal** — help button → "How Your Rings Work" slide-up
- [x] **Phase Interpretation Banner** — score detail contextual orange banner
- [x] **Tier-based metric cards** — color + badge driven by percent-achieved (≥80% green / ≥50% amber / <50% red)
- [x] **GPT-4o-mini full integration** — `buildSystemPrompt`, `callOpenAI`, `parseFoodDescription`, `generateDynamicInsights`, `generateCoachNote`, `generateLogInsight`, `callGPT4oMiniVision` — all in `lib/openai.ts`
- [x] **Dynamic home insights** — AI bullets with skeleton loading; static fallback
- [x] **Dynamic score detail coach note** — AI note with skeleton; static fallback
- [x] **Dynamic Insights screen AI cards** — all 3 tabs; spinner + skeleton; static fallback
- [x] **AI Chat fully wired** — GPT-4o-mini responses with personalized health context; error fallback
- [x] **Anthropic client** — `lib/anthropic.ts` (`callHaiku`) for secondary AI calls
- [x] **USDA food database** — `lib/usda.ts` for barcode + text search food lookup
- [x] **Context snapshot builder** — `lib/context-snapshot.ts` (`buildContextSnapshot`) builds natural language health summary for AI prompt injection
- [x] **Onboarding health-sync Expo Go fix** — `Constants.appOwnership` guard prevents NitroModules crash
- [x] **`@kingstinct/react-native-healthkit`** installed + configured in `app.json` (HealthKit entitlement + usage strings)
- [x] **metro.config.js** — react-native-svg CommonJS redirect + `.claude` blockList

### In Progress / Partially Done

- [ ] Insights screen — wire real data to all cards (currently mock/hardcoded)
- [ ] Home screen — focus cards currently use HealthContext seed data; wire to live log store
- [ ] Tab bar — rename `log` → `insights`, `explore` → `education`

### Not Started

- [ ] Education screen — content structure and articles
- [ ] Apple Health live reads — wire `@kingstinct/react-native-healthkit` HRV/sleep/steps once permission granted (currently seed data in HealthContext)
- [ ] Weight logging wired to Progress tab charts
- [ ] Water / fiber / steps tracking (live, not seed data)
- [ ] Barcode scanning result display refinement
- [ ] Notification system (injection reminders, daily check-in, craving-day alerts)
- [ ] Photo-based food recognition full pipeline polish
- [ ] Supabase profile persistence (currently in-memory — needs native rebuild or SecureStore)
- [ ] User account screen (settings, reset profile, sign out)

---

## 11. Planned Integrations

| Integration | Purpose | Library / Service | Status |
|---|---|---|---|
| Health data (steps, HRV, sleep) | Apple Health live reads | `@kingstinct/react-native-healthkit` | ⚠️ Installed, not wired |
| Barcode scanning | Food product lookup | `expo-camera` + USDA FoodData Central | ✅ Built |
| Food database | Nutritional info lookup | USDA FoodData Central (`lib/usda.ts`) | ✅ Built |
| AI food description | Text parsing via GPT-4o-mini | `lib/openai.ts` — `parseFoodDescription` | ✅ Built |
| AI food photo | Photo analysis via GPT-4o-mini vision | `lib/openai.ts` — `callGPT4oMiniVision` | ✅ Built |
| AI coaching | Dynamic insights, coach notes, log insights | `lib/openai.ts` | ✅ Built |
| Secondary AI | Claude Haiku via Anthropic | `lib/anthropic.ts` | ✅ Built (not yet called from UI) |
| Charts | Weight trend, macro charts | `victory-native` or `react-native-gifted-charts` | ⬜ Not started |
| Push notifications | Injection reminders, craving-day alerts | `expo-notifications` | ⬜ Not started |
| Auth | User accounts | Supabase Auth | ✅ Built |
| Backend | Data sync across devices | Supabase (Postgres + REST) | ✅ Built |

---

## 12. Open Questions & Future Work

### Design / UX

- Should the Home screen show a different layout on injection day vs. recovery day?
- Should water intake use oz or mL — or follow the `unitSystem` from the profile?
- Should `RecentLogsCard` entries be paginated once real data is wired?
- Craving-day alerts: push notification or in-app banner?
- Should there be an in-app Settings screen (unit toggle, reset profile, sign-out)?

### Technical

- **Profile persistence** — `ProfileContext` currently uses in-memory `Map`. Production builds should persist to `expo-secure-store` or Supabase `profiles` table (requires a native rebuild with proper module linking).
- **AsyncStorage** — `@react-native-async-storage/async-storage` is listed in `package.json` but its native module is not available in the current dev client build. A full `expo run:ios` rebuild will restore native module availability and enable persistent storage options.
- **react-native-svg codegen** — `metro.config.js` redirects to `lib/commonjs/` which bypasses Turbo Module codegen. SVG works via legacy bridge interop. A future `expo run:ios` rebuild (after adding `react-native-svg` to Expo's module system properly) will silence the "Codegen didn't run for RNSVG*" warnings.
- **expo-camera / expo-image-picker** — installed as JS packages but native modules require an `expo run:ios` rebuild to activate the camera-dependent screens (`capture-food.tsx`, `scan-food.tsx`).
- Extract inline components from `index.tsx` (`DualRingArc`, `InsightsCard`, `FocusCard`).
- Decide on charting library before wiring real weight data.
- `lib/anthropic.ts` is built but not yet called from any screen — wire to `ask-ai.tsx` or as an alternative AI backend.
- `LayoutAnimation` on Android requires `UIManager.setLayoutAnimationEnabledExperimental(true)` in app entry point.
- OpenAI API key is stored in `.env` (`EXPO_PUBLIC_OPENAI_API_KEY`) and is gitignored. Each developer needs to add their own key.

### Product

- Does the app support dose titration tracking (changing dose over time)?
- Will there be a provider-facing dashboard, or is this purely consumer?
- Should side effects be shareable with a care team (HIPAA implications)?
- Monetization model: freemium, subscription, or healthcare B2B?
- Should `resetProfile()` be exposed in Settings for users who want to redo onboarding?

---

*This document reflects the state of the codebase as of March 7, 2026 (rev 4). It should be updated as features are built and decisions are made.*
