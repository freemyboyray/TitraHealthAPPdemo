import { FullUserProfile } from '@/constants/user-profile';
import { daysSinceInjection, getShotPhase } from '@/constants/scoring';
import type { WeeklySummaryData } from '@/lib/weekly-summary';
import { supabase } from '@/lib/supabase';
import { usePreferencesStore } from '@/stores/preferences-store';

// ─── Data Consent Error ──────────────────────────────────────────────────────

export class DataConsentError extends Error {
  constructor() {
    super('AI data processing requires your consent. Enable "AI Data Processing" in Settings > Privacy & Data.');
    this.name = 'DataConsentError';
  }
}

/** Throws DataConsentError if the user has not granted AI data consent. */
export function requireAiConsent(): void {
  if (!usePreferencesStore.getState().aiDataConsent) {
    throw new DataConsentError();
  }
}

// ─── Usage Limit Error ────────────────────────────────────────────────────────

export class UsageLimitError extends Error {
  feature: string;
  limit: number;
  used: number;
  isPremium: boolean;

  constructor(feature: string, limit: number, used: number, isPremium = false) {
    super(`Daily ${feature} limit reached (${used}/${limit})`);
    this.name = 'UsageLimitError';
    this.feature = feature;
    this.limit = limit;
    this.used = used;
    this.isPremium = isPremium;
  }
}

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
  energy?: {
    score: number;           // 0-100 computed energy bank percentage
    phase: string;           // current medication phase
  };
};

/** Build the energy snapshot from computed scores. */
export function buildEnergySnapshot(
  score: number,
  phase: string,
): HealthSnapshot['energy'] {
  return { score, phase };
}

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
  const { profile, recoveryScore, supportScore, wearable, actuals, targets, focuses, energy } = health;

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
${energy ? `
ENERGY BANK: ${energy.score}% (${energy.score >= 70 ? 'Good' : energy.score >= 40 ? 'Moderate' : 'Low'})` : ''}
TODAY'S TOP FOCUSES:
${focusList || '• All metrics on track'}
${typeContext}

RESPONSE GUIDELINES:
- Be brief and analytical — no encouragement, lead with the key finding or gap directly
- Reference the user's specific numbers directly
- Do NOT make medical diagnoses; recommend consulting their HCP for clinical decisions
- Keep responses to 1–2 sentences unless the user explicitly asks for more
- Plain text only - no markdown, no bullet lists

