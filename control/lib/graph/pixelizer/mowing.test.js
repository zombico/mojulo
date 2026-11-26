// mowing — the lawn-mowing minigame's core and skin: pure and deterministic, the deck cuts the long grass it passes
// over in stripes by the way it was driven, a tree or the edge stops it, a flowerbed driven over costs, the round ends
// with the grass all cut (or the clock), and every live frame is a valid pixelizer recipe.
import { describe, it, expect } from 'vitest';
import { newGame, step, TRAMPLE, seededLawn } from './mowing-core.js';
import { buildWorldRecipe, resolveOverlay } from './mowing-skin.js';
import { validatePixelRecipe } from './pixelizer.js';

// a driver who goes to each point in turn: turns toward it, drives when it faces it
const driver = (points) => {
  let k = 0;
  return (s) => {
    const p = points[k]; if (!p) return [['up', false], ['left', false], ['right', false]];
    const M = s.mower, dx = p[0] - M.x, dy = p[1] - M.y;
    if (Math.hypot(dx, dy) < 0.3) { k++; return [['up', false], ['left', false], ['right', false]]; }
    let d = Math.atan2(dy, dx) - M.h; d = Math.atan2(Math.sin(d), Math.cos(d));
    return [['left', d < -0.06], ['right', d > 0.06], ['up', Math.abs(d) < 0.35]];
  };
};
const play = (s, mind, ms = 120000) => {
  for (let t = 0; t < ms && !s.over; t += 50) { for (const [key, on] of mind(s)) s = step(s, { type: 'key', key, on }); s = step(s, { type: 'tick', dt: 50 }); }
  return s;
};
// an open lawn 8 by 3, the mower at its west end of the top row facing east; rows driven there and back
const OPEN = { rows: ['........', '........', '........'], start: [0.5, 0.5, 0] };
const SERPENT = [[7.5, 0.5], [7.5, 1.5], [0.5, 1.5], [0.5, 2.5], [7.5, 2.5]];

describe('mowing', () => {
  it('is pure: the same lawn and the same hands cut the same stripes', () => {
    expect(JSON.stringify(play(newGame(5, { lawn: OPEN }), driver(SERPENT)))).toBe(JSON.stringify(play(newGame(5, { lawn: OPEN }), driver(SERPENT))));
    expect(newGame(9).rows).toEqual(seededLawn(9).rows);
  });

  it('rows driven there and back cut it all, striped light and dark by the way each went; all cut ends it at the top score', () => {
    const s = play(newGame(1, { lawn: OPEN }), driver(SERPENT));
    expect(s.over).toBe(true);
    expect(s.mown).toBe(s.total);
    expect(s.score).toBe(1000);
    // (the first row driven east: light; the middle one west: dark)
    expect(s.cut[0].slice(1, 7)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(s.cut[1].slice(1, 7)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(s.left).toBeGreaterThan(0);
  });

  it('a tree or the edge stops it short and says so; a flowerbed driven over costs; the clock ends a round left alone', () => {
    const tree = play(newGame(1, { lawn: { rows: ['...T....'], start: [0.5, 0.5, 0] } }), driver([[7.5, 0.5]]), 3000);
    expect(tree.mower.x).toBeLessThan(3);
    expect(tree.mower.v).toBe(0);
    const edge = play(newGame(1, { lawn: OPEN }), () => [['up', true]], 4000);
    expect(edge.mower.x).toBeLessThan(8);
    const bed = play(newGame(1, { lawn: { rows: ['..*.....'], start: [0.5, 0.5, 0] } }), driver([[7.5, 0.5]]));
    expect(bed.trampled).toBe(1);
    expect(bed.score).toBe(1000 - TRAMPLE);
    const idle = play(newGame(1, { lawn: OPEN, time: 5 }), () => []);
    expect(idle).toMatchObject({ over: true, mown: 1, left: 0 });
  });

  it('every live frame is a valid pixelizer recipe, and the overlay says how much is cut', () => {
    let s = newGame(2);
    const mind = driver([[3, s.mower.y], [3, 2]]);
    for (let i = 0; i < 30; i++) { for (const [key, on] of mind(s)) s = step(s, { type: 'key', key, on }); s = step(s, { type: 'tick', dt: 100 }); expect(validatePixelRecipe(buildWorldRecipe(s))).toEqual([]); }
    expect(resolveOverlay(s)).toMatchObject({ title: 'MOWING', status: 'playing', mown: expect.stringMatching(/%$/) });
    expect(resolveOverlay(play(newGame(1, { lawn: OPEN }), driver(SERPENT)))).toMatchObject({ status: 'over', message: 'Every blade cut' });
  });

  it('a slow frame goes as far as several quick ones: the mower keeps to the clock at any rate', () => {
    const go = (dt, n) => { let s = step(newGame(1, { lawn: OPEN }), { type: 'key', key: 'up', on: true }); for (let i = 0; i < n; i++) s = step(s, { type: 'tick', dt }); return s; };
    const slow = go(500, 2), quick = go(50, 20);
    expect(slow.mower.x).toBeCloseTo(quick.mower.x, 5);
    expect(slow.left).toBe(quick.left);
  });

  it('refuses a lawn that is not one: rows of two widths, a tile it does not know', () => {
    expect(() => newGame(1, { lawn: { rows: ['...', '..'] } })).toThrow(/one width/);
    expect(() => newGame(1, { lawn: { rows: ['..q'] } })).toThrow(/one of/);
  });
});
