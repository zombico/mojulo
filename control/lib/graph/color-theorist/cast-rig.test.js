// The cast rig (cast-rig.js): the one light a body is drawn under, solved from the world's own. One cube per light the
// rig meets (a clear sun, a sky-lit overcast, a moon), picked in code from the cubes by what their solve says, and the
// card: the concepts, not the catalogue.
import { describe, it, expect } from 'vitest';
import { castRig, CAST_RIG_LAWS, CAST_CARD, CAST_REGISTERS, CAST_BANDS } from './cast-rig.js';
import { cubeLight } from '../era/cube-light.js';
import { readGeocube, GEOCUBE_PALETTES } from '../era/geocube.js';
import { HERO_LIGHT_LAWS } from './hero-light.js';
import { CAST_LIGHT } from '../era/cast-light.js';

const cubes = Object.keys(GEOCUBE_PALETTES).map((id) => readGeocube(id));
const share = (c) => cubeLight(c).contrast;
// (a clear sun: the look's own share kept; sky-lit: the most of its light the sky's; a moon: the least)
const sunCube = cubes.find((c) => cubeLight(c).skyLight.rule === 'card' && share(c) > 0.2);
const skyCube = [...cubes].sort((a, b) => share(b) - share(a))[0];
const moonCube = [...cubes].sort((a, b) => share(a) - share(b))[0];
const read = (R, law) => R.reads.find((r) => r.law === law);

