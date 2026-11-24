// The side map's layout (side-map/layout.js): a zone chain laid on the plane in screens and reach. The concepts: an
// across run's band is one screen thick and a shaft's one screen wide; a chimney is narrower than a screen, its walls
// out to the frame's edges, its rests on alternate walls never more than three kicks apart, a pickup on each; a ladder
// stands from the shaft's floor to its lip; a chute shuts at its foot and a boss's room behind its door; a gap is open
// to the frame's bottom (a pit); a run too short for what it teaches is laid and says so; the same words lay the same map.
import { describe, it, expect } from 'vitest';
import { layoutSideMap } from './layout.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true }));
const STATURE = 1.67;
const lay = (zones) => layoutSideMap({ zones }, { reach, stature: STATURE });
const thick = (r) => r[3] - r[2], wide = (r) => r[1] - r[0];

describe('the side map\'s layout', () => {
  it('an across run is one screen thick; a shaft one screen wide', () => {
    const L = lay([{ run: 'across', screens: 3, teach: 'basic' }, { run: 'up', screens: 2 }, { run: 'down', screens: 2, drop: 'chute' }]);
    expect(thick(L.zones[0].rect)).toBeCloseTo(L.screen.height, 2);
    expect(wide(L.zones[1].rect)).toBeCloseTo(L.screen.width, 2);
    expect(wide(L.zones[2].rect)).toBeCloseTo(L.screen.width, 2);
    expect(L.zones.map((z) => z.lock)).toEqual(['z', 's', 's']);
  });
  it('a chimney: narrower than a screen, its rests on alternate walls within three kicks, a pickup on each', () => {
    const L = lay([{ run: 'across', screens: 1 }, { run: 'up', screens: 3, climb: 'chimney', rises: true }]);
    const shaft = L.open.find((r) => r.zone === 1);
    expect(shaft.s1 - shaft.s0).toBeLessThan(L.screen.width / 2);
    const R = L.rests.filter((r) => r.zone === 1);
    expect(R.length).toBeGreaterThan(2);
    const zs = [0, ...R.map((r) => r.z - L.zones[1].exit[1] + 3 * L.screen.height)];
    for (let k = 1; k < zs.length; k++) expect(zs[k] - zs[k - 1]).toBeLessThanOrEqual(3 * reach.wall.climb + 1e-6);
    expect(R.every((r, k) => r.side === (k % 2 ? 'far' : 'near'))).toBe(true);
    expect(L.pickups.filter((p) => p.zone === 1)).toHaveLength(R.length);
    expect(L.rises).toEqual([expect.objectContaining({ zone: 1 })]);
  });
  it('a ladder stands from the shaft\'s floor to its lip', () => {
    const L = lay([{ run: 'up', screens: 1.5, climb: 'ladder' }]);
    const [lad] = L.ladders, z = L.zones[0];
    expect(lad.foot[1]).toBe(0);
    expect(lad.lip[1]).toBeCloseTo(z.exit[1], 3);
  });
  it('a chute shuts at its foot; a boss\'s room behind its door', () => {
    const L = lay([{ run: 'across', screens: 1 }, { run: 'down', screens: 2, drop: 'chute' }, { room: [1, 1], teach: 'boss' }]);
    expect(L.doors.map((d) => d.zone)).toEqual([1, 2]);
    expect(L.doors[0].at[1]).toBeCloseTo(L.zones[0].exit[1] - 2 * L.screen.height, 2);
  });
  it('a gap is open to the frame\'s bottom: no solid stands under it', () => {
    const L = lay([{ run: 'across', screens: 3, teach: 'basic' }]);
    expect(L.gaps.length).toBeGreaterThan(0);
    for (const g of L.gaps) {
      const mid = (g.s0 + g.s1) / 2;
      expect(L.solids.some((r) => r.s0 < mid && r.s1 > mid)).toBe(false);
    }
  });
  it('a run too short for what it teaches is laid as one floor, and says so', () => {
    const L = lay([{ run: 'across', screens: 1, teach: 'advanced' }]);
    expect(L.advice[0].says).toMatch(/holds no advanced course/);
  });
  it('a zone\'s solids never stand in another zone\'s open space', () => {
    const L = lay([{ run: 'across', screens: 2 }, { run: 'up', screens: 2 }, { run: 'across', screens: 1 }, { run: 'down', screens: 2, drop: 'chute' }, { room: [1, 1], teach: 'boss' }]);
    for (const r of L.solids) for (const o of L.open.filter((o) => o.zone !== r.zone)) expect(o.s0 < r.s1 - 0.01 && o.s1 > r.s0 + 0.01 && o.z0 < r.z1 - 0.01 && o.z1 > r.z0 + 0.01).toBe(false);
  });
  it('the same words lay the same map', () => {
    const Z = [{ run: 'across', screens: 2, teach: 'gauntlet', spawners: 2 }, { run: 'up', screens: 1, climb: 'switchback' }, { room: [2, 1] }];
    expect(JSON.stringify(lay(Z))).toBe(JSON.stringify(lay(Z)));
  });
  it('a tower and an atrium are climbed as a wall kicker climbs: storeys, a chimney up each at its ends in turn, a ladder only in the open', () => {
    const T = lay([{ run: 'across', screens: 1 }, { run: 'up', screens: 2, climb: 'tower' }, { run: 'across', screens: 1 }]);
    const shaft = T.open.find((r) => r.zone === 1);
    expect(shaft.s1 - shaft.s0).toBeLessThan(T.screen.width - 2);
    expect(T.zones[1].lock).toBe('s');
    const legs = T.towers.find((t) => t.zone === 1).legs;
    expect(legs.map((g) => g.kind)).toEqual(['chimney', 'chimney']);
    // (the ends in turn, so each storey is crossed; the last at the far end, left over the far wall's top)
    expect(Math.sign(legs[0].span[0] - legs[1].span[0])).toBe(-1);
    expect(legs.at(-1).exitDir).toBe(1);
    const kick = reach.wall.climb;
    for (const g of legs) { const zs = [g.zb, ...g.rests.map((r) => r.z), g.zt]; zs.slice(1).forEach((z, k) => expect(z - zs[k]).toBeLessThanOrEqual(3 * kick + 1e-6)); }
    // (a thick floor between the storeys, open at the chute the chimney under it comes up through)
    const slabs = T.solids.filter((r) => r.zone === 1 && r.role === 'slab');
    expect(slabs.length).toBeGreaterThan(0);
    expect(slabs.every((r) => r.z1 - r.z0 >= 1.5)).toBe(true);
    expect(slabs.some((r) => Math.min(r.s1, legs[0].span[1]) - Math.max(r.s0, legs[0].span[0]) > 0.1)).toBe(false);
    expect(T.ladders.filter((l) => l.zone === 1)).toEqual([]);
    // (an atrium: two screens, its middle storey risen by a ladder in the open, its ends by chimneys; no stairs)
    const A = lay([{ run: 'across', screens: 1 }, { run: 'up', screens: 3, climb: 'atrium' }, { run: 'across', screens: 1 }]);
    expect(A.zones[1].lock).toBeNull();
    expect(wide(A.zones[1].rect)).toBeGreaterThan(A.screen.width * 1.9);
    const AL = A.towers.find((t) => t.zone === 1).legs;
    expect(AL.map((g) => g.kind)).toEqual(['chimney', 'ladder', 'chimney']);
    const mid = (A.zones[1].rect[0] + A.zones[1].rect[1]) / 2;
    expect(Math.abs(AL[1].s - mid)).toBeLessThan(1);
    expect(A.solids.some((r) => r.zone === 1 && r.role === 'step')).toBe(false);
    expect(A.advice).toEqual([]);
  });
});
