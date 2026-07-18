// Routing eval — does the retrieval hop route like the in-context rows did?
//
// The orientation diet retired forward_context's fat Create-things rows into
// routing cards behind semantic_search({kinds:['routing']}). This harness is
// the gate on that move: a fixture of user phrasings (PARAPHRASES, deliberately
// not verbatim card quotes — verbatim matches prove nothing) → the expected
// entry tool, asserted to appear in the top-K retrieved cards. A failure means
// a card needs another anchor quote in `when`, not that the architecture is
// wrong — fix the card, not the test.
//
// Uses the REAL local ONNX embedder (the mocked hash-embedder in
// semantic-search.integration.test.js is not semantically meaningful, which
// is the whole point here). Auto-skips when the model isn't fetched — run
// `node scripts/fetch-embed-model.js` to enable locally.

process.env.SQLITE_PATH = ':memory:';

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const MODEL_REL = 'Xenova/multilingual-e5-small/onnx/model_quantized.onnx';
const modelPresent =
  existsSync(join(here, '../../embedder/models', MODEL_REL)) ||
  existsSync(join(homedir(), '.mojulo/models', MODEL_REL));

// phrasing → entry tool the shortlist must surface. Keep phrasings colloquial
// and OFF-card; when adding a creative capability, add 1–2 rows here.
const FIXTURE = [
  ['can you sketch our deployment pipeline as boxes and arrows', 'create_sketch'],
  ['bar chart of last month signups by week', 'create_sketch'],
  ['paint a moody mountain valley at dusk', 'sketch_what_possible'],
  ['I want a picture of a woman mid-stride', 'create_figure'],
  ['recreate the camera angle from this photo I am showing you', 'reference_protocol'],
  ['our company logo in shiny 3D chrome', 'create_carved_solid'],
  ['model a wine glass true to size', 'create_workbench'],
  ['put the wheels and the chassis together into one model', 'create_assembler'],
  ['build me a little town I can wander around in', 'compose_world'],
  ['help my kid understand black holes with something animated', 'create_view'],
  ['background music for the forest level', 'create_beats'],
  ['give me a spinning view of that molecule', 'forge_motion'],
  ['present these three charts one after another with build-in steps', 'forge_motion'],
  ['record the hero clearing the chasm and show me the clip', 'forge_motion'],
  ['check the player can actually get from the door to the goal', 'forge_motion'],
  ['merge those short clips into a single movie file', 'stitch_motion'],
  ['a roguelike where my gear persists across floors', 'create_game'],
  ['turn my notes into a picture book for kids', 'mint_stash'],
  ['lay out a comic page of my hero fighting the dragon', 'create_sketch'],
  ['an AI-painted portrait I will render with an image model', 'create_sketch'],
  ['make my anime character actually talk and blink', 'create_sketch'],
  ['stage the two drawn characters in one scene and cut between their rooms', 'create_sketch'],
];

// Discriminating fixtures: create_sketch is the entry for BOTH diagram-chart
// and image-render, so the entry-tool eval above can't tell them apart. These
// pin the CARD (source_ref) the intent must surface, gating the form linkage.
const CARD_FIXTURE = [
  ['lay out a comic page of my hero fighting the dragon', 'image-render'],
  ['an AI-painted portrait I will render with an image model', 'image-render'],
  ['bar chart of last month signups by week', 'diagram-chart'],
  ['make my anime character actually talk and blink', 'animate-character'],
  ['stage the two drawn characters in one scene and cut between their rooms', 'animate-character'],
];

const TOP_K = 3;

describe.skipIf(!modelPresent)('routing-card retrieval eval (real embedder)', () => {
  let EmbeddingsRepository;
  let catalog;

  beforeAll(async () => {
    const embeddings = await import('@/lib/db/repositories/embeddings');
    EmbeddingsRepository = embeddings.EmbeddingsRepository;
    const { getRoutingCardCatalog } = await import('./loader.js');
    catalog = getRoutingCardCatalog();

    // Index ONLY the routing cards — reindexAll would embed the whole card
    // universe through the real model and turn this eval into a minutes-long
    // run for no extra signal.
    const items = [...catalog.values()].map((card) => ({
      sourceKind: 'routing',
      sourceRef: card.id,
      bodyText: embeddings.BodyComposition.routingCard(card),
    }));
    const embedded = await EmbeddingsRepository.embedMany(items);
    for (const e of embedded) {
      if (!e.vector) throw new Error(`embed failed for routing card ${e.sourceRef}`);
      EmbeddingsRepository.upsertSync({
        sourceKind: e.sourceKind,
        sourceRef: e.sourceRef,
        bodyText: e.bodyText,
        hash: e.hash,
        vector: e.vector,
      });
    }
  }, 120_000);

  afterAll(async () => {
    const { closeDb } = await import('@/lib/db/index');
    closeDb();
  });

  it(
    `every fixture phrasing surfaces its entry tool in the top-${TOP_K} cards`,
    async () => {
      const misses = [];
      for (const [phrasing, expectedEntry] of FIXTURE) {
        const results = await EmbeddingsRepository.search(phrasing, {
          kinds: ['routing'],
          limit: TOP_K,
        });
        const entries = results.map((r) => catalog.get(r.source_ref)?.entry);
        if (!entries.includes(expectedEntry)) {
          misses.push(
            `"${phrasing}" → wanted ${expectedEntry}, got [${results
              .map((r) => `${r.source_ref}:${r.score.toFixed(3)}`)
              .join(', ')}]`,
          );
        }
      }
      expect(misses, `routing misses:\n${misses.join('\n')}`).toEqual([]);
    },
    120_000,
  );

  it(
    `every discriminating phrasing surfaces its specific card in the top-${TOP_K}`,
    async () => {
      const misses = [];
      for (const [phrasing, expectedCard] of CARD_FIXTURE) {
        const results = await EmbeddingsRepository.search(phrasing, {
          kinds: ['routing'],
          limit: TOP_K,
        });
        const refs = results.map((r) => r.source_ref);
        if (!refs.includes(expectedCard)) {
          misses.push(
            `"${phrasing}" → wanted card ${expectedCard}, got [${results
              .map((r) => `${r.source_ref}:${r.score.toFixed(3)}`)
              .join(', ')}]`,
          );
        }
      }
      expect(misses, `card-level routing misses:\n${misses.join('\n')}`).toEqual([]);
    },
    120_000,
  );

  it('routing results return the full card body, not a truncated snippet', async () => {
    const [top] = await EmbeddingsRepository.search('walk to the exit and verify it', {
      kinds: ['routing'],
      limit: 1,
    });
    expect(top).toBeDefined();
    // Full-body contract: the snippet IS the composed card (never elided).
    expect(top.snippet).not.toMatch(/…$/);
    expect(top.snippet).toContain('Entry: `');
  });
});
