// Feature keys — every keyword that meaningfully predicts deal profitability.
// Sourced from live eBay listing analysis across all major Panini basketball product lines.
// Grouped by category for readability; order matters — FEATURE_DIM in tfModel.js depends on this length.

export const FEATURE_KEYS = [
  // ── Sets / Brands ──────────────────────────────────────────────────────────
  'prizm', 'optic', 'chrome', 'mosaic', 'select',
  'donruss', 'hoops', 'spectra', 'immaculate', 'nationalTreasures', 'contenders',

  // ── Premium / rare sets (even base cards have sell-through value) ───────────
  'obsidian', 'oneAndOne', 'flawless',

  // ── Named case hits (insert sets from within mass-produced products) ────────
  'dreamcatcher', 'nextDayAuto',

  // ── Parallel finishes ──────────────────────────────────────────────────────
  'silver', 'gold', 'refractor', 'holo', 'crackIce', 'hyper',
  'pulsar', 'tieDye', 'wave', 'shimmer', 'mojo', 'snakeskin',
  'stainedGlass', 'colorBlast', 'superfractor', 'goldVinyl', 'tigerStripe', 'zebra',

  // ── Card types ─────────────────────────────────────────────────────────────
  'auto', 'patch', 'logoman', 'rpa', 'booklet', 'sp', 'ssp',

  // ── Grades ─────────────────────────────────────────────────────────────────
  'graded', 'psa10', 'psa9', 'psa8', 'bgs9_5', 'bgs10', 'sgc', 'cgc',

  // ── Rarity / print run ─────────────────────────────────────────────────────
  'numbered', 'lowPrint', 'oneOfOne',

  // ── Card identity ──────────────────────────────────────────────────────────
  'rookie', 'vintage',
];
// Total: 54 features (49 original + 5 rarity: obsidian, oneAndOne, flawless, dreamcatcher, nextDayAuto)

export const FEATURE_LABELS = {
  // Sets
  prizm: 'Prizm', optic: 'Optic', chrome: 'Chrome', mosaic: 'Mosaic', select: 'Select',
  donruss: 'Donruss', hoops: 'Hoops', spectra: 'Spectra',
  immaculate: 'Immaculate', nationalTreasures: 'National Treasures', contenders: 'Contenders',
  obsidian: 'Obsidian', oneAndOne: 'One and One', flawless: 'Flawless',
  dreamcatcher: 'Dreamcatcher', nextDayAuto: 'Next Day Auto',
  // Finishes
  silver: 'Silver', gold: 'Gold', refractor: 'Refractor', holo: 'Holo',
  crackIce: 'Cracked Ice', hyper: 'Hyper',
  pulsar: 'Pulsar', tieDye: 'Tie Dye', wave: 'Wave', shimmer: 'Shimmer',
  mojo: 'Mojo', snakeskin: 'Snakeskin',
  stainedGlass: 'Stained Glass', colorBlast: 'Color Blast',
  superfractor: 'Superfractor', goldVinyl: 'Gold Vinyl',
  tigerStripe: 'Tiger Stripe', zebra: 'Zebra',
  // Card types
  auto: 'Autograph', patch: 'Patch', logoman: 'Logoman', rpa: 'RPA',
  booklet: 'Booklet', sp: 'Short Print', ssp: 'Super Short Print',
  // Grades
  graded: 'Graded', psa10: 'PSA 10', psa9: 'PSA 9', psa8: 'PSA 8',
  bgs9_5: 'BGS 9.5', bgs10: 'BGS 10', sgc: 'SGC', cgc: 'CGC',
  // Rarity
  numbered: 'Numbered', lowPrint: 'Low Print Run', oneOfOne: '1/1',
  // Identity
  rookie: 'Rookie', vintage: 'Vintage / Legend',
};

// Default weights — priors before any personal deal data.
// Higher weight = stronger signal that a card will be profitable.
// Premium/rare types (superfractor, logoman, 1/1, BGS 10) get high priors.
export const DEFAULT_WEIGHTS = {
  // Sets
  prizm: 0.15, optic: 0.10, chrome: 0.12, mosaic: 0.05, select: 0.06,
  donruss: 0.04, hoops: 0.03, spectra: 0.09, immaculate: 0.13,
  nationalTreasures: 0.16, contenders: 0.06,
  // Premium sets — high priors because even base cards from these sets have value
  obsidian: 0.25, oneAndOne: 0.30, flawless: 0.28,
  // Named case hits — rare inserts even from cheap base sets
  dreamcatcher: 0.22, nextDayAuto: 0.20,
  // Finishes
  silver: 0.10, gold: 0.12, refractor: 0.12, holo: 0.08, crackIce: 0.06, hyper: 0.06,
  pulsar: 0.07, tieDye: 0.11, wave: 0.05, shimmer: 0.06, mojo: 0.09, snakeskin: 0.06,
  stainedGlass: 0.13, colorBlast: 0.11, superfractor: 0.28, goldVinyl: 0.22,
  tigerStripe: 0.07, zebra: 0.07,
  // Card types
  auto: 0.26, patch: 0.16, logoman: 0.32, rpa: 0.27, booklet: 0.19, sp: 0.11, ssp: 0.16,
  // Grades
  graded: 0.20, psa10: 0.30, psa9: 0.20, psa8: 0.08,
  bgs9_5: 0.25, bgs10: 0.35, sgc: 0.12, cgc: 0.10,
  // Rarity
  numbered: 0.10, lowPrint: 0.15, oneOfOne: 0.38,
  // Identity
  rookie: 0.15, vintage: 0.05,
};

