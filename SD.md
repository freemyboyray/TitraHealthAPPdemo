# GLP-1 Companion App — Software Design Document

**Project:** TitraHealthAPPdemo
**Platform:** iOS / Android (React Native + Expo)
**Last Updated:** March 18, 2026 (rev 12)

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
│   │   │   ├── ask-ai.tsx           # Standalone AI query entry screen
│   │   ├── log-activity.tsx     # Log activity / steps
│   │   ├── log-weight.tsx       # Log weight entry
│   │   ├── side-effects.tsx     # Log side effects entry
│   │   ├── side-effect-impact.tsx     # Side effect impact + target adjustments viewer
│   │   ├── weekly-summary.tsx         # 7-day cycle recap; AI insight; print/share
│   │   ├── gi-burden-survey.tsx       # Weekly check-in: GI Symptom Burden (5 Qs)
│   │   ├── activity-quality-survey.tsx # Weekly check-in: Activity & Strength (5 Qs)
│   │   ├── sleep-quality-survey.tsx   # Weekly check-in: Sleep Quality (5 Qs)
│   │   └── mental-health-survey.tsx   # Weekly check-in: Mental Health / PHQ-2+GAD-2 (5 Qs)
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
│       └── explore.tsx          # Education screen — fully built (rev 12)
├── components/
│   ├── add-entry-sheet.tsx      # FAB-triggered bottom sheet for all logging
│   ├── score-ring.tsx           # Animated SVG ring (Reanimated + react-native-svg)
│   ├── ring-breakdown.tsx       # Tap-to-expand score breakdown sheet
│   ├── cycle-biometric-card.tsx # CycleIQ biometric intelligence card (HRV/RHR/Sleep; tap-to-expand)
│   ├── appetite-forecast-strip.tsx # Appetite forecast strip (CycleIQ)
│   ├── metabolic-adaptation-card.tsx # Metabolic adaptation card (CycleIQ)
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
│   ├── user-profile.ts          # FullUserProfile type, ProfileDraft, BRAND_TO_GLP1_TYPE,
│   │                            # BRAND_TO_ROUTE, BRAND_DEFAULT_FREQ_DAYS, RouteOfAdministration
│   ├── drug-pk.ts               # FDA-sourced PK parameters (DRUG_PK), Bateman-equation helpers,
│   │                            # generatePkCurveHighRes (28-pt cycle), generateIntradayPkCurve (24h intraday),
│   │                            # DRUG_HALF_LIFE_LABEL, DRUG_IS_ORAL, DRUG_DEFAULT_FREQ_DAYS
│   ├── mock-profile.ts          # MOCK_PROFILE (FullUserProfile shape, fallback when no onboarding)
│   ├── scoring.ts               # getDailyTargets, computeRecovery, computeGlp1Support, insights,
│   │                            # breakdown data, coach notes, phase logic, focus cards
│   └── theme.ts                 # Color tokens + Font definitions
├── lib/
│   ├── supabase.ts              # Supabase client (AsyncStorage session persistence)
│   ├── openai.ts                # GPT-4o-mini: buildSystemPrompt, callOpenAI, parseFoodDescription,
│   │                            # generateDynamicInsights, generateCoachNote, generateLogInsight,
│   │                            # callGPT4oMiniVision (vision/photo flow)
│   ├── anthropic.ts             # Claude Haiku client: callHaiku(system, userContent[])
│   ├── usda.ts                  # USDA FoodData Central REST client: searchFoods, getFoodDetails
│   ├── context-snapshot.ts      # buildContextSnapshot() — natural language health summary for AI
│   ├── targets.ts               # Personalized Targets Engine — computeBaseTargets() (Mifflin-St Jeor
│   │                            # BMR → TDEE → deficit → macros); applyAdjustments() (evidence-based
│   │                            # side-effect delta rules, severity+recency weighted, conflict-resolved)
│   ├── garmin.ts                # Garmin Connect OAuth 2.0 PKCE flow + wellness data sync
│   ├── weekly-summary.ts        # computeWeeklySummary() — 7-day cycle aggregation (pure function)
│   ├── cycle-intelligence.ts    # CycleIQ biometric engine: EMA baseline, drug-phase deltas, classification
│   └── database.types.ts        # Auto-generated Supabase TypeScript types
├── stores/                      # Zustand stores (all implemented)
│   ├── log-store.ts             # All log types + Supabase CRUD + fetchInsightsData
│   ├── insights-store.ts        # Score computation from real Supabase data
│   ├── insights-ai-store.ts     # Pre-fetches all 3 Insights-tab AI cards in parallel
│   ├── user-store.ts            # Auth state, session, profile row, signOut
│   ├── garmin-store.ts          # Garmin connection state, sync, disconnect (persisted)
│   ├── preferences-store.ts     # Dark/light mode toggle, appleHealthEnabled (AsyncStorage)
│   ├── biometric-store.ts       # CycleIQ biometric history, EMA baseline, bootstrapping state
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
- **Supabase auth at root via `AuthGate`** — `_layout.tsx` renders an `AuthGate` component (inside `ProfileProvider`) that subscribes to `supabase.auth.onAuthStateChange`. On sign-in it loads the user's profile; on `SIGNED_OUT` it calls `resetProfile()` and navigates to `/auth/sign-in`. This guarantees auth-driven navigation works even when the user is deep in tabs.
- **Auth gate in splash** — `app/index.tsx` checks `sessionLoaded` → if no session, redirects to `/auth/sign-in`; then checks `isLoading` + `profile` to route to `/onboarding` or `/(tabs)`.
- **ProfileProvider at root with in-memory storage** — wraps everything in `_layout.tsx`. Profile is stored in a JS `Map` (not AsyncStorage) to avoid native module issues in dev client. Resets on cold restart; persistent storage should be added in production via a proper native rebuild.
- **Supabase session persistence (rev 7)** — `lib/supabase.ts` switched from `MemoryStorageAdapter` (in-memory Map) to `AsyncStorage` for session storage. Sessions now persist across app restarts, which is critical for OAuth round-trips where the app briefly backgrounds during the browser auth flow.
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

### Theme System (rev 6)

All screens use a runtime theme system. The active palette is provided via `contexts/theme-context.tsx` → `useAppTheme()` → `{ colors: AppColors, isDark: boolean }`. User preference is persisted in `stores/preferences-store.ts` (AsyncStorage key `preferences-store`). Toggle lives in **Settings → Appearance → Light Mode**.

**`AppColors` type** (`constants/theme.ts`):

