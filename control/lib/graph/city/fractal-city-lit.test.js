import { describe, it, expect } from 'vitest';
import { assembleFractalCityScene, planFractalCity } from './fractal-city.js';

// The lit handoff (unreal-demo D2): under `unshaded` the bakes stand down, but the recipe's
// DECLARATION travels — the sky preset and the lamp heads as point emitters — so an engine's
// own sun / sky / local lights perform what the recipe said. The shaded path is untouched.
const opts = { seed: 3, depth: 1, region: { x: 0, y: 0, w: 30, d: 18 }, time: 'night' };

describe('fractal-city lit handoff — the declaration travels under unshaded', () => {
  it('unshaded night: sky preset rides the payload; lamp heads ride `lights` (capped like the bake)', () => {
    const lit = assembleFractalCityScene({ ...opts, unshaded: true });
    expect(lit.sky).toEqual({ preset: 'night', stars: true, moon: true, seed: 3 });
    const heads = planFractalCity(opts).sources;
    if (heads.length) {
      expect(lit.lights).toHaveLength(Math.min(heads.length, 20));
      expect(lit.lights[0]).toMatchObject({ name: 'lamp-0', type: 'point', position: heads[0].pos });
      expect(lit.lights.every((l) => l.intensity > 0 && Array.isArray(l.color))).toBe(true);
    } else {
      expect(lit.lights).toBeUndefined();
    }
  });

  it('unshaded with no time declared: no sky, no lights (byte-identical to the pre-D2 lit pack)', () => {
    const lit = assembleFractalCityScene({ ...opts, time: undefined, unshaded: true });
    expect(lit.sky).toBeUndefined();
    expect(lit.lights).toBeUndefined();
  });

  it('shaded night: the sky is the same as before and no `lights` row appears (the bake owns the lamps)', () => {
    const shaded = assembleFractalCityScene(opts);
    expect(shaded.sky).toEqual({ preset: 'night', stars: true, moon: true, seed: 3 });
    expect(shaded.lights).toBeUndefined();
    expect(assembleFractalCityScene({ ...opts, unshaded: false }).faces).toEqual(shaded.faces);
  });
});
