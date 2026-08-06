/**
 * Sketch vocabulary loader.
 *
 * Vocab cards are the retrieval-primed visual language for sketch composition.
 * Each card is a curated markdown file describing ONE paradigm, layout
 * affordance, or render primitive as an OPINIONATED TEMPLATE — concrete layout
 * math + an example mark fragment — not a prose definition. Retrieving the
 * card is meant to *be* retrieving the composition.
 *
 * Cards carry a `tier` so callers can filter by surface:
 *   - "chart"            (default) chart paradigms / layout affordances used
 *                        by the /sketch skill (stacked-bar, donut-ring, …).
 *   - "render-primitive" render primitives the polygonizer composes from
 *                        (r-brush, fluid-field, vision-pane, …). Injected
 *                        into the polygonizer system prompt only when the
 *                        classifier pre-pass tags the prompt as needing them.
 *   - "recipe"           recipe-shaped authoring shorthand (garment-pattern,
 *                        architectural-construction, panel-depiction-recipes).
 *
 * The cards are indexed into meta_embeddings under source_kind='sketch_vocab'
 * (see lib/db/repositories/embeddings.js → reindexAll). The /sketch skill
 * queries `semantic_search({ kinds: ['sketch_vocab'] })` with the user's intent,
 * then reads the matched cards in full via the `get_sketch_vocab` MCP tool. This
 * keeps the create_sketch tool description lean — the chart vocabulary lives in
 * the index, not in a paradigm enum that would anchor the model.
 *
 * Deliberately NOT mojulo-strict: no contextmap commit, no typed-component
 * store, no graduation. Sketches are scratch. The only discipline is the
 * manifest validator (so the renderer never gets garbage) and these cards
 * (so the model has layout discipline to retrieve). See
 * lite-template/integration/app-system/0528/sketch-chart-vocab/PLAN.md.
 *
 * File format mirrors catalysts — JSON frontmatter between two `---` fences,
 * then the markdown body:
 *
 *   ---
 *   { "id": "donut-ring", "name": "Donut / ring", "summary": "...", "when": "..." }
 *   ---
 *
 *   ## Marks ... ## Layout math ... ## Example
 *
 * Validation faults are loader bugs (curated library, not user input) — throw
 * with a clear file + field reference so a bad PR fails loudly.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VOCAB_DIR = dirname(fileURLToPath(import.meta.url));

// `when` is required: it's the intent-shaped line the embedding leads with, so
// a query phrased as a goal ("compare a few categories over a week") matches
// the card before its geometry prose does. Without it the card only matches on
// implementation vocabulary, which the model doesn't have yet at query time.
const REQUIRED_FIELDS = ['id', 'name', 'summary', 'when'];
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
const VALID_TIERS = new Set(['chart', 'render-primitive', 'recipe', 'mark']);
const DEFAULT_TIER = 'chart';

let _catalog = null;

export function parseVocabCard(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(
      `Sketch vocab card ${filePath} is missing JSON frontmatter (expected '---' fences).`,
    );
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`Sketch vocab card ${filePath} has invalid JSON frontmatter: ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (!meta[field] || typeof meta[field] !== 'string') {
      throw new Error(`Sketch vocab card ${filePath} is missing required string field '${field}'.`);
    }
  }
  const body = raw.slice(match[0].length).trim();
  if (!body) {
    throw new Error(`Sketch vocab card ${filePath} has an empty body — the layout math is the value.`);
  }
  const tier = meta.tier || DEFAULT_TIER;
  if (!VALID_TIERS.has(tier)) {
    throw new Error(
      `Sketch vocab card ${filePath} has invalid tier '${tier}' (expected one of: ${[...VALID_TIERS].join(', ')}).`,
    );
  }
  return {
    id: meta.id,
    name: meta.name,
    summary: meta.summary,
    when: meta.when,
    tier,
    // Optional: the low-level mark kinds this card composes from. Advisory
    // metadata for tooling; not validated against the renderer here.
    marks: Array.isArray(meta.marks) ? meta.marks : [],
    phase: meta.phase || 'p1',
    body,
  };
}

function loadCatalog() {
  const cards = new Map();
  if (!existsSync(VOCAB_DIR)) return cards;
  const addCard = (filePath, fileLabel) => {
    const card = parseVocabCard(filePath, readFileSync(filePath, 'utf8'));
    if (cards.has(card.id)) {
      throw new Error(
        `Sketch vocab id collision: '${card.id}' is declared in both ${cards.get(card.id)._file} and ${fileLabel}.`,
      );
    }
    card._file = fileLabel;
    cards.set(card.id, card);
  };
  for (const file of readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.md'))) {
    addCard(join(VOCAB_DIR, file), file);
  }
  // Pack vocab (generic seam): any `lib/graph/<pack>/vocab/*.md` joins the catalog. Content
  // packs are gitignored trees (e.g. the mobile-suit pack) whose cards ride the same
  // retrieval index only while the pack is installed — pack absent, cards absent; no
  // name-list to edit on either side.
  const GRAPH_DIR = join(VOCAB_DIR, '..');
  for (const entry of readdirSync(GRAPH_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'sketch-vocab') continue;
    const packVocab = join(GRAPH_DIR, entry.name, 'vocab');
    if (!existsSync(packVocab)) continue;
    for (const file of readdirSync(packVocab).filter((f) => f.endsWith('.md'))) {
      addCard(join(packVocab, file), join(entry.name, 'vocab', file));
    }
  }
  return cards;
}

export function getSketchVocabCatalog() {
  if (!_catalog) _catalog = loadCatalog();
  return _catalog;
}

export function listSketchVocab({ tier } = {}) {
  const catalog = getSketchVocabCatalog();
  const tierFilter = tier ? (Array.isArray(tier) ? new Set(tier) : new Set([tier])) : null;
  const out = [];
  for (const c of catalog.values()) {
    if (tierFilter && !tierFilter.has(c.tier)) continue;
    out.push({
      id: c.id,
      name: c.name,
      summary: c.summary,
      when: c.when,
      tier: c.tier,
      marks: c.marks,
      phase: c.phase,
    });
  }
  return out;
}

export function getSketchVocabCard(id) {
  const card = getSketchVocabCatalog().get(id);
  if (!card) return null;
  const { _file, ...rest } = card;
  return rest;
}

// Cards the polygonizer's system-prompt assembler composes from — the
// render-primitive cards plus the recipe cards (garment-pattern,
// architectural-construction, panel-depiction-recipes). The chart tier is
// excluded; charts are the /sketch surface's vocabulary, not the
// polygonizer's. Pass an explicit list of ids, or `'all'` to fetch every
// polygonizer-grammar card (safety net on first repair when the classifier
// may have mis-routed). Unknown ids throw — the loader is curated.
const POLYGONIZER_TIERS = new Set(['render-primitive', 'recipe']);

export function getRenderPrimitiveCards(ids) {
  const catalog = getSketchVocabCatalog();
  if (ids === 'all') {
    return Array.from(catalog.values())
      .filter((c) => POLYGONIZER_TIERS.has(c.tier))
      .map(stripInternal);
  }
  if (!Array.isArray(ids)) {
    throw new Error("getRenderPrimitiveCards expects an array of ids or the literal 'all'.");
  }
  const out = [];
  for (const id of ids) {
    const card = catalog.get(id);
    if (!card) {
      throw new Error(`Unknown sketch vocab card id '${id}'.`);
    }
    if (!POLYGONIZER_TIERS.has(card.tier)) {
      throw new Error(
        `Card '${id}' has tier '${card.tier}', expected one of ${[...POLYGONIZER_TIERS].join(', ')}. Use getSketchVocabCard for chart cards.`,
      );
    }
    out.push(stripInternal(card));
  }
  return out;
}

function stripInternal(card) {
  const { _file, ...rest } = card;
  return rest;
}

// Test seam — let a test point at a fixture or force a reload.
export function _resetSketchVocabForTests(catalog) {
  _catalog = catalog || null;
}

export { VOCAB_DIR as _SKETCH_VOCAB_DIR_FOR_TESTS };
