/**
 * innings arena — a bat-and-ball game in a browser (inlined into the World page's innings block after the physics, the
 * ball card, the contest kernel and the bat sim: scene/channels/contest.js). From the page it uses only what a channel
 * may: `THREE`, `scene`, `camera`, `controls`, `wrap`, and `__ctrlOwnsCamera` (it owns the camera from the start).
 *
 * Two pads on one keyboard (P1 WASD and F or Space; P2 the arrows and the right Shift or the keypad 0; Enter begins
 * again) and the gamepads by index: the side at the bat swings (the press, timed against the ball; the stick sprays it
 * left or right and lifts it), the side in the field pitches or bowls (the stick aims across the zone and up it, or the
 * line and the length; the press lets it go); the sides nobody holds are the computer's. The field is drawn from the
 * sport's dials (a diamond's infield, bases, mound and foul lines, its fence; an oval's square, its wickets and its
 * rope), the players as capsules in their side's broadcast colour (or in their own bodies, athlete.client.js), the ball
 * with its shadow. The camera stands behind the batter and follows a struck ball out. The overlay is the broadcast
 * package: the bug (the runs, the inning or the over, the outs, the count), the kernel's calls on their plates
 * (STRIKE, FOUL BALL, STRUCK OUT, CAUGHT, BOWLED, SINGLE … HOME RUN!, FOUR!, SIX!, SIDE RETIRED, END OF THE OVER), the
 * stats panel at each side retired, and the results board.
 *
 * As a level: hosted in a game's frame it posts READY, plays the game INIT brings (players, register, level, seed over
 * the field's own), and posts the OUTCOME at the end. On its own it starts at once and runs again on start.
 */
/* global INNINGS_ARENA, THREE, scene, camera, controls, wrap, newBat, stepBat, batContext, batDisplay, BPAD, BAT_FPS, athleteRig, placeAthlete, strideStick, newBroadcast, tvNames, tvAdvance, tvCall, tvOpen, tvBoard, tvPanel, tvCut, tvShot, tvDraw, contestStats, statPanel, statLine, statCompact */

const IA = INNINGS_ARENA, FT = IA.field, SP = IA.sport;
const hosted = window.parent !== window;
const BC = IA.broadcast, TV = newBroadcast(BC);
const SIDE_COLORS = { a: BC.colors[0].base, b: BC.colors[1].base };
const OY = FT.originY;   // the batter, the field frame's origin on the stage
const ATH = typeof athleteRig === 'function' && IA.bodies ? athleteRig(IA) : null;
const STRIDE = 2.2;
const BASES = !!SP.field.fair;   // a diamond (bases), or an oval (runs)

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
__ctrlOwnsCamera = true;
const cam = { x: 0, y: OY - 13, z: 3, lx: 0, ly: OY + 12, lz: 0.9 };

// ── input: two pads ──────────────────────────────────────────────────────────────────────────────────────────

