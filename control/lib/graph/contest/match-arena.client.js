/**
 * court arena — the net game in a browser (inlined into the World page's court block after the ball's flight, the ball
 * card, the swing system, the hit, the physics integrator, the contest kernel, the court mind and the match sim:
 * scene/channels/contest.js). From the page it uses only what a channel may: `THREE`, `scene`, `camera`, `controls`,
 * `wrap`, and `__ctrlOwnsCamera` (it owns the camera from the start).
 *
 * The pads: P1 (side a, nearest the camera) on W A S D and F or Space to swing; P2 (side b, across the net) on the
 * arrows and the right Shift or Numpad 0 to swing, its keys read as the screen shows them; the gamepads by index (the
 * left stick, south to swing, start to begin again). A side nobody holds is the court mind's. The stick aims the
 * stroke as it is pressed: sideways across the court, forward for depth (the arcade) or lift (realistic).
 *
 * The players are stick figures posed from the sim (a first drawing: the hero library's clips are the step after this
 * one), the ball a sphere with its shadow, the court its lines from the kernel's regions and the net; a broadcast camera
 * behind side a's baseline; the overlay the scoreboard (sets, games, the points in the kernel's words), the server,
 * the calls (FAULT, LET, OUT, GAME, SET, MATCH) and the rally.
 *
 * As a level: hosted in a game's frame it posts READY, plays the match INIT brings (players, register, level, seed over
 * the court's own), and posts the OUTCOME when the match is over: success when side a (the first player's) won, or an
 * exhibition ended; fail otherwise. On its own it starts at once and plays again on start.
 */
/* global COURT_ARENA, THREE, scene, camera, controls, wrap, newMatch, stepMatch, matchContext, matchDisplay, MPAD, MATCH_FPS, contestRegion */

const CA = COURT_ARENA, CT = CA.court, NET_Y = CT.netY;
const hosted = window.parent !== window;
const COLORS = ['#e0503a', '#3a9be0'];
const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';

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
__ctrlOwnsCamera = true;   // the page's loop leaves the camera to the match
const cam = { x: 0 };

// ── input ────────────────────────────────────────────────────────────────────────────────────────────────────

