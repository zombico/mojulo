// The closed parts painted (side-map/paint.js) and an outdoor zone's backdrop. The concepts: every closed face carries
// its fill (the `painted` law holds on a chain for each fill); a rock's beds are level across the whole level; slices
// keep the walls' rule and only an A slice carries a motif; a big mass carries something toward its middle; an end at a
// pit is bitten out and one toward open space lit; the thread runs unbroken from the first zone to the last; a zone at
// the foot of a climb sees hills and a range, one at the top only a low horizon, one inside none; the same seed, the
// same paint; a plain face loses `painted`.
import { describe, it, expect } from 'vitest';
import { paintSideMap, backdropOf, BACKDROP, SIDE_CAP, SIDE_JAMB, wallSurfaces } from './paint.js';
import { materialOf } from './cake.js';
import { layoutSideMap } from './layout.js';
import { dressSideMap } from './dress.js';
import { sideMapLaws } from './laws.js';
import { FILL_IDS } from './fills.js';
import { rhythmFaults } from '../../era/wall-rhythm.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true }));
const chain = (premise, fill) => ({ premise, ...(fill ? { fill } : {}), zones: [
  { run: 'across', screens: 2, beat: 'rest' }, { run: 'across', screens: 3, teach: 'basic' }, { run: 'up', screens: 3, climb: 'ledges' },
  { run: 'across', screens: 2, beat: 'landing' }, { run: 'down', screens: 2, drop: 'chute' }, { room: [1, 1], teach: 'boss' },
] });
const all = (map, seed = 4) => { const L = layoutSideMap(map, { reach, stature: 1.67 }), D = dressSideMap(L, map, { seed }); return { L, D, P: paintSideMap(L, D, { seed }) }; };
const inside = (m, r) => m.s0 >= r.s0 - 1e-3 && m.s1 <= r.s1 + 1e-3 && m.z0 >= r.z0 - 1e-3 && m.z1 <= r.z1 + 1e-3;

describe('the closed parts painted', () => {
  it('every closed face carries its fill, whatever the fill', () => {
    for (const fill of FILL_IDS) {
      const { L, D, P } = all(chain('into the plant', fill));
      const painted = sideMapLaws(L, reach, { dress: D, paint: P }).find((l) => l.id === 'painted');
      expect(painted.holds, `${fill}: ${painted.says}`).toBe(true);
    }
  });
  it('a rock\'s beds are level across the whole level', () => {
    const { P } = all(chain('up the volcano', 'rock')), beds = P.marks.filter((m) => m.what === 'bed' || m.what === 'cake-bed');
    const tops = new Set(beds.map((m) => m.z1)), zones = new Set(beds.map((m) => m.zone));
    expect(zones.size).toBeGreaterThan(2);
    const shared = [...tops].filter((t) => new Set(beds.filter((m) => m.z1 === t).map((m) => m.zone)).size > 1);
    expect(shared.length).toBeGreaterThan(0);
  });
  it('slices keep the walls\' rule, and only an A slice carries a motif', () => {
    const { L, P } = all(chain('into the plant'));
    for (const Z of L.zones) expect(rhythmFaults(P.slices.filter((x) => x.zone === Z.i).map((x) => x.ab).join(''))).toEqual([]);
    const motifs = P.marks.filter((m) => ['pocket', 'niche', 'lamp-panel', 'plate'].includes(m.what));
    expect(motifs.length).toBeGreaterThan(0);
    for (const m of motifs) expect(P.slices.find((x) => x.zone === m.zone && (m.s0 + m.s1) / 2 >= x.s0 && (m.s0 + m.s1) / 2 < x.s1).ab).toBe('A');
  });
  it('a big mass carries something toward its middle', () => {
    const { L, P } = all(chain('into the plant')), big = L.solids.filter((r) => r.s1 - r.s0 >= 5 && r.z1 - r.z0 >= 5);
    expect(big.length).toBeGreaterThan(0);
    for (const r of big) expect(P.marks.some((m) => ['vein', 'recess', 'window', 'great-block'].includes(m.what) && inside(m, r))).toBe(true);
  });
  it('an end at a pit is bitten out; an end toward open space is lit', () => {
    const { L, P } = all(chain('into the plant'));
    for (const g of L.gaps.filter((g) => g.kind !== 'wall')) {
      expect(P.marks.some((m) => m.what === 'break' && Math.abs(m.s1 - g.s0) < 0.3)).toBe(true);
      expect(P.marks.some((m) => m.what === 'break' && Math.abs(m.s0 - g.s1) < 0.3)).toBe(true);
    }
    expect(P.marks.some((m) => m.what === 'edge')).toBe(true);
  });
  it('the thread runs unbroken from the first zone to the last', () => {
    const { L, D, P } = all(chain('into the plant')), [T] = P.threads;
    expect(T.kind).toBe(D.threads[0].kind);
    expect(T.path[0][0]).toBeLessThanOrEqual(L.zones[0].rect[0] + 1e-6);
    expect(T.path.at(-1)[0]).toBeCloseTo(L.zones.at(-1).exit[0], 3);
    const zones = new Set(P.marks.filter((m) => m.what === T.kind).map((m) => m.zone));
    expect(zones.size).toBeGreaterThanOrEqual(L.zones.length - 1);
  });
  it('the same seed, the same paint; a plain face loses `painted`', () => {
    const a = all(chain('into the plant')), b = all(chain('into the plant'));
    expect(JSON.stringify(a.P)).toBe(JSON.stringify(b.P));
    const big = a.L.solids.find((r) => r.s1 - r.s0 >= 5 && r.z1 - r.z0 >= 3);
    const bare = { ...a.P, marks: a.P.marks.filter((m) => !(m.layer === 1 && inside(m, big))) };
    expect(sideMapLaws(a.L, reach, { dress: a.D, paint: bare }).find((l) => l.id === 'painted').holds).toBe(false);
  });
});

