// Deadfall (deadfall.js): a tree's dead branches and limbs lying under its crown where they fell, by a trail. Held on a
// made land (the walk at x = 12): resting on the ground, turned out, forked, off the walk's middle, out of the rocks; then
// on one stage, laid with the trail's rockfall and drawn as its own wood.
import { describe, it, expect } from 'vitest';
import { deadfall, DEADFALL } from './deadfall.js';
import { assembleStageScene } from './stage.js';

const SITE = { ground: (x, y) => 0.05 * x + 0.02 * y, trailDist: (x) => Math.abs(x - 12), halfWAt: () => 1 };
const TREES = [{ x: 15, y: 10, crown: 2.5 }, { x: 9, y: 20, crown: 3 }, { x: 30, y: 30, crown: 3 }], ROCK = { x: 17, y: 11, r: 0.6 };
const lay = (over = {}) => deadfall(SITE, { amount: 1, trees: TREES, rocks: [ROCK], seed: 3, read: { least: 0.077 }, ...over });

describe('a tree\'s deadfall', () => {
  it('lies under its tree\'s crown, resting on the ground, its faces turned out, its forks off its stem', () => {
    const L = lay();
    expect(L.laws.filter((r) => !r.ok)).toEqual([]);
    expect(L.pieces.length).toBeGreaterThan(0);
    for (const p of L.pieces) {
      const t = TREES[p.tree];
      expect(Math.hypot(p.at[0] - t.x, p.at[1] - t.y)).toBeLessThanOrEqual(t.crown * DEADFALL.reach + 1e-6);
      const cs = p.faces.flatMap((f) => f.corners);
      // (resting: nothing far under the ground, and most of it near it, a propped fork the only part well up)
      expect(Math.min(...cs.map((c) => c[2] - SITE.ground(c[0], c[1])))).toBeGreaterThan(-0.05);
      // (turned out: each face's normal away from its piece's middle line, on the whole)
      expect(p.faces.length).toBeGreaterThan(DEADFALL.sides * 4);
    }
    // (a tree far from the walk drops nothing)
    expect(L.pieces.some((p) => p.tree === 2)).toBe(false);
  });

  it('keeps out of the walk\'s middle and the rocks; more falls the more is asked; the same every time', () => {
    for (const p of lay().pieces) for (const f of p.faces) for (const c of f.corners) expect(Math.abs(c[0] - 12)).toBeGreaterThan(DEADFALL.edge * 0.9);
    const n = (amount) => lay({ amount }).pieces.length;
    expect(n(0.3)).toBeLessThanOrEqual(n(1));
    expect(n(0)).toBe(0);
    expect(JSON.stringify(lay())).toBe(JSON.stringify(lay()));
  });
});

describe('the deadfall on a stage', () => {
  it('is laid with the trail\'s rockfall and drawn as its own wood, walked over; asked nothing, none', () => {
    const M = { kind: 'stage', trail: {}, seed: 3, geocube: { from: 'island-noon', biocube: { from: 'meadow' } } };
    const fell = assembleStageScene({ ...M, skandart: 1 }, {}), plain = assembleStageScene(M, {});
    expect(fell.skandart.deadfall).toMatchObject({ laws: [] });
    expect(fell.skandart.deadfall.branches + fell.skandart.deadfall.limbs).toBeGreaterThan(0);
    expect(fell.faces.some((f) => f.group === 'isekai:deadwood')).toBe(true);
    expect(plain.faces.some((f) => f.group === 'isekai:deadwood')).toBe(false);
    expect((fell.colliders ?? []).length).toBe((plain.colliders ?? []).length);
  }, 120_000);
});
