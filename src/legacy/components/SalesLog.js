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

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcStats() {
  const txns = state.transactions || [];
  return {
    count:   txns.length,
    revenue: txns.reduce((s, t) => s + (t.soldPrice || 0), 0),
    cost:    txns.reduce((s, t) => s + (t.cost     || 0), 0),
    profit:  txns.reduce((s, t) => s + (t.profit   || 0), 0),
  };
}

function thisMonthStats() {
  const now = new Date();
  const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const txns = (state.transactions || []).filter(t => (t.date || '').startsWith(key));
  return {
    count:   txns.length,
    revenue: txns.reduce((s, t) => s + (t.soldPrice || 0), 0),
    cost:    txns.reduce((s, t) => s + (t.cost || 0), 0),
    profit:  txns.reduce((s, t) => s + (t.profit   || 0), 0),
  };
}

// ── Inventory search dropdown ────────────────────────────────────────────────
function renderItemSearch() {
  const txn   = state.newTxn || {};
  const query = txn.itemSearch || '';
  const sel   = txn.selectedItem;

  if (sel) {
    return `
      <div style="display:flex;align-items:center;gap:6px;padding:9px 12px;border:1px solid #e8eaed;border-radius:12px;background:#f8fafc">
        <div style="flex:1;font-size:13px;color:#0f172a">${escHtml(sel['Item Name'] || sel['Item'] || '')}</div>
        <div style="font-size:12px;color:#94a3b8">Cost: ${fmtMoney(parseMoney(sel['Cost']))}</div>
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
        <div style="position:absolute;top:calc(100% + 2px);left:0;right:0;z-index:100;background:#fff;border:1px solid #e8eaed;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08);max-height:220px;overflow-y:auto">
          ${matches.map((r, i) => {
            const name = r['Item Name'] || r['Item'] || '(unnamed)';
            const cost = parseMoney(r['Cost']);
            return `<div
              style="padding:10px 14px;cursor:pointer;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f1f5f9"
              onmousedown="event.preventDefault();window.txnSelectItem(${i})"
            >
              <span style="color:#0f172a">${escHtml(name)}</span>
              <span style="font-size:12px;color:#94a3b8">${fmtMoney(cost)}</span>
            </div>`;
          }).join('')}
        </div>` : ''}
    </div>`;
}

// ── Log form (collapsible) ───────────────────────────────────────────────────
function renderForm() {
  const txn    = state.newTxn || {};
  const dateVal = txn.date || today();
  const hasInv  = (state.sheetsCache?.inventory?.rows || []).length > 0;
  const open    = state.logFormOpen;

  return `
    <div class="bgt-card" style="margin-bottom:16px">
      <button
        onclick="window.toggleLogForm()"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:700;color:#0f172a"
      >
        <span style="display:flex;align-items:center;gap:8px">
          <span style="width:24px;height:24px;border-radius:8px;background:#f0fdf4;display:flex;align-items:center;justify-content:center;font-size:14px;color:#10b981">+</span>
          New Sale
        </span>
        <span style="font-size:14px;color:#94a3b8;transition:transform 0.2s;${open ? 'transform:rotate(180deg)' : ''}">⌄</span>
      </button>
      ${open ? `
      <div style="padding:0 20px 20px;border-top:1px solid #f1f5f9">
        <div style="height:14px"></div>
        <div class="form-grid-2" style="margin-bottom:10px">
          <div class="form-group" style="margin:0">
            <label class="form-label">Date</label>
            <input type="date" value="${dateVal}" oninput="window.txnSet('date', this.value)" style="width:100%"/>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Client</label>
            <input type="text" placeholder="Buyer name" value="${escHtml(txn.client || '')}" oninput="window.txnSet('client', this.value)" style="width:100%"/>
          </div>
        </div>
        <div class="form-grid-2" style="margin-bottom:14px">
          <div class="form-group" style="margin:0">
            <label class="form-label">Item ${!hasInv ? '<span style="color:#f59e0b;font-weight:400">(load inventory first)</span>' : ''}</label>
            ${renderItemSearch()}
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Sold Price</label>
            <div style="display:flex;align-items:center">
              <span style="padding:8px 10px;background:#f8fafc;border:1px solid #e8eaed;border-right:none;border-radius:12px 0 0 12px;font-size:13px;color:#94a3b8">₱</span>
              <input type="number" min="0" step="1" placeholder="0"
                value="${escHtml(String(txn.soldPrice || ''))}"
                oninput="window.txnSet('soldPrice', this.value)"
                style="border-radius:0 12px 12px 0;flex:1"
              />
            </div>
          </div>
        </div>
        <button class="bgt-btn bgt-btn-primary" onclick="window.submitTransaction()"
          ${state.txnSubmitting ? 'disabled' : ''}>
          ${state.txnSubmitting ? 'Saving…' : 'Record Sale'}
        </button>
        ${state.txnError ? `<span style="font-size:12px;color:#ef4444;margin-left:12px">${escHtml(state.txnError)}</span>` : ''}
      </div>` : ''}
    </div>`;
}

// ── Transaction rows ─────────────────────────────────────────────────────────
function renderTxnList(txns) {
  if (!txns.length) return `
    <div style="padding:48px 20px;text-align:center">
      <div style="font-size:32px;margin-bottom:12px;opacity:0.2">🧾</div>
      <p style="color:#94a3b8;font-size:13px">No transactions yet.</p>
    </div>`;

  return `
    <table class="bgt-table">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:right">Sale</th>
          <th style="text-align:right">Profit</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${txns.map(t => {
          const profit = t.profit ?? (t.soldPrice - (t.cost || 0));
          const pos    = profit >= 0;
          const hasCost = t.cost != null && t.cost > 0;
          return `
            <tr>
              <td>
                <div style="font-weight:700;color:#0f172a;font-size:13px">${escHtml(t.item || '—')}</div>
                <div style="font-size:11px;color:#94a3b8;margin-top:2px">
                  ${escHtml(fmtDate(t.date))}${t.client ? ` · ${escHtml(t.client)}` : ''}
                </div>
              </td>
              <td class="bgt-amount-cell" style="font-size:14px;font-weight:700;color:#0f172a">${fmtMoney(t.soldPrice || 0)}</td>
              <td class="bgt-amount-cell">
                ${hasCost
                  ? `<span style="font-size:14px;font-weight:700;color:${pos ? '#10b981' : '#ef4444'}">${pos ? '+' : ''}${fmtMoney(profit)}</span>`
                  : `<span style="color:#cbd5e1">—</span>`}
              </td>
              <td style="text-align:right">
                <button onclick="window.removeTransaction('${t.id}')"
                  style="background:none;border:none;cursor:pointer;color:#cbd5e1;font-size:16px;padding:0 4px;line-height:1;transition:color 0.15s" onmouseenter="this.style.color='#ef4444'" onmouseleave="this.style.color='#cbd5e1'">×</button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── Main render ──────────────────────────────────────────────────────────────
export function renderSalesLog() {
  const txns = [...(state.transactions || [])].sort((a, b) =>
    (b.date || '') > (a.date || '') ? 1 : -1
  );

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const filter    = state.salesFilter || 'all';
  const filtered  = filter === 'month'
    ? txns.filter(t => (t.date || '').startsWith(thisMonth))
    : txns;

  const { count, revenue, cost, profit } = calcStats();
  const month = thisMonthStats();

  const dispProfit  = filter === 'month' ? month.profit  : profit;
  const dispRevenue = filter === 'month' ? month.revenue : revenue;
  const dispCost    = filter === 'month' ? month.cost    : cost;
  const dispCount   = filter === 'month' ? month.count   : count;

  return `
    <div class="bgt-page-header">
      <div>
        <div class="bgt-title">Sales</div>
        <div class="bgt-subtitle">Record new sales and manage transaction details.</div>
      </div>
      <div class="bgt-header-actions">
        ${(state.sheetsCache?.sales?.rows || []).length
          ? `<button class="bgt-btn" onclick="window.importTransactionsFromSheet()">Import from Sheet</button>`
          : `<button class="bgt-btn" onclick="window.loadSheetTab('sales')">Load Sheet Data</button>`}
      </div>
    </div>

    <div class="bgt-stat-grid">
      <div class="bgt-stat">
        <div class="bgt-stat-label">Total Revenue</div>
        <div class="bgt-stat-value">${fmtMoney(revenue)}</div>
        <div class="bgt-stat-sub">all time</div>
      </div>
      <div class="bgt-stat">
        <div class="bgt-stat-label">Gross Profit</div>
        <div class="bgt-stat-value ${profit >= 0 ? 'bgt-green' : 'bgt-red'}">${fmtMoney(profit)}</div>
        <div class="bgt-stat-sub">all time</div>
      </div>
      <div class="bgt-stat">
        <div class="bgt-stat-label">This Month</div>
        <div class="bgt-stat-value ${month.profit >= 0 ? 'bgt-green' : 'bgt-red'}">${fmtMoney(month.profit)}</div>
        <div class="bgt-stat-sub">${month.count} sale${month.count !== 1 ? 's' : ''}</div>
      </div>
      <div class="bgt-stat">
        <div class="bgt-stat-label">Transactions</div>
        <div class="bgt-stat-value">${count}</div>
        <div class="bgt-stat-sub">total sales</div>
      </div>
    </div>

    ${renderForm()}

    ${state.notify && state.tab === 'sales' ? `<div class="notify notify-ok" style="margin-bottom:12px">${escHtml(state.notify.msg)}</div>` : ''}

    <div class="bgt-card">
      <div class="bgt-filter-bar">
        <div class="bgt-pill-tabs">
          <button class="bgt-pill-tab ${filter === 'all'   ? 'active' : ''}" onclick="window.setSalesFilter('all')">All <span style="opacity:.5;font-size:11px">${txns.length}</span></button>
          <button class="bgt-pill-tab ${filter === 'month' ? 'active' : ''}" onclick="window.setSalesFilter('month')">This Month <span style="opacity:.5;font-size:11px">${txns.filter(t => (t.date||'').startsWith(thisMonth)).length}</span></button>
        </div>
      </div>
      ${renderTxnList(filtered)}
    </div>
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
