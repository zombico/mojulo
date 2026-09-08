import { describe, expect, it } from 'vitest';

import { insetFromEdifice, CITY_UNITS_PER_FOOT, DEFAULT_INSET_MARGIN } from './city-insets.js';
import { cityThemeAdapter, planFractalCity, STOREY_H } from './fractal-city.js';
import { buildEdificeFaces, planEdifice, FLOOR_FT } from '../architecture/edifice.js';

// the demo's five-story facade: 60 × 40 ft, one mass
const FACADE = {
  kind: 'edifice',
  masses: [{ id: 'main', footprint: { w: 60, d: 40 }, floors: 5, at: [0, 0],
    facade: { material: 'concrete', rhythm: 'banded', glass: '#5f7d8c', frame: '#d9d2c5' },
    roof: 'modern-shed', interior: { kernel: 'open' } }],
  entrance: 'main', seed: 1,
};

describe('city-insets — an edifice in city units', () => {
  it('scales feet into city units by one storey (STOREY_H / FLOOR_FT) and lands the plot at `at`', () => {
    expect(CITY_UNITS_PER_FOOT).toBeCloseTo(STOREY_H / FLOOR_FT, 12);
    const inset = insetFromEdifice(FACADE, { at: [10, 5] });
    expect(inset.plot.x).toBe(10); expect(inset.plot.y).toBe(5);
    expect(inset.plot.w).toBeCloseTo(60 * CITY_UNITS_PER_FOOT, 9);
    expect(inset.plot.d).toBeCloseTo(40 * CITY_UNITS_PER_FOOT, 9);
    expect(inset.footprint).toEqual({ x: 10 - DEFAULT_INSET_MARGIN, y: 5 - DEFAULT_INSET_MARGIN, w: inset.plot.w + 2 * DEFAULT_INSET_MARGIN, d: inset.plot.d + 2 * DEFAULT_INSET_MARGIN });
    expect(inset.floors).toBe(5);
    // the tallest corner is five storeys, in city units
    const topZ = Math.max(...inset.faces.flatMap((f) => f.corners.map((c) => c[2])));
    expect(topZ).toBeGreaterThanOrEqual(5 * STOREY_H - 1e-9);
    expect(inset.envelopes[0].z1).toBeCloseTo(5 * STOREY_H, 9);
  });

  it('carries every edifice face and its textures, corners inside the plot', () => {
    const plan = planEdifice(FACADE);
    const { faces, textures } = buildEdificeFaces(plan);
    const inset = insetFromEdifice(FACADE, { at: [3, 4] });
    expect(inset.faces.length).toBe(faces.length);
    expect(Object.keys(inset.textures)).toEqual(Object.keys(textures));
    // roof eaves overhang the plot by design; everything stays inside the claimed footprint (plot + ring)
    const fp = inset.footprint, eps = 1e-6;
    for (const f of inset.faces) for (const [x, y] of f.corners) {
      expect(x).toBeGreaterThanOrEqual(fp.x - eps); expect(x).toBeLessThanOrEqual(fp.x + fp.w + eps);
      expect(y).toBeGreaterThanOrEqual(fp.y - eps); expect(y).toBeLessThanOrEqual(fp.y + fp.d + eps);
    }
  });
});

describe('cityThemeAdapter — asset.edifices lowers to the mint knob', () => {
  it('passes the list through untouched (validation is the mint\'s)', () => {
    const list = [{ ref: 'sk_abc', at: [14, 9] }];
    expect(cityThemeAdapter({ asset: { edifices: list } }).edifices).toEqual(list);
    expect(cityThemeAdapter({ asset: {} }).edifices).toBeUndefined();
  });
});

