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
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VOCAB_DIR = dirname(fileURLToPath(import.meta.url));

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
  return { ...meta, body: raw.slice(match[0].length).trim() };
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
  cache = catalog;
  return catalog;
}

// Test seam.
export function _resetSolidVocabCache() {
  cache = null;
}