// ─── Feature extraction ───────────────────────────────────────────────────────
// Converts an eBay listing (or plain title string) into a binary feature object.
export function extractFeatures(input) {
  const title = typeof input === 'string' ? input : (input?.title || '');
  const grade = typeof input === 'object' ? (input?.grade || 'raw') : 'raw';
  const t = title.toUpperCase();
  const g = grade.toUpperCase();

  return {
    // ── Sets ────────────────────────────────────────────────────────────────
    prizm:            t.includes('PRIZM') ? 1 : 0,
    optic:            t.includes('OPTIC') ? 1 : 0,
    chrome:           t.includes('CHROME') ? 1 : 0,
    mosaic:           t.includes('MOSAIC') ? 1 : 0,
    select:           t.includes('SELECT') ? 1 : 0,
    donruss:          t.includes('DONRUSS') ? 1 : 0,
    hoops:            t.includes('HOOPS') ? 1 : 0,
    spectra:          t.includes('SPECTRA') ? 1 : 0,
    immaculate:       t.includes('IMMACULATE') ? 1 : 0,
    nationalTreasures:(t.includes('NATIONAL TREASURES') || t.includes('NAT TREASURES')) ? 1 : 0,
    contenders:       t.includes('CONTENDERS') ? 1 : 0,

    // ── Premium / rare sets ──────────────────────────────────────────────────
    obsidian:     t.includes('OBSIDIAN') ? 1 : 0,
    oneAndOne:    (t.includes('ONE AND ONE') || t.includes('ONE & ONE') || t.includes('ONE&ONE')) ? 1 : 0,
    flawless:     t.includes('FLAWLESS') ? 1 : 0,

    // ── Named case hits ──────────────────────────────────────────────────────
    dreamcatcher: (t.includes('DREAMCATCHER') || t.includes('DREAM CATCHER')) ? 1 : 0,
    nextDayAuto:  (t.includes('NEXT DAY AUTO') || t.includes('NEXT DAY AU')) ? 1 : 0,

    // ── Parallel finishes ────────────────────────────────────────────────────
    silver:           t.includes('SILVER') ? 1 : 0,
    gold:             (t.includes('GOLD') && !t.includes('GOLD VINYL')) ? 1 : 0,
    refractor:        t.includes('REFRACTOR') ? 1 : 0,
    holo:             (t.includes('HOLO') || t.includes('HOLOGRAPHIC')) ? 1 : 0,
    crackIce:         t.includes('CRACKED ICE') ? 1 : 0,
    hyper:            t.includes('HYPER') ? 1 : 0,
    pulsar:           t.includes('PULSAR') ? 1 : 0,
    tieDye:           (t.includes('TIE DYE') || t.includes('TIE-DYE') || t.includes('TIEDYE')) ? 1 : 0,
    wave:             t.includes('WAVE') ? 1 : 0,
    shimmer:          t.includes('SHIMMER') ? 1 : 0,
    mojo:             t.includes('MOJO') ? 1 : 0,
    snakeskin:        t.includes('SNAKESKIN') ? 1 : 0,
    stainedGlass:     t.includes('STAINED GLASS') ? 1 : 0,
    colorBlast:       t.includes('COLOR BLAST') ? 1 : 0,
    superfractor:     t.includes('SUPERFRACTOR') ? 1 : 0,
    goldVinyl:        t.includes('GOLD VINYL') ? 1 : 0,
    tigerStripe:      (t.includes('TIGER STRIPE') || t.includes('TIGER-STRIPE')) ? 1 : 0,
    zebra:            t.includes('ZEBRA') ? 1 : 0,

    // ── Card types ───────────────────────────────────────────────────────────
    auto:    (t.includes(' AUTO') || t.includes('AUTOGRAPH') || / AU[ /]/.test(t) || / AUTO$/.test(t)) ? 1 : 0,
    patch:   (t.includes('PATCH') || t.includes(' MEM ') || t.includes('MEMORABILIA') || t.includes('RELIC')) ? 1 : 0,
    logoman: t.includes('LOGOMAN') ? 1 : 0,
    rpa:     (t.includes(' RPA') || t.includes('RPA ') || t.includes('ROOKIE PATCH AUTO')) ? 1 : 0,
    booklet: t.includes('BOOKLET') ? 1 : 0,
    sp:      (/\bSP\b/.test(t) || t.includes('SHORT PRINT')) ? 1 : 0,
    ssp:     t.includes('SSP') ? 1 : 0,

    // ── Grades ───────────────────────────────────────────────────────────────
    graded: grade !== 'raw' ? 1 : 0,
    psa10:  g === 'PSA 10' ? 1 : 0,
    psa9:   g === 'PSA 9' ? 1 : 0,
    psa8:   g === 'PSA 8' ? 1 : 0,
    bgs9_5: g === 'BGS 9.5' ? 1 : 0,
    bgs10:  (g === 'BGS 10' || t.includes('BLACK LABEL')) ? 1 : 0,
    sgc:    g.startsWith('SGC') ? 1 : 0,
    cgc:    g.startsWith('CGC') ? 1 : 0,

    // ── Rarity ───────────────────────────────────────────────────────────────
    numbered: /\/\d+/.test(title) ? 1 : 0,
    lowPrint: /\/(10|25|49|50)\b/.test(title) ? 1 : 0,
    oneOfOne: (title.includes('1/1') || t.includes('1 OF 1') || t.includes('ONE OF ONE')) ? 1 : 0,

    // ── Identity ─────────────────────────────────────────────────────────────
    rookie:  (/ RC[ /]| RC$|ROOKIE/.test(t)) ? 1 : 0,
    vintage: /\b(199[0-9]|200[0-5])\b/.test(title) ? 1 : 0,
  };
}

