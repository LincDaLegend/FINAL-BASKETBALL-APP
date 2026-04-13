import { NextResponse } from 'next/server';

// Proxy POST requests to a user-configured Google Apps Script web app.
// The GAS script handles the actual Sheets write (append row or update row).
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { gasUrl, ...payload } = body;

  if (!gasUrl) {
    return NextResponse.json(
      { error: 'gasUrl missing — save your Google Apps Script URL in Settings.' },
      { status: 400 }
    );
  }

  let resp;
  try {
    resp = await fetch(gasUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      redirect: 'follow',
    });
  } catch (e) {
    return NextResponse.json({ error: `Network error reaching Apps Script: ${e.message}` }, { status: 502 });
  }

  const text = await resp.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: resp.ok ? 200 : 500 });
  } catch {
    return NextResponse.json({ ok: resp.ok, raw: text.slice(0, 300) });
  }
}
