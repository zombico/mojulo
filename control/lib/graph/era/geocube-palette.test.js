/**
 * The color theorist decides a geocube's colours: a seeded palette on a cube solves its key colours, shade, tone key,
 * moon and sky; the stamp seeds every cube a recipe names where it is stored; a gameworld's palette is its levels'
 * cubes'; and the interpreter stands a composed world on the cube its words point at. A cube with no seed (a recipe
 * minted before) reads as it always did.
 */
import { describe, expect, it } from 'vitest';

import { GEOCUBE_PRESETS, GEOCUBE_PALETTES, readGeocube, lowerGeocube, geocubePaint } from './geocube.js';
import { stampGeocubes, stampWorldPalette } from '../color-theorist/stamp.js';
import { lchOf, hexToRgb } from '../color-theorist/oklab.js';
import { readGameworld, resolveLevel, cubeInPalette } from '../gameworld/world.js';
import { readLevel } from '../level/graph.js';
import { composeGameworld } from '../gameworld/compose.js';
import { SIXTH_GEN_REFERENCES, resolveLook } from './sixth-gen.js';

const L = (hex) => lchOf(hexToRgb(hex))[0];
const solved = (id, seed, more = {}) => readGeocube({ from: id, palette: { ...GEOCUBE_PALETTES[id], seed }, ...more });
let n = 0;
const fresh = () => ++n + 1000;

describe('a cube solved from its palette', () => {
  it('reads the same bytes every time, and two seeds give two cubes', () => {
    for (const id of Object.keys(GEOCUBE_PRESETS)) {
      expect(JSON.stringify(solved(id, 3))).toBe(JSON.stringify(solved(id, 3)));
      expect(solved(id, 3).colour).not.toEqual(solved(id, 11).colour);
      expect(solved(id, 3).colour).not.toEqual(GEOCUBE_PRESETS[id].colour);
    }
  });

  it('a cube with no seed keeps its own colours: a preset, a variant, an unseeded or false palette', () => {
    for (const id of Object.keys(GEOCUBE_PRESETS)) {
      const own = readGeocube(id);
      expect(own.colour).toEqual(GEOCUBE_PRESETS[id].colour);
      expect(own.palette).toBeUndefined();
      expect(own.light.sky).toBeUndefined();
      expect(readGeocube({ from: id, palette: { heat: 0.4 } }).colour).toEqual(own.colour);
      expect(readGeocube({ from: id, palette: false }).colour).toEqual(own.colour);
    }
  });

  it('writes every key colour, the shade, the tone key, the sky, and where it came from', () => {
    const c = solved('island-noon', 5);
    for (const k of ['stone', 'floor', 'trim', 'accent', 'grass', 'foliage', 'water', 'sand']) expect(c.colour[k]).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.colour.shade).toBeGreaterThanOrEqual(0);
    expect(c.register.key).toBe(0.62);
    expect(c.palette).toMatchObject({ seed: 5, id: expect.stringMatching(/^pal-/), reads: expect.stringContaining('key') });
    expect(Object.keys(c.light.sky)).toEqual(['zenith', 'horizon', 'fog']);
  });

  it('a colour written on the cube is a lock: the solve keeps it and fits the rest round', () => {
    const c = solved('gothic-night', 3, { colour: { stone: '#5c6272', trim: '#123456' } });
    expect(c.colour.stone).toBe('#5c6272');
    expect(c.colour.trim).toBe('#123456');
    expect(c.colour.floor).not.toBe(solved('gothic-night', 3).colour.floor);
  });

  it('a cube read again is the same cube: the solve does not run twice', () => {
    const c = solved('jungle-haze', 9);
    expect(readGeocube(c)).toEqual(c);
  });

  it('the preset principles that name colours give way to the palette\'s reading', () => {
    const own = readGeocube('gothic-night'), c = solved('gothic-night', 3);
    expect(c.why).not.toContain(own.why[0]);
    expect(c.why).toContain(own.why[4]);
    expect(c.why.some((w) => w.includes(c.palette.id))).toBe(true);
  });

  it('a night stays dark: the sky takes the reference\'s value and the palette\'s hue; a day\'s sky is the brightest thing', () => {
    const night = solved('gothic-night', 3), dome = SIXTH_GEN_REFERENCES[resolveLook('gothic-night')].air.dome;
    expect(Math.abs(L(night.light.sky.zenith) - lchOf(dome.zenith)[0])).toBeLessThan(0.02);
    expect(L(night.light.sky.horizon)).toBeLessThan(0.35);
    expect(night.light.moon.color).toMatch(/^#[0-9a-f]{6}$/);
    for (const id of ['island-noon', 'jungle-haze']) {
      const day = solved(id, 3);
      for (const k of ['stone', 'floor', 'grass', 'foliage']) expect(L(day.light.sky.horizon)).toBeGreaterThan(L(day.colour[k]));
    }
  });

  it('the island draws its sky and fog from the cube; the cube\'s own reads the reference\'s', () => {
    const c = solved('island-noon', 4), low = lowerGeocube(c, 'outside'), own = lowerGeocube(readGeocube('island-noon'), 'outside');
    expect(low.kit).not.toBe(own.kit);
    expect(geocubePaint({ geocube: c, trail: {} })).toMatchObject({ palette: c.palette.id });
    expect(geocubePaint({ geocube: 'island-noon', trail: {} }).palette).toBeUndefined();
  });
});