function rawScore(features, weights) {
  let s = 0;
  for (const k of FEATURE_KEYS) s += (weights[k] ?? DEFAULT_WEIGHTS[k] ?? 0) * (features[k] ?? 0);
  return s;
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

// ─── Per-player weight resolution ─────────────────────────────────────────────
// weightsObj formats:
//   null/undefined        → use DEFAULT_WEIGHTS
//   legacy flat object    → treat as _global (auto-migrates on next learnFromDeal call)
//   { _global, players }  → new per-player format

function normalizePlayerKey(player) {
  return (player || '').toUpperCase().replace(/[^A-Z ]/g, '').trim();
}

function resolveWeights(weightsObj, player) {
  if (!weightsObj) return DEFAULT_WEIGHTS;
  if (weightsObj.prizm !== undefined) return weightsObj; // legacy flat format
  const key = normalizePlayerKey(player);
  return (key && weightsObj.players?.[key]) || weightsObj._global || DEFAULT_WEIGHTS;
}

// Score 0–100. player: used to look up per-player weights.
export function mlScore(features, weightsObj, player = '') {
  const weights = resolveWeights(weightsObj, player);
  return Math.min(100, Math.max(0, Math.round(sigmoid(rawScore(features, weights)) * 100)));
}

// ─── Pairwise update ──────────────────────────────────────────────────────────
export function pairwiseUpdate(weights, winnerFeatures, loserFeatures, lr = 0.15) {
  const sw   = rawScore(winnerFeatures, weights);
  const sl   = rawScore(loserFeatures,  weights);
  const grad = sigmoid(sl - sw);
  const updated = { ...weights };
  for (const k of FEATURE_KEYS) {
    const diff = (winnerFeatures[k] ?? 0) - (loserFeatures[k] ?? 0);
    updated[k] = (updated[k] ?? DEFAULT_WEIGHTS[k] ?? 0) + lr * grad * diff;
  }
  return updated;
}

// ─── Per-player deal learning ──────────────────────────────────────────────────
// Updates player-specific weights (lr=0.08) AND global weights (lr=0.025).
// Other players are untouched — buying a Jordan Clarkson auto doesn't raise
// the auto weight for Luka Doncic.
export function learnFromDeal(weightsObj, dealFeatures, player = '') {
  // Migrate legacy flat format
  let obj;
  if (!weightsObj || weightsObj.prizm !== undefined) {
    obj = { _global: weightsObj ? { ...weightsObj } : { ...DEFAULT_WEIGHTS }, players: {} };
  } else {
    obj = { _global: { ...(weightsObj._global || DEFAULT_WEIGHTS) }, players: { ...(weightsObj.players || {}) } };
  }

  const neutral = Object.fromEntries(FEATURE_KEYS.map(k => [k, 0]));

  // Weak global signal
  obj._global = pairwiseUpdate(obj._global, dealFeatures, neutral, 0.025);

  // Strong player-specific signal
  const key = normalizePlayerKey(player);
  if (key) {
    const existing = obj.players[key] ? { ...obj.players[key] } : { ...DEFAULT_WEIGHTS };
    obj.players[key] = pairwiseUpdate(existing, dealFeatures, neutral, 0.08);
  }

  return obj;
}

// Top N features contributing positively to this listing's score
export function topFeatures(features, weightsObj, n = 3, player = '') {
  const weights = resolveWeights(weightsObj, player);
  return FEATURE_KEYS
    .map(k => ({ k, score: (weights[k] ?? DEFAULT_WEIGHTS[k] ?? 0) * (features[k] ?? 0) }))
    .filter(x => x.score > 0 && (features[x.k] ?? 0) > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(x => FEATURE_LABELS[x.k] || x.k);
}
