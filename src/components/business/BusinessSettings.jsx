import { useState } from 'react';
import { Settings, Save, Trash2, Download, Upload, RefreshCw, AlertTriangle, Plus, X, CheckCircle, ExternalLink, Eye, EyeOff } from 'lucide-react';

// Read/write directly to the legacy localStorage keys
const ls = {
  get: (k, fallback = '') => { try { return localStorage.getItem(k) ?? fallback; } catch { return fallback; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

export default function BusinessSettings({ data, update, onSync, isSyncing }) {
  const [sheetsUrl, setSheetsUrl] = useState(data.googleSheetsUrl || '');
  const [phpRate,   setPhpRate]   = useState(data.phpRate || 57.2);
  const [newCategory, setNewCategory] = useState('');
  const [saved, setSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState('');

  // eBay credentials — stored in legacy localStorage keys
  const [ebayKey,    setEbayKey]    = useState(() => ls.get('ebayKey'));
  const [ebaySecret, setEbaySecret] = useState(() => ls.get('ebaySecret'));
  const [ebayRuName, setEbayRuName] = useState(() => ls.get('ebayRuName'));
  const [scpToken,   setScpToken]   = useState(() => ls.get('scpToken'));
  const [showSecret, setShowSecret] = useState(false);
  const [ebaySaved,  setEbaySaved]  = useState(false);

  const ebayUser    = ls.get('ebayUser', null);
  const ebayTokenExp = parseInt(ls.get('ebayTokenExp', '0')) || 0;
  const tokenValid  = ebayTokenExp > Date.now() / 1000;

  const saveSettings = () => {
    update(prev => ({ ...prev, googleSheetsUrl: sheetsUrl, phpRate: parseFloat(phpRate) || prev.phpRate }));
    // Also sync into legacy state
    import('../../legacy/utils/state.js').then(({ state: ls2, persistSettings }) => {
      ls2.phpRate     = parseFloat(phpRate) || ls2.phpRate;
      ls2.gasWriteUrl = sheetsUrl;
      persistSettings?.();
    }).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const saveEbayCredentials = () => {
    ls.set('ebayKey',    ebayKey.trim());
    ls.set('ebaySecret', ebaySecret.trim());
    ls.set('ebayRuName', ebayRuName.trim());
    ls.set('scpToken',   scpToken.trim());
    // Sync into running legacy state if available
    import('../../legacy/utils/state.js').then(({ state: ls2, persistSettings }) => {
      ls2.ebayKey    = ebayKey.trim();
      ls2.ebaySecret = ebaySecret.trim();
      ls2.ebayRuName = ebayRuName.trim();
      ls2.scpToken   = scpToken.trim();
      persistSettings?.();
    }).catch(() => {});
    setEbaySaved(true);
    setTimeout(() => setEbaySaved(false), 2000);
  };

  const clearEbayCredentials = () => {
    ['ebayKey','ebaySecret','ebayRuName','ebayToken','ebayTokenExp','ebayRefresh','ebayUser'].forEach(k => ls.del(k));
    setEbayKey(''); setEbaySecret(''); setEbayRuName('');
    import('../../legacy/utils/state.js').then(({ state: ls2 }) => {
      ls2.ebayKey = ''; ls2.ebaySecret = ''; ls2.ebayRuName = '';
      ls2.ebayToken = null; ls2.ebayUser = null;
    }).catch(() => {});
  };

  const connectEbayAccount = () => {
    if (!ebayKey.trim() || !ebaySecret.trim() || !ebayRuName.trim()) return;
    // Save first, then trigger the legacy OAuth flow
    saveEbayCredentials();
    setTimeout(() => window.connectEbayAccount?.(), 100);
  };

  const addCategory = () => {
    const cat = newCategory.trim();
    if (!cat || (data.categories || []).includes(cat)) return;
    update(prev => ({ ...prev, categories: [...(prev.categories || []), cat] }));
    setNewCategory('');
  };

  const removeCategory = (cat) => {
    update(prev => ({ ...prev, categories: (prev.categories || []).filter(c => c !== cat) }));
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baller-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { update(() => JSON.parse(ev.target.result)); }
      catch { alert('Invalid file format.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetSection = (section) => {
    if (section === 'sales')     update(prev => ({ ...prev, sales: [] }));
    if (section === 'inventory') update(prev => ({ ...prev, inventory: [] }));
    if (section === 'expenses')  update(prev => ({ ...prev, expenses: [] }));
    if (section === 'all')       update(prev => ({ ...prev, sales: [], inventory: [], expenses: [], shippingBatches: [] }));
    setShowResetConfirm('');
  };

  const Field = ({ label, hint, children }) => (
    <div>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );

  const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <div className="p-2 bg-slate-50 rounded-lg"><Icon className="w-4 h-4 text-slate-500" /></div>
        <span className="font-bold text-slate-700">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono";

  return (
    <div className="space-y-6 max-w-2xl">

      {/* General */}
      <Section title="General Settings" icon={Settings}>
        <div className="space-y-4">
          <Field label="PHP Exchange Rate (₱ per $1)">
            <input type="number" min="1" step="0.1" value={phpRate} onChange={e => setPhpRate(e.target.value)}
              className="w-40 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </Field>
          <Field label="Google Apps Script URL" hint="Used for syncing sales and inventory data to Google Sheets.">
            <input value={sheetsUrl} onChange={e => setSheetsUrl(e.target.value)}
              className={inputCls + " text-xs"}
              placeholder="https://script.google.com/macros/s/…"
            />
          </Field>
          <div className="flex gap-3">
            <button onClick={saveSettings}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
            >
              {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
            {onSync && (
              <button onClick={onSync} disabled={isSyncing}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors disabled:opacity-50 border border-blue-100"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing…' : 'Sync Now'}
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* eBay API */}
      <Section title="eBay API Credentials" icon={Settings}>
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Get your keys at{' '}
            <a href="https://developer.ebay.com" target="_blank" rel="noopener"
              className="text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1">
              developer.ebay.com <ExternalLink className="w-3 h-3" />
            </a>
            {' '}→ Application Keys.
          </p>

          <Field label="App ID (Client ID)">
            <input value={ebayKey} onChange={e => setEbayKey(e.target.value)}
              className={inputCls} placeholder="AppID-…" />
          </Field>

          <Field label="Client Secret (Cert ID)">
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={ebaySecret} onChange={e => setEbaySecret(e.target.value)}
                className={inputCls + " pr-10"} placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </Field>

          <Field
            label="RuName"
            hint="From eBay developer portal → User Tokens → Get a Token from eBay via Your Application."
          >
            <input value={ebayRuName} onChange={e => setEbayRuName(e.target.value)}
              className={inputCls} placeholder="YourApp-YourApp-Prod-…" />
          </Field>

          {/* Account status */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">eBay Account</p>
              {ebayUser
                ? <p className="text-sm font-semibold text-emerald-600">✓ Connected as {ebayUser}{tokenValid ? '' : ' (token expired)'}</p>
                : <p className="text-sm text-slate-400">Not connected</p>}
            </div>
            {ebayUser
              ? <button onClick={clearEbayCredentials}
                  className="text-xs font-bold text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  Disconnect
                </button>
              : <button onClick={connectEbayAccount}
                  disabled={!ebayKey.trim() || !ebaySecret.trim() || !ebayRuName.trim()}
                  className="text-xs font-bold bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Connect Account
                </button>}
          </div>

          <div className="flex gap-3">
            <button onClick={saveEbayCredentials}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
            >
              {ebaySaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {ebaySaved ? 'Saved!' : 'Save Credentials'}
            </button>
            {ebayKey && (
              <button onClick={clearEbayCredentials}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors border border-red-100"
              >
                <X className="w-4 h-4" /> Clear All
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* SportsCardsPro */}
      <Section title="SportsCardsPro Token" icon={Settings}>
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Find your token at{' '}
            <a href="https://www.sportscardspro.com" target="_blank" rel="noopener"
              className="text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1">
              sportscardspro.com <ExternalLink className="w-3 h-3" />
            </a>
            {' '}→ Account Settings. Enables real sold-price data in search results.
          </p>
          <input value={scpToken} onChange={e => setScpToken(e.target.value)}
            className={inputCls} placeholder="40-character token" />
          {scpToken
            ? <p className="text-xs text-emerald-600 font-semibold">✓ Token saved — market prices use real sold data.</p>
            : <p className="text-xs text-slate-400">Not configured — market prices use live eBay listing prices.</p>}
          <button onClick={saveEbayCredentials}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
          >
            {ebaySaved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {ebaySaved ? 'Saved!' : 'Save Token'}
          </button>
        </div>
      </Section>

      {/* Categories */}
      <Section title="Expense Categories" icon={Settings}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(data.categories || []).map(cat => (
              <div key={cat} className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-3 py-1.5">
                <span className="text-sm font-medium text-slate-700">{cat}</span>
                <button onClick={() => removeCategory(cat)} className="text-slate-400 hover:text-red-500 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newCategory} onChange={e => setNewCategory(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="New category name…"
            />
            <button onClick={addCategory}
              className="px-3 py-2 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Section>

      {/* Data Backup */}
      <Section title="Data Backup" icon={Download}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Export your data as JSON or import a previously exported file.</p>
          <div className="flex gap-3">
            <button onClick={exportData}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" /> Export Data
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" /> Import Data
              <input type="file" accept=".json" onChange={importData} className="hidden" />
            </label>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Importing will replace all current data. Export first if you want to keep a backup.</p>
          </div>
        </div>
      </Section>

      {/* Reset */}
      <Section title="Reset Data" icon={Trash2}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Permanently delete data. This cannot be undone.</p>
          {showResetConfirm && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700 font-semibold mb-3">
                Are you sure you want to reset {showResetConfirm === 'all' ? 'ALL data' : showResetConfirm}?
              </p>
              <div className="flex gap-2">
                <button onClick={() => resetSection(showResetConfirm)}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700"
                >Yes, Delete</button>
                <button onClick={() => setShowResetConfirm('')}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-300"
                >Cancel</button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'sales',     label: 'Reset Sales' },
              { key: 'inventory', label: 'Reset Inventory' },
              { key: 'expenses',  label: 'Reset Expenses' },
              { key: 'all',       label: 'Reset Everything' },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setShowResetConfirm(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-colors ${key === 'all' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600'}`}
              >
                <Trash2 className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
