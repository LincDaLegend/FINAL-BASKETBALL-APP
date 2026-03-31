import { state, persistSettings } from '../utils/state.js';

// ── Settings Page ─────────────────────────────────────────────
export function renderSettings() {
  return `
    <div class="page-title">Settings</div>
    <div class="page-subtitle">API keys, currency, and data management</div>

    ${state.notify ? renderNotify(state.notify) : ''}

    <div class="settings-group">
      <h3>eBay API key</h3>
      <p>
        Get your key at <a href="https://developer.ebay.com" target="_blank" rel="noopener" style="color:var(--accent)">developer.ebay.com</a>
        → Create app → Production App ID (Client ID).<br/>
        The key is stored only in your browser's local storage — never sent anywhere except eBay's servers.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <input
          id="key-input"
          type="password"
          placeholder="Paste your eBay Production App ID (Client ID)"
          value="${escHtml(state.ebayKey)}"
          style="flex:3;min-width:200px"
        />
        <button class="btn-primary" onclick="window.saveEbayKey()">Save key</button>
        ${state.ebayKey ? `<button class="btn-danger" onclick="window.clearEbayKey()">Remove</button>` : ''}
      </div>
      ${state.ebayKey ? `<div style="font-size:12px;color:var(--green);margin-top:8px">✓ eBay key is set</div>` : `<div style="font-size:12px;color:var(--amber);margin-top:8px">⚠ No eBay key — live search is disabled</div>`}
    </div>

    <div class="settings-group">
      <h3>USD → PHP exchange rate</h3>
      <p>Update this when the rate changes. Used to show Philippine Peso prices on all listings.</p>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div style="font-size:14px;color:var(--text-muted)">$1 USD =</div>
        <input
          id="rate-input"
          type="number"
          min="1" step="0.1"
          value="${state.phpRate}"
          style="width:110px"
          oninput="window.updateRate(this.value)"
        />
        <div style="font-size:14px;color:var(--text-muted)">PHP</div>
        <div style="font-size:13px;color:var(--text-secondary)">Current: ₱${state.phpRate.toFixed(1)}/USD</div>
      </div>
    </div>

    <div class="settings-group">
      <h3>Anthropic API (optional)</h3>
      <p>
        The AI scoring engine uses Claude via the Anthropic API. This app calls the API directly from your browser using
        the claude.ai interface's built-in access — no separate key needed when using this app inside claude.ai.<br/>
        If running this as a standalone web app outside claude.ai, you would need to proxy the Anthropic API calls through a backend server to protect your API key.
      </p>
    </div>

    <div class="settings-group">
      <h3>Data management</h3>
      <p>Export your deal history and category rules for backup, or import from a previous export.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-secondary" onclick="window.exportAllData()">Export all data (JSON)</button>
        <button class="btn-secondary" onclick="window.importDataPrompt()">Import JSON backup</button>
        <button class="btn-danger" onclick="window.nukeAllData()">Clear all data</button>
      </div>
    </div>

    <div class="settings-group">
      <h3>About Card Arb Engine</h3>
      <p style="margin-bottom:0">
        Built for basketball card arbitrage sourcing from eBay US to the Philippine market.<br/>
        Searches live eBay listings, scores them with Claude AI using your own deal history as ML context,
        and helps you identify buy now / consider / skip opportunities across your custom categories.<br/><br/>
        <span style="color:var(--text-secondary)">Categories:</span> Low end · Mid end · High end · Quick sell · Margin bet<br/>
        <span style="color:var(--text-secondary)">ML signals:</span> ROI %, days to flip, aesthetic score (design + condition)
      </p>
    </div>
  `;
}

// ── Actions ───────────────────────────────────────────────────
export function saveEbayKey() {
  const key = document.getElementById('key-input')?.value?.trim();
  if (!key) {
    state.notify = { type: 'err', msg: 'Please paste your eBay App ID.' };
    window.renderApp();
    return;
  }
  state.ebayKey = key;
  persistSettings();
  state.notify = { type: 'ok', msg: 'eBay API key saved.' };
  window.renderApp();
}

export function clearEbayKey() {
  state.ebayKey = '';
  persistSettings();
  state.notify = { type: 'ok', msg: 'eBay key removed.' };
  window.renderApp();
}

export function updateRate(val) {
  const r = parseFloat(val);
  if (r > 0) {
    state.phpRate = r;
    persistSettings();
  }
}

export function exportAllData() {
  const payload = {
    version: 1,
    exported: new Date().toISOString(),
    deals: state.deals,
    rules: state.rules,
    mlWeights: state.mlWeights,
    phpRate: state.phpRate,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `card-arb-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

export function importDataPrompt() {
  const input = document.createElement('input');
  input.type  = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    try {
      const text = await e.target.files[0].text();
      const data = JSON.parse(text);
      if (data.deals)     { state.deals     = data.deals;     import('../utils/storage.js').then(({save}) => save('deals', state.deals)); }
      if (data.rules)     { state.rules     = data.rules;     import('../utils/storage.js').then(({save}) => save('rules', state.rules)); }
      if (data.mlWeights) { state.mlWeights = data.mlWeights; import('../utils/storage.js').then(({save}) => save('mlWeights', state.mlWeights)); }
      if (data.phpRate)   { state.phpRate   = data.phpRate;   import('../utils/storage.js').then(({save}) => save('phpRate', state.phpRate)); }
      state.notify = { type: 'ok', msg: `Import complete — ${state.deals.length} deals loaded.` };
      window.renderApp();
    } catch (err) {
      state.notify = { type: 'err', msg: 'Import failed — invalid JSON file.' };
      window.renderApp();
    }
  };
  input.click();
}

export function nukeAllData() {
  if (!confirm('Clear ALL data including deals, rules, and settings? This cannot be undone.')) return;
  localStorage.clear();
  location.reload();
}

// ── Helpers ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderNotify({ type, msg }) {
  const cls = type === 'ok' ? 'notify-ok' : type === 'info' ? 'notify-info' : 'notify-err';
  return `<div class="notify ${cls}">${msg}</div>`;
}
