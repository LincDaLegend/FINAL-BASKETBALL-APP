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
      <h3>Google Sheets sync</h3>
      <p>
        Transactions logged in the app are backed up to your Google Sheet via a Google Apps Script web app.
        Deploy the script once, paste the URL here, and all new transactions will write automatically.
      </p>

      <details style="margin-bottom:14px;font-size:13px">
        <summary style="cursor:pointer;color:var(--accent);font-weight:500;margin-bottom:8px">Setup instructions (click to expand)</summary>
        <ol style="padding-left:18px;line-height:1.9;color:var(--text-secondary);margin-top:8px">
          <li>Open your Google Sheet → <strong>Extensions → Apps Script</strong></li>
          <li>Delete the default code and paste the script below</li>
          <li>Click <strong>Deploy → New deployment → Web app</strong></li>
          <li>Set <em>Execute as</em>: <strong>Me</strong> · <em>Who has access</em>: <strong>Anyone</strong></li>
          <li>Copy the web app URL and paste it in the field below</li>
        </ol>
        <pre style="margin-top:12px;padding:12px;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md);font-size:11px;font-family:var(--mono);overflow-x:auto;white-space:pre;line-height:1.6">const SHEET_ID = '1ac1re_eTDZxA37K-bvGor1V9GAMpP9RL2qQf2-sXmk8';

function doPost(e) {
  try {
    const d  = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);

    if (d.action === 'initSheet') {
      // Create the tab if it doesn't exist, then write the header row
      let sh = ss.getSheetByName(d.sheet);
      if (!sh) sh = ss.insertSheet(d.sheet);
      if (d.headers && d.headers.length) {
        sh.getRange(1, 1, 1, d.headers.length).setValues([d.headers]);
        sh.getRange(1, 1, 1, d.headers.length).setFontWeight('bold');
      }
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sh = ss.getSheetByName(d.sheet);
    if (!sh) throw new Error('Sheet not found: ' + d.sheet);

    if (d.action === 'append') {
      sh.appendRow(d.row);
    } else if (d.action === 'updateRow') {
      const vals = sh.getDataRange().getValues();
      const hdrs = vals[0];
      const mci  = hdrs.indexOf(d.matchCol);
      if (mci &lt; 0) throw new Error('Col not found: ' + d.matchCol);
      for (let i = 1; i &lt; vals.length; i++) {
        if (String(vals[i][mci]) === String(d.matchVal)) {
          (d.updates || []).forEach(({col, val}) => {
            const ci = hdrs.indexOf(col);
            if (ci >= 0) sh.getRange(i + 1, ci + 1).setValue(val);
          });
          break;
        }
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}</pre>
      </details>

      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;max-width:600px">
        <div class="form-group" style="flex:1;margin:0">
          <label class="form-label">Apps Script Web App URL</label>
          <input
            id="gas-url-input"
            type="text"
            placeholder="https://script.google.com/macros/s/…/exec"
            value="${escHtml(state.gasWriteUrl || '')}"
          />
        </div>
        <button class="btn-primary" onclick="window.saveGasUrl()">Save</button>
      </div>
      ${state.gasWriteUrl
        ? `<div style="font-size:12px;color:var(--green);margin-top:8px">✓ Sheets sync configured</div>`
        : `<div style="font-size:12px;color:var(--text-muted);margin-top:8px">Not configured — transactions will only save locally.</div>`
      }
    </div>

    <div class="settings-group">
      <h3>SportsCardsPro API</h3>
      <p>
        Enables accurate grade-specific market prices (raw, PSA 10, PSA 9, etc.) from
        SportsCardsPro. Find your token at
        <strong>sportscardspro.com → My Account → Subscription → API/Download</strong>.
      </p>
      <div style="display:flex;flex-direction:column;gap:10px;max-width:480px;margin-bottom:12px">
        <div class="form-group" style="margin:0">
          <label class="form-label">API Token</label>
          <input
            id="scp-token-input"
            type="password"
            placeholder="40-character token"
            value="${escHtml(state.scpToken || '')}"
          />
        </div>
        <button class="btn-primary" onclick="window.saveScpToken()">Save</button>
      </div>
      ${state.scpToken
        ? `<div style="font-size:12px;color:var(--green);margin-top:8px">✓ SportsCardsPro token saved — market prices will use real sold data.</div>`
        : `<div style="font-size:12px;color:var(--text-muted);margin-top:8px">Not configured — market prices will use live eBay listing prices.</div>`
      }
    </div>

    <div class="settings-group">
      <h3>Setup sheet tabs</h3>
      <p>
        Creates <strong>Baller Sales</strong> and <strong>Baller Inventory</strong> tabs in your Google Sheet with the correct column headers.
        Run once — the app will read from and write to these tabs automatically.
        Requires the Apps Script URL to be saved above.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn-primary" onclick="window.initSheet('Baller Sales')">Create Baller Sales tab</button>
        <button class="btn-primary" onclick="window.initSheet('Baller Inventory')">Create Baller Inventory tab</button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);line-height:1.6">
        <strong>Baller Sales columns:</strong> Date · Item Name · Buyer · Cost (PHP) · Sale Price (PHP) · Profit (PHP) · Notes<br>
        <strong>Baller Inventory columns:</strong> Item Name · Category · Grade · Date Acquired · Seller · Buy Price · Fees · Shipping In · Total Cost · Target Price · Notes · Status
      </div>
    </div>

    <div class="settings-group">
      <h3>Reset data</h3>
      <p>Clear local cached data without touching your Google Sheet.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn-danger" onclick="window.resetTransactions()">Clear sales transactions</button>
        <button class="btn-danger" onclick="window.resetInventory()">Clear inventory cache</button>
      </div>
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

export function saveScpToken() {
  const input = document.getElementById('scp-token-input');
  const token = (input ? input.value : state.scpToken || '').trim();
  state.scpToken = token;
  persistSettings();
  state.notify = { type: token ? 'ok' : 'info', msg: token ? '✓ SportsCardsPro token saved.' : 'Token cleared.' };
  window.renderApp();
}

export function saveGasUrl() {
  const input = document.getElementById('gas-url-input');
  const url   = (input ? input.value : state.gasWriteUrl || '').trim();
  state.gasWriteUrl = url;
  persistSettings();
  state.notify = { type: url ? 'ok' : 'info', msg: url ? '✓ Sheets sync URL saved.' : 'Apps Script URL cleared.' };
  window.renderApp();
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

