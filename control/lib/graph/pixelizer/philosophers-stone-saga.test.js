import { describe, it, expect } from 'vitest';
import { sagaLevel, sagaLevels, sagaStart, sagaStep, dissolved, goalMet, readSaga, SAGA_DEFAULTS } from './philosophers-stone-saga.js';
import { step } from './philosophers-stone-core.js';

// a steady player: the swap that scores most now, or that wins (the curve was measured against this player)
const greedy = (s) => {
  let best = null, bv = -1;
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (x + dx >= s.W || y + dy >= s.H) continue;
    const n = sagaStep(s, { type: 'swap', a: { x, y }, b: { x: x + dx, y: y + dy } });
    if (n === s) continue;
    const g = s.spec.goal, v = (n.result === 'won' ? 1e9 : 0) + (g.collect ? n.collected[g.collect.c] * 40 + n.score * 0.2 : n.score);
    if (v > bv) { bv = v; best = n; }
  }
  return best;
};
const play = (L) => { let s = sagaStart(L); while (!s.over) s = greedy(s); return s; };
// one level of each goal (a score level, a collect level), chosen off the table rather than by hand
const scoreLevel = sagaLevels().find((L) => L.goal.score), collectLevel = sagaLevels().find((L) => L.goal.collect);

describe('the saga: a match-3 map generated from its seed', () => {
  it('the same seed and count make the same map; another seed another', () => {
    expect(sagaLevels({ seed: 5, levels: 4 })).toEqual(sagaLevels({ seed: 5, levels: 4 }));
    expect(sagaLevels({ seed: 6, levels: 4 })).not.toEqual(sagaLevels({ seed: 5, levels: 4 }));
    expect(sagaLevels().length).toBe(SAGA_DEFAULTS.levels);
    expect(sagaLevel(3)).toEqual(sagaLevels()[2]);
  });

  it('the curve thins: fewer moves and a bigger share of them asked as the map goes on', () => {
    const first = sagaLevel(2), late = sagaLevel(29);
    expect(late.moves).toBeLessThan(first.moves);
    expect(late.reagents).toBeGreaterThanOrEqual(first.reagents);
    for (const L of [scoreLevel, collectLevel]) { expect(L.stars[1]).toBeLessThan(L.stars[2]); expect(L.bonus).toBeGreaterThan(0); }
  });

  it('what a move dissolved is counted off the cascade the core hands the page, as the core counts a clear', () => {
    let s = sagaStart(collectLevel);
    const n = greedy(s), cleared = n.lastTrace.reduce((a, t) => a + t.cleared, 0);
    expect(n.moves).toBe(1);
    expect(n.movesLeft).toBe(collectLevel.moves - 1);
    expect(dissolved(n.cascade, collectLevel.reagents).reduce((a, k) => a + k, 0)).toBe(cleared);
    s = n;
    expect(sagaStep(s, { type: 'select', x: 0, y: 0 }).movesLeft).toBe(s.movesLeft);   // arming spends nothing
  });

  it('a steady player wins a score level and a collect level within their moves, and earns stars', () => {
    for (const L of [scoreLevel, collectLevel]) {
      const s = play(L);
      expect(s.result, `level ${L.n}`).toBe('won');
      expect(goalMet(s)).toBe(true);
      expect(s.stars).toBeGreaterThanOrEqual(1);
      expect(s.score).toBeGreaterThanOrEqual(L.stars[0] + s.movesLeft * L.bonus);
    }
  });

  it('out of moves short of the goal is a loss; a won or lost level takes no more moves; restart replays it', () => {
    const tight = { ...scoreLevel, moves: 1, goal: { score: 1e9 }, stars: [1e9, 1e9, 1e9] };
    const lost = greedy(sagaStart(tight));
    expect(lost).toMatchObject({ over: true, result: 'lost', stars: 0, movesLeft: 0 });
    expect(sagaStep(lost, { type: 'swap', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } })).toBe(lost);
    const again = sagaStep(lost, 'restart');
    expect(again.grid).toEqual(sagaStart(tight).grid);
    expect(again).toMatchObject({ over: false, result: null, movesLeft: 1 });
  });

  it('the saga\'s rules wrap the core: the board the core settles is the board the saga plays', () => {
    const s0 = sagaStart(scoreLevel), n = greedy(s0);
    const core = step(s0, { type: 'swap', a: findSwap(s0, n), b: findSwap(s0, n, true) });
    expect(core.grid).toEqual(n.grid);
    expect(core.score).toBe(n.score);
  });

  it('reads the recipe\'s saga, refusing what is not one', () => {
    expect(readSaga(true)).toEqual(SAGA_DEFAULTS);
    expect(readSaga({ levels: 12 })).toEqual({ seed: SAGA_DEFAULTS.seed, levels: 12 });
    expect(() => readSaga({ lives: 5 })).toThrow(/lives is not a saga setting/);
    expect(() => readSaga({ seed: 1.5 })).toThrow(/whole number/);
  });
});

// the swap that took s to n (the greedy player's), its a or (b: true) its b
function findSwap(s, n, b = false) {
  for (let y = 0; y < s.H; y++) for (let x = 0; x < s.W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (x + dx >= s.W || y + dy >= s.H) continue;
    const m = sagaStep(s, { type: 'swap', a: { x, y }, b: { x: x + dx, y: y + dy } });
    if (m !== s && JSON.stringify(m.grid) === JSON.stringify(n.grid)) return b ? { x: x + dx, y: y + dy } : { x, y };
  }
  return null;
}
