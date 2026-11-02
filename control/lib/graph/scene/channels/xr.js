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
//   - FEET, BODY, HEAD: the feet go where the body points (the left stick: forward, back, and sideways
//     to it), and the head is a camera on top. What turns the body is the stance:
//       `move: 'seated'` (the default, the couch action game): the right stick alone turns the body (the
//       rig: forward is the rig yaw); the head looks anywhere without steering.
//       `move: 'standing'` (room scale, a game that cares how the player physically turns): the body is
//       the player's torso, turned by turning. WebXR tracks no torso, so it is estimated the way an
//       avatar's is: the point between the two controllers, held out in front, is in front of the
//       chest (followed fast); with the hands down, the body catches up to where the head has faced
//       for about a second (a glance barely moves it); and the head never sits more than `neck` (50°)
//       off it (a bigger turn drags the body along). The right stick snap-turns on top (a play space
//       and a cable run out); `turn: 'off'` leaves turning to the feet.
//     The head-steered modes stay for comparison: `'latch'` takes the gaze when a push begins and holds
//     it, `'head'` re-reads the gaze every frame, `'hand'` walks where the moving hand's controller
//     points. Every mode goes straight: the stick is shaped (a radial dead zone, a near-cardinal push
//     snapped onto the cardinal).
//   - TURNS IN PLACE: smooth (`turn: 'smooth'`, `turnSpeed` deg/s; seated's default) or snap (`snap` deg;
//     standing's default), about the head, not the play-space origin the rig hangs from (turning about
//     the origin swings a player standing off-centre around a circle).
//
// Frame: WebXR's reference space is y-up with -Z forward; mojulo is z-up. The rig quaternion is
// Qz(yaw − π/2) · Qx(+π/2): local +Y → world +Z, local −Z → world heading `yaw`. three composes
// the headset pose under the rig's matrixWorld, so moving/turning the rig moves/turns the player.
// THE GAME IN THE HEADSET (`ctrl`: the page has a controllable channel with a pilot; emitted only then). The session
// drives the PILOT (the world's pilot, else the camera's target) instead of walking the rig alone, so the game, its
// foes, its mechanics and its contract run in the headset:
//   - the controllers are a PAD: read through the pilot scheme's `xr` bindings into the shape the page's pad read gives
//     (moveX, moveY, fire, jump, interact …), handed to the controllable's input read (`__xrCtl.pad`), so every press
//     edge, the weapon and the interact count go the way they go for a gamepad;
//   - ON FOOT the left stick walks and strafes on the BODY (the stance's: the rig yaw seated, the torso standing, the
//     latched, gaze or hand heading in those modes): the pilot's heading is the body's and its pitch the head's
//     (`__xrCtl.input`); a world-move pilot (`move: 'world'`) gets the same vector in its camera's frame, a lane pilot
//     runs its lane on the stick's X; a VEHICLE keeps the pad's own semantics and carries the rig (yaw and all);
//   - the head's own STEP in the play space moves the pilot, each axis kept out of the world's colliders (a wall holds
//     the body and the view is pushed back), then the rig is placed under the pilot: the head over its feet, the floor
//     at them. The kernel steps, the camera entity stands down (three poses the camera from the headset), and the
//     pilot's body is hidden (first person).
// A page without a pilot walks as above. Absent `ctrl`, none of this is emitted.
// Honest limits: no wall collision in the free walk (v1); the page's HUD is DOM and the headset does not show it;
// overlays (fog/effects) are camera-fed per eye by three but were tuned for the mono view.

const MOVES = ['seated', 'standing', 'latch', 'head', 'hand'];
const TURNS = ['smooth', 'snap', 'off'];
// the pilot scheme's locomotion: what the headset reads
const LOCO = ['moveForward', 'moveBack', 'strafeLeft', 'strafeRight', 'turnLeft', 'turnRight'];