const COURT_KEYS = [
  { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], swing: ['KeyF', 'Space'], start: ['Enter'] },
  { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], swing: ['ShiftRight', 'Numpad0'], start: ['NumpadEnter'] },
];
const IN = { held: new Set(), latch: new Set() };
window.addEventListener('keydown', (e) => { IN.held.add(e.code); IN.latch.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
window.addEventListener('keyup', (e) => IN.held.delete(e.code));
window.addEventListener('blur', () => IN.held.clear());
const anyHeld = (list) => list.some((k) => IN.held.has(k) || IN.latch.has(k));
// the screen's right and up (away from the camera) as the player's own frame: side a's right is the screen's, side b's
// is the other way, and "toward the net" is up the screen for a, down it for b
const screenToPad = (side, sx, sy) => (side === 'a' ? [sx, sy] : [-sx, -sy]);
function padOf(i, side) {
  const K = COURT_KEYS[i] || COURT_KEYS[0];
  let sx = (anyHeld(K.right) ? 1 : 0) - (anyHeld(K.left) ? 1 : 0), sy = (anyHeld(K.up) ? 1 : 0) - (anyHeld(K.down) ? 1 : 0);
  let swing = anyHeld(K.swing), start = anyHeld(K.start);
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads[i];
  if (gp) {
    const btn = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    if (Math.abs(ax) > 0.2) sx = ax; if (Math.abs(ay) > 0.2) sy = -ay;
    swing = swing || btn(0); start = start || btn(9);
  }
  const [x, y] = screenToPad(side, sx, sy);
  return { x, y, b: (swing ? MPAD.SWING : 0) | (start ? MPAD.START : 0) };
}
let startWas = false;
function startEdge(pads) {
  const now = pads.some((p) => p.b & MPAD.START) || anyHeld(['Enter']);
  const edge = now && !startWas; startWas = now;
  return edge;
}

// ── the court, the net, the bodies ───────────────────────────────────────────────────────────────────────────

function shaded(geo) {
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) { const k = 0.5 + 0.5 * Math.max(0, n.getX(i) * -0.35 + n.getY(i) * -0.55 + n.getZ(i) * 0.75); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const GEO_CYL = shaded(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2));
const GEO_BALL = shaded(new THREE.SphereGeometry(1, 14, 10));
const INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xf2f2ee });
const POST = new THREE.MeshBasicMaterial({ color: 0x2a2f3a });
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vD = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1);
function cylinderAt(mesh, a, b, r) {
  vD.subVectors(b, a);
  const len = vD.length() || 0.001;
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, vD.normalize());
  mesh.scale.set(r, r, len);
}
const dressing = new THREE.Group();
scene.add(dressing);
// court frame → stage: the net's centre is (0, NET_Y, 0)
const toStage = (x, y, z = 0) => [x, y + NET_Y, z];
function box(w, d, h, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat); m.position.set(x, y, z); dressing.add(m); return m; }
function lineRect(r) {   // a court-frame rect's four lines on the floor
  const [x0, y0, x1, y1] = r, t = 0.05;
  box(x1 - x0 + t, t, 0.012, (x0 + x1) / 2, NET_Y + y0, 0.006, WHITE); box(x1 - x0 + t, t, 0.012, (x0 + x1) / 2, NET_Y + y1, 0.006, WHITE);
  box(t, y1 - y0 + t, 0.012, x0, NET_Y + (y0 + y1) / 2, 0.006, WHITE); box(t, y1 - y0 + t, 0.012, x1, NET_Y + (y0 + y1) / 2, 0.006, WHITE);
}
function dressCourt() {
  for (const side of ['a', 'b']) for (const name of Object.keys(CT.regions)) { if (name === 'backcourt') continue; lineRect(contestRegion(CA.C, name, side).rect); }
  // the net: two posts past the sidelines, the band along the top, the mesh a dark pane
  const half = CT.halfW + CT.net.beyond, h = CT.net.height;
  box(0.08, 0.08, CT.net.posts, -half, NET_Y, CT.net.posts / 2, POST); box(0.08, 0.08, CT.net.posts, half, NET_Y, CT.net.posts / 2, POST);
  box(half * 2, 0.03, 0.06, 0, NET_Y, h - 0.03, WHITE);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.01, h - 0.06), new THREE.MeshBasicMaterial({ color: 0x1b1f28, transparent: true, opacity: 0.55, depthWrite: false }));
  pane.position.set(0, NET_Y, (h - 0.06) / 2); dressing.add(pane);
}
dressCourt();

