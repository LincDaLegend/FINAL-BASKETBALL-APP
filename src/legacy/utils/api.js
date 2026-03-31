import { EBAY_FINDING_API, PHP_RATE } from './constants.js';

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

export function scoreVerdict(score) {
  if (score >= 70) return { label: 'buy now',  cls: 'badge-buy' };
  if (score >= 45) return { label: 'consider', cls: 'badge-consider' };
  return              { label: 'skip',      cls: 'badge-skip' };
}

export function toPhp(usd, rate = PHP_RATE) {
  return '₱' + (usd * rate).toLocaleString('en-PH', { maximumFractionDigits: 0 });
}

// Note: In Next.js/Vercel we proxy eBay requests via /api/ebay/search.
// This keeps eBay calls off the browser and avoids CORS issues.
export async function searchEbay(query, category) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (category) params.set('category', category);

  const resp = await fetch(`/api/ebay/search?${params.toString()}`);
  if (!resp.ok) {
    let message = `eBay proxy error: ${resp.status}`;
    try {
      const data = await resp.json();
      if (data?.error) message = data.error;
    } catch {}
    throw new Error(message);
  }

  const data = await resp.json();
  return Array.isArray(data?.items) ? data.items : [];
}

// Keep exported constant for compatibility (not used in client now)
export { EBAY_FINDING_API };

