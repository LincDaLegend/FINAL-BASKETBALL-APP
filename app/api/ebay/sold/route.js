import { NextResponse } from 'next/server';

const LAMBDA = Math.LN2 / 7; // 7-day half-life

function decayWeight(daysAgo) {
  return Math.exp(-LAMBDA * Math.max(0, daysAgo));
}

function robustWeightedMean(entries) {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => a.price - b.price);
  if (sorted.length === 1) return sorted[0].price;

  const q1  = sorted[Math.floor(sorted.length * 0.25)].price;
  const q3  = sorted[Math.floor(sorted.length * 0.75)].price;
  const iqr = q3 - q1;
  const lo  = q1 - 1.5 * iqr;
  const hi  = q3 + 1.5 * iqr;
  const clean = entries.filter(e => e.price >= lo && e.price <= hi);
  if (!clean.length) return sorted[Math.floor(sorted.length / 2)].price;

  const simpleMean = clean.reduce((s, e) => s + e.price, 0) / clean.length;
  let sumW = 0, sumWP = 0;
  for (const e of clean) {
    const w = decayWeight(e.daysAgo) * (1 / (1 + Math.abs(e.price - simpleMean)));
    sumW  += w;
    sumWP += w * e.price;
  }
  return sumWP / sumW;
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
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: !appId ? 'no appId' : 'no query' });
  }

  const url = new URL('https://svcs.ebay.com/services/search/FindingService/v1');
  url.searchParams.set('OPERATION-NAME',               'findCompletedItems');
  url.searchParams.set('SERVICE-VERSION',               '1.0.0');
  url.searchParams.set('SECURITY-APPNAME',              appId);
  url.searchParams.set('RESPONSE-DATA-FORMAT',          'JSON');
  url.searchParams.set('keywords',                      q);
  url.searchParams.set('sortOrder',                     'EndTimeSoonest');
  url.searchParams.set('paginationInput.entriesPerPage','50');

  let resp;
  try {
    resp = await fetch(url.toString(), { cache: 'no-store' });
  } catch (e) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: `fetch: ${e.message}` });
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: `eBay ${resp.status}: ${text.slice(0, 300)}` });
  }

  let data;
  try { data = await resp.json(); } catch (e) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: `JSON parse: ${e.message}` });
  }

  const ack = data?.findCompletedItemsResponse?.[0]?.ack?.[0];
  if (ack && ack !== 'Success' && ack !== 'Warning') {
    const errMsg = data?.findCompletedItemsResponse?.[0]?.errorMessage?.[0]?.error?.[0]?.message?.[0] || ack;
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: `eBay ack=${ack}: ${errMsg}` });
  }

  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
  const now   = Date.now();

  const buckets    = {};
  const allEntries = [];
  const recentPrices = [];
  const olderPrices  = [];

  for (const item of items) {
    const title   = item.title?.[0] || '';
    const price   = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__']);
    if (!price || price <= 0) continue;

    const endTimeStr = item.listingInfo?.[0]?.endTime?.[0] || '';
    const daysAgo    = endTimeStr ? (now - new Date(endTimeStr).getTime()) / 86_400_000 : 30;
    const gk         = gradeKey(title);

    if (!buckets[gk]) buckets[gk] = [];
    buckets[gk].push({ price, daysAgo });
    allEntries.push({ price, daysAgo });

    if (daysAgo <= 7)       recentPrices.push(price);
    else if (daysAgo <= 30) olderPrices.push(price);
  }

  const byGrade = {};
  for (const [gk, entries] of Object.entries(buckets)) {
    const wm = robustWeightedMean(entries);
    if (wm != null) byGrade[gk] = Math.round(wm * 100) / 100;
  }

  const overallWM = robustWeightedMean(allEntries);

  let trend = null, trendDir = 'stable';
  if (recentPrices.length >= 2 && olderPrices.length >= 2) {
    const recentMean = recentPrices.reduce((s, p) => s + p, 0) / recentPrices.length;
    const olderMean  = olderPrices.reduce((s, p)  => s + p, 0) / olderPrices.length;
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
