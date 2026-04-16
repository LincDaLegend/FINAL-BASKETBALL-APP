import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Edit2, Package, BoxSelect, Calculator, Container, X, ChevronDown, FileSpreadsheet, Clipboard } from 'lucide-react';
import { fmt, genId } from './store.js';

function getBatchColor(code) {
  const colors = ['bg-red-50 text-red-600 border border-red-200','bg-orange-50 text-orange-600 border border-orange-200','bg-emerald-50 text-emerald-600 border border-emerald-200','bg-teal-50 text-teal-600 border border-teal-200','bg-sky-50 text-sky-600 border border-sky-200','bg-blue-50 text-blue-600 border border-blue-200','bg-violet-50 text-violet-600 border border-violet-200','bg-pink-50 text-pink-600 border border-pink-200'];
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function Inventory({ items, setItems, supplies, setSupplies, shippingBatches, setShippingBatches }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [price, setPrice] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [category, setCategory] = useState('General');
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchQ, setBatchQ] = useState('');

  const [manageTotalQty, setManageTotalQty] = useState(0);
  const [manageCostPerUnit, setManageCostPerUnit] = useState(0);
  const [manageAllocation, setManageAllocation] = useState(1);
  const [calcQty, setCalcQty] = useState('');
  const [calcTotalCost, setCalcTotalCost] = useState('');

  const [newBatchCode, setNewBatchCode] = useState('');
  const [newBatchFee, setNewBatchFee] = useState('');

  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const filteredBatches = useMemo(() =>
    shippingBatches.filter(b => b.code.toLowerCase().includes(batchQ.toLowerCase())),
    [shippingBatches, batchQ]);

  useEffect(() => {
    if (name.trim() && !editingItem) {
      const initials = name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase();
      const batch = batchCode || '000';
      const count = items.filter(i => {
        if ((i.batchCode || '') !== batchCode) return false;
        const ii = i.name.trim().split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase();
        return ii === initials;
      }).length + 1;
      setSku(`${batch}${initials}${count}`);
    }
  }, [name, batchCode]);

  const openModal = (item) => {
    if (item) {
      setEditingItem(item);
      setName(item.name); setSku(item.sku); setCostPrice(item.costPrice || '');
      setPrice(item.price || ''); setBatchCode(item.batchCode || ''); setCategory(item.category || 'General');
    } else {
      setEditingItem(null);
      setName(''); setSku(''); setCostPrice(''); setPrice(''); setBatchCode(''); setCategory('General');
    }
    setBatchQ('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const item = {
      id: editingItem?.id || genId(),
      name, sku,
      quantity: 1,
      costPrice: parseFloat(costPrice) || 0,
      price: parseFloat(price) || 0,
      category, batchCode,
    };
    if (editingItem) {
      setItems(items.map(i => i.id === editingItem.id ? item : i));
    } else {
      setItems([...items, item]);
    }
    setIsModalOpen(false);
  };

  const handleAddBatch = (e) => {
    e.preventDefault();
    const fee = parseFloat(newBatchFee) || 0;
    const existing = shippingBatches.findIndex(b => b.code === newBatchCode);
    if (existing >= 0) {
      const updated = [...shippingBatches];
      updated[existing] = { ...updated[existing], totalFee: fee };
      setShippingBatches(updated);
    } else {
      setShippingBatches([...shippingBatches, { id: genId(), code: newBatchCode, totalFee: fee, date: new Date().toISOString() }]);
    }
    setNewBatchCode(''); setNewBatchFee('');
  };

  const applyRestock = () => {
    if (!calcQty || !calcTotalCost) return;
    const curVal = manageTotalQty * manageCostPerUnit;
    const totalQty = manageTotalQty + parseFloat(calcQty);
    const avgCost = totalQty > 0 ? (curVal + parseFloat(calcTotalCost)) / totalQty : 0;
    setManageTotalQty(totalQty);
    setManageCostPerUnit(avgCost);
    setCalcQty(''); setCalcTotalCost('');
  };

  const handleImport = () => {
    setImportError('');
    try {
      const rows = importText.trim().split('\n');
      if (rows.length < 2) throw new Error('Need header row + data rows');
      const sep = rows[0].includes('\t') ? '\t' : ',';
      const headers = rows[0].split(sep).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
      const ni = headers.findIndex(h => ['name','item','title','description'].some(k => h.includes(k)));
      const ci = headers.findIndex(h => ['cost','buy'].some(k => h.includes(k)));
      const pi = headers.findIndex(h => ['price','sell','value'].some(k => h.includes(k)));
      const cati = headers.findIndex(h => h.includes('category'));
      if (ni < 0) throw new Error("Could not find 'Name' column");
      const newItems = rows.slice(1).filter(Boolean).map(row => {
        const cols = sep === '\t' ? row.split('\t') : row.split(',');
        const clean = s => s?.replace(/^"|"$/g, '').trim() || '';
        return {
          id: genId(),
          name: clean(cols[ni]) || 'Unknown',
          sku: `IMP-${genId().slice(0,6)}`,
          quantity: 1,
          costPrice: parseFloat(clean(cols[ci])) || 0,
          price: parseFloat(clean(cols[pi])) || 0,
          category: ci >= 0 ? clean(cols[cati]) : 'Imported',
          batchCode: '',
        };
      });
      setItems([...items, ...newItems]);
      setIsImportModalOpen(false);
      setImportText('');
    } catch (e) {
      setImportError(e.message);
    }
  };

  const totalValue = items.reduce((s, i) => s + (i.price || 0), 0);
  const totalCost = items.reduce((s, i) => s + (i.costPrice || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-500" /> Inventory
          </h2>
          <p className="text-slate-500 text-sm">Manage stock, batches, and supply costs.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsImportModalOpen(true)} className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-sm">
            <FileSpreadsheet className="w-4 h-4" /> Import
          </button>
          <button onClick={() => openModal()} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-200">
            <Plus className="w-5 h-5" /> Add Item
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Stock</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{items.length} Items</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Cost</span>
          <div className="text-2xl font-black text-red-500 mt-1">{fmt(totalCost)}</div>
        </div>
        <div onClick={() => { setManageTotalQty(supplies.totalQuantity); setManageCostPerUnit(supplies.costPerUnit); setManageAllocation(supplies.unitsPerItem); setIsSupplyModalOpen(true); }}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-400 cursor-pointer transition-colors">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supplies Left</span>
          <div className={`text-2xl font-black mt-1 ${supplies.totalQuantity < 20 ? 'text-red-500' : 'text-slate-900'}`}>{supplies.totalQuantity} Units</div>
        </div>
        <div onClick={() => setIsShippingModalOpen(true)}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-400 cursor-pointer transition-colors">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Batches</span>
          <div className="text-2xl font-black text-blue-600 mt-1">{shippingBatches.length} Batches</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Item Name','SKU','Batch','Cost','Price',''].map(h => (
                  <th key={h} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">No items yet. Click Add Item to start.</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-400">{item.category}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-500">{item.sku}</td>
                  <td className="px-6 py-4">
                    {item.batchCode && <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${getBatchColor(item.batchCode)}`}>{item.batchCode}</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{item.costPrice ? fmt(item.costPrice) : '—'}</td>
                  <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{item.price ? fmt(item.price) : '—'}</td>
                  <td className="px-6 py-4 flex gap-2 justify-center">
                    <button onClick={() => openModal(item)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => { if (confirm('Delete this item?')) setItems(items.filter(i => i.id !== item.id)); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Item Name</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 focus:bg-white" placeholder="e.g. 2023 Prizm Wembanyama Silver" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">SKU (auto)</label>
                  <input type="text" value={sku} onChange={e => setSku(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 font-mono text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
                  <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-emerald-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Cost (₱)</label>
                  <input type="number" min="0" step="1" value={costPrice} onChange={e => setCostPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Sell Price (₱)</label>
                  <input type="number" min="0" step="1" value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-emerald-500" />
                </div>
              </div>
              {/* Batch selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Shipping Batch (optional)</label>
                <div className="relative">
                  <div onClick={() => setIsBatchOpen(!isBatchOpen)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 cursor-pointer flex justify-between items-center">
                    <span className={batchCode ? 'text-slate-900 font-bold' : 'text-slate-400'}>{batchCode || 'Select batch…'}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                  {isBatchOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-44 overflow-y-auto">
                      <div className="p-2 sticky top-0 bg-white border-b border-slate-100">
                        <input autoFocus type="text" placeholder="Search…" value={batchQ} onChange={e => setBatchQ(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none" />
                      </div>
                      <div onClick={() => { setBatchCode(''); setIsBatchOpen(false); }} className="p-3 hover:bg-slate-50 cursor-pointer text-sm text-slate-400 italic">No Batch</div>
                      {filteredBatches.map(b => (
                        <div key={b.id} onClick={() => { setBatchCode(b.code); setIsBatchOpen(false); }}
                          className="p-3 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-700 flex justify-between">
                          <span>{b.code}</span>
                          <span className="text-slate-400 font-normal text-xs">{fmt(b.totalFee)} fee</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-xl mt-4">
                {editingItem ? 'Save Changes' : 'Add to Inventory'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Supply Modal */}
      {isSupplyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><BoxSelect className="w-5 h-5 text-emerald-500" /> Manage Supplies</h3>
              <button onClick={() => setIsSupplyModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
              <div className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-1"><Calculator className="w-3 h-3" /> Restock Calculator</div>
              <div className="flex gap-3 mb-3">
                <input type="number" placeholder="Qty added" value={calcQty} onChange={e => setCalcQty(e.target.value)}
                  className="w-1/2 p-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500" />
                <input type="number" placeholder="Total cost ₱" value={calcTotalCost} onChange={e => setCalcTotalCost(e.target.value)}
                  className="w-1/2 p-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-emerald-500" />
              </div>
              <button onClick={applyRestock} disabled={!calcQty || !calcTotalCost}
                className="w-full bg-emerald-500 text-white font-bold py-2 rounded-lg text-sm hover:bg-emerald-600 disabled:opacity-50">
                Add Stock & Average Cost
              </button>
            </div>
            <div className="space-y-4">
              {[['Total Quantity', manageTotalQty, setManageTotalQty], ['Avg Cost Per Unit (₱)', manageCostPerUnit, setManageCostPerUnit], ['Units Per Item (packaging)', manageAllocation, setManageAllocation]].map(([label, val, setter]) => (
                <div key={label}>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{label}</label>
                  <input type="number" step="0.01" value={val} onChange={e => setter(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:border-emerald-500 font-bold text-slate-800" />
                </div>
              ))}
              <button onClick={() => { setSupplies({ totalQuantity: manageTotalQty, costPerUnit: manageCostPerUnit, unitsPerItem: manageAllocation }); setIsSupplyModalOpen(false); }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Batches Modal */}
      {isShippingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Container className="w-5 h-5 text-blue-500" /> Shipping Batches</h3>
              <button onClick={() => setIsShippingModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddBatch} className="flex gap-2 mb-6">
              <input required type="text" placeholder="Batch code (e.g. JUNE-A)" value={newBatchCode}
                onChange={e => setNewBatchCode(e.target.value.toUpperCase())}
                className="flex-1 border border-slate-300 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 uppercase font-bold" />
              <input type="number" placeholder="Fee ₱" value={newBatchFee} onChange={e => setNewBatchFee(e.target.value)}
                className="w-24 border border-slate-300 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-500 font-bold" />
              <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-600"><Plus className="w-5 h-5" /></button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {shippingBatches.length === 0
                ? <div className="text-center text-slate-400 py-8 text-sm">No batches yet.</div>
                : shippingBatches.map(b => (
                  <div key={b.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded block w-fit mb-1 ${getBatchColor(b.code)}`}>{b.code}</span>
                      <span className="text-xs text-slate-400">{new Date(b.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-slate-700">{fmt(b.totalFee)}</span>
                      <button onClick={() => setShippingBatches(shippingBatches.filter(x => x.id !== b.id))} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Clipboard className="w-5 h-5 text-emerald-500" /> Import from Spreadsheet</h3>
              <button onClick={() => setIsImportModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Copy rows from Excel/Sheets with headers like <strong>Name, Cost, Price, Category</strong> and paste below.</p>
            <textarea value={importText} onChange={e => setImportText(e.target.value)}
              className="w-full h-40 bg-slate-50 border border-slate-300 rounded-xl p-4 text-xs font-mono outline-none focus:border-emerald-500 resize-none mb-2" placeholder="Paste here…" />
            {importError && <p className="text-red-500 text-sm mb-3">{importError}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-xl font-bold">Cancel</button>
              <button onClick={handleImport} className="bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-emerald-600">Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
