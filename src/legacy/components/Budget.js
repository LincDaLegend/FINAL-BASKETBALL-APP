import { state } from '../utils/state.js';

const DEFAULT_CATEGORIES = ['Sourcing', 'Shipping', 'Packaging', 'Marketing', 'Tools', 'Other'];

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

function thisMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function spentThisMonth(categoryName) {
  const month = thisMonthKey();
  return (state.budgetExpenses || [])
    .filter(e => e.category === categoryName && (e.date || '').startsWith(month))
    .reduce((s, e) => s + (e.amount || 0), 0);
}

// ── Monthly spending SVG chart ────────────────────────────────────────────────
function renderSpendingChart() {
  const monthKey  = thisMonthKey();
  const [yr]      = monthKey.split('-').map(Number);
  const months    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Totals per month for this year
  const data = months.map((lbl, mi) => {
    const key = `${yr}-${String(mi + 1).padStart(2, '0')}`;
    const total = (state.budgetExpenses || [])
      .filter(e => (e.date || '').startsWith(key))
      .reduce((s, e) => s + (e.amount || 0), 0);
    return { lbl, total };
  });

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const W = 660, H = 160, padL = 48, padR = 8, padT = 8, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const barW   = Math.max(8, chartW / data.length - 6);

  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = maxVal * f;
    const y = padT + chartH - f * chartH;
    const lbl = v >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${Math.round(v)}`;
    return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>
            <text x="${(padL - 4).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="9" fill="#94a3b8">${lbl}</text>`;
  }).join('');

  const bars = data.map((d, i) => {
    const bh = Math.max(0, (d.total / maxVal) * chartH);
    const bx = padL + i * (chartW / data.length) + (chartW / data.length - barW) / 2;
    const by = padT + chartH - bh;
    const lx = (padL + i * (chartW / data.length) + chartW / data.length / 2).toFixed(1);
    const ly = (padT + chartH + 14).toFixed(1);
    const isCurrentMonth = i === new Date().getMonth();
    return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" fill="${isCurrentMonth ? '#7c3aed' : '#c4b5fd'}" rx="3"/>
            <text x="${lx}" y="${ly}" text-anchor="middle" font-size="9" fill="#94a3b8">${d.lbl}</text>`;
  }).join('');

  return `
    <div class="bgt-card" style="margin-bottom:16px">
      <div class="bgt-card-header">
        <div class="bgt-card-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Monthly Spending Breakdown (${yr})
        </div>
      </div>
      <div style="padding:16px 20px;overflow-x:auto">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:360px;height:auto;display:block">
          ${grid}${bars}
        </svg>
      </div>
    </div>`;
}

// ── Budget category rows ──────────────────────────────────────────────────────
function renderBudgetRows() {
  const budgets = state.budgets || [];
  if (!budgets.length) return `
    <div style="padding:40px 20px;text-align:center">
      <p style="color:#94a3b8;font-size:13px">No budget categories yet. Add one below.</p>
    </div>`;

  return budgets.map(b => {
    const spent     = spentThisMonth(b.name);
    const remaining = b.amount - spent;
    const pct       = b.amount > 0 ? Math.min(1, spent / b.amount) : 0;
    const over      = remaining < 0;
    const barColor  = pct >= 1 ? '#ef4444' : pct >= 0.8 ? '#f59e0b' : '#10b981';
    const consumedColor = pct >= 1 ? '#ef4444' : '#10b981';

    return `
      <div class="bgt-budget-row">
        <div class="bgt-budget-meta">
          <span class="bgt-budget-consumed" style="color:${consumedColor}">${Math.round(pct * 100)}% Consumed</span>
          <span style="font-size:11px;color:${over ? '#ef4444' : '#94a3b8'};font-weight:600">
            ${over ? `Over by ${fmtMoney(Math.abs(remaining))}` : `Remaining: ${fmtMoney(remaining)}`}
          </span>
        </div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div class="bgt-budget-name" style="display:flex;align-items:center;gap:8px">
            ${escHtml(b.name)}
            <button onclick="window.removeBudget('${b.id}')" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:16px;padding:0;margin-top:-2px;line-height:1">×</button>
          </div>
          <div class="bgt-budget-amounts">
            <div class="bgt-budget-amount-group">
              <div class="bgt-budget-amount-label">Actual Spent</div>
              <div class="bgt-budget-amount-val" style="color:${over ? '#ef4444' : '#0f172a'}">${fmtMoney(spent)}</div>
            </div>
            <div class="bgt-budget-amount-group" style="opacity:0.5">
              <div class="bgt-budget-amount-label">Monthly Budget</div>
              <div class="bgt-budget-amount-val">${fmtMoney(b.amount)}</div>
            </div>
          </div>
        </div>
        <div class="bgt-budget-bar-track">
          <div class="bgt-budget-bar-fill" style="width:${(pct * 100).toFixed(1)}%;background:${barColor}"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Add forms ─────────────────────────────────────────────────────────────────
function renderForms() {
  const budgets     = state.budgets || [];
  const suggestions = DEFAULT_CATEGORIES.filter(c => !budgets.map(b => b.name).includes(c));
  const today       = new Date().toISOString().slice(0, 10);

  return `
    <div class="form-grid-2" style="align-items:start;margin-bottom:16px">
      <div class="bgt-card" style="margin-bottom:0">
        <div class="bgt-card-header">
          <div class="bgt-card-title">Add Budget Category</div>
        </div>
        <div style="padding:16px 20px">
          <div class="form-grid-2" style="margin-bottom:12px">
            <div class="form-group" style="margin:0">
              <label class="form-label">Category</label>
              <input id="budget-cat-input" type="text" placeholder="e.g. Sourcing" list="budget-cat-list" style="width:100%"/>
              <datalist id="budget-cat-list">
                ${suggestions.map(c => `<option value="${escHtml(c)}">`).join('')}
              </datalist>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">Monthly Budget</label>
              <div style="display:flex;align-items:center">
                <span style="padding:8px 10px;background:#f8fafc;border:1px solid #e8eaed;border-right:none;border-radius:12px 0 0 12px;font-size:13px;color:#94a3b8">₱</span>
                <input id="budget-amt-input" type="number" min="0" step="100" placeholder="0" style="border-radius:0 12px 12px 0;flex:1"/>
              </div>
            </div>
          </div>
          <button class="bgt-btn bgt-btn-primary" onclick="window.addBudget()">Add Category</button>
        </div>
      </div>

      <div class="bgt-card" style="margin-bottom:0">
        <div class="bgt-card-header">
          <div class="bgt-card-title">Log Expense</div>
        </div>
        <div style="padding:16px 20px">
          <div class="form-grid-2" style="margin-bottom:10px">
            <div class="form-group" style="margin:0">
              <label class="form-label">Category</label>
              <select id="expense-cat-select" style="width:100%">
                <option value="">— Select —</option>
                ${budgets.map(b => `<option value="${escHtml(b.name)}">${escHtml(b.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">Amount</label>
              <div style="display:flex;align-items:center">
                <span style="padding:8px 10px;background:#f8fafc;border:1px solid #e8eaed;border-right:none;border-radius:12px 0 0 12px;font-size:13px;color:#94a3b8">₱</span>
                <input id="expense-amt-input" type="number" min="0" step="1" placeholder="0" style="border-radius:0 12px 12px 0;flex:1"/>
              </div>
            </div>
          </div>
          <div class="form-grid-2" style="margin-bottom:14px">
            <div class="form-group" style="margin:0">
              <label class="form-label">Description</label>
              <input id="expense-note-input" type="text" placeholder="What was this for?" style="width:100%"/>
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">Date</label>
              <input id="expense-date-input" type="date" value="${today}" style="width:100%"/>
            </div>
          </div>
          <button class="bgt-btn bgt-btn-primary" onclick="window.addBudgetExpense()">Log Expense</button>
        </div>
      </div>
    </div>`;
}

// ── Expense history table ─────────────────────────────────────────────────────
function renderExpenseHistory() {
  const expenses    = [...(state.budgetExpenses || [])].sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1);
  const budgets     = state.budgets || [];
  const allCats     = [...new Set(expenses.map(e => e.category))];
  const activeFilter = state.expenseCatFilter || 'all';
  const filtered    = activeFilter === 'all' ? expenses : expenses.filter(e => e.category === activeFilter);
  const filteredTotal = filtered.reduce((s, e) => s + (e.amount || 0), 0);

  if (!expenses.length) return '';

  return `
    <div class="bgt-card">
      <div class="bgt-filter-bar">
        <div class="bgt-search-wrap" style="max-width:200px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search transactions…" oninput="window.expenseSearch(this.value)" />
        </div>
        <div class="bgt-pill-tabs">
          <button class="bgt-pill-tab ${activeFilter === 'all' ? 'active' : ''}" onclick="window.setExpenseCatFilter('all')">All</button>
          ${allCats.map(c => `<button class="bgt-pill-tab ${activeFilter === c ? 'active' : ''}" onclick="window.setExpenseCatFilter('${escHtml(c)}')">${escHtml(c)}</button>`).join('')}
        </div>
      </div>
      <table class="bgt-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th style="text-align:right">Amount</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(e => `
            <tr>
              <td class="bgt-date-cell">
                <span style="display:flex;align-items:center;gap:5px">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  ${escHtml(fmtDate(e.date))}
                </span>
              </td>
              <td style="font-weight:600">${escHtml(e.note || '—')}</td>
              <td><span class="bgt-badge bgt-badge-gray">${escHtml(e.category || '')}</span></td>
              <td class="bgt-amount-cell">${fmtMoney(e.amount || 0)}</td>
              <td style="text-align:right">
                <button onclick="window.removeBudgetExpense('${e.id}')" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:16px;padding:0 4px;line-height:1">×</button>
              </td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid #f1f5f9">
            <td colspan="3" style="padding:12px 20px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;border-bottom:none">Filtered Total</td>
            <td class="bgt-amount-cell" style="padding:12px 20px;font-weight:700;border-bottom:none">${fmtMoney(filteredTotal)}</td>
            <td style="border-bottom:none"></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

// ── Main render ──────────────────────────────────────────────────────────────
export function renderBudget() {
  const monthLabel  = new Date().toLocaleString('en-PH', { month: 'long', year: 'numeric' });
  const totalBudget = (state.budgets || []).reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpent  = (state.budgets || []).reduce((s, b) => s + spentThisMonth(b.name), 0);
  const ytdSpent    = (state.budgetExpenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const txnCount    = (state.budgetExpenses || []).length;

  return `
    <div class="bgt-page-header">
      <div>
        <div class="bgt-title">Expenses</div>
        <div class="bgt-subtitle">Track your business outflows and overheads.</div>
      </div>
    </div>

    <div class="bgt-stat-grid bgt-stat-grid-3" style="margin-bottom:16px">
      <div class="bgt-stat">
        <div class="bgt-stat-label">Total Spent (${escHtml(monthLabel)})</div>
        <div class="bgt-stat-value">${fmtMoney(totalSpent)}</div>
      </div>
      <div class="bgt-stat">
        <div class="bgt-stat-label">Yearly Summary YTD</div>
        <div class="bgt-stat-value">${fmtMoney(ytdSpent)}</div>
        <div class="bgt-stat-sub">of ${fmtMoney(totalBudget)} Budget</div>
      </div>
      <div class="bgt-stat">
        <div class="bgt-stat-label">Transactions</div>
        <div class="bgt-stat-value">${txnCount}</div>
      </div>
    </div>

    ${renderSpendingChart()}

    <div class="bgt-card" style="margin-bottom:16px">
      <div class="bgt-card-header">
        <div class="bgt-card-title">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          Monthly Budget Tracker
        </div>
        <button class="bgt-btn" onclick="window.toggleAddBudgetForm && window.toggleAddBudgetForm()" style="font-size:12px;padding:5px 12px">
          + Add Category
        </button>
      </div>
      ${renderBudgetRows()}
    </div>

    ${renderForms()}
    ${renderExpenseHistory()}
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
