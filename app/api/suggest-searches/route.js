import Anthropic from '@anthropic-ai/sdk';

// Helper: fetch real sold prices for a query via our sold-prices route
async function fetchSoldPrices(query, appId) {
  if (!appId || !query) return null;
  try {
    const params = new URLSearchParams({
      'OPERATION-NAME':       'findCompletedItems',
      'SERVICE-VERSION':      '1.0.0',
      'SECURITY-APPNAME':     appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'keywords':             query,
      'itemFilter(0).name':   'SoldItemsOnly',
      'itemFilter(0).value':  'true',
      'paginationInput.entriesPerPage': '20',
      'sortOrder':            'EndTimeSoonest',
    });
    const resp  = await fetch(`https://svcs.ebay.com/services/search/FindingService/v1?${params}`, { cache: 'no-store' });
    if (!resp.ok) return null;
    const data  = await resp.json();
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    const prices = items
      .map(i => parseFloat(i?.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || '0'))
      .filter(p => p > 0);
    if (!prices.length) return null;
    return {
      avg: Math.round((prices.reduce((a, b) => a + b) / prices.length) * 100) / 100,
      min: Math.min(...prices),
      max: Math.max(...prices),
      count: prices.length,
    };
  } catch { return null; }
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const appId  = process.env.EBAY_APP_ID;
  if (!apiKey) return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  let body;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid request body' }, { status: 400 }); }

  const { deals = [], weights = {}, rules = {}, segments = [] } = body;

  if (deals.length === 0) {
    return Response.json({
      trendNote: 'Log some deals first — suggestions are built entirely from your own purchase history.',
      suggestions: [],
    });
  }

  // ── Deal breakdown ──────────────────────────────────────────────────────
  const sorted     = [...deals].sort((a, b) => (b.roi || 0) - (a.roi || 0));
  const winners    = sorted.slice(0, Math.ceil(deals.length * 0.4));
  const losers     = sorted.slice(-Math.ceil(deals.length * 0.3));
  const avgROI     = Math.round(deals.reduce((a, d) => a + (d.roi || 0), 0) / deals.length);
  const fastFlips  = deals.filter(d => (d.days || 99) <= 7);
  const slowFlips  = deals.filter(d => (d.days || 0)  >  21);

  function summariseGroup(group) {
    return group.map(d =>
      `${d.player || '?'} | ${d.set || '?'} | ${d.grade || 'raw'} | $${d.buyPrice}→$${d.sellPrice} | +${d.roi}% ROI | ${d.days || '?'}d | ${d.category || '?'}`
    ).join('\n');
  }

  // ── Fetch real sold prices for top winning patterns ────────────────────
  // Build 4 representative queries from the strongest deals
  const repDeals  = winners.slice(0, 4);
  const priceData = await Promise.all(repDeals.map(d => {
    const q = [d.player, d.set, d.grade].filter(Boolean).join(' ');
    return fetchSoldPrices(q, appId).then(r => r ? { deal: d, comps: r } : null);
  }));
  const validComps = priceData.filter(Boolean);

  const compsContext = validComps.length > 0
    ? `\nREAL SOLD PRICE COMPS (from eBay completed listings — use these to validate profit margins):\n` +
      validComps.map(({ deal, comps }) =>
        `"${deal.player} ${deal.set} ${deal.grade}": avg sold $${comps.avg} (${comps.count} recent sales, range $${comps.min}–$${comps.max}). You bought at $${deal.buyPrice} → ${comps.avg > deal.buyPrice ? `PROFITABLE at avg sold` : `CAUTION: avg sold below your buy price`}.`
      ).join('\n')
    : '';

  // ── Segment context (informational only — not used to restrict suggestions) ──
  const segmentContext = segments.length > 0
    ? `\nIDENTIFIED BUYING PATTERNS (context only — you are NOT restricted to these):\n` + segments.map(s =>
        `- "${s.name}": buy $${s.priceRange?.min}–$${s.priceRange?.max}, grades: ${(s.typicalGrades||[]).join('/')}, sets: ${(s.typicalSets||[]).join('/')}, avg ROI: +${s.avgROI}%`
      ).join('\n')
    : '';

  const rulesSummary = Object.entries(rules)
    .map(([cat, r]) => `${cat}: max $${r.maxPrice}, min ${r.minROI}% ROI`)
    .join(' | ');

  const prompt = `You are a deal optimiser for a sports card flipper. Analyse their purchase history and suggest what they should search for next — to replicate what worked and avoid what didn't. Do NOT factor in market trends, news, or anything external.

${segmentContext}
${compsContext}

DEAL HISTORY (${deals.length} deals, avg ROI: ${avgROI}%):

HIGH-PERFORMING DEALS (top ${winners.length}):
${summariseGroup(winners)}

UNDERPERFORMING DEALS (bottom ${losers.length}):
${summariseGroup(losers)}

FAST FLIPS (≤7 days, ${fastFlips.length}): ${fastFlips.length ? summariseGroup(fastFlips) : 'none'}
SLOW FLIPS (>21 days, ${slowFlips.length}): ${slowFlips.length ? summariseGroup(slowFlips) : 'none'}

Category rules: ${rulesSummary || 'none set'}

Your task: Generate 7 eBay search suggestions that are direct optimisations of their proven winning patterns.

CRITICAL RULES — a suggestion is only valid if:
1. It is traceable to a specific high-performing deal in their history
2. Where real sold price comps are provided above, the expected buy price must be BELOW the avg sold price — if the comps show the card is unprofitable, DO NOT suggest it
3. The expected margin must meet or exceed their category's minROI rule
4. type: "repeat-winner" | "grade-up" | "price-adjust" | "avoid-pattern"

For each suggestion include a maxBuyPrice — the highest price the user should pay to hit their ROI target (calculate from comps if available, or from their personal deal history).

Respond ONLY with valid JSON:
{
  "trendNote": "1-sentence insight from their own data",
  "suggestions": [
    {
      "query": "exact eBay search string",
      "label": "Short label (3-5 words)",
      "reason": "Which past deal this is based on and why it should be profitable (reference actual prices if comps available)",
      "category": "low end|mid end|high end|quick sell|margin bet",
      "type": "repeat-winner|grade-up|price-adjust|avoid-pattern",
      "maxBuyPrice": 45
    }
  ]
}`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json({ suggestions: [], trendNote: '' });
    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error('[suggest-searches]', e?.message);
    return Response.json({ error: e?.message }, { status: 502 });
  }
}
