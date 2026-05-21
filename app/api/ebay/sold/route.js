import { NextResponse } from 'next/server';

const LAMBDA = Math.LN2 / 7;

function decayWeight(daysAgo) {
  return Math.exp(-LAMBDA * Math.max(0, daysAgo));
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

function weightedMean(entries) {
  if (!entries.length) return null;
  let sumW = 0, sumWP = 0;
  for (const e of entries) {
    const w = decayWeight(e.daysAgo);
    sumW  += w;
    sumWP += w * e.price;
  }
  return sumWP / sumW;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q      = (searchParams.get('q') || '').trim();
  const apiKey = req.headers.get('x-rapidapi-key') || process.env.RAPIDAPI_KEY;

  if (!apiKey || !q) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: !apiKey ? 'no apiKey' : 'no query' });
  }

  let resp;
  try {
    resp = await fetch('https://ebay-average-selling-price.p.rapidapi.com/findCompletedItems', {
      method: 'POST',
      headers: {
        'x-rapidapi-key':  apiKey,
        'x-rapidapi-host': 'ebay-average-selling-price.p.rapidapi.com',
        'Content-Type':    'application/json',
      },
      body: JSON.stringify({ keywords: q, max_search_results: 60, remove_outliers: true }),
      cache: 'no-store',
    });
  } catch (e) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: `fetch: ${e.message}` });
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: `RapidAPI ${resp.status}: ${text.slice(0, 200)}` });
  }

  let data;
  try { data = await resp.json(); } catch (e) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: `JSON parse: ${e.message}` });
  }

  if (!data.success) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: data.error || 'API error' });
  }

  const products = data.products || [];
  const now      = Date.now();
  const buckets  = {};
  const allEntries   = [];
  const recentPrices = [];
  const olderPrices  = [];

  for (const item of products) {
    const price = (parseFloat(item.sale_price) || 0) + (parseFloat(item.shipping_price) || 0);
    if (!price || price <= 0) continue;

    const gk       = gradeKey(item.title || '');
    const soldDate  = item.date_sold ? new Date(item.date_sold) : null;
    const daysAgo   = soldDate && !isNaN(soldDate) ? (now - soldDate.getTime()) / 86_400_000 : 30;

    if (!buckets[gk]) buckets[gk] = [];
    buckets[gk].push({ price, daysAgo });
    allEntries.push({ price, daysAgo });

    if (daysAgo <= 7)       recentPrices.push(price);
    else if (daysAgo <= 30) olderPrices.push(price);
  }

  const byGrade = {};
  for (const [gk, entries] of Object.entries(buckets)) {
    const wm = weightedMean(entries);
    if (wm != null) byGrade[gk] = Math.round(wm * 100) / 100;
  }

  // RapidAPI already removed outliers — use its average_price as the overall figure
  const overallWM = data.average_price ?? weightedMean(allEntries);

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
