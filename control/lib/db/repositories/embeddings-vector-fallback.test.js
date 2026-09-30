// The vector path with no vectors to rank: the recall group is installed (the embedder answers), but the
// rows for the requested kinds were written text-only (before the group arrived, or before its index was
// built) and a short-lived CLI process never waits for the boot backfill. search() must answer lexically
// over those rows rather than return nothing, and rank by vector once vectors exist.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

const state = vi.hoisted(() => ({ available: false }));

vi.mock('../../embedder/local.js', () => {
  class RecallUnavailableError extends Error {
    constructor() {
      super('The embedding runtime (the `recall` install group) is not installed on this host');
      this.code = 'RECALL_UNAVAILABLE';
    }
  }
  // a deterministic 384-d vector per text: the character codes folded into the dimensions
  const vec = (text) => {
    const v = new Array(384).fill(0);
    for (let i = 0; i < text.length; i += 1) v[i % 384] += text.charCodeAt(i) / 1000;
    const n = Math.hypot(...v) || 1;
    return v.map((x) => x / n);
  };
  return {
    LOCAL_EMBEDDING_MODEL: 'multilingual-e5-small',
    LOCAL_EMBEDDING_DIM: 384,
    recallInstallLine: () => 'run `npx -y mojulo@3.0.0 install recall`',
    RecallUnavailableError,
    embedderAvailable: () => state.available,
    preloadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn(async (texts) => {
      if (!state.available) throw new RecallUnavailableError();
      return texts.map(vec);
    }),
  };
});

import { closeDb, getDb } from '../index.js';
import { EmbeddingsRepository } from './embeddings.js';

beforeEach(() => {
  closeDb();
  process.env.SQLITE_PATH = ':memory:';
  getDb();
});

afterAll(() => closeDb());

async function seed(sourceKind, sourceRef, bodyText) {
  const e = await EmbeddingsRepository.embed(sourceKind, sourceRef, bodyText);
  return EmbeddingsRepository.upsertSync({ ...e, sourceKind, sourceRef, bodyText });
}

describe('vector search with no vectors for the requested kinds', () => {
  it('answers lexically over the text-only rows instead of returning nothing', async () => {
    state.available = false;
    await seed('routing', 'world', 'when: build a little town I can walk around in');
    await seed('routing', 'song', 'when: write a song about the sea');
    state.available = true;
    const r = await EmbeddingsRepository.search('a little town to walk around', { kinds: ['routing'], withMeta: true });
    expect(r.mode).toBe('lexical');
    expect(r.results.map((x) => x.source_ref)).toContain('world');
  });

  it('ranks by vector once the rows carry vectors', async () => {
    state.available = true;
    await seed('routing', 'world', 'when: build a little town I can walk around in');
    await seed('routing', 'song', 'when: write a song about the sea');
    const r = await EmbeddingsRepository.search('build a little town I can walk around in', { kinds: ['routing'], withMeta: true });
    expect(r.mode).toBe('vector');
    expect(r.results[0].source_ref).toBe('world');
  });
});