describe('the cap', () => {
  it('every top a hero stands on wears its cap in segments on its fill\'s module; taken away, the top is one smooth band', () => {
    for (const fill of FILL_IDS) {
      const { L, D, P } = all(chain('into the plant', fill)), tops = P.marks.filter((m) => m.what === 'cap-top');
      expect(tops.length, fill).toBeGreaterThan(10);
      if (fill !== 'rock') { const lens = new Set(tops.map((m) => Math.round((m.s1 - m.s0) * 100))); expect([...lens].some((l) => Math.abs(l / 100 - SIDE_CAP.module[fill]) < 0.02)).toBe(true); }
      const bare = { ...P, marks: P.marks.filter((m) => !m.top) };
      expect(sideMapLaws(L, reach, { dress: D, paint: bare }).find((l) => l.id === 'painted').says).toMatch(/one smooth band/);
    }
  });
  it('a built run\'s pier cap where its pillar stands; a machine\'s hazard band at a pit\'s lip', () => {
    const B = all(chain('into the plant', 'built')), pier = B.P.marks.filter((m) => m.what === 'cap-pier');
    const pillars = B.D.zones.flatMap((z) => (z.pillars ?? []).map((p) => [z.zone, p]));
    expect(pier.length).toBeGreaterThan(0);
    for (const m of pier) expect(pillars.some(([z, p]) => z === m.zone && Math.abs((m.s0 + m.s1) / 2 - p) < 1e-3)).toBe(true);
    const M = all(chain('into the plant', 'machine'));
    expect(M.P.marks.some((m) => m.what === 'cap-hazard')).toBe(true);
  });
});

describe('the cake', () => {
  it('a zone\'s slices are its world\'s material: a plant\'s machinery kibble, a base\'s plate, a mountain\'s rock, snow on a cold land', () => {
    expect(materialOf('machine', { setting: 'plant' })).toBe('kibble');
    expect(materialOf('machine', { setting: 'base' })).toBe('plate');
    expect(materialOf('built', {})).toBe('masonry');
    expect(materialOf('rock', { indoor: false, setting: 'mountain', backdrop: 'land' })).toBe('rock');
    expect(materialOf('rock', { indoor: false, setting: 'mountain', backdrop: 'sky' })).toBe('snow');
    expect(materialOf('rock', { indoor: false, cold: true })).toBe('snow');
    const { P } = all(chain('into the plant', 'machine'));
    expect(['cake-conduit', 'cake-panel', 'cake-rib'].every((w) => P.marks.some((m) => m.what === w))).toBe(true);
  });
  it('a rock\'s strata hang from each slice\'s own top: soil under the icing, rubble under the soil', () => {
    const { L, P } = all(chain('up the volcano', 'rock')), f = L.solids.find((r) => r.role === 'floor' && r.s1 - r.s0 > 6);
    const soil = P.marks.find((m) => m.what === 'cake-soil' && m.s0 <= f.s0 + 1 && m.s1 >= f.s0 + 1 && m.z1 <= f.z1);
    expect(f.z1 - soil.z1).toBeCloseTo(0.34, 2);
    expect(P.marks.some((m) => m.what === 'cake-rubble' && Math.abs(m.z1 - soil.z0) < 1e-3)).toBe(true);
  });
});

