/**
 * Embedding-based card router for the polygonizer.
 *
 * Replaces the Haiku-class classifier LLM call in `classifyPromptForCards`
 * with a local-embedding similarity lookup against the render-primitive +
 * recipe card descriptions. Same job (pick the cards a prompt likely needs
 * so the manifest system prompt only ships relevant grammar), one cheap
 * local CPU call instead of a network LLM round-trip.
 *
 * Geometric model: multilingual-e5-small q8 produces L2-normalized 384-dim
 * vectors, so cosine similarity reduces to a plain dot product. e5 expects
 * `passage:` prefix for documents and `query:` prefix for queries; the
 * embedder owns that convention.
 *
 * Card vectors are computed lazily on first call and cached for the lifetime
 * of the process. The catalog is curated (file-system loaded by the sketch
 * vocab loader); changes only happen at deploy time, so no invalidation
 * mechanism is needed at runtime.
 *
 * Threshold posture: be inclusive but not exhaustive — that was the LLM
 * classifier's instruction, and it still applies. We always include the
 * top match (never return empty), then take up to `topK` more cards whose
 * similarity clears `minSim`. The defaults are tuned for the polygonizer's
 * 25-card catalog and short prompt-style queries.
 */

import { generateEmbeddings as defaultEmbed } from '../../embedder/local.js';
import { listSketchVocab } from '../sketch-vocab/loader.js';

let _cardVectorCache = null;

// Semantic cache: maps prior prompt embeddings → results, so a *near*-
// duplicate of a previously-routed prompt (cosine ≥ SEMANTIC_CACHE_THRESHOLD)
// short-circuits the scoring pass. The existing prompt-hash cache in
// `classifyPromptForCards` catches *exact* duplicates; this catches the
// "redo page 4 but make the kettle copper" → "redo page 4 but copper kettle"
// case where the agent rephrases between iterations. Bounded FIFO; mojulo is
// single-user/self-hosted, so even a few hundred entries cost nothing.
const SEMANTIC_CACHE_LIMIT = 256;
const SEMANTIC_CACHE_THRESHOLD = 0.95;
const _semanticCache = [];

function cardEmbeddingText(card) {
  // Lead with the `when` clause — it's the intent-shaped hook the loader
  // requires precisely so embedding matches a goal-phrased query before it
  // matches implementation vocabulary the model doesn't know yet.
  return `When to use: ${card.when}\n\n${card.name}\n\n${card.summary}`;
}

async function ensureCardVectors(embedFn) {
  if (_cardVectorCache) return _cardVectorCache;
  const catalog = listSketchVocab({ tier: ['render-primitive', 'recipe'] });
  if (catalog.length === 0) {
    _cardVectorCache = [];
    return _cardVectorCache;
  }
  const texts = catalog.map(cardEmbeddingText);
  const vectors = await embedFn(texts, { inputType: 'search_document' });
  _cardVectorCache = catalog.map((card, i) => ({
    id: card.id,
    tier: card.tier,
    vector: vectors[i],
  }));
  return _cardVectorCache;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function findSemanticMatch(queryVec, threshold) {
  let bestSim = -Infinity;
  let bestIdx = -1;
  for (let i = 0; i < _semanticCache.length; i++) {
    const sim = dot(_semanticCache[i].embedding, queryVec);
    if (sim > bestSim) {
      bestSim = sim;
      bestIdx = i;
    }
  }
  if (bestIdx >= 0 && bestSim >= threshold) {
    return { result: _semanticCache[bestIdx].result, sim: bestSim };
  }
  return null;
}

function storeSemantic(queryVec, result) {
  _semanticCache.push({ embedding: queryVec, result });
  if (_semanticCache.length > SEMANTIC_CACHE_LIMIT) _semanticCache.shift();
}

/**
 * @param {object} opts
 * @param {string} opts.prompt — the visual prompt to route
 * @param {number} [opts.topK=6] — soft ceiling on returned cards
 * @param {number} [opts.minSim=0.65] — minimum cosine sim (beyond the top match)
 * @param {Function} [opts.embedFn] — injection seam for tests (defaults to local e5)
 * @returns {Promise<{ cards: string[], tiers: string[], scores: Array<{id:string,score:number}> }>}
 */
export async function routeCardsByEmbedding({
  prompt,
  topK = 6,
  minSim = 0.65,
  semanticCache = true,
  embedFn = defaultEmbed,
} = {}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('routeCardsByEmbedding requires a non-empty prompt string');
  }
  const cards = await ensureCardVectors(embedFn);
  if (cards.length === 0) {
    return { cards: [], tiers: [], scores: [] };
  }
  const [queryVec] = await embedFn([prompt], { inputType: 'search_query' });

  if (semanticCache) {
    const hit = findSemanticMatch(queryVec, SEMANTIC_CACHE_THRESHOLD);
    if (hit) {
      return {
        ...hit.result,
        semanticHit: { sim: Math.round(hit.sim * 1000) / 1000 },
      };
    }
  }

  const scored = cards.map((c) => ({
    id: c.id,
    tier: c.tier,
    score: dot(c.vector, queryVec),
  }));
  scored.sort((a, b) => b.score - a.score);
  const picked = scored.filter((c, i) => i === 0 || (i < topK && c.score >= minSim));
  const result = {
    cards: picked.map((c) => c.id),
    tiers: [...new Set(picked.map((c) => c.tier))],
    scores: picked.map((c) => ({ id: c.id, score: Math.round(c.score * 1000) / 1000 })),
  };

  if (semanticCache) storeSemantic(queryVec, result);
  return result;
}

export function _resetCardVectorCacheForTests() {
  _cardVectorCache = null;
  _semanticCache.length = 0;
}
