/**
 * View vocabulary loader.
 *
 * One card per visual KIND behind the two consolidated entry tools:
 *   - `create_view` kinds (science / math / bio study objects — the former
 *     43 `create_*_view` tools), and
 *   - `compose_world` bases (family `world` — the former per-type world
 *     creators: city, transport-hub, controllable, action, operator,
 *     planetary, painted-landscape).
 *
 * Each card carries the depiction prose, the "reach for" routing phrases, and
 * the parameter manual that used to live in the retired tool's tools/list
 * essay. Cards are indexed into meta_embeddings under
 * source_kind='view_vocab' (see lib/db/repositories/embeddings.js →
 * reindexAll); the agent discovers a kind via
 * `semantic_search({ kinds: ['view_vocab'] })` and reads the full card via
 * the `get_view_vocab` MCP tool before composing `params` / `overrides`.
 * Cards deliberately do NOT name entry tools in their bodies (the `entry`
 * frontmatter field carries that) — tool names live in tool descriptions,
 * not in curated card prose. See tool-list-drawerization.plan.md.
 *
 * File format mirrors sketch-vocab / catalysts — JSON frontmatter between two
 * `---` fences, then the markdown body. Validation faults are loader bugs
 * (curated library, not user input) — throw with file + field.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleDir } from '../../../module-dir.js';
const VOCAB_DIR = moduleDir(import.meta.url, 'lib/graph/views/view-vocab');

// `when` is required for the same reason as sketch-vocab: it's the
// intent-shaped line the embedding leads with, so a goal-phrased query
// ("show my student nuclear fission") matches before the geometry prose does.
const REQUIRED_FIELDS = ['id', 'name', 'family', 'entry', 'summary', 'when'];
const VALID_FAMILIES = new Set(['science', 'math', 'bio', 'world']);
const VALID_ENTRIES = new Set(['create_view', 'compose_world']);
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

let cache = null;

function parseCard(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(`view-vocab card ${filePath}: missing JSON frontmatter fences`);
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`view-vocab card ${filePath}: frontmatter is not valid JSON — ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (typeof meta[field] !== 'string' || meta[field].trim().length === 0) {
      throw new Error(`view-vocab card ${filePath}: missing required frontmatter field '${field}'`);
    }
  }
  if (!VALID_FAMILIES.has(meta.family)) {
    throw new Error(
      `view-vocab card ${filePath}: family '${meta.family}' not in ${[...VALID_FAMILIES].join(', ')}`,
    );
  }
  if (!VALID_ENTRIES.has(meta.entry)) {
    throw new Error(
      `view-vocab card ${filePath}: entry '${meta.entry}' not in ${[...VALID_ENTRIES].join(', ')}`,
    );
  }
  return { ...meta, body: raw.slice(match[0].length).trim() };
}

export function getViewVocabCatalog() {
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
      throw new Error(`view-vocab: duplicate card id '${card.id}' (${file})`);
    }
    catalog.set(card.id, card);
  }
  cache = catalog;
  return catalog;
}

// Test seam.
export function _resetViewVocabCache() {
  cache = null;
}
