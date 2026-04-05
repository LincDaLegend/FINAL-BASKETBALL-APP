import Anthropic from '@anthropic-ai/sdk';

// Analyses the full enriched deal history and identifies natural buying segments —
// distinct clusters of purchases with similar grade, set, price range, and ROI profile.
// Segments are shown as informational insight only — not used to restrict suggestions.

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid body' }, { status: 400 }); }

  const { deals = [] } = body;
  if (deals.length < 3) return Response.json({ segments: [] });

  const dealLines = deals.map(d =>
    [
      d.player    || '?',
      d.set       || '?',
      d.year      || '',
      d.variant   || '',
      d.grade     || 'raw',
      `sold $${d.sellPrice}`,
      `+${d.roi}%`,
      d.days ? `${d.days}d` : '',
      d.category  || '',
      d.notes     || '',
    ].filter(Boolean).join(' | ')
  ).join('\n');

  const prompt = `You are analysing a card flipper's complete purchase history to identify their REAL buying segments — natural clusters based on what they ACTUALLY buy, not theoretical categories.

COMPLETE DEAL HISTORY (${deals.length} deals):
${dealLines}

Task: Identify 3–6 distinct segments that describe how this person actually buys. Ground every segment in real patterns from the data above — not assumptions.

For each segment provide:
- name: Short, specific name (e.g. "Raw Prizm Rookies", "PSA 9 Mid-Range Stars", "Budget Quick-Flips")
- description: 1-2 sentences describing what makes this group distinct
- priceRange: { "min": number, "max": number } — typical SOLD price range in USD (use sellPrice, not buyPrice)
- typicalGrades: string[] — grades most common in this segment
- typicalSets: string[] — sets most common in this segment
- typicalPlayers: string[] — example players bought in this segment
- avgROI: number — average ROI % across deals in this segment
- avgDaysToFlip: number — average days to sell (0 if unknown)
- dealCount: number — approximate number of deals in this segment
- isStrong: boolean — true if avg ROI ≥ 30% consistently
- diagnosticFocus: What specific A/B comparisons would be most useful to probe within this segment (e.g. "PSA 9 vs PSA 10 at double the price in the $40-80 range")
- searchFocus: A short phrase describing what eBay searches find more of this segment

Respond ONLY with valid JSON:
{
  "segments": [
    {
      "name": "...",
      "description": "...",
      "priceRange": { "min": 15, "max": 60 },
      "typicalGrades": ["PSA 9", "raw"],
      "typicalSets": ["Prizm", "Optic"],
      "typicalPlayers": ["LeBron James", "Ja Morant"],
      "avgROI": 42,
      "avgDaysToFlip": 12,
      "dealCount": 8,
      "isStrong": true,
      "diagnosticFocus": "...",
      "searchFocus": "..."
    }
  ]
}`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ segments: [] });
    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error('[segment-deals]', e?.message);
    return Response.json({ error: e?.message }, { status: 502 });
  }
}
