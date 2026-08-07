import { safeJson } from '../emit-util.js';

// The CARS channel (city-cars: the "driver-ants" sibling of the walkers channel). Rigid vehicle meshes
// that PACMAN along road lanes — each streams edge-to-edge and, at the wrap, reappears at the far edge,
// so a lane reads as continuous flowing traffic. Unlike walkers there is no rig or gait: a car is ONE
// rigid mesh, translated along its lane by ARC LENGTH (constant ground speed) and yawed to the path
// tangent. It reuses the walkers' arc-length path math; the vehicle geometry comes pre-baked (a b64
// pos/col mesh from vehicleFaces), so several cars can share one baked type via the `bank`.
//
// A lane carries a DIRECTION baked into its path order (authored in travel order), so a two-way road is
// just two lanes whose paths run opposite ways — and which lane gets which direction is the driving-side
// convention, decided at plan time (left- vs right-hand traffic). Per-car `startFrac` spaces lane-mates
// out along the same lane. Emitted only when the caller passes a non-empty `cars`; a car-free world is
// byte-identical.
// `cast` (the world runs the cast-shadow channel): car meshes flag themselves as shadow casters.
export function carsChannelScript(cars, bank, { cast = false } = {}) {
  return `
// ---- cars channel (ambient traffic: rigid vehicles pacman-ing road lanes) ----
let stepCars = () => {};
{
const CARS = ${safeJson(cars)};
const CBANK = ${safeJson(bank)};
// build one rigid mesh per car from its referenced baked geometry (pos + normalized-uint8 colour).
function __buildCar(mesh) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(mesh.pos), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(mesh.col), 3, true));
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));${cast ? '\n  m.castShadow = true;' : ''}
  m.frustumCulled = false;
  scene.add(m);
  return m;
}
// arc-length table for a lane path: cumulative length per vertex + total (constant ground speed).
function __arcTable(path) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
  return { cum, total: cum[cum.length - 1] || 1e-6 };
}
// position + segment tangent at arc-length s (s already wrapped into [0,total) by the caller).
const __cout = { pos: [0, 0, 0], tan: [1, 0, 0] };
function __atArc(path, cum, s) {
  const total = cum[cum.length - 1]; s = Math.max(0, Math.min(total, s));
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const seg = cum[i] - cum[i - 1] || 1e-6, t = (s - cum[i - 1]) / seg, a = path[i - 1], b = path[i];
  __cout.pos[0] = a[0] + (b[0] - a[0]) * t; __cout.pos[1] = a[1] + (b[1] - a[1]) * t; __cout.pos[2] = a[2] + (b[2] - a[2]) * t;
  __cout.tan[0] = b[0] - a[0]; __cout.tan[1] = b[1] - a[1]; __cout.tan[2] = b[2] - a[2];
  return __cout;
}
const __carRigs = CARS.map((c) => {
  const m = __buildCar(CBANK[c.car]);
  const at = __arcTable(c.path);
  if (c.scale > 0 && c.scale !== 1) m.scale.setScalar(c.scale);
  return { c, mesh: m, cum: at.cum, total: at.total,
    // constant ground speed: prefer an explicit period, else lane length / speed (so lanes of any
    // length flow at one pace); else a default.
    period: c.period > 0 ? c.period : (c.speed > 0 ? Math.max(0.5, at.total / c.speed) : 8),
    start: ((c.startFrac || 0) % 1) * at.total,   // arc-length offset → lane-mates spaced out
    yaw: c.yaw != null ? c.yaw : 0 };             // the baked car faces +x at heading 0 → no yaw offset
});
// probe/debug seam (a traversal audit surface): the live pose of every car.
window.__mojCars = __carRigs.map((r) => ({ car: r.c.car, pos: [0, 0, 0], heading: 0 }));
stepCars = (t) => {
  const sec = t / 1000;
  for (let ci = 0; ci < __carRigs.length; ci++) {
    const r = __carRigs[ci], c = r.c, m = r.mesh;
    const s = (((r.start + (sec / r.period) * r.total) % r.total) + r.total) % r.total;   // pacman wrap
    const at = __atArc(c.path, r.cum, s), p = at.pos, tan = at.tan;
    const heading = Math.atan2(tan[1], tan[0]);
    m.position.set(p[0], p[1], p[2]);
    m.rotation.set(0, 0, heading + r.yaw);
    const co = window.__mojCars[ci]; co.pos[0] = p[0]; co.pos[1] = p[1]; co.pos[2] = p[2]; co.heading = heading;
  }
};
}`;
}
