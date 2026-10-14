/**
 * THE DRIVER'S EYE — scapeshift's eye spot, read at speed. A walker's beats are spaced in metres (a trail's 11 m at
 * 6 m/s); a driver's must be spaced in SECONDS. A thing reads when it spans the eye spot (playscape/objects/laws.js:
 * 12 px of a 640 × 448 frame at 60°) where it is, and the rings are times to reach it, not offsets from the way:
 *
 *   near   under 0.6 s ahead: passed before it can be looked at — rhythm and texture, not things
 *   mid    0.6 – 3 s: the look-ahead, where the eye lands (a corner's focus, a set piece)
 *   far    beyond 3 s: the skyline, a landmark seen across the lap
 *
 * The driver follows the racing line (contract.js) on a speed plan bound by the vehicle's own envelope (vehicles.js:
 * cornering grip, launch, braking, top speed), looks along the line from DRIVER.eye over the road, and gazes at the
 * line DRIVER.gazeAhead seconds on (into a corner, the way drivers do).
 *
 *   speedPlan(plan, cls)                  → [{ s, x, y, z, k, v, t }] along the racing line
 *   driverEye(plan, things, { cls, dt })  → the census: per sample and per second what reads in each ring and in the
 *                                           gaze, the corners and whether each was focused, the landmark, the rhythm
 *   trackThings(plan)                     → the plan's own dress as things ({ kind, at, span })
 *
 * Interest is scapeshift's (playscape/objects/laws.js INTEREST): filler stays quiet so what matters can be loud. A
 * wood of filler is context and rhythm, never something LOOKED AT: the gaze is held only by a thing ranked a prop or
 * more (a stand, a gantry, a bridge, a landmark), and a corner is focused only by one.
 *
 * Given the `ground`, a far thing is seen only if the sight line to its top clears the land (a landmark behind a hill
 * is not); nearer things are taken as seen (the road's own cutting is the land they stand on). Pure, deterministic.
 */
import { racingLine } from './contract.js';
import { envelope } from './vehicles.js';
import { FRAME, EYE_SPOT_PX, INTEREST, metresPerPixel } from '../playscape/objects/laws.js';

export const DRIVER = Object.freeze({
  eye: 1.1,          // m over the road (a car's seat; a kart's is lower, the read barely moves)
  gazeAhead: 1.5,    // s: where on the line the eye aims
  gaze: 15,          // deg: the cone round the gaze a thing must be in to be LOOKED AT (the frame's half-width is wider)
  launchKeep: 0.6,   // the share of launch kept on average through the gears (power falls as speed rises)
});
/** The rings, in seconds to reach. */
export const EYE_RINGS = Object.freeze({ near: [0, 0.6], mid: [0.6, 3], far: [3, Infinity] });
// the frame's horizontal half-angle (FRAME's fov is vertical over its height)
const HALF_VIEW = Math.atan(Math.tan((FRAME.fovDeg * Math.PI) / 360) * (FRAME.width / FRAME.height));
/** The least span (m) that reads at a distance. */
export const eyeSpotAt = (d) => EYE_SPOT_PX * metresPerPixel(d);
/** The vehicle a class of track is driven in when none is named. */
export const TRACK_VEHICLE = Object.freeze({ kart: 'kart', circuit: 'sports', rally: 'rally', freeway: 'midsize' });

const r3 = (v) => Math.round(v * 1000) / 1000;

/** The racing line driven: curvature-bound speed (√(grip·g / k), the top speed), then forward (launch) and backward
 *  (braking) passes, round the lap twice when closed. → [{ s, x, y, z, k, v, t }]. */
