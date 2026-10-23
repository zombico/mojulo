import { describe, it, expect } from 'vitest';
import { buildTabletop } from './tabletop-kernel.js';
import { buildTabletopMind } from './tabletop-mind.js';
import { tabletopGame } from './tabletop.js';
import { enclosureGame, lineGame, connectionGame, sandwichGame, majorityGame } from './fixtures/placement.js';

const T = buildTabletop();
const M = buildTabletopMind(T);
const at = (G) => { const { K } = tabletopGame(G); return { K, S: T.start(K) }; };
const names = (K, S) => T.legal(K, S).map((m) => m.name);
// moves by name, in turn; 'pass' keeps a crafted position's turns honest
const play = (K, S, list) => list.reduce((s, n) => {
  const m = T.legal(K, s).find((x) => x.name === n);
  if (!m) throw new Error(`no move ${n} among ${names(K, s).slice(0, 12).join(' ')}…`);
  return T.apply(K, s, m);
}, S);
const cellOf = (K, n) => K.T.byName.get(n);

describe('placement: drops from stock', () => {
  it('a drop goes on any empty cell; a limited stock runs out and only a pass is left', () => {
    const { K, S } = at(majorityGame());
    expect(names(K, S)).toHaveLength(36);
    expect(names(K, S)[0]).toBe('meeple@A1');
    let s = S;
    for (let i = 0; i < 16; i += 1) s = T.apply(K, s, T.legal(K, s)[0]);
    expect(s.stock.map((x) => x.meeple)).toEqual([0, 0]);
    expect(names(K, s)).toEqual(['pass']);
  });

  it('a falling drop lands on the lowest empty cell of its column', () => {
    const { K, S } = at(lineGame());
    expect(names(K, S)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((f) => `disc@${f}1`));
    const s = play(K, S, ['disc@C1']);
    expect(names(K, s)).toContain('disc@C2');
    expect(names(K, s)).not.toContain('disc@C1');
  });
});

describe('placement: enclosure', () => {
  const G = enclosureGame({ size: 5 });

  it('a stone with no empty neighbour is taken; a group of two goes together', () => {
    const { K, S } = at(G);
    // light at B2, surrounded on three sides, the fourth closes it
    let s = play(K, S, ['stone@B1', 'stone@B2', 'stone@A2', 'pass', 'stone@C2', 'pass']);
    const take = T.legal(K, s).find((m) => m.name === 'stone@B3');
    expect(take.cap).toHaveLength(1);
    s = T.apply(K, s, take);
    expect(s.board[cellOf(K, 'B2')]).toBe(-1);
    // two light stones in a corner, enclosed together
    const g = play(K, S, ['stone@C1', 'stone@A1', 'stone@A3', 'stone@B1', 'stone@B2', 'pass']);
    expect(T.legal(K, g).find((m) => m.name === 'stone@A2').cap).toHaveLength(2);
  });

  it('no drop leaves its own group without an empty neighbour, unless it takes', () => {
    const { K, S } = at(G);
    const s = play(K, S, ['stone@B1', 'pass', 'stone@A2', 'pass']);
    // light into A1 would have no empty neighbour and takes nothing
    const turned = play(K, s, ['pass']);
    expect(names(K, turned)).not.toContain('stone@A1');
  });

  it('ko: the board may not go back to how it stood before the other player\'s move', () => {
    const { K, S } = at(G);
    // dark A2 B1 B3 round B2, light C1 C3 D2 round C2, light in B2: dark takes it at C2, and light may not retake at once
    let s = play(K, S, ['stone@A2', 'stone@C1', 'stone@B1', 'stone@C3', 'stone@B3', 'stone@D2', 'pass', 'stone@B2']);
    const take = T.legal(K, s).find((m) => m.name === 'stone@C2');
    expect(take.cap).toHaveLength(1);
    s = T.apply(K, s, take);
    expect(names(K, s)).not.toContain('stone@B2');
    // after a move elsewhere and an answer, the retake is open again
    s = play(K, s, ['stone@E5', 'stone@E4']);
    expect(names(K, s)).toContain('stone@B2');
  });

  it('two passes end it: stones and the empty cells only one side borders, and the half point', () => {
    const { K, S } = at(enclosureGame({ size: 3 }));
    // dark holds the left column, light the right: the middle column borders both
    const s = play(K, S, ['stone@A1', 'stone@C1', 'stone@A2', 'stone@C2', 'stone@A3', 'stone@C3', 'pass', 'pass']);
    expect(s.over).toEqual({ winner: 1, reason: 'score', scores: [3, 3.5] });
  });
});

