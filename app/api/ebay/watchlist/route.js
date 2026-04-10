import { NextResponse } from 'next/server';

export async function POST(req) {
  const { itemId, userToken } = await req.json();

  if (!itemId || !userToken) {
    return NextResponse.json({ error: 'itemId and userToken are required.' }, { status: 400 });
  }

  const resp = await fetch(
    `https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(itemId)}/addItemToWatchlist`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      },
    }
  );

  // eBay returns 204 No Content on success
  if (resp.status === 204 || resp.ok) {
    return NextResponse.json({ success: true });
  }

  const body = await resp.text();
  let data = {};
  try { data = JSON.parse(body); } catch {}

  const ebayMsg = data?.errors?.[0]?.message || data?.error_description || body.slice(0, 200);

  // Scope error — user needs to reconnect with buy.browse scope
  if (resp.status === 403 || ebayMsg?.toLowerCase().includes('scope')) {
    return NextResponse.json({
      error: 'scope_missing',
      detail: 'Your eBay token is missing the watchlist scope. Please reconnect your eBay account in Settings.',
    }, { status: 403 });
  }

  console.error('[watchlist] eBay error', resp.status, ebayMsg);
  return NextResponse.json({ error: ebayMsg || `eBay error ${resp.status}`, status: resp.status }, { status: resp.status });
}
