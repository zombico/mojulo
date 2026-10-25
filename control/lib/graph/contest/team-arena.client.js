/**
 * team arena — a team goal game in a browser (inlined into the World page's pitch block after the physics, the hit,
 * the contest kernel, the minds and the team sim: scene/channels/contest.js). From the page it uses only what a
 * channel may: `THREE`, `scene`, `camera`, `controls`, `wrap`, and `__ctrlOwnsCamera` (it owns the camera from the start).
 *
 * Two pads on one keyboard (P1 WASD and F or Space; P2 the arrows and the right Shift or the keypad 0; Enter begins
 * again) and the gamepads by index (the left stick moves, south kicks, start begins again), both in the screen's
 * directions (one camera behind side a's goal); the sides nobody holds are the computer's. The pitch is drawn from the
 * kernel's regions (the lines, the boxes, the centre circle, the goals with their nets; the rink with its boards), the
 * players as capsules in their side's colour (the one at the pad ringed), the ball with its shadow, the scoreboard and
 * the clock, the referee's banners (GOAL, THROW-IN, CORNER, GOAL KICK, OFFSIDE, FOUL, HALF TIME, FULL TIME).
 *
 * As a level: hosted in a game's frame it posts READY, plays the game INIT brings (players, register, level, seed over
 * the pitch's own), and posts the OUTCOME at the end: success when a player's side won (or drew, or no player holds a
 * side: an exhibition), fail otherwise, the score as stats. On its own it starts at once and runs again on start.
 */
/* global PITCH_ARENA, THREE, scene, camera, controls, wrap, newTeam, stepTeam, teamContext, teamDisplay, GPAD, TEAM_FPS */

const PA = PITCH_ARENA, PT = PA.court, SP = PA.sport;
const hosted = window.parent !== window;
const SIDE_COLORS = { a: '#e0503a', b: '#3a9be0' };
const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
const OY = PT.originY;   // the court frame's origin on the stage

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
__ctrlOwnsCamera = true;   // the page's loop leaves the camera to the game
const cam = { x: 0, y: OY - PT.halfL - 16, z: 14, lx: 0, ly: OY, lz: 0 };

// ── input: two pads ──────────────────────────────────────────────────────────────────────────────────────────

