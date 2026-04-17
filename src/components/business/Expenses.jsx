import { useState, useMemo } from 'react';
import { Plus, Trash2, Receipt, TrendingDown, PieChart, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fmt, fmtExact, genId, getCategoryColor } from './store.js';

export default function Expenses({ data, update }) {
  const [showModal, setShowModal] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [form, setForm] = useState({ description: '', amount: '', category: '', date: new Date().toISOString().slice(0, 10), notes: '' });

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const changeMonth = (offset) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + offset);
    setCurrentDate(d);
  };

  const monthlyExpenses = useMemo(() =>
    (data.expenses || []).filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a, b) => new Date(b.date) - new Date(a.date)),
    [data.expenses, currentMonth, currentYear]
  );

  const totalMonthly = monthlyExpenses.reduce((a, e) => a + e.amount, 0);

  // Category breakdown
  const byCategory = useMemo(() => {
    const map = {};
    for (const e of monthlyExpenses) {
      const cat = e.category || 'Other';
      map[cat] = (map[cat] || 0) + e.amount;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthlyExpenses]);

  const addExpense = () => {
    if (!form.description.trim() || !form.amount) return;
    const expense = {
      id: genId(),
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      category: form.category || 'Other',
      date: form.date || new Date().toISOString().slice(0, 10),
      notes: form.notes.trim(),
    };
    update(prev => ({ ...prev, expenses: [expense, ...(prev.expenses || [])] }));
    setShowModal(false);
    setForm({ description: '', amount: '', category: '', date: new Date().toISOString().slice(0, 10), notes: '' });
  };

  const deleteExpense = (id) => {
    update(prev => ({ ...prev, expenses: (prev.expenses || []).filter(e => e.id !== id) }));
  };

  const categories = data.categories || ['Supplies', 'Shipping', 'Marketing', 'Packaging', 'Other'];

  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    if (isNaN(dt)) return String(d);
    return dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Log Expense
        </button>
        <div className="flex items-center bg-white rounded-xl border border-slate-200 shadow-sm p-1">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronLeft className="w-4 h-4" /></button>
          <span className="w-32 text-center font-bold text-slate-700 text-sm">{monthLabel}</span>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Summary + Chart */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Monthly total */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-red-50 rounded-lg"><TrendingDown className="w-4 h-4 text-red-500" /></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Expenses</span>
          </div>
          <div className="text-4xl font-bold text-red-500 tracking-tight">{fmtExact(totalMonthly)}</div>
          <div className="text-xs text-slate-400 mt-2">{monthlyExpenses.length} transaction{monthlyExpenses.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Category chart */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6" style={{ height: 200 }}>
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">By Category</span>
          </div>
          {byCategory.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-slate-300 text-sm">No expenses this month</div>
          ) : (
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={byCategory} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={90} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                <Tooltip
                  formatter={(v) => fmtExact(v)}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {byCategory.map((entry, i) => (
                    <Cell key={i} fill={getCategoryColor(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Expense list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {monthlyExpenses.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No expenses this month</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Description</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Category</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthlyExpenses.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-800">{e.description}</div>
                    {e.notes && <div className="text-xs text-slate-400">{e.notes}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: getCategoryColor(e.category || 'Other') }}>
                      {e.category || 'Other'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-500">{fmt(e.amount)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteExpense(e.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-100 bg-slate-50/50">
                <td colSpan={3} className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</td>
                <td className="px-4 py-3 text-right font-bold text-red-600">{fmtExact(totalMonthly)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Log Expense</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description *</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. Bubble wrap, eBay fees…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Amount (₱) *</label>
                  <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, category: c }))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${form.category === c ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      style={form.category === c ? { backgroundColor: getCategoryColor(c) } : {}}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Optional…"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-slate-100">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button onClick={addExpense} disabled={!form.description.trim() || !form.amount}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save Expense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
