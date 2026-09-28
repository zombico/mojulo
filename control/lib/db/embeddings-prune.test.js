// The semantic index on a home upgraded from 2.x: 2.1.0 indexed the `bot`
// routing card and the chatbot-factory catalysts, and 3.0.0 no longer ships
// them. Without the retired-shelf prune the rows stayed, so semantic_search
// answered "build me a chatbot" with a card that starts at `start_new_bot`,
// and a catalyst hit that get_catalyst could no longer resolve.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// The lexical path, as on a default install (no recall group): deterministic
// and model-free.
vi.mock('../embedder/local.js', () => {
  class RecallUnavailableError extends Error {
    constructor() {
      super('The embedding runtime (the `recall` install group) is not installed on this host');
      this.code = 'RECALL_UNAVAILABLE';
    }
  }
  return {
    LOCAL_EMBEDDING_MODEL: 'multilingual-e5-small',
    LOCAL_EMBEDDING_DIM: 384,
    recallInstallLine: () => 'run `mojulo install recall`',
    RecallUnavailableError,
    embedderAvailable: () => false,
    preloadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn(async () => {
      throw new RecallUnavailableError();
    }),
  };
});

import { closeDb, getDb } from './index.js';
import { EmbeddingsRepository, reindexAll } from './repositories/embeddings.js';
import { pruneRetiredShelfEmbeddings } from './embeddings-prune.js';
import { semanticSearchHandler } from '../mcp/tools/semantic-search.js';
import { getRoutingCardCatalog } from '../mcp/routing-cards/loader.js';
import { getCatalystCatalog } from '../mcp/catalysts/loader.js';

// Bodies shaped like the rows 2.1.0 wrote (BodyComposition.routingCard /
// .catalyst over the files 3.0.0 deleted), trimmed to what the queries hit.
const STALE_BOT_CARD =
  '# Build a chatbot (bot)\n\nA chatbot for my website that answers from my documents.\n\n' +
  'Entry: `start_new_bot` → `save_modular_bot` → `poll_job`; read transcripts with `query_conversations`.';
const STALE_CATALYST =
  '# qualify-lead-to-crm\n\nQualify leads a deployed bot captured into my CRM; read them with `query_submissions`.';

const LIVE_ROUTING_ID = [...getRoutingCardCatalog().keys()][0];
const LIVE_CATALYST_ID = [...getCatalystCatalog().keys()][0];
const LOCAL_ID = 'my-own-lead-flow';

async function seed(sourceKind, sourceRef, bodyText) {
  const e = await EmbeddingsRepository.embed(sourceKind, sourceRef, bodyText);
  return EmbeddingsRepository.upsertSync({ ...e, sourceKind, sourceRef, bodyText });
}

function refs(db) {
  return db
    .prepare("SELECT source_kind || ':' || source_ref AS r FROM meta_embeddings WHERE source_kind IN ('routing','catalyst') ORDER BY r")
    .all()
    .map((x) => x.r);
}

// A home as 2.1.0 left it: the retired rows plus live ones and a local mint.
async function seedUpgradedHome(db) {
  await seed('routing', 'bot', STALE_BOT_CARD);
  await seed('catalyst', 'qualify-lead-to-crm', STALE_CATALYST);
  await seed('routing', LIVE_ROUTING_ID, `# ${LIVE_ROUTING_ID}\n\na live routing card`);
  await seed('catalyst', LIVE_CATALYST_ID, `# ${LIVE_CATALYST_ID}\n\na live curated catalyst`);
  db.prepare(
    "INSERT INTO local_catalysts (id, frontmatter_json, body_md, kind, rev, status) VALUES (?, '{}', 'body', 'workflow', 1, 'active')",
  ).run(LOCAL_ID);
  await seed('catalyst', LOCAL_ID, `# ${LOCAL_ID}\n\nmy own lead-qualifying flow into the CRM`);
}

const dirs = [];
function freshFileDb() {
  closeDb();
  const dir = mkdtempSync(join(tmpdir(), 'mojulo-prune-'));
  dirs.push(dir);
  process.env.SQLITE_PATH = join(dir, 'home.db');
  return getDb();
}

afterEach(() => {
  closeDb();
  process.env.SQLITE_PATH = ':memory:';
});
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('retired-shelf prune on boot', () => {
  it('an upgraded home stops surfacing the removed bot card and catalysts; live and local rows stay', async () => {
    let db = freshFileDb();
    await seedUpgradedHome(db);

    // The defect as seeded: before a boot, the retired card answers.
    const before = await semanticSearchHandler({ query: 'build me a chatbot for my website', kinds: ['routing'] });
    expect(before.results.map((r) => r.source_ref)).toContain('bot');

    closeDb();
    db = getDb(); // the 3.0 boot

    expect(refs(db)).toEqual(
      [`catalyst:${LIVE_CATALYST_ID}`, `catalyst:${LOCAL_ID}`, `routing:${LIVE_ROUTING_ID}`].sort(),
    );
    const routing = await semanticSearchHandler({ query: 'build me a chatbot for my website', kinds: ['routing'] });
    expect(routing.results.map((r) => r.source_ref)).not.toContain('bot');
    const leads = await semanticSearchHandler({ query: 'qualify leads into my CRM' });
    const leadRefs = leads.results.map((r) => `${r.source_kind}:${r.source_ref}`);
    expect(leadRefs).not.toContain('catalyst:qualify-lead-to-crm');
    expect(leadRefs).toContain(`catalyst:${LOCAL_ID}`);
    // The lexical mirror follows the delete trigger.
    expect(db.prepare("SELECT COUNT(*) AS n FROM meta_fts WHERE meta_fts MATCH '\"start_new_bot\"'").get().n).toBe(0);
  });

  it('a second boot removes nothing more', async () => {
    let db = freshFileDb();
    await seedUpgradedHome(db);
    closeDb();
    db = getDb();
    const after = refs(db);
    expect(pruneRetiredShelfEmbeddings(db)).toBe(0);
    closeDb();
    db = getDb();
    expect(refs(db)).toEqual(after);
  });

  it('an empty shelf reads as "the loader could not see the files", never "prune everything"', async () => {
    const db = freshFileDb();
    await seedUpgradedHome(db);
    expect(pruneRetiredShelfEmbeddings(db, { routingIds: new Set(), catalystIds: new Set() })).toBe(0);
    expect(refs(db)).toContain('routing:bot');
  });
});

describe('reindexAll drops rows whose source no longer ships', () => {
  it('a from-scratch reindex over a populated index removes the retired rows', async () => {
    const db = freshFileDb();
    await seedUpgradedHome(db);
    await reindexAll();
    const after = refs(db);
    expect(after).not.toContain('routing:bot');
    expect(after).not.toContain('catalyst:qualify-lead-to-crm');
    expect(after).toContain(`catalyst:${LOCAL_ID}`);
    expect(after).toContain(`routing:${LIVE_ROUTING_ID}`);
  });
});
