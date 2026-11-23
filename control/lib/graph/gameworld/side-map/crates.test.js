// The crates (side-map/crates.js): breakable crates on a side map's runs. The concepts: none unless the chain asks (a map
// without the word draws, plays and anchors nothing new); each in a resting bay of a run, on its floor, clear of every
// pit and step, as tall as a hand over the buster's muzzle and under the hero's jump; each the play's collider by its id
// and the scene's faces named for it and an anchor of kind crate, so a world's breakability makes it a block that breaks;
// the `crates` law holds on a laid map and a crate at a pit's lip loses it; the same map, the same crates.
import { describe, it, expect } from 'vitest';
import { cratesOf, crateFaults, crateHeight } from './crates.js';
import { layoutSideMap } from './layout.js';
import { dressSideMap } from './dress.js';
import { sideMapPlay } from './play.js';
import { sideMapOf, assembleSideMap } from './scene.js';
import { breakablesOf } from '../../playscape/destruct/breakability.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true })), stature = 1.67;
const chain = (crates) => ({ premise: 'into the plant', fill: 'machine', ...(crates ? { crates: true } : {}), zones: [
  { run: 'across', screens: 2, beat: 'rest' }, { run: 'across', screens: 4, teach: 'basic' }, { run: 'across', screens: 4, beat: 'landing' }, { room: [1, 1], teach: 'boss' },
] });
const scene = (crates) => ({ kind: 'geocube', show: 'sidemap', seed: 4, sidemap: chain(crates) });

describe('the crates', () => {
  it('none unless the chain asks', () => {
    expect(sideMapOf(scene(false)).layout.crates).toBeUndefined();
    const P = assembleSideMap(scene(false));
    expect(P.anchors).toBeUndefined();
    expect(P.faces.some((f) => f.node)).toBe(false);
  });
  it('each in a resting bay of a run, on its floor, clear of the pits and steps, over the muzzle and under the jump', () => {
    const { layout: L, dress: D } = sideMapOf(scene(true)), C = L.crates;
    expect(C.length).toBeGreaterThan(0);
    for (const c of C) {
      const z = D.zones[c.zone], mid = (c.s0 + c.s1) / 2, k = z.seams.findIndex((x) => Math.abs(x - mid) < 1e-3);
      expect(z.bays[k]).toBe('B');
      expect(L.zones[c.zone].run).toBe('across');
      expect(c.z1 - c.z0).toBeCloseTo(crateHeight(stature), 6);
      expect(c.z1 - c.z0).toBeGreaterThan(stature * 0.7);
      expect(c.z1 - c.z0).toBeLessThan(reach.moves.run.height);
      expect(L.gaps.some((g) => c.s1 > g.s0 - 1 && c.s0 < g.s1 + 1)).toBe(false);
      expect(L.steps.some((x) => Math.abs(x.dz) > 0.05 && x.s > c.s0 - 1 && x.s < c.s1 + 1)).toBe(false);
    }
  });
  it('the play\'s collider by its id, the scene\'s named faces and an anchor: a world makes each a block that breaks', () => {
    const M = sideMapOf(scene(true)), P = sideMapPlay(M.layout, { stature }), page = assembleSideMap(scene(true));
    const ids = M.layout.crates.map((c) => c.id);
    expect(P.colliders.filter((c) => c.of).map((c) => c.of)).toEqual(ids);
    expect(page.anchors).toEqual(ids.map((id) => ({ id, kind: 'crate' })));
    for (const id of ids) expect(page.faces.some((f) => f.node === id)).toBe(true);
    const B = breakablesOf({ ...page, colliders: P.colliders }, 'objects');
    expect(B.breakables.map((b) => b.id)).toEqual(ids);
  });
  it('the crates law holds; a crate at a pit\'s lip loses it', () => {
    const M = sideMapOf(scene(true));
    expect(M.laws.find((l) => l.id === 'crates')).toMatchObject({ holds: true });
    const L = layoutSideMap(chain(true), { reach, stature }), g = L.gaps[0];
    if (!g) return;
    const bad = { id: 'x', zone: g.zone, s0: g.s0 - 0.8, s1: g.s0 + 0.4, z0: 0, z1: 1.3 };
    expect(crateFaults(L, [bad], { stature }).some((f) => /pit/.test(f.says))).toBe(true);
  });
  it('the same map, the same crates', () => {
    const L = layoutSideMap(chain(true), { reach, stature }), D = dressSideMap(L, chain(true), { seed: 4 });
    expect(cratesOf(L, D, { stature })).toEqual(cratesOf(L, D, { stature }));
  });
});
