/**
 * Where a terrain world's plants stand. Claims under test: on a ground rising a metre per metre eastward, broadleaves
 * grow low, the conifer toward the treeline, nothing past it, and trees shorten as they near it (the temperature law is
 * pinned to the climate's own treeline); no plant stands on water, a city's graded ground, bare rock or the painter's
 * sand; a stand's crowns cover what the painter shows as wood; the stand is spread, not clumped; tiles partition the
 * plants exactly, and the page computes the same plants from what it carries; palms keep to a tropical coast and an arid
 * river, clumping bamboo stands in clumps whose outer culms lean out; a tropical mountain is forested to its treeline,
 * its species by altitude; a region grows its own conifers (northern Eurasia: spruce throughout and pine on the dry
 * ground; the Alps: beech low, silver fir, spruce to the treeline), absent it is exactly the climate's own; the manifest
 * teaches.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { vegetationKernel, PER } from './vegetation-kernel.js';
import { plantsConfig, plantsKernel, validateTerrainPlants, PLANT_CLIMATES, PLANT_REGIONS, LAPSE, TREELINE_T } from './terrain-plants.js';
import { atlasField, decodeDeep } from './terrain-atlas.js';
import { atlasKernel } from './atlas-kernel.js';
import { plantPool } from '../vegetation/pool.js';

const plants = (out) => { const r = []; for (let q = 0; q < out.length; q += PER) r.push({ x: out[q], y: out[q + 1], z: out[q + 2], h: out[q + 3], s: out[q + 4], pick: out[q + 5], age: out[q + 6], lean: out[q + 7], az: out[q + 8] }); return r; };
// a synthetic ground: height z(X, Y), fully wooded unless `cover` says otherwise, flat unless `bare`
const ground = ({ z = (X) => X, cover = () => 1, bare = () => 0, water = () => null, grade = () => null, river = () => null } = {}) => ({
  landAt: (X, Y) => [z(X, Y), bare(X, Y), river(X, Y), water(X, Y), cover(X, Y), 0.5],
  gradeAt: grade, normalAt: () => [0, 0, 1], gridAt: (X, Y) => z(X, Y), groundAt: (X, Y) => z(X, Y),
});
const temperate = (over = {}) => ({ ...plantsConfig({ K: { zones: { tree: 1900, snow: 3100 }, seaLevel: null }, atlas: { climate: 'temperate' } }), ...over });

describe('the temperature law and the species by zone', () => {
  const V = temperate(), P = vegetationKernel(V, ground());
  const all = plants(P.plantsIn(0, 0, 2600)).filter((p) => V.species[p.s].name !== 'reed');
  const name = (p) => V.species[p.s].name;
  it("pins the treeline to the climate's own: T0 = the treeline temperature + the lapse over the treeline's height", () => {
    expect(V.T0).toBeCloseTo(TREELINE_T + (LAPSE * 1900) / 1000, 9);
  });
  it('grows broadleaves low, the conifer toward the treeline, nothing past it', () => {
    // (a species' range has soft edges, 1.5 °C either side: an oak reaches about 1,450 m, a fir comes down to 900 m)
    const low = all.filter((p) => p.z < 900), high = all.filter((p) => p.z > 1500 && p.z < 1700);
    expect(low.length).toBeGreaterThan(100); expect(low.every((p) => name(p) === 'oak' || name(p) === 'beech')).toBe(true);
    expect(high.length).toBeGreaterThan(50); expect(high.every((p) => name(p) === 'fir')).toBe(true);
    expect(all.reduce((m, p) => (p.z > m ? p.z : m), -Infinity)).toBeLessThan(1.1 * 1900);
  });
  it('shortens its trees toward the treeline', () => {
    const rel = (p) => p.h / (0.5 * (V.species[p.s].h[0] + V.species[p.s].h[1]));
    const mean = (a) => a.reduce((s, p) => s + rel(p), 0) / a.length;
    const firs = all.filter((p) => name(p) === 'fir'); const lowF = firs.filter((p) => p.z < 1300), highF = firs.filter((p) => p.z > 1600);
    expect(mean(highF)).toBeLessThan(0.8 * mean(lowF));
  });
});

describe('where no plant stands', () => {
  const V = temperate();
  it('not on water, not on graded ground, not on bare rock, not on the painted shore', () => {
    const G = ground({
      z: () => 100, water: (X) => (X < 200 ? 101 : null), grade: (X) => (X > 800 && X < 1000 ? [100, 1, 0] : null), bare: (X) => (X > 1200 && X < 1400 ? 1 : 0),
      river: (X) => (X >= 200 && X < 260 ? [X - 150, 50, 99.5, 30] : null),
    });
    const got = plants(vegetationKernel(V, G).plantsIn(0, 0, 1600)).filter((p) => V.species[p.s].name !== 'reed');
    expect(got.length).toBeGreaterThan(1000);
    for (const p of got) { expect(p.x >= 200).toBe(true); expect(p.x > 800 && p.x < 1000).toBe(false); expect(p.x > 1200 && p.x < 1400).toBe(false); }
    // the painter's sand at the water's edge thins the stand there (it mixes sand in, up to 88%)
    expect(got.filter((p) => p.x >= 200 && p.x < 204).length).toBeLessThan(0.5 * got.filter((p) => p.x >= 230 && p.x < 234).length);
  });
});

describe('a stand', () => {
  const V = temperate();
  it("covers what the painter shows as wood, and is spread, not clumped", () => {
    for (const c of [0, 0.1]) {                                                           // cover −0.25 … 0.35 → canopy 0 … 1
      const cover = () => c, want = (() => { const t = Math.min(1, Math.max(0, (c + 0.25) / 0.6)); return t * t * (3 - 2 * t); })();
      const got = plants(vegetationKernel(V, ground({ z: () => 100, cover })).plantsIn(0, 0, 1000)).filter((p) => V.species[p.s].name !== 'reed');
      const crowns = got.reduce((s, p) => s + Math.PI * (0.5 * V.species[p.s].crown * p.h) ** 2, 0) / 1e6;
      expect(Math.abs(crowns - want)).toBeLessThan(0.1);
      if (got.length > 200) {
        const nn = got.slice(0, 400).map((p) => Math.min(...got.filter((q) => q !== p).map((q) => Math.hypot(q.x - p.x, q.y - p.y))));
        const R = nn.reduce((a, b) => a + b, 0) / nn.length / (0.5 / Math.sqrt(got.length / 1e6));
        expect(R).toBeGreaterThan(0.95); expect(R).toBeLessThan(1.6);
      }
    }
  });
  it('tiles partition the plants exactly, whoever computes them', () => {
    const P = vegetationKernel(V, ground({ z: (X, Y) => 300 + 0.2 * X - 0.1 * Y }));
    const whole = plants(P.plantsIn(-256, 128, 256)).map((p) => JSON.stringify(p)).sort();
    const parts = [[-256, 128], [-128, 128], [-256, 256], [-128, 256]].flatMap(([x, y]) => plants(P.plantsIn(x, y, 128))).map((p) => JSON.stringify(p)).sort();
    expect(parts).toEqual(whole); expect(whole.length).toBeGreaterThan(100);
  });
});

describe('composed worlds', () => {
  const RIVER = { features: [{ feature: 'river' }, { feature: 'lake' }, { feature: 'coast', side: 'E' }], seed: 'rhone' };
  const f = atlasField({ world: RIVER }), V = plantsConfig(f), [sx, sy] = f.views.spawn;
  it('the page computes the same plants from what it carries', () => {
    const page = vegetationKernel(JSON.parse(JSON.stringify(V)), atlasKernel(decodeDeep(f.pageConfig())));
    const srv = plantsKernel(f, V);
    for (const [x, y] of [[sx - 64, sy - 64], [sx + 500, sy - 300], [sx - 900, sy + 200]]) expect(page.plantsIn(x, y, 128)).toEqual(srv.plantsIn(x, y, 128));
  });
  it("stands its trees where the ground is painted wood, and on dry ground", () => {
    const P = plantsKernel(f, V); let n = 0;
    for (let a = -3; a < 3; a++) for (let b = -3; b < 3; b++) for (const p of plants(P.plantsIn(sx + a * 128, sy + b * 128, 128))) {
      n++; expect(f.kernel.waterAt(p.x, p.y)).toBe(null); expect(p.z).toBeCloseTo(f.kernel.groundAt(p.x, p.y), 9);
      if (V.species[p.s].name !== 'reed') expect(P.standAt(p.x, p.y).canopy).toBeGreaterThan(0);
    }
    expect(n).toBeGreaterThan(500);
  });
  it('keeps palms to a tropical coast and an arid river, and stands clumping bamboo in clumps leaning out', () => {
    const trop = atlasField({ world: { features: [{ feature: 'river' }, { feature: 'coast', side: 'S' }], climate: 'tropical', seed: 'tropic' } });
    const Vt = plantsConfig(trop), Pt = plantsKernel(trop, Vt), [tx, ty] = trop.views.spawn; const got = [];
    for (let a = -2; a < 2; a++) for (let b = -2; b < 2; b++) got.push(...plants(Pt.plantsIn(tx + a * 128, ty + b * 128, 128)));
    const coco = got.filter((p) => Vt.species[p.s].name === 'coconut'), bam = got.filter((p) => Vt.species[p.s].name === 'vulgaris');
    for (const p of coco) expect(p.z).toBeLessThan(12.5);
    expect(bam.length).toBeGreaterThan(40); expect(bam.some((p) => p.lean > 20)).toBe(true); expect(bam.some((p) => p.lean < 8)).toBe(true);
    const arid = atlasField({ world: { features: [{ feature: 'river' }], climate: 'arid', seed: 'nile' } }); const Va = plantsConfig(arid), Pa = plantsKernel(arid, Va), [ax, ay] = arid.views.spawn;
    for (const p of plants(Pa.plantsIn(ax - 64, ay - 64, 256))) if (Va.species[p.s].name !== 'reed') expect(Pa.standAt(p.x, p.y).nearWater).toBeGreaterThan(0.5);
  }, 120_000);   // composes two worlds: about 10 s alone, past the default under a loaded full suite
});

describe('a mountain jungle: tropical high ground is forested to its treeline', () => {
  const tropical = plantsConfig({ K: { zones: { tree: 3300, snow: 4900 }, seaLevel: null }, atlas: { climate: 'tropical' } });
  it('umbrella trees low, tree ferns and bamboo in the cloud belt, the conifer under the treeline, nothing past it', () => {
    // a ground rising a metre per metre eastward, from the lowland past the treeline, fully wooded
    const P = vegetationKernel(tropical, ground()), all = [];
    for (let x = 0; x < 3800; x += 100) all.push(...plants(P.plantsIn(x, 0, 100)));
    const name = (p) => tropical.species[p.s].name, band = (lo, hi) => all.filter((p) => p.z >= lo && p.z < hi);
    expect(band(0, 500).every((p) => name(p) === 'schefflera')).toBe(true);   // (Moso's soft edge comes down to about 550 m)
    for (const sp of ['treefern', 'moso', 'schefflera']) expect(band(1200, 1900).some((p) => name(p) === sp)).toBe(true);
    expect(band(2700, 3200).some((p) => name(p) === 'fir')).toBe(true); expect(band(0, 2000).some((p) => name(p) === 'fir')).toBe(false);
    for (let z = 0; z < 3250; z += 250) expect(band(z, z + 250).length).toBeGreaterThan(20);
    expect(all.reduce((m, p) => (p.z > m ? p.z : m), -Infinity)).toBeLessThan(1.1 * 3300);
  });
  it("on a tropical volcano, every altitude band the painter shows as wood holds plants, and the cloud belt holds several species", () => {
    const f = atlasField({ world: { features: [{ feature: 'volcano' }], climate: 'tropical', seed: 'kinabalu' } }), V = plantsConfig(f), P = plantsKernel(f, V), S = f.atlas.span;
    let a = 7; const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const bands = {};
    for (let n = 0; n < 6000; n++) {
      const X = (rnd() - 0.5) * 0.6 * S, Y = (rnd() - 0.5) * 0.6 * S, st = P.standAt(X, Y); if (!st.ok || st.canopy < 0.3) continue;
      const b = (bands[Math.floor(st.z / 250) * 250] ||= { tiles: 0, n: 0, sp: new Set() }); if (b.tiles >= 8) continue;
      b.tiles++; for (const p of plants(P.plantsIn(X - 32, Y - 32, 64))) { b.n++; b.sp.add(V.species[p.s].name); }
    }
    const high = Object.keys(bands).map(Number).filter((z) => z >= 250);
    expect(Math.max(...high)).toBeGreaterThanOrEqual(2000);
    for (const z of high) expect(bands[z].n).toBeGreaterThan(0);
    for (const z of high.filter((z) => z >= 1000 && z < 2250)) expect(bands[z].sp.size).toBeGreaterThanOrEqual(2);
  });
  it('grows its two new species as pools the page can carry, each in its own surface', () => {
    for (const [species, key] of [['schefflera', /^bark-beech$/], ['treefern', /^trunk-treefern-/]]) {
      const pool = plantPool({ species, variants: 1, seed: 's', maxLevel: 'L1' });
      expect(pool.variants[0].levels.L1.length).toBeGreaterThan(pool.variants[0].levels.L0.length);
      expect(Object.keys(pool.textures).some((k) => key.test(k))).toBe(true);
    }
  });
});

describe('the manifest teaches', () => {
  it('names the mistake', () => {
    const w = { world: { features: [{ feature: 'river' }] } };
    expect(validateTerrainPlants(true, w)).toEqual([]); expect(validateTerrainPlants({ radius: 800, level: 'L1', variants: 3 }, w)).toEqual([]);
    expect(validateTerrainPlants(true, { from: {} }).join(' ')).toMatch(/needs a composed world/);
    expect(validateTerrainPlants(true, { ...w, planet: true }).join(' ')).toMatch(/for flat worlds/);
    expect(validateTerrainPlants({ radius: 50 }, w).join(' ')).toMatch(/radius must be 200–3000/);
    expect(validateTerrainPlants({ level: 'L3' }, w).join(' ')).toMatch(/level must be L0, L1 or L2/);
    expect(validateTerrainPlants({ variants: 1.5 }, w).join(' ')).toMatch(/variants must be an integer 1–4/);
    expect(validateTerrainPlants('yes', w).join(' ')).toMatch(/must be true or/);
    expect(Object.keys(PLANT_CLIMATES).sort()).toEqual(['alpine', 'arid', 'boreal', 'temperate', 'tropical']);
  });
});

describe('the page plants (P2)', async () => {
  const { plantsPageChannel, plantPools, packTemplate, farTemplate, resolveTerrainPlants } = await import('./terrain-plants.js');
  const { assembleTerrainWorld } = await import('./terrain-world.js');
  const { terrainChannelScript } = await import('../scene/channels/terrain-lod.js');
  const { makeLight } = await import('../polygonizer/vexar.js');
  const { plantPool } = await import('../vegetation/pool.js');
  const dec = (v) => { const u = Buffer.from(v.__b64, 'base64'); return new globalThis[v.t](u.buffer, u.byteOffset, u.byteLength / globalThis[v.t].BYTES_PER_ELEMENT); };
  it('packs a template to within half a quantum of its faces, and a far level of fourteen triangles', async () => {
    const pool = plantPool({ species: 'oak', variants: 1, seed: 's', maxLevel: 'L1' }); const faces = pool.variants[0].levels.L1;
    const t = packTemplate(faces), q = dec(t.q); const unq = (i) => t.lo[i % 3] + (q[i] + 32768) * t.sc[i % 3];
    const { faceListToMesh } = await import('../figures/face-mesh.js'); const P = faceListToMesh(faces).positions;
    expect(q.length).toBe(P.length); let worst = 0; for (let i = 0; i < q.length; i++) worst = Math.max(worst, Math.abs(unq(i) - P[i]) / t.sc[i % 3]);
    expect(worst).toBeLessThanOrEqual(0.5 + 1e-6);                                             // within half a quantum on every axis
    expect(t.tris).toBeGreaterThan(1000); expect(dec(t.col).length).toBe(q.length);
    const far = farTemplate(pool.variants[0].levels.L0); expect(far).toHaveLength(14);
    const withBark = packTemplate(plantPool({ species: 'oak', variants: 1, seed: 's', maxLevel: 'L2' }).variants[0].levels.L2);
    expect(withBark.tex[0].key).toBe('bark-oak'); expect(dec(withBark.tex[0].uv).length).toBe((dec(withBark.tex[0].q).length / 3) * 2);
  });
  it('gives every variant a far level and each level up to the cap, and the textures its templates wear', () => {
    const f = atlasField({ world: { features: [{ feature: 'river' }], climate: 'arid', seed: 'nile' } }); const V = plantsConfig(f), spec = resolveTerrainPlants({ level: 'L1', variants: 1 });
    const ch = plantsPageChannel(V, plantPools(V, spec, makeLight({})), spec);
    expect(ch.levels).toEqual(['L0', 'L1']);
    for (const sp of ch.species) for (const v of sp.variants) { expect(Object.keys(v.t).sort()).toEqual(['L0', 'L1', 'LF']); expect(ch.templates[v.t.LF].tris).toBeLessThanOrEqual(1000); }
    const trees = ch.species.filter((sp) => sp.kind !== 'tuft'); for (const sp of trees) for (const v of sp.variants) expect(ch.templates[v.t.LF].tris).toBe(14);
    const keys = ch.templates.flatMap((t) => (t.tex || []).map((x) => x.key)); for (const k of keys) expect(ch.textures[k]).toMatch(/^data:image\/png/);
  });
  it('a world with plants carries them to the page and its script parses; a world without carries none of it', () => {
    const W = { kind: 'terrain', world: { features: [{ feature: 'river' }], climate: 'arid', seed: 'nile' } };
    const live = assembleTerrainWorld({ ...W, plants: { variants: 1, level: 'L1' } }, { live: true });
    expect(live.terrain.plants.species.map((sp) => sp.name)).toEqual(['date', 'washingtonia', 'reed']); expect(live.meta.plants.climate).toBe('arid');
    const js = terrainChannelScript(live.terrain); expect(js).toContain('const PLANTS = ');
    expect(() => new Function('THREE', 'scene', 'camera', 'walkColliders', js)).not.toThrow();   // eslint-disable-line no-new-func
    const bare = assembleTerrainWorld(W, { live: true }); expect(bare.terrain.plants).toBeUndefined(); expect(terrainChannelScript(bare.terrain)).not.toContain('PLANTS');
    expect(bare.meta.plants).toBeUndefined();
  });
  it('exports carry the stand around the spawn as instances', () => {
    const W = { kind: 'terrain', world: { features: [{ feature: 'river' }], climate: 'arid', seed: 'nile' }, plants: { variants: 1, level: 'L1' } };
    const baked = assembleTerrainWorld(W); const n = baked.repeats.reduce((s, r) => s + r.transforms.length, 0);
    expect(n).toBe(baked.meta.plants.baked); expect(n).toBeGreaterThan(50);
    const [sx, sy] = baked.walk.spawn; for (const r of baked.repeats) for (const t of r.transforms) expect(Math.hypot(t.pos[0] - sx, t.pos[1] - sy)).toBeLessThan(601);
  });
});

describe('a region grows its own conifers', () => {
  const around = (f, V, r = 3) => { const P = plantsKernel(f, V), [sx, sy] = f.views.spawn, got = []; for (let a = -r; a < r; a++) for (let b = -r; b < r; b++) got.push(...plants(P.plantsIn(sx + a * 128, sy + b * 128, 128))); return got; };
  it('absent, a climate keeps exactly its own rows', () => {
    const f = atlasField({ world: { features: [{ feature: 'lake' }], climate: 'boreal', seed: 'taiga' } });
    expect(JSON.stringify(plantsConfig(f, { region: null }))).toBe(JSON.stringify(plantsConfig(f)));
    const trop = atlasField({ world: { features: [{ feature: 'river' }], climate: 'tropical', seed: 'tropic' } });
    expect(JSON.stringify(plantsConfig(trop, { region: 'eurasia' }))).toBe(JSON.stringify(plantsConfig(trop)));   // a climate the region does not name
  }, 120_000);   // composes two worlds: about 9 s alone
  it('northern Eurasia: spruce throughout, pine on the ground away from water', () => {
    const f = atlasField({ world: { features: [{ feature: 'lake' }, { feature: 'river' }], climate: 'boreal', seed: 'taiga' } }); const V = plantsConfig(f, { region: 'eurasia' });
    expect(V.species.map((s) => s.name)).toEqual(['spruce', 'pine', 'reed']);
    const got = around(f, V); const name = (p) => V.species[p.s].name; const P = plantsKernel(f, V);
    const spruce = got.filter((p) => name(p) === 'spruce'), pine = got.filter((p) => name(p) === 'pine');
    expect(spruce.length).toBeGreaterThan(100); expect(pine.length).toBeGreaterThan(20);   // the spawn is by the lake: spruce holds the wet ground
    const wet = (ps) => ps.reduce((s, p) => s + P.standAt(p.x, p.y).nearWater, 0) / ps.length;
    expect(wet(pine)).toBeLessThan(wet(spruce));
  });
  it('the Alps: beech low, silver fir in the montane belt, spruce to the treeline', () => {
    const f = atlasField({ world: { features: [{ feature: 'volcano' }], climate: 'alpine', seed: 'alps' } }); const V = plantsConfig(f, { region: 'eurasia' }), P = plantsKernel(f, V), S = f.atlas.span;
    // a few small tiles in every 250 m band of wooded ground (as the tropical volcano's test samples)
    let a = 11; const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const bands = {}; const got = [];
    for (let n = 0; n < 4000; n++) {
      const X = (rnd() - 0.5) * 0.6 * S, Y = (rnd() - 0.5) * 0.6 * S, st = P.standAt(X, Y); if (!st.ok || st.canopy < 0.3) continue;
      const b = Math.floor(st.z / 250); if ((bands[b] = (bands[b] || 0) + 1) > 6) continue;
      got.push(...plants(P.plantsIn(X - 32, Y - 32, 64)));
    }
    const z = (nm) => { const ps = got.filter((p) => V.species[p.s].name === nm); return ps.length ? ps.reduce((s, p) => s + p.z, 0) / ps.length : NaN; };
    for (const nm of ['beech', 'silverfir', 'spruce']) expect(got.some((p) => V.species[p.s].name === nm)).toBe(true);
    expect(z('beech')).toBeLessThan(z('silverfir')); expect(z('silverfir')).toBeLessThan(z('spruce'));
    for (const c of Object.keys(PLANT_REGIONS.eurasia)) expect(PLANT_REGIONS.eurasia[c].rows.some((r) => r.species === 'fir')).toBe(false);
  });
  it('teaches a region it does not know', () => {
    const w = { world: { features: [{ feature: 'river' }] } };
    expect(validateTerrainPlants({ region: 'eurasia' }, w)).toEqual([]);
    expect(validateTerrainPlants({ region: 'mars' }, w).join(' ')).toMatch(/region must be one of eurasia/);
  });
  it('the card promises oak low only in the climates whose rows grow it', () => {
    const card = readFileSync(new URL('../views/view-vocab/terrain.md', import.meta.url), 'utf8');
    const oak = (c) => PLANT_REGIONS.eurasia[c].rows.some((r) => r.species === 'oak');
    expect(oak('temperate')).toBe(true); expect(oak('alpine')).toBe(false);
    expect(card).toMatch(/temperate oak and beech low \(alpine beech alone\)/); expect(card).not.toMatch(/alpine oak/);
  });
});
