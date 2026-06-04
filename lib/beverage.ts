// Beverage detection + hydration crediting.
//
// Beverages are foods you drink — they should read as a drink (beverage icon)
// and credit the daily hydration total, discounted for caffeinated / sugary /
// alcoholic drinks (which hydrate less, or net-dehydrate). We approximate fluid
// volume in mL from the logged grams (most drinks are ~1 g/mL).

export type BeverageKind =
  | 'water'
  | 'sparkling'
  | 'electrolytes'
  | 'coffee'
  | 'tea'
  | 'juice'
  | 'milk'
  | 'soda'
  | 'alcohol'
  | 'other';

export type BeverageInfo = {
  isBeverage: boolean;
  kind: BeverageKind;
  // Effective hydration per mL (1.0 = same as water). Caffeinated/sugary get a
  // discount; alcohol is net-dehydrating so credits nothing.
  hydrationFactor: number;
};

const FACTOR: Record<BeverageKind, number> = {
  water: 1.0,
  sparkling: 1.0,
  electrolytes: 1.15,
  coffee: 0.85,
  tea: 0.9,
  juice: 0.9,
  milk: 0.9,
  soda: 0.8,
  alcohol: 0.0,
  other: 0.85,
};

// Ordered most-specific → least so e.g. "iced coffee" matches coffee before the
// generic beverage check.
const KIND_KEYWORDS: [BeverageKind, string[]][] = [
  ['alcohol', ['beer', 'wine', 'cocktail', 'margarita', 'mojito', 'whiskey', 'vodka', 'rum', 'tequila', 'cider', 'champagne', 'liquor', 'ale', 'lager', 'sangria']],
  ['coffee', ['coffee', 'espresso', 'latte', 'cappuccino', 'americano', 'macchiato', 'mocha', 'frappuccino', 'frappe', 'cold brew']],
  ['tea', ['tea', 'matcha', 'chai', 'kombucha']],
  ['electrolytes', ['gatorade', 'powerade', 'electrolyte', 'pedialyte', 'liquid iv', 'bodyarmor', 'sports drink']],
  ['soda', ['soda', 'cola', 'coke', 'pepsi', 'sprite', 'fanta', 'mountain dew', 'dr pepper', 'root beer', 'soft drink', 'energy drink', 'red bull', 'monster', 'pop ']],
  ['juice', ['juice', 'lemonade', 'smoothie', 'punch', 'nectar', 'cider']],
  ['milk', ['milk', 'milkshake', 'shake', 'latte', 'horchata', 'eggnog']],
  ['sparkling', ['sparkling', 'seltzer', 'club soda', 'tonic', 'la croix', 'perrier']],
  ['water', ['water']],
];

const GENERIC_BEVERAGE_WORDS = ['drink', 'beverage', 'smoothie', 'shake'];

const BEVERAGE_CATEGORY_HINTS = ['beverage', 'drink', 'soft drink', 'juice', 'coffee', 'tea', 'water', 'soda', 'alcohol'];

function norm(s?: string): string {
  return (s ?? '').toLowerCase();
}

// Classify a food into beverage info from its name + (optional) FatSecret
// category. `category` is the FatSecret sub-category name when available.
export function classifyBeverage(name?: string, category?: string): BeverageInfo {
  const hay = `${norm(name)} ${norm(category)}`;

  let kind: BeverageKind | null = null;
  for (const [k, words] of KIND_KEYWORDS) {
    if (words.some((wd) => hay.includes(wd))) {
      kind = k;
      break;
    }
  }

  const categoryIsBeverage = BEVERAGE_CATEGORY_HINTS.some((h) => norm(category).includes(h));
  const genericMatch = GENERIC_BEVERAGE_WORDS.some((wd) => hay.includes(wd));

  if (!kind) {
    if (categoryIsBeverage || genericMatch) kind = 'other';
    else return { isBeverage: false, kind: 'other', hydrationFactor: 0 };
  }

  return { isBeverage: true, kind, hydrationFactor: FACTOR[kind] };
}

const ML_PER_OZ = 29.5735;

export function mlToOz(ml: number): number {
  return ml / ML_PER_OZ;
}

// Hydration mL credited for a beverage of `grams` (≈ mL) at the given factor.
export function hydrationMl(grams: number, factor: number): number {
  return Math.round(grams * factor);
}