IMPORTANT: All health information you provide is for educational purposes only and is NOT medical advice. When citing nutrition targets, pharmacokinetic data, or clinical benchmarks, note they are based on published clinical guidelines and prescribing information. Always recommend the user consult their prescribing physician for personalized medical decisions.`;
}

// ─── Edge Function Proxy ─────────────────────────────────────────────────────

// No retries — each proxy call increments usage, so retrying would burn
// through the free-tier limit (5/day) on transient failures.
async function callOpenAIProxy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  requireAiConsent();
  __DEV__ && console.log(`[OpenAI] calling proxy, model: ${body.model}`);
  const { data, error } = await supabase.functions.invoke('openai-proxy', { body });

  if (error) {
    const errMsg = error.message ?? '';
    // supabase-js wraps any non-2xx edge-function response in a FunctionsHttpError
    // whose JSON body lives on `error.context` (a Response). That body carries our
    // structured codes (USAGE_LIMIT, openai_error, …). Without reading it, every
    // server error — including a 429 usage limit — collapses into the generic
    // "non-2xx" message, which the photo flow then mislabels as "food not identified".
    let payload: Record<string, any> | null = null;
    let status = 0;
    const ctx: any = (error as any).context;
    if (ctx) {
      if (typeof ctx.status === 'number') status = ctx.status;
      if (typeof ctx.json === 'function') {
        try { payload = await ctx.json(); } catch { /* non-JSON / already-read body */ }
      }
    }
    __DEV__ && console.warn('[OpenAI] proxy error:', status || '', errMsg,
      payload ? JSON.stringify(payload).slice(0, 200) : '');

    if (status === 401 || payload?.error === 'Invalid or expired token' ||
        payload?.error === 'Missing authorization header' ||
        errMsg.includes('401') || errMsg.includes('Unauthorized') || errMsg.includes('authorization')) {
      throw new Error('AUTH_EXPIRED');
    }

    if (status === 429 || payload?.error === 'USAGE_LIMIT') {
      throw new UsageLimitError(
        payload?.feature ?? 'ai_chat',
        payload?.limit ?? 0,
        payload?.used ?? 0,
        !!payload?.is_premium,
      );
    }

    if (status === 413 || payload?.error === 'Payload too large') {
      throw new Error('Image too large to analyze. Please try a different photo.');
    }

    if (payload?.openai_error) {
      throw new Error(`OpenAI API error ${payload.openai_status}: ${payload.openai_message ?? 'unknown'}`);
    }

    throw new Error(`OpenAI proxy error: ${payload?.error ?? errMsg}`);
  }

  if (data?.error && (data.error === 'Invalid or expired token' || data.error === 'Missing authorization header')) {
    __DEV__ && console.error('[OpenAI] auth error from proxy:', data.error);
    throw new Error('AUTH_EXPIRED');
  }

  if (data?.error === 'USAGE_LIMIT') {
    __DEV__ && console.log('[OpenAI] usage limit hit:', data.feature, data.used, '/', data.limit);
    throw new UsageLimitError(data.feature ?? 'ai', data.limit ?? 0, data.used ?? 0, !!data.is_premium);
  }

  if (data?.openai_error) {
    __DEV__ && console.error('[OpenAI] upstream error:', data.openai_status, data.openai_message ?? '');
    throw new Error(`OpenAI API error ${data.openai_status}: ${data.openai_message ?? 'unknown'}`);
  }

  __DEV__ && console.log('[OpenAI] success, response keys:', Object.keys(data ?? {}));
  return data as Record<string, unknown>;
}

// ─── Base OpenAI call ──────────────────────────────────────────────────────────

export async function callOpenAI(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
  feature?: 'ai_chat' | 'photo_analysis' | 'food_parse',
  // The proxy classifies usage server-side and only counts a request as
  // food_parse (vs the stricter ai_chat bucket) when it's sent in JSON mode.
  // Food-parsing callers MUST pass jsonMode:true so they don't burn the chat
  // limit. The systemPrompt must instruct the model to return a JSON object.
  jsonMode = false,
): Promise<string> {
  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    max_tokens: 400,
    temperature: 0.7,
    ...(feature ? { feature } : {}),
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
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
    feature: 'food_parse',
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
    feature: 'food_parse',
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

// ─── Vision (used by the capture-food screen + describe-food sheet) ───────────

/**
 * Calls GPT-4o-mini with a base64-encoded image and a text prompt.
 * Used for food photo analysis in the capture-food entry flow.
 */
// Sniff the media type from base64 magic bytes so we hand the API the right
// data: prefix per image (iPhone JPEG vs. a PNG screenshot, etc.).
function detectImageMediaType(
  base64: string,
  fallback: 'image/jpeg' | 'image/png' = 'image/jpeg',
): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGO')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return fallback;
}

export async function callGPT4oMiniVision(
  systemPrompt: string,
  // One image, or several (e.g. multiple photos of the same meal). Each is sent
  // as its own image_url block so the model sees them all in one request.
  imageBase64: string | string[],
  userText: string,
  mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<string> {
  const images = (Array.isArray(imageBase64) ? imageBase64 : [imageBase64]).filter(Boolean);

  const imageBlocks = images.map((b64) => {
    const detectedType = detectImageMediaType(b64, mediaType);
    __DEV__ && console.log('[OpenAI] vision: detectedType=', detectedType, 'first4=', b64.slice(0, 4));
    return {
      type: 'image_url' as const,
      image_url: { url: `data:${detectedType};base64,${b64}`, detail: 'low' as const },
    };
  });

  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [...imageBlocks, { type: 'text', text: userText }],
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

Return ONLY a valid JSON object with a single "items" array, no other text:
{"items":[
  {"item": "original item name", "variants": ["variant1", "variant2", "variant3"]}
]}

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
    feature: 'food_parse',
    messages: [
      { role: 'system', content: VARIANT_SYSTEM },
      { role: 'user', content: `Generate search variants for these food items:\n${input}` },
    ],
    max_tokens: 600,
    temperature: 0.3,
    // JSON mode → proxy counts this as food_parse, not ai_chat.
    response_format: { type: 'json_object' },
  });

  const raw = (data as any).choices?.[0]?.message?.content ?? '';
  const fallback = () => items.map((it) => ({ item: it, variants: [it] }));
  try {
    const obj = JSON.parse(raw);
    const arr = Array.isArray(obj?.items) ? obj.items : Array.isArray(obj) ? obj : null;
    return arr ?? fallback();
  } catch {
    return fallback();
  }
}

/**
 * Layer 3: Given original item descriptions and their FatSecret candidate matches,
 * selects the most accurate match for each item.
 */
const SELECT_SYSTEM = `You are a nutrition matching assistant. The user described foods they ate, and we searched a nutrition database for each item. Your job is to select which database result best matches what the user actually meant.

