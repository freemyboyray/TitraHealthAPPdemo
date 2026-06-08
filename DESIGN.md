# Titra — UI Design System

The single source of truth for how Titra looks and feels. Read this before building or
expanding any screen. When a choice isn't covered here, follow the **North Star** and the
**Principles**, then add the decision back to this doc.

> Inspiration: the "Apple Glass" / iOS-native aesthetic exemplified by apps like Gentler
> Streak — calm, airy, depth-through-softness, one confident visual per surface. We adapt
> those *principles* to the Titra brand (warm orange, our token system, dark **and** light).

---

## North Star

**Calm, editorial, and physical.** Hierarchy comes from size and space, not borders or
color. Every surface is a soft, rounded, lifted card. Each card has exactly one hero idea.
Data is the hero — shown through a distinct, tasteful visualization, qualified in plain
language. Nothing shouts.

## Principles

1. **Depth through softness.** Lift with large-radius corners + diffuse shadows + subtle
   glass/blur. Never with hard 1px borders or heavy strokes.
2. **Restraint.** Whitespace over dividers. Tone over saturation. One accent per surface.
3. **One hero per card.** A card answers one question with one strong visual.
4. **Show real data, label it in words.** Pair the number/chart with a qualitative status
   ("On track", "Below typical", "Excellent").
5. **Squircle everything.** No sharp corners anywhere.
6. **Theme-honest.** Build with tokens (`AppColors`), never hard-coded `#fff`/`#000`, so
   every screen works in dark and light.
7. **Consistency of affordance.** A lock always means premium. A chevron always means
   "there's more". A pill badge always flags status. Don't reinvent these per screen.

---

## Foundations

### Spacing
Use an **8px rhythm**: `4, 8, 12, 16, 20, 24, 32`.
- Screen horizontal padding: **20**.
- Gap between sibling cards/tiles: **12–16**.
- Inner card padding: **16** (compact) / **20** (standard).
- Section → content gap: **14**.

### Corner radius
| Element | Radius |
|---|---|
| Tiles / standard cards | **24** |
| Large hero / recap cards | **26–28** |
| Compact cards, inputs | **20–22** |
| Pills, badges, chips | **999** (full) or 12–13 for rectangular badges |
| Circular icon buttons | full (height/2) |
| Bottom sheets (top corners) | **24** |

### Color
Brand + neutrals come from **`constants/theme.ts` (`AppColors`)** — always read from the
theme, never hard-code. Key tokens: `bg`, `surface`, `cardBg`, `surfaceElevated`,
`textPrimary`, `textSecondary`, `textMuted`, `textLabel`, `orange`, `border`,
`borderSubtle`, `divider`, `glassOverlay`, `heroGradient`, `isDark`.

- **Primary brand:** `colors.orange` (`#FF742A`). Used for primary actions, active states,
  "See All" links, key accents. One per surface.
- **Neutral text ramp:** `textPrimary` → `textSecondary` → `textMuted`. Most UI is neutral;
  color is reserved for meaning.
- **In `createStyles` factories**, derive translucency from `isDark`:
  `const w = (a) => isDark ? \`rgba(255,255,255,${a})\` : \`rgba(0,0,0,${a})\`` — use `w(0.06)`
  for faint fills, `w(0.4)` for muted text, etc.

**Per-metric data colors** (stable identity across the app — same metric, same color):
| Metric | Color |
|---|---|
| Protein | `#E0533A` |
| Hydration / Water | `#2BA7E0` |
| Fiber | `#3AAE5A` |
| Activity / Steps | `#F5972A` |
| Sleep | `#6E73E0` |

**Status ramp** (energy, scores, gauges): `#27AE60` (good) → `#F6CB45` → `#E8960C` →
`#E53E3E` (low). See `energyColor()` in `components/home/focus-tiles.tsx`.

**Pastel tints** for illustrated/content card backgrounds: mint, lavender, peach — low
saturation, used behind illustrations, never behind dense data.