describe('the jamb', () => {
  it('every wall a hero kicks off wears its jamb in segments, down its edge and on its face into the open', () => {
    for (const fill of FILL_IDS) {
      const { L, P } = all(chain('into the plant', fill)), walls = wallSurfaces(L);
      expect(walls.length, fill).toBeGreaterThan(1);
      for (const W0 of walls) {
        const on = P.marks.filter((m) => m.zone === W0.zone && m.z1 > W0.z0 && m.z0 < W0.z1);
        expect(on.filter((m) => m.what === 'jamb' && Math.abs((W0.dir > 0 ? m.s1 : m.s0) - W0.e) < 1e-3).length, `${fill} ${W0.e}`).toBeGreaterThan(1);
        expect(on.some((m) => m.side && Math.abs(m.s0 - W0.e) < 1e-3)).toBe(true);
      }
      const bare = { ...P, marks: P.marks.filter((m) => !/^jamb/.test(m.what)) };
      expect(sideMapLaws(L, reach, { dress: all(chain('into the plant', fill)).D, paint: bare }).find((l) => l.id === 'painted').holds).toBe(false);
    }
  });
  it('chunky, never past the plane the hero kicks off: a notch at most 0.15 m into the wall', () => {
    const { L, P } = all(chain('into the plant', 'rock')), walls = wallSurfaces(L), notches = P.marks.filter((m) => m.what === 'jamb-notch');
    expect(notches.length).toBeGreaterThan(0);
    for (const m of notches) {
      expect(m.s1 - m.s0).toBeLessThanOrEqual(SIDE_JAMB.notch.rock.reduce((a, b) => Math.max(a, b), 0) + 1e-6);
      expect(walls.some((W0) => W0.zone === m.zone && (W0.dir > 0 ? Math.abs(m.s1 - W0.e) < 1e-3 : Math.abs(m.s0 - W0.e) < 1e-3))).toBe(true);
    }
    expect(Math.max(...Object.values(SIDE_JAMB.notch).flat())).toBeLessThanOrEqual(0.15);
  });
  it('a bracket under each rest against a wall', () => {
    const map = { premise: 'into the plant', zones: [{ run: 'across', screens: 1 }, { run: 'up', screens: 2, climb: 'chimney' }, { run: 'across', screens: 1 }] };
    const L = layoutSideMap(map, { reach, stature: 1.67 }), P = paintSideMap(L, dressSideMap(L, map, { seed: 4 }), { seed: 4 });
    const rests = L.rests.filter((r) => r.zone === 1), brackets = P.marks.filter((m) => m.what === 'bracket');
    for (const r of rests) expect(brackets.some((b) => b.z1 <= r.z - 0.39 && b.z1 >= r.z - 0.41)).toBe(true);
  });
});

describe('the backdrop', () => {
  it('at the foot hills and a range, at the top only a low horizon, inside none; each wider than its zone', () => {
    const map = { premise: 'up the volcano', zones: [{ run: 'across', screens: 2 }, { run: 'up', screens: 4, climb: 'ledges' }, { run: 'across', screens: 2 }, { room: [1, 1] }] };
    const { L, D } = all(map), B = backdropOf(L, D);
    expect(D.zones[0].backdrop).toBe('land');
    expect(D.zones[2].backdrop).toBe('sky');
    expect(B.filter((b) => b.zone === 0).map((b) => b.layer)).toEqual(['hills', 'range']);
    const top = B.filter((b) => b.zone === 2);
    expect(top.map((b) => b.layer)).toEqual(['range']);
    const lane2 = L.zones[1].exit[1];
    expect(Math.max(...top[0].rects.map((r) => r.z1))).toBeLessThan(lane2 + L.camera.lookH);
    expect(B.some((b) => D.zones[b.zone].indoor)).toBe(false);
    for (const b of B) expect(b.rects.at(-1).s1 - b.rects[0].s0).toBeGreaterThan(L.zones[b.zone].rect[1] - L.zones[b.zone].rect[0]);
    expect(BACKDROP.range.x).toBeLessThan(BACKDROP.hills.x);
  });
});
