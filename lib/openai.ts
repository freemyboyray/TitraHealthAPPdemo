import { FullUserProfile } from '@/constants/user-profile';
import { daysSinceInjection, getShotPhase } from '@/constants/scoring';

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
  recoveryScore: number;
  supportScore: number;
  wearable: {
    sleepMinutes: number;
    hrvMs: number;
    restingHR: number;
    spo2Pct: number;
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

  const dayNum = daysSinceInjection(profile.lastInjectionDate);
  const phase = getShotPhase(dayNum);
  const phaseDesc =
    phase === 'shot'    ? 'Shot Day (medication absorption starting, first 24h)' :
    phase === 'peak'    ? `Peak Phase — Day ${dayNum} (highest medication concentration, nausea most likely)` :
    phase === 'balance' ? `Balance Phase — Day ${dayNum} (medication stabilizing, appetite improving)` :
                          `Reset Phase — Day ${dayNum} (medication tapering toward next shot)`;

  const sleepH = Math.floor(wearable.sleepMinutes / 60);
  const sleepM = wearable.sleepMinutes % 60;

  const startDateObj = new Date(profile.startDate);
  const daysOnMed = Math.max(1, Math.floor((Date.now() - startDateObj.getTime()) / 86400000));

  const waterOz = Math.round(actuals.waterMl / 29.57);
  const targetWaterOz = Math.round(targets.waterMl / 29.57);

  const focusList = (focuses ?? []).slice(0, 3).map(f => `• ${f.label}: ${f.subtitle}`).join('\n');

  let typeContext = '';
  if (type === 'recovery') {
    typeContext = '\n\nFOCUS: This user is asking about their Recovery Score (wearable biometrics: sleep, HRV, resting HR, SpO₂). Emphasize recovery, sleep quality, and how GLP-1 medication phase affects biometrics.';
  } else if (type === 'support') {
    typeContext = '\n\nFOCUS: This user is asking about their GLP-1 Readiness Score (lifestyle inputs: protein, hydration, steps, fiber, injection logging). Emphasize nutrition adherence, hydration, and movement.';
  }

  return `You are Titra, a GLP-1 medication companion AI coach. You have access to the user's real-time health data.

USER PROFILE:
- Age: ${profile.age}, Sex: ${profile.sex}
- Medication: ${profile.medicationBrand} (${profile.glp1Type}), ${profile.doseMg}mg, every ${profile.injectionFrequencyDays} days
- Days on medication: ${daysOnMed}
- Activity level: ${profile.activityLevel}
- Current weight: ${Math.round(profile.weightLbs)} lbs (${Math.round(profile.weightKg)} kg)
- Goal weight: ${profile.goalWeightLbs} lbs
- Side effects reported: ${profile.sideEffects.length > 0 ? profile.sideEffects.join(', ') : 'none'}

SHOT CYCLE:
- Last injection: ${profile.lastInjectionDate}
- Days since injection: ${dayNum}
- Phase: ${phaseDesc}

TODAY'S SCORES:
- Recovery Score: ${recoveryScore}/100
- Readiness Score: ${supportScore}/100

WEARABLE BIOMETRICS:
- Sleep: ${sleepH}h ${sleepM}m
- HRV: ${wearable.hrvMs} ms
- Resting HR: ${wearable.restingHR} bpm
- SpO₂: ${wearable.spo2Pct}%${wearable.respRateRpm != null ? `\n- Resp. Rate: ${wearable.respRateRpm} rpm` : ''}

DAILY ACTUALS vs TARGETS:
- Protein: ${actuals.proteinG}g / ${targets.proteinG}g
- Hydration: ${waterOz}oz / ${targetWaterOz}oz
- Steps: ${actuals.steps.toLocaleString()} / ${targets.steps.toLocaleString()}
- Fiber: ${actuals.fiberG}g / ${targets.fiberG}g
- Injection logged: ${actuals.injectionLogged ? 'Yes' : 'No'}

TODAY'S TOP FOCUSES:
${focusList || '• All metrics on track'}
${typeContext}

RESPONSE GUIDELINES:
- Be concise, warm, and evidence-based
- Reference the user's specific numbers when relevant
- Do NOT make medical diagnoses; recommend consulting their HCP for clinical decisions
- Keep responses under 150 words unless the user asks for more detail
- Use plain text, no markdown formatting`;
}

// ─── Base OpenAI call ──────────────────────────────────────────────────────────

export async function callOpenAI(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 400,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content as string;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Food Description Parser ───────────────────────────────────────────────────

export async function parseFoodDescription(
  description: string,
  _profile: FullUserProfile,
): Promise<ParsedFood> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  const systemPrompt = `You are a nutrition database. Return ONLY valid JSON with the nutritional info for the described food. Base estimates on standard USDA values. Respond with this exact shape: {"name":"string","calories":number,"proteinG":number,"carbsG":number,"fatG":number,"fiberG":number,"servingSize":"string","confidence":"high"|"medium"|"low"}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: description },
        ],
        max_tokens: 200,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content) as ParsedFood;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Dynamic Insights (cached per day) ────────────────────────────────────────

export async function generateDynamicInsights(health: HealthSnapshot): Promise<string[]> {
  const key = cacheKey('insights');
  if (_cache.has(key)) return _cache.get(key) as string[];

  const systemPrompt = buildSystemPrompt(health);
  const userPrompt = 'Return ONLY a JSON object with key "insights" containing exactly 3 short insight strings (max 20 words each) personalized to my current health data. Format: {"insights":["...","...","..."]}';

  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    const insights: string[] = parsed.insights ?? [];
    _cache.set(key, insights);
    return insights;
  } finally {
    clearTimeout(timeout);
  }
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
    ? 'Write a 2–3 sentence coaching note explaining what most impacts my Recovery Score today and one specific action I can take based on my current numbers.'
    : 'Write a 2–3 sentence coaching note explaining what most impacts my GLP-1 Readiness Score today and one specific action I can take based on my current numbers.';

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
    lifestyle: 'In 2–3 sentences, give me a specific lifestyle insight based on my protein, hydration, steps, and fiber data vs my targets today.',
    medication: 'In 2–3 sentences, give me an insight about my GLP-1 medication adherence and how my current injection phase affects my body today.',
    progress: 'In 2–3 sentences, give me a weight progress insight based on my current weight, goal weight, and how long I have been on medication.',
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
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: VOICE_SYSTEM_PROMPTS[logType] },
          { role: 'user', content: transcription },
        ],
        max_tokens: 200,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content) as VoiceLogResult;
  } finally {
    clearTimeout(timeout);
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
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
                url: `data:${mediaType};base64,${imageBase64}`,
                detail: 'low',
              },
            },
            { type: 'text', text: userText },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }
  const json = await res.json();
  return json.choices[0].message.content as string;
}
