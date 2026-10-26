/**
 * meet arena — the athletic meet in a browser (inlined into the World page's meet block after the contest kernel and the
 * meet sim: scene/channels/contest.js). From the page it uses only what a channel may: `THREE`, `scene`, `camera`,
 * `controls`, `wrap`, and `__ctrlOwnsCamera` (it owns the camera from the start).
 *
 * The pads: up to four players on one keyboard (P1 F to run and G to hop, or Space; P2 J and K; P3 Z and X; P4 , and .)
 * and the gamepads by index (south runs, east hops, start begins again); the other lanes are the computer's. The
 * runners are stick figures posed from the sim's stride in their lanes' broadcast colours, or a lane's athlete in its
 * own body on the same stride (a character made with create_character: athlete.client.js, when the track carries
 * bodies), the track its lanes, flights and board, the camera a broadcast side view that follows the field. The overlay
 * is the broadcast package (broadcast/broadcast.client.js): the open with the field, the bug (each lane's time or best,
 * the race clock), the starter's calls on their plates (ON YOUR MARKS, SET, GO, a false start), the winner's time as it
 * crosses, the closeup on the winner or a jump's landing once no player's lane still runs, and the results board with
 * its medals.
 *
 * As a level: hosted in a game's frame it posts READY, runs the meet INIT brings (players, register, seed over the
 * track's own), and posts the OUTCOME when the placings are in: success when a player's lane placed first (or no
 * player holds a lane: an exhibition), fail otherwise, the placings as stats. On its own it starts at once and runs
 * again on start.
 */
/* global MEET_ARENA, THREE, scene, camera, controls, wrap, newMeet, stepMeet, meetContext, meetLanes, PAD, HURDLE, FPS, athleteRig, placeAthlete, newBroadcast, tvNames, tvAdvance, tvCall, tvPlate, tvOpen, tvBoard, tvCut, tvShot, tvDraw */

const MA = MEET_ARENA, TK = MA.track;
// the lanes' athletes in their own bodies, when the track carries them (athlete.client.js inlined before this)
const ATH = typeof athleteRig === 'function' && MA.bodies ? athleteRig(MA) : null;
const hosted = window.parent !== window;
const BC = MA.broadcast, TV = newBroadcast(BC);
const COLORS = BC.colors.map((c) => c.base);   // the lanes' kits are the broadcast's: the bug's chip and the vest agree

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
__ctrlOwnsCamera = true;   // the page's loop leaves the camera to the meet
const trackMidY = (TK.lanesY[0] + TK.lanesY[TK.lanesY.length - 1]) / 2;
const cam = { x: TK.x0 + 8, dist: Math.max(9, MA.lanes * TK.laneW * 1.7) };

// ── input ────────────────────────────────────────────────────────────────────────────────────────────────────

