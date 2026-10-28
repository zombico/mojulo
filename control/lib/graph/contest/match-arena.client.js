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
 * The players are stick figures posed from the sim in their sides' broadcast colours, or a side's athlete in its own
 * body on the same pose (a character made with create_character: athlete.client.js, when the court carries bodies) with
 * the racquet in its hand, the ball a sphere with its shadow, the court its lines from the kernel's regions and the net;
 * a broadcast camera behind side a's baseline. The overlay is the broadcast package (broadcast/broadcast.client.js):
 * the open, the bug (sets, games, the points in the kernel's words, the server), the tab (second serve, deuce,
 * advantage), the kernel's calls on their plates, the closeup on the point's winner in the dead ball with its lower
 * third at a game, and the results board.
 *
 * As a level: hosted in a game's frame it posts READY, plays the match INIT brings (players, register, level, seed over
 * the court's own), and posts the OUTCOME when the match is over: success when side a (the first player's) won, or an
 * exhibition ended; fail otherwise. On its own it starts at once and plays again on start.
 */
/* global COURT_ARENA, THREE, scene, camera, controls, wrap, newMatch, stepMatch, matchContext, matchDisplay, MPAD, MATCH_FPS, contestRegion, athleteRig, placeAthlete, newBroadcast, tvNames, tvAdvance, tvCall, tvOpen, tvBoard, tvPanel, tvCut, tvStrap, tvShot, tvDraw, contestStats, statPanel, statLine, statCompact */

const CA = COURT_ARENA, CT = CA.court, NET_Y = CT.netY;
// the sides' athletes in their own bodies, when the court carries them (athlete.client.js inlined before this)
const ATH = typeof athleteRig === 'function' && CA.bodies ? athleteRig(CA) : null;
const hosted = window.parent !== window;
const BC = CA.broadcast, TV = newBroadcast(BC);
const COLORS = BC.colors.map((c) => c.base);   // the kits are the broadcast's: the bug's chip and the player's shirt agree

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
// a raised bed (the table, arcade-rules.js): the court its top, its lines and net on it; the lines thinner to its size
const BED = CA.sport.bed ? CA.sport.bed.height : 0, LINE = BED ? 0.02 : 0.05;
function lineRect(r) {   // a court-frame rect's four lines on the floor
  const [x0, y0, x1, y1] = r, t = LINE, z = BED + 0.006;
  box(x1 - x0 + t, t, 0.012, (x0 + x1) / 2, NET_Y + y0, z, WHITE); box(x1 - x0 + t, t, 0.012, (x0 + x1) / 2, NET_Y + y1, z, WHITE);
  box(t, y1 - y0 + t, 0.012, x0, NET_Y + (y0 + y1) / 2, z, WHITE); box(t, y1 - y0 + t, 0.012, x1, NET_Y + (y0 + y1) / 2, z, WHITE);
}
function dressCourt() {
  if (BED) {
    // the table: its top a dark blue slab, four legs, its lines on top
    box(CT.width, CT.length, 0.04, 0, NET_Y, BED - 0.02, new THREE.MeshBasicMaterial({ color: 0x1d4f7a }));
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.05, 0.05, BED - 0.04, x * (CT.halfW - 0.15), NET_Y + y * (CT.halfL - 0.25), (BED - 0.04) / 2, POST);
  }
  for (const side of ['a', 'b']) for (const name of Object.keys(CT.regions)) { if (name === 'backcourt') continue; lineRect(contestRegion(CA.C, name, side).rect); }
  // the net: two posts past the sidelines, the band along the top, the mesh a dark pane
  const half = CT.halfW + CT.net.beyond, h = CT.net.height, band = Math.min(0.06, h * 0.2), post = Math.min(0.08, h * 0.3);
  box(post, post, CT.net.posts, -half, NET_Y, BED + CT.net.posts / 2, POST); box(post, post, CT.net.posts, half, NET_Y, BED + CT.net.posts / 2, POST);
  box(half * 2, Math.min(0.03, h * 0.1), band, 0, NET_Y, BED + h - band / 2, WHITE);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.01, h - band), new THREE.MeshBasicMaterial({ color: 0x1b1f28, transparent: true, opacity: 0.55, depthWrite: false }));
  pane.position.set(0, NET_Y, BED + (h - band) / 2); dressing.add(pane);
}
dressCourt();

