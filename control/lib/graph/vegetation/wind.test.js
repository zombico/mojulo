// wind — the terrain's opt-in `wind`: validation, the bend table (the elastica under a sideways load), and the page.
import { describe, it, expect } from 'vitest';
import { validateTerrainWind, resolveTerrainWind, bendTable, windPageChannel, grassTaker, naturalFrequency, WIND_TAKERS, TERRAIN_WIND_DEFAULTS } from './wind.js';
import { elastica } from './mechanics.js';
import { assembleTerrainWorld } from '../terrain/terrain-world.js';
import { terrainChannelScript } from '../scene/channels/terrain-lod.js';

describe('the bend table', () => {
  const T = bendTable(), at = (i, k, b) => { const o = ((b * T.NS + k) * T.NR + i) * 2; return [T.data[o], T.data[o + 1]]; };
  it('no load, no change, at any B', () => {
    for (let b = 0; b < T.NB; b++) for (let k = 0; k < T.NS; k++) for (const v of at(0, k, b)) expect(v).toBe(0);
  });
  it('more load bends further downwind and lower, and the stem keeps its length', () => {
    for (let b = 0; b < T.NB; b++) {
      let last = [0, 0];
      for (let i = 1; i < T.NR; i++) {
        const [h, v] = at(i, T.NS - 1, b);
        expect(h).toBeGreaterThan(last[0] - 1e-6); expect(v).toBeLessThan(last[1] + 1e-4);   // the drop saturates as the stem lies along the load
        expect(Math.hypot(h, 1 + v)).toBeLessThanOrEqual(1 + 1e-6);   // the tip is never farther from the root than the stem is long
        last = [h, v];
      }
    }
  });
  it('is the production elastica, rotated into the load', () => {
    const i = 7, b = 9, R = Math.expm1((i / (T.NR - 1)) * Math.log1p(T.R_MAX)), B = Math.expm1((b / (T.NB - 1)) * Math.log1p(T.B_MAX)), m = Math.hypot(1, R);
    const [x, y] = elastica({ B: B * m, theta0: Math.asin(1 / m), n: 64 }).tip, [x0, y0] = elastica({ B, theta0: Math.PI / 2, n: 64 }).tip, [h, v] = at(i, T.NS - 1, b);
    expect(h).toBeCloseTo((x - y * R) / m - x0, 6); expect(v).toBeCloseTo((x * R + y) / m - y0, 6);   // the table is Float32
  });
  it('the same bytes twice', () => { expect(Buffer.from(bendTable().data.buffer).equals(Buffer.from(T.data.buffer))).toBe(true); });
});

describe('takers', () => {
  it('a grass kind takes its blades\' middle B; trees sway slower than grass', () => {
    expect(grassTaker('tussock').B).toBe(5); expect(grassTaker('fescue').B).toBe(1.25);
    for (const k of ['fescue', 'meadow', 'tussock', 'needlegrass', 'sedge', 'fountain', 'pampas', 'lawn', 'elephant']) expect(grassTaker(k).B).toBeLessThan(7.84);   // Greenhill: below it an upright stem stands
    expect(naturalFrequency(WIND_TAKERS.tree.B, 12)).toBeLessThan(naturalFrequency(grassTaker('meadow').B, 0.6));
  });
});

describe('terrain: wind is opt-in', () => {
  const W = { kind: 'terrain', world: { features: [{ feature: 'river' }], climate: 'temperate', seed: 'vale' } };
  it('absent, the page carries no wind and its grass no wind hooks', () => {
    const p = assembleTerrainWorld({ ...W, grass: true }, { live: true }); expect(p.terrain.wind).toBeUndefined(); expect(p.meta.wind).toBeUndefined();
    const js = terrainChannelScript(p.terrain); expect(js).not.toContain('const WIND'); expect(js).not.toContain('SP_OF'); expect(js).not.toContain('TW.wind');
  }, 60_000);
  it('present, the wind script comes before the grass and plants, which bend in it; it parses; exports carry none', () => {
    const p = assembleTerrainWorld({ ...W, grass: { kinds: ['tussock', 'fescue'] }, plants: true, wind: { speed: 8, flaccidity: { plants: 0.5 } } }, { live: true });
    expect(p.meta.wind).toEqual({ speed: 8, dir: 0, gust: 0.5, flaccidity: { grass: 1, plants: 0.5 } });
    expect(p.terrain.wind.grass.map((t) => t.B)).toEqual([5, 1.25]);
    expect(p.terrain.wind.plants.every((t) => t.phi === 0.5)).toBe(true);
    const js = terrainChannelScript(p.terrain);
    expect(js.indexOf('const WIND = ')).toBeGreaterThan(0); expect(js.indexOf('const WIND = ')).toBeLessThan(js.indexOf('const PLANTS = '));
    expect(js).toContain('SP_OF'); expect(js).toContain('TW.wind.material(p.mat');
    expect(() => new Function('THREE', 'scene', 'camera', 'walkColliders', js)).not.toThrow();   // eslint-disable-line no-new-func
    expect(assembleTerrainWorld({ ...W, grass: true, wind: true }, { live: false }).meta.wind).toBeUndefined();
  }, 120_000);
  it('with nothing to bend, no wind is emitted', () => {
    expect(assembleTerrainWorld({ ...W, wind: true }, { live: true }).terrain.wind).toBeUndefined();
  }, 60_000);
  it('validation teaches', () => {
    expect(validateTerrainWind(true)).toEqual([]);
    expect(validateTerrainWind({ speed: 40 })[0]).toMatch(/speed must be 0–30/);
    expect(validateTerrainWind({ flaccidity: { rocks: 1 } })[0]).toMatch(/flaccidity must be \{ grass\?, plants\? \}/);
    expect(validateTerrainWind({ flaccidity: { grass: 2 } })[0]).toMatch(/flaccidity.grass must be 0–1/);
    expect(validateTerrainWind(true, { planet: true })[0]).toMatch(/flat worlds/);
    expect(validateTerrainWind('breezy')[0]).toMatch(/must be true or/);
    expect(resolveTerrainWind({ speed: 3, flaccidity: { grass: 0.4 } })).toEqual({ ...TERRAIN_WIND_DEFAULTS, speed: 3, flaccidity: { grass: 0.4, plants: 1 } });
    expect(resolveTerrainWind(false)).toBeNull();
  });
  it('the page channel carries degrees as radians and every kind its flaccidity', () => {
    const c = windPageChannel(resolveTerrainWind({ dir: 90, veer: 30 }), { grassKinds: ['meadow'], plantKinds: ['palm', 'mystery'] });
    expect(c.dir).toBeCloseTo(Math.PI / 2, 12); expect(c.veer).toBeCloseTo(Math.PI / 6, 12);
    expect(c.plants[0]).toEqual({ ...WIND_TAKERS.palm, phi: 1 }); expect(c.plants[1]).toEqual({ ...WIND_TAKERS.tree, phi: 1 });
  });
});
