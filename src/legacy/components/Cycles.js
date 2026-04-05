// Business Cycles — seasonality and pattern analytics from deal history.
// Pure computation from logged deals. No API calls, no external data.
//
// Uses deal.id (Date.now() at log time) as the deal date proxy.
// Imported deals cluster near import date — best results from manually logged deals.

import { state } from '../utils/state.js';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// NBA calendar phases
const NBA_PHASES = [
  { name: 'Pre-season',    months: [9],          note: 'Season hype begins' },
  { name: 'Regular season',months: [10,11,0,1,2],note: 'Steady, highest volume' },
  { name: 'Playoffs',      months: [3,4],         note: 'Star card spike' },
  { name: 'Finals / Draft',months: [5],           note: 'Peak hype, rookie cards rise' },
  { name: 'Off-season',    months: [6,7,8],       note: 'Slower — best time to buy cheap' },
];

function phaseForMonth(m) {
  return NBA_PHASES.find(p => p.months.includes(m))?.name || 'Unknown';
}

// Group deals by a key function, return { key → [deal] }
function groupBy(deals, keyFn) {
  const map = {};
  for (const d of deals) {
    const k = keyFn(d);
    if (k == null) continue;
    if (!map[k]) map[k] = [];
    map[k].push(d);
  }
  return map;
}

function avg(arr, fn) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, d) => a + (fn(d) || 0), 0) / arr.length);
}

// ─── Main render ──────────────────────────────────────────────────────────────
export function renderCycles() {
  const deals = state.deals;

  if (deals.length < 5) {
    return `
      <div class="page-title">Business Cycles</div>
      <div class="page-subtitle">Seasonality and buying pattern analysis</div>
      <div class="empty-state" style="margin-top:3rem">
        <div class="empty-icon">📈</div>
        <h3>Not enough data yet</h3>
        <p>Log at least 5 deals to see cycle analysis. The more deals you have, the more reliable the patterns.</p>
      </div>`;
  }

  // Attach date to each deal using id as timestamp
  const dated = deals.map(d => ({ ...d, _date: new Date(d.id || Date.now()) }));

  return `
    <div class="page-title">Business Cycles</div>
    <div class="page-subtitle">Seasonality and buying patterns from your ${deals.length} logged deals</div>

    ${renderNBAPhaseTable(dated)}
    ${renderMonthlyHeatmap(dated)}
    ${renderFlipSpeedTrend(dated)}
    ${renderCategoryTable(dated)}
    ${renderTopPlayersTable(dated)}
    ${renderAttributeROITable(dated)}
  `;
}