const num = (v, d) => (Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// `xr`: true | { eye, speed, move, turn, snap (deg), turnSpeed (deg/s), neck (deg), reach (m), dead, axial (deg), bind }.
// `turn` defaults to smooth seated and snap standing; `snap` given without `turn` means snap turning (what `{ snap }`
// always meant). `walk` is the page's walk config (its speed
// halved is the headset's: a walk speed is tuned for a sprint across a monitor). `ctrl`: the page plays a game (its
// pilot reads every action the pilot scheme binds on the xr family, not only the locomotion). Absent `xr` ⇒ null.
export function xrConfig(xr, walk, { ctrl = false } = {}) {
  if (!xr) return null;
  const k = typeof xr === 'object' ? xr : {};
  const move = MOVES.includes(k.move) ? k.move : 'seated';
  const turn = TURNS.includes(k.turn) ? k.turn : (Number.isFinite(k.snap) || move === 'standing' ? 'snap' : 'smooth');
  const K = buildControlsKernel();
  const B = K.resolve(SCHEMES.pilot, { xr: DEVICES.xr }, k.bind && typeof k.bind === 'object' ? { xr: k.bind } : null);
  const ids = ctrl ? Object.keys(B.bind.xr).filter((id) => LOCO.includes(id) || (B.bind.xr[id] || []).length) : LOCO;
  const bind = Object.fromEntries(ids.map((id) => [id, B.bind.xr[id]]));
  return {
    eye: num(k.eye, 1.6),
    speed: num(k.speed, walk ? walk.speed * 0.5 : 3),
    move,
    turn,
    snap: num(k.snap, 30) * Math.PI / 180,
    turnSpeed: num(k.turnSpeed, 120) * Math.PI / 180,
    neck: clamp(num(k.neck, 50), 10, 120) * Math.PI / 180,
    reach: clamp(num(k.reach, 0.12), 0.02, 0.6),
    dead: clamp(num(k.dead, 0.2), 0, 0.9),
    axial: clamp(num(k.axial, 12), 0, 44) * Math.PI / 180,
    bind: { xr: bind },
  };
}

// `?xr=` on the live /world route: '1' / 'true' adds the entry with the manifest's own `xr` (or the defaults), '0' /
// 'false' drops it, and words pick the modes for a headset A/B without a re-mint: `?xr=standing`, `?xr=seated,snap`,
// `?xr=head` (any of seated | standing | latch | head | hand, smooth | snap | off, comma-separated). A stance word picks
// its own turn unless a turn word is given too. No param ⇒ the manifest's `xr` as is.
export function xrFromParam(param, own) {
  if (param == null) return own || null;
  const p = String(param).trim().toLowerCase();
  if (p === '0' || p === 'false') return null;
  const base = own && typeof own === 'object' ? { ...own } : {};
  const words = p.split(',').map((s) => s.trim());
  for (const w of words) {
    if (TURNS.includes(w)) base.turn = w;
    else if (MOVES.includes(w)) { base.move = w; if (!words.some((x) => TURNS.includes(x))) delete base.turn; }
  }
  return Object.keys(base).length ? base : (own || true);
}

// the game in the headset (`ctrl`): the controllable channel declares `__xrCtl` (null: the page reads its own pad and
// drives its own camera) and reads it in its input read, its camera drive and its body sync (controllable/index.js `xr`)
const CTRL = `// --- the game in the headset: the session drives the pilot, the rig stands under it ---
let __xrHead0 = null, __xrPad0 = null;
// the body the headset plays: the world's pilot, else the camera's target
function __xrPilot(){
  const W = __world, t = W.camera && W.camera.rule && W.camera.rule.target;
  return (W.pilotId && W.byId[W.pilotId]) || (t && W.byId[t]) || null;
}
const __xrVehicle = (e) => !!(e.rule && (e.rule.type === 'drive' || e.rule.type === 'fly'));
// the head, rig-local (y-up), or null before a pose
function __xrHeadLocal(){ const p = __xrViewer(); return p ? { x: p.transform.position.x, z: p.transform.position.z } : null; }
// the head's pitch (radians, + up): its forward's rise, the rig only turning about the world's up
function __xrPitch(){
  const p = __xrViewer(); if (!p) return 0;
  const o = p.transform.orientation; __xrQ.set(o.x, o.y, o.z, o.w); __xrB.set(0, 0, -1).applyQuaternion(__xrQ);
  return Math.asin(Math.max(-1, Math.min(1, __xrB.y)));
}
// the body's heading, as the stance says (the walk's own headings)
function __xrBody(){
  return XR.move === 'standing' ? __xrYaw + (__xrTorso || 0) : XR.move === 'latch' ? (__xrLatch !== null ? __xrLatch : __xrYaw)
    : XR.move === 'hand' ? __xrHandHeading() : XR.move === 'head' ? __xrHeading() : __xrYaw;
}
// the controllers as the page's pad: the pilot scheme's xr bindings, the left stick shaped as the walk shapes it
function __xrPadRead(){
  const s = renderer.xr.getSession(), src = s ? s.inputSources : [], rd = __XRV.xrRead(src, __XRD), ra = __XRV.xrRead(src, __XRD, true);
  const m = __XRV.stick(__XRK.axis(XR, 'strafeRight', 'strafeLeft', 'xr', rd), __XRK.axis(XR, 'moveForward', 'moveBack', 'xr', rd), XR.dead, XR.axial);
  const h = (id) => __XRK.held(XR, id, 'xr', rd);
  __xrPad0 = {
    moveX: m[0], moveY: m[1], lookX: 0, lookY: 0,
    fire: h('fire'), boost: h('boost'), rt: __XRK.value(XR, 'fire', 'xr', ra), lt: __XRK.value(XR, 'boost', 'xr', ra),
    tackle: h('tackle'), kneel: h('kneel'), jump: h('jump'), cycle: false, slot: 0,
    swap: h('swapSuit'), ai: h('aiToggle'), lock: h('lock'), transform: h('transform'), interact: h('interact'),
  };
  return __xrPad0;
}
// the input read, finished: on foot the stick walks on the body, the pilot faces the body's way and looks where the head
// looks (the kernel turns nothing itself); a vehicle drives as the pad drives it
function __xrInput(inp){
  const e = __xrPilot(), p = __xrPad0;
  if (!e || !p || __xrVehicle(e)) return inp;
  const r = e.rule || {}, h = __xrBody();
  inp.turn = 0; inp.lookDX = 0; inp.lookDY = 0;
  if (r.move === 'lane') { inp.forward = 0; inp.strafe = p.moveX; }
  else if (r.move === 'world') {
    // the body's vector, in the frame of the camera the world moves by
    const my = r.moveYaw !== undefined ? r.moveYaw : Math.PI / 2;
    const wx = Math.cos(h) * p.moveY + Math.sin(h) * p.moveX, wy = Math.sin(h) * p.moveY - Math.cos(h) * p.moveX;
    inp.forward = wx * Math.cos(my) + wy * Math.sin(my); inp.strafe = wx * Math.sin(my) - wy * Math.cos(my);
  } else { inp.forward = p.moveY; inp.strafe = p.moveX; e.transform.heading = h; }
  e.transform.pitch = __xrPitch();
  return inp;
}
// a step of the head moves the pilot, an axis at a time, never into a collider (one whose top is past a step above the
// feet): the body stays out of the wall and the view is pushed back
function __xrShift(e, dx, dy){
  const r = e.rule || {}, p = e.transform.pos, rad = r.collideRadius || 0.3, foot = p[2] - (r.eye || 0), top = foot + (r.collideHeight || 1.7);
  const free = (x, y) => {
    for (const c of (__world.colliders || [])) if (x > c.min[0] - rad && x < c.max[0] + rad && y > c.min[1] - rad && y < c.max[1] + rad && top > c.min[2] && c.max[2] > foot + (r.step || 0.3)) return false;
    return true;
  };
  if (free(p[0] + dx, p[1])) p[0] += dx;
  if (free(p[0], p[1] + dy)) p[1] += dy;
}
// the rig under the pilot: the head (rig-local L) over its feet, the floor at them; a vehicle carries the rig's yaw too
function __xrPlace(e, L){
  const p = e.transform.pos, foot = p[2] - ((e.rule && e.rule.eye) || 0);
  if (__xrVehicle(e)) { __xrYaw = e.transform.heading || 0; __xrSetYaw(__xrRig, __xrYaw); }
  __xrA.set(L ? L.x : 0, 0, L ? L.z : 0).applyQuaternion(__xrRig.quaternion);
  __xrRig.position.set(p[0] - __xrA.x, p[1] - __xrA.y, foot);
}
function __xrPlay(dt){
  const e = __xrPilot();
  if (!e) return;
  const L = __xrHeadLocal();
  if (L && __xrHead0 && !__xrVehicle(e)) {
    __xrA.set(L.x - __xrHead0.x, 0, L.z - __xrHead0.z).applyQuaternion(__xrRig.quaternion);   // the step, in the world
    if (__xrA.x || __xrA.y) __xrShift(e, __xrA.x, __xrA.y);
  }
  __xrHead0 = L;
  stepControllable(dt);
  __xrPlace(e, L);
}
`;

export function xrModeScript(cfg, { ctrl = false } = {}) {
  return `
// --- WebXR immersive-vr (opt-in): the z-up rig carries the y-up XR space through the same scene ---
const XR = ${safeJson(cfg)};
// a static copy (a download, a page on a static host) takes the mode words the live route does: ?xr=snap,hand
try {
  const ws = (new URLSearchParams(location.search).get('xr') || '').toLowerCase().split(',');
  const t = ws.find((w) => w === 'smooth' || w === 'snap' || w === 'off'), m = ws.find((w) => ['seated', 'standing', 'latch', 'head', 'hand'].includes(w));
  if (m) { XR.move = m; XR.turn = m === 'standing' ? 'snap' : 'smooth'; }
  if (t) XR.turn = t;
} catch (e) { /* no location */ }
const __XRK = (${buildControlsKernel.toString()})();
const __XRV = (${buildXrDriver.toString()})();
const __XRD = ${safeJson({ xr: DEVICES.xr })};
let __xrOn = false, __xrRig = null, __xrYaw = 0, __xrSnapCool = 0, __xrSaved = null, __xrLatch = null, __xrTorso = null;
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
// standing: the torso's yaw inside the play space (rig-local, about +Y, 0 = the space's -Z), estimated each frame
const __xrWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function __xrLocalYaw(o){
  __xrQ.set(o.x, o.y, o.z, o.w); __xrB.set(0, 0, -1).applyQuaternion(__xrQ);
  return Math.hypot(__xrB.x, __xrB.z) > 0.2 ? Math.atan2(-__xrB.x, -__xrB.z) : null;
}
function __xrStance(dt){
  const p = __xrViewer(); if (!p) return;
  const hy = __xrLocalYaw(p.transform.orientation);
  if (__xrTorso === null) { __xrTorso = hy !== null ? hy : 0; return; }
  // the hands: the point between the two controllers, held out in front of the head, is in front of the chest
  let hands = null;
  const f = renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace(), s = renderer.xr.getSession();
  if (f && ref && s) {
    let n = 0, mx = 0, mz = 0;
    for (const src of s.inputSources) {
      if (src.handedness !== 'left' && src.handedness !== 'right') continue;
      const sp = src.gripSpace || src.targetRaySpace, q = sp ? f.getPose(sp, ref) : null;
      if (q) { mx += q.transform.position.x; mz += q.transform.position.z; n++; }
    }
    const vx = mx / 2 - p.transform.position.x, vz = mz / 2 - p.transform.position.z;
    if (n === 2 && Math.hypot(vx, vz) > XR.reach) hands = Math.atan2(-vx, -vz);
  }
  const goal = hands !== null ? hands : hy, rate = hands !== null ? 8 : 1;
  if (goal !== null) __xrTorso += __xrWrap(goal - __xrTorso) * (1 - Math.exp(-rate * dt));
  if (hy !== null) { const d = __xrWrap(hy - __xrTorso); if (Math.abs(d) > XR.neck) __xrTorso += d - Math.sign(d) * XR.neck; }
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
  __xrBtn.classList.remove('on');${ctrl ? `
  __xrCtl = null; __xrHead0 = null; __xrPad0 = null;` : ''}
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
  walkOn = false; controls.enabled = false; __xrLatch = null; __xrSnapCool = 0; __xrTorso = null;
  if (document.pointerLockElement) document.exitPointerLock();
  __xrOn = true; __xrBtn.classList.add('on');${ctrl ? `
  // a page with a pilot: the session plays the game (the body faces the pilot's way, the rig stands under it)
  { const e = __xrPilot(); if (e) { __xrYaw = e.transform.heading || 0; __xrSetYaw(__xrRig, __xrYaw); __xrHead0 = null; __xrPlace(e, null); __xrCtl = { pad: __xrPadRead, input: __xrInput, hides: (b) => b === __xrPilot() }; } }` : ''}
  session.addEventListener('end', __xrExit);
  await renderer.xr.setSession(session);
}
// per-frame: standing estimates the torso, the right stick turns (smooth or snap, about the head), the left stick walks
// and strafes on the body (seated: the rig; standing: the rig and the torso in it) / latched / gaze / hand heading, then the rig's feet snap to the floor beneath (walk channel's probe).
function __xrStep(dt){
  const session = renderer.xr.getSession(); if (!session || !__xrRig) return;
  const rd = __XRV.xrRead(session.inputSources, __XRD);
  if (XR.move === 'standing') __xrStance(dt);
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
  } else if (XR.turn === 'smooth') {
    const t = __XRV.stick(turn, 0, XR.dead, 0)[0];
    if (t) __xrTurn(-t * XR.turnSpeed * dt);
  }
${ctrl ? `  if (__xrCtl) { __xrPlay(dt); return; }   // the game steps the pilot; the rig follows it
` : ''}  if (walking) {
    const h = XR.move === 'seated' ? __xrYaw : XR.move === 'standing' ? __xrYaw + (__xrTorso || 0) : XR.move === 'latch' ? __xrLatch : XR.move === 'hand' ? __xrHandHeading() : __xrHeading();
    const v = XR.speed * dt, fx = Math.cos(h), fy = Math.sin(h), rx = Math.sin(h), ry = -Math.cos(h);
    __xrRig.position.x += (m[1] * fx + m[0] * rx) * v;
    __xrRig.position.y += (m[1] * fy + m[0] * ry) * v;
  }
  if (typeof groundBelow === 'function') {
    const g = groundBelow(__xrRig.position.x, __xrRig.position.y, __xrRig.position.z + XR.eye);
    if (g != null) __xrRig.position.z = g;
  }
}
${ctrl ? CTRL : ''}renderer.xr.enabled = true;
const __xrBtn = document.createElement('button'); __xrBtn.textContent = 'vr'; __xrBtn.hidden = true;
__xrBtn.onclick = () => { __xrEnter(); };
hud.appendChild(__xrBtn);
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { __xrBtn.hidden = !ok; if (!ok) __xrBtn.title = 'no immersive-vr device'; }).catch(() => {});
}
`;
}
