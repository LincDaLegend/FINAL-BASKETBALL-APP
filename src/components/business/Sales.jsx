import { useState, useMemo } from 'react';
import { Plus, Trash2, ShoppingCart, DollarSign, Search, X, TrendingUp, Clock } from 'lucide-react';
import { SaleStatus, PaymentStatus, fmt, fmtExact, genId } from './store.js';

const SALE_TYPES = ['Sale', 'Auction', 'Firesale'];

export default function Sales({ data, update }) {
  const [showModal, setShowModal] = useState(false);
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    itemName: '', inventoryId: '', costPrice: '', salePrice: '', quantity: 1,
    saleType: 'Sale', status: SaleStatus.TO_SHIP, paymentStatus: PaymentStatus.PAID,
    buyer: '', platform: '', date: new Date().toISOString().slice(0, 10), notes: '',
  });
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const availableInventory = useMemo(() =>
    (data.inventory || []).filter(i =>
      !itemSearch || i.name?.toLowerCase().includes(itemSearch.toLowerCase())
    ), [data.inventory, itemSearch]);

  const selectItem = (item) => {
    setForm(f => ({
      ...f,
      itemName: item.name,
      inventoryId: item.id,
      costPrice: item.costPrice ?? '',
      salePrice: item.targetPrice ?? '',
    }));
    setItemSearch(item.name);
    setShowItemDropdown(false);
  };

  const addSale = () => {
    if (!form.itemName.trim() || !form.salePrice) return;
    const sale = {
      id: genId(),
      itemName: form.itemName.trim(),
      inventoryId: form.inventoryId || null,
      costPrice: parseFloat(form.costPrice) || 0,
      totalAmount: parseFloat(form.salePrice) * (parseInt(form.quantity) || 1),
      quantity: parseInt(form.quantity) || 1,
      saleType: form.saleType,
      status: form.status,
      paymentStatus: form.paymentStatus,
      buyer: form.buyer.trim(),
      platform: form.platform.trim(),
      date: form.date || new Date().toISOString().slice(0, 10),
      notes: form.notes.trim(),
    };
    update(prev => {
      let inventory = prev.inventory || [];
      if (sale.inventoryId) {
        inventory = inventory.map(i =>
          i.id === sale.inventoryId
            ? { ...i, quantity: Math.max(0, (i.quantity || 1) - sale.quantity) }
            : i
        ).filter(i => (i.quantity || 0) > 0 || i.id !== sale.inventoryId);
      }
      return { ...prev, sales: [sale, ...(prev.sales || [])], inventory };
    });
    setShowModal(false);
    setForm({
      itemName: '', inventoryId: '', costPrice: '', salePrice: '', quantity: 1,
      saleType: 'Sale', status: SaleStatus.TO_SHIP, paymentStatus: PaymentStatus.PAID,
      buyer: '', platform: '', date: new Date().toISOString().slice(0, 10), notes: '',
    });
    setItemSearch('');
  };

  const deleteSale = (id) => {
    update(prev => {
      const sale = (prev.sales || []).find(s => s.id === id);
      let inventory = prev.inventory || [];
      if (sale?.inventoryId) {
        const inv = inventory.find(i => i.id === sale.inventoryId);
        if (inv) {
          inventory = inventory.map(i =>
            i.id === sale.inventoryId ? { ...i, quantity: (i.quantity || 0) + (sale.quantity || 1) } : i
          );
        }
      }
      return { ...prev, sales: prev.sales.filter(s => s.id !== id), inventory };
    });
  };

  const togglePayment = (id) => {
    update(prev => ({
      ...prev,
      sales: prev.sales.map(s =>
        s.id === id
          ? { ...s, paymentStatus: s.paymentStatus === PaymentStatus.PAID ? PaymentStatus.UNPAID : PaymentStatus.PAID }
          : s
      ),
    }));
  };

  const toggleStatus = (id) => {
    update(prev => ({
      ...prev,
      sales: prev.sales.map(s => {
        if (s.id !== id) return s;
        const order = [SaleStatus.TO_SHIP, SaleStatus.ON_HOLD, SaleStatus.SHIPPED];
        const idx = order.indexOf(s.status);
        return { ...s, status: order[(idx + 1) % order.length] };
      }),
    }));
  };

  const filtered = useMemo(() => {
    let s = data.sales || [];
    if (filterPayment !== 'all') s = s.filter(x => x.paymentStatus === filterPayment);
    if (filterType !== 'all') s = s.filter(x => x.saleType === filterType);
    if (searchQuery) s = s.filter(x =>
      x.itemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      x.buyer?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return s.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [data.sales, filterPayment, filterType, searchQuery]);

  const totalRevenue = filtered.filter(s => s.paymentStatus === PaymentStatus.PAID).reduce((a, s) => a + s.totalAmount, 0);
  const totalProfit = filtered.filter(s => s.paymentStatus === PaymentStatus.PAID).reduce((a, s) => a + (s.totalAmount - (s.costPrice || 0) * s.quantity), 0);
  const pendingCount = filtered.filter(s => s.paymentStatus === PaymentStatus.UNPAID).length;

  const statusColor = (s) => {
    if (s === SaleStatus.SHIPPED) return 'bg-emerald-100 text-emerald-700';
    if (s === SaleStatus.ON_HOLD) return 'bg-amber-100 text-amber-700';
    return 'bg-blue-100 text-blue-700';
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales', value: filtered.length, sub: 'transactions', color: 'text-slate-700', Icon: ShoppingCart },
          { label: 'Revenue', value: fmtExact(totalRevenue), sub: 'paid only', color: 'text-emerald-600', Icon: DollarSign },
          { label: 'Gross Profit', value: fmtExact(totalProfit), sub: 'paid only', color: totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500', Icon: TrendingUp },
          { label: 'Pending', value: pendingCount, sub: 'unpaid', color: 'text-amber-600', Icon: Clock },
        ].map(({ label, value, sub, color, Icon }) => (
          <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</span>
              <Icon className="w-4 h-4 text-slate-300" />
            </div>
            <div className={`text-2xl font-bold tracking-tight ${color}`}>{value}</div>
            <div className="text-xs text-slate-400 mt-1">{sub}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Sale
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by item or buyer…"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Payment filter */}
            {['all', PaymentStatus.PAID, PaymentStatus.UNPAID].map(v => (
              <button key={v}
                onClick={() => setFilterPayment(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterPayment === v ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {v === 'all' ? 'All' : v}
              </button>
            ))}
            <div className="w-px bg-slate-200" />
            {/* Type filter */}
            {['all', ...SALE_TYPES].map(v => (
              <button key={v}
                onClick={() => setFilterType(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterType === v ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {v === 'all' ? 'All Types' : v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No sales found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Item</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Type</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Sale</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Profit</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Payment</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(s => {
                  const profit = s.totalAmount - (s.costPrice || 0) * s.quantity;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(s.date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800">{s.itemName}</div>
                        {s.buyer && <div className="text-xs text-slate-400">{s.buyer}{s.platform ? ` · ${s.platform}` : ''}</div>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{s.saleType}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{fmt(s.totalAmount)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{fmt(profit)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => togglePayment(s.id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${s.paymentStatus === PaymentStatus.PAID ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}
                        >
                          {s.paymentStatus}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleStatus(s.id)}
                          className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${statusColor(s.status)}`}
                        >
                          {s.status}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteSale(s.id)}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Sale Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Record New Sale</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Item selector */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Item Name *</label>
                <div className="relative">
                  <input
                    value={itemSearch}
                    onChange={e => { setItemSearch(e.target.value); setForm(f => ({ ...f, itemName: e.target.value, inventoryId: '' })); setShowItemDropdown(true); }}
                    onFocus={() => setShowItemDropdown(true)}
                    placeholder="Type or search inventory…"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {showItemDropdown && availableInventory.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 bg-white border border-slate-200 rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto">
                      {availableInventory.slice(0, 8).map(item => (
                        <button key={item.id} onMouseDown={() => selectItem(item)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm flex items-center justify-between"
                        >
                          <span className="font-medium text-slate-700">{item.name}</span>
                          <span className="text-xs text-slate-400">{fmt(item.targetPrice || item.costPrice)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sale type */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sale Type</label>
                <div className="flex gap-2">
                  {SALE_TYPES.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, saleType: t }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${form.saleType === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cost (₱)</label>
                  <input type="number" min="0" value={form.costPrice}
                    onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Sale Price (₱) *</label>
                  <input type="number" min="0" value={form.salePrice}
                    onChange={e => setForm(f => ({ ...f, salePrice: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Qty + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quantity</label>
                  <input type="number" min="1" value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Buyer + Platform */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Buyer</label>
                  <input value={form.buyer} onChange={e => setForm(f => ({ ...f, buyer: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Name / username"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Platform</label>
                  <input value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="eBay / FB / etc."
                  />
                </div>
              </div>

              {/* Status + Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Shipping Status</label>
                  <div className="flex gap-2">
                    {[SaleStatus.TO_SHIP, SaleStatus.ON_HOLD].map(s => (
                      <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${form.status === s ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Payment</label>
                  <div className="flex gap-2">
                    {[PaymentStatus.PAID, PaymentStatus.UNPAID].map(p => (
                      <button key={p} onClick={() => setForm(f => ({ ...f, paymentStatus: p }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${form.paymentStatus === p ? (p === PaymentStatus.PAID ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white') : 'bg-slate-100 text-slate-500'}`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Optional notes…"
                />
              </div>

              {/* Profit preview */}
              {form.salePrice && (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Gross Profit</span>
                    <span className={`font-bold ${(parseFloat(form.salePrice) - parseFloat(form.costPrice || 0)) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {fmtExact((parseFloat(form.salePrice) - parseFloat(form.costPrice || 0)) * (parseInt(form.quantity) || 1))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-slate-400">Margin</span>
                    <span className="text-slate-500 font-medium">
                      {parseFloat(form.salePrice) > 0
                        ? (((parseFloat(form.salePrice) - parseFloat(form.costPrice || 0)) / parseFloat(form.salePrice)) * 100).toFixed(1) + '%'
                        : '—'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button onClick={addSale}
                disabled={!form.itemName.trim() || !form.salePrice}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Record Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
