// Driving primitives D2, the sweep: designed laps (with and without a crossing) and stages over seeds, drawn and
// measured. Every one keeps its ground under its footprint, its road at its class's width and bank, and a crossing's
// deck at the class clearance over the lower road.
import { describe, it, expect } from 'vitest';
import { DESIGN_CLASSES } from './classes.js';
import { planTrack, trackCensus } from './track.js';

const LENGTH = { kart: 700, circuit: 2200, rally: 1400 };
const check = (c, tag) => {
  const C = DESIGN_CLASSES[c.class];
  expect(c.terrainOverRoad.max, `${tag} at ${JSON.stringify(c.terrainOverRoad.at)}`).toBeLessThan(-0.02);
  expect(c.roadWidth[0], tag).toBeCloseTo(C.roadW, 2);
  expect(c.bankMax, tag).toBeLessThanOrEqual(C.emax + 1e-3);
  for (const x of c.crossings) expect(x.clearance, tag).toBeGreaterThanOrEqual(C.clearance - 0.01);
};

describe('designed tracks, drawn and measured', () => {
  for (const cls of ['kart', 'circuit', 'rally']) for (const crossing of [false, true]) {
    it(`${cls} laps${crossing ? ', crossing' : ''}`, () => {
      for (let seed = 1; seed <= 8; seed++) {
        const c = trackCensus(planTrack({ form: 'circuit', course: { class: cls, length: LENGTH[cls], twist: 0.6, crossing, seed, ...(crossing ? {} : { elevation: { amplitude: 6, hills: 2 } }) } }));
        check(c, `${cls} ${crossing} seed ${seed}`);
        expect(c.crossings.length).toBe(crossing ? 1 : 0);
      }
    });
  }
  it('rally stages', () => {
    for (let seed = 1; seed <= 8; seed++) check(trackCensus(planTrack({ form: 'stage', course: { class: 'rally', length: 1800, twist: 0.7, elevation: { amplitude: 10, hills: 3, crest: 'sharp' }, seed } })), `stage seed ${seed}`);
  });
});
