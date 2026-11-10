import { describe, it, expect } from 'vitest';
import { designGeotown, DRIVE_STAND } from './design.js';
import { readGeotown, ACCESS_IDS } from './read.js';
import { PATTERNS, DEFAULT_PATTERN } from './pattern.js';

const law = (d, id) => d.laws.find((l) => l.law === id);
const houses = (d) => d.plots.filter((pl) => pl.kind === 'houses' && pl.form !== 'mansion');
const inside = (r, [u0, v0, u1, v1]) => u0 >= r[0] - 1e-6 && v0 >= r[1] - 1e-6 && u1 <= r[2] + 1e-6 && v1 <= r[3] + 1e-6;

describe('a houses block\'s access: how its households reach their cars', () => {
  it('reads the town\'s word and a block\'s, and refuses what is off them', () => {
    expect(ACCESS_IDS).toEqual(['none', 'lane', 'mutual', 'compact', 'alley']);
    expect(readGeotown({ access: 'compact' }).access).toBe('compact');
    expect('access' in readGeotown({})).toBe(false);
    expect(readGeotown({ evoke: 'metro', grid: [2, 1], blocks: { B1: { access: 'alley' } } }).blocks.B1.access).toBe('alley');
    expect(() => readGeotown({ access: 'garage' })).toThrow(/access is none, lane .* compact .* alley/);
    expect(() => readGeotown({ evoke: 'metro', grid: [1, 1], blocks: { A1: { access: 'carport' } } })).toThrow(/blocks.A1.access is/);
    // (the pattern's dice keep their old shares: a town that asks neither rolls as it did)
    const A = PATTERNS[DEFAULT_PATTERN].access;
    expect([A.compact, A.alley]).toEqual([0, 0]);
  });

  it('lays a COMPACT block: each house its own drive from the walk to its one-car garage beside it', () => {
    for (const d of [designGeotown({ access: 'compact' }, { seed: 3 }), designGeotown({ evoke: 'metro', grid: [1, 1], access: 'compact' }, { seed: 4 })]) {
      expect(d.laws.filter((l) => !l.ok)).toEqual([]);
      const H = houses(d), G = d.pattern.access.single;
      expect(H.length).toBeGreaterThan(3);
      // (no mansion on a compact block: its lots are its drives' and its garages')
      expect(d.plots.some((pl) => pl.form === 'mansion')).toBe(false);
      for (const pl of H) {
        const { strip, garage, side } = pl.drive, env = pl.house.env;
        expect(strip[1] - strip[0]).toBeCloseTo(G.w, 3);
        // the garage beside the house, against its wall, its door a little back of the house's front
        expect(side === 'L' ? garage[2] : garage[0]).toBeCloseTo(side === 'L' ? env[0] : env[2], 3);
        expect(garage[1]).toBeCloseTo(env[1] + G.set, 3);
        expect(garage[3]).toBeLessThanOrEqual(env[3] + 1e-6);
        expect(inside([0, 0, pl.w, pl.d], garage)).toBe(true);
        // a semi's on its outer side, the pair's garages either end of it
        if (pl.form === 'semi') expect(side).toBe(pl.half);
        // the house still a dwelling's width, its path clear of its drive
        expect(env[2] - env[0]).toBeGreaterThanOrEqual(5.5);
        expect(Math.abs(pl.path.u - (strip[0] + strip[1]) / 2)).toBeGreaterThan(G.w / 2 + pl.path.w / 2);
      }
      // its drives cut the kerb's stalls, and no front pad besides
      expect(d.parking.pads).toBe(0);
      expect(d.parking.singles).toBe(H.length);
      expect(d.parking.stands).toBe(H.filter((pl) => pl.drive.garage[1] >= DRIVE_STAND).length);
      const cuts = Object.values(d.parking.cuts).flat();
      expect(cuts.length).toBeGreaterThanOrEqual(H.length);
    }
  });

  it('lays an ALLEY block: a rear lane, every house its one-car garage off it behind an apron', () => {
    const d = designGeotown({ evoke: 'metro', grid: [1, 1], access: 'alley' }, { seed: 4 });
    expect(d.laws.filter((l) => !l.ok)).toEqual([]);
    expect(d.blocks[0].lane).toBeDefined();
    const H = houses(d), G = d.pattern.access.single;
    expect(H.every((pl) => pl.alley)).toBe(true);
    for (const pl of H) {
      const { garage, apron } = pl.alley;
      // the apron from the garage's door to the plot's back line, on the lane; the garden kept before the garage
      expect(apron[3]).toBeCloseTo(pl.d, 3);
      expect(apron[1]).toBeCloseTo(garage[3], 3);
      expect(apron[3] - apron[1]).toBeCloseTo(d.pattern.access.apron, 3);
      expect(garage[2] - garage[0]).toBeCloseTo(G.w, 3);
      expect(garage[1] - pl.house.env[3]).toBeGreaterThanOrEqual(2 - 1e-6);
      // no drive across its front: the street's front yards whole
      expect(pl.drive ?? pl.park ?? pl.mutual).toBeUndefined();
    }
    expect(d.parking.singles).toBe(H.length);
    // (its households' cars off the street: the parking law counts a garage and an apron each)
    expect(law(d, 'parking').value).toMatch(/drives/);
  });

  it('takes a block\'s own word over the town\'s, and the ledger closes either way', () => {
    const d = designGeotown({ evoke: 'metro', grid: [2, 1], access: 'compact', blocks: { B1: { access: 'alley' } } }, { seed: 2 });
    expect(houses(d).filter((pl) => pl.block === 'A1').every((pl) => pl.drive)).toBe(true);
    expect(houses(d).filter((pl) => pl.block === 'B1').some((pl) => pl.alley)).toBe(true);
    expect(houses(d).filter((pl) => pl.block === 'B1').some((pl) => pl.drive)).toBe(false);
    expect(law(d, 'closes').ok).toBe(true);
    expect(d.ledger.town.drive).toBeGreaterThan(0);
  });
});
