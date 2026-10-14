/**
 * Shoot plan — the subjects a camera can follow: the things in a world that move on a schedule. A key's `pos` or `poi`
 * may name one (`{ follow: 'car:2', offset, frame }`) instead of a point; the AE move is linking the point of
 * interest to a layer, or parenting the camera to a null.
 *
 * Every subject here is a pure function of the world clock (seconds), the same clock the World page's channels run
 * on, so the plan can sample a following camera ahead of time and still draw its path. Each reads the payload the
 * page is emitted from and repeats that channel's position rule exactly:
 *   - `walker:<i>` — channels/walkers.js: arc length along its loop at constant speed (or, holding at signalled
 *     crossings, `heldWalk` stepped from clock zero, the code the page embeds);
 *   - `car:<i>` — channels/cars.js: the constant-speed lane wrap, or the signalised traffic model (`stepTraffic` /
 *     `stepTrafficTurning`, the code the page embeds) stepped from clock zero;
 *   - `mover:<group>` — channels/mover.js: a path mover's equal-time samples, looped or played-held-replayed.
 * Indices count the lists exactly as scene-three filters them, so `car:2` is the third car the page drives.
 *
 * Things that move live (physics bodies, player- or AI-driven entities) have no position before they are played, so
 * they are not subjects here.
 */
import { createTrafficModel, stepTraffic, armTurns, stepTrafficTurning, heldWalk, TRAFFIC } from '../scene/channels/traffic-model.js';

function arcTable(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { cum, total: cum[cum.length - 1] || 1e-6 };
}

function atArc(path, cum, s) {
  const total = cum[cum.length - 1];
  s = Math.max(0, Math.min(total, s));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1e-6, t = (s - cum[i - 1]) / seg, a = path[i - 1], b = path[i];
  return { pos: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], heading: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}

// a stepped model answers forward queries incrementally; a query before its clock restarts it from zero (as the page)
function stepTo(model, sec, step) {
  for (let guard = 0; guard < 100000; guard++) {
    const before = model.t;
    step(model, model.t > sec ? sec : Math.min(sec, model.t + 60));
    if (model.t + model.T.DT > sec + 1e-9 || model.t === before) return;
  }
}

function walkerSubjects(payload) {
  const figs = payload.figures || {};
  const list = (Array.isArray(payload.walkers) ? payload.walkers : []).filter((w) =>
    w && typeof w.figure === 'string' && figs[w.figure] && Array.isArray(w.path) && w.path.length > 2);
  const signals = Array.isArray(payload.signals) ? payload.signals : [];
  return list.map((w, i) => {
    const { cum, total } = arcTable(w.path);
    const period = w.period > 0 ? w.period : (w.speed > 0 ? Math.max(0.5, total / w.speed) : 8);
    const s0 = ((w.startFrac || 0) % 1) * total;
    const held = Array.isArray(w.holds) ? { s0, s: s0, t: 0 } : null;
    const arcAt = (sec) => (held ? heldWalk(w.holds, w.speed, held, total, sec, signals)
      : w.loop === false ? Math.min(total, (sec / period) * total) : ((sec / period) % 1) * total);
    return { id: `walker:${i}`, kind: 'walker', at: (sec) => atArc(w.path, cum, arcAt(Math.max(0, sec))) };
  });
}

