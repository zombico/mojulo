// wind — the terrain's opt-in `wind`: validation, the bend table (the elastica under a sideways load), and the page.
import { describe, it, expect } from 'vitest';
import { validateTerrainWind, resolveTerrainWind, bendTable, windPageChannel, grassTaker, naturalFrequency, windField, debrisKernel, WIND_TAKERS, TERRAIN_WIND_DEFAULTS, WIND_DEBRIS_DEFAULTS } from './wind.js';
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

describe('the field', () => {
  const W = { speed: 6, dir: 0, gust: 0.8, scale: 8, evolve: 30, veer: 0.35, seed: 3, z0: 0.05 };
  it('the same seed the same gusts; another seed others; no speed, no wind', () => {
    expect(windField(W).at(3, 4, 1, 2)).toEqual(windField({ ...W }).at(3, 4, 1, 2));
    expect(windField(W).at(3, 4, 1, 2)).not.toEqual(windField({ ...W, seed: 4 }).at(3, 4, 1, 2));
    expect(windField({ ...W, speed: 0 }).at(3, 4, 1, 2)).toEqual([0, 0, 0]);
  });
  it('a gust arrives d/speed seconds later d metres downwind (frozen turbulence)', () => {
    const F = windField(W), dt = 0.05, A = [], B = [];
    for (let t = 0; t < 60; t += dt) { A.push(Math.hypot(...F.at(0, 0, 2, t))); B.push(Math.hypot(...F.at(12, 0, 2, t))); }
    const mean = (s) => s.reduce((a, b) => a + b) / s.length, ma = mean(A), mb = mean(B); let best = -Infinity, lag = 0;
    for (let L = 0; L < 80; L++) { let c = 0; for (let i = 0; i + L < A.length; i++) c += (A[i] - ma) * (B[i + L] - mb); c /= A.length - L; if (c > best) { best = c; lag = L * dt; } }
    expect(Math.abs(lag - 2)).toBeLessThanOrEqual(0.1);
  });
  it('weaker near the ground, and gusty: the speed spreads about the mean', () => {
    const F = windField(W); let lo = 0, hi = 0, min = Infinity, max = 0;
    // sample points that do not ride with the gusts (x − speed·t keeps moving)
    for (let i = 0; i < 400; i++) { const x = i * 7.3, t = i * 0.13; lo += Math.hypot(...F.at(x, 0, 0.1, t).slice(0, 2)); const s = Math.hypot(...F.at(x, 0, 2, t).slice(0, 2)); hi += s; min = Math.min(min, s); max = Math.max(max, s); }
    expect(lo).toBeLessThan(0.5 * hi); expect(hi / 400).toBeGreaterThan(4); expect(hi / 400).toBeLessThan(8); expect(max - min).toBeGreaterThan(4);
  });
});

