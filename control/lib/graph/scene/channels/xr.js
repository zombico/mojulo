import { safeJson } from '../emit-util.js';
import { buildControlsKernel } from '../../controls/controls-kernel.js';
import { buildXrDriver } from '../../controls/xr-driver.js';
import { DEVICES } from '../../controls/devices.js';
import { SCHEMES } from '../../controls/schemes.js';

// WebXR immersive-vr (opt-in via emitThreeWorld({ xr }) — interchange-seams.plan.md seam 7).
// A Quest browser or Vision Pro Safari walks the SAME scene with no engine: the page already
// drives renderer.setAnimationLoop (the XR-compatible loop), so this block adds the session
// handshake, a RIG that carries the y-up XR reference space inside the z-up world, two-stick
// locomotion, and the ground snap borrowed from the walk channel when one is emitted
// (typeof-guarded — orbit-only worlds still ride the XR.eye fallback).
// No `three/examples` import (the emitted page must stay self-contained): the enter button is
// inline. Bespoke block, spliced after the runtime channels; absent `xr` ⇒ NOT emitted, so every
// existing World stays byte-identical (emit-channels.char.test.js).
//
// The sticks are the pilot scheme's `xr` bindings (controls/schemes.js), read through the controls
// kernel and the xr family's driver (controls/xr-driver.js), so the headset and the scheme's
// controls card say the same thing and `xr.bind` remaps them: the left thumbstick walks and
// strafes, the right one turns, so the player never has to turn their head to turn.
//   - FEET, BODY, HEAD (`move: 'body'`, the default: the seated, couch action game): the feet go where
//     the body points (the left stick: forward, back, and sideways to it), the body turns only on the
//     right stick, and the head is a pure camera, looking anywhere without steering. The body is the
//     rig: its yaw is the body's, so "forward" is the rig yaw. Standing players who turn their whole
//     body by hand want the head to steer instead: `'latch'` takes the gaze when a push begins and
//     holds it (a glance aside mid-walk does not bend the path), `'head'` re-reads the gaze every
//     frame, `'hand'` walks where the moving hand's controller points. Every mode goes straight: the
//     stick is shaped (a radial dead zone, a near-cardinal push snapped onto the cardinal).
//   - TURNS IN PLACE: smooth (`turn: 'smooth'`, `turnSpeed` deg/s) or snap (`snap` deg), about the
//     head, not the play-space origin the rig hangs from (turning about the origin swings a player
//     standing off-centre around a circle).
//
// Frame: WebXR's reference space is y-up with -Z forward; mojulo is z-up. The rig quaternion is
// Qz(yaw − π/2) · Qx(+π/2): local +Y → world +Z, local −Z → world heading `yaw`. three composes
// the headset pose under the rig's matrixWorld, so moving/turning the rig moves/turns the player.
// Honest limits: no wall collision in XR (v1); a game's hero is not driven in the session (the
// rig replaces the controllable step); overlays (fog/effects) are camera-fed per eye by three but
// were tuned for the mono view.

const MOVES = ['body', 'latch', 'head', 'hand'];
const TURNS = ['smooth', 'snap'];
// the pilot scheme's locomotion: what the headset reads
const LOCO = ['moveForward', 'moveBack', 'strafeLeft', 'strafeRight', 'turnLeft', 'turnRight'];

