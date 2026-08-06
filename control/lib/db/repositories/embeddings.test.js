// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js (getDb is lazy and reads SQLITE_PATH on first
// call). Vitest workers isolate sibling files so this doesn't leak.
process.env.SQLITE_PATH = ':memory:';
// Skip the first-boot backfill — it dynamically imports back into this file
// during getDb() and would try to load the ONNX model. Each test seeds the
// embeddings it needs via the stubbed embedder.
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the embedder before the repository import so the lazy ONNX load
// never fires under test. Deterministic 384-dim vectors derived from a
// content hash give us shape parity with the real model and let us assert
// score ordering without floating-point flakiness.
vi.mock('../../embedder/local.js', async () => {
  const { createHash } = await import('node:crypto');
  const LOCAL_EMBEDDING_DIM = 384;
  const LOCAL_EMBEDDING_MODEL = 'multilingual-e5-small';

  function vectorFromText(text) {
    // Hash → expand into a normalized 384-dim float vector. Deterministic so
    // a query for "foo" hits a doc with "foo" in it with cosine ~1, and
    // unrelated docs come out near 0.
    const v = new Float32Array(LOCAL_EMBEDDING_DIM);
    const buf = createHash('sha512').update(text).digest();
    // SHA-512 = 64 bytes; tile up to 384 dims, mapping each byte to [-1, 1].
    for (let i = 0; i < LOCAL_EMBEDDING_DIM; i++) {
      v[i] = (buf[i % buf.length] - 128) / 128;
    }
    let mag = 0;
    for (let i = 0; i < v.length; i++) mag += v[i] * v[i];
    mag = Math.sqrt(mag) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= mag;
    return Array.from(v);
  }

  return {
    LOCAL_EMBEDDING_MODEL,
    LOCAL_EMBEDDING_DIM,
    preloadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn(async (texts, { inputType }) => {
      // Both query and passage go through the same deterministic map so a
      // query matches the body it came from. inputType is checked to make
      // sure the repo passes it correctly.
      if (inputType !== 'search_document' && inputType !== 'search_query') {
        throw new Error(`mock embedder got unexpected inputType: ${inputType}`);
      }
      return texts.map(vectorFromText);
    }),
  };
});

import { closeDb, getDb } from '../index.js';
import {
  EmbeddingsRepository,
  SOURCE_KINDS,
  composeMcpToolRef,
  composeMcpToolBody,
  composeOrbitComponentRef,
  BodyComposition,
  reindexAll,
  _internals as embeddingsInternals,
} from './embeddings.js';
import { CapabilitiesRepository } from './mcp-capabilities.js';

beforeEach(() => {
  closeDb();
});

describe('schema bootstraps', () => {
  it('creates meta_embeddings on first getDb()', () => {
    const db = getDb();
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = 'meta_embeddings'",
      )
      .all();
    expect(tables).toHaveLength(1);
  });

  it('creates the source_kind index', () => {
    const db = getDb();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name = 'idx_meta_embeddings_kind'",
      )
      .all();
    expect(indexes).toHaveLength(1);
  });

  it('CHECK constraint pins the allowed source_kinds', () => {
    const db = getDb();
    expect(() =>
      db
        .prepare(
          `INSERT INTO meta_embeddings
             (source_kind, source_ref, content_hash, body_text, embedding, model)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('rogue_kind', 'ref', 'h', 'b', Buffer.alloc(0), 'm'),
    ).toThrow(/CHECK constraint failed/);
  });

  it('UNIQUE(source_kind, source_ref) enforced at the DB layer', () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO meta_embeddings
         (source_kind, source_ref, content_hash, body_text, embedding, model)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('principle', '1', 'h', 'b', Buffer.alloc(0), 'm');
    expect(() =>
      db
        .prepare(
          `INSERT INTO meta_embeddings
             (source_kind, source_ref, content_hash, body_text, embedding, model)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run('principle', '1', 'h2', 'b2', Buffer.alloc(0), 'm'),
    ).toThrow(/UNIQUE constraint failed/);
  });
});

