import { NextResponse } from 'next/server';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  const appBase = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error || !code) {
    return NextResponse.redirect(`${appBase}/?ebay_error=${encodeURIComponent(error || 'no_code')}`);
  }

  const clientId     = process.env.EBAY_APP_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET || req.cookies.get('ebay_cs')?.value;
  // redirect_uri in token exchange must be the RuName, same as used in the auth request
  const redirectUri  = process.env.EBAY_REDIRECT_URI  || req.cookies.get('ebay_ru')?.value;

  try {
    // Exchange auth code for user access token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResp = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      throw new Error(`Token exchange failed: ${text.slice(0, 100)}`);
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;

    // Fetch eBay username from identity API
    const identityResp = await fetch('https://apiz.ebay.com/commerce/identity/v1/user/', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    let username = 'eBay User';
    if (identityResp.ok) {
      const identity = await identityResp.json();
      username = identity.username || identity.userId || 'eBay User';
    }

    // Redirect back to app — frontend reads params and stores in localStorage
    const successResp = NextResponse.redirect(
      `${appBase}/?ebay_user=${encodeURIComponent(username)}`
    );
    successResp.cookies.delete('ebay_cs');
    successResp.cookies.delete('ebay_ru');
    return successResp;
  } catch (e) {
    return NextResponse.redirect(
      `${appBase}/?ebay_error=${encodeURIComponent(e.message)}`
    );
  }
}
