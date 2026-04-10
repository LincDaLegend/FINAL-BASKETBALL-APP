import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url);

  // Prefer query params (passed from client-side Settings) over env vars
  const clientId     = searchParams.get('app_id')        || process.env.EBAY_APP_ID;
  const clientSecret = searchParams.get('client_secret') || process.env.EBAY_CLIENT_SECRET;
  // ru_name is the RuName from eBay developer portal — used as redirect_uri in OAuth, NOT an actual URL
  const ruName       = searchParams.get('ru_name')       || process.env.EBAY_REDIRECT_URI;
  const appBase      = process.env.NEXT_PUBLIC_APP_URL   || origin;

  if (!clientId || !ruName) {
    return NextResponse.redirect(
      `${appBase}/?ebay_error=${encodeURIComponent('Save your eBay App ID and RuName in Settings first.')}`
    );
  }

  const scopes = [
    'https://api.ebay.com/oauth/api_scope',
    'https://api.ebay.com/oauth/api_scope/commerce.identity.readonly',
    'https://api.ebay.com/oauth/api_scope/buy.offer.auction',
    'https://api.ebay.com/oauth/api_scope/buy.browse',
  ];

  // Encode credentials in the state param so callback can read them without relying on cookies
  const statePayload = Buffer.from(JSON.stringify({ clientId, clientSecret, ruName })).toString('base64url');

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  ruName,
    response_type: 'code',
    scope:         scopes.join(' '),
    state:         statePayload,
  });

  const url = `https://auth.ebay.com/oauth2/authorize?${params}`;

  // Add ?debug=1 to /api/ebay/auth to inspect the constructed URL instead of redirecting
  if (searchParams.get('debug')) {
    return NextResponse.json({ url, clientId, ruName, scopes });
  }

  return NextResponse.redirect(url);
}
