// grass — the tuft primitive and its kinds, the grass kernel's placement, and the terrain's opt-in `grass`.
import { describe, it, expect } from 'vitest';
import { GRASSES, grassTuft, grassLadder, volumeLit, stylize } from './grass.js';
import { trisToFaces } from './pool.js';
import { grassKernel } from '../terrain/grass-kernel.js';
import { grassConfig, grassKernelOf, validateTerrainGrass, resolveTerrainGrass, TERRAIN_GRASS_DEFAULTS } from '../terrain/terrain-grass.js';
import { plantsConfig, plantsKernel } from '../terrain/terrain-plants.js';
import { atlasField } from '../terrain/terrain-atlas.js';
import { assembleTerrainWorld } from '../terrain/terrain-world.js';
import { terrainChannelScript } from '../scene/channels/terrain-lod.js';

describe('the tuft', () => {
  it('every kind grows a ladder that thins level by level, at unit height, the same bytes twice', () => {
    for (const kind of Object.keys(GRASSES)) {
      const lad = grassLadder(kind, { seed: 3 });
      expect(lad.L2.length).toBeGreaterThan(lad.L1.length); expect(lad.L1.length).toBeGreaterThan(lad.L0.length); expect(lad.LF.length).toBe(3);
      const top = Math.max(...lad.L2.flatMap((t) => t.p.map((p) => p[2]))); expect(top).toBeGreaterThan(0.7); expect(top).toBeLessThan(1.35);
      expect(JSON.stringify(grassLadder(kind, { seed: 3 }))).toBe(JSON.stringify(lad));
    }
  });
  it('a recipe may retune a kind’s form and colours', () => {
    const a = grassTuft('meadow', { seed: 1 }), b = grassTuft('meadow', { seed: 1, over: { colors: { base: [200, 40, 40] } } });
    expect(a.length).toBe(b.length); expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
  it('is lit as one volume: normals out of the heart and up, the base darker', () => {
    const lit = volumeLit(grassTuft('tussock', { seed: 2 }));
    for (const t of lit) expect(t.n[2]).toBeGreaterThan(0.3);
    const low = lit.filter((t) => t.p[0][2] < 0.05), high = lit.filter((t) => t.p[0][2] > 0.5);
    const lum = (ts) => ts.reduce((s, t) => s + t.c[0] + t.c[1] + t.c[2], 0) / ts.length;
    expect(lum(low)).toBeLessThan(lum(high));
  });
  it('the World faces keep a tri’s own normal, and a tri without one is lit as before', () => {
    const t = { p: [[0, 0, 0], [1, 0, 0], [0, 0, 1]], c: [100, 150, 80], kind: 'leaf' };
    expect(trisToFaces([t])[0].outNormal).toEqual(trisToFaces([{ ...t }])[0].outNormal);
    expect(trisToFaces([{ ...t, n: [0, 0, 1] }])[0].outNormal).toEqual([0, 0, 1]);
  });
});

describe('short grass and the stylized style', () => {
  it('short grass is turf: short, dense, no heads, placed as plugs', () => {
    expect(GRASSES.lawn.habit).toBe('turf'); expect(GRASSES.lawn.heights[1]).toBeLessThan(0.2); expect(GRASSES.lawn.culms).toBe(0);
    const f = atlasField({ world: { features: [{ feature: 'river' }], climate: 'temperate', seed: 'vale' } }); const V = grassConfig(f, resolveTerrainGrass({ kinds: ['lawn'] })); const P = grassKernelOf(f, V);
    let n = 0; for (let x = -600; x < 600; x += 80) n += P.plantsIn(x, 40, 16).length / 9; expect(n).toBeGreaterThan(50);
  });
  it('stylized: any kind, blades lit as the ground (normals up), more saturated, no heads unless a plume', () => {
    for (const kind of Object.keys(GRASSES)) {
      const lad = grassLadder(kind, { seed: 2, style: 'stylized' }); for (const t of lad.L2) expect(t.n[2]).toBeCloseTo(1, 6);
      const S = stylize(GRASSES[kind]); if (GRASSES[kind].head !== 'plume') expect(S.culms).toBe(0);
      const spread = (c) => Math.max(...c) - Math.min(...c); expect(spread(S.colors.tip)).toBeGreaterThanOrEqual(spread(GRASSES[kind].colors.tip));
    }
    expect(JSON.stringify(grassLadder('meadow', { seed: 2 }))).not.toBe(JSON.stringify(grassLadder('meadow', { seed: 2, style: 'stylized' })));
  });
  it('the natural style is the default: the same bytes with or without naming it', () => {
    expect(JSON.stringify(grassLadder('tussock', { seed: 4, style: 'natural' }))).toBe(JSON.stringify(grassLadder('tussock', { seed: 4 })));
  });
});

describe('the grass kernel', () => {
  const temperate = atlasField({ world: { features: [{ feature: 'river' }], climate: 'temperate', seed: 'vale' } });
  const V = grassConfig(temperate, TERRAIN_GRASS_DEFAULTS), P = grassKernelOf(temperate, V), S = temperate.atlas.span;
  const sample = (P, f, n = 120) => { let a = 5; const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; const out = []; for (let k = 0; k < n; k++) out.push(P.plantsIn((rnd() - 0.5) * 0.5 * f.atlas.span, (rnd() - 0.5) * 0.5 * f.atlas.span, 16)); return out; };
  it('places the same tufts whoever computes it, packed nine numbers a tuft', () => {
    const a = P.plantsIn(100, 200, 16), b = grassKernel(V, temperate.kernel).plantsIn(100, 200, 16); expect(a).toEqual(b); expect(a.length % 9).toBe(0);
  });
  it('stands in patches, not a carpet, and never on water or graded ground; hardly under wood', () => {
    const Pv = plantsKernel(temperate, plantsConfig(temperate)); const tiles = sample(P, temperate); let under = 0, n = 0;
    expect(tiles.filter((t) => t.length).length / tiles.length).toBeLessThan(0.85);
    for (const a of tiles) for (let q = 0; q < a.length; q += 9) { n++; const st = Pv.standAt(a[q], a[q + 1]); expect(st.why).not.toBe('water'); expect(st.why).not.toBe('graded'); if (st.ok && st.canopy > 0.6) under++; }
    expect(n).toBeGreaterThan(100); expect(under / n).toBeLessThan(0.08);
  });
  it('a clump shares its tint and leans; lean stays small', () => {
    for (const a of sample(P, temperate, 30)) for (let q = 0; q < a.length; q += 9) { expect(a[q + 6]).toBeGreaterThanOrEqual(0); expect(a[q + 6]).toBeLessThanOrEqual(9); expect(a[q + 7]).toBeLessThan(20); }
  });
  it('the climate picks the kinds: a tropical lowland grows tall grass, arid country needlegrass', () => {
    const kinds = (world) => { const f = atlasField({ world }); const Vf = grassConfig(f, TERRAIN_GRASS_DEFAULTS); const got = new Set(); for (const a of sample(grassKernelOf(f, Vf), f)) for (let q = 0; q < a.length; q += 9) if (a[q + 2] < 500) got.add(Vf.species[a[q + 4]].name); return got; };
    expect(kinds({ features: [{ feature: 'volcano' }], climate: 'tropical', seed: 'kinabalu' }).has('elephant')).toBe(true);
    expect(kinds({ features: [{ feature: 'river' }], climate: 'arid', seed: 'nile' }).has('needlegrass')).toBe(true);
  });
});

describe('terrain: grass is opt-in', () => {
  const W = { kind: 'terrain', world: { features: [{ feature: 'river' }], climate: 'temperate', seed: 'vale' } };
  it('absent, the page carries no grass', () => {
    const p = assembleTerrainWorld(W, { live: true }); expect(p.terrain.grass).toBeUndefined(); expect(terrainChannelScript(p.terrain)).not.toContain('const GRASS');
  });
  it('present, the page carries its own script and it parses; exports carry none', () => {
    const p = assembleTerrainWorld({ ...W, grass: { kinds: ['fountain', 'fescue'] } }, { live: true });
    expect(p.meta.grass.kinds).toEqual(['fountain', 'fescue']);
    const js = terrainChannelScript(p.terrain); expect(js).toContain('const GRASS = ');
    expect(() => new Function('THREE', 'scene', 'camera', 'walkColliders', js)).not.toThrow();   // eslint-disable-line no-new-func
    expect(assembleTerrainWorld({ ...W, grass: true }, { live: false }).meta.grass).toBeUndefined();
  });
  it('validation teaches', () => {
    expect(validateTerrainGrass(true, { world: {} })).toEqual([]);
    expect(validateTerrainGrass({ kinds: ['bluegrass'] }, { world: {} })[0]).toMatch(/grass kinds: fescue/);
    expect(validateTerrainGrass(true, {})[0]).toMatch(/composed world/);
    expect(resolveTerrainGrass({ radius: 40 }).radius).toBe(40);
    expect(resolveTerrainGrass({ style: 'stylized' }).density).toBe(5); expect(resolveTerrainGrass({ style: 'stylized', density: 2 }).density).toBe(2);
    expect(validateTerrainGrass({ style: 'anime' }, { world: {} })[0]).toMatch(/style must be one of natural, stylized/);
  });
});
