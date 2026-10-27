/**
 * The island (`island` on a local meru) and a stage's bare bones (`dress: false`): specimens of terrain and of a room,
 * checked before a world is built. Both are opt-in: absent, the stage builds as it always has.
 */
import { describe, expect, it } from 'vitest';

import { readLocalMeru } from './plan.js';
import { assembleStageScene } from '../era/stage.js';

// two small bases: the least land that still has a beach, a high shore and a crease (each build is seconds)
const TWO_BASES = [{ form: 'mound', height: 6, foot: 11, summit: 6.5 }, { form: 'mound', height: 5, foot: 4.8, summit: 2.2, up: { turns: 1 } }];
const meru = (island, shading) => assembleStageScene({ kind: 'stage', kit: 'isekai-meadow', meru: { tiers: TWO_BASES, ...(island === undefined ? {} : { island }), ...(shading === undefined ? {} : { shading }) } }, {});
const GEO = { geology: true, walk: 'base' };
const isle = meru(true), plain = meru(undefined), rocky = meru(GEO);
const of = (p, g) => p.faces.filter((f) => f.group === g);
const mid = (f) => [0, 1, 2].map((k) => f.corners.reduce((s, c) => s + c[k], 0) / f.corners.length);

describe('local meru: the island', () => {
  it('drops a walker on its own ground, however high it stands over the stage\'s join', () => {
    // (the meru island's high side, 13.5 m up, stands over the join at the origin; the join's own height is the stage's)
    const high = meru({ geology: true, walk: 'none', high: { height: 13.5 } }), [x, y, z] = high.walk.spawn;
    // (the land under the spawn: every face whose plan holds it, its height there)
    const at = high.faces.flatMap((f) => { const c = f.corners, out = [];
      for (let k = 1; k + 1 < c.length; k++) { const [a, q, d] = [c[0], c[k], c[k + 1]], det = (q[1] - d[1]) * (a[0] - d[0]) + (d[0] - q[0]) * (a[1] - d[1]);
        if (Math.abs(det) < 1e-12) continue;
        const l1 = ((q[1] - d[1]) * (x - d[0]) + (d[0] - q[0]) * (y - d[1])) / det, l2 = ((d[1] - a[1]) * (x - d[0]) + (a[0] - d[0]) * (y - d[1])) / det;
        if (l1 >= -1e-9 && l2 >= -1e-9 && l1 + l2 <= 1 + 1e-9) out.push(l1 * a[2] + l2 * q[2] + (1 - l1 - l2) * d[2]); }
      return out; });
    const ground = Math.max(...at);
    expect(ground).toBeGreaterThan(5);
    // (standing over it at an eye's height, give or take the hand it is dropped from; the seam's eye the same)
    expect(z - ground).toBeGreaterThanOrEqual(1.7);
    expect(z - ground).toBeLessThan(2);
    expect(high.cameras.find((c) => c.name === 'seam').worldFraming.cameraPosition[2]).toBeCloseTo(z, 5);
  });

  it('reads its settings and refuses what it does not know', () => {
    expect(readLocalMeru({ island: true }).island).toMatchObject({ beach: 9, sea: 0.7, depth: 3, high: { height: 4.5, span: 110 } });
    expect(readLocalMeru({}).island).toBeUndefined();
    expect(() => readLocalMeru({ island: { tide: 1 } })).toThrow(/island.tide is not a setting/);
    expect(() => readLocalMeru({ island: { high: { cliff: 2 } } })).toThrow(/island.high.cliff is not a setting/);
    expect(() => readLocalMeru({ island: { beach: 0 } })).toThrow(/island.beach must be metres above 0/);
    expect(() => readLocalMeru({ island: true, after: { kit: 'isekai-meadow' } })).toThrow(/stands alone/);
  });

  it('stands in a sea: water at the waterline, clear over the shallows, deep over the seabed', () => {
    const sea = of(isle, 'isekai:water');
    expect(sea.length).toBeGreaterThan(100);
    expect(sea.every((f) => f.water && f.corners.every((c) => Math.abs(c[2] - sea[0].corners[0][2]) < 1e-6))).toBe(true);
    const alphas = sea.flatMap((f) => f.cornerAlpha);
    expect(Math.min(...alphas)).toBeLessThan(0.4);
    expect(Math.max(...alphas)).toBeGreaterThan(0.85);
    expect(of(plain, 'isekai:water')).toHaveLength(0);
  });

  it('has a sand beach on its low side and a cliff into the water on its high side', () => {
    const z = of(isle, 'isekai:water')[0].corners[0][2];
    const sand = of(isle, 'isekai:sand');
    expect(sand.length).toBeGreaterThan(100);
    expect(sand.some((f) => mid(f)[2] < z) && sand.some((f) => mid(f)[2] > z)).toBe(true);   // it crosses the waterline
    // cliff that reaches below the waterline: the high side's drop, painted as rock by the slope rule
    expect(of(isle, 'isekai:cliff').filter((f) => f.corners.some((c) => c[2] < z)).length).toBeGreaterThan(20);
    expect(of(plain, 'isekai:cliff').filter((f) => f.corners.some((c) => c[2] < -0.5)).length).toBe(0);
  });
});