const LIMB_R = 0.055;
// the racquet's length: a paddle or a bat as short as the sport's reach is (its `pace`), the racquet's otherwise
// (bare hands, volleyball's: none drawn)
const RQ = CA.sport.bare ? 0 : 0.55 * (CA.sport.pace && CA.sport.pace.reach ? CA.sport.pace.reach : 1);
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
// a side's athlete: its own body, and the racquet it holds
function makeAthlete(i) {
  const A = ATH.make(i), fill = new THREE.Mesh(GEO_CYL, new THREE.MeshBasicMaterial({ color: 0xd8d2c2, vertexColors: true })), ink = new THREE.Mesh(GEO_CYL, INK);
  A.group.add(fill, ink); A.racquet = { fill, ink };
  return A;
}
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
  if (B.athlete) {
    // its own body on the stick's pose, facing the net; the racquet on along its own forearm from its own wrist
    const N = placeAthlete(B, { ...J, pelvis: [x, y, hipZ], neck }, { face: [0, s] });
    const w = N.wristR, e = N.elbowR, d = [w[0] - e[0], w[1] - e[1], w[2] - e[2]], n = Math.hypot(d[0], d[1], d[2]) || 1, h = N.hand || 0.09;
    const g = [w[0] + (d[0] / n) * h, w[1] + (d[1] / n) * h, w[2] + (d[2] / n) * h];
    seg(B.racquet, g, [g[0] + (d[0] / n) * RQ, g[1] + (d[1] / n) * RQ, g[2] + (d[2] / n) * RQ], LIMB_R * 0.6);
    return;
  }
  seg(B.trunk, [x, y, hipZ], neck, LIMB_R * 1.8);
  for (const S2 of ['L', 'R']) {
    seg(B.limbs[`thigh${S2}`], J[`hip${S2}`], J[`knee${S2}`], LIMB_R * 1.15); seg(B.limbs[`shin${S2}`], J[`knee${S2}`], J[`ankle${S2}`], LIMB_R);
    seg(B.limbs[`arm${S2}`], J[`shoulder${S2}`], J[`elbow${S2}`], LIMB_R); seg(B.limbs[`fore${S2}`], J[`elbow${S2}`], J[`wrist${S2}`], LIMB_R * 0.9);
  }
  // the racquet: from the right wrist on along the forearm's line, a little longer
  const w = J.wristR, e = J.elbowR, d = [w[0] - e[0], w[1] - e[1], w[2] - e[2]], n = Math.hypot(d[0], d[1], d[2]) || 1;
  seg(B.racquet, w, [w[0] + (d[0] / n) * RQ, w[1] + (d[1] / n) * RQ, w[2] + (d[2] / n) * RQ], LIMB_R * 0.6);
  B.head.fill.position.set(head[0], head[1], head[2]); B.head.fill.scale.setScalar(0.11);
  B.head.ink.position.copy(B.head.fill.position); B.head.ink.scale.setScalar(0.11 * 1.12);
  B.shadow.position.set(x, y, 0.01);
}
// the ball in its colour: a table-tennis ball's white, a shuttle's, a volleyball's, the felt yellow of a tennis ball otherwise
const ballMesh = new THREE.Mesh(GEO_BALL, new THREE.MeshBasicMaterial({ color: { pingpong: 0xf6f1e4, shuttle: 0xfbfbf8, volleyball: 0xf1e6c4 }[CA.sport.ball] ?? 0xd9e84a, vertexColors: true }));
const ballInk = new THREE.Mesh(GEO_BALL, INK);
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
scene.add(ballMesh, ballInk, ballShadow);
function placeBall(S) {
  const b = S.sim.bodies[0], r = Math.max(0.075, b.radius), [x, y, z] = toStage(b.position[0], b.position[1], b.position[2]);
  ballMesh.position.set(x, y, z); ballMesh.scale.setScalar(r); ballInk.position.set(x, y, z); ballInk.scale.setScalar(r * 1.15);
  const onBed = BED && Math.abs(b.position[0]) <= CT.halfW && Math.abs(b.position[1]) <= CT.halfL, sz = onBed ? BED + 0.012 : 0.012;
  ballShadow.position.set(x, y, sz); ballShadow.scale.setScalar(r * Math.max(0.5, 1.4 - (z - sz) * 0.15));
}

