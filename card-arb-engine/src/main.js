import { state, persistDeals, emptyDeal } from './utils/state.js';
import { renderSearch, doSearch } from './components/Search.js';
import { renderDeals, logDeal, removeDeal, clearAllDeals, exportDeals } from './components/Deals.js';
import { renderRules, updateRule, resetRules, setMLWeight } from './components/Rules.js';
import {
  renderSettings, saveEbayKey, clearEbayKey,
  updateRate, exportAllData, importDataPrompt, nukeAllData,
} from './components/Settings.js';

// ── Navigation config ─────────────────────────────────────────
const NAV = [
  { id: 'search',   label: 'Search',       icon: '🔍', section: null },
  { id: 'deals',    label: 'Deal Log',      icon: '📋', section: null },
  { id: 'rules',    label: 'Category Rules',icon: '⚙',  section: 'Config' },
  { id: 'settings', label: 'Settings',      icon: '🔧', section: null },
];

// ── Render ────────────────────────────────────────────────────
function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <header class="app-header">
      <div class="logo">
        <div class="logo-icon">CA</div>
        <div>
          <div class="logo-text">Card Arb Engine</div>
          <div class="logo-sub">eBay US → PH · AI-powered sourcing</div>
        </div>
      </div>
      <div class="header-right">
        <div class="rate-badge">₱${state.phpRate.toFixed(1)}/USD</div>
        ${state.ebayKey
          ? `<div class="rate-badge" style="color:var(--green);border-color:#1a5c3a">eBay connected</div>`
          : `<div class="rate-badge" style="color:var(--amber);border-color:#4a3010">No eBay key</div>`}
      </div>
    </header>

    <div class="app-body">
      <nav class="sidebar">
        ${NAV.map(n => `
          ${n.section ? `<div class="nav-section">${n.section}</div>` : ''}
          <button class="nav-item ${state.tab === n.id ? 'active' : ''}" onclick="window.setTab('${n.id}')">
            <span class="nav-icon">${n.icon}</span>
            <span>${n.label}</span>
            ${n.id === 'deals' && state.deals.length > 0 ? `<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${state.deals.length}</span>` : ''}
          </button>
        `).join('')}
      </nav>

      <main class="main-content">
        ${renderPage()}
      </main>
    </div>

    <nav class="mobile-nav">
      ${NAV.map(n => `
        <button class="mobile-nav-item ${state.tab === n.id ? 'active' : ''}" onclick="window.setTab('${n.id}')">
          <span class="mobile-nav-icon">${n.icon}</span>
          <span>${n.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

function renderPage() {
  switch (state.tab) {
    case 'search':   return renderSearch();
    case 'deals':    return renderDeals();
    case 'rules':    return renderRules();
    case 'settings': return renderSettings();
    default:         return renderSearch();
  }
}

// ── Global action bindings ────────────────────────────────────
window.renderApp = renderApp;

window.setTab = (tab) => {
  state.tab    = tab;
  state.notify = null;
  renderApp();
  window.scrollTo(0, 0);
};

window.setVerdictFilter = (v) => {
  state.verdictFilter = state.verdictFilter === v ? '' : v;
  renderApp();
};

// Search
window.doSearch = doSearch;

// Deals
window.ndSet = (k, v) => { state.newDeal[k] = v; };
window.logDeal = logDeal;
window.removeDeal = removeDeal;
window.clearAllDeals = clearAllDeals;
window.clearNewDeal = () => { state.newDeal = emptyDeal(); renderApp(); };
window.exportDeals  = exportDeals;

// Rules
window.updateRule = updateRule;
window.resetRules  = resetRules;
window.setMLWeight = setMLWeight;

// Settings
window.saveEbayKey      = saveEbayKey;
window.clearEbayKey     = clearEbayKey;
window.updateRate       = updateRate;
window.exportAllData    = exportAllData;
window.importDataPrompt = importDataPrompt;
window.nukeAllData      = nukeAllData;

// ── Boot ──────────────────────────────────────────────────────
renderApp();
