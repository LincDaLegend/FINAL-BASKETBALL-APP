import { state, persistSettings } from '../utils/state.js';
import { searchEbayQuick } from '../utils/api.js';
import { extractFeatures, pairwiseUpdate, DEFAULT_WEIGHTS, FEATURE_LABELS } from '../utils/ml.js';

async function fetchSoldPrices(query) {
  if (!query) return null;
  try {
    const resp = await fetch('/api/sold-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ebay-key': state.ebayKey || '' },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

// Gradient presets cycled by round index
const GRADIENTS = [
  'linear-gradient(140deg, #b0b8c8 0%, #e8ecf0 45%, #8c9aaa 100%)',
  'linear-gradient(140deg, #78350f 0%, #d97706 50%, #fbbf24 100%)',
  'linear-gradient(140deg, #064e3b 0%, #10b981 60%, #6ee7b7 100%)',
  'linear-gradient(140deg, #1e3a8a 0%, #1d4ed8 60%, #60a5fa 100%)',
  'linear-gradient(140deg, #4c1d95 0%, #7c3aed 60%, #c4b5fd 100%)',
  'linear-gradient(140deg, #92400e 0%, #b45309 50%, #f59e0b 100%)',
  'linear-gradient(140deg, #1e3a5f 0%, #6366f1 60%, #a5b4fc 100%)',
  'linear-gradient(140deg, #14532d 0%, #16a34a 60%, #86efac 100%)',
  'linear-gradient(140deg, #0c4a6e 0%, #0284c7 60%, #7dd3fc 100%)',
  'linear-gradient(140deg, #881337 0%, #e11d48 60%, #fda4af 100%)',
  'linear-gradient(140deg, #292524 0%, #57534e 60%, #a8a29e 100%)',
  'linear-gradient(140deg, #1e1b4b 0%, #4338ca 60%, #a5b4fc 100%)',
];

export function renderDiagnostic() {
  const sess = state.diagnosticSession;
  if (!sess) return renderIntro();
  if (sess.phase === 'loading-claude') return renderClaudeThinking('Generating your next question…');
  if (sess.phase === 'loading-listings') return renderClaudeThinking('Pulling live eBay listings…');
  if (sess.phase === 'done') return renderProfile(sess);
  return renderRound(sess);
}

// ─── Intro ────────────────────────────────────────────────────────────────────
function renderIntro() {
  const hasWeights = !!state.mlFeatureWeights;

  return `
    <div class="page-title">Diagnostic</div>
    <div class="page-subtitle">Claude learns your exact sourcing preferences — as many rounds as it takes</div>

    <div class="card-section" style="max-width:580px">
      <div class="section-title" style="margin-bottom:8px">How it works</div>
      <p style="font-size:13px;color:var(--text-muted);line-height:1.75;margin-bottom:8px">
        Claude asks you A/B card comparisons — each question is generated live based on what it still needs to learn about you. After every pick it analyses your pattern, then decides what to probe next. It keeps going until it reaches a <strong>firm, confident profile</strong> of your sourcing style (usually 8–16 rounds).
      </p>
      <p style="font-size:13px;color:var(--text-muted);line-height:1.75;margin-bottom:20px">
        The result: a written profile of your preferences + 5 personalised search recommendations wired directly into your search bar.
      </p>
      <div style="display:flex;gap:10px">
        <button class="btn-primary" onclick="window.startDiagnostic()">${hasWeights ? 'Re-run diagnostic' : 'Start diagnostic'}</button>
      </div>
    </div>

    ${hasWeights ? renderWeightsSummary() : ''}
    ${state.diagnosticProfile ? renderSavedProfile() : ''}
  `;
}

function renderSavedProfile() {
  return `
    <div class="card-section" style="max-width:580px">
      <div class="section-title" style="margin-bottom:10px">Your profile</div>
      <div class="diag-profile-text">${escHtml(state.diagnosticProfile)}</div>
    </div>
  `;
}

// ─── Thinking state ───────────────────────────────────────────────────────────
function renderClaudeThinking(msg) {
  return `
    <div class="page-title">Diagnostic</div>
    <div class="page-subtitle">${escHtml(msg)}</div>
    <div class="loading-state" style="padding-top:2rem">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">Claude is working…</div>
      <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
    </div>
  `;
}

// ─── Active round ─────────────────────────────────────────────────────────────
function renderRound(sess) {
  const round = sess.currentRound;
  const listingA = sess.listings?.A || null;
  const listingB = sess.listings?.B || null;
  const gradA = GRADIENTS[(sess.picks.length * 2)     % GRADIENTS.length];
  const gradB = GRADIENTS[(sess.picks.length * 2 + 1) % GRADIENTS.length];
  const completed = sess.picks.length;

  return `
    <div class="page-title">Diagnostic</div>
    <div class="page-subtitle">${escHtml(round.question)}</div>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      ${sess.picks.map((_, i) => `<div style="width:18px;height:3px;border-radius:2px;background:var(--text-primary)"></div>`).join('')}
      <div style="width:18px;height:3px;border-radius:2px;background:var(--text-muted)"></div>
      <span style="font-size:11px;color:var(--text-muted);margin-left:4px">Round ${completed + 1} · ${escHtml(round.label)}</span>
    </div>

    ${round.analysis ? `
      <div class="diag-analysis-bar">
        <span class="diag-analysis-icon">◆</span>
        <span>${escHtml(round.analysis)}</span>
      </div>
    ` : ''}

    <div class="diag-pair">
      ${renderCardOption(round.A, listingA, 'A', gradA, sess.soldPrices?.A)}
      <div class="diag-vs">or</div>
      ${renderCardOption(round.B, listingB, 'B', gradB, sess.soldPrices?.B)}
    </div>

    <div style="text-align:center;margin-top:12px">
      <button class="btn-ghost btn-sm" onclick="window.diagSkip()">No preference — skip</button>
    </div>
  `;
}

function renderCardOption(roundDef, listing, side, gradient, comps) {
  const hasListing   = listing && listing.title;
  const listingPrice = hasListing ? listing.price : null;
  const displayTitle = hasListing
    ? (listing.title.length > 70 ? listing.title.slice(0, 70) + '…' : listing.title)
    : roundDef.hint;

  const imageHtml = hasListing && listing.imgUrl
    ? `<img src="${escHtml(listing.imgUrl)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md) var(--radius-md) 0 0" loading="lazy" onerror="this.style.display='none'" />`
    : '';

  // Profit badge from real comps
  let profitBadge = '';
  if (comps?.avgSoldPrice && listingPrice) {
    const margin    = Math.round(((comps.avgSoldPrice - listingPrice) / listingPrice) * 100);
    const color     = margin >= 20 ? '#3ecf8e' : margin >= 5 ? '#f5a623' : '#f04444';
    const label     = margin >= 0 ? `+${margin}% est. margin` : `${margin}% (overpriced)`;
    profitBadge = `<div style="font-size:11px;font-weight:600;color:${color};margin-top:4px">
      avg sold $${comps.avgSoldPrice} · ${label}
    </div>`;
  } else if (comps === null && hasListing) {
    profitBadge = `<div style="font-size:10px;color:var(--text-muted);margin-top:4px">fetching comps…</div>`;
  }

  return `
    <div class="diag-card" onclick="window.diagPick('${side}')">
      <div style="position:relative;height:140px;background:${gradient};border-radius:var(--radius-md) var(--radius-md) 0 0;overflow:hidden">
        ${imageHtml}
        ${listingPrice ? `<div style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,0.6);color:#fff;font-size:13px;font-weight:600;padding:3px 8px;border-radius:4px;font-family:var(--mono)">$${listingPrice.toFixed(2)}</div>` : ''}
      </div>
      <div style="padding:14px 16px 16px">
        <div style="font-size:13px;font-weight:500;color:var(--text-primary);margin-bottom:4px;line-height:1.4">${escHtml(displayTitle)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;line-height:1.5">${escHtml(roundDef.description || '')}</div>
        ${profitBadge}
        <button class="btn-primary" style="width:100%;margin-top:12px" onclick="event.stopPropagation();window.diagPick('${side}')">Pick this</button>
      </div>
    </div>
  `;
}

// ─── Final profile ─────────────────────────────────────────────────────────────
function renderProfile(sess) {
  const rec = sess.conclusion;
  const searches = rec?.recommendedSearches || [];

  return `
    <div class="page-title">Profile complete</div>
    <div class="page-subtitle">${sess.picks.length} rounds · Claude reached a firm conclusion</div>

    <div class="card-section" style="max-width:600px">
      <div class="section-title" style="margin-bottom:12px">Your sourcing profile</div>
      <div class="diag-profile-text">${escHtml(rec?.profile || '')}</div>
    </div>

    ${searches.length ? `
      <div class="card-section" style="max-width:600px">
        <div class="section-title" style="margin-bottom:4px">Recommended searches</div>
        <div class="section-subtitle" style="margin-bottom:14px">Click any to search eBay now</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${searches.map(s => `
            <div class="diag-search-rec" onclick="window.diagRunSearch(${JSON.stringify(s.query).replace(/'/g, '&#39;')})">
              <div>
                <div style="font-size:13px;font-weight:500;color:var(--text-primary)">${escHtml(s.label)}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${escHtml(s.reason || '')}</div>
              </div>
              <span class="badge badge-blue" style="flex-shrink:0">${escHtml(s.category || 'search')}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    ${renderWeightsSummary()}

    <div style="display:flex;gap:10px;max-width:600px;margin-top:8px">
      <button class="btn-primary" onclick="window.diagApplyPrefs()">Save profile &amp; apply</button>
      <button class="btn-secondary" onclick="window.startDiagnostic()">Run again</button>
      <button class="btn-ghost" onclick="window.diagDiscard()">Discard</button>
    </div>
  `;
}

function renderWeightsSummary() {
  const weights = state.mlFeatureWeights || DEFAULT_WEIGHTS;
  const top = Object.keys(FEATURE_LABELS)
    .map(k => ({ k, w: weights[k] ?? DEFAULT_WEIGHTS[k] ?? 0 }))
    .sort((a, b) => b.w - a.w)
    .slice(0, 6);

  return `
    <div class="card-section" style="max-width:580px">
      <div class="section-title" style="margin-bottom:12px">Learned feature weights</div>
      <div style="display:flex;flex-direction:column;gap:5px">
        ${top.map(({ k, w }) => {
          const pct = Math.min(100, Math.round((w / 0.4) * 100));
          return `
            <div style="display:flex;align-items:center;gap:10px;font-size:13px">
              <span style="color:var(--text-muted);width:120px;flex-shrink:0">${FEATURE_LABELS[k]}</span>
              <div style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden">
                <div style="height:4px;width:${pct}%;background:var(--accent);border-radius:2px"></div>
              </div>
              <span style="color:var(--text-secondary);font-family:var(--mono);font-size:11px;width:32px;text-align:right">${w.toFixed(2)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ─── Actions ──────────────────────────────────────────────────────────────────
export async function startDiagnostic() {
  state.diagnosticSession = {
    phase: 'loading-claude',
    picks: [],
    currentRound: null,
    listings: { A: null, B: null },
    conclusion: null,
    done: false,
    weightsSnapshot: state.mlFeatureWeights ? { ...state.mlFeatureWeights } : null,
  };
  window.renderApp();
  await loadNextRound();
}

async function loadNextRound() {
  const sess = state.diagnosticSession;
  if (!sess) return;

  sess.phase = 'loading-claude';
  window.renderApp();

  try {
    const resp = await fetch('/api/diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        picks:    sess.picks,
        deals:    state.deals,
        segments: state.segments || [],
        round:    sess.picks.length,
      }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (data.confident) {
      // Claude has reached a conclusion
      sess.phase      = 'done';
      sess.done       = true;
      sess.conclusion = data;
      window.renderApp();
      return;
    }

    // Load eBay listings for A and B
    sess.currentRound = data;
    sess.phase        = 'loading-listings';
    window.renderApp();

    const [listingA, listingB] = await Promise.all([
      searchEbayQuick(data.A.query),
      searchEbayQuick(data.B.query),
    ]);

    sess.listings  = { A: listingA, B: listingB };

    // Fetch real eBay sold prices for both card options (non-blocking display enrichment)
    sess.soldPrices = { A: null, B: null };
    window.renderApp(); // show cards immediately while comps load

    const [compsA, compsB] = await Promise.all([
      fetchSoldPrices(data.A.query),
      fetchSoldPrices(data.B.query),
    ]);
    sess.soldPrices = { A: compsA, B: compsB };
    sess.phase      = 'active';
    window.renderApp();

  } catch (e) {
    console.error('[diagnostic]', e);
    // On error, show an error state but keep session recoverable
    sess.phase = 'active';
    if (!sess.currentRound) {
      // Fallback round if Claude fails on first load
      sess.currentRound = {
        label: 'Card finish',
        question: 'Which card would you rather source?',
        analysis: '',
        A: { query: 'LeBron James 2020 Prizm Silver PSA 9', hint: 'LeBron · Prizm Silver · PSA 9', description: 'Silver holo — the most liquid finish in the hobby.' },
        B: { query: 'LeBron James 2020 Prizm Gold /10 PSA 9', hint: 'LeBron · Prizm Gold /10 · PSA 9', description: 'Gold numbered /10 — scarce, premium collector appeal.' },
      };
      sess.listings = { A: null, B: null };
    }
    window.renderApp();
  }
}

export async function diagPick(side) {
  const sess = state.diagnosticSession;
  if (!sess || sess.done || sess.phase !== 'active') return;

  const round  = sess.currentRound;
  const loser  = side === 'A' ? 'B' : 'A';
  const winnerListing = sess.listings?.[side]  || null;
  const loserListing  = sess.listings?.[loser] || null;

  const winnerFeatures = extractFeatures(winnerListing || round[side].query);
  const loserFeatures  = extractFeatures(loserListing  || round[loser].query);

  const currentWeights = state.mlFeatureWeights || { ...DEFAULT_WEIGHTS };
  state.mlFeatureWeights = pairwiseUpdate(currentWeights, winnerFeatures, loserFeatures);

  sess.picks.push({
    label:        round.label,
    side,
    chosenHint:   round[side].hint,
    rejectedHint: round[loser].hint,
    skipped:      false,
  });

  await loadNextRound();
}

export async function diagSkip() {
  const sess = state.diagnosticSession;
  if (!sess || sess.done || sess.phase !== 'active') return;

  sess.picks.push({
    label:        sess.currentRound?.label || 'unknown',
    side:         null,
    chosenHint:   '',
    rejectedHint: '',
    skipped:      true,
  });

  await loadNextRound();
}

export function diagApplyPrefs() {
  const sess = state.diagnosticSession;
  if (sess?.conclusion?.profile) {
    state.diagnosticProfile = sess.conclusion.profile;
    // Save recommended searches to state for the search tab
    if (sess.conclusion.recommendedSearches?.length) {
      state.suggestedSearches = sess.conclusion.recommendedSearches;
    }
  }
  persistSettings();
  state.diagnosticSession = null;
  state.notify = { type: 'ok', msg: 'Profile saved — preferences applied to all future searches.' };
  window.setTab('search');
}

export function diagDiscard() {
  const sess = state.diagnosticSession;
  state.mlFeatureWeights = sess ? sess.weightsSnapshot : null;
  state.diagnosticSession = null;
  window.renderApp();
}

// Called when user clicks a recommended search from the profile results page
export function diagRunSearch(query) {
  diagApplyPrefs();
  setTimeout(() => {
    const input = document.getElementById('q-input');
    if (input) { input.value = query; }
    state.query = query;
    window.doSearch();
  }, 100);
}

// Keep for backward compat
export function diagApply(newRoi, newSpeed) {
  state.mlWeights = { roi: newRoi, speed: newSpeed };
  persistSettings();
  state.diagnosticSession = null;
  window.setTab('search');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
