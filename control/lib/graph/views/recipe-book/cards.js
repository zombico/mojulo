/**
 * recipe-book cards — the fs-only SYNC half of the book attachment
 * (recipe-book.plan.md, Doors 1 + the Phase-5 cookbook). Reads card.md entries
 * from the attached BOOKS for the per-family vocab catalog merges and the
 * embeddings reindex. Kept separate from ./loader.js (the Door-2 builder
 * importer) so the vocab loaders can import THIS without pulling the
 * world-kinds → science-views module chain.
 *
 * MULTI-BOOK (Phase 5): attachment is an ORDERED list of book directories —
 *
 *     core vocab cards  >  the COOKBOOK  >  the upstream clone
 *
 * The cookbook is the operator's own book (save_recipe writes it), living
 * beside the instance's data (`$MOJULO_COOKBOOK` or `<data dir>/cookbook`) so
 * the index that chases it is always its neighbour. The upstream book is the
 * operator-cloned catalog (`$MOJULO_RECIPE_BOOK`). Precedence is FIRST-WINS by
 * card id across books (and core beats both at each vocab merge), so
 * "forking" an upstream entry = saving under your own id — no merge machinery.
 *
 * MULTI-FAMILY (Phase 4): a card's `entry` frontmatter is its ROUTING KEY —
 * `create_view` cards merge into the view-vocab catalog, `create_beats` into
 * beats-vocab, and so on per CARD_CATALOGS. THIS module owns the one parser
 * for BOOK cards (all families, shared base fields only); each family's vocab
 * loader pulls its slice via `readBookCards({ entries })` and applies its own
 * family rules at merge time. Core vocab cards keep their own strict per-family
 * parsers — a curated library throws loudly, a user-editable book is tolerant:
 * a malformed or unroutable card is warned and skipped, never thrown.
 */

import { existsSync, readFileSync } from 'node:fs';
import path, { join } from 'node:path';

// entry tool → target vocab catalog. Cards whose `entry` has no row here are
// skipped with a warning — a book written for a newer mojulo (families this
// install lacks) degrades gracefully. Dedupe across books is scoped PER
// catalog, so a view card and a beats card may share an id without shadowing.
export const CARD_CATALOGS = {
  create_view: 'view',
  compose_world: 'view',
  create_beats: 'beats',
  mint_solid: 'solid',
  edit_solid: 'solid',
  forge_motion: 'motion',
  stitch_motion: 'motion',
};

const FRONTMATTER_FENCE = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

// The one parser for BOOK cards, every family. Validates only the shared base
// fields; `family` is deliberately NOT required here (beats cards don't carry
// one) — each vocab loader enforces its own family rules at merge time.
export function parseBookCard(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(FRONTMATTER_FENCE);
  if (!match) throw new Error('missing JSON frontmatter fences');
  let meta;
  try {
    meta = JSON.parse(match[1]);
  } catch (err) {
    throw new Error(`frontmatter is not valid JSON — ${err.message}`);
  }
  for (const field of ['id', 'name', 'entry', 'summary', 'when']) {
    if (typeof meta[field] !== 'string' || meta[field].trim().length === 0) {
      throw new Error(`missing required frontmatter field '${field}'`);
    }
  }
  return { ...meta, body: raw.slice(match[0].length).trim() };
}

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
// the vocab caches) after each save. The cache holds ALL parsed cards across
// books; `entries` filters the returned slice (omit it for everything — the
// registry snapshot's use).
let _cardsCache = null;
export function readBookCards({ entries, dirs } = {}) {
  if (!_cardsCache) {
    const cards = [];
    const seen = new Set();   // `${catalog}:${id}` — first book wins, per catalog
    for (const { dir, source } of dirs ?? bookDirs()) {
      const manifest = readBookManifest(dir);
      if (!manifest) continue;
      for (const entry of Array.isArray(manifest.entries) ? manifest.entries : []) {
        const cardPath = join(dir, 'chapters', String(entry.chapter || ''), String(entry.dir || ''), 'card.md');
        if (!existsSync(cardPath)) continue;
        try {
          const card = parseBookCard(cardPath);
          const catalog = CARD_CATALOGS[card.entry];
          if (!catalog) {
            console.warn(`recipe-book: card '${card.id}' routes to entry tool '${card.entry}' — no catalog for it in this mojulo; skipped`);
            continue;
          }
          const key = `${catalog}:${card.id}`;
          if (seen.has(key)) {
            console.warn(`recipe-book: card '${card.id}' in ${source} shadowed by a higher-precedence book — skipped`);
            continue;
          }
          seen.add(key);
          cards.push({ ...card, source, chapter: entry.chapter, entryType: entry.type });
        } catch (err) {
          console.warn(`recipe-book: skipping card ${cardPath} — ${err.message}`);
        }
      }
    }
    _cardsCache = cards;
  }
  if (!entries) return _cardsCache;
  const want = new Set(entries);
  return _cardsCache.filter((c) => want.has(c.entry));
}

// Test seam (also used by save_recipe to make a fresh save visible).
export function _resetBookCards() { _cardsCache = null; }
