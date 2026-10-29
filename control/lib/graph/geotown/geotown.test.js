import { describe, it, expect } from 'vitest';
import { designGeotown, geotownLand } from './design.js';
import { readGeotown } from './read.js';
import { SURFACES, SURFACE_IDS, PATTERNS, DEFAULT_PATTERN } from './pattern.js';
import { geotownSheet } from './sheet.js';

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
