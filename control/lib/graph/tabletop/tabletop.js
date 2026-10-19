/**
 * A game over its board, for Node: the lattice laid from the game's `board` spec and the kernel's game compiled over
 * it. The page carries the same two as data (the lattice record) and code (`buildTabletop.toString()`).
 *
 *   tabletopGame(G) → { L, K, G }   G as tabletop-kernel.js reads it, with board: a lattice spec (polygonizer/lattice.js;
 *                                   a game of cards alone may leave it out);
 *                                   the G returned is the one played, its `deal` done
 *   dealt(G) → G                    the `deal` system done: the cells' types and numbers, and the pieces it sets
 *
 * The deal (seeded setup, a system a game written out may use): { types: { <type>: n }, numbers?: [n], numberless?:
 * [type], apart?: [n], place?: { <neutral kind>: <type> } } shuffles the types onto the board's cells from G.seed,
 * the numbers onto the cells whose type is not numberless, keeping the `apart` numbers off neighbouring cells, and sets
 * each neutral kind on the first cell of its type. A board dealt again from the same seed is the same board.
 */

import { lattice } from '../polygonizer/lattice.js';
import { tabletopCompile } from './tabletop-kernel.js';

function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(list, roll) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(roll() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

export function dealt(G) {
  const D = G?.deal;
  if (!D) return G;
  const L = lattice(G.board), n = L.cells.length;
  const kinds = Object.entries(D.types || {}).flatMap(([t, k]) => Array(k).fill(t));
  if (kinds.length !== n) throw new Error(`tabletop: the deal's types count ${kinds.length}, the board has ${n} cells`);
  const roll = dice(G.seed ?? 1);
  const types = shuffle(kinds, roll);
  const numbered = L.cells.map((_, i) => i).filter((i) => !(D.numberless || []).includes(types[i]));
  const numbers = D.numbers || [];
  if (numbers.length && numbers.length !== numbered.length) throw new Error(`tabletop: the deal has ${numbers.length} numbers for ${numbered.length} numbered cells`);
  const apart = new Set(D.apart || []);
  let at = null;
  for (let tries = 0; tries < 1000 && !at; tries += 1) {
    const deal = shuffle(numbers, roll), here = {};
    numbered.forEach((i, k) => { if (deal[k] !== undefined) here[i] = deal[k]; });
    const hot = Object.keys(here).map(Number).filter((i) => apart.has(here[i]));
    if (hot.some((i) => L.cells[i].n.some((j) => j >= 0 && hot.includes(j)))) continue;
    at = here;
  }
  if (!at) throw new Error('tabletop: no deal kept the apart numbers off neighbouring cells');
  const byName = {}, nums = {};
  L.cells.forEach((c, i) => { byName[c.name] = types[i]; if (at[i] !== undefined) nums[c.name] = at[i]; });
  const neutral = { ...(G.setup?.neutral || {}) };
  for (const [kind, type] of Object.entries(D.place || {})) {
    const i = types.indexOf(type);
    if (i < 0) throw new Error(`tabletop: the deal places a ${kind} on a ${type}, and no cell is one`);
    neutral[kind] = [L.cells[i].name];
  }
  const { deal, ...rest } = G;
  return { ...rest, board: { ...G.board, types: byName }, numbers: { ...(G.numbers || {}), ...nums }, setup: { ...(G.setup || {}), ...(Object.keys(neutral).length ? { neutral } : {}) } };
}

export function tabletopGame(G) {
  if (!G || (!G.board && !G.piles && !G.round)) throw new Error('tabletop: a game needs a board (a lattice spec: { shape, cols, rows } or { shape: \'hex\', radius }), piles of cards or rounds');
  // a game of cards alone keeps a single cell, so the one kernel serves it too
  const P = dealt(G.board ? G : { ...G, board: { shape: 'square', cols: 1, rows: 1 } });
  const L = lattice(P.board);
  return { L, K: tabletopCompile(L, P), G: P };
}
