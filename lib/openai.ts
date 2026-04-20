import { FullUserProfile } from '@/constants/user-profile';
import { daysSinceInjection, getShotPhase } from '@/constants/scoring';
import type { WeeklySummaryData } from '@/lib/weekly-summary';
import { supabase } from '@/lib/supabase';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ParsedFood = {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  servingSize: string;
  confidence: 'high' | 'medium' | 'low';
};

// Minimal shape of what we need from HealthContext
export type HealthSnapshot = {
  profile: FullUserProfile;
  recoveryScore: number | null;
  supportScore: number;
  wearable: {
    sleepMinutes?: number;
    hrvMs?: number;
    restingHR?: number;
    spo2Pct?: number;
    respRateRpm?: number;
  };
  actuals: {
    proteinG: number;
    waterMl: number;
    fiberG: number;
    steps: number;
    injectionLogged: boolean;
  };
  targets: {
    proteinG: number;
    waterMl: number;
    fiberG: number;
    steps: number;
  };
  focuses: Array<{ label: string; subtitle: string }>;
};

// ─── In-memory cache ───────────────────────────────────────────────────────────

const _cache = new Map<string, unknown>();

function cacheKey(type: string): string {
  return `${type}_${new Date().toDateString()}`;
}

// ─── System Prompt Builder ─────────────────────────────────────────────────────

