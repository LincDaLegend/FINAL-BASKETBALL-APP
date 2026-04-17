import { useState, useMemo } from 'react';
import { PackageOpen, CheckCircle, Package, Clock, ChevronDown, ChevronRight, Truck } from 'lucide-react';
import { SaleStatus, PaymentStatus, fmt, fmtExact } from './store.js';

export default function HeldOrders({ data, update }) {
  const [expandedBuyer, setExpandedBuyer] = useState(null);

  const heldSales = useMemo(() =>
    (data.sales || []).filter(s => s.status === SaleStatus.ON_HOLD || s.status === SaleStatus.TO_SHIP)
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [data.sales]
  );

  // Group by buyer (fallback to 'Unknown Buyer')
  const grouped = useMemo(() => {
    const map = {};
    for (const s of heldSales) {
      const key = s.buyer?.trim() || 'Unknown Buyer';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [heldSales]);

  const markShipped = (id) => {
    update(prev => ({
      ...prev,
      sales: prev.sales.map(s => s.id === id ? { ...s, status: SaleStatus.SHIPPED } : s),
    }));
  };

  const markAllShipped = (buyer) => {
    update(prev => ({
      ...prev,
      sales: prev.sales.map(s =>
        (s.buyer?.trim() || 'Unknown Buyer') === buyer && s.status !== SaleStatus.SHIPPED
          ? { ...s, status: SaleStatus.SHIPPED }
          : s
      ),
    }));
  };

  const toggleHold = (id) => {
    update(prev => ({
      ...prev,
      sales: prev.sales.map(s =>
        s.id === id
          ? { ...s, status: s.status === SaleStatus.ON_HOLD ? SaleStatus.TO_SHIP : SaleStatus.ON_HOLD }
          : s
      ),
    }));
  };

  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  };

  const totalHeld = heldSales.reduce((a, s) => a + s.totalAmount, 0);
  const onHoldCount = heldSales.filter(s => s.status === SaleStatus.ON_HOLD).length;
  const toShipCount = heldSales.filter(s => s.status === SaleStatus.TO_SHIP).length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Held', value: heldSales.length, color: 'text-slate-700', Icon: Package },
          { label: 'On Hold', value: onHoldCount, color: 'text-amber-600', Icon: Clock },
          { label: 'To Ship', value: toShipCount, color: 'text-blue-600', Icon: Truck },
        ].map(({ label, value, color, Icon }) => (
          <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</span>
              <Icon className="w-4 h-4 text-slate-300" />
            </div>
            <div className={`text-3xl font-bold tracking-tight ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Total value */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Value on Hold</p>
          <p className="text-3xl font-bold text-slate-800 tracking-tight">{fmtExact(totalHeld)}</p>
        </div>
        <PackageOpen className="w-10 h-10 text-slate-200" />
      </div>

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm py-16 text-center text-slate-400">
          <PackageOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No held orders</p>
          <p className="text-sm mt-1">Mark sales as "On Hold" or "To Ship" to see them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([buyer, sales]) => {
            const isOpen = expandedBuyer === buyer;
            const total = sales.reduce((a, s) => a + s.totalAmount, 0);
            const unpaidCount = sales.filter(s => s.paymentStatus === PaymentStatus.UNPAID).length;

            return (
              <div key={buyer} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Buyer header */}
                <button
                  onClick={() => setExpandedBuyer(isOpen ? null : buyer)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">
                      {buyer[0]?.toUpperCase()}
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800">{buyer}</div>
                      <div className="text-xs text-slate-400">{sales.length} item{sales.length !== 1 ? 's' : ''}{unpaidCount > 0 ? ` · ${unpaidCount} unpaid` : ''}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800">{fmt(total)}</span>
                    {unpaidCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                        Unpaid
                      </span>
                    )}
                  </div>
                </button>

                {/* Items */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {sales.map(s => (
                      <div key={s.id} className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === SaleStatus.ON_HOLD ? 'bg-amber-400' : 'bg-blue-400'}`} />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-700 truncate">{s.itemName}</div>
                            <div className="text-xs text-slate-400">{fmtDate(s.date)} · {s.platform || 'Direct'}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <span className="font-bold text-slate-800 text-sm">{fmt(s.totalAmount)}</span>
                          <button
                            onClick={() => toggleHold(s.id)}
                            className={`px-2.5 py-1 rounded-full text-xs font-bold transition-colors ${s.status === SaleStatus.ON_HOLD ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}
                          >
                            {s.status}
                          </button>
                          <button
                            onClick={() => markShipped(s.id)}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-300 hover:text-emerald-500 transition-colors"
                            title="Mark shipped"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {/* Batch ship all */}
                    <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => markAllShipped(buyer)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                      >
                        <Truck className="w-3.5 h-3.5" /> Mark All Shipped
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
