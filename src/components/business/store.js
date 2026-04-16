import { useState, useEffect } from 'react';

const STORAGE_KEY = 'baller_biz_v1';

export const SaleStatus = { SHIPPED: 'Shipped', ON_HOLD: 'On Hold', TO_SHIP: 'To Ship' };
export const PaymentStatus = { PAID: 'Paid', UNPAID: 'Unpaid' };

const defaultState = {
  inventory: [],
  sales: [],
  expenses: [],
  shippingBatches: [],
  budgets: {},
  categories: ['Supplies', 'Shipping', 'Marketing', 'Packaging', 'Other'],
  supplies: { totalQuantity: 0, costPerUnit: 0, unitsPerItem: 1 },
  phpRate: 57.2,
  googleSheetsUrl: '',
  ebayUserToken: '',
  autoSyncEnabled: false,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const saved = JSON.parse(raw);
    // migrate old baller state if present
    const legacy = localStorage.getItem('baller_state');
    const legacyParsed = legacy ? JSON.parse(legacy) : {};
    return {
      ...defaultState,
      ...saved,
      phpRate: saved.phpRate ?? legacyParsed.phpRate ?? defaultState.phpRate,
      googleSheetsUrl: saved.googleSheetsUrl || legacyParsed.gasWriteUrl || '',
      ebayUserToken: saved.ebayUserToken || '',
    };
  } catch {
    return defaultState;
  }
}

export function useBusinessStore() {
  const [data, setData] = useState(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }, [data]);

  const update = (fn) => setData(prev => {
    const next = typeof fn === 'function' ? fn(prev) : { ...prev, ...fn };
    return next;
  });

  return [data, update];
}

export function fmt(n) {
  return '₱' + Math.round(n || 0).toLocaleString('en-PH');
}

export function fmtExact(n) {
  return '₱' + (n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getCategoryColor(str) {
  const colors = ['#f97316','#10b981','#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#3b82f6','#14b8a6'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