const PITCH_KEYS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], kick: ['KeyF', 'Space'], start: ['Enter'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], kick: ['ShiftRight', 'Numpad0'], start: ['NumpadEnter'] },
];
const IN = { held: new Set() };
window.addEventListener('keydown', (e) => { IN.held.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
window.addEventListener('keyup', (e) => IN.held.delete(e.code));
window.addEventListener('blur', () => IN.held.clear());
const anyHeld = (list) => list.some((k) => IN.held.has(k));
function padOf(i) {
  const K = PITCH_KEYS[i] || PITCH_KEYS[0];
  let x = (anyHeld(K.right) ? 1 : 0) - (anyHeld(K.left) ? 1 : 0), y = (anyHeld(K.up) ? 1 : 0) - (anyHeld(K.down) ? 1 : 0);
  let kick = anyHeld(K.kick), start = anyHeld(K.start);
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads[i];
  if (gp) {
    const btn = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed), dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    if (!x) x = dz(gp.axes[0] || 0); if (!y) y = -dz(gp.axes[1] || 0);
    kick = kick || btn(0); start = start || btn(9);
  }
  return { x, y, b: (kick ? GPAD.KICK : 0) | (start ? GPAD.START : 0) };
}
let startWas = false;
function startEdge(pads) { const now = pads.some((p) => p.b & GPAD.START) || anyHeld(['Enter']); const edge = now && !startWas; startWas = now; return edge; }

// ── the pitch, the goals, the players, the ball ──────────────────────────────────────────────────────────────

const INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xf4f4f0 });
const LINE = new THREE.MeshBasicMaterial({ color: 0xf8f8f4 });
const dressing = new THREE.Group();
scene.add(dressing);
function flat(w, d, x, y, z, mat) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.position.set(x, y + OY, z); dressing.add(m); return m; }
function box(w, d, h, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat); m.position.set(x, y + OY, z); dressing.add(m); return m; }
function dressPitch() {
  const W = PT.halfW, L = PT.halfL, t = 0.1, ice = PT.boards;
  flat(2 * W + 1, 2 * L + 1, 0, 0, 0.011, new THREE.MeshBasicMaterial({ color: ice ? 0xdfe9f2 : 0x3f9a48 }));
  if (!ice) for (let i = 0; i < 10; i++) flat(2 * W, (2 * L) / 10, 0, -L + ((2 * L) / 10) * (i + 0.5), 0.012, new THREE.MeshBasicMaterial({ color: i % 2 ? 0x3f9a48 : 0x45a650 }));
  const lines = [[2 * W, t, 0, -L], [2 * W, t, 0, L], [t, 2 * L, -W, 0], [t, 2 * L, W, 0], [2 * W, t, 0, 0]];
  for (const [w, d, x, y] of lines) flat(w, d, x, y, 0.014, LINE);
  const regions = PA.C.court.regions;
  for (const name of ['box', 'goal-area']) {
    const r = regions[name]; if (!r) continue;
    const [x0, y0, x1, y1] = r.rect, bw = x1 - x0, bd = y1 - y0;
    for (const s of [1, -1]) { const yc = s * (y0 + y1) / 2; flat(bw, t, (x0 + x1) / 2, s * y1, 0.014, LINE); flat(t, bd, x0, yc, 0.014, LINE); flat(t, bd, x1, yc, 0.014, LINE); }
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(ice ? 4.4 : 2.9, ice ? 4.5 : 3, 48), LINE); ring.position.set(0, OY, 0.014); dressing.add(ring);
  // the goals: posts, a bar, a net plane behind; the rink's boards
  const G = SP.goal, post = new THREE.MeshBasicMaterial({ color: 0xffffff }), net = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const y = s * L;
    box(0.08, 0.08, G.height, -G.width / 2, y, G.height / 2, post); box(0.08, 0.08, G.height, G.width / 2, y, G.height / 2, post);
    box(G.width + 0.08, 0.08, 0.08, 0, y, G.height, post);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(G.width, G.height), net); back.position.set(0, y + s * 1.2 + OY, G.height / 2); back.rotation.x = Math.PI / 2; dressing.add(back);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(G.width, 1.2), net); top.position.set(0, y + s * 0.6 + OY, G.height); dressing.add(top);
  }
  if (ice) { const bm = new THREE.MeshBasicMaterial({ color: 0xc8d0d8 }); box(0.15, 2 * L + 0.6, 1.2, -W - 0.15, 0, 0.6, bm); box(0.15, 2 * L + 0.6, 1.2, W + 0.15, 0, 0.6, bm); box(2 * W + 0.6, 0.15, 1.2, 0, -L - 0.15, 0.6, bm); box(2 * W + 0.6, 0.15, 1.2, 0, L + 0.15, 0.6, bm); }
}
dressPitch();
const BALL_GEO = new THREE.SphereGeometry(1, 14, 10), CAP = new THREE.CylinderGeometry(0.22, 0.22, 1.1, 10).rotateX(Math.PI / 2), HEAD = new THREE.SphereGeometry(0.16, 10, 8);
const ballMesh = new THREE.Mesh(BALL_GEO, new THREE.MeshBasicMaterial({ color: SP.ball === 'puck' ? 0x141414 : 0xf8f8f4 })), ballInk = new THREE.Mesh(BALL_GEO, INK);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
scene.add(ballMesh, ballInk, shadow);
const figures = {};
function makeFigure(id, side) {
  const mat = new THREE.MeshBasicMaterial({ color: SIDE_COLORS[side] });
  const body = new THREE.Mesh(CAP, mat), ink = new THREE.Mesh(CAP, INK), head = new THREE.Mesh(HEAD, new THREE.MeshBasicMaterial({ color: 0xf0d2b6 })), ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24), new THREE.MeshBasicMaterial({ color: 0xffd23a }));
  ink.scale.set(1.12, 1.12, 1.03); ring.visible = false;
  scene.add(body, ink, head, ring);
  figures[id] = { body, ink, head, ring };
}

// ── the game ─────────────────────────────────────────────────────────────────────────────────────────────────

