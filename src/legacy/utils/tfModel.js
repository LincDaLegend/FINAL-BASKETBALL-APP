// TensorFlow.js neural network — v3 architecture with player/set hash embeddings
// and explicit player×card-type interaction features.
//
// Architecture: Dense(50→48, relu) → Dropout(0.2) → Dense(48→24, relu) → Dense(24→8, relu) → Dense(8→1, sigmoid)
//
// Input vector (50 dims):
//   [0–18]  19 binary card features (Prizm, Chrome, PSA10, Rookie, etc.)
//   [19]    price_norm           — listing price ÷ max deal price, clamped 0–1
//   [20]    aesthetic_norm       — aesthetic score ÷ 10
//   [21–36] player_hash[16]      — deterministic hash embedding of player name
//   [37–44] set_hash[8]          — deterministic hash embedding of card set name
//   [45–49] interactions[5]      — player_hash[i] × card_feature for top 5 features
//                                   [prizm, chrome, psa9, psa10, rookie]
//                                   Each encodes "THIS player + THIS card type"
//                                   distinctly from any other player+type combo.
//
// The interaction features let the model learn that "Luka + Prizm + PSA9" is a
// different signal from "Unknown player + Prizm + PSA9" — same card type, but the
// player identity changes the profitability expectation.
//
// v3 storage key: 'baller-tf-model-v3'

import * as tf from '@tensorflow/tfjs';
import { FEATURE_KEYS, extractFeatures } from './ml.js';

const STORAGE_KEY  = 'localstorage://baller-tf-model-v5';

const PLAYER_EMBED_DIM  = 16;
const SET_EMBED_DIM     = 8;
const INTERACTION_DIM   = 6;  // player_hash[i] × {prizm, chrome, psa9, psa10, rookie, auto}
// FEATURE_DIM is computed from FEATURE_KEYS.length so it automatically stays in sync
// as features are added. Current total: 49 binary + 1 price + 1 aesthetic + 16 + 8 + 6 = 81
export const FEATURE_DIM = FEATURE_KEYS.length + 1 + 1 + PLAYER_EMBED_DIM + SET_EMBED_DIM + INTERACTION_DIM;

// ─── Hash embedding ───────────────────────────────────────────────────────────
// Maps any string to a deterministic unit-norm float vector of length `dim`.
// Uses character-level trigonometric hashing: different strings → different vectors,
// similar strings → somewhat similar vectors (approximate locality sensitivity).
export function hashEmbed(str, dim) {
  const s   = (str || '').toUpperCase().trim();
  const vec = new Float32Array(dim);
  if (!s.length) return Array.from(vec); // zero vector for empty string

  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    for (let j = 0; j < dim; j++) {
      // Different frequency per dimension so information spreads evenly
      vec[j] += Math.sin(code * (i + 1) * (j + 1) * 0.09)
              + Math.cos(code * (j + 1) * 0.13);
    }
  }

  // L2 normalise to unit sphere — magnitude doesn't carry meaning
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec).map(v => v / norm);
}

// ─── Model factory ────────────────────────────────────────────────────────────
export function buildModel() {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [FEATURE_DIM],
        units: 48,  // wider first layer — more capacity to learn player×feature patterns
        activation: 'relu',
        kernelInitializer: 'glorotUniform',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 24,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
      }),
      tf.layers.dense({ units: 8,  activation: 'relu' }),
      tf.layers.dense({ units: 1,  activation: 'sigmoid' }),
    ],
  });
  model.compile({
    optimizer: tf.train.adam(0.003),
    loss: 'binaryCrossentropy',
  });
  return model;
}

// ─── Feature engineering ──────────────────────────────────────────────────────
// Converts a listing to a FEATURE_DIM-length float vector.
// Automatically adapts to FEATURE_KEYS.length — no hardcoded indices.
export function listingToVector(listing, maxPrice = 200) {
  const feats         = extractFeatures(listing);
  const binary        = FEATURE_KEYS.map(k => feats[k] ?? 0);
  const priceNorm     = Math.min(1, Math.max(0, (listing.price || 0) / maxPrice));
  const aestheticNorm = Math.min(1, (listing.aestheticScore || 5) / 10);

  // Extract player name: use explicit field, or first 2–3 words of the title
  const player = listing.player
    || (listing.title || '').split(/\s+/).slice(0, 3).join(' ');

  // Card set: use explicit field, or infer from known set keywords in title
  const t = (listing.title || '').toUpperCase();
  const knownSet = ['PRIZM','CHROME','OPTIC','MOSAIC','SELECT','DONRUSS','HOOPS','TOPPS','BOWMAN']
    .find(s => t.includes(s)) || '';
  const cardSet  = listing.set || knownSet;

  const playerEmbed = hashEmbed(player,  PLAYER_EMBED_DIM);
  const setEmbed    = hashEmbed(cardSet, SET_EMBED_DIM);

  // Interaction features: player_hash[i] × top card type feature
  // Each dim encodes "this specific player + this card type" as a continuous signal.
  // Uses different hash dimensions per feature so interactions are orthogonal.
  // auto is included here to fix the core issue: buying Jordan Clarkson autos ≠ wanting base cards.
  const interactions = [
    feats.prizm   * playerEmbed[0],   // player identity × prizm
    feats.chrome  * playerEmbed[1],   // player identity × chrome
    feats.psa9    * playerEmbed[2],   // player identity × PSA 9
    feats.psa10   * playerEmbed[3],   // player identity × PSA 10
    feats.rookie  * playerEmbed[4],   // player identity × rookie
    feats.auto    * playerEmbed[5],   // player identity × autograph ← fixes auto/base confusion
  ];

  return [...binary, priceNorm, aestheticNorm, ...playerEmbed, ...setEmbed, ...interactions];
}

