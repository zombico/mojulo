/**
 * versus arena (the World page's fight) — the fight drawn on a scapeshift arena in 3D (inlined as text by
 * scene/channels/versus.js inside one block, never imported).
 *
 * The pure modules and the runtime (versus-runtime.client.js) come first in the block; `VERSUS_ARENA` (the plane,
 * the walls, the roster, the rules, the level wire's names) is injected. From the page it uses only what a channel
 * may: `THREE`, `scene`, `camera`, `controls`, `wrap`, and `__ctrlOwnsCamera` (it owns the camera from the start).
 *
 * The fight's plane is the arena's: sim x (mm) is world x / 1000 about the room's middle, sim y the height off the
 * floor, all at the plane's y. Bodies are the stick figures as solid limbs (a fill and a black hull for the ink, a
 * joint ball at each bend), lead limbs a hand nearer the camera than rear ones. The camera stands square to the
 * plane on the open side, keeps both fighters in frame (closer as they close in) and stops at the walls. Health,
 * timer, banners, sparks and fireballs are the runtime's overlay, on a canvas over the picture.
 *
 * A character made with create_character (its `character` ref, its body in `VERSUS_ARENA.bodies`) fights in its own
 * body: its rig's rigid parts, each bone turned from the fight's pose (versus-skin.js), the figure facing its foe.
 * One the arena has no body for (a game's roster grown since the arena was made) is the stick figure.
 *
 * As a level: hosted in a versus game's frame it posts READY, fights the picks INIT brings (fighters as recipes,
 * names, colours, schemes, mode), and posts OUTCOME at the end (its result for player 1; quitting from pause is an
 * abort). On its own it fights the arena's first two fighters, player 1 against the CPU, and offers another.
 */

/* global VERSUS_ARENA, THREE, scene, camera, controls, wrap, compileFighter, rigJoints, weaponLine, RT, VS_DUMMY,
   skinSkeleton, skinPose, decodeF32, decodeU8, installVersusInput, hostedRules, menuInput, endInputFrame, newMatch, stepMatch, poseOf, drawEffects, drawHud, vsText, vsOutlined */

const AV = VERSUS_ARENA;
const hosted = window.parent !== window;
const PLANE = AV.plane, FLOOR = AV.floor || 0;

// ── the overlay and the camera ───────────────────────────────────────────────────────────────────────────────

const ov = document.createElement('canvas');
ov.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:6';
wrap.appendChild(ov);
const g2 = ov.getContext('2d');
let OW = 0, OH = 0, ODPR = 1;
function fitOverlay() {
  ODPR = Math.min(2, window.devicePixelRatio || 1);
  OW = wrap.clientWidth || window.innerWidth; OH = wrap.clientHeight || window.innerHeight;
  ov.width = Math.round(OW * ODPR); ov.height = Math.round(OH * ODPR);
}
window.addEventListener('resize', fitOverlay);
fitOverlay();

controls.enabled = false;
__ctrlOwnsCamera = true;   // the page's loop leaves the camera to the fight
const VFOV = 38;
const cam = { x: 0, dist: 5.8 };

// ── bodies ───────────────────────────────────────────────────────────────────────────────────────────────────

// a unit cylinder along +y with its light baked into vertex colours (the page draws unlit), and a ball
function shadedGeometry(geo) {
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const k = 0.5 + 0.5 * Math.max(0, n.getX(i) * -0.35 + n.getY(i) * 0.55 + n.getZ(i) * -0.75);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const CYL = shadedGeometry(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2));
const BALL = shadedGeometry(new THREE.SphereGeometry(1, 14, 10));
const INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
const LIMBS = [
  ['pelvis', 'neck', 1.7], ['shoulder', 'elbowF', 1], ['elbowF', 'fistF', 1], ['shoulder', 'elbowB', 1], ['elbowB', 'fistB', 1],
  ['pelvis', 'kneeF', 1.15], ['kneeF', 'ankleF', 1], ['ankleF', 'toeF', 0.8], ['pelvis', 'kneeB', 1.15], ['kneeB', 'ankleB', 1], ['ankleB', 'toeB', 0.8],
];
const JOINTS = [['elbowF', 1], ['elbowB', 1], ['kneeF', 1.1], ['kneeB', 1.1], ['fistF', 1.5], ['fistB', 1.5], ['ankleF', 1], ['ankleB', 1], ['pelvis', 1.6], ['shoulder', 1.4]];
const depthOf = (name) => (name.endsWith('F') ? -0.11 : name.endsWith('B') ? 0.11 : 0);

