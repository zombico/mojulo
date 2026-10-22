import { describe, expect, it } from 'vitest';

import { readCreases, CREASE_DEFAULTS } from './creases.js';
import { emitThreeWorld } from '../scene-three.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';

const quad = (fill, extra = {}) => ({ corners: [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]], fill, ...extra });
const floor = (fill) => ({ corners: [[0, 0, 0], [4, 0, 0], [4, 4, 0], [0, 4, 0]], fill });
const GROUPS = (page) => JSON.parse(page.match(/const GROUPS = (\[.*?\]);\n/s)[1]);

describe('creases: the setting', () => {
  it('reads true as the defaults and an object over them; absent or false is off', () => {
    expect(readCreases(true)).toEqual({ ...CREASE_DEFAULTS });
    expect(readCreases({ ink: '#101020', wash: 0 })).toEqual({ ...CREASE_DEFAULTS, ink: '#101020', wash: 0 });
    for (const off of [undefined, null, false]) expect(readCreases(off)).toBeNull();
  });

  it('refuses what it cannot draw, naming the setting', () => {
    expect(() => readCreases('yes')).toThrow(/creases is true or/);
    expect(() => readCreases({ width: 2 })).toThrow(/creases\.width is not a setting/);
    expect(() => readCreases({ ink: 'red' })).toThrow(/creases\.ink/);
    expect(() => readCreases({ line: 2 })).toThrow(/creases\.line/);
    expect(() => readCreases({ reach: 0 })).toThrow(/creases\.reach/);
  });
});

describe('creases: the World page', () => {
  const faces = [quad('#8a7a5c'), floor('#b8b08a'), quad('#3a6a32', { organic: true })];

  it('absent, the organic flag is never read: the same bytes as a world without it', () => {
    const plain = faces.map(({ organic: _o, ...f }) => f);
    expect(emitThreeWorld({ faces })).toBe(emitThreeWorld({ faces: plain }));
    expect(emitThreeWorld({ faces })).not.toContain('__crease');
  });

  it('on, organic faces leave the static group and only the angular group is marked', () => {
    const groups = GROUPS(emitThreeWorld({ faces, creases: true }));
    const byName = Object.fromEntries(groups.map((g) => [g.name, g]));
    expect(Object.keys(byName).sort()).toEqual(['static', 'static:organic']);
    expect(byName.static.crease).toBe(true);
    expect(byName['static:organic'].crease).toBeUndefined();
  });

  it('on, the prepass runs before every render and the reach is in world units', () => {
    const page = emitThreeWorld({ faces, creases: { reach: 3.66 }, metersPerUnit: 3.66 });
    const renders = page.split('renderer.render(scene, camera)').length - 1;
    expect(page.split('__creasePrepass(); renderer.render(scene, camera)').length - 1).toBe(renders - 1);   // all but the prepass's own
    expect(page).toContain('uWashR: { value: 1 }');
  });
});

describe('creases: world-scene', () => {
  const sk = (manifest) => ({ manifest, title: 'test' });

  it('carries the resolved terms only when asked, and the unshaded base drops them', async () => {
    expect((await resolveWorldScene(sk({ kind: 'floorplan' }))).payload.creases).toBeUndefined();
    expect((await resolveWorldScene(sk({ kind: 'floorplan', creases: true }))).payload.creases).toEqual({ ...CREASE_DEFAULTS });
    expect((await resolveWorldScene(sk({ kind: 'floorplan', creases: true }), { unshaded: true })).payload.creases).toBeUndefined();
  });

  it('a fractal city tags its trees organic only when it draws creases', async () => {
    const off = (await resolveWorldScene(sk({ kind: 'fractal-city' }))).payload;
    const on = (await resolveWorldScene(sk({ kind: 'fractal-city', creases: true }))).payload;
    expect(off.faces.some((f) => f.organic)).toBe(false);
    const trees = on.faces.filter((f) => f.organic).length;
    expect(trees).toBeGreaterThan(0);
    expect(on.faces.length).toBe(off.faces.length);   // the same geometry, only tagged
  });
});
