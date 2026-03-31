import { NextResponse } from 'next/server';

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
  if (condition === 'Brand New' || condition === 'Like New') score += 0.5;
  return Math.min(10, Math.round(score * 10) / 10);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const category = (searchParams.get('category') || '').trim();

  const ebayAppId = process.env.EBAY_APP_ID;
  if (!ebayAppId) {
    return NextResponse.json(
      { error: 'Server missing EBAY_APP_ID env var.' },
      { status: 500 }
    );
  }

  const keywords = [q, 'basketball card', category !== '' ? category : '']
    .filter(Boolean)
    .join(' ');

  if (!keywords.trim()) {
    return NextResponse.json({ items: [] }, { status: 200 });
  }

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findItemsByKeywords',
    'SERVICE-VERSION': '1.0.3',
    'SECURITY-APPNAME': ebayAppId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': keywords,
    'paginationInput.entriesPerPage': '20',
    'itemFilter(0).name': 'Condition',
    'itemFilter(0).value(0)': '1000',
    'itemFilter(0).value(1)': '2000',
    'itemFilter(0).value(2)': '2500',
    'itemFilter(0).value(3)': '3000',
    'sortOrder': 'BestMatch',
  });

  const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`;

  const resp = await fetch(url, {
    headers: {
      // eBay sometimes varies responses; disabling cache avoids confusing results.
      'cache-control': 'no-store',
    },
    cache: 'no-store',
  });

  if (!resp.ok) {
    return NextResponse.json(
      { error: `eBay API error: ${resp.status}` },
      { status: 502 }
    );
  }

  const data = await resp.json();
  const items = data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];

  const normalized = items.map((item) => {
    const title     = item.title?.[0] || '';
    const price     = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0);
    const imgUrl    = item.galleryURL?.[0] || '';
    const itemId    = item.itemId?.[0] || '';
    const viewUrl   = item.viewItemURL?.[0] || '';
    const condition = item.condition?.[0]?.conditionDisplayName?.[0] || 'Unknown';
    const grade     = extractGrade(title);
    const aestheticScore = estimateAesthetic(title, condition);
    return {
      title,
      price,
      imgUrl,
      itemId,
      viewUrl,
      condition,
      grade,
      aestheticScore,
      avgSold: price * 1.35,
    };
  });

  return NextResponse.json({ items: normalized }, { status: 200 });
}

