// VERIFICATION (not a committed unit test — see filename .verify).
// Drives the REAL resolve logic against LIVE FatSecret serving data:
//   - lib/supabase is mocked ONLY to turn supabase.functions.invoke into a real
//     HTTP call to the deployed `fatsecret` edge function (verify_jwt:false).
//     The DATA is live, not hard-coded.
//   - getFatSecretFood (real) → buildServingOptions (real, sorts smallest-first)
//   - pickServingForEstimate (real, the changed selection logic)
// Then compares OLD behavior (serving_options[0] + parsed count) vs NEW for the
// exact case in the bug report: "waffles and eggs".

jest.mock('../../lib/supabase', () => ({
  supabase: {
    functions: {
      // Forwards invoke() to the real edge functions. GET (fatsecret, query in
      // the path) and POST with a JSON body (openai-proxy) are both real.
      // Reads env inside the factory (jest forbids closing over outer scope).
      invoke: async (path: string, opts?: { body?: unknown; method?: string }) => {
        const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
        // Both functions call verifyAuth → need a real user JWT.
        // FS_ACCESS_TOKEN is minted by a password-grant sign-in before the run.
        const token = process.env.FS_ACCESS_TOKEN || anon;
        const hasBody = opts?.body !== undefined;
        const res = await fetch(`${url}/functions/v1/${path}`, {
          method: hasBody ? 'POST' : 'GET',
          headers: { Authorization: `Bearer ${token}`, apikey: anon, 'Content-Type': 'application/json' },
          body: hasBody ? JSON.stringify(opts!.body) : undefined,
        });
        const data = await res.json();
        return { data, error: null };
      },
    },
  },
}));

// callEdge / callOpenAIProxy gate on consent — grant both in the mock.
jest.mock('../../stores/preferences-store', () => ({
  usePreferencesStore: { getState: () => ({ foodDbConsent: true, aiDataConsent: true }) },
}));

import { searchFatSecret, getFatSecretFood, type FoodResult } from '../../lib/fatsecret';
import { pickServingForEstimate } from '../../lib/food-macros';
import { parseDescriptionToDishes } from '../../lib/food-parse';

// Representative model parse for "waffles and eggs". The serving DATA below is
// live; these per-unit gram estimates stand in for what parseDescriptionToDishes
// returns (the bug was in CONSUMING serving options, not in these numbers).
const CASES = [
  { query: 'waffle', label: 'waffles', quantity: 1, estimated_g: 75 },
  { query: 'egg',    label: 'eggs',    quantity: 2, estimated_g: 50 },
];

// Find a real DB food that actually has multiple serving options (so there's a
// choice to get wrong) — same shape the resolver would land on.
async function firstFoodWithOptions(query: string): Promise<FoodResult | null> {
  const results = await searchFatSecret(query);
  for (const r of results.slice(0, 8)) {
    const detail = await getFatSecretFood(r.fdcId);
    if (detail && (detail.serving_options?.length ?? 0) > 1) return detail;
  }
  return null;
}

const cal = (food: FoodResult, grams: number) => Math.round((food.calories / 100) * grams);

// Requires a live user JWT (FS_ACCESS_TOKEN) + network. Skipped in CI so the
// normal `npm test` run doesn't fail; run on demand after minting a token.
const live = process.env.FS_ACCESS_TOKEN ? describe : describe.skip;

