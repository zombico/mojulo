import { safeJson } from '../emit-util.js';
import { TRAFFIC_MODEL_SOURCE } from './traffic-model.js';

// The FLOW channel (a metro's traffic, geocity/flow.js): the old city's driver-ants (channels/cars.js) at a metro's
// scale, where one mesh a car would be thousands. Each lane its own signalised model (traffic-model.js, its source
// embedded verbatim: the page and the tests run one code), stepped ONLY while the camera stands within `near` of the
// lane: a lane far off waits, one come into reach starts from the last turn of its signals' cycle (all a metro's signals
// share one cycle, so a lane's pose at a clock is the clock's, however the camera came to it). Its vehicles are
// INSTANCES of the page's pooled templates (a repeat carrying `pool`: the parked vehicles' own, paint tinted per
// vehicle, trim, a roof's extra), written each frame for the vehicles within `near` and before the camera only: the
// draw is what the camera can see, the rest of the metro's traffic no cost. Each sits on its lane's road (the ground
// sampled along it), pitched to it between its axles. Emitted only when a payload carries `flow`; none ⇒ not one byte.
//
// PLAYED (`play`: the page has a car a hero gets into, worlds/controllable/mount.js): the traffic GIVES WAY and STANDS
// IN THE WAY. Each frame the world's cabs and its pilot on foot that stand in a lane are that lane's BLOCKS: a vehicle
// behind one brakes to rest a gap short of it (tick by tick, however long the frame) and those behind queue as they do at a red (a lane's pose is then no
// longer the clock's alone, until the camera leaves it); and the vehicles near the pilot are handed to the world as
// hulls (`world.trafficHulls`: [{ p, heading, hull: [half width, half length] }]) the cabs and walkers are pushed out
// of, each with its id, model and paint so one may be taken (channels/cab-pool.js: `window.__mojTaken`, drawn here no
// more); the probe's `blocks` counts the lanes' blocks this frame. Absent `play`, not one byte of it.
//
//   flow { T, signals, near, kinds: [{ model, extra?, len }], tints: [[r, g, b] linear], lanes: [{ axis, cross, lo, hi,
//          dir, total, speed, crossings, ground: [u, z, …] }], cars: [[lane, kind, tint, startFrac]] }

/** A lane's BLOCKS (played): each body standing in it (`bodies`: [{ p, f, hw, hl }], a box turned to `f` on the ground),
 *  as where along the lane it lies (metres from the lane's start, the way it drives) and its half length along it. */
export function laneBlocks(L, bodies, T, zAt) {
  const out = [], sg = L.dir >= 0 ? 1 : -1, ay = L.axis === 'y';
  for (const b of bodies) {
    const off = (ay ? b.p[0] : b.p[1]) - L.cross, u = ay ? b.p[1] : b.p[0];
    const fa = Math.abs(ay ? b.f[1] : b.f[0]), fp = Math.abs(ay ? b.f[0] : b.f[1]), along = b.hl * fa + b.hw * fp, across = b.hl * fp + b.hw * fa;
    if (Math.abs(off) > across + T.CAR_WID / 2 || u < L.lo || u > L.hi || Math.abs(b.p[2] - zAt(L.ground, u)) > 2.5) continue;
    out.push({ s: sg > 0 ? u - L.lo : L.hi - u, half: along });
  }
  return out;
}
/** After a lane's step (played): no vehicle that was behind a block (`s0`, each vehicle's place before the step) has
 *  come nearer it than the gap; it brakes to rest there, and those behind it queue by the model's own rule. */
export function flowYield(m, blocks, s0, T) {
  for (let k = 0; k < m.cars.length; k++) {
    const c = m.cars[k], half = c.len / 2 + T.MARGIN;
    for (const b of blocks) {
      if (s0[k] > b.s) continue;
      const stop = b.s - b.half - T.MARGIN - T.GAP - half;
      if (c.s > stop) { c.s = Math.max(s0[k], Math.min(c.s, stop)); c.v = 0; }
      else c.v = Math.min(c.v, Math.sqrt(2 * T.ACCEL * (stop - c.s)));
    }
  }
}

/** A lane stepped to clock `t` with blocks in it (played): the model's own fixed ticks, each followed by the yield, so
 *  a frame that covers many ticks never lets a vehicle run on and be set back onto the one behind it. `tick` the
 *  model's (traffic-model.js trafficTick: handed in, so this function's source stands alone on the page). */
export function stepFlowYielding(m, t, blocks, T, tick) {
  if (t < m.t - 1e-9) m.reset();
  let n = 0;
  while (m.t + T.DT <= t + 1e-9 && n < T.MAX_STEPS) { const s0 = m.cars.map((c) => c.s); tick(m, T.DT); flowYield(m, blocks, s0, T); n += 1; }
  return m;
}

