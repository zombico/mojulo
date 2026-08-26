/**
 * recipe-book cards — the fs-only SYNC half of the book attachment
 * (recipe-book.plan.md, Door 1). Reads the attached clone's card.md entries
 * for the view-vocab catalog merge and the embeddings reindex. Kept separate
 * from ./loader.js (the Door-2 builder importer) so the view-vocab loader can
 * import THIS without pulling the world-kinds → science-views module chain.
 *
 * `parse` is INJECTED (view-vocab's own parseCard) so the card format has
 * exactly one parser and the dependency stays one-directional
 * (view-vocab → recipe-book, never back). Tolerant per file: a malformed card
 * in the user-editable clone is warned and skipped, never thrown.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function bookDir(override) {
  const dir = override ?? process.env.MOJULO_RECIPE_BOOK;
  return typeof dir === 'string' && dir.trim().length ? dir.trim() : null;
}

export function readBookManifest(dirOverride) {
  const dir = bookDir(dirOverride);
  if (!dir || !existsSync(join(dir, 'manifest.json'))) return null;
  try {
    return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  } catch (err) {
    console.warn(`recipe-book: unreadable manifest.json — ${err.message}`);
    return null;
  }
}

// Cached per process (restart to re-read the clone — same discipline as the
// view-vocab catalog cache it merges into). Returns [] absent a book.
let _cardsCache = null;
export function readBookCards({ parse, dir: dirOverride } = {}) {
  if (_cardsCache) return _cardsCache;
  if (typeof parse !== 'function') return [];
  const dir = bookDir(dirOverride);
  const manifest = readBookManifest(dir);
  if (!dir || !manifest) return [];
  const cards = [];
  for (const entry of Array.isArray(manifest.entries) ? manifest.entries : []) {
    const cardPath = join(dir, 'chapters', String(entry.chapter || ''), String(entry.dir || ''), 'card.md');
    if (!existsSync(cardPath)) continue;
    try {
      const card = parse(cardPath);
      cards.push({ ...card, source: 'recipe-book', chapter: entry.chapter, entryType: entry.type });
    } catch (err) {
      console.warn(`recipe-book: skipping card ${cardPath} — ${err.message}`);
    }
  }
  _cardsCache = cards;
  return cards;
}

// Test seam.
export function _resetBookCards() { _cardsCache = null; }
