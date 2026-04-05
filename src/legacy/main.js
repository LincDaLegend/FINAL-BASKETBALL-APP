import { state, emptyDeal } from './utils/state.js';
import { buildModel, loadModel, trainOnDeals, saveModel } from './utils/tfModel.js';
import { buildEmbeddingModel } from './utils/embedding.js';
import { startEnrichment } from './utils/enrichment.js';
import { renderSearch, doSearch } from './components/Search.js';
import { renderDeals, logDeal, removeDeal, clearAllDeals, exportDeals, handleXlsxFile, handleXlsxDrop, xlsxSetMapping, cancelXlsxImport, processXlsxImport, segmentEdit, segmentAddNew, segmentCancelEdit, segmentSave, segmentDelete } from './components/Deals.js';
import { renderRules, setRulesTab, updateCatROI, addPlayer, removePlayer, addSetToTier, removeSetFromTier, resetAllConfig, setMLWeight } from './components/Rules.js';
import {
  renderSettings, saveEbayKey, clearEbayKey,
  updateRate, exportAllData, importDataPrompt, nukeAllData,
} from './components/Settings.js';
import {
  renderDiagnostic, startDiagnostic, diagPick, diagSkip, diagApply, diagApplyPrefs, diagDiscard, diagRunSearch,
} from './components/Diagnostic.js';
import { renderCycles } from './components/Cycles.js';