function makeBody(color, F) {
  const front = new THREE.MeshBasicMaterial({ color, vertexColors: true });
  const back = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), vertexColors: true });
  const group = new THREE.Group();
  const part = (geo, mat) => {
    const fill = new THREE.Mesh(geo, mat), ink = new THREE.Mesh(geo, INK);
    group.add(fill, ink);
    return { fill, ink };
  };
  const limbs = LIMBS.map(([a, b, w]) => ({ a, b, w, ...part(CYL, b.endsWith('B') ? back : front) }));
  const joints = JOINTS.map(([j, w]) => ({ j, w, ...part(BALL, j.endsWith('B') ? back : front) }));
  const head = part(BALL, front);
  // a weapon: one more inked cylinder, the blade's own colour, on the grip hand's side of the plane
  const blade = F && F.weapon ? part(CYL, new THREE.MeshBasicMaterial({ color: F.weapon.color, vertexColors: true })) : null;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  scene.add(group, shadow);
  return { group, limbs, joints, head, blade, shadow, front, back };
}

const vA = new THREE.Vector3(), vB = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1), vD = new THREE.Vector3();
function placeBody(B, p, F, t) {
  const J = rigJoints(F.body, poseOf(p, F, t));
  const at = (name, out) => out.set((p.x + J[name][0] * p.face) / 1000, PLANE + depthOf(name), FLOOR + (p.y + J[name][1]) / 1000);
  const r = F.body.limbR / 1000;
  for (const L of B.limbs) {
    at(L.a, vA); at(L.b, vB);
    vD.subVectors(vB, vA);
    const len = vD.length() || 0.001;
    for (const [mesh, k] of [[L.fill, 1], [L.ink, 1.32]]) {
      mesh.position.addVectors(vA, vB).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(UP, vD.clone().normalize());
      mesh.scale.set(r * L.w * k, r * L.w * k, len);
    }
  }
  for (const Jn of B.joints) {
    at(Jn.j, vA);
    for (const [mesh, k] of [[Jn.fill, 1.05], [Jn.ink, 1.32]]) { mesh.position.copy(vA); mesh.scale.setScalar(r * Jn.w * k); }
  }
  if (B.blade) {
    const L = weaponLine(J, F.weapon);
    const z = PLANE + (F.weapon.grip === 'B' ? 0.13 : -0.13);
    vA.set((p.x + L.butt[0] * p.face) / 1000, z, FLOOR + (p.y + L.butt[1]) / 1000);
    vB.set((p.x + L.tip[0] * p.face) / 1000, z, FLOOR + (p.y + L.tip[1]) / 1000);
    vD.subVectors(vB, vA);
    const len = vD.length() || 0.001, wr = (F.weapon.width / 1000) * 0.55;
    for (const [mesh, k] of [[B.blade.fill, 1], [B.blade.ink, 1.6]]) {
      mesh.position.addVectors(vA, vB).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(UP, vD.clone().normalize());
      mesh.scale.set(wr * k, wr * k, len);
    }
  }
  at('head', vA);
  const hr = F.body.head / 1000;
  B.head.fill.position.copy(vA); B.head.fill.scale.setScalar(hr);
  B.head.ink.position.copy(vA); B.head.ink.scale.setScalar(hr * 1.12);
  B.shadow.position.set(p.x / 1000, PLANE, FLOOR + 0.01);
  B.shadow.scale.setScalar((F.body.bodyR / 1000) * 1.8 * Math.max(0.4, 1 - p.y / 1600));
}

