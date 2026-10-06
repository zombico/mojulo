/**
 * Solid vocabulary loader.
 *
 * One card per solid KIND / edit OP behind the consolidated entry tools:
 *   - `mint_solid` kinds (the former per-type creators: figure, manji-tree,
 *     workbench, assembler, carved-solid, solid-turntable, edifice, vehicle),
 *     and
 *   - `edit_solid` ops (the verbs over an already-minted family solid: skin,
 *     emote).
 *
 * Each card carries the depiction prose, the "reach for" routing phrases, and
 * the parameter manual that used to live in the retired tool's tools/list
 * essay. Cards are indexed into meta_embeddings under
 * source_kind='solid_vocab' (see lib/db/repositories/embeddings.js →
 * reindexAll); the agent discovers a kind via
 * `semantic_search({ kinds: ['solid_vocab'] })` and reads the full card via
 * the `get_solid_vocab` MCP tool before composing `spec`. Cards deliberately
 * do NOT name entry tools in their bodies (the `entry` frontmatter field
 * carries that) — tool names live in tool descriptions, not in curated card
 * prose. See mint-solid-consolidation.plan.md.
 *
 * File format mirrors view-vocab / sketch-vocab / catalysts — JSON frontmatter
 * between two `---` fences, then the markdown body. Validation faults are
 * loader bugs (curated library, not user input) — throw with file + field.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { readBookCards } from '../views/recipe-book/cards.js';
const VOCAB_DIR = moduleDir(import.meta.url, 'lib/graph/solid-vocab');

// `when` is required for the same reason as view-vocab: it's the intent-shaped
// line the embedding leads with, so a goal-phrased query ("a chrome wordmark",
// "a posed female figure", "a spinning crystal") matches before the geometry
// prose does.
const REQUIRED_FIELDS = ['id', 'name', 'family', 'entry', 'summary', 'when'];
const VALID_FAMILIES = new Set(['figure', 'creature', 'object', 'structure', 'vehicle', 'edit']);
const VALID_ENTRIES = new Set(['mint_solid', 'edit_solid']);
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

let cache = null;

function parseCard(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(`solid-vocab card ${filePath}: missing JSON frontmatter fences`);
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`solid-vocab card ${filePath}: frontmatter is not valid JSON — ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (typeof meta[field] !== 'string' || meta[field].trim().length === 0) {
      throw new Error(`solid-vocab card ${filePath}: missing required frontmatter field '${field}'`);
    }
  }
  if (!VALID_FAMILIES.has(meta.family)) {
    throw new Error(
      `solid-vocab card ${filePath}: family '${meta.family}' not in ${[...VALID_FAMILIES].join(', ')}`,
    );
  }
  if (!VALID_ENTRIES.has(meta.entry)) {
    throw new Error(
      `solid-vocab card ${filePath}: entry '${meta.entry}' not in ${[...VALID_ENTRIES].join(', ')}`,
    );
  }
  return { ...meta, ...splitSections(raw.slice(match[0].length).trim(), filePath) };
}

// A long card can mark its deeper steps so a reader opens it at the first one:
//   <!-- section: <name> | <title> | <one-line summary> -->
//   …
//   <!-- /section -->
// `body` is the whole card with the marks removed (what search and the embeddings index, as before). `base` is
// the card with each section replaced in place by one stub line; `sections` holds each one's text. A card with no
// marks gets neither field and reads exactly as it did.
const SECTION_OPEN = /^<!-- section: ([a-z][a-z0-9-]*) \| ([^|]+?) \| ([^|]+?) -->$/;
const SECTION_CLOSE = '<!-- /section -->';

export function splitSections(text, where = 'card') {
  if (!text.includes('<!-- section:')) return { body: text };
  const lines = text.split('\n');
  const bodyLines = [], baseLines = [], sections = {};
  let open = null;
  for (const line of lines) {
    const m = line.match(SECTION_OPEN);
    if (m) {
      if (open) throw new Error(`solid-vocab card ${where}: section '${m[1]}' opens inside '${open.name}'`);
      if (sections[m[1]]) throw new Error(`solid-vocab card ${where}: duplicate section '${m[1]}'`);
      open = { name: m[1], title: m[2].trim(), summary: m[3].trim(), lines: [] };
      baseLines.push({ stub: open });
      continue;
    }
    if (line === SECTION_CLOSE) {
      if (!open) throw new Error(`solid-vocab card ${where}: a section closes that never opened`);
      sections[open.name] = { title: open.title, summary: open.summary, body: open.lines.join('\n').trim() };
      open = null;
      continue;
    }
    bodyLines.push(line);
    if (open) open.lines.push(line);
    else baseLines.push(line);
  }
  if (open) throw new Error(`solid-vocab card ${where}: section '${open.name}' never closes`);
  const kb = (s) => `${(Buffer.byteLength(s, 'utf8') / 1024).toFixed(1)} KB`;
  const base = baseLines
    .map((l) => (typeof l === 'string' ? l : `- **${l.stub.title}** — ${l.stub.summary}. Section \`${l.stub.name}\`, ${kb(sections[l.stub.name].body)}.`))
    .join('\n');
  return { body: bodyLines.join('\n'), base, sections };
}

export function getSolidVocabCatalog() {
  if (cache) return cache;
  const catalog = new Map();
  if (!existsSync(VOCAB_DIR)) {
    cache = catalog;
    return catalog;
  }
  for (const file of readdirSync(VOCAB_DIR)) {
    if (!file.endsWith('.md')) continue;
    const card = parseCard(join(VOCAB_DIR, file));
    if (catalog.has(card.id)) {
      throw new Error(`solid-vocab: duplicate card id '${card.id}' (${file})`);
    }
    catalog.set(card.id, card);
  }
  // Attached recipe-book / cookbook cards routed here by their
  // `entry: 'mint_solid' | 'edit_solid'` frontmatter (recipe-book.plan.md,
  // Phase 4) — merged after core so get_solid_vocab and the embeddings
  // reindex see one catalog. The book is user-editable: warn-and-skip, never
  // throw; on an id collision CORE WINS.
  for (const card of readBookCards({ entries: ['mint_solid', 'edit_solid'] })) {
    if (!VALID_FAMILIES.has(card.family)) {
      console.warn(`solid-vocab: book card '${card.id}' has family '${card.family}' — not a solid family; skipped`);
      continue;
    }
    if (catalog.has(card.id)) {
      console.warn(`solid-vocab: book card '${card.id}' collides with a core card — core wins`);
      continue;
    }
    catalog.set(card.id, card);
  }
  cache = catalog;
  return catalog;
}

// Test seam.
export function _resetSolidVocabCache() {
  cache = null;
}
