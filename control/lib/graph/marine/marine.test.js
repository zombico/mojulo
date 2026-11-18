/**
 * What grows on a seabed and does not swim (marine/): the primitives' laws (a form is rooted, sized as its row says, moves
 * only where it is free, and is the same shape from the same seed), the roster's (a kind lives at its depth), the lay's
 * (the trail kept clear, what grows on a rock stands on it, the rocks kept under a budget) and the page's (absent, no byte).
 */
import { describe, expect, it } from 'vitest';

import { MARINE, MARINE_GROWS } from './forms.js';
import { MARINE_KINDS, MARINE_KIND_IDS, MARINE_MIXES, MARINE_OF_ZONE, MARINE_SEATS, MARINE_BUDGET, checkMarine, readMarine } from './roster.js';
import { MARINE_LAY, seabedGrid, placeMarine, templateOf, variantSeed } from './place.js';
import { marineInput, marineScript } from '../scene/channels/marine.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { readBiocube } from '../era/biocube.js';
import { sceneOfWords } from '../gameworld/scene-words.js';
import { SEA } from '../scene/channels/sea.js';

// one kind a way of growing, picked from the roster: a new kind is covered by the primitive it grows by
const BY_GROW = MARINE_GROWS.map((g) => MARINE_KIND_IDS.find((k) => MARINE_KINDS[k].grow === g));
const grown = (kind, v = 0) => { const t = templateOf(kind, v, 0); return { t, F: MARINE.form(t.grow, t) }; };
// a small bed: a 40 m square of half-metre... of one-metre quads, a trail two metres wide up its middle
const bed = (n = 40) => {
  const faces = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) faces.push({ corners: [[i, j, 0.1 * Math.sin(i / 5)], [i + 1, j, 0.1 * Math.sin((i + 1) / 5)], [i + 1, j + 1, 0.1 * Math.sin((i + 1) / 5)], [i, j + 1, 0.1 * Math.sin(i / 5)]], normal: [0, 0, 1], group: Math.abs(i - n / 2) < 1 ? 'isekai:trail' : 'isekai:sand' });
  return faces;
};

describe('the marine primitives', () => {
  it('every way of growing has a kind, and every kind a way and a seat', () => {
    expect(BY_GROW.every(Boolean)).toBe(true);
    for (const g of new Set(Object.values(MARINE_KINDS).map((K) => K.grow))) expect(MARINE_GROWS).toContain(g);
    for (const K of Object.values(MARINE_KINDS)) { expect(MARINE_SEATS).toContain(K.seat); expect(K.depth[0]).toBeLessThan(K.depth[1]); expect(K.colours.length).toBeGreaterThan(0); }
  });

  it('a form is rooted in the bed, stands as tall as its row says, and is all finite', () => {
    for (const kind of BY_GROW) {
      const { t, F } = grown(kind);
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < F.pos.length; i += 3) { expect(Number.isFinite(F.pos[i] + F.pos[i + 1] + F.pos[i + 2]), kind).toBe(true); lo = Math.min(lo, F.pos[i + 2]); hi = Math.max(hi, F.pos[i + 2]); }
      expect(lo, kind).toBeLessThanOrEqual(0);
      expect(hi, kind).toBeGreaterThan(t.h * 0.4);
      expect(hi, kind).toBeLessThan(t.h * 1.3);
      expect(F.tris, kind).toBe(F.idx.length / 3);
      expect(Math.max(...F.idx), kind).toBe(F.pos.length / 3 - 1);
      expect(F.col.every((c) => c >= 0 && c <= 1), kind).toBe(true);
    }
  });

  it('moves only where it is free: nothing sways at the bed, a rigid kind not at all, a free end by its row\'s sway', () => {
    for (const kind of BY_GROW) {
      const { t, F } = grown(kind), top = Math.max(...F.sway);
      for (let i = 0; i < F.sway.length; i++) if (F.pos[i * 3 + 2] <= 0) expect(F.sway[i], kind).toBeLessThan(1e-6);
      if (t.sway === 0) expect(top, kind).toBe(0);
      else { expect(top, kind).toBeGreaterThan(t.sway * 0.4); expect(top, kind).toBeLessThan(t.sway * 2.2); }
    }
  });

  it('is the same shape from the same seed, another from another', () => {
    const kind = BY_GROW[0], a = grown(kind).F, b = grown(kind).F, c = grown(kind, 1).F;
    expect(a.pos).toEqual(b.pos);
    expect(c.pos).not.toEqual(a.pos);
    expect(variantSeed(kind, 0)).not.toBe(variantSeed(kind, 1));
  });

  it('a rock\'s height is the function it was built from: what grows on it stands on it', () => {
    const { t, F } = grown('bommie');
    for (let i = 0; i < F.pos.length; i += 3) {
      const [x, y, z] = [F.pos[i], F.pos[i + 1], F.pos[i + 2]];
      if (z > 0) expect(MARINE.rockZ(t.seed, t.w / 2, t.h, x, y)).toBeCloseTo(z, 5);
    }
    expect(MARINE.rockZ(t.seed, t.w / 2, t.h, t.w * 2, 0)).toBe(0);
  });
});

