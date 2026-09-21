// The lexical path — what `semantic_search` is on a DEFAULT install, where the
// embedding runtime (the opt-in `recall` install group) is absent. The embedder
// mock throws the runtime's "not installed" signal (RECALL_UNAVAILABLE) on every
// call, exactly as lib/embedder/local.js does without the group; the repository
// must then store rows text-only and rank over the FTS5 mirror (meta_fts).

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('../../embedder/local.js', () => {
  class RecallUnavailableError extends Error {
    constructor() {
      super('The embedding runtime (the `recall` install group) is not installed on this host');
      this.code = 'RECALL_UNAVAILABLE';
    }
  }
  return {
    LOCAL_EMBEDDING_MODEL: 'multilingual-e5-small',
    LOCAL_EMBEDDING_DIM: 384,
    RECALL_INSTALL_LINE: 'run `mojulo install recall`',
    RecallUnavailableError,
    embedderAvailable: () => false,
    preloadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn(async () => {
      throw new RecallUnavailableError();
    }),
  };
});

import { closeDb, getDb } from '../index.js';
import {
  EmbeddingsRepository,
  TEXT_ONLY_MODEL,
  lexicalTerms,
  reindexAll,
} from './embeddings.js';
import { semanticSearchHandler } from '../../mcp/tools/semantic-search.js';
import { FIXTURE } from '../../mcp/routing-cards/routing-eval.fixture.js';
import { getRoutingCardCatalog } from '../../mcp/routing-cards/loader.js';
import { BodyComposition } from './embeddings.js';

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

describe('text-only rows (runtime absent)', () => {
  it('embed() reports textOnly and upsertSync stores the row with a NULL vector', async () => {
    const e = await EmbeddingsRepository.embed('principle', '1', 'calendar booking workflow');
    expect(e.vector).toBe(null);
    expect(e.textOnly).toBe(true);
    const res = EmbeddingsRepository.upsertSync({ ...e, sourceKind: 'principle', sourceRef: '1', bodyText: 'calendar booking workflow' });
    expect(res).toEqual({ written: true, textOnly: true });
    const row = EmbeddingsRepository.findByRef('principle', '1');
    expect(row.hasVector).toBe(false);
    expect(row.model).toBe(TEXT_ONLY_MODEL);
  });

  it('an unchanged text row is a hash-skip, not a rewrite', async () => {
    await seed('principle', '1', 'calendar booking workflow');
    const again = await EmbeddingsRepository.embed('principle', '1', 'calendar booking workflow');
    expect(again).toEqual({ hash: again.hash, vector: null });
    expect(EmbeddingsRepository.upsertSync({ ...again, sourceKind: 'principle', sourceRef: '1', bodyText: 'x' }).written).toBe(false);
  });

  it('embedMany marks new/changed entries textOnly and leaves unchanged ones alone', async () => {
    await seed('principle', '1', 'same text');
    const out = await EmbeddingsRepository.embedMany([
      { sourceKind: 'principle', sourceRef: '1', bodyText: 'same text' },
      { sourceKind: 'principle', sourceRef: '2', bodyText: 'new text' },
    ]);
    expect(out[0].textOnly).toBeUndefined();
    expect(out[1].textOnly).toBe(true);
  });

  it('the vector-null hash-skip upsert stays a no-op (no textOnly flag)', () => {
    const res = EmbeddingsRepository.upsertSync({ sourceKind: 'principle', sourceRef: '9', bodyText: 'b', hash: 'h', vector: null });
    expect(res.written).toBe(false);
    expect(EmbeddingsRepository.findByRef('principle', '9')).toBe(null);
  });

  it('reindexAll counts text-only writes separately and never fails a row', async () => {
    const r = await reindexAll();
    expect(r.failed).toBe(0);
    expect(r.textOnly).toBeGreaterThan(0);
    expect(r.written).toBe(0);
  });
});

