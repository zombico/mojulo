/**
 * The far lift (channels/far-lift.js): the grass past the reach given its height, the ground drawn again. Claims under
 * test: a longer sward stands taller; a page that does not ask for it carries none of it; one that asks carries the
 * lift after the far field it reads, cut to where the blanket is and risen from the reach.
 */
import { describe, expect, it } from 'vitest';

import { FAR_LIFT, FAR_LIFT_HEIGHTS, farLiftScript, readFarLift } from './far-lift.js';
import { formLandScript } from './form-land.js';

const land = { light: { sun: [1, 1, 1], ambient: [0.2, 0.2, 0.2] } };

describe('the far lift', () => {
  it('stands a longer sward taller', () => {
    const [tall, medium, short] = FAR_LIFT_HEIGHTS;
    expect(tall).toBeGreaterThan(medium); expect(medium).toBeGreaterThan(short); expect(short).toBeGreaterThan(0);
    expect(FAR_LIFT.stand).toBeGreaterThan(0);
  });
  it('is absent unless asked', () => {
    expect(farLiftScript(null)).toBe('');
    expect(readFarLift(undefined)).toBe(null); expect(readFarLift(false)).toBe(null); expect(readFarLift(true)).toEqual({});
    expect(() => readFarLift({ height: 2 })).toThrow(/farLift/);
    expect(formLandScript(land)).not.toContain('far lift');
  });
  it('asked for, is the ground drawn again after the far field, cut to the blanket and risen from the reach', () => {
    const page = formLandScript({ ...land, farLift: true }), at = page.indexOf('--- the far lift');
    expect(at).toBeGreaterThan(page.indexOf('--- the far field'));
    const lift = page.slice(at);
    expect(lift).toContain('q.geometry.attributes.splat');
    expect(lift).toContain('farBlanket( vLiftP');
    expect(lift).toContain('transformed.z += liftAt(');
    expect(lift).toContain('window.__formFarLift');
  });
});
