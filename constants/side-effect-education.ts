// Generic, factual "why this matters" copy for each side effect — the lead
// paragraph shown above the personalized AI line in the expanded trend detail.
// Keep it calm and educational, never alarming, and never about dose changes
// (see the no-dosage-regulation rule). Keyed by the stored effect_type
// (`SideEffectLog.effect_type` / the `dbType` values in constants/side-effects.ts).

export const SYMPTOM_ABOUT: Record<string, string> = {
  nausea:
    'Nausea is the most common GLP-1 side effect. It usually shows up early in each cycle, when your medication level is rising fastest, and tends to ease as your body adapts over the following weeks. It matters because persistent nausea can quietly cut into hydration and protein, so it is worth tracking how strong it is and when in your cycle it lands.',
  vomiting:
    'Vomiting is less common than nausea but more disruptive, since it can affect hydration and how much of your meals you keep down. It often clusters in the same early-cycle window as nausea. Tracking its timing and intensity helps you tell an adjusting-body pattern from something worth raising with your care team.',
  fatigue:
    'Fatigue on a GLP-1 often reflects eating less, lower blood sugar, or simply the body adapting. It tends to be most noticeable in the day or two after a dose. Following your fatigue over the cycle helps separate a normal post-dose dip from a steadier drag that protein, hydration, or sleep might explain.',
  constipation:
    'These medications slow how quickly your stomach empties, which can also slow the rest of your digestion and lead to constipation. It usually builds gradually rather than spiking. Watching the trend matters because fiber and water habits make a real difference to it.',
  diarrhea:
    'Diarrhea reflects the same shift in gut motility that drives other GI symptoms, just in the other direction. It often comes and goes with the cycle. Tracking it helps you notice whether it lines up with specific days, meals, or your dose timing.',
  headache:
    'Headaches on a GLP-1 are frequently tied to dehydration or lower food intake rather than the drug itself. They often appear in the higher-concentration part of the cycle. Following the pattern helps you see whether hydration and steady eating ease them.',
  injection_site:
    'Injection-site reactions like redness, itching, or a small lump are usually mild and short-lived. Tracking them alongside the sites you use helps you spot whether rotating injection sites keeps them to a minimum.',
  appetite_loss:
    'Reduced appetite is the intended effect of these medications, but tracking its strength matters: very strong suppression can make it hard to hit your protein and overall nutrition targets, which protects lean mass during weight loss.',
  dehydration:
    'Dehydration ties together several GLP-1 symptoms, since eating and drinking less reduces fluid intake just as nausea or GI changes increase losses. It is worth watching because it amplifies headaches, fatigue, and dizziness.',
  dizziness:
    'Dizziness is often a downstream sign of dehydration, lower blood sugar, or eating less rather than a direct drug effect. Tracking when it appears in your cycle helps connect it to the habits most likely to ease it.',
  muscle_loss:
    'Some of the weight lost on a GLP-1 can come from muscle, not just fat. Noticing it early matters because protein intake and resistance activity are the main levers for preserving lean mass while you lose weight.',
  heartburn:
    'Heartburn and reflux come from food sitting in the stomach longer as digestion slows. It often tracks with meal size and timing. Following the pattern helps you see which days and habits set it off.',
  food_noise:
    'Food noise is the constant background chatter of food thoughts and cravings. Many people find these medications quiet it, and tracking it is a useful window into how well your appetite signals are being managed across the cycle.',
  sulfur_burps:
    'Sulfur burps are a distinctive but harmless symptom of slowed digestion, where food ferments a little longer than usual. They tend to flare around larger or higher-fat meals, so tracking their timing can point to the trigger.',
  bloating:
    'Bloating comes from the slower stomach emptying these medications cause, leaving you fuller and gassier for longer. It usually eases between doses. Watching the pattern helps connect it to meal size and the cycle.',
  hair_loss:
    'Hair shedding during weight loss is usually temporary and tied to rapid loss or lower protein intake rather than the medication directly. It tends to show up weeks in, not day to day, so the longer trend is what matters most here.',
  other:
    'Tracking any symptom over time turns a one-off bad day into a pattern you can actually read: how strong it is, when in your cycle it lands, and whether it is settling as your body adapts.',
};

export function symptomAbout(type: string): string {
  return SYMPTOM_ABOUT[type] ?? SYMPTOM_ABOUT.other;
}