describe('the marine roster', () => {
  it('reads a mix, true (its sea\'s zone\'s), or its settings; and refuses what it is not', () => {
    expect(checkMarine(undefined)).toBeNull();
    expect(checkMarine(false)).toBeNull();
    expect(checkMarine(true)).toEqual({ mix: null, density: 1, kinds: {} });
    const mix = MARINE_MIX_ID();
    expect(checkMarine(mix).mix).toBe(mix);
    expect(() => checkMarine('swamp')).toThrow(/flora.marine.mix is one of/);
    expect(() => checkMarine({ crowd: 2 })).toThrow(/flora.marine.crowd is not a setting/);
    expect(() => checkMarine({ density: 9 })).toThrow(/flora.marine.density/);
    expect(() => checkMarine({ kinds: { fish: 1 } })).toThrow(/not a marine kind/);
    expect(() => checkMarine(3)).toThrow(/flora.marine is a mix/);
  });

  it('grows what its sea\'s zone grows, each zone a mix of its own', () => {
    for (const zone of Object.keys(SEA.zones)) expect(MARINE_MIXES[MARINE_OF_ZONE[zone]], zone).toBeTruthy();
    const first = Object.keys(SEA.zones)[0], last = Object.keys(SEA.zones).at(-1);
    expect(readMarine(true, { zone: first, depth: SEA.zones[first].depth }).mix).toBe(MARINE_OF_ZONE[first]);
    expect(readMarine(true, { zone: last, depth: SEA.zones[last].depth }).mix).toBe(MARINE_OF_ZONE[last]);
    expect(readMarine(true).mix).toBe('reef');
  });

  it('leaves out what does not live at the depth, and says why: nothing that needs the sun in the dark', () => {
    // (the kind that lives shallowest, asked of the deepest water; and the deepest-living, of the shallowest)
    const sunny = MARINE_KIND_IDS.filter((k) => MARINE_KINDS[k].seat !== 'rock').reduce((m, k) => (MARINE_KINDS[k].depth[1] < MARINE_KINDS[m].depth[1] ? k : m));
    const deep = readMarine({ mix: 'reef', kinds: { [sunny]: 2 } }, { depth: SEA.range.depth[1] });
    expect(Object.values(deep.seats).some((S) => sunny in S)).toBe(false);
    expect(deep.left.find((l) => l.kind === sunny).why).toMatch(/lives under/);
    const dark = MARINE_KIND_IDS.reduce((m, k) => (MARINE_KINDS[k].depth[0] > MARINE_KINDS[m].depth[0] ? k : m));
    expect(readMarine({ kinds: { [dark]: 1 } }, { depth: 2 }).left.some((l) => l.kind === dark)).toBe(true);
    // (a kind weighed 0 is taken out; one the mix lacks joins its own seat; density crowds the bed)
    const K = Object.keys(MARINE_MIXES.reef.on)[0], cut = readMarine({ mix: 'reef', kinds: { [K]: 0 }, density: 2 }, { depth: 10 });
    expect(K in cut.seats.on).toBe(false);
    expect(cut.patches).toBeCloseTo(MARINE_MIXES.reef.patches * 2, 6);
    expect(readMarine({ mix: 'reef', kinds: { bommie: 0 } }).rock).toBe(0);
  });
});
const MARINE_MIX_ID = () => Object.keys(MARINE_MIXES)[1];

