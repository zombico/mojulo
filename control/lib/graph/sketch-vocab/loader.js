/**
 * Sketch vocabulary loader.
 *
 * Vocab cards are the retrieval-primed chart language for the /sketch surface.
 * Each card is a curated markdown file describing ONE paradigm or layout
 * affordance (stacked bar, donut/ring, KPI tile, grid layout, z-layering, the
 * flow pipeline) as an OPINIONATED TEMPLATE — concrete layout math + an example
 * mark fragment — not a prose definition. Retrieving the card is meant to *be*
 * retrieving the composition.
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
  return {
    id: meta.id,
    name: meta.name,
    summary: meta.summary,
    when: meta.when,
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
  const files = readdirSync(VOCAB_DIR).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const filePath = join(VOCAB_DIR, file);
    const raw = readFileSync(filePath, 'utf8');
    const card = parseVocabCard(filePath, raw);
    if (cards.has(card.id)) {
      throw new Error(
        `Sketch vocab id collision: '${card.id}' is declared in both ${cards.get(card.id)._file} and ${file}.`,
      );
    }
    card._file = file;
    cards.set(card.id, card);
  }
  return cards;
}

export function getSketchVocabCatalog() {
  if (!_catalog) _catalog = loadCatalog();
  return _catalog;
}

export function listSketchVocab() {
  const catalog = getSketchVocabCatalog();
  return Array.from(catalog.values()).map((c) => ({
    id: c.id,
    name: c.name,
    summary: c.summary,
    when: c.when,
    marks: c.marks,
    phase: c.phase,
  }));
}

export function getSketchVocabCard(id) {
  const card = getSketchVocabCatalog().get(id);
  if (!card) return null;
  const { _file, ...rest } = card;
  return rest;
}

// Test seam — let a test point at a fixture or force a reload.
export function _resetSketchVocabForTests(catalog) {
  _catalog = catalog || null;
}

export { VOCAB_DIR as _SKETCH_VOCAB_DIR_FOR_TESTS };
