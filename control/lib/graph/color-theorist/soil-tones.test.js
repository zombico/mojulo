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
});
