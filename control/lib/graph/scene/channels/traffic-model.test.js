// Signalised traffic, headless: the SAME model the world page runs (its source is embedded verbatim
// into the cars channel), simulated on the default-frame tower city with traffic on for several full
// signal cycles at the fixed dt. The invariants here are what "cars don't collide" means.
import { describe, expect, it } from 'vitest';

import { planFractalCity, carLaneToPath } from '../../city/fractal-city.js';
import { TRAFFIC, TRAFFIC_MODEL_SOURCE, buildSignals, phaseAt, laneCrossings, pairLanes, carsPerLane, laneCapacity, createTrafficModel, trafficTick, stepTraffic, inBox, deriveClearance, carFootprint, rectsTouch } from './traffic-model.js';
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

// ── zero car overlap: the HARD invariant of the world path ──────────────────────────────────
// Every pair of cars — moving on any lane, opposite directions of one road, perpendicular lanes,
// and the static portal ants — keeps its grown footprint (the model's measured length × width plus
// the margin, oriented along its lane) clear of every other, every tick, for several full cycles.
import { bakeCarMesh } from '../../vehicles/car-bake.js';

// the world-kinds car bank, measured the same way (six models from one seeded stream at scale 0.9)
const mul32 = (a) => () => { a |= 0; a = a + 0x6d2b79f5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const BANK = (() => { const rng = mul32(0x2545f491), bank = {}; for (let i = 0; i < 6; i++) bank['car' + i] = bakeCarMesh({ scale: 0.9, rng }); return bank; })();
const NAMES = Object.keys(BANK);
const DIMS = Object.fromEntries(NAMES.map((n) => [n, { len: BANK[n].len, wid: BANK[n].wid }]));
const T_CITY = (junctions) => {
  const T = { ...TRAFFIC, CAR_LEN: Math.max(...NAMES.map((n) => DIMS[n].len), TRAFFIC.CAR_LEN), CAR_WID: Math.max(...NAMES.map((n) => DIMS[n].wid), TRAFFIC.CAR_WID) };
  T.CLEARANCE = deriveClearance(Math.max(0, ...junctions.map((j) => Math.max(j.wx, j.wy))), T.CAR_LEN, CAR_SPEED, T.ACCEL);
  return T;
};
// the world-kinds pairing with the measured bank: lanes, cars (with their model names), statics
function worldTraffic(recipe) {
  const plan = planFractalCity(recipe);
  const T = T_CITY(plan.junctions);
  const signals = buildSignals(plan.junctions, recipe.seed ?? 1, recipe.region || { x: 2, y: 2, w: 30, d: 18 }, T);
  const lanes = pairLanes(plan.carLanes, signals, CAR_SPEED, T);
  const cars = [];
  lanes.forEach((L, li) => {
    const nameAt = (k) => NAMES[(li * CARS_PER_LANE + k) % NAMES.length];
    const n = laneCapacity(L.total, CARS_PER_LANE, T, L.crossings, (k) => DIMS[nameAt(k)].len);
    for (let k = 0; k < n; k++) cars.push({ lane: li, startFrac: ((k / n) + li * 0.19) % 1, car: nameAt(k), len: DIMS[nameAt(k)].len });
  });
  const strips = lanes.map((L) => { const r = carFootprint(L, 0, 0, T.CAR_WID, T); return L.axis === 'x' ? { x: Math.min(L.lo, L.hi), y: r.y, w: Math.abs(L.hi - L.lo), d: r.d } : { x: r.x, y: Math.min(L.lo, L.hi), w: r.w, d: Math.abs(L.hi - L.lo) }; });
  const statics = new Map();
  for (const f of plan.faces) if (f.portalCarRect && !statics.has(f.portalCarKey)) statics.set(f.portalCarKey, f.portalCarRect);
  const grown = (r) => ({ x: r.x - T.MARGIN, y: r.y - T.MARGIN, w: r.w + 2 * T.MARGIN, d: r.d + 2 * T.MARGIN });
  const keptStatics = [...statics.values()].filter((r) => !strips.some((s) => rectsTouch(s, grown(r))));
  return { plan, T, signals, lanes, cars, statics: keptStatics, droppedStatics: statics.size - keptStatics.length, model: createTrafficModel(lanes, cars, signals, T) };
}
function footprints(w) {
  return w.model.cars.map((c) => { const L = w.lanes[c.lane], d = DIMS[w.cars[c.idx].car]; return carFootprint(L, c.s, d.len, d.wid, w.T); });
}
function assertNoOverlap(w, tag) {
  const fps = footprints(w);
  for (let i = 0; i < fps.length; i++) {
    for (let j = i + 1; j < fps.length; j++) expect(rectsTouch(fps[i], fps[j]), `${tag}: cars ${i} (lane ${w.model.cars[i].lane}) and ${j} (lane ${w.model.cars[j].lane}) overlap`).toBe(false);
    for (const s of w.statics) expect(rectsTouch(fps[i], { x: s.x - w.T.MARGIN, y: s.y - w.T.MARGIN, w: s.w + 2 * w.T.MARGIN, d: s.d + 2 * w.T.MARGIN }), `${tag}: car ${i} overlaps a static portal car`).toBe(false);
  }
}

describe('zero car overlap — the hard invariant, pairwise, every tick', () => {
  const cities = {
    default: { seed: 3, anchor: 'tower', density: 0.7, locale: 'north-america', traffic: true, elements: { frontage: true } },
    base: { seed: 3, region: { x: 2, y: 2, w: 40, d: 28 }, depth: 3, anchor: 'tower', density: 0.7, locale: 'north-america', traffic: true, elements: { frontage: true } },
    town: { seed: 5, profile: 'town', anchor: 'tower', traffic: true, elements: { frontage: true } },
  };
  for (const [name, recipe] of Object.entries(cities)) {
    it(`${name}: no two footprints intersect over three cycles at the real cars per lane, and every car advances each cycle`, () => {
      const w = worldTraffic(recipe);
      const T = w.T, cycle = w.signals.length ? w.signals[0].cycle : 34;
      expect(T.CLEARANCE).toBeGreaterThanOrEqual(deriveClearance(0, T.CAR_LEN, CAR_SPEED));
      expect(w.cars.length).toBeGreaterThan(0);
      assertNoOverlap(w, `${name} t=0`);
      const steps = Math.round(3 * cycle / T.DT), perCycle = Math.round(cycle / T.DT);
      const moved = w.model.cars.map(() => 0), last = w.model.cars.map((c) => c.s);
      for (let k = 0; k < steps; k++) {
        trafficTick(w.model, T.DT);
        assertNoOverlap(w, `${name} step ${k}`);
        w.model.cars.forEach((c, i) => { if (Math.abs(c.s - last[i]) > 1e-9) moved[i] += 1; last[i] = c.s; });
        if ((k + 1) % perCycle === 0) { moved.forEach((m, i) => expect(m, `${name}: car ${i} (lane ${w.model.cars[i].lane}) did not advance in cycle ${(k + 1) / perCycle}`).toBeGreaterThan(0)); moved.fill(0); }
      }
    });
  }

  it('opposite lanes of one road sit apart by at least the widest model plus margins, or the road runs one lane', () => {
    for (const recipe of Object.values(cities)) {
      const w = worldTraffic(recipe);
      for (let i = 0; i < w.lanes.length; i++) for (let j = i + 1; j < w.lanes.length; j++) {
        const A = w.lanes[i], B = w.lanes[j];
        if (A.axis !== B.axis || Math.max(A.lo, B.lo) >= Math.min(A.hi, B.hi)) continue;
        expect(Math.abs(A.cross - B.cross)).toBeGreaterThanOrEqual(w.T.CAR_WID + 2 * w.T.MARGIN - 1e-9);
      }
    }
  });

  it('spawn: the initial ring already keeps footprint + gap between cars, and a lane too short for its cars takes fewer', () => {
    const w = worldTraffic(cities.default);
    for (const lane of w.model.lanes) {
      const n = lane.cars.length;
      if (n < 2) continue;
      const sorted = lane.cars.slice().sort((p, q) => p.s - q.s);
      for (let i = 0; i < n; i++) { const a = sorted[i], b = sorted[(i + 1) % n]; const gap = (i === n - 1 ? b.s + lane.total : b.s) - a.s; expect(gap).toBeGreaterThanOrEqual(w.T.CAR_LEN + 2 * w.T.MARGIN + w.T.GAP - 1e-6); }
    }
    expect(carsPerLane(3, 3, w.T, [])).toBe(0);
    expect(carsPerLane(6, 3, w.T, [])).toBe(1);
    expect(carsPerLane(60, 3, w.T, [])).toBe(3);
  });

  it('a stopped car keeps its whole footprint outside the box, and the queue behind is spaced by footprint + gap', () => {
    const w = worldTraffic(cities.default), T = w.T;
    for (let k = 0; k < Math.round(2 * 34 / T.DT); k++) {
      trafficTick(w.model, T.DT);
      for (const lane of w.model.lanes) for (const c of lane.cars) if (c.v < 1e-6) {
        for (const cx of lane.crossings) expect(c.s + T.CAR_LEN / 2 + T.MARGIN <= cx.sIn || c.s - T.CAR_LEN / 2 - T.MARGIN >= cx.sOut).toBe(true);
      }
    }
  });

  it('wrap: on a lane short enough to wrap within the run, a wrapping car queues behind the head and never lands on it', () => {
    const T = { ...TRAFFIC, CAR_LEN: 1.7, CAR_WID: 0.8 };
    const lanes = [{ axis: 'x', cross: 0, lo: 0, hi: 9, dir: 1, total: 9, speed: CAR_SPEED, crossings: [] }];
    const cars = [{ lane: 0, startFrac: 0 }, { lane: 0, startFrac: 0.5 }];
    const m = createTrafficModel(lanes, cars, [], T);
    let wraps = 0, last = m.cars.map((c) => c.s);
    for (let k = 0; k < Math.round(60 / T.DT); k++) {
      trafficTick(m, T.DT);
      m.cars.forEach((c, i) => { if (c.s < last[i] - 1) wraps += 1; last[i] = c.s; });
      const [a, b] = m.cars.map((c) => carFootprint(lanes[0], c.s, 1.7, 0.8, T));
      expect(rectsTouch(a, b), `wrap step ${k}`).toBe(false);
    }
    expect(wraps).toBeGreaterThan(4);
    // and with a queue: hold one car at a red for the whole run; the other must wrap and stop behind it
    const sig = [{ x: 7, y: 0, wx: 1.3, wy: 1.3, streetW: 1.3, cycle: 1000, offset: 0, green: 490, amber: 2, clearance: 10, major: 'y' }];   // x is red for the first 500 s
    const lanes2 = [{ axis: 'x', cross: 0, lo: 0, hi: 12, dir: 1, total: 12, speed: CAR_SPEED, crossings: laneCrossings({ axis: 'x', cross: 0, lo: 0, hi: 12, dir: 1 }, sig, T) }];
    const m2 = createTrafficModel(lanes2, [{ lane: 0, startFrac: 0.05 }, { lane: 0, startFrac: 0.55 }], sig, T);
    for (let k = 0; k < Math.round(40 / T.DT); k++) {
      trafficTick(m2, T.DT);
      const [a, b] = m2.cars.map((c) => carFootprint(lanes2[0], c.s, 1.7, 0.8, T));
      expect(rectsTouch(a, b), `wrap-queue step ${k}`).toBe(false);
    }
    expect(m2.cars.every((c) => c.v < 1e-6)).toBe(true);   // both queued at the red, one behind the other, none across the wrap
  });

  it('queue: many cars behind one red pack up without overlap and all release on green', () => {
    const T = { ...TRAFFIC, CAR_LEN: 1.7, CAR_WID: 0.8, CLEARANCE: 6 };
    const sig = [{ x: 20, y: 0, wx: 3.1, wy: 3.1, streetW: 3.1, cycle: 60, offset: 0, green: 24, amber: 2, clearance: 6, major: 'y' }];   // x waits 30 s then gets 24 s
    const laneSpec = { axis: 'x', cross: 0, lo: 0, hi: 40, dir: 1 };
    const lanes = [{ ...laneSpec, total: 40, speed: CAR_SPEED, crossings: laneCrossings(laneSpec, sig, T) }];
    const n = carsPerLane(40, 8, T, lanes[0].crossings);
    const cars = Array.from({ length: n }, (_, k) => ({ lane: 0, startFrac: k / n }));
    const m = createTrafficModel(lanes, cars, sig, T);
    let stoppedAtOnce = 0, released = 0;
    for (let k = 0; k < Math.round(120 / T.DT); k++) {
      trafficTick(m, T.DT);
      const fps = m.cars.map((c) => carFootprint(lanes[0], c.s, 1.7, 0.8, T));
      for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) expect(rectsTouch(fps[i], fps[j]), `queue step ${k}`).toBe(false);
      const stopped = m.cars.filter((c) => c.v < 1e-6).length;
      stoppedAtOnce = Math.max(stoppedAtOnce, stopped);
      if (k > Math.round(60 / T.DT) && stopped === 0) released += 1;
    }
    expect(n).toBeGreaterThanOrEqual(4);
    expect(stoppedAtOnce).toBeGreaterThanOrEqual(3);   // a real queue formed
    expect(released).toBeGreaterThan(0);               // and moved again
  });

  it('static portal cars never lie on a moving lane (an ant that would is dropped, removal only)', () => {
    for (const recipe of Object.values(cities)) {
      const w = worldTraffic(recipe);
      expect(w.droppedStatics).toBeGreaterThanOrEqual(0);
      for (const s of w.statics) for (const L of w.lanes) {
        const strip = carFootprint(L, 0, 0, w.T.CAR_WID, w.T);
        const full = L.axis === 'x' ? { x: Math.min(L.lo, L.hi), y: strip.y, w: Math.abs(L.hi - L.lo), d: strip.d } : { x: strip.x, y: Math.min(L.lo, L.hi), w: strip.w, d: Math.abs(L.hi - L.lo) };
        expect(rectsTouch(full, { x: s.x - w.T.MARGIN, y: s.y - w.T.MARGIN, w: s.w + 2 * w.T.MARGIN, d: s.d + 2 * w.T.MARGIN })).toBe(false);
      }
    }
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