const KEYS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], swing: ['KeyF', 'Space'], start: ['Enter'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], swing: ['ShiftRight', 'Numpad0'], start: ['NumpadEnter'] },
];
const IN = { held: new Set() };
window.addEventListener('keydown', (e) => { IN.held.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
window.addEventListener('keyup', (e) => IN.held.delete(e.code));
window.addEventListener('blur', () => IN.held.clear());
const anyHeld = (list) => list.some((k) => IN.held.has(k));
function padOf(i) {
  const K = KEYS[i] || KEYS[0];
  let x = (anyHeld(K.right) ? 1 : 0) - (anyHeld(K.left) ? 1 : 0), y = (anyHeld(K.up) ? 1 : 0) - (anyHeld(K.down) ? 1 : 0);
  let swing = anyHeld(K.swing), start = anyHeld(K.start);
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads[i];
  if (gp) {
    const btn = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed), dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    if (!x) x = dz(gp.axes[0] || 0); if (!y) y = -dz(gp.axes[1] || 0);
    swing = swing || btn(0); start = start || btn(9);
  }
  return { x, y, b: (swing ? BPAD.SWING : 0) | (start ? BPAD.START : 0) };
}
let startWas = false;
function startEdge(pads) { const now = pads.some((p) => p.b & BPAD.START) || anyHeld(['Enter']); const edge = now && !startWas; startWas = now; return edge; }

// ── the field ────────────────────────────────────────────────────────────────────────────────────────────────

const LINE = new THREE.MeshBasicMaterial({ color: 0xf8f8f4 }), INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
const dressing = new THREE.Group();
scene.add(dressing);
function flat(geo, x, y, z, mat, rot = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y + OY, z); m.rotation.z = rot; dressing.add(m); return m; }
function box(w, d, h, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat); m.position.set(x, y + OY, z); dressing.add(m); return m; }
function dressField() {
  const r = FT.fence, grass = new THREE.MeshBasicMaterial({ color: 0x3f9a48 }), stripe = new THREE.MeshBasicMaterial({ color: 0x46a551 });
  if (BASES) {
    // the outfield a fan to the fence, its stripes; the infield's dirt, the bases, the mound, the foul lines; the fence
    const fan = Math.PI / 2;
    flat(new THREE.CircleGeometry(r, 64, Math.PI / 4, fan), 0, 0, 0.03, grass);
    for (let i = 1; i < 8; i += 2) flat(new THREE.RingGeometry((r * i) / 8, (r * (i + 1)) / 8, 64, 1, Math.PI / 4, fan), 0, 0, 0.06, stripe);
    const dirt = new THREE.MeshBasicMaterial({ color: 0xb98a5c });
    flat(new THREE.CircleGeometry(29, 48, Math.PI / 4, fan), 0, 0, 0.09, dirt);
    flat(new THREE.PlaneGeometry(19.4, 19.4), 0, 19.4, 0.12, grass, Math.PI / 4);
    flat(new THREE.CircleGeometry(2.7, 24), 0, 18.44, 0.15, dirt);
    for (const [x, y] of [[19.4, 19.4], [0, 38.8], [-19.4, 19.4], [0, 0]]) box(0.4, 0.4, 0.06, x, y, 0.18, LINE);
    for (const s of [-1, 1]) { const len = r, a = Math.PI / 2 - s * Math.PI / 4; flat(new THREE.PlaneGeometry(len, 0.1), (Math.cos(a) * len) / 2, (Math.sin(a) * len) / 2, 0.16, LINE, a); }
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, FT.fenceHeight || 2, 64, 1, true, Math.PI / 4 - Math.PI / 2, fan).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1f5a3a, side: THREE.DoubleSide }));
    wall.position.set(0, OY, (FT.fenceHeight || 2) / 2); wall.rotation.z = Math.PI; dressing.add(wall);   // (the arc about +y, the field's)
  } else {
    // the oval, its stripes, the square's strip, the wickets at each end, the rope
    flat(new THREE.CircleGeometry(r + 4, 72), 0, SP.pitch.at[1] / 2, 0.03, grass);
    for (let i = 1; i < 8; i += 2) flat(new THREE.RingGeometry(((r + 4) * i) / 8, ((r + 4) * (i + 1)) / 8, 72), 0, SP.pitch.at[1] / 2, 0.06, stripe);
    flat(new THREE.PlaneGeometry(3, SP.pitch.at[1] + 2.4), 0, SP.pitch.at[1] / 2, 0.09, new THREE.MeshBasicMaterial({ color: 0xcdb98c }));
    const stump = new THREE.MeshBasicMaterial({ color: 0xf1e6c4 });
    for (const y of [0, SP.pitch.at[1]]) for (const x of [-0.11, 0, 0.11]) box(0.035, 0.035, 0.71, x, y - (y ? -0.3 : 0.3), 0.355, stump);
    flat(new THREE.RingGeometry(r - 0.15, r + 0.15, 96), 0, 0, 0.12, LINE);
  }
}
dressField();

const CAP = new THREE.CylinderGeometry(0.22, 0.22, 1.1, 10).rotateX(Math.PI / 2), HEAD = new THREE.SphereGeometry(0.16, 10, 8), BALL_GEO = new THREE.SphereGeometry(1, 14, 10);
const ballMesh = new THREE.Mesh(BALL_GEO, new THREE.MeshBasicMaterial({ color: SP.ball === 'cricket' ? 0xb32a22 : 0xf6f3ea })), ballInk = new THREE.Mesh(BALL_GEO, INK);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
scene.add(ballMesh, ballInk, shadow);
const figures = [];
function figure(color, slot) {
  if (ATH && ATH.has(slot)) { const A = ATH.make(slot); return { A, phase: 0, at: null }; }
  const body = new THREE.Mesh(CAP, new THREE.MeshBasicMaterial({ color })), ink = new THREE.Mesh(CAP, INK), head = new THREE.Mesh(HEAD, new THREE.MeshBasicMaterial({ color: 0xf0d2b6 }));
  ink.scale.set(1.12, 1.12, 1.03); scene.add(body, ink, head);
  return { body, ink, head };
}
function placeFigure(F, x, y, face) {
  if (F.A) {
    const sx = x, sy = y + OY;
    const speed = F.at ? Math.hypot(sx - F.at[0], sy - F.at[1]) * BAT_FPS : 0;
    if (F.at) F.phase += (Math.hypot(sx - F.at[0], sy - F.at[1]) / STRIDE) * 2 * Math.PI;
    F.at = [sx, sy];
    placeAthlete(F.A, strideStick({ at: [sx, sy], heading: face, phase: F.phase, speed }), { face: [Math.cos(face), Math.sin(face)] });
    return;
  }
  F.body.position.set(x, y + OY, 0.55); F.ink.position.copy(F.body.position); F.head.position.set(x, y + OY, 1.27);
}