// ─── NBA Season Phase Performance ─────────────────────────────────────────────
function renderNBAPhaseTable(dated) {
  const byPhase = groupBy(dated, d => phaseForMonth(d._date.getMonth()));

  const rows = NBA_PHASES.map(phase => {
    const group = byPhase[phase.name] || [];
    if (!group.length) return null;
    const avgROI  = avg(group, d => d.roi);
    const avgDays = avg(group, d => d.days);
    const roiCls  = avgROI >= 40 ? 'var(--green)' : avgROI >= 20 ? 'var(--amber)' : 'var(--red)';
    return `
      <tr>
        <td><strong>${phase.name}</strong><div style="font-size:11px;color:var(--text-muted)">${phase.note}</div></td>
        <td style="text-align:center">${group.length}</td>
        <td style="text-align:center;color:${roiCls};font-weight:600">+${avgROI}%</td>
        <td style="text-align:center">${avgDays ? avgDays + 'd' : '—'}</td>
      </tr>`;
  }).filter(Boolean);

  if (!rows.length) return '';

  return `
    <div class="card-section">
      <div class="section-title">NBA Season Phase Performance</div>
      <div class="section-subtitle">When in the NBA calendar have you made your best deals?</div>
      <table class="cycles-table">
        <thead><tr><th>Phase</th><th>Deals</th><th>Avg ROI</th><th>Avg flip</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

// ─── Monthly Heatmap ──────────────────────────────────────────────────────────
function renderMonthlyHeatmap(dated) {
  const byMonth = groupBy(dated, d => d._date.getMonth());

  // Find max ROI for normalising bar widths
  const monthROIs = MONTH_NAMES.map((_, i) => {
    const g = byMonth[i] || [];
    return g.length ? avg(g, d => d.roi) : null;
  });
  const maxROI = Math.max(...monthROIs.filter(r => r !== null), 1);

  const cells = MONTH_NAMES.map((name, i) => {
    const g = byMonth[i] || [];
    if (!g.length) {
      return `<div class="month-cell month-empty"><div class="month-label">${name}</div><div class="month-no-data">no data</div></div>`;
    }
    const roi    = monthROIs[i];
    const pct    = Math.round((roi / maxROI) * 100);
    const color  = roi >= 40 ? '#3ecf8e' : roi >= 20 ? '#f5a623' : '#f04444';
    const phase  = phaseForMonth(i);
    return `
      <div class="month-cell">
        <div class="month-label">${name}</div>
        <div class="month-bar-wrap">
          <div class="month-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="month-roi" style="color:${color}">+${roi}%</div>
        <div class="month-count">${g.length} deal${g.length > 1 ? 's' : ''}</div>
        <div class="month-phase">${phase}</div>
      </div>`;
  });

  return `
    <div class="card-section">
      <div class="section-title">ROI by Month</div>
      <div class="section-subtitle">Which months have you been most profitable?</div>
      <div class="month-grid">${cells.join('')}</div>
    </div>`;
}

// ─── Flip Speed Trend ─────────────────────────────────────────────────────────
function renderFlipSpeedTrend(dated) {
  const withDays = dated.filter(d => d.days > 0);
  if (withDays.length < 4) return '';

  // Split into quarters of deal history and compare avg flip time
  const sorted  = [...withDays].sort((a, b) => a.id - b.id);
  const q       = Math.max(1, Math.floor(sorted.length / 4));
  const quarters = [
    sorted.slice(0, q),
    sorted.slice(q, q * 2),
    sorted.slice(q * 2, q * 3),
    sorted.slice(q * 3),
  ].filter(g => g.length);

  if (quarters.length < 2) return '';

  const qAvgs = quarters.map(g => avg(g, d => d.days));
  const improving = qAvgs[qAvgs.length - 1] < qAvgs[0];
  const maxDays   = Math.max(...qAvgs, 1);

  const bars = quarters.map((g, i) => {
    const days  = qAvgs[i];
    const pct   = Math.round((days / maxDays) * 100);
    const label = i === 0 ? 'Earliest' : i === quarters.length - 1 ? 'Recent' : `Q${i + 1}`;
    const color = i === quarters.length - 1 && improving ? 'var(--green)' : 'var(--text-muted)';
    return `
      <div class="speed-bar-row">
        <div class="speed-bar-label">${label}</div>
        <div class="speed-bar-track">
          <div class="speed-bar-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="speed-bar-val" style="color:${color}">${days}d avg</div>
      </div>`;
  });

  const trend = improving
    ? `<span style="color:var(--green)">Improving — you're flipping faster over time.</span>`
    : `<span style="color:var(--amber)">Slowing — recent deals taking longer to move.</span>`;

  return `
    <div class="card-section">
      <div class="section-title">Flip Speed Trend</div>
      <div class="section-subtitle">Are you getting faster at turning cards over? ${trend}</div>
      <div class="speed-bars">${bars.join('')}</div>
    </div>`;
}

