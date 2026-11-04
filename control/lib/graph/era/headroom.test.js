import { describe, it, expect } from 'vitest';
import { AWNING_CLEAR, BODY_HEIGHT, clearUnits } from './headroom.js';
import { frontOf, FRONT } from '../geotown/fronts.js';
import { cafeOf } from '../geotown/sites.js';
import { makeFacade, buildingExtras } from '../architecture/building-facade.js';

const lowest = (faces) => Math.min(...faces.flatMap((f) => f.corners.map((c) => c[2])));

// every shade walked under clears the base model by half a body
describe('headroom: an awning clears the base model by half a body', () => {
  it('is the base model and half again', () => {
    expect(AWNING_CLEAR).toBeCloseTo(BODY_HEIGHT * 1.5, 9);
    expect(clearUnits(3.66) * 3.66).toBeCloseTo(AWNING_CLEAR, 9);
  });

  it('a shopfront\'s awning of each form, on a short storey and a tall one, clears it; a tall storey keeps its own', () => {
    for (const awning of ['slope', 'flat', 'round']) for (const storeyH of [3, 4.2]) {
      const F = frontOf({ shop: { awning } }, { W: 8, n: 3, storeyH, doorX: 4, doorW: 1.2 }).faces, canvas = F.filter((f) => f.role === 'canvas' || f.role === 'canopy');
      expect(canvas.length, `${awning} ${storeyH}`).toBeGreaterThan(0);
      expect(lowest(canvas), `${awning} ${storeyH}`).toBeGreaterThanOrEqual(AWNING_CLEAR - 1e-9);
    }
    // (a slope hung from a tall storey's glazing already clears: it hangs where it did)
    const tall = frontOf({ shop: { awning: 'slope' } }, { W: 8, n: 3, storeyH: 5, doorX: 4, doorW: 1.2 }).faces.filter((f) => f.role === 'canvas');
    expect(Math.max(...tall.flatMap((f) => f.corners.map((c) => c[2])))).toBeCloseTo(5 - FRONT.shop.head + 0.05, 6);
  });

  it('a cafe\'s parasol clears it', () => {
    expect(lowest(cafeOf(0, 0).filter((f) => f.role === 'canvas'))).toBeGreaterThanOrEqual(AWNING_CLEAR - 1e-9);
  });

  it('a city facade\'s awning and shopfront canopy clear it in the city\'s units, on its shortest storey', () => {
    const f = { ...makeFacade(7), awning: true, storefront: true, noEntrance: false, floorH: 0.78 };
    const X = buildingExtras({ x: 0, y: 0, w: 6, d: 4, z0: 0, z1: 0.78 * 4 }, f, 4, 3);
    const shades = X.boxes.filter((b) => b.d === 0.55 || b.d === 0.34);
    expect(shades.length).toBeGreaterThan(0);
    for (const b of shades) expect(b.z0).toBeGreaterThanOrEqual(clearUnits(3.66) - 1e-9);
  });
});
