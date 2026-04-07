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
    phase === 'peak'    ? `Peak Phase - Day ${dayNum} (highest medication concentration, nausea most likely)` :
    phase === 'balance' ? `Balance Phase - Day ${dayNum} (medication stabilizing, appetite improving)` :
                          `Reset Phase - Day ${dayNum} (medication tapering toward next shot)`;

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
      const { data, error } = await supabase.functions.invoke('openai-proxy', { body });

      if (error) {
        lastError = new Error(`OpenAI proxy error: ${error.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
          continue;
        }
        throw lastError;
      }

      return data as Record<string, unknown>;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
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
    progress: 'In 1 concise sentence, state my weight progress toward my goal and whether my current rate is on track given my time on medication.',
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
              url: `data:${mediaType};base64,${imageBase64}`,
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
