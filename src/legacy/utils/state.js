import { load, save } from './storage.js';
import { DEFAULT_RULES, SAMPLE_DEALS } from './constants.js';

export const state = {
  tab: 'search',

  // Settings
  ebayKey: load('ebayKey', ''),
  phpRate: load('phpRate', 57.2),
  mlWeights: load('mlWeights', { roi: 0.6, speed: 0.4 }),

  // Search
  query: '',
  category: '',
  results: [],
  loading: false,
  verdictFilter: '',
  notify: null,

  // Deals (ML training data)
  deals: load('deals', SAMPLE_DEALS),

  // Rules
  rules: load('rules', DEFAULT_RULES),

  // New deal form
  newDeal: emptyDeal(),
};

export function emptyDeal() {
  return {
    player: '', year: '', set: '', variant: '',
    grade: 'raw', buyPrice: '', sellPrice: '',
    days: '', category: 'low end', aesthetic: '', notes: '',
  };
}

export function persistDeals() { save('deals', state.deals); }
export function persistRules()  { save('rules', state.rules); }
export function persistSettings() {
  save('ebayKey',    state.ebayKey);
  save('phpRate',    state.phpRate);
  save('mlWeights',  state.mlWeights);
}

export function dealStats() {
  const d = state.deals;
  if (!d.length) return { count: 0, avgROI: 0, avgDays: 0, totalProfit: 0 };
  return {
    count:       d.length,
    avgROI:      +(d.reduce((a, x) => a + (x.roi || 0), 0) / d.length).toFixed(1),
    avgDays:     +(d.reduce((a, x) => a + (x.days || 0), 0) / d.length).toFixed(1),
    totalProfit: +d.reduce((a, x) => a + ((x.sellPrice - x.buyPrice) || 0), 0).toFixed(2),
  };
}

