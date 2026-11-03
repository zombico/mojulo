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
    // (the game's HUD on a panel in the headset, PANEL below: on unless `hud: false`)
    ...(ctrl && k.hud === false ? { hud: false } : {}),
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

// THE HANDS (`hands`: the pilot's figure carries `xrHands`, polygonizer/hero-xr-hands.js): the hero's own hand and digit
// bones, their meshes shared with the body's (no new geometry rides the page), drawn on each controller's grip pose: the
// rest hand carried into the grip space by the bake's grip frame (its centre at the grip's origin, its axes the grip's)
// and the body's scale, the digits posed from their curl tables as the page poses any rig bone (head' + q·(v − restHead),
// nlerp between samples). The controller curls them: the index relaxed → open as the grip closes (a point), then → fist by
// the trigger; the middle, ring and little fingers relaxed → fist by the grip; the thumb to the fist while it rests on a
// thumb button (touched or pressed), eased. A hand with no grip pose this frame is hidden.
const HANDS = `// --- the hero's hands on the controllers ---
const __xrHands = { R: null, L: null }, __xrHONE = new THREE.Vector3(1, 1, 1);
const __xrHQ = new THREE.Quaternion(), __xrHV = new THREE.Vector3(), __xrHW = new THREE.Vector3();
let __xrHandsOf = null;
function __xrHandsDrop(){
  for (const S of ['R', 'L']) { const h = __xrHands[S]; if (h && h.g.parent) h.g.parent.remove(h.g); __xrHands[S] = null; }
  __xrHandsOf = null;
}
function __xrHandsMake(e){
  __xrHandsDrop(); __xrHandsOf = e.id;
  const body = __bodies[e.id], rf = body && body.userData && body.userData.rigFig, X = rf && rf.fig && rf.fig.xrHands;
  if (!X) return;
  const k = body.scale && body.scale.x ? body.scale.x : 1;
  for (const S of ['R', 'L']) {
    const H = X[S]; if (!H) continue;
    const g = new THREE.Group(); g.matrixAutoUpdate = false; g.visible = false;
    const by = {};
    const add = (id) => {
      const bi = rf.fig.bones.findIndex((b) => b.id === id), src = bi >= 0 ? rf.boneMeshes[bi] : null;
      if (!src || !src.geometry) return;
      const m = new THREE.Mesh(src.geometry, src.material); m.matrixAutoUpdate = false; m.frustumCulled = false; m.raycast = function () {};
      g.add(m); by[id] = { m, rest: rf.fig.bones[bi].head };
    };
    add(H.hand); for (const d in H.digits) for (const id of H.digits[d].bones) add(id);
    // what the hand holds: its triangles, last in the hand's part, drawn apart (the same buffers, its own range) and moved
    // from the hero's rest hold to the headset's (the bake's rehold); an indexed part keeps the rest hold in one mesh
    const I = H.item, hb = rf.fig.bones.findIndex((b) => b.id === H.hand), part = hb >= 0 ? rf.fig.parts[hb] : null, src = hb >= 0 ? rf.boneMeshes[hb] : null;
    let item = null;
    if (I && part && src && by[H.hand] && !src.geometry.index && part.faces > I.tris) {
      const first = part.faces - I.tris;
      const span = (a, n) => { const q = new THREE.BufferGeometry(); for (const k in src.geometry.attributes) q.setAttribute(k, src.geometry.attributes[k]); q.setDrawRange(3 * a, 3 * n); return q; };
      by[H.hand].m.geometry = span(0, first);
      item = new THREE.Mesh(span(first, I.tris), src.material); item.matrixAutoUpdate = false; item.frustumCulled = false; item.raycast = function () {};
      const r = I.rehold; item.matrix.set(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11], 0, 0, 0, 1);
      g.add(item);
    }
    // the rest hand into the grip space: the rows its axes, its centre the origin, scaled as the body is
    const G = H.grip, o = G.o, row = (a) => [a[0] * k, a[1] * k, a[2] * k, -k * (a[0] * o[0] + a[1] * o[1] + a[2] * o[2])];
    const x = row(G.x), y = row(G.y), z = row(G.z);
    const inv = new THREE.Matrix4().set(x[0], x[1], x[2], x[3], y[0], y[1], y[2], y[3], z[0], z[1], z[2], z[3], 0, 0, 0, 1);
    __xrRig.add(g);
    __xrHands[S] = { g, by, H, inv, item, thumb: (H.item ? H.poses.grip : H.poses.relaxed).thumb };
  }
}
// a digit at an angle (degrees): its bones from the curl table, a clip's frame-pair nlerp
function __xrDigit(h, d, a){
  const D = h.H.digits[d]; if (!D) return;
  const n = D.bones.length, B = D.b, f = Math.min(1, Math.max(0, (a - D.lo) / (D.hi - D.lo))) * (D.k - 1), i0 = Math.min(D.k - 2, Math.floor(f)), t = f - i0;
  for (let j = 0; j < n; j++) {
    const b = h.by[D.bones[j]]; if (!b) continue;
    const o0 = (i0 * n + j) * 7, o1 = ((i0 + 1) * n + j) * 7;
    const s = (B[o0] * B[o1] + B[o0 + 1] * B[o1 + 1] + B[o0 + 2] * B[o1 + 2] + B[o0 + 3] * B[o1 + 3]) < 0 ? -1 : 1;
    __xrHQ.set(B[o0] + (s * B[o1] - B[o0]) * t, B[o0 + 1] + (s * B[o1 + 1] - B[o0 + 1]) * t, B[o0 + 2] + (s * B[o1 + 2] - B[o0 + 2]) * t, B[o0 + 3] + (s * B[o1 + 3] - B[o0 + 3]) * t).normalize();
    __xrHW.set(b.rest[0], b.rest[1], b.rest[2]).applyQuaternion(__xrHQ);
    __xrHV.set(B[o0 + 4] + (B[o1 + 4] - B[o0 + 4]) * t - __xrHW.x, B[o0 + 5] + (B[o1 + 5] - B[o0 + 5]) * t - __xrHW.y, B[o0 + 6] + (B[o1 + 6] - B[o0 + 6]) * t - __xrHW.z);
    b.m.matrix.compose(__xrHV, __xrHQ, __xrHONE); b.m.matrixWorldNeedsUpdate = true;
  }
}
// a thumb at rest on a thumb button (the stick, A / X, B / Y): touched or pressed
function __xrThumbDown(src, side){
  const X = __XRD.xr.buttons;
  for (const q of src) {
    if (!q || q.handedness !== side || !q.gamepad) continue;
    const bs = q.gamepad.buttons || [];
    for (const i of [X.thumbstick, X.primary, X.secondary]) if (bs[i] && (bs[i].touched || bs[i].pressed)) return true;
  }
  return false;
}
function __xrHandsStep(dt){
  const s = renderer.xr.getSession(), src = s ? s.inputSources : [], f = renderer.xr.getFrame && renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
  const P = __XRV.xrPoses(f, ref, src), ra = __XRV.xrRead(src, __XRD, true);
  for (const S of ['R', 'L']) {
    const h = __xrHands[S]; if (!h) continue;
    const side = S === 'R' ? 'right' : 'left', gp = P[side].grip;
    if (!gp) { h.g.visible = false; continue; }
    h.g.visible = true;
    __xrHV.set(gp.p[0], gp.p[1], gp.p[2]); __xrHQ.set(gp.q[0], gp.q[1], gp.q[2], gp.q[3]);
    h.g.matrix.compose(__xrHV, __xrHQ, __xrHONE).multiply(h.inv); h.g.matrixWorldNeedsUpdate = true;
    // (a hand that holds something closes from the grip word, round it; an empty one from relaxed, pointing as it grips)
    const tr = ra(side + '.trigger'), sq = ra(side + '.squeeze'), W = h.H.poses, rl = h.H.item ? W.grip : W.relaxed, op = W.open, fi = W.fist;
    const ix = h.H.item ? rl.index : rl.index + (op.index - rl.index) * sq;
    __xrDigit(h, 'index', ix + (fi.index - ix) * tr);
    for (const d of ['middle', 'ring', 'little']) __xrDigit(h, d, rl[d] + (fi[d] - rl[d]) * sq);
    const want = __xrThumbDown(src, side) ? fi.thumb : rl.thumb;
    h.thumb += (want - h.thumb) * (1 - Math.exp(-14 * (dt || 0)));
    __xrDigit(h, 'thumb', h.thumb);
  }
}
`;

