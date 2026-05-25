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
import { ProviderArtifactRepository } from './mcp-orbit-provider-artifacts.js';
import { EmbeddingsRepository } from './embeddings.js';

beforeEach(() => {
  closeDb();
});

function baseParams(overrides = {}) {
  return {
    primitiveRef: 'document-store@0.1.0',
    role: 'source',
    server: 'claude_ai_Google_Drive',
    introspectedAt: '2026-05-24T18:00:00Z',
    snapshotConfidence: 'tools_list_full',
    bodyMd: '# Provider artifact body\n\nSome text describing the artifact.',
    manifest: { bound: [], unbound: [], declaredCount: 0 },
    bindings: {},
    ...overrides,
  };
}

describe('ProviderArtifactRepository.insertWithEmbedding', () => {
  it('writes a meta_embeddings row keyed on the generated ref', async () => {
    getDb();
    const artifact = await ProviderArtifactRepository.insertWithEmbedding(baseParams());
    expect(artifact.ref).toMatch(/^prov_/);
    const row = EmbeddingsRepository.findByRef('orbit_artifact', artifact.ref);
    expect(row).not.toBe(null);
    expect(row.bodyText).toContain('Provider artifact body');
  });

  it('soft-skips when MOJULO_SEMANTIC_INDEX_DISABLED=1', async () => {
    const original = process.env.MOJULO_SEMANTIC_INDEX_DISABLED;
    process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
    try {
      getDb();
      const artifact = await ProviderArtifactRepository.insertWithEmbedding(baseParams());
      expect(EmbeddingsRepository.findByRef('orbit_artifact', artifact.ref)).toBe(null);
    } finally {
      process.env.MOJULO_SEMANTIC_INDEX_DISABLED = original;
    }
  });

  it('atomicity — rolls back artifact + embedding on bad payload', async () => {
    getDb();
    await expect(
      ProviderArtifactRepository.insertWithEmbedding(
        baseParams({ role: 'sideways' }),
      ),
    ).rejects.toThrow();
    const db = getDb();
    expect(db.prepare('SELECT COUNT(*) AS n FROM mcp_orbit_provider_artifacts').get().n).toBe(0);
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM meta_embeddings WHERE source_kind = 'orbit_artifact'").get().n,
    ).toBe(0);
  });
});
