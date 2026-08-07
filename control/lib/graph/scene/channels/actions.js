import { safeJson } from '../emit-util.js';

// In-page script: the ACTIONS channel — what makes an actions-world INTERACTIVE. Each action binds an
// input (`pointer` / `key`) to a verb on a physics body. Slice 1 verb is `impulse` (the kick.html
// primitive): a velocity kick whose magnitude is scaled by the body's inverse mass, so a heavy body
// barely moves and a light one shoots off — mass is first-class, as the brief asked.
//   { on:'pointer', target:'ball', do:'impulse', dir:'camera'|'up'|[x,y,z], gain:6 }
//   { on:'key', key:' ', target:'ball', do:'impulse', dir:'up', gain:8 }
// pointer with NO `target` kicks whatever body is under the cursor (raycast pick); with a `target` it
// kicks that named body on any click (button-feel). Default pointer `dir` is the camera ray (kick away
// from the eye). Requires the physics channel (uses window.__mojSim); gated on hasPhysics by the caller.
// NOTE (slice 1): fires on pointerdown, so a kick also nudges OrbitControls; click-vs-drag disambig is
// a follow-on. `window.__mojActions.fire(name)` is exposed for headless verification.
export function actionsChannelScript(actions) {
  return `
const ACTIONS = ${safeJson(actions)};
const __ray = new THREE.Raycaster();
function __bodyById(id) { return (window.__mojSim && window.__mojSim.state.bodies.find((b) => b.id === id)) || null; }
function __applyImpulse(body, dir, gain) {
  if (!body || body.invMass === 0) return false;
  const L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const k = (gain != null ? gain : 5) * body.invMass;   // Δv = J·invMass → mass matters
  body.velocity[0] += dir[0] / L * k; body.velocity[1] += dir[1] / L * k; body.velocity[2] += dir[2] / L * k;
  body.resting = false;
  return true;
}
function __resolveDir(spec, ray) {
  if (Array.isArray(spec)) return spec;
  if (spec === 'up') return [0, 0, 1];
  if (spec === 'camera') { const v = new THREE.Vector3(); camera.getWorldDirection(v); return [v.x, v.y, v.z]; }
  return ray || [0, 0, 1];
}
function __pickBody(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  const nx = ((ev.clientX - r.left) / r.width) * 2 - 1, ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
  __ray.setFromCamera({ x: nx, y: ny }, camera);
  const meshes = Object.values(window.__mojSim.meshes);
  const hit = __ray.intersectObjects(meshes, false)[0];
  let id = null;
  if (hit) for (const k in window.__mojSim.meshes) { if (window.__mojSim.meshes[k] === hit.object) { id = k; break; } }
  return { id, ray: [__ray.ray.direction.x, __ray.ray.direction.y, __ray.ray.direction.z] };
}
// Ray ∩ horizontal plane z=h → a world point under the cursor. Used by spawn (drop a body where
// you click) and grab (drag a body across a plane at its own height). Falls back to the camera
// target's height when the ray is parallel to the plane.
function __planeHit(ev, h) {
  const r = renderer.domElement.getBoundingClientRect();
  const nx = ((ev.clientX - r.left) / r.width) * 2 - 1, ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
  __ray.setFromCamera({ x: nx, y: ny }, camera);
  const o = __ray.ray.origin, d = __ray.ray.direction;
  if (Math.abs(d.z) < 1e-6) return [o.x, o.y, h];
  const t = (h - o.z) / d.z;
  return [o.x + d.x * t, o.y + d.y * t, h];
}
function __runAction(act, ev) {
  if (!window.__mojSim) return;
  if (act.do === 'impulse') {
    if (act.on === 'pointer') {
      const pick = __pickBody(ev);
      const id = act.target || pick.id;
      if (id) __applyImpulse(__bodyById(id), __resolveDir(act.dir, pick.ray), act.gain);
    } else {
      __applyImpulse(__bodyById(act.target), __resolveDir(act.dir, null), act.gain);
    }
  } else if (act.do === 'spawn' && act.template) {
    const h = Number.isFinite(act.height) ? act.height : (act.template.position ? act.template.position[2] : 8);
    const at = act.on === 'pointer' && ev && ev.clientX != null ? __planeHit(ev, h) : (act.at || act.template.position || [0, 0, h]);
    window.__mojSim.spawn({ ...act.template, id: (act.template.id || 'spawn') + '-' + (window.__mojSpawnN = (window.__mojSpawnN || 0) + 1), position: at });
  }
}
// GRAB (pointer-only): pick a body on pointerdown, drag it across a horizontal plane at its grab
// height (pointermove), release with a throw velocity from the last cursor delta (pointerup). While
// grabbed, window.__mojGrab pins the body in the physics loop so the sim doesn't fight the drag.
function __wireGrab(act) {
  let grabH = 0, lastT = 0;
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', (ev) => {
    if (!window.__mojSim) return;
    const pick = __pickBody(ev);
    const id = act.target || pick.id;
    const body = __bodyById(id);
    if (!body || body.invMass === 0) return;
    grabH = body.position[2];
    const p = __planeHit(ev, grabH);
    window.__mojGrab = { id, target: p, last: p, lastT: ev.timeStamp || 0 };
    lastT = ev.timeStamp || 0;
  });
  dom.addEventListener('pointermove', (ev) => {
    const g = window.__mojGrab;
    if (!g) return;
    g.last = g.target; g.target = __planeHit(ev, grabH);
    g.lastDt = Math.max(1e-3, ((ev.timeStamp || 0) - lastT) / 1000); lastT = ev.timeStamp || 0;
  });
  const release = () => {
    const g = window.__mojGrab;
    if (!g) return;
    const body = __bodyById(g.id);
    if (body && g.last) {
      const dt = g.lastDt || 1 / 60;
      body.velocity = [(g.target[0] - g.last[0]) / dt, (g.target[1] - g.last[1]) / dt, (g.target[2] - g.last[2]) / dt];
    }
    window.__mojGrab = null;
  };
  dom.addEventListener('pointerup', release);
  dom.addEventListener('pointercancel', release);
}
for (const act of ACTIONS) {
  if (act.do === 'grab') { __wireGrab(act); continue; }
  if (act.on === 'pointer') renderer.domElement.addEventListener('pointerdown', (ev) => __runAction(act, ev));
  else if (act.on === 'key') window.addEventListener('keydown', (ev) => { if (!act.key || ev.key === act.key) __runAction(act, ev); });
}
// exposed for headless verification: fire the Nth action (or the first matching the named target).
window.__mojActions = { list: ACTIONS, fire: (i) => __runAction(typeof i === 'number' ? ACTIONS[i] : ACTIONS.find((a) => a.target === i), {}) };`;
}
