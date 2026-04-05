import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Topics Claude has available to probe — ensures full coverage before concluding
const PROBE_TOPICS = [
  'card finish (silver/gold/refractor/holo/cracked ice)',
  'set brand (Prizm vs Optic vs Chrome vs Mosaic)',
  'grade preference (PSA 10 vs PSA 9 vs raw)',
  'rarity (numbered /10 /25 /49 vs base parallel)',
  'player tier (established star vs rising rookie)',
  'era (modern active player vs all-time legend)',
  'grading company (PSA vs BGS vs SGC)',
  'card style (chrome refractor vs standard base)',
  'price tier (low entry <$30 vs premium $100+)',
  'flip speed (fast liquid base vs slower premium)',
];

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

  const { picks = [], deals = [], segments = [], round = 0 } = body;

  // Summarise picks
  const pickSummary = picks.length === 0
    ? 'No picks yet — this is the first question.'
    : picks.map((p, i) => `Round ${i + 1} (${p.label}): picked "${p.chosenHint}" over "${p.rejectedHint}"${p.skipped ? ' (skipped)' : ''}`).join('\n');

  // Segments shown as background context only — NOT used to restrict questions
  let segmentContext = '';
  if (segments.length > 0) {
    segmentContext = `\nBUYING PATTERNS IDENTIFIED (informational — do NOT limit questions to these ranges):\n` +
      segments.map(s =>
        `- "${s.name}": buy $${s.priceRange?.min}–$${s.priceRange?.max}, grades: ${(s.typicalGrades||[]).join('/')}, sets: ${(s.typicalSets||[]).join('/')}, avg ROI: +${s.avgROI}%, ${s.dealCount} deals`
      ).join('\n');
  }

  const dealContext = deals.length > 0
    ? `Deal history: ${deals.length} deals. Avg ROI: ${Math.round(deals.reduce((a, d) => a + (d.roi || 0), 0) / deals.length)}%.`
    : 'No deal history yet.';

  const coveredTopics = picks.filter(p => !p.skipped).map(p => p.label).join(', ') || 'none yet';
  const topicsRemaining = PROBE_TOPICS.filter(t => !picks.some(p => p.label && t.toLowerCase().includes(p.label.toLowerCase().split(' ')[0]))).join(', ');

  const prompt = `You are a sports trading card arbitrage preference profiler. Your goal is to understand this flipper's exact sourcing preferences through A/B comparisons, then generate a confident buyer profile.

${dealContext}
${segmentContext}

Picks so far (${picks.length} rounds completed):
${pickSummary}

Topics covered: ${coveredTopics}
Topics still uncovered: ${topicsRemaining}

Your task:
${round < 6 ? `Ask round ${round + 1}. Focus on a topic NOT yet covered. You have complete freedom to choose any card at any price point — do not restrict to past buying ranges.` : `You have ${picks.length} data points. Decide: are you confident enough to conclude, or do you need 1-2 more targeted questions?`}

Rules:
- Include the expected price in each card's description so comparisons are grounded in real cost
- Make the cards specific (player, year, set, variant, grade)
- The eBay search queries should return actual listings
- Cover a broad range of price points across rounds — do not cluster all questions in one price tier
- After 8+ picks with broad coverage, you may conclude
- NEVER conclude before 6 rounds
- When concluding, write a detailed multi-paragraph profile (minimum 120 words)

Respond ONLY with valid JSON:
{
  "label": "short topic label (2-3 words)",
  "question": "Which card would you rather source?",
  "analysis": "2-3 sentence analysis of what you've learned from picks so far, and what this next question will reveal.",
  "A": {
    "query": "eBay search string for card A",
    "hint": "Player · Set · Grade",
    "description": "1-2 sentence why this card is interesting to source"
  },
  "B": {
    "query": "eBay search string for card B",
    "hint": "Player · Set · Grade",
    "description": "1-2 sentence why this card is interesting to source"
  },
  "confident": false
}

OR if concluding:
{
  "confident": true,
  "analysis": "Brief final statement",
  "profile": "Detailed multi-paragraph profile of this buyer's preferences, strengths, ideal categories, risk tolerance, and recommended sourcing strategy. Minimum 120 words.",
  "recommendedSearches": [
    { "query": "eBay search query", "label": "Short label", "reason": "Why this fits their profile" },
    { "query": "...", "label": "...", "reason": "..." },
    { "query": "...", "label": "...", "reason": "..." },
    { "query": "...", "label": "...", "reason": "..." },
    { "query": "...", "label": "...", "reason": "..." }
  ]
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'Could not parse response', raw: text.slice(0, 200) }, { status: 502 });
    }
    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error('[diagnostic] Claude error:', e?.message);
    return Response.json({ error: e?.message || 'Claude request failed' }, { status: 502 });
  }
}
