import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { CHESS, chessFromFen } from './games/chess.js';
import { CHECKERS } from './games/checkers.js';

const T = buildTabletop();
const M = buildTabletopMind(T);
const at = (G) => { const { K } = tabletopGame(G); return { K, S: T.start(K) }; };

describe('tabletop mind: it sees what is there', () => {
  it('mates in one', () => {
    const { K, S } = at(chessFromFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - -'));
    const r = M.think(K, S, { depth: 1 });
    expect(r.move.name).toBe('D1-D8');
    expect(r.score).toBeGreaterThan(M.WIN - 10);
  });

  it('mates in two, three turns deep', () => {
    const { K, S } = at(chessFromFen('7k/8/5K2/8/8/8/8/6R1 w - -'));
    const r = M.think(K, S, { depth: 3 });
    expect(r.score).toBeGreaterThan(M.WIN - 10);
    // whatever black answers, the next move mates
    let s = T.apply(K, S, r.move);
    s = T.apply(K, s, M.think(K, s, { depth: 1 }).move);
    s = T.apply(K, s, M.think(K, s, { depth: 1 }).move);
    expect(T.outcome(K, s)).toEqual({ winner: 0, reason: 'mate' });
  });

  it('takes a queen left hanging, and the search counts past the horizon (quiet captures)', () => {
    const { K, S } = at(chessFromFen('4k3/8/8/3q4/8/8/8/3QK3 w - -'));
    expect(M.think(K, S, { depth: 1 }).move.name).toBe('D1xD5');
    // a pawn guards the queen: a rook takes it anyway (a queen for a rook), and depth 1 sees the recapture
    const guarded = at(chessFromFen('4k3/8/4p3/3q4/8/8/8/3RK3 w - -'));
    const r = M.think(guarded.K, guarded.S, { depth: 1 });
    expect(r.move.name).toBe('D1xD5');
    // the score is the position after the exchange: a rook for a queen, so about four better than now, not nine
    const gain = r.score - M.evaluate(guarded.K, guarded.S, 0);
    expect(gain).toBeGreaterThan(3);
    expect(gain).toBeLessThan(5);
  });
});

describe('tabletop mind: alpha-beta is minimax, made quicker', () => {
  it('the root\'s best score is the plain search\'s', () => {
    const { K, S } = at(chessFromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -'));
    const plain = (s, d) => {
      const moves = T.legal(K, s), end = T.outcome(K, s, moves);
      if (end) return end.winner === null ? 0 : end.winner === s.side ? M.WIN : -M.WIN;
      if (d === 0) return M.evaluate(K, s, s.side);
      return Math.max(...moves.map((m) => -plain(T.apply(K, s, m), d - 1)));
    };
    const r = M.think(K, S, { depth: 2, quiet: 0, nodes: 1e7 });
    expect(r.score).toBeCloseTo(plain(S, 2), 9);
  });
});

describe('tabletop mind: dice and bounds', () => {
  it('the same seed, the same move; slack lets other near moves be chosen', () => {
    const { K, S } = at(CHESS);
    const a = M.think(K, S, { depth: 1, seed: 7, slack: 0.5 }), b = M.think(K, S, { depth: 1, seed: 7, slack: 0.5 });
    expect(a.move.name).toBe(b.move.name);
    const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => M.think(K, S, { depth: 1, seed, slack: 0.5 }).move.name));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('a count of positions bounds the search: it settles on the deepest it finished', () => {
    const { K, S } = at(CHESS);
    const r = M.think(K, S, { depth: 4, nodes: 300 });
    expect(r.depth).toBeLessThan(4);
    expect(T.legal(K, S).some((m) => m.name === r.move.name)).toBe(true);
  });

  it('no move, no thought', () => {
    const { K, S } = at(chessFromFen('7k/5Q2/6K1/8/8/8/8/8 b - -'));
    expect(M.think(K, S)).toBeNull();
  });
});

describe('tabletop mind: whole games', () => {
  it('checkers, mind against mind, ends, and the same seeds play the same game', () => {
    const play = () => {
      const { K, S: s0 } = at({ ...CHECKERS, cap: 120 });
      let s = s0;
      const line = [];
      while (!s.over && !T.outcome(K, s)) {
        const r = M.think(K, s, s.side === 0 ? { depth: 2, seed: 3 } : { depth: 1, seed: 4 });
        line.push(r.move.name);
        s = T.apply(K, s, r.move);
      }
      return { line, end: s.over || T.outcome(K, s) };
    };
    const a = play(), b = play();
    expect(a.end).not.toBeNull();
    expect(a.line).toEqual(b.line);
  });

  it('the mind runs on its own beside the kernel, as a page carries both', () => {
    const lone = new Function(`const T = (${buildTabletop.toString()})(); return (${buildTabletopMind.toString()})(T);`)();
    const { K, S } = at(chessFromFen('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - -'));
    expect(lone.think(K, S, { depth: 1 }).move.name).toBe('D1-D8');
  });
});
