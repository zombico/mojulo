import { describe, it, expect } from 'vitest';
import { designGeotown, geotownLand } from './design.js';
import { readGeotown, readStreetscape } from './read.js';
import { SURFACES, SURFACE_IDS, PATTERNS, DEFAULT_PATTERN } from './pattern.js';
import { geotownSheet } from './sheet.js';
import { yardOf, balconyOf, YARDS, ZONES } from './yards.js';
import { mulberry32 } from '../city/plan/dice.js';

// a plane rising north (4 %), so the levels have a known land to be read against
const RISE = 0.04, plane = (x, y) => RISE * y;
const one = (spec = {}, opts = {}) => designGeotown({ evoke: 'metro', grid: [1, 1], ...spec }, { seed: 3, ...opts });
const law = (d, id) => d.laws.find((l) => l.law === id);

describe('the geotown\'s map: blocks of plots, every square metre one surface', () => {
  it('reads its rails and refuses what is off them by name', () => {
    expect(() => readGeotown({ town: 1 })).toThrow(/'town' is not a setting/);
    expect(() => readGeotown({ evoke: 'metro', grid: [5, 1] })).toThrow(/grid is \[cols, rows\]/);
    expect(() => readGeotown({ grid: [2, 2] })).toThrow(/grid is the town laid to scale's/);
    expect(() => readGeotown({ evoke: 'vast' })).toThrow(/evoke is 'segment', 'neighbourhood', 'metro'/);
    expect(() => readGeotown({ segment: 'mall' })).toThrow(/segment is houses, main-street, apartments, park/);
    expect(() => readGeotown({ evoke: 'neighbourhood', neighbourhood: { layout: ['HH'] } })).toThrow(/a neighbourhood is at least 4 segments/);
    expect(() => readGeotown({ evoke: 'neighbourhood', neighbourhood: { layout: ['HX', 'HH'] } })).toThrow(/'X' is not a segment's letter/);
    expect(() => readGeotown({ evoke: 'neighbourhood', neighbourhood: { layout: ['HH', 'HH'], main: ['ew-7'] } })).toThrow(/'ew-7' is not a street/);
    expect(() => readGeotown({ evoke: 'metro', grid: [1, 1], blocks: { B1: {} } })).toThrow(/blocks.B1 is not a block of a 1 × 1 grid/);
    expect(() => readGeotown({ blocks: { A1: { use: 'mall' } } })).toThrow(/use is houses, main-street, apartments, park/);
    expect(() => readGeotown({ pattern: { from: DEFAULT_PATTERN, plot: { triplex: [5, 6] } } })).toThrow(/pattern.plot.triplex is not a setting/);
    // a pattern's changes are merged a level deep over its own
    const T = readGeotown({ pattern: { from: DEFAULT_PATTERN, mix: { detached: 0 } } });
    expect(T.pattern.mix).toEqual({ semi: PATTERNS[DEFAULT_PATTERN].mix.semi, detached: 0 });
  });

  it('closes its budget: the town to its frame, each plot to its own area, each row to its block', () => {
    const d = one({ hills: false });
    expect(law(d, 'closes').ok).toBe(true);
    expect(Math.abs(d.ledger.total - d.frame.W * d.frame.D)).toBeLessThan(0.05);
    for (const pl of d.plots) expect(Math.abs(Object.values(pl.alloc).reduce((a, b) => a + b, 0) - pl.w * pl.d)).toBeLessThan(0.01);
    const B = d.blocks[0], L = B.rect[3] - B.rect[1];
    for (const side of ['w', 'e']) expect(d.plots.filter((pl) => pl.side === side).reduce((a, pl) => a + pl.w, 0)).toBeCloseTo(L, 2);
    // the hard surfaces grow nothing, the soft ones grass at least
    // (a hard surface grows no grass and no garden: a main street's furnishing strip only its trees, in their pits)
    for (const k of SURFACE_IDS) expect(SURFACES[k].soft ? SURFACES[k].grows.includes('grass') : SURFACES[k].grows.every((g) => g === 'street-tree')).toBe(true);
  });

  it('keeps a back yard every plot and a block face\'s setback held', () => {
    const d = one({ hills: false }), P = d.pattern;
    expect(law(d, 'back-yard').ok).toBe(true);
    for (const pl of d.plots) expect(pl.d - pl.setback - pl.house.depth).toBeGreaterThanOrEqual(P.back - 1e-9);
    expect(law(d, 'setback').ok).toBe(true);
    for (const side of ['w', 'e']) expect(new Set(d.plots.filter((pl) => pl.side === side).map((pl) => pl.setback)).size).toBe(1);
  });

  it('stands a semi pair about its party wall: no side yard there, one depth and one pad', () => {
    const d = one({ pattern: { from: DEFAULT_PATTERN, mix: { semi: 1, detached: 0 } } }, { field: plane });
    const pairs = new Map();
    for (const pl of d.plots) (pairs.get(pl.pair) ?? pairs.set(pl.pair, []).get(pl.pair)).push(pl);
    expect(pairs.size).toBeGreaterThan(2);
    for (const [L, R] of pairs.values()) {
      expect([L.half, R.half]).toEqual(['L', 'R']);
      expect(L.house.sides[1]).toBe(0);
      expect(R.house.sides[0]).toBe(0);
      expect(L.house.depth).toBe(R.house.depth);
      expect(L.pad).toBe(R.pad);
    }
  });

  it('levels on the land: its streets keep the land\'s grade, each pad a whole number of risers over its walk', () => {
    const d = one({}, { field: plane }), P = d.pattern, { S } = d.land, kerb = d.row.kerb;
    // the streets' ground is the land smoothed: a plane stays itself inside the frame
    const B = d.blocks[0], [cx, cy] = [(B.rect[0] + B.rect[2]) / 2, (B.rect[1] + B.rect[3]) / 2];
    expect(Math.abs(S(cx, cy) - plane(cx, cy))).toBeLessThan(0.05);
    expect(law(d, 'grade').value).toMatch(/0\.04/);
    for (const pl of d.plots) {
      const fx = pl.A[0] + pl.ex[0] * (pl.w / 2), fy = pl.A[1] + pl.ex[1] * (pl.w / 2), rise = pl.pad - (S(fx, fy) + kerb);
      // (a semi pair levels at its party wall: its halves' fronts are a frontage apart)
      expect(rise).toBeGreaterThanOrEqual(P.pad.least - P.pad.riser - 0.02);
      expect(rise).toBeLessThanOrEqual(P.pad.most + P.pad.riser + 0.02);
    }
    // a steep land: the grade law advises, never refuses
    expect(law(one({}, { field: (x, y) => 0.12 * y }), 'grade').ok).toBe(false);
    expect(law(one({ hills: false }), 'grade').ok).toBe(true);
  });

  it('lays a block at a time: one block made a park moves no other block\'s plots', () => {
    const a = designGeotown({ evoke: 'metro', grid: [2, 1] }, { seed: 5, field: plane }), b = designGeotown({ evoke: 'metro', grid: [2, 1], blocks: { B1: { use: 'park' } } }, { seed: 5, field: plane });
    const of = (d) => JSON.stringify(d.plots.filter((pl) => pl.block === 'A1'));
    expect(of(b)).toBe(of(a));
    expect(b.plots.some((pl) => pl.block === 'B1')).toBe(false);
    expect(b.ledger.blocks.B1.park).toBeGreaterThan(0);
    expect(law(b, 'closes').ok).toBe(true);
    // the same recipe, the same map
    expect(JSON.stringify(designGeotown({ evoke: 'metro', grid: [2, 1] }, { seed: 5, field: plane }).surfaces)).toBe(JSON.stringify(a.surfaces));
  });

  it('reads the land from its hills: the natural ground spans the height asked over the frame', () => {
    const frame = { W: 200, D: 200, margin: 20 }, L = geotownLand({ height: 12, span: 600, from: { heartbeat: 'gentle-pulse', splatch: 'verdure-trio', seed: 'g2' } }, frame, 1);
    let lo = Infinity, hi = -Infinity;
    for (let x = -20; x <= 220; x += 8) for (let y = -20; y <= 220; y += 8) { const z = L.N(x, y); lo = Math.min(lo, z); hi = Math.max(hi, z); }
    expect(lo).toBeGreaterThanOrEqual(-0.01);
    expect(hi).toBeLessThanOrEqual(12.01);
    expect(hi - lo).toBeGreaterThan(6);
    expect(geotownLand(null, frame, 1).S(50, 50)).toBe(0);
  });

  it('draws its sheet: the map, its blocks, its ledger and its laws', () => {
    const d = designGeotown({ evoke: 'metro', grid: [2, 1], blocks: { B1: { use: 'park' } } }, { seed: 2, field: plane }), svg = geotownSheet(d);
    expect(svg.startsWith('<svg')).toBe(true);
    for (const s of ['A1', 'B1 · park', 'back', 'closes']) expect(svg).toContain(s);
  });

  it('evokes the town rather than laying it out: a block of six or eight, back to back, standing for the town to scale', () => {
    for (const seed of [1, 2, 3]) {
      const d = designGeotown({}, { seed, field: plane }), B = d.blocks[0];
      expect(d.spec.evoke).toBe('segment');
      expect(d.blocks.length).toBe(1);
      // (its houses six or eight; a midtown mansion or two beside them, each on a plot of its own: see below)
      expect([6, 8]).toContain(d.plots.filter((pl) => pl.form !== 'mansion').length);
      // its two rows hold one count, back to back (a mansion's row fewer: it takes houses' frontage), and close on the block's length
      const rows = ['w', 'e'].map((s) => d.plots.filter((pl) => pl.side === s));
      if (!d.plots.some((pl) => pl.form === 'mansion')) expect(rows[0].length).toBe(rows[1].length);
      for (const r of rows) expect(r.reduce((a, pl) => a + pl.w, 0)).toBeCloseTo(B.rect[3] - B.rect[1], 2);
      // it stands for the town laid to scale, whose measures it keeps
      expect(d.evoked.stands.plots).toBeGreaterThan(5 * d.plots.length);
      expect(law(d, 'evokes').ok).toBe(true);
      expect(law(d, 'closes').ok).toBe(true);
      expect(new Set(d.plots.filter((pl) => pl.form !== 'mansion').map((pl) => pl.form))).toEqual(new Set(['semi', 'detached']));
    }
  });

  it('turns a main-street segment\'s shops to its main street: built to the walk, a service yard behind, houses backing onto it', () => {
    const d = designGeotown({ segment: 'main-street' }, { seed: 2, field: plane }), B = d.blocks[0];
    expect(d.streets.find((s) => s.id === 'ew-0').rank).toBe('main');
    expect(B.rows.map((r) => `${r.side}:${r.kind}`)).toEqual(['s:shops', 'n:houses']);
    const shops = d.plots.filter((pl) => pl.kind === 'shops'), houses = d.plots.filter((pl) => pl.kind === 'houses');
    expect(shops.every((pl) => pl.setback === 0 && pl.rear === 'service' && pl.alloc.front === 0 && pl.alloc.service > 0)).toBe(true);
    expect(houses.every((pl) => pl.setback > 0 && pl.rear === 'back')).toBe(true);
    // the main street's section: wider, its walk paved to its kerb (a furnishing strip, no verge)
    expect(d.pieces.some((p) => p.street === 'ew-0' && p.cls === 'furnish')).toBe(true);
    expect(d.pieces.some((p) => p.street === 'ew-0' && p.cls === 'verge')).toBe(false);
    expect(d.sections.y[0].row).toBeGreaterThan(d.sections.y[1].row);
    for (const id of ['closes', 'fits', 'frontage', 'setback']) expect(law(d, id).ok).toBe(true);
  });

  it('composes a neighbourhood: its segments tuned to their cells, its uses mixed, its perimeter its ports', () => {
    const d = designGeotown({ evoke: 'neighbourhood', neighbourhood: { layout: ['HP', 'MA'], main: ['ew-0'] } }, { seed: 3, field: plane });
    expect(d.blocks.map((b) => `${b.id}:${b.use}`)).toEqual(['A1:main-street', 'B1:apartments', 'A2:houses', 'B2:park']);
    for (const id of ['closes', 'fits', 'frontage', 'evokes']) expect(law(d, id).ok).toBe(true);
    expect(Object.keys(d.ledger.uses).filter((k) => k !== 'garage').sort()).toEqual(['apartments', 'houses', 'shops']);
    // a row its cell stretched past the rail is recut: every row's spread inside the pattern's stretch, give or take
    for (const f of d.evoked.fits) expect(f.stretch).toBeGreaterThan(d.pattern.evoke.stretch[0] - 0.1);
    // a column as wide as its widest need: the blocks of a column share their width, the rows of cells their length
    const w = (b) => b.rect[2] - b.rect[0];
    expect(w(d.blocks[0])).toBeCloseTo(w(d.blocks[2]), 6);
    // its four perimeter streets are its ports, their ranks and their ends' heights
    expect(d.ports.map((p) => `${p.side}:${p.rank}`)).toEqual(['w:street', 'e:street', 's:main', 'n:street']);
    for (const p of d.ports) expect(p.z.every(Number.isFinite)).toBe(true);
  });

  it('sets a midtown mansion or two among a segment\'s houses: a much larger property, its drive, its garage, its pool', () => {
    const counts = [];
    for (const seed of [1, 2, 3, 4]) {
      const d = designGeotown({}, { seed, field: plane }), M = d.plots.filter((pl) => pl.form === 'mansion'), H = d.plots.filter((pl) => pl.kind === 'houses' && pl.form !== 'mansion');
      counts.push(M.length);
      expect(M.length).toBeLessThanOrEqual(PATTERNS[DEFAULT_PATTERN].evoke.mansions[1]);
      for (const id of ['closes', 'back-yard', 'evokes', ...(M.length ? ['mansions'] : [])]) expect(law(d, id).ok).toBe(true);
      const mean = H.reduce((a, pl) => a + pl.w * pl.d, 0) / (H.length || 1);
      for (const pl of M) {
        expect(pl.w * pl.d).toBeGreaterThanOrEqual(2 * mean);
        // its drive along one side yard, its garage (when its yard has the depth) inside that yard's surfaces
        expect(pl.alloc.drive).toBeGreaterThan(0);
        expect(d.surfaces.some((s) => s.plot === pl.id && s.cls === 'drive')).toBe(true);
      }
    }
    expect(Math.max(...counts)).toBe(2);
  });

  it('reads an evocation\'s land as a window of the town to scale\'s, so its slopes are the town\'s', () => {
    const d = designGeotown({}, { seed: 4 }), m = designGeotown({ evoke: 'metro' }, { seed: 4 });
    const ox = (m.frame.W - d.frame.W) / 2, oy = (m.frame.D - d.frame.D) / 2;
    for (const [x, y] of [[10, 10], [d.frame.W / 2, d.frame.D / 2], [d.frame.W - 5, d.frame.D - 5]]) expect(d.land.N(x, y)).toBeCloseTo(m.land.N(x + ox, y + oy), 6);
  });
});

describe('a back yard\'s plan: a feature a zone, each given its depth from the house, a feature without its room lawn', () => {
  const inside = (Y, w, v0, v1) => Y.faces.every((f) => f.corners.every(([u, v]) => u >= -1e-6 && u <= w + 1e-6 && v >= v0 - 1e-6 && v <= v1 + 1e-6));
  it('lays its zones in order from the back door, each inside the yard', () => {
    for (const plan of [{ near: 'deck', mid: 'trampoline', back: 'shed' }, { near: 'patio', mid: 'play', back: 'tree' }, { near: 'lawn', mid: 'garden', back: 'beds' }]) {
      const Y = yardOf(plan, { w: 7, v0: 10, v1: 26, R: mulberry32(5) });
      expect(Y.plan).toEqual(plan);
      expect(inside(Y, 7, 10, 26)).toBe(true);
      for (const z of ZONES) expect(['any', z]).toContain(YARDS[Y.plan[z]].zone);
    }
    // the shade tree its yard's one large tree, by its back fence
    const T = yardOf({ near: 'patio', mid: 'lawn', back: 'tree' }, { w: 7, v0: 10, v1: 26, R: mulberry32(1) });
    expect(T.trees.filter((t) => t.large).length).toBe(1);
    expect(T.trees.find((t) => t.large).v).toBeGreaterThan(22);
  });

  it('gives way where the yard is short or narrow: its back fence\'s feature first, then its middle\'s, each lawn', () => {
    const Y = yardOf({ near: 'deck', mid: 'trampoline', back: 'shed' }, { w: 7, v0: 10, v1: 19, R: mulberry32(2) });
    expect(Y.plan).toEqual({ near: 'deck', mid: 'trampoline', back: 'lawn' });
    expect(yardOf({ near: 'deck', mid: 'trampoline', back: 'shed' }, { w: 7, v0: 10, v1: 17, R: mulberry32(2) }).plan).toEqual({ near: 'deck', mid: 'lawn', back: 'lawn' });
    expect(yardOf({ near: 'lawn', mid: 'pool', back: 'lawn' }, { w: 4.5, v0: 0, v1: 20, R: mulberry32(3) }).plan.mid).toBe('lawn');
    // a balcony stands off its wall over its own width
    const B = balconyOf({ u0: 1, u1: 4, v: 12, z: 3, R: mulberry32(4) });
    expect(B.every((f) => f.corners.every(([u, v]) => u >= 1 - 1e-6 && u <= 4 + 1e-6 && v >= 12 - 1e-6 && v <= 13.6))).toBe(true);
  });
});

describe('a streetscape: how close to the city, read from the sidewalk', () => {
  const H = (d) => d.plots.filter((pl) => pl.kind === 'houses' && pl.form !== 'mansion');
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  it('reads its streetscape over the pattern, and refuses what is off it by name', () => {
    expect(readGeotown({}).pattern.streetscape).toBe('leafy');
    const U = readGeotown({ streetscape: { from: 'urban', setback: [6, 8], gates: 'none', parking: 'one', trees: 0.5 } }).pattern;
    expect([U.setback, U.gates.share, U.parking.sides, U.trees.share]).toEqual([[6, 8], 0, 'one', 0.5]);
    // a deeper setback asked deepens the block: its front yard, its house and its back yard
    expect(U.block.depth[0]).toBeGreaterThanOrEqual(8 + U.house.depth[0] + U.back);
    expect(() => readGeotown({ streetscape: 'suburb' })).toThrow(/streetscape 'suburb' is not one of the pattern's/);
    expect(() => readGeotown({ streetscape: { from: 'snug', lanes: 2 } })).toThrow(/streetscape.lanes is not a setting/);
    expect(() => readGeotown({ streetscape: { gates: 'half' } })).toThrow(/streetscape.gates is none, some, most, all/);
    expect(readStreetscape(readGeotown({}).pattern, undefined).streetscape).toBe('leafy');
  });

  it('tightens toward the city: narrower lots nearer their walks, a narrower boulevard or none, more houses to a segment', () => {
    const [L, S, U] = ['leafy', 'snug', 'urban'].map((sc) => designGeotown({ streetscape: sc }, { seed: 2, field: plane }));
    expect(mean(H(S).map((pl) => pl.w))).toBeLessThan(mean(H(L).map((pl) => pl.w)));
    expect(mean(H(U).map((pl) => pl.w))).toBeLessThan(mean(H(S).map((pl) => pl.w)) + 0.3);
    for (const d of [L, S, U]) for (const pl of H(d)) expect(pl.setback).toBeGreaterThanOrEqual(d.pattern.setback[0] - 1e-9);
    expect(Math.max(...H(U).map((pl) => pl.setback))).toBeLessThan(Math.min(...H(L).map((pl) => pl.setback)));
    expect(S.row.verge).toBeLessThan(L.row.verge);
    expect(U.pieces.some((p) => p.cls === 'verge')).toBe(false);
    expect(H(U).length).toBeGreaterThan(H(L).length);
    for (const d of [L, S, U]) for (const id of ['closes', 'back-yard', 'parking', 'fits', 'evokes']) expect(law(d, id).ok).toBe(true);
  });

  it('makes room for parking: a lane on each block-facing kerb it parks, its stalls clear of every drive, a front pad off its path', () => {
    const one = designGeotown({ streetscape: 'leafy' }, { seed: 3, field: plane }), both = designGeotown({ evoke: 'neighbourhood', neighbourhood: 'quiet-streets', streetscape: 'snug' }, { seed: 3, field: plane });
    // snug parks both sides of a street between two blocks, leafy one
    const sides = (d, id) => d.parking.lanes.filter((l) => l.street === id).map((l) => l.side);
    expect(new Set(sides(both, 'ns-1'))).toEqual(new Set(['w', 'e']));
    expect(one.ledger.town.parking).toBeGreaterThan(0);
    for (const d of [one, both]) for (const l of d.parking.lanes) for (const [s0, s1] of l.stalls) expect(l.cuts.some(([c0, c1]) => c0 < s1 && c1 > s0)).toBe(false);
    // a pad in a deep, near-level front yard, its path beside it
    const pads = designGeotown({ streetscape: { from: 'leafy', setback: [5.5, 6.5] }, pattern: { from: 'bay-and-gable', streetscapes: { leafy: { ...PATTERNS[DEFAULT_PATTERN].streetscapes.leafy, parking: { ...PATTERNS[DEFAULT_PATTERN].streetscapes.leafy.parking, pads: 1 } } } } }, { seed: 1, field: plane });
    const withPad = pads.plots.filter((pl) => pl.park);
    expect(withPad.length).toBeGreaterThan(0);
    for (const pl of withPad) { const [a, b] = [pl.path.u - pl.path.w / 2, pl.path.u + pl.path.w / 2]; expect(a >= pl.park[1] - 1e-9 || b <= pl.park[0] + 1e-9).toBe(true); }
    expect(law(pads, 'closes').ok).toBe(true);
  });
});

describe('a site: a block given to one program, evoked as the houses are', () => {
  const at = (d, cls) => d.surfaces.filter((s) => s.cls === cls).reduce((a, s) => a + (s.area ?? (s.rect[2] - s.rect[0]) * (s.rect[3] - s.rect[1])), 0);
  it('evokes a school on two segments\' ground: one block, no street through it, its lot, yard, staff lot and field round a track', () => {
    const d = designGeotown({ segment: 'school' }, { seed: 3, field: plane }), B = d.blocks[0];
    expect(d.spec.grid).toEqual([2, 1]);
    expect(d.blocks.length).toBe(1);
    expect(B.cells).toEqual(['A1', 'B1']);
    // the street between its two cells is the block's: no piece of ns-1 stands inside it, its crossings walk across
    const inside = (r) => r[0] >= B.rect[0] - 1e-6 && r[2] <= B.rect[2] + 1e-6 && r[1] >= B.rect[1] - 1e-6 && r[3] <= B.rect[3] + 1e-6;
    expect(d.pieces.some((p) => inside(p.rect))).toBe(false);
    expect(d.pieces.some((p) => p.crossing === '1:0' && p.cls === 'walk' && !p.corner)).toBe(true);
    const school = d.plots.filter((pl) => pl.kind === 'school');
    expect(school.length).toBe(1);
    expect(school[0].rear).toBe('court');
    for (const cls of ['field', 'track', 'service', 'grounds', 'court']) expect(at(d, cls)).toBeGreaterThan(0);
    for (const id of ['closes', 'sites', 'frontage']) expect(law(d, id).ok).toBe(true);
    expect(d.laws.some((l) => l.law === 'evokes')).toBe(false);
  });

  it('evokes a sports field: its diamond\'s dirt out of its turf, a pitch, courts, a field house on its lawn', () => {
    const d = designGeotown({ segment: 'sports' }, { seed: 1, field: plane }), w = d.blocks[0].site.what;
    expect(w.diamond && w.pitch && w.courts && w.fieldhouse).toBeTruthy();
    expect(at(d, 'infield')).toBeGreaterThan(0);
    expect(d.ledger.uses.fieldhouse).toBeGreaterThan(0);
    for (const id of ['closes', 'sites']) expect(law(d, id).ok).toBe(true);
  });

  it('composes: wide letters side by side one block, each site yielding to its neighbours\' cells; to scale, the block it is laid on', () => {
    const d = designGeotown({ evoke: 'neighbourhood', neighbourhood: 'school-and-field' }, { seed: 3, field: plane });
    expect(d.blocks.filter((b) => b.site && b.site.type !== 'park').map((b) => `${b.id}:${b.use}:${b.cells.join('')}`)).toEqual(['A1:school:A1B1', 'A3:sports:A3B3']);
    // its two fields a row of houses and a park apart; side by side, the law advises
    expect(law(d, 'apart').ok).toBe(true);
    expect(law(designGeotown({ evoke: 'neighbourhood', neighbourhood: { layout: ['FFH', 'SSH'] } }, { seed: 3, field: plane }), 'apart').ok).toBe(false);
    expect(d.blocks.find((b) => b.use === 'school').site.front).toBe('s');
    for (const s of d.sites) expect(s.deepen).toBeLessThan(1);
    expect(d.laws.filter((l) => !l.ok)).toEqual([]);
    const m = designGeotown({ evoke: 'metro', grid: [2, 2], blocks: { B1: { use: 'school' } } }, { seed: 3, field: plane }), S = m.blocks.find((b) => b.use === 'school');
    // (its long side its front: the town to scale's blocks run north)
    expect(S.site.front).toBe('w');
    for (const id of ['closes', 'sites', 'coverage']) expect(law(m, id).ok).toBe(true);
  });
});

describe('an edge: two-storey buildings facing a major street, a lane behind, houses behind it', () => {
  it('turns its avenue to its major street, each building a type its neighbour is not, at its type\'s setback; a lane between its rows', () => {
    const d = designGeotown({ segment: 'edge' }, { seed: 3, field: plane }), B = d.blocks[0], T = PATTERNS[DEFAULT_PATTERN].rows.avenue.types;
    expect(d.streets.find((s) => s.id === 'ew-0').rank).toBe('major');
    expect(d.sections.y[0].row).toBeGreaterThan(d.sections.y[1].row);
    expect(B.rows.map((r) => `${r.side}:${r.kind}`)).toEqual(['s:avenue', 'n:houses']);
    const av = d.plots.filter((pl) => pl.kind === 'avenue').sort((p, q) => p.k - q.k);
    for (let k = 1; k < av.length; k++) expect(av[k].type).not.toBe(av[k - 1].type);
    for (const pl of av) expect(pl.house.env[1]).toBeCloseTo(T[pl.type].setback ?? 0, 6);
    // the lane: between the avenue's backs and the houses', its own surface; the houses' garages off it are parking
    expect(B.lane).toBeTruthy();
    expect(d.ledger.town.lane).toBeGreaterThan(0);
    const homes = d.plots.filter((pl) => pl.kind === 'houses');
    expect(homes.every((pl) => !(pl.rect[0] < B.lane[2] && pl.rect[2] > B.lane[0] && pl.rect[1] < B.lane[3] && pl.rect[3] > B.lane[1]))).toBe(true);
    expect(d.parking.laneGarages).toBe(homes.filter((pl) => pl.laneGarage).length);
    expect(d.laws.filter((l) => !l.ok)).toEqual([]);
  });

  it('composes the edges of a neighbourhood: each edge\'s avenue facing its own major street', () => {
    const d = designGeotown({ evoke: 'neighbourhood', neighbourhood: 'edges' }, { seed: 1, field: plane });
    const faces = d.blocks.filter((b) => b.use === 'edge').map((b) => b.rows[0]);
    expect(faces.every((r) => r.kind === 'avenue')).toBe(true);
    expect(new Set(faces.map((r) => r.side))).toEqual(new Set(['s', 'n']));
    expect(d.laws.filter((l) => !l.ok)).toEqual([]);
    expect(() => readGeotown({ evoke: 'neighbourhood', neighbourhood: { layout: ['EE', 'HH'], main: ['ew-0'], major: ['ew-0'] } })).toThrow(/is main or major, not both/);
  });
});
