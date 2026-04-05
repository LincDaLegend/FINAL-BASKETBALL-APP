// Semantic embedding engine — TF-IDF over your deal history vocabulary.
// Pure JS, no model download, no API key. Runs synchronously in the browser.
//
// How it works:
//   1. buildEmbeddingModel(deals) — learns vocabulary + IDF weights from your deals,
//      computes a "winning centroid" (average TF-IDF vector of top-25% deals by ROI)
//   2. listingEmbScore(title, embModel) — scores any listing against the centroid
//      using cosine similarity. High score = semantically close to your past winners.
//
// This replaces keyword-boolean matching with continuous semantic proximity,
// so cards you've never explicitly named can still score high if they resemble
// patterns in your profitable deals.

// ─── Tokenise ─────────────────────────────────────────────────────────────────
function tokenize(text) {
  return (text || '')
    .toUpperCase()
    .replace(/[^\w/]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

// ─── IDF ──────────────────────────────────────────────────────────────────────
// Smooth IDF: log((N+1)/(df+1))+1 — standard sklearn default
function buildIDF(texts) {
  const N  = Math.max(texts.length, 1);
  const df = {};
  for (const text of texts) {
    for (const term of new Set(tokenize(text))) {
      df[term] = (df[term] || 0) + 1;
    }
  }
  const idf = {};
  for (const [term, count] of Object.entries(df)) {
    idf[term] = Math.log((N + 1) / (count + 1)) + 1;
  }
  return idf;
}

// ─── TF-IDF vector (sparse) ───────────────────────────────────────────────────
function tfidfVec(text, idf) {
  const terms = tokenize(text);
  if (!terms.length) return {};
  const tf = {};
  for (const t of terms) tf[t] = (tf[t] || 0) + 1 / terms.length;
  const vec = {};
  for (const [t, w] of Object.entries(tf)) {
    if (idf[t]) vec[t] = w * idf[t];
  }
  return vec;
}

// ─── Cosine similarity (sparse) ───────────────────────────────────────────────
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of Object.entries(a)) { dot += v * (b[k] || 0); na += v * v; }
  for (const v of Object.values(b))       { nb += v * v; }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

// ─── Average sparse vectors ───────────────────────────────────────────────────
function avgVecs(vecs) {
  const valid = vecs.filter(v => v && Object.keys(v).length);
  if (!valid.length) return {};
  const out = {};
  for (const v of valid) {
    for (const [k, x] of Object.entries(v)) out[k] = (out[k] || 0) + x / valid.length;
  }
  return out;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the embedding model from deal history.
 * Call this on startup, after enrichment, and whenever deals change significantly.
 *
 * Returns { idf, topVec, bottomVec } or null if no deals.
 *   idf       — IDF weights learned from all deal titles
 *   topVec    — centroid of top-25% deals (semantic "target")
 *   bottomVec — centroid of bottom-25% deals (semantic "avoid")
 */
export function buildEmbeddingModel(deals) {
  if (!deals?.length) return null;

  const texts = deals.map(d =>
    [d.player, d.set, d.variant, d.grade, d.year, d.notes].filter(Boolean).join(' ')
  );
  const idf = buildIDF(texts);

  // Store TF-IDF vectors on deal objects (in-memory only, not persisted)
  deals.forEach((d, i) => { d._tfidfVec = tfidfVec(texts[i], idf); });

  const sorted = [...deals].sort((a, b) => (b.roi || 0) - (a.roi || 0));
  const cutTop = Math.max(1, Math.ceil(deals.length * 0.25));
  const cutBot = Math.max(1, Math.ceil(deals.length * 0.25));

  const topVec    = avgVecs(sorted.slice(0, cutTop).map(d => d._tfidfVec));
  const bottomVec = avgVecs(sorted.slice(-cutBot).map(d => d._tfidfVec));

  return { idf, topVec, bottomVec };
}

/**
 * Score how semantically similar a listing title is to your top deals.
 * Returns 0–1, or null if the model isn't built yet.
 *
 * Scoring: cosine(listing, topVec) − 0.4 × cosine(listing, bottomVec)
 * Cards that look like winners and UNLIKE losers score highest.
 */
export function listingEmbScore(listingTitle, embModel) {
  if (!embModel || !listingTitle) return null;
  const { idf, topVec, bottomVec } = embModel;
  if (!Object.keys(topVec).length) return null;

  const vec       = tfidfVec(listingTitle, idf);
  if (!Object.keys(vec).length) return null;

  const simTop = cosine(vec, topVec);
  const simBot = bottomVec && Object.keys(bottomVec).length ? cosine(vec, bottomVec) : 0;

  // Net similarity — reward closeness to winners, penalise closeness to losers
  const net = simTop - 0.4 * simBot;

  // Cosine for short card titles is typically 0–0.5; scale to 0–1
  return Math.min(1, Math.max(0, net * 2.5));
}