function carSubjects(payload) {
  const meshes = payload.carMeshes || {};
  const list = (Array.isArray(payload.cars) ? payload.cars : []).filter((c) =>
    c && typeof c.car === 'string' && meshes[c.car] && Array.isArray(c.path) && c.path.length > 1);
  if (!list.length) return [];
  const lanes = payload.trafficLanes;
  const signalised = Array.isArray(payload.signals) && payload.signals.length > 0 && Array.isArray(lanes);
  let model = null, step = null, lanePaths = null;
  if (signalised) {
    model = createTrafficModel(lanes, list.map((c) => ({ lane: c.lane, startFrac: c.startFrac })), payload.signals, payload.trafficConstants || TRAFFIC);
    const turning = lanes.some((L) => Array.isArray(L.turns));
    if (turning) {
      armTurns(model, lanes, lanes[0].share || 0);
      lanePaths = lanes.map((L) => ({ path: L.path, ...arcTable(L.path) }));
      step = stepTrafficTurning;
    } else step = stepTraffic;
  }
  return list.map((c, i) => {
    const { cum, total } = arcTable(c.path);
    const period = c.period > 0 ? c.period : (c.speed > 0 ? Math.max(0.5, total / c.speed) : 8);
    const start = ((c.startFrac || 0) % 1) * total;
    const at = (sec) => {
      sec = Math.max(0, sec);
      if (!model) return atArc(c.path, cum, (((start + (sec / period) * total) % total) + total) % total);
      stepTo(model, sec, step);
      const mc = model.cars[i];
      if (lanePaths) { const lp = lanePaths[mc.lane]; return atArc(lp.path, lp.cum, mc.s); }
      return atArc(c.path, cum, mc.s);
    };
    return { id: `car:${i}`, kind: 'car', at };
  });
}

function moverSubjects(payload) {
  const list = (Array.isArray(payload.movers) ? payload.movers : []).filter((mv) =>
    mv && typeof mv.group === 'string' && Array.isArray(mv.path) && mv.path.length > 1 && mv.t1 == null && !mv.pose && mv.period > 0);
  return list.map((mv) => {
    const u = (sec) => {
      if (mv.loop) return ((sec / mv.period) % 1 + 1) % 1;
      const cycle = mv.period + (mv.hold || 0), ph = sec % cycle;
      return ph < mv.period ? ph / mv.period : 1;
    };
    const at = (sec) => {
      const n = mv.path.length, f = Math.max(0, Math.min(1, u(Math.max(0, sec)))) * (n - 1);
      const i = Math.min(n - 2, Math.floor(f)), a = f - i, p0 = mv.path[i], p1 = mv.path[i + 1];
      return { pos: [p0[0] + (p1[0] - p0[0]) * a, p0[1] + (p1[1] - p0[1]) * a, p0[2] + (p1[2] - p0[2]) * a], heading: Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) };
    };
    return { id: `mover:${mv.group}`, kind: 'mover', at };
  });
}

/**
 * The followable subjects of a resolved world payload, by id. Each `at(sec)` returns `{ pos, heading }` (heading in
 * radians, 0 = +x) and is cached per instant, so a camera that samples them at its frame rate steps each stepped
 * model once.
 */
export function shootSubjects(payload) {
  const out = new Map();
  if (!payload || typeof payload !== 'object') return out;
  for (const s of [...walkerSubjects(payload), ...carSubjects(payload), ...moverSubjects(payload)]) {
    const cache = new Map();
    out.set(s.id, { id: s.id, kind: s.kind, at: (sec) => {
      const k = Math.round(sec * 1e4);
      if (!cache.has(k)) { const v = s.at(sec); cache.set(k, { pos: v.pos, heading: v.heading }); }
      return cache.get(k);
    } });
  }
  return out;
}

/** The point a follow reference names at a time: the subject's position plus `offset`, turned with its heading
 * when `frame: 'subject'` (x forward, y left, z up: a camera riding behind and above is `[-4, 0, 1.5]`). */
export function followPoint(ref, subjects, sec) {
  const s = subjects && subjects.get(ref.follow);
  if (!s) throw new Error(`shoot plan: '${ref.follow}' is not a moving subject in this world`);
  const { pos, heading } = s.at(sec);
  const o = ref.offset || [0, 0, 0];
  if (ref.frame !== 'subject') return [pos[0] + o[0], pos[1] + o[1], pos[2] + o[2]];
  const c = Math.cos(heading), n = Math.sin(heading);
  return [pos[0] + o[0] * c - o[1] * n, pos[1] + o[0] * n + o[1] * c, pos[2] + o[2]];
}
