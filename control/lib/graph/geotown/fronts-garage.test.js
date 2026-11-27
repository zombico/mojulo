// A GARAGE UNDER THE HOUSE (fronts.js `garage`, the Avenues'): its door in the ground storey on the side away from the
// house's own door, where a bay would stand; none where that side is too narrow for a car; a front without one is the
// front it was. And the two San Francisco cards that wear it and not: one block of each, built.
import { describe, it, expect } from 'vitest';
import { frontOf, FRONT } from './fronts.js';
import { assembleGeotownScene } from './scene.js';

const house = { W: 7.6, n: 2, storeyH: 3, doorX: 1.3, doorW: 1 };
const doors = (F) => F.faces.filter((f) => f.role === 'door');

describe('a garage under the house', () => {
  it('stands its door in the ground storey, away from the house\'s door, a car wide', () => {
    const F = frontOf({ garage: true }, house), [g] = doors(F), xs = g.corners.map((c) => c[0]), zs = g.corners.map((c) => c[2]);
    expect(doors(F)).toHaveLength(1);
    expect(Math.min(...zs)).toBe(0);
    expect(Math.max(...zs)).toBe(FRONT.garage.h);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThanOrEqual(FRONT.garage.least);
    expect(Math.min(...xs)).toBeGreaterThan(house.doorX + house.doorW / 2);
  });

  it('is none where the side is too narrow, and a front without one is as it was', () => {
    expect(doors(frontOf({ garage: true }, { ...house, W: 4.2 }))).toHaveLength(0);
    expect(JSON.stringify(frontOf({ bay: 'square', bayStoreys: 'upper', garage: false }, house))).toBe(JSON.stringify(frontOf({ bay: 'square', bayStoreys: 'upper' }, house)));
  });
});

describe('the San Francisco cards', () => {
  const block = (pattern) => assembleGeotownScene({ kind: 'geocube', cube: 'valley-morning', show: 'geotown', seed: 3, geotown: { pattern, evoke: 'segment' } });
  it('a Victorian block and an Avenues block build within their laws, the Avenues\' houses over their garages', () => {
    for (const pattern of ['san-francisco', 'sunset']) {
      const P = block(pattern);
      expect(P.geotown.laws.filter((l) => !l.ok).map((l) => l.law), pattern).toEqual([]);
      expect(P.geotown.counts.houses, pattern).toBeGreaterThan(0);
    }
  }, 180_000);
});
