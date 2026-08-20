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
  ['I want a picture of a woman mid-stride', 'mint_solid'],
  ['recreate the camera angle from this photo I am showing you', 'reference_protocol'],
  ['our company logo in shiny 3D chrome', 'mint_solid'],
  ['model a wine glass true to size', 'mint_solid'],
  ['put the wheels and the chassis together into one model', 'mint_solid'],
  ['turn this concept art of an espresso machine into a 3d model piece by piece', 'mint_solid'],
  ['rebuild my drawing of a bicycle as a real 3d model one segment at a time', 'mint_solid'],
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
  ['make a pixel-art cutscene of my hero character', 'get_catalyst'],
  ['pixelize this portrait into a 32-bit sprite', 'get_catalyst'],
  // Orientation-containment C1: the FORM recognizer rows moved into the studio
  // body (forward_context mode:'studio'); these rows pin that an agent that
  // skips the studio read and goes straight to semantic_search still lands on
  // the right card. Voice previously had no fixture coverage.
  ['I want my comic to reveal one speech bubble per tap on my phone', 'create_sketch'],
  ['present the graphic novel like a slideshow I click through', 'create_sketch'],
  ['I want the narrator to sound deeper and more sure of herself', 'create_voice'],
  ['give my app a japanese female announcer voice', 'create_voice'],
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
  ['make a pixel-art cutscene of my hero character', 'pixel-art'],
  ['I want my comic to reveal one speech bubble per tap on my phone', 'motion-comic'],
  ['present the graphic novel like a slideshow I click through', 'motion-comic'],
];

// Adjacency collisions: pairs of cards that share heavy surface vocabulary
// ("walk", "dungeon", "world", "animated") where the top-3 membership gate
// above is too loose — the WRONG neighbour can sit at RANK 0 while the right
// card rides along at rank 1 and the top-3 gate stays green. These pin RANK-0
// (true top-1) for the intent: the gate that actually catches a mis-route.
// Seeded from the persona-sweep loop that found "playable dungeon crawler I
// walk around in" landing on the walkability-audit card instead of create_game.
const COLLISION_FIXTURE = [
  // a playable artifact vs the walkability audit — both are "walk in a world"
  ['a playable dungeon crawler I can actually walk around in', 'create_game'],
  // ...while the audit itself must still win its own turf (the control)
  ['walk to the exit and check the level is beatable', 'forge_motion'],
  // an animated explainer vs a camera flythrough — margin was ~0.004
  ['show my kid how a black hole bends light, animated', 'create_view'],
];

// Office wing (Bot / App / Connected Service) — the paradigm-disambiguation
// cards. Same top-K entry-membership contract as FIXTURE. Business phrasings
// are less messy than creative ones (concrete nouns: CRM, submissions, folder),
// so these route cleanly; the genuinely-ambiguous asks live in COVERAGE below.
const OFFICE_FIXTURE = [
  ['build me a customer support chatbot for my website', 'start_new_bot'],
  ['every Monday summarize qualified leads into our CRM', 'meta_context_declare_inventory'],
  ['sync new form submissions to a google sheet nightly', 'meta_context_declare_inventory'],
  ['watch this folder and process new invoices as they arrive', 'install_scaffold'],
  ['a background worker on my machine that reacts to events', 'install_scaffold'],
  // Substrate self-description (0816 post-install persona sims): these exact
  // question families dead-ended in semantic_search — "phone home" and
  // "uninstall" retrieved declared vendor tools (gmail.untrash_thread) because
  // no card carried the substrate's own posture. The substrate-self card
  // routes them to get_substrate, whose facts block the agent derives from.
  ['does mojulo send my data to your servers', 'get_substrate'],
  ['how do I completely remove this thing from my laptop', 'get_substrate'],
  ['can I safely put patient information into one of these bots', 'get_substrate'],
  ['is there a subscription or do I need to buy an api key', 'get_substrate'],
];

// The TWO-STEP contract. For an ask that genuinely spans paradigms ("triage
// support emails" — chat surface, or silent inbox automation?), a top-1 gate is
// wrong: the design wants the candidate SET to CONTAIN the viable paradigms so
// step-2 (crisp who-touches-it criteria + ask-the-user) can decide. This pins
// SET COVERAGE — ≥2 of the expected paradigm cards present in the top-SET_K —
// which is the assertion the bot/app/connected-service two-step is built on.
const SET_K = 5;
const COVERAGE_FIXTURE = [
  ['triage incoming support emails and route them to the right team', ['bot', 'connected-service']],
  ['book appointments and add them to my calendar', ['bot', 'connected-service']],
];

const TOP_K = 3;

