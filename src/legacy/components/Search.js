import { state } from '../utils/state.js';
import { searchEbay, computeMarketFromListings, ruleMLScore, scoreVerdict, toPhp, getPlayerCategory } from '../utils/api.js';
import { extractFeatures, topFeatures } from '../utils/ml.js';
import { CAT_BADGE_CLASS, CAT_LABEL, DEFAULT_RULES, DEFAULT_PLAYER_CATEGORIES, SAMPLE_DEALS } from '../utils/constants.js';

export function renderSearch() {
  return `
    <div class="page-title">Search Listings</div>
    <div class="page-subtitle">Live eBay search · Scored using your deal history</div>

    <div class="search-area">
      <div class="search-row" style="margin-bottom:10px">
        <input
          id="q-input"
          type="text"
          placeholder="Player name  (e.g. LeBron James, Jordan Clarkson...)"
          value="${escHtml(state.query)}"
          style="flex:1;min-width:180px"
          onkeydown="if(event.key==='Enter') window.doSearch()"
        />
        <button class="btn-search" onclick="window.doSearch()" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? '<span>Searching…</span>' : '<span>Search eBay</span>'}
        </button>
      </div>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:space-between">
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <div style="display:flex;gap:4px;align-items:center">
            <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-right:4px">Type</span>
            ${[['all','All'],['fixed','Buy It Now'],['auction','Auction']].map(([v,l]) => `
              <button class="pill ${state.listingType === v ? 'active' : ''}" onclick="window.setListingType('${v}')">${l}</button>
            `).join('')}
          </div>
          <div style="display:flex;gap:4px;align-items:center">
            <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-right:4px">Location</span>
            ${[['us','US only'],['all','Worldwide']].map(([v,l]) => `
              <button class="pill ${state.itemLocation === v ? 'active' : ''}" onclick="window.setItemLocation('${v}')">${l}</button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    ${state.notify ? renderNotify(state.notify) : ''}
    ${!state.ebayKey && !state.notify ? renderNotify({ type: 'info', msg: 'Add your eBay API key in Settings to enable search.' }) : ''}

    ${state.results.length > 0 ? `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px">
        <div class="pill-row" style="margin-bottom:0">
          ${['', 'buy now', 'consider', 'skip'].map(v => `
            <button class="pill ${state.verdictFilter === v ? 'active' : ''}" onclick="window.setVerdictFilter('${v}')">
              ${v || 'all results'} ${v ? `(${state.results.filter(r => scoreVerdict(r.aiScore || 0).label === v).length})` : `(${state.results.length})`}
            </button>
          `).join('')}
        </div>
        <div style="display:flex;gap:4px;align-items:center">
          <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-right:4px">Sort</span>
          ${[['score','Deal Score'],['price_asc','Price ↑'],['price_desc','Price ↓'],['ending','Ending Soon']].map(([v,l]) => `
            <button class="pill ${(state.searchSort||'score') === v ? 'active' : ''}" onclick="window.setSearchSort('${v}')">${l}</button>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div>
      ${state.loading ? `
        <div class="loading-state">
          <div>Searching eBay…</div>
          <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
        </div>
      ` : ''}

      ${!state.loading && state.results.length === 0 && !state.query ? renderEmptySearch() : ''}

      ${renderResults()}
    </div>
  `;
}

function timeLeft(endTime) {
  if (!endTime) return null;
  const ms = new Date(endTime) - Date.now();
  if (ms <= 0) return 'Ended';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h >= 1)  return `${h}h ${m}m`;
  if (m >= 1)  return `${m}m ${s}s`;
  return `${s}s`;
}

function renderResults() {
  if (state.loading || state.results.length === 0) return '';
  const filtered = state.verdictFilter
    ? state.results.filter(r => scoreVerdict(r.aiScore || 0).label === state.verdictFilter)
    : state.results;

  if (filtered.length === 0) return `<div class="empty-state"><p>No ${state.verdictFilter} listings found.</p></div>`;

  const sort = state.searchSort || 'score';
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'price_asc')  return (a.price + (a.shippingCost||0)) - (b.price + (b.shippingCost||0));
    if (sort === 'price_desc') return (b.price + (b.shippingCost||0)) - (a.price + (a.shippingCost||0));
    if (sort === 'ending') {
      const aMs = a.endTime ? new Date(a.endTime) - Date.now() : Infinity;
      const bMs = b.endTime ? new Date(b.endTime) - Date.now() : Infinity;
      return aMs - bMs;
    }
    // 'score' — default: highest score first
    return (b.aiScore || 0) - (a.aiScore || 0);
  });

  return sorted.map(r => {
    const score   = r.aiScore || 0;
    const verdict = scoreVerdict(score).label;
    const vCls    = verdict === 'buy now' ? 'badge-buy' : verdict === 'consider' ? 'badge-consider' : 'badge-skip';
    const barColor = score >= 70 ? '#3ecf8e' : score >= 45 ? '#f5a623' : '#f04444';
    const scoreLetterCls = score >= 70 ? 'score-A' : score >= 45 ? 'score-B' : 'score-C';
    const scaledScore = score >= 70 ? 'A' : score >= 45 ? 'B' : 'C';
    const totalPrice = r.price + (r.shippingCost || 0);
    const phpPrice = toPhp(totalPrice, state.phpRate);
    const isAuction = r.buyingOption === 'AUCTION' || r.buyingOption === 'AUCTION_WITH_BIN';
    const tLeft = isAuction ? timeLeft(r.endTime) : null;
    // Urgency colour: red if < 1h, amber if < 4h, otherwise neutral
    const tLeftMs = r.endTime ? new Date(r.endTime) - Date.now() : Infinity;
    const tCls = tLeftMs < 3600000 ? 'badge-skip' : tLeftMs < 14400000 ? 'badge-consider' : 'badge-gray';

    return `
      <div class="listing-card">
        ${r.imgUrl
          ? `<img class="listing-img" src="${escHtml(r.imgUrl)}" alt="card" loading="lazy" onerror="this.style.display='none'" />`
          : `<div class="listing-img-ph">no image</div>`}

        <div class="listing-body">
          <div class="listing-title">${escHtml(r.title)}</div>
          <div class="listing-sub">${escHtml(r.condition)} · ${r.grade}</div>

          ${(() => {
            const pCat = getPlayerCategory(r.title, state.playerCategories);
            const pCatBadge = pCat ? `<span class="badge ${CAT_BADGE_CLASS[pCat] || 'badge-gray'}">${CAT_LABEL[pCat] || pCat}</span>` : '';
            return `
          <div class="listing-badges">
            <span class="badge ${vCls}">${verdict}</span>
            <span class="badge badge-blue">${r.grade}</span>
            ${pCatBadge}
            ${isAuction ? `<span class="badge badge-gray">Auction</span>` : ''}
            ${tLeft ? `<span class="badge ${tCls}">⏱ ${tLeft}</span>` : ''}
<span class="badge badge-pink">aesthetic ${r.aestheticScore}/10</span>
          </div>`;
          })()}

          ${state.mlFeatureWeights && r.aiScore >= 45 ? (() => {
            const player  = (r.title || '').split(/\s+/).slice(0, 3).join(' ');
            const reasons = topFeatures(extractFeatures(r), state.mlFeatureWeights, 3, player);
            return reasons.length ? `<div class="listing-ai-reason">Matches your taste: ${reasons.join(' · ')}</div>` : '';
          })() : ''}

          <div class="score-bar-wrap">
            <div class="score-bar-meta">
              <span>deal score</span>
              <span>${score}/100</span>
            </div>
            <div class="score-track">
              <div class="score-fill" style="width:${score}%;background:${barColor}"></div>
            </div>
          </div>

          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center">
            ${r.viewUrl
              ? `<a class="ebay-link" href="${escHtml(r.viewUrl)}" target="_blank" rel="noopener">view on eBay →</a>`
              : ''}
            ${r.itemId ? (() => {
              const watched = (state.watchlist || []).includes(r.itemId);
              return `<button
                class="btn-ghost btn-sm"
                onclick="window.toggleWatch('${r.itemId}', '${escHtml(r.title)}')"
                style="gap:4px;display:inline-flex;align-items:center"
                title="${watched ? 'Remove from watchlist' : 'Add to eBay watchlist'}"
              >${watched ? '♥' : '♡'} ${watched ? 'Watching' : 'Watch'}</button>`;
            })() : ''}
          </div>
        </div>

        <div class="listing-price">
          <div class="score-ring ${scoreLetterCls}">${scaledScore}</div>
          <div class="price-usd" style="margin-top:8px">$${totalPrice.toFixed(2)}</div>
          ${r.shippingCost > 0
            ? `<div style="font-size:10px;color:var(--text-muted)">$${r.price.toFixed(2)} + $${r.shippingCost.toFixed(2)} ship</div>`
            : `<div style="font-size:10px;color:var(--green)">free shipping</div>`}
          <div class="price-php">${phpPrice}</div>
          <div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
            <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.4px">Market price (${r.grade})</div>
            ${r.marketValue != null ? (() => {
              const roi = r.realRoiPct ?? 0;
              const cls = roi >= 20 ? 'badge-buy' : roi >= 0 ? 'badge-consider' : 'badge-skip';
              const sign = roi >= 0 ? '+' : '';
              const trendIcon  = r.trendDir === 'up' ? '↑' : r.trendDir === 'down' ? '↓' : '→';
              const trendLabel = r.trendDir === 'up' ? 'trending' : r.trendDir === 'down' ? 'cooling' : 'stable';
              const trendCls   = r.trendDir === 'up' ? 'badge-buy' : r.trendDir === 'down' ? 'badge-skip' : 'badge-gray';
              const trendPct   = r.trend != null ? ` ${r.trend > 0 ? '+' : ''}${r.trend}%` : '';
              return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:13px;font-weight:600;color:var(--text)">~$${r.marketValue.toFixed(0)}</span>
                <span class="badge ${cls}">${sign}${roi}% vs mkt</span>
                ${r.trendDir ? `<span class="badge ${trendCls}">${trendIcon} ${trendLabel}${trendPct}</span>` : ''}
              </div>`;
            })() : `<span style="font-size:12px;color:var(--text-muted)">-- (no sold data)</span>`}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderEmptySearch() {
  return `
    <div class="empty-state">
      <div class="empty-icon">🏀</div>
      <h3>Ready to source</h3>
      <p>Enter a player name above to pull live eBay listings.</p>
    </div>`;
}


export async function doSearch() {
  state.query  = document.getElementById('q-input')?.value?.trim() || '';
  state.notify = null;

  if (!state.query) {
    state.notify = { type: 'err', msg: 'Enter a player name to search.' };
    window.renderApp();
    return;
  }

  state.loading       = true;
  state.results       = [];
  state.verdictFilter = '';
  window.renderApp();

  try {
    const listings = await searchEbay(state.query, '', state.listingType, state.itemLocation);
    const marketData = computeMarketFromListings(listings);

    if (!listings.length) {
      state.loading = false;
      state.notify = { type: 'err', msg: 'No eBay results found. Try a broader search term.' };
      window.renderApp();
      return;
    }

    // Filter to listings that actually contain every word of the query
    const queryWords = state.query.toUpperCase().split(/\s+/).filter(Boolean);
    const relevant = listings.filter(l =>
      queryWords.every(w => l.title.toUpperCase().includes(w))
    );

    const _rules   = state.rules || DEFAULT_RULES;
    const _deals   = state.deals || SAMPLE_DEALS;
    const _weights = state.mlFeatureWeights || null;
    if (!state.playerCategories) state.playerCategories = DEFAULT_PLAYER_CATEGORIES;

    relevant.forEach(l => {
      try {
        l.aiScore = ruleMLScore(l, null, _rules, _deals, _weights, marketData);
        if (!Number.isFinite(l.aiScore)) l.aiScore = 0;
      } catch (err) {
        console.error('[score]', err.message, l.title);
        l.aiScore = 0;
      }
    });

    // Remove listings priced >25% above market value (only when we have enough sold data)
    const filtered = (marketData?.count >= 3)
      ? relevant.filter(l => l.realRoiPct === undefined || l.realRoiPct >= -25)
      : relevant;

    state.results = [...filtered].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
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


function renderNotify({ type, msg }) {
  const cls = type === 'ok' ? 'notify-ok' : type === 'info' ? 'notify-info' : 'notify-err';
  return `<div class="notify ${cls}">${msg}</div>`;
}
