// eBay Finding API — findCompletedItems
// Returns real sold prices for a card query (last 20 sales).
// Uses App ID only — no OAuth needed.
// Called by suggest-searches for profitability validation and by
// the Diagnostic to show real comps on each card option.

export async function POST(req) {
  const appId = req.headers.get('x-ebay-key') || process.env.EBAY_APP_ID;
  if (!appId) {
    return Response.json({ error: 'EBAY_APP_ID not configured' }, { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid body' }, { status: 400 }); }

  const { query } = body;
  if (!query) return Response.json({ error: 'query required' }, { status: 400 });

  const params = new URLSearchParams({
    'OPERATION-NAME':       'findCompletedItems',
    'SERVICE-VERSION':      '1.0.0',
    'SECURITY-APPNAME':     appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'keywords':             query,
    'itemFilter(0).name':   'SoldItemsOnly',
    'itemFilter(0).value':  'true',
    'paginationInput.entriesPerPage': '20',
    'sortOrder':            'EndTimeSoonest',
  });

  try {
    const resp = await fetch(
      `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`,
      { cache: 'no-store' }
    );
    if (!resp.ok) throw new Error(`eBay Finding API ${resp.status}`);

    const data  = await resp.json();
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];

    const sales = items
      .map(i => ({
        title: i.title?.[0] || '',
        price: parseFloat(i?.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || '0'),
        date:  i?.listingInfo?.[0]?.endTime?.[0] || '',
      }))
      .filter(s => s.price > 0);

    if (!sales.length) {
      return Response.json({ avgSoldPrice: null, recentSales: [], count: 0 });
    }

    const prices      = sales.map(s => s.price);
    const avgSoldPrice = Math.round((prices.reduce((a, b) => a + b) / prices.length) * 100) / 100;
    const minPrice    = Math.min(...prices);
    const maxPrice    = Math.max(...prices);

    return Response.json({ avgSoldPrice, minPrice, maxPrice, recentSales: sales.slice(0, 10), count: sales.length });
  } catch (e) {
    console.error('[sold-prices]', e?.message);
    return Response.json({ error: e?.message }, { status: 502 });
  }
}