// ── the match ────────────────────────────────────────────────────────────────────────────────────────────────

let ctx = null, S = null, bodies = [], phase = 'wait', waited = 0, lastParams = null, calls = 0;
const SPORT = (CA.sport.id || 'match').replace(/-/g, ' ');
function begin(params = {}) {
  lastParams = params;
  for (const B of bodies) scene.remove(B.group, B.shadow);
  ctx = matchContext({ ...CA, players: params.players ?? CA.players, register: params.register ?? CA.register, level: params.level ?? CA.level, seed: params.seed ?? CA.seed });
  S = newMatch(ctx);
  bodies = S.p.map((P, i) => (ATH && ATH.has(i) ? makeAthlete(i) : makePlayer(COLORS[sideIx(P.side)])));
  calls = 0; games = 0;
  tvOpen(TV, { title: CA.title || SPORT, rows: [0, 1].map((i) => ({ name: sideName(i), color: i })) });
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
const sideName = (i) => tvNames(BC, 2, ctx ? ctx.players : CA.players)[i];
const sideIx = (side) => (side === 'a' ? 0 : 1);
const NAMES = { side: (side) => ({ name: sideName(sideIx(side)), color: sideIx(side) }) };
// the stats the coverage shows (broadcast-package.js STAT_COVERAGE: the panel at the changeovers, the match's strap and
// the board), folded from the match's calls when shown (contest-stats.js); null when the recipe turns them off
const STATS = BC.stats || null, COLS = () => [0, 1].map((i) => ({ name: sideName(i), color: i }));
const statsNow = () => contestStats(S, 'match');
const withStats = (line, side, rows) => { const extra = STATS && rows && rows.length ? statLine(statsNow(), side, rows) : ''; return extra ? `${line} · ${extra}` : line; };
let games = 0;
// the ladder's counts as the board names them, the top first: SETS, GAMES, PTS (tennis), GAMES, PTS (a rally game)
const UNITS = CA.C.scoring.ladder.map((u, i) => Object.assign(new String(i === 0 ? 'PTS' : `${CA.C.scoring.ladder[i - 1].unit.toUpperCase()}S`), { ix: i })).reverse();
// the director: each call on its plate; in the dead ball after a point, a game or the match, the closeup on its winner
function readCalls() {
  for (; calls < S.calls.length; calls++) {
    const c = S.calls[calls], q = tvCall(TV, c, NAMES);
    if (!q) continue;
    const side = c.kind === 'over' ? c.winner : c.side;
    if (q.cut === 'winner' && (side === 'a' || side === 'b')) {
      const P = S.p.find((p) => p.side === side), [x, y] = toStage(P.x, P.y), sc = S.K.score[side], op = S.K.score[side === 'a' ? 'b' : 'a'];
      const line = [c.kind === 'over' ? 'THE MATCH' : q.text, ...UNITS.slice(0, -1).map((u) => `${u} ${sc[u.ix] ?? 0}–${op[u.ix] ?? 0}`)].join(' · ');
      const strap = q.unit || c.kind === 'over' ? { name: sideName(sideIx(side)), line: c.kind === 'over' && STATS ? withStats(line, side, STATS.strap) : line, tag: side === 'a' ? '1' : '2', color: sideIx(side) } : null;
      tvCut(TV, { on: [x, y, 0], hold: c.kind === 'over' ? 110 : 54, ...(strap ? { strap } : {}) });
    }
    // at a changeover (the end of an odd game: the players change ends), the stats panel
    if (c.kind === 'game' && STATS && STATS.at === 'changeover' && ++games % 2 === 1 && S.K.phase !== 'over') tvPanel(TV, statPanel(statsNow(), STATS.panel, COLS(), `${SPORT} · changeover`));
    if (c.kind === 'over') {
      const rows = ['a', 'b'].sort((p, q2) => (p === c.winner ? -1 : q2 === c.winner ? 1 : 0)).map((side, k) => ({ place: k + 1, name: sideName(sideIx(side)), color: sideIx(side), value: String(c.score[side][c.score[side].length - 1]), note: withStats(UNITS[0].toLowerCase(), side, STATS && STATS.board) }));
      tvBoard(TV, { title: `${SPORT} · final`, rows, foot: hosted ? null : 'press start to play again' });
    }
  }
}
function tick() {
  const pads = Array.from({ length: ctx ? ctx.players : CA.players }, (_, i) => padOf(i, i === 0 ? 'a' : 'b'));
  const start = startEdge(pads);
  tvAdvance(TV);
  if (phase === 'wait') { if (!hosted || ++waited > 90) begin({}); return; }
  if (phase === 'over') { if (start) begin(lastParams); return; }
  if (phase !== 'match') return;
  stepMatch(S, pads, ctx);
  readCalls();
  if (S.over && S.dead === 0) {
    const won = ctx.players === 0 || S.winner === 'a';
    if (hosted) { post({ moj: CA.wire.outcome, envelope: { result: won ? 'success' : 'fail', events: [], stats: { court: { winner: S.winner, score: S.K.score }, contest: statCompact(statsNow()) } } }); phase = 'done'; }
    else phase = 'over';
  }
}

// the broadcast camera behind side a's end, nearer and lower for a small court (a table, a pickleball court)
const CAM = CT.halfL >= 8 ? { back: 10.5, up: 6.5, ahead: 1.5, low: 0.4 } : { back: 3.4 + CT.halfL * 0.6, up: BED + 2 + CT.halfL * 0.45, ahead: CT.halfL * 0.15, low: BED };
function frameCamera() {
  const b = S.sim.bodies[0];
  const wantX = (S.p[0].x + S.p[1].x) / 2 * 0.5 + b.position[0] * 0.2;
  cam.x += (wantX - cam.x) * 0.06;
  if (camera.fov !== 44) { camera.fov = 44; camera.updateProjectionMatrix(); }
  camera.position.set(cam.x, NET_Y - CT.halfL - CAM.back, CAM.up);
  const look = [cam.x * 0.5, NET_Y + CAM.ahead, CAM.low];
  camera.lookAt(look[0], look[1], look[2]);
  tvShot(TV, camera, look);
}
// the scoreboard's words as the bug shows them: deuce is 40 all and said on the tab, the advantage AD
const POINT_CELL = { deuce: '40', advantage: 'AD', '-': '40' };
function feedOf(d) {
  const pa = d.score.a[0], tab = d.faults === 1 && S.K.phase === 'serve' ? 'second serve' : pa === 'deuce' ? 'deuce' : pa === 'advantage' ? `advantage ${sideName(0)}` : d.score.b[0] === 'advantage' ? `advantage ${sideName(1)}` : null;
  return {
    title: CA.title || SPORT, cols: UNITS.map(String), hot: UNITS.length - 1,
    rows: ['a', 'b'].map((side, i) => { const sc = d.score[side]; return { name: sideName(i), color: i, cells: UNITS.map((u) => (u.ix === 0 ? POINT_CELL[sc[0]] ?? sc[0] : sc[u.ix])), mark: d.server === side ? 'serve' : null }; }),
    tab,
    hint: ctx.players > 0 && TV.f < 600 ? `${sideName(0)} · W A S D move · F swing` : null,
  };
}
function draw() {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!S) { tvDraw(TV, g2, OW, OH, null); return; }
  frameCamera();
  S.p.forEach((P, i) => posePlayer(bodies[i], P));
  placeBall(S);
  tvDraw(TV, g2, OW, OH, feedOf(matchDisplay(S, ctx)));
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
  // how many players are drawn in their own bodies (athlete.client.js) at this frame
  athletes: () => bodies.filter((B) => B.athlete).length,
  get state() { return S; }, get phase() { return phase; }, get ctx() { return ctx; },
  display: () => (S ? matchDisplay(S, ctx) : null),
  // a probe's run: so many seconds of the match stepped at once, the players' pads at rest (the minds play)
  run(seconds) { if (phase === 'wait') begin({}); const n = Math.round(seconds * MATCH_FPS); for (let i = 0; i < n && phase === 'match'; i++) tick(); return S; },
};