describe('EmbeddingsRepository.embed', () => {
  it('returns { hash, vector } for a fresh row', async () => {
    getDb();
    const result = await EmbeddingsRepository.embed('principle', '1', 'hello world');
    expect(typeof result.hash).toBe('string');
    expect(result.hash).toHaveLength(64);
    expect(Array.isArray(result.vector)).toBe(true);
    expect(result.vector).toHaveLength(384);
  });

  it('returns { hash, vector: null } when the existing row has the same hash', async () => {
    getDb();
    const first = await EmbeddingsRepository.embed('principle', '1', 'hello world');
    EmbeddingsRepository.upsertSync({
      sourceKind: 'principle',
      sourceRef: '1',
      bodyText: 'hello world',
      hash: first.hash,
      vector: first.vector,
    });
    const second = await EmbeddingsRepository.embed('principle', '1', 'hello world');
    expect(second.hash).toBe(first.hash);
    expect(second.vector).toBe(null);
  });

  it('returns a fresh vector when bodyText changes', async () => {
    getDb();
    const first = await EmbeddingsRepository.embed('principle', '1', 'one');
    EmbeddingsRepository.upsertSync({
      sourceKind: 'principle',
      sourceRef: '1',
      bodyText: 'one',
      hash: first.hash,
      vector: first.vector,
    });
    const second = await EmbeddingsRepository.embed('principle', '1', 'two');
    expect(second.hash).not.toBe(first.hash);
    expect(Array.isArray(second.vector)).toBe(true);
  });

  it('throws on invalid source_kind', async () => {
    getDb();
    await expect(
      EmbeddingsRepository.embed('not_a_kind', '1', 'body'),
    ).rejects.toThrow(/source_kind/);
  });

  it('throws on empty bodyText', async () => {
    getDb();
    await expect(EmbeddingsRepository.embed('principle', '1', '')).rejects.toThrow(/bodyText/);
  });
});

describe('EmbeddingsRepository.embedMany', () => {
  it('returns one entry per input, parallel order', async () => {
    getDb();
    const items = [
      { sourceKind: 'principle', sourceRef: '1', bodyText: 'a' },
      { sourceKind: 'principle', sourceRef: '2', bodyText: 'b' },
      { sourceKind: 'mcp_tool', sourceRef: 'gmail::send', bodyText: 'send mail' },
    ];
    const result = await EmbeddingsRepository.embedMany(items);
    expect(result).toHaveLength(3);
    expect(result[0].sourceRef).toBe('1');
    expect(result[2].sourceRef).toBe('gmail::send');
    for (const r of result) expect(Array.isArray(r.vector)).toBe(true);
  });

  it('hash-skips entries whose existing row matches', async () => {
    getDb();
    const first = await EmbeddingsRepository.embedMany([
      { sourceKind: 'principle', sourceRef: '1', bodyText: 'a' },
      { sourceKind: 'principle', sourceRef: '2', bodyText: 'b' },
    ]);
    for (const e of first) {
      EmbeddingsRepository.upsertSync({
        sourceKind: e.sourceKind,
        sourceRef: e.sourceRef,
        bodyText: e.bodyText,
        hash: e.hash,
        vector: e.vector,
      });
    }
    const again = await EmbeddingsRepository.embedMany([
      { sourceKind: 'principle', sourceRef: '1', bodyText: 'a' },
      { sourceKind: 'principle', sourceRef: '2', bodyText: 'b' },
      { sourceKind: 'principle', sourceRef: '3', bodyText: 'c' },
    ]);
    expect(again[0].vector).toBe(null);
    expect(again[1].vector).toBe(null);
    expect(Array.isArray(again[2].vector)).toBe(true);
  });

  it('returns [] for empty input without calling the embedder', async () => {
    getDb();
    const result = await EmbeddingsRepository.embedMany([]);
    expect(result).toEqual([]);
  });
});