For each item, you'll see the user's original description and numbered candidates from the database (with name, brand, and calories per 100g).

Return ONLY a valid JSON object with a single "indices" array of selected 0-based indices, one per item:
{"indices":[0, 2, 0, 1]}

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
    feature: 'food_parse',
    messages: [
      { role: 'system', content: SELECT_SYSTEM },
      { role: 'user', content: prompt },
    ],
    max_tokens: 100,
    temperature: 0.1,
    // JSON mode → proxy counts this as food_parse, not ai_chat.
    response_format: { type: 'json_object' },
  });

  const raw = (data as any).choices?.[0]?.message?.content ?? '';
  try {
    const obj = JSON.parse(raw);
    const indices = (Array.isArray(obj?.indices) ? obj.indices : Array.isArray(obj) ? obj : []) as number[];
    if (indices.length === 0) return selections.map(() => 0);
    // Clamp indices to valid range
    return selections.map((s, i) => {
      const idx = indices[i];
      const max = s?.candidates?.length ?? 1;
      return typeof idx === 'number' && idx >= 0 && idx < max ? idx : 0;
    });
  } catch {
    return selections.map(() => 0);
  }
}

// ─── GLP-1 Meal Tip ─────────────────────────────────────────────────────────

export async function generateMealTip(
  foodName: string,
  macros: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number },
  score: number,
  phase: string,
  sideEffects: string[],
): Promise<string> {
  const sideEffectStr = sideEffects.length > 0 ? sideEffects.join(', ') : 'none';
  const systemPrompt = `You are a GLP-1 medication nutrition coach. The user just logged a meal. Give ONE concise, actionable tip (1 sentence, max 25 words) to improve this meal for their GLP-1 journey. Focus on the biggest gap. If the meal scored 8+, give a brief affirmation instead. Never say "consider" — be direct.`;
  const userPrompt = `Food: ${foodName} | ${macros.calories} cal, ${macros.protein_g}g protein, ${macros.carbs_g}g carbs, ${macros.fat_g}g fat, ${macros.fiber_g}g fiber | Score: ${score}/10 | Phase: ${phase} | Side effects: ${sideEffectStr}`;

  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 60,
    temperature: 0.5,
  });

  return (data as any).choices[0].message.content as string;
}

// ─── AI Macro Estimation Fallback ─────────────────────────────────────────────

