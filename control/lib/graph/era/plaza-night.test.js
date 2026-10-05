import { describe, it, expect } from 'vitest';
import { assembleStageScene } from './stage.js';
import { sunDir } from './sun.js';
import { hexRgb } from './geom.js';
import { DELFINO_PLAZA } from './style/delfino-plaza.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { collectFaceTextures } from '../landscape/surface-textures.js';

// the plaza at night (`time: 'night'`, plaza-night.js): machine checks for the style card's night principles
const PLAZA = { kind: 'stage', reference: 'sunshine', kit: 'delfino-plaza', rooms: [{ id: 'plaza', x: 0, y: 0, w: 26, d: 22, h: 12 }] };
const N = DELFINO_PLAZA.night;
const day = assembleStageScene(PLAZA), night = assembleStageScene({ ...PLAZA, time: 'night' });
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// every baked corner of a group: [point, rgb]
const corners = (s, g) => s.faces.filter((f) => f.group === g && f.cornerFills).flatMap((f) => f.corners.map((p, i) => [p, hexRgb(f.cornerFills[i])]));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const near = (p, q, r) => Math.hypot(p[0] - q[0], p[1] - q[1]) < r;
const lightsOf = (s, color) => s.lights.filter((l) => l.color.every((v, k) => Math.abs(v - hexRgb(color)[k]) < 1e-6));

describe('the plaza at night', () => {
  it('the floor holds: `time: \'day\'` is the plaza as it was; a kit without a night refuses one; a bad time throws', () => {
    expect(JSON.stringify(assembleStageScene({ ...PLAZA, time: 'day' }))).toBe(JSON.stringify(day));
    expect('night' in day).toBe(false);
    expect(() => assembleStageScene({ kind: 'stage', reference: 'dmc3', kit: 'gothic-nave', rooms: [{ id: 'n', x: 0, y: 0, w: 12, d: 24, h: 13 }], time: 'night' })).toThrow(/no night/);
    expect(() => assembleStageScene({ ...PLAZA, time: 'dusk' })).toThrow(/time must be/);
  });

  it(N.principles[0], () => {
    const wall = corners(night, 'stage:wall').map(([, c]) => c), dayWall = corners(day, 'stage:wall').map(([, c]) => c);
    // the moonlit stucco: the walls away from any lamp are bluer than they are red, and never black
    const lamps = night.lights.map((l) => l.position);
    const dark = corners(night, 'stage:wall').filter(([p]) => lamps.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > 6)).map(([, c]) => c);
    expect(dark.length).toBeGreaterThan(100);
    expect(mean(dark.map((c) => c[2] - c[0]))).toBeGreaterThan(0);
    expect(Math.min(...dark.map(lum))).toBeGreaterThan(0.03);
    expect(mean(dark.map(lum))).toBeLessThan(mean(dayWall.map(lum)) * 0.5);
    expect(mean(wall.map(lum))).toBeLessThan(mean(dayWall.map(lum)));
  });

  it(N.principles[1], () => {
    const lanterns = lightsOf(night, N.lantern.color).map((l) => l.position);
    expect(lanterns.length).toBeGreaterThan(4);
    const floor = corners(night, 'stage:floor');
    const pooled = floor.filter(([p]) => lanterns.some((q) => near(p, q, 2))), between = floor.filter(([p]) => night.lights.every((l) => Math.hypot(p[0] - l.position[0], p[1] - l.position[1], p[2] - l.position[2]) > 6));
    expect(between.length).toBeGreaterThan(100);
    expect(pooled.length).toBeGreaterThan(20);
    expect(mean(pooled.map(([, c]) => lum(c)))).toBeGreaterThan(2 * mean(between.map(([, c]) => lum(c))));
    // and the pool is warm: red over blue
    expect(mean(pooled.map(([, c]) => c[0] - c[2]))).toBeGreaterThan(0);
  });

  it(N.principles[2], () => {
    const basin = lightsOf(night, N.fountain.color);
    expect(basin.length).toBe(1);
    expect(basin[0].position[0]).toBeCloseTo(13, 6);
    expect(basin[0].position[1]).toBeCloseTo(11, 6);
  });

  it(N.principles[3], () => {
    const glass = night.faces.filter((f) => f.group === 'stage:glass');
    const lit = glass.filter((f) => f.fill === N.windows.color);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(glass.length * 0.7);
    expect(day.faces.some((f) => f.group === 'stage:glass' && f.fill === N.windows.color)).toBe(false);
    // each lit window spills a little light on its sill
    expect(lightsOf(night, N.windows.color).length).toBeGreaterThan(5);
  });

  it(N.principles[4], () => {
    expect(night.sky.day).toBe(0);
    expect(night.sky.stars).toBeGreaterThan(0);
    // the moon on the dome is where the bake's moonlight comes from (sky-dome.js places it by u, h)
    const { u, h } = night.sky.moon, az = -Math.PI / 2 + (u - 0.5) * Math.PI, el = h * (Math.PI / 2);
    const toMoon = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)], key = sunDir(N.moon.elevation, N.moon.azimuth);
    toMoon.forEach((v, k) => expect(v).toBeCloseTo(key[k], 3));
    expect(night.effects[0]).toBeTruthy();   // the cloud deck, lit by the moon
  });

  it('with water at night the falling water is seen in the night\'s light, not the sun\'s', () => {
    const wet = assembleStageScene({ ...PLAZA, time: 'night', water: true });
    expect(wet.jetLight).toEqual(N.jets);
    expect('jetLight' in assembleStageScene({ ...PLAZA, water: true })).toBe(false);
    const html = emitThreeWorld({ ...wet, textures: collectFaceTextures(wet.faces), inline: true });
    expect(html).toContain('JLIT * vec3(0.92, 0.95, 0.97)');
  });
});
