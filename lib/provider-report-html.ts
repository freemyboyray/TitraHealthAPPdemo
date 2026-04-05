// ─── Provider Report HTML/PDF Builder ────────────────────────────────────────
// Generates print-friendly HTML with inline SVG charts for expo-print.
// Styled as a professional clinical document (monochrome, data-dense).

import type {
  ProviderReportData,
  ProviderReportConfig,
  WeightSection,
  AdherenceSection,
  SideEffectSection,
  NutritionSection,
  ActivitySection,
  BiometricsSection,
  CheckinSection,
  ClinicalFlag,
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

function pctStatus(pct: number): { color: string; label: string } {
  if (pct >= 90) return { color: STATUS_GREEN, label: 'On Target' };
  if (pct >= 70) return { color: STATUS_AMBER, label: 'Below Target' };
  return { color: STATUS_RED, label: 'Low' };
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

// ─── Section Builders ────────────────────────────────────────────────────────

function buildHeaderSection(data: ProviderReportData, config: ProviderReportConfig): string {
  const { patient, medication, dateRange } = data;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const dobLine = patient.dob
    ? `${formatDate(patient.dob)}${patient.age ? ` (Age ${patient.age})` : ''}`
    : patient.age ? `${patient.age}` : '—';

  let providerBlock = '';
  if (config.providerName) {
    providerBlock = `
      <table style="margin-top:10px; font-size:9pt;">
        <tr><th colspan="2" style="text-align:left; background:${LIGHT_BG};">PREPARED FOR</th></tr>
        <tr>
          <td style="width:35%;"><strong>Provider</strong></td>
          <td>${esc(config.providerName)}</td>
        </tr>
        ${config.practiceName ? `<tr><td><strong>Practice</strong></td><td>${esc(config.practiceName)}</td></tr>` : ''}
      </table>`;
  }

  return `
    <div style="margin-bottom: 20px;">
      <div style="border-bottom: 2px solid ${PRIMARY}; padding-bottom: 10px; margin-bottom: 14px;">
        <div style="font-size: 16pt; font-weight: 700; letter-spacing: 1px; color: ${PRIMARY}; text-transform: uppercase;">Patient Progress Report</div>
        <div style="font-size: 7pt; color: ${MUTED}; margin-top: 2px; letter-spacing: 0.5px;">Generated by TitraHealth &middot; ${today}</div>
      </div>

      <table style="font-size: 9pt;">
        <tr><th colspan="4" style="text-align:left; background:${LIGHT_BG};">PATIENT DEMOGRAPHICS</th></tr>
        <tr>
          <td style="width:25%;"><strong>Name</strong></td>
          <td style="width:25%;">${esc(patient.name) || 'Not provided'}</td>
          <td style="width:25%;"><strong>DOB / Age</strong></td>
          <td style="width:25%;">${dobLine}</td>
        </tr>
        <tr>
          <td><strong>Sex</strong></td>
          <td>${esc(capitalize(patient.sex))}</td>
          <td><strong>Height</strong></td>
          <td>${esc(patient.heightDisplay)}</td>
        </tr>
        <tr>
          <td><strong>BMI</strong></td>
          <td>${patient.bmi ?? '—'} (${esc(patient.bmiClass)})</td>
          <td><strong>Program Start</strong></td>
          <td>${patient.programStartDate ? formatDate(patient.programStartDate) : '—'}</td>
        </tr>
        <tr>
          <td><strong>Start Weight</strong></td>
          <td>${patient.startWeight?.toFixed(1) ?? '—'} lbs</td>
          <td><strong>Current Weight</strong></td>
          <td>${patient.currentWeight?.toFixed(1) ?? '—'} lbs</td>
        </tr>
        <tr>
          <td><strong>Goal Weight</strong></td>
          <td>${patient.goalWeight?.toFixed(1) ?? '—'} lbs</td>
          <td><strong>Program Week</strong></td>
          <td>${patient.programWeek ?? '—'}</td>
        </tr>
      </table>

      <div style="margin-top:10px; padding:6px 10px; background:${LIGHT_BG}; border:0.5px solid ${BORDER}; font-size:9pt;">
        <strong>Report Period:</strong> ${formatDate(dateRange.start)} – ${formatDate(dateRange.end)} (${dateRange.totalDays} days)
      </div>

      ${providerBlock}
    </div>`;
}

function buildMedicationLine(data: ProviderReportData): string {
  const { medication } = data;
  if (!medication.type && !medication.brand) return '';

  return `
    <table style="margin-bottom: 16px; font-size: 9pt;">
      <tr><th colspan="5" style="text-align:left; background:${LIGHT_BG};">CURRENT MEDICATION</th></tr>
      <tr>
        <td><strong>Medication</strong><br/>${esc(capitalize(medication.type ?? '—'))} ${medication.brand ? `(${esc(medication.brand)})` : ''}</td>
        <td><strong>Dose</strong><br/>${medication.currentDose ? `${medication.currentDose} mg` : '—'}</td>
        <td><strong>Route</strong><br/>${esc(medication.route)}</td>
        <td><strong>Frequency</strong><br/>${esc(medication.frequency.toLowerCase())}</td>
        <td><strong>Initial Dose</strong><br/>${medication.initialDose ? `${medication.initialDose} mg` : '—'}</td>
      </tr>
    </table>`;
}

function buildExecutiveSummary(data: ProviderReportData, aiSummary: string | null): string {
  if (aiSummary) {
    return `
      <div style="border: 1px solid ${BORDER}; padding: 10px 14px; margin-bottom: 18px;">
        <div style="font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${PRIMARY}; margin-bottom: 6px;">Clinical Summary</div>
        <div style="font-size: 9pt; line-height: 1.5; color: ${SECONDARY};">${esc(aiSummary)}</div>
        <div style="font-size: 7pt; color: ${MUTED}; margin-top: 6px; font-style: italic;">AI-assisted narrative based on patient-reported data</div>
      </div>`;
  }

  // Auto-generated bullet summary
  const bullets: string[] = [];
  const w = data.weight;
  if (w.deltaLbs != null) {
    bullets.push(`<strong>Weight:</strong> ${w.deltaLbs > 0 ? '+' : ''}${w.deltaLbs.toFixed(1)} lbs (${w.deltaPct != null ? (w.deltaPct > 0 ? '+' : '') + w.deltaPct + '%' : ''}) over report period${w.totalLossPct != null ? ` | Total: ${w.totalLossPct > 0 ? '+' : ''}${w.totalLossPct}% since program start` : ''}`);
  }
  if (w.weeklyRateLbs != null) {
    bullets.push(`<strong>Rate:</strong> ${Math.abs(w.weeklyRateLbs).toFixed(1)} lbs/week ${w.weeklyRateLbs < 0 ? 'loss' : 'gain'}`);
  }
  bullets.push(`<strong>Adherence:</strong> ${data.adherence.adherencePct}% (${data.adherence.loggedDoses}/${data.adherence.expectedDoses} expected doses)`);
  if (data.nutrition.averages.protein != null) {
    bullets.push(`<strong>Protein:</strong> ${data.nutrition.averages.protein}g/day avg (${data.nutrition.proteinPct ?? '—'}% of target)`);
  }
  if (data.sideEffects.totalEvents > 0) {
    const topTypes = data.sideEffects.byType.slice(0, 3).map(t => capitalize(t.type)).join(', ');
    bullets.push(`<strong>Side Effects:</strong> ${data.sideEffects.totalEvents} events — ${topTypes}`);
  }

  return `
    <div style="border: 1px solid ${BORDER}; padding: 10px 14px; margin-bottom: 18px;">
      <div style="font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${PRIMARY}; margin-bottom: 6px;">Summary</div>
      <ul style="margin: 0; padding-left: 16px; font-size: 9pt; line-height: 1.7; color: ${SECONDARY};">
        ${bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>
    </div>`;
}

function buildWeightSection(data: WeightSection, goalWeight: number | null): string {
  const rows = [
    ['Start of Period', data.startOfPeriod != null ? `${data.startOfPeriod.toFixed(1)} lbs` : '—'],
    ['End of Period', data.endOfPeriod != null ? `${data.endOfPeriod.toFixed(1)} lbs` : '—'],
    ['Period Change', data.deltaLbs != null ? `${data.deltaLbs > 0 ? '+' : ''}${data.deltaLbs.toFixed(1)} lbs (${data.deltaPct != null ? (data.deltaPct > 0 ? '+' : '') + data.deltaPct + '%' : ''})` : '—'],
    ['Total Program Loss', data.totalLossFromBaseline != null ? `${data.totalLossFromBaseline > 0 ? '+' : ''}${data.totalLossFromBaseline.toFixed(1)} lbs (${data.totalLossPct != null ? (data.totalLossPct > 0 ? '+' : '') + data.totalLossPct + '%' : ''})` : '—'],
    ['Weekly Rate', data.weeklyRateLbs != null ? `${Math.abs(data.weeklyRateLbs).toFixed(1)} lbs/wk ${data.weeklyRateLbs < 0 ? 'loss' : 'gain'}` : '—'],
    ['BMI', data.bmi != null ? `${data.bmi} (${data.bmiClass})` : '—'],
  ];

  const table = `
    <table>
      <tr><th style="width:50%;">Metric</th><th>Value</th></tr>
      ${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('')}
    </table>`;

  const chart = buildWeightChart(data.dataPoints, goalWeight);
  const flags = buildFlagBoxes(data.flags);

  return sectionWrapper('Weight Trend', table + chart + flags);
}

function buildAdherenceSection(data: AdherenceSection, config: ProviderReportConfig): string {
  const { color, label } = pctStatus(data.adherencePct);

  const summary = `
    <table>
      <tr><th>Adherence Rate</th><th>Doses Logged</th><th>Expected Doses</th><th>Missed Windows</th><th>Status</th></tr>
      <tr>
        <td style="font-weight:700;">${data.adherencePct}%</td>
        <td>${data.loggedDoses}</td>
        <td>${data.expectedDoses}</td>
        <td>${data.missedWindows.length}</td>
        <td style="color:${color};">${label}</td>
      </tr>
    </table>`;

  const calendar = buildAdherenceCalendar(data.doseHistory, data.missedWindows, config.dateRange.start, config.dateRange.end);

  let doseTable = '';
  if (data.doseHistory.length > 0) {
    const rows = data.doseHistory.map(d => `
      <tr>
        <td>${formatDateShort(d.date)}</td>
        <td>${d.dose} mg</td>
        <td>${capitalize(d.site ?? '—')}</td>
        <td>${capitalize(d.medication ?? '—')}</td>
      </tr>`).join('');

    doseTable = `
      <div style="font-size:8pt; font-weight:700; color:${PRIMARY}; margin-top:10px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.3px;">Dose History</div>
      <table>
        <tr><th>Date</th><th>Dose</th><th>Site</th><th>Medication</th></tr>
        ${rows}
      </table>`;
  }

  const flags = buildFlagBoxes(data.flags);

  return sectionWrapper('Medication Adherence', summary + calendar + doseTable + flags);
}

function buildSideEffectSection(data: SideEffectSection): string {
  if (data.totalEvents === 0) {
    return sectionWrapper('Side Effect Profile', '<p style="color:#777; font-size:9pt;">No side effects reported during this period.</p>');
  }

  const table = `
    <table>
      <tr><th>Type</th><th>Count</th><th>Avg Severity</th><th>Max Severity</th><th>Trend</th></tr>
      ${data.byType.map(r => `
        <tr>
          <td>${capitalize(r.type)}</td>
          <td>${r.count}</td>
          <td>${r.avgSeverity}/10</td>
          <td>${r.maxSeverity}/10</td>
          <td>${trendArrow(r.trend)}</td>
        </tr>`).join('')}
    </table>`;

  const dist = `
    <div style="font-size: 9pt; color: ${SECONDARY}; margin: 6px 0;">
      <strong>Severity Distribution:</strong>
      Mild (1–3): ${data.severityDistribution.mild} &middot;
      Moderate (4–6): ${data.severityDistribution.moderate} &middot;
      Severe (7–10): ${data.severityDistribution.severe}
    </div>`;

  const chart = buildSideEffectBars(data.weeklyBars);
  const flags = buildFlagBoxes(data.flags);

  return sectionWrapper('Side Effect Profile', table + dist + chart + flags);
}

function buildNutritionSection(data: NutritionSection): string {
  const compliance = `
    <div style="font-size: 9pt; color: ${SECONDARY}; margin-bottom: 6px;">
      Logging compliance: ${data.daysLogged} of ${data.totalDays} days (${data.loggingPct}%)
    </div>`;

  const metrics: [string, number | null, number, string][] = [
    ['Calories', data.averages.calories, data.targets.calories, 'kcal'],
    ['Protein', data.averages.protein, data.targets.protein, 'g'],
    ['Carbs', data.averages.carbs, data.targets.carbs, 'g'],
    ['Fat', data.averages.fat, data.targets.fat, 'g'],
    ['Fiber', data.averages.fiber, data.targets.fiber, 'g'],
  ];

  const table = `
    <table>
      <tr><th>Metric</th><th>Daily Average</th><th>Target</th><th>% of Target</th><th>Status</th></tr>
      ${metrics.map(([label, avg, target, unit]) => {
        const pct = avg != null && target > 0 ? Math.round((avg / target) * 100) : null;
        const status = pct != null ? pctStatus(pct) : null;
        return `<tr>
          <td>${label}</td>
          <td>${avg != null ? avg + ' ' + unit : '—'}</td>
          <td>${target} ${unit}</td>
          <td>${pct != null ? pct + '%' : '—'}</td>
          <td style="color: ${status ? status.color : MUTED};">${status ? status.label : ''}</td>
        </tr>`;
      }).join('')}
    </table>`;

  const chart = buildNutritionChart(data.weeklyTrend, data.targets.calories, data.targets.protein);
  const flags = buildFlagBoxes(data.flags);

  return sectionWrapper('Nutrition Summary', compliance + table + chart + flags);
}

function buildActivitySection(data: ActivitySection): string {
  const stepsPct = data.avgDailySteps != null && data.stepsTarget > 0
    ? Math.round((data.avgDailySteps / data.stepsTarget) * 100) : null;
  const stepsStatus = stepsPct != null ? pctStatus(stepsPct) : null;

  const summary = `
    <table>
      <tr><th>Avg Daily Steps</th><th>Target</th><th>% of Target</th><th>Active Days</th><th>Exercise Sessions</th></tr>
      <tr>
        <td style="font-weight:700;">${data.avgDailySteps?.toLocaleString() ?? '—'}</td>
        <td>${data.stepsTarget.toLocaleString()}</td>
        <td style="color:${stepsStatus ? stepsStatus.color : MUTED};">${stepsPct != null ? stepsPct + '%' : '—'}</td>
        <td>${data.activeDays} / ${data.totalDays}</td>
        <td>${data.exerciseSessions}</td>
      </tr>
    </table>`;

  let exerciseTable = '';
  if (data.exerciseByType.length > 0) {
    exerciseTable = `
      <div style="font-size:8pt; font-weight:700; color:${PRIMARY}; margin-top:10px; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.3px;">Exercise Breakdown</div>
      <table>
        <tr><th>Type</th><th>Sessions</th><th>Avg Duration</th></tr>
        ${data.exerciseByType.map(e => `
          <tr>
            <td>${capitalize(e.type)}</td>
            <td>${e.count}</td>
            <td>${e.avgDuration} min</td>
          </tr>`).join('')}
      </table>`;
  }

  const chart = buildStepsChart(data.weeklySteps, data.stepsTarget);
  const flags = buildFlagBoxes(data.flags);

  return sectionWrapper('Activity & Exercise', summary + exerciseTable + chart + flags);
}

function buildBiometricsSection(data: BiometricsSection): string {
  const metrics = [
    { label: 'Resting Heart Rate', value: data.restingHR, unit: 'bpm', range: '60–100' },
    { label: 'Heart Rate Variability', value: data.hrv, unit: 'ms', range: '20–80' },
    { label: 'Sleep Duration', value: data.sleepHours, unit: 'hrs/night', range: '7–9' },
    { label: 'Blood Glucose', value: data.bloodGlucose, unit: 'mg/dL', range: '70–100 (fasting)' },
    { label: 'SpO2', value: data.spo2, unit: '%', range: '95–100' },
  ].filter(m => m.value != null);

  if (metrics.length === 0) {
    return sectionWrapper('Biometrics', '<p style="color:#777; font-size:9pt;">No biometric data available. Connect Apple Health for HealthKit integration.</p>');
  }

  const table = `
    <table>
      <tr><th>Metric</th><th>Value</th><th>Unit</th><th>Reference Range</th></tr>
      ${metrics.map(m => `
        <tr>
          <td>${m.label}</td>
          <td style="font-weight:700;">${m.value}</td>
          <td>${m.unit}</td>
          <td>${m.range}</td>
        </tr>`).join('')}
    </table>`;

  return sectionWrapper('Biometrics (Apple Health)', table);
}

function buildCheckinsSection(data: CheckinSection): string {
  const LABELS: Record<string, string> = {
    foodNoise: 'Food Noise',
    appetite: 'Appetite',
    energyMood: 'Energy & Mood',
    giBurden: 'GI Symptoms',
    activityQuality: 'Activity',
    sleepQuality: 'Sleep',
    mentalHealth: 'Mental Health',
  };

  const entries = Object.entries(data.latestScores).filter(([, v]) => v != null);
  if (entries.length === 0) {
    return sectionWrapper('Patient-Reported Outcomes', '<p style="color:#777; font-size:9pt;">No check-in data available.</p>');
  }

  const table = `
    <table>
      <tr><th>Category</th><th>Latest Score</th><th>Status</th></tr>
      ${entries.map(([key, score]) => {
        const status = score! >= 70 ? 'Good' : score! >= 50 ? 'Fair' : 'Needs Attention';
        const color = score! >= 70 ? STATUS_GREEN : score! >= 50 ? STATUS_AMBER : STATUS_RED;
        return `<tr>
          <td>${LABELS[key] ?? key}</td>
          <td>${score}/100</td>
          <td style="color:${color};">${status}</td>
        </tr>`;
      }).join('')}
    </table>`;

  return sectionWrapper('Patient-Reported Outcomes', table);
}

function buildClinicalFlagsSection(flags: ClinicalFlag[]): string {
  if (flags.length === 0) {
    return sectionWrapper('Clinical Considerations', `<p style="color:${STATUS_GREEN}; font-size:9pt;">No clinical flags at this time.</p>`);
  }

  const table = `
    <table>
      <tr><th style="width:15%;">Priority</th><th style="width:25%;">Finding</th><th>Details</th></tr>
      ${flags.map(f => {
        const isWarning = f.severity === 'warning';
        const priority = isWarning ? 'WARNING' : 'NOTE';
        const color = isWarning ? STATUS_RED : INFO_BLUE;
        return `<tr>
          <td style="font-weight:700; color:${color};">${priority}</td>
          <td>${esc(f.title)}</td>
          <td>${esc(f.body)}</td>
        </tr>`;
      }).join('')}
    </table>`;

  return sectionWrapper('Clinical Considerations', table);
}

// ─── Utility wrappers ────────────────────────────────────────────────────────

function sectionWrapper(title: string, content: string): string {
  return `
    <div style="margin-bottom: 18px; page-break-inside: avoid;">
      <h2>${esc(title)}</h2>
      ${content}
    </div>`;
}

function buildFlagBoxes(flags: string[]): string {
  if (flags.length === 0) return '';
  return flags.map(f => `
    <div style="border: 1px solid ${BORDER}; padding: 6px 10px; margin-top: 6px; font-size: 9pt; color: ${SECONDARY}; line-height: 1.4;">
      <strong>NOTE:</strong> ${esc(f)}
    </div>`).join('');
}

// ─── Main builder ────────────────────────────────────────────────────────────

export function buildProviderReportHtml(
  data: ProviderReportData,
  config: ProviderReportConfig,
  aiSummary: string | null,
): string {
  const sections: string[] = [];

  // Always: header + medication + executive summary
  sections.push(buildHeaderSection(data, config));
  sections.push(buildMedicationLine(data));
  sections.push(buildExecutiveSummary(data, aiSummary));

  // Conditional sections
  if (config.sections.weight) {
    sections.push(buildWeightSection(data.weight, data.patient.goalWeight));
  }
  if (config.sections.adherence) {
    sections.push(buildAdherenceSection(data.adherence, config));
  }
  if (config.sections.sideEffects) {
    sections.push(buildSideEffectSection(data.sideEffects));
  }
  if (config.sections.nutrition) {
    sections.push(buildNutritionSection(data.nutrition));
  }
  if (config.sections.activity) {
    sections.push(buildActivitySection(data.activity));
  }
  if (config.sections.biometrics) {
    sections.push(buildBiometricsSection(data.biometrics));
  }
  if (config.sections.checkins) {
    sections.push(buildCheckinsSection(data.checkins));
  }

  // Always: clinical flags
  sections.push(buildClinicalFlagsSection(data.clinicalFlags));

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