export function buildSystemPrompt(
  health: HealthSnapshot,
  type?: 'recovery' | 'support',
): string {
  const { profile, recoveryScore, supportScore, wearable, actuals, targets, focuses } = health;

  const isOnMedication = profile.treatmentStatus === 'on' && !!profile.lastInjectionDate;

  const dayNum = daysSinceInjection(profile.lastInjectionDate);
  const phase = getShotPhase(dayNum);
  const phaseDesc =
    phase === 'shot'    ? 'Dose Day (medication absorption starting, first 24h)' :
    phase === 'peak'    ? `Peak Phase - Day ${dayNum} (highest medication concentration, nausea most likely)` :
    phase === 'balance' ? `Balance Phase - Day ${dayNum} (medication stabilizing, appetite improving)` :
                          `Reset Phase - Day ${dayNum} (medication tapering toward next dose)`;

  const sleepH = wearable.sleepMinutes != null ? Math.floor(wearable.sleepMinutes / 60) : null;
  const sleepM = wearable.sleepMinutes != null ? wearable.sleepMinutes % 60 : null;

  const startDateObj = profile.startDate ? new Date(profile.startDate) : new Date();
  const daysOnMed = Math.max(1, Math.floor((Date.now() - startDateObj.getTime()) / 86400000));
  const weeksOnMed = daysOnMed / 7;
  const totalLost = (profile.startWeightLbs ?? profile.weightLbs) - profile.weightLbs;
  const weeklyRate = weeksOnMed > 0 ? totalLost / weeksOnMed : 0;
  const remaining = profile.weightLbs - profile.goalWeightLbs;

  const waterOz = Math.round(actuals.waterMl / 29.57);
  const targetWaterOz = Math.round(targets.waterMl / 29.57);

  const focusList = (focuses ?? []).slice(0, 3).map(f => `• ${f.label}: ${f.subtitle}`).join('\n');
  const sideEffects = profile.sideEffects ?? [];

  let typeContext = '';
  if (type === 'recovery') {
    typeContext = '\n\nFOCUS: This user is asking about their Recovery Score (wearable biometrics: sleep, HRV, resting HR, SpO₂). Emphasize recovery, sleep quality, and how biometrics affect wellness.';
  } else if (type === 'support') {
    typeContext = '\n\nFOCUS: This user is asking about their Wellness Score (lifestyle inputs: protein, hydration, steps, fiber). Emphasize nutrition adherence, hydration, and movement.';
  }

  const medicationBlock = isOnMedication
    ? `- Medication: ${profile.medicationBrand} (${profile.glp1Type}), ${profile.doseMg}mg, every ${profile.injectionFrequencyDays} days
- Days on medication: ${daysOnMed}
- Side effects reported: ${sideEffects.length > 0 ? sideEffects.join(', ') : 'none'}`
    : '- Medication: Not currently on GLP-1 medication (lifestyle tracking only)';

  const weightProgressBlock = `WEIGHT PROGRESS:
- Start weight: ${Math.round(profile.startWeightLbs ?? profile.weightLbs)} lbs
- Current weight: ${Math.round(profile.weightLbs)} lbs
- Total lost: ${totalLost.toFixed(1)} lbs
- Weeks tracking: ${weeksOnMed.toFixed(1)}
- Weekly loss rate: ${weeklyRate.toFixed(2)} lbs/wk
- Target weekly loss: ${profile.targetWeeklyLossLbs ?? 1.0} lbs/wk
- Remaining to goal: ${remaining.toFixed(1)} lbs`;

  const doseCycleBlock = isOnMedication
    ? `DOSE CYCLE:
- Last dose: ${profile.lastInjectionDate}
- Days since last dose: ${dayNum}
- Phase: ${phaseDesc}`
    : '';

  const doseLogLine = isOnMedication
    ? `\n- Dose logged: ${actuals.injectionLogged ? 'Yes' : 'No'}`
    : '';

  const roleDesc = isOnMedication
    ? 'You are Titra, a GLP-1 medication companion AI coach.'
    : 'You are Titra, a health and wellness AI coach helping the user track weight, nutrition, and activity.';

  return `${roleDesc} You have access to the user's real-time health data.

USER PROFILE:
- Age: ${profile.age}, Sex: ${profile.sex}
${medicationBlock}
- Activity level: ${profile.activityLevel}
- Current weight: ${Math.round(profile.weightLbs)} lbs (${Math.round(profile.weightKg)} kg)
- Goal weight: ${profile.goalWeightLbs} lbs

${weightProgressBlock}
${doseCycleBlock ? `\n${doseCycleBlock}` : ''}
TODAY'S SCORES:
- Recovery Score: ${recoveryScore}/100
- Wellness Score: ${supportScore}/100

WEARABLE BIOMETRICS:
- Sleep: ${sleepH != null ? `${sleepH}h ${sleepM}m` : 'No data'}
- HRV: ${wearable.hrvMs ?? 'No data'} ${wearable.hrvMs != null ? 'ms' : ''}
- Resting HR: ${wearable.restingHR ?? 'No data'} ${wearable.restingHR != null ? 'bpm' : ''}
- SpO₂: ${wearable.spo2Pct ?? 'No data'}${wearable.spo2Pct != null ? '%' : ''}${wearable.respRateRpm != null ? `\n- Resp. Rate: ${wearable.respRateRpm} rpm` : ''}

DAILY ACTUALS vs TARGETS:
- Protein: ${actuals.proteinG}g / ${targets.proteinG}g
- Hydration: ${waterOz}oz / ${targetWaterOz}oz
- Steps: ${actuals.steps.toLocaleString()} / ${targets.steps.toLocaleString()}
- Fiber: ${actuals.fiberG}g / ${targets.fiberG}g${doseLogLine}

TODAY'S TOP FOCUSES:
${focusList || '• All metrics on track'}
${typeContext}

RESPONSE GUIDELINES:
- Be brief and analytical — no encouragement, lead with the key finding or gap directly
- Reference the user's specific numbers directly
- Do NOT make medical diagnoses; recommend consulting their HCP for clinical decisions
- Keep responses to 1–2 sentences unless the user explicitly asks for more
- Plain text only - no markdown, no bullet lists`;
}

// ─── Edge Function Proxy ─────────────────────────────────────────────────────

const MAX_RETRIES = 2;    // up to 3 total attempts

async function callOpenAIProxy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let lastError: Error = new Error('Request failed');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      __DEV__ && console.log(`[OpenAI] attempt ${attempt + 1}/${MAX_RETRIES + 1}, model: ${body.model}`);
      const { data, error } = await supabase.functions.invoke('openai-proxy', { body });

      if (error) {
        const errMsg = error.message ?? '';
        const errJson = JSON.stringify(error).slice(0, 300);
        __DEV__ && console.error(`[OpenAI] proxy error (attempt ${attempt + 1}):`, errMsg, 'context:', errJson);

        // Don't retry auth errors — the session is expired/invalid
        if (errMsg.includes('401') || errMsg.includes('Unauthorized') || errMsg.includes('authorization') ||
            errJson.includes('401') || errJson.includes('Invalid or expired token')) {
          throw new Error('AUTH_EXPIRED');
        }

        lastError = new Error(`OpenAI proxy error: ${errMsg}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
          continue;
        }
        throw lastError;
      }

      // Check if the response itself is an auth error (edge function returned 401 as JSON)
      if (data?.error && (data.error === 'Invalid or expired token' || data.error === 'Missing authorization header')) {
        __DEV__ && console.error('[OpenAI] auth error from proxy:', data.error);
        throw new Error('AUTH_EXPIRED');
      }

      // Check if the proxy wrapped an upstream OpenAI error
      if (data?.openai_error) {
        __DEV__ && console.error(`[OpenAI] upstream error (attempt ${attempt + 1}): status=${data.openai_status}`);
        lastError = new Error(`OpenAI API error ${data.openai_status}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
          continue;
        }
        throw lastError;
      }

      __DEV__ && console.log('[OpenAI] success, response keys:', Object.keys(data ?? {}));
      return data as Record<string, unknown>;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Don't retry auth errors
      if (lastError.message === 'AUTH_EXPIRED') throw lastError;
      __DEV__ && console.error(`[OpenAI] caught error (attempt ${attempt + 1}):`, lastError.message);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
        continue;
      }
    }
  }

  throw lastError;
}

