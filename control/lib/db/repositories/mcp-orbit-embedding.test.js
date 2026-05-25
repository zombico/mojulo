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
import {
  MCPOrbitComponentRepository,
  MCPOrbitCompositionRepository,
} from './mcp-orbit.js';
import { EmbeddingsRepository } from './embeddings.js';

beforeEach(() => {
  closeDb();
});

describe('MCPOrbitComponentRepository.upsertWithEmbedding', () => {
  it('writes a meta_embeddings row keyed on kind/ref@version', async () => {
    getDb();
    await MCPOrbitComponentRepository.upsertWithEmbedding({
      kind: 'trigger',
      ref: 'cron',
      version: '0.1.0',
      body_md: '# Cron trigger\n\nFires on a recurring schedule.',
    });
    const row = EmbeddingsRepository.findByRef('orbit_component', 'trigger/cron@0.1.0');
    expect(row).not.toBe(null);
    expect(row.bodyText).toContain('Cron trigger');
  });

  it('each version gets its own embedding row', async () => {
    getDb();
    await MCPOrbitComponentRepository.upsertWithEmbedding({
      kind: 'trigger',
      ref: 'cron',
      version: '0.1.0',
      body_md: 'cron v0.1.0',
    });
    await MCPOrbitComponentRepository.upsertWithEmbedding({
      kind: 'trigger',
      ref: 'cron',
      version: '0.2.0',
      body_md: 'cron v0.2.0',
    });
    expect(EmbeddingsRepository.findByRef('orbit_component', 'trigger/cron@0.1.0')).not.toBe(null);
    expect(EmbeddingsRepository.findByRef('orbit_component', 'trigger/cron@0.2.0')).not.toBe(null);
  });

  it('soft-skips when MOJULO_SEMANTIC_INDEX_DISABLED=1', async () => {
    const original = process.env.MOJULO_SEMANTIC_INDEX_DISABLED;
    process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
    try {
      getDb();
      await MCPOrbitComponentRepository.upsertWithEmbedding({
        kind: 'pattern',
        ref: 'digest',
        version: '0.1.0',
        body_md: 'digest body',
      });
      expect(EmbeddingsRepository.findByRef('orbit_component', 'pattern/digest@0.1.0')).toBe(null);
    } finally {
      process.env.MOJULO_SEMANTIC_INDEX_DISABLED = original;
    }
  });
});

describe('MCPOrbitCompositionRepository.insertWithEmbedding', () => {
  it('writes a meta_embeddings row keyed on the generated composition ref', async () => {
    getDb();
    const composition = await MCPOrbitCompositionRepository.insertWithEmbedding({
      intent_md: 'Weekly digest of open Linear issues into a Google Drive folder',
      component_refs: [
        { kind: 'mcp', ref: 'linear', version: '0.1.0', role: 'source' },
        { kind: 'mcp', ref: 'google_drive', version: '0.1.0', role: 'destination' },
      ],
      knobs: {},
    });
    expect(composition.ref).toMatch(/^comp_/);
    const row = EmbeddingsRepository.findByRef('orbit_composition', composition.ref);
    expect(row).not.toBe(null);
    expect(row.bodyText).toContain('Weekly digest');
  });

  it('soft-skips when MOJULO_SEMANTIC_INDEX_DISABLED=1', async () => {
    const original = process.env.MOJULO_SEMANTIC_INDEX_DISABLED;
    process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
    try {
      getDb();
      const composition = await MCPOrbitCompositionRepository.insertWithEmbedding({
        intent_md: 'Some intent',
        component_refs: [{ kind: 'pattern', ref: 'digest', version: '0.1.0' }],
        knobs: {},
      });
      expect(composition.ref).toMatch(/^comp_/);
      expect(EmbeddingsRepository.findByRef('orbit_composition', composition.ref)).toBe(null);
    } finally {
      process.env.MOJULO_SEMANTIC_INDEX_DISABLED = original;
    }
  });

  it('atomicity — rolls back composition + embedding on bad payload', async () => {
    getDb();
    await expect(
      MCPOrbitCompositionRepository.insertWithEmbedding({
        intent_md: 'rogue',
        component_refs: [],
        knobs: {},
      }),
    ).rejects.toThrow();
    const db = getDb();
    expect(db.prepare('SELECT COUNT(*) AS n FROM mcp_orbit_compositions').get().n).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS n FROM meta_embeddings WHERE source_kind = 'orbit_composition'").get().n).toBe(0);
  });
});
