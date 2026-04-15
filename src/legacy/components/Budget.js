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

function initials(str) {
  return String(str || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── Budget Cards ─────────────────────────────────────────────────────────────
function renderBudgetCards() {
  const budgets = state.budgets || [];
  if (!budgets.length) return `
    <div class="empty-state" style="padding:2rem 0">
      <p>No budgets set. Add a category below to get started.</p>
    </div>`;

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:24px">
      ${budgets.map(b => {
        const spent     = spentThisMonth(b.name);
        const remaining = b.amount - spent;
        const pct       = b.amount > 0 ? Math.min(1, spent / b.amount) : 0;
        const over      = remaining < 0;
        const barColor  = pct >= 1 ? 'var(--red)' : pct >= 0.8 ? 'var(--amber)' : 'var(--green)';

        return `
          <div class="wallet-stat" style="position:relative">
            <button onclick="window.removeBudget('${b.id}')"
              style="position:absolute;top:10px;right:10px;background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:14px;padding:0;line-height:1">×</button>
            <div class="wallet-stat-label">${escHtml(b.name)}</div>
            <div class="wallet-stat-value" style="color:${over ? 'var(--red)' : 'var(--text-primary)'}">${fmtMoney(spent)}</div>
            <div class="wallet-stat-sub" style="margin-bottom:8px">of ${fmtMoney(b.amount)}</div>
            <div style="height:4px;background:var(--border);border-radius:99px;overflow:hidden;margin-bottom:5px">
              <div style="height:100%;width:${(pct * 100).toFixed(1)}%;background:${barColor};border-radius:99px;transition:width 0.3s"></div>
            </div>
            <div style="font-size:10px;color:${over ? 'var(--red)' : 'var(--text-muted)'}">
              ${over ? `over by ${fmtMoney(Math.abs(remaining))}` : `${fmtMoney(remaining)} left`}
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
    <div style="border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:12px">
      <div style="padding:14px 18px;font-size:13px;font-weight:600;color:var(--text-primary);border-bottom:1px solid var(--border)">Set Budget</div>
      <div style="padding:14px 18px">
        <div class="form-grid-2" style="margin-bottom:12px">
          <div class="form-group" style="margin:0">
            <label class="form-label">Category</label>
            <input id="budget-cat-input" type="text" placeholder="e.g. Sourcing" list="budget-cat-list" style="width:100%"/>
            <datalist id="budget-cat-list">
              ${suggestions.map(c => `<option value="${escHtml(c)}">`).join('')}
            </datalist>
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Monthly Amount</label>
            <div style="display:flex;align-items:center">
              <span style="padding:8px 10px;background:var(--bg-surface);border:1px solid var(--border);border-right:none;border-radius:var(--radius-md) 0 0 var(--radius-md);font-size:13px;color:var(--text-muted)">₱</span>
              <input id="budget-amt-input" type="number" min="0" step="100" placeholder="0" style="border-radius:0 var(--radius-md) var(--radius-md) 0;flex:1"/>
            </div>
          </div>
        </div>
        <button class="btn-primary btn-sm" onclick="window.addBudget()">Add Budget</button>
      </div>
    </div>`;
}

// ── Log Expense Form ──────────────────────────────────────────────────────────
function renderExpenseForm() {
  const budgets = state.budgets || [];
  const today   = new Date().toISOString().slice(0, 10);

  return `
    <div style="border:1px solid var(--border);border-radius:16px;overflow:hidden;margin-bottom:24px">
      <div style="padding:14px 18px;font-size:13px;font-weight:600;color:var(--text-primary);border-bottom:1px solid var(--border)">Log Expense</div>
      <div style="padding:14px 18px">
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
      </div>
    </div>`;
}

// ── Expense History ───────────────────────────────────────────────────────────
function renderExpenseHistory() {
  const expenses = [...(state.budgetExpenses || [])].sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1);
  if (!expenses.length) return '';

  return `
    <div>
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px">History</div>
      <div class="txn-list">
        ${expenses.map(e => {
          const av = initials(e.category || '?');
          return `
            <div class="txn-row">
              <div class="txn-avatar" style="background:var(--bg-surface);color:var(--text-secondary);font-size:11px">${escHtml(av)}</div>
              <div class="txn-body">
                <div class="txn-name">${escHtml(e.note || e.category || '—')}</div>
                <div class="txn-meta">${fmtDate(e.date)}${e.category ? ' · ' + escHtml(e.category) : ''}</div>
              </div>
              <div class="txn-right">
                <div class="txn-profit" style="color:var(--red)">-${fmtMoney(e.amount || 0)}</div>
              </div>
              <button class="btn-ghost btn-sm" onclick="window.removeBudgetExpense('${e.id}')"
                style="color:var(--text-muted);padding:2px 6px;font-size:12px;flex-shrink:0">×</button>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ── Main render ──────────────────────────────────────────────────────────────
export function renderBudget() {
  const monthLabel = new Date().toLocaleString('en-PH', { month: 'long', year: 'numeric' });

  const totalBudget = (state.budgets || []).reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpent  = (state.budgets || []).reduce((s, b) => s + spentThisMonth(b.name), 0);
  const remaining   = totalBudget - totalSpent;
  const heroGrad = remaining >= 0
    ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
    : 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)';

  return `
    <div style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:16px">Budget</div>

    ${totalBudget > 0 ? `
      <div class="wallet-hero" style="background:${heroGrad}">
        <div class="wallet-hero-eyebrow">Remaining · ${escHtml(monthLabel)}</div>
        <div class="wallet-hero-amount">${fmtMoney(remaining)}</div>
        <div class="wallet-hero-row">
          <div class="wallet-hero-stat">Budget <strong>${fmtMoney(totalBudget)}</strong></div>
          <div class="wallet-hero-stat">Spent <strong>${fmtMoney(totalSpent)}</strong></div>
        </div>
      </div>
    ` : ''}

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
