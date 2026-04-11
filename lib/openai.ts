import { FullUserProfile } from '@/constants/user-profile';
import { daysSinceInjection, getShotPhase } from '@/constants/scoring';
import type { WeeklySummaryData } from '@/lib/weekly-summary';
import type { ObservationItem } from '@/lib/provider-report-data';
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

  const dayNum = daysSinceInjection(profile.lastInjectionDate);
  const phase = getShotPhase(dayNum);
  const phaseDesc =
    phase === 'shot'    ? 'Dose Day (medication absorption starting, first 24h)' :
    phase === 'peak'    ? `Peak Phase - Day ${dayNum} (highest medication concentration, nausea most likely)` :
    phase === 'balance' ? `Balance Phase - Day ${dayNum} (medication stabilizing, appetite improving)` :
                          `Reset Phase - Day ${dayNum} (medication tapering toward next dose)`;

  const sleepH = wearable.sleepMinutes != null ? Math.floor(wearable.sleepMinutes / 60) : null;
  const sleepM = wearable.sleepMinutes != null ? wearable.sleepMinutes % 60 : null;

  const startDateObj = new Date(profile.startDate);
  const daysOnMed = Math.max(1, Math.floor((Date.now() - startDateObj.getTime()) / 86400000));
  const weeksOnMed = daysOnMed / 7;
  const totalLost = (profile.startWeightLbs ?? profile.weightLbs) - profile.weightLbs;
  const weeklyRate = weeksOnMed > 0 ? totalLost / weeksOnMed : 0;
  const remaining = profile.weightLbs - profile.goalWeightLbs;

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

WEIGHT PROGRESS:
- Start weight: ${Math.round(profile.startWeightLbs ?? profile.weightLbs)} lbs
- Current weight: ${Math.round(profile.weightLbs)} lbs
- Total lost: ${totalLost.toFixed(1)} lbs
- Weeks on medication: ${weeksOnMed.toFixed(1)}
- Weekly loss rate: ${weeklyRate.toFixed(2)} lbs/wk
- Target weekly loss: ${profile.targetWeeklyLossLbs ?? 1.0} lbs/wk
- Remaining to goal: ${remaining.toFixed(1)} lbs

DOSE CYCLE:
- Last dose: ${profile.lastInjectionDate}
- Days since last dose: ${dayNum}
- Phase: ${phaseDesc}

TODAY'S SCORES:
- Recovery Score: ${recoveryScore}/100
- Readiness Score: ${supportScore}/100

WEARABLE BIOMETRICS:
- Sleep: ${sleepH != null ? `${sleepH}h ${sleepM}m` : 'No data'}
- HRV: ${wearable.hrvMs ?? 'No data'} ${wearable.hrvMs != null ? 'ms' : ''}
- Resting HR: ${wearable.restingHR} bpm
- SpO₂: ${wearable.spo2Pct}%${wearable.respRateRpm != null ? `\n- Resp. Rate: ${wearable.respRateRpm} rpm` : ''}

DAILY ACTUALS vs TARGETS:
- Protein: ${actuals.proteinG}g / ${targets.proteinG}g
- Hydration: ${waterOz}oz / ${targetWaterOz}oz
- Steps: ${actuals.steps.toLocaleString()} / ${targets.steps.toLocaleString()}
- Fiber: ${actuals.fiberG}g / ${targets.fiberG}g
- Dose logged: ${actuals.injectionLogged ? 'Yes' : 'No'}

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
      console.log(`[OpenAI] attempt ${attempt + 1}/${MAX_RETRIES + 1}, model: ${body.model}`);
      const { data, error } = await supabase.functions.invoke('openai-proxy', { body });

      if (error) {
        console.error(`[OpenAI] proxy error (attempt ${attempt + 1}):`, error.message, 'context:', JSON.stringify(error).slice(0, 300));
        lastError = new Error(`OpenAI proxy error: ${error.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
          continue;
        }
        throw lastError;
      }

      // Check if the proxy wrapped an upstream OpenAI error
      if (data?.openai_error) {
        console.error(`[OpenAI] upstream error (attempt ${attempt + 1}): status=${data.openai_status} body=${data.openai_body}`);
        lastError = new Error(`OpenAI API error ${data.openai_status}: ${data.openai_body}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
          continue;
        }
        throw lastError;
      }

      console.log('[OpenAI] success, response keys:', Object.keys(data ?? {}));
      return data as Record<string, unknown>;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[OpenAI] caught error (attempt ${attempt + 1}):`, lastError.message);
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
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');

  const res = await fetchWithRetry(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CONVERSE_FOOD_SYSTEM },
        ...messages,
      ],
      max_tokens: 500,
      temperature: 0.5,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content: string = data.choices[0].message.content ?? '';

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
  console.log('[OpenAI] vision: detectedType=', detectedType, 'first4=', imageBase64.slice(0, 4));

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

// ─── Provider Report Narrative ─────────────────────────────────────────────────
// Polishes a structured list of observations into a short clinical-style
// paragraph. Both clinician AND patient will read this PDF, so the prompt
// enforces neutral, observational language with no recommendations.

export async function generateProviderReportNarrative(
  observations: ObservationItem[],
  patientContext: { sex: string; programWeek: number | null; medication: string | null },
): Promise<string | null> {
  if (observations.length === 0) return null;

  const obsList = observations
    .map(o => `- [${o.severity.toUpperCase()}] ${o.text}`)
    .join('\n');

  const systemPrompt = `You are a careful technical writer producing a single neutral paragraph for the "Assessment" section of a printable patient progress report. The report will be physically handed by the patient to their healthcare provider; both will read it. You are not a clinician. You are not giving advice. You are restating logged data in plain prose.