const MEET_KEYS = [
  { run: ['KeyF', 'Space'], jump: ['KeyG'], start: ['Enter'] },
  { run: ['KeyJ'], jump: ['KeyK'], start: ['NumpadEnter'] },
  { run: ['KeyZ'], jump: ['KeyX'], start: [] },
  { run: ['Comma'], jump: ['Period'], start: [] },
];
const IN = { held: new Set(), latch: new Set() };
window.addEventListener('keydown', (e) => { IN.held.add(e.code); IN.latch.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
window.addEventListener('keyup', (e) => IN.held.delete(e.code));
window.addEventListener('blur', () => IN.held.clear());
const anyHeld = (list) => list.some((k) => IN.held.has(k) || IN.latch.has(k));
function padOf(i) {
  const K = MEET_KEYS[i] || MEET_KEYS[0];
  let run = anyHeld(K.run), jump = anyHeld(K.jump), start = anyHeld(K.start);
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads[i];
  if (gp) {
    const btn = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed);
    run = run || btn(0); jump = jump || btn(1); start = start || btn(9);
  }
  return { b: (run ? PAD.RUN : 0) | (jump ? PAD.JUMP : 0) | (start ? PAD.START : 0) };
}
let startWas = false;
function startEdge(pads) {
  const now = pads.some((p) => p.b & PAD.START) || anyHeld(['Enter']);
  const edge = now && !startWas; startWas = now;
  return edge;
}

// ── the track and the runners ────────────────────────────────────────────────────────────────────────────────

function shaded(geo) {
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) { const k = 0.5 + 0.5 * Math.max(0, n.getX(i) * -0.35 + n.getY(i) * -0.55 + n.getZ(i) * 0.75); c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const CYL = shaded(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2));
const BALL = shaded(new THREE.SphereGeometry(1, 14, 10));
const INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xf2f2ee });
const WOOD = new THREE.MeshBasicMaterial({ color: 0xc9a24a });
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
function box(w, d, h, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat); m.position.set(x, y, z); dressing.add(m); return m; }
function dressTrack() {
  const x1 = TK.x0 - 3, x2 = TK.finish + 10, len = x2 - x1, mid = (x1 + x2) / 2;
  for (let i = 0; i <= MA.lanes; i++) box(len, 0.05, 0.012, mid, TK.lanesY[0] - TK.laneW / 2 + i * TK.laneW, 0.006, WHITE);   // the lane lines
  box(0.06, MA.lanes * TK.laneW, 0.012, TK.x0, trackMidY, 0.007, WHITE);   // the start
  if (MA.event.measure === 'time') box(0.1, MA.lanes * TK.laneW, 0.014, TK.finish, trackMidY, 0.008, WHITE);   // the line
  for (const hx of TK.hurdlesX || []) for (const y of TK.lanesY) {   // a flight: two posts and the bar
    box(0.05, 0.05, HURDLE.height, hx, y - 0.5, HURDLE.height / 2, POST); box(0.05, 0.05, HURDLE.height, hx, y + 0.5, HURDLE.height / 2, POST);
    box(0.06, 1.05, 0.07, hx, y, HURDLE.height - 0.035, WHITE);
  }
  if (TK.boardX !== undefined) { box(0.2, MA.lanes * TK.laneW, 0.02, TK.boardX, trackMidY, 0.01, WOOD); box(8, MA.lanes * TK.laneW, 0.01, TK.boardX + 5, trackMidY, 0.005, new THREE.MeshBasicMaterial({ color: 0xd8c39a })); }
}
dressTrack();

