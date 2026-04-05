import { EBAY_FINDING_API, PHP_RATE, DEFAULT_SET_RARITY_TIERS } from './constants.js';
import { state } from './state.js';
import { extractFeatures, mlScore, DEFAULT_WEIGHTS } from './ml.js';
// predictScore loaded dynamically to avoid bundling TF.js into the critical path
let _predictScore = null;
if (typeof window !== 'undefined') {
  import('./tfModel.js').then(m => { _predictScore = m.predictScore; }).catch(() => {});
}
import { listingEmbScore } from './embedding.js';

// ── Set / card rarity scoring ─────────────────────────────────────────────────
// Returns a 0–1 continuous score representing how scarce this card is to source.
// Operates entirely on the listing title — no external calls needed.
//
// Tier guide:
//   ~0.92  Ultra-premium set (NT, Flawless, Eminence, One and One) — base cards sell
//   ~0.78  High-end set (Obsidian, Immaculate, Spectra, Impeccable, Noir)
//   ~0.88  Case hit insert from any set (Dreamcatcher, Kaboom, Logoman…)
//   ~0.95  Any 1/1 — case hit or otherwise
//   ~0.55  Mid-tier set (Select, Crown Royale, Contenders Optic…)
//   ~0.28  Mass-produced parallel (Prizm Silver, Optic Holo, Donruss Holo…)
//   ~0.12  Mass-produced base card (plain Prizm, Optic, Donruss, Hoops base)
//   ~0.45  Unknown / unrecognised set — cautious neutral

export function computeSetRarity(title) {
  if (!title) return 0.45;
  const t  = title.toUpperCase();
  const st = state.setRarityTiers || DEFAULT_SET_RARITY_TIERS;
  const hit = (list) => (list || []).some(s => s && t.includes(s.toUpperCase()));

  // ── Step 1: base tier from set name ───────────────────────────────────────────
  // Case hits set base = 0.88 but do NOT return early — print-run boosts still apply.
  // e.g. a Kaboom 1/1 or Logoman 1/1 scores 0.95, not 0.88.
  let base;
  if      (hit(st.caseHits))  base = 0.88;
  else if (hit(st.premium))   base = 0.92;
  else if (hit(st.highEnd))   base = 0.78;
  else if (hit(st.midTier))   base = 0.55;
  else if (hit(st.massBase))  base = hit(st.parallels) ? 0.28 : 0.12;
  else                        base = 0.45;

  // ── Step 2: print-run boost — applied on top of every set tier ────────────
  // A Prizm /5 (5 copies worldwide) should outscore an Obsidian /75 (75 copies).
  // Math.max ensures higher base tiers are never downgraded by this check.
  const isOneOfOne = /\b1\/1\b/.test(title) || t.includes('1 OF 1') || t.includes('ONE OF ONE');
  const isUltraLow = !isOneOfOne && /\/[2-5]\b/.test(title);           // /2 – /5
  const isVeryLow  = !isUltraLow && /\/(6|7|8|9|10)\b/.test(title);   // /6 – /10
  const isLowPrint = !isVeryLow  && /\/(1[1-9]|2[0-5])\b/.test(title);// /11 – /25
  const isNumbered = !isLowPrint && /\/\d+/.test(title);               // /26+

  if (isOneOfOne)  return Math.max(base, 0.95);  // 1/1
  if (isUltraLow)  return Math.max(base, 0.88);  // /2–/5
  if (isVeryLow)   return Math.max(base, 0.80);  // /6–/10
  if (isLowPrint)  return Math.max(base, 0.70);  // /11–/25
  if (isNumbered)  return Math.max(base, 0.58);  // /26+

  return base;
}

export function extractGrade(title) {
  const t = title.toUpperCase();
  if (t.includes('PSA 10')) return 'PSA 10';
  if (t.includes('PSA 9'))  return 'PSA 9';
  if (t.includes('PSA 8'))  return 'PSA 8';
  if (t.includes('PSA 7'))  return 'PSA 7';
  if (t.includes('BGS 9.5')) return 'BGS 9.5';
  if (t.includes('BGS 9'))  return 'BGS 9';
  if (t.includes('SGC 9'))  return 'SGC 9';
  if (t.includes('SGC 8'))  return 'SGC 8';
  return 'raw';
}

