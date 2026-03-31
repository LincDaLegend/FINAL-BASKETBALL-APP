import { state, persistRules } from '../utils/state.js';
import { CATEGORIES, DEFAULT_RULES, CAT_BADGE_CLASS } from '../utils/constants.js';

export function renderRules() {
  return `
    <div class="page-title">Category Rules</div>
    <div class="page-subtitle">Define scoring thresholds per category · used alongside your deal history</div>

    <div class="card-section" style="margin-bottom:16px">
      <div class="section-header">
        <div>
          <div class="section-title">Category thresholds</div>
          <div class="section-subtitle">Max price and minimum ROI per sourcing category</div>
        </div>
        <button class="btn-ghost btn-sm" onclick="window.resetRules()">Reset to defaults</button>
      </div>

      <table class="rules-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Max buy price ($)</th>
            <th>Min ROI (%)</th>
            <th>Preferred grades</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${CATEGORIES.map(cat => {
            const r = state.rules[cat] || DEFAULT_RULES[cat];
            return `
              <tr>
                <td><span class="badge ${CAT_BADGE_CLASS[cat] || 'badge-gray'}">${cat}</span></td>
                <td>
                  <input
                    type="number" min="1" max="9999"
                    value="${r.maxPrice}"
                    onchange="window.updateRule('${cat}','maxPrice',+this.value)"
                    style="width:80px"
                  />
                </td>
                <td>
                  <input
                    type="number" min="0" max="500"
                    value="${r.minROI}"
                    onchange="window.updateRule('${cat}','minROI',+this.value)"
                    style="width:70px"
                  />
                </td>
                <td style="font-size:12px;color:var(--text-muted)">${(r.preferredGrades || []).join(', ')}</td>
                <td style="font-size:12px;color:var(--text-muted)">${r.desc}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

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

export function updateRule(cat, key, val) {
  if (!state.rules[cat]) state.rules[cat] = { ...DEFAULT_RULES[cat] };
  state.rules[cat][key] = val;
  persistRules();
}

export function resetRules() {
  if (!confirm('Reset all category rules to defaults?')) return;
  state.rules = JSON.parse(JSON.stringify(DEFAULT_RULES));
  persistRules();
  window.renderApp();
}

export function setMLWeight(val) {
  const roi = val / 100;
  state.mlWeights = { roi, speed: 1 - roi };
  import('../utils/storage.js').then(({ save }) => save('mlWeights', state.mlWeights));
  window.renderApp();
}

