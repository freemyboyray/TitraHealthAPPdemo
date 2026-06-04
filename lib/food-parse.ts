// Shared text → dishes parser used by every "describe what you ate" surface
// (the describe sheet, log-food describe mode, the review screen's
// re-describe fallback). One prompt, one place.

import { callOpenAI, UsageLimitError, DataConsentError } from './openai';
import type { ParsedDish } from '../stores/food-task-store';

// Map a parse failure to a message that reflects what actually went wrong,
// instead of always blaming the user's wording. Shared by every describe
// surface so they stay consistent.
export function describeErrorMessage(err: unknown): string {
  if (err instanceof UsageLimitError) {
    return "You've reached today's free food logging limit. Upgrade to Titra Pro for unlimited logging.";
  }
  if (err instanceof DataConsentError) {
    return 'Enable “AI Data Processing” in Settings › Privacy & Data to use this.';
  }
  if (err instanceof Error && err.message === 'AUTH_EXPIRED') {
    return 'Your session expired. Please sign out and back in.';
  }
  return "Couldn't read that — try being more specific.";
}

export const PARSE_SYSTEM = `You are a food logging assistant. Read the user's input and identify the distinct DISHES they ate.
A "dish" is one thing eaten as a unit — a sandwich, a bowl, a salad, a drink, a piece of fruit.
Group the ingredients that make up a single dish into its "components" (e.g. a bacon, egg & cheese bagel is ONE dish with four components).
Keep clearly separate foods as separate dishes (e.g. a sandwich AND a coffee AND an apple is THREE dishes).
Give each dish a short natural name a person would say.
For each component:
- "item": a SINGULAR, specific FOOD NAME ONLY (e.g. "scrambled egg", not "eggs" or "2 eggs"). NEVER include conversational words, pronouns, or filler — the input may be spoken, so strip phrases like "I had", "actually", "I think", "let me see". "I had them poached actually" must become "poached egg".
- "quantity": how many identical units there are (default 1). "3 apples" is ONE component with quantity 3 — never three separate components.
- "estimated_g": grams of ONE unit if not specified.
Return ONLY a valid JSON object with a single "dishes" array, no other text:
{"dishes":[{"name":"Bacon Egg & Cheese Bagel","components":[{"item":"bacon","quantity":2,"estimated_g":15},{"item":"scrambled egg","quantity":1,"estimated_g":50},{"item":"american cheese","quantity":1,"estimated_g":20},{"item":"plain bagel","quantity":1,"estimated_g":85}]}]}`;

// Parse a free-text meal description into validated ParsedDish[]. Throws if the
// model returns nothing usable so callers can show an error.
export async function parseDescriptionToDishes(text: string): Promise<ParsedDish[]> {
  const raw = await callOpenAI(
    [{ role: 'user', content: `User input: "${text}"` }],
    PARSE_SYSTEM,
    'food_parse',
    true, // JSON mode → proxy counts this as food_parse, not ai_chat
  );
  // JSON mode returns an object {"dishes":[...]}; tolerate a bare array or a
  // wrapped object in case the model strays.
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/) ?? raw.match(/\[[\s\S]*\]/);
    if (!m) throw new Error('No JSON in response');
    parsed = JSON.parse(m[0]);
  }
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.dishes) ? parsed.dishes : [];
  const dishes: ParsedDish[] = list
    .filter((d: any) => d && Array.isArray(d.components) && d.components.length > 0)
    .map((d: any) => ({ name: d.name || 'Meal', components: d.components }));
  if (dishes.length === 0) throw new Error('No food items found');
  return dishes;
}
