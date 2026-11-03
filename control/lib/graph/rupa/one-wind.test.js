import { describe, it, expect } from 'vitest';
import { PLANT_Z0, at10, at2, matchAlpha, physicsWind, plantWind } from './one-wind.js';
import { rupaPhysics } from './index.js';
import { plantKind, breakSpeed, solveWind, PLANT_FORMS } from './wind-solver.js';
import { TERRAIN_WIND_DEFAULTS } from '../vegetation/wind.js';
import { SPECIES } from '../vegetation/species.js';

const speedAt = (spec, z) => Math.hypot(...rupaPhysics.windAt(rupaPhysics.windOf({ ...spec, gust: 0 }), [0, 0, z], 0));
const logAt = (u2, z) => (u2 * Math.log(z / PLANT_Z0)) / Math.log(2 / PLANT_Z0);

describe('one wind: the plants\' air is the physics\' air', () => {
  it('the profiles agree at 2 m and 10 m, and within 2 % between', () => {
    const u2 = 6, spec = physicsWind({ speed: u2, dir: 30, gust: 0.2, seed: 4 });
    expect(spec).toMatchObject({ dir: 30, gust: 0.2, seed: 4 });
    expect(spec.speed).toBeCloseTo(at10(u2), 9);
    expect(spec.alpha).toBeCloseTo(matchAlpha(), 12);
    expect(speedAt(spec, 2)).toBeCloseTo(u2, 9);
    expect(speedAt(spec, 10)).toBeCloseTo(logAt(u2, 10), 9);
    for (const z of [3, 5, 7]) expect(Math.abs(speedAt(spec, z) / logAt(u2, z) - 1)).toBeLessThan(0.02);
    expect(at2(at10(u2))).toBeCloseTo(u2, 12);
  });

  it('true is the plants\' default wind; a physics-only wind reads back as the plants\' at 2 m', () => {
    expect(physicsWind(true).speed).toBeCloseTo(at10(TERRAIN_WIND_DEFAULTS.speed), 9);
    expect(physicsWind(false)).toBeNull();
    const back = plantWind(physicsWind({ speed: 7, dir: -45, seed: 2 }));
    expect(back.speed).toBeCloseTo(7, 9);
    expect(back.dir).toBeCloseTo(-45, 9);
    expect(plantWind({ speed: 10, terrain: 'city' }).speed).toBeLessThan(plantWind({ speed: 10, terrain: 'sea' }).speed);
  });
});

describe('plants in the solver', () => {
  it('geometric similarity: the wind that snaps a broadleaf is the same at every size, near what storms show', () => {
    const small = breakSpeed(plantKind('tree', 6)), tall = breakSpeed(plantKind('tree', 30));
    expect(tall).toBeCloseTo(small, 6);
    expect(small).toBeGreaterThan(35);   // storms break trees of every size near 42 m/s (Virot et al. 2016)
    expect(small).toBeLessThan(45);
    expect(breakSpeed(plantKind('conifer', 20))).toBeLessThan(small);   // a dense crown on weaker wood goes sooner
  });

  it('a species by name stands still in a breeze, bends in a fresh wind and snaps in a storm past its crown\'s break speed', () => {
    const sp = Object.keys(SPECIES).find((s) => SPECIES[s].kind === 'tree'), H = 15;
    const el = { id: 'stand', kind: sp, height: H, place: { min: [0, 0, 0], max: [20, 20, 0] }, count: 6 };
    expect(solveWind([el], physicsWind({ speed: 2, gust: 0.2 })).still).toEqual(['stand']);
    expect(solveWind([el], physicsWind({ speed: 8 })).batches[0]).toMatchObject({ script: 'bend', count: 6 });
    // a storm whose strongest gust at the crown passes the break speed
    const U = breakSpeed(plantKind(sp, H)), gust = 0.5, a = matchAlpha(), u10 = (1.2 * U) / ((1 + gust) * Math.pow(H / 10, a));
    const storm = solveWind([el], { speed: u10, dir: 0, alpha: a, gust });
    expect(storm.simulate).toEqual(['stand']);
    expect(storm.reasons.stand).toMatch(/snaps/);
  });

  it('a hollow culm is lighter and less stiff for its size than a solid one; an unknown plant is refused', () => {
    const solid = { ...plantKind('culm', 12) }; delete solid.hollow;
    expect(breakSpeed(plantKind('culm', 12))).toBeLessThan(breakSpeed(solid));
    expect(() => plantKind('cactus', 3)).toThrow(/a plant is/);
    expect(Object.keys(PLANT_FORMS)).toEqual(expect.arrayContaining(['tree', 'conifer', 'palm', 'culm']));
  });
});