| Token | Dark value | Light value | Usage |
|---|---|---|---|
| `bg` | `#000000` | `#FFFFFF` | Screen background |
| `surface` | `#111111` | `#F5F5F5` | Card / sheet surface |
| `textPrimary` | `#FFFFFF` | `#000000` | All primary text |
| `textSecondary` | `#9A9490` | `#6B6868` | Subtitles, labels |
| `textMuted` | `#5A5754` | `#9A9490` | Placeholders, disabled |
| `orange` | `#FF742A` | `#FF742A` | Brand accent — unchanged |
| `orangeDim` | `rgba(255,116,42,0.15)` | `rgba(255,116,42,0.15)` | Icon bg tint |
| `border` | `rgba(255,255,255,0.18)` | `rgba(0,0,0,0.18)` | Card borders |
| `borderSubtle` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.08)` | Dividers |
| `glassOverlay` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.04)` | BlurView overlay |
| `ringTrack` | `rgba(255,255,255,0.12)` | `rgba(0,0,0,0.12)` | SVG ring background track |
| `blurTint` | `'dark'` | `'light'` | BlurView tint prop |
| `statusBar` | `'light'` | `'dark'` | Expo StatusBar style |
| `isDark` | `true` | `false` | Used in `w(alpha)` helper |

**Status colors (semantic, unchanged in both modes):**
- Good: `#27AE60` | Low: `#F39C12` | Bad: `#E74C3C`

**Pattern for per-file usage:**
```typescript
import { useAppTheme } from '@/contexts/theme-context';
import type { AppColors } from '@/constants/theme';

// Inside component:
const { colors } = useAppTheme();
const s = useMemo(() => createStyles(colors), [colors]);

// Style factory — use w(alpha) for all translucent text/border colors:
const createStyles = (c: AppColors) => {
  const w = (a: number) => c.isDark ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
  return StyleSheet.create({
    label: { color: w(0.45) },
    border: { borderColor: w(0.18) },
  });
};
```

**Glass card pattern (both modes):**
```
Container (shadow + borderRadius)
└── backgroundColor: c.bg
└── BlurView (intensity 55–80, tint: colors.blurTint) — absolute fill
    └── c.glassOverlay overlay
        └── GlassBorder: top rgba(255,255,255,0.13)... [stays white — specular highlight]
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

- **sign-in.tsx** — email/password login via `supabase.auth.signInWithPassword`. Google OAuth via `expo-auth-session` + `expo-web-browser` (PKCE + implicit flow handling). Apple Sign In via `expo-apple-authentication` + `supabase.auth.signInWithIdToken`. All three paths call `finishOAuth(session)` helper that sets session, loads profile, and navigates to `/(tabs)`.
- **sign-up.tsx** — email/password registration via `supabase.auth.signUp`. Navigates to `/onboarding` on success.
- Auth state is managed in `useUserStore` (session, profile row, signOut).
- **`AuthGate` component** (rev 7) — `_layout.tsx` renders an `AuthGate` component inside `ProfileProvider` that subscribes to `supabase.auth.onAuthStateChange`. On `SIGNED_OUT` event it calls `resetProfile()` (clears in-memory profile + AsyncStorage) and `router.replace('/auth/sign-in')`, guaranteeing navigation even when the user is deep inside tabs.
- **Visual polish (rev 5):** Terracotta accent updated from `#C4784B` → `#D67455`; `Helvetica Neue` applied as explicit `fontFamily` across all text styles; button style renamed to `primaryBtn` / `primaryBtnText`.

---

### 6.1 Onboarding Flow (14 Screens)

**Files:** `app/onboarding/index.tsx` … `side-effects.tsx`
**Status:** ✅ Built

All 14 screens use `ProfileContext.updateDraft()` to accumulate data. The final screen (`side-effects.tsx`) calls `completeOnboarding()` which computes derived metrics, saves the full `FullUserProfile` (in-memory), sets `profile` in context, then navigates to `/(tabs)`.

| Step | File | Input Collected |
|---|---|---|
| 1 | `index.tsx` | `glp1Status` (active / starting) |
| 2 | `medication.tsx` | `medicationBrand`, `glp1Type`, `routeOfAdministration`, `injectionFrequencyDays` (auto-populated from brand via `BRAND_TO_ROUTE` + `BRAND_DEFAULT_FREQ_DAYS`). Brands grouped into Weekly Injection / Daily Injection / Daily Oral Pill / Other sections with inline drug notes. |
| 3 | `dose.tsx` | `doseMg` (preset or custom) |
| 4 | `schedule.tsx` | `injectionFrequencyDays` (locked to 1 for daily drugs; picker shown for weekly/biweekly injectables only). Dose noun adapts (pill / injection / shot). Oral semaglutide shows empty-stomach tip card. `lastInjectionDate` |
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
4. **Focus Cards** — data-driven from `HealthContext.focuses` (`FocusItem[]`). Each card shows an icon, label, and subtitle. Generated by `generateFocuses()` in `scoring.ts` using phase-weighted deficit scoring. Completed items show a filled orange circle + checkmark and strikethrough label; incomplete items show a plain gray ring.

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
**Status:** ✅ Built — all 3 tabs rendered; AI Insight cards are dynamic; PK chart is drug-aware

Three-tab segmented control (Medication | Lifestyle | Progress). Each tab has cards + collapsible Recent Logs.

**AI Insight Cards (dynamic):** Each tab's "AI INSIGHTS" card calls `generateLogInsight(tab, health)` on mount (GPT-4o-mini, cached per day per tab). Shows `ActivityIndicator` + skeleton bars while loading; falls back to a hardcoded static string on error.

**Medication Level Chart (drug-aware):**
- Weekly/biweekly injectables → `generatePkCurveHighRes()` — 28-point high-resolution cycle curve (injection → next dose); x-axis = cycle-anchored labels via `pkCycleLabels()` (`['Inj', '+1D', …, 'Next']`); includes a **NOW marker** (vertical line + white/orange dot + "NOW" label) at the user's actual current position computed from `hoursElapsed` since last injection; current level label reflects real-time `pkConcentrationPct` not the cycle trough
- Daily drugs (liraglutide, oral_semaglutide, orforglipron) → `generateIntradayPkCurve()` — 7-point intraday chart (t=0.5h → 24h); x-axis = `INTRADAY_TIME_LABELS` (`['Dose', '+4h', …, '+24h']`)
- Chart header shows drug class name + half-life label from `DRUG_HALF_LIFE_LABEL`

---

### 6.4 Education Screen

**File:** `app/(tabs)/explore.tsx` *(rename to `education.tsx` pending)*
**Status:** ✅ Built (rev 12)

Fully implemented education hub with 5 interactive sections and a Supabase article library.

**Layout (top to bottom):**

1. **Phase-Aware "This Week's Focus" card** — reads `profile.doseStartDate` + `doseMg` + `glp1Type` via `useProfile()`, computes program week, calls `getEscalationPhase()` to determine current phase, then renders the phase's `weeklyFocus` blurb + 4 actionable phase-specific tips. Displays program week number. Only renders when profile has a start date.

