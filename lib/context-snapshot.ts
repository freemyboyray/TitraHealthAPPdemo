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
};

export function buildContextSnapshot(data: SnapshotInput): string {
  const today = new Date().toISOString().split('T')[0];

  // ── Injection context ─────────────────────────────────────────────────────
  const lastInj = data.injectionLogs[0];
  const daysSinceInj = lastInj
    ? Math.floor((Date.now() - new Date(lastInj.injection_date).getTime()) / 86400000)
    : null;
  const freq = data.profile?.injection_frequency_days ?? 7;
  const daysUntilNext = daysSinceInj !== null ? Math.max(0, freq - daysSinceInj) : null;

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

  // ── Build snapshot string ─────────────────────────────────────────────────
  return `
USER CONTEXT (as of ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}):
- Name: ${data.userName ?? 'User'}
- Medication: ${data.profile?.medication_type ?? 'GLP-1'} ${lastInj?.dose_mg ? `${lastInj.dose_mg}mg` : ''}
- Days on program: ${daysSinceStart ?? 'unknown'} (${weeksElapsed ?? '?'} weeks)
- Last injection: ${daysSinceInj !== null ? `${daysSinceInj} day(s) ago` : 'not logged'}
- Next injection: ${daysUntilNext !== null ? `in ${daysUntilNext} day(s)` : 'unknown'}

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
  Activity: ${data.score.activity}/100`.trim();
}