export function estimateAesthetic(title, condition) {
  const t = title.toUpperCase();
  let score = 5;
  if (t.includes('PRIZM'))       score += 1.5;
  if (t.includes('CHROME'))      score += 1.2;
  if (t.includes('OPTIC'))       score += 1.0;
  if (t.includes('GOLD'))        score += 1.2;
  if (t.includes('SILVER'))      score += 0.8;
  if (t.includes('HOLO'))        score += 0.8;
  if (t.includes('REFRACTOR'))   score += 1.0;
  if (t.includes('MOSAIC'))      score += 0.5;
  if (t.includes('CRACKED ICE')) score += 0.8;
  if (t.includes('HYPER'))       score += 1.0;
  if (t.includes('RC') || t.includes('ROOKIE')) score += 0.5;
  if (condition === 'Brand New' || condition === 'Like New') score += 0.5;
  return Math.min(10, Math.round(score * 10) / 10);
}

// Detect which player-demand tier a listing belongs to by matching title against
// the user's player category lists.  Returns 'strong'|'middle'|'volatile'|'ph-specific'|null.
export function getPlayerCategory(title, playerCategories) {
  if (!playerCategories || !title) return null;
  const t = title.toUpperCase();
  for (const [cat, players] of Object.entries(playerCategories)) {
    for (const p of players) {
      if (p && t.includes(p.toUpperCase())) return cat;
    }
  }
  return null;
}

export function ruleMLScore(listing, _category, rules, deals, featureWeights) {
  const price = listing.price || 0;

  // Auto-detect player demand tier from listing title
  const detectedCat = getPlayerCategory(listing.title, state.playerCategories);
  const rule = rules[detectedCat] || null;

  // Build estimated ROI using personal deal history for this player tier
  const catDeals = detectedCat ? deals.filter(d => d.category === detectedCat) : [];
  const personalMultiplier = catDeals.length >= 2
    ? 1 + Math.min(1.5, Math.max(0, catDeals.reduce((a, d) => a + (d.roi || 0), 0) / catDeals.length / 100))
    : 1.20;
  const avgSold = (listing.avgSold && listing.avgSold !== price * 1.35)
    ? listing.avgSold
    : price * personalMultiplier;
  // Guard against price=0 (eBay sometimes omits price for auctions with no bids)
  const roi = price > 0 ? ((avgSold - price) / price) * 100 : 20;

  const roiScore = rule
    ? (roi >= rule.minROI ? 1 : Math.max(0, roi / Math.max(1, rule.minROI)))
    : 0.5;

  // ── Set rarity — computed early, used for both isPremiumSet and final blend ──
  const rarityScore = computeSetRarity(listing.title);

  // ── Player-category suitability ─────────────────────────────────────────────
  // Determines how "appropriate" this card type is for the detected player tier.
  const features    = extractFeatures(listing);
  const hasPremium  = features.auto   || features.patch  || features.logoman || features.rpa;
  const hasTopGrade = features.psa10  || features.bgs10;
  const hasMidGrade = features.psa9   || features.psa8;
  const isRare      = features.sp     || features.ssp    || features.oneOfOne;
  // High-end+ sets (Obsidian, Immaculate, Spectra, NT, Flawless, case hits, etc.) elevate
  // even plain base cards — a volatile player's Immaculate base still moves.
  const isPremiumSet = rarityScore >= 0.78;
  const isValuable  = hasPremium || hasTopGrade || hasMidGrade || isRare || isPremiumSet;

  let suitability;
  switch (detectedCat) {
    case 'strong':
      // All card types have local demand; premium gets a small extra boost
      suitability = isValuable ? 1.0 : 0.82;
      break;
    case 'middle':
      // Plain low end doesn't move — needs a hook to fetch decent prices
      suitability = isValuable ? 1.0 : 0.38;
      break;
    case 'volatile':
      // Very low PH demand — only autos/GU/top grades can move
      suitability = isValuable ? 0.78 : 0.12;
      break;
    case 'ph-specific': {
      // Filipino blood — mid autos/GUs are gold; low end is a trap
      // Exception: Dylan Harper rookies still get some local hype
      const isDylanHarper = listing.title.toUpperCase().includes('DYLAN HARPER');
      if (hasPremium) {
        suitability = 1.05;
      } else if (isDylanHarper && features.rookie) {
        suitability = 0.72;
      } else {
        suitability = 0.35;
      }
      break;
    }
    default:
      // Unknown player — cautious neutral; let other signals decide
      suitability = 0.62;
  }

  // Deal-history boost: reward listings whose ROI exceeds your average in this tier
  let mlBoost = 0;
  if (catDeals.length > 0) {
    const avgDealROI = catDeals.reduce((a, d) => a + (d.roi || 0), 0) / catDeals.length;
    mlBoost = Math.min(0.18, (roi / Math.max(1, avgDealROI)) * 0.16);
  }

  // Aesthetic bonus
  const aestheticBoost = Math.min(0.08, Math.max(-0.05, ((listing.aestheticScore || 5) - 5) / 50));

  // Blend suitability + roiScore weighted by the ROI/speed slider
  const roiW   = state.mlWeights?.roi   ?? 0.6;
  const ruleRaw = suitability * 0.42
                + roiScore   * (0.50 * roiW / 0.6)
                + mlBoost
                + aestheticBoost;

  // Pairwise-learned feature weights — per-player aware
  // (features already computed above for suitability; reuse the same object)
  const weights       = featureWeights || DEFAULT_WEIGHTS;
  const listingPlayer = (listing.title || '').split(/\s+/).slice(0, 3).join(' ');
  const featureScore  = mlScore(features, weights, listingPlayer) / 100; // 0–1

  // Neural network score (TF.js) — used when model has been trained on ≥3 deals
  const tfScore = (state.tfModelReady && state.tfModel && _predictScore)
    ? _predictScore(state.tfModel, listing, 500) / 100
    : null;

  // Semantic embedding score — how similar is this listing to your past winners?
  const embRaw  = listingEmbScore(listing.title, state.embModel); // 0–1 or null
  const embScore = embRaw !== null ? embRaw : null;

  let blended;
  if (tfScore !== null && embScore !== null) {
    // All 5 signals: 30% rule + 25% neural + 18% pairwise + 12% embedding + 15% rarity
    blended = ruleRaw * 0.30 + tfScore * 0.25 + featureScore * 0.18 + embScore * 0.12 + rarityScore * 0.15;
  } else if (tfScore !== null) {
    // No embedding: 33% rule + 27% neural + 22% pairwise + 18% rarity
    blended = ruleRaw * 0.33 + tfScore * 0.27 + featureScore * 0.22 + rarityScore * 0.18;
  } else if (embScore !== null) {
    // TF not ready: 40% rule + 25% pairwise + 18% embedding + 17% rarity
    blended = ruleRaw * 0.40 + featureScore * 0.25 + embScore * 0.18 + rarityScore * 0.17;
  } else {
    // Fallback: 45% rule + 33% pairwise + 22% rarity
    blended = ruleRaw * 0.45 + featureScore * 0.33 + rarityScore * 0.22;
  }

  return Math.min(100, Math.round(blended * 100));
}