describe('local meru: island geology and a walk at the base', () => {
  const bare = isle, rock = rocky;
  it('reads geology and walk, and refuses other words', () => {
    expect(readLocalMeru({ island: { geology: true, walk: 'base' } }).island).toMatchObject({ geology: true, walk: 'base' });
    expect(() => readLocalMeru({ island: { geology: 'yes' } })).toThrow(/island.geology is true/);
    expect(() => readLocalMeru({ island: { walk: 'fly' } })).toThrow(/island.walk is 'all'/);   // ('none' is a walk now: the island flown)
  });
  it('makes the raised land rock, so the mountain is not a turned mound', () => {
    expect(of(rock, 'isekai:cliff').length).toBeGreaterThan(of(bare, 'isekai:cliff').length * 1.3);
  });
  it('draws only the approach at the foot when the walk is at the base', () => {
    expect(of(rock, 'isekai:trail').length).toBeLessThan(of(bare, 'isekai:trail').length);
    const top = (p) => Math.max(...of(p, 'isekai:trail').flatMap((f) => f.corners.map((c) => c[2])));
    // no shelf up the flank: the path stays on the ground at the foot (on the high shore at most, 4.5 m up)
    expect(top(rock)).toBeLessThan(4.5 + 0.5);
    expect(top(bare)).toBeGreaterThan(top(rock) + 4);
  });
});

describe('stage: dress false', () => {
  const room = (extra) => assembleStageScene({ kind: 'stage', kit: 'gothic-stone', reference: 'gothic-night', rooms: [{ id: 'room', x: 0, y: 0, w: 12, d: 12, h: 6, open: ['-y', '+x'] }], ...extra }, {});
  it('keeps the bones and leaves out what is placed', () => {
    const bare = room({ dress: false }), dressed = room({});
    const groups = (p) => new Set(p.faces.map((f) => f.group));
    for (const g of ['stage:wall', 'stage:floor', 'stage:trim']) expect(groups(bare).has(g)).toBe(true);
    for (const g of ['stage:focus', 'stage:accent']) { expect(groups(dressed).has(g)).toBe(true); expect(groups(bare).has(g)).toBe(false); }
  });
  it('is false or left out', () => {
    expect(() => room({ dress: 'none' })).toThrow(/dress is false/);
  });
});

describe('local meru: shading, the land lit by polygons', () => {
  const build = (shading) => meru(GEO, shading);
  const tiled = rocky, poly = build(true);
  let flat;                                                       // the polygons without the rules, built once
  const unruled = () => (flat ||= build({ crevice: 0, ridge: 0, blend: 0 }));
  it('reads its settings and refuses what it does not know', () => {
    expect(readLocalMeru({ shading: true }).shading).toMatchObject({ smooth: true, crevice: 0.6, ridge: 0.35, blend: 0.6 });
    expect(readLocalMeru({}).shading).toBeUndefined();
    expect(() => readLocalMeru({ shading: { glow: 1 } })).toThrow(/shading.glow is not a setting/);
    expect(() => readLocalMeru({ shading: { crevice: 2 } })).toThrow(/shading.crevice is 0..1/);
    expect(() => readLocalMeru({ shading: { shade: 'blue' } })).toThrow(/shading.shade is a/);
  });
  it('bakes the rock instead of tiling it, one colour per facet, and leaves the grass cards out', () => {
    const rock = (p) => p.faces.filter((f) => f.group === 'isekai:cliff' || f.group === 'isekai:rock');
    expect(rock(tiled).every((f) => f.texture)).toBe(true);
    expect(rock(poly).length).toBe(rock(tiled).length);
    expect(rock(poly).every((f) => !f.texture && f.aoFlat)).toBe(true);
    expect(of(poly, 'isekai:grass')).toHaveLength(0);
  });
  it('smooths the ground: corners shared by two ground quads take one colour before the rules', () => {
    const flat = unruled(), key = (c) => c.map((v) => Math.round(v * 100)).join(','), seen = new Map();
    let same = 0, diff = 0;
    for (const f of of(flat, 'isekai:ground')) f.corners.forEach((c, k) => { const h = f.cornerFills[k], s = seen.get(key(c)); if (s === undefined) seen.set(key(c), h); else if (s === h) same++; else diff++; });
    expect(same).toBeGreaterThan(diff * 20);
  });
  it('marks a crease darker than the same land without the rules', () => {
    const off = unruled(), lum = (h) => [1, 3, 5].reduce((a, i) => a + parseInt(h.slice(i, i + 2), 16), 0);
    const sum = (p) => of(p, 'isekai:cliff').reduce((a, f) => a + f.cornerFills.reduce((b, h) => b + lum(h), 0), 0);
    expect(sum(poly)).toBeLessThan(sum(off));
  });
});