// ── the game ─────────────────────────────────────────────────────────────────────────────────────────────────

let ctx = null, S = null, phase = 'wait', waited = 0, lastParams = null, calls = 0;
const SPORT = (SP.id || 'the game').replace(/-/g, ' ');
const sideIx = (side) => (side === 'a' ? 0 : 1);
const sideName = (side) => tvNames(BC, 2, ctx ? ctx.players : IA.players)[sideIx(side)];
function clearFigures() { for (const F of figures) { if (F.A) scene.remove(F.A.group, F.A.shadow); else scene.remove(F.body, F.ink, F.head); } figures.length = 0; }
function begin(params = {}) {
  lastParams = params;
  ctx = batContext({ ...IA, players: params.players ?? IA.players, register: params.register ?? IA.register, level: params.level ?? IA.level, seed: params.seed ?? IA.seed });
  S = newBat(ctx);
  clearFigures();
  // the batter (side batting's first), then each side's fielders (the fielding side's are the ones placed)
  const n = SP.fielders.length;
  for (const side of ['a', 'b']) for (let i = 0; i < n; i++) figures.push(figure(SIDE_COLORS[side], sideIx(side) * n + i));
  calls = 0;
  tvOpen(TV, { title: IA.title || SPORT, rows: ['a', 'b'].map((side) => ({ name: sideName(side), color: sideIx(side) })) });
  phase = 'game';
}
function post(msg) { if (hosted) window.parent.postMessage(msg, '*'); }
if (hosted) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.moj !== IA.wire.init || d.contractVersion !== IA.wire.version) return;
    begin((d.params && d.params.innings) || {});
  });
  post({ moj: IA.wire.ready, contractVersion: IA.wire.version, levelRef: 'innings' });
}
const NAMES = {
  side: (side) => ({ name: sideName(side), color: sideIx(side) }),
  retired: (c) => (BASES ? 'SIDE RETIRED' : 'INNINGS'),
};
const STATS = BC.stats || null, COLS = () => ['a', 'b'].map((side) => ({ name: sideName(side), color: sideIx(side) }));
const statsNow = () => contestStats(S, 'innings');
const withStats = (line, side, rows) => { const extra = STATS && rows && rows.length ? statLine(statsNow(), side, rows) : ''; return extra ? `${line} · ${extra}` : line; };
function readCalls() {
  for (; calls < S.calls.length; calls++) {
    const c = S.calls[calls];
    tvCall(TV, c, NAMES);
    if (c.kind === 'side' && STATS && S.K.phase !== 'over') tvPanel(TV, statPanel(statsNow(), STATS.panel, COLS(), `${SPORT} · ${BASES ? `after ${S.K.inning - (S.K.half ? 0 : 1)}` : 'innings'}`));
    if (c.kind === 'over') {
      const sides = c.winner === 'b' ? ['b', 'a'] : ['a', 'b'];
      tvBoard(TV, { title: `${SPORT} · final`, rows: sides.map((side, k) => ({ place: c.winner ? k + 1 : 1, name: sideName(side), color: sideIx(side), value: String(S.K.total[side]), ...(STATS ? { note: withStats('', side, STATS.board).replace(/^ · /, '') } : {}) })), foot: hosted ? null : 'press start to play again' });
    }
  }
}
function tick() {
  const pads = Array.from({ length: ctx ? ctx.players : IA.players }, (_, i) => padOf(i));
  const start = startEdge(pads.length ? pads : [padOf(0)]);
  tvAdvance(TV);
  if (phase === 'wait') { if (!hosted || ++waited > 90) begin({}); return; }
  if (phase === 'over') { if (start) begin(lastParams); return; }
  if (phase !== 'game') return;
  stepBat(S, pads, ctx);
  readCalls();
  if (S.over && S.dead === 0) {
    const mine = ['a', 'b'].filter((side, i) => i < ctx.players);
    const won = ctx.players === 0 || S.winner === null || mine.includes(S.winner);
    if (hosted) { post({ moj: IA.wire.outcome, envelope: { result: won ? 'success' : 'fail', events: [], stats: { innings: { winner: S.winner, runs: S.K.total }, contest: statCompact(statsNow()) } } }); phase = 'done'; }
    else phase = 'over';
  }
}