let ctx = null, S = null, phase = 'wait', waited = 0, banner = null, lastParams = null, calls = 0;
const BANNER_FRAMES = 90;
const sideName = (side) => { const i = side === 'a' ? 0 : 1; return i < ctx.players ? `P${i + 1}` : 'CPU'; };
function begin(params = {}) {
  lastParams = params;
  ctx = teamContext({ ...PA, players: params.players ?? PA.players, register: params.register ?? PA.register, level: params.level ?? PA.level, seed: params.seed ?? PA.seed });
  S = newTeam(ctx);
  for (const id of Object.keys(figures)) { const F = figures[id]; scene.remove(F.body, F.ink, F.head, F.ring); delete figures[id]; }
  for (const P of S.p) makeFigure(P.id, P.side);
  banner = { text: 'KICK-OFF', left: BANNER_FRAMES, color: '#fff' }; calls = 0;
  phase = 'game';
}
function post(msg) { if (hosted) window.parent.postMessage(msg, '*'); }
if (hosted) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.moj !== PA.wire.init || d.contractVersion !== PA.wire.version) return;
    begin((d.params && d.params.pitch) || {});
  });
  post({ moj: PA.wire.ready, contractVersion: PA.wire.version, levelRef: 'pitch' });
}
const RESTART_WORDS = { 'throw-in': 'THROW-IN', corner: 'CORNER', 'goal-kick': 'GOAL KICK', free: 'FREE KICK', kickoff: 'KICK-OFF' };
function readCalls() {
  for (; calls < S.calls.length; calls++) {
    const c = S.calls[calls];
    if (c.kind === 'score') banner = { text: `GOAL! ${sideName(c.side)}`, left: BANNER_FRAMES * 1.6, color: SIDE_COLORS[c.side] };
    else if (c.kind === 'out') banner = { text: `${RESTART_WORDS[c.restart.kind] || c.restart.kind.toUpperCase()} · ${sideName(c.side)}`, left: BANNER_FRAMES, color: '#fff' };
    else if (c.kind === 'foul') banner = { text: c.foul === 'offside' ? `OFFSIDE · ${sideName(c.side)}` : `FOUL · ${sideName(c.side)}`, left: BANNER_FRAMES * 1.2, color: '#ffd23a' };
    else if (c.kind === 'period') banner = { text: c.period < ctx.C.clock.periods ? (ctx.C.clock.periods === 2 ? 'HALF TIME' : `END OF PERIOD ${c.period}`) : 'FULL TIME', left: BANNER_FRAMES * 1.5, color: '#fff' };
    else if (c.kind === 'overtime') banner = { text: 'OVERTIME', left: BANNER_FRAMES * 1.5, color: '#ffd23a' };
    else if (c.kind === 'over') banner = null;
  }
}
function tick() {
  const pads = Array.from({ length: ctx ? ctx.players : PA.players }, (_, i) => padOf(i));
  const start = startEdge(pads.length ? pads : [padOf(0)]);
  if (phase === 'wait') { if (!hosted || ++waited > 90) begin({}); return; }
  if (phase === 'over') { if (start) begin(lastParams); return; }
  if (phase !== 'game') return;
  stepTeam(S, pads, ctx);
  readCalls();
  if (banner && --banner.left <= 0) banner = null;
  if (S.over) {
    const mine = ['a', 'b'].filter((side, i) => i < ctx.players);
    const won = ctx.players === 0 || S.winner === null || mine.includes(S.winner);
    if (hosted) { post({ moj: PA.wire.outcome, envelope: { result: won ? 'success' : 'fail', events: [], stats: { pitch: { winner: S.winner, score: S.K.score } } } }); phase = 'done'; }
    else phase = 'over';
  }
}

// ── drawing ──────────────────────────────────────────────────────────────────────────────────────────────────

