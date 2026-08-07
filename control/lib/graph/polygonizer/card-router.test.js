import { describe, it, expect, beforeEach } from 'vitest';

import {
  routeCardsByEmbedding,
  _resetCardVectorCacheForTests,
} from './card-router.js';

beforeEach(() => {
  _resetCardVectorCacheForTests();
});

// Embedder seam: callers pass a stub via `embedFn` so these tests run in
// microseconds with no model load. We control the geometry directly — each
// test asserts a property of the selection mechanic, not of the real
// embedding space.

describe('routeCardsByEmbedding', () => {
  it('returns the highest-similarity card first and always includes at least the top match', async () => {
    // Query points at axis 0; the passage for any card whose composed text
    // contains the marker aligns 1.0 on axis 0. Other passages lean 0.1 on
    // axis 0 — still cosine-positive but well below `minSim`. The marker
    // 'fluidField' appears in that card's `name` field and nowhere else in
    // the catalog, so this test asserts the router picks the right id.
    const marker = 'fluidField';
    const embedFn = async (texts, { inputType }) => {
      if (inputType === 'search_query') return [[1, 0, 0]];
      return texts.map((t) => (t.includes(marker) ? [1, 0, 0] : [0.1, 0.7, 0.7]));
    };
    const result = await routeCardsByEmbedding({
      prompt: 'smoke rising from a chimney',
      embedFn,
      minSim: 0.5,
    });
    expect(result.cards[0]).toBe('fluid-field');
    expect(result.tiers).toContain('render-primitive');
    // Scores are present + ordered descending.
    const scores = result.scores.map((s) => s.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('always returns at least one card even when nothing clears minSim', async () => {
    const embedFn = async (texts, { inputType }) => {
      if (inputType === 'search_query') return [[1, 0, 0]];
      // All weakly aligned — every sim ≈ 0.1.
      return texts.map(() => [0.1, 0.9, 0.4]);
    };
    const result = await routeCardsByEmbedding({
      prompt: 'a prompt that matches nothing well',
      embedFn,
      minSim: 0.95,
    });
    expect(result.cards.length).toBe(1);
  });

  it('caps the return list at topK', async () => {
    const embedFn = async (texts, { inputType }) => {
      if (inputType === 'search_query') return [[1, 0, 0]];
      // Every card perfectly aligned — without topK, we'd return all of them.
      return texts.map(() => [1, 0, 0]);
    };
    const result = await routeCardsByEmbedding({ prompt: 'p', embedFn, topK: 3 });
    expect(result.cards.length).toBe(3);
  });

  it('reuses the card vector cache across calls (only computes passage embeddings once)', async () => {
    const calls = { passage: 0, query: 0 };
    const embedFn = async (texts, { inputType }) => {
      if (inputType === 'search_query') {
        calls.query += 1;
        return [[1, 0, 0]];
      }
      calls.passage += 1;
      return texts.map(() => [1, 0, 0]);
    };
    await routeCardsByEmbedding({ prompt: 'first prompt', embedFn, topK: 2 });
    await routeCardsByEmbedding({ prompt: 'second prompt', embedFn, topK: 2 });
    expect(calls.passage).toBe(1);
    expect(calls.query).toBe(2);
  });

  it('rejects empty or non-string prompts with a clear message', async () => {
    const embedFn = async () => [[0]];
    await expect(routeCardsByEmbedding({ prompt: '', embedFn })).rejects.toThrow(/non-empty/);
    await expect(routeCardsByEmbedding({ prompt: 42, embedFn })).rejects.toThrow(/non-empty/);
  });

  it('semantic cache reuses a near-duplicate prompt result without rescoring', async () => {
    // Two prompts whose query embeddings are cosine ≈ 0.99 (above threshold).
    // The second call should hit the semantic cache and return without
    // recomputing the per-card scores.
    let queryCalls = 0;
    const close = [1, 0.05, 0.05]; // ≈ normalized; very close to [1,0,0]
    const closer = [1, 0.04, 0.04];
    const embedFn = async (texts, { inputType }) => {
      if (inputType === 'search_query') {
        queryCalls += 1;
        return [queryCalls === 1 ? close : closer];
      }
      return texts.map((t) => (t.includes('fluidField') ? [1, 0, 0] : [0.1, 0.7, 0.7]));
    };
    const first = await routeCardsByEmbedding({ prompt: 'smoke', embedFn, minSim: 0.5 });
    expect(first.semanticHit).toBeUndefined();
    expect(first.cards[0]).toBe('fluid-field');
    const second = await routeCardsByEmbedding({ prompt: 'smoke (rephrased)', embedFn, minSim: 0.5 });
    expect(second.semanticHit).toBeTruthy();
    expect(second.semanticHit.sim).toBeGreaterThan(0.95);
    expect(second.cards).toEqual(first.cards);
  });

  it('semantic cache does NOT hit when prompts are semantically distant', async () => {
    const embedFn = async (texts, { inputType }) => {
      if (inputType === 'search_query') {
        // Each call returns a different axis — cosine sim between them = 0.
        return [texts[0].includes('first') ? [1, 0, 0] : [0, 1, 0]];
      }
      return texts.map((t) => (t.includes('fluidField') ? [1, 0, 0] : [0.1, 0.7, 0.7]));
    };
    const first = await routeCardsByEmbedding({ prompt: 'first prompt', embedFn, minSim: 0.5 });
    const second = await routeCardsByEmbedding({ prompt: 'second prompt', embedFn, minSim: 0.5 });
    expect(first.semanticHit).toBeUndefined();
    expect(second.semanticHit).toBeUndefined();
  });

  it('honors semanticCache:false (bypasses cache entirely)', async () => {
    const same = [1, 0, 0];
    const embedFn = async (texts, { inputType }) => {
      if (inputType === 'search_query') return [same];
      return texts.map(() => [1, 0, 0]);
    };
    const first = await routeCardsByEmbedding({ prompt: 'p1', embedFn, semanticCache: false });
    const second = await routeCardsByEmbedding({ prompt: 'p2', embedFn, semanticCache: false });
    expect(first.semanticHit).toBeUndefined();
    expect(second.semanticHit).toBeUndefined();
  });
});