// Margin gate (routing-context-weaving.plan.md B2): rank-0 alone only fails at
// the flip point — a margin that erodes from 0.02 to 0.001 stays green until
// the day it flips. Collision rows must hold top1 − top2 by at least this much
// (post-tiebreaker score, ROUTING_LEXICAL_LAMBDA included). If a legitimate
// card edit shrinks a margin below the gate, add an anchor quote to the
// expected card's `when` — same remedy as a rank miss.
const COLLISION_MARGIN = 0.01;

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

  it(
    `every collision phrasing surfaces its entry tool at RANK 0 with ≥${COLLISION_MARGIN} margin over rank 1`,
    async () => {
      const misses = [];
      const margins = [];
      for (const [phrasing, expectedEntry] of COLLISION_FIXTURE) {
        const results = await EmbeddingsRepository.search(phrasing, {
          kinds: ['routing'],
          limit: TOP_K,
        });
        const topEntry = catalog.get(results[0]?.source_ref)?.entry;
        const margin =
          results.length > 1 ? results[0].score - results[1].score : Number.POSITIVE_INFINITY;
        margins.push(`"${phrasing}" → ${results[0]?.source_ref} margin ${margin.toFixed(4)}`);
        if (topEntry !== expectedEntry) {
          misses.push(
            `"${phrasing}" → wanted ${expectedEntry} at rank 0, got [${results
              .map((r) => `${r.source_ref}:${r.score.toFixed(3)}`)
              .join(', ')}]`,
          );
        } else if (margin < COLLISION_MARGIN) {
          misses.push(
            `"${phrasing}" → right card at rank 0 but margin ${margin.toFixed(4)} < ${COLLISION_MARGIN} ` +
              `(erosion warning — add an anchor quote to ${results[0].source_ref}'s \`when\`); ` +
              `rank 1 is ${results[1].source_ref}:${results[1].score.toFixed(3)}`,
          );
        }
      }
      // Margins print on every run so erosion is visible before it fails.
      console.log(`collision margins:\n${margins.join('\n')}`);
      expect(misses, `collision (rank-0 + margin) misses:\n${misses.join('\n')}`).toEqual([]);
    },
    120_000,
  );

  it(
    `every OFFICE phrasing surfaces its paradigm entry tool in the top-${TOP_K} cards`,
    async () => {
      const misses = [];
      for (const [phrasing, expectedEntry] of OFFICE_FIXTURE) {
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
      expect(misses, `office routing misses:\n${misses.join('\n')}`).toEqual([]);
    },
    120_000,
  );

  it(
    `every ambiguous OFFICE ask surfaces ≥2 viable paradigms in the top-${SET_K} SET (two-step coverage)`,
    async () => {
      const misses = [];
      for (const [phrasing, expectedCards] of COVERAGE_FIXTURE) {
        const results = await EmbeddingsRepository.search(phrasing, {
          kinds: ['routing'],
          limit: SET_K,
        });
        const refs = new Set(results.map((r) => r.source_ref));
        const covered = expectedCards.filter((c) => refs.has(c));
        if (covered.length < 2) {
          misses.push(
            `"${phrasing}" → wanted ≥2 of [${expectedCards.join(', ')}] in the SET, got [${results
              .map((r) => `${r.source_ref}:${r.score.toFixed(3)}`)
              .join(', ')}]`,
          );
        }
      }
      expect(misses, `two-step coverage misses:\n${misses.join('\n')}`).toEqual([]);
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

// ---------------------------------------------------------------------------
// Pack-level eval (tool-packs.plan.md P4) — DERIVED, not authored.
//
// In packs mode the connect surface is ~20 pack descriptions and the first
// routing hop is the model matching the ask against them in-context. The
// embedder is the deterministic proxy for that hop: it can't simulate the
// LLM's pick, but it catches the failure mode that matters — two recognizers
// claiming the same ask. Fixtures lift from the rows above by pure lookup
// (entry tool → home pack via the P2-D partition); spine entries (no pack
// hop, e.g. get_substrate) drop out. A near-miss at this grain costs one
// unveil, so the general gate is top-PACK_TOP_K membership; the derived
// collision rows pin rank-0 with the B2-style margin.
// ---------------------------------------------------------------------------

const PACK_TOP_K = 2;
const PACK_COLLISION_MARGIN = 0.01;

describe.skipIf(!modelPresent)('pack routing eval (derived from the fixtures above)', () => {
  let packs;
  let packIds;
  let packVectors; // id → Float32Array

  // A phrasing routes CORRECTLY to any pack that can dispatch its entry tool
  // — the home pack or a pack that `shared`-lists it ("lay out a comic page"
  // → create_sketch is dispatchable from pack_illustration; opening it there
  // is right, not a miss). Spine entries (no pack hop) return null.
  const acceptSetFor = (entry, packsMod) => {
    const home = packsMod.homePackForTool(entry);
    if (!home) return null;
    const ids = new Set([home.id]);
    for (const p of packsMod.PACKS) {
      if ((p.shared || []).includes(entry)) ids.add(p.id);
    }
    return ids;
  };

  // Documented judgment rows, not test-rigging: catalyst CONTENT ("is there a
  // pixel-art recipe") can't ride pack_catalysts' generic recognizer — that
  // routing legitimately goes through semantic_search (spine). At pack grain
  // these intents are ALSO served by the sprite/pixelizer tools (pack_game)
  // and the external-paint loop (pack_image_render), so those join the
  // accept set.
  const ACCEPT_OVERRIDES = new Map([
    ['make a pixel-art cutscene of my hero character', ['pack_game', 'pack_image_render']],
    ['pixelize this portrait into a 32-bit sprite', ['pack_game', 'pack_image_render']],
  ]);

  const deriveRows = (fixture, packsMod) =>
    fixture
      .map(([phrasing, entry]) => {
        const accept = acceptSetFor(entry, packsMod);
        if (!accept) return null;
        for (const extra of ACCEPT_OVERRIDES.get(phrasing) || []) accept.add(extra);
        return [phrasing, accept];
      })
      .filter(Boolean);

  const dot = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s; // vectors are L2-normalized — dot IS cosine
  };

  let rankPacks; // (queryVector) → [{ id, score }] sorted desc

  // Multi-vector scoring: one long recognizer averages its many anchors into
  // mush under e5-small (a query matching ONE quote gets diluted by the other
  // topics), which is not how the real hop works — the model latches onto the
  // matching example. So each pack embeds as its capability lead PLUS each
  // authored 'anchor quote' separately, and scores by MAX over segments.
  const segmentsFor = (pack) => {
    const quoted = [...pack.description.matchAll(/'([^']{8,})'/g)].map((m) => m[1]);
    const lead = pack.description.split(/Open for/i)[0];
    return [`${pack.title}. ${lead}`, ...quoted];
  };

  beforeAll(async () => {
    packs = await import('@/lib/mcp/packs');
    const { generateEmbeddings } = await import('@/lib/embedder/local');
    packIds = packs.PACKS.map((p) => p.id);
    const flat = [];
    const spans = []; // id → [start, end)
    for (const pack of packs.PACKS) {
      const segs = segmentsFor(pack);
      spans.push([flat.length, flat.length + segs.length]);
      flat.push(...segs);
    }
    const vectors = await generateEmbeddings(flat, { inputType: 'search_document' });
    packVectors = new Map(packIds.map((id, i) => [id, vectors.slice(spans[i][0], spans[i][1])]));
    rankPacks = (qv) =>
      packIds
        .map((id) => ({
          id,
          score: Math.max(...packVectors.get(id).map((v) => dot(qv, v))),
        }))
        .sort((a, b) => b.score - a.score);
  }, 120_000);

  it(
    `every derived phrasing surfaces its home pack in the top-${PACK_TOP_K} of ${20} recognizers`,
    async () => {
      const { generateEmbeddings } = await import('@/lib/embedder/local');
      const rows = deriveRows([...FIXTURE, ...OFFICE_FIXTURE], packs);
      const queries = await generateEmbeddings(
        rows.map(([phrasing]) => phrasing),
        { inputType: 'search_query' },
      );
      const misses = [];
      rows.forEach(([phrasing, acceptSet], i) => {
        const ranked = rankPacks(queries[i]);
        const top = ranked.slice(0, PACK_TOP_K).map((r) => r.id);
        if (!top.some((id) => acceptSet.has(id))) {
          misses.push(
            `"${phrasing}" → wanted one of [${[...acceptSet].join(', ')}], got [${ranked
              .slice(0, 3)
              .map((r) => `${r.id}:${r.score.toFixed(3)}`)
              .join(', ')}]`,
          );
        }
      });
      expect(misses, `pack routing misses:\n${misses.join('\n')}`).toEqual([]);
    },
    120_000,
  );

  it(
    `derived collision phrasings hold rank-0 with ≥${PACK_COLLISION_MARGIN} margin`,
    async () => {
      const { generateEmbeddings } = await import('@/lib/embedder/local');
      // Collision rows pin the HOME pack at strict rank-0 — no accept-set.
      const rows = COLLISION_FIXTURE.map(([phrasing, entry]) => [
        phrasing,
        packs.homePackForTool(entry)?.id,
      ]).filter(([, id]) => id);
      const queries = await generateEmbeddings(
        rows.map(([phrasing]) => phrasing),
        { inputType: 'search_query' },
      );
      const failures = [];
      rows.forEach(([phrasing, expectedPack], i) => {
        const ranked = rankPacks(queries[i]);
        const margin = ranked[0].score - ranked[1].score;
        // eslint-disable-next-line no-console
        console.log(
          `[pack-eval] "${phrasing}" → ${ranked[0].id} (margin ${margin.toFixed(4)}, want ${expectedPack})`,
        );
        if (ranked[0].id !== expectedPack) {
          failures.push(`"${phrasing}" → rank-0 ${ranked[0].id}, wanted ${expectedPack}`);
        } else if (margin < PACK_COLLISION_MARGIN) {
          failures.push(
            `"${phrasing}" → right pack but margin ${margin.toFixed(4)} < ${PACK_COLLISION_MARGIN} — add an anchor to the recognizer`,
          );
        }
      });
      expect(failures, `pack collision failures:\n${failures.join('\n')}`).toEqual([]);
    },
    120_000,
  );
});
