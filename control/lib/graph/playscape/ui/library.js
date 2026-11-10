/**
 * THE LIBRARY — what a level gives the player to read: publications (publication/publication.js: a grimoire, a
 * bestiary, a manual, a notebook) kept on a shelf, each held from the start or found when a flag is set (scenes.js
 * flags: a scene's `sets`, an answer's, or a cue's `emit: 'flag:<name>'`). The page keeps the shelf (L opens it) and
 * opens a book as the reader (publication/reader.js): the same pages that print, turned a spread at a time.
 *
 *   play.library: [{ id, book, found? }]
 *     book    a publication recipe ({ kind, title, chapters: [{ title?, blocks }] })
 *     found   the flag that puts it on the shelf (else it is there from the start)
 *
 *   readLibrary(play)      → the entries as written, checked (throws naming what it takes)
 *   libraryFlags(play)     → the flags the shelf reads
 *   libraryProgram(play)   → [{ id, title, kind, found?, page }] what the page carries: `page` the reader's html
 *   libraryView(program, vars) → the books held now [{ id, title, kind }]     (ships in the page: self-contained)
 *   libraryNews(program, flags) → [{ title }] the books these flags just put on the shelf (the same)
 *
 * A book's pages are drawn when the level is read, so a shelf's plates are kept few and its books short; the reader's
 * plates are drawn at a coarser grain than the press's (LIBRARY_RES).
 */
import { readPublication, compilePublication, PUBLICATION_KIND_IDS } from '../../publication/publication.js';
import { readerHtml } from '../../publication/reader.js';

const err = (m) => new Error(`play.library${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const ID = /^[a-z][a-z0-9-]{0,39}$/, FLAG = /^[a-z][a-z0-9-]{0,39}$/;

export const LIBRARY_KEYS = Object.freeze({ id: 'a lowercase id', book: `a publication: { kind (${PUBLICATION_KIND_IDS.join(', ')}), title, chapters: [{ title?, blocks }] }`, found: 'the flag that puts it on the shelf (else it is there from the start)' });
/** The most books a level's shelf holds, and the grain its plates are drawn at. */
export const LIBRARY_MAX = 8, LIBRARY_RES = 1.5;

export function readLibrary(play) {
  const L = play && play.library;
  if (L === undefined) return [];
  if (!Array.isArray(L) || L.length > LIBRARY_MAX) throw err(` is a list of up to ${LIBRARY_MAX} { id, book, found? }`);
  const seen = new Set();
  return L.map((e, i) => {
    const at = `[${i}]`;
    if (!isObj(e)) throw err(`${at} is { id, book, found? }`);
    for (const k of Object.keys(e)) if (!LIBRARY_KEYS[k]) throw err(`${at}.${k} is not part of a shelf's book (${Object.keys(LIBRARY_KEYS).join(', ')})`);
    if (typeof e.id !== 'string' || !ID.test(e.id)) throw err(`${at}.id is a lowercase id ("ember-grimoire")`);
    if (seen.has(e.id)) throw err(`${at}.id '${e.id}' appears twice`);
    seen.add(e.id);
    if (e.found !== undefined && !FLAG.test(e.found ?? '')) throw err(`${at}.found is the flag that puts it on the shelf (a lowercase name: found-grimoire)`);
    try { readPublication(e.book); } catch (x) { throw err(`${at}.book: ${x.message.replace(/^publication: /, '')}`); }
    return { id: e.id, book: e.book, ...(e.found ? { found: e.found } : {}) };
  });
}

export function libraryFlags(play) {
  return [...new Set(readLibrary(play).map((e) => e.found).filter(Boolean))].sort();
}

export function libraryProgram(play) {
  return readLibrary(play).map((e) => ({
    id: e.id, title: e.book.title, kind: e.book.kind, ...(e.found ? { found: e.found } : {}),
    page: readerHtml(compilePublication(e.book, { res: LIBRARY_RES })),
  }));
}

// self-contained (the page ships their source): the flags are the bus vars flag-<name>
export function libraryView(program, vars) {
  const out = [];
  for (const b of program || []) if (!b.found || (vars && vars['flag-' + b.found])) out.push({ id: b.id, title: b.title, kind: b.kind });
  return out;
}
export function libraryNews(program, flags) {
  const out = [];
  for (const f of flags || []) for (const b of program || []) if (b.found === f) out.push({ title: b.title });
  return out;
}
