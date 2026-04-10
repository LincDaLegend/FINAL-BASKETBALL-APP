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

  const data = await resp.json().catch(() => ({}));
  const msg = data?.errors?.[0]?.message || `eBay error ${resp.status}`;
  return NextResponse.json({ error: msg }, { status: resp.status });
}
