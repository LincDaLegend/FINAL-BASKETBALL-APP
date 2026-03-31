import { EBAY_FINDING_API, ANTHROPIC_API, PHP_RATE } from './constants.js';

// ── eBay grade extraction ─────────────────────────────────────
export function extractGrade(title) {
  const t = title.toUpperCase();
  if (t.includes('PSA 10')) return 'PSA 10';
  if (t.includes('PSA 9'))  return 'PSA 9';
  if (t.includes('PSA 8'))  return 'PSA 8';
  if (t.includes('PSA 7'))  return 'PSA 7';
  if (t.includes('BGS 9.5')) return 'BGS 9.5';
  if (t.includes('BGS 9'))  return 'BGS 9';
  if (t.includes('SGC 9'))  return 'SGC 9';
  if (t.includes('SGC 8'))  return 'SGC 8';
  return 'raw';
}

// ── Estimate aesthetic score from title + condition ───────────
export function estimateAesthetic(title, condition) {
  const t = title.toUpperCase();
  let score = 5;
  if (t.includes('PRIZM'))       score += 1.5;
  if (t.includes('CHROME'))      score += 1.2;
  if (t.includes('OPTIC'))       score += 1.0;
  if (t.includes('GOLD'))        score += 1.2;
  if (t.includes('SILVER'))      score += 0.8;
  if (t.includes('HOLO'))        score += 0.8;
  if (t.includes('REFRACTOR'))   score += 1.0;
  if (t.includes('MOSAIC'))      score += 0.5;
  if (t.includes('CRACKED ICE')) score += 0.8;
  if (t.includes('HYPER'))       score += 1.0;
  if (t.includes('RC') || t.includes('ROOKIE')) score += 0.5;
  if (condition === 'Brand New' || condition === 'Like New') score += 0.5;
  return Math.min(10, Math.round(score * 10) / 10);
}

// ── Rule-based ML score ───────────────────────────────────────
export function ruleMLScore(listing, category, rules, deals) {
  const rule = rules[category];
  if (!rule) return 50;
  const price    = listing.price;
  const avgSold  = listing.avgSold || price * 1.35;
  const roi      = ((avgSold - price) / price) * 100;

  const priceScore = price <= rule.maxPrice ? 1 : Math.max(0, 1 - (price - rule.maxPrice) / rule.maxPrice);
  const roiScore   = roi >= rule.minROI ? 1 : Math.max(0, roi / Math.max(1, rule.minROI));

  const catDeals   = deals.filter(d => d.category === category);
  let mlBoost = 0;
  if (catDeals.length > 0) {
    const avgDealROI = catDeals.reduce((a, d) => a + (d.roi || 0), 0) / catDeals.length;
    mlBoost = Math.min(0.25, (roi / Math.max(1, avgDealROI)) * 0.2);
  }

  const aestheticBonus = listing.aestheticScore ? (listing.aestheticScore / 10) * 0.08 : 0;
  const raw = (priceScore * 0.38) + (roiScore * 0.42) + mlBoost + aestheticBonus;
  return Math.min(100, Math.round(raw * 100));
}

// ── Verdict from score ────────────────────────────────────────
export function scoreVerdict(score) {
  if (score >= 70) return { label: 'buy now',  cls: 'badge-buy' };
  if (score >= 45) return { label: 'consider', cls: 'badge-consider' };
  return              { label: 'skip',      cls: 'badge-skip' };
}

// ── PHP conversion ────────────────────────────────────────────
export function toPhp(usd, rate = PHP_RATE) {
  return '₱' + (usd * rate).toLocaleString('en-PH', { maximumFractionDigits: 0 });
}

// ── eBay Finding API search ───────────────────────────────────
export async function searchEbay(query, category, apiKey) {
  const keywords = [query, 'basketball card', category !== '' ? category : '']
    .filter(Boolean).join(' ');

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findItemsByKeywords',
    'SERVICE-VERSION': '1.0.3',
    'SECURITY-APPNAME': apiKey,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': '',
    'keywords': keywords,
    'paginationInput.entriesPerPage': '20',
    'itemFilter(0).name': 'Condition',
    'itemFilter(0).value(0)': '1000',
    'itemFilter(0).value(1)': '2000',
    'itemFilter(0).value(2)': '2500',
    'itemFilter(0).value(3)': '3000',
    'sortOrder': 'BestMatch',
  });

  const resp = await fetch(`${EBAY_FINDING_API}?${params}`);
  if (!resp.ok) throw new Error(`eBay API error: ${resp.status}`);
  const data = await resp.json();
  const items = data?.findItemsByKeywordsResponse?.[0]?.searchResult?.[0]?.item || [];

  return items.map(item => {
    const title     = item.title?.[0] || '';
    const price     = parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0);
    const imgUrl    = item.galleryURL?.[0] || '';
    const itemId    = item.itemId?.[0] || '';
    const viewUrl   = item.viewItemURL?.[0] || '';
    const condition = item.condition?.[0]?.conditionDisplayName?.[0] || 'Unknown';
    const grade     = extractGrade(title);
    const aestheticScore = estimateAesthetic(title, condition);
    return { title, price, imgUrl, itemId, viewUrl, condition, grade, aestheticScore, avgSold: price * 1.35 };
  });
}

// ── Claude AI scoring ─────────────────────────────────────────
export async function aiScoreListings(listings, playerQuery, category, rules, deals) {
  const rule = rules[category] || {};
  const ruleText = category
    ? `Category "${category}": max $${rule.maxPrice || 999}, min ROI ${rule.minROI || 20}%`
    : 'No specific category filter — general arbitrage';

  const pastContext = deals.slice(-25)
    .map(d => `${d.player} ${d.set} ${d.variant} | buy $${d.buyPrice} → sell $${d.sellPrice} | ${d.days}d | ROI ${d.roi}% | ${d.category} | aesthetic: ${d.aesthetic || 'n/a'}`)
    .join('\n');

  const listingText = listings.slice(0, 15)
    .map((l, i) => `[${i}] "${l.title}" | $${l.price.toFixed(2)} | grade:${l.grade} | aesthetic:${l.aestheticScore}/10 | condition:${l.condition}`)
    .join('\n');

  const resp = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: `You are an expert basketball card arbitrage analyst for a Philippines reseller buying from eBay US. You must score each listing based on:
1. ROI potential vs the reseller's past deals (primary ML signal)
2. Days to flip estimate from historical velocity
3. Card aesthetics: design (prizm/chrome/holo/gold > base), condition, eye appeal
4. Price vs category rules

Return ONLY valid JSON, no markdown, no extra text.
Format: {"scores":[{"idx":0,"score":85,"verdict":"buy now","roi_est":42,"days_est":5,"reason":"12 words max why","aesthetic_note":"brief design/condition note"}]}
Verdict must be exactly: "buy now", "consider", or "skip"`,
      messages: [{
        role: 'user',
        content: `Player search: "${playerQuery}" | ${ruleText}

Past deals (ML training data — learn from these):
${pastContext || 'No past deals yet — use category rules only'}

Listings to score:
${listingText}

Return JSON scores array for all ${Math.min(listings.length, 15)} listings.`,
      }],
    }),
  });

  if (!resp.ok) throw new Error(`Anthropic API error: ${resp.status}`);
  const data = await resp.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '{}';

  let parsed;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    parsed = { scores: [] };
  }

  const scoreMap = {};
  (parsed.scores || []).forEach(s => { scoreMap[s.idx] = s; });
  return scoreMap;
}
