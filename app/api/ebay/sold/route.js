import { NextResponse } from 'next/server';

// Median of a sorted or unsorted array
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function gradeKey(title) {
  const t = String(title || '').toUpperCase();
  if (t.includes('PSA 10'))  return 'psa10';
  if (t.includes('BGS 9.5')) return 'bgs9.5';
  if (t.includes('PSA 9'))   return 'psa9';
  if (t.includes('PSA 8'))   return 'psa8';
  if (t.includes('BGS 9'))   return 'bgs9';
  if (t.includes('SGC 9'))   return 'sgc9';
  if (t.includes('SGC 10'))  return 'sgc10';
  return 'raw';
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q     = (searchParams.get('q') || '').trim();
  const appId = req.headers.get('x-ebay-key') || process.env.EBAY_APP_ID;

  if (!appId || !q) {
    return NextResponse.json({ byGrade: {}, median: null, count: 0 });
  }

  // eBay Finding API — findCompletedItems (sold only), JSON format
  const url = new URL('https://svcs.ebay.com/services/search/FindingService/v1');
  url.searchParams.set('OPERATION-NAME',        'findCompletedItems');
  url.searchParams.set('SERVICE-VERSION',        '1.0.0');
  url.searchParams.set('SECURITY-APPNAME',       appId);
  url.searchParams.set('RESPONSE-DATA-FORMAT',   'JSON');
  url.searchParams.set('keywords',               q);
  url.searchParams.set('categoryId',             '212');  // Sports Trading Cards
  url.searchParams.set('itemFilter(0).name',     'SoldItemsOnly');
  url.searchParams.set('itemFilter(0).value',    'true');
  url.searchParams.set('sortOrder',              'EndTimeSoonest');
  url.searchParams.set('paginationInput.entriesPerPage', '50');

  let resp;
  try {
    resp = await fetch(url.toString(), { cache: 'no-store' });
  } catch (e) {
    return NextResponse.json({ byGrade: {}, median: null, count: 0, error: e.message });
  }

  if (!resp.ok) {
    return NextResponse.json({ byGrade: {}, median: null, count: 0 });
  }

  let data;
  try { data = await resp.json(); } catch {
    return NextResponse.json({ byGrade: {}, median: null, count: 0 });
  }

  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

  // Bucket sold prices by grade tier
  const buckets = {};
  const allPrices = [];

  for (const item of items) {
    const title = item.title?.[0] || '';
    const priceRaw = item.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'];
    const price = parseFloat(priceRaw);
    if (!price || price <= 0) continue;

    allPrices.push(price);
    const gk = gradeKey(title);
    if (!buckets[gk]) buckets[gk] = [];
    buckets[gk].push(price);
  }

  // Compute medians per grade
  const byGrade = {};
  for (const [gk, prices] of Object.entries(buckets)) {
    byGrade[gk] = median(prices);
  }

  return NextResponse.json({
    byGrade,
    median:      median(allPrices),
    count:       allPrices.length,
  });
}
