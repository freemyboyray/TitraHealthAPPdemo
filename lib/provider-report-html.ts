// ─── Provider Report HTML/PDF Builder ────────────────────────────────────────
// Generates print-friendly HTML with inline SVG charts for expo-print.
// Styled as a professional clinical document (monochrome, data-dense).

import type {
  ProviderReportData,
  ProviderReportConfig,
  ObservationItem,
  DiscussionItem,
  RtmSection,
} from './provider-report-data';

// ─── Clinical palette ────────────────────────────────────────────────────────

const PRIMARY = '#1a1a1a';
const SECONDARY = '#444';
const MUTED = '#777';
const BORDER = '#bbb';
const LIGHT_BG = '#f0f0f0';
const STATUS_GREEN = '#2d7a2d';
const STATUS_AMBER = '#b8860b';
const STATUS_RED = '#c0392b';
const INFO_BLUE = '#2c5282';
const CHART_DARK = '#333';
const CHART_MID = '#888';
const CHART_LIGHT = '#ddd';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(d: string): string {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return d; }
}

function formatDateShort(d: string): string {
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return d; }
}

function capitalize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function trendArrow(trend: string): string {
  if (trend === 'improving') return '↓ Improving';
  if (trend === 'worsening') return '↑ Worsening';
  return '→ Stable';
}

// ─── SVG Chart Builders ─────────────────────────────────────────────────────

function buildWeightChart(dataPoints: { date: string; weight: number }[], goalWeight: number | null): string {
  if (dataPoints.length < 2) return '';

  const W = 500, H = 160, PAD_L = 50, PAD_R = 20, PAD_T = 15, PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const weights = dataPoints.map(d => d.weight);
  let minW = Math.min(...weights);
  let maxW = Math.max(...weights);
  if (goalWeight != null) {
    minW = Math.min(minW, goalWeight);
    maxW = Math.max(maxW, goalWeight);
  }
  const range = maxW - minW || 10;
  minW -= range * 0.1;
  maxW += range * 0.1;

  function x(i: number): number { return PAD_L + (i / (dataPoints.length - 1)) * chartW; }
  function y(w: number): number { return PAD_T + (1 - (w - minW) / (maxW - minW)) * chartH; }

  const pathPoints = dataPoints.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.weight).toFixed(1)}`).join(' ');

  const step = Math.max(1, Math.floor(dataPoints.length / 5));
  const xLabels = dataPoints
    .filter((_, i) => i % step === 0 || i === dataPoints.length - 1)
    .map((d) => {
      const idx = dataPoints.indexOf(d);
      return `<text x="${x(idx).toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="${MUTED}" font-size="8" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">${formatDateShort(d.date)}</text>`;
    }).join('');

  const ySteps = 4;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const w = minW + (i / ySteps) * (maxW - minW);
    return `<text x="${PAD_L - 8}" y="${y(w).toFixed(1)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" font-size="8" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">${Math.round(w)}</text>`;
  }).join('');

  const gridLines = Array.from({ length: ySteps + 1 }, (_, i) => {
    const w = minW + (i / ySteps) * (maxW - minW);
    return `<line x1="${PAD_L}" y1="${y(w).toFixed(1)}" x2="${W - PAD_R}" y2="${y(w).toFixed(1)}" stroke="${CHART_LIGHT}" stroke-width="0.5"/>`;
  }).join('');

  const goalLine = goalWeight != null
    ? `<line x1="${PAD_L}" y1="${y(goalWeight).toFixed(1)}" x2="${W - PAD_R}" y2="${y(goalWeight).toFixed(1)}" stroke="${CHART_MID}" stroke-width="0.8" stroke-dasharray="4,3"/>
       <text x="${W - PAD_R + 4}" y="${y(goalWeight).toFixed(1)}" fill="${CHART_MID}" font-size="7" dominant-baseline="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">Goal</text>`
    : '';

  const dots = dataPoints.map((d, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(d.weight).toFixed(1)}" r="2.5" fill="${CHART_DARK}"/>`
  ).join('');

  return `
    <svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="margin: 8px 0;">
      ${gridLines}
      ${goalLine}
      <path d="${pathPoints}" fill="none" stroke="${CHART_DARK}" stroke-width="1.5"/>
      ${dots}
      ${xLabels}
      ${yLabels}
    </svg>`;
}

