// Weak-retrieval decoration (routing-context-weaving.plan.md C1/C2): the
// semantic_search tool turns silent misses into one-hop recoveries — a weak or
// empty result carries an in-band `hint`, and a query-embed failure carries
// `degraded: true` instead of masquerading as "nothing matches". Same
// deterministic hash-embedder mock as semantic-search.integration.test.js,
// plus a magic token that makes the query embed THROW to drive the degraded
// path.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/embedder/local', async () => {
  const { createHash } = await import('node:crypto');
  const LOCAL_EMBEDDING_DIM = 384;
  function vectorFromText(text) {
    const v = new Float32Array(LOCAL_EMBEDDING_DIM);
    const buf = createHash('sha512').update(text).digest();
    for (let i = 0; i < LOCAL_EMBEDDING_DIM; i++) v[i] = (buf[i % buf.length] - 128) / 128;
    let mag = 0;
    for (let i = 0; i < v.length; i++) mag += v[i] * v[i];
    mag = Math.sqrt(mag) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= mag;
    return Array.from(v);
  }
  return {
    LOCAL_EMBEDDING_MODEL: 'multilingual-e5-small',
    LOCAL_EMBEDDING_DIM,
    preloadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn(async (texts) => {
      if (texts.some((t) => t.includes('__EMBED_FAIL__'))) {
        throw new Error('mock embed failure');
      }
      return texts.map(vectorFromText);
    }),
  };
});

import { closeDb, getDb } from '@/lib/db/index';
import { EmbeddingsRepository } from '@/lib/db/repositories/embeddings';
import { semanticSearchHandler } from './semantic-search.js';

beforeEach(() => {
  closeDb();
  getDb();
});

async function seed(sourceKind, sourceRef, bodyText) {
  const e = await EmbeddingsRepository.embed(sourceKind, sourceRef, bodyText);
  EmbeddingsRepository.upsertSync({
    sourceKind,
    sourceRef,
    bodyText,
    hash: e.hash,
    vector: e.vector,
  });
}

describe('semantic_search weak/degraded decoration', () => {
  it('a strong match carries no hint and no degraded flag', async () => {
    // Hash-mock: identical text → identical vector → cosine 1.
    await seed('catalyst', 'strong', 'exactly this phrasing');
    const out = await semanticSearchHandler({ query: 'exactly this phrasing' });
    expect(out.results).toHaveLength(1);
    expect(out.hint).toBeUndefined();
    expect(out.degraded).toBeUndefined();
    expect(out._telemetrySignal.degraded).toBeUndefined();
  });

  it('an empty result set carries the weak hint (leads-not-answers)', async () => {
    const out = await semanticSearchHandler({ query: 'anything at all' });
    expect(out.results).toEqual([]);
    expect(out.degraded).toBeUndefined();
    expect(out.hint).toContain('leads, not answers');
    expect(out._telemetrySignal.result_count).toBe(0);
  });

  it('a weak top score carries the weak hint with the score named', async () => {
    // Hash-mock vectors for unrelated strings land near 0 cosine — well below
    // the shared threshold.
    await seed('catalyst', 'unrelated', 'completely different subject matter');
    const out = await semanticSearchHandler({ query: 'quarterly finance rollup' });
    expect(out.results).toHaveLength(1);
    expect(out.results[0].score).toBeLessThan(0.35);
    expect(out.hint).toContain('Weak match');
    expect(out.hint).toContain('top score');
  });

  it('a weak ROUTING search gets the routing-specific hint (forward_context, FORM rephrase)', async () => {
    const out = await semanticSearchHandler({
      query: 'zxqv nonsense intent',
      kinds: ['routing'],
    });
    expect(out.hint).toContain("forward_context({mode:'studio'})");
    expect(out.hint).toContain('FORM');
  });

  it('query-embed failure → degraded: true + recovery hint, and the signal records it', async () => {
    const out = await semanticSearchHandler({ query: 'find __EMBED_FAIL__ things' });
    expect(out.results).toEqual([]);
    expect(out.degraded).toBe(true);
    expect(out.hint).toContain('does NOT mean nothing matches');
    expect(out.hint).toContain('reindex-embeddings');
    expect(out._telemetrySignal).toMatchObject({ result_count: 0, degraded: true });
  });

  it('withMeta is additive — the bare repo search API still returns a plain array', async () => {
    await seed('catalyst', 'plain', 'plain shape check');
    const arr = await EmbeddingsRepository.search('plain shape check', {});
    expect(Array.isArray(arr)).toBe(true);
    const failed = await EmbeddingsRepository.search('__EMBED_FAIL__', {});
    expect(failed).toEqual([]);
  });
});
