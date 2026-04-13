import { state } from '../utils/state.js';

function parseMoney(val) {
  return parseFloat(String(val || '0').replace(/[₱,$,]/g, '').replace(/,/g, '')) || 0;
}

function fmtMoney(n) {
  return '₱' + Math.round(n).toLocaleString('en-PH');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ── Stats ────────────────────────────────────────────────────────────────────
function calcStats() {
  const txns = state.transactions || [];
  return {
    count:   txns.length,
    revenue: txns.reduce((s, t) => s + (t.soldPrice || 0), 0),
    cost:    txns.reduce((s, t) => s + (t.cost     || 0), 0),
    profit:  txns.reduce((s, t) => s + (t.profit   || 0), 0),
  };
}

// ── Inventory search dropdown ────────────────────────────────────────────────
function renderItemSearch() {
  const txn    = state.newTxn || {};
  const query  = txn.itemSearch || '';
  const sel    = txn.selectedItem;

  if (sel) {
    return `
      <div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-surface)">
        <div style="flex:1;font-size:13px;color:var(--text-primary)">${escHtml(sel['Item Name'] || sel['Item'] || '')}</div>
        <div style="font-size:12px;color:var(--text-muted)">Cost: ${fmtMoney(parseMoney(sel['Cost']))}</div>
        <button class="btn-ghost btn-sm" onclick="window.txnClearItem()" style="padding:2px 7px;font-size:11px">×</button>
      </div>`;
  }

  const invRows = state.sheetsCache?.inventory?.rows || [];
  const matches = query.length >= 1
    ? invRows.filter(r => String(r['Item Name'] || r['Item'] || '').toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  return `
    <div style="position:relative">
      <input
        id="txn-item-input"
        type="text"
        placeholder="Search your inventory…"
        value="${escHtml(query)}"
        oninput="window.txnSearch(this.value)"
        autocomplete="off"
        style="width:100%"
      />
      ${matches.length ? `
        <div style="position:absolute;top:calc(100% + 2px);left:0;right:0;z-index:100;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:0 4px 12px rgba(0,0,0,0.08);max-height:220px;overflow-y:auto">
          ${matches.map((r, i) => {
            const name = r['Item Name'] || r['Item'] || '(unnamed)';
            const cost = parseMoney(r['Cost']);
            return `<div
              style="padding:9px 12px;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)"
              onmousedown="event.preventDefault();window.txnSelectItem(${i})"
            >
              <span>${escHtml(name)}</span>
              <span style="font-size:12px;color:var(--text-muted)">${fmtMoney(cost)}</span>
            </div>`;
          }).join('')}
        </div>` : ''}
    </div>`;
}

// ── Transaction form ─────────────────────────────────────────────────────────
function renderForm() {
  const txn = state.newTxn || {};
  const dateVal = txn.date || today();
  const hasInv  = (state.sheetsCache?.inventory?.rows || []).length > 0;

  return `
    <div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px;margin-bottom:24px">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px">Log Transaction</div>

      <div class="form-grid-2" style="margin-bottom:10px">
        <div class="form-group" style="margin:0">
          <label class="form-label">Date</label>
          <input type="date" value="${dateVal}" oninput="window.txnSet('date', this.value)" style="width:100%"/>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Client Name</label>
          <input type="text" placeholder="Buyer name" value="${escHtml(txn.client || '')}" oninput="window.txnSet('client', this.value)" style="width:100%"/>
        </div>
      </div>

      <div class="form-grid-2" style="margin-bottom:14px">
        <div class="form-group" style="margin:0">
          <label class="form-label">Item ${!hasInv ? '<span style="color:var(--amber);font-weight:400">(load inventory first)</span>' : ''}</label>
          ${renderItemSearch()}
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Sold Price</label>
          <div style="display:flex;align-items:center;gap:0">
            <span style="padding:8px 10px;background:var(--bg-surface);border:1px solid var(--border);border-right:none;border-radius:var(--radius-md) 0 0 var(--radius-md);font-size:13px;color:var(--text-muted)">₱</span>
            <input type="number" min="0" step="1" placeholder="0"
              value="${escHtml(String(txn.soldPrice || ''))}"
              oninput="window.txnSet('soldPrice', this.value)"
              style="border-radius:0 var(--radius-md) var(--radius-md) 0;flex:1"
            />
          </div>
        </div>
      </div>

      <button class="btn-primary" onclick="window.submitTransaction()"
        style="min-width:140px"
        ${state.txnSubmitting ? 'disabled' : ''}>
        ${state.txnSubmitting ? 'Saving…' : '+ Log Transaction'}
      </button>
      ${state.txnError ? `<span style="font-size:12px;color:var(--red);margin-left:12px">${escHtml(state.txnError)}</span>` : ''}
    </div>`;
}

// ── Transaction table ────────────────────────────────────────────────────────
function renderTable(txns) {
  if (!txns.length) return `<div class="empty-state"><p>No transactions yet. Log your first sale above.</p></div>`;

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Client</th>
            <th>Item</th>
            <th style="text-align:right">Cost</th>
            <th style="text-align:right">Sold Price</th>
            <th style="text-align:right">Profit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${txns.map(t => `
            <tr>
              <td style="color:var(--text-secondary)">${escHtml(t.date || '')}</td>
              <td>${escHtml(t.client || '—')}</td>
              <td>${escHtml(t.item || '')}</td>
              <td style="text-align:right;font-variant-numeric:tabular-nums">${t.cost ? fmtMoney(t.cost) : '—'}</td>
              <td style="text-align:right;font-variant-numeric:tabular-nums">${fmtMoney(t.soldPrice || 0)}</td>
              <td style="text-align:right;font-variant-numeric:tabular-nums;color:${(t.profit||0) >= 0 ? 'var(--green)' : 'var(--red)'}">${t.cost ? fmtMoney(t.profit || 0) : '—'}</td>
              <td style="text-align:right">
                <button class="btn-ghost btn-sm" onclick="window.removeTransaction('${t.id}')" style="color:var(--text-muted);padding:2px 7px">×</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Main render ──────────────────────────────────────────────────────────────
export function renderSalesLog() {
  const txns = [...(state.transactions || [])].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    return (b.date || '') > (a.date || '') ? 1 : -1;
  });

  const { count, revenue, cost, profit } = calcStats();

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filter  = state.salesFilter || 'all';
  const filtered = filter === 'month'
    ? txns.filter(t => (t.date || '').startsWith(thisMonth))
    : txns;

  return `
    <div class="biz-header">
      <div class="biz-header-left">
        <div class="page-title">Sales</div>
        <div class="page-subtitle">Transaction log · synced to Google Sheets</div>
      </div>
    </div>

    ${txns.length ? `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="stat-label">Sold</div>
        <div class="stat-value">${count}</div>
        <div class="stat-sub">transactions</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Revenue</div>
        <div class="stat-value">${fmtMoney(revenue)}</div>
        <div class="stat-sub">total sold</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cost</div>
        <div class="stat-value">${fmtMoney(cost)}</div>
        <div class="stat-sub">capital in</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Profit</div>
        <div class="stat-value" style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtMoney(profit)}</div>
        <div class="stat-sub">net</div>
      </div>
    </div>` : ''}

    ${renderForm()}

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div class="pill-row" style="margin-bottom:0">
        <button class="pill ${filter === 'all' ? 'active' : ''}" onclick="window.setSalesFilter('all')">All <span style="opacity:.6;font-size:11px;margin-left:2px">${txns.length}</span></button>
        <button class="pill ${filter === 'month' ? 'active' : ''}" onclick="window.setSalesFilter('month')">This Month <span style="opacity:.6;font-size:11px;margin-left:2px">${txns.filter(t => (t.date||'').startsWith(thisMonth)).length}</span></button>
      </div>
      ${(state.sheetsCache?.sales?.rows || []).length ? `
        <button class="btn-ghost btn-sm" onclick="window.importTransactionsFromSheet()">Import from Sheet</button>
      ` : `
        <button class="btn-ghost btn-sm" onclick="window.loadSheetTab('sales')">Load Sheet Data</button>
      `}
    </div>

    ${state.notify && state.tab === 'sales' ? `<div class="notify notify-ok" style="margin-bottom:12px">${escHtml(state.notify.msg)}</div>` : ''}

    ${renderTable(filtered)}
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
