// SIGNALISED TRAFFIC — the pure model the cars channel runs in the browser AND the tests run headless.
//
// The city's moving cars used to ride their lanes at constant speed with no notion of a junction, so
// perpendicular lanes drove through each other. This module gives every crossing a signal PROGRAM
// (two exclusive phases, x-green then y-green, each followed by an all-red clearance) and every car
// a stepped state (arc position + speed) integrated at a FIXED dt from the world clock's zero, so the
// pose at any clock t is deterministic whatever the frame rate, and pause / resume (which rebases the
// clock) and capture frames (which set it) all replay the same traffic.
//
// Collision-freedom holds BY CONSTRUCTION of the phases, not by a runtime check:
//   • a car crosses its stop line only while its axis is green (or amber when it can no longer stop),
//     and only when the car ahead has left room for it to clear the box — so no car is ever held
//     inside a junction by a queue;
//   • a car that entered finishes crossing; the CLEARANCE all-red is longer than the time a car needs
//     to enter at amber's last instant (from rest or at speed) and clear the far edge, so by the time
//     the other axis turns green the box is empty;
//   • same-lane following keeps a named GAP, queues form behind a red and dissolve on green, and a car
//     wraps to the lane start only when the start is clear.
// The functions below are self-contained (no closures over module scope beyond what they take), so
// the cars channel embeds their SOURCE into the world page: the browser and vitest run one code.

const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// the program's numbers, in seconds and city units. CLEARANCE covers the worst-case crossing: a car
// entering at amber's end from a crawl at ACCEL 2 across a 3.1-wide major box plus its own length
// (~4.1 s); at lane speed 1.26 it is ~3.7 s.
export const TRAFFIC = {
  GREEN: 12, AMBER: 2, CLEARANCE: 5,
  STOP_MARGIN: 1.4,    // the stop line sits this far before the junction box edge: past the crosswalk band (0.15 + 1.1 from the box, intersectionDoodads) so a queue halts before the zebra, not on it
  CAR_LEN: 1.55,       // the baked car's length at scale 0.9 (vehicleFaces 1.7 × 0.9)
  GAP: 0.5,            // front-to-rear gap a following car keeps
  ACCEL: 2.0,          // units / s² for both pulling away and braking
  DT: 1 / 30,          // the fixed integration step
  MAX_STEPS: 4000,     // a capture frame at t = 2 min integrates ≤ this many steps at once
};