// ─── Base OpenAI call ──────────────────────────────────────────────────────────

export async function callOpenAI(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
): Promise<string> {
  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    max_tokens: 400,
    temperature: 0.7,
  });

  return (data as any).choices[0].message.content as string;
}

// ─── Food Description Parser ───────────────────────────────────────────────────

export async function parseFoodDescription(
  description: string,
  _profile: FullUserProfile,
): Promise<ParsedFood> {
  const systemPrompt = `You are a nutrition database. Return ONLY valid JSON with the nutritional info for the described food. Base estimates on standard USDA values. Respond with this exact shape: {"name":"string","calories":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"servingSize":"string","confidence":"high"|"medium"|"low"}`;

  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: description },
    ],
    max_tokens: 200,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = (data as any).choices?.[0]?.message?.content ?? '';
  try {
    return JSON.parse(raw) as ParsedFood;
  } catch {
    throw new Error('OpenAI returned non-JSON response for food description');
  }
}

// ─── Conversational Food Logging ──────────────────────────────────────────────

export type ConverseFoodResult = {
  /** Parsed food items once the AI has enough info (null while still clarifying) */
  items: { item: string; estimated_g: number }[] | null;
  /** AI's response text (clarifying question or confirmation summary) */
  message: string;
  /** true when no more questions are needed */
  done: boolean;
};

const CONVERSE_FOOD_SYSTEM = `You are a friendly nutrition logging assistant helping a patient log what they ate.

Your job:
1. Listen to the user's meal description.
2. If anything is vague or missing (portion sizes, cooking method, specific ingredients, number of items), ask 1–2 SHORT clarifying questions in a single message. Be conversational and warm, not robotic.
3. Once you have enough detail, respond with a confirmation and a JSON block.

Rules:
- Ask at most 3 rounds of clarifying questions total across the conversation. After that, make your best estimate.
- Never ask more than 2 questions per message.
- Keep questions SHORT (one sentence each).
- When you have enough info, your message MUST end with a JSON block on its own line:
  FOOD_JSON: [{"item": "specific food name", "estimated_g": 150}, ...]
- Be specific in item names (e.g. "scrambled eggs with butter" not "eggs").
- Estimate reasonable portion sizes in grams if the user doesn't specify exact amounts.
- The FOOD_JSON line must be the LAST line of your response when you're done.`;

export async function converseFoodLog(
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<ConverseFoodResult> {
  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: CONVERSE_FOOD_SYSTEM },
      ...messages,
    ],
    max_tokens: 500,
    temperature: 0.5,
  });

  const content: string = (data as any).choices?.[0]?.message?.content ?? '';

  // Check if the response contains the FOOD_JSON marker
  const jsonMatch = content.match(/FOOD_JSON:\s*(\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      const items = JSON.parse(jsonMatch[1]) as { item: string; estimated_g: number }[];
      // Strip the JSON line from the display message
      const message = content.replace(/FOOD_JSON:\s*\[[\s\S]*\]/, '').trim();
      return { items, message, done: true };
    } catch {
      // JSON parse failed — treat as still clarifying
    }
  }

  return { items: null, message: content.trim(), done: false };
}

// ─── Dynamic Insights (cached per day) ────────────────────────────────────────

