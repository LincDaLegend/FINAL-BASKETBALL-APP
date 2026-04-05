import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { itemId, maxBid, userToken } = await req.json();

    if (!itemId || !maxBid || !userToken) {
      return NextResponse.json({ error: 'itemId, maxBid, and userToken are required.' }, { status: 400 });
    }

    const resp = await fetch(
      `https://api.ebay.com/buy/offer/v1_beta/bidding/${encodeURIComponent(itemId)}/place_proxy_bid`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        body: JSON.stringify({
          maxAmount: {
            value: String(parseFloat(maxBid).toFixed(2)),
            currency: 'USD',
          },
        }),
      }
    );

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = data?.errors?.[0]?.message || data?.message || `eBay error ${resp.status}`;
      return NextResponse.json({ error: msg }, { status: resp.status });
    }

    return NextResponse.json({ success: true, ...data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