const MACRO_ESTIMATE_SYSTEM = `You are a nutrition database. Return ONLY valid JSON for the exact food named, per 100g:
{"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number,"fiber_g":number,"saturated_fat_g":number,"trans_fat_g":number,"sugar_g":number,"added_sugars_g":number,"sodium_mg":number,"cholesterol_mg":number,"potassium_mg":number,"serving":{"label":"string","grams":number},"alt_servings":[{"label":"string","grams":number}]}
Use standard nutritional values. Provide the extended nutrients (saturated_fat_g, trans_fat_g, sugar_g, added_sugars_g, sodium_mg, cholesterol_mg, potassium_mg) as best-estimate numbers from standard food data; use 0 only when the food genuinely contains none. For "serving", provide a natural typical serving with a human-friendly label (e.g. "1 burger", "1 cup", "1 slice", "1 bowl") and its weight in grams. For "alt_servings", provide 1-2 alternative portion sizes with natural labels. No extra text, no markdown.`;

export async function estimateMacrosWithAI(foodName: string): Promise<{
  fdcId: number;
  name: string;
  brand: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  saturated_fat_g?: number;
  trans_fat_g?: number;
  sugar_g?: number;
  added_sugars_g?: number;
  sodium_mg?: number;
  cholesterol_mg?: number;
  potassium_mg?: number;
  serving_options: { label: string; grams: number }[];
} | null> {
  try {
    const raw = await callOpenAI([{ role: 'user', content: foodName }], MACRO_ESTIMATE_SYSTEM, 'food_parse', true);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const m = JSON.parse(match[0]);

    // Build natural serving options from AI response with fallback
    const serving = m.serving && m.serving.label && m.serving.grams
      ? { label: m.serving.label, grams: Math.round(m.serving.grams) }
      : { label: '1 serving', grams: 150 };
    const altServings: { label: string; grams: number }[] = Array.isArray(m.alt_servings)
      ? m.alt_servings
          .filter((s: any) => s?.label && s?.grams)
          .map((s: any) => ({ label: s.label, grams: Math.round(s.grams) }))
      : [];
    const serving_options = [serving, ...altServings];

    return {
      fdcId: -1,
      name: foodName,
      brand: 'AI Estimate',
      calories: Math.round(m.calories ?? 0),
      protein_g: parseFloat((m.protein_g ?? 0).toFixed(1)),
      carbs_g: parseFloat((m.carbs_g ?? 0).toFixed(1)),
      fat_g: parseFloat((m.fat_g ?? 0).toFixed(1)),
      fiber_g: parseFloat((m.fiber_g ?? 0).toFixed(1)),
      // Extended nutrients — only carry through when the model actually
      // returned a value, so "not estimated" stays distinct from "zero".
      saturated_fat_g: m.saturated_fat_g != null ? parseFloat(Number(m.saturated_fat_g).toFixed(2)) : undefined,
      trans_fat_g: m.trans_fat_g != null ? parseFloat(Number(m.trans_fat_g).toFixed(2)) : undefined,
      sugar_g: m.sugar_g != null ? parseFloat(Number(m.sugar_g).toFixed(1)) : undefined,
      added_sugars_g: m.added_sugars_g != null ? parseFloat(Number(m.added_sugars_g).toFixed(1)) : undefined,
      sodium_mg: m.sodium_mg != null ? Math.round(Number(m.sodium_mg)) : undefined,
      cholesterol_mg: m.cholesterol_mg != null ? Math.round(Number(m.cholesterol_mg)) : undefined,
      potassium_mg: m.potassium_mg != null ? Math.round(Number(m.potassium_mg)) : undefined,
      serving_options,
    };
  } catch {
    return null;
  }
}

// ─── Weekly Summary Insight ────────────────────────────────────────────────────

/** Per-section weekly insight set. Stored JSON-stringified in weekly_summaries.ai_insight. */
export type WeeklyInsightSet = {
  overall: string;
  weight: string;
  nutrition: string;
  activity: string;
  checkins: string;
  sideEffects: string;
};

const EMPTY_INSIGHT_SET: WeeklyInsightSet = {
  overall: '', weight: '', nutrition: '', activity: '', checkins: '', sideEffects: '',
};

/**
 * Parse a stored `ai_insight` value into a WeeklyInsightSet. Handles the new
 * JSON format, the legacy plain-string format (→ `overall`), and null.
 */
