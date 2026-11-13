/**
 * The far lift (channels/far-lift.js): the grass past the reach given its height, the ground drawn again. Claims under
 * test: a longer sward stands taller; a page that does not ask for it carries none of it; one that asks carries the
 * lift after the far field it reads, cut to where the blanket is and risen from the reach.
 */
import { describe, expect, it } from 'vitest';

import { FAR_LIFT, liftField, farLiftScript, readFarLift } from './far-lift.js';
import { formLandScript } from './form-land.js';

const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };

describe('the far lift', () => {
  it('stands to the mean of the grass that is there: tall where it is tall and thick, lower where it is sparse, nothing where there is none', () => {
    // (a map: tall grass on every cell at the left, on every other cell in the middle, none at the right)
    const nx = 30, ny = 12, h8 = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) h8[j * nx + i] = i < 10 ? 200 : i < 20 ? ((i + j) % 2 ? 200 : 0) : 0;
    const L = liftField(h8, nx, ny, 2), at = (i) => L[6 * nx + i];
    expect(at(4)).toBe(200);
    expect(at(15)).toBeGreaterThan(80); expect(at(15)).toBeLessThan(120);
    expect(at(26)).toBe(0);
    // (and it falls from one to the next over the radius, never a step)
    for (let i = 5; i < 25; i++) expect(Math.abs(at(i + 1) - at(i))).toBeLessThan(60);
    expect(Array.from(liftField(h8, nx, ny, 2))).toEqual(Array.from(L));
    expect(FAR_LIFT.least).toBeLessThan(FAR_LIFT.wall);
  });
  it('is absent unless asked', () => {
    expect(farLiftScript(null)).toBe('');
    expect(readFarLift(undefined)).toBe(null); expect(readFarLift(false)).toBe(null); expect(readFarLift(true)).toEqual({});
    expect(() => readFarLift({ height: 2 })).toThrow(/farLift/);
    expect(formLandScript(land)).not.toContain('--- the far lift');
    expect(formLandScript(land)).not.toContain('window.__formFarLift =');
  });
  it('asked for, is the ground drawn again after the far field, cut to the blanket and risen from the reach', () => {
    const page = formLandScript({ ...land, farLift: true }), at = page.indexOf('--- the far lift');
    expect(at).toBeGreaterThan(page.indexOf('--- the far field'));
    const lift = page.slice(at);
    expect(lift).toContain('q.geometry.attributes.splat');
    expect(lift).toContain('window.__formFar, fd = FF.tex.image.data');
    expect(lift).toContain('farBlanket( vLiftP');
    expect(lift).toContain('transformed.z += liftAt(');
    expect(lift).toContain('window.__formFarLift');
  });
});