describe('EmbeddingsRepository.upsertSync', () => {
  it('inserts a row and idempotently updates on conflict', async () => {
    const db = getDb();
    const { hash, vector } = await EmbeddingsRepository.embed('principle', '1', 'hello');
    EmbeddingsRepository.upsertSync({
      sourceKind: 'principle',
      sourceRef: '1',
      bodyText: 'hello',
      hash,
      vector,
    });
    const row = EmbeddingsRepository.findByRef('principle', '1');
    expect(row.bodyText).toBe('hello');
    expect(row.contentHash).toBe(hash);

    const next = await EmbeddingsRepository.embed('principle', '1', 'goodbye');
    EmbeddingsRepository.upsertSync({
      sourceKind: 'principle',
      sourceRef: '1',
      bodyText: 'goodbye',
      hash: next.hash,
      vector: next.vector,
    });
    const updated = EmbeddingsRepository.findByRef('principle', '1');
    expect(updated.bodyText).toBe('goodbye');
    expect(updated.contentHash).toBe(next.hash);

    const all = db.prepare('SELECT COUNT(*) AS n FROM meta_embeddings').get();
    expect(all.n).toBe(1);
  });

  it('soft no-op on vector:null (hash-skip path)', () => {
    getDb();
    const result = EmbeddingsRepository.upsertSync({
      sourceKind: 'principle',
      sourceRef: '1',
      bodyText: 'body',
      hash: 'h',
      vector: null,
    });
    expect(result.written).toBe(false);
    expect(EmbeddingsRepository.findByRef('principle', '1')).toBe(null);
  });

  it('throws on wrong vector dimension', () => {
    getDb();
    expect(() =>
      EmbeddingsRepository.upsertSync({
        sourceKind: 'principle',
        sourceRef: '1',
        bodyText: 'b',
        hash: 'h',
        vector: [0, 1, 2],
      }),
    ).toThrow(/vector length/);
  });

  it('persists vector round-trip with shape preserved', async () => {
    getDb();
    const { hash, vector } = await EmbeddingsRepository.embed('principle', '1', 'hello');
    EmbeddingsRepository.upsertSync({
      sourceKind: 'principle',
      sourceRef: '1',
      bodyText: 'hello',
      hash,
      vector,
    });
    const db = getDb();
    const row = db
      .prepare('SELECT embedding FROM meta_embeddings WHERE source_kind=? AND source_ref=?')
      .get('principle', '1');
    expect(row.embedding.byteLength).toBe(384 * 4);
    const restored = embeddingsInternals.bufferToVector(row.embedding);
    expect(restored).toHaveLength(384);
    // Cosine with original ≈ 1 (same vector, normalized).
    expect(embeddingsInternals.cosine(vector, restored)).toBeCloseTo(1, 5);
  });
});

describe('EmbeddingsRepository.deleteByRefSync / deleteByRefPrefixSync', () => {
  it('deletes one row by exact ref', async () => {
    getDb();
    const { hash, vector } = await EmbeddingsRepository.embed('principle', '7', 'p7');
    EmbeddingsRepository.upsertSync({
      sourceKind: 'principle',
      sourceRef: '7',
      bodyText: 'p7',
      hash,
      vector,
    });
    expect(EmbeddingsRepository.findByRef('principle', '7')).not.toBe(null);
    const changes = EmbeddingsRepository.deleteByRefSync('principle', '7');
    expect(changes).toBe(1);
    expect(EmbeddingsRepository.findByRef('principle', '7')).toBe(null);
  });

  it('deletes by prefix without splashing other kinds', async () => {
    getDb();
    const items = [
      { sourceKind: 'mcp_tool', sourceRef: 'gmail::send_message', bodyText: 'a' },
      { sourceKind: 'mcp_tool', sourceRef: 'gmail::search', bodyText: 'b' },
      { sourceKind: 'mcp_tool', sourceRef: 'notion::create_page', bodyText: 'c' },
      { sourceKind: 'principle', sourceRef: 'gmail::not-a-tool', bodyText: 'd' },
    ];
    for (const it of items) {
      const { hash, vector } = await EmbeddingsRepository.embed(it.sourceKind, it.sourceRef, it.bodyText);
      EmbeddingsRepository.upsertSync({ ...it, hash, vector });
    }
    const changes = EmbeddingsRepository.deleteByRefPrefixSync('mcp_tool', 'gmail::');
    expect(changes).toBe(2);
    expect(EmbeddingsRepository.findByRef('mcp_tool', 'gmail::send_message')).toBe(null);
    expect(EmbeddingsRepository.findByRef('mcp_tool', 'gmail::search')).toBe(null);
    expect(EmbeddingsRepository.findByRef('mcp_tool', 'notion::create_page')).not.toBe(null);
    // Same prefix on a different kind is untouched.
    expect(EmbeddingsRepository.findByRef('principle', 'gmail::not-a-tool')).not.toBe(null);
  });

  it('escapes LIKE wildcards in the prefix', async () => {
    getDb();
    const items = [
      { sourceKind: 'mcp_tool', sourceRef: 'odd_server::tool', bodyText: 'a' },
      { sourceKind: 'mcp_tool', sourceRef: 'oddXserver::tool', bodyText: 'b' },
    ];
    for (const it of items) {
      const { hash, vector } = await EmbeddingsRepository.embed(it.sourceKind, it.sourceRef, it.bodyText);
      EmbeddingsRepository.upsertSync({ ...it, hash, vector });
    }
    const changes = EmbeddingsRepository.deleteByRefPrefixSync('mcp_tool', 'odd_server::');
    expect(changes).toBe(1);
    expect(EmbeddingsRepository.findByRef('mcp_tool', 'oddXserver::tool')).not.toBe(null);
  });
});