describe('debris', () => {
  const W = { speed: 9, dir: 0, gust: 0.6, scale: 8, evolve: 6, veer: 0.35, seed: 3, z0: 0.05 }, flat = () => 0;
  const run = (phi, w = W, secs = 20) => { const F = windField(w), D = debrisKernel({ leaves: 60, dust: 60, radius: 40, phi, seed: 3 }, F.at, flat); D.place(0, 0); const x0 = D.x.slice(), y0 = D.y.slice(); for (let i = 0; i < secs * 60; i++) D.step(1 / 60, i / 60, 0, 0); return { D, x0, y0 }; };
  const moved = ({ D, x0, y0 }, k) => { let n = 0; for (let i = 0; i < D.n; i++) if (D.kind[i] === k && (D.x[i] !== x0[i] || D.y[i] !== y0[i])) n++; return n; };
  it('φ = 0 and still air leave it where it lay', () => {
    for (const r of [run(0), run(1, { ...W, speed: 0 })]) { expect([...r.D.x]).toEqual([...r.x0]); expect([...r.D.y]).toEqual([...r.y0]); expect([...r.D.z].every((z) => z === 0)).toBe(true); }
  });
  it('a gust lifts dust before leaves; all of it stays within reach, on or above the ground, the same twice', () => {
    const r = run(1, { ...W, speed: 5 }, 10); expect(moved(r, 1)).toBeGreaterThan(moved(r, 0)); expect(moved(r, 0)).toBeGreaterThan(0);
    for (let i = 0; i < r.D.n; i++) { expect(Math.hypot(r.D.x[i], r.D.y[i])).toBeLessThanOrEqual(40.5); expect(r.D.z[i]).toBeGreaterThanOrEqual(0); }
    expect([...run(1, { ...W, speed: 5 }, 10).D.x]).toEqual([...r.D.x]);
  });
  it('petals come from crowns in bloom: none show without one, a gust releases them, φ = 0 holds them on the tree', () => {
    const mk = (phi, w = W) => { const F = windField(w), D = debrisKernel({ leaves: 0, dust: 0, petals: 200, radius: 40, phi, seed: 5 }, F.at, flat); D.place(0, 0); return { D, F }; };
    const count = (D) => { let held = 0, aloft = 0, lying = 0; for (let i = 0; i < D.n; i++) { if (D.held[i]) held++; else if (D.z[i] > D.gz[i] + 0.01) aloft++; else lying++; } return { held, aloft, lying }; };
    const bare = mk(1); for (let i = 0; i < 300; i++) bare.D.step(1 / 60, i / 60, 0, 0); expect(count(bare.D).held).toBe(200);
    const tree = [[0, 0, 4.5, 3.5, 2]], g = mk(1); g.D.setSources(tree); expect(count(g.D).lying).toBe(80);   // two in five are the carpet
    for (let i = 0; i < 600; i++) g.D.step(1 / 60, i / 60, 0, 0); const c = count(g.D); expect(c.aloft + c.lying).toBeGreaterThan(80); expect(c.held).toBeLessThan(120);
    for (let i = 0; i < g.D.n; i++) expect(g.D.z[i]).toBeGreaterThanOrEqual(0);
    const still = mk(0); still.D.setSources(tree); for (let i = 0; i < 600; i++) still.D.step(1 / 60, i / 60, 0, 0); expect(count(still.D)).toEqual({ held: 120, aloft: 0, lying: 80 });
  });
  it('a breeze too light to lift a leaf leaves the leaves', () => { const r = run(1, { ...W, speed: 2, gust: 0.2 }); expect(moved(r, 0)).toBe(0); });
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
    expect(p.meta.wind).toEqual({ speed: 8, dir: 0, gust: 0.5, flaccidity: { grass: 1, plants: 0.5, debris: 1 } });
    expect(p.terrain.wind.debris).toEqual({ ...WIND_DEBRIS_DEFAULTS, phi: 1, petals: 0 });   // nothing here blooms
    expect(p.terrain.wind.grass.map((t) => t.B)).toEqual([5, 1.25]);
    expect(p.terrain.wind.plants.every((t) => t.phi === 0.5)).toBe(true);
    const js = terrainChannelScript(p.terrain);
    expect(js.indexOf('const WIND = ')).toBeGreaterThan(0); expect(js.indexOf('const WIND = ')).toBeLessThan(js.indexOf('const PLANTS = '));
    expect(js).toContain('SP_OF'); expect(js).toContain('TW.wind.material(p.mat'); expect(js).toContain('function debrisKernel');
    expect(() => new Function('THREE', 'scene', 'camera', 'walkColliders', js)).not.toThrow();   // eslint-disable-line no-new-func
    expect(assembleTerrainWorld({ ...W, grass: true, wind: true }, { live: false }).meta.wind).toBeUndefined();
  }, 120_000);
  it('with nothing to bend, no wind is emitted', () => {
    expect(assembleTerrainWorld({ ...W, wind: true }, { live: true }).terrain.wind).toBeUndefined();
  }, 60_000);
  it('validation teaches', () => {
    expect(validateTerrainWind(true)).toEqual([]);
    expect(validateTerrainWind({ speed: 40 })[0]).toMatch(/speed must be 0–30/);
    expect(validateTerrainWind({ flaccidity: { rocks: 1 } })[0]).toMatch(/flaccidity must be \{ grass\?, plants\?, debris\? \}/);
    expect(validateTerrainWind({ flaccidity: { grass: 2 } })[0]).toMatch(/flaccidity.grass must be 0–1/);
    expect(validateTerrainWind(true, { planet: true })[0]).toMatch(/flat worlds/);
    expect(validateTerrainWind('breezy')[0]).toMatch(/must be true or/);
    expect(resolveTerrainWind({ speed: 3, flaccidity: { grass: 0.4 } })).toEqual({ ...TERRAIN_WIND_DEFAULTS, speed: 3, flaccidity: { grass: 0.4, plants: 1, debris: 1 }, debris: WIND_DEBRIS_DEFAULTS });
    expect(resolveTerrainWind({ debris: false }).debris).toBeNull(); expect(resolveTerrainWind({ debris: { leaves: 0, dust: 0, petals: 0 } }).debris).toBeNull();
    expect(validateTerrainWind({ debris: { leaves: 1.5 } })[0]).toMatch(/leaves must be an integer 0–3000/);
    expect(validateTerrainWind({ debris: { pebbles: 3 } })[0]).toMatch(/debris must be true, false or/);
    expect(resolveTerrainWind(false)).toBeNull();
  });
  it('the page channel carries degrees as radians and every kind its flaccidity', () => {
    const c = windPageChannel(resolveTerrainWind({ dir: 90, veer: 30 }), { grassKinds: ['meadow'], plantKinds: ['palm', 'mystery'] });
    expect(c.dir).toBeCloseTo(Math.PI / 2, 12); expect(c.veer).toBeCloseTo(Math.PI / 6, 12);
    expect(c.plants[0]).toEqual({ ...WIND_TAKERS.palm, phi: 1 }); expect(c.plants[1]).toEqual({ ...WIND_TAKERS.tree, phi: 1 });
  });
});