const LIMB_R = 0.055;
function makePlayer(color) {
  const near = new THREE.MeshBasicMaterial({ color, vertexColors: true });
  const group = new THREE.Group();
  const part = (geo, mat = near) => { const fill = new THREE.Mesh(geo, mat), ink = new THREE.Mesh(geo, INK); group.add(fill, ink); return { fill, ink }; };
  const B = { group, trunk: part(GEO_CYL), head: part(GEO_BALL), racquet: part(GEO_CYL, new THREE.MeshBasicMaterial({ color: 0xd8d2c2, vertexColors: true })), limbs: Object.fromEntries(['thighL', 'thighR', 'shinL', 'shinR', 'armL', 'armR', 'foreL', 'foreR'].map((k) => [k, part(GEO_CYL)])) };
  B.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  scene.add(group, B.shadow);
  return B;
}
const seg = (P, a, b, r) => { vA.set(a[0], a[1], a[2]); vB.set(b[0], b[1], b[2]); cylinderAt(P.fill, vA, vB, r); cylinderAt(P.ink, vA, vB, r * 1.3); };
// the body from the sim: facing the net, the legs working with its speed, the racquet arm swept by the swing's phase
function posePlayer(B, P) {
  const s = P.side === 'a' ? 1 : -1, right = s;   // a faces +y, its right +x
  const [x, y] = toStage(P.x, P.y);
  const speed = Math.hypot(P.vx, P.vy), moving = speed > 0.3, t = performance.now() / 1000;
  const sw = P.swing, u = sw ? sw.u : 0, serve = sw && sw.verb === 'serve';
  const hipZ = 0.9 - (moving ? 0.02 * Math.abs(Math.sin(t * 9)) : 0.03), legL = 0.45, shin = 0.43, arm = 0.3, fore = 0.3;
  const J = {};
  for (const [S2, side] of [['L', -1], ['R', 1]]) {
    const hip = [x + side * 0.12, y, hipZ], a = moving ? 0.6 * Math.sin(t * 9 + (side > 0 ? 0 : Math.PI)) : 0.12 * side, k = moving ? 0.5 + 0.8 * Math.max(0, -a) : 0.3;
    const knee = [hip[0], hip[1] + s * legL * Math.sin(a), hip[2] - legL * Math.cos(a)];
    const ankle = [knee[0], knee[1] + s * shin * Math.sin(a - k), knee[2] - shin * Math.cos(a - k)];
    J[`hip${S2}`] = hip; J[`knee${S2}`] = knee; J[`ankle${S2}`] = ankle;
  }
  const shoulderZ = hipZ + 0.52;
  for (const [S2, side] of [['L', -1], ['R', 1]]) {
    const sh = [x + side * 0.19, y, shoulderZ];
    const isRacquet = (side > 0) === (right > 0) || true;   // the racquet hand is the figure's right in its own frame
    let pitch = 0.25, yaw = 0, elev = 0;
    if (sw && S2 === 'R') {
      if (serve) { elev = 2.6 - 1.2 * Math.max(0, u - 0.4) * 2; pitch = 0; }
      else { const dir = sw.verb === 'backhand' ? -1 : 1; yaw = dir * (-1.3 + 2.6 * Math.min(1, u * 1.25)); pitch = 1.2; }
    } else if (moving) pitch = 0.5 * Math.sin(t * 9 + (side > 0 ? Math.PI : 0)) + 0.3;
    // the upper arm: down and a little forward, swept by yaw about the shoulder's vertical and lifted by elev
    const ex = Math.cos(elev) * Math.sin(yaw), ey = Math.cos(elev) * Math.cos(yaw) * Math.sin(pitch), ez = -Math.cos(elev) * Math.cos(pitch) + Math.sin(elev);
    const elbow = [sh[0] + side * 0.05 + arm * ex * right, sh[1] + s * arm * ey, sh[2] + arm * ez];
    const wrist = [elbow[0] + fore * ex * right * 1.2, elbow[1] + s * fore * (ey + 0.5), elbow[2] + fore * (ez + (sw ? 0.3 : -0.2))];
    J[`shoulder${S2}`] = sh; J[`elbow${S2}`] = elbow; J[`wrist${S2}`] = wrist;
    void isRacquet;
  }
  const neck = [x, y, shoulderZ + 0.08], head = [x, y + s * 0.03, neck[2] + 0.16];
  seg(B.trunk, [x, y, hipZ], neck, LIMB_R * 1.8);
  for (const S2 of ['L', 'R']) {
    seg(B.limbs[`thigh${S2}`], J[`hip${S2}`], J[`knee${S2}`], LIMB_R * 1.15); seg(B.limbs[`shin${S2}`], J[`knee${S2}`], J[`ankle${S2}`], LIMB_R);
    seg(B.limbs[`arm${S2}`], J[`shoulder${S2}`], J[`elbow${S2}`], LIMB_R); seg(B.limbs[`fore${S2}`], J[`elbow${S2}`], J[`wrist${S2}`], LIMB_R * 0.9);
  }
  // the racquet: from the right wrist on along the forearm's line, a little longer
  const w = J.wristR, e = J.elbowR, d = [w[0] - e[0], w[1] - e[1], w[2] - e[2]], n = Math.hypot(d[0], d[1], d[2]) || 1;
  seg(B.racquet, w, [w[0] + (d[0] / n) * 0.55, w[1] + (d[1] / n) * 0.55, w[2] + (d[2] / n) * 0.55], LIMB_R * 0.6);
  B.head.fill.position.set(head[0], head[1], head[2]); B.head.fill.scale.setScalar(0.11);
  B.head.ink.position.copy(B.head.fill.position); B.head.ink.scale.setScalar(0.11 * 1.12);
  B.shadow.position.set(x, y, 0.01);
}
const ballMesh = new THREE.Mesh(GEO_BALL, new THREE.MeshBasicMaterial({ color: 0xd9e84a, vertexColors: true }));
const ballInk = new THREE.Mesh(GEO_BALL, INK);
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
scene.add(ballMesh, ballInk, ballShadow);
function placeBall(S) {
  const b = S.sim.bodies[0], r = Math.max(0.075, b.radius), [x, y, z] = toStage(b.position[0], b.position[1], b.position[2]);
  ballMesh.position.set(x, y, z); ballMesh.scale.setScalar(r); ballInk.position.set(x, y, z); ballInk.scale.setScalar(r * 1.15);
  ballShadow.position.set(x, y, 0.012); ballShadow.scale.setScalar(r * Math.max(0.5, 1.4 - z * 0.15));
}

