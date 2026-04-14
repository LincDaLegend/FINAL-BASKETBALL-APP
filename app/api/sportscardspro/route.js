import { NextResponse } from 'next/server';

const BASE = 'https://www.sportscardspro.com';

// Proxy for SportsCardsPro Prices API.
// Keeps the token server-side so it never appears in browser network logs.
// GET /api/sportscardspro?q=jordan+clarkson+select+blue+ice+2024
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q     = (searchParams.get('q') || '').trim();
  const token = req.headers.get('x-scp-token') || process.env.SCP_TOKEN;

  if (!token) return NextResponse.json({ status: 'error', error: 'no token' }, { status: 401 });
  if (!q)     return NextResponse.json({ status: 'error', error: 'no query' }, { status: 400 });

  // Step 1: find best matching product ID
  const searchUrl = `${BASE}/api/products?t=${encodeURIComponent(token)}&q=${encodeURIComponent(q)}`;
  let searchResp;
  try {
    searchResp = await fetch(searchUrl, { cache: 'no-store' });
  } catch (e) {
    return NextResponse.json({ status: 'error', error: `fetch: ${e.message}` });
  }

  if (!searchResp.ok) {
    const text = await searchResp.text().catch(() => '');
    return NextResponse.json({ status: 'error', error: `SCP ${searchResp.status}: ${text.slice(0, 200)}` });
  }

  const searchData = await searchResp.json().catch(() => null);
  const products   = searchData?.products || [];
  if (!products.length) {
    return NextResponse.json({ status: 'error', error: 'no matches' });
  }

  // Step 2: get full price data for the best match
  const bestId     = products[0].id;
  const priceUrl   = `${BASE}/api/product?t=${encodeURIComponent(token)}&id=${encodeURIComponent(bestId)}`;
  let priceResp;
  try {
    priceResp = await fetch(priceUrl, { cache: 'no-store' });
  } catch (e) {
    return NextResponse.json({ status: 'error', error: `fetch prices: ${e.message}` });
  }

  if (!priceResp.ok) {
    const text = await priceResp.text().catch(() => '');
    return NextResponse.json({ status: 'error', error: `SCP prices ${priceResp.status}: ${text.slice(0, 200)}` });
  }

  const priceData = await priceResp.json().catch(() => null);
  if (!priceData || priceData.status === 'error') {
    return NextResponse.json({ status: 'error', error: priceData?.['error-message'] || 'unknown' });
  }

  // Prices are in pennies — convert to dollars
  const p = (key) => {
    const v = parseInt(priceData[key], 10);
    return (v && v > 0) ? Math.round(v) / 100 : null;
  };

  return NextResponse.json({
    status:       'success',
    productName:  priceData['product-name'] || '',
    consoleName:  priceData['console-name'] || '',
    id:           bestId,
    byGrade: {
      raw:    p('loose-price'),
      psa10:  p('manual-only-price'),
      psa9:   p('graded-price'),
      bgs9_5: p('box-only-price'),
      psa8:   p('new-price'),
      psa7:   p('cib-price'),
      sgc10:  p('condition-18-price'),
      cgc10:  p('condition-17-price'),
      bgs10:  p('bgs-10-price'),
    },
  });
}
