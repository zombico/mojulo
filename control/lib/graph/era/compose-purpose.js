/**
 * WHAT A PLACE IS FOR (the scene composer's first question, architect mode): a GAME is read at a glance, a SHOW is
 * looked at. The purpose picks the renderer rail a place is built on, so the same house is a level that never goes
 * into face overdrive or a showing at its every piece's best:
 *
 *   game  readability: each piece at a coarser grain (scene/readable-rung.js), nothing set on a table, the pieces of a
 *         room laid in their rank within an allowance of faces, the spend reported
 *   show  fidelity: each piece as its maker drew it, every table set
 *
 * A rail lays a place within its allowance; it never cuts one afterwards. What a room is for (its first rank: the
 * bed, the sofa, the kitchen run) always stands; the rest are laid in rank while the allowance holds. The allowance
 * advises: a room over it is said, what it left out is said (`spend`), and a recipe may raise it for a room. The purpose is the recipe's (`purpose: 'game' | 'show'`),
 * stamped at the mint (`purposeAtMint`: a level is a game, a house a show); a recipe without one is built as it was.
 *
 *   PURPOSES, PURPOSE_IDS
 *   readPurpose(v)                          → 'game' | 'show' | null (absent), throws on any other
 *   purposeAtMint(manifest)                 → the purpose a new recipe is stamped with
 *   railOf(purpose)                         → the purpose's rail, or null (absent: as it was)
 *   allowanceOf(manifest)                   → a room's allowance: the recipe's own (`allowance: { room }`), else its rail's
 *   PIECE_RANK, rankOf(role)                → the order a room's pieces are laid in under an allowance
 *   layWithin(pieces, { allowance, costOf, rankOf }) → { kept, dropped, spent, over }
 */

export const PURPOSES = Object.freeze({
  game: Object.freeze({
    reads: 'readability: a level read at a glance; each piece at a coarser grain, nothing set on a table, a room laid within its allowance',
    // (the grain in metres: 0.075 holds a chair's legs and a counter's slab; coarser, the thin slabs tear)
    grain: 0.075,
    tabletop: false,
    // (faces of furniture a room may spend, at the grain: a furnished lounge costs about 6000, a bedroom under 1000;
    // a guard against a crowded room's overdrive, not a diet for a furnished one)
    allowance: Object.freeze({ room: 6000 }),
  }),
  show: Object.freeze({
    reads: 'fidelity: a place looked at, on a tour; each piece as its maker drew it, every table set',
    grain: null,
    tabletop: true,
    allowance: null,
  }),
});
export const PURPOSE_IDS = Object.freeze(Object.keys(PURPOSES));

export function readPurpose(v) {
  if (v === undefined || v === null) return null;
  if (!PURPOSE_IDS.includes(v)) throw new Error(`purpose: one of ${PURPOSE_IDS.join(', ')} (what the place is for: a game read at a glance, a show looked at)`);
  return v;
}

/** A new recipe's purpose: its own, else a level's is a game's, else a show's. */
export function purposeAtMint(m = {}) {
  const own = readPurpose(m.purpose);
  if (own) return own;
  return m.level !== undefined && m.level !== null && m.level !== false ? 'game' : 'show';
}

/** The rail a purpose builds on; absent, null (the place built as it was before purposes). */
export const railOf = (purpose) => (readPurpose(purpose) ? PURPOSES[purpose] : null);

/** A room's allowance in faces: the recipe's own `allowance: { room }` (raised for a hero room, or tightened), else
 *  its rail's; null where the rail has none. */
export function allowanceOf(m = {}) {
  const rail = railOf(m.purpose);
  if (m.allowance !== undefined && m.allowance !== null) {
    const r = m.allowance && m.allowance.room;
    if (!(Number.isInteger(r) && r > 0)) throw new Error('allowance: { room: <faces> }, a whole number of faces a room\'s furniture may spend on the game\'s rail');
    if (!rail || !rail.allowance) throw new Error("allowance: a game's (purpose: 'game'); a show spends what its pieces cost");
    return r;
  }
  return rail && rail.allowance ? rail.allowance.room : null;
}

// the order a room's pieces are laid in when its allowance is short: what the room is for first, then where one sits,
// what one keeps things in, what one looks at, what one sets down (furnishings/roster.js ROLES)
export const PIECE_RANK = Object.freeze({
  bed: 0, sofa: 0, 'dining-table': 0, desk: 0, counter: 0, 'kitchen-unit': 0, fixture: 0,
  'easy-chair': 1, 'dining-chair': 1, 'desk-chair': 1, stool: 1, bench: 1, 'coffee-table': 1, media: 1, screen: 1,
  nightstand: 2, dresser: 2, bookcase: 2, shelving: 2, cabinet: 2, sideboard: 2,
  rug: 3, lamp: 3, 'wall-art': 3, 'wall-light': 3,
  tabletop: 4,
});
const UNRANKED = 3;
export const rankOf = (role) => PIECE_RANK[role] ?? UNRANKED;

/**
 * A room's pieces laid in rank (the given order within a rank). The first rank, what the room is for, always stands;
 * then each while the allowance holds: a piece that would cross it is left out and the next is tried, so a cheap lamp
 * still stands where a costly chair could not. `over` when the first rank alone crosses it.
 * → { kept: pieces (in the given order), dropped: [{ piece, cost }], spent, over }
 */
export function layWithin(pieces, { allowance, costOf, rankOf: rank = () => 0 }) {
  const order = pieces.map((p, i) => ({ p, i, r: rank(p) })).sort((a, b) => a.r - b.r || a.i - b.i);
  const keep = new Set(), dropped = [];
  let spent = 0;
  for (const { p, i, r } of order) {
    const cost = costOf(p);
    if (allowance == null || r === 0 || spent + cost <= allowance) { keep.add(i); spent += cost; } else dropped.push({ piece: p, cost });
  }
  return { kept: pieces.filter((_, i) => keep.has(i)), dropped, spent, over: allowance != null && spent > allowance };
}
