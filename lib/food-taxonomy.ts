// Local food taxonomy for Top Contributors grouping.
//
// FatSecret's own sub-categories are sparse (frequently null on branded /
// restaurant items) and only arrive on the detail call, so we derive grouping
// locally from the ingredient label instead. This gives 100% coverage and a
// stable, meaningful set of buckets. It's a heuristic keyword map — tune freely.

// Cooking-method / prep / size adjectives stripped during normalization so that
// "fried egg", "scrambled eggs", and "egg" all collapse to a single key.
const STOPWORDS = new Set([
  'grilled', 'fried', 'baked', 'roasted', 'boiled', 'steamed', 'sauteed', 'sautéed',
  'scrambled', 'poached', 'seared', 'broiled', 'braised', 'smoked', 'toasted',
  'raw', 'fresh', 'frozen', 'cooked', 'dried', 'canned',
  'sliced', 'diced', 'chopped', 'shredded', 'minced', 'ground', 'mashed', 'crushed',
  'whole', 'organic', 'plain', 'lean', 'extra', 'large', 'small', 'medium', 'mini',
  'hot', 'cold', 'warm', 'boneless', 'skinless', 'unsalted', 'salted', 'roast',
  'with', 'and', 'of', 'the', 'a', 'in', 'no', 'low', 'reduced',
]);