describe('the lay', () => {
  const grid = seabedGrid(bed()), comp = readMarine('reef', { zone: 'reef', depth: 14 });
  const placed = placeMarine(comp, grid, { seed: 3 });
  const each = (fn) => { for (const g of placed.groups) for (let i = 0; i < g.items.length; i += 7) fn(g, g.items.slice(i, i + 7)); };

  it('reads the land\'s ground and its trail', () => {
    expect(grid.cells.size).toBe(40 * 40);
    expect(grid.trail.size).toBeGreaterThan(0);
    expect(grid.z(3.5, 3.5)).toBeCloseTo(0.1 * (Math.sin(3 / 5) + Math.sin(4 / 5)) / 2, 5);
    expect(grid.z(-5, 3)).toBeNull();
  });

  it('lays rocks first, things on them and round them, stands and drifts; the trail kept clear', () => {
    expect(placed.count).toBeGreaterThan(40);
    expect(placed.readout.rocks).toBeGreaterThan(0);
    const seats = new Set();
    each((g, it) => {
      expect(g.items.length % 7).toBe(0);
      seats.add(MARINE_KINDS[g.kind].seat);
      // (the trail runs up x = 20, two metres wide: nothing nearer its edge than the clear, but what a rock carries over it)
      if (MARINE_KINDS[g.kind].seat !== 'on') expect(Math.abs(it[0] - 20), g.kind).toBeGreaterThan(MARINE_LAY.clear - 1.2);
      expect(it[4]).toBeGreaterThan(0.3);
    });
    for (const s of ['rock', 'on', 'foot', 'carpet']) expect(seats.has(s), s).toBe(true);
  });

  it('what grows on a rock stands on it: over the bed, never under it', () => {
    let on = 0;
    each((g, it) => { if (MARINE_KINDS[g.kind].seat !== 'on') return; on++; expect(it[2], g.kind).toBeGreaterThan(grid.z(it[0], it[1]) - 0.05); });
    expect(on).toBeGreaterThan(5);
  });

  it('is the same lay from the same seed, another from another; and on no ground, nothing', () => {
    expect(placeMarine(comp, grid, { seed: 3 })).toEqual(placed);
    expect(placeMarine(comp, grid, { seed: 4 }).groups).not.toEqual(placed.groups);
    expect(placeMarine(comp, seabedGrid([]), { seed: 3 }).count).toBe(0);
  });

  it('under the page\'s budget a crowded bed is thinned, its rocks kept', () => {
    const crowd = placeMarine(readMarine({ mix: 'reef', density: 3 }, { depth: 14 }), seabedGrid(bed(70)), { seed: 1 });
    expect(crowd.count).toBeLessThanOrEqual(MARINE_BUDGET.items);
    expect(crowd.tris).toBeLessThanOrEqual(MARINE_BUDGET.tris);
    expect(crowd.readout.thinned).toBeLessThan(1);
    expect(crowd.readout.kinds.bommie).toBe(crowd.readout.rocks);
  });
});

describe('the seabed, composed', () => {
  it('the seabed biocube is the desert\'s baseline with the surface world taken out and the bed\'s own flora laid', () => {
    const B = readBiocube('seabed');
    expect(B.flora).toMatchObject({ grass: null, shrubs: null, flowers: null, marine: true });
    expect(B.flora.trees.clusters).toBe(0);
    expect(readBiocube({ from: 'seabed', flora: { marine: { mix: 'kelp' } } }).flora.marine).toEqual({ mix: 'kelp' });
    expect(() => readBiocube({ from: 'seabed', flora: { marine: 'lawn' } })).toThrow(/biocube: flora.marine.mix/);
    // (a preset that names no marine carries none: it reads as it did)
    expect('marine' in readBiocube('desert').flora).toBe(false);
  });

  it('a scene\'s words put it under the sea: the bed\'s biome, its dunes, the water by the word\'s depth', () => {
    const S = sceneOfWords('an underwater reef');
    expect(S.sea).toBe('reef');
    expect(S.cube).toMatchObject({ biocube: { from: 'seabed' }, outside: { cliff: false, dunes: { supply: 1 } }, colour: { grass: expect.any(String) } });
    expect(sceneOfWords('the abyss').sea).toBe('midnight');
    expect(sceneOfWords('a grassy field').sea).toBeUndefined();
  });

  it('is on the page only when laid, its templates grown there from the kernel', () => {
    const placed = placeMarine(readMarine('reef', { depth: 14 }), seabedGrid(bed()), { seed: 3 }), cfg = marineInput(placed, { sun: [0.3, 0.2, 0.9] });
    expect(marineInput({ groups: [], count: 0 })).toBeNull();
    expect(Math.hypot(...cfg.light.dir)).toBeCloseTo(1, 3);
    const src = marineScript(cfg);
    expect(() => new Function('THREE', 'scene', 'renderer', src)).not.toThrow();
    for (const s of ['function marineKernel()', 'THREE.InstancedMesh', 'aSway', 'window.__mojMarine']) expect(src).toContain(s);
    const face = { corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], normal: [0, 0, 1], fill: '#888888' };
    expect(emitThreeWorld({ faces: [face], marine: cfg })).toContain('channels/marine.js');
    expect(emitThreeWorld({ faces: [face] })).not.toContain('channels/marine.js');
    expect(emitThreeWorld({ faces: [face] })).toBe(emitThreeWorld({ faces: [face], marine: null }));
  });
});