function buildAdherenceCalendar(doseHistory: { date: string }[], missedWindows: string[], start: string, end: string): string {
  const loggedDates = new Set(doseHistory.map(d => d.date));
  const missedSet = new Set(missedWindows);

  const allDates: { date: string; status: 'logged' | 'missed' | 'none' }[] = [];
  const cursor = new Date(start + 'T00:00:00');
  const endD = new Date(end + 'T00:00:00');
  while (cursor <= endD) {
    const ds = cursor.toISOString().slice(0, 10);
    if (loggedDates.has(ds)) allDates.push({ date: ds, status: 'logged' });
    else if (missedSet.has(ds)) allDates.push({ date: ds, status: 'missed' });
    cursor.setDate(cursor.getDate() + 1);
  }

  if (allDates.length === 0) return '<p style="color:#777; font-size:9pt;">No dose data available for this period.</p>';

  const SIZE = 12, GAP = 2;
  const displayDates = allDates.length > 30 ? allDates.slice(-30) : allDates;
  const W = displayDates.length * (SIZE + GAP);

  const rects = displayDates.map((d, i) => {
    const color = d.status === 'logged' ? CHART_DARK : d.status === 'missed' ? BORDER : '#eee';
    const xPos = i * (SIZE + GAP);
    return `<rect x="${xPos}" y="0" width="${SIZE}" height="${SIZE}" rx="1" fill="${color}"/>`;
  }).join('');

  return `
    <div style="margin: 6px 0;">
      <svg width="${W}" height="${SIZE + 2}" viewBox="0 0 ${W} ${SIZE + 2}" xmlns="http://www.w3.org/2000/svg">
        ${rects}
      </svg>
      <div style="font-size: 7pt; color: ${MUTED}; margin-top: 3px;">
        <span style="color:${CHART_DARK};">&#9632;</span> Administered &nbsp;
        <span style="color:${BORDER};">&#9632;</span> Missed &nbsp;
        ${displayDates.length < allDates.length ? `(last 30 of ${allDates.length} days shown)` : ''}
      </div>
    </div>`;
}

function buildSideEffectBars(weeklyBars: { week: string; count: number; avgSeverity: number }[]): string {
  if (weeklyBars.length === 0) return '';

  const W = 500, H = 90, PAD_L = 40, PAD_R = 10, PAD_T = 8, PAD_B = 22;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const maxCount = Math.max(...weeklyBars.map(b => b.count), 1);
  const barW = Math.min(28, (chartW / weeklyBars.length) * 0.65);
  const gap = chartW / weeklyBars.length;

  const bars = weeklyBars.map((b, i) => {
    const barH = (b.count / maxCount) * chartH;
    const xPos = PAD_L + i * gap + (gap - barW) / 2;
    const yPos = PAD_T + chartH - barH;
    // Use opacity to indicate severity — darker = more severe
    const opacity = 0.4 + (b.avgSeverity / 10) * 0.6;
    return `<rect x="${xPos.toFixed(1)}" y="${yPos.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="1" fill="${CHART_DARK}" fill-opacity="${opacity.toFixed(2)}"/>
            <text x="${(xPos + barW / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="${MUTED}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">Wk${i + 1}</text>`;
  }).join('');

  return `
    <svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="margin: 6px 0;">
      ${bars}
      <text x="${PAD_L - 5}" y="${PAD_T + 5}" text-anchor="end" fill="${MUTED}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">${maxCount}</text>
      <text x="${PAD_L - 5}" y="${PAD_T + chartH}" text-anchor="end" fill="${MUTED}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">0</text>
    </svg>
    <div style="font-size:7pt; color:${MUTED}; margin-top:2px;">Bar opacity indicates average severity</div>`;
}

