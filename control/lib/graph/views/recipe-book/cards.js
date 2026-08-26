/**
 * recipe-book cards — the fs-only SYNC half of the book attachment
 * (recipe-book.plan.md, Doors 1 + the Phase-5 cookbook). Reads card.md entries
 * from the attached BOOKS for the view-vocab catalog merge and the embeddings
 * reindex. Kept separate from ./loader.js (the Door-2 builder importer) so the
 * view-vocab loader can import THIS without pulling the world-kinds →
 * science-views module chain.
 *
 * MULTI-BOOK (Phase 5): attachment is an ORDERED list of book directories —
 *
 *     core view-vocab  >  the COOKBOOK  >  the upstream clone
 *
 * The cookbook is the operator's own book (save_recipe writes it), living
 * beside the instance's data (`$MOJULO_COOKBOOK` or `<data dir>/cookbook`) so
 * the index that chases it is always its neighbour. The upstream book is the
 * operator-cloned catalog (`$MOJULO_RECIPE_BOOK`). Precedence is FIRST-WINS by
 * card id across books (and core beats both at the view-vocab merge), so
 * "forking" an upstream entry = saving under your own id — no merge machinery.
 *
 * `parse` is INJECTED (view-vocab's own parseCard) so the card format has
 * exactly one parser and the dependency stays one-directional
 * (view-vocab → recipe-book, never back). Tolerant per file: a malformed card
 * in a user-editable book is warned and skipped, never thrown.
 */

import { existsSync, readFileSync } from 'node:fs';
import path, { join } from 'node:path';

export function bookDir(override) {
  const dir = override ?? process.env.MOJULO_RECIPE_BOOK;
  return typeof dir === 'string' && dir.trim().length ? dir.trim() : null;
}

// The cookbook sits beside the SQLite DB this instance runs on (repo-dev:
// control/data/cookbook; CLI installs: ~/.mojulo/data/cookbook), overridable
// via MOJULO_COOKBOOK. Mirrors lib/db/index.js's SQLITE_PATH resolution.
export function cookbookDir(override) {
  const dir = override ?? process.env.MOJULO_COOKBOOK;
  if (typeof dir === 'string' && dir.trim().length) return dir.trim();
  const dataDir = process.env.SQLITE_PATH
    ? path.dirname(process.env.SQLITE_PATH)
    : join(process.cwd(), 'data');
  return join(dataDir, 'cookbook');
}

export function controlVersion() {
  try {
    // cwd is the control package root in every runtime (next dev/start,
    // mcp-stdio chdir's there, scripts run from control/).
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    return pkg.version || '0.0.0';
  } catch { return '0.0.0'; }
}

/**
 * The ordered attachment list: [{ dir, source }] — cookbook first (it beats
 * the upstream clone on id collisions), each present only if its
 * manifest.json exists. Overrides are test seams.
 */
export function bookDirs({ cookbook, upstream } = {}) {
  const dirs = [];
  const cb = cookbookDir(cookbook);
  if (cb && existsSync(join(cb, 'manifest.json'))) dirs.push({ dir: cb, source: 'cookbook' });
  const up = bookDir(upstream);
  if (up && existsSync(join(up, 'manifest.json'))) dirs.push({ dir: up, source: 'recipe-book' });
  return dirs;
}

export function readBookManifest(dir) {
  if (!dir || !existsSync(join(dir, 'manifest.json'))) return null;
  try {
    return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  } catch (err) {
    console.warn(`recipe-book: unreadable manifest.json in ${dir} — ${err.message}`);
    return null;
  }
}

// Cached per process (restart to re-read the clone). The cookbook is the one
// book whose writes should be seen live — save_recipe resets this cache (and
// the view-vocab cache) after each save.
let _cardsCache = null;
export function readBookCards({ parse, dirs } = {}) {
  if (_cardsCache) return _cardsCache;
  if (typeof parse !== 'function') return [];
  const cards = [];
  const seen = new Set();
  for (const { dir, source } of dirs ?? bookDirs()) {
    const manifest = readBookManifest(dir);
    if (!manifest) continue;
    for (const entry of Array.isArray(manifest.entries) ? manifest.entries : []) {
      const cardPath = join(dir, 'chapters', String(entry.chapter || ''), String(entry.dir || ''), 'card.md');
      if (!existsSync(cardPath)) continue;
      try {
        const card = parse(cardPath);
        if (seen.has(card.id)) {
          console.warn(`recipe-book: card '${card.id}' in ${source} shadowed by a higher-precedence book — skipped`);
          continue;
        }
        seen.add(card.id);
        cards.push({ ...card, source, chapter: entry.chapter, entryType: entry.type });
      } catch (err) {
        console.warn(`recipe-book: skipping card ${cardPath} — ${err.message}`);
      }
    }
  }
  _cardsCache = cards;
  return cards;
}

// Test seam (also used by save_recipe to make a fresh save visible).
export function _resetBookCards() { _cardsCache = null; }
