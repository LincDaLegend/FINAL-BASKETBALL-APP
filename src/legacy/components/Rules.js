import { state, persistRules, persistSettings } from '../utils/state.js';
import {
  CATEGORIES, CAT_LABEL, CAT_BADGE_CLASS, CAT_HINT, DEFAULT_RULES, DEFAULT_PLAYER_CATEGORIES,
  SET_TIER_KEYS, SET_TIER_LABEL, SET_TIER_BADGE, SET_TIER_SCORE, SET_TIER_DESC, DEFAULT_SET_RARITY_TIERS,
} from '../utils/constants.js';

export function renderRules() {
  const tab = state.rulesTab || 'players';

  return `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
      <div>
        <div class="page-title" style="margin-bottom:4px">Scoring Configuration</div>
        <div class="page-subtitle">Tune how cards are evaluated · changes apply immediately to search results</div>
      </div>
      <button class="btn-ghost btn-sm" onclick="window.resetAllConfig()" style="margin-top:4px">Reset defaults</button>
    </div>

    <div class="rules-subtab-nav">
      <button class="rules-subtab ${tab === 'players' ? 'active' : ''}" onclick="window.setRulesTab('players')">
        Player Tiers
      </button>
      <button class="rules-subtab ${tab === 'sets' ? 'active' : ''}" onclick="window.setRulesTab('sets')">
        Set Classes
      </button>
      <button class="rules-subtab ${tab === 'ml' ? 'active' : ''}" onclick="window.setRulesTab('ml')">
        ML Weights
      </button>
    </div>

    ${tab === 'players' ? renderPlayerTiersTab() : ''}
    ${tab === 'sets'    ? renderSetClassesTab()  : ''}
    ${tab === 'ml'      ? renderMLTab()          : ''}
  `;
}

// ── Player Tiers tab ───────────────────────────────────────────────────────────
function renderPlayerTiersTab() {
  return `
    <div class="card-section" style="margin-bottom:12px;padding:10px 14px">
      <div style="font-size:12px;color:var(--text-muted);line-height:1.6">
        <strong>Strong</strong> → any card type works &nbsp;·&nbsp;
        <strong>Middle</strong> → needs grade/auto/numbered &nbsp;·&nbsp;
        <strong>Volatile</strong> → only auto/GU/rare PSA &nbsp;·&nbsp;
        <strong>PH-Specific</strong> → mid autos/GUs only (Dylan Harper rookies excepted)
      </div>
    </div>
    <div class="cat-grid">
      ${CATEGORIES.map(cat => renderCategoryCard(cat)).join('')}
    </div>
  `;
}

function renderCategoryCard(cat) {
  const rule    = state.rules[cat]             || DEFAULT_RULES[cat] || {};
  const players = (state.playerCategories || {})[cat] || [];
  const badge   = CAT_BADGE_CLASS[cat] || 'badge-gray';
  const label   = CAT_LABEL[cat]       || cat;

  return `
    <div class="card-section cat-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span class="badge ${badge}" style="font-size:13px;padding:3px 10px">${label}</span>
        <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted)">
          Min ROI
          <input
            type="number" min="0" max="200"
            value="${rule.minROI ?? 25}"
            onchange="window.updateCatROI('${cat}', +this.value)"
            style="width:56px"
          />%
        </div>
      </div>

      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;line-height:1.55">${CAT_HINT[cat] || ''}</div>

      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;min-height:26px">
        ${players.map((p, i) => `
          <span class="player-chip">
            ${escHtml(p)}
            <button class="chip-remove" onclick="window.removePlayer('${cat}', ${i})" title="Remove">×</button>
          </span>
        `).join('')}
        ${players.length === 0
          ? `<span style="font-size:11px;color:var(--text-muted);font-style:italic;align-self:center">No players assigned</span>`
          : ''}
      </div>

      <div style="display:flex;gap:6px">
        <input
          id="add-player-${cat}"
          type="text"
          placeholder="Add player name…"
          style="flex:1;font-size:12px"
          onkeydown="if(event.key==='Enter') window.addPlayer('${cat}')"
        />
        <button class="btn-primary btn-sm" onclick="window.addPlayer('${cat}')">Add</button>
      </div>
    </div>
  `;
}

// ── Set Classes tab ────────────────────────────────────────────────────────────
function renderSetClassesTab() {
  return `
    <div class="card-section" style="margin-bottom:12px;padding:10px 14px">
      <div style="font-size:12px;color:var(--text-muted);line-height:1.6">
        Keywords are matched case-insensitively against listing titles.
        Tiers are checked top-to-bottom: <strong>Case Hits → Ultra Premium → High End → Mid Tier → Mass Produced</strong> (with parallel check).
        A keyword can only belong to one tier — adding it to a new tier removes it from the old one.
      </div>
    </div>
    <div class="cat-grid">
      ${SET_TIER_KEYS.map(tier => renderSetTierCard(tier)).join('')}
    </div>
  `;
}