// Converts a logged deal → pseudo-listing for feature extraction
function dealToListing(deal) {
  return {
    title:         [deal.player, deal.set, deal.variant, deal.grade].filter(Boolean).join(' '),
    grade:         deal.grade      || 'raw',
    price:         deal.buyPrice   || 0,
    aestheticScore: deal.aesthetic || 5,
    player:        deal.player     || '',
    set:           deal.set        || '',
  };
}

// ─── Training ─────────────────────────────────────────────────────────────────
// Requires ≥ 3 deals. Returns true on success.
export async function trainOnDeals(model, deals) {
  if (!deals || deals.length < 3) return false;

  const sorted    = [...deals].sort((a, b) => (a.roi ?? 0) - (b.roi ?? 0));
  const medianROI = sorted[Math.floor(sorted.length / 2)]?.roi ?? 30;
  const maxPrice  = Math.max(...deals.map(d => d.buyPrice ?? 0), 200);

  const xs = [];
  const ys = [];

  // Real examples from deal history
  for (const deal of deals) {
    xs.push(listingToVector(dealToListing(deal), maxPrice));
    ys.push([(deal.roi ?? 0) >= medianROI ? 1 : 0]);
  }

  // Synthetic negatives — expensive, low-aesthetic, unknown player/set, no interactions
  const synthCount = Math.min(deals.length, 12);
  for (let i = 0; i < synthCount; i++) {
    const synth = new Array(FEATURE_DIM).fill(0).map(() => (Math.random() < 0.05 ? 1 : 0));
    // price_norm and aesthetic_norm sit right after the binary features
    const binaryLen = FEATURE_KEYS.length;
    synth[binaryLen]     = 0.85 + Math.random() * 0.15; // expensive
    synth[binaryLen + 1] = Math.random() * 0.3;          // low aesthetic
    // player/set hash dims and interaction dims all stay at 0 (unknown player)
    for (let j = binaryLen + 2; j < FEATURE_DIM; j++) synth[j] = 0;
    xs.push(synth);
    ys.push([0]);
  }

  const xTensor = tf.tensor2d(xs);
  const yTensor = tf.tensor2d(ys);

  await model.fit(xTensor, yTensor, {
    epochs:    120,
    batchSize: Math.max(2, Math.min(8, xs.length)),
    shuffle:   true,
    verbose:   0,
  });

  xTensor.dispose();
  yTensor.dispose();
  return true;
}

// ─── Persistence ──────────────────────────────────────────────────────────────
export async function saveModel(model) {
  try {
    await model.save(STORAGE_KEY);
  } catch (e) {
    console.warn('[tfModel] save failed:', e);
  }
}

export async function loadModel() {
  try {
    const model = await tf.loadLayersModel(STORAGE_KEY);
    // Verify input shape matches current architecture before returning
    const expectedDim = FEATURE_DIM;
    const actualDim   = model.inputs[0]?.shape?.[1];
    if (actualDim !== expectedDim) {
      console.info(`[tfModel] Saved model has ${actualDim} inputs, expected ${expectedDim}. Rebuilding.`);
      return null;
    }
    model.compile({ optimizer: tf.train.adam(0.003), loss: 'binaryCrossentropy' });
    return model;
  } catch {
    return null;
  }
}

// ─── Inference ────────────────────────────────────────────────────────────────
// Returns an integer 0–100, or null if model not ready.
export function predictScore(model, listing, maxPrice = 200) {
  if (!model) return null;
  return tf.tidy(() => {
    const vec    = listingToVector(listing, maxPrice);
    const tensor = tf.tensor2d([vec]);
    const pred   = model.predict(tensor);
    return Math.round(pred.dataSync()[0] * 100);
  });
}