export async function generateDynamicInsights(health: HealthSnapshot): Promise<string> {
  const key = cacheKey('insights');
  if (_cache.has(key)) return _cache.get(key) as string;

  const systemPrompt = buildSystemPrompt(health);
  const userPrompt = 'In 1 concise sentence, state the most significant health trend or gap for me today, referencing my specific numbers and medication phase. Plain text only.';

  const result = await callOpenAI([{ role: 'user', content: userPrompt }], systemPrompt);
  _cache.set(key, result);
  return result;
}

// ─── Coach Note (cached per day per type) ─────────────────────────────────────

export async function generateCoachNote(
  type: 'recovery' | 'support',
  health: HealthSnapshot,
): Promise<string> {
  const key = cacheKey(`coach_${type}`);
  if (_cache.has(key)) return _cache.get(key) as string;

  const systemPrompt = buildSystemPrompt(health, type);
  const userPrompt = type === 'recovery'
    ? 'In 1 sentence, state the single biggest factor driving my Recovery Score today and one specific action I can take.'
    : 'In 1 sentence, state the single biggest factor affecting my GLP-1 Readiness Score today and one specific action I can take.';

  const result = await callOpenAI([{ role: 'user', content: userPrompt }], systemPrompt);
  _cache.set(key, result);
  return result;
}

// ─── Log Insights (cached per day per tab) ────────────────────────────────────

export async function generateLogInsight(
  tab: 'lifestyle' | 'medication' | 'progress',
  health: HealthSnapshot,
): Promise<string> {
  const key = cacheKey(`log_${tab}`);
  if (_cache.has(key)) return _cache.get(key) as string;

  const systemPrompt = buildSystemPrompt(health);

  const prompts: Record<typeof tab, string> = {
    lifestyle: 'In 1 concise sentence, state the most significant gap or trend in my protein, hydration, steps, or fiber vs my targets today.',
    medication: 'In 1 concise sentence, state how my current injection phase is affecting my body and whether my adherence is on track.',
    progress: 'In 1 concise sentence, summarize my weight progress: total lost, weekly rate, and whether I am on track to reach my goal. Reference the WEIGHT PROGRESS data provided. Never say I have not reported weight loss if start weight and current weight differ.',
  };

  const result = await callOpenAI([{ role: 'user', content: prompts[tab] }], systemPrompt);
  _cache.set(key, result);
  return result;
}

// ─── Voice Log Parser ─────────────────────────────────────────────────────────

export type VoiceWeightResult    = { weight_lbs: number; unit: 'lbs' | 'kg'; notes?: string };
export type VoiceActivityResult  = { exercise_type: string; duration_min: number; intensity: 'low' | 'moderate' | 'high'; notes?: string };
export type VoiceSideEffectsResult = { symptoms: string[]; severity: number; phase: 'shot' | 'peak' | 'balance' | 'reset'; notes?: string };
export type VoiceInjectionResult = { medication: string; dose_mg: number; site: string; notes?: string; batch?: string };
export type VoiceLogResult = VoiceWeightResult | VoiceActivityResult | VoiceSideEffectsResult | VoiceInjectionResult;

const VOICE_SYSTEM_PROMPTS: Record<string, string> = {
  weight: `Extract weight from the transcription. Return JSON: {"weight_lbs":number,"unit":"lbs"|"kg","notes":"string or omit"}. Convert to lbs if user said kg. If only kg mentioned, set unit to "kg" and weight_lbs to kg*2.20462.`,
  activity: `Extract workout details. Return JSON: {"exercise_type":"string","duration_min":number,"intensity":"low"|"moderate"|"high","notes":"string or omit"}. Map terms: easy/light/gentle→low, moderate/medium/normal→moderate, hard/intense/max/high→high.`,
  side_effects: `Extract side effects. Return JSON: {"symptoms":["nausea"|"vomiting"|"fatigue"|"constipation"|"diarrhea"|"headache"|"injection_site"|"appetite_loss"|"other"],"severity":1-10,"phase":"shot"|"peak"|"balance"|"reset","notes":"string or omit"}. Only include symptoms mentioned. Default phase to "balance" if not clear.`,
  injection: `Extract injection details. Return JSON: {"medication":"Ozempic"|"Wegovy"|"Mounjaro"|"Zepbound"|"Saxenda"|"Victoza","dose_mg":number,"site":"Left Abdomen"|"Right Abdomen"|"Left Thigh"|"Right Thigh"|"Left Upper Arm"|"Right Upper Arm","notes":"string or omit","batch":"string or omit"}. Parse dose as a number (e.g. "0.5mg" → 0.5). Default medication to "Ozempic" if unclear.`,
};