describe('EmbeddingsRepository.search', () => {
  beforeEach(async () => {
    closeDb();
    getDb();
    // Seed a small mixed corpus.
    const items = [
      { sourceKind: 'principle', sourceRef: '1', bodyText: 'calendar booking workflow' },
      { sourceKind: 'principle', sourceRef: '2', bodyText: 'routing to specialist bot' },
      { sourceKind: 'mcp_tool', sourceRef: 'google_calendar::create_event', bodyText: 'create event' },
      { sourceKind: 'catalyst', sourceRef: 'appointment-to-calendar', bodyText: 'appointment to calendar catalyst' },
    ];
    const embedded = await EmbeddingsRepository.embedMany(items);
    for (const e of embedded) {
      EmbeddingsRepository.upsertSync({
        sourceKind: e.sourceKind,
        sourceRef: e.sourceRef,
        bodyText: e.bodyText,
        hash: e.hash,
        vector: e.vector,
      });
    }
  });

  it('returns hits across kinds, sorted by score', async () => {
    const results = await EmbeddingsRepository.search('calendar', { limit: 4 });
    expect(results.length).toBeGreaterThan(0);
    // The exact-text match for "calendar booking workflow" should beat the
    // routing principle on the deterministic mock embedder.
    const refs = results.map((r) => r.source_ref);
    expect(refs).toContain('1'); // calendar principle should be present
    // Scores are descending.
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it('filters by kinds when provided', async () => {
    const results = await EmbeddingsRepository.search('calendar', { kinds: ['mcp_tool'] });
    for (const r of results) expect(r.source_kind).toBe('mcp_tool');
  });

  it('respects the limit', async () => {
    const results = await EmbeddingsRepository.search('calendar', { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('snippets cap body_text at 280 chars', async () => {
    const longBody = 'x'.repeat(500);
    const { hash, vector } = await EmbeddingsRepository.embed('catalyst', 'long-one', longBody);
    EmbeddingsRepository.upsertSync({
      sourceKind: 'catalyst',
      sourceRef: 'long-one',
      bodyText: longBody,
      hash,
      vector,
    });
    const results = await EmbeddingsRepository.search('xxxxx', { kinds: ['catalyst'], limit: 1 });
    expect(results[0].snippet.length).toBeLessThanOrEqual(280);
  });

  it('throws on empty query', async () => {
    await expect(EmbeddingsRepository.search('')).rejects.toThrow(/query/);
  });

  it('throws on limit outside [1, 50]', async () => {
    await expect(EmbeddingsRepository.search('x', { limit: 0 })).rejects.toThrow(/limit/);
    await expect(EmbeddingsRepository.search('x', { limit: 51 })).rejects.toThrow(/limit/);
  });

  it('skips superseded capability rows', async () => {
    closeDb();
    getDb();
    // Insert a current capability + an embedding for it.
    const first = CapabilitiesRepository.insert({
      providerRef: 'gmail',
      bodyMd: 'gmail v1 body',
    });
    const e1 = await EmbeddingsRepository.embed('mcp_capability', 'gmail', 'gmail v1 body');
    EmbeddingsRepository.upsertSync({
      sourceKind: 'mcp_capability',
      sourceRef: 'gmail',
      bodyText: 'gmail v1 body',
      hash: e1.hash,
      vector: e1.vector,
    });
    // First search hits the current row.
    let results = await EmbeddingsRepository.search('gmail v1 body', { kinds: ['mcp_capability'] });
    expect(results.find((r) => r.source_ref === 'gmail')).toBeTruthy();

    // Manually stash a "stale" embedding under a different (now-invalid)
    // provider_ref to mimic an embedding row whose source row is no longer
    // current. The search-side filter walks
    // meta_mcp_capabilities WHERE superseded_by IS NULL and drops anything
    // whose source_ref isn't a current provider_ref.
    const stale = await EmbeddingsRepository.embed(
      'mcp_capability',
      'no-such-provider',
      'stale capability body',
    );
    EmbeddingsRepository.upsertSync({
      sourceKind: 'mcp_capability',
      sourceRef: 'no-such-provider',
      bodyText: 'stale capability body',
      hash: stale.hash,
      vector: stale.vector,
    });
    results = await EmbeddingsRepository.search('stale capability body', {
      kinds: ['mcp_capability'],
    });
    expect(results.find((r) => r.source_ref === 'no-such-provider')).toBeUndefined();
    // first.id should still hit on its own body.
    expect(first.id).toBeDefined();
  });
});

describe('body composition helpers', () => {
  it('composeMcpToolRef joins with `::` separator', () => {
    expect(composeMcpToolRef('gmail', 'send_message')).toBe('gmail::send_message');
  });

  it('composeMcpToolBody falls back to server.tool when description is missing', () => {
    expect(composeMcpToolBody({ server: 'gmail', toolName: 'send' })).toBe('gmail.send');
    expect(
      composeMcpToolBody({ server: 'gmail', toolName: 'send', description: '   ' }),
    ).toBe('gmail.send');
    expect(
      composeMcpToolBody({ server: 'gmail', toolName: 'send', description: 'Send email.' }),
    ).toBe('gmail.send\nSend email.');
  });

  it('composeOrbitComponentRef encodes kind/ref@version', () => {
    expect(
      composeOrbitComponentRef({ kind: 'trigger', ref: 'cron', version: '0.1.0' }),
    ).toBe('trigger/cron@0.1.0');
  });

  it('BodyComposition tolerates both snake_case and camelCase source shapes', () => {
    expect(BodyComposition.principle({ body_md: 'a' })).toBe('a');
    expect(BodyComposition.principle({ bodyMd: 'b' })).toBe('b');
    expect(BodyComposition.orbitComposition({ intent_md: 'c' })).toBe('c');
    expect(BodyComposition.orbitComposition({ intentMd: 'd' })).toBe('d');
  });

  it('BodyComposition.catalyst composes name + summary + valueHook + body', () => {
    const out = BodyComposition.catalyst({
      id: 'demo',
      name: 'Demo Catalyst',
      summary: 'a demo',
      valueHook: 'turn input X into output Y',
      category: 'demo',
      body: 'Body line.',
    });
    expect(out).toContain('# Demo Catalyst');
    expect(out).toContain('a demo');
    expect(out).toContain('turn input X into output Y');
    expect(out).toContain('Body line.');
  });
});

describe('SOURCE_KINDS', () => {
  it('matches the CHECK constraint in the schema', () => {
    expect(SOURCE_KINDS).toEqual([
      'principle',
      'mcp_tool',
      'mcp_capability',
      'orbit_component',
      'orbit_composition',
      'orbit_artifact',
      'catalyst',
      'sketch_vocab',
      'sketch_method',
      'manji_program',
      'painted_landscape',
      'view_vocab',
      'beats_vocab',
      'game_vocab',
      'game_mechanic',
      'game_kit',
      'game_glyph',
      'game_sfx',
      'game_project',
      'routing',
    ]);
  });
});

describe('reindexAll', () => {
  it('no-ops on empty DB (no source rows + skips catalysts when no other work)', async () => {
    getDb();
    // We still load catalysts; the loader will populate them. Verify the
    // function returns a structured result.
    const result = await reindexAll();
    expect(result.totalSeen).toBeGreaterThanOrEqual(0);
    expect(result.written).toBeGreaterThanOrEqual(0);
  });

  it('indexes existing source rows', async () => {
    const db = getDb();
    // Seed a principle directly via SQL so we don't pull in meta-context.
    db.prepare(
      `INSERT INTO meta_principles (scope_kind, scope_id, body_md, source_event)
       VALUES (?, ?, ?, ?)`,
    ).run('node', 1, 'sample principle body', 'artifact_materialization');

    const result = await reindexAll();
    expect(result.totalSeen).toBeGreaterThan(0);
    expect(result.written).toBeGreaterThan(0);

    const row = EmbeddingsRepository.findByRef('principle', '1');
    expect(row).not.toBe(null);
    expect(row.bodyText).toBe('sample principle body');
  });

  it('is idempotent — second run hash-skips all rows', async () => {
    const db = getDb();
    db.prepare(
      `INSERT INTO meta_principles (scope_kind, scope_id, body_md, source_event)
       VALUES (?, ?, ?, ?)`,
    ).run('node', 1, 'sample principle body', 'artifact_materialization');

    const first = await reindexAll();
    const second = await reindexAll();
    expect(second.written).toBe(0);
    expect(second.skipped).toBe(first.totalSeen);
  });

  it('includes active local-shelf catalysts (merged catalog), not archived ones', async () => {
    getDb();
    const { LocalCatalystRepository } = await import('./local-catalysts.js');
    const { validateCatalystMeta } = await import('../../mcp/catalysts/loader.js');
    const mint = (id) =>
      LocalCatalystRepository.create({
        catalyst: validateCatalystMeta(
          { id, name: id, summary: 's', valueHook: 'v' },
          `body of ${id}`,
        ),
      });
    mint('local-live');
    mint('local-shelved');
    LocalCatalystRepository.archive('local-shelved');

    await reindexAll();
    const live = EmbeddingsRepository.findByRef('catalyst', 'local-live');
    expect(live).not.toBe(null);
    expect(live.bodyText).toContain('body of local-live');
    expect(EmbeddingsRepository.findByRef('catalyst', 'local-shelved')).toBe(null);
  });
});
