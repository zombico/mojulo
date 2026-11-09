import { describe, it, expect } from 'vitest';
import { profileStreets, PROFILE } from './profile.js';
import { designGeotown } from './design.js';
import { readGeotown } from './read.js';

// a small grid of streets over a known land: two hummocks on a rise, so the profile has something to grade out
const X = [0, 60, 120], Y = [0, 50, 100], SX = X.map(() => ({ half: 6 })), SY = Y.map(() => ({ half: 6 }));
const land = (x, y) => 0.08 * y + 1.5 * Math.sin(x / 9) * Math.cos(y / 7);
const P = profileStreets({ S: land, X, Y, SX, SY, frame: { W: 120, D: 100 } });
const law = (d, id) => d.laws.find((l) => l.law === id);

describe('the streets\' profile: crossings level, each block graded between them', () => {
  it('holds every crossing level at the land\'s height there, across the street\'s width', () => {
    for (const x of X) for (const y of Y) {
      const z = land(x, y);
      for (const [dx, dy] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [4, -4], [5, 5], [-5, 5], [-5, -5]]) expect(P.S(x + dx, y + dy)).toBeCloseTo(z, 9);
    }
  });

  it('is on every street\'s line its own profile: one ramp a block, rising monotone between its crossings', () => {
    for (const s of P.streets) {
      expect(s.stretches).toHaveLength(s.nodes.length - 1);
      s.stretches.forEach((r, k) => {
        const along = (t) => (s.axis === 'y' ? P.S(s.at, t) : P.S(t, s.at));
        const zs = []; for (let t = r.from; t <= r.to + 1e-9; t += (r.to - r.from) / 20) zs.push(along(t));
        // no hummock left on it: it climbs (or falls) one way, from one crossing's level to the next's
        const sign = Math.sign(r.rise);
        for (let i = 1; i < zs.length; i++) expect(sign * (zs[i] - zs[i - 1])).toBeGreaterThanOrEqual(-1e-9);
        expect(zs[0]).toBeCloseTo(s.nodes[k], 2);
        expect(zs[zs.length - 1]).toBeCloseTo(s.nodes[k + 1], 2);
        // its grade the steepest it climbs (the middle of its ramp), eased in at each end
        let steep = 0; for (let t = r.from; t + 1 <= r.to; t += 1) steep = Math.max(steep, Math.abs(along(t + 1) - along(t)));
        expect(steep).toBeLessThanOrEqual(r.grade + 1e-3);
        expect(steep).toBeGreaterThan(r.grade * 0.9 - 1e-3);
      });
    }
  });

  it('flags a stretch past the walkable grade as a stair, and only those', () => {
    const steep = profileStreets({ S: (x, y) => 0.2 * y, X, Y, SX, SY, frame: {} });
    const ns = steep.streets.filter((s) => s.axis === 'y').flatMap((s) => s.stretches), ew = steep.streets.filter((s) => s.axis === 'x').flatMap((s) => s.stretches);
    expect(ns.every((r) => r.stairs && r.grade > PROFILE.walkable)).toBe(true);
    expect(ew.every((r) => !r.stairs && r.grade === 0)).toBe(true);
    // a town that walks steeper asks no stair
    const lax = profileStreets({ S: (x, y) => 0.2 * y, X, Y, SX, SY, frame: {} }, { walkable: 0.4 });
    expect(lax.streets.flatMap((s) => s.stretches).some((r) => r.stairs)).toBe(false);
  });

  it('runs each street on level past the outermost lines, to the frame\'s edge', () => {
    expect(P.S(-30, 50)).toBeCloseTo(land(0, 50), 9);
    expect(P.S(60, 140)).toBeCloseTo(land(60, 100), 9);
    expect(P.S(-30, -30)).toBeCloseTo(land(0, 0), 9);
  });
});

describe('a geotown\'s `profile`', () => {
  const hilly = { evoke: 'metro', grid: [2, 2], hills: { height: 25, span: 400 } };

  it('reads true or { walkable, curve } and refuses what is off its rails', () => {
    expect(readGeotown({ profile: true }).profile).toEqual({});
    expect(readGeotown({ profile: { walkable: 0.15 } }).profile).toEqual({ walkable: 0.15 });
    expect('profile' in readGeotown({})).toBe(false);
    expect('profile' in readGeotown({ profile: false })).toBe(false);
    expect(() => readGeotown({ profile: 'yes' })).toThrow(/profile is true/);
    expect(() => readGeotown({ profile: { steep: 1 } })).toThrow(/profile.steep is not a setting/);
    expect(() => readGeotown({ profile: { walkable: 0.9 } })).toThrow(/profile.walkable/);
    expect(() => readGeotown({ profile: { curve: 50 } })).toThrow(/profile.curve/);
  });

  it('adds nothing when absent: a town without it is laid as before', () => {
    const a = designGeotown(hilly, { seed: 3 }), b = designGeotown({ ...hilly, profile: false }, { seed: 3 });
    expect(a.profile).toBeUndefined();
    expect(law(a, 'stairs')).toBeUndefined();
    expect(JSON.stringify(b.plots)).toBe(JSON.stringify(a.plots));
    expect(a.land.S(37, 41)).toBe(b.land.S(37, 41));
  });

  it('lays the town\'s streets on profiles: its crossings level where the draped streets tilt', () => {
    const a = designGeotown(hilly, { seed: 3 }), p = designGeotown({ ...hilly, profile: true }, { seed: 3 });
    expect(p.profile.length).toBe(p.X.length + p.Y.length);
    // the tilt across a crossing: its four corners at a street's half-width
    const tilt = (d) => {
      let worst = 0;
      d.X.forEach((x, k) => d.Y.forEach((y, j) => {
        const hx = d.sections.x[k].half * 0.9, hy = d.sections.y[j].half * 0.9, zs = [[hx, hy], [hx, -hy], [-hx, hy], [-hx, -hy]].map(([dx, dy]) => d.land.S(x + dx, y + dy));
        worst = Math.max(worst, Math.max(...zs) - Math.min(...zs));
      }));
      return worst;
    };
    expect(tilt(p)).toBeLessThan(1e-9);
    expect(tilt(a)).toBeGreaterThan(tilt(p) * 5);
    // and the town says, by law, where it wants a stair
    expect(law(p, 'stairs')).toBeDefined();
  });

  it('says the stairs a steep town wants, street by street', () => {
    const d = designGeotown({ evoke: 'metro', grid: [2, 2], hills: { height: 40, span: 200 }, profile: true }, { seed: 3 });
    const l = law(d, 'stairs');
    expect(l.ok).toBe(false);
    expect(l.detail ?? l.note ?? l.said ?? JSON.stringify(l)).toMatch(/(ns|ew)-\d+ .* at \d+%/);
  });
});