2. **Myth vs. Fact cards** (horizontally scrollable `FlatList`) — 7 tap-to-reveal cards debunking the most common GLP-1 misconceptions (willpower framing, eat-anything myth, weight permanence, hair loss permanence, nausea = efficacy, diabetes-only indication, thyroid risk). Red "MYTH" / green "FACT" badge swaps on tap with `LayoutAnimation`.

3. **Side Effect Decoder** — interactive searchable symptom grid. 20 symptoms colour-coded by category: Expected (green) / Monitor (yellow) / Call Doctor (red). Category filter bar narrows the chip grid. Tapping a chip reveals a detail panel with specific guidance. Teaches the critical Expected vs. Concerning distinction that causes unnecessary ER visits and medication discontinuation.

4. **"When to Call Your Doctor" safety card** — collapsible red-tinted card with 9 specific warning signs (🔴 immediate / 🟡 monitor) including pancreatitis, jaundice, severe dehydration, hypoglycemia, and allergic reaction. Includes emergency note for 911 situations.

5. **FROM THE LIBRARY** — fetches up to 10 articles from Supabase `articles` table (populated by `supabase/migrations/20260318_articles.sql`). Articles rendered as tappable cards with category colour chips and reading time; tap navigates to `app/articles/[id].tsx`.

6. **DEEP DIVES** — 7 expandable accordion sections using `LayoutAnimation.easeInEaseOut` per item:
   - Understanding Your Medication (6 Q&As)
   - Injection Technique & Storage (6 Q&As — new in rev 12)
   - Nutrition Guide (6 Q&As — expanded with supplements, nausea trigger foods)
   - Lifestyle & Exercise (5 Q&As — expanded with muscle loss, alcohol)
   - Mental Health & Food Noise (5 Q&As — new in rev 12: food noise neuroscience, body image, addiction connection)
   - Managing Side Effects (5 Q&As)
   - Frequently Asked Questions (6 Q&As — expanded with fertility, stopping therapy, drug interactions)

**Articles Database (`supabase/migrations/20260318_articles.sql`):**
- Creates `articles` table with `id`, `title`, `subtitle`, `category`, `body_markdown`, `reading_time_minutes`, `published_at`, `phase_focus`
- Row-level security: publicly readable, no auth required
- Seeds 10 full-length evidence-based articles: protein preservation, injection technique, weight plateau, vitamins/deficiency, food noise neuroscience, muscle preservation, alcohol safety, stopping therapy, GI side effect management, cardiovascular benefits

---

### 6.5 AI Chat Screen

**File:** `app/ai-chat.tsx` + `components/ai-chat-overlay.tsx`
**Status:** ✅ Built — fully wired to GPT-4o-mini via `lib/openai.ts`

`app/ai-chat.tsx` is a standalone modal screen (navigated from Score Detail via route param). `components/ai-chat-overlay.tsx` is a floating overlay triggered by tapping any metric card on the Home or Insights screens.

**AI Chat Overlay features (rev 7 redesign):**
- **Minimal floating UI** — blur backdrop + bottom input card + floating chat bubbles
- **Top-left controls** — X close button (left: 16) + clock history button (gap: 8, same row)
- **Image upload** — camera icon (`handlePickCamera` via `ImagePicker.launchCameraAsync`) + attach icon (`handlePickLibrary` via `ImagePicker.launchImageLibraryAsync`); both capture base64 + URI; thumbnail preview above input with dismiss X; sending with image calls `callGPT4oMiniVision` instead of `callOpenAI`; image shown in user bubble
- **Chat history** — clock button opens history panel; messages fetched from Supabase `chat_messages` table; grouped into conversations by 30-minute time gaps (`groupIntoConversations()`); each conversation shown as a card with preview text, date, and message count; "Resume conversation" loads past messages into active chat with a "Resumed from [date]" banner
- **Context labels** — overlay launched with a `contextLabel`/`contextValue` pair (e.g., "Protein: 45g") shown as an orange badge above the input

**Card tap-to-ask (rev 7):**
- "Ask AI" text and explicit buttons removed from all cards
- Cards themselves are wrapped in `Pressable` — tapping any metric card opens the AI overlay with that card's data as context
- Applies to: `HealthMetricCard` (home), all Insights screen cards (`MetricCard`, `DailyMetricCard`, `InjectionCard`, `WeightChartCard`, etc.)

**`app/ai-chat.tsx` features:**
- **Context strip** — orange badge at top showing score + phase when launched from a score detail screen
- **Type-aware prompt chips** — `RECOVERY_CHIPS`, `READINESS_CHIPS`, or `GENERIC_CHIPS` based on `type` param
- **Chat interface** — full message history with user (orange) / assistant (dark) bubbles, loading state, auto-scroll
- **`sendMessage()`** — calls `callOpenAI(messages, systemPrompt)` with `buildSystemPrompt(health, type?)`. Error shows user-facing fallback.

---

### 6.6 Add Entry Sheet

**File:** `components/add-entry-sheet.tsx`
**Status:** ✅ Built — all 10 items wired

Bottom sheet modal triggered by FAB. 10-item grid. Each item navigates to its dedicated entry screen (via `router.push`) or opens an inline form.

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
- **SIDE EFFECTS** — navigates to `app/entry/side-effects.tsx` (restored in rev 8; was dropped during dark mode redesign)

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
| Log Activity | `log-activity.tsx` | Activity type, duration, intensity arc gauge, steps input (auto-estimated from `STEPS_PER_MIN` × duration, user-editable). Saves `exercise_type`, `duration_min`, `intensity`, `steps`, `active_calories` via `useLogStore.addActivityLog()`. Multiple workouts per day supported. |
| Log Weight | `log-weight.tsx` | Current weight (lbs/kg with unit toggle). Saves via `useLogStore.addWeightLog()` |
| Side Effects | `side-effects.tsx` | Side effect type + severity slider. Saves via `useLogStore.addSideEffectLog()` |
| Side Effect Impact | `side-effect-impact.tsx` | Read-only screen showing how active side effects adjust daily nutrition and activity targets; powered by `computeBaseTargets()` + `applyAdjustments()` from `lib/targets.ts` |
| Weekly Summary | `weekly-summary.tsx` | 7-day cycle recap: weight delta, avg protein/hydration/steps, food noise trend, weekly check-in scores, GPT-4o-mini narrative insight (`generateWeeklyInsight`). Exportable via `expo-print` + `expo-sharing`. Caches last summary in AsyncStorage. |
| GI Burden Survey | `gi-burden-survey.tsx` | Weekly check-in: 5 GI symptom questions (Not at all → Extremely). Raw score 0–20 inverted to 0–100. Saved to `weekly_checkins` as `gi_burden`. Unlocks on day 1 of each cycle. |
| Activity Quality Survey | `activity-quality-survey.tsx` | Weekly check-in: 5 activity/strength questions (Not at all → Always). Raw score 0–20 direct → 0–100. Saved as `activity_quality`. Unlocks day 8. |
| Sleep Quality Survey | `sleep-quality-survey.tsx` | Weekly check-in: 5 sleep quality questions. Raw 0–20 inverted to 0–100. Saved as `sleep_quality`. Unlocks day 15. |
| Mental Health Survey | `mental-health-survey.tsx` | Weekly check-in: 5 PHQ-2+GAD-2 adapted questions. Raw 0–20 inverted to 0–100. Saved as `mental_health`. Unlocks day 22. |

