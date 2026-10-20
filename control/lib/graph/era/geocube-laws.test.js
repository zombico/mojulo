import { describe, it, expect } from 'vitest';
import { readGeocube, lowerGeocube, geocubePaint, GEOCUBE_PRESETS, GEOCUBE_PALETTES } from './geocube.js';
import { QUIET } from './geocube-laws.js';

// A CUBE'S AVOID LIST: each mistake a style names is measured by a law when the cube is read, and written back on the
// line. Advice, never a refusal; a cube that names none carries none.
const QUIETLY = { line: 'Noisy realistic textures.', law: 'quiet-surfaces' };
const BLACK = { line: 'Flat black where nothing can be read.', law: 'shade-is-colour' };
// a stock preset with no avoid list of its own, and the preset whose list reads a palette law the palette must ask for
const plain = Object.keys(GEOCUBE_PRESETS).find((id) => !GEOCUBE_PRESETS[id].avoid);
const grouped = Object.keys(GEOCUBE_PRESETS).find((id) => GEOCUBE_PRESETS[id].avoid?.some((a) => a.law === 'value-groups'));
const solved = (id, seed, more = {}) => readGeocube({ from: id, palette: { ...GEOCUBE_PALETTES[id], seed }, ...more });

describe('a cube\'s avoid list', () => {
  it('a cube law is measured on the cube: the stock stone is loud, a quiet one passes', () => {
    const loud = readGeocube({ from: plain, avoid: [QUIETLY] }).avoid[0];
    expect(loud).toMatchObject({ law: 'quiet-surfaces', ok: false });
    expect(loud.value).toMatch(/loud: wall/);
    const wall = { ...GEOCUBE_PRESETS[plain].surfaces.wall, vary: QUIET.vary, grain: QUIET.grain };
    const floor = { ...GEOCUBE_PRESETS[plain].surfaces.floor, vary: QUIET.vary, grain: QUIET.grain };
    expect(readGeocube({ from: plain, surfaces: { wall, floor }, avoid: [QUIETLY] }).avoid[0].ok).toBe(true);
  });

  it('a palette law is read off the contract the colours were solved from, and unmeasured without one', () => {
    expect(solved(plain, 3, { avoid: [BLACK] }).avoid[0]).toMatchObject({ law: 'shade-is-colour', ok: true });
    expect(readGeocube({ from: plain, avoid: [BLACK] }).avoid[0]).toMatchObject({ ok: null, value: expect.stringMatching(/unmeasured/) });
  });

  it('value-groups is read only where the palette names its groups', () => {
    const c = solved(grouped, 3);
    expect(c.avoid.find((a) => a.law === 'value-groups')).toMatchObject({ ok: true });
    const { values: _v, ...ungrouped } = GEOCUBE_PALETTES[grouped];
    const d = readGeocube({ from: grouped, palette: { ...ungrouped, seed: 3 } });
    expect(d.avoid.find((a) => a.law === 'value-groups')).toMatchObject({ ok: null, value: expect.stringMatching(/does not read/) });
  });

  it('a preset holds its own list under its own palette', () => {
    for (const seed of [1, 7]) for (const a of solved(grouped, seed).avoid) expect(a.ok, `${a.law}: ${a.value}`).toBe(true);
  });

  it('a cube read again is the same cube, its readout kept', () => {
    const c = solved(grouped, 5);
    expect(readGeocube(c)).toEqual(c);
    const own = readGeocube(grouped);
    expect(readGeocube(own)).toEqual(own);
  });

  it('the readout rides what a level painted by the cube reports', () => {
    const paint = geocubePaint({ geocube: { from: plain, avoid: [QUIETLY] }, meru: true });
    expect(paint.avoid).toEqual([{ law: 'quiet-surfaces', ok: false }]);
  });

  it('a cube that names none carries none, and lowers as it did', () => {
    const c = readGeocube(plain);
    expect(c.avoid).toBeUndefined();
    expect(geocubePaint({ geocube: plain, meru: true }).avoid).toBeUndefined();
    // the list is a readout: it changes nothing the cube lowers to
    const withList = readGeocube({ ...c, avoid: [QUIETLY] });
    expect(JSON.stringify(lowerGeocube(withList, 'inside'))).toBe(JSON.stringify(lowerGeocube(c, 'inside')));
  });

  it('every line names a law that exists', () => {
    expect(() => readGeocube({ from: plain, avoid: [{ line: 'Teal.', law: 'no-teal' }] })).toThrow(/avoid\[0\]\.law 'no-teal' is not a law/);
    expect(() => readGeocube({ from: plain, avoid: [] })).toThrow(/avoid is \[\{ line, law \}\]/);
    expect(() => readGeocube({ from: plain, avoid: [{ line: '', law: 'quiet-surfaces' }] })).toThrow(/line is the mistake/);
  });
});
