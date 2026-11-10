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

  it('flags a stretch past the walkable grade steep, and only those', () => {
    const steep = profileStreets({ S: (x, y) => 0.2 * y, X, Y, SX, SY, frame: {} });
    const ns = steep.streets.filter((s) => s.axis === 'y').flatMap((s) => s.stretches), ew = steep.streets.filter((s) => s.axis === 'x').flatMap((s) => s.stretches);
    expect(ns.every((r) => r.steep && r.grade > PROFILE.walkable)).toBe(true);
    expect(ew.every((r) => !r.steep && r.grade === 0)).toBe(true);
    // a town that walks steeper finds none too steep
    const lax = profileStreets({ S: (x, y) => 0.2 * y, X, Y, SX, SY, frame: {} }, { walkable: 0.4 });
    expect(lax.streets.flatMap((s) => s.stretches).some((r) => r.steep)).toBe(false);
  });

  it('runs each street on level past the outermost lines, to the frame\'s edge', () => {
    expect(P.S(-30, 50)).toBeCloseTo(land(0, 50), 9);
    expect(P.S(60, 140)).toBeCloseTo(land(60, 100), 9);
    expect(P.S(-30, -30)).toBeCloseTo(land(0, 0), 9);
  });
});

describe('the profile kept at its edges, and its streets that climb', () => {
  const X4 = [0, 40, 100, 140], Y4 = [0, 45, 95, 140], S4 = X4.map(() => ({ half: 5 })), T4 = Y4.map(() => ({ half: 5 }));
  const K = profileStreets({ S: land, X: X4, Y: Y4, SX: S4, SY: T4, frame: {} }, { keep: true });

  it('keeps its outermost lines on the ground given, and that ground past them, so it meets what is round it', () => {
    for (const t of [3, 27, 61, 118]) {
      for (const x of [0, 140]) expect(K.S(x, t)).toBeCloseTo(land(x, t), 9);
      for (const y of [0, 140]) expect(K.S(t, y)).toBeCloseTo(land(t, y), 9);
    }
    expect(K.S(-20, 70)).toBe(land(-20, 70));
    expect(K.S(70, 160)).toBe(land(70, 160));
    // (the kept lines unreported: a frame's edge is no street of its own)
    expect(K.streets.map((s) => s.id)).toEqual(['ns-1', 'ns-2', 'ew-1', 'ew-2']);
    // its own crossings level corner to corner, as a profile's are
    for (const x of [40, 100]) for (const y of [45, 95]) for (const [dx, dy] of [[4, 4], [-4, 4], [4, -4], [-4, -4]]) expect(K.S(x + dx, y + dy)).toBeCloseTo(land(x, y), 9);
  });

  it('climbs a named street at its grade from its first crossing, its cross streets graded to meet it', () => {
    const C = profileStreets({ S: land, X, Y, SX, SY, frame: {} }, { climb: { 'ns-1': 0.1 } });
    const st = C.streets.find((q) => q.id === 'ns-1');
    expect(st.climb).toBe(0.1);
    st.nodes.forEach((z, k) => expect(z).toBeCloseTo(land(60, 0) + 0.1 * Y[k], 3));
    // (a cross street meets it at its crossing, level there)
    expect(C.streets.find((q) => q.id === 'ew-2').nodes[1]).toBeCloseTo(st.nodes[2], 3);
    expect(C.S(60, 100)).toBeCloseTo(st.nodes[2], 3);
    // (a falling one, and the refusals: streets that cross, a name off the grid)
    expect(profileStreets({ S: land, X, Y, SX, SY, frame: {} }, { climb: { 'ew-1': -0.05 } }).streets.find((q) => q.id === 'ew-1').nodes[2]).toBeCloseTo(land(0, 50) - 0.05 * 120, 3);
    expect(() => profileStreets({ S: land, X, Y, SX, SY, frame: {} }, { climb: { 'ns-1': 0.1, 'ew-1': 0.1 } })).toThrow(/cross/);
    expect(() => profileStreets({ S: land, X, Y, SX, SY, frame: {} }, { climb: { 'ns-9': 0.1 } })).toThrow(/not a street of this grid/);
    // (a kept line climbs no more than the ground it keeps)
    expect(() => profileStreets({ S: land, X: X4, Y: Y4, SX: S4, SY: T4, frame: {} }, { keep: true, climb: { 'ns-0': 0.1 } })).toThrow(/not a street/);
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
    expect(law(a, 'walkable')).toBeUndefined();
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
    // and the town says, by law, where it is too steep to walk
    expect(law(p, 'walkable')).toBeDefined();
  });

  it('says where a steep town is too steep to walk, street by street', () => {
    const d = designGeotown({ evoke: 'metro', grid: [2, 2], hills: { height: 40, span: 200 }, profile: true }, { seed: 3 });
    const l = law(d, 'walkable');
    expect(l.ok).toBe(false);
    expect(l.detail ?? l.note ?? l.said ?? JSON.stringify(l)).toMatch(/(ns|ew)-\d+ .* at \d+%/);
  });
});

