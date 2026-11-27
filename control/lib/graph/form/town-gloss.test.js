// What a town's glass gives back (town-gloss.js): the sky a page paints taken back to the renderer's linear light as
// the form render's environment, the town's glazed groups as its surfaces; nothing without a sky or a gloss.
import { describe, it, expect } from 'vitest';
import { townReflect, TOWN_GLOSS } from './town-gloss.js';
import { SKY_ENV } from '../scene/page-light.js';

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('a town\'s glass under its sky', () => {
  it('lays the painted sky as its environment, linear, the ground under it the horizon\'s share; its gloss its surfaces', () => {
    const R = townReflect({ zenith: [60, 98, 150], horizon: [227, 189, 154] }, { 'geocity:glass': TOWN_GLOSS.window });
    expect(R.surfaces).toEqual({ 'geocity:glass': TOWN_GLOSS.window });
    expect(lum(R.env.horizon)).toBeGreaterThan(lum(R.env.zenith));
    R.env.ground.forEach((v, k) => expect(v).toBeCloseTo(R.env.horizon[k] * SKY_ENV.ground, 4));
    // (a curtain wall gives back more of the sky than a window, and is smoother)
    expect(TOWN_GLOSS.curtain.metal).toBeGreaterThan(TOWN_GLOSS.window.metal);
    expect(TOWN_GLOSS.curtain.rough).toBeLessThanOrEqual(TOWN_GLOSS.window.rough);
  });

  it('is nothing without a sky or a gloss', () => {
    expect(townReflect(null, { a: TOWN_GLOSS.window })).toBe(null);
    expect(townReflect({ zenith: '#3c6296', horizon: '#e3bd9a' }, {})).toBe(null);
  });
});
