import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { cityTraffic } from './traffic.js';
import { assembleCityScene } from './scene.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { CITY_METERS_PER_UNIT as U } from '../fractal-city.js';

const recipe = (rec = {}) => ({ kind: 'city', ...inferCity({ seed: 3, grammar: 'new-york', board: { cols: 8, rows: 6 }, ...rec }).recipe });

describe('traffic: the streets as lanes and signalled junctions', () => {
  const d = designCity(recipe()), T = cityTraffic(d);
  // the straight street runs, in metres
  const runs = d.streets.flatMap((s) => s.pts.slice(1).map((b, k) => ({ s, a: s.pts[k], b })));
  it('lays every lane on a carriageway, a car\'s width inside its kerbs, along the street it drives', () => {
    expect(T.carLanes.length).toBeGreaterThan(8);
    for (const L of T.carLanes) {
      const c = L.cross * U, lo = L.lo * U, hi = L.hi * U, i = L.axis === 'x' ? 1 : 0, j = 1 - i;
      const on = runs.find(({ s, a, b }) => Math.abs(a[i] - b[i]) < 1e-6 && Math.abs(c - a[i]) <= s.road / 2 - 1 && lo >= Math.min(a[j], b[j]) - 0.01 && hi <= Math.max(a[j], b[j]) + 0.01);
      expect(on, JSON.stringify(L)).toBeTruthy();
    }
  });
  it('signals every place two streets meet, the box as wide as their carriageways', () => {
    expect(T.junctions.length).toBeGreaterThan(4);
    for (const J of T.junctions) {
      const v = runs.find(({ s, a, b }) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[0] - J.x * U) < 0.01 && Math.abs(s.road / U - J.wx) < 0.01);
      const h = runs.find(({ s, a, b }) => Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[1] - J.y * U) < 0.01 && Math.abs(s.road / U - J.wy) < 0.01);
      expect(v && h).toBeTruthy();
    }
  });
  it('drives on the grammar\'s side: a two-way street\'s +x lane south of its line on the right, north on the left', () => {
    const lane = (G) => { const t = cityTraffic(designCity(recipe({ grammar: G }))); const p = t.carLanes.find((L) => L.axis === 'x' && !L.oneWay && L.dir === 1); return { p, m: t.carLanes.find((L) => L.axis === 'x' && !L.oneWay && L.dir === -1 && L.lo === p.lo && L.hi === p.hi) }; };
    const ny = lane('new-york'), ld = lane('london');
    expect(ny.p.cross).toBeLessThan(ny.m.cross);
    expect(ld.p.cross).toBeGreaterThan(ld.m.cross);
  });
  it('rolls no dice: a lot by hand moves no lane', () => {
    const lot = d.lots.find((l) => l.use !== 'parking');
    expect(cityTraffic(designCity(recipe({ lots: { [lot.id]: { storeys: 30 } } })))).toEqual(T);
  });
  it('hands the lanes to the world path, which fills them with signalled cars; `cars: false` and massing leave them empty', async () => {
    const { payload } = await resolveWorldScene({ ref: 'traffic-test', manifest: recipe() });
    expect(payload.cars.length).toBeGreaterThan(10);
    expect(payload.signals.length).toBe(T.junctions.length);
    expect(payload.trafficLanes.length).toBeGreaterThan(5);
    expect(payload.carLanes).toBeUndefined();
    expect(assembleCityScene(recipe({ cars: false })).carLanes).toBeUndefined();
    expect(assembleCityScene(recipe({ fidelity: 'massing' })).carLanes).toBeUndefined();
    expect(() => readCityPlan({ cars: 'busy' })).toThrow(/cars is true .*, false .*, or \{ turn\?/);
  });
  it('a segment\'s level drives only the streets of its crop', () => {
    const r = recipe({ board: { cols: 14, rows: 10 }, segments: true }), ds = designCity(r), seg = ds.segments[0];
    const s = assembleCityScene({ ...r, level: { segment: seg.id } });
    const ring = 140;
    for (const L of s.carLanes) {
      const [x0, x1, y0, y1] = L.axis === 'x' ? [L.lo, L.hi, L.cross, L.cross] : [L.cross, L.cross, L.lo, L.hi];
      // a lane sits up to a quarter of its road off its street's line, which is inside the crop
      const off = 10;
      expect(x0 * U).toBeGreaterThanOrEqual(seg.rect.x0 - ring - off);
      expect(x1 * U).toBeLessThanOrEqual(seg.rect.x1 + ring + off);
      expect(y0 * U).toBeGreaterThanOrEqual(seg.rect.y0 - ring - off);
      expect(y1 * U).toBeLessThanOrEqual(seg.rect.y1 + ring + off);
    }
    expect(s.carLanes.length).toBeLessThan(cityTraffic(ds).carLanes.length);
  });
});