function renderSetTierCard(tier) {
  const sets  = (state.setRarityTiers || {})[tier] || [];
  const badge = SET_TIER_BADGE[tier] || 'badge-gray';
  const label = SET_TIER_LABEL[tier] || tier;
  const score = SET_TIER_SCORE[tier] || '?';
  const desc  = SET_TIER_DESC[tier]  || '';

  return `
    <div class="card-section cat-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span class="badge ${badge}" style="font-size:13px;padding:3px 10px">${label}</span>
        <span style="font-size:11px;color:var(--text-muted);font-family:monospace">score ${score}</span>
      </div>

      <div style="font-size:11.5px;color:var(--text-muted);margin-bottom:12px;line-height:1.55">${desc}</div>

      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;min-height:26px">
        ${sets.map((s, i) => `
          <span class="player-chip">
            ${escHtml(s)}
            <button class="chip-remove" onclick="window.removeSetFromTier('${tier}', ${i})" title="Remove">×</button>
          </span>
        `).join('')}
        ${sets.length === 0
          ? `<span style="font-size:11px;color:var(--text-muted);font-style:italic;align-self:center">No keywords assigned</span>`
          : ''}
      </div>

      <div style="display:flex;gap:6px">
        <input
          id="add-set-${tier}"
          type="text"
          placeholder="Add keyword…"
          style="flex:1;font-size:12px"
          onkeydown="if(event.key==='Enter') window.addSetToTier('${tier}')"
        />
        <button class="btn-primary btn-sm" onclick="window.addSetToTier('${tier}')">Add</button>
      </div>
    </div>
  `;
}

// ── ML Weights tab ─────────────────────────────────────────────────────────────
function renderMLTab() {
  return `
    <div class="card-section">
      <div class="section-title" style="margin-bottom:6px">ML weight tuning</div>
      <div class="section-subtitle" style="margin-bottom:16px">Balance whether scoring prioritizes high ROI vs fast-flipping cards</div>

      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px">
        <span class="slider-label">ROI focus</span>
        <div class="slider-wrap" style="flex:1;min-width:200px">
          <input
            type="range" min="10" max="90" step="5"
            value="${Math.round(state.mlWeights.roi * 100)}"
            oninput="window.setMLWeight(this.value)"
          />
        </div>
        <span class="slider-label">Speed focus</span>
      </div>

      <div style="display:flex;gap:20px;font-size:13px">
        <div>ROI weight: <span class="mono text-accent">${Math.round(state.mlWeights.roi * 100)}%</span></div>
        <div>Speed weight: <span class="mono text-accent">${Math.round(state.mlWeights.speed * 100)}%</span></div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:8px">
        ROI focus → favors high-margin cards even if they take longer to flip.<br/>
        Speed focus → favors cards likely to sell quickly.
      </div>
    </div>
  `;
}

// ── Exported functions ─────────────────────────────────────────────────────────

export function setRulesTab(tab) {
  state.rulesTab = tab;
  window.renderApp();
}

export function updateCatROI(cat, val) {
  if (!state.rules[cat]) state.rules[cat] = { ...DEFAULT_RULES[cat] };
  state.rules[cat].minROI = val;
  persistRules();
}

export function addPlayer(cat) {
  const input = document.getElementById(`add-player-${cat}`);
  const name  = (input?.value || '').trim();
  if (!name) return;

  if (!state.playerCategories)       state.playerCategories = {};
  if (!state.playerCategories[cat])  state.playerCategories[cat] = [];

  // Move out of any other category first
  for (const c of CATEGORIES) {
    if (c !== cat && state.playerCategories[c]) {
      state.playerCategories[c] = state.playerCategories[c].filter(
        p => p.toUpperCase() !== name.toUpperCase()
      );
    }
  }

  if (!state.playerCategories[cat].some(p => p.toUpperCase() === name.toUpperCase())) {
    state.playerCategories[cat].push(name);
  }

  if (input) input.value = '';
  persistSettings();
  window.renderApp();
}

export function removePlayer(cat, idx) {
  if (!state.playerCategories?.[cat]) return;
  state.playerCategories[cat].splice(idx, 1);
  persistSettings();
  window.renderApp();
}

export function addSetToTier(tier) {
  const input   = document.getElementById(`add-set-${tier}`);
  const keyword = (input?.value || '').trim();
  if (!keyword) return;

  if (!state.setRarityTiers)        state.setRarityTiers = {};
  if (!state.setRarityTiers[tier])  state.setRarityTiers[tier] = [];

  // Remove from any other tier to avoid double-matching
  for (const t of SET_TIER_KEYS) {
    if (t !== tier && state.setRarityTiers[t]) {
      state.setRarityTiers[t] = state.setRarityTiers[t].filter(
        s => s.toUpperCase() !== keyword.toUpperCase()
      );
    }
  }

  if (!state.setRarityTiers[tier].some(s => s.toUpperCase() === keyword.toUpperCase())) {
    state.setRarityTiers[tier].push(keyword);
  }

  if (input) input.value = '';
  persistSettings();
  window.renderApp();
}

export function removeSetFromTier(tier, idx) {
  if (!state.setRarityTiers?.[tier]) return;
  state.setRarityTiers[tier].splice(idx, 1);
  persistSettings();
  window.renderApp();
}

export function resetAllConfig() {
  if (!confirm('Reset player tiers, set classes, and ROI thresholds to defaults?')) return;
  state.rules            = JSON.parse(JSON.stringify(DEFAULT_RULES));
  state.playerCategories = JSON.parse(JSON.stringify(DEFAULT_PLAYER_CATEGORIES));
  state.setRarityTiers   = JSON.parse(JSON.stringify(DEFAULT_SET_RARITY_TIERS));
  persistRules();
  persistSettings();
  state.notify = { type: 'ok', msg: 'All scoring config reset to defaults.' };
  window.renderApp();
}

export function setMLWeight(val) {
  const roi = val / 100;
  state.mlWeights = { roi, speed: 1 - roi };
  import('../utils/storage.js').then(({ save }) => save('mlWeights', state.mlWeights));
  window.renderApp();
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
