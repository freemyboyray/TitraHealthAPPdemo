import type { FullUserProfile } from '@/constants/user-profile';
import { TITRA_LOGO_DATA_URI } from './titra-logo';

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

  const generatedStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const brandHead = (eyebrow: string, title: string) => `
<header class="brand-head">
  <div class="head-text">
    <div class="eyebrow">${eyebrow}</div>
    <div class="report-title">${title}</div>
  </div>
  <div class="brand">
    <img class="logo" src="${TITRA_LOGO_DATA_URI}" alt="Titra Health" />
    <span class="wordmark">Titra Health</span>
  </div>
</header>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, System, sans-serif; color: #1a1a1a; padding: 40px; max-width: 680px; margin: auto; }

  .brand-head {
    display: flex; align-items: center; justify-content: space-between;
    border: 1px solid #eee; border-radius: 14px; padding: 16px 20px; margin-bottom: 18px;
  }
  .brand-head .eyebrow { font-size: 12px; color: #999; margin-bottom: 2px; }
  .brand-head .report-title { font-size: 22px; font-weight: 800; color: #1a1a1a; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand .logo { width: 34px; height: 34px; border-radius: 9px; display: block; }
  .brand .wordmark { font-size: 18px; font-weight: 800; color: #FF742A; letter-spacing: -0.3px; }

  .sub { font-size: 14px; color: #666; line-height: 1.5; margin: 0 0 18px 2px; }
  h2   { font-size: 16px; font-weight: 700; margin: 24px 0 8px; border-bottom: 2px solid #FF742A; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eee; }
  th   { font-weight: 600; color: #888; }
  footer { margin-top: 40px; font-size: 11px; color: #aaa; text-align: center; line-height: 1.6; }

  /* ── Explanation (back) page ───────────────────────── */
  .page-break { page-break-before: always; break-before: page; }
  .lead { font-size: 13.5px; color: #444; line-height: 1.6; margin: 4px 0 20px; }
  h3 { font-size: 16px; font-weight: 700; color: #1a1a1a; margin: 22px 0 6px; }
  .explain p { font-size: 13px; color: #555; line-height: 1.6; margin: 0 0 8px; }
  .explain .label { font-size: 13px; color: #555; margin: 4px 0 4px; }
  .explain ul { margin: 4px 0 8px; padding-left: 20px; }
  .explain li { font-size: 13px; color: #555; line-height: 1.6; margin-bottom: 2px; }

  .callout {
    margin-top: 28px; background: #FFF1E8; border-radius: 16px; padding: 24px 26px;
    display: flex; gap: 22px; align-items: center;
  }
  .callout .copy { flex: 1; }
  .callout h4 { font-size: 19px; font-weight: 800; color: #FF742A; line-height: 1.25; margin: 0 0 10px; }
  .callout p { font-size: 12.5px; color: #5a4a40; line-height: 1.55; margin: 0 0 8px; }
  .callout ul { margin: 6px 0 10px; padding-left: 18px; }
  .callout li { font-size: 12.5px; color: #5a4a40; line-height: 1.5; margin-bottom: 2px; }
  .callout .link { font-size: 12.5px; color: #FF742A; font-weight: 700; }
  .callout .mark { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .callout .mark img { width: 92px; height: 92px; border-radius: 22px; display: block; }
  .callout .mark span { font-size: 13px; font-weight: 800; color: #FF742A; }
</style>
</head>
<body>
${brandHead('Health &amp; Wellness Report', 'User Summary')}
<div class="sub">${dateRangeStr}<br/>Generated ${generatedStr}</div>

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

<!-- ───────────────────── Explanation / back page ───────────────────── -->
<div class="page-break"></div>
${brandHead('About this report', 'Explanation')}

<div class="explain">
  <p class="lead">
    This report was created using data from Titra Health, a companion app for people taking GLP-1
    medications such as semaglutide and tirzepatide. Titra Health helps users track their medication,
    nutrition, weight, activity, and side effects so they can better understand their treatment and
    make informed decisions alongside their care team.
  </p>

  <h3>How this report was created</h3>
  <p>
    The insights shown here are based on self-tracked data entered by the user. Titra Health supports
    consistent, accurate tracking with simple logging tools and reminders throughout each dose cycle.
  </p>
  <div class="label">Data included in this report:</div>
  <ul>
    <li>Medication, dose, frequency, and injection history</li>
    <li>Weight measurements over the reporting period</li>
    <li>Nutrition averages (calories, protein, fiber, and hydration)</li>
    <li>Activity and daily step counts</li>
    <li>Wellness check-in scores and reported side effects</li>
  </ul>

  <h3>How to interpret this report</h3>
  <p>
    This report is designed to help spark meaningful conversations between patients and their healthcare
    providers. It highlights trends in weight, nutrition, activity, and tolerability that may be helpful
    when discussing treatment.
  </p>
  <div class="label">Please note:</div>
  <ul>
    <li>This report is not a diagnostic tool</li>
    <li>It should be interpreted alongside clinical assessment and any additional testing</li>
    <li>Data accuracy depends on user consistency and memory</li>
  </ul>
</div>

<div class="callout">
  <div class="copy">
    <h4>Supporting patients and providers through better insights</h4>
    <p>
      Titra Health bridges the gap between visits by giving providers a clearer picture of how treatment
      is going day to day. Our goal is to make every appointment more efficient, informed, and supportive.
      All data is private, encrypted, and shared only with patient consent.
    </p>
    <ul>
      <li>Review medication, weight, and nutrition trends in one place</li>
      <li>Understand side effects and tolerability across the dose cycle</li>
      <li>Save time by starting each visit with the bigger picture</li>
    </ul>
    <span class="link">Learn more at titrahealth.io</span>
  </div>
  <div class="mark">
    <img src="${TITRA_LOGO_DATA_URI}" alt="Titra Health" />
    <span>Titra Health</span>
  </div>
</div>
</body>
</html>`;
}
