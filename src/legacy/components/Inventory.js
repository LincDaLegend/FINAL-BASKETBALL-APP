import { state } from '../utils/state.js';

function parseMoney(val) {
  return parseFloat(String(val || '0').replace(/[₱,]/g, '')) || 0;
}

function fmtMoney(n) {
  return '₱' + Math.round(n).toLocaleString('en-PH');
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return String(d);
  return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderInventory() {
  const { rows, cols, error, loading } = state.sheetsCache?.inventory || {};

  const allRows   = rows || [];
  const totalCost = allRows.reduce((s, r) => s + parseMoney(r['Cost'] || r['Buy Price'] || r['Price']), 0);
  const avgCost   = allRows.length ? totalCost / allRows.length : 0;

  const hasData = !loading && !error && allRows.length;

  return `
    <div class="bgt-page-header">
      <div>
        <div class="bgt-title">Inventory</div>
        <div class="bgt-subtitle">Manage stock, supplies, and shipping batches.</div>
      </div>
      <div class="bgt-header-actions">
        <button class="bgt-btn" onclick="window.loadSheetTab('inventory')" ${loading ? 'disabled' : ''}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          ${loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
    </div>

    ${error ? `<div class="notify notify-err" style="margin-bottom:16px">${error}</div>` : ''}
    ${loading ? `<div class="empty-state"><p>Loading from Google Sheets…</p></div>` : ''}

    ${allRows.length ? `
      <div class="bgt-stat-grid">
        <div class="bgt-stat">
          <div class="bgt-stat-label">Total Stock</div>
          <div class="bgt-stat-value">${allRows.length}</div>
          <div class="bgt-stat-sub">Items</div>
        </div>
        <div class="bgt-stat">
          <div class="bgt-stat-label">Total Value</div>
          <div class="bgt-stat-value bgt-green">${fmtMoney(totalCost)}</div>
          <div class="bgt-stat-sub">capital deployed</div>
        </div>
        <div class="bgt-stat">
          <div class="bgt-stat-label">Avg Cost</div>
          <div class="bgt-stat-value">${fmtMoney(avgCost)}</div>
          <div class="bgt-stat-sub">per card</div>
        </div>
        <div class="bgt-stat">
          <div class="bgt-stat-label">Active Batches</div>
          <div class="bgt-stat-value bgt-green">1</div>
          <div class="bgt-stat-sub">Batches</div>
        </div>
      </div>
    ` : ''}

    ${hasData ? `
      <div class="bgt-card">
        <table class="bgt-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Date</th>
              <th>Notes</th>
              <th style="text-align:right">Cost</th>
            </tr>
          </thead>
          <tbody>
            ${allRows.map(r => {
              const name  = r['Item Name'] || r['Item'] || '(unnamed)';
              const cost  = parseMoney(r['Cost'] || r['Buy Price'] || r['Price']);
              const date  = r['Date'] || r['Date Acquired'] || '';
              const notes = r['Notes'] || r['Grade'] || '';
              const cat   = r['Category'] || r['Type'] || '';
              return `
                <tr>
                  <td>
                    <div style="font-weight:700;color:#0f172a">${escHtml(name)}</div>
                    ${cat ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px">${escHtml(cat)}</div>` : ''}
                  </td>
                  <td class="bgt-date-cell">${escHtml(fmtDate(date))}</td>
                  <td style="color:#64748b;font-size:12px">${escHtml(notes)}</td>
                  <td class="bgt-amount-cell">${cost ? fmtMoney(cost) : '—'}</td>
                </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid #f1f5f9">
              <td style="padding:12px 20px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:none">Total</td>
              <td style="border-bottom:none"></td>
              <td style="border-bottom:none"></td>
              <td class="bgt-amount-cell" style="padding:12px 20px;font-weight:700;border-bottom:none">${fmtMoney(totalCost)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    ` : (!loading && !error && !allRows.length && rows !== undefined ? `
      <div class="bgt-card">
        <div style="padding:48px 20px;text-align:center">
          <div style="font-size:32px;margin-bottom:12px;opacity:0.2">📦</div>
          <p style="color:#94a3b8;font-size:13px">No inventory records found.</p>
        </div>
      </div>
    ` : '')}
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