// THE HUD IN THE HEADSET (`ctrl`, unless `hud: false`): the page's HUD is DOM (events.js's layer, `.moj-hud`), which a
// session does not show. A panel in the play space does: a canvas texture on a plane low in front of the body (on the
// floor 2.4 m ahead, tilted up to the eye: under where a game's things come at the player, never across them), the
// HUD's own columns drawn on it (the left slots left, the right right, the rest in the middle), each visible widget a
// line of its own text in its own colour (a CSS variable read off the page) and fade. It is the HUD the game already
// has: readouts, bars, clocks, banners, toasts, whatever a game's mechanics put there; not its legend (the keyboard's). Read ten times a second; drawn
// again only when what it says has changed. Made on entering, gone on leaving.
const PANEL = `// --- the HUD in the headset: the page's own HUD mirrored onto a panel low in front of the body ---
let __xrPanel = null, __xrPanelSig = '', __xrPanelT = 0;
const __XRP = { w: 1024, h: 512, size: [1.4, 0.7], at: [0, 0.3, -2.4], tilt: 0.95, every: 0.1 };
function __xrPanelMake(){
  if (__xrPanel || !document.createElement) return;
  const cv = document.createElement('canvas'), ctx = cv && cv.getContext ? cv.getContext('2d') : null;
  if (!ctx) return;
  cv.width = __XRP.w; cv.height = __XRP.h;
  const tex = new THREE.CanvasTexture(cv);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(__XRP.size[0], __XRP.size[1]), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.position.set(__XRP.at[0], __XRP.at[1], __XRP.at[2]); m.rotation.x = -__XRP.tilt; m.renderOrder = 990; m.raycast = function () {};
  m.visible = false; __xrRig.add(m);
  __xrPanel = { m, cv, ctx, tex }; __xrPanelSig = ''; __xrPanelT = 0;
}
function __xrPanelDrop(){
  if (!__xrPanel) return;
  if (__xrPanel.m.parent) __xrPanel.m.parent.remove(__xrPanel.m);
  if (__xrPanel.tex.dispose) __xrPanel.tex.dispose();
  __xrPanel = null; __xrPanelSig = '';
}
// a CSS colour as the canvas takes it: a page variable read off the root
function __xrPanelColor(c){
  const v = /^var\\((--[\\w-]+)\\)/.exec(c || '');
  if (!v) return c || '#ffffff';
  const got = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(document.documentElement).getPropertyValue(v[1]).trim() : '';
  return got || '#ffffff';
}
// the HUD's visible widgets, by side: { left, center, right } of { text, color, a }; null without a HUD
function __xrPanelRows(){
  const layer = document.querySelector ? document.querySelector('.moj-hud') : null;
  if (!layer) return null;
  const out = { left: [], center: [], right: [] };
  for (const col of Array.from(layer.children || [])) {
    const slot = (/\\bmoj-hud-(?!col\\b)([a-z-]+)/.exec(col.className || '') || [0, 'center'])[1];   // (not its moj-hud-col)
    const side = /left$/.test(slot) ? 'left' : /right$/.test(slot) ? 'right' : 'center';
    for (const el of Array.from(col.children || [])) {
      const cl = el.classList;
      // (a legend teaches the keyboard and the mouse, which a headset does not hold)
      if (cl && (cl.contains('moj-hidden') || cl.contains('moj-off') || cl.contains('moj-w-legend'))) continue;
      const a = el.style && el.style.opacity !== '' && el.style.opacity != null ? +el.style.opacity : 1;
      if (!(a > 0.05)) continue;
      const text = Array.from(el.childNodes || []).map((n) => String(n.textContent || '').trim()).filter(Boolean).join('  ');
      if (text) out[side].push({ text, color: __xrPanelColor(el.style && el.style.color), a: Math.round(a * 10) / 10 });
    }
  }
  return out;
}
function __xrPanelStep(dt){
  if (!__xrPanel) return;
  __xrPanelT -= dt || 0; if (__xrPanelT > 0) return; __xrPanelT = __XRP.every;
  const R = __xrPanelRows(), sig = R ? JSON.stringify(R) : '';
  if (sig === __xrPanelSig) return;
  __xrPanelSig = sig;
  const n = R ? R.left.length + R.center.length + R.right.length : 0;
  __xrPanel.m.visible = n > 0;
  if (!n) return;
  const c = __xrPanel.ctx, W = __XRP.w, H = __XRP.h, pad = 36, line = 62;
  c.clearRect(0, 0, W, H);
  c.globalAlpha = 1; c.fillStyle = 'rgba(10,12,16,0.62)'; c.fillRect(0, 0, W, H);
  c.font = 'bold 46px sans-serif'; c.textBaseline = 'top';
  const col = (rows, x, align) => {
    c.textAlign = align;
    rows.slice(0, 7).forEach((r, k) => { c.globalAlpha = r.a; c.fillStyle = r.color; c.fillText(r.text, x, pad + k * line, W / 2 - pad); });
  };
  col(R.left, pad, 'left'); col(R.center, W / 2, 'center'); col(R.right, W - pad, 'right');
  c.globalAlpha = 1;
  __xrPanel.tex.needsUpdate = true;
}
`;