const num = (v, d) => (Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// `xr`: true | { eye, speed, turn, snap (deg), turnSpeed (deg/s), move, dead, axial (deg), bind }. `snap` given
// without `turn` means snap turning (what `{ snap }` always meant). `walk` is the page's walk config (its speed
// halved is the headset's: a walk speed is tuned for a sprint across a monitor). Absent `xr` ⇒ null.
export function xrConfig(xr, walk) {
  if (!xr) return null;
  const k = typeof xr === 'object' ? xr : {};
  const turn = TURNS.includes(k.turn) ? k.turn : (Number.isFinite(k.snap) ? 'snap' : 'smooth');
  const K = buildControlsKernel();
  const B = K.resolve(SCHEMES.pilot, { xr: DEVICES.xr }, k.bind && typeof k.bind === 'object' ? { xr: k.bind } : null);
  const bind = Object.fromEntries(LOCO.map((id) => [id, B.bind.xr[id]]));
  return {
    eye: num(k.eye, 1.6),
    speed: num(k.speed, walk ? walk.speed * 0.5 : 3),
    turn,
    snap: num(k.snap, 30) * Math.PI / 180,
    turnSpeed: num(k.turnSpeed, 120) * Math.PI / 180,
    move: MOVES.includes(k.move) ? k.move : 'body',
    dead: clamp(num(k.dead, 0.2), 0, 0.9),
    axial: clamp(num(k.axial, 12), 0, 44) * Math.PI / 180,
    bind: { xr: bind },
  };
}

// `?xr=` on the live /world route: '1' / 'true' adds the entry with the manifest's own `xr` (or the defaults), '0' /
// 'false' drops it, and words pick the modes for a headset A/B without a re-mint: `?xr=snap`, `?xr=smooth,hand`,
// `?xr=head` (any of body | latch | head | hand, smooth | snap, comma-separated). No param ⇒ the manifest's `xr` as is.
export function xrFromParam(param, own) {
  if (param == null) return own || null;
  const p = String(param).trim().toLowerCase();
  if (p === '0' || p === 'false') return null;
  const base = own && typeof own === 'object' ? { ...own } : {};
  for (const w of p.split(',').map((s) => s.trim())) {
    if (TURNS.includes(w)) base.turn = w;
    else if (MOVES.includes(w)) base.move = w;
  }
  return Object.keys(base).length ? base : (own || true);
}

export function xrModeScript(cfg) {
  return `
// --- WebXR immersive-vr (opt-in): the z-up rig carries the y-up XR space through the same scene ---
const XR = ${safeJson(cfg)};
// a static copy (a download, a page on a static host) takes the mode words the live route does: ?xr=snap,hand
try { for (const w of (new URLSearchParams(location.search).get('xr') || '').toLowerCase().split(',')) { if (w === 'smooth' || w === 'snap') XR.turn = w; else if (w === 'body' || w === 'latch' || w === 'head' || w === 'hand') XR.move = w; } } catch (e) { /* no location */ }
const __XRK = (${buildControlsKernel.toString()})();
const __XRV = (${buildXrDriver.toString()})();
const __XRD = ${safeJson({ xr: DEVICES.xr })};
let __xrOn = false, __xrRig = null, __xrYaw = 0, __xrSnapCool = 0, __xrSaved = null, __xrLatch = null;
const __xrTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
const __xrA = new THREE.Vector3(), __xrB = new THREE.Vector3(), __xrQ = new THREE.Quaternion();
// the hand that walks: the one the forward binding names
const __xrHand = (/^(left|right)\\./.exec((XR.bind.xr.moveForward || [])[0] || '') || [0, 'left'])[1];
function __xrSetYaw(rig, yaw){ rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), yaw - Math.PI / 2).multiply(__xrTilt); }
// the frame's viewer pose (rig-local, y-up), or null before the session's first frame
function __xrViewer(){
  const f = renderer.xr.getFrame && renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
  return f && ref ? f.getViewerPose(ref) : null;
}
// world-XY heading of the headset gaze: this frame's viewer orientation carried through the rig, so a right-stick turn
// (which turns the rig) turns "forward" with it; the rig yaw when looking straight up or down, or before a pose
function __xrHeading(){
  const p = __xrViewer(); if (!p) return __xrYaw;
  const o = p.transform.orientation; __xrQ.set(o.x, o.y, o.z, o.w);
  __xrA.set(0, 0, -1).applyQuaternion(__xrQ).applyQuaternion(__xrRig.quaternion);
  return Math.hypot(__xrA.x, __xrA.y) > 0.2 ? Math.atan2(__xrA.y, __xrA.x) : __xrYaw;
}
// world-XY heading of the walking hand's pointing ray ('hand'); the gaze when it points straight up or down
function __xrHandHeading(){
  const s = renderer.xr.getSession(), f = renderer.xr.getFrame && renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
  if (s && f && ref) for (const src of s.inputSources) {
    if (src.handedness !== __xrHand || !src.targetRaySpace) continue;
    const p = f.getPose(src.targetRaySpace, ref); if (!p) break;
    const o = p.transform.orientation; __xrQ.set(o.x, o.y, o.z, o.w);
    __xrA.set(0, 0, -1).applyQuaternion(__xrQ).applyQuaternion(__xrRig.quaternion);
    if (Math.hypot(__xrA.x, __xrA.y) > 0.2) return Math.atan2(__xrA.y, __xrA.x);
    break;
  }
  return __xrHeading();
}
// the head in world space: the frame's viewer pose (rig-local) through the rig; last render's camera without a frame
function __xrHead(out){
  const p = __xrViewer();
  if (p) out.set(p.transform.position.x, p.transform.position.y, p.transform.position.z); else out.copy(camera.position);
  __xrRig.updateMatrixWorld(); return __xrRig.localToWorld(out);
}
// turn the rig by d radians about world +Z through the head, so the player turns where they stand
function __xrTurn(d){
  __xrHead(__xrA);
  __xrYaw += d; __xrSetYaw(__xrRig, __xrYaw);
  __xrHead(__xrB);
  __xrRig.position.x += __xrA.x - __xrB.x; __xrRig.position.y += __xrA.y - __xrB.y;
  if (__xrLatch !== null) __xrLatch += d;
}
function __xrExit(){
  if (!__xrOn) return;
  __xrOn = false;
  __xrRig.remove(camera); scene.remove(__xrRig); __xrRig = null; __xrLatch = null;
  camera.position.copy(__xrSaved.pos); camera.quaternion.copy(__xrSaved.quat);
  controls.enabled = __xrSaved.controls; walkOn = __xrSaved.walkOn; __xrSaved = null;
  __xrBtn.classList.remove('on');
}
async function __xrEnter(){
  if (__xrOn) { const s = renderer.xr.getSession(); if (s) s.end(); return; }
  let session;
  try { session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }); }
  catch (e) { __xrBtn.title = 'WebXR session refused: ' + (e && e.message ? e.message : e); return; }
  renderer.xr.setReferenceSpaceType('local-floor');
  // pose the rig at the current vantage: feet on the floor beneath the eye when the walk channel's
  // ground probe exists, else XR.eye below the camera; heading = the camera's current look direction.
  const look = new THREE.Vector3(); camera.getWorldDirection(look);
  __xrYaw = Math.hypot(look.x, look.y) > 1e-4 ? Math.atan2(look.y, look.x) : 0;
  const g = (typeof groundBelow === 'function') ? groundBelow(camera.position.x, camera.position.y, camera.position.z + 1e-3) : null;
  __xrRig = new THREE.Group();
  __xrRig.position.set(camera.position.x, camera.position.y, g != null ? g : camera.position.z - XR.eye);
  __xrSetYaw(__xrRig, __xrYaw);
  scene.add(__xrRig);
  __xrSaved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), controls: controls.enabled, walkOn };
  __xrRig.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity();
  walkOn = false; controls.enabled = false; __xrLatch = null; __xrSnapCool = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  __xrOn = true; __xrBtn.classList.add('on');
  session.addEventListener('end', __xrExit);
  await renderer.xr.setSession(session);
}
// per-frame: the right stick turns (smooth or snap, about the head), the left stick walks and strafes on the
// body / latched / gaze / hand heading, then the rig's feet snap to the floor beneath (walk channel's probe).
function __xrStep(dt){
  const session = renderer.xr.getSession(); if (!session || !__xrRig) return;
  const rd = __XRV.xrRead(session.inputSources, __XRD);
  const m = __XRV.stick(__XRK.axis(XR, 'strafeRight', 'strafeLeft', 'xr', rd), __XRK.axis(XR, 'moveForward', 'moveBack', 'xr', rd), XR.dead, XR.axial);
  const walking = !!(m[0] || m[1]);
  // latch before turning, so this frame's turn turns the latched heading too
  if (!walking) __xrLatch = null;
  else if (XR.move === 'latch' && __xrLatch === null) __xrLatch = __xrHeading();
  const turn = __XRK.axis(XR, 'turnRight', 'turnLeft', 'xr', rd);
  if (XR.turn === 'snap') {
    __xrSnapCool = Math.max(0, __xrSnapCool - dt);
    if (Math.abs(turn) > 0.7 && __xrSnapCool <= 0) { __xrTurn(-Math.sign(turn) * XR.snap); __xrSnapCool = 0.3; }
    else if (Math.abs(turn) < 0.3) __xrSnapCool = 0;
  } else {
    const t = __XRV.stick(turn, 0, XR.dead, 0)[0];
    if (t) __xrTurn(-t * XR.turnSpeed * dt);
  }
  if (walking) {
    const h = XR.move === 'body' ? __xrYaw : XR.move === 'latch' ? __xrLatch : XR.move === 'hand' ? __xrHandHeading() : __xrHeading();
    const v = XR.speed * dt, fx = Math.cos(h), fy = Math.sin(h), rx = Math.sin(h), ry = -Math.cos(h);
    __xrRig.position.x += (m[1] * fx + m[0] * rx) * v;
    __xrRig.position.y += (m[1] * fy + m[0] * ry) * v;
  }
  if (typeof groundBelow === 'function') {
    const g = groundBelow(__xrRig.position.x, __xrRig.position.y, __xrRig.position.z + XR.eye);
    if (g != null) __xrRig.position.z = g;
  }
}
renderer.xr.enabled = true;
const __xrBtn = document.createElement('button'); __xrBtn.textContent = 'vr'; __xrBtn.hidden = true;
__xrBtn.onclick = () => { __xrEnter(); };
hud.appendChild(__xrBtn);
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { __xrBtn.hidden = !ok; if (!ok) __xrBtn.title = 'no immersive-vr device'; }).catch(() => {});
}
`;
}
