import { describe, it, expect } from 'vitest';
import { planFractalCity, fractalCityCameras, metroAtmosphere, CITY_METERS_PER_UNIT } from './fractal-city.js';
import { planCanalCity, canalCityCensus, canalCameras, CANAL } from './canal-city.js';
import { gablePieces, canalHouseFaces, canalBridgeFaces, CANAL_GABLES, RIDGE_T } from '../architecture/canal-house.js';

const M = CITY_METERS_PER_UNIT;
const plans = new Map();
const planOf = (seed, layout = 'ring') => {
  const k = `${seed}|${layout}`;
  if (!plans.has(k)) plans.set(k, planFractalCity({ profile: 'canal', seed, canals: { layout } }));
  return plans.get(k);
};
const overlaps = (a, b, e = 1e-3) => a.x < b.x + b.w - e && b.x < a.x + a.w - e && a.y < b.y + b.d - e && b.y < a.y + a.d - e;
const inside = (g, x, y) => x >= g.x - 1e-6 && x <= g.x + g.w + 1e-6 && y >= g.y - 1e-6 && y <= g.y + g.d + 1e-6;
const CASES = [[1, 'ring'], [7, 'ring'], [42, 'parallel']];

describe('canal city: the gate', () => {
  it('a recipe without the profile never reaches the canal planner (canals alone is ignored)', () => {
    const stock = planFractalCity({ seed: 7 });
    expect(JSON.stringify(planFractalCity({ seed: 7, canals: { layout: 'ring' } }))).toBe(JSON.stringify(stock));
    expect(stock.stats.profile).toBeUndefined();
    expect(stock.boxes.some((b) => b.kind === 'canalhouse' || b.kind === 'canalbridge')).toBe(false);
  });
  it('the canal plan reports its profile and is deterministic per seed', () => {
    const a = planOf(7);
    expect(a.stats.profile).toBe('canal');
    expect(JSON.stringify(planCanalCity({ seed: 7, canals: { layout: 'ring' }, elements: planOf(7).elements }).boxes)).toBe(JSON.stringify(a.boxes));
    expect(JSON.stringify(planOf(8).boxes)).not.toBe(JSON.stringify(a.boxes));
  });
});

describe('canal city: the machine gate (bands from the plan\'s reference sheet)', () => {
  for (const [seed, layout] of CASES) {
    it(`seed ${seed} ${layout}: a flat skyline — nothing but the church above the gable band`, () => {
      const plan = planOf(seed, layout), c = canalCityCensus(plan);
      expect(c.top.max).toBeLessThanOrEqual(23.01);                 // mid-rise (22.5–30 m) is barred in the UNESCO area
      expect(c.eaves.p50).toBeGreaterThanOrEqual(12);
      expect(c.eaves.p50).toBeLessThanOrEqual(17);
      expect(c.maxOverP50).toBeLessThanOrEqual(1.6);
      const tall = plan.boxes.filter((b) => b.z1 * M > 23.01 && b.shape !== 'church');
      expect(tall.map((b) => b.kind)).toEqual([]);
      expect(c.church && c.church.height).toBeGreaterThan(60);      // the one landmark that breaks the roofline
      expect(c.church.height).toBeLessThan(95);
    });
    it(`seed ${seed} ${layout}: canal-house lots, a real water share, bridges and boats`, () => {
      const plan = planOf(seed, layout), c = canalCityCensus(plan);
      expect(c.houses).toBeGreaterThan(600);
      expect(c.frontage.p50).toBeGreaterThanOrEqual(5);
      expect(c.frontage.p50).toBeLessThanOrEqual(8.5);
      expect(c.waterShare).toBeGreaterThanOrEqual(0.1);
      expect(c.waterShare).toBeLessThanOrEqual(0.25);
      expect(plan.stats.bridges).toBeGreaterThan(5);
      expect(plan.stats.houseboats).toBeGreaterThan(5);
      expect(Object.keys(c.gables).length).toBe(CANAL_GABLES.length);   // every outline appears
      expect(c.gables.cornice).toBeGreaterThan(c.gables.step);         // cornice fronts are the majority, step gables rare
    });
    it(`seed ${seed} ${layout}: integrity — houses never overlap each other, water, a quay or a street`, () => {
      const plan = planOf(seed, layout);
      const houses = plan.boxes.filter((b) => b.kind === 'canalhouse');
      const hard = plan.grounds.filter((g) => ['quay', 'street', 'junction', 'canal-bed'].includes(g.kind));
      const sorted = [...houses].sort((a, b) => a.x - b.x);
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length && sorted[j].x < sorted[i].x + sorted[i].w; j++) expect(overlaps(sorted[i], sorted[j])).toBe(false);
        for (const g of hard) if (overlaps(sorted[i], g)) throw new Error(`house at ${sorted[i].x.toFixed(2)},${sorted[i].y.toFixed(2)} overlaps ${g.kind}`);
      }
    });
    it(`seed ${seed} ${layout}: every house fronts a quay or a street on its gable face`, () => {
      const plan = planOf(seed, layout);
      const fronts = plan.grounds.filter((g) => ['quay', 'street', 'junction'].includes(g.kind));
      for (const b of plan.boxes.filter((h) => h.kind === 'canalhouse')) {
        const e = 0.05, x = b.face === '-x' ? b.x - e : b.face === '+x' ? b.x + b.w + e : b.x + b.w / 2;
        const y = b.face === '-y' ? b.y - e : b.face === '+y' ? b.y + b.d + e : b.y + b.d / 2;
        expect(fronts.some((g) => inside(g, x, y))).toBe(true);
      }
    });
  }
});