---

## 7. Data Models

### FullUserProfile (implemented — in-memory via ProfileContext)

```typescript
// constants/user-profile.ts

// Weekly SC injectables: zepbound | mounjaro | ozempic | wegovy | trulicity |
//                        compounded_semaglutide | compounded_tirzepatide
// Daily SC injectables:  saxenda | victoza | compounded_liraglutide
// Daily oral pills:      rybelsus | oral_wegovy | orforglipron
// Catch-all:             other
type MedicationBrand = ...;

// weekly injectable: semaglutide | tirzepatide | dulaglutide
// daily injectable:  liraglutide
// daily oral:        oral_semaglutide | orforglipron
type Glp1Type = ...;

type RouteOfAdministration = 'injection' | 'oral';

export type FullUserProfile = {
  glp1Status: 'active' | 'starting';
  medicationBrand: MedicationBrand;
  glp1Type: Glp1Type;
  routeOfAdministration: RouteOfAdministration;
  doseMg: number;
  injectionFrequencyDays: number;     // 1 | 7 | 14 | custom
  lastInjectionDate: string;          // YYYY-MM-DD (also "last dose date" for oral drugs)
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

### Drug Pharmacokinetic Model (implemented — `constants/drug-pk.ts`)

FDA/population-PK sourced Bateman-equation model for all 6 GLP-1 drug classes.

| Drug Class | Brands | t½ | Tmax | Route | Dosing |
|---|---|---|---|---|---|
| `semaglutide` | Ozempic, Wegovy, compounded | 168h | 56h | SC | Weekly |
| `tirzepatide` | Mounjaro, Zepbound, compounded | 120h | 24h | SC | Weekly |
| `dulaglutide` | Trulicity | 120h | 48h | SC | Weekly |
| `liraglutide` | Saxenda, Victoza, compounded | 13h | 11h | SC | Daily |
| `oral_semaglutide` | Rybelsus, oral Wegovy | 158h | ~1h | Oral | Daily |
| `orforglipron` | Orforglipron (Eli Lilly) | 50h | 8h | Oral | Daily |

**Key exports:**
- `DRUG_PK` — `{ ka, ke }` rate constants per drug class
- `DRUG_HALF_LIFE_LABEL` — human-readable half-life label per drug (shown in chart header)
- `DRUG_IS_ORAL` / `DRUG_DEFAULT_FREQ_DAYS` — route and interval lookups
- `generatePkCurveHighRes(glp1Type, glp1Status, injFreqDays, nPoints=28)` — N evenly-spaced samples from t=0 → cycle end; default 28 points for 7-day cycle (~1 sample per 6h); replaces `generatePkCurve`
- `pkCycleLabels(injFreqDays)` — cycle-anchored x-axis labels: `['Inj', '+1D', …, '+{N-1}D', 'Next']`
- `generatePkCurve(daysSince, …)` — legacy 7-day lookback curve; retained but no longer used by the chart
- `generateIntradayPkCurve(glp1Type)` — 7 values sampled at t = 0.5h, 4h, 8h, 12h, 16h, 20h, 24h for daily drugs (always at steady state)
- `pkConcentrationPct(tHours, drug, atSteadyState, intervalH)` — normalized 0–100% concentration at any time point
- `INTRADAY_TIME_LABELS` — `['Dose', '+4h', '+8h', '+12h', '+16h', '+20h', '+24h']` for chart x-axis

---

### Supabase Database Tables (implemented — via `lib/database.types.ts`)

| Table | Key Columns | Used By |
|---|---|---|
| `profiles` | `id`, `full_name`, `medication_type`, `injection_frequency_days`, `start_weight_lbs`, `goal_weight_lbs`, `program_start_date`, `medication_brand`, `route_of_administration`, `glp1_status`, `unit_system`, `initial_dose_mg`, `dose_start_date` | `user-store.ts`, `log-store.ts`, `insights-store.ts` |
| `user_goals` | `daily_calories_target`, `daily_protein_g_target`, `daily_fiber_g_target`, `daily_steps_target` | `log-store.ts`, `insights-store.ts` |
| `injection_logs` | `dose_mg`, `injection_date`, `injection_time`, `site`, `notes` | `log-store.ts` |
| `food_logs` | `name`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `serving_size`, `meal_type`, `source`, `logged_at` | `log-store.ts` |
| `weight_logs` | `weight_lbs`, `weight_kg`, `logged_at`, `notes` | `log-store.ts` |
| `activity_logs` | `activity_type`, `duration_min`, `steps`, `calories_burned`, `source`, `date` | `log-store.ts` |
| `side_effect_logs` | `effect_type` (enum — see below), `severity`, `phase_at_log`, `notes`, `logged_at` | `log-store.ts` |

**`side_effect_type` enum values** (expanded in migration `20260315_expand_side_effect_types.sql`):
`nausea` · `vomiting` · `fatigue` · `constipation` · `diarrhea` · `headache` · `appetite_loss` · `hair_loss` · `dehydration` · `dizziness` · `muscle_loss` · `heartburn` · `food_noise` · `sulfur_burps` · `bloating` · `other`

**Migrations applied:**
- `20260311_profiles_medication_brand.sql` — adds `medication_brand`, `route_of_administration`, `glp1_status`, `unit_system`, `initial_dose_mg`, `dose_start_date` to `profiles`
- `20260315_expand_side_effect_types.sql` — adds 7 new values to `side_effect_type` enum
- `20260316_garmin_tokens.sql` — adds `garmin_tokens JSONB` to `profiles`; adds `source TEXT DEFAULT 'manual'` to `activity_logs` + `weight_logs`; adds unique constraint `activity_logs_user_date_source_key (user_id, date, source)`; adds partial unique index `weight_logs_garmin_daily_uniq` on `(user_id, source, logged_at::date) WHERE source = 'garmin'`
- `20260316_new_checkin_types.sql` — documentation marker for 4 new `weekly_checkins` check-in types: `gi_burden`, `activity_quality`, `sleep_quality`, `mental_health` (no schema change; `checkin_type` is TEXT)
- `20260318_articles.sql` — creates `articles` table (`id UUID PK`, `title`, `subtitle`, `category CHECK IN ('nutrition','medication','lifestyle','mindset','exercise')`, `body_markdown`, `reading_time_minutes`, `published_at`, `phase_focus`, `created_at`); public-read RLS policy; seeds 10 evidence-based full-length articles

### Scoring Types (implemented)

```typescript
// constants/scoring.ts

