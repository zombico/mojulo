import { describe, it, expect } from 'vitest';
import { assembleGeotownScene, readEnter } from './scene.js';
import { SLOT } from '../retail/store-slot.js';

// the smallest town with a row of shops: one main-street segment, its shops one card (the street's lightest)
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 4, enter: { cards: ['electronics'] }, geotown: { evoke: 'segment', segment: 'main-street', hills: { height: 4 }, margin: 12 } };
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
});