const ICONS = {
  search:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>`,
  deals:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h4"/></svg>`,
  diagnostic: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  cycles:     `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  rules:      `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>`,
  settings:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
};

const CROWN_SVG = `<svg viewBox="0 0 22 26" fill="white" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="3.8" r="2.8"/>
  <path d="M8 7C7 8 6 11 6.5 15L10.5 15L10 22L14 22L13.5 15L17 14C17 11 15.5 8 14 7Q13 6.2 12 6.2Q10 6.2 8 7Z"/>
  <path d="M17 10L20.5 7.5L21.5 9.8L18.5 12.5Z"/>
  <circle cx="21.5" cy="6.5" r="2.2"/>
  <path d="M10 22L8.5 26L11 26L12 24Z"/>
  <path d="M14 22L15.5 26L13 26L12 24Z"/>
</svg>`;

const NAV = [
  { id: 'search',     label: 'Search',         icon: 'search',     section: null },
  { id: 'deals',      label: 'Deal Log',       icon: 'deals',      section: null },
  { id: 'diagnostic', label: 'Diagnostic',     icon: 'diagnostic', section: null },
  { id: 'cycles',     label: 'Cycles',         icon: 'cycles',     section: null },
  { id: 'rules',      label: 'Player Tiers',   icon: 'rules',      section: 'Config' },
  { id: 'settings',   label: 'Settings',       icon: 'settings',   section: null },
];

function renderApp() {
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = `
    <header class="app-header">
      <div class="logo">
        <div class="logo-icon">${CROWN_SVG}</div>
        <div class="logo-text">Bogart Makes Bands</div>
      </div>
    </header>

    <div class="app-body">
      <nav class="sidebar">
        ${NAV.map(n => `
          ${n.section ? `<div class="nav-section">${n.section}</div>` : ''}
          <button class="nav-item ${state.tab === n.id ? 'active' : ''}" onclick="window.setTab('${n.id}')">
            <span class="nav-icon">${ICONS[n.icon]}</span>
            <span>${n.label}</span>
            ${n.id === 'deals' && state.deals.length > 0 ? `<span class="nav-count">${state.deals.length}</span>` : ''}
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
          <span class="mobile-nav-icon">${ICONS[n.icon]}</span>
          <span>${n.label}</span>
        </button>
      `).join('')}
    </nav>
  `;
}

function renderPage() {
  switch (state.tab) {
    case 'search':     return renderSearch();
    case 'deals':      return renderDeals();
    case 'diagnostic': return renderDiagnostic();
    case 'cycles':     return renderCycles();
    case 'rules':      return renderRules();
    case 'settings':   return renderSettings();
    default:           return renderSearch();
  }
}

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
window.setListingType  = (v) => { state.listingType  = v; renderApp(); };
window.setItemLocation = (v) => { state.itemLocation = v; renderApp(); };

// Deals
window.ndSet = (k, v) => { state.newDeal[k] = v; };
window.logDeal = logDeal;
window.removeDeal = removeDeal;
window.clearAllDeals = clearAllDeals;
window.clearNewDeal = () => { state.newDeal = emptyDeal(); renderApp(); };
window.exportDeals  = exportDeals;

// AI enrichment
window.startEnrichment = () => startEnrichment();

// Segment editing
window.segmentEdit       = segmentEdit;
window.segmentAddNew     = segmentAddNew;
window.segmentCancelEdit = segmentCancelEdit;
window.segmentSave       = segmentSave;
window.segmentDelete     = segmentDelete;

// xlsx import
window.handleXlsxFile     = (file) => handleXlsxFile(file);
window.handleXlsxDrop     = (ev)   => handleXlsxDrop(ev);
window.xlsxSetMapping     = (field, col) => xlsxSetMapping(field, col);
window.cancelXlsxImport   = cancelXlsxImport;
window.processXlsxImport  = processXlsxImport;

// Scoring config (Rules tab)
window.setRulesTab        = setRulesTab;
window.updateCatROI       = updateCatROI;
window.addPlayer          = addPlayer;
window.removePlayer       = removePlayer;
window.addSetToTier       = addSetToTier;
window.removeSetFromTier  = removeSetFromTier;
window.resetAllConfig     = resetAllConfig;
window.setMLWeight        = setMLWeight;

// Settings
window.placeBid = async (itemId, title) => {
  const input = document.getElementById(`bid-${itemId}`);
  const maxBid = parseFloat(input?.value);
  if (!maxBid || maxBid <= 0) {
    state.notify = { type: 'err', msg: 'Enter a valid max bid amount.' };
    window.renderApp();
    return;
  }
  if (!state.ebayToken) {
    state.notify = { type: 'err', msg: 'Connect your eBay account in Settings first.' };
    window.renderApp();
    return;
  }
  state.notify = { type: 'info', msg: `Placing bid on "${title.slice(0, 40)}..."` };
  window.renderApp();
  try {
    const resp = await fetch('/api/ebay/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, maxBid, userToken: state.ebayToken }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Bid failed');
    state.notify = { type: 'ok', msg: `Bid placed! Max: $${maxBid.toFixed(2)}` };
  } catch (e) {
    state.notify = { type: 'err', msg: `Bid failed: ${e.message}` };
  }
  window.renderApp();
};

window.connectEbayAccount = () => {
  if (!state.ebayKey || !state.ebaySecret || !state.ebayRuName) {
    state.notify = { type: 'err', msg: 'Save your App ID, Client Secret, and RuName in Settings first.' };
    window.renderApp();
    return;
  }
  const params = new URLSearchParams({
    app_id:        state.ebayKey,
    client_secret: state.ebaySecret,
    ru_name:       state.ebayRuName,
  });
  window.location.href = `/api/ebay/auth?${params}`;
};
window.disconnectEbayUser = () => {
  state.ebayUser = null;
  import('./utils/state.js').then(({ persistSettings }) => persistSettings());
  state.notify = { type: 'info', msg: 'eBay account disconnected.' };
  renderApp();
};
window.saveEbayKey      = saveEbayKey;
window.clearEbayKey     = clearEbayKey;
window.updateRate       = updateRate;
window.exportAllData    = exportAllData;
window.importDataPrompt = importDataPrompt;
window.nukeAllData      = nukeAllData;

// Diagnostic
window.startDiagnostic  = startDiagnostic;
window.diagPick         = diagPick;
window.diagSkip         = diagSkip;
window.diagApply        = diagApply;
window.diagApplyPrefs   = diagApplyPrefs;
window.diagDiscard      = diagDiscard;
window.diagRunSearch    = diagRunSearch;

// Bid popup
window.openBidPopup = (url) => {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// Search suggestions
window.runSuggestedSearch = (query) => {
  state.query = query;
  window.setTab('search');
  setTimeout(() => {
    const input = document.getElementById('q-input');
    if (input) input.value = query;
    window.doSearch();
  }, 50);
};
window.fetchSuggestions = async () => {
  state.suggestLoading = true;
  window.renderApp();
  try {
    const resp = await fetch('/api/suggest-searches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deals:    state.deals,
        weights:  state.mlFeatureWeights || {},
        rules:    state.rules,
        segments: state.segments || [],
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      state.suggestedSearches = data.suggestions || [];
      state.suggestTrendNote  = data.trendNote   || '';
      const { persistSettings } = await import('./utils/state.js');
      persistSettings();
    }
  } catch (e) {
    console.warn('[suggest]', e);
  }
  state.suggestLoading = false;
  window.renderApp();
};

// Debounce renderApp — batches rapid calls into a single RAF paint
let _rafPending = false;
const _renderAppImmediate = renderApp;
window.renderApp = () => {
  if (_rafPending) return;
  _rafPending = true;
  requestAnimationFrame(() => { _rafPending = false; _renderAppImmediate(); });
};

// Handle eBay OAuth callback — reads ?ebay_user= or ?ebay_error= from URL
(function handleEbayOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const user  = params.get('ebay_user');
  const err   = params.get('ebay_error');
  if (user || err) {
    // Clean the query string without a page reload
    history.replaceState(null, '', window.location.pathname);
    if (user) {
      state.ebayUser     = user;
      state.ebayToken    = params.get('ebay_token')     || null;
      state.ebayTokenExp = parseInt(params.get('ebay_token_exp') || '0', 10);
      state.ebayRefresh  = params.get('ebay_refresh')   || null;
      import('./utils/state.js').then(({ persistSettings }) => persistSettings());
      state.notify = { type: 'ok', msg: `eBay account connected: ${user}` };
    } else if (err) {
      state.notify = { type: 'err', msg: `eBay connect failed: ${err}` };
    }
  }
})();

// Initialise semantic embedding model — synchronous, runs immediately from deals in localStorage.
if (state.deals.length >= 2) {
  state.embModel = buildEmbeddingModel(state.deals);
}

renderApp();

// Initialise TensorFlow.js model — async, non-blocking.
// Only trains if no saved model exists; otherwise loads weights as-is.
(async () => {
  try {
    const saved = await loadModel();
    if (saved) {
      // Model already trained and saved — just load it, no retraining needed
      state.tfModel      = saved;
      state.tfModelReady = state.deals.length >= 3;
    } else if (state.deals.length >= 3) {
      // First run — build and train from scratch
      const model   = buildModel();
      state.tfModel = model;
      const trained = await trainOnDeals(model, state.deals);
      if (trained) { await saveModel(model); state.tfModelReady = true; }
    } else {
      state.tfModel = buildModel(); // ready to receive training later
    }
  } catch (e) {
    console.warn('[TF init]', e);
  }
})();