// One signal per crossing. `major` is the axis whose green comes first in the cycle (the region's long
// axis); the offset is the SEEDED offset: mulberry32 on the recipe seed and the junction index, so the
// same city always phases the same way and neighbouring crossings are not in lock-step.
// A junction is { x, y, wx, wy }: the box is wx wide (the x-extent, the width of the road running
// along y) and wy deep (the width of the road running along x); `streetW` (the wider of the two) is
// carried for readers that want one number.
export function buildSignals(junctions, seed, region, T = TRAFFIC) {
  const cycle = 2 * (T.GREEN + T.CLEARANCE);
  const major = region && region.d > region.w ? 'y' : 'x';
  return (junctions || []).map((j, i) => {
    const rng = mulberry32(((seed >>> 0) ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
    const wx = j.wx ?? j.streetW, wy = j.wy ?? j.streetW;
    return { x: j.x, y: j.y, wx, wy, streetW: Math.max(wx, wy), cycle, offset: Math.floor(rng() * cycle), green: T.GREEN, amber: T.AMBER, clearance: T.CLEARANCE, major };
  });
}

// the phase of one signal at clock t (seconds): which axis is green, whether it is in its amber tail,
// and how long that green has left; axis null during a clearance interval.
export function phaseAt(sig, t) {
  const cycle = sig.cycle, local = (((t - sig.offset) % cycle) + cycle) % cycle;
  const first = sig.major || 'x', second = first === 'x' ? 'y' : 'x';
  if (local < sig.green) return { axis: first, amber: local >= sig.green - sig.amber, remaining: sig.green - local };
  if (local < sig.green + sig.clearance) return { axis: null, amber: false, remaining: sig.green + sig.clearance - local };
  if (local < 2 * sig.green + sig.clearance) { const l2 = local - sig.green - sig.clearance; return { axis: second, amber: l2 >= sig.green - sig.amber, remaining: sig.green - l2 }; }
  return { axis: null, amber: false, remaining: cycle - local };
}

// the junctions a straight lane crosses, in travel order, as arc positions along the lane: the box
// entry edge, the exit edge and the stop line (entry minus STOP_MARGIN). A lane is { axis, cross, lo,
// hi, dir }: it runs along `axis` at the fixed `cross` coordinate from lo to hi, travelling +axis when
// dir ≥ 0. Only crossings whose box straddles the lane's line and lies within the lane count.
export function laneCrossings(lane, signals, T = TRAFFIC) {
  const a = lane.dir >= 0 ? lane.lo : lane.hi, sOf = (p) => Math.abs(p - a);
  const out = [];
  (signals || []).forEach((sig, si) => {
    const along = lane.axis === 'x' ? sig.x : sig.y, across = lane.axis === 'x' ? sig.y : sig.x;
    const halfAlong = (lane.axis === 'x' ? sig.wx ?? sig.streetW : sig.wy ?? sig.streetW) / 2;   // the box's extent along the lane
    const halfAcross = (lane.axis === 'x' ? sig.wy ?? sig.streetW : sig.wx ?? sig.streetW) / 2;  // …and across it
    if (Math.abs(across - lane.cross) > halfAcross + 0.05) return;                                   // the lane does not run through the box
    if (along + halfAlong <= lane.lo || along - halfAlong >= lane.hi) return;                       // the box is off the lane's span
    const e0 = sOf(along - halfAlong), e1 = sOf(along + halfAlong);
    const sIn = Math.min(e0, e1), sOut = Math.max(e0, e1);
    out.push({ sig: si, sIn, sOut, sStop: sIn - T.STOP_MARGIN });
  });
  return out.sort((p, q) => p.sIn - q.sIn);
}

// A lane that STARTS inside a box (a side street leaving an avenue) begins past the box; a lane that
// ENDS inside one (a side street dead-ending into an avenue) stops at that box's stop line — so no
// car spawns or wraps in the middle of a crossing. Returns the lane with its span trimmed, its arc
// `total`, and the crossings that remain strictly inside it.
export function trimLaneAtBoxes(lane, signals, T = TRAFFIC) {
  let lo = lane.lo, hi = lane.hi;
  const dir = lane.dir, total = () => Math.abs(hi - lo);
  let cx = laneCrossings({ ...lane, lo, hi }, signals, T);
  for (let guard = 0; guard < 8 && cx.length && cx[0].sIn < T.CAR_LEN; guard++) {
    const cut = cx[0].sOut + T.GAP;
    if (dir >= 0) lo += cut; else hi -= cut;
    cx = laneCrossings({ ...lane, lo, hi }, signals, T);
  }
  for (let guard = 0; guard < 8 && cx.length && cx[cx.length - 1].sOut > total() - T.CAR_LEN; guard++) {
    const end = Math.max(0, cx[cx.length - 1].sStop - T.CAR_LEN / 2);
    if (dir >= 0) hi = lo + end; else lo = hi - end;
    cx = laneCrossings({ ...lane, lo, hi }, signals, T);
  }
  return { ...lane, lo, hi, total: total(), crossings: cx };
}

// the world-kinds pairing: every lane trimmed at its end boxes and given its crossings + speed;
// lanes too short to hold a car with room to move are dropped
export function pairLanes(lanes, signals, speed, T = TRAFFIC) {
  return (lanes || []).map((L) => ({ ...trimLaneAtBoxes(L, signals, T), speed })).filter((L) => L.total >= 2 * T.CAR_LEN + T.GAP);
}

// how many cars a lane can carry: its length minus every junction box it crosses plus the room a car
// must find beyond each box to be allowed in (the box-clear rule: 1.5 lengths + a gap), divided by a
// car length + gap + breathing room — so a queue can always drain through its boxes and a short
// side-street run takes one car (an avenue the caller's maximum). Without this a three-car lane with
// one box can lock: the box-clear rule holds the first car, the gap holds the second, the wrap hold
// the third.
export function carsPerLane(total, max, T = TRAFFIC, crossings = []) {
  const reserved = (crossings || []).reduce((s, c) => s + (c.sOut - c.sIn) + 1.5 * T.CAR_LEN + T.GAP, 0);
  return Math.max(1, Math.min(max, Math.floor((total - reserved) / (T.CAR_LEN + T.GAP + 0.6))));
}

// the stepped state: one entry per car { lane, s (arc position of the car's CENTRE), v }, integrated
// from clock zero. `lanes[i]` = { total, crossings, speed } ; `cars[i]` = { lane, startFrac, speed }.
export function createTrafficModel(lanes, cars, signals, T) {
  const model = {
    T, signals,
    lanes: lanes.map((L) => ({ axis: L.axis, total: L.total, crossings: L.crossings || [], speed: L.speed > 0 ? L.speed : 1.26, cars: [] })),
    cars: cars.map((c, i) => ({ lane: c.lane, s: ((c.startFrac || 0) % 1) * lanes[c.lane].total, v: lanes[c.lane].speed > 0 ? lanes[c.lane].speed : 1.26, idx: i })),
    t: 0, steps: 0,
  };
  model.cars.forEach((c) => model.lanes[c.lane].cars.push(c));
  // the initial spread is box-aware: a car that would start inside a junction box is set back to that
  // box's stop line, and any same-lane overlap that makes is resolved by pushing the trailing car back
  // (so clock zero already satisfies the invariants the steps keep)
  const L2 = T.CAR_LEN / 2;
  for (const lane of model.lanes) {
    for (const c of lane.cars) { const cx = lane.crossings.find((x) => c.s + L2 > x.sIn && c.s - L2 < x.sOut); if (cx) c.s = Math.max(0, cx.sStop - L2); }
    const order = lane.cars.slice().sort((p, q) => q.s - p.s);   // leaders first
    for (let i = 1; i < order.length; i++) { const lead = order[i - 1], c = order[i]; if (lead.s - c.s < T.CAR_LEN + T.GAP) c.s = Math.max(0, lead.s - T.CAR_LEN - T.GAP); }
  }
  const init = model.cars.map((c) => ({ s: c.s, v: c.v }));
  model.reset = () => { model.cars.forEach((c, i) => { c.s = init[i].s; c.v = init[i].v; }); model.t = 0; model.steps = 0; };
  return model;
}

// one fixed step of dt at model clock `model.t`. Cars are advanced from the positions they held at the
// START of the step (leaders read before anyone moves), so the order of evaluation never matters.
export function trafficTick(model, dt) {
  const T = model.T, t = model.t, L2 = T.CAR_LEN / 2;
  const phaseCache = new Map();
  const phaseOf = (si) => { let p = phaseCache.get(si); if (!p) { p = phaseAt(model.signals[si], t); phaseCache.set(si, p); } return p; };
  for (let li = 0; li < model.lanes.length; li++) {
    const lane = model.lanes[li], total = lane.total, cars = lane.cars;
    if (!cars.length) continue;
    const order = cars.slice().sort((p, q) => p.s - q.s);   // travel order along the lane
    const next = order.map((car, k) => {
      const leader = cars.length > 1 ? order[(k + 1) % cars.length] : null;
      const leaderS = leader ? (k === cars.length - 1 ? leader.s + total : leader.s) : car.s + total * 2;   // the last car's leader is the first, one lap on
      const gapAhead = leaderS - car.s - T.CAR_LEN;                 // front-to-rear room to the car ahead
      let v = Math.min(lane.speed, car.v + T.ACCEL * dt);           // pull away / cruise
      let limit = Infinity;                                          // how far the car may advance this step
      // the junction ahead: the first crossing this car has not fully left
      const cx = lane.crossings.find((c) => car.s - L2 < c.sOut);
      if (cx && car.s + L2 <= cx.sIn) {                              // approaching (front not yet past the entry edge)
        const stopAt = cx.sStop - L2, dist = stopAt - car.s;
        const ph = phaseOf(cx.sig);
        const canStop = dist >= (car.v * car.v) / (2 * T.ACCEL) - 1e-9;
        const boxClear = leaderS >= cx.sOut + 1.5 * T.CAR_LEN + T.GAP;   // the car ahead has left room to clear the box
        const go = ph.axis === lane.axis && boxClear && (!ph.amber || !canStop);
        if (!go) {
          limit = Math.max(0, dist);
          v = Math.min(v, Math.sqrt(2 * T.ACCEL * Math.max(0, dist)));   // brake to rest at the line
          if (dist <= 1e-3) v = 0;
        }
      }
      limit = Math.min(limit, Math.max(0, gapAhead - T.GAP));       // never closer than GAP to the car ahead
      let ds = Math.min(v * dt, limit);
      if (ds < v * dt) v = ds / dt;                                  // held: the speed is what it could move
      let s = car.s + ds;
      if (s >= total) {                                              // wrap only when the lane start is clear
        const first = order[0];
        const startClear = cars.length === 1 || first === car || first.s - L2 >= T.GAP + L2;
        if (startClear) s -= total; else { s = total - 1e-6; v = 0; }
      }
      return { car, s, v };
    });
    for (const n of next) { n.car.s = n.s; n.car.v = n.v; }
  }
  model.t += dt; model.steps += 1;
}

// integrate the model to clock t (seconds) in fixed steps; a clock that went backwards restarts from
// zero (a capture frame, never a running world). Steps per call are bounded.
export function stepTraffic(model, t) {
  const T = model.T;
  if (t < model.t - 1e-9) model.reset();
  let n = 0;
  while (model.t + T.DT <= t + 1e-9 && n < T.MAX_STEPS) { trafficTick(model, T.DT); n += 1; }
  return model;
}

// is a car (centre s) inside crossing `cx`'s box? (any part of the car between the edges)
export function inBox(s, cx, T = TRAFFIC) { return s + T.CAR_LEN / 2 > cx.sIn && s - T.CAR_LEN / 2 < cx.sOut; }

// the source the cars channel embeds: the same functions, verbatim
export const TRAFFIC_MODEL_SOURCE = [phaseAt, createTrafficModel, trafficTick, stepTraffic].map((f) => f.toString()).join('\n');