═══ ROLE ═══
You are NOT a doctor, coach, dietitian, or AI assistant addressing the patient. You are a report-formatting tool. Your only job is to convert the bulleted observations below into 2–4 sentences of flowing prose without adding, inferring, or recommending anything.

═══ HARD RULES — violating any of these is a failed output ═══

1. NO RECOMMENDATIONS. Never tell anyone to do, try, change, monitor, increase, decrease, evaluate, follow up, order, supplement, escalate, titrate, discuss, address, watch, review, schedule, repeat, check, or investigate anything. If a recommendation feels natural, rewrite it as a factual observation.

2. BANNED WORDS AND PHRASES (do not use, in any tense or form):
   should, must, ought, need to, needs to, recommend, recommendation, suggest, suggestion, advise, advisable, consider, considering, candidate for, candidate, encourage, urge, important to, worth, may want to, might want to, could benefit, would benefit, may benefit, beneficial to, evaluate, assess for, follow-up, follow up, monitor, watch, check, recheck, reassess, review with, discuss with, address, intervention, plan to, ensure, make sure, aim for, target, goal, work on, focus on, prioritize, optimize, improve, enhance, maintain, continue, try to, attempt, refer, referral, screen, screening, rule out, diagnose, treatment, prescription, dose change, dose adjustment, titrate, supplementation, supplement (as a verb), counseling, education needed, contraindicated, indicated, warranted, advised against.

3. NO JUDGMENT OR BLAME. The patient is logging diligently and doing their best. Never use: non-compliant, noncompliance, poor adherence, failed to, missed (when implying fault), inadequate, insufficient (about behavior), low (about effort), struggle, difficulty, lacking, falling short, behind, off-track, concerning, alarming, worrying, troubling, problematic, dangerous, risky, unsafe.

4. NO CLINICAL INTERPRETATION. Do not infer causes, mechanisms, diagnoses, prognoses, or risk levels. Do not name conditions. Do not mention "lean mass", "muscle loss", "metabolism", "deficiency", "dehydration", "starvation", or any physiologic mechanism unless that exact word appears verbatim in an observation. Do not predict.

5. NO SECOND PERSON. Never write "you" or "your". Use "the patient" sparingly, or write in subject-free constructions ("Logged weight averaged…", "Sleep self-ratings ranged…"). Do not address the patient.

6. NO HEDGE-RECOMMENDATION TRICKS. Phrases like "it may be worth noting", "this could indicate", "this might suggest", "potentially", "appears concerning", "raises the question of" are forbidden. Just state the number.

7. NUMBERS ARE LITERAL. Use the exact numbers from the observation list. Do not round, average across observations, or invent values not present.

8. STRUCTURE: 2 to 4 complete sentences. Plain prose only. No bullets, no markdown, no headings, no labels, no parentheticals like "(see chart)", no ellipses. Output ONLY the paragraph text — no preamble like "Here is the summary:" and no trailing notes.

═══ EXAMPLES ═══

GOOD (use this style):
"Logged weight changed by −9.8 lbs over the period, averaging −2.3 lbs per week. Average daily protein intake was 58 g, approximately 58% of the 100 g target for this user. Five nausea events were logged, with severity higher in the second half of the period than the first."

BAD (these would be rejected):
✗ "Protein intake is below target — recommend supplementation." (recommendation)
✗ "The patient should discuss dose escalation with their provider." (banned word "should")
✗ "Weight loss is rapid and may indicate dehydration." (clinical interpretation)
✗ "You are doing great with your logging this period." (second person, evaluation)
✗ "Worth noting that nausea is worsening — consider anti-emetic." (banned word "consider")
✗ "Adherence has been suboptimal." (judgment word)
✗ "Continue current strategy and monitor weight closely." (recommendation)

═══ SELF-CHECK BEFORE OUTPUTTING ═══
Before responding, mentally scan your draft for ANY banned word from rule #2, ANY judgment word from rule #3, and ANY recommendation pattern. If you find one, rewrite that sentence as a pure observation. If after rewriting you have nothing useful to say about a particular observation, drop it from the paragraph rather than forcing words.

═══ PATIENT CONTEXT (for grammatical agreement only — do not reference these directly) ═══
- Sex: ${patientContext.sex}
- Program week: ${patientContext.programWeek ?? 'unknown'}
- Medication: ${patientContext.medication ?? 'GLP-1 agonist'}

═══ OBSERVATIONS TO RESTATE AS PROSE ═══
${obsList}

Output the paragraph now. Paragraph only — no preamble, no explanation, no trailing text.`;

  try {
    const data = await callOpenAIProxy({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Write the assessment paragraph.' },
      ],
      max_tokens: 220,
      temperature: 0.3,
    });
    const text = (data as any)?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.trim().length === 0) return null;
    return text.trim();
  } catch {
    return null;
  }
}