type DailyTargets = { proteinG: number; waterMl: number; fiberG: number; steps: number };
type DailyActuals = { proteinG: number; waterMl: number; fiberG: number; steps: number; injectionLogged: boolean };
type WearableData  = { sleepMinutes: number; hrvMs: number; restingHR: number; spo2Pct: number; respRateRpm?: number };
type ShotPhase     = 'shot' | 'peak' | 'balance' | 'reset';
type FocusItem     = { id: string; label: string; subtitle: string; iconName: string; iconSet: 'Ionicons' | 'MaterialIcons'; status: 'completed' | 'active' | 'pending' };
```

### Weekly Summary Types (implemented — `lib/weekly-summary.ts`)

```typescript
export interface WeeklySummaryData {
  windowStart: string;          // 'yyyy-MM-dd', 7 days ago
  windowEnd: string;            // 'yyyy-MM-dd', yesterday
  weight: {
    start: number | null;       // lbs, oldest log in window
    end: number | null;         // lbs, newest log in window
    delta: number | null;       // end - start
  };
  nutrition: {
    avgCalories: number | null;
    avgProteinG: number | null;
    avgFiberG: number | null;
    avgWaterMl: number | null;
    daysLogged: number;
  };
  activity: {
    avgSteps: number | null;
    totalActiveMin: number | null;
    daysActive: number;
  };
  checkins: {
    gi_burden: number | null;        // 0–100
    activity_quality: number | null; // 0–100
    sleep_quality: number | null;    // 0–100
    mental_health: number | null;    // 0–100
  };
}
```

**Key exports:**
- `computeWeeklySummary(logs, targets)` — pure function aggregating 7-day window ending yesterday from `FoodLog[]`, `WeightLog[]`, `ActivityLog[]`, `SideEffectLog[]`, `WeeklyCheckinRow[]`, and `FoodNoiseLog[]`

### Garmin Integration (implemented — `lib/garmin.ts` + `stores/garmin-store.ts`)

```typescript
// lib/garmin.ts
export type GarminSyncResult = {
  steps: number | null;
  activeCalories: number | null;
  sleepHours: number | null;
  restingHR: number | null;
  weight: number | null;
};
```

**Key exports:**
- `initiateGarminOAuth()` — OAuth 2.0 PKCE flow via `expo-web-browser`; returns auth code from deep-link callback
- `triggerGarminSync()` — calls `garmin-sync` Supabase Edge Function; returns `GarminSyncResult`
- `disconnectGarmin()` — calls `garmin-disconnect` Edge Function; clears tokens from `profiles`

**Supabase Edge Functions:**
- `garmin-token-exchange` — exchanges auth code for access + refresh tokens; stores in `profiles.garmin_tokens`
- `garmin-sync` — refreshes token if needed; fetches Garmin Wellness API `/dailies` (steps, calories, sleep, HR) + `/bodyComps` (weight); upserts into `activity_logs` and `weight_logs` with `source = 'garmin'`
- `garmin-disconnect` — nulls `profiles.garmin_tokens`

### Personalized Targets Engine (implemented — `lib/targets.ts`)

```typescript
// lib/targets.ts — Pure TypeScript, no React/Supabase

type BaseTargets = {
  caloriesTarget: number;  // Mifflin-St Jeor BMR → TDEE → caloric deficit
  proteinG: number;        // 1.6–2.0 g/kg based on weekly loss speed
  fatG: number;            // 28% of calories
  carbsG: number;          // remainder calories, floor 50g
  fiberG: number;          // IOM gender/age norms
  waterMl: number;         // 35 ml/kg, bounded [2000, 4000]
  steps: number;           // 8000–9000 based on loss speed
  activeMinutes: number;
};

type SideEffectRule = {
  waterMlDelta: number; proteinPct: number; fiberGDelta: number;
  fatPct: number; carbsPct: number; stepsDelta: number; activeMinDelta: number;
  mealFrequency: number; fiberType?: 'soluble_first' | 'soluble_only' | 'avoid_cruciferous';
  resistanceFlag?: boolean; foodsToAvoid?: string[]; foodsToPrioritize?: string[]; label: string;
};

