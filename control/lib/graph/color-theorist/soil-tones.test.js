/**
 * The two dirts of a floor (color-theorist/ground.js soilTones): powder lighter and quieter, its hue toward the light's;
 * clay darker and fuller, its hue toward red; the floor between them.
 */
import { describe, expect, it } from 'vitest';

import { soilTones } from './ground.js';
import { lchOf, hexToRgb, hueGap } from './oklab.js';

const lch = (h) => lchOf(hexToRgb(h));

describe('soilTones', () => {
  it('powder lighter and quieter toward the light, clay darker and fuller toward red, the floor between', () => {
    const floor = '#c4875a', light = '#fff4d8', { powder, clay } = soilTones(floor, light), [L, C, h] = lch(floor);
    const P = lch(powder), Q = lch(clay);
    expect(P[0]).toBeGreaterThan(L);
    expect(P[1]).toBeLessThan(C);
    expect(Q[0]).toBeLessThan(L);
    expect(Q[1]).toBeGreaterThan(C);
    expect(hueGap(P[2], lch(light)[2])).toBeLessThan(hueGap(h, lch(light)[2]));
    expect(hueGap(Q[2], 32)).toBeLessThan(hueGap(h, 32));
    expect(Math.abs((P[0] + Q[0]) / 2 - L)).toBeLessThan(0.01);
    // (and humus, the soil under living cover: darker and quieter than the clay)
    const Hm = lch(soilTones(floor, light).humus);
    expect(Hm[0]).toBeLessThan(Q[0]);
    expect(Hm[1]).toBeLessThan(C);
  });

  it('with no light named, powder keeps the floor\'s hue', () => {
    const { powder } = soilTones('#9a7a58');
    expect(hueGap(lch(powder)[2], lch('#9a7a58')[2])).toBeLessThan(2);
  });

  it('match brings the clay to the powder: its hue, fullness and light the powder\'s, a worn shade darker; none, as it was', () => {
    const floor = '#8f8f7a', light = '#ffe0c0', T0 = soilTones(floor, light), P = lch(T0.powder), Q0 = lch(T0.clay);
    expect(soilTones(floor, light, { match: 0 })).toEqual(T0);
    const Q1 = lch(soilTones(floor, light, { match: 1 }).clay), Qh = lch(soilTones(floor, light, { match: 0.5 }).clay);
    expect(hueGap(Q1[2], P[2])).toBeLessThan(2);
    expect(Math.abs(Q1[1] - P[1])).toBeLessThan(0.01);
    expect(Q1[0]).toBeLessThan(P[0]);
    expect(P[0] - Q1[0]).toBeLessThan(0.05);
    expect(Q1[0]).toBeGreaterThan(Q0[0]);
    expect(hueGap(Qh[2], P[2])).toBeLessThan(hueGap(Q0[2], P[2]));
    expect(soilTones(floor, light, { match: 1 }).powder).toBe(T0.powder);
  });
});
