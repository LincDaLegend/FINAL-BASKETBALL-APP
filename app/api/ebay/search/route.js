import { NextResponse } from 'next/server';

// Simple in-memory token cache (survives within a single serverless instance)
let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken(appId, clientSecret) {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const credentials = Buffer.from(`${appId}:${clientSecret}`).toString('base64');
  const resp = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    cache: 'no-store',
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`eBay OAuth failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in * 1000),
  };
  return tokenCache.token;
}

function extractGrade(title) {
  const t = String(title || '').toUpperCase();
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

function estimateAesthetic(title, condition) {
  const t = String(title || '').toUpperCase();
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
  if (condition && (condition.toLowerCase().includes('new') || condition.toLowerCase().includes('mint'))) score += 0.5;
  return Math.min(10, Math.round(score * 10) / 10);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q            = (searchParams.get('q') || '').trim();
  const category     = (searchParams.get('category') || '').trim();
  const listingType  = searchParams.get('listingType') || '';
  const itemLocation = searchParams.get('itemLocation') || '';

  const ebayAppId     = req.headers.get('x-ebay-key')    || process.env.EBAY_APP_ID;
  const ebaySecret    = req.headers.get('x-ebay-secret')  || process.env.EBAY_CLIENT_SECRET;

  if (!ebayAppId || !ebaySecret) {
    return NextResponse.json(
      { error: 'eBay App ID and Client Secret are both required. Add them in Settings.' },
      { status: 500 }
    );
  }

  const keywords = [q, category !== '' ? category : '']
    .filter(Boolean)
    .join(' ');

  if (!keywords.trim()) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  let accessToken;
  try {
    accessToken = await getAccessToken(ebayAppId, ebaySecret);
  } catch (e) {
    return NextResponse.json(
      { error: `eBay auth failed: ${e.message}. Check your App ID and Client Secret.` },
      { status: 502 }
    );
  }

  const maxItems = parseInt(searchParams.get('max') || '0', 10);
  const PAGE_SIZE = 25; // cap per page — keeps response fast
  const ebayHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    'Content-Type': 'application/json',
  };

  const allItems = [];
  let offset = 0;
  let total = null;

  do {
    const filters = ['conditionIds:{1000|1500|2000|2500|3000}'];
    if (listingType === 'fixed')   filters.push('buyingOptions:{FIXED_PRICE}');
    if (listingType === 'auction') filters.push('buyingOptions:{AUCTION}');
    if (itemLocation === 'us')     filters.push('itemLocationCountry:US');

    const browseParams = new URLSearchParams({
      q: keywords,
      limit: String(maxItems > 0 ? Math.min(PAGE_SIZE, maxItems) : PAGE_SIZE),
      offset: String(offset),
      sort: 'bestMatch',
      category_ids: '212',
    });
    if (filters.length) browseParams.set('filter', filters.join(','));

    const resp = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?${browseParams.toString()}`,
      { headers: ebayHeaders, cache: 'no-store' }
    );

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json(
        { error: `eBay Browse API error (${resp.status}): ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    const page = data?.itemSummaries || [];
    allItems.push(...page);

    if (total === null) total = data?.total ?? 0;
    offset += PAGE_SIZE;
  } while (false); // single page only — keeps latency low

  const items = allItems;

  const now24h = Date.now() + 24 * 60 * 60 * 1000;
  const isAuctionFilter = listingType === 'auction';

  const normalized = items
    .map((item) => {
      const title        = item.title || '';
      const price        = parseFloat(item.currentBidPrice?.value || item.price?.value || 0);
      const imgUrl       = item.image?.imageUrl || (item.thumbnailImages?.[0]?.imageUrl) || '';
      const itemId       = item.itemId || '';
      const viewUrl      = item.itemWebUrl || '';
      const condition    = item.condition || 'Unknown';
      const grade        = extractGrade(title);
      const aestheticScore = estimateAesthetic(title, condition);
      const endTime      = item.itemEndDate || null;
      const buyingOption = (item.buyingOptions || []).includes('AUCTION') ? 'AUCTION' : 'FIXED_PRICE';
      const sellerId     = item.seller?.username || '';
      const sellerFeedback = Math.round(parseFloat(item.seller?.feedbackPercentage || '100'));
      const shippingCost = (() => {
        const opt = (item.shippingOptions || [])[0];
        if (!opt) return 0;
        if (opt.shippingCostType === 'FREE') return 0;
        return parseFloat(opt.shippingCost?.value || '0');
      })();
      return { title, price, imgUrl, itemId, viewUrl, condition, grade, aestheticScore, avgSold: price * 1.35, endTime, buyingOption, sellerId, sellerFeedback, shippingCost };
    })
    // When searching auctions, only show listings ending within 24 hours
    .filter(item => {
      if (!isAuctionFilter) return true;
      if (!item.endTime) return true; // no end time = include (BIN or unknown)
      return new Date(item.endTime).getTime() <= now24h;
    });

  return NextResponse.json({ items: normalized }, { status: 200 });
}