// ── the match ────────────────────────────────────────────────────────────────────────────────────────────────

let ctx = null, S = null, bodies = [], phase = 'wait', waited = 0, banner = null, lastParams = null, calls = 0;
const BANNER = 90;
function begin(params = {}) {
  lastParams = params;
  for (const B of bodies) scene.remove(B.group, B.shadow);
  ctx = matchContext({ ...CA, players: params.players ?? CA.players, register: params.register ?? CA.register, level: params.level ?? CA.level, seed: params.seed ?? CA.seed });
  S = newMatch(ctx);
  bodies = S.p.map((_, i) => makePlayer(COLORS[i]));
  banner = null; calls = 0;
  phase = 'match';
}
function post(msg) { if (hosted) window.parent.postMessage(msg, '*'); }
if (hosted) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.moj !== CA.wire.init || d.contractVersion !== CA.wire.version) return;
    begin((d.params && d.params.court) || {});
  });
  post({ moj: CA.wire.ready, contractVersion: CA.wire.version, levelRef: 'court' });
}
const sideName = (i) => (i < ctx.players ? `P${i + 1}` : 'CPU');
const CALL_WORDS = { out: 'OUT', 'double-bounce': 'NOT UP', 'own-side': 'INTO THE NET', net: 'NET', 'reach-over': 'OVER THE NET', touches: 'TWICE', 'double-touch': 'TWICE', 'volleyed-serve': 'VOLLEYED', 'touched-own-serve': 'OWN SERVE', 'net-touch': 'NET TOUCH', 'foot-fault': 'FOOT FAULT', 'double-fault': 'DOUBLE FAULT' };
function readCalls() {
  for (; calls < S.calls.length; calls++) {
    const c = S.calls[calls];
    if (c.kind === 'point') banner = { text: CALL_WORDS[c.why] || c.why.toUpperCase(), left: BANNER, color: '#ffd23a' };
    else if (c.kind === 'fault') banner = { text: 'FAULT', left: BANNER * 0.7, color: '#e0503a' };
    else if (c.kind === 'let') banner = { text: 'LET', left: BANNER * 0.7, color: '#fff' };
    else if (c.kind === 'game') banner = { text: 'GAME', left: BANNER, color: '#3ae08a' };
    else if (c.kind === 'set') banner = { text: 'SET', left: BANNER * 1.3, color: '#3ae08a' };
    else if (c.kind === 'over') banner = { text: `GAME, SET AND MATCH · ${c.winner === 'a' ? sideName(0) : sideName(1)}`, left: BANNER * 3, color: '#3ae08a' };
  }
}
function tick() {
  const pads = Array.from({ length: ctx ? ctx.players : CA.players }, (_, i) => padOf(i, i === 0 ? 'a' : 'b'));
  const start = startEdge(pads);
  if (phase === 'wait') { if (!hosted || ++waited > 90) begin({}); return; }
  if (phase === 'over') { if (start) begin(lastParams); return; }
  if (phase !== 'match') return;
  stepMatch(S, pads, ctx);
  readCalls();
  if (banner && --banner.left <= 0) banner = null;
  if (S.over && S.dead === 0) {
    const won = ctx.players === 0 || S.winner === 'a';
    if (hosted) { post({ moj: CA.wire.outcome, envelope: { result: won ? 'success' : 'fail', events: [], stats: { court: { winner: S.winner, score: S.K.score } } } }); phase = 'done'; }
    else phase = 'over';
  }
}

