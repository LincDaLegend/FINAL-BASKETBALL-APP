import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Edit2, Package, BoxSelect, Calculator, Container, X, ChevronDown, FileSpreadsheet, Search } from 'lucide-react';
import { fmt, fmtExact, genId } from './store.js';

function getBatchColor(code) {
  const palette = [
    'bg-red-50 text-red-600 border border-red-200',
    'bg-orange-50 text-orange-600 border border-orange-200',
    'bg-emerald-50 text-emerald-600 border border-emerald-200',
    'bg-teal-50 text-teal-600 border border-teal-200',
    'bg-sky-50 text-sky-600 border border-sky-200',
    'bg-blue-50 text-blue-600 border border-blue-200',
    'bg-violet-50 text-violet-600 border border-violet-200',
    'bg-pink-50 text-pink-600 border border-pink-200',
  ];
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

const EMPTY_FORM = { name: '', sku: '', costPrice: '', targetPrice: '', batchCode: '', category: 'General' };

export default function Inventory({ data, update }) {
  const items          = data.inventory     || [];
  const supplies       = data.supplies      || { totalQuantity: 0, costPerUnit: 0, unitsPerItem: 1 };
  const shippingBatches = data.shippingBatches || [];

  const [showItemModal,     setShowItemModal]     = useState(false);
  const [showSupplyModal,   setShowSupplyModal]   = useState(false);
  const [showBatchModal,    setShowBatchModal]    = useState(false);
  const [showImportModal,   setShowImportModal]   = useState(false);
  const [editingItem,       setEditingItem]       = useState(null);
  const [searchQuery,       setSearchQuery]       = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchQ,      setBatchQ]      = useState('');

  // Supply modal state
  const [supplyForm, setSupplyForm] = useState({ totalQuantity: 0, costPerUnit: 0, unitsPerItem: 1 });
  const [calcQty,      setCalcQty]      = useState('');
  const [calcTotalCost, setCalcTotalCost] = useState('');

  // Batch modal state
  const [newBatchCode, setNewBatchCode] = useState('');
  const [newBatchFee,  setNewBatchFee]  = useState('');

  // Import state
  const [importText,  setImportText]  = useState('');
  const [importError, setImportError] = useState('');

  // Auto-generate SKU
  useEffect(() => {
    if (form.name.trim() && !editingItem) {
      const initials = form.name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase();
      const batch = form.batchCode || '000';
      const count = items.filter(i => {
        if ((i.batchCode || '') !== form.batchCode) return false;
        const ii = i.name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase();
        return ii === initials;
      }).length + 1;
      setForm(f => ({ ...f, sku: `${batch}${initials}${count}` }));
    }
  }, [form.name, form.batchCode]);

  const filteredBatches = useMemo(() =>
    shippingBatches.filter(b => b.code.toLowerCase().includes(batchQ.toLowerCase())),
    [shippingBatches, batchQ]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(i =>
      i.name?.toLowerCase().includes(q) ||
      i.sku?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.batchCode?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const openModal = (item) => {
    if (item) {
      setEditingItem(item);
      setForm({ name: item.name, sku: item.sku || '', costPrice: item.costPrice ?? '', targetPrice: item.targetPrice ?? '', batchCode: item.batchCode || '', category: item.category || 'General' });
    } else {
      setEditingItem(null);
      setForm(EMPTY_FORM);
    }
    setBatchQ('');
    setIsBatchOpen(false);
    setShowItemModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const item = {
      id: editingItem?.id || genId(),
      name: form.name.trim(),
      sku: form.sku.trim(),
      quantity: editingItem?.quantity ?? 1,
      costPrice: parseFloat(form.costPrice) || 0,
      targetPrice: parseFloat(form.targetPrice) || 0,
      category: form.category.trim() || 'General',
      batchCode: form.batchCode,
    };
    update(prev => ({
      ...prev,
      inventory: editingItem
        ? prev.inventory.map(i => i.id === editingItem.id ? item : i)
        : [...(prev.inventory || []), item],
    }));
    setShowItemModal(false);
  };

  const deleteItem = (id) => {
    update(prev => ({ ...prev, inventory: prev.inventory.filter(i => i.id !== id) }));
  };

  const openSupplyModal = () => {
    setSupplyForm({ ...supplies });
    setCalcQty(''); setCalcTotalCost('');
    setShowSupplyModal(true);
  };

  const applyRestock = () => {
    if (!calcQty || !calcTotalCost) return;
    const curVal = supplyForm.totalQuantity * supplyForm.costPerUnit;
    const totalQty = supplyForm.totalQuantity + parseFloat(calcQty);
    const avgCost = totalQty > 0 ? (curVal + parseFloat(calcTotalCost)) / totalQty : 0;
    setSupplyForm(f => ({ ...f, totalQuantity: totalQty, costPerUnit: avgCost }));
    setCalcQty(''); setCalcTotalCost('');
  };

  const saveSupplies = () => {
    update(prev => ({ ...prev, supplies: { ...supplyForm } }));
    setShowSupplyModal(false);
  };

  const addBatch = (e) => {
    e.preventDefault();
    if (!newBatchCode.trim()) return;
    const fee = parseFloat(newBatchFee) || 0;
    const existing = shippingBatches.findIndex(b => b.code === newBatchCode);
    update(prev => {
      const batches = [...(prev.shippingBatches || [])];
      if (existing >= 0) {
        batches[existing] = { ...batches[existing], totalFee: fee };
      } else {
        batches.push({ id: genId(), code: newBatchCode, totalFee: fee, date: new Date().toISOString() });
      }
      return { ...prev, shippingBatches: batches };
    });
    setNewBatchCode(''); setNewBatchFee('');
  };

  const deleteBatch = (id) => {
    update(prev => ({ ...prev, shippingBatches: prev.shippingBatches.filter(b => b.id !== id) }));
  };

  const handleImport = () => {
    setImportError('');
    try {
      const rows = importText.trim().split('\n');
      if (rows.length < 2) throw new Error('Need a header row + at least one data row');
      const sep = rows[0].includes('\t') ? '\t' : ',';
      const headers = rows[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
      const ni   = headers.findIndex(h => ['name','item','title','description'].some(k => h.includes(k)));
      const ci   = headers.findIndex(h => ['cost','buy'].some(k => h.includes(k)));
      const pi   = headers.findIndex(h => ['price','sell','target','value'].some(k => h.includes(k)));
      const cati = headers.findIndex(h => h.includes('category'));
      if (ni < 0) throw new Error("Could not find a 'Name' column — check headers");
      const newItems = rows.slice(1).filter(Boolean).map(row => {
        const cols = row.split(sep);
        const clean = s => s?.replace(/^"|"$/g, '').trim() || '';
        return {
          id: genId(),
          name: clean(cols[ni]) || 'Unknown',
          sku: `IMP-${genId().slice(0, 6).toUpperCase()}`,
          quantity: 1,
          costPrice: parseFloat(clean(cols[ci])) || 0,
          targetPrice: parseFloat(clean(cols[pi])) || 0,
          category: cati >= 0 ? (clean(cols[cati]) || 'Imported') : 'Imported',
          batchCode: '',
        };
      });
      update(prev => ({ ...prev, inventory: [...(prev.inventory || []), ...newItems] }));
      setShowImportModal(false);
      setImportText('');
    } catch (e) {
      setImportError(e.message);
    }
  };

  const totalCost = items.reduce((s, i) => s + (i.costPrice || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search inventory…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImportModal(true)}
            className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-3 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Import
          </button>
          <button onClick={() => openModal(null)}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Stock</span>
          <div className="text-2xl font-bold text-slate-800 mt-1">{items.length} <span className="text-base font-medium text-slate-400">items</span></div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capital In</span>
          <div className="text-2xl font-bold text-red-500 mt-1">{fmt(totalCost)}</div>
        </div>
        <button onClick={openSupplyModal}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-400 hover:shadow-md text-left transition-all"
        >
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Supplies Left</span>
          <div className={`text-2xl font-bold mt-1 ${supplies.totalQuantity < 20 ? 'text-red-500' : 'text-slate-800'}`}>
            {supplies.totalQuantity} <span className="text-base font-medium text-slate-400">units</span>
          </div>
        </button>
        <button onClick={() => setShowBatchModal(true)}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 hover:shadow-md text-left transition-all"
        >
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batches</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">{shippingBatches.length} <span className="text-base font-medium text-slate-400">batches</span></div>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">{searchQuery ? 'No items match your search' : 'No inventory yet'}</p>
            {!searchQuery && <p className="text-sm mt-1">Click Add Item to get started.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Item', 'SKU', 'Batch', 'Cost', 'Target Price', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800">{item.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.category}</div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{item.sku}</td>
                    <td className="px-5 py-3.5">
                      {item.batchCode && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getBatchColor(item.batchCode)}`}>
                          {item.batchCode}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium">{item.costPrice ? fmt(item.costPrice) : '—'}</td>
                    <td className="px-5 py-3.5 font-bold text-emerald-600">{item.targetPrice ? fmt(item.targetPrice) : '—'}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openModal(item)}
                          className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteItem(item.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add / Edit Item Modal ── */}
      {showItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Item Name *</label>
                <input required type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. 2023 Prizm Wembanyama Silver"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">SKU (auto)</label>
                  <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                  <input type="text" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cost (₱)</label>
                  <input type="number" min="0" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Target Price (₱)</label>
                  <input type="number" min="0" value={form.targetPrice} onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Profit preview */}
              {form.costPrice && form.targetPrice && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex justify-between text-sm">
                  <span className="text-slate-500">Est. Margin</span>
                  <span className={`font-bold ${(parseFloat(form.targetPrice) - parseFloat(form.costPrice)) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {parseFloat(form.targetPrice) > 0
                      ? (((parseFloat(form.targetPrice) - parseFloat(form.costPrice)) / parseFloat(form.targetPrice)) * 100).toFixed(1) + '%'
                      : '—'}
                    {' '}({fmtExact(parseFloat(form.targetPrice) - parseFloat(form.costPrice))})
                  </span>
                </div>
              )}

              {/* Batch selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Shipping Batch (optional)</label>
                <div className="relative">
                  <button type="button" onClick={() => setIsBatchOpen(v => !v)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 flex justify-between items-center text-sm"
                  >
                    <span className={form.batchCode ? 'text-slate-800 font-bold' : 'text-slate-400'}>
                      {form.batchCode || 'Select batch…'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>
                  {isBatchOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-44 overflow-y-auto">
                      <div className="p-2 sticky top-0 bg-white border-b border-slate-100">
                        <input autoFocus type="text" placeholder="Search…" value={batchQ} onChange={e => setBatchQ(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none"
                        />
                      </div>
                      <div onClick={() => { setForm(f => ({ ...f, batchCode: '' })); setIsBatchOpen(false); }}
                        className="px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-400 italic"
                      >
                        No Batch
                      </div>
                      {filteredBatches.map(b => (
                        <div key={b.id} onClick={() => { setForm(f => ({ ...f, batchCode: b.code })); setIsBatchOpen(false); }}
                          className="px-3 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                        >
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${getBatchColor(b.code)}`}>{b.code}</span>
                          <span className="text-xs text-slate-400">{fmt(b.totalFee)} fee</span>
                        </div>
                      ))}
                      {filteredBatches.length === 0 && shippingBatches.length === 0 && (
                        <div className="px-3 py-3 text-xs text-slate-400 text-center">No batches — create one in Inventory → Batches</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowItemModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700"
                >
                  {editingItem ? 'Save Changes' : 'Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Supply Modal ── */}
      {showSupplyModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BoxSelect className="w-5 h-5 text-emerald-500" /> Manage Supplies
              </h3>
              <button onClick={() => setShowSupplyModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Restock calculator */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5" /> Restock Calculator
                </p>
                <div className="flex gap-2 mb-3">
                  <input type="number" placeholder="Qty added" value={calcQty} onChange={e => setCalcQty(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input type="number" placeholder="Total cost ₱" value={calcTotalCost} onChange={e => setCalcTotalCost(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <button onClick={applyRestock} disabled={!calcQty || !calcTotalCost}
                  className="w-full bg-emerald-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-40"
                >
                  Add Stock & Average Cost
                </button>
              </div>

              {[
                ['Total Quantity', 'totalQuantity'],
                ['Avg Cost Per Unit (₱)', 'costPerUnit'],
                ['Units Per Item (packaging)', 'unitsPerItem'],
              ].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                  <input type="number" step="0.01" value={supplyForm[key]}
                    onChange={e => setSupplyForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
                  />
                </div>
              ))}

              <div className="flex gap-3">
                <button onClick={() => setShowSupplyModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button onClick={saveSupplies}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Shipping Batches Modal ── */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Container className="w-5 h-5 text-blue-500" /> Shipping Batches
              </h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={addBatch} className="flex gap-2 mb-5">
                <input required type="text" placeholder="Batch code (e.g. JUNE-A)" value={newBatchCode}
                  onChange={e => setNewBatchCode(e.target.value.toUpperCase())}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input type="number" placeholder="Fee ₱" value={newBatchFee} onChange={e => setNewBatchFee(e.target.value)}
                  className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-600">
                  <Plus className="w-4 h-4" />
                </button>
              </form>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {shippingBatches.length === 0 ? (
                  <div className="text-center text-slate-400 py-10 text-sm">No batches yet.</div>
                ) : shippingBatches.map(b => (
                  <div key={b.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${getBatchColor(b.code)}`}>{b.code}</span>
                      <div className="text-xs text-slate-400 mt-1">{new Date(b.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-slate-700">{fmt(b.totalFee)}</span>
                      <button onClick={() => deleteBatch(b.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Import from Spreadsheet</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-3">
                Copy rows from Excel or Google Sheets with headers like <strong>Name, Cost, Price, Category</strong> and paste below.
              </p>
              <textarea value={importText} onChange={e => setImportText(e.target.value)}
                className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Paste tab-separated or CSV data here…"
              />
              {importError && <p className="text-red-500 text-sm mt-2">{importError}</p>}
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setShowImportModal(false); setImportError(''); setImportText(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button onClick={handleImport} disabled={!importText.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 disabled:opacity-40"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
