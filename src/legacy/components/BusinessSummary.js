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
    costCol   ? { col: costCol,   color: '#d97706', label: costCol   } : null,
    profitCol ? { col: profitCol, color: '#7c3aed', label: profitCol } : null,
  ].filter(Boolean).filter((s, i, arr) => arr.findIndex(x => x.col === s.col) === i);

  if (!series.length) return '';

  const data   = rows.map(r => ({
    label: String(r[labelCol] || '').slice(0, 3),
    vals:  series.map(s => Math.max(0, parseMoney(r[s.col]))),
  }));

  const maxVal = Math.max(...data.flatMap(d => d.vals), 1);

  const W = 760, H = 200, padL = 58, padR = 12, padT = 8, padB = 34;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const groupW = chartW / data.length;
  const gapPx  = 2;
  const barW   = Math.min((groupW - 10) / series.length - gapPx, 20);

  // Y-axis grid lines
  const grid = Array.from({ length: 5 }, (_, i) => {
    const v  = maxVal * i / 4;
    const y  = padT + chartH - (v / maxVal) * chartH;
    const lbl = v >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${Math.round(v)}`;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#ebebeb" stroke-width="1"/>
            <text x="${(padL - 5).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#bbb">${lbl}</text>`;
  }).join('');

  // Bars + x-axis labels
  const bars = data.map((d, gi) => {
    const groupX   = padL + gi * groupW;
    const totalW   = series.length * (barW + gapPx) - gapPx;
    const startX   = groupX + (groupW - totalW) / 2;

    const rects = series.map((s, si) => {
      const bh = Math.max(0, (d.vals[si] / maxVal) * chartH);
      const bx = startX + si * (barW + gapPx);
      const by = padT + chartH - bh;
      return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" fill="${s.color}" rx="2" opacity="0.85"/>`;
    }).join('');

    const lx = (groupX + groupW / 2).toFixed(1);
    const ly = (padT + chartH + 14).toFixed(1);
    return `${rects}<text x="${lx}" y="${ly}" text-anchor="middle" font-size="10" fill="#bbb">${escHtml(d.label)}</text>`;
  }).join('');

  // Legend centred below chart
  const legendW = series.length * 90;
  const legend  = series.map((s, i) => {
    const lx = (W / 2 - legendW / 2 + i * 90).toFixed(1);
    const ly = (H + 4).toFixed(1);
    return `<rect x="${lx}" y="${ly}" width="8" height="8" fill="${s.color}" rx="1"/>
            <text x="${(parseFloat(lx) + 12).toFixed(1)}" y="${(H + 12).toFixed(1)}" font-size="10" fill="#999">${escHtml(s.label)}</text>`;
  }).join('');

  return `
    <div style="margin-bottom:24px">
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Monthly Overview</div>
      <div style="overflow-x:auto">
        <svg viewBox="0 0 ${W} ${H + 24}" style="width:100%;min-width:480px;height:auto;display:block">
          ${grid}
          ${bars}
          ${legend}
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

  return `
    <div class="biz-header">
      <div class="biz-header-left">
        <div class="page-title">Summary</div>
        <div class="page-subtitle">Monthly business overview · sourced from Google Sheets</div>
      </div>
      <button class="btn-ghost btn-sm" onclick="window.loadSheetTab('summary')" ${loading ? 'disabled' : ''}>
        ${loading ? 'Loading…' : '↻ Refresh'}
      </button>
    </div>

    ${error ? `<div class="notify notify-err">${error}</div>` : ''}
    ${loading ? `<div class="empty-state"><p>Loading from Google Sheets…</p></div>` : ''}

    ${!loading && !error && rows?.length ? `
      ${renderBarChart(rows, cols)}
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>${(cols || []).filter(c => c).map(c => `<th>${escHtml(String(c))}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                ${(cols || []).filter(c => c).map(c => {
                  const val   = r[c] ?? '';
                  const isNum = numCols.includes(c) && val !== '';
                  return `<td style="${isNum ? 'text-align:right;font-variant-numeric:tabular-nums' : ''}">${escHtml(String(val))}</td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
          ${numCols.length ? `
          <tfoot>
            <tr style="border-top:2px solid var(--border)">
              ${(cols || []).filter(c => c).map((c, i) =>
                numCols.includes(c)
                  ? `<td style="padding:10px 12px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;font-size:13px">${fmtMoney(totals[c])}</td>`
                  : `<td style="padding:10px 12px;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">${i === 0 ? 'Total' : ''}</td>`
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