export function speedPlan(plan, cls = TRACK_VEHICLE[plan.course.class] ?? 'sports') {
  const env = envelope(cls), closed = plan.alignment.closed;
  const P = racingLine(plan), n = P.length;
  const ds = P.map((p, i) => { const q = P[(i + 1) % n]; return closed || i < n - 1 ? Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) : 0; });
  // curvature by the circle through each point and its neighbours, averaged over a few to calm the polyline's noise
  const kRaw = P.map((p, i) => {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], c = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const ab = Math.hypot(p.x - a.x, p.y - a.y), bc = Math.hypot(c.x - p.x, c.y - p.y), ac = Math.hypot(c.x - a.x, c.y - a.y);
    const cross = (p.x - a.x) * (c.y - a.y) - (p.y - a.y) * (c.x - a.x);
    return ab * bc * ac > 1e-9 ? (2 * cross) / (ab * bc * ac) : 0;
  });
  const k = kRaw.map((_, i) => { let sum = 0, m = 0; for (let j = -2; j <= 2; j++) { const q = closed ? (i + j + n) % n : i + j; if (q >= 0 && q < n) { sum += kRaw[q]; m++; } } return sum / m; });
  const v = k.map((kk) => Math.min(env.top, Math.sqrt(env.corner / Math.max(Math.abs(kk), 1e-6))));
  const acc = env.launch * DRIVER.launchKeep;
  for (let pass = 0; pass < (closed ? 2 : 1); pass++) {
    for (let i = 0; i < (closed ? n : n - 1); i++) { const j = (i + 1) % n; v[j] = Math.min(v[j], Math.sqrt(v[i] * v[i] + 2 * acc * ds[i])); }
    for (let i = (closed ? n : n - 1) - 1; i >= 0; i--) { const j = (i + 1) % n; v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * env.brake * ds[i])); }
  }
  if (!closed) v[0] = Math.min(v[0], 1);   // a stage starts from rest
  let s = 0, t = 0;
  return P.map((p, i) => {
    const out = { s: r3(s), x: p.x, y: p.y, z: p.z, k: k[i], v: v[i], t: r3(t) };
    if (closed || i < n - 1) { s += ds[i]; t += ds[i] / Math.max(0.5, (v[i] + v[(i + 1) % n]) / 2); }
    return out;
  });
}

/** The plan's own dress as things: filler, a tree read by its crown, a rock by its height. */
export function trackThings(plan) {
  return (plan.props ?? []).map((q) => ({ kind: q.kind, interest: 'filler', at: [q.at[0], q.at[1], q.at[2] + (q.kind === 'tree' ? 3 * q.size : 0.5 * q.size)], span: q.kind === 'tree' ? 3.4 * q.size : 1.1 * q.size }));
}
const rankOf = (th) => INTEREST[th.interest ?? 'filler']?.rank ?? 0;

/** What the driver sees, lap long. `things`: [{ kind, interest (INTEREST's: filler … focus), at: [x, y, z] (its
 *  centre), span (m, its least extent), top? (its highest point, for a far sight line), landmark? }]. `line`: a speed plan already driven (the racing line is the
 *  costly part; a search that asks the eye many times drives it once). `ground(x, y)`: the land's height, for far
 *  sight lines. */
