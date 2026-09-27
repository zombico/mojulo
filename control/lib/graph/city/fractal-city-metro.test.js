import { describe, expect, it, vi } from 'vitest';

// The metro profile: the storey stays, and block pitch, rights-of-way, lot grain,
// heights and the street kit come into proportion with it. The bands below are real-world
// ones, measured in metres by cityScaleCensus over three seeds; the stock city must not move at all.
vi.setConfig({ testTimeout: 120000 });

import { planFractalCity, assembleFractalCityScene, cityScaleCensus, fractalCityCameras, FRACTAL_CAMERAS, METRO, CITY_METERS_PER_UNIT } from './fractal-city.js';

const FRAME = { x: 2, y: 2, w: 220, d: 140 };
const metro = (seed, extra = {}) => planFractalCity({ seed, profile: 'metro', anchor: 'tower', region: FRAME, elements: { frontage: true }, ...extra });
const PLANS = [1, 7, 42].map((seed) => metro(seed));
const CENSUS = PLANS.map((p) => cityScaleCensus(p, FRAME));
const MASS = new Set(['building', 'anchor', 'midtower', 'townhouse', 'house']);
const overlap = (a, b, e = 1e-6) => a.x + e < b.x + b.w && b.x + e < a.x + a.w && a.y + e < b.y + b.d && b.y + e < a.y + a.d;

describe('metro profile: the stock city is untouched', () => {
  it('an absent profile plans the same city as profile "city", with no metro fields', () => {
    const a = planFractalCity({ seed: 7, anchor: 'tower' }), b = planFractalCity({ seed: 7, anchor: 'tower', profile: 'city' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.cues).toBeUndefined();
    expect(a.core).toBeUndefined();
    expect(a.stats.profile).toBeUndefined();
  });
  it('the stock recipe keeps the stock cameras', () => {
    expect(fractalCityCameras({ seed: 7 })).toBe(FRACTAL_CAMERAS);
    expect(assembleFractalCityScene({ seed: 7 }).cameras).toEqual(FRACTAL_CAMERAS);
  });
});

describe('metro profile: proportion bands (metres)', () => {
  it('is deterministic', () => {
    expect(JSON.stringify(metro(7))).toBe(JSON.stringify(PLANS[1]));
  });
  it('blocks sit at a real downtown pitch with a real crossing density', () => {
    for (const c of CENSUS) {
      expect(c.pitch).toBeGreaterThan(90);            // Portland 81 m … Manhattan / Chicago ≈ 140 m (√ area per block)
      expect(c.pitch).toBeLessThan(145);
      expect(c.crossingsPerKm2).toBeGreaterThan(45);  // Manhattan 46, Eixample 56, Portland 172
      expect(c.crossingsPerKm2).toBeLessThan(170);
      expect(c.streetShare).toBeLessThan(0.42);       // walk bands; crossings count twice
    }
  });
  it('heights are heavy-tailed and peak at the core', () => {
    for (const c of CENSUS) {
      expect(c.height.p50).toBeGreaterThan(12);       // all Manhattan 18 m, Midtown 20 m
      expect(c.height.p50).toBeLessThan(30);
      expect(c.height.max).toBeGreaterThan(150);
      expect(c.height.maxOverP50).toBeGreaterThan(7); // CBDs 8–24×
      expect(c.core.coreP50).toBeGreaterThan(c.core.edgeP50 * 1.5);
      expect(c.towers).toBeGreaterThan(3);
      expect(c.minSlenderness).toBeGreaterThan(3.5);  // nothing over 100 m is a slab
    }
  });
  it('the root tower is slender, not a third of the frame', () => {
    for (const p of PLANS) {
      const a = p.boxes.find((b) => b.kind === 'anchor');
      expect(a).toBeTruthy();
      expect((a.z1 - a.z0) / Math.min(a.w, a.d)).toBeGreaterThanOrEqual(METRO.anchor.slender);
      expect((a.z1 - a.z0) * CITY_METERS_PER_UNIT).toBeGreaterThan(170);
    }
  });
  it('no sub-anchor slab: a k16-size metro region carries no quadrant-sized mass', () => {
    const p = planFractalCity({ seed: 7, profile: 'metro', region: { x: 2, y: 2, w: 480, d: 288 }, depth: 6 });
    const masses = p.boxes.filter((b) => MASS.has(b.kind));
    expect(masses.every((b) => b.w * b.d < 0.01 * 480 * 288)).toBe(true);
  });
  it('the street kit stands at its real size, and a signalled crossing carries no stop signs', () => {
    for (const c of CENSUS) {
      expect(c.kit.streetSign).toBeLessThan(3.5);
      expect(c.kit.signal).toBeLessThan(6);
      expect(c.kit.stopSign).toBeNull();
    }
  });
});

describe('metro profile: fabric integrity', () => {
  it('masses stand wall to wall but never inside each other', () => {
    for (const p of PLANS) {
      const m = p.boxes.filter((b) => MASS.has(b.kind));
      for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) expect(overlap(m[i], m[j], 0.26)).toBe(false);
    }
  });
  it('walk tiles never overlap each other (the renderer lift never fires on them)', () => {
    const w = PLANS[1].grounds.filter((g) => g.kind === 'sidewalk');
    expect(w.length).toBeGreaterThan(20);
    for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) expect(overlap(w[i], w[j])).toBe(false);
  });
  it('a metro mass carries whole floors at a real floor height', () => {
    const b = PLANS[1].boxes.filter((x) => x.kind === 'building');
    expect(b.every((x) => Number.isInteger(x.floors) && x.floors >= 1)).toBe(true);
    expect(b.every((x) => [METRO.floorH.residential, METRO.floorH.office].includes(x.floorH))).toBe(true);
  });
  it('the portal car is a real-size car', () => {
    const p = metro(7, { traffic: true });
    const rects = p.faces.filter((f) => f.portalCarRect).map((f) => f.portalCarRect);
    expect(rects.length).toBeGreaterThan(0);
    for (const r of rects) expect(Math.max(r.w, r.d) * CITY_METERS_PER_UNIT).toBeLessThan(4.7);
  });
});

describe('metro profile: cameras and cues', () => {
  it('opens on a 1.7 m street eye and hands the world path its real-size cues', () => {
    const cams = fractalCityCameras({ profile: 'metro', region: FRAME });
    expect(cams.map((c) => c.name)).toEqual(['street', 'aerial', 'skyline']);
    expect(cams[0].worldFraming.cameraPosition[2] * CITY_METERS_PER_UNIT).toBeCloseTo(1.7, 5);
    const scene = assembleFractalCityScene({ seed: 7, profile: 'metro', region: FRAME });
    expect(scene.cameras).toEqual(cams);
    expect(scene.cityCues).toEqual({ figure: METRO.figure, car: METRO.car, pedHeight: METRO.pedHeight });
  });
  it('a stock-depth metro recipe still reaches block size (depth is not a metro block dial)', () => {
    const shallow = cityScaleCensus(planFractalCity({ seed: 7, profile: 'metro', region: FRAME, depth: 2 }), FRAME);
    expect(shallow.pitch).toBeLessThan(145);
  });
});
