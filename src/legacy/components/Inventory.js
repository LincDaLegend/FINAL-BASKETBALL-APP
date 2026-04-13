import { state } from '../utils/state.js';

// Show these columns in order; skip Batch (internal numbering)
const DISPLAY_COLS = ['Date', 'Item Name', 'Cost', 'Notes'];

function parseMoney(val) {
  return parseFloat(String(val || '0').replace(/[₱,]/g, '')) || 0;
}

function fmtMoney(n) {
  return '₱' + Math.round(n).toLocaleString('en-PH');
}

export function renderInventory() {
  const { rows, cols, error, loading } = state.sheetsCache?.inventory || {};

  const allRows   = rows || [];
  const totalCost = allRows.reduce((s, r) => s + parseMoney(r['Cost'] || r['Buy Price'] || r['Price']), 0);
  const avgCost   = allRows.length ? totalCost / allRows.length : 0;

  const availCols = new Set(cols || []);
  const showCols  = DISPLAY_COLS.filter(c => availCols.has(c));
  // Fall back to all cols minus Batch if DISPLAY_COLS don't match
  const effectiveCols = showCols.length
    ? showCols
    : (cols || []).filter(c => c && c !== 'Batch' && c !== 'batch');

  return `
    <div class="biz-header">
      <div class="biz-header-left">
        <div class="page-title">Inventory</div>
        <div class="page-subtitle">Inventory 2026 · sourced from Google Sheets</div>
      </div>
      <button class="btn-ghost btn-sm" onclick="window.loadSheetTab('inventory')" ${loading ? 'disabled' : ''}>
        ${loading ? 'Loading…' : '↻ Refresh'}
      </button>
    </div>

    ${allRows.length ? `
    <div class="stats-grid" style="margin-bottom:20px;grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="stat-card">
        <div class="stat-label">In Stock</div>
        <div class="stat-value">${allRows.length}</div>
        <div class="stat-sub">cards</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Cost</div>
        <div class="stat-value">${fmtMoney(totalCost)}</div>
        <div class="stat-sub">capital deployed</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Cost</div>
        <div class="stat-value">${fmtMoney(avgCost)}</div>
        <div class="stat-sub">per card</div>
      </div>
    </div>` : ''}

    ${error ? `<div class="notify notify-err">${error}</div>` : ''}
    ${loading ? `<div class="empty-state"><p>Loading from Google Sheets…</p></div>` : ''}

    ${!loading && !error && allRows.length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              ${effectiveCols.map(c => `<th>${escHtml(String(c))}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${allRows.map(r => `
              <tr>
                ${effectiveCols.map(c => {
                  const val  = r[c] ?? '';
                  const isNum = (c === 'Cost' || c === 'Buy Price' || c === 'Price')
                             && val !== '' && !isNaN(parseMoney(val) || NaN);
                  return `<td style="${isNum ? 'text-align:right;font-variant-numeric:tabular-nums' : ''}">${escHtml(String(val))}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : (!loading && !error && !allRows.length && rows !== undefined ? `
      <div class="empty-state"><p>No inventory records found.</p></div>
    ` : '')}
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
