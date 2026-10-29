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
    expect(() => readGeotown({ evoke: 'vast' })).toThrow(/evoke is 'low', 'mid', 'high', 'metro'/);
    expect(() => readGeotown({ evoke: 'metro', grid: [1, 1], blocks: { B1: {} } })).toThrow(/blocks.B1 is not a block of a 1 × 1 grid/);
    expect(() => readGeotown({ blocks: { A1: { use: 'mall' } } })).toThrow(/use is houses or park/);
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
    for (const k of SURFACE_IDS) expect(SURFACES[k].soft ? SURFACES[k].grows.includes('grass') : SURFACES[k].grows.length === 0).toBe(true);
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
      expect(d.spec.evoke).toBe('low');
      expect(d.blocks.length).toBe(1);
      expect([6, 8]).toContain(d.plots.length);
      // its two rows hold one count, back to back, and close on the block's length
      const rows = ['w', 'e'].map((s) => d.plots.filter((pl) => pl.side === s));
      expect(rows[0].length).toBe(rows[1].length);
      for (const r of rows) expect(r.reduce((a, pl) => a + pl.w, 0)).toBeCloseTo(B.rect[3] - B.rect[1], 2);
      // it stands for the town laid to scale, whose measures it keeps
      expect(d.evoked.stands.plots).toBeGreaterThan(5 * d.plots.length);
      expect(law(d, 'evokes').ok).toBe(true);
      expect(law(d, 'closes').ok).toBe(true);
      expect(new Set(d.plots.map((pl) => pl.form))).toEqual(new Set(['semi', 'detached']));
    }
    // a street of houses facing each other (mid): two blocks across it
    const mid = designGeotown({ evoke: 'mid' }, { seed: 1, field: plane });
    expect(mid.blocks.map((b) => b.id)).toEqual(['A1', 'B1']);
    expect(law(mid, 'evokes').ok).toBe(true);
  });

  it('reads an evocation\'s land as a window of the town to scale\'s, so its slopes are the town\'s', () => {
    const d = designGeotown({}, { seed: 4 }), m = designGeotown({ evoke: 'metro' }, { seed: 4 });
    const ox = (m.frame.W - d.frame.W) / 2, oy = (m.frame.D - d.frame.D) / 2;
    for (const [x, y] of [[10, 10], [d.frame.W / 2, d.frame.D / 2], [d.frame.W - 5, d.frame.D - 5]]) expect(d.land.N(x, y)).toBeCloseTo(m.land.N(x + ox, y + oy), 6);
  });
});
