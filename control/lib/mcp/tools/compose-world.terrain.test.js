// Isolate to in-memory SQLite before any import that pulls db/index.js (compose-world.fog.test.js pattern).
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

/**
 * compose_world({ base: 'terrain' }) — the on-ramp. Claims under test: an inline painted
 * scene mints and resolves; a stored painted-landscape promotes by `{ ref }` and the world follows it; the live
 * /world resolve ships the recipe while an export resolve carries the baked world; a placed sketch lands in the
 * payload's faces fitted and seated; a world composed from features mints and resolves with its bookmarks; a stored
 * fractal city stands on the ground by `{ ref }` (a canal city refuses); a bad recipe refuses at mint, a dangling ref at
 * resolve.
 */
import { describe, expect, it } from 'vitest';

import { composeWorld } from './compose-world.js';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { resolveWorldScene } from '@/lib/graph/worlds/world-scene';
import { mintPaintedLandscape } from './painted-landscape.js';

const FROM = { heartbeat: 'gentle-roughness', splatch: 'verdure-trio', seed: 'ct', landform: [{ op: 'scarp', path: [[-16, -6], [16, -9]], throw: 3, side: 'right' }] };
const MUG = {
  kind: 'workbench', units: 'cm',
  lathes: [{ axisFrom: { x: 0, y: 0, z: 0 }, axisTo: { x: 0, y: 0, z: 9 }, profile: [{ t: 0, radius: 3.6 }, { t: 1, radius: 4 }], tint: '#b8342c' }],
};