// the game in the headset (`ctrl`): the controllable channel declares `__xrCtl` (null: the page reads its own pad and
// drives its own camera) and reads it in its input read, its camera drive and its body sync (controllable/index.js `xr`)
const ctrlScript = ({ hands = false } = {}) => `// --- the game in the headset: the session drives the pilot, the rig stands under it ---
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
  const aim = __xrAim(e); if (aim) inp.aim = aim;
  const sw = __xrSweeps(e); if (sw) inp.sweeps = sw;
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
  __xrHead0 = L;${hands ? `
  // (the hands first, in the rig: the step's aim reads the held muzzle; the rig, placed after it, carries them)
  if (e.id !== __xrHandsOf) __xrHandsMake(e);
  __xrHandsStep(dt);` : ''}
  stepControllable(dt);
  __xrPlace(e, L);
  __xrPanelStep(dt);
}
${PANEL}
// what each hand strikes with, in the world (the kernel's input.sweeps, worlds/controllable/sweep.js): ${hands ? `a held blade
// from its guard to its tip, an empty hand its fist's knuckles (a gun's hand none), where the hands draw them; else` : 'without the hands drawn,'}
// the grip pose's centre, a fist
const __xrSwA = new THREE.Vector3(), __xrSwB = new THREE.Vector3();
function __xrSweeps(e){
  __xrRig.updateMatrixWorld(true);
  const hands = [];${hands ? `
  let drawn = false;
  for (const S of ['R', 'L']) {
    const h = __xrHands[S]; if (!h) continue;
    drawn = true; if (!h.g.visible) continue;
    const I = h.H.item, W = h.g.matrixWorld;
    if (I && I.blade) { __xrSwA.set(I.blade.a[0], I.blade.a[1], I.blade.a[2]).applyMatrix4(W); __xrSwB.set(I.blade.b[0], I.blade.b[1], I.blade.b[2]).applyMatrix4(W); hands.push({ id: S, kind: 'blade', a: __xrSwA.toArray(), b: __xrSwB.toArray(), r: 0.03 }); }
    else if (!I && h.H.fist) { __xrSwA.set(h.H.fist[0], h.H.fist[1], h.H.fist[2]).applyMatrix4(W); hands.push({ id: S, kind: 'fist', a: __xrSwA.toArray(), b: __xrSwA.toArray(), r: 0.045 }); }
  }
  if (drawn) return { by: e.id, hands };` : ''}
  const s = renderer.xr.getSession(), f = renderer.xr.getFrame && renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
  const P = __XRV.xrPoses(f, ref, s ? s.inputSources : []);
  for (const [S, side] of [['R', 'right'], ['L', 'left']]) {
    const g = P[side].grip; if (!g) continue;
    __xrSwA.set(g.p[0], g.p[1], g.p[2]).applyMatrix4(__xrRig.matrixWorld);
    hands.push({ id: S, kind: 'fist', a: __xrSwA.toArray(), b: __xrSwA.toArray(), r: 0.06 });
  }
  return { by: e.id, hands };
}
// the weapon hand's aim in the world (the kernel's input.aim, combat-ranged.js): a held gun's muzzle along its bore where
// the hands draw one, else the controller's target ray; null before a pose
const __xrAimO = new THREE.Vector3(), __xrAimD = new THREE.Vector3();
function __xrAim(e){
  const side = e.weapon && e.weapon.hand === 'left' ? 'left' : 'right';
  __xrRig.updateMatrixWorld(true);${hands ? `
  const h = __xrHands[side === 'left' ? 'L' : 'R'], M = h && h.g.visible && h.H.item && h.H.item.muzzle;
  if (M) {
    __xrAimO.set(M.p[0], M.p[1], M.p[2]).applyMatrix4(h.g.matrixWorld); __xrAimD.set(M.d[0], M.d[1], M.d[2]).transformDirection(h.g.matrixWorld);
    return { from: __xrAimO.toArray(), dir: __xrAimD.toArray() };
  }` : ''}
  const s = renderer.xr.getSession(), f = renderer.xr.getFrame && renderer.xr.getFrame(), ref = renderer.xr.getReferenceSpace();
  const a = __XRV.xrPoses(f, ref, s ? s.inputSources : [])[side].aim;
  if (!a) return null;
  __xrAimO.set(a.p[0], a.p[1], a.p[2]).applyMatrix4(__xrRig.matrixWorld);
  __xrQ.set(a.q[0], a.q[1], a.q[2], a.q[3]); __xrAimD.set(0, 0, -1).applyQuaternion(__xrQ).transformDirection(__xrRig.matrixWorld);
  return { from: __xrAimO.toArray(), dir: __xrAimD.toArray() };
}
${hands ? HANDS : ''}`;

export function xrModeScript(cfg, { ctrl = false, hands = false } = {}) {
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
  __xrCtl = null; __xrHead0 = null; __xrPad0 = null;${hands ? ' __xrHandsDrop();' : ''} __xrPanelDrop();` : ''}
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
  { const e = __xrPilot(); if (e) { __xrYaw = e.transform.heading || 0; __xrSetYaw(__xrRig, __xrYaw); __xrHead0 = null; __xrPlace(e, null); __xrCtl = { pad: __xrPadRead, input: __xrInput, hides: (b) => b === __xrPilot() }; if (XR.hud !== false) __xrPanelMake(); } }` : ''}
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
${ctrl ? ctrlScript({ hands }) : ''}renderer.xr.enabled = true;
const __xrBtn = document.createElement('button'); __xrBtn.textContent = 'vr'; __xrBtn.hidden = true;
__xrBtn.onclick = () => { __xrEnter(); };
hud.appendChild(__xrBtn);
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then((ok) => { __xrBtn.hidden = !ok; if (!ok) __xrBtn.title = 'no immersive-vr device'; }).catch(() => {});
}
`;
}
