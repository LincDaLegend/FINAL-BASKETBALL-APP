import { state, persistDeals, emptyDeal, dealStats } from '../utils/state.js';
import { CATEGORIES, GRADES, CAT_BADGE_CLASS } from '../utils/constants.js';

// ── Deal Log Page ─────────────────────────────────────────────
export function renderDeals() {
  const stats = dealStats();

  return `
    <div class="page-title">Deal Log</div>
    <div class="page-subtitle">Every deal you log becomes ML training data for AI scoring</div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Past deals</div>
        <div class="stat-value">${stats.count}</div>
        <div class="stat-sub">logged</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg ROI</div>
        <div class="stat-value">${stats.count ? stats.avgROI : '—'}${stats.count ? '%' : ''}</div>
        <div class="stat-sub">return on investment</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg flip</div>
        <div class="stat-value">${stats.count ? stats.avgDays : '—'}${stats.count ? 'd' : ''}</div>
        <div class="stat-sub">days to sell</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total profit</div>
        <div class="stat-value">$${stats.count ? stats.totalProfit.toFixed(0) : '0'}</div>
        <div class="stat-sub">USD gross profit</div>
      </div>
    </div>

    ${state.notify ? renderNotify(state.notify) : ''}

    <div class="card-section">
      <div class="section-header">
        <div>
          <div class="section-title">Log a completed deal</div>
          <div class="section-subtitle">The AI reads your last 25 deals when scoring new listings</div>
        </div>
      </div>

      <div class="form-grid-4">
        <div class="form-group">
          <label class="form-label">Player *</label>
          <input id="nd-player" type="text" placeholder="LeBron James" value="${escHtml(state.newDeal.player)}" oninput="window.ndSet('player',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Year</label>
          <input id="nd-year" type="text" placeholder="2021" value="${escHtml(state.newDeal.year)}" oninput="window.ndSet('year',this.value)" style="max-width:90px" />
        </div>
        <div class="form-group">
          <label class="form-label">Set</label>
          <input id="nd-set" type="text" placeholder="Prizm" value="${escHtml(state.newDeal.set)}" oninput="window.ndSet('set',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Variant</label>
          <input id="nd-variant" type="text" placeholder="Silver RC" value="${escHtml(state.newDeal.variant)}" oninput="window.ndSet('variant',this.value)" />
        </div>
      </div>

      <div class="form-grid-3">
        <div class="form-group">
          <label class="form-label">Grade</label>
          <select id="nd-grade" onchange="window.ndSet('grade',this.value)">
            ${GRADES.map(g => `<option value="${g}" ${state.newDeal.grade === g ? 'selected' : ''}>${g}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select id="nd-category" onchange="window.ndSet('category',this.value)">
            ${CATEGORIES.map(c => `<option value="${c}" ${state.newDeal.category === c ? 'selected' : ''}>${capFirst(c)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Days to sell</label>
          <input id="nd-days" type="number" min="0" placeholder="5" value="${escHtml(String(state.newDeal.days))}" oninput="window.ndSet('days',this.value)" />
        </div>
      </div>

      <div class="form-grid-3">
        <div class="form-group">
          <label class="form-label">Buy price (USD) *</label>
          <input id="nd-buy" type="number" min="0" step="0.01" placeholder="42.00" value="${escHtml(String(state.newDeal.buyPrice))}" oninput="window.ndSet('buyPrice',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Sell price (USD) *</label>
          <input id="nd-sell" type="number" min="0" step="0.01" placeholder="65.00" value="${escHtml(String(state.newDeal.sellPrice))}" oninput="window.ndSet('sellPrice',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Calculated ROI</label>
          <input type="text" readonly value="${calcROIPreview()}" style="background:var(--bg-surface);color:var(--green);font-family:var(--mono)" />
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Aesthetic note</label>
          <input id="nd-aesthetic" type="text" placeholder="clean silver holo, great centering, eye appeal 9/10" value="${escHtml(state.newDeal.aesthetic)}" oninput="window.ndSet('aesthetic',this.value)" />
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input id="nd-notes" type="text" placeholder="lot deal, undergraded, etc." value="${escHtml(state.newDeal.notes)}" oninput="window.ndSet('notes',this.value)" />
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button class="btn-secondary" onclick="window.clearNewDeal()">Clear</button>
        <button class="btn-primary" onclick="window.logDeal()">Log deal</button>
      </div>
    </div>

    <div class="card-section">
      <div class="section-header">
        <div>
          <div class="section-title">Deal history</div>
          <div class="section-subtitle">ML training data — ${state.deals.length} deals</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn-ghost btn-sm" onclick="window.exportDeals()">Export CSV</button>
          <button class="btn-danger btn-sm" onclick="window.clearAllDeals()">Clear all</button>
        </div>
      </div>

      ${state.deals.length === 0 ? `
        <div class="empty-state" style="padding:2rem">
          <p>No deals logged yet. Log your first deal above to start training the AI.</p>
        </div>
      ` : state.deals.slice().reverse().map(d => renderDealRow(d)).join('')}
    </div>
  `;
}

function renderDealRow(d) {
  const roiColor = d.roi >= 50 ? 'var(--green)' : d.roi >= 25 ? 'var(--amber)' : 'var(--red)';
  const catCls   = CAT_BADGE_CLASS[d.category] || 'badge-gray';

  return `
    <div class="deal-row">
      <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-muted);flex-shrink:0;font-family:var(--mono)">
        ${d.roi >= 50 ? '<span style="color:var(--green)">A</span>' : d.roi >= 25 ? '<span style="color:var(--amber)">B</span>' : '<span style="color:var(--red)">C</span>'}
      </div>
      <div class="deal-main">
        <div class="deal-title">${escHtml(d.player)}${d.year ? ' · ' + d.year : ''}${d.set ? ' ' + d.set : ''}${d.variant ? ' ' + d.variant : ''} <span style="color:var(--text-muted);font-weight:400">${d.grade}</span></div>
        <div class="deal-meta">
          <span class="badge ${catCls}" style="margin-right:6px">${d.category}</span>
          buy $${d.buyPrice} → sell $${d.sellPrice} · ${d.days}d flip
          ${d.aesthetic ? ' · ' + escHtml(d.aesthetic) : ''}
        </div>
      </div>
      <div class="deal-roi" style="color:${roiColor}">+${d.roi}%</div>
      <button class="btn-ghost btn-sm" onclick="window.removeDeal(${d.id})" style="color:var(--text-muted)">×</button>
    </div>
  `;
}

// ── Computed helpers ──────────────────────────────────────────
function calcROIPreview() {
  const buy  = parseFloat(state.newDeal.buyPrice);
  const sell = parseFloat(state.newDeal.sellPrice);
  if (!buy || !sell || buy <= 0) return '—';
  return '+' + Math.round(((sell - buy) / buy) * 100) + '%';
}

// ── Actions ───────────────────────────────────────────────────
export function logDeal() {
  const d = state.newDeal;
  if (!d.player || !d.buyPrice || !d.sellPrice) {
    state.notify = { type: 'err', msg: 'Player name, buy price, and sell price are required.' };
    window.renderApp();
    return;
  }
  const roi = Math.round(((+d.sellPrice - +d.buyPrice) / +d.buyPrice) * 100);
  state.deals.push({
    id:         Date.now(),
    player:     d.player,
    year:       d.year,
    set:        d.set,
    variant:    d.variant,
    grade:      d.grade,
    buyPrice:   +d.buyPrice,
    sellPrice:  +d.sellPrice,
    days:       +d.days || 0,
    category:   d.category,
    roi,
    aesthetic:  d.aesthetic,
    notes:      d.notes,
  });
  persistDeals();
  state.newDeal = emptyDeal();
  state.notify  = { type: 'ok', msg: `Deal logged — +${roi}% ROI · ML model updated with ${state.deals.length} deals` };
  window.renderApp();
}

export function removeDeal(id) {
  state.deals = state.deals.filter(d => d.id !== id);
  persistDeals();
  window.renderApp();
}

export function clearAllDeals() {
  if (!confirm('Clear all deal history? This resets the ML training data.')) return;
  state.deals = [];
  persistDeals();
  state.notify = { type: 'ok', msg: 'Deal history cleared.' };
  window.renderApp();
}

export function exportDeals() {
  const header = 'player,year,set,variant,grade,buyPrice,sellPrice,days,roi,category,aesthetic,notes';
  const rows   = state.deals.map(d =>
    [d.player, d.year, d.set, d.variant, d.grade, d.buyPrice, d.sellPrice, d.days, d.roi, d.category, d.aesthetic, d.notes]
      .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
      .join(',')
  );
  const csv  = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'card-arb-deals.csv';
  a.click();
}

// ── Helpers ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function renderNotify({ type, msg }) {
  const cls = type === 'ok' ? 'notify-ok' : type === 'info' ? 'notify-info' : 'notify-err';
  return `<div class="notify ${cls}">${msg}</div>`;
}
