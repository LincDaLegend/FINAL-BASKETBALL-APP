import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Target, PieChart as PieChartIcon, BarChart as BarChartIcon, ArrowUpRight, ArrowDownRight, Plus, Package, ShoppingCart, Receipt } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { PaymentStatus, fmt, fmtExact } from './store.js';

export default function Dashboard({ data, setActiveTab }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [targetMargin, setTargetMargin] = useState(30);

  const changeMonth = (offset) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + offset);
    setCurrentDate(d);
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const paidSales = (data.sales || []).filter(s => s.paymentStatus === PaymentStatus.PAID);

  const yearlyIncome = useMemo(() =>
    paidSales.filter(s => new Date(s.date).getFullYear() === currentYear)
      .reduce((sum, s) => sum + s.totalAmount, 0),
    [data.sales, currentYear]);

  const yearlyCOGS = useMemo(() =>
    paidSales.filter(s => new Date(s.date).getFullYear() === currentYear)
      .reduce((sum, s) => sum + ((s.costPrice || 0) * s.quantity), 0),
    [data.sales, currentYear]);

  const yearlyGrossProfit = yearlyIncome - yearlyCOGS;

  const monthlyIncome = useMemo(() =>
    paidSales.filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }),
    [data.sales, currentMonth, currentYear]);

  const monthlyExpenses = useMemo(() =>
    (data.expenses || []).filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }),
    [data.expenses, currentMonth, currentYear]);

  const totalRevenue = monthlyIncome.reduce((s, i) => s + i.totalAmount, 0);
  const totalCOGS = monthlyIncome.reduce((s, i) => s + ((i.costPrice || 0) * i.quantity), 0);
  const totalOpExp = monthlyExpenses.reduce((s, e) => s + e.amount, 0);
  const grossProfit = totalRevenue - totalCOGS;
  const netEarnings = grossProfit - totalOpExp;
  const aggregateMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const marginVarianceData = useMemo(() => {
    return ['Sale', 'Auction', 'Firesale'].map(type => {
      const s = monthlyIncome.filter(i => i.saleType === type);
      const rev = s.reduce((a, i) => a + i.totalAmount, 0);
      const cogs = s.reduce((a, i) => a + ((i.costPrice || 0) * i.quantity), 0);
      const margin = rev > 0 ? ((rev - cogs) / rev) * 100 : 0;
      return { name: type, margin: parseFloat(margin.toFixed(1)), target: targetMargin };
    });
  }, [monthlyIncome, targetMargin]);

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { tab: 'inventory',   label: 'Add Inventory',  sub: 'Record new stock',    Icon: Package,     color: 'emerald', bg: 'emerald-50',  ic: 'emerald-600' },
          { tab: 'sales',       label: 'New Sale',        sub: 'Record transaction',  Icon: ShoppingCart, color: 'blue',   bg: 'blue-50',     ic: 'blue-600' },
          { tab: 'expenses',    label: 'Log Expense',     sub: 'Track spending',      Icon: Receipt,     color: 'red',    bg: 'red-50',      ic: 'red-600' },
          { tab: 'held-orders', label: 'Held Orders',     sub: 'To ship & book',      Icon: Package,     color: 'amber',  bg: 'amber-50',    ic: 'amber-600' },
        ].map(({ tab, label, sub, Icon, color, bg, ic }) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-${color}-500 hover:shadow-md transition-all text-left`}>
            <div className={`bg-${bg} w-10 h-10 rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 text-${ic}`} />
            </div>
            <div className="font-bold text-slate-700 text-sm">{label}</div>
            <div className="text-xs text-slate-400">{sub}</div>
          </button>
        ))}
      </div>

      {/* Yearly Summary */}
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
          <div className="p-2 bg-emerald-50 text-emerald-500 rounded-lg"><PieChartIcon className="w-5 h-5" /></div>
          <span className="text-xl font-bold tracking-tight">{currentYear} Annual Performance</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div className="px-4">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Total Revenue (YTD)</p>
            <p className="text-4xl font-semibold text-emerald-500 tracking-tight">{fmtExact(yearlyIncome)}</p>
            <p className="text-xs text-slate-400 mt-2 font-medium">Paid Sales Only</p>
          </div>
          <div className="px-4 pt-6 md:pt-0">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Cost of Goods Sold (YTD)</p>
            <p className="text-4xl font-semibold text-red-400 tracking-tight">{fmtExact(yearlyCOGS)}</p>
            <p className="text-xs text-slate-400 mt-2 font-medium uppercase">Purchase Cost</p>
          </div>
          <div className="px-4 pt-6 md:pt-0">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Gross Profit (YTD)</p>
            <p className={`text-4xl font-semibold tracking-tight ${yearlyGrossProfit >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
              {fmtExact(yearlyGrossProfit)}
            </p>
            <p className="text-xs text-slate-400 mt-2 font-medium">Before Operating Expenses</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <h2 className="text-slate-700 font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-500" /> Period
          </h2>
          <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-200 rounded-md text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
            <span className="w-28 text-center font-bold text-slate-700 text-sm">{monthLabel}</span>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-200 rounded-md text-slate-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm md:col-span-2 flex flex-col justify-center">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-emerald-500" />
              <span className="font-bold text-slate-700 text-sm">Margin Target</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="100" step="1" value={targetMargin}
                onChange={e => setTargetMargin(parseFloat(e.target.value) || 0)}
                className="w-16 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-right font-semibold text-emerald-600 text-sm outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="font-bold text-emerald-500">%</span>
            </div>
          </div>
          <input type="range" min="5" max="80" step="1" value={targetMargin}
            onChange={e => setTargetMargin(parseFloat(e.target.value))}
            className="w-full mt-3 h-2 bg-emerald-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
        </div>
      </div>

      {/* Chart + Financial Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" style={{ height: 320 }}>
          <div className="flex gap-6 h-full">
            <div className="flex-1 flex flex-col">
              <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChartIcon className="w-4 h-4 text-emerald-500" /> Margin by Sale Type — {monthLabel}
              </h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marginVarianceData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                    <YAxis unit="%" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', color: '#0f172a' }}
                    />
                    <ReferenceLine y={targetMargin} stroke="#10b981" strokeDasharray="3 3"
                      label={{ value: 'Target', position: 'insideTopRight', fill: '#34d399', fontSize: 10, fontWeight: 700 }} />
                    <Bar dataKey="margin" name="Margin %" radius={[4, 4, 0, 0]}>
                      {marginVarianceData.map((entry, i) => (
                        <Cell key={i} fill={entry.margin >= entry.target ? '#10b981' : '#f43f5e'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="w-44 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col justify-center items-center text-center p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-4">Net Margin</span>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-semibold text-emerald-600">{aggregateMargin.toFixed(1)}</span>
                <span className="text-xl font-bold text-emerald-600/60">%</span>
              </div>
              <div className="mt-4 pt-4 border-t border-emerald-200/50 w-full flex justify-center">
                {aggregateMargin >= targetMargin
                  ? <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white text-emerald-600 border border-emerald-200">On Track</span>
                  : <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white text-red-500 border border-red-200">Below Target</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Financial health */}
        <div className="grid grid-rows-3 gap-4" style={{ height: 320 }}>
          {[
            { label: 'Product Costs (COGS)', value: totalCOGS, pct: totalRevenue > 0 ? Math.min(100, (totalCOGS / totalRevenue) * 100) : 0, barColor: 'bg-slate-400' },
            { label: 'Operating Expenses', value: totalOpExp, pct: totalRevenue > 0 ? Math.min(100, (totalOpExp / totalRevenue) * 100) : 0, barColor: 'bg-red-400' },
          ].map(({ label, value, pct, barColor }) => (
            <div key={label} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-end mb-3">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{label}</span>
                <span className="text-lg font-medium text-slate-900">{fmtExact(value)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className={`${barColor} h-2.5 rounded-full`} style={{ width: pct + '%' }} />
              </div>
            </div>
          ))}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col">
            <div className="flex-1 flex flex-col justify-center items-center px-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Net Earnings</span>
                {netEarnings >= 0
                  ? <span className="bg-emerald-100 text-emerald-600 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Profit</span>
                  : <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><ArrowDownRight className="w-3 h-3" /> Loss</span>}
              </div>
              <div className={`text-3xl font-bold tracking-tight ${netEarnings >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {fmtExact(netEarnings)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