function frameCamera() {
  const b = S.sim.bodies[0];
  const wantX = (S.p[0].x + S.p[1].x) / 2 * 0.5 + b.position[0] * 0.2;
  cam.x += (wantX - cam.x) * 0.06;
  if (camera.fov !== 44) { camera.fov = 44; camera.updateProjectionMatrix(); }
  camera.position.set(cam.x, NET_Y - CT.halfL - 10.5, 6.5);
  camera.lookAt(cam.x * 0.5, NET_Y + 1.5, 0.4);
}
function text(str, x, y, size, color, align = 'center', weight = 800) { g2.font = `${weight} ${size}px ${FONT}`; g2.textAlign = align; g2.textBaseline = 'middle'; g2.fillStyle = color; g2.fillText(str, x, y); }
function outlined(str, x, y, size, color) { g2.font = `900 ${size}px ${FONT}`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineWidth = Math.max(3, size / 9); g2.strokeStyle = '#000'; g2.lineJoin = 'round'; g2.strokeText(str, x, y); g2.fillStyle = color; g2.fillText(str, x, y); }
function draw() {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!S) { outlined('GET READY', OW / 2, OH / 2, 40, '#fff'); return; }
  frameCamera();
  S.p.forEach((P, i) => posePlayer(bodies[i], P));
  placeBall(S);
  const d = matchDisplay(S, ctx);
  // the scoreboard: a row a side, the sets, the games, the points, the server marked
  g2.fillStyle = 'rgba(0,0,0,0.55)'; g2.fillRect(14, 14, 300, 68);
  text(CA.title || CA.sport.words, 18, 96, 12, 'rgba(255,255,255,0.75)', 'left', 500);
  ['a', 'b'].forEach((side, i) => {
    const y = 32 + i * 30, sc = d.score[side], col = COLORS[i];
    text(`${d.server === side ? '● ' : '   '}${sideName(i)}`, 22, y, 16, col, 'left', 700);
    text(sc[2], 200, y, 16, '#fff', 'right', 600); text(sc[1], 240, y, 16, '#fff', 'right', 600); text(sc[0], 300, y, 18, '#ffd23a', 'right', 800);
  });
  text('sets  games  points', 300, 76, 10, 'rgba(255,255,255,0.6)', 'right', 500);
  if (d.faults === 1 && S.K.phase === 'serve') text('second serve', OW / 2, 30, 14, '#fff', 'center', 600);
  if (banner) outlined(banner.text, OW / 2, OH * 0.26, 44, banner.color);
  if (phase === 'over') text('press start to play again', OW / 2, OH * 0.36, 14, '#fff', 'center', 500);
}

// the page calls this from its frame step with its clock in seconds; the match steps at 60 Hz
let acc = 0, last = null;
function stepCourtArena(t) {
  if (last === null) last = t;
  acc += Math.min(0.1, Math.max(0, t - last));
  last = t;
  let ticked = false;
  while (acc >= 1 / MATCH_FPS) { acc -= 1 / MATCH_FPS; tick(); ticked = true; }
  if (ticked) IN.latch.clear();
  draw();
}

window.__mojCourt = {
  get state() { return S; }, get phase() { return phase; }, get ctx() { return ctx; },
  display: () => (S ? matchDisplay(S, ctx) : null),
  // a probe's run: so many seconds of the match stepped at once, the players' pads at rest (the minds play)
  run(seconds) { if (phase === 'wait') begin({}); const n = Math.round(seconds * MATCH_FPS); for (let i = 0; i < n && phase === 'match'; i++) tick(); return S; },
};
