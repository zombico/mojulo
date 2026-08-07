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
import { LocalCatalystRepository } from './local-catalysts.js';
import { EmbeddingsRepository } from './embeddings.js';
import { validateCatalystMeta } from '../../mcp/catalysts/loader.js';

beforeEach(() => {
  closeDb();
  getDb();
});

function validCatalyst(overrides = {}) {
  return validateCatalystMeta(
    {
      id: 'evening-digest',
      name: 'Evening Digest',
      summary: 'Digest the day into a channel',
      valueHook: 'A nightly summary without asking for it',
      category: 'digest',
      ...overrides,
    },
    overrides.body ?? '# Body\n\nMapping intent prose.',
  );
}

function embeddingRow(id) {
  return getDb()
    .prepare(`SELECT body_text, content_hash FROM meta_embeddings WHERE source_kind = 'catalyst' AND source_ref = ?`)
    .get(id);
}

describe('LocalCatalystRepository embedding mirror', () => {
  it('mint writes a catalyst-kind row using the shared body composition', async () => {
    await LocalCatalystRepository.createWithEmbedding({ catalyst: validCatalyst() });
    const row = embeddingRow('evening-digest');
    expect(row).toBeDefined();
    expect(row.body_text).toContain('# Evening Digest');
    expect(row.body_text).toContain('*A nightly summary without asking for it*');
    expect(row.body_text).toContain('Mapping intent prose.');
  });

  it('mint is searchable under kinds: [catalyst]', async () => {
    await LocalCatalystRepository.createWithEmbedding({ catalyst: validCatalyst() });
    // The mock embedder is a hash map — query with the exact stored body to
    // get cosine ~1; the assertion is about kind routing, not ranking.
    const row = embeddingRow('evening-digest');
    const results = await EmbeddingsRepository.search(row.body_text, { kinds: ['catalyst'] });
    expect(results.some((r) => r.source_ref === 'evening-digest')).toBe(true);
  });

  it('update re-embeds (hash changes) and archive deletes the row', async () => {
    await LocalCatalystRepository.createWithEmbedding({ catalyst: validCatalyst() });
    const before = embeddingRow('evening-digest');
    await LocalCatalystRepository.updateWithEmbedding({
      catalyst: validCatalyst({ body: '# Body v2\n\nRevised prose.' }),
      note: 'revise',
    });
    const after = embeddingRow('evening-digest');
    expect(after.content_hash).not.toBe(before.content_hash);
    expect(after.body_text).toContain('Revised prose.');

    LocalCatalystRepository.archive('evening-digest');
    expect(embeddingRow('evening-digest')).toBeUndefined();
  });
});