function buildNutritionChart(weeklyTrend: { week: string; avgCalories: number; avgProtein: number }[], calTarget: number, proTarget: number): string {
  if (weeklyTrend.length < 2) return '';

  const W = 500, H = 130, PAD_L = 50, PAD_R = 20, PAD_T = 15, PAD_B = 22;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const calPcts = weeklyTrend.map(w => (w.avgCalories / calTarget) * 100);
  const proPcts = weeklyTrend.map(w => (w.avgProtein / proTarget) * 100);
  const maxPct = Math.max(...calPcts, ...proPcts, 110);
  const minPct = Math.min(...calPcts, ...proPcts, 50);

  function x(i: number): number { return PAD_L + (i / (weeklyTrend.length - 1)) * chartW; }
  function y(pct: number): number { return PAD_T + (1 - (pct - minPct) / (maxPct - minPct)) * chartH; }

  const calPath = calPcts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const proPath = proPcts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');

  const targetLine = `<line x1="${PAD_L}" y1="${y(100).toFixed(1)}" x2="${W - PAD_R}" y2="${y(100).toFixed(1)}" stroke="${CHART_LIGHT}" stroke-width="0.8" stroke-dasharray="4,3"/>
    <text x="${W - PAD_R + 4}" y="${y(100).toFixed(1)}" fill="${MUTED}" font-size="7" dominant-baseline="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">100%</text>`;

  const xLabels = weeklyTrend.map((w, i) =>
    `<text x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="${MUTED}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">Wk${i + 1}</text>`
  ).join('');

  return `
    <svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="margin: 6px 0;">
      ${targetLine}
      <path d="${calPath}" fill="none" stroke="${CHART_MID}" stroke-width="1" stroke-dasharray="3,2"/>
      <path d="${proPath}" fill="none" stroke="${CHART_DARK}" stroke-width="1.5"/>
      ${xLabels}
      <text x="${PAD_L + 5}" y="${PAD_T - 3}" fill="${CHART_DARK}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">— Protein (% target)</text>
      <text x="${PAD_L + 110}" y="${PAD_T - 3}" fill="${CHART_MID}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">-- Calories (% target)</text>
    </svg>`;
}

function buildStepsChart(weeklySteps: { week: string; avgSteps: number }[], target: number): string {
  if (weeklySteps.length === 0) return '';

  const W = 500, H = 90, PAD_L = 50, PAD_R = 10, PAD_T = 8, PAD_B = 22;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const maxSteps = Math.max(...weeklySteps.map(w => w.avgSteps), target);
  const barW = Math.min(28, (chartW / weeklySteps.length) * 0.65);
  const gap = chartW / weeklySteps.length;

  const bars = weeklySteps.map((w, i) => {
    const barH = (w.avgSteps / maxSteps) * chartH;
    const xPos = PAD_L + i * gap + (gap - barW) / 2;
    const yPos = PAD_T + chartH - barH;
    return `<rect x="${xPos.toFixed(1)}" y="${yPos.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="1" fill="${CHART_DARK}" fill-opacity="0.7"/>
            <text x="${(xPos + barW / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle" fill="${MUTED}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">Wk${i + 1}</text>`;
  }).join('');

  const targetY = PAD_T + chartH - (target / maxSteps) * chartH;
  const targetLine = `<line x1="${PAD_L}" y1="${targetY.toFixed(1)}" x2="${W - PAD_R}" y2="${targetY.toFixed(1)}" stroke="${CHART_MID}" stroke-width="0.8" stroke-dasharray="4,3"/>
    <text x="${W - PAD_R + 4}" y="${targetY.toFixed(1)}" fill="${MUTED}" font-size="7" dominant-baseline="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">Target</text>`;

  return `
    <svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="margin: 6px 0;">
      ${targetLine}
      ${bars}
    </svg>`;
}

// ─── SOAP Section Builders ───────────────────────────────────────────────────

function soapHeader(label: string): string {
  return `
    <div style="margin: 22px 0 10px; border-bottom: 1.5px solid ${PRIMARY}; padding-bottom: 4px;">
      <div style="font-size: 11pt; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: ${PRIMARY};">
        ${label}
      </div>
    </div>`;
}

function subHeader(label: string): string {
  return `
    <div style="margin: 12px 0 4px; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: ${SECONDARY};">
      ${label}
    </div>`;
}

