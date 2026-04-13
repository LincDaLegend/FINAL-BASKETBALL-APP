import { NextResponse } from 'next/server';

const SHEET_ID = '1ac1re_eTDZxA37K-bvGor1V9GAMpP9RL2qQf2-sXmk8';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sheet = searchParams.get('sheet') || '';
  const range = searchParams.get('range') || '';

  if (!sheet) return NextResponse.json({ error: 'sheet param required' }, { status: 400 });

  const url = new URL(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`);
  url.searchParams.set('tqx', 'out:json');
  url.searchParams.set('sheet', sheet);
  if (range) url.searchParams.set('range', range);

  let resp;
  try {
    resp = await fetch(url.toString(), { cache: 'no-store' });
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${e.message}` }, { status: 502 });
  }

  if (!resp.ok) {
    return NextResponse.json(
      { error: `Sheets returned ${resp.status}. Make sure the sheet is shared "Anyone with link can view".` },
      { status: resp.status }
    );
  }

  const text = await resp.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) {
    return NextResponse.json({ error: 'Unexpected Sheets response format.' }, { status: 500 });
  }

  try {
    const { table } = JSON.parse(match[1]);
    const cols = (table.cols || []).map((c, i) => c.label || c.id || `col${i}`);
    const rows = (table.rows || [])
      .map(r => {
        const obj = {};
        cols.forEach((col, i) => {
          obj[col] = r.c?.[i]?.f ?? r.c?.[i]?.v ?? '';
        });
        return obj;
      })
      .filter(r => cols.some(c => r[c] !== '' && r[c] !== null));
    return NextResponse.json({ cols, rows });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to parse Sheets data.', detail: e.message }, { status: 500 });
  }
}
