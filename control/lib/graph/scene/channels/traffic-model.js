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
  GREEN: 12, AMBER: 2, CLEARANCE: 5,   // CLEARANCE here is the fallback; a city derives its own (deriveClearance) from its widest box and longest model
  STOP_MARGIN: 1.4,    // the stop line sits this far before the junction box edge: past the crosswalk band (0.15 + 1.1 from the box, intersectionDoodads) so a queue halts before the zebra, not on it
  CAR_LEN: 1.55,       // the collision footprint's length: the LONGEST model in the bank (world-kinds measures it; this is the sedan fallback)
  CAR_WID: 0.72,       // …and its width (the widest model; fallback 0.8 × 0.9)
  MARGIN: 0.15,        // the safety margin added around every footprint: no two footprints (each grown by it) may touch
  GAP: 0.5,            // front-to-rear clear road a following car keeps beyond the margins
  ACCEL: 2.0,          // units / s² for both pulling away and braking
  DT: 1 / 30,          // the fixed integration step
  MAX_STEPS: 4000,     // a capture frame at t = 2 min integrates ≤ this many steps at once
};

// The all-red clearance a city needs: the LONGEST model, entering at amber's last instant from rest
// (the slowest legal entry — a car that could not stop was at least crawling, and pulls away at
// ACCEL), must have its whole footprint past the far edge of the WIDEST box before the cross axis
// turns green. Derived, not guessed; rounded up to the half second with 0.3 s of slack.
export function deriveClearance(maxBoxAlong, maxLen, speed, accel = TRAFFIC.ACCEL) {
  const D = maxBoxAlong + maxLen + 2 * TRAFFIC.MARGIN;
  const tAccel = speed / accel, dAccel = 0.5 * accel * tAccel * tAccel;
  const t = D <= dAccel ? Math.sqrt(2 * D / accel) : tAccel + (D - dAccel) / speed;
  return Math.ceil((t + 0.3) * 2) / 2;
}

// a car's axis-aligned collision footprint (its model's length × width, grown by the margin),
// oriented along its lane's axis, at arc position s — the pairwise invariant the tests check
export function carFootprint(lane, s, len, wid, T = TRAFFIC) {
  const a = lane.dir >= 0 ? lane.lo : lane.hi, along = a + lane.dir * s;   // world coordinate along the lane
  const hl = len / 2 + T.MARGIN, hw = wid / 2 + T.MARGIN;
  return lane.axis === 'x' ? { x: along - hl, y: lane.cross - hw, w: 2 * hl, d: 2 * hw } : { x: lane.cross - hw, y: along - hl, w: 2 * hw, d: 2 * hl };
}
export const rectsTouch = (a, b) => !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.d <= b.y || b.y + b.d <= a.y);

