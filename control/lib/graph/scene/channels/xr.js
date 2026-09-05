import { safeJson } from '../emit-util.js';

// WebXR immersive-vr (opt-in via emitThreeWorld({ xr }) — interchange-seams.plan.md seam 7).
// A Quest browser or Vision Pro Safari walks the SAME scene with no engine: the page already
// drives renderer.setAnimationLoop (the XR-compatible loop), so this block adds the session
// handshake, a RIG that carries the y-up XR reference space inside the z-up world, thumbstick
// locomotion on the gaze heading, snap turn, and the ground snap borrowed from the walk channel
// when one is emitted (typeof-guarded — orbit-only worlds still ride the XR.eye fallback).
// No `three/examples` import (the emitted page must stay self-contained): the enter button is
// inline. Bespoke block, spliced after the runtime channels; absent `xr` ⇒ NOT emitted, so every
// existing World stays byte-identical (emit-channels.char.test.js).
//
// Frame: WebXR's reference space is y-up with -Z forward; mojulo is z-up. The rig quaternion is
// Qz(yaw − π/2) · Qx(+π/2): local +Y → world +Z, local −Z → world heading `yaw`. three composes
// the headset pose under the rig's matrixWorld, so moving/turning the rig moves/turns the player.
// Honest limits: no wall collision in XR (v1), overlays (fog/effects) are camera-fed per eye by
// three but were tuned for the mono view.
// `cfg`: { eye (fallback standing eye height, world units), speed (world units / s), snap (radians) }.
export function xrModeScript(cfg) {
  return `
// --- WebXR immersive-vr (opt-in): the z-up rig carries the y-up XR space through the same scene ---
const XR = ${safeJson(cfg)};
let __xrOn = false, __xrRig = null, __xrYaw = 0, __xrSnapCool = 0, __xrSaved = null;
const __xrTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
function __xrSetYaw(rig, yaw){ rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), yaw - Math.PI / 2).multiply(__xrTilt); }
// world-XY heading of the headset gaze (falls back to the rig yaw when looking straight up/down)
function __xrHeading(){
  const d = new THREE.Vector3(); renderer.xr.getCamera().getWorldDirection(d);
  return Math.hypot(d.x, d.y) > 1e-4 ? Math.atan2(d.y, d.x) : __xrYaw;
}
function __xrExit(){
  if (!__xrOn) return;
  __xrOn = false;
  __xrRig.remove(camera); scene.remove(__xrRig); __xrRig = null;
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
  walkOn = false; controls.enabled = false;
  if (document.pointerLockElement) document.exitPointerLock();
  __xrOn = true; __xrBtn.classList.add('on');
  session.addEventListener('end', __xrExit);
  await renderer.xr.setSession(session);
}
// per-frame: left stick moves on the gaze heading (stick forward = negative y), right stick snap-turns
// the rig about world +Z, then the rig's feet snap to the floor beneath (walk channel's probe).
function __xrStep(dt){
  const session = renderer.xr.getSession(); if (!session || !__xrRig) return;
  let mx = 0, my = 0, turn = 0;
  for (const src of session.inputSources) {
    const gp = src.gamepad; if (!gp || !gp.axes || gp.axes.length < 2) continue;
    const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0], ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1];
    if (src.handedness === 'right') turn = ax; else { mx = ax; my = ay; }
  }
  __xrSnapCool = Math.max(0, __xrSnapCool - dt);
  if (Math.abs(turn) > 0.7 && __xrSnapCool <= 0) { __xrYaw -= Math.sign(turn) * XR.snap; __xrSetYaw(__xrRig, __xrYaw); __xrSnapCool = 0.3; }
  else if (Math.abs(turn) < 0.3) __xrSnapCool = 0;
  const dead = 0.15;
  if (Math.abs(mx) > dead || Math.abs(my) > dead) {
    const h = __xrHeading(), v = XR.speed * dt;
    const fx = Math.cos(h), fy = Math.sin(h), rx = Math.sin(h), ry = -Math.cos(h);
    __xrRig.position.x += (-my * fx + mx * rx) * v;
    __xrRig.position.y += (-my * fy + mx * ry) * v;
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