describe('lexicalTerms', () => {
  it('lowercases, drops terms under three characters, dedupes, and caps', () => {
    expect(lexicalTerms('A bar chart of Bar signups by week')).toEqual(['bar', 'chart', 'signups', 'week']);
    expect(lexicalTerms('私は東京タワーの模型が欲しい')).toEqual(['私は東京タワーの模型が欲しい']);
    expect(lexicalTerms('ab cd')).toEqual([]);
    expect(lexicalTerms(Array.from({ length: 30 }, (_, i) => `term${i}`).join(' ')).length).toBe(12);
  });
});

describe('search over meta_fts', () => {
  beforeEach(async () => {
    await seed('principle', '1', 'calendar booking workflow for the dentist');
    await seed('principle', '2', 'routing to a specialist bot');
    await seed('mcp_tool', 'google_calendar::create_event', 'create a calendar event');
    await seed('catalyst', 'appointment-to-calendar', 'appointment to calendar catalyst');
  });

  it('answers with mode lexical, never degraded, scores in [0,1] descending', async () => {
    const { results, degraded, mode } = await EmbeddingsRepository.search('calendar booking', { withMeta: true });
    expect(mode).toBe('lexical');
    expect(degraded).toBe(false);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source_ref).toBe('1'); // both terms → coverage 1
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < results.length; i++) expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
  });

  it('substring matching: a singular query finds the plural row (trigram)', async () => {
    await seed('principle', '3', 'shared calendars for the whole clinic');
    const results = await EmbeddingsRepository.search('calendar', {});
    expect(results.map((r) => r.source_ref)).toContain('3');
  });

  it('filters by kinds and respects the limit', async () => {
    const only = await EmbeddingsRepository.search('calendar', { kinds: ['mcp_tool'] });
    expect(only.map((r) => r.source_kind)).toEqual(['mcp_tool']);
    expect((await EmbeddingsRepository.search('calendar', { limit: 1 })).length).toBe(1);
  });

  it('a query with no indexable term returns nothing rather than everything', async () => {
    expect(await EmbeddingsRepository.search('a b', {})).toEqual([]);
  });

  it('segments CJK bodies the operator wrote in their own language (trigram)', async () => {
    await seed('catalyst', 'tokyo', '東京タワーの模型を作る — a Tokyo Tower model');
    const hits = await EmbeddingsRepository.search('東京タワー', {});
    expect(hits[0]?.source_ref).toBe('tokyo');
  });

  it('a deleted row leaves the index (trigger-maintained mirror)', async () => {
    EmbeddingsRepository.deleteByRefSync('principle', '1');
    const refs = (await EmbeddingsRepository.search('dentist', {})).map((r) => r.source_ref);
    expect(refs).not.toContain('1');
  });

  it('the MCP tool reports the mode and the lexical weak hint', async () => {
    const strong = await semanticSearchHandler({ query: 'calendar booking workflow' });
    expect(strong.mode).toBe('lexical');
    expect(strong.degraded).toBeUndefined();
    expect(strong.hint).toBeUndefined();
    const weak = await semanticSearchHandler({ query: 'zebra quantum trombone calendar' });
    expect(weak.hint).toContain('lexical match');
    expect(weak._telemetrySignal.mode).toBe('lexical');
  });
});

describe('first search of an empty corpus populates the index inline', () => {
  it('a fresh DB answers a routing query on the first call', async () => {
    const db = getDb();
    expect(db.prepare('SELECT COUNT(*) AS n FROM meta_embeddings').get().n).toBe(0);
    const { results, mode } = await EmbeddingsRepository.search('build me a little town I can wander around in', {
      kinds: ['routing'],
      withMeta: true,
    });
    expect(mode).toBe('lexical');
    expect(results.length).toBeGreaterThan(0);
    expect(db.prepare('SELECT COUNT(*) AS n FROM meta_embeddings').get().n).toBeGreaterThan(0);
  });
});