// a stick figure: the trunk, the head, each thigh and shin, each arm, a shadow; posed from the sim's stride
const LIMB_R = 0.055;
function makeRunner(color) {
  const near = new THREE.MeshBasicMaterial({ color, vertexColors: true });
  const group = new THREE.Group();
  const part = (geo) => { const fill = new THREE.Mesh(geo, near), ink = new THREE.Mesh(geo, INK); group.add(fill, ink); return { fill, ink }; };
  const B = { group, trunk: part(CYL), head: part(BALL), limbs: Object.fromEntries(['thighL', 'thighR', 'shinL', 'shinR', 'armL', 'armR', 'foreL', 'foreR'].map((k) => [k, part(CYL)])) };
  B.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  scene.add(group, B.shadow);
  return B;
}
const seg = (P, a, b, r) => { vA.set(a[0], a[1], a[2]); vB.set(b[0], b[1], b[2]); cylinderAt(P.fill, vA, vB, r); cylinderAt(P.ink, vA, vB, r * 1.3); };
// the body's joints from a stride phase (and the air, the stumble, the end), in metres about the lane's point
function poseRunner(B, r, laneY, S) {
  const x = TK.x0 + r.x, y = laneY;
  const s = r.stride * 2 * Math.PI, air = r.air > 0, moving = r.v > 0.3;
  let hop = 0;
  if (air && r.hop) { const u = 1 - r.air / Math.max(1e-6, r.airT || r.air); hop = 0; void u; }
  if (air) { const span = r.hop ? Math.max(0.3, r.hop.d ? (2 * r.v * Math.sin(0.4)) / 9.81 : 0.4) : HURDLE.air; const u = Math.min(1, Math.max(0, 1 - r.air / span)); hop = (r.hop ? 0.9 : 0.55) * Math.sin(Math.PI * u); }
  const lean = r.stumble > 0 ? 0.6 : moving ? 0.18 + 0.06 * Math.min(1, r.v / 8) : 0;
  const hipZ = 0.95 - (moving ? 0.03 * Math.abs(Math.sin(s)) : 0) + hop, legL = 0.46, shin = 0.44, arm = 0.3, fore = 0.28;
  const hip = (side) => [x, y + side * 0.1, hipZ];
  const swing = air ? { L: 1.1, R: -0.8 } : moving ? { L: 0.75 * Math.sin(s), R: -0.75 * Math.sin(s) } : { L: 0, R: 0 };
  const kneeBend = (sw) => (air ? 1.2 : moving ? 0.5 + 0.9 * Math.max(0, -sw) : 0.05);
  const joints = {};
  for (const [S2, side] of [['L', -1], ['R', 1]]) {
    const h = hip(side), a = swing[S2], k = kneeBend(a);
    const knee = [h[0] + legL * Math.sin(a), h[1], h[2] - legL * Math.cos(a)];
    const ankle = [knee[0] + shin * Math.sin(a - k), knee[1], knee[2] - shin * Math.cos(a - k)];
    joints[`knee${S2}`] = knee; joints[`ankle${S2}`] = ankle; joints[`hip${S2}`] = h;
  }
  const shoulderZ = hipZ + 0.52, shX = x + 0.52 * Math.sin(lean), shoulder = (side) => [shX, y + side * 0.17, shoulderZ * Math.cos(lean) + hipZ * (1 - Math.cos(lean))];
  for (const [S2, side] of [['L', -1], ['R', 1]]) {
    const sh = shoulder(side), a = (air ? 0.4 : moving ? -0.9 * Math.sin(s) * (S2 === 'L' ? 1 : -1) : 0.1) + (r.done && r.t !== null ? 2.6 : 0);
    const elbow = [sh[0] + arm * Math.sin(a), sh[1], sh[2] - arm * Math.cos(a)];
    const wrist = [elbow[0] + fore * Math.sin(a + (moving ? 1.3 : 0.3)), elbow[1], elbow[2] - fore * Math.cos(a + (moving ? 1.3 : 0.3))];
    joints[`shoulder${S2}`] = sh; joints[`elbow${S2}`] = elbow; joints[`wrist${S2}`] = wrist;
  }
  const neck = [(joints.shoulderL[0] + joints.shoulderR[0]) / 2, y, joints.shoulderL[2] + 0.08];
  const head = [neck[0] + 0.06 * Math.sin(lean) + (r.dq ? 0.05 : 0), y, neck[2] + 0.16 - (r.dq ? 0.06 : 0)];
  if (!B.trunk) { B.joints = { ...joints, pelvis: [x, y, hipZ], neck }; B.hop = hop; return; }   // the stick alone (an athlete's)
  seg(B.trunk, [x, y, hipZ], neck, LIMB_R * 1.8);
  for (const [S2] of [['L'], ['R']]) {
    seg(B.limbs[`thigh${S2}`], joints[`hip${S2}`], joints[`knee${S2}`], LIMB_R * 1.15); seg(B.limbs[`shin${S2}`], joints[`knee${S2}`], joints[`ankle${S2}`], LIMB_R);
    seg(B.limbs[`arm${S2}`], joints[`shoulder${S2}`], joints[`elbow${S2}`], LIMB_R); seg(B.limbs[`fore${S2}`], joints[`elbow${S2}`], joints[`wrist${S2}`], LIMB_R * 0.9);
  }
  B.head.fill.position.set(head[0], head[1], head[2]); B.head.fill.scale.setScalar(0.11);
  B.head.ink.position.copy(B.head.fill.position); B.head.ink.scale.setScalar(0.11 * 1.12);
  B.shadow.position.set(x, y, 0.01); B.shadow.scale.setScalar(Math.max(0.5, 1 - hop * 0.6));
}
// a lane's athlete: its own body on the stick's stride, facing down the track, the hop its air
function poseLane(B, r, laneY, S) {
  if (!B.athlete) return poseRunner(B, r, laneY, S);
  const stick = { joints: null };
  poseRunner(stick, r, laneY, S);
  placeAthlete(B, stick.joints, { face: [1, 0], lift: stick.hop });
}