// One signal per crossing. `major` is the axis whose green comes first in the cycle (the region's long
// axis); the offset is the SEEDED offset: mulberry32 on the recipe seed and the junction index, so the
// same city always phases the same way and neighbouring crossings are not in lock-step.
// A junction is { x, y, wx, wy }: the box is wx wide (the x-extent, the width of the road running
// along y) and wy deep (the width of the road running along x); `streetW` (the wider of the two) is
// carried for readers that want one number.
export function buildSignals(junctions, seed, region, T = TRAFFIC) {
  const cycle = 2 * (T.GREEN + T.CLEARANCE);
  const major = region && region.d > region.w ? 'y' : 'x';
  const js = junctions || [];
  // ADJACENT crossings — two boxes on one road closer than a car can stand between them (a T beside
  // a crossing) — share ONE offset, so the lane's compound crossing (laneCrossings) has a green at
  // all: union by adjacency, the cluster's first member's seeded offset for every member.
  const near = T.CAR_LEN + 2 * T.MARGIN + T.GAP;
  const root = js.map((_, i) => i), find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
  for (let i = 0; i < js.length; i++) for (let k = i + 1; k < js.length; k++) {
    const a = js[i], b = js[k];
    const awx = a.wx ?? a.streetW, awy = a.wy ?? a.streetW, bwx = b.wx ?? b.streetW, bwy = b.wy ?? b.streetW;
    const sameRow = Math.abs(a.y - b.y) < Math.min(awy, bwy) / 2, sameCol = Math.abs(a.x - b.x) < Math.min(awx, bwx) / 2;
    const gapX = Math.abs(a.x - b.x) - (awx + bwx) / 2, gapY = Math.abs(a.y - b.y) - (awy + bwy) / 2;
    if ((sameRow && gapX < near) || (sameCol && gapY < near)) root[find(i)] = find(k);
  }
  const offsets = js.map((_, i) => { const rng = mulberry32(((seed >>> 0) ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0); return Math.floor(rng() * cycle); });
  return js.map((j, i) => {
    const wx = j.wx ?? j.streetW, wy = j.wy ?? j.streetW;
    return { x: j.x, y: j.y, wx, wy, streetW: Math.max(wx, wy), cycle, offset: offsets[find(i)], green: T.GREEN, amber: T.AMBER, clearance: T.CLEARANCE, major };
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
    // a lane "runs through" a box when its cars' grown footprints would touch it: the lane's swept
    // strip (half a car width + the margin either side of its line) against the box's across-extent,
    // and the box against the lane's span grown by half a car length + the margin — so a box a lane
    // merely ENDS beside is listed too, and trimLaneAtBoxes keeps the lane's end clear of it
    const reachAcross = T.CAR_WID / 2 + T.MARGIN, reachAlong = T.CAR_LEN / 2 + T.MARGIN;
    if (Math.abs(across - lane.cross) >= halfAcross + reachAcross) return;                          // the lane's cars never touch the box
    if (along + halfAlong <= lane.lo - reachAlong || along - halfAlong >= lane.hi + reachAlong) return;   // the box is clear of the lane's span and its end footprints
    const e0 = sOf(along - halfAlong), e1 = sOf(along + halfAlong);
    const sIn = Math.min(e0, e1), sOut = Math.max(e0, e1);
    out.push({ sig: si, sigs: [si], sIn, sOut, sStop: sIn - T.STOP_MARGIN });
  });
  out.sort((p, q) => p.sIn - q.sIn);
  // ADJACENT boxes (a T beside a crossing, closer than a car can stand between) merge into one
  // compound crossing: one stop line before the first, entry only when EVERY member is green, room
  // required beyond the last — so no car ever stops straddling a box or is carried from one box into
  // the next on a red. buildSignals gives such neighbours one offset, so the phases agree.
  const merged = [];
  for (const c of out) {
    const prev = merged[merged.length - 1];
    if (prev && c.sIn - prev.sOut < T.CAR_LEN + 2 * T.MARGIN + T.GAP) { prev.sOut = Math.max(prev.sOut, c.sOut); prev.sigs.push(c.sig); }
    else merged.push({ ...c, sigs: c.sigs.slice() });
  }
  return merged;
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
  const trimmed = (lanes || []).map((L) => ({ ...trimLaneAtBoxes(L, signals, T), speed })).filter((L) => L.total >= T.CAR_LEN + 2 * T.MARGIN + T.GAP + 0.6);
  // OPPOSITE LANES: two directions on one road must sit far enough apart for the widest model's grown
  // footprints never to touch; a road too narrow for that keeps ONE lane (the +side one, dropped by
  // pairing on the same span). Lanes on one road share axis and span and sit within a road's width.
  const need = T.CAR_WID + 2 * T.MARGIN;
  const out = [];
  for (const L of trimmed) {
    const twin = out.find((M) => M.axis === L.axis && Math.abs(M.cross - L.cross) < need && Math.max(M.lo, L.lo) < Math.min(M.hi, L.hi));
    if (twin) { twin.singled = true; continue; }
    out.push(L);
  }
  return out;
}

// how many cars a lane can carry: its length minus every junction box it crosses plus the room a car
// must find beyond each box to be allowed in (the box-clear rule: 1.5 lengths + a gap), divided by a
// car length + gap + breathing room — so a queue can always drain through its boxes and a short
// side-street run takes one car (an avenue the caller's maximum). Without this a three-car lane with
// one box can lock: the box-clear rule holds the first car, the gap holds the second, the wrap hold
// the third.
// the same count with each car's OWN length: cars are taken in order (lenFor(k) gives the k-th car's
// measured length) and each adds its pitch until the ring, minus its boxes' reservations, is used up
export function laneCapacity(total, max, T = TRAFFIC, crossings = [], lenFor = () => T.CAR_LEN) {
  const reserved = (crossings || []).reduce((s, c) => s + (c.sOut - c.sIn) + T.STOP_MARGIN + 1.5 * T.CAR_LEN + T.GAP + 2 * T.MARGIN, 0);
  let n = 0, used = 0;
  while (n < max) { const pitch = lenFor(n) + 2 * T.MARGIN + T.GAP + 0.6; if (used + pitch > total - reserved) break; used += pitch; n += 1; }
  return n;
}
export function carsPerLane(total, max, T = TRAFFIC, crossings = []) {
  const pitch = T.CAR_LEN + 2 * T.MARGIN + T.GAP + 0.6;              // one car's grown footprint + its gap + breathing room, on the ring
  const reserved = (crossings || []).reduce((s, c) => s + (c.sOut - c.sIn) + T.STOP_MARGIN + 1.5 * T.CAR_LEN + T.GAP + 2 * T.MARGIN, 0);
  if (total < pitch) return 0;                                       // too short for even one car to move without meeting itself
  return Math.max(1, Math.min(max, Math.floor((total - reserved) / pitch)));
}

// the stepped state: one entry per car { lane, s (arc position of the car's CENTRE), v }, integrated
// from clock zero. `lanes[i]` = { total, crossings, speed } ; `cars[i]` = { lane, startFrac, speed }.
export function createTrafficModel(lanes, cars, signals, T) {
  const model = {
    T, signals,
    lanes: lanes.map((L) => ({ axis: L.axis, total: L.total, crossings: L.crossings || [], speed: L.speed > 0 ? L.speed : 1.26, cars: [] })),
    // each car carries its OWN measured length (its model's, from the bank); T.CAR_LEN is the fallback
    // and the bound the box rules use
    cars: cars.map((c, i) => ({ lane: c.lane, s: ((c.startFrac || 0) % 1) * lanes[c.lane].total, v: lanes[c.lane].speed > 0 ? lanes[c.lane].speed : 1.26, len: c.len > 0 ? c.len : T.CAR_LEN, idx: i })),
    t: 0, steps: 0,
  };
  model.cars.forEach((c) => model.lanes[c.lane].cars.push(c));
  // The initial spread is a RING: the lane's cars follow one another around its length at their own
  // pitch (each car's grown footprint + the gap + breathing room, the same pitch laneCapacity
  // counted with), the spare length shared out evenly, phased by the first car's startFrac and then
  // rotated in quarter-unit steps until no car's footprint overlaps a junction box — so clock zero
  // already satisfies every invariant the steps keep (across the wrap too, since it is a ring).
  for (const lane of model.lanes) {
    const n = lane.cars.length; if (!n) continue;
    const pitches = lane.cars.map((c) => c.len + 2 * T.MARGIN + T.GAP + 0.6);
    const spare = Math.max(0, lane.total - pitches.reduce((a, b) => a + b, 0)) / n;
    const offsets = []; let acc = 0;
    for (let i = 0; i < n; i++) { offsets.push(acc); acc += pitches[i] + spare; }
    const base = lane.cars[0].s;
    const inAnyBox = (c, s) => { const h = c.len / 2 + T.MARGIN; return lane.crossings.some((x) => s + h > x.sIn - T.STOP_MARGIN && s - h < x.sOut); };   // the box plus its stop margin
    let shift = 0;
    for (let tries = 0; tries < 64; tries++) {
      const ok = lane.cars.every((c, i) => !inAnyBox(c, (((base + shift + offsets[i]) % lane.total) + lane.total) % lane.total));
      if (ok) break;
      shift += 0.25;
    }
    lane.cars.forEach((c, i) => { c.s = (((base + shift + offsets[i]) % lane.total) + lane.total) % lane.total; });
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
      const half = car.len / 2 + T.MARGIN;                            // this car's grown half-length
      const leaderRear = leaderS - (leader ? leader.len / 2 : 0) - T.MARGIN;
      const gapAhead = leaderRear - (car.s + half);                   // clear road between the two grown footprints (ring: the last car's leader is the first, a lap on)
      let v = Math.min(lane.speed, car.v + T.ACCEL * dt);           // pull away / cruise
      let limit = Infinity;                                          // how far the car may advance this step
      // the junction ahead: the first crossing this car has not fully left
      const cx = lane.crossings.find((c) => car.s - half < c.sOut);
      if (cx && car.s + half <= cx.sIn) {                            // approaching (front not yet past the entry edge)
        const stopAt = cx.sStop - half, dist = stopAt - car.s;       // the whole grown footprint stays behind the line
        // a compound crossing (adjacent boxes) needs EVERY member green for this axis; amber if any is
        const phs = (cx.sigs || [cx.sig]).map(phaseOf);
        const green = phs.every((p) => p.axis === lane.axis), amber = phs.some((p) => p.amber);
        const canStop = dist >= (car.v * car.v) / (2 * T.ACCEL) - 1e-9;
        const boxClear = leaderRear >= cx.sOut + car.len + T.GAP + 3 * T.MARGIN;   // the car ahead has left room for this car's whole grown footprint to clear the box and keep its gap
        const go = green && boxClear && (!amber || !canStop);
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
      // WRAP: the lane is a ring for the following rule (the last car's leader is the first car a lap
      // on), so a wrapping car has already queued behind the head of the lane — it simply re-enters
      if (s >= total) s -= total;
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
