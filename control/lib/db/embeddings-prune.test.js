// The semantic index on an upgraded home: a release that deletes a routing card
// or a curated catalyst leaves its indexed row behind. Without the retired-shelf
// prune the rows stay, so semantic_search answers with a card whose entry tool
// is gone, and a catalyst hit that get_catalyst can no longer resolve.

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

// Bodies shaped like the rows an earlier release wrote (BodyComposition.routingCard /
// .catalyst over files a later one deleted), trimmed to what the queries hit.
const STALE_CARD =
  '# Weave a tapestry (tapestry)\n\nA woven tapestry for my wall from a photo.\n\n' +
  'Entry: `start_loom` → `weave_tapestry`; read the pattern with `get_loom_pattern`.';
const STALE_CATALYST =
  '# tapestry-order-to-shop\n\nSend a woven tapestry order to my shop; read them with `list_loom_orders`.';

const LIVE_ROUTING_ID = [...getRoutingCardCatalog().keys()][0];
const LIVE_CATALYST_ID = [...getCatalystCatalog().keys()][0];
const LOCAL_ID = 'my-own-order-flow';

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

// A home as the earlier release left it: the retired rows plus live ones and a local mint.
async function seedUpgradedHome(db) {
  await seed('routing', 'tapestry', STALE_CARD);
  await seed('catalyst', 'tapestry-order-to-shop', STALE_CATALYST);
  await seed('routing', LIVE_ROUTING_ID, `# ${LIVE_ROUTING_ID}\n\na live routing card`);
  await seed('catalyst', LIVE_CATALYST_ID, `# ${LIVE_CATALYST_ID}\n\na live curated catalyst`);
  db.prepare(
    "INSERT INTO local_catalysts (id, frontmatter_json, body_md, kind, rev, status) VALUES (?, '{}', 'body', 'workflow', 1, 'active')",
  ).run(LOCAL_ID);
  await seed('catalyst', LOCAL_ID, `# ${LOCAL_ID}\n\nmy own tapestry order flow into the shop`);
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
  it('an upgraded home stops surfacing the removed card and catalyst; live and local rows stay', async () => {
    let db = freshFileDb();
    await seedUpgradedHome(db);

    // The defect as seeded: before a boot, the retired card answers.
    const before = await semanticSearchHandler({ query: 'weave me a tapestry for my wall', kinds: ['routing'] });
    expect(before.results.map((r) => r.source_ref)).toContain('tapestry');

    closeDb();
    db = getDb(); // the upgraded boot

    expect(refs(db)).toEqual(
      [`catalyst:${LIVE_CATALYST_ID}`, `catalyst:${LOCAL_ID}`, `routing:${LIVE_ROUTING_ID}`].sort(),
    );
    const routing = await semanticSearchHandler({ query: 'weave me a tapestry for my wall', kinds: ['routing'] });
    expect(routing.results.map((r) => r.source_ref)).not.toContain('tapestry');
    const orders = await semanticSearchHandler({ query: 'send tapestry orders to my shop' });
    const orderRefs = orders.results.map((r) => `${r.source_kind}:${r.source_ref}`);
    expect(orderRefs).not.toContain('catalyst:tapestry-order-to-shop');
    expect(orderRefs).toContain(`catalyst:${LOCAL_ID}`);
    // The lexical mirror follows the delete trigger.
    expect(db.prepare("SELECT COUNT(*) AS n FROM meta_fts WHERE meta_fts MATCH '\"start_loom\"'").get().n).toBe(0);
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
    expect(refs(db)).toContain('routing:tapestry');
  });
});

describe('reindexAll drops rows whose source no longer ships', () => {
  it('a from-scratch reindex over a populated index removes the retired rows', async () => {
    const db = freshFileDb();
    await seedUpgradedHome(db);
    await reindexAll();
    const after = refs(db);
    expect(after).not.toContain('routing:tapestry');
    expect(after).not.toContain('catalyst:tapestry-order-to-shop');
    expect(after).toContain(`catalyst:${LOCAL_ID}`);
    expect(after).toContain(`routing:${LIVE_ROUTING_ID}`);
  });
});