type SideEffectAdjustment = {
  mealFrequency: number; foodsToAvoid: string[]; foodsToPrioritize: string[];
  adjustmentReasons: string[]; resistanceTrainingRecommended: boolean; fiberType?: string;
};
```

**Key exports:**
- `computeBaseTargets(profile)` — Mifflin-St Jeor BMR-based daily targets from `FullUserProfile`; stores to `user_goals` at onboarding completion
- `SIDE_EFFECT_RULES` — 13-effect rule table with evidence-based deltas (sourced from PMC9821052, PMC11668918, PMC12536186, ACLM/ASN/OMA/TOS joint advisory)
- `applyAdjustments(base, recentLogs)` — applies severity + recency weighted side-effect deltas to any target set; conflict resolution: water=MAX, protein=MAX, fiber=decrease-wins, fat=most-restrictive, steps=MAX (suppressed for vomiting/severe nausea)

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
| Insights AI | `useInsightsAiStore` (Zustand) | Pre-fetched AI text for all 3 Insights tabs; avoids repeated GPT calls on tab switch |
| Garmin | `useGarminStore` (Zustand + AsyncStorage) | Connection state, last-synced timestamp, latest wellness data; persisted via `zustand/middleware` |
| Health / Scores | `HealthContext` (useReducer) | Daily actuals, targets, wearable data, recovery + support scores |
| Preferences | `usePreferencesStore` (Zustand + AsyncStorage) | `isDark` (light/dark mode), `appleHealthEnabled` |
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

**HealthContext initialization changes (rev 5):**
- Initial actuals are now all-zero (`ZERO_ACTUALS`) rather than pre-seeded with demo values
- Water intake is persisted to `AsyncStorage` (key: `@titrahealth_water_YYYY-MM-DD`) and reloaded on mount; works even when unauthenticated
- Wearable seed renamed to `STUB_WEARABLE` (placeholder until Apple Health is wired)

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
| `AddEntrySheet` | `components/add-entry-sheet.tsx` | ✅ Built | All 10 items; DESCRIBE FOOD AI parser inline; SIDE EFFECTS button restored (rev 8) |
| Insights Screen | `app/(tabs)/log.tsx` | ✅ Built | All 3 tabs; dynamic AI insight cards |
| AI Chat | `app/ai-chat.tsx` | ✅ Built | GPT-4o-mini; full health context; type-aware chips |
| Score Detail | `app/score-detail.tsx` | ✅ Built | Per-metric breakdown; AI coach note; phase banner |
| `PhaseInterpretationBanner` | inline in `app/score-detail.tsx` | ✅ Built | Phase-aware orange banner |
| `DualRingArc` | inline in `app/(tabs)/index.tsx` | ⚠️ Inline | Extract to `components/dual-ring-arc.tsx` |
| `InsightsCard` | inline in `app/(tabs)/index.tsx` | ⚠️ Inline | Extract to `components/insights-card.tsx` |
| `FocusCard` | inline in `app/(tabs)/index.tsx` | ⚠️ Inline | Extract to `components/focus-card.tsx` |
| Education Screen | `app/(tabs)/explore.tsx` | ✅ Built | Phase card, Myth vs. Fact, Side Effect Decoder, Safety card, 7 deep-dive accordions, article library (rev 12) |
| `CycleBiometricCard` | `components/cycle-biometric-card.tsx` | ✅ Built | HRV/RHR/Sleep with EMA baseline; tap-to-expand explanation panel; long-press AI chat (rev 12) |
| `AppetiteForecastStrip` | `components/appetite-forecast-strip.tsx` | ✅ Built | CycleIQ appetite forecast strip |
| `MetabolicAdaptationCard` | `components/metabolic-adaptation-card.tsx` | ✅ Built | CycleIQ metabolic adaptation card |
| Side Effect Impact Screen | `app/entry/side-effect-impact.tsx` | ✅ Built | Shows adjusted targets from active side effects |
| Weekly Summary Screen | `app/entry/weekly-summary.tsx` | ✅ Built | 7-day recap; AI insight; print/share |
| GI Burden Survey | `app/entry/gi-burden-survey.tsx` | ✅ Built | Weekly check-in (5 Qs, inverted 0–100) |
| Activity Quality Survey | `app/entry/activity-quality-survey.tsx` | ✅ Built | Weekly check-in (5 Qs, direct 0–100) |
| Sleep Quality Survey | `app/entry/sleep-quality-survey.tsx` | ✅ Built | Weekly check-in (5 Qs, inverted 0–100) |
| Mental Health Survey | `app/entry/mental-health-survey.tsx` | ✅ Built | Weekly check-in PHQ-2+GAD-2 (5 Qs, inverted 0–100) |
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
- [x] **Supabase integration** — `lib/supabase.ts` (AsyncStorage session persistence); `useUserStore` (session); `useLogStore` (all CRUD); `lib/database.types.ts`
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
- [x] **metro.config.js** — react-native-svg CommonJS redirect + `.claude` blockList + parent `node_modules` block + `nodeModulesPaths` / `watchFolders` scoped to project root
- [x] **Extended drug coverage** — `MedicationBrand` expanded to include daily injectables (Saxenda, Victoza, compounded liraglutide) and oral GLP-1 pills (Rybelsus, oral Wegovy, Orforglipron)
- [x] **FDA-sourced PK model** — `constants/drug-pk.ts`; Bateman-equation `pkConcentrationPct`; `generatePkCurveHighRes` (28-pt cycle, rev 9) + `generateIntradayPkCurve` (24h intraday); population-PK verified against NDA data for all 6 drug classes
- [x] **`RouteOfAdministration` type** — `'injection' | 'oral'`; added to `FullUserProfile`; auto-populated via `BRAND_TO_ROUTE` on medication onboarding step
- [x] **Medication onboarding grouped** — brands organized into Weekly Injection / Daily Injection / Daily Oral Pill / Other sections with inline drug notes
- [x] **Smart schedule screen** — frequency auto-locked for daily drugs; dose noun adapts (pill / injection / shot); oral semaglutide empty-stomach tip card
- [x] **Drug-aware PK chart in Insights** — weekly drugs → 7-day chart; daily drugs → intraday 24h chart with `INTRADAY_TIME_LABELS`; chart header shows drug name + half-life
- [x] **High-res PK curve + NOW marker (rev 9)** — `generatePkCurveHighRes()` replaces 7-point daily samples with 28-point smooth pharmacokinetic arc; x-axis uses `pkCycleLabels()` cycle-anchored labels (`Inj · +1D … Next`); "NOW" marker (vertical line + white/orange dot) rendered at user's real-time position via `hoursElapsed`; `currentConcentrationPct` drives the Optimal/Active/Tapering/Low level label instead of the cycle trough
- [x] **Medication brand shown in PK chart (rev 9)** — chart header displays brand name via `BRAND_DISPLAY_NAMES` (e.g., "Mounjaro® · 5-day half-life") instead of raw generic type string; `BRAND_DISPLAY_NAMES` record added to `constants/user-profile.ts`
- [x] **HealthProvider profile sync fix (rev 9)** — `HealthProvider` used `useReducer` with a one-time initializer, causing `state.profile` to remain stale as `MOCK_PROFILE` (semaglutide) even after the real profile loaded or settings changed; fixed by adding `SYNC_PROFILE` action to reducer + `useEffect` that dispatches on every `profile` prop change; ensures PK chart, scoring, and AI context always reflect the user's actual medication
- [x] **No mock injection logs (rev 9)** — removed auto-seeding of `injection_logs` rows from `completeOnboarding()` and `updateProfile()` in `profile-context.tsx`; injection logs are now only created by explicit user action via the log-injection entry screen
- [x] **Render error fix on empty injection logs (rev 9)** — `MedLevelChartCard` called `useUiStore()` after a conditional early return, violating React's Rules of Hooks; when the last injection log was deleted `chartData` became null causing "rendered fewer hooks than expected"; fixed by hoisting `useUiStore()` above the early return
- [x] **AI error message improved (rev 9)** — catch block in `ai-chat-overlay.tsx` now distinguishes "API key not configured" (`EXPO_PUBLIC_OPENAI_API_KEY not set` → instructs user to restart with `--clear`) from network/connection errors
- [x] **Focus card points system removed (rev 9)** — removed `badge` field from `FocusItem` type and all `+N pts` / "On Track" / "Complete" badge values from `buildFocusItem` in `scoring.ts`; badge render block and `badge`/`badgeText` styles removed from `index.tsx`
- [x] **Focus card completion UX (rev 9)** — orange circle indicator now only shows for `completed` status (filled orange + checkmark); `active` and `pending` both render a plain gray ring (no orange until goal is met); completed focus labels gain strikethrough + muted color via `focusLabelDone` style
- [x] **Zero-initialized actuals** — `ZERO_ACTUALS` replaces pre-seeded demo data in `HealthContext`
- [x] **Water persistence via AsyncStorage** — water intake keyed by date (`@titrahealth_water_YYYY-MM-DD`); loaded on mount; works unauthenticated
- [x] **Auth screen polish** — terracotta `#D67455`, Helvetica Neue font, `primaryBtn` style rename, shadow/opacity tweaks
- [x] **Arc gauge SVG fix** — `largeArc` hardcoded to `0` in `log-activity.tsx` to prevent rendering glitch at 50% threshold
- [x] **Light/dark mode toggle** — persistent app-wide theme system; Settings → Appearance → Light Mode switch; `AppThemeProvider` + `useAppTheme()` hook; `AppColors` palette type with `isDark` flag; `w(alpha)` helper pattern flips all `rgba(255,255,255,X)` → `rgba(0,0,0,X)` in light mode; all 50+ screens and components converted; orange `#FF742A` unchanged in both modes; preference persisted via `stores/preferences-store.ts` (AsyncStorage); `StatusBar` style wired to theme
- [x] **AI Chat Overlay redesign (rev 7)** — floating minimal UI (blur backdrop, bottom input card, floating bubbles); top-left X + history clock controls; image upload via camera + photo library (`expo-image-picker`); thumbnail preview + dismiss; vision path calls `callGPT4oMiniVision`; image shown in user bubble; chat history panel groups messages into conversations by 30-min time gaps; conversation cards show preview/date/count + "Resume conversation"; resuming pre-loads past messages with banner
- [x] **Card tap-to-ask AI (rev 7)** — removed "Ask AI" text buttons from all cards (Home + Insights screens); cards themselves wrapped in `Pressable` to open overlay with metric context; applies to `HealthMetricCard`, `MetricCard`, `DailyMetricCard`, `InjectionCard`, `WeightChartCard`, `WeightTimelineCard`, `MedLevelChartCard`, `ProgressStatCard`
- [x] **Gray card backgrounds (rev 7)** — "Today's Focuses" cards and all Score Breakdown metric cards now use `c.surface` (lifted gray) instead of `c.bg` (pure page background); applied in `index.tsx` (`focusCardInner`) and `score-detail.tsx` (`createCardStyles`, `createFocusStyles`, `coachBody`)
- [x] **Sign-out navigation (rev 7)** — `AuthGate` inside `ProfileProvider` listens for Supabase `SIGNED_OUT` event; calls `resetProfile()` (clears AsyncStorage + in-memory state) then `router.replace('/auth/sign-in')`; sign-out button in Settings now correctly navigates user out
- [x] **Google + Apple Sign In functional (rev 7)** — Google OAuth via `expo-auth-session` + `expo-web-browser` with `makeRedirectUri({ scheme: 'titrahealthappdemo', native: 'titrahealthappdemo://' })`, handles PKCE (code exchange) and implicit (hash token) flows; Apple Sign In via `expo-apple-authentication` + `supabase.auth.signInWithIdToken`; both protected by `checkSupabaseConfigured()` guard; `try/finally` ensures loading states always clear
- [x] **Apple Health toggle functional (rev 7)** — Settings → Integrations → Apple Health is a live `Switch`; toggle ON calls `requestPermissions()` (HealthKit); if granted sets `appleHealthEnabled` in preferences store + calls `fetchAll()`; if denied shows system Settings alert; `(tabs)/_layout.tsx` only calls `fetchHealthData()` on launch when `appleHealthEnabled` is true; `appleHealthEnabled` added to `preferences-store.ts`
- [x] **Supabase session persistence via AsyncStorage (rev 7)** — `lib/supabase.ts` switched from `MemoryStorageAdapter` to `AsyncStorage`; sessions persist across app restarts; required for OAuth round-trips where app backgrounds during browser auth flow
- [x] **Personalized Targets Engine (rev 8)** — `lib/targets.ts`; `computeBaseTargets()` uses Mifflin-St Jeor BMR → TDEE → deficit → macros; evidence-based from 2024–2025 PMC + ACLM/ASN/OMA/TOS meta-analyses; replaces hardcoded scoring.ts multipliers for calorie and macro targets
- [x] **Side-Effect Adjustment Engine (rev 8)** — `applyAdjustments()` in `lib/targets.ts`; 13 GLP-1 side effects (constipation, diarrhea, nausea, vomiting, fatigue, headache, appetite_loss, dehydration, dizziness, muscle_loss, heartburn, food_noise, sulfur_burps, bloating); severity × recency weighted; conflict-resolved (water=MAX, protein=MAX, fiber=decrease-wins, fat=most-restrictive); each effect includes `foodsToAvoid`, `foodsToPrioritize`, `mealFrequency`, `fiberType`, optional `resistanceFlag`
- [x] **DB schema expanded (rev 8)** — `profiles` table: 6 new columns (`medication_brand`, `route_of_administration`, `glp1_status`, `unit_system`, `initial_dose_mg`, `dose_start_date`); `side_effect_type` enum: 7 new values (`dehydration`, `dizziness`, `muscle_loss`, `heartburn`, `food_noise`, `sulfur_burps`, `bloating`)
- [x] **Side Effects button restored in Add Entry Sheet (rev 8)** — was silently dropped in dark-mode redesign commit (`90cfb38`); now navigates to `/entry/side-effects`
- [x] **Google OAuth redirect URI fix (rev 8)** — updated `makeRedirectUri` for `expo-auth-session` v7 API changes; ensures redirect URI generation works correctly in both Expo Go (tunnel) and production builds
- [x] **Activity logging persists steps + calories (rev 10)** — `addActivityLog` signature extended with optional `steps` and `active_calories` params; `log-activity.tsx` adds `STEPS_PER_MIN` lookup table (Walking 100/min, Running 160/min, Cycling 0, others 30) that auto-estimates steps from workout type × duration; editable `TextInput` steps field inserted below Duration gauge; user edits lock the auto-estimate via `stepsEdited` flag; voice transcription changes re-estimate correctly; both values now written to `activity_logs` on every manual save; Lifestyle tab "Calories Burned" and "Daily Steps" metric cards populated from real data
- [x] **Lifestyle tab data refresh on focus (rev 10)** — `log.tsx` mount-only `useEffect(() => fetchInsightsData(), [])` replaced with `useFocusEffect(useCallback(...))` (same pattern as `index.tsx`); ensures `activityLogs`, `foodLogs`, and all Lifestyle/Medication/Progress cards are always fresh when navigating back from any entry screen
- [x] **Activity log submit decoupled from global loading state (rev 10)** — `log-activity.tsx` previously used `disabled={loading}` tied to the global `useLogStore` loading flag; `useFocusEffect` in `log.tsx` set `loading: true` on every tab focus, making the "Log Activity" button silently no-op when arriving from the log tab; fixed by replacing with a local `isSubmitting` state scoped to the submit action only; `Alert` added to surface Supabase insert errors directly to the user
- [x] **Drop `activity_logs` unique date constraint (rev 10)** — `activity_logs_user_id_date_key` unique constraint on `(user_id, date)` prevented logging more than one workout per day; migration `20260316_activity_logs_drop_unique_date.sql` drops the constraint; multiple workouts per day now correctly accumulate in the Lifestyle tab cards
- [x] **Garmin Connect integration (rev 11)** — `lib/garmin.ts` implements OAuth 2.0 PKCE via `expo-web-browser` deep-link callback; `stores/garmin-store.ts` persists connection state + latest wellness data (steps, active calories, sleep hours, resting HR, weight) via Zustand + AsyncStorage; 3 Supabase Edge Functions: `garmin-token-exchange` (code → tokens → store in `profiles.garmin_tokens`), `garmin-sync` (refresh token if needed → Garmin Wellness API `/dailies` + `/bodyComps` → upsert `activity_logs` + `weight_logs` with `source='garmin'`), `garmin-disconnect` (null tokens); migration adds `garmin_tokens JSONB` to `profiles` + `source TEXT` columns + unique constraints for Garmin upserts
- [x] **Weekly check-in surveys (rev 11)** — 4 new entry screens, each with 5 Likert-scale questions (Not at all → Extremely/Always); scores normalized to 0–100; saved to `weekly_checkins` table; unlock sequentially by injection cycle day: GI Burden (day 1), Activity Quality (day 8), Sleep Quality (day 15), Mental Health (day 22); all themed with dark glass UI + orange dot picker
- [x] **Side Effect Impact screen (rev 11)** — `app/entry/side-effect-impact.tsx`; read-only screen showing how the user's current active side effects are adjusting each daily target; uses `computeBaseTargets()` + `applyAdjustments()` to diff base vs. adjusted values; displays delta badges (increase/decrease) for protein, water, fiber, calories, steps, and active minutes with reason labels
- [x] **Weekly Summary screen + engine (rev 11)** — `app/entry/weekly-summary.tsx` + `lib/weekly-summary.ts`; `computeWeeklySummary()` pure function aggregates 7-day window: weight delta, avg macros/hydration/steps, days logged/active, food noise trend, and all 4 weekly check-in scores; GPT-4o-mini `generateWeeklyInsight()` call generates a narrative paragraph; last summary cached in AsyncStorage; exportable as PDF via `expo-print` + `expo-sharing`
- [x] **AI Insights Store (rev 11)** — `stores/insights-ai-store.ts`; `prefetchAll(health)` fires all 3 Insights tab AI calls (`lifestyle`, `medication`, `progress`) in parallel on first visit; results cached in store to prevent redundant GPT calls on each tab switch; individual loading flags per tab; static fallback strings on error
- [x] **CycleIQ biometric intelligence (rev 12)** — `lib/cycle-intelligence.ts` implements EMA baseline builder (excludes peak/shot days), drug-phase delta application (HRV suppression, RHR elevation at peak), and 5-tier classification engine (`expected_glp1`, `expected_positive`, `mild_unusual`, `concerning`, `insufficient_data`); `stores/biometric-store.ts` persists biometric history and bootstrapping state; `components/cycle-biometric-card.tsx` renders HRV/RHR/Sleep rows with classification badges, tap-to-expand educational panel (`LayoutAnimation.easeInEaseOut`), and long-press AI chat; `components/appetite-forecast-strip.tsx` and `components/metabolic-adaptation-card.tsx` added for Insights tab
- [x] **Education screen fully built (rev 12)** — `app/(tabs)/explore.tsx` overhauled with 5 novel interactive features: (1) Phase-aware personalized "This Week's Focus" card driven by `getEscalationPhase()` + profile context; (2) horizontally-scrollable Myth vs. Fact card row (7 cards, tap-to-reveal with `LayoutAnimation`); (3) Side Effect Decoder — 20-symptom interactive grid with 3-tier categorisation (Expected/Monitor/Call Doctor), filter bar, and detail panel; (4) collapsible "When to Call Your Doctor" safety card with 9 red-flag warning signs; (5) article library from Supabase `articles` table; 7 deep-dive accordion sections (3 new: Injection Technique & Storage, Mental Health & Food Noise, expanded Nutrition/FAQ); `supabase/migrations/20260318_articles.sql` creates `articles` table + seeds 10 evidence-based full-length articles
- [x] **Biometric card tap-to-expand (rev 12)** — `CycleBiometricCard` adds `onPress` → `LayoutAnimation.easeInEaseOut` expand toggle; collapsed state shows `↓ Details` chevron + `"Tap for details · Hold for AI"` hint; expanded panel explains baseline methodology (EMA, eligible day count), per-metric GLP-1 pharmacological context (HRV suppression, RHR elevation, sleep), 5-badge classification guide, and "Ask AI" button; long-press AI chat preserved unchanged

