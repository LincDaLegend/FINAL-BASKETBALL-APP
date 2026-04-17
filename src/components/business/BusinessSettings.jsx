import { useState } from 'react';
import { Settings, Save, Trash2, Download, Upload, RefreshCw, AlertTriangle, Plus, X, CheckCircle } from 'lucide-react';

export default function BusinessSettings({ data, update, onSync, isSyncing }) {
  const [sheetsUrl, setSheetsUrl] = useState(data.googleSheetsUrl || '');
  const [phpRate, setPhpRate] = useState(data.phpRate || 57.2);
  const [newCategory, setNewCategory] = useState('');
  const [saved, setSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState('');

  const saveSettings = () => {
    update(prev => ({ ...prev, googleSheetsUrl: sheetsUrl, phpRate: parseFloat(phpRate) || prev.phpRate }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
      try {
        const imported = JSON.parse(ev.target.result);
        update(() => imported);
      } catch {
        alert('Invalid file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetSection = (section) => {
    if (section === 'sales') update(prev => ({ ...prev, sales: [] }));
    if (section === 'inventory') update(prev => ({ ...prev, inventory: [] }));
    if (section === 'expenses') update(prev => ({ ...prev, expenses: [] }));
    if (section === 'all') update(prev => ({ ...prev, sales: [], inventory: [], expenses: [], shippingBatches: [] }));
    setShowResetConfirm('');
  };

  const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
        <div className="p-2 bg-slate-50 rounded-lg"><Icon className="w-4 h-4 text-slate-500" /></div>
        <span className="font-bold text-slate-700">{title}</span>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      {/* General */}
      <Section title="General Settings" icon={Settings}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">PHP Exchange Rate (₱ per $1)</label>
            <input type="number" min="1" step="0.1" value={phpRate} onChange={e => setPhpRate(e.target.value)}
              className="w-40 px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Google Apps Script URL</label>
            <input value={sheetsUrl} onChange={e => setSheetsUrl(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
              placeholder="https://script.google.com/macros/s/…"
            />
            <p className="text-xs text-slate-400 mt-1.5">Used for syncing sales and inventory data to Google Sheets.</p>
          </div>
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

      {/* Data Export/Import */}
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
                >
                  Yes, Delete
                </button>
                <button onClick={() => setShowResetConfirm('')}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'sales', label: 'Reset Sales' },
              { key: 'inventory', label: 'Reset Inventory' },
              { key: 'expenses', label: 'Reset Expenses' },
              { key: 'all', label: 'Reset Everything' },
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
