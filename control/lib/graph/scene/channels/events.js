import { buildBus } from '../../worlds/event-bus.js';
import { safeJson } from '../emit-util.js';

// In-page script: the EVENTS channel — the in-world bus (event-bus.plan.md). This is the MEMBRANE
// between mechanism and policy: the physics step emits physical FACTS (contact / rest), the bus
// assigns MEANING via declarative reactions + scope-keyed sequences, and the result is reflected
// onto marker meshes. Compute is truth, render is a projection of it — by the time __syncBus runs,
// the reaction has already decided what happened; the mesh just shows the foregone conclusion.
//
// Single source of truth: the reducer is the SAME code as the node module event-bus.js, emitted via
// buildBus.toString() — no second, drifting browser copy (same discipline as physics/controllable).
// Determinism: deriveEvents is EDGE-TRIGGERED off the integrator's per-step detections, and the first
// frame seeds dt 0 (frame zero → no events), so a frozen still / ?t render is the initial condition.
// Reaction VERBS reflected here are the non-physics ones — spawn (a marker appears), toggle (.on →
// mesh visibility), move (reposition). Reaching back INTO physics (impulse on a body) is Phase 5b.
export function eventsChannelScript(events) {
  return `
const EVENTS = ${safeJson(events)};
const __BUS = (${buildBus.toString()})();
const __busState = __BUS.createBusState(EVENTS, EVENTS.entities || []);
const __SOURCES = EVENTS.sources || [];
// INPUT as a source (the 4th, beside physics facts / timers / watches): bind key/pointer to a bus
// event. Listeners push onto a queue drained each frame, so a conceptual world is clickable.
const __inputQueue = [];
const __markerMeshes = {};        // bus entity id → mesh (spawn/toggle/move reflect onto these)
const __MARKER_COLOR = 0x7ad1ff;
const __pickRay = new THREE.Raycaster();
const __pickNdc = new THREE.Vector2();
// raycast the VISIBLE marker meshes under the pointer; return the nearest entity id, or null.
function __pickEntity(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  __pickNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  __pickNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  __pickRay.setFromCamera(__pickNdc, camera);
  const meshes = Object.values(__markerMeshes).filter((m) => m.visible);
  const hits = __pickRay.intersectObjects(meshes, false);
  return hits.length ? hits[0].object.__entityId : null;
}
// 'fire' is a line-of-sight laser. By DEFAULT it shoots CAMERA-forward (first-person: crosshair =
// screen-center). With a "from" entity id on the input it shoots from that CONTROLLABLE entity's OWN
// line of sight — origin at its head (transform + "eye" height, default 1.4), direction along its
// heading/pitch — so a THIRD-PERSON character aims where IT faces, not where the camera looks. Either
// way it raycasts ALL scene geometry and takes the NEAREST hit, so walls/obstacles occlude for free.
function __shotRay(inp) {                                            // → { origin, dir } or null
  if (inp && inp.from) {
    const ctrl = window.__mojCtrl && window.__mojCtrl.world;
    const e = ctrl && ctrl.byId ? ctrl.byId[inp.from] : null;
    if (!e) return null;
    const p = e.transform.pos, h = e.transform.heading || 0, pit = inp.level ? 0 : (e.transform.pitch || 0);   // level → pure-yaw aim
    const eye = inp.eye != null ? inp.eye : 1.4;
    return { origin: new THREE.Vector3(p[0], p[1], p[2] + eye), dir: new THREE.Vector3(Math.cos(pit) * Math.cos(h), Math.cos(pit) * Math.sin(h), Math.sin(pit)).normalize() };
  }
  return { origin: camera.position.clone(), dir: camera.getWorldDirection(new THREE.Vector3()) };
}
// nearest scene intersection along a ray, started slightly IN FRONT of the origin so a character never
// shoots its own body. Returns { start, hit } (hit is the THREE intersection, or null on a miss).
function __rayHit(ray) {
  const start = ray.origin.clone().add(ray.dir.clone().multiplyScalar(0.6));
  __pickRay.set(start, ray.dir);
  const hits = __pickRay.intersectObjects(scene.children, true);    // recursive: walls/obstacles occlude
  return { start, hit: hits.length ? hits[0] : null };
}
// a brief laser BEAM from the muzzle to where the shot landed (a marker, a wall, or far). A pure
// visual flash OUTSIDE the bus (no determinism impact — the timeout/render is not the tick).
let __beam = null;
function __laserFlash(from, to) {
  if (!__beam) { __beam = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xff5a4d, transparent: true, opacity: 0.9 })); __beam.frustumCulled = false; scene.add(__beam); }
  __beam.geometry.setFromPoints([from, to]);
  __beam.visible = true;
  clearTimeout(__beam.__t); __beam.__t = setTimeout(() => { if (__beam) __beam.visible = false; }, 90);
}
// aim SIGHT: a fixed screen-center reticle for CAMERA-fire; a world-space dot at the character's
// line-of-sight point for from-fire (updated each frame in stepEvents so you SEE where it aims).
const __fireInputs = (EVENTS.inputs || []).filter((i) => i && i.on === 'fire');
if (__fireInputs.some((i) => !i.from)) {
  const __sight = document.createElement('div');
  __sight.style.cssText = 'position:fixed;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:#ff5a4d;box-shadow:0 0 8px 2px rgba(255,90,77,.85),0 0 0 1px rgba(255,255,255,.55);pointer-events:none;z-index:11';
  document.body.appendChild(__sight);
}
const __losInput = __fireInputs.find((i) => i.from);
let __aimDot = null;
if (__losInput) { __aimDot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe000 })); __aimDot.frustumCulled = false; scene.add(__aimDot); }   // bright yellow reticle, distinct from red targets
function __updateAim() {   // park the aim dot where the character is looking (nearest hit, or far along the ray)
  if (!__aimDot || !__losInput) return;
  const ray = __shotRay(__losInput); if (!ray) return;
  const { start, hit } = __rayHit(ray);
  __aimDot.position.copy(hit ? hit.point : start.clone().add(ray.dir.clone().multiplyScalar(40)));
}
(EVENTS.inputs || []).forEach((inp) => {
  if (!inp || !inp.emit) return;
  if (inp.on === 'key') window.addEventListener('keydown', (ev) => { if (!inp.key || ev.key === inp.key) __inputQueue.push(Object.assign({}, inp.emit)); });
  else if (inp.on === 'pointer') renderer.domElement.addEventListener('pointerdown', () => __inputQueue.push(Object.assign({}, inp.emit)));
  // 'pick' raycasts the marker the pointer is over and stamps its id into the event (default 'target').
  else if (inp.on === 'pick') renderer.domElement.addEventListener('pointerdown', (ev) => {
    const id = __pickEntity(ev);
    if (id == null) return;                     // a miss is no deed — score stays tied to a real hit
    const e = Object.assign({}, inp.emit); e[inp.into || 'target'] = id; __inputQueue.push(e);
  });
  // 'fire' is the LOS laser (left-click): raycast camera-forward, flash a beam to wherever it landed,
  // and stamp the hit target. An occluded or missed shot flashes but is no deed — same "score stays
  // tied to a real hit" discipline as pick.
  else if (inp.on === 'fire') renderer.domElement.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;                // left-click only
    const ray = __shotRay(inp); if (!ray) return;
    const { start, hit } = __rayHit(ray);
    __laserFlash(start, hit ? hit.point : start.clone().add(ray.dir.clone().multiplyScalar(100)));   // beam, hit or miss
    const id = hit && hit.object.__entityId != null ? hit.object.__entityId : null;
    if (id == null) return;
    const e = Object.assign({}, inp.emit); e[inp.into || 'target'] = id; __inputQueue.push(e);
  });
});
function __ensureMarker(e) {
  if (__markerMeshes[e.id]) return __markerMeshes[e.id];
  const r = Number.isFinite(e.radius) ? e.radius : 0.4;
  const col = e.color != null ? new THREE.Color(e.color) : new THREE.Color(__MARKER_COLOR);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), new THREE.MeshBasicMaterial({ color: col }));
  mesh.__entityId = e.id;
  scene.add(mesh);
  __markerMeshes[e.id] = mesh;
  return mesh;
}
// optional HUD: bind vars → an on-screen readout (so the score/timer is visible while you play).
let __hud = null;
if (Array.isArray(EVENTS.hud) && EVENTS.hud.length) {
  __hud = document.createElement('div');
  __hud.style.cssText = 'position:fixed;top:12px;left:12px;font:600 18px system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.45);padding:8px 14px;border-radius:8px;z-index:10;letter-spacing:.5px';
  document.body.appendChild(__hud);
}
function __syncHud() { if (__hud) __hud.textContent = EVENTS.hud.map((h) => (h.label ? h.label + ': ' : '') + (__busState.vars[h.var] != null ? __busState.vars[h.var] : 0)).join(' '); }
// Read-only projection of bus ENTITY state onto meshes. The bus decides WHAT is true; this shows it.
// Physics body PROXIES (Phase 5b link) are skipped — they already render via the physics channel.
function __syncBus() {
  for (const e of __busState.entities) {
    if (__busState._linked && __busState._linked[e.id]) continue;
    const m = __ensureMarker(e);
    m.position.set(e.position[0], e.position[1], e.position[2]);
    m.visible = e.on !== false;   // toggle flips .on → hide/show; default shown
  }
}
// Phase 5b bridge: register physics bodies so reactions can impulse/move them, then seed any
// one-shot startup events (e.g. arming a rig saga). Runs once, before the loop (physics block ran
// first, so window.__mojSim is already present).
if (window.__mojSim) __BUS.linkPhysics(__busState, window.__mojSim.state);
if (EVENTS.initial) __BUS.processEvents(__busState, EVENTS.initial);
let __busPrev, __busPrevT = 0, __zonePrev;
stepEvents = (t) => {
  const dtSec = __busPrevT ? Math.min((t - __busPrevT) / 1000, 0.05) : 0; __busPrevT = t;  // frame 0 → dt 0
  if (window.__mojSim) __BUS.syncFromBodies(__busState, window.__mojSim.state);   // fresh body reads
  const incoming = [];
  while (__inputQueue.length) incoming.push(__inputQueue.shift());   // input → bus events this frame
  if (window.__mojSim) {            // physics FACTS → events (edge-triggered), only if physics is live
    const d = __BUS.deriveEvents(window.__mojSim.state, __busPrev, __SOURCES);
    __busPrev = d.prev;
    for (const ev of d.events) incoming.push(ev);
  }
  if (window.__mojCtrl) {           // ZONE FACTS → enter/exit events for the walking player (M0-pre)
    const z = __BUS.deriveZoneEvents(window.__mojCtrl.world.entities, __zonePrev, __SOURCES);
    __zonePrev = z.prev;
    for (const ev of z.events) incoming.push(ev);
  }
  if (incoming.length) __BUS.processEvents(__busState, incoming);
  __watchFix();                                      // conceptual predicates (vars/entities/counts)
  const ticks = __BUS.tickTimers(__busState, dtSec); // recurring world heartbeats (spawners, countdowns)
  if (ticks.length) __BUS.processEvents(__busState, ticks);
  const timed = __BUS.stepTime(__busState, dtSec);   // one-shot sequence awaits
  if (timed.length) __BUS.processEvents(__busState, timed);
  __watchFix();                                      // re-check after timer effects settle
  if (window.__mojSim) __BUS.syncToBodies(__busState, window.__mojSim.state);     // apply impulse/move back
  if (window.__mojCtrl) __BUS.syncToCtrl(__busState, window.__mojCtrl.world.entities); // apply respawn/teleport warps
  __syncBus(); __syncHud(); __updateAim();
};
// loop watches→reactions to a fixed point so a reaction's var write can trip a watch the same frame.
function __watchFix() { let g = 0; while (g++ < 8) { const w = __BUS.watchEvents(__busState); if (!w.length) break; __BUS.processEvents(__busState, w); } }
window.__mojBus = { bus: __BUS, state: __busState, markers: __markerMeshes, sync: __syncBus };`;
}