// a character's own body: one mesh per bone part, posed each frame by its bone's turn (versus-skin.js)
const SKINS = {};
function skinOf(ref) {
  const pack = ref && AV.bodies && AV.bodies[ref];
  if (!pack) return null;
  return SKINS[ref] || (SKINS[ref] = { pack, sk: skinSkeleton(pack.bones) });
}
function makeCharacter(skin) {
  const group = new THREE.Group();
  const meshes = skin.pack.parts.map((part) => {
    if (!part) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(decodeF32(part.pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(decodeU8(part.col), 3, true));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = false;   // matrices change every frame
    group.add(mesh);
    return mesh;
  });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  scene.add(group, shadow);
  return { group, shadow, skin, meshes };
}
const qB = new THREE.Quaternion(), vR = new THREE.Vector3(), X_AXIS = new THREE.Vector3(1, 0, 0), ONE = new THREE.Vector3(1, 1, 1);
function placeCharacter(B, p, F, t) {
  const pose = poseOf(p, F, t);
  const { a, h } = skinPose(B.skin.sk, rigJoints(F.body, pose), p.face, !!pose.air);
  // the figure faces +y in its own frame: turned to face its foe along the plane, its feet on the fight's ground
  B.group.position.set(p.x / 1000, PLANE, FLOOR + p.y / 1000);
  B.group.rotation.set(0, 0, p.face > 0 ? -Math.PI / 2 : Math.PI / 2);
  const bones = B.skin.pack.bones;
  for (let i = 0; i < B.meshes.length; i++) {
    const mesh = B.meshes[i];
    if (!mesh) continue;
    // M·v = head' + q·(v − restHead)
    qB.setFromAxisAngle(X_AXIS, a[i]);
    const rh = bones[i].head;
    vR.set(rh[0], rh[1], rh[2]).applyQuaternion(qB);
    vR.set(h[i][0] - vR.x, h[i][1] - vR.y, h[i][2] - vR.z);
    mesh.matrix.compose(vR, qB, ONE);
  }
  B.shadow.position.set(p.x / 1000, PLANE, FLOOR + 0.01);
  B.shadow.scale.setScalar((F.body.bodyR / 1000) * 1.8 * Math.max(0.4, 1 - p.y / 1600));
}
const placeFighter = (B, p, F, t) => (B.skin ? placeCharacter(B, p, F, t) : placeBody(B, p, F, t));

// ── the fight ────────────────────────────────────────────────────────────────────────────────────────────────

const ROSTER = AV.roster.map((r) => ({ ...r, F: compileFighter(r.recipe) }));
let match = null, bodies = [], phase = 'wait', waited = 0, pauseIx = 0, lastParams = null;

installVersusInput((code) => { if (code === 'KeyR' && match && match.mode === 'training') RT.dummy = (RT.dummy + 1) % VS_DUMMY.length; });

function defaults() {
  const a = ROSTER[0], b = ROSTER[Math.min(1, ROSTER.length - 1)];
  return { fighters: [a.recipe, b.recipe], names: [a.name, b.name], colors: [a.color, a.id === b.id ? '#e8e8e8' : b.color], characters: [a.character || null, b.character || null], schemes: ['modern', 'modern'], mode: 'cpu', level: 1, seed: 1 };
}

function begin(params) {
  lastParams = params;
  for (const B of bodies) scene.remove(B.group, B.shadow);
  const fighters = params.fighters.map((r) => compileFighter(r));
  const rules = hostedRules(AV.rules, params.rules, Math.round(AV.half * 1000));
  match = newMatch({ fighters, names: params.names, colors: params.colors, schemes: params.schemes, mode: params.mode, level: params.level, rules, seed: params.seed ?? 1 });
  bodies = params.colors.map((c, i) => {
    const skin = skinOf(params.characters && params.characters[i]);
    return skin ? makeCharacter(skin) : makeBody(c, fighters[i]);
  });
  phase = 'fight';
}

function post(msg) { if (hosted) window.parent.postMessage(msg, '*'); }

if (hosted) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.moj !== AV.wire.init || d.contractVersion !== AV.wire.version) return;
    if (d.params && d.params.versus) begin(d.params.versus);
  });
  post({ moj: AV.wire.ready, contractVersion: AV.wire.version, levelRef: 'versus' });
}

