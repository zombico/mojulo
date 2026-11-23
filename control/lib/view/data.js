/**
 * THE VIEW'S DATA — what the view reads from the store, shaped the way the work is: games first, then levels, then
 * characters, then everything else. Read only: the view writes nothing to the store.
 *
 *   KINDS                  the kinds a section owns (games, characters); a level is any row whose recipe carries a
 *                          game contract (`game`), whatever its kind
 *   games()                → [{ ref, title, kind, rail, size, levels: [ref], game: ref | null, made }] designed and
 *                          quick games (a gameworld, with the game it made), then games made without one
 *   gameOf(ref)            → { row, levels: [{ key, ref, frame, walk }], characters: [ref], game: row | null } | null
 *   levels()               → [{ ref, title, kind, of: game ref | null }] every row with a game contract
 *   characters()           → rows of the character kinds, with the games that cast them
 *   objects({ limit })     → every other row, newest first
 *   row(ref)               → the stored row, or null
 *   printOf(row)           → a short print of its recipe as stored (a check's record is kept against it)
 */
import { createHash } from 'node:crypto';
import { getDb } from '@/lib/db/index';
import { SketchRepository } from '@/lib/db/repositories/sketches';

export const KINDS = Object.freeze({
  games: Object.freeze(['gameworld', 'game']),
  // (a hero, a foe, a mascot from create_character, and the drawn figures and sheets the library shelves as characters)
  characters: Object.freeze(['layered', 'figure', 'character-sheet', 'sprite-sheet']),
});

export const row = (ref) => (typeof ref === 'string' && ref ? SketchRepository.getByRef(ref) : null);
export const printOf = (r) => createHash('sha256').update(JSON.stringify(r?.manifest ?? null)).digest('hex').slice(0, 8);

// a gameworld's run record: its levels in the order they were made, each with its first frame and its walk
function levelsOfWorld(m) {
  const made = m?.made && typeof m.made === 'object' ? m.made : {};
  return Object.entries(made)
    .filter(([k, v]) => k.startsWith('level-') && v && v.ref)
    .map(([key, v]) => ({ key, ref: v.ref, frame: v.frame ?? null, walk: made[`audit-${key}`] ?? null }));
}
const castOf = (m) => Object.entries(m?.made ?? {}).filter(([k, v]) => v && v.ref && !k.startsWith('level-') && !k.startsWith('audit-') && k !== 'game' && !k.endsWith('-sheet')).map(([, v]) => v.ref);

export function games() {
  const worlds = SketchRepository.listByKinds({ kinds: ['gameworld'], limit: 500 });
  const made = new Set();
  const out = worlds.map((w) => {
    const m = w.manifest || {}, game = m.made?.game?.ref ?? null;
    if (game) made.add(game);
    const lv = levelsOfWorld(m);
    return { ref: w.ref, title: m.name || w.title || w.ref, kind: 'gameworld', rail: m.rail?.from ?? m.intent?.from ?? null, size: m.rail?.size ?? (m.quick ? 'quick' : null), levels: lv.map((l) => l.ref), game, made: lv };
  });
  for (const g of SketchRepository.listByKinds({ kinds: ['game'], limit: 500 })) {
    if (made.has(g.ref)) continue;
    const m = g.manifest || {};
    out.push({ ref: g.ref, title: m.title || g.title || g.ref, kind: 'game', rail: null, size: null, levels: (m.levels ?? []).map((l) => l.ref).filter(Boolean), game: g.ref, made: [] });
  }
  return out;
}

export function gameOf(ref) {
  const r = row(ref);
  if (!r) return null;
  const m = r.manifest || {};
  if (m.kind === 'gameworld') return { row: r, levels: levelsOfWorld(m), characters: castOf(m), game: row(m.made?.game?.ref) };
  if (m.kind === 'game') return { row: r, levels: (m.levels ?? []).filter((l) => l && l.ref).map((l, i) => ({ key: `level-${i}`, ref: l.ref, frame: null, walk: null })), characters: [], game: r };
  return null;
}

export function levels() {
  const rows = getDb().prepare("SELECT ref, title, kind FROM sketches WHERE json_type(manifest_json, '$.game') = 'object' AND kind NOT IN ('game', 'gameworld') ORDER BY id DESC LIMIT 1000").all();
  const of = new Map();
  for (const g of games()) for (const l of g.levels) if (!of.has(l)) of.set(l, g.ref);
  return rows.map((x) => ({ ref: x.ref, title: x.title || x.ref, kind: x.kind, of: of.get(x.ref) ?? null }));
}

export function characters() {
  const castBy = new Map();
  for (const g of games()) {
    const G = gameOf(g.ref);
    for (const c of G?.characters ?? []) castBy.set(c, [...(castBy.get(c) ?? []), g.ref]);
  }
  return SketchRepository.listByKinds({ kinds: [...KINDS.characters], limit: 500 }).map((c) => ({ ...c, games: castBy.get(c.ref) ?? [] }));
}

export function objects({ limit = 200 } = {}) {
  const skip = [...KINDS.games, ...KINDS.characters];
  const rows = getDb().prepare(`SELECT ref, title, kind FROM sketches WHERE kind NOT IN (${skip.map(() => '?').join(', ')}) AND json_type(manifest_json, '$.game') IS NOT 'object' ORDER BY id DESC LIMIT ?`).all(...skip, limit);
  return rows.map((x) => ({ ref: x.ref, title: x.title || x.ref, kind: x.kind }));
}
