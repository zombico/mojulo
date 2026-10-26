import { describe, expect, it } from 'vitest';

import { REGISTERS, expandRegister, checkRegister, registerInks, registerCreases, registerInkLaw } from './colour-register.js';
import { readGeocube, geocubeRegisterOf, GEOCUBE_PRESETS } from './geocube.js';
import { GRIT_PIXELS } from '../local-meru/plan.js';
import { CUBE_LAWS } from './geocube-laws.js';
import { lchOf, hexToRgb } from '../color-theorist/oklab.js';

const no = (m) => { throw new Error(m); };
const L = (hex) => lchOf(hexToRgb(hex))[0];

describe('the colour register: names and terms', () => {
  it('a name expands to its terms over the cube\'s own register, keeping its key; changes win term by term', () => {
    expect(expandRegister('cel', { steps: 0, key: 0.42 }, no)).toEqual({ key: 0.42, ...REGISTERS.cel, name: 'cel' });
    expect(expandRegister({ from: 'cel', steps: 4 }, { key: 0.5 }, no)).toMatchObject({ steps: 4, key: 0.5, outline: true, name: 'cel' });
    const plain = { steps: 2, key: 0.4 };
    expect(expandRegister(plain, {}, no)).toBe(plain);
    expect(() => expandRegister('noir', {}, no)).toThrow(/register 'noir' is not one/);
  });

  it('checks what it cannot draw, naming the term', () => {
    const ok = { steps: 3, key: 0.5 };
    expect(() => checkRegister({ ...ok, glow: 1 }, no)).toThrow(/register\.glow is not a setting/);
    expect(() => checkRegister({ ...ok, outline: { width: 9 } }, no)).toThrow(/outline\.width/);
    expect(() => checkRegister({ ...ok, creases: { reach: 0 } }, no)).toThrow(/register\.creases\.reach/);
    expect(() => checkRegister({ ...ok, contrast: 'n64' }, no)).toThrow(/register\./);
    expect(() => checkRegister({ ...ok, steps: 9 }, no)).toThrow(/register\.steps/);
  });

  it('a cube reads a named register; a cube that names none reads as it always did', () => {
    for (const id of Object.keys(GEOCUBE_PRESETS)) expect(readGeocube(id).register).toEqual(GEOCUBE_PRESETS[id].register);
    const cel = readGeocube({ from: 'valley-morning', register: 'cel' });
    expect(cel.register).toMatchObject({ name: 'cel', steps: 3, key: GEOCUBE_PRESETS['valley-morning'].register.key, outline: true });
    // read again (a stored cube), the same
    expect(readGeocube(cel).register).toEqual(cel.register);
  });

  it('a register lends its contrast to a cube that names none, and never over the cube\'s own', () => {
    expect(readGeocube('gothic-night').contrast).toBeUndefined();
    expect(readGeocube({ from: 'gothic-night', register: 'wii' }).contrast).toBe('wii');
    expect(readGeocube({ from: 'upland-morning', register: 'wii' }).contrast).toEqual(readGeocube('upland-morning').contrast);
  });
});

describe('the colour register: its inks', () => {
  it('inks under every ramp\'s darkest stop, the creases in the shade\'s hue family (register-ink)', () => {
    for (const from of ['valley-morning', 'gothic-night']) {
      const cube = readGeocube({ from, register: 'cel' });
      const inks = registerInks(cube);
      expect(L(inks.outline)).toBeLessThan(0.2);
      expect(L(inks.creases)).toBeLessThan(0.2);
      expect(registerInkLaw(cube).ok).toBe(true);
      expect(CUBE_LAWS['register-ink'].test(cube).ok).toBe(true);
    }
  });

  it('a written ink too bright to read as ink fails the law', () => {
    const cube = readGeocube({ from: 'valley-morning', register: { from: 'cel', creases: { ink: '#d0c8b0' } } });
    const r = registerInkLaw(cube);
    expect(r.ok).toBe(false);
    expect(r.value).toMatch(/creases not under it/);
  });

  it('the crease pass\'s terms: none for a register without ink; the outline alone draws no crease', () => {
    expect(registerCreases(readGeocube('valley-morning'))).toBeNull();
    expect(registerCreases(readGeocube({ from: 'valley-morning', register: 'continuous' }))).toBeNull();
    const only = registerCreases(readGeocube({ from: 'valley-morning', register: { steps: 3, key: 0.5, outline: { width: 2 } } }));
    expect(only).toMatchObject({ line: 0, wash: 0, outline: { width: 2 } });
    expect(registerCreases(readGeocube({ from: 'valley-morning', register: 'wii' })).outline).toBeUndefined();
  });

  it('a gritty cube whose register names no creases draws the wii register\'s; its own creases, or false, win', () => {
    const gritty = Object.keys(GEOCUBE_PRESETS).find((id) => readGeocube(id).grit >= GRIT_PIXELS), cube = readGeocube(gritty);
    expect(cube.register.creases).toBeUndefined();
    expect(registerCreases(cube)).toMatchObject({ ...REGISTERS.wii.creases, ink: registerInks(cube).creases });
    expect(registerCreases(readGeocube({ from: gritty, grit: GRIT_PIXELS / 2 }))).toBeNull();
    expect(registerCreases(readGeocube({ from: gritty, register: { ...cube.register, creases: false } }))).toBeNull();
    expect(registerCreases(readGeocube({ from: gritty, register: 'cel' }))).toMatchObject(REGISTERS.cel.creases);
    expect(registerInkLaw(cube).ok).toBe(true);
  });

  it('a world manifest takes its cube\'s register (a geocube, a stage\'s geocube, a city\'s paint); a hero\'s none', () => {
    const cube = { from: 'gothic-night', register: 'ink-wash' };
    const want = registerCreases(readGeocube(cube));
    expect(geocubeRegisterOf({ kind: 'geocube', cube, show: 'room' })).toEqual(want);
    expect(geocubeRegisterOf({ kind: 'stage', geocube: cube })).toEqual(want);
    expect(geocubeRegisterOf({ kind: 'city', paint: { geocube: cube } })).toEqual(want);
    expect(geocubeRegisterOf({ kind: 'layered', hero: { geocube: cube } })).toBeNull();
    expect(geocubeRegisterOf({ kind: 'floorplan' })).toBeNull();
  });
});