function buildSoapHeader(data: ProviderReportData, config: ProviderReportConfig): string {
  const { patient, medication, dateRange } = data;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const ageSex = [
    patient.age != null ? `${patient.age}` : null,
    patient.sex && patient.sex !== 'Not specified' ? capitalize(patient.sex)[0] : null,
  ].filter(Boolean).join('');

  const bannerLine = [
    esc(patient.name) || 'Patient',
    ageSex || null,
    patient.bmi != null ? `BMI ${patient.bmi} (${esc(patient.bmiClass)})` : null,
    patient.programWeek != null ? `Program week ${patient.programWeek}` : null,
  ].filter(Boolean).join(' \u00b7 ');

  const medLine = (medication.type || medication.brand)
    ? `${esc(capitalize(medication.type ?? ''))}${medication.brand ? ` (${esc(medication.brand)})` : ''}` +
      `${medication.currentDose ? ` \u00b7 ${medication.currentDose} mg` : ''}` +
      ` \u00b7 ${esc(medication.route)} \u00b7 ${esc(medication.frequency.toLowerCase())}`
    : null;

  const heightStartGoal = [
    `Height ${esc(patient.heightDisplay)}`,
    patient.startWeight != null ? `Start ${patient.startWeight.toFixed(1)} lbs` : null,
    patient.currentWeight != null ? `Current ${patient.currentWeight.toFixed(1)} lbs` : null,
    patient.goalWeight != null ? `Goal ${patient.goalWeight.toFixed(1)} lbs` : null,
  ].filter(Boolean).join(' \u00b7 ');

  let providerBlock = '';
  if (config.providerName) {
    providerBlock = `
      <div style="font-size:8pt; color:${SECONDARY}; margin-top:4px;">
        Prepared for ${esc(config.providerName)}${config.practiceName ? ` \u00b7 ${esc(config.practiceName)}` : ''}
      </div>`;
  }

  return `
    <div style="margin-bottom: 12px;">
      <div style="border-bottom: 2px solid ${PRIMARY}; padding-bottom: 10px;">
        <div style="font-size: 14pt; font-weight: 800; letter-spacing: 0.3px; color: ${PRIMARY};">
          Patient Progress Report
        </div>
        <div style="font-size: 7.5pt; color: ${MUTED}; margin-top: 2px;">
          Generated by TitraHealth \u00b7 ${today}
        </div>
      </div>

      <div style="margin-top:10px; font-size:10pt; font-weight:700; color:${PRIMARY};">
        ${bannerLine}
      </div>
      ${medLine ? `<div style="margin-top:3px; font-size:9pt; color:${SECONDARY};">${medLine}</div>` : ''}
      ${heightStartGoal ? `<div style="margin-top:3px; font-size:8.5pt; color:${MUTED};">${heightStartGoal}</div>` : ''}

      <div style="margin-top:8px; padding:5px 9px; background:${LIGHT_BG}; border:0.5px solid ${BORDER}; font-size:9pt;">
        <strong>Report period:</strong> ${formatDate(dateRange.start)} – ${formatDate(dateRange.end)} (${dateRange.totalDays} days)
      </div>
      ${providerBlock}
    </div>`;
}

// ── Subjective ──────────────────────────────────────────────────────────────

