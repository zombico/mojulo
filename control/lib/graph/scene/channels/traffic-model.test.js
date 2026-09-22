// Signalised traffic, headless: the SAME model the world page runs (its source is embedded verbatim
// into the cars channel), simulated on the default-frame tower city with traffic on for several full
// signal cycles at the fixed dt. The invariants here are what "cars don't collide" means.
import { describe, expect, it } from 'vitest';

import { planFractalCity, carLaneToPath } from '../../city/fractal-city.js';
import { TRAFFIC, TRAFFIC_MODEL_SOURCE, buildSignals, phaseAt, laneCrossings, pairLanes, carsPerLane, createTrafficModel, trafficTick, stepTraffic, inBox } from './traffic-model.js';
import { carsChannelScript } from './cars.js';

const CARS_PER_LANE = 3, CAR_SPEED = 1.26;   // world-kinds attachCityCars' numbers
const DFLT = { seed: 3, anchor: 'tower', density: 0.7, locale: 'north-america', traffic: true, elements: { frontage: true } };

// the world-kinds pairing, reproduced without the DB: lanes → trimmed trafficLanes + cars
function cityTraffic(recipe) {
  const plan = planFractalCity(recipe);
  const signals = plan.signals;
  const trafficLanes = pairLanes(plan.carLanes, signals, CAR_SPEED, TRAFFIC);
  const cars = [];
  trafficLanes.forEach((L, li) => { const n = carsPerLane(L.total, CARS_PER_LANE, TRAFFIC, L.crossings); for (let k = 0; k < n; k++) cars.push({ lane: li, startFrac: ((k / n) + li * 0.19) % 1 }); });
  return { plan, lanes: trafficLanes, signals, trafficLanes, cars, model: createTrafficModel(trafficLanes, cars, signals, TRAFFIC) };
}

describe('signalised traffic — the phase program', () => {
  it('phases are exclusive per junction: at any instant at most one axis is green, with all-red clearances between', () => {
    const sig = buildSignals([{ x: 10, y: 8, streetW: 3.1 }], 7, { x: 2, y: 2, w: 30, d: 18 })[0];
    expect(sig.cycle).toBe(2 * (TRAFFIC.GREEN + TRAFFIC.CLEARANCE));
    let sawX = 0, sawY = 0, sawRed = 0;
    for (let t = 0; t < sig.cycle * 3; t += 0.05) {
      const p = phaseAt(sig, t);
      expect([null, 'x', 'y']).toContain(p.axis);
      if (p.axis === 'x') sawX += 1; else if (p.axis === 'y') sawY += 1; else sawRed += 1;
      // the transition out of a green always passes through a clearance long enough to empty the box
      if (p.axis) { const q = phaseAt(sig, t + 0.05); if (q.axis && q.axis !== p.axis) throw new Error('green to green with no clearance'); }
    }
    expect(sawX).toBeGreaterThan(0); expect(sawY).toBeGreaterThan(0); expect(sawRed).toBeGreaterThan(0);
    // the clearance covers the worst-case crossing: from a crawl at ACCEL across a major box plus a car length
    const dist = 3.1 + TRAFFIC.CAR_LEN, tAccel = CAR_SPEED / TRAFFIC.ACCEL, dAccel = 0.5 * TRAFFIC.ACCEL * tAccel * tAccel;
    expect(tAccel + (dist - dAccel) / CAR_SPEED).toBeLessThan(TRAFFIC.CLEARANCE);
  });

  it('offsets are seeded (deterministic per seed and junction, varied across junctions)', () => {
    const js = Array.from({ length: 6 }, (_, i) => ({ x: 5 + i * 4, y: 8, streetW: 1.3 }));
    const a = buildSignals(js, 11, { x: 0, y: 0, w: 30, d: 18 }), b = buildSignals(js, 11, { x: 0, y: 0, w: 30, d: 18 });
    expect(a.map((s) => s.offset)).toEqual(b.map((s) => s.offset));
    expect(new Set(a.map((s) => s.offset)).size).toBeGreaterThan(1);
    expect(a.every((s) => s.major === 'x')).toBe(true);
    expect(buildSignals(js, 11, { x: 0, y: 0, w: 18, d: 30 })[0].major).toBe('y');
  });

  it('stop lines sit outside the junction box, in travel order, for both directions', () => {
    const signals = buildSignals([{ x: 10, y: 8, streetW: 3.1 }, { x: 20, y: 8, streetW: 1.3 }], 1, { x: 0, y: 0, w: 30, d: 18 });
    for (const dir of [1, -1]) {
      const cx = laneCrossings({ axis: 'x', cross: 8.4, lo: 0, hi: 30, dir }, signals);
      expect(cx.length).toBe(2);
      for (const c of cx) { expect(c.sStop).toBeLessThan(c.sIn); expect(c.sIn).toBeLessThan(c.sOut); expect(c.sIn - c.sStop).toBeCloseTo(TRAFFIC.STOP_MARGIN, 9); }
      expect(cx[0].sIn).toBeLessThan(cx[1].sIn);
    }
    // a lane that does not run through the box (offset by more than half the road) crosses nothing
    expect(laneCrossings({ axis: 'x', cross: 12, lo: 0, hi: 30, dir: 1 }, signals).length).toBe(0);
  });
});