export function scoreVerdict(score) {
  if (score >= 70) return { label: 'buy now',  cls: 'badge-buy' };
  if (score >= 45) return { label: 'consider', cls: 'badge-consider' };
  return              { label: 'skip',      cls: 'badge-skip' };
}

export function toPhp(usd, rate = PHP_RATE) {
  return '₱' + (usd * rate).toLocaleString('en-PH', { maximumFractionDigits: 0 });
}

// Note: In Next.js/Vercel we proxy eBay requests via /api/ebay/search.
// This keeps eBay calls off the browser and avoids CORS issues.
export async function searchEbay(query, category, listingType = 'all', itemLocation = 'us') {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);
  if (listingType && listingType !== 'all') params.set('listingType', listingType);
  if (itemLocation && itemLocation !== 'all') params.set('itemLocation', itemLocation);

  const headers = {};
  if (state.ebayKey)    headers['x-ebay-key']    = state.ebayKey;
  if (state.ebaySecret) headers['x-ebay-secret']  = state.ebaySecret;

  const resp = await fetch(`/api/ebay/search?${params.toString()}`, { headers });
  if (!resp.ok) {
    let message = `eBay proxy error: ${resp.status}`;
    try {
      const data = await resp.json();
      if (data?.error) message = data.error;
    } catch {}
    throw new Error(message);
  }

  const data = await resp.json();
  return Array.isArray(data?.items) ? data.items : [];
}

// Fetch a single top listing — used by diagnostic to pull real cards
export async function searchEbayQuick(query) {
  const params = new URLSearchParams({ q: query, max: '3' });
  const headers = {};
  if (state.ebayKey)    headers['x-ebay-key']    = state.ebayKey;
  if (state.ebaySecret) headers['x-ebay-secret']  = state.ebaySecret;
  try {
    const resp = await fetch(`/api/ebay/search?${params.toString()}`, { headers });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data?.items || [])[0] || null;
  } catch {
    return null;
  }
}

// Keep exported constant for compatibility (not used in client now)
export { EBAY_FINDING_API };

