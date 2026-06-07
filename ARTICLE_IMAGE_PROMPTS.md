# Education Article Artwork — Generation Prompts

Goal: replace the dark photorealistic oil-painting covers with **flat, cute vector
illustrations on solid pastel backgrounds**, matching the reference Insights cards.

## How the code uses these images

- Each article has a `bgColor` in `constants/articles.ts`. The card and the detail
  header are painted that exact color, and the illustration sits on top.
- **The illustration's background MUST be that same hex**, full-bleed, so there's no
  visible seam between the image and the card. Generate on the specified hex (or pure
  white and recolor) — do NOT leave a white border, drop shadow, or canvas edge.
- Export **square** (illustrations are shown square: 1:1). 1024×1024 is plenty.
- Save as PNG, overwrite the existing files in `assets/images/articles/` with the
  **exact same filenames** (listed below). No code changes needed after that.

## Shared style guide — paste this into every prompt

> Flat vector illustration, modern cute editorial style, simple rounded shapes, soft
> minimal flat shading, friendly and approachable, centered single subject with
> generous padding around it, no text, no words, no letters, no UI, no border, no
> drop shadow, no gradient background — solid flat background color {HEX}. Subtle
> warm orange accent (#FF742A) used sparingly. Clean, calm, premium health-app feel.

Keep the **subject centered with padding** — the card crops slightly and the detail
view shows it whole, so don't let the subject touch the edges.

---

## The 6 prompts

### 1. `glp1-how-they-work.png` — "How GLP-1s Work"
**Background `#E6E3FB` (soft periwinkle).**
> {style guide with HEX=#E6E3FB} Subject: a friendly, simplified GLP-1 injection pen
> standing upright, with a few small sparkles and a tiny abstract molecule/dot motif
> floating beside it to suggest a hormone signal. Soft periwinkle background.

### 2. `managing-side-effects.png` — "Your First Weeks"
**Background `#FBE3EC` (soft pink).**
> {style guide with HEX=#FBE3EC} Subject: a calm, rounded stomach/belly character with
> a gentle smile, soothed by a sprig of mint and a slice of ginger beside it. Cozy,
> reassuring mood. Soft pink background.

### 3. `protein-priority.png` — "The Protein Priority"
**Background `#FBEED0` (butter yellow).**
> {style guide with HEX=#FBEED0} Subject: a simple plate with a salmon fillet and a
> halved boiled egg, a couple of almonds beside it. Wholesome and clean. Butter-yellow
> background.

### 4. `staying-hydrated.png` — "Staying Hydrated"
**Background `#D9EDFB` (sky blue).**
> {style guide with HEX=#D9EDFB} Subject: a tall glass of water with a single large
> water droplet above it and a couple of small bubbles. Fresh and light. Sky-blue
> background.

### 5. `exercise-on-glp1s.png` — "Movement That Matters"
**Background `#D9F2E3` (mint green).**
> {style guide with HEX=#D9F2E3} Subject: a single friendly dumbbell with a small
> motion/energy swoosh, or a minimal figure mid-stretch. Energetic but calm. Mint-green
> background.

### 6. `what-to-eat.png` — "What to Eat (and What to Rethink)"
**Background `#FBE2D2` (peach).**
> {style guide with HEX=#FBE2D2} Subject: a balanced bowl seen from above — leafy
> greens, cherry tomatoes, avocado, a portion of grain. Colorful and appetizing. Peach
> background.

---

## After generating

1. Drop the 6 PNGs into `assets/images/articles/` (same filenames, overwrite).
2. If any background doesn't perfectly match its `bgColor`, either re-export on the
   exact hex, or tell me the actual hex and I'll update `bgColor` in `articles.ts`.
3. That's it — the Education tab, article detail header, and the home "Article of the
   Day" tile all pick the new art up automatically.

> Tip for consistency across all 6: generate them in one session, reuse the exact same
> style-guide sentence, and only swap the subject + background hex. If your tool
> supports a style/seed reference, lock it after image #1 so the line weight and shading
> stay identical.
