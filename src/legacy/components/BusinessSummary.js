import { state } from '../utils/state.js';

function parseMoney(val) {
  return parseFloat(String(val || '0').replace(/[₱,]/g, '')) || 0;
}

function fmtMoney(n) {
  return '₱' + Math.round(n).toLocaleString('en-PH');
}

// ── SVG Bar Chart ────────────────────────────────────────────────────────────
function renderBarChart(rows, cols) {
  if (!rows?.length || !cols?.length) return '';

  const labelCol = cols[0];
  const numCols  = cols.filter(c => c && rows.some(r => r[c] !== '' && !isNaN(parseMoney(r[c]))));
  if (!numCols.length) return '';

  const revCol    = numCols.find(c => /revenue|sale|income|gross.*in/i.test(c))    || numCols[0];
  const costCol   = numCols.find(c => /cost/i.test(c) && !/gross/i.test(c))        || numCols[1];
  const profitCol = numCols.find(c => /profit|net/i.test(c))                       || numCols[2];

  const series = [
    revCol    ? { col: revCol,    color: '#10b981', label: revCol    } : null,
    costCol   ? { col: costCol,   color: '#f59e0b', label: costCol   } : null,
    profitCol ? { col: profitCol, color: '#7c3aed', label: profitCol } : null,
  ].filter(Boolean).filter((s, i, arr) => arr.findIndex(x => x.col === s.col) === i);

  if (!series.length) return '';

  const data   = rows.map(r => ({
    label: String(r[labelCol] || '').slice(0, 3),
    vals:  series.map(s => Math.max(0, parseMoney(r[s.col]))),
  }));
  const maxVal = Math.max(...data.flatMap(d => d.vals), 1);

  const W = 720, H = 180, padL = 52, padR = 12, padT = 8, padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const groupW = chartW / data.length;
  const gapPx  = 2;
  const barW   = Math.min((groupW - 10) / series.length - gapPx, 18);

  const grid = Array.from({ length: 5 }, (_, i) => {
    const v   = maxVal * i / 4;
    const y   = padT + chartH - (v / maxVal) * chartH;
    const lbl = v >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${Math.round(v)}`;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>
            <text x="${(padL - 5).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="#94a3b8">${lbl}</text>`;
  }).join('');

  const bars = data.map((d, gi) => {
    const groupX = padL + gi * groupW;
    const totalW = series.length * (barW + gapPx) - gapPx;
    const startX = groupX + (groupW - totalW) / 2;
    const rects  = series.map((s, si) => {
      const bh = Math.max(0, (d.vals[si] / maxVal) * chartH);
      const bx = startX + si * (barW + gapPx);
      const by = padT + chartH - bh;
      return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" fill="${s.color}" rx="3"/>`;
    }).join('');
    const lx = (groupX + groupW / 2).toFixed(1);
    const ly = (padT + chartH + 14).toFixed(1);
    return `${rects}<text x="${lx}" y="${ly}" text-anchor="middle" font-size="9" fill="#94a3b8">${escHtml(d.label)}</text>`;
  }).join('');

  const legendW = series.length * 90;
  const legend  = series.map((s, i) => {
    const lx = (W / 2 - legendW / 2 + i * 90).toFixed(1);
    const ly = (H + 4).toFixed(1);
    return `<rect x="${lx}" y="${ly}" width="8" height="8" fill="${s.color}" rx="2"/>
            <text x="${(parseFloat(lx) + 12).toFixed(1)}" y="${(H + 12).toFixed(1)}" font-size="10" fill="#94a3b8">${escHtml(s.label)}</text>`;
  }).join('');

  return `
    <div class="bgt-card" style="margin-bottom:16px">
      <div class="bgt-card-header">
        <div class="bgt-card-title">Revenue &amp; Profit <span class="bgt-card-title-sub">Performance over time</span></div>
        <div style="display:flex;gap:12px">
          ${series.map(s => `<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8"><span style="width:8px;height:8px;border-radius:2px;background:${s.color};display:inline-block"></span>${escHtml(s.label)}</span>`).join('')}
        </div>
      </div>
      <div style="padding:16px 20px;overflow-x:auto">
        <svg viewBox="0 0 ${W} ${H + 20}" style="width:100%;min-width:400px;height:auto;display:block">
          ${grid}${bars}${legend}
        </svg>
      </div>
    </div>`;
}

// ── Main render ──────────────────────────────────────────────────────────────
export function renderBusinessSummary() {
  const { rows, cols, error, loading } = state.sheetsCache?.summary || {};

  const numCols = (cols || []).filter(c =>
    c && (rows || []).some(r => r[c] !== '' && !isNaN(parseMoney(r[c])))
  );
  const totals = {};
  numCols.forEach(c => {
    totals[c] = (rows || []).reduce((s, r) => s + parseMoney(r[c]), 0);
  });

  const revCol    = numCols.find(c => /revenue|sale|income|gross.*in/i.test(c));
  const costCol   = numCols.find(c => /cost/i.test(c) && !/gross/i.test(c));
  const profitCol = numCols.find(c => /profit|net/i.test(c));
  const profit    = profitCol ? totals[profitCol] : 0;
  const revenue   = revCol    ? totals[revCol]    : 0;
  const cost      = costCol   ? totals[costCol]   : 0;

  const hasData = !loading && !error && rows?.length;

  const statTiles = hasData ? [
    revCol    ? { label: 'Total Revenue', value: fmtMoney(revenue), icon: '$', cls: '' }          : null,
    profitCol ? { label: 'Gross Profit',  value: fmtMoney(profit),  icon: '↗', cls: profit >= 0 ? 'bgt-green' : 'bgt-red' } : null,
    costCol   ? { label: 'Total COGS',    value: fmtMoney(cost),    icon: '📦', cls: '' }          : null,
    ...numCols.filter(c => c !== revCol && c !== costCol && c !== profitCol).slice(0, 1).map(c => ({
      label: c, value: fmtMoney(totals[c]), icon: '◎', cls: '',
    })),
  ].filter(Boolean) : [];

  return `
    <div class="bgt-page-header">
      <div>
        <div class="bgt-title">Summary</div>
        <div class="bgt-subtitle">Track your business performance</div>
      </div>
      <div class="bgt-header-actions">
        <button class="bgt-btn" onclick="window.loadSheetTab('summary')" ${loading ? 'disabled' : ''}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          ${loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
    </div>

    ${error ? `<div class="notify notify-err" style="margin-bottom:16px">${error}</div>` : ''}
    ${loading ? `<div class="empty-state"><p>Loading from Google Sheets…</p></div>` : ''}

    ${statTiles.length ? `
      <div class="bgt-stat-grid${statTiles.length === 3 ? ' bgt-stat-grid-3' : ''}">
        ${statTiles.map(t => `
          <div class="bgt-stat">
            <div class="bgt-stat-label">${escHtml(t.label)}</div>
            <div class="bgt-stat-value ${t.cls}">${escHtml(t.value)}</div>
          </div>`).join('')}
      </div>` : ''}

    ${hasData ? `
      ${renderBarChart(rows, cols)}

      <div class="bgt-card">
        <div class="bgt-card-header">
          <div class="bgt-card-title">Monthly Breakdown</div>
        </div>
        <table class="bgt-table">
          <thead>
            <tr>
              ${(cols || []).filter(c => c).map(c => `<th>${escHtml(String(c))}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                ${(cols || []).filter(c => c).map(c => {
                  const val   = r[c] ?? '';
                  const isNum = numCols.includes(c) && val !== '';
                  return `<td class="${isNum ? 'bgt-amount-cell' : ''}">${escHtml(String(val))}</td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
          ${numCols.length ? `
          <tfoot>
            <tr style="border-top:2px solid #f1f5f9">
              ${(cols || []).filter(c => c).map((c, i) =>
                numCols.includes(c)
                  ? `<td class="bgt-amount-cell" style="padding:12px 20px;font-weight:700;border-bottom:none">${fmtMoney(totals[c])}</td>`
                  : `<td style="padding:12px 20px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:none">${i === 0 ? 'Total' : ''}</td>`
              ).join('')}
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
    ` : (!loading && !error && !rows?.length && rows !== undefined ? `
      <div class="empty-state"><p>No data found in Summary 2026 B22:J35.</p></div>
    ` : '')}
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