describe("compose_world base 'terrain'", () => {
  it('an inline painted scene mints and resolves: the live page gets the recipe, exports get the bake', async () => {
    const r = composeWorld({ base: 'terrain', overrides: { from: FROM, span: 1600 } });
    expect(r.ok).toBe(true);
    const stored = SketchRepository.getByRef(r.ref);
    expect(stored.manifest.kind).toBe('terrain');
    const live = await resolveWorldScene(stored, { live: true });
    expect(live.kind).toBe('terrain'); expect(live.payload.faces).toEqual([]); expect(live.payload.terrain.K.s).toBe(1600 / 24);
    const exp = await resolveWorldScene(stored);
    expect(exp.payload.faces.length).toBeGreaterThan(1000);
  });
  it('a stored painting promotes by ref, and the world follows its source', async () => {
    const painting = mintPaintedLandscape({ title: 'ridge', ...FROM });
    const r = composeWorld({ base: 'terrain', overrides: { from: { ref: painting.ref } } });
    const w = SketchRepository.getByRef(r.ref);
    const top = (K) => K.hMin + K.hStep * 65535;
    const before = top((await resolveWorldScene(w, { live: true })).payload.terrain.K);
    SketchRepository.update({ ref: painting.ref, manifest: { ...SketchRepository.getByRef(painting.ref).manifest, landform: [{ op: 'scarp', path: [[-16, -6], [16, -9]], throw: 6, side: 'right' }] } });
    const after = top((await resolveWorldScene(SketchRepository.getByRef(r.ref), { live: true })).payload.terrain.K);
    expect(after - before).toBeGreaterThan(2.5);   // the scarp thrown 3 higher raised the top by about that: top against top
  });
  it('a placed sketch stands in the world', async () => {
    SketchRepository.create({ ref: 'sk_terrain_mug', title: 'mug', manifest: MUG });
    const r = composeWorld({ base: 'terrain', overrides: { from: FROM, place: [{ ref: 'sk_terrain_mug', at: [0, 300], size: 30, name: 'mug' }] } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef(r.ref), { live: true });
    const mug = payload.faces.filter((f) => f.group === 'item:mug');
    expect(mug.length).toBeGreaterThan(20);
    const xs = mug.flatMap((f) => f.corners.map((c) => c[0])); expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(30 + 1e-6);
  });
  it('a world composed from features mints and resolves, standing you at the anchor', async () => {
    const r = composeWorld({ base: 'terrain', overrides: { world: { features: [{ feature: 'lake', size: 'tarn' }], climate: 'alpine' } } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef(r.ref), { live: true });
    expect(payload.meta.world.anchor.feature).toBe('lake'); expect(payload.cameras.map((c) => c.name)).toEqual(['ground', 'aerial', 'region', 'world']);
    expect(payload.terrain.K.atlas).toBe(true);
  });
  it('a composed world carries its plants and grass to the stored recipe and the live page, with no false note', async () => {
    const plants = { region: 'eurasia', variants: 1, level: 'L0' };
    const r = composeWorld({ base: 'terrain', overrides: { world: { features: [{ feature: 'lake', size: 'tarn' }], climate: 'alpine' }, plants, grass: true } });
    expect(r.note).toBeUndefined();
    const stored = SketchRepository.getByRef(r.ref);
    expect(stored.manifest.plants).toEqual(plants); expect(stored.manifest.grass).toBe(true);
    const { payload } = await resolveWorldScene(stored, { live: true });
    expect(payload.terrain.plants.templates.length).toBeGreaterThan(0); expect(payload.terrain.grass.templates.length).toBeGreaterThan(0);
    expect(payload.meta.plants.species).toContain('spruce');
  }, 120_000);
  it('the override note names only what did not land', () => {
    const r = composeWorld({ base: 'terrain', overrides: { from: FROM, span: 1600, bogus_knob: 1 } });
    expect(r.recipe.span).toBe(1600);
    expect(r.note).toMatch(/not reflected in the stored recipe: bogus_knob —/);
  });
  it("a painted landscape's own keys are reflected too: no false note", () => {
    const r = composeWorld({ base: 'painted-landscape', overrides: { title: 'ridge', ...FROM, rocks: 'granite', erosion: true } });
    expect(r.recipe.landform).toEqual(FROM.landform); expect(r.note).toBeUndefined();
  });
  it('a stored fractal city stands on the ground by ref; a canal city refuses', async () => {
    SketchRepository.create({ ref: 'sk_terrain_town', title: 'town', manifest: { kind: 'fractal-city', profile: 'town', seed: 3, region: { x: 0, y: 0, w: 60, d: 40 } } });
    const r = composeWorld({ base: 'terrain', overrides: { from: FROM, cities: [{ ref: 'sk_terrain_town' }] } });
    const { payload } = await resolveWorldScene(SketchRepository.getByRef(r.ref), { live: true });
    expect(payload.meta.cities[0].size).toEqual([60 * 3.66, 40 * 3.66]); expect(payload.meta.cities[0].masses).toBeGreaterThan(5);
    expect(payload.faces.some((f) => f.group === 'city')).toBe(true);
    SketchRepository.create({ ref: 'sk_terrain_canal', title: 'canal', manifest: { kind: 'fractal-city', profile: 'canal', seed: 3 } });
    const c = composeWorld({ base: 'terrain', overrides: { from: FROM, cities: [{ ref: 'sk_terrain_canal' }] } });
    await expect(resolveWorldScene(SketchRepository.getByRef(c.ref), { live: true })).rejects.toThrow(/canal city/);
  });
  it('an inline city carries its frontage and round-kit flags in the row; the stamp renders the same bytes', async () => {
    const city = { profile: 'town', seed: 3, size: 220 };
    const r = composeWorld({ base: 'terrain', overrides: { from: FROM, cities: [city, { ...city, seed: 4, elements: { roundKit: false } }, { ref: 'sk_terrain_town' }] } });
    const stored = SketchRepository.getByRef(r.ref).manifest.cities;
    expect(stored[0].elements).toEqual({ frontage: true, roundKit: true });
    expect(stored[1].elements).toEqual({ frontage: true, roundKit: false });   // the caller's own word wins
    expect(stored[2]).toEqual({ ref: 'sk_terrain_town' });                    // a stored city is its own row
    const m = SketchRepository.getByRef(r.ref).manifest;
    const bare = { ...m, cities: [city, { ...city, seed: 4, elements: { roundKit: false } }, { ref: 'sk_terrain_town' }] };
    const a = await resolveWorldScene({ ref: 'x', title: 't', manifest: m }, { live: true }), b = await resolveWorldScene({ ref: 'x', title: 't', manifest: bare }, { live: true });
    expect(JSON.stringify(a.payload)).toBe(JSON.stringify(b.payload));
  }, 120000);
  it('refuses a bad recipe at mint and a dangling ref at resolve', async () => {
    expect(() => composeWorld({ base: 'terrain', overrides: {} })).toThrow(/give `from`.*or `world`/);
    expect(() => composeWorld({ base: 'terrain', overrides: { world: { features: [{ feature: 'sea' }] } } })).toThrow(/feature must be one of/);
    expect(() => composeWorld({ base: 'terrain', overrides: { from: { heartbeat: 'nope', splatch: 'verdure-trio' } } })).toThrow(/terrain\.from/);
    const m = { kind: 'terrain', from: { ref: 'sk_does_not_exist' } };
    await expect(resolveWorldScene({ ref: 'x', title: 't', manifest: m })).rejects.toThrow(/not a stored sketch/);
  });
});