function tick() {
  const inp = menuInput();
  const any = (k) => inp[0][k] || inp[1][k];
  if (phase === 'wait') {
    // hosted, a versus game sends its picks; on its own (or if none come) the arena's first two fight
    if (!hosted || ++waited > 90) begin(defaults());
    return;
  }
  if (phase === 'paused') {
    if (any('up') || any('down')) pauseIx = 1 - pauseIx;
    if (any('ok')) {
      if (pauseIx === 0) phase = 'fight';
      else if (hosted) { post({ moj: AV.wire.outcome, envelope: { result: 'abort', events: [] } }); phase = 'done'; }
      else begin(lastParams);
    }
    return;
  }
  if (phase === 'over') {
    if (any('ok')) begin(lastParams);
    return;
  }
  if (phase !== 'fight') return;
  if ((inp[0].pause || inp[1].pause) && match.s.phase !== 'matchEnd') { phase = 'paused'; pauseIx = 0; return; }
  if (match.slow > 0) { match.slow--; if (match.slow % 3) return; }
  stepMatch(match);
  if (match.end === 150) {
    const s = match.s;
    if (hosted) {
      post({ moj: AV.wire.outcome, envelope: { result: s.winner === 0 ? 'success' : 'fail', events: [], stats: { versus: { winner: s.winner, wins: s.wins } } } });
      phase = 'done';
    } else phase = 'over';
  }
}

function frameCamera() {
  const s = match.s;
  const aspect = (OW || 16) / (OH || 9);
  const tanH = Math.tan((VFOV * Math.PI) / 360) * aspect;
  const sep = Math.abs(s.p[0].x - s.p[1].x) / 1000;
  // the genre's framing: a body near half the picture's height, both in frame with room to move
  const want = Math.max(5.8, Math.min(9, (sep + 3.4) / (2 * tanH)));
  cam.dist += (want - cam.dist) * 0.12;
  const halfView = cam.dist * tanH;
  const lim = Math.max(0, AV.half + 0.8 - halfView);
  const mid = (s.p[0].x + s.p[1].x) / 2000;
  cam.x += (Math.max(-lim, Math.min(lim, mid)) - cam.x) * 0.15;
  const shake = match.shake > 0 ? Math.sin(match.t * 2.3) * match.shake * 0.006 : 0;
  if (camera.fov !== VFOV) { camera.fov = VFOV; camera.updateProjectionMatrix(); }
  camera.position.set(cam.x + shake, PLANE - cam.dist, FLOOR + 1.25 + cam.dist * 0.05);
  camera.lookAt(cam.x + shake, PLANE, FLOOR + 1.05);
}

const vP = new THREE.Vector3();
function toScreen(xmm, ymm) {
  vP.set(xmm / 1000, PLANE, FLOOR + ymm / 1000).project(camera);
  return [((vP.x + 1) / 2) * OW, ((1 - vP.y) / 2) * OH];
}

function draw() {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!match) { vsOutlined(g2, 'GET READY', OW / 2, OH / 2, 40, '#fff'); return; }
  frameCamera();
  const s = match.s;
  for (let i = 0; i < 2; i++) placeFighter(bodies[i], s.p[i], match.ctx.fighters[i], match.t + i * 40);
  const S = OH / (2 * cam.dist * Math.tan((VFOV * Math.PI) / 360)) / 1000;
  drawEffects(g2, match, toScreen, S);
  drawHud(g2, OW, OH, match);
  if (phase === 'paused') {
    g2.fillStyle = 'rgba(0,0,0,0.65)'; g2.fillRect(0, 0, OW, OH);
    vsOutlined(g2, 'PAUSED', OW / 2, OH * 0.3, 54, '#fff');
    ['Resume', hosted ? 'Quit to character select' : 'Restart'].forEach((it, k) => vsText(g2, it, OW / 2, OH * 0.45 + k * 50, 24, k === pauseIx ? '#ffd23a' : '#fff'));
  }
  if (phase === 'over') vsOutlined(g2, 'PRESS START TO FIGHT AGAIN', OW / 2, OH * 0.62, 28, '#ffd23a');
}

// the page calls this from its frame step with its (pause-rebased) clock in seconds; the fight steps at 60 Hz
let fightAcc = 0, fightLast = null;
function stepArenaFight(t) {
  if (fightLast === null) fightLast = t;
  fightAcc += Math.min(0.1, Math.max(0, t - fightLast));
  fightLast = t;
  let ticked = false;
  while (fightAcc >= 1 / 60) { fightAcc -= 1 / 60; tick(); ticked = true; }
  if (ticked) endInputFrame();
  draw();
}

window.__mojVersus = { get match() { return match; }, get phase() { return phase; }, get bodies() { return bodies; }, ROSTER };
