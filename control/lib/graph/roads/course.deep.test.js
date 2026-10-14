// Driving primitives D1, the sweep: every class × twist × crossing over thirty seeds. Each design closes, holds its
// class's corners, grades and banks, and keeps clear of itself (a figure of eight crossing once, over its deck).
import { describe, it, expect } from 'vitest';
import { DESIGN_CLASSES } from './classes.js';
import { designRoadway, selfClearance } from './course.js';

const LENGTH = { kart: 700, circuit: 2500, rally: 1500 };

describe('the designer over seeds', () => {
  for (const cls of ['kart', 'circuit', 'rally']) for (const twist of [0, 0.5, 1]) for (const crossing of [false, true]) {
    it(`${cls}, twist ${twist}${crossing ? ', crossing' : ''}`, () => {
      const C = DESIGN_CLASSES[cls];
      for (let seed = 1; seed <= 30; seed++) {
        const c = designRoadway({ class: cls, length: LENGTH[cls], twist, crossing, seed, elevation: crossing ? null : { amplitude: 6, hills: 2 } });
        const a = c.alignment, tag = `${cls} ${twist} ${crossing} seed ${seed}`;
        expect(c.advisories.filter((x) => x.startsWith('no seed')), tag).toEqual([]);
        expect(a.closure.residual, tag).toBeLessThan(0.01);
        for (const p of a.stations({ fine: 4, coarse: 10 })) {
          if (Math.abs(p.k) > 1e-9) expect(1 / Math.abs(p.k), tag).toBeGreaterThanOrEqual(C.rmin - 1e-6);
          expect(Math.abs(p.grade), tag).toBeLessThanOrEqual(C.gradeMax + 1e-9);
          expect(p.e, tag).toBeLessThanOrEqual(C.emax + 1e-9);
        }
        const sc = selfClearance(a, { width: c.footprint, margin: 1 });
        expect(sc.conflicts, tag).toEqual([]);
        expect(sc.crossings.length, tag).toBe(crossing ? 1 : 0);
        if (crossing) expect(sc.crossings[0].dz, tag).toBeGreaterThanOrEqual(C.clearance);
      }
    });
  }
});