// Naive singularization good enough for grouping ("carrots"→"carrot",
// "berries"→"berry", "tomatoes"→"tomato"). Leaves words like "hummus" alone.
function singularize(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (/(ses|shes|ches|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith('oes')) return word.slice(0, -2);
  if (word.endsWith('ss')) return word;            // glass, grass
  if (word.endsWith('us')) return word;            // asparagus, hummus, citrus
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/**
 * Normalize an ingredient/food label into a stable grouping key.
 * Lowercases, drops parentheticals/brand noise, strips prep adjectives, and
 * singularizes the remaining words. Returns a lowercase key.
 */
export function normalizeIngredient(label: string): string {
  if (!label) return 'unknown';
  let s = label.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, ' ');      // drop "(100g)" etc.
  s = s.replace(/[,/].*$/, ' ');          // keep only the head before a comma/slash
  s = s.replace(/[^a-z\s-]/g, ' ');       // strip digits/punctuation
  const words = s
    .split(/[\s-]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(singularize);
  const key = words.join(' ').trim();
  return key || label.toLowerCase().trim();
}

/** Title-case a normalized key for display ("egg" → "Egg"). */
export function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Conversational / filler words that never appear in a real food name. Used to
// detect when a voice/describe parse leaked a spoken phrase into a component
// label (e.g. "I had them poached actually") so we can fall back to the matched
// food name ("Poached Egg") for display + grouping.
const CONVERSATIONAL = new Set([
  'i', 'im', 'ive', 'id', 'me', 'my', 'mine', 'we', 'us', 'our', 'you', 'your',
  'them', 'they', 'he', 'she', 'his', 'her', 'it', 'its',
  'had', 'have', 'has', 'having', 'was', 'were', 'is', 'are', 'be', 'been', 'am',
  'ate', 'eat', 'eaten', 'eating', 'got', 'get', 'getting', 'did', 'do', 'done',
  'actually', 'think', 'thought', 'guess', 'maybe', 'probably', 'really',
  'just', 'kinda', 'sorta', 'gonna', 'wanna', 'like', 'um', 'uh', 'well',
  'today', 'yesterday', 'morning', 'lunch', 'dinner', 'breakfast', 'snack',
]);

/**
 * Pick the best display/grouping label for a logged ingredient. Prefers the
 * AI's `item` label, but falls back to the canonical FatSecret `matchedName`
 * when `item` is conversational junk or implausibly long for a food name.
 */
export function cleanFoodLabel(item?: string, matchedName?: string): string {
  const it = (item ?? '').trim();
  const mn = (matchedName ?? '').trim();
  if (!it) return mn || 'Unknown';
  const tokens = it.toLowerCase().split(/[\s-]+/).filter(Boolean);
  const looksConversational = tokens.some((t) => CONVERSATIONAL.has(t)) || tokens.length > 4;
  if (looksConversational && mn) return mn;
  return it;
}

// Food groups, checked in priority order (first match wins). Keywords are
// matched as substrings against the normalized label.
const FOOD_GROUPS: { group: string; keywords: string[] }[] = [
  { group: 'Beverages', keywords: ['coffee', 'tea', 'juice', 'soda', 'cola', 'latte', 'espresso', 'smoothie', 'beer', 'wine', 'cocktail', 'lemonade', 'kombucha', 'drink', 'water'] },
  { group: 'Sweets & Snacks', keywords: ['candy', 'chocolate', 'cookie', 'cake', 'brownie', 'donut', 'doughnut', 'syrup', 'honey', 'dessert', 'pastry', 'pie', 'ice cream', 'icecream', 'muffin', 'chip', 'cracker', 'pretzel', 'popcorn', 'granola bar', 'jam', 'jelly'] },
  { group: 'Protein', keywords: ['chicken', 'beef', 'steak', 'pork', 'bacon', 'sausage', 'ham', 'turkey', 'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'shrimp', 'crab', 'lobster', 'egg', 'tofu', 'tempeh', 'seitan', 'lentil', 'chickpea', 'lamb', 'veal', 'venison', 'meatball', 'burger', 'patty', 'jerky', 'protein'] },
  { group: 'Dairy', keywords: ['milk', 'cheese', 'yogurt', 'yoghurt', 'butter', 'cream', 'cottage', 'kefir', 'custard'] },
  { group: 'Grains', keywords: ['rice', 'bread', 'pasta', 'oat', 'cereal', 'tortilla', 'bagel', 'noodle', 'quinoa', 'wheat', 'bun', 'wrap', 'flour', 'barley', 'couscous', 'cracker', 'pancake', 'waffle', 'toast', 'roll', 'grain'] },
  { group: 'Fruits', keywords: ['apple', 'banana', 'orange', 'berry', 'strawberry', 'blueberry', 'raspberry', 'grape', 'mango', 'melon', 'watermelon', 'peach', 'pear', 'pineapple', 'cherry', 'plum', 'kiwi', 'lemon', 'lime', 'fruit', 'apricot', 'fig', 'date', 'pomegranate'] },
  { group: 'Vegetables', keywords: ['carrot', 'broccoli', 'spinach', 'lettuce', 'tomato', 'pepper', 'onion', 'potato', 'cucumber', 'kale', 'celery', 'mushroom', 'zucchini', 'cabbage', 'corn', 'pea', 'salad', 'vegetable', 'asparagus', 'cauliflower', 'squash', 'eggplant', 'bean', 'garlic', 'beet', 'radish', 'sprout'] },
  // Note: no bare 'nut' keyword — it would mis-catch "butternut", "coconut",
  // "doughnut". Specific nut names are listed instead.
  { group: 'Fats & Oils', keywords: ['oil', 'olive', 'mayo', 'mayonnaise', 'dressing', 'avocado', 'almond', 'peanut', 'walnut', 'cashew', 'pecan', 'pistachio', 'seed', 'tahini', 'guacamole'] },
];

/**
 * Map an ingredient/food label to a broad food group.
 *
 * Matching is word-level, not raw-substring: a single-word keyword matches a
 * token exactly or as a suffix (so "blueberry" matches "berry", "cheeseburger"
 * matches "burger") — but "steak" never matches "tea" and "chocolate" never
 * matches "cola". Multi-word keywords ("ice cream") match as a phrase.
 */
export function foodGroupFor(label: string): string {
  const norm = normalizeIngredient(label);
  const tokens = norm.split(' ').filter(Boolean);
  const matches = (keyword: string) => {
    if (keyword.includes(' ')) return norm.includes(keyword);
    return tokens.some((t) => t === keyword || t.endsWith(keyword));
  };
  for (const { group, keywords } of FOOD_GROUPS) {
    if (keywords.some(matches)) return group;
  }
  return 'Other';
}