describe('a geotown\'s `slope`: this climbs', () => {
  const flat = { evoke: 'metro', grid: [2, 2], hills: false };

  it('reads a side and a grade, the streets that climb, and refuses what is off them', () => {
    expect(readGeotown({ slope: { toward: 'n', grade: 0.06 } }).slope).toEqual({ toward: 'n', grade: 0.06 });
    // (a street that climbs is laid on its profile, asked or not)
    expect(readGeotown({ ...flat, slope: { streets: { 'ns-1': 0.1 } } }).profile).toEqual({});
    expect(() => readGeotown({ slope: { toward: 'n' } })).toThrow(/go together/);
    expect(() => readGeotown({ slope: { toward: 'up', grade: 0.1 } })).toThrow(/toward is the side/);
    expect(() => readGeotown({ slope: { toward: 'n', grade: 0.5 } })).toThrow(/grade is the land/);
    expect(() => readGeotown({ ...flat, slope: { streets: { 'ns-7': 0.1 } } })).toThrow(/not a street of a 2 × 2/);
    expect(() => readGeotown({ ...flat, slope: { streets: { 'ns-1': 0.1, 'ew-1': 0.1 } } })).toThrow(/along one axis/);
    expect(() => readGeotown({ ...flat, slope: { streets: { 'ns-1': 0.9 } } })).toThrow(/−0.4 to 0.4/);
    expect(() => readGeotown({ slope: { lean: 1 } })).toThrow(/slope.lean is not a setting/);
  });

  it('tilts the land toward its side at its grade, the houses\' pads with it', () => {
    const d = designGeotown({ ...flat, slope: { toward: 'n', grade: 0.06 } }, { seed: 3 }), x = d.frame.W / 2;
    expect((d.land.N(x, 200) - d.land.N(x, 100)) / 100).toBeCloseTo(0.06, 6);
    const pads = d.plots.map((pl) => [pl.rect[1], pl.pad]).sort((a, b) => a[0] - b[0]);
    expect(pads[pads.length - 1][1] - pads[0][1]).toBeGreaterThan(0.06 * (pads[pads.length - 1][0] - pads[0][0]) * 0.7);
  });

  it('climbs a named street at its grade on its profile, its ground rising with it, its cross streets said where too steep to walk', () => {
    const d = designGeotown({ ...flat, slope: { streets: { 'ns-1': 0.12 } } }, { seed: 3 }), st = d.profile.find((s) => s.id === 'ns-1');
    expect(st.climb).toBe(0.12);
    st.nodes.forEach((z, k) => expect(z - st.nodes[0]).toBeCloseTo(0.12 * (d.Y[k] - d.Y[0]), 2));
    // (the land beside it lifted with it, eased out toward its neighbours)
    const at = (dx) => d.land.N(d.X[1] + dx, d.Y[2] - 20);
    expect(at(0)).toBeGreaterThan(at(d.X[1] - d.X[0]) + 0.12 * (d.Y[2] - 20 - d.Y[0]) * 0.8);
    const steep = d.laws.find((l) => l.law === 'walkable');
    expect(steep.ok).toBe(false);
    expect(steep.value).toMatch(/ew-\d/);
  });

  it('adds nothing when absent, and a town on a metro\'s ground keeps its perimeter on it', () => {
    const a = designGeotown(flat, { seed: 3 }), b = designGeotown({ ...flat, slope: undefined }, { seed: 3 });
    expect(JSON.stringify(b.plots)).toBe(JSON.stringify(a.plots));
    expect(a.land.N(50, 50)).toBe(0);
    // (on a metro's streets' ground: no tilt of its own, its perimeter streets on that ground, its inner ones profiled)
    const metro = (x, y) => 0.05 * x + 2 * Math.sin(y / 30);
    const c = designGeotown({ ...flat, profile: true, slope: { toward: 'n', grade: 0.1 } }, { seed: 3, streets: metro });
    for (const t of [10, 77, 160]) { expect(c.land.S(c.X[0], t)).toBeCloseTo(metro(c.X[0], t), 9); expect(c.land.S(t, c.Y[2])).toBeCloseTo(metro(t, c.Y[2]), 9); }
    expect(c.profile.map((s) => s.id)).toEqual(['ns-1', 'ew-1']);
    expect(c.land.S(c.X[1] + 3, c.Y[1] + 3)).toBeCloseTo(metro(c.X[1], c.Y[1]), 6);
  });
});