function buildSubjectiveSection(data: ProviderReportData): string {
  const parts: string[] = [soapHeader('Subjective')];

  // Side effects table
  const se = data.sideEffects;
  if (se.totalEvents === 0) {
    parts.push(`${subHeader('Side Effects')}<p style="color:${MUTED}; font-size:9pt; margin: 4px 0;">No side effects logged during this period.</p>`);
  } else {
    parts.push(subHeader('Side Effects'));
    parts.push(`
      <table>
        <tr><th>Type</th><th>Events</th><th>Avg severity</th><th>Max</th><th>Within-period change</th></tr>
        ${se.byType.map(r => `
          <tr>
            <td>${capitalize(r.type)}</td>
            <td>${r.count}</td>
            <td>${r.avgSeverity}/10</td>
            <td>${r.maxSeverity}/10</td>
            <td>${trendArrow(r.trend)}</td>
          </tr>`).join('')}
      </table>
      <div style="font-size: 8.5pt; color: ${MUTED}; margin: 4px 0;">
        Severity distribution \u2014 mild (1\u20133): ${se.severityDistribution.mild} \u00b7 moderate (4\u20136): ${se.severityDistribution.moderate} \u00b7 severe (7\u201310): ${se.severityDistribution.severe}
      </div>`);
  }

  // Patient-reported check-in scores
  const LABELS: Record<string, string> = {
    foodNoise: 'Food noise',
    appetite: 'Appetite',
    energyMood: 'Energy & mood',
    giBurden: 'GI symptoms',
    activityQuality: 'Activity quality',
    sleepQuality: 'Sleep quality',
    mentalHealth: 'Mental health',
  };
  const entries = Object.entries(data.checkins.latestScores).filter(([, v]) => v != null);
  if (entries.length > 0) {
    parts.push(subHeader('Patient self-ratings (most recent in period)'));
    parts.push(`
      <table>
        <tr><th>Category</th><th>Score</th></tr>
        ${entries.map(([key, score]) => `
          <tr>
            <td>${LABELS[key] ?? key}</td>
            <td>${score}/100</td>
          </tr>`).join('')}
      </table>
      <div style="font-size: 7.5pt; color: ${MUTED}; margin-top: 3px;">
        Self-rated 0\u2013100. Higher values indicate the patient described that area as going better.
      </div>`);
  }

  // Food noise sparkline (if 3+ entries)
  const fnHistory = data.checkins.foodNoiseHistory;
  if (fnHistory.length >= 3) {
    parts.push(subHeader('Food noise self-rating over period'));
    parts.push(buildFoodNoiseSparkline(fnHistory));
  }

  return parts.join('\n');
}

function buildFoodNoiseSparkline(history: { date: string; score: number }[]): string {
  if (history.length < 2) return '';
  const W = 500, H = 80, PAD_L = 35, PAD_R = 20, PAD_T = 10, PAD_B = 22;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const minS = 0;
  const maxS = 100;
  function x(i: number): number { return PAD_L + (i / (history.length - 1)) * chartW; }
  function y(s: number): number { return PAD_T + (1 - (s - minS) / (maxS - minS)) * chartH; }

  const path = history.map((h, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(h.score).toFixed(1)}`).join(' ');
  const dots = history.map((h, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(h.score).toFixed(1)}" r="2" fill="${CHART_DARK}"/>`
  ).join('');

  const yLabels = [0, 50, 100].map(v =>
    `<text x="${PAD_L - 6}" y="${y(v).toFixed(1)}" text-anchor="end" dominant-baseline="middle" fill="${MUTED}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">${v}</text>`
  ).join('');

  const firstDate = formatDateShort(history[0].date);
  const lastDate = formatDateShort(history[history.length - 1].date);

  return `
    <svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="margin: 4px 0;">
      <line x1="${PAD_L}" y1="${y(50).toFixed(1)}" x2="${W - PAD_R}" y2="${y(50).toFixed(1)}" stroke="${CHART_LIGHT}" stroke-width="0.5" stroke-dasharray="3,2"/>
      <path d="${path}" fill="none" stroke="${CHART_DARK}" stroke-width="1.4"/>
      ${dots}
      ${yLabels}
      <text x="${PAD_L}" y="${H - 4}" fill="${MUTED}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">${firstDate}</text>
      <text x="${W - PAD_R}" y="${H - 4}" text-anchor="end" fill="${MUTED}" font-size="7" font-family="Helvetica Neue, Helvetica, Arial, sans-serif">${lastDate}</text>
    </svg>`;
}

// ── Objective ───────────────────────────────────────────────────────────────

