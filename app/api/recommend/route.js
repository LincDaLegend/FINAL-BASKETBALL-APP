import Anthropic from '@anthropic-ai/sdk';

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { listings = [], deals = [], rules = {}, query = '', category = '' } = body;

  // Build listings summary (top 10)
  const topListings = listings.slice(0, 10).map((l, i) =>
    `${i + 1}. "${l.title}" — $${l.price?.toFixed(2)} | Grade: ${l.grade} | Score: ${l.aiScore}/100 | Aesthetic: ${l.aestheticScore}/10`
  ).join('\n');

  if (!topListings) {
    return Response.json({ picks: [], avoid: [], marketRead: 'No listings to analyse.' });
  }

  // Build deal history summary
  let dealSummary = 'No deal history yet — using general market knowledge.';
  if (deals.length > 0) {
    const avgROI = Math.round(deals.reduce((a, d) => a + (d.roi ?? 0), 0) / deals.length);
    const bestDeal = [...deals].sort((a, b) => (b.roi ?? 0) - (a.roi ?? 0))[0];
    const cats = [...new Set(deals.map(d => d.category).filter(Boolean))];
    const players = [...new Set(deals.map(d => d.player).filter(Boolean))].slice(0, 5);
    dealSummary = `${deals.length} deals logged. Avg ROI: ${avgROI}%. Best deal: ${bestDeal?.player} +${bestDeal?.roi}% ROI. Active categories: ${cats.join(', ')}. Players flipped: ${players.join(', ')}.`;
  }

  // Build category rule context
  const ruleCtx = category && rules[category]
    ? `Active rule: max buy $${rules[category].maxPrice}, min ROI ${rules[category].minROI}%.`
    : 'No category filter active.';

  const prompt = `You are a sports trading card arbitrage expert. A user is sourcing basketball cards on eBay to flip for profit.

Search: "${query || 'general basketball cards'}" ${category ? `(category: ${category})` : ''}
${ruleCtx}
Deal history: ${dealSummary}

eBay listings (pre-scored 0–100 by rule+ML engine):
${topListings}

Your job:
1. Pick the best 1–3 listings to buy. For each, give a concrete reason: grade premium opportunity, set desirability, player trajectory, price vs market value, or arbitrage edge.
2. Flag up to 2 listings to avoid and why (overpriced, saturated market, poor grade, etc.).
3. One-sentence market read on this search.

Respond ONLY with valid JSON in this exact shape:
{
  "picks": [
    { "rank": 1, "listingIndex": 0, "action": "buy now", "reason": "..." },
    { "rank": 2, "listingIndex": 3, "action": "consider", "reason": "..." }
  ],
  "avoid": [
    { "listingIndex": 5, "reason": "..." }
  ],
  "marketRead": "..."
}

listingIndex is the 0-based index into the listings array above. Keep reasons under 25 words each.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ picks: [], avoid: [], marketRead: text.slice(0, 200) });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return Response.json(parsed);
  } catch (e) {
    console.error('[recommend] Claude error:', e?.message);
    return Response.json({ error: e?.message || 'Claude request failed' }, { status: 502 });
  }
}