export function driverEye(plan, things, { cls = TRACK_VEHICLE[plan.course.class] ?? 'sports', dt = 0.25, line = speedPlan(plan, cls), ground = null } = {}) {
  const n = line.length, closed = plan.alignment.closed;
  // a far thing behind a hill is not seen: the sight line from the eye to its top, marched over the ground
  const sighted = (eye, th) => {
    if (!ground) return true;
    const top = th.top ?? th.at[2] + th.span / 2;
    for (let i = 1; i < 24; i++) { const u = i / 24, x = eye[0] + (th.at[0] - eye[0]) * u, y = eye[1] + (th.at[1] - eye[1]) * u; if (ground(x, y) > eye[2] + (top - eye[2]) * u) return false; }
    return true;
  };
  const T = line[n - 1].t + (closed ? Math.hypot(line[0].x - line[n - 1].x, line[0].y - line[n - 1].y) / Math.max(0.5, line[n - 1].v) : 0);
  // a point on the line at a time (wrapping on a lap)
  let cursor = 0;
  const at = (time) => {
    const tt = closed ? ((time % T) + T) % T : Math.min(time, line[n - 1].t);
    if (tt < line[cursor].t) cursor = 0;
    while (cursor < n - 1 && line[cursor + 1].t <= tt) cursor++;
    const a = line[cursor], b = cursor < n - 1 ? line[cursor + 1] : closed ? line[0] : a, span = (cursor < n - 1 ? b.t : T) - a.t;
    const u = span > 1e-9 ? (tt - a.t) / span : 0;
    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u, v: a.v + (b.v - a.v) * u, k: a.k, s: a.s };
  };
  const samples = [];
  for (let time = 0; time < T; time += dt) {
    const p = at(time), q = at(time + 0.1), g = at(time + DRIVER.gazeAhead);
    const head = Math.atan2(q.y - p.y, q.x - p.x), gazeH = Math.atan2(g.y - p.y, g.x - p.x);
    const eye = [p.x, p.y, p.z + DRIVER.eye];
    // per ring: what reads in the frame (filler included), and what the gaze holds that is a prop or more
    const reads = { near: 0, mid: 0, far: 0 }, gaze = { near: 0, mid: 0, far: 0 };
    let landmark = false;
    for (const th of things) {
      const dx = th.at[0] - eye[0], dy = th.at[1] - eye[1], dz = th.at[2] - eye[2];
      const d = Math.hypot(dx, dy, dz), fwd = dx * Math.cos(head) + dy * Math.sin(head);
      if (fwd <= 0 || th.span < eyeSpotAt(d)) continue;
      const off = Math.abs(wrap(Math.atan2(dy, dx) - head));
      if (off > HALF_VIEW) continue;
      const ring = ringOf(fwd / Math.max(0.5, p.v));
      if (ring === 'far' && !sighted(eye, th)) continue;
      reads[ring]++;
      if (rankOf(th) >= 1 && Math.abs(wrap(Math.atan2(dy, dx) - gazeH)) <= (DRIVER.gaze * Math.PI) / 180) { gaze[ring]++; if (th.landmark) landmark = true; }
    }
    samples.push({ t: r3(time), s: r3(p.s), v: r3(p.v), reads, gaze, looked: gaze.mid + gaze.far > 0, landmark });
  }
  // seconds: a second is BLANK when the gaze found nothing to read in the mid or far ring all through it
  const seconds = [];
  for (const sm of samples) { const i = Math.floor(sm.t); (seconds[i] ??= { looked: false, reads: 0 }); seconds[i].looked ||= sm.looked; seconds[i].reads += sm.reads.mid + sm.reads.far; }
  // corners: focused if the gaze held a prop or more in the 1.5 s before turn-in
  const { corners } = cornersOf(line, cls, closed);
  const before = (sm, c) => [c.t0, c.t0 + T, c.t0 - T].some((t0) => sm.t >= t0 - 1.5 && sm.t <= t0);   // a lap wraps
  for (const c of corners) c.focused = samples.some((sm) => sm.gaze.mid > 0 && before(sm, c));
  // the rhythm: things passing abeam within 25 m of the line, per second (filler counts: rhythm is its work)
  const near = things.filter((th) => line.some((p) => Math.hypot(th.at[0] - p.x, th.at[1] - p.y) < 25)).length;
  return {
    cls, lap: r3(T), samples, seconds,
    blank: seconds.filter((x) => !x.looked).length,
    corners: corners.map((c) => ({ s: r3(line[c.i0 % line.length].s), t: r3(c.t0), vMin: r3(c.vMin), focused: c.focused })),
    landmarkSeen: samples.some((sm) => sm.landmark),
    rhythm: { passing: near, perSecond: r3(near / T) },
    vMax: r3(Math.max(...line.map((p) => p.v))), vMean: r3(line[n - 1].s / T),
  };
}
/** The lap split into corners (where grip, not power, sets the speed: the corner's own speed under 90 % of the top)
 *  and the straights between, a closed lap's run across the line kept whole. Indices past the line's end are the
 *  next lap's (`i % n`). → { corners: [{ i0, i1, t0, t1, dur, apex, vMin, turn }], straights: [{ i0, i1, t0, t1, dur }] } */
export function cornersOf(line, cls, closed) {
  const env = envelope(cls), n = line.length;
  const T = closed ? line[n - 1].t + Math.hypot(line[0].x - line[n - 1].x, line[0].y - line[n - 1].y) / Math.max(0.5, line[n - 1].v) : line[n - 1].t;
  const bound = line.map((p) => Math.sqrt(env.corner / Math.max(Math.abs(p.k), 1e-6)) < env.top * 0.9);
  const prev = (i) => (i > 0 ? bound[i - 1] : closed ? bound[n - 1] : !bound[0]);
  const starts = [];
  for (let i = 0; i < n; i++) if (bound[i] !== prev(i)) starts.push(i);
  if (!starts.length) starts.push(0);
  const tOf = (i) => line[i % n].t + (i >= n ? T : 0);
  const corners = [], straights = [];
  for (let j = 0; j < starts.length; j++) {
    const i0 = starts[j], i1 = j + 1 < starts.length ? starts[j + 1] : closed ? starts[0] + n : n - 1;
    const run = { i0, i1, t0: tOf(i0), t1: tOf(i1), dur: tOf(i1) - tOf(i0) };
    if (bound[i0]) {
      let apex = i0, vMin = Infinity, kSum = 0;
      for (let i = i0; i < i1; i++) { const q = line[i % n]; kSum += q.k; if (q.v < vMin) { vMin = q.v; apex = i % n; } }
      corners.push({ ...run, apex, vMin, turn: Math.sign(kSum) });
    } else straights.push(run);
  }
  return { corners, straights, T };
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ringOf = (time) => (time < EYE_RINGS.near[1] ? 'near' : time < EYE_RINGS.mid[1] ? 'mid' : 'far');