function buildObjectiveSection(data: ProviderReportData, config: ProviderReportConfig): string {
  const parts: string[] = [soapHeader('Objective')];

  // Weight
  const w = data.weight;
  parts.push(subHeader('Weight'));
  const wRows = [
    ['Start of period', w.startOfPeriod != null ? `${w.startOfPeriod.toFixed(1)} lbs` : '\u2014'],
    ['End of period', w.endOfPeriod != null ? `${w.endOfPeriod.toFixed(1)} lbs` : '\u2014'],
    ['Period change', w.deltaLbs != null ? `${w.deltaLbs > 0 ? '+' : ''}${w.deltaLbs.toFixed(1)} lbs${w.deltaPct != null ? ` (${w.deltaPct > 0 ? '+' : ''}${w.deltaPct}%)` : ''}` : '\u2014'],
    ['Since program start', w.totalLossFromBaseline != null ? `${w.totalLossFromBaseline > 0 ? '+' : ''}${w.totalLossFromBaseline.toFixed(1)} lbs${w.totalLossPct != null ? ` (${w.totalLossPct > 0 ? '+' : ''}${w.totalLossPct}%)` : ''}` : '\u2014'],
    ['Weekly rate', w.weeklyRateLbs != null ? `${w.weeklyRateLbs >= 0 ? '+' : ''}${w.weeklyRateLbs.toFixed(1)} lbs/week` : '\u2014'],
    ['BMI', w.bmi != null ? `${w.bmi} (${w.bmiClass})` : '\u2014'],
  ];
  parts.push(`
    <table>
      ${wRows.map(([l, v]) => `<tr><td style="width:40%;">${l}</td><td>${v}</td></tr>`).join('')}
    </table>`);
  parts.push(buildWeightChart(w.dataPoints, data.patient.goalWeight));

  // Biometrics
  const b = data.biometrics;
  const bMetrics = [
    { label: 'Resting heart rate', value: b.restingHR, unit: 'bpm', range: '60\u2013100' },
    { label: 'Heart rate variability', value: b.hrv, unit: 'ms', range: '20\u201380' },
    { label: 'Sleep duration', value: b.sleepHours, unit: 'hrs/night', range: '7\u20139' },
    { label: 'Blood glucose', value: b.bloodGlucose, unit: 'mg/dL', range: '70\u2013100 (fasting)' },
    { label: 'SpO\u2082', value: b.spo2, unit: '%', range: '95\u2013100' },
  ].filter(m => m.value != null);
  if (bMetrics.length > 0) {
    parts.push(subHeader('Biometrics (Apple Health / Health Connect)'));
    parts.push(`
      <table>
        <tr><th>Metric</th><th>Value</th><th>Unit</th><th>Reference range</th></tr>
        ${bMetrics.map(m => `
          <tr>
            <td>${m.label}</td>
            <td style="font-weight:700;">${m.value}</td>
            <td>${m.unit}</td>
            <td>${m.range}</td>
          </tr>`).join('')}
      </table>`);
  }

  // Nutrition
  const n = data.nutrition;
  parts.push(subHeader(`Nutrition \u00b7 logged ${n.daysLogged} of ${n.totalDays} days (${n.loggingPct}%)`));
  const nMetrics: [string, number | null, number, string][] = [
    ['Calories', n.averages.calories, n.targets.calories, 'kcal'],
    ['Protein', n.averages.protein, n.targets.protein, 'g'],
    ['Carbs', n.averages.carbs, n.targets.carbs, 'g'],
    ['Fat', n.averages.fat, n.targets.fat, 'g'],
    ['Fiber', n.averages.fiber, n.targets.fiber, 'g'],
  ];
  parts.push(`
    <table>
      <tr><th>Metric</th><th>Daily average</th><th>Target</th><th>% of target</th></tr>
      ${nMetrics.map(([label, avg, target, unit]) => {
        const pct = avg != null && target > 0 ? Math.round((avg / target) * 100) : null;
        return `<tr>
          <td>${label}</td>
          <td>${avg != null ? avg + ' ' + unit : '\u2014'}</td>
          <td>${target} ${unit}</td>
          <td>${pct != null ? pct + '%' : '\u2014'}</td>
        </tr>`;
      }).join('')}
    </table>`);
  if (n.weeklyTrend.length >= 2) {
    parts.push(buildNutritionChart(n.weeklyTrend, n.targets.calories, n.targets.protein));
  }

  // Activity
  const a = data.activity;
  parts.push(subHeader('Activity'));
  parts.push(`
    <table>
      <tr><th>Avg daily steps</th><th>Target</th><th>Active days</th><th>Exercise sessions</th></tr>
      <tr>
        <td style="font-weight:700;">${a.avgDailySteps?.toLocaleString() ?? '\u2014'}</td>
        <td>${a.stepsTarget.toLocaleString()}</td>
        <td>${a.activeDays} / ${a.totalDays}</td>
        <td>${a.exerciseSessions}</td>
      </tr>
    </table>`);
  if (a.exerciseByType.length > 0) {
    parts.push(`
      <div style="margin-top:6px;">
        <table>
          <tr><th>Exercise type</th><th>Sessions</th><th>Avg duration</th></tr>
          ${a.exerciseByType.map(e => `
            <tr>
              <td>${capitalize(e.type)}</td>
              <td>${e.count}</td>
              <td>${e.avgDuration} min</td>
            </tr>`).join('')}
        </table>
      </div>`);
  }
  if (a.weeklySteps.length > 0) {
    parts.push(buildStepsChart(a.weeklySteps, a.stepsTarget));
  }

  // Adherence
  const ad = data.adherence;
  parts.push(subHeader('Medication adherence'));
  parts.push(`
    <table>
      <tr><th>Doses logged</th><th>Expected windows</th><th>Logged ratio</th><th>Windows without log</th></tr>
      <tr>
        <td>${ad.loggedDoses}</td>
        <td>${ad.expectedDoses}</td>
        <td style="font-weight:700;">${ad.adherencePct}%</td>
        <td>${ad.missedWindows.length}</td>
      </tr>
    </table>`);
  parts.push(buildAdherenceCalendar(ad.doseHistory, ad.missedWindows, config.dateRange.start, config.dateRange.end));
  if (ad.doseHistory.length > 0) {
    const rows = ad.doseHistory.map(d => `
      <tr>
        <td>${formatDateShort(d.date)}</td>
        <td>${d.dose} mg</td>
        <td>${capitalize(d.site ?? '\u2014')}</td>
        <td>${capitalize(d.medication ?? '\u2014')}</td>
      </tr>`).join('');
    parts.push(`
      <div style="margin-top:6px;">
        <table>
          <tr><th>Date</th><th>Dose</th><th>Site</th><th>Medication</th></tr>
          ${rows}
        </table>
      </div>`);
  }

  return parts.join('\n');
}