### Typography
System font (SF Pro via `fontFamily: 'System'`). Hierarchy through **size + weight + tight
tracking**, not color.
| Role | Size | Weight | Tracking |
|---|---|---|---|
| Screen title | 28–34 | 800 | -0.5 to -0.8 |
| Card hero headline | 21–30 | 800 | -0.5 to -0.8 |
| Section header | 22 | 700 | -0.3 |
| Card title | 16–18 | 700 | -0.3 |
| Body | 14–16 | 400–500 | 0 |
| Status / descriptor | 13–14 | 400–500 | 0 |
| Eyebrow / pill label | 11–12 | 800 | +0.5 to +1.2, often UPPERCASE |
| Big metric value | 22–34 | 800 | -0.5 |

### Elevation & glass
Three depth tiers: **page → card → sheet/popover**.
- **Cards:** `surface` background + soft shadow (low opacity, large radius). Light theme:
  thin `borderSubtle` + minimal shadow. Dark theme: stronger diffuse shadow, no hard border.
  Use `cardElevation(isDark)` from `constants/theme.ts`.
- **Glass surfaces** (overlays, sheets, the dark entry screens): `expo-blur` `BlurView`
  (intensity ~40–80, themed `blurTint`) + a `glassOverlay` fill + **`GlassBorder`**
  (`components/ui/glass-border.tsx`) for the top-light/bottom-dark edge.
- Shadow recipe (card): `shadowOffset {0, 6}`, `shadowOpacity 0.12–0.18`, `shadowRadius
  14–18`, `elevation 6`.

### Backgrounds
- **Page:** `colors.bg` with an optional faint vertical gradient (`GradientBackground`).
- **Hero/detail headers:** soft **mesh/aurora gradient** — large blurred multi-color blobs
  (use `heroGradient` tokens / `expo-linear-gradient` or layered radial gradients), often
  behind a minimal face or title. Calm, low-contrast, never busy.

---

## Components

### Card / Tile
The atom of the UI. Rounded (24), `surface` bg, soft shadow, inner padding 16–20. Header
row = title (left) + chevron or action (right). One hero visual below. Tap → detail screen.
Reference: `components/home/focus-tiles.tsx`.

### Section header
Bold 22 title on the left; optional **"See All ›"** in `colors.orange` on the right (with a
chevron). Followed by a one-line muted description, then the content row/grid.

### Pill badge & lock badge
- **Status pill** ("NEW", "DONE", "WEEKLY"): rectangular, radius 12–13, bold 11–12 uppercase.
  Black pill for neutral highlight, `orange` for promotional, tinted for status.
- **Lock badge** (premium-gated content): black circle, white lock glyph, top-right of the
  card. Consistent everywhere premium is gated.

### Circular icon button
Back, filters, profile, customize, info. A circle (34–52px) with a translucent/glass fill
(`w(0.06)` or blur), centered lucide icon. Use for all chrome controls.

### Floating tab bar
Pill-shaped, floating above content, glassy/blurred. Each tab = icon + label. Active tab
gets a filled pill background and `orange` icon/label.

### Buttons
- **Primary:** full-width **orange pill** (radius 999, py ~16), white bold label. One per
  screen.
- **Secondary:** quiet text button beneath (muted color), or an outlined pill.

### Bottom sheet (preferences/customize pattern)
White/`surface` sheet, top corners 24, slides up. Optional centered illustration + bold
centered title. List rows = label + control (orange **checkbox** ✓ and/or **drag handle**).
Primary orange pill ("Done") near the bottom, a text action below ("Reset Layout"), and a
muted explanatory footnote. Reference: `CustomizeSheet` in `focus-tiles.tsx` (earlier rev).

### Recap / highlight card
Editorial card for recaps & summaries — **theme-honest** (`surface` fill + `cardElevation`,
never hard white/black). Top row = a **tone pill badge** (`orange` / `neutral` / `positive`)
+ optional `X` dismiss; then a small uppercase **eyebrow** (e.g. "Weekly Summary"), one
**big headline** (26/800), an optional muted caption, an optional **accent slot** for a single
real datum (a delta chip, sparkline, or dots), and an orange **"View ›" CTA**. A faint
`orangeDim` flourish bleeds off the right edge. One hero idea, calm — not a data dump.
Reference: `components/home/recap-card.tsx` (props: `badge`, `tone`, `eyebrow`, `headline`,
`caption`, `accent`, `cta`). Used by the weekly check-in + summary home cards.

