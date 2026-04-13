import { NextResponse } from 'next/server';

// Exponential decay: 7-day half-life
// weight = e^(-λ · daysAgo), where λ = ln(2) / 7 ≈ 0.099
// Sales from 7 days ago → 0.5× weight
// Sales from 14 days ago → 0.25× weight
// Sales from 30 days ago → 0.05× weight
const LAMBDA = Math.LN2 / 7;

function decayWeight(daysAgo) {
  return Math.exp(-LAMBDA * Math.max(0, daysAgo));
}

// Time-weighted mean: Σ(weight_i · price_i) / Σ(weight_i)
// Falls back to simple mean if total weight is negligible (very stale data).
function weightedMean(entries) {
  if (!entries.length) return null;
  const totalW = entries.reduce((s, e) => s + e.w, 0);
  if (totalW < 0.05) {
    // All data is very old — fall back to simple mean to avoid returning null
    const sum = entries.reduce((s, e) => s + e.price, 0);
    return sum / entries.length;
  }
  return entries.reduce((s, e) => s + e.price * e.w, 0) / totalW;
}

function gradeKey(title) {
  const t = String(title || '').toUpperCase();
  if (t.includes('PSA 10'))  return 'psa10';
  if (t.includes('BGS 9.5')) return 'bgs9.5';
  if (t.includes('PSA 9'))   return 'psa9';
  if (t.includes('PSA 8'))   return 'psa8';
  if (t.includes('BGS 9'))   return 'bgs9';
  if (t.includes('SGC 10'))  return 'sgc10';
  if (t.includes('SGC 9'))   return 'sgc9';
  return 'raw';
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q     = (searchParams.get('q') || '').trim();
  const appId = req.headers.get('x-ebay-key') || process.env.EBAY_APP_ID;

  if (!appId || !q) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0 });
  }

  const url = new URL('https://svcs.ebay.com/services/search/FindingService/v1');
  url.searchParams.set('OPERATION-NAME',        'findCompletedItems');
  url.searchParams.set('SERVICE-VERSION',        '1.0.0');
  url.searchParams.set('SECURITY-APPNAME',       appId);
  url.searchParams.set('RESPONSE-DATA-FORMAT',   'JSON');
  url.searchParams.set('keywords',               q);
  url.searchParams.set('categoryId',             '212');
  url.searchParams.set('itemFilter(0).name',     'SoldItemsOnly');
  url.searchParams.set('itemFilter(0).value',    'true');
  url.searchParams.set('sortOrder',              'EndTimeSoonest');
  url.searchParams.set('paginationInput.entriesPerPage', '50');

  let resp;
  try {
    resp = await fetch(url.toString(), { cache: 'no-store' });
  } catch (e) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: e.message });
  }

  if (!resp.ok) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0 });
  }

  let data;
  try { data = await resp.json(); } catch {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0 });
  }

  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
  const now   = Date.now();

  // Per-grade buckets: [{ price, w, daysAgo }]
  const buckets    = {};
  const allEntries = [];

  // For trend: split into recent (≤7d) and older (8–30d)
  const recentPrices = [];
  const olderPrices  = [];

  for (const item of items) {
    const title    = item.title?.[0] || '';
    const priceRaw = item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'];
    const price    = parseFloat(priceRaw);
    if (!price || price <= 0) continue;

    // Parse sale timestamp
    const endTimeStr = item.listingInfo?.[0]?.endTime?.[0] || '';
    const endMs      = endTimeStr ? new Date(endTimeStr).getTime() : now;
    const daysAgo    = (now - endMs) / 86_400_000;

    const w  = decayWeight(daysAgo);
    const gk = gradeKey(title);

    if (!buckets[gk]) buckets[gk] = [];
    buckets[gk].push({ price, w, daysAgo });
    allEntries.push({ price, w, daysAgo });

    if (daysAgo <= 7)              recentPrices.push(price);
    else if (daysAgo <= 30)        olderPrices.push(price);
  }

  // Time-weighted mean per grade bucket
  const byGrade = {};
  for (const [gk, entries] of Object.entries(buckets)) {
    const wm = weightedMean(entries);
    if (wm != null) byGrade[gk] = Math.round(wm * 100) / 100;
  }

  // Overall time-weighted market price
  const overallWM = weightedMean(allEntries);

  // Trend: compare recent ≤7d simple mean vs older 8–30d simple mean
  // positive = prices rising, negative = prices falling
  let trend    = null;
  let trendDir = 'stable';
  if (recentPrices.length >= 2 && olderPrices.length >= 2) {
    const recentMean = recentPrices.reduce((s, p) => s + p, 0) / recentPrices.length;
    const olderMean  = olderPrices.reduce((s, p) => s + p, 0)  / olderPrices.length;
    trend    = Math.round((recentMean - olderMean) / olderMean * 100);
    trendDir = trend > 5 ? 'up' : trend < -5 ? 'down' : 'stable';
  }

  return NextResponse.json({
    byGrade,
    weightedMean: overallWM != null ? Math.round(overallWM * 100) / 100 : null,
    count:        allEntries.length,
    trend,
    trendDir,
  });
}