describe('the cube\'s wind and the level\'s', () => {
  it('a geocube\'s wind is its outside levels\' when they name none; a recipe\'s own wins; a bad one is refused', async () => {
    const { readGeocube, withGeocube, GEOCUBE_PRESETS } = await import('../era/geocube.js');
    const from = Object.keys(GEOCUBE_PRESETS)[0], cube = { from, wind: { speed: 9, dir: 40 } };
    expect(() => readGeocube({ from, wind: { speed: 99 } })).toThrow(/wind.speed must be 0–30/);
    expect(withGeocube({ kind: 'stage', geocube: cube, meru: true }).wind).toEqual({ speed: 9, dir: 40 });
    expect(withGeocube({ kind: 'stage', geocube: cube, trail: {} }).wind).toEqual({ speed: 9, dir: 40 });
    expect(withGeocube({ kind: 'stage', geocube: cube, trail: {}, wind: { speed: 2 } }).wind).toEqual({ speed: 2 });
    expect(withGeocube({ kind: 'stage', geocube: from, trail: {} }).wind).toBeUndefined();
  }, 120000);

  it('a physical level\'s blocks feel the level\'s wind; its matter.wind overrides it for the physics', async () => {
    const { resolveWorldScene } = await import('../worlds/world-scene.js');
    const { starter } = await import('../era/entries.js');
    const hero = { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.7] } };
    const level = (extra) => ({ manifest: { ...starter('gothic-stone'), entities: [hero], destruction: 'physical', ...extra }, title: 'yard' });
    const own = (await resolveWorldScene(level({ wind: { speed: 6, dir: 90 } }))).payload.rupa;
    expect(own.wind).toEqual(physicsWind({ speed: 6, dir: 90 }));
    const over = (await resolveWorldScene(level({ wind: { speed: 6 }, matter: { wind: { speed: 20 } } }))).payload.rupa;
    expect(over.wind.speed).toBe(20);
    expect((await resolveWorldScene(level({}))).payload.rupa.wind).toBeUndefined();
  }, 120000);
});

describe('the geocube\'s own assets', () => {
  it('a biocube\'s leaf forms are plants: an evergreen spire a conifer, every other crown a broadleaf', async () => {
    const { plantOfLeaf } = await import('./wind-solver.js');
    const { LEAF_FORMS } = await import('../era/leaf-forms.js');
    const ever = Object.keys(LEAF_FORMS).find((k) => LEAF_FORMS[k].evergreen), leafy = Object.keys(LEAF_FORMS).find((k) => !LEAF_FORMS[k].evergreen);
    expect(plantOfLeaf(ever)).toBe('conifer');
    expect(plantOfLeaf(leafy)).toBe('tree');
    expect(breakSpeed(plantKind(ever, 12))).toBeCloseTo(breakSpeed(plantKind('conifer', 12)), 9);
  });

  it('a cube\'s wind and its dunes share their way', async () => {
    const { withGeocube, GEOCUBE_PRESETS } = await import('../era/geocube.js');
    const from = Object.keys(GEOCUBE_PRESETS)[0];
    const laid = withGeocube({ kind: 'stage', geocube: { from, wind: { speed: 7, dir: 60 } }, trail: { ground: { dunes: true } } });
    expect(laid.trail.ground.dunes.wind).toBe(60);
    const own = withGeocube({ kind: 'stage', geocube: { from, wind: { speed: 7, dir: 60 } }, trail: { ground: { dunes: { wind: 10 } } } });
    expect(own.trail.ground.dunes.wind).toBe(10);
  }, 120000);
});
