// The historic entries through semantic_search's DEFAULT path: lexical, no embedding runtime (the opt-in
// `recall` group absent). The context chain is FIND (search) → READ (the entry) → MINT (a starter); this is the
// FIND hop, on the words people type, with nothing but the generated cards' text.

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
import { semanticSearchHandler } from '../../mcp/tools/semantic-search.js';
import { getViewVocabCatalog } from '../views/view-vocab/loader.js';

const ENTRY_OF = { egypt: ['egypt', 'thebes', 'giza'], thebes: ['thebes', 'egypt'], giza: ['giza', 'egypt'], sumer: ['sumer'], lindos: ['lindos', 'greece'], qin: ['qin'], pompeii: ['pompeii', 'italy'], forum: ['forum', 'italy'], rome: ['forum', 'pompeii', 'italy'] };

beforeAll(async () => {
  closeDb();
  getDb();
  await reindexAll();
}, 120_000);
afterAll(() => closeDb());

async function top(query, k = 3) {
  return (await EmbeddingsRepository.search(query, { kinds: ['view_vocab'], limit: k })).map((r) => r.source_ref);
}

describe('finding an entry by the words people type (lexical, no model)', () => {
  const cases = [
    ['egypt', ENTRY_OF.egypt], ['egyptian temple town', ENTRY_OF.egypt], ['pharaoh', ENTRY_OF.egypt], ['the nile', ENTRY_OF.egypt],
    ['egypt inspired level', ENTRY_OF.egypt], ['ancient thebes', ENTRY_OF.thebes], ['luxor karnak', ENTRY_OF.thebes],
    ['pyramids and the sphinx', ENTRY_OF.giza], ['ziggurat', ENTRY_OF.sumer], ['sumerian city', ENTRY_OF.sumer],
    ['mesopotamia', ENTRY_OF.sumer], ['a greek town on rhodes', ENTRY_OF.lindos], ['qin xianyang', ENTRY_OF.qin],
    ['pompeii before the eruption', ENTRY_OF.pompeii], ['vesuvius', ENTRY_OF.pompeii], ['the roman forum', ENTRY_OF.forum],
    ['ancient rome', ENTRY_OF.rome], ['a roman town', ENTRY_OF.rome],
  ];
  for (const [q, want] of cases) {
    it(`"${q}" finds ${want[0]} in the top 3`, async () => {
      const got = await top(q);
      expect(got.some((r) => want.includes(r)), `${q} → ${got.join(', ')}`).toBe(true);
    });
  }

  it('never surfaces a record card: an entry answers before its sources', async () => {
    for (const q of ['mud brick limestone sources', 'egypt record', 'sumer']) {
      expect((await top(q, 10)).some((r) => r.endsWith('/record'))).toBe(false);
    }
  });

  it('a cold ask finds the historic routing card', async () => {
    const r = await EmbeddingsRepository.search('show me ancient egypt', { kinds: ['routing'], limit: 3 });
    expect(r.map((x) => x.source_ref)).toContain('historic');
  });

  it('a query not in English finds nothing and says why: the index reads English terms', async () => {
    const out = await semanticSearchHandler({ query: 'エジプト風のステージ', kinds: ['view_vocab'] });
    expect(out.results.length).toBe(0);
    const again = await semanticSearchHandler({ query: 'ägyptische tempelstadt am fluss', kinds: ['view_vocab'] });
    expect(again.hint || '').toMatch(/English/);
  });
});

describe('an upgraded index learns the cards a release shipped', () => {
  it('a reindexed corpus missing a shipped entry gets it on the next search', async () => {
    const db = getDb();
    db.prepare("DELETE FROM meta_embeddings WHERE source_kind = 'view_vocab' AND source_ref = 'thebes'").run();
    expect(EmbeddingsRepository.findByRef('view_vocab', 'thebes')).toBeFalsy();
    const flag = process.env.MOJULO_SEMANTIC_INDEX_DISABLED;
    delete process.env.MOJULO_SEMANTIC_INDEX_DISABLED;
    try {
      await EmbeddingsRepository.search('thebes', { kinds: ['view_vocab'], limit: 3 });
    } finally { process.env.MOJULO_SEMANTIC_INDEX_DISABLED = flag; }
    expect(EmbeddingsRepository.findByRef('view_vocab', 'thebes')).toBeTruthy();
    expect(getViewVocabCatalog().get('thebes')).toBeTruthy();
  }, 120_000);
});
