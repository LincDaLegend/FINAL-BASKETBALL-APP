import React, { useState, useMemo } from 'react';
import { Truck, Plus, Trash2, Package, X, Copy, CheckCircle } from 'lucide-react';
import { SaleStatus, fmt, genId } from './store.js';

const LBC_RATES = [
  { weight: 0.5, rate: 110 },
  { weight: 1,   rate: 135 },
  { weight: 2,   rate: 170 },
  { weight: 3,   rate: 200 },
  { weight: 5,   rate: 260 },
  { weight: 7,   rate: 310 },
  { weight: 10,  rate: 390 },
];

function estimateRate(kg) {
  if (!kg || kg <= 0) return 0;
  for (const r of LBC_RATES) {
    if (kg <= r.weight) return r.rate;
  }
  return LBC_RATES[LBC_RATES.length - 1].rate + Math.ceil((kg - 10) / 5) * 60;
}

export default function LbcBooking({ data, update }) {
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [form, setForm] = useState({
    recipientName: '',
    address: '',
    contactNo: '',
    weight: '',
    declaredValue: '',
    salesIds: [],
    notes: '',
    date: new Date().toISOString().slice(0, 10),
    trackingNo: '',
  });

  const batches = data.shippingBatches || [];

  const toShipSales = useMemo(() =>
    (data.sales || []).filter(s => s.status === SaleStatus.TO_SHIP || s.status === SaleStatus.ON_HOLD),
    [data.sales]
  );

  const estimatedRate = estimateRate(parseFloat(form.weight));

  const addBatch = () => {
    if (!form.recipientName.trim() || !form.address.trim()) return;
    const batch = {
      id: genId(),
      recipientName: form.recipientName.trim(),
      address: form.address.trim(),
      contactNo: form.contactNo.trim(),
      weight: parseFloat(form.weight) || 0,
      estimatedRate,
      declaredValue: parseFloat(form.declaredValue) || 0,
      salesIds: form.salesIds,
      notes: form.notes.trim(),
      date: form.date,
      trackingNo: form.trackingNo.trim(),
      shipped: false,
    };
    // Mark selected sales as shipped
    update(prev => {
      const sales = prev.sales.map(s =>
        form.salesIds.includes(s.id) ? { ...s, status: SaleStatus.ON_HOLD } : s
      );
      return { ...prev, shippingBatches: [batch, ...(prev.shippingBatches || [])], sales };
    });
    setShowModal(false);
    setForm({ recipientName: '', address: '', contactNo: '', weight: '', declaredValue: '', salesIds: [], notes: '', date: new Date().toISOString().slice(0, 10), trackingNo: '' });
  };

  const deleteBatch = (id) => {
    update(prev => ({ ...prev, shippingBatches: prev.shippingBatches.filter(b => b.id !== id) }));
  };

  const markShipped = (id) => {
    update(prev => {
      const batch = prev.shippingBatches.find(b => b.id === id);
      const sales = batch
        ? prev.sales.map(s => batch.salesIds.includes(s.id) ? { ...s, status: SaleStatus.SHIPPED } : s)
        : prev.sales;
      return {
        ...prev,
        shippingBatches: prev.shippingBatches.map(b => b.id === id ? { ...b, shipped: true } : b),
        sales,
      };
    });
  };

  const updateTracking = (id, trackingNo) => {
    update(prev => ({
      ...prev,
      shippingBatches: prev.shippingBatches.map(b => b.id === id ? { ...b, trackingNo } : b),
    }));
  };

  const toggleSaleId = (id) => {
    setForm(f => ({
      ...f,
      salesIds: f.salesIds.includes(id) ? f.salesIds.filter(x => x !== id) : [...f.salesIds, id],
    }));
  };

  const copyAddress = (batch) => {
    const text = `${batch.recipientName}\n${batch.address}\n${batch.contactNo}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(batch.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const pending = batches.filter(b => !b.shipped);
  const shipped = batches.filter(b => b.shipped);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl"><Truck className="w-5 h-5 text-emerald-600" /></div>
          <div>
            <h2 className="font-bold text-slate-800">LBC Booking</h2>
            <p className="text-xs text-slate-400">{pending.length} pending · {shipped.length} shipped</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      {/* LBC Rate Reference */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">LBC Rate Reference (PHP)</p>
        <div className="flex flex-wrap gap-2">
          {LBC_RATES.map(r => (
            <div key={r.weight} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <span className="text-xs font-bold text-slate-600">{r.weight}kg</span>
              <span className="text-xs text-slate-400">=</span>
              <span className="text-xs font-bold text-emerald-600">₱{r.rate}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bookings */}
      {batches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center text-slate-400">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No bookings yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...pending, ...shipped].map(batch => (
            <div key={batch.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${batch.shipped ? 'border-emerald-200 opacity-75' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-800">{batch.recipientName}</span>
                    {batch.shipped && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">Shipped</span>}
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{batch.address}</p>
                  {batch.contactNo && <p className="text-xs text-slate-400 mt-1">{batch.contactNo}</p>}
                  <div className="flex flex-wrap gap-3 mt-3">
                    {batch.weight > 0 && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{batch.weight}kg</span>}
                    {batch.estimatedRate > 0 && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">~{fmt(batch.estimatedRate)}</span>}
                    <span className="text-xs text-slate-400">{fmtDate(batch.date)}</span>
                    {batch.salesIds?.length > 0 && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                        {batch.salesIds.length} item{batch.salesIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {/* Tracking input */}
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      value={batch.trackingNo || ''}
                      onChange={e => updateTracking(batch.id, e.target.value)}
                      placeholder="Tracking number…"
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => copyAddress(batch)}
                    className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Copy address"
                  >
                    {copiedId === batch.id ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                  {!batch.shipped && (
                    <button onClick={() => markShipped(batch.id)}
                      className="p-2 rounded-xl hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors"
                      title="Mark shipped"
                    >
                      <Truck className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => deleteBatch(batch.id)}
                    className="p-2 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Booking Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">New LBC Booking</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Recipient Name *</label>
                <input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Delivery Address *</label>
                <textarea rows={3} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Street, Barangay, City, Province, Zip"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contact No.</label>
                  <input value={form.contactNo} onChange={e => setForm(f => ({ ...f, contactNo: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="09xx…"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Weight (kg)</label>
                  <input type="number" min="0" step="0.1" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.5"
                  />
                  {estimatedRate > 0 && (
                    <p className="text-xs text-emerald-600 font-bold mt-1">Estimated: ₱{estimatedRate}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Declared Value (₱)</label>
                  <input type="number" min="0" value={form.declaredValue} onChange={e => setForm(f => ({ ...f, declaredValue: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Link to held sales */}
              {toShipSales.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Link Sales (optional)</label>
                  <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {toShipSales.map(s => (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer">
                        <input type="checkbox" checked={form.salesIds.includes(s.id)} onChange={() => toggleSaleId(s.id)}
                          className="accent-emerald-600"
                        />
                        <span className="text-sm text-slate-700 flex-1">{s.itemName}</span>
                        <span className="text-xs text-slate-400">{s.buyer}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Fragile, special instructions…"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button onClick={addBatch} disabled={!form.recipientName.trim() || !form.address.trim()}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
