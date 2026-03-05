# GLP-1 Companion App — Software Design Document

**Project:** TitraHealthAPPdemo
**Platform:** iOS / Android (React Native + Expo)
**Last Updated:** March 5, 2026

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Navigation Structure](#4-navigation-structure)
5. [Design System](#5-design-system)
6. [Screens](#6-screens)
   - [Home](#61-home-screen)
   - [Insights](#62-insights-screen)
   - [Education](#63-education-screen)
   - [Add Entry Sheet](#64-add-entry-sheet)
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
│   ├── _layout.tsx              # Root Stack navigator + ThemeProvider
│   ├── modal.tsx                # Generic modal screen
│   └── (tabs)/
│       ├── _layout.tsx          # Tab navigator + CustomTabBar + FAB + AddEntrySheet
│       ├── index.tsx            # Home screen (dashboard)
│       ├── log.tsx              # Insights screen (3-tab: Medication / Lifestyle / Progress)
│       └── explore.tsx          # Education screen (placeholder)
├── components/
│   ├── add-entry-sheet.tsx      # FAB-triggered bottom sheet for all logging
│   ├── hello-wave.tsx           # (Expo boilerplate, unused)
│   ├── haptic-tab.tsx           # Haptic-feedback tab button
│   ├── external-link.tsx        # Utility link component
│   ├── parallax-scroll-view.tsx # Parallax header scroll
│   ├── themed-text.tsx          # Theme-aware Text
│   ├── themed-view.tsx          # Theme-aware View
│   └── ui/
│       ├── collapsible.tsx      # Expand/collapse section
│       ├── icon-symbol.tsx      # Cross-platform icon bridge
│       └── icon-symbol.ios.tsx  # iOS SF Symbols version
├── contexts/
│   └── tab-bar-visibility.tsx   # Scroll-aware tab bar hide/show (Animated.spring)
├── constants/
│   └── theme.ts                 # Color tokens + Font definitions
├── hooks/
│   ├── use-color-scheme.ts
│   ├── use-color-scheme.web.ts
│   └── use-theme-color.ts
└── assets/
    └── images/
```

### Key Architectural Decisions

- **File-based routing via Expo Router** — screens map directly to files under `app/`. Deep linking and URL handling are automatic.
- **AddEntrySheet rendered at tab layout level** — the sheet is a sibling of `<Tabs>`, not a child of any tab screen. This allows it to overlay the entire UI including the nav bar.
- **Scroll-aware tab bar** — `TabBarVisibilityProvider` in `contexts/tab-bar-visibility.tsx` exposes an `onScroll` handler that uses `Animated.spring` to slide the tab bar off-screen when scrolling down and restore it when scrolling up.
- **No global state library (yet)** — all state is local `useState`. A state management solution (Zustand recommended) will be needed when real data is introduced.
- **No backend / persistence layer yet** — all data is hardcoded/static. A data layer decision is pending (see Section 11).

---

## 4. Navigation Structure

```
Root Stack
└── (tabs)                        ← No header
    ├── index       [Home]
    ├── log         [Insights]    ← Rename to insights.tsx pending
    └── explore     [Education]   ← Rename to education.tsx pending

Overlays (rendered outside tab navigator, managed by tab layout state):
└── AddEntrySheet                 ← Modal, slide animation, transparent
```

### Custom Tab Bar

The default React Navigation tab bar is replaced with a custom `CustomTabBar` component that renders:

1. **Glass Pill** — frosted glass capsule (`BlurView` intensity 75, light tint) containing the three tab icon buttons. The active tab shows a terracotta `#D67455` dot indicator below the icon.
2. **FAB** — a floating circular button to the right of the pill, rendered with `BlurView` + a terracotta overlay. Toggles between `add` and `close` icons. Opens/closes `AddEntrySheet`.

Both elements are positioned `absolute` and float over the scrollable content. Tab screens apply `paddingBottom: 120` to prevent content from hiding under the bar.

### Scroll-Aware Behavior

The tab bar auto-hides when the user scrolls down and reappears on scroll up. Driven by `useTabBarVisibility()` hook — each scroll-enabled screen passes `onScroll` to its `ScrollView`. The animation uses `Animated.spring` for a fluid feel.

---

## 5. Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `TERRACOTTA` | `#D67455` | Primary brand — FAB, active icons, bullets, accents |
| `DARK` | `#1C0F09` / `#1A1A1A` | Primary body text (slight variation across files) |
| App Background | `#F0EAE4` | Warm linen/off-white app background |
| Score Badge Green | `#2B9450` | Positive progress badges |
| Score Badge Red | `#DC3232` | Negative/deficit indicators |
| Muted Gray | `#888888` / `#AAAAAA` | Secondary labels, timestamps |

### Glassmorphism Pattern

Every card in the app uses a consistent glass treatment:

```
Container (glassShadow + borderRadius)
└── View style cardWrap + cardBody (overflow: hidden)
    └── BlurView (intensity 55–80, tint: "light") — absolute fill
        └── rgba(255,255,255, 0.42) overlay — absolute fill
            └── GlassBorder helper — absolute, pointer-events none
                ├── borderTopColor:    rgba(255,255,255, 0.80)  ← strong highlight
                ├── borderLeftColor:   rgba(255,255,255, 0.55)
                ├── borderRightColor:  rgba(255,255,255, 0.18)
                └── borderBottomColor: rgba(255,255,255, 0.10) ← subtle fade
```

`GlassBorder` is currently duplicated inline in `index.tsx`, `add-entry-sheet.tsx`, and `log.tsx`. It should be extracted to `components/ui/glass-border.tsx` and shared.

### Typography

| Usage | Weight | Letter Spacing |
|---|---|---|
| Display numbers (score, weight) | `800` | `-1` to `-1.5` |
| Section headings | `700`–`800` | `0` to `0.5` |
| Card titles | `700` | `0` |
| Uppercase labels / pills | `700` | `1.5`–`3.5` |
| Body text | `500`–`600` | `0` |
| Timestamps / muted | `500` | `0` |

Font family: System fonts (SF Pro Rounded on iOS via `constants/theme.ts`). No custom fonts loaded.

### Shadow Style (`glassShadow`)

```typescript
{
  shadowColor: '#1A1A1A',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 24,
  elevation: 8,  // Android
}
```

### Status / Impact Colors

Used for metric change badges and log entry impact tags:

```typescript
const statusStyle = {
  positive: { bg: 'rgba(43,148,80,0.12)',   text: '#2B9450' },
  negative: { bg: 'rgba(220,50,50,0.10)',   text: '#DC3232' },
  neutral:  { bg: 'rgba(150,150,150,0.10)', text: '#888888' },
};
```

---

## 6. Screens

### 6.1 Home Screen

**File:** `app/(tabs)/index.tsx`
**Status:** Built (static/hardcoded data), Apple Liquid Glass aesthetic

The Home screen is a vertically scrollable daily dashboard with scroll-aware tab bar. It consists of four main sections:

#### Header

- Large bold date: e.g., `"October 24"`
- Uppercase subtitle: `"SHOT DAY"` (or neutral day label)

#### Lifestyle Effectiveness Score Card

- Terracotta glass card with triple concentric rings (`ScoreRings` — inline component)
- Central score number (0–100), e.g., `85`
- Two stat columns below the rings:
  - Exercise: `240 / 600 min`
  - Stand: `160 / 600 min`
- **Score influences:** Protein intake, hydration, exercise, rest/recovery

#### Insights Card

- White frosted glass card (`InsightsCard` — inline component)
- Title: `"Insights"`
- Phase label pill: e.g., `"SHOT PHASE"`
- Bullet recommendations: e.g., `"Increase protein by 20g today"`, `"Drink 2 more liters of water"`
- Footer note about current medication phase

#### Today's Focuses

- Vertical list of focus cards (`FocusCard` — inline component, hardcoded: `"High Protein Meal"`, `"15 min Walk"`)
- Each card: terracotta icon + label + green `"+X% Score"` badge
- Will be driven by user data and daily logic once data layer exists

---

### 6.2 Insights Screen

**File:** `app/(tabs)/log.tsx` *(rename to `insights.tsx` pending)*
**Status:** Built (static/hardcoded data) — all 3 tabs fully rendered

The Insights screen has a glass segmented control at the top (Medication | Lifestyle | Progress). Each tab renders a full set of cards with hardcoded data. A collapsible **Recent Logs** card appears at the bottom of every tab.

#### Shared Components (used across all 3 tabs)

| Component | Description |
|---|---|
| `GlassBorder` | Directional glass border overlay (same as Home/Sheet) |
| `RecentLogsCard` | Collapsible card showing historical log entries for the active tab. Collapsed by default. Expand/collapse driven by `LayoutAnimation.Presets.easeInEaseOut`. Each entry shows: icon, title, timestamp, detail line, and a colored impact tag (`statusStyle`). |

#### Medication Tab

| Component | Description |
|---|---|
| `MedAIInsightsCard` | AI Insights banner — adherence %, metabolic response status |
| `MedLevelChartCard` | 7-day line chart of estimated GLP-1 level in body. Custom SVG-style view (absolute-positioned lines + dots, no charting library). Shows "Optimal / In Range" badge. |
| Injection Details grid | 2×2 `InjectionCard` grid: Last Site, Rotate To, Last Dosage, Next Injection |
| `RecentLogsCard` | 3 injection log entries (Ozempic 0.5mg, 0.5mg, 0.25mg with site, batch, adherence impact) |

#### Lifestyle Tab

| Component | Description |
|---|---|
| `AIInsightsCard` | AI Insights banner — protein and hydration deficit warning |
| Metrics row | 2-column `MetricCard` row: Calories Burned (ring indicator) + Daily Steps (ring indicator) |
| Daily Metrics grid | 2×2 `DailyMetricCard` grid: Protein, Fiber, Hydration, Carbs — each with icon, value, change badge |
| `RecentLogsCard` | 4 lifestyle entries (Cheeseburger, Greek Yogurt Bowl, Morning Walk, Water Intake) |

#### Progress Tab

| Component | Description |
|---|---|
| `ProgAIInsightsCard` | AI Insights banner — on-track message with goal date |
| `WeightChartCard` | Weight journey line chart with 4-period toggle (7D / 30D / 90D / 1Y). Custom chart (no charting library). Shows start label, current dot with halo ring, goal/current annotation. |
| Stats grid | 2-column `ProgressStatCard` grid: Current BMI (with down badge) + To Goal % (with inline progress bar) |
| Weight Timeline section | `WeightTimelineCard` — 3-milestone timeline: Starting Weight, Current Weight, Est. Goal Weight |
| `RecentLogsCard` | 3 weight log entries with BMI and goal progress impact |

---

### 6.3 Education Screen

**File:** `app/(tabs)/explore.tsx` *(rename to `education.tsx` pending)*
**Status:** Expo boilerplate — content not yet designed

Planned content areas:
- GLP-1 mechanism of action (how the medication works)
- Nutrition guidance specific to GLP-1 users (high-protein, fiber, anti-nausea)
- Injection technique and site rotation best practices
- Managing common side effects
- Lifestyle optimization tips (meal timing, hydration, sleep)

Content format TBD: static articles, interactive cards, or video-linked tiles.

---

### 6.4 Add Entry Sheet

**File:** `components/add-entry-sheet.tsx`
**Status:** Built (UI complete, no actions wired up)

A bottom sheet modal triggered by the FAB. Slides up from the bottom with a semi-transparent backdrop.

#### Layout

```
Backdrop (dismiss on tap)
└── Glass Sheet (top-rounded corners)
    ├── Drag Handle
    ├── Title: "Add Entry"
    ├── Subtitle
    ├── Dashed Divider (blue tint)
    ├── 3-Column Grid (9 items)
    └── Nav Bar Replica (glass pill + FAB ×)
```

#### Grid Items

| Label | Icon Source | Icon Name |
|---|---|---|
| DESCRIBE FOOD | MaterialIcons | `restaurant` |
| LOG INJECTION | FontAwesome5 | `syringe` |
| CAPTURE FOOD | Ionicons | `camera-outline` |
| SCAN FOOD | Ionicons | `barcode-outline` |
| ASK AI | Custom (terracotta sphere) | — |
| SEARCH FOOD | Ionicons | `search-outline` |
| LOG WEIGHT | MaterialCommunityIcons | `scale-bathroom` |
| SIDE EFFECTS | Ionicons | `warning-outline` |
| LOG ACTIVITY | MaterialIcons | `directions-run` |

The `ASK AI` button uses a custom rendered orb (terracotta sphere with specular highlight), not a standard icon.

#### Nav Bar Replica

The sheet renders a pixel-matched copy of the floating glass pill + FAB at its bottom edge. This creates a seamless visual transition where the sheet appears to sit directly above the persistent nav bar.

---

## 7. Data Models

> All fields marked with `*` are not yet implemented — these are planned schemas.
> The `LogEntry` type below **is** implemented in `log.tsx` as hardcoded mock data.

### LogEntry (implemented — mock data only)

```typescript
type LogEntry = {
  id: string;
  timestamp: string;       // e.g. "Today, 12:34 PM"
  title: string;           // e.g. "Cheeseburger"
  details: string;         // e.g. "520 cal · 28g protein · 2g fiber · 40g carbs"
  impact: string;          // e.g. "Updated Protein +28g, Carbs +40g, Fiber +2g"
  impactStatus: Status;    // 'positive' | 'negative' | 'neutral'
  icon: React.ReactElement;
};
```

### User Profile *

```typescript
type UserProfile = {
  id: string;
  name: string;
  heightCm: number;
  startWeight: number;       // lbs or kg
  goalWeight: number;
  startDate: string;         // ISO date
  medicationName: string;    // e.g., "Ozempic", "Wegovy"
  injectionFrequency: 'weekly' | 'biweekly';
  units: 'imperial' | 'metric';
};
```

### Injection Log *

```typescript
type InjectionLog = {
  id: string;
  date: string;              // ISO datetime
  doseMg: number;
  site: InjectionSite;
  notes?: string;
};

type InjectionSite =
  | 'abdomen-left'
  | 'abdomen-right'
  | 'thigh-left'
  | 'thigh-right'
  | 'arm-left'
  | 'arm-right';
```

### Food Log Entry *

```typescript
type FoodEntry = {
  id: string;
  timestamp: string;
  inputMethod: 'search' | 'barcode' | 'photo' | 'describe' | 'ai';
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  servingSize?: string;
};
```

### Daily Log *

```typescript
type DailyLog = {
  date: string;              // YYYY-MM-DD
  waterMl: number;
  stepsCount: number;
  activityMinutes: number;
  weightKg?: number;
  foodEntries: FoodEntry[];
  sideEffects?: SideEffectEntry[];
};
```

### Side Effect Entry *

```typescript
type SideEffectEntry = {
  id: string;
  timestamp: string;
  type: 'nausea' | 'fatigue' | 'constipation' | 'injection-site' | 'other';
  severity: 1 | 2 | 3 | 4 | 5;
  notes?: string;
};
```

### Lifestyle Effectiveness Score *

```typescript
type EffectivenessScore = {
  date: string;
  score: number;             // 0–100
  breakdown: {
    protein: number;         // 0–100 sub-score
    hydration: number;
    exercise: number;
    recovery: number;
  };
};
```

---

## 8. State Management

### Current State

All state is local `useState` within individual components. No global state exists.

| State | Location | Value |
|---|---|---|
| `sheetOpen` | `app/(tabs)/_layout.tsx` | `boolean` — controls AddEntrySheet visibility |
| `activeTab` | `app/(tabs)/log.tsx` (InsightsScreen) | `'medication' \| 'lifestyle' \| 'progress'` |
| `expanded` | `RecentLogsCard` (log.tsx) | `boolean` — collapse state per tab render |
| `activePeriod` | `WeightChartCard` (log.tsx) | `'7D' \| '30D' \| '90D' \| '1Y'` |
| `chartWidth` | `MedLevelChartCard`, `WeightChartCard` | `number` — layout-measured width for chart drawing |
| Tab bar offset | `contexts/tab-bar-visibility.tsx` | `Animated.Value` — scroll-driven show/hide |

### Planned State Architecture

**Recommendation: Zustand** (lightweight, no boilerplate, works well with React Native)

Proposed stores:

```
stores/
├── userStore.ts         # Profile, preferences, auth state
├── logStore.ts          # Daily entries (food, injections, water, weight)
├── insightsStore.ts     # Computed metrics, score breakdown
└── uiStore.ts           # Sheet open state, active tab, loading states
```

### Persistence

- **Local persistence:** `expo-secure-store` (sensitive data) + `AsyncStorage` (general data)
- **Remote sync (future):** REST API or Supabase (see Section 11)

---

## 9. Component Inventory

| Component | File | Status | Notes |
|---|---|---|---|
| `CustomTabBar` | `app/(tabs)/_layout.tsx` | ✅ Complete | Glass pill + FAB + scroll-aware hide/show |
| `TabBarVisibilityProvider` | `contexts/tab-bar-visibility.tsx` | ✅ Complete | Animated.spring scroll handler |
| Home Dashboard | `app/(tabs)/index.tsx` | ✅ Built | Static data, Apple Liquid Glass |
| `AddEntrySheet` | `components/add-entry-sheet.tsx` | ✅ Built | UI only, no actions wired |
| `SegmentedControl` | `app/(tabs)/log.tsx` | ✅ Built | 3-tab glass pill |
| `AIInsightsCard` | `app/(tabs)/log.tsx` | ✅ Built | Lifestyle tab AI banner |
| `MedAIInsightsCard` | `app/(tabs)/log.tsx` | ✅ Built | Medication tab AI banner |
| `ProgAIInsightsCard` | `app/(tabs)/log.tsx` | ✅ Built | Progress tab AI banner |
| `MetricCard` | `app/(tabs)/log.tsx` | ✅ Built | Ring indicator + label |
| `RingIndicator` | `app/(tabs)/log.tsx` | ✅ Built | Circular progress ring (CSS-style) |
| `DailyMetricCard` | `app/(tabs)/log.tsx` | ✅ Built | 2×2 grid metric tile |
| `MedLevelChartCard` | `app/(tabs)/log.tsx` | ✅ Built | 7-day GLP-1 level line chart (custom, no lib) |
| `InjectionCard` | `app/(tabs)/log.tsx` | ✅ Built | Injection detail tile |
| `WeightChartCard` | `app/(tabs)/log.tsx` | ✅ Built | Weight journey line chart, 4-period toggle (custom, no lib) |
| `ProgressStatCard` | `app/(tabs)/log.tsx` | ✅ Built | BMI / goal % stat tile |
| `WeightTimelineCard` | `app/(tabs)/log.tsx` | ✅ Built | 3-milestone weight timeline |
| `RecentLogsCard` | `app/(tabs)/log.tsx` | ✅ Built | Collapsible log history, all 3 tabs |
| `GlassBorder` | `index.tsx`, `add-entry-sheet.tsx`, `log.tsx` | ⚠️ Duplicated ×3 | Extract to `components/ui/glass-border.tsx` |
| `ScoreRings` | (inline in `index.tsx`) | ⚠️ Inline | Extract to `components/score-rings.tsx` |
| `InsightsCard` | (inline in `index.tsx`) | ⚠️ Inline | Extract to `components/insights-card.tsx` |
| `FocusCard` | (inline in `index.tsx`) | ⚠️ Inline | Extract to `components/focus-card.tsx` |
| Education Screen | `app/(tabs)/explore.tsx` | ⬜ Boilerplate | Needs full build |
| `BodyDiagram` | Not yet built | ⬜ Planned | Injection site rotation map |
| `FoodLogForm` | Not yet built | ⬜ Planned | Triggered from AddEntrySheet |
| `InjectionLogForm` | Not yet built | ⬜ Planned | Triggered from AddEntrySheet |

---

## 10. Feature Status

### Completed

- [x] App shell — root layout, routing, tab navigation
- [x] Custom glass pill tab bar with FAB
- [x] Scroll-aware tab bar (auto-hide on scroll down, restore on scroll up)
- [x] Home screen — score card, insights card, focus cards (static data), Apple Liquid Glass aesthetic
- [x] Add Entry Sheet — 9-item grid, glass styling, nav replica
- [x] Insights screen — Medication tab (AI insights, GLP-1 level chart, injection detail grid, recent logs)
- [x] Insights screen — Lifestyle tab (AI insights, calorie/steps rings, daily metrics grid, recent logs)
- [x] Insights screen — Progress tab (AI insights, weight journey chart with period toggle, BMI/goal stats, weight timeline, recent logs)
- [x] Collapsible Recent Logs card — all 3 Insights tabs (hardcoded mock data, smooth LayoutAnimation)

### In Progress / Partially Done

- [ ] Home screen — wire dynamic data to score, insights, focus cards
- [ ] Insights screen — wire real data to all cards (currently all hardcoded)
- [ ] Tab bar — rename `log` → `insights`, `explore` → `education`
- [ ] Extract `GlassBorder` to shared component (currently duplicated in 3 files)

### Not Started

- [ ] Education screen — content structure and articles
- [ ] Food logging flow (all input methods: describe, search, scan, photo, AI)
- [ ] Injection logging form + site rotation logic
- [ ] Weight logging (wire Add Entry sheet → store → Progress tab)
- [ ] Water intake tracking
- [ ] Activity / steps tracking
- [ ] Side effects logging
- [ ] Lifestyle Effectiveness Score computation engine
- [ ] User profile setup / onboarding
- [ ] Data persistence (AsyncStorage / expo-secure-store)
- [ ] Notification system (injection reminders, daily check-in)
- [ ] AI food description parsing
- [ ] Barcode scanning
- [ ] Photo-based food recognition
- [ ] Zustand store setup (userStore, logStore, insightsStore, uiStore)
- [ ] Apple Health / Google Fit integration (steps, weight)

---

## 11. Planned Integrations

| Integration | Purpose | Library / Service |
|---|---|---|
| Health data (steps, weight) | Pull from Apple Health / Google Fit | `expo-health` (HealthKit) |
| Barcode scanning | Food product lookup | `expo-camera` + USDA FoodData API or Open Food Facts |
| Food database | Nutritional info lookup | USDA FoodData Central API or Nutritionix |
| AI food description | Parse text/photo into nutrients | OpenAI Vision API or custom model |
| Charts | Weight trend, macro charts | `victory-native` or `react-native-gifted-charts` (not yet decided — current charts are custom-drawn) |
| Push notifications | Injection reminders, daily tips | `expo-notifications` |
| Local persistence | Offline-first data storage | `@react-native-async-storage/async-storage` |
| Auth (future) | User accounts + cloud sync | Supabase Auth or Clerk |
| Backend (future) | Data sync across devices | Supabase (Postgres + REST) or Firebase |

---

## 12. Open Questions & Future Work

### Design / UX

- What is the exact scoring algorithm for the Lifestyle Effectiveness Score? (weights per metric, normalization)
- Should the Home screen personalize differently based on injection day vs. non-injection day?
- Should water intake use oz or mL — or let the user choose in settings?
- What does an "empty state" look like for a brand new user with no data?
- Should `RecentLogsCard` entries be paginated or infinite-scroll once real data is wired?

### Technical

- Decide on charting library before committing to it for real data — current charts are custom-drawn with absolute-positioned Views (no external lib). `victory-native` (established) vs. `react-native-gifted-charts` (lighter).
- Extract `GlassBorder` into `components/ui/glass-border.tsx` before adding more screens — currently duplicated in `index.tsx`, `add-entry-sheet.tsx`, and `log.tsx`.
- Extract inline components from `index.tsx` (`ScoreRings`, `InsightsCard`, `FocusCard`) to reduce file size.
- Confirm state management approach (Zustand recommended) before wiring any real data.
- Decide on offline-first vs. sync-first architecture for data persistence.
- Determine whether AI food logging (photo/description) is handled client-side or via API call.
- `LayoutAnimation` on Android requires `UIManager.setLayoutAnimationEnabledExperimental(true)` in the app entry point — add this before releasing Android builds.

### Product

- Onboarding flow: what information does the user provide at signup? (medication name, dose, start date, weight, goal)
- Does the app support multiple GLP-1 medications with different dosing schedules?
- Will there be a provider-facing dashboard in the future, or is this purely consumer?
- Should side effects be shared with a care team (HIPAA implications)?
- What is the monetization model — freemium, subscription, or healthcare B2B?

---

*This document reflects the state of the codebase as of March 5, 2026. It should be updated as features are built and decisions are made.*