live('portion fix — live FatSecret data', () => {
  jest.setTimeout(60000);

  for (const c of CASES) {
    it(`${c.label}: preserves model grams, no double-count`, async () => {
      const food = await firstFoodWithOptions(c.query);
      expect(food).toBeTruthy();
      const opts = food!.serving_options!;
      const totalModelG = c.quantity * c.estimated_g;

      // OLD behavior: snap to smallest serving (opts sorted smallest-first),
      // pin the parsed count on top.
      const old = opts[0];
      const oldGrams = c.quantity * old.grams;

      // NEW behavior: the real shipping helper.
      const nu = pickServingForEstimate(opts, c.estimated_g, c.quantity)!;
      const newGrams = parseFloat(nu.qty) * nu.unitGrams;

      console.log(`\n=== ${c.label.toUpperCase()} (live: "${food!.name}"${food!.brand ? ' / ' + food!.brand : ''}) ===`);
      console.log(`  serving_options:`, opts.map(o => `${o.label}`).join('  |  '));
      console.log(`  model said: ${c.quantity} × ${c.estimated_g}g = ${totalModelG}g`);
      console.log(`  OLD: "${c.quantity} × ${old.label}" -> ${oldGrams}g, ${cal(food!, oldGrams)} cal`);
      console.log(`  NEW: "${nu.qty} × ${nu.unitLabel}" -> ${newGrams}g, ${cal(food!, newGrams)} cal`);

      // The fix's contract: displayed grams track the model's estimate, not the
      // database's smallest serving. Allow one serving-unit of rounding slack.
      const maxUnit = Math.max(...opts.map(o => o.grams));
      expect(Math.abs(newGrams - totalModelG)).toBeLessThanOrEqual(
        Math.min(nu.unitGrams, maxUnit),
      );
    });
  }

  // PROBE: the literal "2 × 2 eggs" pathology needs a DB entry whose serving
  // LABEL bakes in a count (e.g. "2 eggs", "2 large"). Hunt the live egg
  // results for one and show OLD (count × count) vs NEW (count derived).
  it('PROBE: count-baked serving label does not double-count', async () => {
    const results = await searchFatSecret('eggs');
    const countLabel = /\b([2-9]|\d{2,})\b/; // leading multi-count in label
    let found: { food: FoodResult; opt: { label: string; grams: number } } | null = null;
    for (const r of results.slice(0, 12)) {
      const detail = await getFatSecretFood(r.fdcId);
      const opts = detail?.serving_options ?? [];
      // serving_options[0] is what OLD code grabbed (smallest-first)
      const smallest = opts[0];
      if (smallest && countLabel.test(smallest.label.replace(/\(\d+g\)/, ''))) {
        found = { food: detail!, opt: smallest };
        break;
      }
    }
    if (!found) {
      console.log('\n=== EGG DOUBLE-COUNT PROBE: no count-baked serving in live results today (varies by FatSecret index) ===');
      return; // not a failure — depends on live DB contents
    }
    const { food, opt } = found;
    const quantity = 2, estimated_g = 50;
    const oldGrams = quantity * opt.grams; // OLD: quantity × a serving that already encodes a count
    const nu = pickServingForEstimate(food.serving_options, estimated_g, quantity)!;
    const newGrams = parseFloat(nu.qty) * nu.unitGrams;
    console.log(`\n=== EGG DOUBLE-COUNT PROBE (live: "${food.name}"${food.brand ? ' / ' + food.brand : ''}) ===`);
    console.log(`  serving_options:`, food.serving_options!.map(o => o.label).join('  |  '));
    console.log(`  model said: ${quantity} × ${estimated_g}g = ${quantity * estimated_g}g`);
    console.log(`  OLD: "${quantity} × ${opt.label}" -> ${oldGrams}g  (count × a serving that already means many)`);
    console.log(`  NEW: "${nu.qty} × ${nu.unitLabel}" -> ${newGrams}g`);
    // NEW must not exceed the model's intent the way OLD does.
    expect(newGrams).toBeLessThan(oldGrams);
  });

  // FULL PIPELINE — nothing assumed: the REAL model parses "waffles and eggs"
  // (live openai-proxy), and its ACTUAL quantity/estimated_g feed the live
  // serving selection. Answers "does the model itself underestimate?".
  it('END-TO-END: real model parse → live serving selection', async () => {
    const dishes = await parseDescriptionToDishes('waffles and eggs');
    console.log('\n=== REAL MODEL PARSE of "waffles and eggs" ===');
    for (const d of dishes) {
      for (const c of d.components as { item: string; quantity?: number; estimated_g: number }[]) {
        const quantity = c.quantity ?? 1;
        const totalModelG = quantity * c.estimated_g;
        console.log(`\n  • model: "${c.item}" → quantity ${quantity} × ${c.estimated_g}g = ${totalModelG}g`);

        const food = await firstFoodWithOptions(c.item);
        if (!food) { console.log(`    (no DB match with options for "${c.item}")`); continue; }
        const nu = pickServingForEstimate(food.serving_options, c.estimated_g, quantity)!;
        const newGrams = parseFloat(nu.qty) * nu.unitGrams;
        console.log(`    DB "${food.name}" options: ${food.serving_options!.map(o => o.label).join(' | ')}`);
        console.log(`    FINAL (NEW): "${nu.qty} × ${nu.unitLabel}" -> ${newGrams}g, ${cal(food, newGrams)} cal`);
      }
    }
    expect(dishes.length).toBeGreaterThan(0);
  });
});
