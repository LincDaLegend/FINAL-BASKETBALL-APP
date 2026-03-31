import { state } from '../utils/state.js';
import { searchEbay, ruleMLScore, scoreVerdict, toPhp } from '../utils/api.js';
import { CATEGORIES, CAT_BADGE_CLASS } from '../utils/constants.js';

export function renderSearch() {
  return `
    <div class="page-title">Search Listings</div>
    <div class="page-subtitle">Live eBay search · Scored using your deal history</div>

    <div class="search-area">
      <div class="search-row">
        <input
          id="q-input"
          type="text"
          placeholder="Player name  (e.g. LeBron James, Ja Morant...)"
          value="${escHtml(state.query)}"
          style="flex:3;min-width:180px"
          onkeydown="if(event.key==='Enter') window.doSearch()"
        />
        <select id="cat-input" style="flex:1;min-width:140px">
          <option value="">All categories</option>
          ${CATEGORIES.map(c => `<option value="${c}" ${state.category === c ? 'selected' : ''}>${capFirst(c)}</option>`).join('')}
        </select>
        <button class="btn-search" onclick="window.doSearch()" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? '<span>Searching…</span>' : '<span>Search eBay</span>'}
        </button>
      </div>
    </div>

    ${state.notify ? renderNotify(state.notify) : ''}
    ${!state.ebayKey ? renderNotify({ type: 'info', msg: 'No eBay API key set — go to Settings to add it before searching.' }) : ''}

    ${state.results.length > 0 ? `
      <div class="pill-row">
        ${['', 'buy now', 'consider', 'skip'].map(v => `
          <button class="pill ${state.verdictFilter === v ? 'active' : ''}" onclick="window.setVerdictFilter('${v}')">
            ${v || 'all results'} ${v ? `(${state.results.filter(r => scoreVerdict(r.aiScore || 0).label === v).length})` : `(${state.results.length})`}
          </button>
        `).join('')}
      </div>
    ` : ''}

    ${state.loading ? `
      <div class="loading-state">
        <div>Searching eBay…</div>
        <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
      </div>
    ` : ''}

    ${!state.loading && state.results.length === 0 && !state.query ? `
      <div class="empty-state">
        <div class="empty-icon">🏀</div>
        <h3>Ready to source</h3>
        <p>Enter a player name above to pull live eBay listings.<br/>Listings are scored using your deal history and category rules.</p>
      </div>
    ` : ''}

    ${renderResults()}
  `;
}

function renderResults() {
  if (state.loading || state.results.length === 0) return '';
  const filtered = state.verdictFilter
    ? state.results.filter(r => scoreVerdict(r.aiScore || 0).label === state.verdictFilter)
    : state.results;

  if (filtered.length === 0) return `<div class="empty-state"><p>No ${state.verdictFilter} listings found.</p></div>`;

  return filtered.map(r => {
    const score   = r.aiScore || 0;
    const verdict = scoreVerdict(score).label;
    const vCls    = verdict === 'buy now' ? 'badge-buy' : verdict === 'consider' ? 'badge-consider' : 'badge-skip';
    const barColor = score >= 70 ? '#3ecf8e' : score >= 45 ? '#f5a623' : '#f04444';
    const scoreLetterCls = score >= 70 ? 'score-A' : score >= 45 ? 'score-B' : 'score-C';
    const scaledScore = score >= 70 ? 'A' : score >= 45 ? 'B' : 'C';
    const phpPrice = toPhp(r.price, state.phpRate);

    return `
      <div class="listing-card">
        ${r.imgUrl
          ? `<img class="listing-img" src="${escHtml(r.imgUrl)}" alt="card" loading="lazy" onerror="this.style.display='none'" />`
          : `<div class="listing-img-ph">no image</div>`}

        <div class="listing-body">
          <div class="listing-title">${escHtml(r.title)}</div>
          <div class="listing-sub">${escHtml(r.condition)} · ${r.grade}</div>

          <div class="listing-badges">
            <span class="badge ${vCls}">${verdict}</span>
            <span class="badge badge-blue">${r.grade}</span>
            ${state.category ? `<span class="badge ${CAT_BADGE_CLASS[state.category] || 'badge-gray'}">${state.category}</span>` : ''}
            <span class="badge badge-pink">aesthetic ${r.aestheticScore}/10</span>
          </div>

          <div class="score-bar-wrap">
            <div class="score-bar-meta">
              <span>deal score</span>
              <span>${score}/100</span>
            </div>
            <div class="score-track">
              <div class="score-fill" style="width:${score}%;background:${barColor}"></div>
            </div>
          </div>

          ${r.viewUrl ? `<a class="ebay-link" href="${escHtml(r.viewUrl)}" target="_blank" rel="noopener">view on eBay →</a>` : ''}
        </div>

        <div class="listing-price">
          <div class="score-ring ${scoreLetterCls}">${scaledScore}</div>
          <div class="price-usd" style="margin-top:8px">$${r.price.toFixed(2)}</div>
          <div class="price-php">${phpPrice}</div>
        </div>
      </div>
    `;
  }).join('');
}

export async function doSearch() {
  state.query    = document.getElementById('q-input')?.value?.trim() || '';
  state.category = document.getElementById('cat-input')?.value || '';
  state.notify   = null;

  if (!state.query && !state.category) {
    state.notify = { type: 'err', msg: 'Enter a player name or pick a category first.' };
    window.renderApp();
    return;
  }

  if (!state.ebayKey) {
    state.notify = { type: 'err', msg: 'Add your eBay API key in Settings first.' };
    window.renderApp();
    return;
  }

  state.loading = true;
  state.results = [];
  state.verdictFilter = '';
  window.renderApp();

  try {
    const listings = await searchEbay(state.query, state.category);

    if (!listings.length) {
      state.loading = false;
      state.notify = { type: 'err', msg: 'No eBay results found. Try a broader search term.' };
      window.renderApp();
      return;
    }

    listings.forEach(l => { l.aiScore = ruleMLScore(l, state.category, state.rules, state.deals); });
    state.results = [...listings].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
    state.loading = false;
    window.renderApp();
  } catch (e) {
    state.loading = false;
    state.notify  = { type: 'err', msg: `Search failed: ${e.message}` };
    window.renderApp();
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function capFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function renderNotify({ type, msg }) {
  const cls = type === 'ok' ? 'notify-ok' : type === 'info' ? 'notify-info' : 'notify-err';
  return `<div class="notify ${cls}">${msg}</div>`;
}

