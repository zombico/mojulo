// The cube's light (cube-light.js): the palette's colours are targets, and the base colours and one light are solved
// together so the render shows them: lit square to the sun, shaded under the sky alone, one shade tint for every role.
import { describe, expect, it } from 'vitest';
import { cubeLight, skyShare, seen, toneNeutral, untoneNeutral, BASE_MAX, SKY_OVER, SKY_SHARE_MAX } from './cube-light.js';
import { readGeocube } from './geocube.js';

const NOON = readGeocube('island-noon');
const lin = (hex) => untoneNeutral([1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }));

describe('the palette solves the light', () => {
  it('each base under the light shows its colour square to the sun, and its shade under the sky alone', () => {
    const L = cubeLight(NOON);
    expect(L.hour).toBe(L.own);
    for (const r of Object.keys(L.bases)) {
      if (L.targets[r].reached) continue;
      expect(seen(L.linearBases[r], L, 1), r).toBe(NOON.colour[r]);
      expect(seen(L.linearBases[r], L, 0), r).toBe(L.targets[r].shade);
    }
    // one sun: what shade keeps of lit is the same tint for every role
    const T = (r) => lin(L.targets[r].shade).map((v, k) => v / lin(NOON.colour[r])[k]);
    T('stone').forEach((v, k) => expect(v).toBeCloseTo(T('grass')[k], 2));
    // the sun warm, the sky's light cool: the base leans against the sky to show its colour
    const [sr, , sb] = L.sun.linear, [ar, , ab] = L.ambient.linear;
    expect(sr > sb && ab > ar).toBe(true);
    expect(JSON.stringify(cubeLight(NOON))).toBe(JSON.stringify(L));
  });

  it('the light is as bright as the brightest material needs: a darker palette, a dimmer light', () => {
    const L = cubeLight(NOON), dark = cubeLight(readGeocube({ from: 'island-noon', colour: Object.fromEntries(Object.entries(NOON.colour).map(([k, v]) => [k, '#' + [1, 3, 5].map((i) => Math.round(parseInt(v.slice(i, i + 2), 16) * 0.5).toString(16).padStart(2, '0')).join('')])) }));
    expect(dark.sun.level).toBeLessThan(L.sun.level);
    expect(Math.max(...Object.values(L.linearBases).map((b) => 0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2]))).toBeCloseTo(BASE_MAX, 3);
  });

  it('at another hour the materials stay and the light moves; a colour out of the sun\'s reach is held and named', () => {
    const L = cubeLight(NOON), eve = cubeLight(NOON, { hour: 17.5 });
    expect(eve.bases).toEqual(L.bases);
    expect(eve.sun.level).toBeLessThan(L.sun.level);
    expect(eve.sun.elevation).toBeLessThan(L.sun.elevation);
    const blue = cubeLight(readGeocube({ from: 'island-noon', colour: { accent: '#0040ff' } }));
    expect(blue.checks.find((c) => c.role === 'accent')).toMatchObject({ unreached: true });
    expect(blue.targets.accent.reached).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('the tone curve undone gives back what it was given', () => {
    for (const c of [[0.02, 0.1, 0.3], [0.5, 0.6, 0.7], [1.4, 0.9, 0.3]]) untoneNeutral(toneNeutral(c)).forEach((v, k) => expect(v).toBeCloseTo(c[k], 4));
  });

  it('the sky a cube paints is the light it gives: a share its look leaves too small is raised to meet it', () => {
    // a clear noon's sky agrees with its light: the look's own share, the solve as it always was
    const noon = cubeLight(NOON);
    expect(noon.skyLight.rule).toBe('card');
    expect(noon.skyLight.over).toBeLessThanOrEqual(SKY_OVER);
    expect(noon.checks.some((c) => c.sky)).toBe(false);
    // an overcast look paints a sky far brighter than its card's ambient: the sky's share rises, the level stays the
    // palette's, and each colour is still shown square to what sun is left
    const HAZE = readGeocube('jungle-haze'), haze = cubeLight(HAZE);
    expect(haze.skyLight.rule).toBe('sky');
    expect(haze.contrast).toBeGreaterThan(haze.skyLight.card);
    expect(haze.skyLight.over).toBeCloseTo(SKY_OVER, 2);
    expect(haze.ambient.level).toBeGreaterThan(haze.sun.level);
    expect(haze.checks.find((c) => c.sky)).toMatchObject({ rule: 'sky' });
    for (const r of Object.keys(haze.bases)) if (!haze.targets[r].reached) expect(seen(haze.linearBases[r], haze, 1), r).toBe(HAZE.colour[r]);
  });

  it('a sky brighter than anything it lights sets the level, the materials dark under it; a cube\'s own share is kept', () => {
    // (the rule alone: a sky four times the palette's level)
    const S = skyShare({ card: 0.2, painted: 4, level: 1 });
    expect(S).toMatchObject({ rule: 'sky-level', share: SKY_SHARE_MAX });
    expect(S.minLevel).toBeGreaterThan(1);
    expect(S.over).toBeCloseTo(SKY_OVER, 6);
    expect(skyShare({ card: 0.2, painted: 0.6, level: 1 })).toMatchObject({ rule: 'sky', minLevel: 0 });
    expect(skyShare({ card: 0.2, painted: 0.6, level: 1 }).share).toBeCloseTo(0.4, 9);
    expect(skyShare({ card: 0.5, painted: 0.6, level: 1 })).toMatchObject({ rule: 'card', share: 0.5 });
    // on a cube: its palette dimmed under its own sky, no base reaches BASE_MAX
    const dim = cubeLight(readGeocube({ from: 'jungle-haze', colour: Object.fromEntries(Object.entries(readGeocube('jungle-haze').colour).filter(([, v]) => /^#/.test(v)).map(([k, v]) => [k, '#' + [1, 3, 5].map((i) => Math.round(parseInt(v.slice(i, i + 2), 16) * 0.6).toString(16).padStart(2, '0')).join('')])) }));
    expect(dim.skyLight.rule).toBe('sky-level');
    expect(Math.max(...Object.values(dim.linearBases).map((b) => 0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2]))).toBeLessThan(BASE_MAX - 0.01);
    // its own share: kept as written, the sky only read against it
    const own = cubeLight(readGeocube({ from: 'jungle-haze', light: { skyShare: 0.3 } }));
    expect(own.contrast).toBe(0.3);
    expect(own.skyLight.rule).toBe('own');
    expect(() => readGeocube({ from: 'jungle-haze', light: { skyShare: 1.2 } })).toThrow(/skyShare/);
  });
});
