// The hero's gen-7 light (hero-light.js): a cube's cast light drawn as a rig, and the theorist's laws read on the figure
// as lit. One cube per light the cast light has (a sun and a moon, chosen from the comic hero pack's looks in code), one
// palette with a focal step, one metal group: the concepts, not the catalogue.
import { describe, it, expect } from 'vitest';
import { heroFormLight, HERO_LIGHT_LAWS } from './hero-light.js';
import { geocubeCastLight } from '../era/cast-light.js';
import { readGeocube } from '../era/geocube.js';
import { solvePalette } from './solve.js';
import { LOOKS } from '../cosmos/packs/comic-hero/looks.js';

const cubes = Object.values(LOOKS).map((L) => readGeocube(L.geocube));
const sunCube = cubes.find((c) => geocubeCastLight(c).from.key === 'sun');
// (the night whose fill most outweighs its key)
const flat = (c) => { const C = geocubeCastLight(c); return C.diffuse / C.ambient; };
const moonCube = cubes.filter((c) => geocubeCastLight(c).from.key === 'moon').sort((a, b) => flat(a) - flat(b))[0];
const PALETTE = { Top: '#c62828', OutfitBase: '#c62828', OutfitAccent: '#ffd400', Hair: '#0a0a0a', Plate: '#8b929a', Reactor: '#e53935' };
const read = (R, law) => R.reads.filter((r) => r.law === law);

describe('the hero\'s gen-7 light', () => {
  it('is the cube\'s cast light as a rig: the key from its sun, the fill its sky, the rim its horizon; deterministic', () => {
    const C = geocubeCastLight(sunCube), R = heroFormLight(sunCube, { palette: PALETTE });
    expect(R.rig.key.toLight).toEqual(C.toLight);
    expect(R.rig.key.intensity).toBeCloseTo(Math.max(...C.cast.key), 3);
    expect(R.rig.rim.strength).toBe(C.rim[3]);
    expect(heroFormLight(sunCube, { palette: PALETTE })).toEqual(R);
  });
  it('reads each group by its material\'s response: a metal reflects, a glow is left out of the light\'s laws', () => {
    const R = heroFormLight(sunCube, { palette: PALETTE, surfaces: { Plate: { metal: 'steel', finish: 'brushed' } } });
    expect(R.groups.Plate.response).toBe('metal');
    expect(R.groups.Top.response).toBe('cloth');
    expect(R.groups.Reactor).toMatchObject({ response: 'glow' });
    expect(R.groups.Reactor.lit).toBe(R.groups.Reactor.shade);
    expect(R.groups.Top.lit).toBeGreaterThan(R.groups.Top.shade);
  });
  it('holds the laws on the lit figure: the emblem\'s step on both sides, a near-black group a hole, the form the rig\'s ratio', () => {
    const R = heroFormLight(sunCube, { palette: PALETTE });
    const [focal] = read(R, 'focal');
    expect(focal).toMatchObject({ ok: true, groups: ['OutfitAccent', 'OutfitBase'] });
    expect(focal.step.lit).toBeGreaterThanOrEqual(HERO_LIGHT_LAWS.focal);
    expect(read(R, 'shade')[0].groups).toEqual(['Hair']);
    expect(read(R, 'form')[0].ok).toBe(true);
  });
  it('under a night cube whose fill outweighs its key, the figure reads flat and the rim is raised to carry the outline', () => {
    const day = heroFormLight(sunCube, { palette: PALETTE }), night = heroFormLight(moonCube, { palette: PALETTE });
    expect(read(night, 'form')[0].ratio).toBeLessThan(read(day, 'form')[0].ratio);
    const [sep] = read(night, 'separation');
    if (!sep.ok) expect(night.rig.rim.strength).toBeGreaterThan(geocubeCastLight(moonCube).rim[3]);
    else expect(night.rig.rim.strength).toBe(geocubeCastLight(moonCube).rim[3]);
  });
  it('a palette lends the rig its hues and its exposure, never the cube\'s levels', () => {
    const K = solvePalette({ seed: 3 }), plain = heroFormLight(sunCube, { palette: PALETTE }), hued = heroFormLight(sunCube, { palette: PALETTE, K });
    expect(hued.rig.key.intensity).toBe(plain.rig.key.intensity);
    expect(hued.rig.fill.intensity).toBe(plain.rig.fill.intensity);
    expect(hued.rig.fill.sky).not.toBe(plain.rig.fill.sky);
    expect(hued.why.join(' ')).toMatch(new RegExp(K.id));
  });
});
