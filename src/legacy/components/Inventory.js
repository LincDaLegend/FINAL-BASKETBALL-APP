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
  return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export function renderInventory() {
  const { rows, cols, error, loading } = state.sheetsCache?.inventory || {};

  const allRows   = rows || [];
  const totalCost = allRows.reduce((s, r) => s + parseMoney(r['Cost'] || r['Buy Price'] || r['Price']), 0);
  const avgCost   = allRows.length ? totalCost / allRows.length : 0;

  const heroGrad = 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)';

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:17px;font-weight:700;color:var(--text-primary)">Inventory</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Cards in stock · Inventory 2026</div>
      </div>
      <button class="btn-ghost btn-sm" onclick="window.loadSheetTab('inventory')" ${loading ? 'disabled' : ''}>
        ${loading ? 'Loading…' : '↻ Refresh'}
      </button>
    </div>

    ${error ? `<div class="notify notify-err">${error}</div>` : ''}
    ${loading ? `<div class="empty-state"><p>Loading from Google Sheets…</p></div>` : ''}

    ${allRows.length ? `
      <div class="wallet-hero" style="background:${heroGrad}">
        <div class="wallet-hero-eyebrow">Capital Deployed</div>
        <div class="wallet-hero-amount">${fmtMoney(totalCost)}</div>
        <div class="wallet-hero-row">
          <div class="wallet-hero-stat">Cards <strong>${allRows.length}</strong></div>
          <div class="wallet-hero-stat">Avg Cost <strong>${fmtMoney(avgCost)}</strong></div>
        </div>
      </div>

      <div>
        ${allRows.map(r => {
          const name = r['Item Name'] || r['Item'] || '(unnamed)';
          const cost = parseMoney(r['Cost'] || r['Buy Price'] || r['Price']);
          const date = r['Date'] || r['Date Acquired'] || '';
          const notes = r['Notes'] || r['Grade'] || '';
          return `
            <div class="inv-row">
              <div class="inv-dot"></div>
              <div class="inv-body">
                <div class="inv-name">${escHtml(name)}</div>
                <div class="inv-date">${fmtDate(date)}${notes ? (date ? ' · ' : '') + escHtml(notes) : ''}</div>
              </div>
              <div class="inv-cost">${cost ? fmtMoney(cost) : '—'}</div>
            </div>`;
        }).join('')}
      </div>
    ` : (!loading && !error && !allRows.length && rows !== undefined ? `
      <div class="empty-state"><p>No inventory records found.</p></div>
    ` : '')}
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
