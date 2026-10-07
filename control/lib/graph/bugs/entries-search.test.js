// The arthropod entries through semantic_search's DEFAULT path: lexical, no embedding runtime (the opt-in `recall`
// group absent). The FIND hop of find → read → mint, on the words people type, with nothing but the generated text.

process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

vi.mock('../../embedder/local.js', () => {
  class RecallUnavailableError extends Error {
    constructor() { super('The embedding runtime (the `recall` install group) is not installed on this host'); this.code = 'RECALL_UNAVAILABLE'; }
  }
  return {
    LOCAL_EMBEDDING_MODEL: 'multilingual-e5-small', LOCAL_EMBEDDING_DIM: 384,
    recallInstallLine: () => 'run `npx -y mojulo install recall`', RecallUnavailableError,
    embedderAvailable: () => false, preloadModel: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn(async () => { throw new RecallUnavailableError(); }),
  };
});

import { closeDb, getDb } from '../../db/index.js';
import { EmbeddingsRepository, reindexAll } from '../../db/repositories/embeddings.js';

beforeAll(async () => {
  closeDb();
  getDb();
  await reindexAll();
}, 120_000);
afterAll(() => closeDb());

async function top(query, k = 3) {
  return (await EmbeddingsRepository.search(query, { kinds: ['solid_vocab'], limit: k })).map((r) => r.source_ref);
}

describe('finding an arthropod by the words people type (lexical, no model)', () => {
  const cases = [
    ['a ladybug', ['species/ladybird']], ['crawdad', ['species/crayfish']], ['daddy longlegs', ['species/harvestman']],
    ['lightning bug', ['species/firefly']], ['a scarab beetle', ['species/dungBeetle']], ['stag beetle', ['species/stagBeetle']],
    ['praying mantis', ['species/prayingMantis']], ['a honey bee', ['species/honeyBee']], ['monarch butterfly', ['species/monarch']],
    ['norway lobster', ['species/langoustine']], ['horseshoe crab', ['species/horseshoeCrab']], ['pill bug', ['species/crustaceans', 'species/woodlouse']],
    ['a wasp', ['species/insects', 'species/honeyBee']], ['hermit crab', ['species/crustaceans', 'species/greenCrab']],
    ['tarantula', ['species/arachnids', 'species/gardenSpider']], ['insects', ['species/insects']],
    ['coccinella septempunctata', ['species/ladybird']],
  ];
  for (const [q, want] of cases) {
    it(`"${q}" finds ${want[0]} in the top 3`, async () => {
      const got = await top(q);
      expect(got.some((r) => want.includes(r)), `${q} → ${got.join(', ')}`).toBe(true);
    });
  }
});

describe('an upgraded index learns the entries a release shipped', () => {
  it('a corpus missing a shipped species entry gets it on the next search', async () => {
    const db = getDb();
    db.prepare("DELETE FROM meta_embeddings WHERE source_kind = 'solid_vocab' AND source_ref = 'species/firefly'").run();
    expect(EmbeddingsRepository.findByRef('solid_vocab', 'species/firefly')).toBeFalsy();
    const flag = process.env.MOJULO_SEMANTIC_INDEX_DISABLED;
    delete process.env.MOJULO_SEMANTIC_INDEX_DISABLED;
    try {
      await EmbeddingsRepository.search('firefly', { kinds: ['solid_vocab'], limit: 3 });
    } finally { process.env.MOJULO_SEMANTIC_INDEX_DISABLED = flag; }
    expect(EmbeddingsRepository.findByRef('solid_vocab', 'species/firefly')).toBeTruthy();
  }, 120_000);
});