function placeBodies() {
  const b = S.sim.bodies[0], r = Math.max(b.radius, 0.11);
  ballMesh.position.set(b.position[0], b.position[1] + OY, Math.max(b.position[2], r)); ballMesh.scale.setScalar(r);
  ballInk.position.copy(ballMesh.position); ballInk.scale.setScalar(r * 1.12);
  shadow.position.set(b.position[0], b.position[1] + OY, 0.02); shadow.scale.setScalar(Math.max(r * 0.7, r * (1.5 - Math.min(1, b.position[2] / 6))));
  for (const P of S.p) {
    const F = figures[P.id]; if (!F) continue;
    F.body.position.set(P.x, P.y + OY, 0.55); F.ink.position.copy(F.body.position); F.head.position.set(P.x, P.y + OY, 1.27);
    F.ring.position.set(P.x, P.y + OY, 0.02); F.ring.visible = S.active[P.side] === P.id && (P.side === 'a' ? 0 : 1) < ctx.players;
  }
}
function frameCamera() {
  const b = S.sim.bodies[0], bx = b.position[0], by = b.position[1] + OY;
  const wx = bx * 0.35, wy = by - 20, wz = 15;
  cam.x += (wx - cam.x) * 0.06; cam.y += (wy - cam.y) * 0.06; cam.z += (wz - cam.z) * 0.06;
  cam.lx += (bx * 0.5 - cam.lx) * 0.08; cam.ly += (by + 3 - cam.ly) * 0.08;
  if (camera.fov !== 52) { camera.fov = 52; camera.updateProjectionMatrix(); }
  camera.position.set(cam.x, cam.y, cam.z);
  camera.lookAt(cam.lx, cam.ly, 0.3);
}
function text(str, x, y, size, color, align = 'center', weight = 800) { g2.font = `${weight} ${size}px ${FONT}`; g2.textAlign = align; g2.textBaseline = 'middle'; g2.fillStyle = color; g2.fillText(str, x, y); }
function outlined(str, x, y, size, color) { g2.font = `900 ${size}px ${FONT}`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineWidth = Math.max(3, size / 9); g2.strokeStyle = '#000'; g2.lineJoin = 'round'; g2.strokeText(str, x, y); g2.fillStyle = color; g2.fillText(str, x, y); }
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function draw() {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!S) { outlined('GET READY', OW / 2, OH / 2, 40, '#fff'); return; }
  placeBodies(); frameCamera();
  const d = teamDisplay(S, ctx);
  text(`${PA.title || PA.sport.id}`, 18, 26, 20, '#fff', 'left'); text(SP.words, 18, 50, 13, 'rgba(255,255,255,0.75)', 'left', 500);
  // the scoreboard: A n – n B, the clock
  g2.fillStyle = 'rgba(0,0,0,0.5)'; g2.fillRect(OW / 2 - 130, 12, 260, 46);
  text(sideName('a'), OW / 2 - 95, 28, 14, SIDE_COLORS.a, 'center', 700); text(sideName('b'), OW / 2 + 95, 28, 14, SIDE_COLORS.b, 'center', 700);
  text(`${d.score.a[0]}  –  ${d.score.b[0]}`, OW / 2, 28, 22, '#fff');
  if (d.clock) text(`${d.clock.overtime ? 'OT' : ctx.C.clock.periods === 2 ? (d.clock.period === 1 ? '1st half' : '2nd half') : `period ${d.clock.period}`} · ${mmss(d.clock.left)}`, OW / 2, 48, 12, 'rgba(255,255,255,0.85)', 'center', 500);
  const me = S.p.find((P) => P.id === S.active.a);
  if (me && ctx.players > 0 && me.charge > 0) { const mw = 120; g2.fillStyle = 'rgba(0,0,0,0.5)'; g2.fillRect(OW / 2 - mw / 2, OH - 34, mw, 10); g2.fillStyle = '#ffd23a'; g2.fillRect(OW / 2 - mw / 2, OH - 34, mw * me.charge, 10); }
  if (banner) outlined(banner.text, OW / 2, OH * 0.3, 44, banner.color);
  if (S.over) {
    g2.fillStyle = 'rgba(0,0,0,0.55)'; g2.fillRect(OW / 2 - 200, OH * 0.42 - 30, 400, 90);
    outlined(S.winner ? `${sideName(S.winner)} WINS ${d.score.a[0]}–${d.score.b[0]}` : `A DRAW ${d.score.a[0]}–${d.score.b[0]}`, OW / 2, OH * 0.42, 30, '#ffd23a');
    if (phase === 'over') text('press start to play again', OW / 2, OH * 0.42 + 40, 14, '#fff', 'center', 500);
  }
}

// the page calls this from its frame step with its clock in seconds; the game steps at 60 Hz
let acc = 0, last = null;
function stepPitchArena(t) {
  if (last === null) last = t;
  acc += Math.min(0.1, Math.max(0, t - last));
  last = t;
  while (acc >= 1 / TEAM_FPS) { acc -= 1 / TEAM_FPS; tick(); }
  draw();
}

window.__mojPitch = {
  get state() { return S; }, get phase() { return phase; }, get ctx() { return ctx; },
  display: () => (S ? teamDisplay(S, ctx) : null),
  // a probe's run: so many seconds of the game stepped at once, the pads at rest (the computer sides play)
  run(seconds) { if (phase === 'wait') begin({}); const n = Math.round(seconds * TEAM_FPS); for (let i = 0; i < n && phase === 'game'; i++) tick(); return S; },
};