describe('a cherry grove', () => {
  it('the cherry grows in bloom: its crown is blossom, its twigs dark', async () => {
    const { plantPool } = await import('./pool.js');
    const faces = plantPool({ species: 'cherry', variants: 1 }).variants[0].levels.L2; let pink = 0, green = 0;
    for (const f of faces) { const r = parseInt(f.fill.slice(1, 3), 16), g = parseInt(f.fill.slice(3, 5), 16); if (r > g + 20) pink++; else if (g > r) green++; }
    expect(pink).toBeGreaterThan(faces.length / 4); expect(green).toBe(0);
  }, 60_000);
  it('plants.kinds replaces the climate\'s trees; the page gives petals only where a tree blooms', async () => {
    const { validateTerrainPlants } = await import('../terrain/terrain-plants.js');
    expect(validateTerrainPlants({ kinds: ['cherry'] }, { world: {} })).toEqual([]);
    expect(validateTerrainPlants({ kinds: ['sakura'] }, { world: {} })[0]).toMatch(/kinds must be a list of species: .*cherry/);
    const W = { kind: 'terrain', world: { features: [{ feature: 'river' }], climate: 'temperate', seed: 'vale' } };
    const p = assembleTerrainWorld({ ...W, plants: { kinds: ['cherry'] }, wind: true }, { live: true });
    expect(p.meta.plants.species).toEqual(['cherry', 'reed']); expect(p.terrain.wind.debris.bloom).toEqual([1, 0]); expect(p.terrain.wind.debris.petals).toBe(WIND_DEBRIS_DEFAULTS.petals);
    expect(assembleTerrainWorld({ ...W, plants: true, wind: true }, { live: true }).terrain.wind.debris.petals).toBe(0);
  }, 180_000);
});
