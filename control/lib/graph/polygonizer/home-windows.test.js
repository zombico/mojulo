// A home's windows placed by architecture (home-windows.js, window-laws.js): the house knows its own north apart from
// the plan's axes; each facade a grid every storey keeps; a room takes what it needs (a living room its light, a
// bedroom a window to leave by, a bathroom the standard frosted unit, a store none); and the laws an architect reads on
// the drawings hold.
import { describe, expect, it } from 'vitest';
import { compassOf, facingOf, egressOf, BATH, CORNER } from './home-windows.js';
import { structurizeHouse, storeyLevels } from './floorplan-structure.js';

// a two-storey brick house drawn from its seed: a living floor below, bedrooms and baths above
const HOUSE = { kind: 'floorplan', seed: 3, storeys: 2, tier: { base: 'house', beds: 3 }, windows: true, style: 'brick', houseLook: 2, design: { repair: true } };
const build = (m = HOUSE) => structurizeHouse({ ...m, ...storeyLevels(m) }, { ...m, view: 'cutaway' });

describe('the compass', () => {
  it('the recipe\'s own north; else the living room\'s longest outside wall to the sun; the plan\'s letters are not the compass', () => {
    const fp = { x0: 0, y0: 0, x1: 30, y1: 20 };
    // (a living room on the plan's N edge, 30 ft long, and on its W edge, 12 ft)
    const cells = [{ kind: 'room', glyph: 'L', x: 0, y: 0, w: 30, h: 12 }, { kind: 'room', glyph: 'B', x: 0, y: 12, w: 30, h: 8 }];
    const c = compassOf({}, cells, fp);
    expect([c.inferred, facingOf('N', c)]).toEqual([true, 180]);   // (its long wall faces south: the sun)
    expect(facingOf('N', compassOf({ compass: { hemisphere: 'south' } }, cells, fp))).toBe(0);
    expect(compassOf({ compass: { north: 90 } }, cells, fp)).toMatchObject({ north: 90, inferred: false });
    expect(facingOf('E', { north: 90 })).toBe(0);
    expect(() => compassOf({ compass: { north: 400 } })).toThrow(/compass.north/);
    expect(() => compassOf({ compass: { hemisphere: 'up' } })).toThrow(/compass.hemisphere/);
  });
});

describe('a home\'s windows', () => {
  it('the laws an architect reads hold; the read says the house\'s north', () => {
    const W = build().windows;
    expect(W.compass.inferred).toBe(true);
    for (const law of W.laws) expect(law.ok, `${law.id}: ${law.says}`).toBe(true);
  });

  it('each room what it is for: a store blind, a bathroom the standard frosted unit over its fixtures, a bedroom a window to leave by', () => {
    const H = build(), rooms = H.levels.flatMap((L) => L.structure.wallGraph.homeWindows.rooms);
    for (const r of rooms.filter((x) => x.need === 'no' && x.glyph !== 'W')) expect(r.units, r.glyph).toEqual([]);
    const baths = rooms.filter((x) => x.glyph === 'W');
    expect(baths.length).toBeGreaterThan(0);
    for (const r of baths) for (const u of r.units) expect([u.w, u.sill]).toEqual([BATH.w, BATH.sill]);
    const frosted = H.levels.flatMap((L) => L.structure.wallGraph.runs.flatMap((r) => r.openings || [])).filter((op) => op.obscured);
    expect(frosted.length).toBe(baths.reduce((n, r) => n + r.units.length, 0));
    for (const r of rooms.filter((x) => x.need === 'egress')) expect(r.units.some((u) => egressOf(u.style, u.w, u.top - u.sill, u.sill).ok)).toBe(true);
    // (every window clear of the corners, on one head line)
    for (const L of H.levels) {
      const fp = L.structure.wallGraph.footprint;
      for (const run of L.structure.wallGraph.runs.filter((r) => !r.interior)) for (const op of (run.openings || []).filter((o) => o.sill > 0.01)) {
        const [lo, hi] = run.orientation === 'h' ? [fp.x0, fp.x1] : [fp.y0, fp.y1];
        expect(op.a - lo >= CORNER - 1e-6 && hi - op.b >= CORNER - 1e-6).toBe(true);
      }
    }
  });

  it('the same recipe, the same windows; a house without the look places them as it always did', () => {
    const sig = (H) => H.levels.map((L) => L.structure.wallGraph.runs.flatMap((r) => (r.openings || []).map((o) => [o.a, o.b, o.sill].map((v) => v.toFixed(3)).join())));
    expect(sig(build())).toEqual(sig(build()));
    const legacy = build({ ...HOUSE, houseLook: undefined });
    expect('windows' in legacy).toBe(false);
    expect(legacy.levels[0].structure.wallGraph.homeWindows).toBeUndefined();
  });
});
