import { state } from '../utils/state.js';

const DEFAULT_CATEGORIES = ['Sourcing', 'Shipping', 'Packaging', 'Marketing', 'Tools', 'Other'];

function parseMoney(val) {
  return parseFloat(String(val || '0').replace(/[₱,]/g, '')) || 0;
}

function fmtMoney(n) {
  return '₱' + Math.round(n).toLocaleString('en-PH');
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

// ── Budget Cards ─────────────────────────────────────────────────────────────
function renderBudgetCards() {
  const budgets = state.budgets || [];
  if (!budgets.length) return `
    <div class="empty-state" style="padding:2rem 0">
      <p>No budgets set. Add a category below to get started.</p>
    </div>`;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:24px">
      ${budgets.map(b => {
        const spent     = spentThisMonth(b.name);
        const remaining = b.amount - spent;
        const pct       = b.amount > 0 ? Math.min(1, spent / b.amount) : 0;
        const over      = remaining < 0;
        const barColor  = pct >= 1 ? 'var(--red)' : pct >= 0.8 ? 'var(--amber)' : 'var(--green)';

        return `
          <div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
              <div style="font-size:13px;font-weight:600">${escHtml(b.name)}</div>
              <button class="btn-ghost btn-sm" onclick="window.removeBudget('${b.id}')" style="color:var(--text-muted);padding:1px 6px;font-size:11px">×</button>
            </div>
            <div style="font-size:22px;font-weight:600;font-family:var(--mono);color:${over ? 'var(--red)' : 'var(--text-primary)'};margin-bottom:2px">${fmtMoney(spent)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">of ${fmtMoney(b.amount)} this month</div>
            <div style="height:5px;background:var(--bg-surface);border-radius:99px;overflow:hidden;margin-bottom:8px">
              <div style="height:100%;width:${(pct * 100).toFixed(1)}%;background:${barColor};border-radius:99px;transition:width 0.3s"></div>
            </div>
            <div style="font-size:11px;color:${over ? 'var(--red)' : 'var(--text-muted)'}">
              ${over ? `over by ${fmtMoney(Math.abs(remaining))}` : `${fmtMoney(remaining)} remaining`}
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ── Add Budget Form ───────────────────────────────────────────────────────────
function renderAddBudget() {
  const cats = (state.budgets || []).map(b => b.name);
  const suggestions = DEFAULT_CATEGORIES.filter(c => !cats.includes(c));

  return `
    <div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px;margin-bottom:20px">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px">Set Budget</div>
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
            <span style="padding:8px 10px;background:var(--bg-surface);border:1px solid var(--border);border-right:none;border-radius:var(--radius-md) 0 0 var(--radius-md);font-size:13px;color:var(--text-muted)">₱</span>
            <input id="budget-amt-input" type="number" min="0" step="100" placeholder="0" style="border-radius:0 var(--radius-md) var(--radius-md) 0;flex:1"/>
          </div>
        </div>
      </div>
      <button class="btn-primary btn-sm" onclick="window.addBudget()">Add Budget</button>
    </div>`;
}

// ── Log Expense Form ──────────────────────────────────────────────────────────
function renderExpenseForm() {
  const budgets = state.budgets || [];
  const today   = new Date().toISOString().slice(0, 10);

  return `
    <div style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:18px 20px;margin-bottom:24px">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:14px">Log Expense</div>
      <div class="form-grid-2" style="margin-bottom:10px">
        <div class="form-group" style="margin:0">
          <label class="form-label">Category</label>
          <select id="expense-cat-select" style="width:100%">
            <option value="">— Select category —</option>
            ${budgets.map(b => `<option value="${escHtml(b.name)}">${escHtml(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Amount</label>
          <div style="display:flex;align-items:center">
            <span style="padding:8px 10px;background:var(--bg-surface);border:1px solid var(--border);border-right:none;border-radius:var(--radius-md) 0 0 var(--radius-md);font-size:13px;color:var(--text-muted)">₱</span>
            <input id="expense-amt-input" type="number" min="0" step="1" placeholder="0" style="border-radius:0 var(--radius-md) var(--radius-md) 0;flex:1"/>
          </div>
        </div>
      </div>
      <div class="form-grid-2" style="margin-bottom:14px">
        <div class="form-group" style="margin:0">
          <label class="form-label">Description <span style="font-weight:400;color:var(--text-muted)">(optional)</span></label>
          <input id="expense-note-input" type="text" placeholder="What was this for?" style="width:100%"/>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Date</label>
          <input id="expense-date-input" type="date" value="${today}" style="width:100%"/>
        </div>
      </div>
      <button class="btn-primary btn-sm" onclick="window.addBudgetExpense()">Log Expense</button>
    </div>`;
}

// ── Expense History ───────────────────────────────────────────────────────────
function renderExpenseHistory() {
  const expenses = [...(state.budgetExpenses || [])].sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1);
  if (!expenses.length) return '';

  return `
    <div>
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">Expense History</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th style="text-align:right">Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${expenses.map(e => `
              <tr>
                <td style="color:var(--text-secondary)">${escHtml(e.date || '')}</td>
                <td><span class="badge badge-gray">${escHtml(e.category || '')}</span></td>
                <td style="color:var(--text-secondary)">${escHtml(e.note || '—')}</td>
                <td style="text-align:right;font-variant-numeric:tabular-nums">${fmtMoney(e.amount || 0)}</td>
                <td style="text-align:right">
                  <button class="btn-ghost btn-sm" onclick="window.removeBudgetExpense('${e.id}')" style="color:var(--text-muted);padding:2px 7px">×</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Main render ──────────────────────────────────────────────────────────────
export function renderBudget() {
  const month      = thisMonthKey();
  const monthLabel = new Date().toLocaleString('en-PH', { month: 'long', year: 'numeric' });

  // Total budget vs total spent this month
  const totalBudget = (state.budgets || []).reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpent  = (state.budgets || []).reduce((s, b) => s + spentThisMonth(b.name), 0);

  return `
    <div class="biz-header">
      <div class="biz-header-left">
        <div class="page-title">Budget</div>
        <div class="page-subtitle">${escHtml(monthLabel)} · expense tracking</div>
      </div>
    </div>

    ${state.budgets?.length ? `
    <div class="stats-grid" style="margin-bottom:20px;grid-template-columns:repeat(3,minmax(0,1fr))">
      <div class="stat-card">
        <div class="stat-label">Total Budget</div>
        <div class="stat-value">${fmtMoney(totalBudget)}</div>
        <div class="stat-sub">this month</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Spent</div>
        <div class="stat-value" style="color:${totalSpent > totalBudget ? 'var(--red)' : 'var(--text-primary)'}">${fmtMoney(totalSpent)}</div>
        <div class="stat-sub">so far</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Remaining</div>
        <div class="stat-value" style="color:${totalBudget - totalSpent < 0 ? 'var(--red)' : 'var(--green)'}">${fmtMoney(totalBudget - totalSpent)}</div>
        <div class="stat-sub">available</div>
      </div>
    </div>` : ''}

    ${renderBudgetCards()}

    <div class="form-grid-2" style="align-items:start">
      <div>${renderAddBudget()}</div>
      <div>${renderExpenseForm()}</div>
    </div>

    ${renderExpenseHistory()}
  `;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
