import type { FullUserProfile } from '@/constants/user-profile';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReportData = {
  profile: FullUserProfile;
  dateRange: { start: string; end: string };
  weight: { start: number | null; end: number | null; delta: number | null };
  nutrition: {
    avgCalories: number | null;
    avgProteinG: number | null;
    avgFiberG: number | null;
    avgWaterOz: number | null;
    daysLogged: number;
  };
  activity: {
    avgSteps: number | null;
    activeDays: number;
    totalDays: number;
  };
  sideEffects: {
    totalCount: number;
    topTypes: string[];
  };
  checkins: Record<string, number | null>;
  injections: {
    count: number;
    dates: string[];
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(d: string) {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

const CHECKIN_LABELS: Record<string, string> = {
  foodNoise: 'Food Noise',
  appetite: 'Appetite',
  energyMood: 'Energy & Mood',
  giBurden: 'GI Symptoms',
  activityQuality: 'Activity',
  sleepQuality: 'Sleep',
  mentalHealth: 'Mental Health',
};

// ─── HTML Builder ────────────────────────────────────────────────────────────

export function buildHealthReportHtml(data: ReportData): string {
  const { profile, dateRange, weight, nutrition, activity, sideEffects, checkins, injections } = data;

  const brandDisplay = capitalize(profile.medicationBrand);
  const dateRangeStr = `${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}`;

  const weightRow = weight.delta != null
    ? `${weight.start?.toFixed(1) ?? '—'} lbs → ${weight.end?.toFixed(1) ?? '—'} lbs (${weight.delta > 0 ? '+' : ''}${weight.delta.toFixed(1)} lbs)`
    : 'No weight data for this period';

  const checkinRows = Object.entries(checkins)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `<tr><td>${CHECKIN_LABELS[k] ?? capitalize(k)}</td><td>${v}/100</td></tr>`)
    .join('');

  const seRow = sideEffects.totalCount === 0
    ? 'None logged'
    : `${sideEffects.totalCount} logged${sideEffects.topTypes.length ? ': ' + sideEffects.topTypes.map(capitalize).join(', ') : ''}`;

  const injectionRow = injections.count === 0
    ? 'None logged'
    : `${injections.count} doses administered`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: -apple-system, System, sans-serif; color: #1a1a1a; padding: 40px; max-width: 680px; margin: auto; }
  h1   { font-size: 28px; font-weight: 800; color: #FF742A; margin-bottom: 2px; }
  .sub { font-size: 14px; color: #666; margin-bottom: 8px; }
  .disclaimer { background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #856404; margin-bottom: 24px; line-height: 1.5; }
  .patient-line { font-size: 14px; color: #333; margin-bottom: 24px; border-bottom: 1px solid #ccc; padding-bottom: 8px; }
  h2   { font-size: 16px; font-weight: 700; margin: 24px 0 8px; border-bottom: 2px solid #FF742A; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th   { font-weight: 600; color: #888; }
  footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; line-height: 1.6; }
</style>
</head>
<body>
<h1>titra</h1>
<div class="sub">Health & Wellness Report · ${dateRangeStr}</div>

<div class="disclaimer">
  <strong>Important:</strong> This report contains self-reported wellness data from the Titra app.
  It is NOT a medical record and should not be used as a substitute for professional medical evaluation.
  All data was entered by the user and has not been clinically verified.
</div>

<div class="patient-line">
  <strong>Patient Name:</strong> _____________________________________ &nbsp;&nbsp;
  <strong>Date:</strong> _________________
</div>

<h2>Medication</h2>
<table>
  <tr><td>Medication</td><td>${brandDisplay} (${capitalize(profile.glp1Type)})</td></tr>
  <tr><td>Current Dose</td><td>${profile.doseMg} mg</td></tr>
  <tr><td>Frequency</td><td>Every ${profile.injectionFrequencyDays} day${profile.injectionFrequencyDays !== 1 ? 's' : ''}</td></tr>
  <tr><td>Route</td><td>${capitalize(profile.routeOfAdministration)}</td></tr>
  <tr><td>Doses in Period</td><td>${injectionRow}</td></tr>
</table>

<h2>Weight</h2>
<p>${weightRow}</p>

<h2>Nutrition (${nutrition.daysLogged} days logged)</h2>
<table>
  <tr><th>Metric</th><th>Daily Average</th></tr>
  <tr><td>Calories</td><td>${nutrition.avgCalories ?? '—'}</td></tr>
  <tr><td>Protein</td><td>${nutrition.avgProteinG != null ? nutrition.avgProteinG + 'g' : '—'}</td></tr>
  <tr><td>Fiber</td><td>${nutrition.avgFiberG != null ? nutrition.avgFiberG + 'g' : '—'}</td></tr>
  <tr><td>Water</td><td>${nutrition.avgWaterOz != null ? nutrition.avgWaterOz + ' oz' : '—'}</td></tr>
</table>

<h2>Activity</h2>
<table>
  <tr><td>Avg Daily Steps</td><td>${activity.avgSteps?.toLocaleString() ?? '—'}</td></tr>
  <tr><td>Active Days</td><td>${activity.activeDays} / ${activity.totalDays}</td></tr>
</table>

${checkinRows ? `
<h2>Wellness Check-In Scores</h2>
<table>
  <tr><th>Domain</th><th>Avg Score</th></tr>
  ${checkinRows}
</table>
` : ''}

<h2>Side Effects</h2>
<p>${seRow}</p>

<footer>
  Self-reported wellness data from the Titra app. Not a medical record.<br/>
  Generated ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
</footer>
</body>
</html>`;
}
