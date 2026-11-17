// AN INDUSTRIAL YARD, DESIGNED (facility.js). One yard: a window of the first industrial segment this metro has a block
// of, small and grown briefly. The concepts: the search answers with a yard that has the place's own things standing in
// it, grown under the laws no worse than it was read, one ground and bounded, and with where it stands; the same search
// answers the same.
import { describe, expect, it } from 'vitest';
import { designFacility } from './facility.js';
import { cityGround, readGroundMap } from './read-town.js';
import { mapLaws } from './laws.js';
import { designGeocity } from '../geocity/design.js';
import { INDUSTRY_SEGMENTS } from '../geocity/segments.js';

const CITY = designGeocity({}, { seed: 1 });
const ON = INDUSTRY_SEGMENTS.find((k) => CITY.regions.flatMap((r) => r.blocks ?? []).some((b) => b.kind === k));

describe('a yard, designed', () => {
  const opts = { seed: 1, on: ON, design: CITY, size: 30, most: 1, passes: 200 }, F = designFacility({}, opts);
  it(`(${ON}) is a window of the block with the place's own things standing in it, grown under the laws, and says where it stands`, () => {
    expect(F.on).toBe(ON);
    expect(F.kinds.length).toBeGreaterThan(0);
    expect(F.map.read.things.some((t) => !t.beyond)).toBe(true);
    expect(F.at).toHaveLength(2);
    const read = readGroundMap(cityGround(CITY, { on: ON }), { at: F.at, size: 30 });
    expect(F.held).toBeGreaterThanOrEqual(mapLaws(read).held);
    expect(F.laws.find((l) => l.law === 'connected').holds && F.laws.find((l) => l.law === 'bounded').holds).toBe(true);
    // (what the place is made of is kept: every mass of the reading is a mass of the yard)
    const solid = new Set(F.map.solids.map((c) => c.join()));
    for (const c of read.solids) expect(solid.has(c.join())).toBe(true);
    expect(designFacility({}, opts).at).toEqual(F.at);
  }, 240000);
});
