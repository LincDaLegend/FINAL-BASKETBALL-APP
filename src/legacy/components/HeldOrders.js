import { state } from '../utils/state.js';

// Status column is always "Shipping On-Hold" here — no need to show it
const DISPLAY_COLS = ['Date', 'Item', 'Cost', 'Sale'];

function parseMoney(val) {
  return parseFloat(String(val || '0').replace(/[₱,]/g, '')) || 0;
}

function fmtMoney(n) {
  return '₱' + Math.round(n).toLocaleString('en-PH');
}

export function renderHeldOrders() {
  const { rows, cols, error, loading } = state.sheetsCache?.sales || {};

  const held = (rows || []).filter(r =>
    String(r['Status'] || '').toLowerCase().includes('hold')
  );

  const totalSale  = held.reduce((s, r) => s + parseMoney(r['Sale'] || r['Price']), 0);
  const totalCost  = held.reduce((s, r) => s + parseMoney(r['Cost']), 0);

  const availCols = new Set(cols || []);
  const showCols  = DISPLAY_COLS.filter(c => availCols.has(c));
  const effectiveCols = showCols.length
    ? showCols
    : (cols || []).filter(c => c && c !== 'Status' && c !== 'Buyer' && c !== 'Format');

  return `
    <div class="biz-header">
      <div class="biz-header-left">
        <div class="page-title">Held Orders</div>
        <div class="page-subtitle">Shipping on-hold · sourced from Google Sheets</div>
      </div>
      <button class="btn-ghost btn-sm" onclick="window.loadSheetTab('sales')" ${loading ? 'disabled' : ''}>
        ${loading ? 'Loading…' : '↻ Refresh'}
      </button>
    </div>

    ${held.length ? `
    <div class="stats-grid" style="margin-bottom:20px;grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="stat-card">
        <div class="stat-label">On Hold</div>
        <div class="stat-value">${held.length}</div>
        <div class="stat-sub">pending orders</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Held Value</div>
        <div class="stat-value">${fmtMoney(totalSale)}</div>
        <div class="stat-sub">total sale</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cost Tied Up</div>
        <div class="stat-value">${fmtMoney(totalCost)}</div>
        <div class="stat-sub">capital locked</div>
      </div>
    </div>` : ''}

    ${error ? `<div class="notify notify-err">${error}</div>` : ''}
    ${loading ? `<div class="empty-state"><p>Loading from Google Sheets…</p></div>` : ''}

    ${!loading && !error && held.length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              ${effectiveCols.map(c => `<th>${escHtml(String(c))}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${held.map(r => `
              <tr>
                ${effectiveCols.map(c => {
                  const val    = r[c] ?? '';
                  const isNum  = (c === 'Cost' || c === 'Sale' || c === 'Price')
                              && val !== '' && !isNaN(parseMoney(val) || NaN);
                  return `<td style="${isNum ? 'text-align:right;font-variant-numeric:tabular-nums' : ''}">${escHtml(String(val))}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : (!loading && !error && !held.length && rows !== undefined ? `
      <div class="empty-state"><p>No orders currently on hold.</p></div>
    ` : '')}
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
