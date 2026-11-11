// A town's buildings in the form render (geotown/scene.js under ctx.formBuildings; form/sun-light.js): their faces baked
// with their colour and their light apart, the sun's shadow tested, and handed to the page's form channel with the sun
// as its one lamp. The smallest town (scene.test.js's), read three ways.
import { describe, it, expect } from 'vitest';
import { assembleGeotownScene } from './scene.js';
import { formScript, FORM_PAGE } from '../scene/channels/form.js';

const TOWN = { cube: 'valley-morning', seed: 4, geotown: { evoke: 'metro', grid: [1, 1], hills: { height: 6 }, margin: 12 } };
const built = (f) => typeof f.group === 'string' && (f.group.startsWith('town:') || f.group.startsWith('geotown:'));
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('a town\'s buildings in the form render', () => {
  const paint = assembleGeotownScene(TOWN, { form: true }), form = assembleGeotownScene(TOWN, { form: true, formBuildings: true });

  it('asked for, every building face carries its light apart from its colour; not asked for, the town is as it was', () => {
    expect(paint.form).toBeUndefined();
    expect(paint.faces.some((f) => f.cornerLight !== undefined)).toBe(false);
    const lit = form.faces.filter((f) => f.cornerLight !== undefined);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.every(built)).toBe(true);
    // (the same faces, in the same places: only their colour and their light differ)
    expect(form.faces.length).toBe(paint.faces.length);
    expect(form.faces.map((f) => f.group)).toEqual(paint.faces.map((f) => f.group));
    // (the land's ground is the land's: none of it baked here)
    expect(form.faces.filter((f) => f.group === 'isekai:ground').every((f) => f.cornerLight === undefined)).toBe(true);
    // (deterministic)
    expect(JSON.stringify(assembleGeotownScene(TOWN, { form: true, formBuildings: true }).form)).toBe(JSON.stringify(form.form));
  }, 120_000);

  it('the sun reaches some corners and not others: a face it reaches is brighter than the same paint in shade, and one base serves both', () => {
    const walls = form.faces.filter((f) => f.cornerLight !== undefined && Math.abs(f.normal[2]) < 0.3);
    const inSun = walls.filter((f) => f.sunShare.every((s) => s > 0.2)), inShade = walls.filter((f) => f.sunShare.every((s) => s === 0));
    expect(inSun.length).toBeGreaterThan(0);
    expect(inShade.length).toBeGreaterThan(0);
    const y = (F) => F.reduce((a, f) => a + lum(f.cornerLight[0]), 0) / F.length;
    expect(y(inSun)).toBeGreaterThan(y(inShade) * 1.3);
    // (a paint shared by a sunlit and a shaded wall has one base: the light is not in the colour)
    const bySun = new Set(inSun.map((f) => f.fill));
    expect(inShade.some((f) => bySun.has(f.fill))).toBe(true);
  });

  it('goes to the page as the form channel\'s: the sun its one lamp, far off along its way; a room\'s page carries none of the sun\'s code', () => {
    const T = form.form.town;
    expect(T.lights).toHaveLength(1);
    expect(T.lights[0].live).toBe(true);
    const d = T.lights[0].at, l = Math.hypot(...d);
    d.map((v) => v / l).forEach((v, k) => expect(v).toBeCloseTo(form.sky.sun.dir[k], 2));
    expect(T.sun.ground).toHaveLength(3);
    const page = (cfg) => formScript({ ...FORM_PAGE, ...cfg, maps: {} });
    expect(page(T)).toContain('uFGround');
    expect(page(T)).toContain('mat.userData.cast = true;');
    const room = page({ lights: [{ at: [0, 0, 2], key: [1, 1, 1], radius: 6, live: true }], ambient: [0.1, 0.1, 0.1], fall: 2 });
    expect(room).not.toContain('uFGround');
    expect(room).not.toContain('userData.cast');
  });

  it('at night it stays paint', () => {
    const night = assembleGeotownScene({ ...TOWN, hour: 'night' }, { form: true, formBuildings: true });
    expect(night.form).toBeUndefined();
    expect(night.faces.some((f) => f.cornerLight !== undefined)).toBe(false);
  }, 120_000);
});
