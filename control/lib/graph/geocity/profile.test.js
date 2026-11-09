// THE METRO'S STREETS ON PROFILES: its arterials laid as a hill town lays them, the land's edges kept, each neighbourhood's
// collectors and locals the same inside it, its towns profiled on its ground, the arterials the slope names climbing.
import { describe, it, expect } from 'vitest';
import { designGeocity } from './design.js';
import { readGeocity } from './metro.js';

const HILLY = { hills: { height: 30, span: 900 }, metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const plain = designGeocity(HILLY, { seed: 2 }), prof = designGeocity({ ...HILLY, profile: true }, { seed: 2 });
const law = (d, id) => d.laws.find((l) => l.law === id);
const tilt = (S, x, y, hx, hy) => { const zs = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => S(x + a * hx, y + b * hy)); return Math.max(...zs) - Math.min(...zs); };

describe('a metro\'s `profile`: its streets climb as a hill town\'s do', () => {
  it('reads true or { walkable, curve }, and the arterials that climb', () => {
    expect(readGeocity({ profile: true }).profile).toEqual({});
    expect(readGeocity({ slope: { streets: { 'ns-2': 0.04 } } }).profile).toEqual({});
    expect(() => readGeocity({ profile: { steep: 1 } })).toThrow(/profile.steep is not a setting/);
    expect(() => readGeocity({ slope: { toward: 'n' } })).toThrow(/slope is \{ streets/);
    expect(() => readGeocity({ slope: { streets: { 'ns-1': 0.1, 'ew-1': 0.1 } } })).toThrow(/along one axis/);
    expect(() => readGeocity({ slope: { streets: { spine: 0.1 } } })).toThrow(/an arterial's id/);
  });

  it('holds every arterial crossing level and every neighbourhood\'s own, where draped they tilt', () => {
    const art = (d) => Math.max(...d.crossings.map((c) => { const [a, b] = c.id.split('×').map((id) => d.lines.find((l) => l.id === id)); return tilt(d.land.S, c.at[0], c.at[1], a.half * 0.9, b.half * 0.9); }));
    const inner = (d) => Math.max(...d.regions.flatMap((r) => { const st = r.streets ?? [], xs = st.filter((q) => q.axis === 'ns'), ys = st.filter((q) => q.axis === 'ew'); return xs.flatMap((a) => ys.map((b) => tilt(d.land.S, a.at, b.at, a.w * 0.45, b.w * 0.45))); }));
    expect(art(plain)).toBeGreaterThan(0.2);
    expect(art(prof)).toBeLessThan(1e-9);
    expect(inner(plain)).toBeGreaterThan(0.1);
    expect(inner(prof)).toBeLessThan(0.05);
    expect(prof.profile.arterials.map((s) => s.id)).toEqual(prof.lines.map((l) => l.id));
    expect(Object.keys(prof.profile.neighbourhoods).length).toBeGreaterThan(4);
    expect(law(prof, 'walkable')).toBeDefined();
    expect(law(plain, 'walkable')).toBeUndefined();
  });

  it('keeps the land\'s edges on its ground (the shore where it falls to the water), and adds nothing unasked', () => {
    const [x0, y0, x1, y1] = plain.land.rect;
    for (const t of [0.1, 0.37, 0.8]) {
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const [p, q] of [[x, y0], [x, y1], [x0, y], [x1, y]]) expect(prof.land.S(p, q)).toBeCloseTo(plain.land.S(p, q), 9);
    }
    expect(plain.profile).toBeUndefined();
    expect(JSON.stringify(designGeocity({ ...HILLY, profile: false }, { seed: 2 }).regions.map((r) => r.height))).toBe(JSON.stringify(plain.regions.map((r) => r.height)));
  });

  it('profiles the towns it composes, their perimeters on its ground, unless their recipes say', () => {
    const r = prof.regions.find((x) => !x.park && x.builds === 'outskirts');
    const d = designGeocity({ ...HILLY, profile: true, geotowns: { [r.id]: true } }, { seed: 2 }), t = d.regions.find((x) => x.id === r.id).geotown;
    expect(t.spec.profile).toEqual({});
    expect(designGeocity({ ...HILLY, profile: true, geotowns: { [r.id]: { profile: false } } }, { seed: 2 }).regions.find((x) => x.id === r.id).geotown.spec.profile).toBe(false);
    // (its perimeter streets on the metro's ground)
    const T = t.design, o = t.origin;
    for (const s of [0.2, 0.6]) { const y = T.frame.D * s; expect(T.land.S(T.X[0], y)).toBeCloseTo(d.land.S(T.X[0] + o[0], y + o[1]), 6); }
  });

  it('climbs a named arterial at its grade, the land under it lifted with it, its cross streets said where too steep to walk', () => {
    const id = prof.lines.find((l) => l.axis === 'ns' && l.rank !== 'spine').id;
    const d = designGeocity({ ...HILLY, slope: { streets: { [id]: 0.04 } } }, { seed: 2 }), st = d.profile.arterials.find((s) => s.id === id);
    expect(st.climb).toBe(0.04);
    // (its nodes from the shore's kept edge across every arterial, to the land's far edge, kept on its ground)
    const Y = [d.land.rect[1], ...d.lines.filter((l) => l.axis === 'ew').map((l) => l.at), d.land.rect[3]];
    st.nodes.slice(0, -1).forEach((z, k) => expect(z - st.nodes[0]).toBeCloseTo(0.04 * (Y[k] - Y[0]), 2));
    const l = d.lines.find((q) => q.id === id), y = Y[Y.length - 2] - 30;
    expect(d.land.N(l.at, y) - plain.land.N(l.at, y)).not.toBeCloseTo(0, 0);
    expect(law(d, 'walkable')).toBeDefined();
  });
});