// ─── Category Performance ─────────────────────────────────────────────────────
function renderCategoryTable(dated) {
  const byCategory = groupBy(dated, d => d.category || 'unset');
  const rows = Object.entries(byCategory)
    .sort(([, a], [, b]) => avg(b, d => d.roi) - avg(a, d => d.roi))
    .map(([cat, g]) => {
      const roi  = avg(g, d => d.roi);
      const days = avg(g, d => d.days);
      const roiCls = roi >= 40 ? 'var(--green)' : roi >= 20 ? 'var(--amber)' : 'var(--red)';
      return `
        <tr>
          <td>${escHtml(cat)}</td>
          <td style="text-align:center">${g.length}</td>
          <td style="text-align:center;color:${roiCls};font-weight:600">+${roi}%</td>
          <td style="text-align:center">${days ? days + 'd' : '—'}</td>
        </tr>`;
    });

  return `
    <div class="card-section">
      <div class="section-title">Category Performance</div>
      <table class="cycles-table">
        <thead><tr><th>Category</th><th>Deals</th><th>Avg ROI</th><th>Avg flip</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

// ─── Top Players by ROI ────────────────────────────────────────────────────────
function renderTopPlayersTable(dated) {
  const byPlayer = groupBy(dated, d => d.player || null);
  const rows = Object.entries(byPlayer)
    .filter(([, g]) => g.length >= 2)  // only players with 2+ deals
    .sort(([, a], [, b]) => avg(b, d => d.roi) - avg(a, d => d.roi))
    .slice(0, 10)
    .map(([player, g]) => {
      const roi  = avg(g, d => d.roi);
      const days = avg(g, d => d.days);
      const roiCls = roi >= 40 ? 'var(--green)' : roi >= 20 ? 'var(--amber)' : 'var(--red)';
      const bestDeal = [...g].sort((a, b) => (b.roi || 0) - (a.roi || 0))[0];
      return `
        <tr>
          <td>
            <strong>${escHtml(player)}</strong>
            ${bestDeal ? `<div style="font-size:11px;color:var(--text-muted)">best: ${bestDeal.set || ''} ${bestDeal.grade || ''} +${bestDeal.roi}%</div>` : ''}
          </td>
          <td style="text-align:center">${g.length}</td>
          <td style="text-align:center;color:${roiCls};font-weight:600">+${roi}%</td>
          <td style="text-align:center">${days ? days + 'd' : '—'}</td>
        </tr>`;
    });

  if (!rows.length) return '';

  return `
    <div class="card-section">
      <div class="section-title">Top Players by ROI</div>
      <div class="section-subtitle">Players you've flipped 2+ times, ranked by avg return</div>
      <table class="cycles-table">
        <thead><tr><th>Player</th><th>Deals</th><th>Avg ROI</th><th>Avg flip</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

// ─── Card Attribute ROI Table ──────────────────────────────────────────────────
function renderAttributeROITable(dated) {
  const attrs = [
    { label: 'Prizm',       test: d => /PRIZM/i.test([d.set, d.variant, d.notes].join(' ')) },
    { label: 'Chrome',      test: d => /CHROME/i.test([d.set, d.variant, d.notes].join(' ')) },
    { label: 'Optic',       test: d => /OPTIC/i.test([d.set, d.variant].join(' ')) },
    { label: 'Refractor',   test: d => /REFRACTOR/i.test([d.variant, d.notes].join(' ')) },
    { label: 'Silver',      test: d => /SILVER/i.test([d.variant, d.notes].join(' ')) },
    { label: 'PSA 10',      test: d => d.grade === 'PSA 10' },
    { label: 'PSA 9',       test: d => d.grade === 'PSA 9' },
    { label: 'Raw',         test: d => !d.grade || d.grade === 'raw' },
    { label: 'Rookie',      test: d => /RC|ROOKIE/i.test([d.variant, d.notes, d.set].join(' ')) },
    { label: 'Numbered',    test: d => /\/\d+/.test(d.variant || '') },
  ];

  const rows = attrs
    .map(attr => {
      const group = dated.filter(attr.test);
      if (group.length < 2) return null;
      const roi    = avg(group, d => d.roi);
      const roiCls = roi >= 40 ? 'var(--green)' : roi >= 20 ? 'var(--amber)' : 'var(--red)';
      return { label: attr.label, count: group.length, roi, roiCls };
    })
    .filter(Boolean)
    .sort((a, b) => b.roi - a.roi);

  if (!rows.length) return '';

  return `
    <div class="card-section">
      <div class="section-title">Card Attribute ROI</div>
      <div class="section-subtitle">Which card types have been most profitable for you?</div>
      <table class="cycles-table">
        <thead><tr><th>Attribute</th><th>Deals</th><th>Avg ROI</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.label}</td>
              <td style="text-align:center">${r.count}</td>
              <td style="text-align:center;color:${r.roiCls};font-weight:600">+${r.roi}%</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