// ── drawing ──────────────────────────────────────────────────────────────────────────────────────────────────

function placeBodies() {
  const b = S.sim.bodies[0], r = Math.max(b.radius, 0.09), n = SP.fielders.length, bat = S.K.batting, field = bat === 'a' ? 'b' : 'a';
  ballMesh.position.set(b.position[0], b.position[1] + OY, Math.max(b.position[2], r)); ballMesh.scale.setScalar(r);
  ballInk.position.copy(ballMesh.position); ballInk.scale.setScalar(r * 1.15);
  shadow.position.set(b.position[0], b.position[1] + OY, 0.2); shadow.scale.setScalar(Math.max(r, r * (2 - Math.min(1.5, b.position[2] / 8))));
  // the fielding side at its places (the first the pitcher, the bowler); the batting side's first at the plate, the rest
  // waiting by the side
  for (let i = 0; i < n; i++) {
    const F = figures[sideIx(field) * n + i], fd = S.fielders[i];
    if (F && fd) placeFigure(F, fd.x, fd.y, -Math.PI / 2);
    const B = figures[sideIx(bat) * n + i];
    if (B) placeFigure(B, i === 0 ? -0.7 : (BASES ? -24 : -FT.fence + 4) + i * 1.2, i === 0 ? 0 : (BASES ? -4 : -2), Math.PI / 2);
  }
}
function frameCamera() {
  const b = S.sim.bodies[0], flying = S.phase === 'flight' || (S.phase === 'dead' && Math.hypot(b.position[0], b.position[1]) > 8);
  const want = flying ? { x: b.position[0] * 0.4, y: OY + b.position[1] * 0.45 - 16, z: 14, lx: b.position[0], ly: OY + b.position[1], lz: 1 } : { x: 0, y: OY - 13, z: 3, lx: 0, ly: OY + 12, lz: 0.9 };
  for (const k of Object.keys(want)) cam[k] += (want[k] - cam[k]) * (flying ? 0.08 : 0.12);
  if (camera.fov !== 50) { camera.fov = 50; camera.updateProjectionMatrix(); }
  camera.position.set(cam.x, cam.y, cam.z);
  camera.lookAt(cam.lx, cam.ly, cam.lz);
  tvShot(TV, camera, [cam.lx, cam.ly, cam.lz]);
}
function feedOf(d) {
  const I = d.innings, ord = (n) => ['', '1st', '2nd', '3rd'][n] || `${n}th`;
  const tab = BASES ? `${I.half ? 'bottom' : 'top'} ${ord(I.inning)} · ${I.outs} out · ${I.strikes} strike${I.strikes === 1 ? '' : 's'}${I.bases.some(Boolean) ? ` · on ${I.bases.map((on, i) => (on ? ['1st', '2nd', '3rd'][i] : null)).filter(Boolean).join(', ')}` : ''}`
    : `${sideName(I.batting)} batting · over ${I.overs}.${I.balls} · ${I.outs} wkt${I.outs === 1 ? '' : 's'}${I.half ? ` · target ${(Number(d.score[I.first][0]) || 0) + 1}` : ''}`;
  return {
    title: IA.title || SPORT,
    rows: ['a', 'b'].map((side) => ({ name: sideName(side), color: sideIx(side), cells: [d.score[side][0]], mark: I.batting === side ? 'serve' : null })), hot: 0,
    tab,
    hint: ctx.players > 0 && TV.f < 600 ? `${sideName('a')} · at the bat: F swing (A D spray, W S lift) · in the field: A D W S aim, F ${BASES ? 'pitch' : 'bowl'}` : null,
  };
}
function draw() {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!S) { tvDraw(TV, g2, OW, OH, null); return; }
  placeBodies(); frameCamera();
  tvDraw(TV, g2, OW, OH, feedOf(batDisplay(S, ctx)));
}

let acc = 0, last = null;
function stepInningsArena(t) {
  if (last === null) last = t;
  acc += Math.min(0.1, Math.max(0, t - last));
  last = t;
  while (acc >= 1 / BAT_FPS) { acc -= 1 / BAT_FPS; tick(); }
  draw();
}

window.__mojInnings = {
  athletes: () => figures.filter((F) => F.A).length,
  get state() { return S; }, get phase() { return phase; }, get ctx() { return ctx; },
  display: () => (S ? batDisplay(S, ctx) : null),
  run(seconds) { if (phase === 'wait') begin({}); const n = Math.round(seconds * BAT_FPS); for (let i = 0; i < n && phase === 'game'; i++) tick(); return S; },
};
