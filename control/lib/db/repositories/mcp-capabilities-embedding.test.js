process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED_BACKFILL_ONLY = '1';

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../embedder/local.js', async () => {
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
    generateEmbeddings: vi.fn(async (texts) => texts.map(vectorFromText)),
  };
});

import { closeDb, getDb } from '../index.js';
import { CapabilitiesRepository } from './mcp-capabilities.js';
import { EmbeddingsRepository } from './embeddings.js';

beforeEach(() => {
  closeDb();
});

describe('CapabilitiesRepository.insertWithEmbedding', () => {
  it('writes a meta_embeddings row keyed on provider_ref', async () => {
    getDb();
    const result = await CapabilitiesRepository.insertWithEmbedding({
      providerRef: 'gmail',
      displayName: 'Gmail',
      bodyMd: 'gmail v1 body',
      sourceUrls: ['https://developers.google.com/gmail'],
    });
    expect(result.providerRef).toBe('gmail');
    const row = EmbeddingsRepository.findByRef('mcp_capability', 'gmail');
    expect(row).not.toBe(null);
    expect(row.bodyText).toBe('gmail v1 body');
  });

  it('supersession overwrites the embedding (one row per provider)', async () => {
    getDb();
    await CapabilitiesRepository.insertWithEmbedding({
      providerRef: 'gmail',
      bodyMd: 'gmail v1 body',
    });
    await CapabilitiesRepository.insertWithEmbedding({
      providerRef: 'gmail',
      bodyMd: 'gmail v2 body',
    });
    const db = getDb();
    const rows = db
      .prepare("SELECT body_text FROM meta_embeddings WHERE source_kind = 'mcp_capability'")
      .all();
    expect(rows).toHaveLength(1);
    expect(rows[0].body_text).toBe('gmail v2 body');
  });

  it('atomicity — rolls back embedding if the supersession step throws', async () => {
    getDb();
    await CapabilitiesRepository.insertWithEmbedding({
      providerRef: 'gmail',
      bodyMd: 'gmail v1 body',
    });
    // Bad call shouldn't leave a dangling embedding.
    await expect(
      CapabilitiesRepository.insertWithEmbedding({
        providerRef: '',
        bodyMd: 'rogue body',
      }),
    ).rejects.toThrow();
    const row = EmbeddingsRepository.findByRef('mcp_capability', 'gmail');
    expect(row).not.toBe(null);
    expect(row.bodyText).toBe('gmail v1 body');
  });

  it('soft-skips when MOJULO_SEMANTIC_INDEX_DISABLED=1 — capability still commits', async () => {
    const original = process.env.MOJULO_SEMANTIC_INDEX_DISABLED;
    process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
    try {
      getDb();
      const result = await CapabilitiesRepository.insertWithEmbedding({
        providerRef: 'notion',
        bodyMd: 'notion body',
      });
      expect(result.providerRef).toBe('notion');
      expect(EmbeddingsRepository.findByRef('mcp_capability', 'notion')).toBe(null);
    } finally {
      process.env.MOJULO_SEMANTIC_INDEX_DISABLED = original;
    }
  });
});

describe('search() filters out superseded capability rows', () => {
  it('returns the current row, not an orphan keyed on a missing provider', async () => {
    getDb();
    await CapabilitiesRepository.insertWithEmbedding({
      providerRef: 'gmail',
      bodyMd: 'gmail body',
    });
    // Manually stash an "orphan" embedding for a provider that never had a
    // capability row created — search must filter it out.
    const orphan = await EmbeddingsRepository.embed(
      'mcp_capability',
      'no-such-provider',
      'orphan body',
    );
    EmbeddingsRepository.upsertSync({
      sourceKind: 'mcp_capability',
      sourceRef: 'no-such-provider',
      bodyText: 'orphan body',
      hash: orphan.hash,
      vector: orphan.vector,
    });
    const results = await EmbeddingsRepository.search('orphan body', {
      kinds: ['mcp_capability'],
    });
    expect(results.find((r) => r.source_ref === 'no-such-provider')).toBeUndefined();
  });
});
