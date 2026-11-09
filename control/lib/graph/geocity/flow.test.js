// THE METRO'S TRAFFIC: its arterials' lanes driven by the fleets' vehicles through a signal at each crossing. The smallest
// metro that still crosses its lines; the model stepped as the page steps it (a lane at a time, from its cycle's last
// turn once in reach), and held to the box rule: no two axes' vehicles in one crossing at once.
import { describe, it, expect } from 'vitest';
import { designGeocity } from './design.js';
import { flowOf, flowLaws, FLOW } from './flow.js';
import { createTrafficModel, stepTraffic, carFootprint, rectsTouch } from '../scene/channels/traffic-model.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const D = designGeocity(geocity, { seed: 2 }), F = flowOf(D, { seed: 2 });

describe('the metro\'s traffic, planned', () => {
  it('drives each arterial\'s travel lanes but a streetcar\'s, the land\'s length, each its way', () => {
    const travel = D.lines.flatMap((l) => l.bands.filter((b) => b.kind === 'travel' && !b.streetcar).map((b) => ({ l, b })));
    expect(F.lanes.length).toBe(travel.length);
    for (const L of F.lanes) {
      const l = D.lines.find((x) => x.id === L.line), b = l.bands.find((x) => x.kind === 'travel' && !x.streetcar && Math.abs(l.at + (x.from + x.to) / 2 - L.cross) < 1e-3);
      expect(b).toBeDefined();
      expect(L.dir).toBe(b.dir);
      expect(L.axis).toBe(l.axis === 'ns' ? 'y' : 'x');
    }
  });

  it('signals every crossing, its all-red long enough for its longest vehicle across its widest box; every lane within what it holds', () => {
    const ns = D.lines.filter((l) => l.axis === 'ns').length, ew = D.lines.filter((l) => l.axis === 'ew').length;
    expect(F.signals.length).toBe(ns * ew);
    expect(new Set(F.signals.map((s) => s.cycle)).size).toBe(1);
    for (const l of flowLaws(F)) expect(l.ok, l.value).toBe(true);
    expect(F.cars.length).toBeGreaterThan(F.lanes.length);
    // (the mix: mostly the family cars, a bus or a van among them)
    expect(F.kinds.some((k) => k.model.startsWith('loft:'))).toBe(true);
    expect(F.T.CAR_LEN).toBe(Math.max(...F.kinds.map((k) => k.len)));
  });

  it('lays each lane on its road: the drape\'s height at its cells, a kerb up over a cross street\'s walk', () => {
    const S = D.land.S, L = F.lanes.find((x) => x.axis === 'x'), l = D.lines.find((x) => x.id === L.line), R2 = l.road / 2, k = (L.cross - l.at + R2) / (2 * R2);
    for (let i = 0; i < L.ground.length; i += 2) { const u = L.ground[i]; expect(L.ground[i + 1]).toBeCloseTo(S(u, l.at - R2) + (S(u, l.at + R2) - S(u, l.at - R2)) * k, 1); }
    const N = F.lanes.find((x) => x.axis === 'y'), b = D.lines.find((x) => x.axis === 'ew'), at = b.at - (b.road / 2 + b.half) / 2;
    const zAt = (g, u) => { for (let i = 2; i < g.length; i += 2) if (g[i] >= u) return g[i - 1] + ((g[i + 1] - g[i - 1]) * (u - g[i - 2])) / (g[i] - g[i - 2]); return g[g.length - 1]; };
    expect(zAt(N.ground, at) - S(N.cross, at)).toBeCloseTo(0.15, 1);
  });

  it('is the same plan from the same seed', () => {
    expect(JSON.stringify(flowOf(D, { seed: 2 }))).toBe(JSON.stringify(F));
  });
});

describe('the metro\'s traffic, driven as the page drives it', () => {
  it('never has two axes\' vehicles in one crossing, its lanes each entered at its own time', () => {
    const cycle = F.signals[0].cycle, T = F.T;
    // each lane its own model, come into reach at its own clock (the page's rule: from its cycle's last turn)
    const lanes = F.lanes.map((L, li) => {
      const cars = F.cars.filter((c) => c[0] === li), m = createTrafficModel([L], cars.map((c) => ({ lane: 0, startFrac: c[3], len: F.kinds[c[1]].len })), F.signals, T);
      return { L, m, cars, enter: (li * 7.3) % 50 };
    });
    let crossed = 0;
    for (let t = 0; t <= 90; t += 0.5) {
      const inBox = F.signals.map(() => new Set());
      for (const lane of lanes) {
        if (t < lane.enter) continue;
        const { m, L } = lane;
        if (t < m.t - 1e-9 || t - m.t > cycle) { m.reset(); m.t = Math.floor(t / cycle) * cycle; }
        stepTraffic(m, t);
        for (const c of m.cars) {
          const fp = carFootprint(L, c.s, c.len, T.CAR_WID, { ...T, MARGIN: 0 });
          F.signals.forEach((s, si) => { if (rectsTouch(fp, { x: s.x - s.wx / 2, y: s.y - s.wy / 2, w: s.wx, d: s.wy })) inBox[si].add(L.axis); });
          if (c.v > 0.5) crossed++;
        }
      }
      for (const axes of inBox) expect(axes.size).toBeLessThanOrEqual(1);
    }
    expect(crossed).toBeGreaterThan(0);
  });

  it('keeps each lane\'s vehicles apart, front to back', () => {
    const L = F.lanes[0], cars = F.cars.filter((c) => c[0] === 0), T = F.T;
    const m = createTrafficModel([L], cars.map((c) => ({ lane: 0, startFrac: c[3], len: F.kinds[c[1]].len })), F.signals, T);
    for (let t = 0; t <= 60; t += 1) {
      stepTraffic(m, t);
      const o = m.cars.slice().sort((a, b) => a.s - b.s);
      for (let i = 0; i + 1 < o.length; i++) expect(o[i + 1].s - o[i + 1].len / 2 - (o[i].s + o[i].len / 2)).toBeGreaterThan(FLOW.T.GAP - 1e-6);
    }
  });
});
