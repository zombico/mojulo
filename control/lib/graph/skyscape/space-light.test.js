import { describe, expect, it } from 'vitest';

import { assembleAirspace } from './airspace.js';
import { SPACE_STAR } from './space.js';
import { formLight, skyMood, SPACE_MOOD } from '../car-designer/form-light.js';
import { skyDomeScript } from '../scene/channels/sky-dome.js';

// ── the light in space (car-designer/form-light.js SPACE_MOOD, space.js SPACE_STAR) ─────────────────────────────────────
// One star, seen where its light comes from; a craft lit by it alone, its shade side dark and never black, its rim
// carrying the silhouette against the void; the sky at infinity, flown through and never past.

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const M = { kind: 'airspace', map: { craft: 'fighter', field: 3000 }, space: { asteroids: 'sparse' }, seed: 3 };

describe('the light in space', () => {
  it('draws its star where the rocks are lit from, and holds its sky at infinity', () => {
    const page = assembleAirspace(M, {});
    expect(page.sky).toMatchObject({ space: true, follow: true });
    expect(page.sky.sun.dir).toEqual([...SPACE_STAR.dir]);
    expect(Math.hypot(...SPACE_STAR.dir)).toBeCloseTo(1, 3);
    // (the star is up: the rocks' light falls from it, z-up)
    expect(SPACE_STAR.dir[2]).toBeGreaterThan(0.5);
  });

  it('lights a body under a space sky by the star alone: its key from the star, no sky and no ground to fill it', () => {
    const mood = skyMood({ space: true, sun: { dir: [0, 0, 2] } });
    expect(mood.toLight).toEqual([0, 0, 1]);
    const F = formLight(mood, {}), noon = formLight(null, {});
    // a harder key than a day's, under no air
    expect(F.keyIntensity).toBeGreaterThan(noon.keyIntensity);
    expect(Math.min(...F.key)).toBeGreaterThan(0.85);                    // a white star, near enough
    // its fill the galaxy's faint glow, written in the body's own light: the key side over ten times the shade side
    const wall = (lum(F.hemi.sky) + lum(F.hemi.ground)) / 2;
    expect((0.8 * F.keyIntensity) / (Math.PI * wall)).toBeGreaterThan(10);
    // dark, never black: a light grey hull's shade side over the cast rig's floor (OKLab L 0.27 of a grey's luminance)
    expect(Math.cbrt(0.5 * wall)).toBeGreaterThan(0.2);
    // the void reflected, the rim cool and carrying the outline
    expect(Math.max(...F.sky.zenith, ...F.sky.horizon, ...F.sky.ground)).toBeLessThan(30);
    expect(F.rim.linear[2]).toBeGreaterThan(F.rim.linear[0]);
    expect(F.rim.strength).toBeGreaterThan(0);
  });

  it('leaves every other body as it was: a day sky, an absent one', () => {
    expect(skyMood(null)).toBe(null);
    const day = formLight(skyMood({ zenith: [96, 138, 190], horizon: [198, 207, 218], day: 1 }), {});
    expect(day.hemi).toBeUndefined();
    expect(day.rim).toBeUndefined();
    expect(day.keyIntensity).toBe(formLight(null, {}).keyIntensity);
    expect(SPACE_MOOD.level).toBeGreaterThan(2.6);
  });

  it('rides the sky with the eye only where it is asked: another sky is drawn as it was', () => {
    const base = { space: true, zenith: [], horizon: [], day: 0, stars: 1, seed: 7, center: [0, 0, 0], radius: 7000, sun: { dir: [0, 0, 1] } };
    expect(skyDomeScript(base)).not.toContain('__skyFollow');
    const s = skyDomeScript({ ...base, follow: true });
    expect(s).toContain('const __skyFollow = ');
    expect(s.match(/__skyFollow\(/g)).toHaveLength(2);                   // the stars, the star
  });
});