describe('canal city: the house and bridge geometry', () => {
  it('every gable outline covers the roof section behind it (no roof pokes past the gable)', () => {
    for (const type of CANAL_GABLES.filter((t) => t !== 'cornice')) {
      const pieces = gablePieces(type).map((p) => p.pts);
      for (let s = 0.01; s < 1; s += 0.01) {
        const roof = RIDGE_T * (1 - Math.abs(2 * s - 1));
        // the outline's top at s: the highest t of any convex piece spanning s
        let top = 0;
        for (const pts of pieces) {
          const xs = pts.map((p) => p[0]);
          if (s < Math.min(...xs) || s > Math.max(...xs)) continue;
          for (let i = 0; i < pts.length; i++) {
            const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
            if ((a[0] - s) * (b[0] - s) <= 0 && a[0] !== b[0]) top = Math.max(top, a[1] + ((s - a[0]) / (b[0] - a[0])) * (b[1] - a[1]));
          }
        }
        if (type === 'neck' && (s > 0.26 && s < 0.3 || s > 0.7 && s < 0.74)) continue;   // the claws' shoulders: real neck gables show the roof there
        expect(top, `${type} at s=${s.toFixed(2)}`).toBeGreaterThanOrEqual(roof - 1e-9);
      }
    }
  });
  it('every piece is convex (the World fan-triangulates clipped quads)', () => {
    for (const type of CANAL_GABLES) for (const { pts } of gablePieces(type)) {
      let sign = 0;
      for (let i = 0; i < pts.length; i++) {
        const [a, b, c] = [pts[i], pts[(i + 1) % pts.length], pts[(i + 2) % pts.length]];
        const z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
        if (Math.abs(z) < 1e-12) continue;
        if (!sign) sign = Math.sign(z); else expect(Math.sign(z)).toBe(sign);
      }
    }
  });
  it('a house and a bridge draw finite faces inside their boxes', () => {
    const plan = planOf(7);
    const shade = (c, hex) => hex;
    const house = plan.boxes.find((b) => b.kind === 'canalhouse' && b.ridge === 'perp' && b.gable === 'bell');
    const bridge = plan.boxes.find((b) => b.kind === 'canalbridge');
    for (const [b, faces] of [[house, canalHouseFaces(house, shade)], [bridge, canalBridgeFaces(bridge, shade)]]) {
      expect(faces.length).toBeGreaterThan(3);
      for (const f of faces) for (const [x, y, z] of f.corners) {
        expect(Number.isFinite(x + y + z)).toBe(true);
        expect(x).toBeGreaterThanOrEqual(b.x - 0.05); expect(x).toBeLessThanOrEqual(b.x + b.w + 0.05);
        expect(y).toBeGreaterThanOrEqual(b.y - 0.05); expect(y).toBeLessThanOrEqual(b.y + b.d + 0.05);
        expect(z).toBeLessThanOrEqual((b.topZ ?? b.z1) + 1e-6);
      }
    }
  });
});

describe('canal city: cameras, cues and atmosphere', () => {
  it('the street eye stands at 1.7 m on a quay, and the presets are plan-free', () => {
    for (const layout of ['ring', 'parallel']) {
      const recipe = { profile: 'canal', seed: 7, canals: { layout } }, plan = planOf(7, layout);
      const cams = fractalCityCameras(recipe);
      expect(cams).toEqual(canalCameras(recipe));
      expect(cams.map((c) => c.name)).toEqual(['street', 'aerial', 'canal']);
      const [x, y, z] = cams[0].worldFraming.cameraPosition;
      expect(z * M).toBeCloseTo(1.7, 5);
      expect(plan.grounds.some((g) => g.kind === 'quay' && inside(g, x, y))).toBe(true);
    }
  });
  it('real-size cues ride the plan, and the canal town gets its own sky and haze', () => {
    expect(planOf(7).cues).toEqual({ figure: 0.67, car: 0.72, pedHeight: 1.75 / 3.66 });
    const atm = metroAtmosphere({ profile: 'canal' });
    expect(atm.sky.horizon).toEqual([208, 212, 214]);
    expect(atm.haze.density).toBeCloseTo(1.98 / (2 * Math.hypot(CANAL.region.w, CANAL.region.d)), 12);
    expect(metroAtmosphere({})).toBeNull();
  });
});
