import { buildSim } from '../../worlds/physics-sim.js';
import { safeJson } from '../emit-util.js';

// In-page script: the PHYSICS channel — the live, interactive substrate of an actions-world
// (actions-world.plan.md). Unlike every other channel here (which REPLAY baked, deterministic
// motion), this RUNS the integrator in the browser: state accumulates, input can perturb it.
//
// Single source of truth: the integrator is the SAME code as the node module physics-sim.js,
// emitted via buildSim.toString() — there is no second, drifting browser copy. We step it on a
// FIXED dt (accumulator-clamped) off setAnimationLoop's time arg, so the sim rate is stable across
// frame-rate; the first frame seeds prevT (dt 0) so a frozen still / capture renders frame zero
// (the degradation contract: /svg + /scene + ?t → initial condition). Bodies render UNLIT
// (MeshBasicMaterial), matching the baked-light identity — physics moves the mesh, never relights it.
// Dynamic sphere bodies get their own mesh; static plane/aabb colliders are invisible (the scene's
// baked faces are the visual floor/walls). `window.__mojSim` is exposed for the actions channel
// (phase 4) and headless verification. Colours come from the raw manifest body (`color`).
export function physicsChannelScript(physics) {
  return `
const PHYSICS = ${safeJson(physics)};
const __SIM = (${buildSim.toString()})();
const __simState = __SIM.createState(PHYSICS);
const __FIXED_DT = 1 / 120;
const __DEFAULT_BODY_COLOR = 0xff7a59;
const __bodyMeshes = {};
const __bodyColor = {};   // id → manifest colour, so spawns/emitters can inherit a template colour
(PHYSICS.bodies || []).forEach((raw, i) => { const b = __simState.bodies[i]; if (b && raw && raw.color != null) __bodyColor[b.id] = raw.color; });
// Lazily build a mesh for any dynamic sphere that lacks one — covers the manifest bodies AND any
// body added at runtime by the spawn verb / emitters. A small dark "pole" marker rides the surface
// so SPIN is visible (a uniform unlit sphere looks identical from every angle while it rolls).
function __ensureMesh(b) {
  if (__bodyMeshes[b.id] || b.collider !== 'sphere') return;
  const col = __bodyColor[b.id] != null ? __bodyColor[b.id] : __DEFAULT_BODY_COLOR;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(b.radius, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(col) }));
  const mark = new THREE.Mesh(new THREE.SphereGeometry(b.radius * 0.28, 12, 8), new THREE.MeshBasicMaterial({ color: 0x10141c }));
  mark.position.set(0, 0, b.radius);   // north-pole cap, in body-local space → rotates with the body
  mesh.add(mark);
  scene.add(mesh);
  __bodyMeshes[b.id] = mesh;
}
function __syncBodies() {
  for (const b of __simState.bodies) {
    __ensureMesh(b);
    const m = __bodyMeshes[b.id];
    if (!m) continue;
    m.position.set(b.position[0], b.position[1], b.position[2]);
    const q = b.orientation;
    if (q) m.quaternion.set(q[0], q[1], q[2], q[3]);   // rigid-body spin
  }
}
function __spawn(raw) {
  const b = __SIM.addBody(__simState, raw);
  if (raw && raw.color != null) __bodyColor[b.id] = raw.color;
  __ensureMesh(b); __syncBodies();
  return b;
}
// autonomous EMITTERS (a behaviour rule): each emits a body every 1/rate seconds, up to the cap, from
// its anchor with an initial velocity. Deterministic — a small index-based offset keeps emitted bodies from
// perfectly overlapping without any RNG (so a no-input playthrough stays reproducible).
const __emitters = (PHYSICS.emitters || []).filter((e) => e && e.template).map((e) => ({ spec: e, acc: 0, count: 0 }));
function __stepEmitters(dtSec) {
  for (const em of __emitters) {
    const rate = Number.isFinite(em.spec.rate) ? em.spec.rate : 1;
    const cap = Number.isFinite(em.spec.max) ? em.spec.max : 50;
    em.acc += dtSec;
    const period = 1 / Math.max(0.01, rate);
    while (em.acc >= period && em.count < cap) {
      em.acc -= period;
      const t = em.spec.template;
      const at = Array.isArray(em.spec.at) ? em.spec.at : (t.position || [0, 0, 5]);
      const off = (em.count % 5) * 0.15 - 0.3;   // deterministic spread
      __spawn({ ...t, id: (t.id || 'emit') + '-' + em.spec_i + '-' + em.count + '-' + Math.round(at[0] * 1000),
        position: [at[0] + off, at[1] + off, at[2]], velocity: em.spec.velocity || t.velocity });
      em.count++;
    }
  }
}
__emitters.forEach((em, i) => { em.spec_i = i; });
let __physPrevT = 0, __physAcc = 0;
stepPhysics = (t) => {
  if (!__physPrevT) { __physPrevT = t; __syncBodies(); return; }   // first frame → frame zero
  const frame = Math.min((t - __physPrevT) / 1000, 0.05); __physPrevT = t;
  __physAcc += frame;
  let guard = 0;
  while (__physAcc >= __FIXED_DT && guard++ < 8) { __SIM.step(__simState, __FIXED_DT); __physAcc -= __FIXED_DT; }
  __stepEmitters(frame);
  // grab-pin: while a body is grabbed (actions channel) the physics is overridden — it tracks the
  // cursor and holds zero velocity, so the sim doesn't fight the drag. Release restores dynamics.
  const g = window.__mojGrab;
  if (g && g.id && g.target) { const b = __simState.bodies.find((x) => x.id === g.id); if (b) { b.position = g.target.slice(); b.velocity = [0, 0, 0]; b.angularVelocity = [0, 0, 0]; } }
  __syncBodies();
};
// exposed for the actions channel + headless verification.
window.__mojSim = { sim: __SIM, state: __simState, meshes: __bodyMeshes, sync: __syncBodies, spawn: __spawn };`;
}
