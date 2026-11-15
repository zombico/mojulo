import { describe, it, expect } from 'vitest';
import { assembleGeotownScene } from './scene.js';
import { SLOT, readEnter } from '../retail/store-slot.js';
import { frontOf } from './fronts.js';

// the smallest town with a row of shops: one main-street segment, its shops one card (the street's lightest)
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 4, geotown: { enter: { cards: ['electronics'] }, evoke: 'segment', segment: 'main-street', hills: { height: 4 }, margin: 12 } };
const P = assembleGeotownScene(M), E = P.geotown.enter, shops = P.anchors.filter((a) => a.store);
const within = (p, c) => p[0] > c.min[0] && p[0] < c.max[0] && p[1] > c.min[1] && p[1] < c.max[1] && p[2] > c.min[2] && p[2] < c.max[2];

describe('a town\'s shops walked into', () => {
  it('reads its setting', () => {
    expect(readEnter(undefined)).toBeNull(); expect(readEnter(false)).toBeNull();
    expect(readEnter(true).near).toBe(SLOT.near);
    expect(() => readEnter({ cards: ['nowhere'] })).toThrow(/enter.cards/);
    expect(() => readEnter({ doors: 2 })).toThrow(/enter.doors/);
  });
  it('every shop of its row is entered, by its law', () => {
    expect(shops.length).toBeGreaterThan(0);
    expect(shops.length).toBe(P.anchors.filter((a) => a.use === 'shop' && a.row === 'shops').length);
    expect(P.geotown.laws.find((l) => l.law === 'entered').ok).toBe(true);
    expect(Object.keys(E.shops)).toHaveLength(shops.length);
  });
  it('a body walks from the walk through the door to the till: no box in its way', () => {
    for (const a of shops) {
      const { door, till, inside } = a.store, N = a.N, z = door[2] + 1;
      for (const t of [-1.5, -0.5, 0, 0.5, 1.2]) expect(P.colliders.some((c) => within([door[0] - N[0] * t, door[1] - N[1] * t, z], c))).toBe(false);
      expect(till[0]).toBeGreaterThan(inside.min[0]); expect(till[0]).toBeLessThan(inside.max[0]);
      expect(till[1]).toBeGreaterThan(inside.min[1]); expect(till[1]).toBeLessThan(inside.max[1]);
      // (its inside within its building's own box, its walls still held round it)
      expect(inside.min[0]).toBeGreaterThan(a.box.min[0]); expect(inside.max[0]).toBeLessThan(a.box.max[0]);
      expect(inside.min[1]).toBeGreaterThan(a.box.min[1]); expect(inside.max[1]).toBeLessThan(a.box.max[1]);
      expect(P.colliders.some((c) => within([inside.min[0] - 0.1, (inside.min[1] + inside.max[1]) / 2, z], c))).toBe(true);
    }
  });
  it('each inside is a repeat drawn near the camera only, stamped at its door', () => {
    const reps = P.repeats.filter((r) => r.group.startsWith('geotown:store-'));
    expect(reps).toHaveLength(E.templates);
    expect(reps.every((r) => r.near === SLOT.near)).toBe(true);
    expect(reps.reduce((a, r) => a + r.transforms.length, 0)).toBe(shops.length);
    const doors = shops.map((a) => a.store.door.join(','));
    for (const r of reps) for (const t of r.transforms) expect(doors).toContain(t.pos.join(','));
    // (no inside's faces among the town's own: its budget is the town's)
    expect(P.geotown.laws.find((l) => l.law === 'faces').ok).toBe(true);
  });
  it('its glass is seen through: a pane each side of its door, the wall behind them cut', () => {
    const panes = P.faces.filter((f) => f.group === 'geotown:pane');
    expect(panes.length).toBeGreaterThanOrEqual(shops.length);
    expect(panes.every((f) => f.alpha > 0 && f.alpha < 1)).toBe(true);
    // (no face of the building's own wall stands across a pane's middle)
    for (const a of shops) {
      const N = a.N, mine = panes.filter((f) => f.corners.every((c) => c[0] > a.box.min[0] - 0.01 && c[0] < a.box.max[0] + 0.01));
      expect(mine.length).toBeGreaterThan(0);
      for (const f of mine) {
        const mid = [0, 1, 2].map((i) => f.corners.reduce((s, c) => s + c[i], 0) / f.corners.length), k = Math.abs(N[0]) > 0.5 ? 0 : 1, o = 1 - k;
        const behind = P.faces.filter((g) => g.group.startsWith('town:') && g.corners.every((c) => Math.abs(c[k] - mid[k]) < 0.5) && Math.min(...g.corners.map((c) => c[o])) < mid[o] - 0.05 && Math.max(...g.corners.map((c) => c[o])) > mid[o] + 0.05 && Math.min(...g.corners.map((c) => c[2])) < mid[2] - 0.05 && Math.max(...g.corners.map((c) => c[2])) > mid[2] + 0.05);
        expect(behind.map((g) => g.group)).toEqual([]);
      }
    }
  });
});

describe('a shopfront', () => {
  const house = { W: 7, n: 2, storeyH: 2.9, doorX: 2.5, doorW: 1 };
  it('open, tells its panes and keeps its panel only round them; shut, it is as it was', () => {
    const shut = frontOf({ shop: { sign: 'band', awning: 'none' } }, house), open = frontOf({ shop: { sign: 'band', awning: 'none', open: true } }, house);
    expect(shut.panes).toBeUndefined();
    expect(shut.faces.some((f) => f.see)).toBe(false);
    expect(open.panes).toHaveLength(2);
    expect(open.faces.filter((f) => f.see)).toHaveLength(2);
    for (const [x0, x1, z0, z1] of open.panes) {
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      // (nothing opaque across a pane's whole middle but its own mullions and rail)
      const over = open.faces.filter((f) => !f.see && f.role === 'trim' && Math.min(...f.corners.map((c) => c[0])) <= x0 && Math.max(...f.corners.map((c) => c[0])) >= x1 && Math.min(...f.corners.map((c) => c[2])) < mz - 0.3 && Math.max(...f.corners.map((c) => c[2])) > mz + 0.3);
      expect(over).toHaveLength(0);
      expect(mx).toBeGreaterThan(0);
    }
  });
});
