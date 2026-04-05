import { state, persistSettings } from '../utils/state.js';

export function renderSettings() {
  return `
    <div class="page-title">Settings</div>
    <div class="page-subtitle">API keys, currency, and data management</div>

    ${state.notify ? renderNotify(state.notify) : ''}

    <div class="settings-group">
      <h3>eBay API credentials</h3>
      <p>
        Go to <a href="https://developer.ebay.com" target="_blank" rel="noopener" style="color:var(--accent)">developer.ebay.com</a>
        → My Account → Application Keys → <strong>Production</strong> keys.
        You need <strong>both</strong> the App ID (Client ID) and the Client Secret.
      </p>

      <div style="display:flex;flex-direction:column;gap:10px;max-width:480px;margin-bottom:12px">
        <div class="form-group" style="margin:0">
          <label class="form-label">App ID (Client ID)</label>
          <input
            id="ebay-key-input"
            type="password"
            placeholder="YourName-AppName-PRD-xxxxxxxx-xxxxxxxx"
            value="${escHtml(state.ebayKey)}"
          />
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Client Secret</label>
          <input
            id="ebay-secret-input"
            type="password"
            placeholder="PRD-xxxxxxxxxxxxxxxx-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value="${escHtml(state.ebaySecret)}"
          />
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">RuName <span style="font-weight:400;color:var(--text-muted)">(eBay developer portal → User Tokens → Get a Token from eBay via Your Application)</span></label>
          <input
            id="ebay-runame-input"
            type="text"
            placeholder="YourName-AppName-PRD-xxxxxxxx-xxxxxxxx"
            value="${escHtml(state.ebayRuName)}"
          />
        </div>
      </div>

      <div style="display:flex;gap:10px;align-items:center">
        <button class="btn-primary" onclick="window.saveEbayKey()">Save credentials</button>
        ${(state.ebayKey || state.ebaySecret) ? `<button class="btn-danger btn-sm" onclick="window.clearEbayKey()">Clear</button>` : ''}
      </div>

      ${(state.ebayKey && state.ebaySecret)
        ? `<div style="font-size:12px;color:var(--green);margin-top:8px">✓ App ID and Client Secret saved</div>`
        : state.ebayKey
          ? `<div style="font-size:12px;color:var(--amber);margin-top:8px">App ID saved — Client Secret still needed for search to work.</div>`
          : `<div style="font-size:12px;color:var(--text-muted);margin-top:8px">No credentials saved — searches will fail until both are added.</div>`
      }
    </div>

    <div class="settings-group">
      <h3>eBay account</h3>
      <p>Connect your eBay account to place bids without leaving this page. Listings open in a compact popup window.</p>
      ${state.ebayUser
        ? `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="font-size:13px;color:var(--green)">✓ Connected as <strong>${escHtml(state.ebayUser)}</strong></div>
            <button class="btn-danger btn-sm" onclick="window.disconnectEbayUser()">Disconnect</button>
          </div>`
        : `<div style="display:flex;flex-direction:column;gap:8px;max-width:480px">
            <button class="btn-secondary" onclick="window.connectEbayAccount()" ${!(state.ebayKey && state.ebaySecret && state.ebayRuName) ? 'disabled title="Save App ID, Client Secret, and RuName first"' : ''}>
              Connect eBay Account
            </button>
            ${!(state.ebayKey && state.ebaySecret && state.ebayRuName)
              ? `<div style="font-size:11px;color:var(--amber)">Save your App ID, Client Secret, and RuName above first.</div>`
              : `<div style="font-size:11px;color:var(--text-muted)">You'll be redirected to eBay to authorise.</div>`
            }
          </div>`
      }
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
      <h3>AI scoring</h3>
      <p>
        Listings are scored with your deal history + category rules. Use the <strong>Diagnostic</strong> tab to teach the engine your preferences.
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
  `;
}

export function saveEbayKey() {
  const keyInput    = document.getElementById('ebay-key-input');
  const secretInput = document.getElementById('ebay-secret-input');
  const ruNameInput = document.getElementById('ebay-runame-input');
  const key    = (keyInput    ? keyInput.value    : state.ebayKey).trim();
  const secret = (secretInput ? secretInput.value : state.ebaySecret).trim();
  const ruName = (ruNameInput ? ruNameInput.value : state.ebayRuName).trim();

  if (!key && !secret) {
    state.notify = { type: 'err', msg: 'Paste your eBay App ID and Client Secret before saving.' };
    window.renderApp();
    return;
  }
  if (key)    state.ebayKey    = key;
  if (secret) state.ebaySecret = secret;
  if (ruName) state.ebayRuName = ruName;
  persistSettings();
  state.notify = { type: 'ok', msg: 'eBay credentials saved.' };
  window.renderApp();
}

export function clearEbayKey() {
  state.ebayKey    = '';
  state.ebaySecret = '';
  state.ebayRuName = '';
  persistSettings();
  state.notify = { type: 'info', msg: 'eBay credentials cleared.' };
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
    } catch {
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

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderNotify({ type, msg }) {
  const cls = type === 'ok' ? 'notify-ok' : type === 'info' ? 'notify-info' : 'notify-err';
  return `<div class="notify ${cls}">${msg}</div>`;
}

