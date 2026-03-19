import type {
  ActivityLog,
  FoodLog,
  InjectionLog,
  ProfileRow,
  SideEffectLog,
  UserGoalsRow,
  WeightLog,
} from '@/stores/log-store';

type SnapshotInput = {
  injectionLogs: InjectionLog[];
  foodLogs: FoodLog[];
  weightLogs: WeightLog[];
  activityLogs: ActivityLog[];
  sideEffectLogs: SideEffectLog[];
  userGoals: UserGoalsRow | null;
  profile: ProfileRow | null;
  userName: string | null;
  score: { total: number; medication: number; nutrition: number; activity: number };
  focalPoint?: { label: string; value: string };
  cycleiqContext?: string;
  // Extended personalization fields (all optional - backwards compatible)
  escalationPhase?: { name: string; programWeek: number; weeklyFocus: string };
  shotPhaseLabel?: string;          // e.g. "Peak Phase (Day 3)"
  foodNoiseScore?: number | null;   // 0–20, last weekly FNQ
  bmi?: number;
  isPlasticityWindow?: boolean;
  projection?: { projectedGoalDate: string; confidenceLevel: string; lossToDatePct: number };
};

export function buildContextSnapshot(data: SnapshotInput): string {
  const today = new Date().toISOString().split('T')[0];

  // ── Injection context ─────────────────────────────────────────────────────
  const lastInj = data.injectionLogs[0];
  const daysSinceInj = lastInj
    ? Math.floor((Date.now() - new Date(lastInj.injection_date).getTime()) / 86400000)
    : null;
  const freq = data.profile?.injection_frequency_days ?? 7;
  const isDaily = freq === 1;
  const daysUntilNext = daysSinceInj !== null ? Math.max(0, freq - daysSinceInj) : null;
  const doseTime = (data.profile as any)?.dose_time ?? null;

  // ── Program duration ──────────────────────────────────────────────────────
  const startDate = data.profile?.program_start_date
    ? new Date(data.profile.program_start_date)
    : null;
  const daysSinceStart = startDate
    ? Math.floor((Date.now() - startDate.getTime()) / 86400000)
    : null;
  const weeksElapsed = daysSinceStart !== null ? Math.round(daysSinceStart / 7) : null;

  // ── Today's nutrition ─────────────────────────────────────────────────────
  const todayFoods = data.foodLogs.filter((f) => f.logged_at?.startsWith(today));
  const todayCalories = todayFoods.reduce((s, f) => s + (f.calories ?? 0), 0);
  const todayProtein = todayFoods.reduce((s, f) => s + (f.protein_g ?? 0), 0);
  const todayFiber = todayFoods.reduce((s, f) => s + (f.fiber_g ?? 0), 0);

  // ── Weight progress ───────────────────────────────────────────────────────
  const latestWeight = data.weightLogs[0]?.weight_lbs ?? null;
  const startWeight = data.profile?.start_weight_lbs ?? null;
  const weightDelta =
    latestWeight !== null && startWeight !== null
      ? Math.round((latestWeight - startWeight) * 10) / 10
      : null;
  const lossPerWeek =
    weightDelta !== null && weeksElapsed && weeksElapsed > 0
      ? Math.round((Math.abs(weightDelta) / weeksElapsed) * 10) / 10
      : null;

  // ── Recent side effects ───────────────────────────────────────────────────
  const recentSE = data.sideEffectLogs.filter(
    (se) => Date.now() - new Date(se.logged_at).getTime() < 7 * 86400000,
  );

  // ── Focal point block ─────────────────────────────────────────────────────
  const focalBlock = data.focalPoint
    ? `\nCURRENT FOCUS:\n- ${data.focalPoint.label}: ${data.focalPoint.value}\n`
    : '';

  // ── Build snapshot string ─────────────────────────────────────────────────
  return `${focalBlock}
USER CONTEXT (as of ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}):
- Name: ${data.userName ?? 'User'}
- Medication: ${data.profile?.medication_type ?? 'GLP-1'} ${lastInj?.dose_mg ? `${lastInj.dose_mg}mg` : ''}
- Days on program: ${daysSinceStart ?? 'unknown'} (${weeksElapsed ?? '?'} weeks)
- Last ${isDaily ? 'dose' : 'injection'}: ${daysSinceInj !== null ? `${daysSinceInj} day(s) ago` : 'not logged'}
- Next ${isDaily ? 'dose' : 'injection'}: ${isDaily ? (doseTime ? `daily at ${doseTime}` : 'daily') : (daysUntilNext !== null ? `in ${daysUntilNext} day(s)` : 'unknown')}${doseTime ? `\n- Daily dose time: ${doseTime}` : ''}

TODAY'S NUTRITION (${todayFoods.length} items logged):
- Calories: ${todayCalories} / ${data.userGoals?.daily_calories_target ?? 2000} kcal
- Protein: ${Math.round(todayProtein)}g / ${data.userGoals?.daily_protein_g_target ?? 120}g
- Fiber: ${Math.round(todayFiber)}g / ${data.userGoals?.daily_fiber_g_target ?? 25}g

RECENT SIDE EFFECTS (last 7 days, ${recentSE.length} logged):
${recentSE.length > 0 ? recentSE.slice(0, 5).map((se) => `- ${se.effect_type} severity ${se.severity}/10 (${se.phase_at_log} phase)`).join('\n') : '- None reported'}

WEIGHT PROGRESS:
- Start: ${startWeight ? `${startWeight} lbs` : 'not set'}
- Current: ${latestWeight ? `${latestWeight} lbs` : 'not logged'}
- Change: ${weightDelta !== null ? `${weightDelta > 0 ? '+' : ''}${weightDelta} lbs` : 'N/A'} over ${weeksElapsed ?? '?'} weeks
- Rate: ${lossPerWeek ? `${lossPerWeek} lbs/week` : 'N/A'}
- Goal weight: ${data.profile?.goal_weight_lbs ? `${data.profile.goal_weight_lbs} lbs` : 'not set'}

LIFESTYLE SCORE TODAY: ${data.score.total}/100
  Medication adherence: ${data.score.medication}/100
  Nutrition: ${data.score.nutrition}/100
  Activity: ${data.score.activity}/100
${data.escalationPhase ? `
PROGRAM PHASE:
- Escalation phase: ${data.escalationPhase.name} (Week ${data.escalationPhase.programWeek})
- ${isDaily ? 'Intraday phase' : 'Injection cycle'}: ${data.shotPhaseLabel ?? (isDaily ? 'daily dosing' : 'unknown')}
- Weekly focus: ${data.escalationPhase.weeklyFocus}
- BMI: ${data.bmi != null ? data.bmi.toFixed(1) + (data.bmi < 25 ? ' (normal)' : data.bmi < 30 ? ' (overweight)' : data.bmi < 35 ? ' (obesity class I)' : data.bmi < 40 ? ' (obesity class II)' : ' (obesity class III)') : 'not set'}
- Plasticity window: ${data.isPlasticityWindow ? 'YES - prime habit-building period' : 'no'}${data.foodNoiseScore != null ? `\n- Food noise (last check-in): ${data.foodNoiseScore}/20` : ''}` : ''}
${data.projection ? `
WEIGHT PROJECTION:
- Lost to date: ${data.projection.lossToDatePct.toFixed(1)}% of body weight
- Projected goal: ${data.projection.projectedGoalDate} (${data.projection.confidenceLevel})` : ''}${data.cycleiqContext ? `

${data.cycleiqContext}` : ''}`.trim();
}
