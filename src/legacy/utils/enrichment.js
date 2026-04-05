// Enrichment orchestrator — runs after xlsx import.
// Phase 1: Claude extracts set/year/grade/variant/aesthetic from partial deal data (text, batched)
// Phase 2: eBay image search per deal — stores imgUrl for display and aesthetic context
// Phase 3: Claude segments the full enriched deal history
// Phase 4: Retrain TF model on enriched data

import { state, persistDeals, persistSettings } from './state.js';
import { trainOnDeals, saveModel } from './tfModel.js';
import { buildEmbeddingModel } from './embedding.js';
import { searchEbayQuick } from './api.js';

const ENRICH_BATCH = 25; // deals per Claude call
const IMAGE_BATCH  = 5;  // concurrent eBay image lookups

export async function startEnrichment() {
  const deals = state.deals;
  if (!deals.length) return;

  // ── Phase 1: Extract card details ─────────────────────────────────────────
  state.enrichmentProgress = { phase: 'details', current: 0, total: deals.length, done: false };
  window.renderApp();

  for (let i = 0; i < deals.length; i += ENRICH_BATCH) {
    const batch = deals.slice(i, i + ENRICH_BATCH);
    state.enrichmentProgress.current = i;
    window.renderApp();

    try {
      const resp = await fetch('/api/enrich-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deals: batch }),
      });
      if (!resp.ok) continue;

      const { enriched = [] } = await resp.json();

      enriched.forEach(e => {
        const deal = deals[i + e.index];
        if (!deal) return;
        // Only fill in fields that are missing or still at default values
        if (e.set      && !deal.set)                             deal.set      = e.set;
        if (e.year     && !deal.year)                            deal.year     = e.year;
        if (e.grade    && (!deal.grade || deal.grade === 'raw') && e.grade !== 'raw') deal.grade = e.grade;
        if (e.variant  && !deal.variant)                         deal.variant  = e.variant;
        if (e.aestheticScore)                                    deal.aesthetic = e.aestheticScore;
        if (e.ebayQuery)                                         deal._ebayQuery = e.ebayQuery;
        deal._enriched   = true;
        deal._confidence = e.confidence || 'medium';
      });
    } catch (err) {
      console.warn('[enrich phase 1 batch]', err);
    }
  }

  persistDeals();

  // ── Phase 2: eBay image search ────────────────────────────────────────────
  state.enrichmentProgress = { phase: 'images', current: 0, total: deals.length, done: false };
  window.renderApp();

  for (let i = 0; i < deals.length; i += IMAGE_BATCH) {
    const batch = deals.slice(i, i + IMAGE_BATCH);
    state.enrichmentProgress.current = i;

    await Promise.allSettled(batch.map(async (deal) => {
      if (deal.imgUrl) return; // already have one
      const query = deal._ebayQuery || [deal.player, deal.set, deal.grade].filter(Boolean).join(' ');
      if (!query) return;
      try {
        const listing = await searchEbayQuick(query);
        if (listing?.imgUrl) deal.imgUrl = listing.imgUrl;
      } catch { /* silent — images are non-critical */ }
    }));

    window.renderApp();
  }

  persistDeals();

  // ── Phase 3: Segment analysis ─────────────────────────────────────────────
  state.enrichmentProgress = { phase: 'segments', current: deals.length, total: deals.length, done: false };
  window.renderApp();

  try {
    const resp = await fetch('/api/segment-deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deals }),
    });
    if (resp.ok) {
      const data = await resp.json();
      state.segments = data.segments || [];
      persistSettings();
    }
  } catch (err) {
    console.warn('[enrich phase 3 segments]', err);
  }

  // ── Phase 4: Rebuild semantic embedding model ──────────────────────────────
  try {
    state.embModel = buildEmbeddingModel(deals);
  } catch (err) {
    console.warn('[enrich embedding]', err);
  }

  // ── Phase 5: Retrain TF neural network ────────────────────────────────────
  if (state.tfModel && deals.length >= 3) {
    try {
      await trainOnDeals(state.tfModel, deals);
      await saveModel(state.tfModel);
      state.tfModelReady = true;
    } catch (err) {
      console.warn('[enrich TF retrain]', err);
    }
  }

  state.enrichmentProgress = { phase: 'done', current: deals.length, total: deals.length, done: true };
  window.renderApp();
}