// Gate: the routing fixture through the lexical path. The retrieval gate
// (routing-eval.integration.test.js) measures the same rows through the real
// embedder and needs the recall group; this is the default install's number.
// The floor is the measured value at the time of pinning — a drop is a
// legitimate signal that a card's When line lost the words agents use.
const LEXICAL_TOP3_FLOOR = 0.85; // measured 94.1 % (32/34) on 2026-09-21
describe('routing fixture through the lexical path', () => {
  it(`surfaces the entry tool in the top 3 for ≥ ${LEXICAL_TOP3_FLOOR * 100}% of phrasings`, async () => {
    const catalog = getRoutingCardCatalog();
    const items = [...catalog.values()].map((card) => ({
      sourceKind: 'routing',
      sourceRef: card.id,
      bodyText: BodyComposition.routingCard(card),
    }));
    const embedded = await EmbeddingsRepository.embedMany(items);
    for (const e of embedded) EmbeddingsRepository.upsertSync(e);
    const misses = [];
    for (const [phrasing, expectedEntry] of FIXTURE) {
      const results = await EmbeddingsRepository.search(phrasing, { kinds: ['routing'], limit: 3 });
      const entries = results.map((r) => catalog.get(r.source_ref)?.entry);
      if (!entries.includes(expectedEntry)) misses.push(`"${phrasing}" → wanted ${expectedEntry}, got [${entries.join(', ')}]`);
    }
    const rate = 1 - misses.length / FIXTURE.length;
    // eslint-disable-next-line no-console
    console.log(`[lexical routing] top-3 ${(rate * 100).toFixed(1)}% (${FIXTURE.length - misses.length}/${FIXTURE.length})\n${misses.join('\n')}`);
    expect(rate, misses.join('\n')).toBeGreaterThanOrEqual(LEXICAL_TOP3_FLOOR);
  });
});

describe('migration: NOT NULL vector column and a pre-existing corpus', () => {
  it('rebuilds meta_embeddings nullable and fills meta_fts from the old rows', () => {
    closeDb();
    const dir = mkdtempSync(join(tmpdir(), 'mojulo-lexical-'));
    const file = join(dir, 'old.db');
    const raw = new Database(file);
    raw.exec(`CREATE TABLE meta_embeddings (
      id INTEGER PRIMARY KEY,
      source_kind TEXT NOT NULL CHECK(source_kind IN ('principle','mcp_tool','mcp_capability','orbit_component','orbit_composition','orbit_artifact','catalyst','sketch_vocab','sketch_method','manji_program','painted_landscape','view_vocab','solid_vocab','motion_vocab','beats_vocab','game_vocab','game_mechanic','game_kit','game_glyph','game_sfx','game_hud','game_project','routing')),
      source_ref TEXT NOT NULL, content_hash TEXT NOT NULL, body_text TEXT NOT NULL,
      embedding BLOB NOT NULL, model TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()), UNIQUE(source_kind, source_ref))`);
    raw.prepare('INSERT INTO meta_embeddings (source_kind, source_ref, content_hash, body_text, embedding, model) VALUES (?,?,?,?,?,?)')
      .run('principle', 'old', 'h', 'an old row about dentist appointments', Buffer.alloc(4), 'm');
    raw.close();
    try {
      process.env.SQLITE_PATH = file;
      const db = getDb();
      const ddl = db.prepare("SELECT sql FROM sqlite_master WHERE name='meta_embeddings'").get().sql;
      expect(ddl).not.toMatch(/embedding\s+BLOB\s+NOT\s+NULL/i);
      expect(db.prepare('SELECT COUNT(*) AS n FROM meta_embeddings').get().n).toBe(1);
      const hit = db.prepare("SELECT rowid FROM meta_fts WHERE meta_fts MATCH '\"dentist\"'").all();
      expect(hit).toHaveLength(1);
      expect(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND name LIKE 'meta_embeddings_fts_%'").get().n).toBe(3);
    } finally {
      closeDb();
      process.env.SQLITE_PATH = ':memory:';
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