export async function parseVoiceLog(
  logType: 'weight' | 'activity' | 'side_effects' | 'injection',
  transcription: string,
): Promise<VoiceLogResult> {
  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: VOICE_SYSTEM_PROMPTS[logType] },
      { role: 'user', content: transcription },
    ],
    max_tokens: 200,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const raw = (data as any).choices?.[0]?.message?.content ?? '';
  try {
    return JSON.parse(raw) as VoiceLogResult;
  } catch {
    throw new Error('OpenAI returned non-JSON response for voice log');
  }
}

// ─── Vision (used by capture-food / scan-food screens) ────────────────────────

/**
 * Calls GPT-4o-mini with a base64-encoded image and a text prompt.
 * Used for food photo analysis in the capture-food entry flow.
 */
export async function callGPT4oMiniVision(
  systemPrompt: string,
  imageBase64: string,
  userText: string,
  mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<string> {
  // Detect actual image format from base64 magic bytes
  let detectedType: string = mediaType;
  if (imageBase64.startsWith('/9j/')) {
    detectedType = 'image/jpeg';
  } else if (imageBase64.startsWith('iVBOR')) {
    detectedType = 'image/png';
  } else if (imageBase64.startsWith('R0lGO')) {
    detectedType = 'image/gif';
  } else if (imageBase64.startsWith('UklGR')) {
    detectedType = 'image/webp';
  }
  __DEV__ && console.log('[OpenAI] vision: detectedType=', detectedType, 'first4=', imageBase64.slice(0, 4));

  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${detectedType};base64,${imageBase64}`,
              detail: 'low',
            },
          },
          { type: 'text', text: userText },
        ],
      },
    ],
  });

  return (data as any).choices[0].message.content as string;
}

// ─── Smart Food Resolution (variant search + AI selection) ───────────────────

/**
 * Layer 1: Takes parsed food item names and generates search-friendly variants
 * for each one. This helps bridge the gap between how people describe food
 * ("toast with pb") and how nutrition databases index it ("whole wheat bread").
 */
const VARIANT_SYSTEM = `You are a food search assistant helping query a nutrition database (FatSecret/USDA).

For each food item, generate 3 short search-friendly name variants that would match well in a nutrition database. Think about:
- The standard/generic database name (e.g. "banana, raw")
- A brand or common preparation variant (e.g. "banana fresh")
- A more specific variant (e.g. "banana medium")

Return ONLY valid JSON, no other text:
[
  {"item": "original item name", "variants": ["variant1", "variant2", "variant3"]}
]

Rules:
- Keep variants short (1-4 words) — they are search queries, not descriptions
- Include the most common/generic name as the first variant
- Do NOT include portion sizes or quantities in variants
- If the item is already very specific (e.g. "Coca-Cola"), still generate variants (e.g. ["coca cola", "coca cola classic", "coke"])`;

export async function generateSearchVariants(
  items: string[],
): Promise<{ item: string; variants: string[] }[]> {
  const input = items.map((it, i) => `${i + 1}. "${it}"`).join('\n');

  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: VARIANT_SYSTEM },
      { role: 'user', content: `Generate search variants for these food items:\n${input}` },
    ],
    max_tokens: 600,
    temperature: 0.3,
  });

  const raw = (data as any).choices?.[0]?.message?.content ?? '';
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    // Fallback: just use original names
    return items.map((it) => ({ item: it, variants: [it] }));
  }
  try {
    return JSON.parse(match[0]);
  } catch {
    return items.map((it) => ({ item: it, variants: [it] }));
  }
}

/**
 * Layer 3: Given original item descriptions and their FatSecret candidate matches,
 * selects the most accurate match for each item.
 */
const SELECT_SYSTEM = `You are a nutrition matching assistant. The user described foods they ate, and we searched a nutrition database for each item. Your job is to select which database result best matches what the user actually meant.

For each item, you'll see the user's original description and numbered candidates from the database (with name, brand, and calories per 100g).

Return ONLY valid JSON — an array of selected indices (0-based), one per item:
[0, 2, 0, 1]

Rules:
- Pick the candidate closest to what the user described
- Prefer unbranded/generic matches unless the user specified a brand
- Prefer entries with reasonable calorie values (not 0)
- If all candidates seem wrong, pick the closest one anyway (index 0 as last resort)`;

export async function selectBestFoodMatches(
  selections: {
    originalItem: string;
    candidates: { name: string; brand: string; calories: number }[];
  }[],
): Promise<number[]> {
  const prompt = selections
    .map((s, i) => {
      const candidateList = s.candidates
        .map((c, ci) => `  ${ci}. ${c.name}${c.brand ? ` (${c.brand})` : ''} — ${c.calories} kcal/100g`)
        .join('\n');
      return `Item ${i + 1}: "${s.originalItem}"\nCandidates:\n${candidateList}`;
    })
    .join('\n\n');

  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SELECT_SYSTEM },
      { role: 'user', content: prompt },
    ],
    max_tokens: 100,
    temperature: 0.1,
  });

  const raw = (data as any).choices?.[0]?.message?.content ?? '';
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return selections.map(() => 0);
  try {
    const indices = JSON.parse(match[0]) as number[];
    // Clamp indices to valid range
    return indices.map((idx, i) => {
      const max = selections[i]?.candidates?.length ?? 1;
      return idx >= 0 && idx < max ? idx : 0;
    });
  } catch {
    return selections.map(() => 0);
  }
}

// ─── AI Macro Estimation Fallback ─────────────────────────────────────────────

const MACRO_ESTIMATE_SYSTEM = `You are a nutrition database. Return ONLY valid JSON for the exact food named, per 100g:
{"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"fiber_g":number}
Use standard nutritional values. No extra text, no markdown.`;

export async function estimateMacrosWithAI(foodName: string): Promise<{
  fdcId: number;
  name: string;
  brand: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  serving_options: { label: string; grams: number }[];
} | null> {
  try {
    const raw = await callOpenAI([{ role: 'user', content: foodName }], MACRO_ESTIMATE_SYSTEM);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const m = JSON.parse(match[0]);
    return {
      fdcId: -1,
      name: foodName,
      brand: 'AI Estimate',
      calories: Math.round(m.calories ?? 0),
      protein_g: parseFloat((m.protein_g ?? 0).toFixed(1)),
      carbs_g: parseFloat((m.carbs_g ?? 0).toFixed(1)),
      fat_g: parseFloat((m.fat_g ?? 0).toFixed(1)),
      fiber_g: parseFloat((m.fiber_g ?? 0).toFixed(1)),
      serving_options: [
        { label: '100g', grams: 100 },
        { label: '150g', grams: 150 },
        { label: '200g', grams: 200 },
      ],
    };
  } catch {
    return null;
  }
}

// ─── Weekly Summary Insight ────────────────────────────────────────────────────

export async function generateWeeklyInsight(
  summary: WeeklySummaryData,
  profile: FullUserProfile,
): Promise<string> {
  const daysOnMed = Math.max(1, Math.floor((Date.now() - new Date(profile.startDate).getTime()) / 86400000));
  const weightChange = summary.weight.delta != null
    ? `${summary.weight.delta > 0 ? '+' : ''}${summary.weight.delta.toFixed(1)} lbs`
    : 'not logged';

  const systemPrompt = `You are Titra, a GLP-1 medication companion AI coach. Write a concise, personalized weekly recap.

USER:
- Medication: ${profile.medicationBrand} ${profile.doseMg}mg, day ${daysOnMed} on program
- Weight change this week: ${weightChange}
- Avg calories: ${summary.nutrition.avgCalories ?? 'not logged'} (target: ${summary.nutrition.caloriesTarget})
- Avg protein: ${summary.nutrition.avgProteinG ?? 'not logged'}g (target: ${summary.nutrition.proteinTarget}g)
- Avg fiber: ${summary.nutrition.avgFiberG ?? 'not logged'}g
- Days food logged: ${summary.nutrition.daysLogged}/7
- Avg steps: ${summary.activity.avgSteps ?? 'not logged'} (target: ${summary.activity.stepsTarget})
- Active days: ${summary.activity.activeDays}/7
- Side effects logged: ${summary.sideEffects.totalCount}${summary.sideEffects.topTypes.length > 0 ? ` (${summary.sideEffects.topTypes.join(', ')})` : ''}

Write 3-4 sentences of personalized insight covering the most significant trend from this week and one specific, actionable recommendation for the next injection cycle. Plain text only — no bullets or markdown.`;

  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Write my weekly summary insight.' },
    ],
    max_tokens: 250,
    temperature: 0.7,
  });

  return (data as any).choices[0].message.content as string;
}

