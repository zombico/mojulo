import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { tileGame } from './fixtures/tiles.js';
import { sandwichGame, connectionGame } from './fixtures/placement.js';
import { responseDuel } from './fixtures/duel.js';
import { CHESS } from './games/chess.js';

const T = buildTabletop();
const M = buildTabletopMind(T);
const at = (G) => { const { K } = tabletopGame(G); return { K, S: T.start(K) }; };
// a search's work is its playouts: asked for 37, a searched move reports 37 positions weighed
const searched = (K, S, o) => M.think(K, S, { ...o, seed: 1, mcts: { playouts: 37 } }).nodes === 37;

describe('the third mind: where it plays', () => {
  it('hard searches the tile game and a game whose drops flip lines, and plans everywhere else', () => {
    const tiles = at(tileGame()), flip = at(sandwichGame({ size: 6 }));
    expect(searched(tiles.K, tiles.S, M.LEVELS.hard)).toBe(true);
    expect(searched(flip.K, flip.S, M.LEVELS.hard)).toBe(true);
    for (const G of [responseDuel(), connectionGame({ size: 5 }), CHESS]) {
      const { K, S } = at(G);
      expect(searched(K, S, M.LEVELS.hard)).toBe(false);
    }
  });

  it('easier levels keep the planners; a game may ask for search, or refuse it', () => {
    const tiles = at(tileGame());
    expect(searched(tiles.K, tiles.S, M.LEVELS.fair)).toBe(false);
    const refused = tileGame();
    refused.mind = { search: 'plan' };
    const r = at(refused);
    expect(searched(r.K, r.S, M.LEVELS.hard)).toBe(false);
    const asked = responseDuel();
    asked.mind = { search: 'mcts', playouts: 25 };
    const a = at(asked);
    // turns pass until there is a choice to search (with one move left, there is nothing to weigh)
    let s = a.S;
    while (T.legal(a.K, s).length < 2) s = T.apply(a.K, s, T.legal(a.K, s)[0]);
    expect(M.think(a.K, s, { ...M.LEVELS.hard, seed: 1 }).nodes).toBe(25);
  });
});

describe('the third mind: how it plays', () => {
  it('bounded by its playouts, seeded: the same position and seed the same move', () => {
    const { K, S } = at(tileGame({ seed: 3 }));
    const o = { ...M.LEVELS.hard, seed: 5, mcts: { playouts: 60 } };
    const a = M.think(K, S, o);
    expect(a.nodes).toBe(60);
    expect(M.think(K, S, o)).toEqual(a);
  });

  it('a move legal only in some deals of the hidden bag is weighed as even, not lost', () => {
    // each playout deals the bag again, so the tile in hand differs: priors taken in one deal miss moves of another
    const { K, S } = at(tileGame({ seed: 2 }));
    let s = S;
    for (let i = 0; i < 6 && !s.over; i++) s = T.apply(K, s, M.think(K, s, { ...M.LEVELS.hard, seed: i, mcts: { playouts: 40 } }).move);
    expect(s.turn).toBeGreaterThan(0);
  });

  it('where the planner cannot read the game, search beats it: a sandwich game to its end', () => {
    const { K, S } = at(sandwichGame({ size: 4 }));
    let s = S, n = 0;
    while (!s.over && n < 200) {
      const o = s.side === 0 ? { ...M.LEVELS.hard, seed: n, mcts: { playouts: 200 } } : { depth: 2, seed: n };
      s = T.apply(K, s, M.think(K, s, o).move);
      if (!s.over) { const end = T.outcome(K, s); if (end) s = { ...s, over: end }; }
      n += 1;
    }
    expect(s.over.winner).toBe(0);
  });
});