// ── Assessment ──────────────────────────────────────────────────────────────

function buildAssessmentSection(
  observations: ObservationItem[],
  narrativeProse: string | null,
): string {
  const parts: string[] = [soapHeader('Assessment')];

  if (narrativeProse) {
    parts.push(`
      <div style="font-size:9.5pt; line-height:1.55; color:${SECONDARY}; margin: 6px 0 12px;">
        ${esc(narrativeProse)}
      </div>
      <div style="font-size:7pt; color:${MUTED}; margin-bottom: 8px; font-style: italic;">
        Narrative summary AI-polished from the observations below. All observations are derived deterministically from logged data.
      </div>`);
  }

  if (observations.length === 0) {
    parts.push(`<p style="color:${MUTED}; font-size:9pt; margin: 6px 0;">No notable observations from the rule set for this period.</p>`);
  } else {
    parts.push(subHeader('Structured observations'));
    parts.push(`
      <table>
        <tr><th style="width:70px;"></th><th>Observation</th></tr>
        ${observations.map(o => {
          const isWarn = o.severity === 'warning';
          const icon = isWarn ? '\u26a0' : '\u25c6';
          const color = isWarn ? STATUS_AMBER : INFO_BLUE;
          return `<tr>
            <td style="font-weight:700; color:${color}; text-align:center;">${icon}</td>
            <td>${esc(o.text)}</td>
          </tr>`;
        }).join('')}
      </table>
      <div style="font-size:7pt; color:${MUTED}; margin-top:4px; font-style: italic;">
        Observations describe what the patient-logged data shows for this period. They are not clinical recommendations.
      </div>`);
  }

  return parts.join('\n');
}

// ── Discussion (replaces traditional SOAP "Plan") ──────────────────────────