// ── the meet ─────────────────────────────────────────────────────────────────────────────────────────────────

let ctx = null, S = null, bodies = [], phase = 'wait', waited = 0, lastParams = null, calls = 0;
const EVENT_TITLE = MA.title || (MA.event.kind === 'longJump' ? 'long jump' : `${MA.event.distance} m${MA.event.kind === 'hurdles' ? ' hurdles' : ''}`);
function begin(params = {}) {
  lastParams = params;
  for (const B of bodies) scene.remove(B.group, B.shadow);
  ctx = meetContext({ ...MA, players: params.players ?? MA.players, register: params.register ?? MA.register, seed: params.seed ?? MA.seed });
  S = newMeet(ctx);
  bodies = S.r.map((_, i) => (ATH && ATH.has(i) ? ATH.make(i) : makeRunner(COLORS[i % COLORS.length])));
  calls = 0;
  tvOpen(TV, { title: EVENT_TITLE, rows: S.r.map((_, i) => ({ name: laneName(i), color: i })) });
  tvPlate(TV, { text: 'ON YOUR MARKS', tone: 'neutral', hold: 1.2 });
  phase = 'meet';
}
function post(msg) { if (hosted) window.parent.postMessage(msg, '*'); }
if (hosted) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.moj !== MA.wire.init || d.contractVersion !== MA.wire.version) return;
    begin((d.params && d.params.meet) || {});
  });
  post({ moj: MA.wire.ready, contractVersion: MA.wire.version, levelRef: 'meet' });
}
const laneName = (i) => tvNames(BC, MA.lanes, ctx ? ctx.players : MA.players)[i];
const runnerIx = (id) => S.r.findIndex((r) => r.id === id);
const NAMES = { who: (id) => { const i = runnerIx(id); return { name: `${laneName(i)} · LANE ${S.r[i].lane + 1}`, color: i }; } };
// the director: the starter's calls and the field's on their plates; a closeup only once no player's lane still runs
const playerRunning = () => S.r.some((r, i) => i < ctx.players && !r.done && !r.dq);
function readCalls() {
  for (; calls < S.calls.length; calls++) {
    const c = S.calls[calls], q = tvCall(TV, c, NAMES);
    if (c.kind === 'over') {
      const rows = S.placings.map((p) => { const i = runnerIx(p.who); return { place: p.place ?? null, name: laneName(i), color: i, note: `lane ${S.r[i].lane + 1}`, value: p.dq ? 'DQ' : MA.event.measure === 'time' ? fmt(p.value) : p.value === null ? 'NM' : `${p.value.toFixed(2)} m` }; });
      tvBoard(TV, { title: `${EVENT_TITLE} · result`, rows, foot: hosted ? null : 'press start to run again' });
    }
    if (!q || !q.cut || playerRunning()) continue;
    const i = runnerIx(c.who);
    if (i < 0) continue;
    const r = S.r[i];
    tvCut(TV, { on: [TK.x0 + r.x, TK.lanesY[r.lane], 0], hold: 70, strap: { name: laneName(i), line: c.kind === 'finish' ? `first across · ${fmt(c.t)}` : c.kind === 'mark' ? (c.foul ? `attempt ${c.attempt} · foul` : `attempt ${c.attempt} · ${c.value.toFixed(2)} m`) : 'false start', tag: String(r.lane + 1), color: i } });
  }
}
function tick() {
  const pads = Array.from({ length: ctx ? ctx.players : MA.players }, (_, i) => padOf(i));
  const start = startEdge(pads);
  tvAdvance(TV);
  if (phase === 'wait') { if (!hosted || ++waited > 90) begin({}); return; }
  if (phase === 'over') { if (start) begin(lastParams); return; }
  if (phase !== 'meet') return;
  stepMeet(S, pads, ctx);
  readCalls();
  if (S.over) {
    const mine = S.placings.filter((p) => S.r.find((r) => r.id === p.who).lane < ctx.players);
    const won = ctx.players === 0 || mine.some((p) => p.place === 1);
    if (hosted) { post({ moj: MA.wire.outcome, envelope: { result: won ? 'success' : 'fail', events: [], stats: { meet: { placings: S.placings } } } }); phase = 'done'; }
    else phase = 'over';
  }
}

