/**
 * Manji-program shelf loader.
 *
 * Manji-program cards on the markdown shelf are the second source of
 * `manji_program`-kind entries (the first is the in-code library inside
 * mandala-patterns.js — mandala-pattern + shot-glyph cards that carry a
 * `manjiProgram` field). Shelf cards are pure manji-program presets with
 * no legacy renderer rigging; they exist to make the curatorial expansion
 * tractable as the library grows past the dozen-or-so threshold where a
 * single JS file starts to drag.
 *
 * File format mirrors `lib/mcp/catalysts/`:
 *
 *   ---
 *   { "id": "...", "label": "...", "family": "...", ...,
 *     "manjiProgram": { "spine": {...}, "slots": [...] } }
 *   ---
 *
 *   # Body markdown — the prose surface
 *
 *   ## Use when
 *   (paragraphs the model reads to decide whether to reach for this card)
 *
 *   ## Slot semantics
 *   (per-slot prose declaring what each slot is FOR)
 *
 *   ## Composition examples
 *   (worked examples of pairing this card with other cards)
 *
 *   ## Provenance and influences
 *   (art-history lineage; optional)
 *
 *   ## Stays bespoke when
 *   (cases where this card is NOT the right fit)
 *
 * The body is the highest-signal retrieval surface — semantic_search
 * indexes it alongside the frontmatter metadata. Longer prose = better
 * intent matching, which is the lever that makes the library expansion
 * pay off as it grows. See
 * lite-template/integration/0605/manji-program-library-expansion.plan.md.
 *
 * Frontmatter is JSON (not YAML) to match the catalyst convention and
 * keep the parse unambiguous + dep-free.
 *
 * Validation faults are loader bugs (the shelf is curated, not user
 * input) — we throw with a clear file reference so a bad PR fails loudly.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
const SHELF_DIR = moduleDir(import.meta.url, 'lib/graph/manji-programs');

// id/label/family are always required (taxonomy + retrieval). At least
// ONE scenic primitive (manjiProgram | waveField | connections) is also
// required — the card must describe SOMETHING the substrate can render.
// See lite-template/integration/0605/wave-field-plan-revision.plan.md.
const REQUIRED_FIELDS = ['id', 'label', 'family'];
const PRIMITIVE_FIELDS = ['manjiProgram', 'waveField', 'connections', 'waveManji'];
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

function parseShelfFile(filePath, raw) {
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(
      `Manji-program shelf card ${filePath} is missing JSON frontmatter (expected '---' fences).`,
    );
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(
      `Manji-program shelf card ${filePath} has invalid JSON frontmatter: ${err.message}`,
    );
  }
  for (const field of REQUIRED_FIELDS) {
    if (meta[field] === undefined || meta[field] === null) {
      throw new Error(
        `Manji-program shelf card ${filePath} is missing required field '${field}'.`,
      );
    }
  }
  const presentPrimitives = PRIMITIVE_FIELDS.filter((f) => meta[f] !== undefined && meta[f] !== null);
  if (presentPrimitives.length === 0) {
    throw new Error(
      `Manji-program shelf card ${filePath} must declare at least one primitive (manjiProgram | waveField | connections).`,
    );
  }
  if (meta.manjiProgram !== undefined && (typeof meta.manjiProgram !== 'object' || Array.isArray(meta.manjiProgram))) {
    throw new Error(
      `Manji-program shelf card ${filePath} field 'manjiProgram' must be an object when present.`,
    );
  }
  if (meta.waveField !== undefined && (typeof meta.waveField !== 'object' || Array.isArray(meta.waveField))) {
    throw new Error(
      `Manji-program shelf card ${filePath} field 'waveField' must be an object when present.`,
    );
  }
  if (meta.connections !== undefined && !Array.isArray(meta.connections)) {
    throw new Error(
      `Manji-program shelf card ${filePath} field 'connections' must be an array when present.`,
    );
  }
  if (meta.waveManji !== undefined && !Array.isArray(meta.waveManji)) {
    throw new Error(
      `Manji-program shelf card ${filePath} field 'waveManji' must be an array when present.`,
    );
  }
  const body = raw.slice(match[0].length).trim();
  if (!body) {
    throw new Error(
      `Manji-program shelf card ${filePath} has an empty body — the prose IS the curatorial value of the shelf format.`,
    );
  }
  return {
    id: meta.id,
    label: meta.label,
    family: meta.family,
    aliases: Array.isArray(meta.aliases) ? meta.aliases : [],
    intents: Array.isArray(meta.intents) ? meta.intents : [],
    topology: meta.topology || {},
    reasoningUse: Array.isArray(meta.reasoningUse) ? meta.reasoningUse : [],
    boundaryContract: meta.boundaryContract || {},
    manjiProgram: meta.manjiProgram ?? null,
    waveField: meta.waveField ?? null,
    connections: meta.connections ?? null,
    waveManji: meta.waveManji ?? null,
    body,
  };
}

let _catalog = null;

function loadCatalog() {
  const out = new Map();
  if (!existsSync(SHELF_DIR)) return out;
  const files = readdirSync(SHELF_DIR).filter(
    (f) => f.endsWith('.md') && f !== 'PRINCIPLES.md' && f !== 'README.md',
  );
  for (const file of files) {
    const filePath = join(SHELF_DIR, file);
    const raw = readFileSync(filePath, 'utf8');
    const card = parseShelfFile(filePath, raw);
    if (out.has(card.id)) {
      throw new Error(
        `Manji-program shelf id collision: '${card.id}' is declared in multiple files.`,
      );
    }
    card._file = file;
    out.set(card.id, card);
  }
  return out;
}

export function getManjiProgramCatalog() {
  if (!_catalog) _catalog = loadCatalog();
  return _catalog;
}

/**
 * Resolve a shelf card by id. Returns the FULL card (frontmatter +
 * body), or null if not found. Callers needing just the manjiProgram
 * preset pull `card.manjiProgram` themselves.
 *
 * Aliases are NOT respected here — the shelf path is keyed only on
 * `id`. Alias resolution lives in `resolveManjiProgramRef` (which
 * checks the in-code libraries first, where alias maps already exist)
 * and falls through to the shelf as the final source.
 */
export function getManjiProgramShelfCard(id) {
  const card = getManjiProgramCatalog().get(id);
  if (!card) return null;
  const { _file, ...rest } = card;
  return rest;
}

export function listManjiProgramShelfIds() {
  return Array.from(getManjiProgramCatalog().keys()).sort();
}

// Test seam — let the test suite reset the lazy catalog.
export function _resetCatalogForTests(catalog) {
  _catalog = catalog || null;
}

export { SHELF_DIR as _SHELF_DIR_FOR_TESTS, parseShelfFile as _parseShelfFileForTests };
