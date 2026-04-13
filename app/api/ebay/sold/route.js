import { NextResponse } from 'next/server';

// Exponential decay: 7-day half-life
const LAMBDA = Math.LN2 / 7;

function decayWeight(daysAgo) {
  return Math.exp(-LAMBDA * Math.max(0, daysAgo));
}

// IQR outlier removal + time-weighted mean
function robustWeightedMean(entries) {
  if (!entries.length) return null;
  const prices = [...entries].sort((a, b) => a.price - b.price);
  if (prices.length === 1) return prices[0].price;

  const q1  = prices[Math.floor(prices.length * 0.25)].price;
  const q3  = prices[Math.floor(prices.length * 0.75)].price;
  const iqr = q3 - q1;
  const lo  = q1 - 1.5 * iqr;
  const hi  = q3 + 1.5 * iqr;
  const clean = entries.filter(e => e.price >= lo && e.price <= hi);
  if (!clean.length) return prices[Math.floor(prices.length / 2)].price;

  const simpleMean = clean.reduce((s, e) => s + e.price, 0) / clean.length;
  let sumW = 0, sumWP = 0;
  for (const e of clean) {
    const timeW    = decayWeight(e.daysAgo);
    const centralW = 1 / (1 + Math.abs(e.price - simpleMean));
    const w        = timeW * centralW;
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

let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken(appId, secret) {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 60_000) return tokenCache.token;

  const credentials = Buffer.from(`${appId}:${secret}`).toString('base64');
  const resp = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope%20https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope%2Fbuy.marketplace.insights',
    cache: 'no-store',
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth failed (${resp.status}): ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return tokenCache.token;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q      = (searchParams.get('q') || '').trim();
  const appId  = req.headers.get('x-ebay-key')    || process.env.EBAY_APP_ID;
  const secret = req.headers.get('x-ebay-secret') || process.env.EBAY_CLIENT_SECRET;
  // User OAuth token takes priority — has buy.marketplace.insights scope if granted
  const userToken = req.headers.get('x-ebay-token') || null;

  if (!q) {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: 'no query' });
  }

  let token;
  if (userToken) {
    token = userToken;
  } else if (appId && secret) {
    try {
      token = await getAccessToken(appId, secret);
    } catch (e) {
      return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: `auth: ${e.message}` });
    }
  } else {
    return NextResponse.json({ byGrade: {}, weightedMean: null, count: 0, error: 'no credentials' });
  }

  const params = new URLSearchParams({
    q,
    limit: '50',
    sort: 'lastSoldDate',
  });

  let resp;
  try {
    resp = await fetch(
      `https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );
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

  const items = data?.itemSales || [];
  const now   = Date.now();

  const buckets    = {};
  const allEntries = [];
  const recentPrices = [];
  const olderPrices  = [];

  for (const item of items) {
    const title  = item.title || '';
    const price  = parseFloat(item.lastSoldPrice?.value || 0);
    if (!price || price <= 0) continue;

    const soldMs  = item.lastSoldDate ? new Date(item.lastSoldDate).getTime() : now;
    const daysAgo = (now - soldMs) / 86_400_000;
    const gk      = gradeKey(title);

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
