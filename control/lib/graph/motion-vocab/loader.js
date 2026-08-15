/**
 * Motion vocabulary loader.
 *
 * One card per motion SUBJECT FAMILY behind `forge_motion` / `stitch_motion`:
 * camera / deck / effect / world / stitch. `forge_motion` is one tool over
 * four subject families (a manji-tree camera move, a chart deck slideshow, a
 * carved-solid effect, a traversable world) whose full parameter manual used
 * to ride its ~13k-char tools/list description. That manual now lives in these
 * cards, indexed under source_kind='motion_vocab' — semantic_search to find,
 * `get_motion_vocab` to read — so the tool description stays a lean routing
 * hook. See mint-solid-consolidation.plan.md (Tier 1) for the pattern.
 *
 * File format mirrors view-vocab / solid-vocab: JSON frontmatter between two
 * `---` fences, then the markdown body. Validation faults are loader bugs
 * (curated library, not user input) — throw with file + field.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VOCAB_DIR = dirname(fileURLToPath(import.meta.url));

const REQUIRED_FIELDS = ['id', 'name', 'family', 'entry', 'summary', 'when'];
const VALID_FAMILIES = new Set(['motion']);
const VALID_ENTRIES = new Set(['forge_motion', 'stitch_motion']);
const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

let cache = null;

function parseCard(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) {
    throw new Error(`motion-vocab card ${filePath}: missing JSON frontmatter fences`);
  }
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`motion-vocab card ${filePath}: frontmatter is not valid JSON — ${err.message}`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (typeof meta[field] !== 'string' || meta[field].trim().length === 0) {
      throw new Error(`motion-vocab card ${filePath}: missing required frontmatter field '${field}'`);
    }
  }
  if (!VALID_FAMILIES.has(meta.family)) {
    throw new Error(
      `motion-vocab card ${filePath}: family '${meta.family}' not in ${[...VALID_FAMILIES].join(', ')}`,
    );
  }
  if (!VALID_ENTRIES.has(meta.entry)) {
    throw new Error(
      `motion-vocab card ${filePath}: entry '${meta.entry}' not in ${[...VALID_ENTRIES].join(', ')}`,
    );
  }
  return { ...meta, body: raw.slice(match[0].length).trim() };
}

export function getMotionVocabCatalog() {
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
      throw new Error(`motion-vocab: duplicate card id '${card.id}' (${file})`);
    }
    catalog.set(card.id, card);
  }
  cache = catalog;
  return catalog;
}

// Test seam.
export function _resetMotionVocabCache() {
  cache = null;
}