describe('the stamp: a cube is seeded where it is stored', () => {
  it('a preset id becomes the preset\'s character with a seed, wherever a recipe names a cube', () => {
    const m = stampGeocubes({ kind: 'stage', trail: {}, geocube: 'gothic-night', hero: { geocube: 'island-noon' } }, null, fresh);
    expect(m.geocube).toEqual({ from: 'gothic-night', palette: { ...GEOCUBE_PALETTES['gothic-night'], seed: expect.any(Number) } });
    expect(m.hero.geocube.palette.seed).toEqual(expect.any(Number));
    expect(stampGeocubes({ kind: 'geocube', cube: 'jungle-haze', show: 'land' }, null, fresh).cube.palette.seed).toEqual(expect.any(Number));
  });

  it('leaves a seeded palette, palette false, and what is not a cube', () => {
    const m = { kind: 'stage', geocube: { from: 'island-noon', palette: { seed: 7 } }, other: { geocube: { from: 'jungle-haze', palette: false } }, note: { geocube: 'not-a-cube' } };
    expect(stampGeocubes(m, null, fresh)).toBe(m);
  });

  it('an edit that leaves an old cube as it was leaves it; one re-sent before its stamp keeps its seed', () => {
    const old = { kind: 'stage', trail: {}, geocube: 'gothic-night', title: 'a' };
    expect(stampGeocubes({ ...old, title: 'b' }, old, fresh).geocube).toBe('gothic-night');
    const stored = stampGeocubes(old, null, fresh);
    expect(stampGeocubes({ ...old, title: 'b' }, stored, fresh).geocube).toEqual(stored.geocube);
    expect(stampGeocubes({ ...old, geocube: 'island-noon' }, stored, fresh).geocube.from).toBe('island-noon');
    // an edit that writes another seed keeps it
    const reseeded = { ...stored.geocube, palette: { ...stored.geocube.palette, seed: 7 } };
    expect(stampGeocubes({ ...old, geocube: reseeded }, stored, fresh).geocube.palette.seed).toBe(7);
  });
});

describe('a gameworld and its cubes: one palette', () => {
  const base = { id: 'one-look', seed: 3, levels: { a: { walk: { nodes: { 'a-1': { trail: true }, 'a-2': { trail: true } } } }, b: { walk: { nodes: { 'b-1': { trail: true } } } } }, links: [{ from: 'a', to: 'b' }] };
  const levelCube = (w, id) => readGeocube(resolveLevel(readGameworld(w), id).level.geocube);

  it('a world on a cube alone takes the cube\'s palette, and every level\'s cube is solved from it', () => {
    const w = stampWorldPalette(stampGeocubes({ ...base, style: { geocube: 'gothic-night' } }, null, fresh), null, fresh);
    expect(w.style.palette).toEqual(w.style.geocube.palette);
    expect(levelCube(w, 'a').palette.id).toBe(levelCube(w, 'b').palette.id);
  });

  it('a world naming both lowers its own palette, moved per level, into each level\'s cube; painted nodes wear it', () => {
    const w = stampWorldPalette(stampGeocubes({ ...base, style: { geocube: 'gothic-night', palette: { seed: 5, heat: 0.8, script: 'dusk' } } }, null, fresh), null, fresh);
    expect(w.style.palette).toEqual({ seed: 5, heat: 0.8, script: 'dusk' });
    const a = levelCube(w, 'a'), b = levelCube(w, 'b');
    expect(a.palette.heat).toBe(0.8);
    expect(a.palette.id).not.toBe(b.palette.id);
    const lv = readLevel(resolveLevel(readGameworld(w), 'a').level);
    expect(Object.values(lv.nodes)[0].kit).toBe(lowerGeocube(a, 'outside').kit);
  });

  it('an old world on a cube, edited, is left as it was', () => {
    const old = { ...base, style: { geocube: 'gothic-night' } }, w = stampWorldPalette(stampGeocubes({ ...old, name: 'x' }, old, fresh), old, fresh);
    expect(w.style).toEqual({ geocube: 'gothic-night' });
    expect(levelCube(w, 'a').colour).toEqual(GEOCUBE_PRESETS['gothic-night'].colour);
  });

  it('cubeInPalette leaves a cube in a world with no palette', () => {
    expect(cubeInPalette('gothic-night', undefined)).toBe('gothic-night');
    expect(cubeInPalette('gothic-night', false)).toBe('gothic-night');
    expect(cubeInPalette('gothic-night', { seed: 2, script: 'dusk' })).toEqual({ from: 'gothic-night', palette: { seed: 2 } });
  });
});

describe('the interpreter stands a composed world on a cube', () => {
  it('the word that names a cube decides it, and the brief says so', () => {
    const w = composeGameworld({ prompt: 'a haunted crypt on rocky hills', seed: 2 });
    expect(w.style.geocube).toBe('gothic-night');
    expect(w.brief.cube).toEqual({ id: 'gothic-night', word: 'haunted' });
    expect(w.brief.read.find((r) => r.word === 'haunted').decides).toContain('geocube');
  });

  it('else the kit\'s nearest, drawn on the kit\'s own card; an airless plain has none', () => {
    const w = composeGameworld({ prompt: 'bamboo forest with tiered temples', seed: 2 });
    expect(w.style.geocube).toEqual('jungle-haze');
    const s = composeGameworld({ prompt: 'a blossom valley with domes', seed: 2 });
    expect(s.style.geocube).toEqual({ from: 'island-noon', outside: { base: 'isekai-sakura' } });
    const m = composeGameworld({ prompt: 'a cratered lunar plain', seed: 2 });
    expect(m.style.geocube).toBeUndefined();
    expect(m.brief.cube.id).toBeNull();
  });
});