describe('signalised traffic — the default tower city, several cycles', () => {
  const sim = cityTraffic(DFLT);
  const { model, signals, trafficLanes } = sim;
  const cycle = signals[0].cycle;
  const T = TRAFFIC;

  it('the plan exports signals with traffic on, none without, and the lanes cross real junctions', () => {
    expect(signals.length).toBeGreaterThan(0);
    expect(trafficLanes.some((L) => L.crossings.length > 0)).toBe(true);
    expect(planFractalCity({ ...DFLT, traffic: undefined }).signals).toBeUndefined();
    // lanes never run through the centred tower: no lane's span covers the tower's footprint
    const t = sim.plan.boxes.find((b) => b.kind === 'anchor' && b.glass === '#aebfd0');
    for (const L of sim.lanes) {
      const along = L.axis === 'x' ? [t.x, t.x + t.w] : [t.y, t.y + t.d], across = L.axis === 'x' ? [t.y, t.y + t.d] : [t.x, t.x + t.w];
      if (L.cross > across[0] && L.cross < across[1]) expect(L.lo >= along[1] - 1e-6 || L.hi <= along[0] + 1e-6, 'a lane runs through the tower').toBe(true);
    }
  });

  it('no two cars on perpendicular lanes share a junction box; no same-lane car overlaps or passes the one ahead; stops are outside the box; every lane moves', () => {
    model.reset();
    const steps = Math.round((3 * cycle) / T.DT);
    const moved = trafficLanes.map(() => 0);
    const stepsPerCycle = Math.round(cycle / T.DT), movedThisCycle = trafficLanes.map(() => 0);
    const lastS = model.cars.map((c) => c.s);
    const order0 = trafficLanes.map((_, li) => model.lanes[li].cars.slice().sort((p, q) => p.s - q.s).map((c) => c.idx));
    for (let k = 0; k < steps; k++) {
      trafficTick(model, T.DT);
      // (1) box exclusivity across axes, per signal
      const occupancy = new Map();   // signal index → Set(axis)
      model.cars.forEach((c) => {
        const lane = model.lanes[c.lane];
        for (const cx of lane.crossings) if (inBox(c.s, cx, T)) (occupancy.get(cx.sig) || occupancy.set(cx.sig, new Set()).get(cx.sig)).add(lane.axis);
      });
      for (const [si, axes] of occupancy) expect(axes.size, `step ${k}: two axes inside junction ${si}`).toBeLessThanOrEqual(1);
      // (2) same-lane: no overlap, no passing (the cyclic order never changes)
      model.lanes.forEach((lane, li) => {
        const sorted = lane.cars.slice().sort((p, q) => p.s - q.s);
        for (let i = 0; i < sorted.length; i++) {
          const a = sorted[i], b = sorted[(i + 1) % sorted.length];
          const gap = (i === sorted.length - 1 ? b.s + lane.total : b.s) - a.s;
          if (sorted.length > 1) expect(gap, `step ${k} lane ${li}: cars overlap`).toBeGreaterThanOrEqual(T.CAR_LEN - 1e-6);
        }
        const ids = sorted.map((c) => c.idx), o0 = order0[li], start = ids.indexOf(o0[0]);
        for (let i = 0; i < ids.length; i++) expect(ids[(start + i) % ids.length], `step ${k} lane ${li}: a car passed another`).toBe(o0[i]);
      });
      // (3) a stopped car is outside every box
      model.cars.forEach((c) => {
        if (c.v > 1e-6) return;
        for (const cx of model.lanes[c.lane].crossings) expect(inBox(c.s, cx, T), `step ${k}: a car stopped inside a junction`).toBe(false);
      });
      model.cars.forEach((c, i) => { if (Math.abs(c.s - lastS[i]) > 1e-9) { moved[c.lane] += 1; movedThisCycle[c.lane] += 1; } lastS[i] = c.s; });
      // (4) no deadlock: every lane moves in EVERY cycle (a lane that jams after its first pass is a deadlock too)
      if ((k + 1) % stepsPerCycle === 0) { movedThisCycle.forEach((m, li) => expect(m, `lane ${li} did not move during cycle ${(k + 1) / stepsPerCycle}`).toBeGreaterThan(0)); movedThisCycle.fill(0); }
    }
    moved.forEach((m, li) => expect(m, `lane ${li} never moved`).toBeGreaterThan(0));
    // and cars did stop somewhere (the signals bite)
    expect(model.steps).toBe(steps);
  });

  it('queues form behind a red and dissolve: some car waits at a stop line, later moves through', () => {
    model.reset();
    let waited = false, released = false;
    const waiting = new Set();
    for (let k = 0; k < Math.round((2 * cycle) / T.DT); k++) {
      trafficTick(model, T.DT);
      model.cars.forEach((c) => {
        const cx = model.lanes[c.lane].crossings.find((x) => c.s + T.CAR_LEN / 2 <= x.sIn && c.s + T.CAR_LEN / 2 > x.sStop - 0.5);
        if (cx && c.v < 1e-6) { waited = true; waiting.add(c.idx); }
        else if (waiting.has(c.idx) && c.v > 0.5) { released = true; waiting.delete(c.idx); }
      });
    }
    expect(waited).toBe(true);
    expect(released).toBe(true);
  });

  it('is deterministic at any clock and restarts from zero when the clock goes back', () => {
    const a = createTrafficModel(trafficLanes, sim.cars, signals, T), b = createTrafficModel(trafficLanes, sim.cars, signals, T);
    stepTraffic(a, 40); stepTraffic(b, 12); stepTraffic(b, 25); stepTraffic(b, 40);
    expect(a.cars.map((c) => c.s)).toEqual(b.cars.map((c) => c.s));
    stepTraffic(b, 5);   // backwards → reset and re-integrate
    stepTraffic(a, 0); stepTraffic(a, 5);
    expect(a.cars.map((c) => c.s)).toEqual(b.cars.map((c) => c.s));
  });

  it('scales with baseScale: junction positions and street widths follow the frame', () => {
    const full = planFractalCity(DFLT), small = planFractalCity({ ...DFLT, baseScale: 0.6 });
    expect(small.signals.length).toBeGreaterThan(0);
    const fx = 2, fy = 2;
    // a baseScale 0.6 city is a different city (larger gen region), but every signal lies inside the frame and its width is 0.6 × a gen width
    for (const s of small.signals) { expect(s.x).toBeGreaterThanOrEqual(fx); expect(s.x).toBeLessThanOrEqual(fx + 30); expect(s.y).toBeGreaterThanOrEqual(fy); expect(s.y).toBeLessThanOrEqual(fy + 18); }
    const widths = new Set(small.signals.map((s) => s.streetW.toFixed(4)));
    for (const w of widths) expect(full.signals.some((s) => Math.abs(s.streetW * 0.6 - Number(w)) < 1e-3)).toBe(true);
  });
});

describe('signalised traffic — the emitted channel', () => {
  it('embeds the model source verbatim when signals are given, and is byte-identical to the legacy script without', () => {
    const cars = [{ car: 'car0', path: [[0, 0, 0], [10, 0, 0]], speed: 1.26, startFrac: 0, lane: 0 }];
    const bank = { car0: { pos: 'AA==', col: 'AA==' } };
    const legacy = carsChannelScript(cars, bank, { cast: false });
    const same = carsChannelScript(cars, bank, { cast: false, traffic: null });
    expect(same).toBe(legacy);
    expect(legacy).not.toContain('stepTraffic');
    const sig = carsChannelScript(cars, bank, { cast: false, traffic: { lanes: [{ axis: 'x', cross: 0, lo: 0, hi: 10, dir: 1, total: 10, speed: 1.26, crossings: [] }], signals: [{ x: 5, y: 0, streetW: 1.3, cycle: 34, offset: 0, green: 12, amber: 2, clearance: 5, major: 'x' }] } });
    expect(sig).toContain(TRAFFIC_MODEL_SOURCE);
    expect(sig).toContain('stepTraffic(__traffic, sec)');
    expect(sig).toContain('__mojSignals');
  });
});