export function parseWeeklyInsight(raw: string | null | undefined): WeeklyInsightSet {
  if (!raw) return EMPTY_INSIGHT_SET;
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === 'object' && ('overall' in p || 'nutrition' in p)) {
      return {
        overall: typeof p.overall === 'string' ? p.overall : '',
        weight: typeof p.weight === 'string' ? p.weight : '',
        nutrition: typeof p.nutrition === 'string' ? p.nutrition : '',
        activity: typeof p.activity === 'string' ? p.activity : '',
        checkins: typeof p.checkins === 'string' ? p.checkins : '',
        sideEffects: typeof p.sideEffects === 'string' ? p.sideEffects : '',
      };
    }
  } catch { /* legacy plain string */ }
  return { ...EMPTY_INSIGHT_SET, overall: raw };
}

export async function generateWeeklyInsight(
  summary: WeeklySummaryData,
  profile: FullUserProfile,
): Promise<string> {
  const daysOnMed = Math.max(1, Math.floor((Date.now() - new Date(profile.startDate).getTime()) / 86400000));
  const weightChange = summary.weight.delta != null
    ? `${summary.weight.delta > 0 ? '+' : ''}${summary.weight.delta.toFixed(1)} lbs (start ${summary.weight.start?.toFixed(1) ?? '—'}, end ${summary.weight.end?.toFixed(1) ?? '—'})`
    : 'not logged';
  const checkinLines = Object.entries(summary.checkins)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k} ${v}/100`)
    .join(', ') || 'none completed';

  const systemPrompt = `You are Titra, a GLP-1 medication companion AI coach. Write a personalized weekly recap broken into short per-section insights.

USER DATA (week of ${summary.windowStart} to ${summary.windowEnd}):
- Medication: ${profile.medicationBrand} ${profile.doseMg}mg, day ${daysOnMed} on program
- Weight: ${weightChange}
- Nutrition: ${summary.nutrition.avgCalories ?? 'not logged'} avg cal (target ${summary.nutrition.caloriesTarget}), ${summary.nutrition.avgProteinG ?? 'not logged'}g protein (target ${summary.nutrition.proteinTarget}g), ${summary.nutrition.avgFiberG ?? 'not logged'}g fiber; ${summary.nutrition.daysLogged}/7 days logged
- Activity: ${summary.activity.avgSteps ?? 'not logged'} avg steps (target ${summary.activity.stepsTarget}), ${summary.activity.activeDays}/7 active days
- Check-in scores (0-100, higher is better): ${checkinLines}
- Side effects: ${summary.sideEffects.totalCount} logged${summary.sideEffects.topTypes.length > 0 ? ` (${summary.sideEffects.topTypes.join(', ')})` : ''}

