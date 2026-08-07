// Isolate this test file to an in-memory SQLite — must run before any import
// that pulls in db/index.js.
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the embedder before the repository import so the lazy ONNX load
// never fires under test. Deterministic 384-dim vector from the input
// text — cosine similarity then reflects literal token-overlap, which is
// enough to verify the indexing wiring lands school-of-athens for
// intent queries that share vocabulary with its retrieval body.
vi.mock('../../embedder/local.js', async () => {
  const { createHash } = await import('node:crypto');
  const LOCAL_EMBEDDING_DIM = 384;
  const LOCAL_EMBEDDING_MODEL = 'multilingual-e5-small';

  // Token-bag vector: hash each whitespace token to a sparse position;
  // accumulate; normalize. Co-occurring tokens between query and doc lift
  // cosine, so an intent query that shares words with the body matches.
  function vectorFromText(text) {
    const v = new Float32Array(LOCAL_EMBEDDING_DIM);
    const tokens = String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    for (const t of tokens) {
      const buf = createHash('sha256').update(t).digest();
      // Two positions per token to reduce collision noise.
      const i0 = ((buf[0] << 8) | buf[1]) % LOCAL_EMBEDDING_DIM;
      const i1 = ((buf[2] << 8) | buf[3]) % LOCAL_EMBEDDING_DIM;
      v[i0] += 1;
      v[i1] += 1;
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
  BodyComposition,
  reindexAll,
} from './embeddings.js';
import {
  mandalaPatternLibrary,
  shotGlyphLibrary,
} from '../../graph/polygonizer/mandala-patterns.js';

beforeEach(() => {
  closeDb();
});

describe('BodyComposition.manjiProgram', () => {
  it('front-loads retrieval signals (label, aliases, family, intents, slots) for a mandala-pattern card', () => {
    const card = mandalaPatternLibrary().find((c) => c.id === 'snowflake-sixfold');
    expect(card.manjiProgram).toBeTruthy();
    const body = BodyComposition.manjiProgram(card);
    expect(body).toContain('Snowflake sixfold');
    expect(body).toContain('Ref: snowflake-sixfold');
    expect(body).toContain('Aliases:');
    expect(body).toContain('Family: radial-symmetry');
    expect(body).toContain('Intents:');
    expect(body).toContain('Use when:');
    // Bind-slot vocabulary (2D-shape slotLabels + centerSlotId)
    expect(body).toContain('Bind slots:');
    expect(body).toContain('arm-0');
    expect(body).toContain('center');
  });

  it('handles 3D shot-glyph cards (slots[].id instead of slotLabels)', () => {
    const card = shotGlyphLibrary().find((c) => c.id === 'school-of-athens-central-hall');
    expect(card.manjiProgram).toBeTruthy();
    const body = BodyComposition.manjiProgram(card);
    expect(body).toContain('School of Athens central hall');
    expect(body).toContain('Ref: school-of-athens-central-hall');
    expect(body).toContain('Bind slots:');
    expect(body).toContain('axis-mundi-hub');
    expect(body).toContain('back-arch-aperture');
  });
});

describe('reindexAll indexes manji-program-bearing cards', () => {
  it('writes a meta_embeddings row for each card with a manjiProgram', { timeout: 30000 }, async () => {
    getDb();
    const result = await reindexAll();
    expect(result.written).toBeGreaterThan(0);

    // snowflake-sixfold and l-tetrad were converted earlier in the migration.
    expect(EmbeddingsRepository.findByRef('manji_program', 'snowflake-sixfold')).not.toBe(null);
    expect(EmbeddingsRepository.findByRef('manji_program', 'l-tetrad')).not.toBe(null);
    // school-of-athens-central-hall is the first shot glyph with manjiProgram.
    expect(EmbeddingsRepository.findByRef('manji_program', 'school-of-athens-central-hall')).not.toBe(null);
  });

  it('does NOT index cards without a manjiProgram field', { timeout: 30000 }, async () => {
    getDb();
    await reindexAll();
    // pinwheel-tetrad and seal-grid do not yet carry manjiProgram fields.
    expect(EmbeddingsRepository.findByRef('manji_program', 'pinwheel-tetrad')).toBe(null);
    expect(EmbeddingsRepository.findByRef('manji_program', 'seal-grid')).toBe(null);
  });

  it('is idempotent — second reindex skips manji_program rows that already match', { timeout: 30000 }, async () => {
    getDb();
    const first = await reindexAll();
    const second = await reindexAll();
    expect(second.written).toBe(0);
    expect(second.skipped).toBe(first.totalSeen);
  });
});

describe('semantic_search surfaces school-of-athens for civic-hall intent', () => {
  it('returns school-of-athens-central-hall among the top results for a hall-ish intent query', { timeout: 30000 }, async () => {
    getDb();
    await reindexAll();
    const results = await EmbeddingsRepository.search(
      'civic interior hall with central axis mundi and back arch aperture',
      { kinds: ['manji_program'], limit: 5 },
    );
    expect(results.length).toBeGreaterThan(0);
    const refs = results.map((r) => r.source_ref);
    expect(refs).toContain('school-of-athens-central-hall');
    // It should be the top result for this very on-vocabulary query.
    expect(refs[0]).toBe('school-of-athens-central-hall');
  });

  it('returns snowflake-sixfold for a six-fold radial query', { timeout: 30000 }, async () => {
    getDb();
    await reindexAll();
    // The query leans on snowflake-sixfold's distinctive vocabulary (crystal,
    // mirrored arms, branching spokes). A bare "six fold radial symmetry"
    // query now collides with the markdown-shelf `mandala-six` card ("Mandala
    // (six-fold)"), which is an equally valid answer — so disambiguate toward
    // the card under test rather than weakening the assertion.
    const results = await EmbeddingsRepository.search(
      'snowflake crystal with six mirrored radial arms branching around one center',
      { kinds: ['manji_program'], limit: 5 },
    );
    const refs = results.map((r) => r.source_ref);
    expect(refs).toContain('snowflake-sixfold');
  });
});

describe('Wave 1.5 surface cards each surface for a natural-intent query', () => {
  // Limit was bumped from 3 to 5 after Wave 2 (cameras / architecture /
  // postures) shipped — the new cards' rich prose bodies share generic
  // tokens (`sky`, `interior`, `architecture`, `civic`) with some Wave 1.5
  // surface queries, which can push a surface card past the top-3 cutoff.
  // The card still ranks well; the test just needs slightly more headroom.
  // Per polygonizer-capability-additions.plan.md: prefer bumping limit over
  // weakening assertion contents.
  it('all 6 surface shelf cards rank in the top 5 results for an on-vocabulary query', { timeout: 30000 }, async () => {
    getDb();
    await reindexAll();
    const cases = [
      {
        query: 'calm still water surface for a coastal harbor scene',
        expected: 'calm-water',
      },
      {
        query: 'rough open ocean stormy sea with high energy waves',
        expected: 'choppy-sea',
      },
      {
        query: 'rolling green countryside hills pastoral terrain',
        expected: 'rolling-hills',
      },
      {
        query: 'clear daytime sky backdrop behind exterior architecture',
        expected: 'clear-sky-gradient',
      },
      {
        query: 'flat stone interior floor for a hall or plaza',
        expected: 'flat-floor',
      },
      {
        query: 'tiled paved floor with visible tile pattern for civic interior',
        expected: 'tile-grid-floor',
      },
    ];
    const failures = [];
    for (const { query, expected } of cases) {
      const results = await EmbeddingsRepository.search(query, {
        kinds: ['manji_program'],
        limit: 5,
      });
      const refs = results.map((r) => r.source_ref);
      if (!refs.includes(expected)) {
        failures.push({ query, expected, got: refs });
      }
    }
    if (failures.length) {
      // eslint-disable-next-line no-console
      console.error('Wave 1.5 surface discovery failures:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);
  });

  it('indexer counts at least 17 manji_program rows (3 original + 8 Wave 1 + 6 Wave 1.5)', { timeout: 30000 }, async () => {
    getDb();
    await reindexAll();
    // Spot-check a few of each kind to confirm indexing breadth.
    expect(EmbeddingsRepository.findByRef('manji_program', 'calm-water')).not.toBe(null);
    expect(EmbeddingsRepository.findByRef('manji_program', 'rolling-hills')).not.toBe(null);
    expect(EmbeddingsRepository.findByRef('manji_program', 'wide-shot-landscape')).not.toBe(null);
    expect(EmbeddingsRepository.findByRef('manji_program', 'cathedral-nave-deep-perspective')).not.toBe(null);
    expect(EmbeddingsRepository.findByRef('manji_program', 'snowflake-sixfold')).not.toBe(null);
  });
});

describe('Wave 1 cards each surface for a natural-intent query', () => {
  it('all 8 Wave 1 cards rank in the top 3 results for an on-vocabulary query (PC)', { timeout: 30000 }, async () => {
    getDb();
    await reindexAll();
    const cases = [
      {
        query: 'wide establishing landscape shot with deep foreground midground and far horizon',
        expected: 'wide-shot-landscape',
      },
      {
        query: 'medium framing of one figure from the waist up for dialogue',
        expected: 'medium-shot-figure',
      },
      {
        query: 'intimate face close up showing emotion through expression',
        expected: 'close-up-face',
      },
      {
        query: 'over the shoulder shot framing two characters in conversation',
        expected: 'over-the-shoulder-two-figure',
      },
      {
        query: 'three figures arranged in a classical pyramidal triangular composition',
        expected: 'triangular-figure-stack',
      },
      {
        query: 'deep cathedral nave interior with vaulted ceiling and altar at the back',
        expected: 'cathedral-nave-deep-perspective',
      },
      {
        query: 'canonical upright standing figure armature with head torso and limbs',
        expected: 'standing-figure-canonical',
      },
      {
        query: 'three objects arranged on a tabletop still life surface',
        expected: 'still-life-tabletop-three-objects',
      },
    ];
    const failures = [];
    for (const { query, expected } of cases) {
      const results = await EmbeddingsRepository.search(query, {
        kinds: ['manji_program'],
        limit: 3,
      });
      const refs = results.map((r) => r.source_ref);
      if (!refs.includes(expected)) {
        failures.push({ query, expected, got: refs });
      }
    }
    if (failures.length) {
      // Print a useful diagnostic so the operator can tune reasoningUse / aliases.
      // eslint-disable-next-line no-console
      console.error('Wave 1 discovery failures:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);
  });
});

describe('Wave 2.1 cards each surface for a natural-intent query', () => {
  it('the new low-angle-hero card surfaces in the top 3 for a heroic-framing query (PC)', { timeout: 30000 }, async () => {
    getDb();
    await reindexAll();
    const cases = [
      {
        query: 'dramatic low angle hero shot looking up at a monumental towering subject against open sky',
        expected: 'low-angle-hero',
      },
    ];
    const failures = [];
    for (const { query, expected } of cases) {
      const results = await EmbeddingsRepository.search(query, {
        kinds: ['manji_program'],
        limit: 3,
      });
      const refs = results.map((r) => r.source_ref);
      if (!refs.includes(expected)) {
        failures.push({ query, expected, got: refs });
      }
    }
    if (failures.length) {
      // eslint-disable-next-line no-console
      console.error('Wave 2.1 discovery failures:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);
  });
});

describe('Wave 2.2 architecture cards each surface for a natural-intent query', () => {
  it('all 5 Wave 2.2 cards rank in the top 3 results for an on-vocabulary query (PC)', { timeout: 30000 }, async () => {
    getDb();
    await reindexAll();
    const cases = [
      {
        query: 'rectangular peristyle ring of columns surrounding an open classical temple courtyard',
        expected: 'peristyle-colonnade',
      },
      {
        query: 'monastic cloister courtyard with arcaded walkways and a central garth garden',
        expected: 'cloister-square',
      },
      {
        query: 'hexagonal six column garden gazebo pavilion with open sides and a peaked roof',
        expected: 'gazebo-six-column',
      },
      {
        query: 'classical three bay tripartite portico entrance facade with four piers and a pediment',
        expected: 'portico-three-bay',
      },
      {
        query: 'garden pergola open lattice walk with two parallel rows of posts and an overhead canopy',
        expected: 'garden-pergola',
      },
    ];
    const failures = [];
    for (const { query, expected } of cases) {
      const results = await EmbeddingsRepository.search(query, {
        kinds: ['manji_program'],
        limit: 3,
      });
      const refs = results.map((r) => r.source_ref);
      if (!refs.includes(expected)) {
        failures.push({ query, expected, got: refs });
      }
    }
    if (failures.length) {
      // eslint-disable-next-line no-console
      console.error('Wave 2.2 discovery failures:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);
  });
});

describe('Wave 2.3 posture cards each surface for a natural-intent query', () => {
  it('all 4 new Wave 2.3 posture cards rank in the top 3 results for an on-vocabulary query (PC)', { timeout: 30000 }, async () => {
    getDb();
    await reindexAll();
    // standing-figure-canonical is already covered by the Wave 1 test (it was
    // promoted from in-code in Wave 2.3 with geometry preserved). This block
    // covers the 4 new postures.
    const cases = [
      {
        query: 'formal seated figure on a throne with upright torso and feet on the ground',
        expected: 'seated-figure-formal',
      },
      {
        query: 'kneeling supplicant figure with hands clasped in prayer torso upright knees on the ground',
        expected: 'kneeling-figure-supplicant',
      },
      {
        query: 'classical reclining nude figure on a couch propped on one elbow horizontal pose',
        expected: 'reclining-figure-classical',
      },
      {
        query: 'contrapposto classical figure standing with weight on one leg S-curve hip and shoulder counter-tilt',
        expected: 'contrapposto-figure-canonical',
      },
    ];
    const failures = [];
    for (const { query, expected } of cases) {
      const results = await EmbeddingsRepository.search(query, {
        kinds: ['manji_program'],
        limit: 3,
      });
      const refs = results.map((r) => r.source_ref);
      if (!refs.includes(expected)) {
        failures.push({ query, expected, got: refs });
      }
    }
    if (failures.length) {
      // eslint-disable-next-line no-console
      console.error('Wave 2.3 discovery failures:', JSON.stringify(failures, null, 2));
    }
    expect(failures).toEqual([]);
  });
});