### Glass card & chrome button (shared primitives)
- **`GlassCard`** (`components/ui/glass-card.tsx`): the standard theme-honest glass surface —
  `surface` fill + `BlurView` + `glassOverlay` + `GlassBorder` + `cardElevation`. Use this
  instead of re-inlining the blur/overlay/border stack per screen. Props: `radius`, `intensity`.
- **`CircleIconButton`** (`components/ui/circle-icon-button.tsx`): the circular glass chrome
  button (back / close / info). Pass a lucide icon component + `onPress` + `accessibilityLabel`.

### Metric detail screen (data-over-time template)
The standard layout for **any single metric viewed over time** (macros, micros, steps…).
Top-down, no date — the metric *is* the subject. **Description leads, data follows:**
1. **Nav bar** — circular glass back button + centered **metric illustration** (the same
   hand-illustrated `assets/images/cards/*.png` used on the summary cards — *not* a lucide/AI
   glyph) + label. Micros share `micronutrients.png`; unmapped metrics fall back to the lucide icon.
2. **Lead description** — the metric's `about` paragraph is the **first thing read**, in muted
   body text, with **no "About" heading**. (The old bottom "About" card is gone.)
3. **Headline value** — big number (44/800) + unit, then a **status dot + descriptor**
   ("Goal reached · 171 of 87 g").
4. **Range pills** — `7D / 30D / 90D`; active pill tinted with the metric color.
5. **Line+area chart** — smooth line in the metric color, soft area fill, dashed goal line,
   y-ticks, first/mid/last date labels. Graph comes **before** the stats.
6. **Stat grid** — 2×2: Average · Goal hit · Trend · Best streak. Each tile carries a small
   **ⓘ info button** (top-right) that opens a glass explainer modal defining that stat in
   plain language (built per-metric by `statInfo()`, inverse-goal aware).
7. **Learn more** — optional related article links.

Keep it **free/airy**: cards are soft `surface` fills with `cardElevation`, **no hard
borders**; rely on whitespace. Reference: `app/insights/metric/[id].tsx`, driven by the
`SUMMARY_METRICS` registry + per-day history in `lib/metric-history.ts`. To add a metric:
add a `SUMMARY_METRIC` entry (id, color, icon, unit, getValue, about, inverseGoal), its
target in the screen's `targetMap`, and (optionally) a card image in the `METRIC_IMAGE` map
— the whole detail page comes for free.

### Carousel row
Horizontally scrollable row of cards that **bleeds to the screen edges** (negative margin to
cancel the page padding), `snapToInterval`, `decelerationRate="fast"`, next card peeking
(~`screenW − 64`). Use for recaps and content collections. If only one item → render it
full-width, no scroll. Reference: weekly recap row in `app/(tabs)/index.tsx`.

---

## Data visualization patterns

Pick the metaphor that fits the data. **Vary metaphors across a screen** — that variety is
what reads as premium. Never fake data you don't have.

- **Radial glow number** — a big value floating on a radial gradient whose intensity tracks
  progress. For headline metrics (steps, protein). Signature look.
- **Fill bar** — horizontal or vertical track that fills by % in the metric color. For
  goal-based metrics. Lock state shows a lock instead of a fill.
- **Multi-metric capsule panel** — a row of small metric icons, each over a capsule/bar with
  lock states. For a compact "many metrics at a glance" tile.
- **Time-series bars / hypnogram** — vertical bars over a time axis (e.g. sleep stages).
  Only when you actually have the time-resolved data.
- **Organic blob / gauge** — a soft, glossy abstract shape for a single qualitative metric
  (e.g. fitness). Refined and shaded, never a cartoon outline.
- **Battery / segmented gauge** — for energy/readiness; fills in the status-ramp color.