describe('placement: lines and connection', () => {
  it('k in a row wins along any axis; a full board without one draws', () => {
    for (const line of [
      ['disc@A1', 'disc@A2', 'disc@B1', 'disc@B2', 'disc@C1', 'disc@C2', 'disc@D1'],
      ['disc@A1', 'disc@B1', 'disc@A2', 'disc@B2', 'disc@A3', 'disc@B3', 'disc@A4'],
      ['disc@A1', 'disc@B1', 'disc@B2', 'disc@C1', 'disc@C2', 'disc@D1', 'disc@C3', 'disc@D2', 'disc@D3', 'disc@G1', 'disc@D4'],
    ]) {
      const { K, S } = at(lineGame());
      const s = play(K, S, line);
      expect(s.over).toEqual({ winner: 0, reason: 'line' });
    }
    const { K, S } = at(lineGame({ cols: 3, rows: 3, k: 4 }));
    let s = S;
    while (!s.over) s = T.apply(K, s, T.legal(K, s)[0]);
    expect(s.over).toMatchObject({ winner: null, reason: 'score' });
  });

  it('connection: a group joining its own two sides wins, and a full board always has exactly one such group', () => {
    const { K, S } = at(connectionGame({ size: 4 }));
    // the first player's line up one edge of the rhombus (its least axial q), the second's down the other
    const qs = K.L.cells.map((c) => c.v[0]), lo = Math.min(...qs), hi = Math.max(...qs);
    const byRow = (q) => K.L.cells.map((c, i) => i).filter((i) => K.L.cells[i].v[0] === q).sort((a, b) => K.rows[0].of[a] - K.rows[0].of[b]);
    const mine = byRow(lo), theirs = byRow(hi);
    const dropAt = (s, c) => T.apply(K, s, T.legal(K, s).find((m) => m.to === c));
    let s = S;
    for (let i = 0; i < mine.length - 1; i += 1) s = dropAt(dropAt(s, mine[i]), theirs[i]);
    expect(T.connectDistance(K, s, 0)).toBe(1);
    const won = dropAt(s, mine[mine.length - 1]);
    expect(won.over).toEqual({ winner: 0, reason: 'connect' });
    // fill a board at random, without stopping at a win: one side and only one is joined
    for (const seed of [1, 2, 3]) {
      const { K: K5, S: S5 } = at(connectionGame({ size: 5 }));
      let x = seed * 7919, s5 = S5;
      const order = K5.L.cells.map((_, i) => i).sort((a, b) => ((a * 2654435761 + x) % 97) - ((b * 2654435761 + x) % 97));
      const sides = s5.board.slice();
      order.forEach((c, i) => { sides[c] = i % 2; });
      s5 = { ...s5, board: sides.map((sd, c) => c), pieces: sides.map((sd, c) => ({ kind: 'stone', side: sd, at: c, moved: 0 })) };
      const joined = [0, 1].filter((sd) => T.connectDistance(K5, s5, sd) === 0);
      expect(joined).toHaveLength(1);
      x += 1;
    }
  });
});

describe('placement: sandwiching and majorities', () => {
  it('a drop must close a line of foes, and turns every line it closes; a player with none passes', () => {
    const { K, S } = at(sandwichGame());
    expect(names(K, S).sort()).toEqual(['disc@C4', 'disc@D3', 'disc@E6', 'disc@F5']);
    const s = play(K, S, ['disc@D3']);
    expect(s.pieces[s.board[cellOf(K, 'D4')]].side).toBe(0);
    const { K: K4, S: S4 } = at(sandwichGame({ size: 4 }));
    let t = S4;
    while (!t.over) t = T.apply(K4, t, T.legal(K4, t)[0]);
    expect(t.over.reason).toBe('score');
    expect(t.over.scores[0] + t.over.scores[1]).toBeLessThanOrEqual(16);
  });

  it('majorities: each region scores first and second, a tie sharing the places\' points', () => {
    const { K, S } = at(majorityGame());
    // teal two in the south-west and one in the south-east; plum one in each
    const s = play(K, S, ['meeple@A1', 'meeple@B1', 'meeple@A2', 'meeple@D1', 'meeple@E1']);
    const sc = T.scores(K, s);
    // south-west: teal 2, plum 1 → 5 and 2; south-east: one each → (5 + 2) / 2 each, rounded down
    expect(sc).toEqual([5 + 3, 2 + 3]);
  });
});

describe('placement: the computer', () => {
  it('takes a line that wins, and blocks one that would lose', () => {
    const { K, S } = at(lineGame());
    const win = play(K, S, ['disc@A1', 'disc@A2', 'disc@B1', 'disc@B2', 'disc@C1', 'disc@C2']);
    expect(M.think(K, win, { depth: 2 }).move.name).toBe('disc@D1');
    const block = play(K, S, ['disc@A1', 'disc@G1', 'disc@B1', 'disc@G2', 'disc@C1']);
    expect(M.think(K, block, { depth: 2 }).move.name).toBe('disc@D1');
  });

  it('takes a stone left with one empty neighbour', () => {
    const { K, S } = at(enclosureGame({ size: 5 }));
    // (no pass waiting: after a pass, a second one ends the game, and a mind ahead on points rightly takes that)
    const s = play(K, S, ['stone@B1', 'stone@B2', 'stone@A2', 'stone@E5', 'stone@C2', 'stone@E4']);
    expect(M.think(K, s, { depth: 1 }).move.name).toBe('stone@B3');
  });

  it('the same seed plays the same placement game', () => {
    const game = () => {
      const { K, S } = at(connectionGame({ size: 5 }));
      let s = S;
      const line = [];
      while (!s.over && line.length < 40) { const m = M.think(K, s, { ...M.LEVELS.fair, seed: line.length }).move; line.push(m.name); s = T.apply(K, s, m); }
      return line;
    };
    expect(game()).toEqual(game());
  });
});
