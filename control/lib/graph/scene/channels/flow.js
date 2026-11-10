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
//   flow { T, signals, near, kinds: [{ model, extra?, len }], tints: [[r, g, b] linear], lanes: [{ axis, cross, lo, hi,
//          dir, total, speed, crossings, ground: [u, z, …] }], cars: [[lane, kind, tint, startFrac]] }

/** A flow fit to emit: its lanes, signals and vehicles, or null. */
export function readFlow(flow) {
  if (!flow || typeof flow !== 'object') return null;
  const ok = Array.isArray(flow.lanes) && flow.lanes.length && Array.isArray(flow.signals) && flow.signals.length && Array.isArray(flow.cars) && flow.cars.length && Array.isArray(flow.kinds) && flow.kinds.length && flow.T;
  return ok ? flow : null;
}

/** The page's script: `stepFlow(t)` (t in ms, the world clock), `window.__mojFlow` its probe. */
export function flowChannelScript(flow) {
  const F = { T: flow.T, signals: flow.signals, near: flow.near ?? 320, kinds: flow.kinds.map((k) => ({ model: k.model, ...(k.extra ? { extra: k.extra } : {}), len: k.len })), tints: flow.tints, lanes: flow.lanes.map((L) => ({ axis: L.axis, cross: L.cross, lo: L.lo, hi: L.hi, dir: L.dir, total: L.total, speed: L.speed, crossings: L.crossings, ground: L.ground })), cars: flow.cars };
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
window.__mojFlow = { lanes: FLOW.lanes.length, cars: FLOW.cars.length, active: 0, drawn: 0, pose: [] };
stepFlow = (t) => {
  const sec = t / 1000, p = camera.position, R = FLOW.near;
  camera.getWorldDirection(__flF);
  const fl = Math.hypot(__flF.x, __flF.y) || 1, fx = __flF.x / fl, fy = __flF.y / fl;
  for (let i = 0; i < __flAt.length; i++) __flAt[i] = 0;
  let active = 0;
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
    stepTraffic(m, sec);
    const heading = L.axis === 'y' ? (L.dir >= 0 ? 0 : Math.PI) : (L.dir >= 0 ? -Math.PI / 2 : Math.PI / 2), sg = L.dir >= 0 ? 1 : -1;
    for (let k = 0; k < m.cars.length; k++) {
      const c = lane.cars[k], kind = FLOW.kinds[c[1]], s = m.cars[k].s, u = sg > 0 ? L.lo + s : L.hi - s;
      const x = L.axis === 'y' ? L.cross : u, y = L.axis === 'y' ? u : L.cross, dx = x - p.x, dy = y - p.y;
      // (within reach, and not behind the camera)
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
};
}`;
}