describe('the cast rig', () => {
  it('is the world\'s own light: the key the solve\'s sun, the sky its ambient, the ground its floor\'s bounce; deterministic', () => {
    const L = cubeLight(sunCube), R = castRig(sunCube);
    expect(R.key.toLight).toEqual(L.sun.dir);
    expect(R.key.linear).toEqual(L.sun.linear);
    expect(R.hemi.sky).toEqual(L.ambient.linear);
    // (the floor throws back less than falls on it)
    R.hemi.ground.forEach((v, k) => expect(v).toBeLessThan(L.ambient.linear[k] + L.sun.linear[k]));
    // (a clear day turns a body by itself: no gain of the body's own)
    expect(R.key.gain).toBe(1);
    expect(R.hemi.gain).toBe(1);
    expect(read(R, 'form').ok).toBe(true);
    expect(JSON.stringify(castRig(sunCube))).toBe(JSON.stringify(R));
  });

  it('at another hour the key moves with the level\'s light, the rig still the solve\'s', () => {
    const noon = castRig(sunCube), eve = castRig(sunCube, { hour: 17.5 });
    expect(eve.key.level).toBeLessThan(noon.key.level);
    expect(eve.key.toLight).toEqual(cubeLight(sunCube, { hour: 17.5 }).sun.dir);
    expect(eve.from.hour).toBe(17.5);
  });

  it('holds the form between its laws with the body\'s own gains: a key raised under a sky-lit level, a fill under a moon', () => {
    // (a sky-lit level turns nothing: the body's key is raised, never the world's)
    const sky = castRig(skyCube), f = read(sky, 'form');
    expect(f.world).toBeLessThan(CAST_RIG_LAWS.form);
    expect(sky.key.gain).toBeGreaterThan(1);
    expect(sky.key.gain).toBeLessThanOrEqual(CAST_RIG_LAWS.keyGain);
    expect(sky.key.linear).toEqual(cubeLight(skyCube).sun.linear);
    expect(f.ratio).toBeGreaterThan(f.world);
    // (a moon over a dark sky leaves the shade side a hole: the body's fill is raised to the deepest the law allows)
    const moon = castRig(moonCube), g = read(moon, 'form');
    expect(g.world).toBeGreaterThan(CAST_RIG_LAWS.depth);
    expect(moon.hemi.gain).toBeGreaterThan(1);
    expect(g.ratio).toBeCloseTo(CAST_RIG_LAWS.depth, 3);
    expect(g.ok).toBe(true);
  });

  it('raises the rim where the shade side sits on the horizon\'s value, and says so', () => {
    // (a body whose shade is the horizon's own value: found by its albedo, on the sky-lit cube)
    const base = castRig(skyCube), lit = (base.hemi.sky.map((v, k) => (v + base.hemi.ground[k]) / 2).reduce((s, v, k) => s + v * [0.2126, 0.7152, 0.0722][k], 0)) * base.hemi.gain;
    const hor = cubeLight(skyCube).sky.horizon.map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }), yH = 0.2126 * hor[0] + 0.7152 * hor[1] + 0.0722 * hor[2];
    const a = Math.min(1, yH / lit), enc = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0'), grey = `#${enc(a)}${enc(a)}${enc(a)}`;
    if (a < 1) {
      const near = castRig(skyCube, { palette: { Suit: grey } }), s = read(near, 'separation');
      expect(s.ok).toBe(false);
      expect(near.rim.strength).toBeCloseTo(Math.min(1, base.rim.strength + HERO_LIGHT_LAWS.rimLift), 4);
    }
    // (a dark body against a day's horizon stands off it: the rim an accent)
    const far = castRig(sunCube, { palette: { Suit: '#101010' } });
    expect(read(far, 'separation').ok).toBe(true);
  });

  it('value: a dark suit\'s shade side is lifted to the floor, its key and fill together (the turn kept); a light one, and none, as they were', () => {
    const lum = (R, hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const dark = { Top: '#1b1e21', Bottom: '#2a2d2b', Skin: '#e4c0ab' }, light = { Top: '#c9c2b0', Bottom: '#b8b09c' };
    const none = castRig(skyCube), D = castRig(skyCube, { palette: dark }), Lt = castRig(skyCube, { palette: light });
    expect(read(D, 'value').lift).toBeGreaterThan(1);
    expect(D.hemi.gain / none.hemi.gain).toBeCloseTo(D.key.gain / none.key.gain, 3);              // (together: the turn kept; the gains to four places)
    expect(read(D, 'form').ratio).toBe(read(none, 'form').ratio);
    // (its shade side, the bulk's (its top and bottom) under the fill, at the floor: dark, never black)
    const wall = (lum(null, '#000000') + (0.2126 * D.hemi.sky[0] + 0.7152 * D.hemi.sky[1] + 0.0722 * D.hemi.sky[2] + 0.2126 * D.hemi.ground[0] + 0.7152 * D.hemi.ground[1] + 0.0722 * D.hemi.ground[2]) / 2);
    const bulk = (lum(null, dark.Top) + lum(null, dark.Bottom)) / 2;
    expect(Math.cbrt(bulk * wall * D.hemi.gain)).toBeGreaterThanOrEqual(CAST_RIG_LAWS.floor - 1e-3);
    expect(read(D, 'value').lift).toBeLessThanOrEqual(CAST_RIG_LAWS.lift);
    expect(read(Lt, 'value').lift).toBe(1);
    expect(Lt.hemi.gain).toBe(none.hemi.gain); expect(Lt.key.gain).toBe(none.key.gain);
    expect(read(none, 'value').ok).toBe(true);
  });
  it('with no cube is the card: the fight rig\'s own numbers; a register is the body\'s, the light the same', () => {
    for (const reg of CAST_REGISTERS) {
      const R = castRig(null, { register: reg });
      expect(R.from).toEqual({ card: reg });
      expect(R.key.toLight).toEqual(CAST_CARD[reg].toLight);
      R.key.linear.forEach((v, k) => expect(v).toBeCloseTo(CAST_CARD[reg].key[k], 4));
      // (written, not solved: no gain of the body's own, whatever its form reads)
      expect([R.key.gain, R.hemi.gain]).toEqual([1, 1]);
    }
    const w = castRig(sunCube), a = castRig(sunCube, { register: 'anime' });
    expect(a.key).toEqual(w.key);
    expect(a.hemi).toEqual(w.hemi);
    expect(a.bands).toEqual({ steps: CAST_BANDS.steps, ramp: [...CAST_BANDS.ramp] });
    expect(w.bands).toBeUndefined();
    expect(() => castRig(sunCube, { register: 'noir' })).toThrow(/register/);
    // (the numbers the module writes for itself are the ones they stand for)
    expect(CAST_RIG_LAWS.form).toBe(HERO_LIGHT_LAWS.form);
    expect([CAST_RIG_LAWS.separation, CAST_RIG_LAWS.rimLift]).toEqual([HERO_LIGHT_LAWS.separation, HERO_LIGHT_LAWS.rimLift]);
    expect(CAST_RIG_LAWS.rim).toEqual({ strength: CAST_LIGHT.rim.strength, power: CAST_LIGHT.rim.power });
    expect([CAST_CARD.western.strength, CAST_CARD.western.power]).toEqual([CAST_LIGHT.rim.strength, CAST_LIGHT.rim.power]);
  });
});
