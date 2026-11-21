// The icing's doodads (side-map/doodads.js): what stands on a slice's icing and blocks nothing. The concepts: none is a
// collider (the layout's blocks are the same with them as without, and the build draws them as their own groups); each
// stands in an A bay of an across run, at its depth (behind the lane, on its lip, in the foreground); a lip thing stays
// under the hero's feet line's reach and a foreground thing's top under the top it stands before; none at a pit's lip;
// the `doodads` law holds on a laid map and a sunk thing loses it; the same map, the same doodads.
import { describe, it, expect } from 'vitest';
import { doodadsOf, doodadFaults, DOODAD_DEPTHS, LIP_MAX } from './doodads.js';
import { layoutSideMap } from './layout.js';
import { dressSideMap } from './dress.js';
import { sideMapLaws } from './laws.js';
import { assembleSideMap } from './scene.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true }));
const chain = (premise, fill) => ({ premise, fill, zones: [
  { run: 'across', screens: 2, beat: 'rest' }, { run: 'across', screens: 3, teach: 'basic' }, { run: 'up', screens: 2, climb: 'ledges' },
  { run: 'across', screens: 2, beat: 'landing' }, { room: [1, 1], teach: 'boss' },
] });
const laid = (map, seed = 4) => { const L = layoutSideMap(map, { reach, stature: 1.67 }); return { L, D: dressSideMap(L, map, { seed }) }; };
// (one map a kind of set: machinery's, with a foreground frame; rock's, with lip things)
const MAPS = [chain('into the plant', 'machine'), chain('up the volcano', 'rock')];

describe('the icing\'s doodads', () => {
  it('stand in A bays of across runs, at their depths, and none is a collider', () => {
    for (const map of MAPS) {
      const { L, D } = laid(map), dd = doodadsOf(L, D);
      expect(dd.length, map.premise).toBeGreaterThan(0);
      expect(new Set(dd.map((d) => d.depth)).size, map.premise).toBeGreaterThan(1);
      for (const d of dd) {
        const z = D.zones[d.zone], bw = z.seams[1] - z.seams[0], k = z.seams.findIndex((c) => Math.abs(d.s - c) <= bw / 2 + 1e-6);
        expect(z.bays[k], `${d.kind} at ${d.s}`).toBe('A');
        const [x0, x1] = DOODAD_DEPTHS[d.depth];
        if (d.kind !== 'icicles') expect(d.x0 >= x0 - 1e-6 && d.x1 <= x1 + 1e-6, `${d.kind} within its depth`).toBe(true);
      }
      // (the build draws them, and the runtime's colliders, the layout's blocks, are the same as the layout's alone)
      const P = assembleSideMap({ kind: 'geocube', show: 'sidemap', seed: 4, sidemap: map });
      expect(P.faces.some((f) => /^sidemap:doodad-/.test(f.group))).toBe(true);
      expect(P.sidemap.layout.blocks).toEqual(L.blocks);
    }
  });
  it('the lip stays low and the foreground under the feet line', () => {
    const { L, D } = laid(MAPS[0]), dd = doodadsOf(L, D);
    const fore = dd.filter((d) => d.depth === 'foreground'), lip = dd.filter((d) => d.depth === 'lip' && d.z >= d.on - 1e-6);
    expect(fore.length).toBeGreaterThan(0);
    for (const d of fore) expect(d.top).toBeLessThanOrEqual(d.on);
    for (const d of lip) expect(d.top - d.on).toBeLessThanOrEqual(LIP_MAX * 1.67);
  });
  it('the doodads law holds, and a thing sunk in a closed part loses it', () => {
    const { L, D } = laid(MAPS[1]), law = sideMapLaws(L, reach, { dress: D }).find((l) => l.id === 'doodads');
    expect(law.holds, law.says).toBe(true);
    const r = L.solids.find((q) => q.role === 'floor' && q.z1 - q.z0 > 1), mid = (r.s0 + r.s1) / 2;
    const sunk = { zone: r.zone, kind: 'crate', depth: 'back', s: mid, z: r.z1 - 0.8, top: r.z1 + 0.1, w: 0.5, x0: -1, x1: -0.6, on: r.z1 };
    expect(doodadFaults(L, [sunk]).some((f) => /sunk/.test(f.says))).toBe(true);
  });
  it('the same map, the same doodads', () => {
    const a = laid(MAPS[0]), b = laid(MAPS[0]);
    expect(doodadsOf(a.L, a.D)).toEqual(doodadsOf(b.L, b.D));
  });
});