function frameCamera() {
  const live = S.r.filter((r) => !r.done && !r.dq);
  const field = live.length ? live : S.r;
  const lead = Math.max(...field.map((r) => r.x)), tail = Math.min(...field.map((r) => r.x));
  const wantX = TK.x0 + (lead + tail) / 2 + 2;
  cam.x += (wantX - cam.x) * 0.1;
  const aspect = (OW || 16) / (OH || 9), tanH = Math.tan((38 * Math.PI) / 360) * aspect;
  const span = Math.max(8, lead - tail + 10);
  const want = Math.max(cam.dist * 0.6, Math.min(40, span / (2 * tanH)));
  cam.dist += (want - cam.dist) * 0.06;
  if (camera.fov !== 38) { camera.fov = 38; camera.updateProjectionMatrix(); }
  camera.position.set(cam.x, trackMidY - cam.dist, 2.2 + cam.dist * 0.12);
  const look = [cam.x, trackMidY, 1];
  camera.lookAt(look[0], look[1], look[2]);
  tvShot(TV, camera, look);
}
const fmt = (t) => (t === null || t === undefined ? '—' : t.toFixed(2));
const KEYS_HINT = ['F run · G hop', 'J run · K hop', 'Z run · X hop', ', run · . hop'];
function feedOf() {
  const lanes = meetLanes(S), timed = MA.event.measure === 'time', running = S.K.phase === 'running' || S.K.phase === 'live' || lanes.some((L) => L.state === 'running');
  return {
    title: EVENT_TITLE,
    rows: lanes.map((L, i) => ({ name: laneName(i), color: i, mark: L.state === 'dq' ? 'out' : null, cells: [timed ? (L.t !== null ? fmt(L.t) : L.state === 'dq' ? 'DQ' : '') : L.best !== null ? L.best.toFixed(2) : L.marks.length ? 'X' : ''] })),
    ...(timed && (running || S.over) ? { clock: fmt(S.K.t), period: 'race' } : {}),
    ...(timed ? {} : { tab: `best of ${MA.event.attempts} attempts` }),
    hint: ctx.players > 0 && TV.f < 600 ? Array.from({ length: ctx.players }, (_, i) => `${laneName(i)} ${KEYS_HINT[i]}`).join('   ') : null,
  };
}
function draw() {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!S) { tvDraw(TV, g2, OW, OH, null); return; }
  frameCamera();
  S.r.forEach((r, i) => poseLane(bodies[i], r, TK.lanesY[r.lane], S));
  tvDraw(TV, g2, OW, OH, feedOf());
}

// the page calls this from its frame step with its clock in seconds; the meet steps at 60 Hz
let acc = 0, last = null;
function stepMeetArena(t) {
  if (last === null) last = t;
  acc += Math.min(0.1, Math.max(0, t - last));
  last = t;
  let ticked = false;
  while (acc >= 1 / FPS) { acc -= 1 / FPS; tick(); ticked = true; }
  if (ticked) IN.latch.clear();
  draw();
}

window.__mojMeet = {
  // how many players are drawn in their own bodies (athlete.client.js) at this frame
  athletes: () => bodies.filter((B) => B.athlete).length,
  get state() { return S; }, get phase() { return phase; }, get ctx() { return ctx; },
  lanes: () => (S ? meetLanes(S) : null),
  // a probe's run: so many seconds of the meet stepped at once, the players' pads at rest (the computer lanes run)
  run(seconds) { if (phase === 'wait') begin({}); const n = Math.round(seconds * FPS); for (let i = 0; i < n && phase === 'meet'; i++) tick(); return S; },
};
