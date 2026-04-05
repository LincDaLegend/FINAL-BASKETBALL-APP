import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { messages = [], deals = [], segments = [], diagnosticProfile = null } = body;
  if (!messages.length) return Response.json({ error: 'No messages' }, { status: 400 });

  // Build deal context — what has this person profited on?
  const dealCount = deals.length;
  const avgROI    = dealCount
    ? Math.round(deals.reduce((a, d) => a + (d.roi || 0), 0) / dealCount)
    : 0;

  // Top patterns: player+type combos with highest ROI
  const topDeals = [...deals]
    .sort((a, b) => (b.roi || 0) - (a.roi || 0))
    .slice(0, 8)
    .map(d => `${d.player} ${d.set || ''} ${d.variant || ''} ${d.grade || ''} +${d.roi}%`.trim())
    .join(', ');

  // Player-specific history for players mentioned in the latest message
  const latestMsg   = messages[messages.length - 1]?.content || '';
  const dealsByPlayer = {};
  for (const d of deals) {
    const k = (d.player || '').toLowerCase();
    if (!dealsByPlayer[k]) dealsByPlayer[k] = [];
    dealsByPlayer[k].push(d);
  }
  // Find any player names from deal history that appear in the latest message
  const mentionedPlayers = Object.keys(dealsByPlayer).filter(p =>
    p.length > 3 && latestMsg.toLowerCase().includes(p)
  );
  const playerContext = mentionedPlayers.map(p => {
    const playerDeals = dealsByPlayer[p];
    const playerAvgROI = Math.round(playerDeals.reduce((a, d) => a + (d.roi || 0), 0) / playerDeals.length);
    const types = playerDeals.map(d => [d.set, d.variant, d.grade].filter(Boolean).join(' ')).join(', ');
    return `${p} (${playerDeals.length} deals, +${playerAvgROI}% avg ROI, types: ${types})`;
  }).join('\n');

  const segmentSummary = segments.length > 0
    ? segments.map(s => `"${s.name}": $${s.priceRange?.min}–$${s.priceRange?.max}, ${(s.typicalGrades||[]).join('/')}, ROI +${s.avgROI}%`).join(' | ')
    : '';

  const systemPrompt = `You are a search assistant for a basketball card flipper who buys and resells on eBay.
Your job: have a natural conversation to understand exactly what they want to buy, then output a precise eBay search query.

THEIR DEAL HISTORY:
- ${dealCount} deals logged, avg ROI: +${avgROI}%
- Best recent deals: ${topDeals || 'none yet'}
${segmentSummary ? `- Buying patterns: ${segmentSummary}` : ''}
${playerContext ? `\nPLAYER-SPECIFIC HISTORY:\n${playerContext}` : ''}
${diagnosticProfile ? `\nBUYER PROFILE: ${diagnosticProfile.slice(0, 300)}` : ''}

RULES:
- Be conversational and brief (2–3 sentences max in your reply)
- When you understand what they want, output a searchQuery
- The searchQuery should be optimised for eBay title search — specific but not over-filtered
- listingType: "auction" finds better deals; "fixed" for Buy It Now; "all" for both
- If they've profited on a specific card type for a player, suggest that type
- If they mention a player you have history on, reference it — e.g. "You've done well with his PSA 9s"
- Do NOT restrict to past patterns — they can explore new territory
- maxBuyPrice: suggest based on their category rules and deal history; null if unclear

Always respond with valid JSON:
{
  "reply": "conversational response",
  "searchQuery": "eBay search string" or null if not a search request,
  "listingType": "all" | "auction" | "fixed",
  "category": "low end" | "mid end" | "high end" | "quick sell" | "margin bet" | "",
  "maxBuyPrice": number or null
}`;

  // Format conversation for Claude
  const claudeMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  try {
    const response = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:     systemPrompt,
      messages:   claudeMessages,
    });

    const text      = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Graceful fallback if Claude doesn't return JSON
      return Response.json({ reply: text.slice(0, 300), searchQuery: null });
    }
    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error('[chat-search]', e?.message);
    return Response.json({ error: e?.message }, { status: 502 });
  }
}