describe('planFractalCity — lot placement (the default): the inset takes a parcel', () => {
  const overlaps = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);
  const MASS = new Set(['building', 'anchor', 'midtower', 'townhouse', 'house', 'garage']);

  it('replaces a generated building, evicts everything on the plot, keeps every road', () => {
    const inset = { ...insetFromEdifice(FACADE, { at: [0, 0] }), ref: 'sk_test' };
    const base = planFractalCity({ seed: 11, depth: 2 });
    const plan = planFractalCity({ seed: 11, depth: 2, insets: [inset] });
    const placed = plan.stats.insets[0];
    expect(['lot', 'lot-kerb']).toContain(placed.placement);   // 60 × 40 ft outgrows this city's parcels → it fronts the kerb
    expect(placed.replaced).toBeGreaterThanOrEqual(1);
    expect(plan.faces.filter((f) => f.inset === 'sk_test').length).toBe(inset.faces.length);
    // nothing else stands on the plot
    for (const b of plan.boxes) expect(overlaps(b, placed.plot), `box ${b.kind} at ${b.x},${b.y}`).toBe(false);
    // the plot is where a mass stood, not on a road: the base city had a mass there, and its roads are untouched
    expect(base.boxes.some((b) => MASS.has(b.kind) && overlaps(b, placed.plot))).toBe(true);
    expect(JSON.stringify(plan.ribbons)).toBe(JSON.stringify(base.ribbons));
    // the reseated faces sit on the plot (eaves may overhang by their real width)
    const xs = plan.faces.filter((f) => f.inset === 'sk_test').flatMap((f) => f.corners.map((c) => c[0]));
    expect(Math.min(...xs)).toBeGreaterThan(placed.plot.x - 0.2); expect(Math.max(...xs)).toBeLessThan(placed.plot.x + placed.plot.w + 0.2);
    expect(plan.insets[0].envelope.z1).toBeCloseTo(Math.max(...plan.faces.filter((f) => f.inset === 'sk_test').flatMap((f) => f.corners.map((c) => c[2]))), 9);
  });

  it('a 90° seat keeps the footprint area and turns the roof normals with it', () => {
    const inset = { ...insetFromEdifice(FACADE, { at: [0, 0] }), ref: 'sk_test' };
    const plan = planFractalCity({ seed: 11, depth: 2, insets: [inset] });
    const p = plan.stats.insets[0];
    if (p.yaw === 90) { expect(p.plot.w).toBeCloseTo(inset.plot.d, 9); expect(p.plot.d).toBeCloseTo(inset.plot.w, 9); }
    else { expect(p.plot.w).toBeCloseTo(inset.plot.w, 9); expect(p.plot.d).toBeCloseTo(inset.plot.d, 9); }
  });
});

describe('planFractalCity — a building sized to a parcel sits inside it', () => {
  it('50 × 27 ft fits an anchor lot at seed 11 without touching the sidewalk', () => {
    const small = { ...FACADE, masses: [{ ...FACADE.masses[0], footprint: { w: 50, d: 27 } }] };
    const inset = { ...insetFromEdifice(small, { at: [0, 0] }), ref: 'sk_small' };
    const plan = planFractalCity({ seed: 11, depth: 2, insets: [inset] });
    expect(plan.stats.insets[0].placement).toBe('lot');
    expect(plan.stats.insets[0].replaced).toBe(1);
  });
});

describe('planFractalCity — plaza mode (explicit `at`) reserves before the roads', () => {
  const overlaps = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);

  it('no block, road or lot claims the plot; the faces are appended; stats name the inset', () => {
    const inset = { ...insetFromEdifice(FACADE, { at: [14, 9] }), ref: 'sk_test', mode: 'plaza' };
    const plan = planFractalCity({ seed: 11, depth: 2, insets: [inset] });
    // nothing at all on the building's plot; no built mass on the sidewalk ring either (a signal pole
    // or lamp may stand at the ring's kerb, exactly as beside a landmark plaza)
    const MASS = new Set(['building', 'anchor', 'midtower', 'townhouse', 'house', 'garage']);
    for (const b of plan.boxes) expect(overlaps(b, inset.plot), `box ${b.kind} at ${b.x},${b.y}`).toBe(false);
    for (const b of plan.boxes) if (MASS.has(b.kind)) expect(overlaps(b, inset.footprint), `mass ${b.kind} at ${b.x},${b.y}`).toBe(false);
    expect(plan.faces.filter((f) => f.inset === 'sk_test').length).toBe(inset.faces.length);
    expect(plan.grounds.some((g) => g.kind === 'inset-plaza')).toBe(true);
    expect(plan.stats.insets).toEqual([expect.objectContaining({ ref: 'sk_test', placement: 'plaza', faces: inset.faces.length, floors: 5, inside: true, overlapsReserved: false })]);
  });

  it('the same seed without insets is unchanged (no stream perturbation)', () => {
    const a = JSON.stringify(planFractalCity({ seed: 11, depth: 2 }).boxes);
    const b = JSON.stringify(planFractalCity({ seed: 11, depth: 2, insets: [] }).boxes);
    expect(b).toBe(a);
  });

  it('under baseScale the inset rides the output scale-down: the plot lands where `at` says', () => {
    const inset = { ...insetFromEdifice(FACADE, { at: [14, 9] }), ref: 'sk_test', mode: 'plaza' };
    const plan = planFractalCity({ seed: 11, depth: 2, baseScale: 0.7, insets: [inset] });
    const xs = plan.faces.filter((f) => f.inset === 'sk_test').flatMap((f) => f.corners.map((c) => c[0]));
    const own = inset.faces.flatMap((f) => f.corners.map((c) => c[0]));   // eaves overhang the plot; compare to the inset itself
    expect(Math.min(...xs)).toBeCloseTo(Math.min(...own), 6);
    expect(Math.max(...xs)).toBeCloseTo(Math.max(...own), 6);
  });
});
