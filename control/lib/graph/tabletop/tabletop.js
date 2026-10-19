/**
 * A game over its board, for Node: the lattice laid from the game's `board` spec and the kernel's game compiled over
 * it. The page carries the same two as data (the lattice record) and code (`buildTabletop.toString()`).
 *
 *   tabletopGame(G) → { L, K }   G as tabletop-kernel.js reads it, with board: a lattice spec (polygonizer/lattice.js)
 */

import { lattice } from '../polygonizer/lattice.js';
import { tabletopCompile } from './tabletop-kernel.js';

export function tabletopGame(G) {
  if (!G || !G.board) throw new Error('tabletop: a game needs a board (a lattice spec: { shape, cols, rows } or { shape: \'hex\', radius })');
  const L = lattice(G.board);
  return { L, K: tabletopCompile(L, G) };
}
