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

function initials(str) {
  return String(str || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
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

// ── Log form (collapsible) ───────────────────────────────────────────────────
function renderForm() {
  const txn    = state.newTxn || {};
  const dateVal = txn.date || today();
  const hasInv  = (state.sheetsCache?.inventory?.rows || []).length > 0;
  const open    = state.logFormOpen;

  return `
    <div style="border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:20px">
      <button
        onclick="window.toggleLogForm()"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:none;border:none;cursor:pointer;font-size:13px;font-weight:600;color:var(--text-primary)"
      >
        <span>+ Log Transaction</span>
        <span style="font-size:16px;color:var(--text-muted);transition:transform 0.2s;${open ? 'transform:rotate(180deg)' : ''}">⌄</span>
      </button>
      ${open ? `
      <div style="padding:0 18px 18px;border-top:1px solid var(--border)">
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
            <label class="form-label">Item ${!hasInv ? '<span style="color:var(--amber);font-weight:400">(load inventory first)</span>' : ''}</label>
            ${renderItemSearch()}
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Sold Price</label>
            <div style="display:flex;align-items:center">
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
          ${state.txnSubmitting ? 'Saving…' : 'Save Transaction'}
        </button>
        ${state.txnError ? `<span style="font-size:12px;color:var(--red);margin-left:12px">${escHtml(state.txnError)}</span>` : ''}
      </div>` : ''}
    </div>`;
}

// ── Transaction list (bank statement style) ──────────────────────────────────
function renderTxnList(txns) {
  if (!txns.length) return `
    <div class="empty-state" style="padding:40px 0">
      <p style="color:var(--text-muted)">No transactions yet.</p>
    </div>`;

  return `
    <div class="txn-list">
      ${txns.map(t => {
        const profit  = t.profit ?? (t.soldPrice - (t.cost || 0));
        const pos     = profit >= 0;
        const av      = initials(t.client || t.item || '?');
        return `
          <div class="txn-row">
            <div class="txn-avatar">${escHtml(av)}</div>
            <div class="txn-body">
              <div class="txn-name">${escHtml(t.item || '—')}</div>
              <div class="txn-meta">${fmtDate(t.date)}${t.client ? ' · ' + escHtml(t.client) : ''}</div>
            </div>
            <div class="txn-right">
              <div class="txn-profit" style="color:${pos ? 'var(--green)' : 'var(--red)'}">
                ${pos ? '+' : ''}${t.cost ? fmtMoney(profit) : '—'}
              </div>
              <div class="txn-sold">${fmtMoney(t.soldPrice || 0)}</div>
            </div>
            <button class="btn-ghost btn-sm" onclick="window.removeTransaction('${t.id}')"
              style="color:var(--text-muted);padding:2px 6px;font-size:12px;flex-shrink:0">×</button>
          </div>`;
      }).join('')}
    </div>`;
}

// ── Main render ──────────────────────────────────────────────────────────────
export function renderSalesLog() {
  const txns = [...(state.transactions || [])].sort((a, b) =>
    (b.date || '') > (a.date || '') ? 1 : -1
  );

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthName = now.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  const filter    = state.salesFilter || 'all';
  const filtered  = filter === 'month'
    ? txns.filter(t => (t.date || '').startsWith(thisMonth))
    : txns;

  const { count, revenue, cost, profit } = calcStats();
  const month = thisMonthStats();
  const heroProfit  = filter === 'month' ? month.profit  : profit;
  const heroRevenue = filter === 'month' ? month.revenue : revenue;
  const heroCount   = filter === 'month' ? month.count   : count;
  const heroCost    = filter === 'month'
    ? filtered.reduce((s, t) => s + (t.cost || 0), 0)
    : cost;

  const heroGrad = heroProfit >= 0
    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
    : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';

  return `
    <div class="wallet-hero" style="background:${heroGrad}">
      <div class="wallet-hero-eyebrow">Net Profit · ${filter === 'month' ? monthName : 'All Time'}</div>
      <div class="wallet-hero-amount">${fmtMoney(heroProfit)}</div>
      <div class="wallet-hero-row">
        <div class="wallet-hero-stat">Revenue <strong>${fmtMoney(heroRevenue)}</strong></div>
        <div class="wallet-hero-stat">COGS <strong>${fmtMoney(heroCost)}</strong></div>
        <div class="wallet-hero-stat">Sales <strong>${heroCount}</strong></div>
      </div>
    </div>

    <div class="wallet-stats">
      <div class="wallet-stat">
        <div class="wallet-stat-label">Revenue</div>
        <div class="wallet-stat-value">${fmtMoney(revenue)}</div>
        <div class="wallet-stat-sub">all time</div>
      </div>
      <div class="wallet-stat">
        <div class="wallet-stat-label">COGS</div>
        <div class="wallet-stat-value">${fmtMoney(cost)}</div>
        <div class="wallet-stat-sub">total cost</div>
      </div>
      <div class="wallet-stat">
        <div class="wallet-stat-label">Profit</div>
        <div class="wallet-stat-value" style="color:${profit >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${fmtMoney(profit)}
        </div>
        <div class="wallet-stat-sub">${count} sales</div>
      </div>
    </div>

    ${renderForm()}

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <div class="pill-row" style="margin-bottom:0">
        <button class="pill ${filter === 'all'   ? 'active' : ''}" onclick="window.setSalesFilter('all')">All <span style="opacity:.5;font-size:11px">${txns.length}</span></button>
        <button class="pill ${filter === 'month' ? 'active' : ''}" onclick="window.setSalesFilter('month')">This Month <span style="opacity:.5;font-size:11px">${txns.filter(t => (t.date||'').startsWith(thisMonth)).length}</span></button>
      </div>
      ${(state.sheetsCache?.sales?.rows || []).length
        ? `<button class="btn-ghost btn-sm" onclick="window.importTransactionsFromSheet()">Import from Sheet</button>`
        : `<button class="btn-ghost btn-sm" onclick="window.loadSheetTab('sales')">Load Sheet Data</button>`}
    </div>

    ${state.notify && state.tab === 'sales' ? `<div class="notify notify-ok" style="margin-bottom:12px">${escHtml(state.notify.msg)}</div>` : ''}

    ${renderTxnList(filtered)}
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