Always pair the visual with a **qualitative descriptor** (see Voice).

---

## Iconography & illustration

- **Icons:** `lucide-react-native`, consistent stroke weight, sized 16–24. Metric icons use
  their per-metric color; chrome icons use neutral `textSecondary`/`textMuted`.
- **Illustrations:** warm, flat, friendly, with small sparkle accents — for content cards,
  empty states, onboarding, and the mascot. Pastel-tinted backgrounds. Keep one consistent
  illustration style; don't mix.
- **Anti-pattern:** do **not** use cartoon object silhouettes (a steak, a shoe) as the
  *data* visualization. Illustrations are for storytelling; data uses the viz patterns above.

## Motion & interaction

- **Subtle and physical.** Entrances fade/scale in (~400–700ms, ease-out). Fills animate up
  to their value on mount (Reanimated). Avoid bouncy or attention-seeking motion.
- **Haptics** on meaningful taps (`expo-haptics`, light impact).
- **Tap targets** ≥ 44px; use `hitSlop` for small chrome icons.

## Voice & microcopy

- **Qualitative over raw numbers** for status: "On track", "Below typical", "Goal reached",
  "Excellent", "Outdated", "No data yet".
- **Warm and second-person:** "Your week, recapped." "You're all checked in this week."
- Short, confident, lowercase-friendly. No jargon, no clinical tone (except medical
  disclaimers, which stay precise).

---

## Anti-patterns (lessons learned)

- ❌ Cartoon object silhouettes as data viz (looks "vibe-coded"). ✅ Use real viz + glow.
- ❌ Hard 1px borders / heavy strokes for separation. ✅ Whitespace + soft shadow.
- ❌ Hard-coded `#fff`/`#000`. ✅ `AppColors` tokens + `w(a)` helper.
- ❌ Faking data you don't have (e.g. a hypnogram from a single number). ✅ Show what's real,
  lock or "No data" the rest.
- ❌ Multiple competing accent colors on one surface. ✅ One accent per surface.
- ❌ Cramming raw ratios everywhere. ✅ Big value + qualitative label; details on tap.

---

## Building a new screen — checklist

1. **Page bg** = `colors.bg` (+ optional `GradientBackground` / mesh hero).
2. **Title** 28–34 / 800, tight tracking.
3. Group content under **section headers** (22/700 + optional "See All ›").
4. Content lives in **rounded cards** (24, `surface`, soft shadow, 16–20 padding).
5. Each card: **one hero visual** + qualitative label; tap → detail.
6. Use **per-metric colors** and **status ramp** consistently.
7. Chrome = **circular glass icon buttons**; primary action = **orange pill**.
8. Premium → **lock badge**; new/flagged → **pill badge**.
9. Everything from **theme tokens**; verify in **dark and light**.
10. Subtle **entrance/fill animation**; haptics on key taps.
11. Run `tsc` clean; check the screen on a real device for spacing/contrast.

## Code mapping

| Concept | Where |
|---|---|
| Color tokens (`AppColors`), dark+light palettes | `constants/theme.ts` |
| Card elevation / shadow helper | `cardElevation()` in `constants/theme.ts` |
| Glass edge | `components/ui/glass-border.tsx` |
| Glass card / chrome button | `components/ui/glass-card.tsx`, `components/ui/circle-icon-button.tsx` |
| Recap / highlight card | `components/home/recap-card.tsx` |
| Check-in domain identity (label/icon/color/status) | `constants/checkin-domains.ts` |
| Theme access | `useAppTheme()` (`contexts/theme-context.tsx`) |
| Home tiles (glow number, bars, battery) | `components/home/focus-tiles.tsx` |
| Recap / highlight card | `components/home/recap-card.tsx` |
| Page gradient / hero | `components/ui/gradient-background.tsx` |
| Lifestyle metric data layer | `hooks/use-lifestyle-metrics.ts` |
| Tile-visibility preference | `homeFocusTiles` in `stores/preferences-store.ts` |

---

*Keep this doc alive: when you introduce a new pattern, token, or component, document it
here so the next screen stays consistent.*
