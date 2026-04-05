import Anthropic from '@anthropic-ai/sdk';

// Processes up to 30 deals per call.
// Extracts set, year, grade, variant, aesthetic score, and eBay search query
// from whatever partial data the user imported — using Claude's card knowledge.

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid body' }, { status: 400 }); }

  const { deals = [] } = body;
  if (!deals.length) return Response.json({ enriched: [] });

  const chunk = deals.slice(0, 30);

  const dealLines = chunk.map((d, i) => {
    const parts = [
      `#${i}`,
      `player: ${d.player || '?'}`,
      d.set      ? `set: ${d.set}`           : null,
      d.year     ? `year: ${d.year}`         : null,
      d.grade    ? `grade: ${d.grade}`       : null,
      d.variant  ? `variant: ${d.variant}`   : null,
      d.notes    ? `notes: "${d.notes}"`     : null,
      `buy: $${d.buyPrice}`,
      `sell: $${d.sellPrice}`,
      `roi: +${d.roi}%`,
    ].filter(Boolean).join(' | ');
    return parts;
  }).join('\n');

  const prompt = `You are a sports trading card expert with encyclopaedic knowledge of basketball card sets, releases, grades, and visual characteristics.

The user has imported ${chunk.length} past card purchases. Many have incomplete details. Use ALL available context — player name, notes, buy price, ROI — to extract or infer the missing fields. Your card market knowledge is the primary tool here.

DEALS:
${dealLines}

For EACH deal, return:
- set: Card brand/set (Prizm, Optic, Chrome, Mosaic, Select, Bowman, Topps, Donruss, Upper Deck, Hoops, etc.)
- year: Production year of the card (not purchase date — infer from player career stage, set history, or price)
- grade: Condition (PSA 10, PSA 9, PSA 8, PSA 7, BGS 9.5, BGS 9, SGC 10, SGC 9, raw). Use price as a signal: <$20 usually raw, $20-60 PSA 9, $60+ PSA 10 or premium.
- variant: Finish/parallel (Silver, Gold, Refractor, Holo, Cracked Ice, Hyper, Base, RPA, Auto, etc.)
- aestheticScore: 1-10 based on visual desirability of THIS card type to collectors. Examples: Prizm Silver PSA 10 = 9, Optic Holo = 8, Chrome Refractor = 8, Mosaic = 6, Donruss base = 4, raw base = 3.
- ebayQuery: A precise eBay search string to find this card (player + year + set + variant + grade)
- confidence: "high" | "medium" | "low" — how certain you are given the available data

Rules:
- KEEP existing values if already provided (only override if clearly wrong)
- If you genuinely cannot infer a field, use "" (empty string) — do NOT guess randomly
- Return EXACTLY ${chunk.length} objects in the SAME ORDER as input (index 0 to ${chunk.length - 1})

Respond ONLY with a JSON array:
[{"index":0,"set":"Prizm","year":"2019","grade":"PSA 9","variant":"Silver","aestheticScore":8,"ebayQuery":"Ja Morant 2019 Panini Prizm Silver PSA 9 rookie RC","confidence":"high"}]`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text || '';
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (!arrMatch) return Response.json({ enriched: [] });

    const enriched = JSON.parse(arrMatch[0]);
    return Response.json({ enriched });
  } catch (e) {
    console.error('[enrich-cards]', e?.message);
    return Response.json({ error: e?.message }, { status: 502 });
  }
}
