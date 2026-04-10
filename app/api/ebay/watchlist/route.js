import { NextResponse } from 'next/server';

// Trading API AddToWatchList — works with basic user OAuth token (no extra scope needed)
export async function POST(req) {
  const { itemId, userToken, appId } = await req.json();

  if (!itemId || !userToken) {
    return NextResponse.json({ error: 'itemId and userToken are required.' }, { status: 400 });
  }

  // Browse API returns IDs like "v1|123456789|0" — Trading API needs just the numeric part
  const numericId = itemId.includes('|') ? itemId.split('|')[1] : itemId;

  const effectiveAppId = appId || process.env.EBAY_APP_ID || '';

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddToWatchListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ItemID>${numericId}</ItemID>
</AddToWatchListRequest>`;

  const resp = await fetch('https://api.ebay.com/ws/api.dll', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'X-EBAY-API-CALL-NAME': 'AddToWatchList',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-APP-NAME': effectiveAppId,
      'X-EBAY-API-IAF-TOKEN': userToken,
    },
    body: xml,
  });

  const text = await resp.text();

  if (text.includes('<Ack>Success</Ack>') || text.includes('<Ack>Warning</Ack>')) {
    return NextResponse.json({ success: true });
  }

  // Extract error message from XML
  const msgMatch = text.match(/<LongMessage>(.*?)<\/LongMessage>/);
  const msg = msgMatch?.[1] || text.slice(0, 300);
  console.error('[watchlist] Trading API error:', msg);
  return NextResponse.json({ error: msg }, { status: 502 });
}
