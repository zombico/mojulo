import { safeJson } from '../emit-util.js';

// First-person free-traverse (opt-in via emitThreeWorld({ walk })). A z-up pointer-lock
// controller — pure control, no collision/gravity/wobble. WASD moves on the heading plane,
// Space/Shift fly up/down, mouse looks. World-AGNOSTIC: it only mutates camera XYZ + yaw/pitch,
// and every World is z-up (camera.up=+Z), so the same controller traverses a room, a house, a
// city, a hub or terrain — the caller only picks spawn + speed (scale). The vendored
// PointerLockControls addon is y-up, so we drive yaw (about world +Z) and pitch by hand instead.
// `cfg`: { speed, spawn:[x,y,z] }. `center`: scene centroid (spawn faces it on entry).
export function walkModeScript(cfg, center) {
  return `
// --- first-person traversal (z-up): WALK (gravity + wall collision) and FLY (free 6DOF) ---
// Two grounded-vs-free modes sharing one pointer-lock look. WALK raycasts the real geometry
// (no separate collider data): straight down for the floor underfoot (stairs/terrain/voids all
// just work) and ahead for walls. FLY ignores both — W follows the full aim, Space/Shift fly z.
const WALK = ${safeJson(cfg)};
const WALK_CENTER = ${safeJson(center)};
const walkHint = document.querySelector('.hint');
const ORBIT_HINT = walkHint ? walkHint.textContent : '';
let walkYaw = 0, walkPitch = 0, walkMode = 'fly', walkVZ = 0, walkEye = WALK.minEye, walkGround = false, walkDragging = false;
const walkKeys = new Set();
// FPV head-bob (opt-in): WALK.bob is a baked gait-camera curve (gait-camera.js) — the figure
// rig's own head trajectory over one stride. Indexed by DISTANCE walked (the bob stops when you
// stop) and eased in/out with motion. Offsets are STAND units, scaled to the world by
// walkEye/0.855 (the figure's eye sits at 0.855 STAND) so a taller vantage bobs proportionally.
// null → rigid eye (the walk is unchanged).
// FPS-feel defaults: subtle, mostly POSITIONAL (rotational view-bob is the nauseating part,
// so yaw/pitch stay small). Override per-channel via the baked-curve object.
const BOB = WALK.bob || null;
const BOB_EYE_STAND = 0.855;
const BOB_SCALES = BOB ? { sway: BOB.swayScale ?? 0.12, vert: BOB.bobScale ?? 0.35, yaw: BOB.yawScale ?? 0.25, pitch: BOB.pitchScale ?? 0.15 } : null;
// Bob scales STAND->world by the player's standing eye height (walkEye, computed on entry) — so a
// caller MUST pass a street-level walk eye (the default spawn sits at the city centroid, which
// would balloon the bob). strideScale > 1 lengthens the stride -> calmer step cadence.
const BOB_STRIDE = BOB ? (BOB.strideScale ?? 1.6) : 1;
let bobPhase = 0, bobAmt = 0, bobPrev = { x: 0, y: 0, z: 0 };
function sampleBob(phase){
  const C = BOB.curve, N = C.length;
  const f = (((phase % 1) + 1) % 1) * N;
  const i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, t = f - Math.floor(f);
  const a = C[i0], b = C[i1], lp = (k) => a[k] + (b[k] - a[k]) * t;
  return { dx: lp('dx'), dy: lp('dy'), dz: lp('dz'), pitch: lp('pitch'), yaw: lp('yaw') };
}
const WALK_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight'];
// collide/ground against every opaque fill (incl. the x-ray outer walls, which live outside \`solids\`)
const walkColliders = solids.concat(xrayGroups.map((g) => g.fill));
const walkDown = new THREE.Raycaster(), walkAhead = new THREE.Raycaster();
const flyBtn = document.createElement('button'); flyBtn.textContent = 'fly';
const walkBtn = document.createElement('button'); walkBtn.textContent = 'walk';
function walkLookDir(){
  return new THREE.Vector3(Math.cos(walkPitch) * Math.cos(walkYaw), Math.cos(walkPitch) * Math.sin(walkYaw), Math.sin(walkPitch));
}
// world z of the nearest solid surface straight below (x,y) from height zFrom, or null if nothing underfoot
function groundBelow(x, y, zFrom){
  walkDown.set(new THREE.Vector3(x, y, zFrom), new THREE.Vector3(0, 0, -1));
  const hit = walkDown.intersectObjects(walkColliders, false)[0];
  return hit ? hit.point.z : null;
}
function enterFirstPerson(mode){
  walkMode = mode; walkOn = true; controls.enabled = false; walkVZ = 0;
  bobPhase = 0; bobAmt = 0; bobPrev = { x: 0, y: 0, z: 0 };   // reset head-bob on (re)entry
  flyBtn.classList.toggle('on', mode === 'fly'); walkBtn.classList.toggle('on', mode === 'walk');
  camera.position.set(WALK.spawn[0], WALK.spawn[1], WALK.spawn[2]);
  walkYaw = Math.atan2(WALK_CENTER[1] - WALK.spawn[1], WALK_CENTER[0] - WALK.spawn[0]); // spawn looking inward
  walkPitch = 0;
  if (mode === 'walk'){
    // eye height = how far the (tuned) spawn floats over the floor beneath it; keeps the caller's vantage,
    // then gravity holds you that far above whatever you stand on. Falls back to minEye over open air.
    const g = groundBelow(WALK.spawn[0], WALK.spawn[1], WALK.spawn[2] + 1e-3);
    walkEye = (g != null) ? Math.max(WALK.minEye, WALK.spawn[2] - g) : WALK.minEye;
    if (g != null) camera.position.z = g + walkEye;
  }
  // WALK captures the pointer (immersive FPS). FLY keeps the cursor free — you steer by
  // dragging and can still click the HUD — so it doubles as a navigable inspect mode.
  if (mode === 'walk') { canvas.requestPointerLock(); }
  else { walkDragging = false; canvas.style.cursor = 'grab'; }
  if (walkHint) walkHint.textContent = mode === 'walk'
    ? 'WALK · WASD move · Space jump · mouse look · gravity + walls · click to capture · Esc release'
    : 'FLY · WASD toward aim · Space/Shift up·down · drag to look · Esc release';
}
function exitWalk(){
  walkOn = false; controls.enabled = true; flyBtn.classList.remove('on'); walkBtn.classList.remove('on');
  if (document.pointerLockElement) document.exitPointerLock();
  walkDragging = false; canvas.style.cursor = '';
  if (walkHint) walkHint.textContent = ORBIT_HINT;
  applyCam(0);
}
flyBtn.onclick = () => (walkOn && walkMode === 'fly') ? exitWalk() : enterFirstPerson('fly');
walkBtn.onclick = () => (walkOn && walkMode === 'walk') ? exitWalk() : enterFirstPerson('walk');
hud.appendChild(flyBtn); hud.appendChild(walkBtn);
// WALK: re-capture pointer on click if lost; losing the lock (Esc) exits the mode.
canvas.addEventListener('click', () => { if (walkOn && walkMode === 'walk' && document.pointerLockElement !== canvas) canvas.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { if (walkOn && walkMode === 'walk' && document.pointerLockElement !== canvas) exitWalk(); });
// FLY: drag-to-look — only rotate while a mouse button is held, leaving the cursor usable otherwise.
canvas.addEventListener('mousedown', () => { if (walkOn && walkMode === 'fly') { walkDragging = true; canvas.style.cursor = 'grabbing'; } });
addEventListener('mouseup', () => { if (walkDragging) { walkDragging = false; canvas.style.cursor = 'grab'; } });
document.addEventListener('mousemove', (e) => {
  if (!walkOn) return;
  if (walkMode === 'walk' ? document.pointerLockElement !== canvas : !walkDragging) return;
  const s = 0.0022;
  walkYaw -= e.movementX * s; walkPitch -= e.movementY * s;
  const lim = Math.PI / 2 - 0.05; walkPitch = Math.max(-lim, Math.min(lim, walkPitch));
});
addEventListener('keydown', (e) => {
  if (!walkOn) return;
  if (e.code === 'Escape') { exitWalk(); return; }   // exits FLY (WALK also exits via pointerlockchange)
  if (WALK_CODES.includes(e.code)) { walkKeys.add(e.code); e.preventDefault(); }
});
addEventListener('keyup', (e) => walkKeys.delete(e.code));
// WALK horizontal move with wall-slide: advance X and Y separately, each clamped by a forward ray
// (cast at eye + shin so a low rail still stops you). Hitting a wall on one axis still slides the other.
function walkSlide(dx, dy){
  const axis = (ax, ay) => {
    const d = Math.hypot(ax, ay); if (d < 1e-6) return;
    const dir = new THREE.Vector3(ax / d, ay / d, 0);
    let allow = d;
    for (const zo of [0, -walkEye * 0.6]) {
      walkAhead.set(new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z + zo), dir);
      const hit = walkAhead.intersectObjects(walkColliders, false)[0];
      if (hit) allow = Math.min(allow, Math.max(0, hit.distance - WALK.radius));
    }
    camera.position.x += dir.x * allow; camera.position.y += dir.y * allow;
  };
  axis(dx, 0); axis(0, dy);
}
stepWalk = (dt) => {
  if (walkMode === 'fly') {
    const fwd = walkLookDir();                                                // full aim (yaw+pitch): W/S fly toward where you look
    const right = new THREE.Vector3(Math.sin(walkYaw), -Math.cos(walkYaw), 0); // strafe stays horizontal
    const v = new THREE.Vector3();
    if (walkKeys.has('KeyW')) v.add(fwd);
    if (walkKeys.has('KeyS')) v.sub(fwd);
    if (walkKeys.has('KeyD')) v.add(right);
    if (walkKeys.has('KeyA')) v.sub(right);
    if (v.lengthSq() > 0) v.normalize().multiplyScalar(WALK.speed * dt);
    let dz = 0;
    if (walkKeys.has('Space')) dz += 1;
    if (walkKeys.has('ShiftLeft') || walkKeys.has('ShiftRight')) dz -= 1;
    camera.position.x += v.x; camera.position.y += v.y; camera.position.z += v.z + dz * WALK.speed * dt;
    camera.lookAt(camera.position.clone().add(walkLookDir()));
    return;
  }
  // WALK: horizontal heading only (pitch ignored for movement); gravity + the floor ray pin you down.
  // Strip last frame's head-bob first so physics + the floor-snap run on the CLEAN base eye — the bob
  // is a transient render offset, never fed back into the controller state (→ no drift / no creep).
  if (BOB) { camera.position.x -= bobPrev.x; camera.position.y -= bobPrev.y; camera.position.z -= bobPrev.z; }
  const fwd = new THREE.Vector3(Math.cos(walkYaw), Math.sin(walkYaw), 0);
  const right = new THREE.Vector3(Math.sin(walkYaw), -Math.cos(walkYaw), 0);
  const v = new THREE.Vector3();
  if (walkKeys.has('KeyW')) v.add(fwd);
  if (walkKeys.has('KeyS')) v.sub(fwd);
  if (walkKeys.has('KeyD')) v.add(right);
  if (walkKeys.has('KeyA')) v.sub(right);
  let moveDist = 0;
  if (v.lengthSq() > 0) { v.normalize().multiplyScalar(WALK.speed * dt); moveDist = v.length(); walkSlide(v.x, v.y); }
  if (walkGround && walkKeys.has('Space')) walkVZ = WALK.jump;   // jump only from the ground
  walkVZ -= WALK.gravity * dt;
  camera.position.z += walkVZ * dt;
  const g = groundBelow(camera.position.x, camera.position.y, camera.position.z);
  if (g != null && camera.position.z <= g + walkEye) {           // landed / standing: snap to floor + eye
    camera.position.z = g + walkEye; walkVZ = 0; walkGround = true;
  } else { walkGround = false; }
  // Head-bob: advance the gait phase by DISTANCE walked (2 steps per cycle), ease it in/out with
  // motion, sample the baked rig curve, apply it as a transient position offset on the clean eye + a
  // transient yaw/pitch on the LOOK only (walkYaw/walkPitch untouched → the mouse aim stays exact).
  let bobYaw = 0, bobPitch = 0;
  if (BOB) {
    const bu = walkEye / BOB_EYE_STAND;                          // STAND → world units, by standing eye height
    bobAmt += ((moveDist > 1e-6 ? 1 : 0) - bobAmt) * Math.min(1, dt * 6);
    if (moveDist > 1e-6) bobPhase += moveDist / (BOB.strideDistance * bu * 2 * BOB_STRIDE);
    const s = sampleBob(bobPhase);
    const ox = (right.x * s.dx + fwd.x * s.dy) * BOB_SCALES.sway * bu * bobAmt;
    const oy = (right.y * s.dx + fwd.y * s.dy) * BOB_SCALES.sway * bu * bobAmt;
    const oz = s.dz * BOB_SCALES.vert * bu * bobAmt;
    bobPrev = { x: ox, y: oy, z: oz };
    camera.position.x += ox; camera.position.y += oy; camera.position.z += oz;
    bobYaw = s.yaw * Math.PI / 180 * BOB_SCALES.yaw * bobAmt;
    bobPitch = s.pitch * Math.PI / 180 * BOB_SCALES.pitch * bobAmt;
  }
  const bl = new THREE.Vector3(
    Math.cos(walkPitch + bobPitch) * Math.cos(walkYaw + bobYaw),
    Math.cos(walkPitch + bobPitch) * Math.sin(walkYaw + bobYaw),
    Math.sin(walkPitch + bobPitch),
  );
  camera.lookAt(camera.position.clone().add(bl));
};`;
}