Return a JSON object with EXACTLY these keys, each a warm, second-person, 1-2 sentence plain-text insight grounded in the numbers above (no markdown, no bullets):
{
  "overall": "the single most important takeaway for the week plus one specific focus for the next injection cycle",
  "weight": "the weight trend",
  "nutrition": "calories/protein/fiber/water",
  "activity": "steps and activity",
  "checkins": "the check-in domain scores (energy, GI, appetite, sleep, mental health, etc.)",
  "sideEffects": "side-effect burden this week"
}
If a section has no data this week, set its value to an empty string "". Never recommend specific medication doses.`;

  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Write my weekly per-section insights as JSON.' },
    ],
    max_tokens: 600,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const raw = (data as any).choices[0].message.content as string;
  // Normalize to our shape before storing so the reader can trust the keys.
  return JSON.stringify(parseWeeklyInsight(raw));
}

// ─── Side-effect insights (overall + per-symptom, cached per day) ─────────────

export type SideEffectDigestSymptom = {
  type: string;          // stored effect_type (the perSymptom key)
  label: string;         // display label
  count: number;
  avgTier: string;       // 'Mild' | 'Moderate' | 'Severe'
  mild: number;
  moderate: number;
  severe: number;
  trend: string;         // 'improving' | 'worsening' | 'steady' | 'new'
};

export type SideEffectDigest = {
  freqLabel: string;             // 'weekly injection' | 'daily dose' | …
  cyclePeakLabel: string | null; // 'Day 1–2' | 'Mon' | '12–18h' | null
  symptoms: SideEffectDigestSymptom[];
  clusters: { a: string; b: string; daysTogether: number }[];
};

export type SideEffectInsightSet = { overall: string; perSymptom: Record<string, string> };

const EMPTY_SE_INSIGHTS: SideEffectInsightSet = { overall: '', perSymptom: {} };

function parseSideEffectInsights(raw: string | null | undefined, types: string[]): SideEffectInsightSet {
  if (!raw) return EMPTY_SE_INSIGHTS;
  try {
    const p = JSON.parse(raw);
    const overall = typeof p?.overall === 'string' ? p.overall : '';
    const perSymptom: Record<string, string> = {};
    const src = (p && typeof p.perSymptom === 'object' && p.perSymptom) || {};
    for (const t of types) {
      if (typeof src[t] === 'string') perSymptom[t] = src[t];
    }
    return { overall, perSymptom };
  } catch {
    return EMPTY_SE_INSIGHTS;
  }
}

/**
 * One batched call producing the overall summary plus a personalized line per
 * tracked symptom. Cached per day (mirrors generateWeeklyInsight). Returns the
 * parsed set directly so the hook can use it without re-parsing.
 */
export async function generateSideEffectInsights(
  digest: SideEffectDigest,
  profile: FullUserProfile,
): Promise<SideEffectInsightSet> {
  const types = digest.symptoms.map(s => s.type);
  const key = cacheKey('side_effect_insights');
  if (_cache.has(key)) return _cache.get(key) as SideEffectInsightSet;

  if (digest.symptoms.length === 0) {
    const empty = EMPTY_SE_INSIGHTS;
    _cache.set(key, empty);
    return empty;
  }

  const daysOnMed = Math.max(1, Math.floor((Date.now() - new Date(profile.startDate).getTime()) / 86400000));
  const symptomLines = digest.symptoms
    .map(s => `- ${s.label} (key "${s.type}"): ${s.count} logs, mostly ${s.avgTier} (${s.mild} mild, ${s.moderate} moderate, ${s.severe} severe), trend ${s.trend}`)
    .join('\n');
  const clusterLine = digest.clusters.length > 0
    ? digest.clusters.map(c => `${c.a}+${c.b} (${c.daysTogether} shared days)`).join(', ')
    : 'none notable';

  const systemPrompt = `You are Titra, a GLP-1 medication companion AI coach. The user is on day ${daysOnMed} of their program with a ${digest.freqLabel}. Write personalized, grounded side-effect insights.

LAST 30 DAYS OF SIDE-EFFECT DATA:
- Cycle timing of symptoms: ${digest.cyclePeakLabel ? `most symptoms land around ${digest.cyclePeakLabel} of the cycle` : 'no clear cycle timing yet'}
- Symptoms:
${symptomLines}
- Symptoms that cluster on the same day: ${clusterLine}

Return a JSON object with EXACTLY these keys:
{
  "overall": "2-3 warm, second-person sentences: the single most important takeaway about their side-effect picture and cycle timing, plus what to keep an eye on next cycle",
  "perSymptom": { ${types.map(t => `"${t}": "1-2 sentences personalized to THIS symptom's trend, severity mix, and what specifically to watch for"`).join(', ')} }
}
Ground every sentence in the numbers above. Be encouraging when things are improving and matter-of-fact when steady. Suggest hydration, protein, fiber, meal timing, or contacting their care team where relevant. NEVER recommend, adjust, or mention specific medication doses. Plain text only, no markdown.`;

  const data = await callOpenAIProxy({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Write my side-effect insights as JSON.' },
    ],
    max_tokens: 700,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });

  const raw = (data as any).choices?.[0]?.message?.content as string;
  const parsed = parseSideEffectInsights(raw, types);
  _cache.set(key, parsed);
  return parsed;
}