/** A flow fit to emit: its lanes, signals and vehicles, or null. */
export function readFlow(flow) {
  if (!flow || typeof flow !== 'object') return null;
  const ok = Array.isArray(flow.lanes) && flow.lanes.length && Array.isArray(flow.signals) && flow.signals.length && Array.isArray(flow.cars) && flow.cars.length && Array.isArray(flow.kinds) && flow.kinds.length && flow.T;
  return ok ? flow : null;
}

/** The page's script: `stepFlow(t)` (t in ms, the world clock), `window.__mojFlow` its probe. */
export function flowChannelScript(flow, { play = false } = {}) {
  const F = { T: flow.T, signals: flow.signals, near: flow.near ?? 320, kinds: flow.kinds.map((k) => ({ model: k.model, ...(k.extra ? { extra: k.extra } : {}), len: k.len, ...(play ? { wid: k.wid ?? 1.9 } : {}) })), tints: flow.tints, lanes: flow.lanes.map((L) => ({ axis: L.axis, cross: L.cross, lo: L.lo, hi: L.hi, dir: L.dir, total: L.total, speed: L.speed, crossings: L.crossings, ground: L.ground })), cars: flow.cars };
  return `
// ---- flow channel (a metro's traffic: lanes stepped and vehicles drawn near the camera only) ----
let stepFlow = () => {};
{
const FLOW = ${safeJson(F)};
${TRAFFIC_MODEL_SOURCE}
const __flCycle = FLOW.signals[0].cycle;
// each kind's parts: instanced meshes on the pooled templates, sized to its vehicles, drawn as many as are near
const __flMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const __flN = FLOW.kinds.map(() => 0); for (const c of FLOW.cars) __flN[c[1]]++;
const __flParts = FLOW.kinds.map((k, i) => ['paint', 'trim', k.extra || null].filter(Boolean).map((part) => {
  const geo = typeof __POOLS !== 'undefined' ? __POOLS[k.model + '|' + part] : null;
  if (!geo || !__flN[i]) return null;
  const im = new THREE.InstancedMesh(geo, __flMat, __flN[i]);
  im.count = 0; im.frustumCulled = false; im.userData.g = 'flow:' + k.model;
  if (part === 'paint') im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(__flN[i] * 3), 3);
  scene.add(im);
  return { im, paint: part === 'paint' };
}).filter(Boolean));
const __flTint = FLOW.tints.map((t) => new THREE.Color(t[0], t[1], t[2]));
const __flLanes = FLOW.lanes.map((L, li) => ({ L, cars: FLOW.cars.filter((c) => c[0] === li), m: null }));
// the road's height at u along a lane (its samples ascending)
function __flZ(g, u) {
  const n = g.length / 2;
  if (u <= g[0]) return g[1];
  if (u >= g[2 * n - 2]) return g[2 * n - 1];
  let a = 0, b = n - 1;
  while (b - a > 1) { const k = (a + b) >> 1; if (g[2 * k] <= u) a = k; else b = k; }
  const t = (u - g[2 * a]) / (g[2 * b] - g[2 * a] || 1e-6);
  return g[2 * a + 1] + (g[2 * b + 1] - g[2 * a + 1]) * t;
}
const __flM = new THREE.Matrix4(), __flQ = new THREE.Quaternion(), __flE = new THREE.Euler(0, 0, 0, 'ZYX'), __flP = new THREE.Vector3(), __flS = new THREE.Vector3(1, 1, 1), __flF = new THREE.Vector3();
const __flAt = FLOW.kinds.map(() => 0);
${play ? `// (played) the world's bodies that block a lane, and the vehicles near its pilot as hulls
let __flBodies = [], __flHulls = null, __flPil = [0, 0], __flNB = 0;
function __flWorld() {
  const W = window.__mojCtrl && window.__mojCtrl.world;
  __flBodies = []; __flHulls = null;
  if (!W) return;
  for (const e of W.entities) {
    if (e.gone || e.isCamera || e.mountedOn) continue;
    const h = e.mount && e.mount.cab && e.mount.hull, a = e.transform.heading, p = e.transform.pos;
    if (h) __flBodies.push({ p, f: [Math.cos(a), Math.sin(a)], hw: h[0], hl: h[1] });
    else if (e.id === W.pilotId) __flBodies.push({ p, f: [1, 0], hw: 0.4, hl: 0.4 });
  }
  const P = W.byId[W.pilotId];
  if (P) { __flPil = P.transform.pos; __flHulls = W.trafficHulls = []; }
}
${laneBlocks.toString()}
${flowYield.toString()}
${stepFlowYielding.toString()}
const __flBlocks = (L) => laneBlocks(L, __flBodies, FLOW.T, __flZ);
` : ''}window.__mojFlow = { lanes: FLOW.lanes.length, cars: FLOW.cars.length, active: 0, drawn: 0, pose: [] };
stepFlow = (t) => {
  const sec = t / 1000, p = camera.position, R = FLOW.near;
  camera.getWorldDirection(__flF);
  const fl = Math.hypot(__flF.x, __flF.y) || 1, fx = __flF.x / fl, fy = __flF.y / fl;
  for (let i = 0; i < __flAt.length; i++) __flAt[i] = 0;
${play ? '  __flWorld(); __flNB = 0;\n' : ''}  let active = 0;
  const pose = [];
  for (const lane of __flLanes) {
    const L = lane.L;
    // a lane within reach of the camera (across it and over it), or none of it is stepped or drawn
    const off = (L.axis === 'y' ? p.x : p.y) - L.cross, up = p.z - __flZ(L.ground, L.axis === 'y' ? p.y : p.x);
    if (off * off + up * up > R * R) continue;
    active++;
    if (!lane.m) lane.m = createTrafficModel([L], lane.cars.map((c) => ({ lane: 0, startFrac: c[3], len: FLOW.kinds[c[1]].len })), FLOW.signals, FLOW.T);
    const m = lane.m;
    // (come into reach after a while, or a clock set back: from its cycle's last turn)
    if (sec < m.t - 1e-9 || sec - m.t > __flCycle) { m.reset(); m.t = Math.floor(sec / __flCycle) * __flCycle; }
${play ? '    const __flB = __flBlocks(L); __flNB += __flB.length;\n    if (__flB.length) stepFlowYielding(m, sec, __flB, FLOW.T, trafficTick); else\n' : ''}    stepTraffic(m, sec);
    const heading = L.axis === 'y' ? (L.dir >= 0 ? 0 : Math.PI) : (L.dir >= 0 ? -Math.PI / 2 : Math.PI / 2), sg = L.dir >= 0 ? 1 : -1;
    for (let k = 0; k < m.cars.length; k++) {
      const c = lane.cars[k], kind = FLOW.kinds[c[1]], s = m.cars[k].s, u = sg > 0 ? L.lo + s : L.hi - s;
      const x = L.axis === 'y' ? L.cross : u, y = L.axis === 'y' ? u : L.cross, dx = x - p.x, dy = y - p.y;
${play ? '      // (one a hero took, channels/cab-pool.js: a body of the world now, drawn and held there)\n      if (window.__mojTaken && window.__mojTaken[__flLanes.indexOf(lane) + \':\' + k]) continue;\n      // (near the pilot, seen or not: a hull the world holds its bodies out of)\n      if (__flHulls && (x - __flPil[0]) * (x - __flPil[0]) + (y - __flPil[1]) * (y - __flPil[1]) < 1600) __flHulls.push({ p: [x, y, __flZ(L.ground, u)], heading: heading + Math.PI / 2, hull: [kind.wid / 2, kind.len / 2], v: m.cars[k].v, id: __flLanes.indexOf(lane) + \':\' + k, model: kind.model, tint: FLOW.tints[c[2]] });\n' : ''}      // (within reach, and not behind the camera)
      if (dx * dx + dy * dy > R * R || dx * fx + dy * fy < -kind.len) continue;
      const h = kind.len * 0.35, zf = __flZ(L.ground, u + sg * h), zr = __flZ(L.ground, u - sg * h), dz = (zf + zr) / 2 - p.z;
      if (dx * dx + dy * dy + dz * dz > R * R) continue;
      __flE.set(Math.atan2(zf - zr, 2 * h), 0, heading); __flQ.setFromEuler(__flE); __flP.set(x, y, (zf + zr) / 2);
      __flM.compose(__flP, __flQ, __flS);
      const n = __flAt[c[1]]++;
      for (const part of __flParts[c[1]]) { part.im.setMatrixAt(n, __flM); if (part.paint) part.im.setColorAt(n, __flTint[c[2]]); }
      if (pose.length < 64) pose.push({ kind: c[1], at: [x, y, (zf + zr) / 2], v: m.cars[k].v });
    }
  }
  let drawn = 0;
  __flParts.forEach((parts, i) => { for (const part of parts) { part.im.count = __flAt[i]; part.im.instanceMatrix.needsUpdate = true; if (part.paint && part.im.instanceColor) part.im.instanceColor.needsUpdate = true; } drawn += __flAt[i]; });
  const P = window.__mojFlow; P.active = active; P.drawn = drawn; P.pose = pose;
${play ? '  P.blocks = __flNB;\n' : ''}};
}`;
}