function buildDiscussionSection(items: DiscussionItem[]): string {
  if (items.length === 0) {
    return [
      soapHeader('Topics that came up this period'),
      `<p style="color:${MUTED}; font-size:9pt; margin: 6px 0;">No within-period changes large enough to surface for discussion.</p>`,
    ].join('\n');
  }

  return [
    soapHeader('Topics that came up this period'),
    `<ul style="margin: 6px 0; padding-left: 18px; font-size:9.5pt; line-height:1.6; color:${SECONDARY};">
      ${items.map(i => `<li>${esc(i.text)}</li>`).join('')}
    </ul>`,
    `<div style="font-size:7pt; color:${MUTED}; margin-top:4px; font-style: italic;">
      Items in this list are observation-driven prompts from the data \u2014 not directives or recommendations.
    </div>`,
  ].join('\n');
}

// ─── Main builder ────────────────────────────────────────────────────────────

function buildClinicianContext(rtm: RtmSection): string {
  return `<h2>Clinician Context</h2>
<table>
  <tr>
    <th style="width:35%;">Linked Clinician</th>
    <td>${esc(rtm.clinicianName ?? '—')}</td>
  </tr>
  <tr>
    <th>Reporting Period</th>
    <td>${formatDate(rtm.periodStart)} – ${formatDate(rtm.periodEnd)}</td>
  </tr>
  <tr>
    <th>Days With Patient-Logged Data</th>
    <td><strong>${rtm.engagementDays}</strong> distinct days within the reporting period</td>
  </tr>
</table>
<p style="font-size:8pt; color:${MUTED}; margin-top:6px; line-height:1.5;">
  Days-with-data reflects distinct calendar days on which the patient logged at least one of:
  medication injection, food intake, weight, side effect, food-noise check-in, weekly check-in,
  journal entry, mindfulness session, or manual activity. Provided as informational context for
  clinical review only.
</p>`;
}

export function buildProviderReportHtml(
  data: ProviderReportData,
  config: ProviderReportConfig,
  _legacyAiSummary: string | null,
  assessmentNarrative: string | null,
): string {
  const sections: string[] = [];

  // Patient header
  sections.push(buildSoapHeader(data, config));

  // Clinician context block — appears immediately after the patient header
  // when the patient has linked a clinician. Informational only.
  if (data.rtm?.enabled) {
    sections.push(buildClinicianContext(data.rtm));
  }

  // SOAP body
  sections.push(buildSubjectiveSection(data));
  sections.push(buildObjectiveSection(data, config));
  sections.push(buildAssessmentSection(data.narrative.assessment, assessmentNarrative));
  sections.push(buildDiscussionSection(data.narrative.discussion));

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { margin: 0.6in 0.75in; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: ${PRIMARY};
    font-size: 10pt;
    line-height: 1.35;
    margin: 0;
    padding: 0;
  }
  h2 {
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: ${PRIMARY};
    border-bottom: 1.5px solid ${PRIMARY};
    padding-bottom: 3px;
    margin: 18px 0 8px;
    page-break-after: avoid;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
    margin: 4px 0;
  }
  td, th {
    text-align: left;
    padding: 4px 6px;
    border: 0.5px solid ${BORDER};
    vertical-align: top;
  }
  th {
    font-weight: 700;
    background: ${LIGHT_BG};
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: ${SECONDARY};
  }
  ul { margin: 0; padding-left: 16px; }
  li { margin-bottom: 2px; }
</style>
</head>
<body>
${sections.join('\n')}

<footer style="margin-top:30px; padding-top:10px; border-top:0.5px solid ${MUTED}; font-size:7.5pt; color:${MUTED}; line-height:1.5;">
  <table style="width:100%; border:none; font-size:7.5pt; color:${MUTED};">
    <tr>
      <td style="border:none; padding:0;">Generated: ${today}</td>
      <td style="border:none; padding:0; text-align:center; font-weight:700;">CONFIDENTIAL — Patient Health Information</td>
      <td style="border:none; padding:0; text-align:right;">TitraHealth</td>
    </tr>
  </table>
  <div style="text-align:center; font-size:7pt; color:#999; margin-top:4px;">
    This report contains patient-generated, self-reported data and is not a substitute for clinical assessment.<br/>
    Data accuracy depends on patient logging compliance. Verify all findings with clinical evaluation.
  </div>
</footer>
</body>
</html>`;
}