### In Progress / Partially Done

- [ ] Insights screen — wire real data to all cards (currently mock/hardcoded)
- [ ] Home screen — focus cards currently use HealthContext seed data; wire to live log store
- [ ] Tab bar — rename `log` → `insights`, `explore` → `education`

### Not Started

- [ ] Apple Health live reads — wire `@kingstinct/react-native-healthkit` HRV/sleep/steps once permission granted (currently seed data in HealthContext)
- [ ] Weight logging wired to Progress tab charts
- [ ] Water / fiber / steps tracking (live, not seed data)
- [ ] Barcode scanning result display refinement
- [ ] Notification system (injection reminders, daily check-in, craving-day alerts)
- [ ] Photo-based food recognition full pipeline polish
- [ ] Supabase profile persistence (currently in-memory — needs native rebuild or SecureStore)

---

## 11. Planned Integrations

| Integration | Purpose | Library / Service | Status |
|---|---|---|---|
| Health data (steps, HRV, sleep) | Apple Health live reads | `@kingstinct/react-native-healthkit` | ⚠️ Permission toggle wired; live data reads not yet surfaced to UI |
| Garmin Connect | Wellness data sync (steps, calories, sleep, HR, weight) | `lib/garmin.ts` + `stores/garmin-store.ts` + 3 Edge Functions | ✅ Built |
| Barcode scanning | Food product lookup | `expo-camera` + USDA FoodData Central | ✅ Built |
| Food database | Nutritional info lookup | USDA FoodData Central (`lib/usda.ts`) | ✅ Built |
| AI food description | Text parsing via GPT-4o-mini | `lib/openai.ts` — `parseFoodDescription` | ✅ Built |
| AI food photo | Photo analysis via GPT-4o-mini vision | `lib/openai.ts` — `callGPT4oMiniVision` | ✅ Built |
| AI coaching | Dynamic insights, coach notes, log insights, weekly summary | `lib/openai.ts` | ✅ Built |
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

*This document reflects the state of the codebase as of March 16, 2026 (rev 11). It should be updated as features are built and decisions are made.*
