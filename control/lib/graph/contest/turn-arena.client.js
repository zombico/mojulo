/**
 * turn arena — a turn sport in a browser (inlined into the World page's turns block after the physics, the hit, the
 * contest kernel, the minds and the turn sim: scene/channels/contest.js). From the page it uses only what a channel
 * may: `THREE`, `scene`, `camera`, `controls`, `wrap`, and `__ctrlOwnsCamera` (it owns the camera from the start).
 *
 * One pad, hot-seat: the seat the kernel names holds it (the arrows or WASD turn the aim and set the lift or the hook,
 * Space or F charges and releases the shot, Enter begins again; gamepad 0 the same), the computer plays the rest. The
 * course is drawn from the kernel's regions (the tee, the fairway, the green, the bunkers, the water, the cup and its
 * flag; the approach, the lane, the gutters, the pins), the ball with its shadow, the aim as a line from the ball, the
 * meter and the card on the overlay, the camera behind the ball toward the target and following the shot.
 *
 * As a level: hosted in a game's frame it posts READY, plays the game INIT brings (seats, players, register, level,
 * seed over the course's own), and posts the OUTCOME at the end: success when a player's seat won (or no player holds
 * a seat: an exhibition), fail otherwise, the totals as stats. On its own it starts at once and runs again on start.
 */
/* global TURNS_ARENA, THREE, scene, camera, controls, wrap, newTurns, stepTurns, turnContext, turnsDisplay, targetOf, clubOf, TPAD, TURN_FPS */

const TA = TURNS_ARENA, CO = TA.course, SP = TA.sport;
const hosted = window.parent !== window;
const SEAT_COLORS = ['#e0503a', '#3a9be0', '#e0a23a', '#3ae08a', '#9a4ae0', '#e03a9a', '#c8c8c8', '#6ad0d0'];
const FONT = '"Avenir Next", "Segoe UI", system-ui, sans-serif';
const OY = CO.originY;   // the course frame's origin on the stage

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
const cam = { x: 0, y: OY - CO.depth / 2 - 8, z: 4, lx: 0, ly: OY, lz: 0.5 };

// ── input: one pad ───────────────────────────────────────────────────────────────────────────────────────────

const KEYS = { left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], swing: ['Space', 'KeyF'], start: ['Enter', 'NumpadEnter'] };
const IN = { held: new Set() };
window.addEventListener('keydown', (e) => { IN.held.add(e.code); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); });
window.addEventListener('keyup', (e) => IN.held.delete(e.code));
window.addEventListener('blur', () => IN.held.clear());
const anyHeld = (list) => list.some((k) => IN.held.has(k));
function padNow() {
  let x = (anyHeld(KEYS.right) ? 1 : 0) - (anyHeld(KEYS.left) ? 1 : 0), y = (anyHeld(KEYS.up) ? 1 : 0) - (anyHeld(KEYS.down) ? 1 : 0);
  let swing = anyHeld(KEYS.swing), start = anyHeld(KEYS.start);
  const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
  const gp = pads[0];
  if (gp) {
    const btn = (n) => !!(gp.buttons[n] && gp.buttons[n].pressed), dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    if (!x) x = dz(gp.axes[0] || 0); if (!y) y = -dz(gp.axes[1] || 0);
    swing = swing || btn(0); start = start || btn(9);
  }
  return { x, y, b: (swing ? TPAD.SWING : 0) | (start ? TPAD.START : 0) };
}
let startWas = false;
function startEdge(pad) { const now = !!(pad.b & TPAD.START); const edge = now && !startWas; startWas = now; return edge; }

// ── the course, the ball, the pins ───────────────────────────────────────────────────────────────────────────

const LOOK = { cup: 0x0c0c0c, green: 0x52c45e, fairway: 0x3f9a48, tee: 0x2f8a3c, water: 0x2d6fd6, approach: 0xd9bb7c, lane: 0xe2c78e, pit: 0x111111 };
const lookOf = (name) => (name.startsWith('bunker') ? 0xe6d6a4 : name.startsWith('gutter') ? 0x2a2a2a : LOOK[name] ?? 0x6f9a4a);
const INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
const WHITE = new THREE.MeshBasicMaterial({ color: 0xf4f4f0 });
const RED = new THREE.MeshBasicMaterial({ color: 0xd63a2e });
let courseGroup = null, courseHole = -1;
function dressHole(holeIndex) {
  if (courseGroup) scene.remove(courseGroup);
  courseGroup = new THREE.Group(); courseHole = holeIndex;
  const course = TA.C.rounds[holeIndex].course, names = Object.keys(course.regions);
  names.forEach((name, i) => {   // the first authored lies on top (the cup over the green, a bunker over the fairway)
    const r = course.regions[name], z = 0.012 + (names.length - i) * 0.0015;
    let mesh;
    if (r.kind === 'rect') { const [x0, y0, x1, y1] = r.rect; mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshBasicMaterial({ color: lookOf(name) })); mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2 + OY, z); }
    else { const [cx, cy, rad] = r.circle; mesh = new THREE.Mesh(new THREE.CircleGeometry(rad, 48), new THREE.MeshBasicMaterial({ color: lookOf(name) })); mesh.position.set(cx, cy + OY, z); }
    courseGroup.add(mesh);
  });
  if (TA.sport.id === 'golf') {   // the flag
    const [cx, cy] = course.regions[TA.C.turn.holed].circle;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.2, 8).rotateX(Math.PI / 2), WHITE); pole.position.set(cx, cy + OY, 1.1); courseGroup.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), new THREE.MeshBasicMaterial({ color: 0xe0a23a, side: THREE.DoubleSide })); flag.position.set(cx + 0.25, cy + OY, 2.0); flag.rotation.x = Math.PI / 2; courseGroup.add(flag);
  } else {   // the foul line
    const line = new THREE.Mesh(new THREE.PlaneGeometry(SP.lane.width, 0.03), new THREE.MeshBasicMaterial({ color: 0x222222 })); line.position.set(0, OY, 0.03); courseGroup.add(line);
  }
  scene.add(courseGroup);
}
const BALL_GEO = new THREE.SphereGeometry(1, 16, 12);
const ballMesh = new THREE.Mesh(BALL_GEO, new THREE.MeshBasicMaterial({ color: TA.sport.id === 'golf' ? 0xf8f8f4 : 0x23244a }));
const ballInk = new THREE.Mesh(BALL_GEO, INK);
const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
scene.add(ballMesh, ballInk, shadow);
const pinMeshes = [];
if (TA.sport.id === 'bowling') {
  const PIN = new THREE.CylinderGeometry(0.035, 0.06, SP.pins.height, 10).rotateX(Math.PI / 2);
  for (let i = 0; i < SP.pins.spots.length; i++) { const m = new THREE.Mesh(PIN, WHITE), ink = new THREE.Mesh(PIN, INK), band = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 10).rotateX(Math.PI / 2), RED); ink.scale.setScalar(1.08); scene.add(m, ink, band); pinMeshes.push({ m, ink, band }); }
}
const aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff }));
scene.add(aimLine);
const AIM_LEN = { putt: 4, iron: 25, drive: 40, roll: 8 };

// ── the game ─────────────────────────────────────────────────────────────────────────────────────────────────

let ctx = null, S = null, phase = 'wait', waited = 0, banner = null, lastParams = null, calls = 0;
const BANNER_FRAMES = 90;
const seatName = (id) => { const i = Number(id.slice(1)) - 1; return i < ctx.players ? `P${i + 1}` : ctx.seats - ctx.players > 1 ? `CPU ${i + 1 - ctx.players}` : 'CPU'; };
function begin(params = {}) {
  lastParams = params;
  ctx = turnContext({ ...TA, players: params.players ?? TA.players, register: params.register ?? TA.register, level: params.level ?? TA.level, seed: params.seed ?? TA.seed });
  S = newTurns(ctx);
  banner = { text: `${seatName(S.K.turn)} TO PLAY`, left: BANNER_FRAMES, color: '#fff' }; calls = 0;
  dressHole(S.hole);
  phase = 'game';
}
function post(msg) { if (hosted) window.parent.postMessage(msg, '*'); }
if (hosted) {
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object' || d.moj !== TA.wire.init || d.contractVersion !== TA.wire.version) return;
    begin((d.params && d.params.turns) || {});
  });
  post({ moj: TA.wire.ready, contractVersion: TA.wire.version, levelRef: 'turns' });
}
const TO_PAR = { '-3': 'ALBATROSS', '-2': 'EAGLE', '-1': 'BIRDIE', 0: 'PAR', 1: 'BOGEY', 2: 'DOUBLE BOGEY' };
function readCalls() {
  for (; calls < S.calls.length; calls++) {
    const c = S.calls[calls];
    if (c.kind === 'holed') banner = { text: c.why === 'picked-up' ? 'PICKED UP' : c.toPar === null ? `HOLED IN ${c.strokes}` : TO_PAR[c.toPar] ?? `+${c.toPar}`, left: BANNER_FRAMES * 1.3, color: c.toPar !== null && c.toPar < 0 ? '#3ae08a' : '#ffd23a' };
    else if (c.kind === 'penalty') banner = { text: `${c.region === 'water' ? 'IN THE WATER' : c.region === 'out' ? 'OUT OF BOUNDS' : c.region.toUpperCase()} · +${c.strokes}`, left: BANNER_FRAMES * 1.3, color: '#e0503a' };
    else if (c.kind === 'roll') banner = c.mark === 'strike' ? { text: 'STRIKE!', left: BANNER_FRAMES * 1.3, color: '#3ae08a' } : c.mark === 'spare' ? { text: 'SPARE', left: BANNER_FRAMES * 1.2, color: '#ffd23a' } : c.down === 0 ? { text: S.ball.gutter ? 'GUTTER' : 'MISS', left: BANNER_FRAMES, color: '#e0503a' } : { text: `${c.down} DOWN`, left: BANNER_FRAMES * 0.8, color: '#fff' };
    else if (c.kind === 'turn') banner = { text: `${seatName(c.who)} TO PLAY${ctx.kind === 'strokes' ? ` · HOLE ${c.round}` : ` · FRAME ${c.round}`}`, left: BANNER_FRAMES, color: '#fff' };
    else if (c.kind === 'over') banner = null;
  }
}
function tick() {
  const pad = padNow();
  const start = startEdge(pad);
  if (phase === 'wait') { if (!hosted || ++waited > 90) begin({}); return; }
  if (phase === 'over') { if (start) begin(lastParams); return; }
  if (phase !== 'game') return;
  stepTurns(S, pad, ctx);
  readCalls();
  if (S.hole !== courseHole) dressHole(S.hole);
  if (banner && --banner.left <= 0) banner = null;
  if (S.over) {
    const mine = Object.keys(S.K.cards).filter((id) => Number(id.slice(1)) - 1 < ctx.players);
    const won = ctx.players === 0 || (S.winner !== null ? mine.includes(S.winner) : (S.K.tied || []).some((id) => mine.includes(id)));
    if (hosted) { post({ moj: TA.wire.outcome, envelope: { result: won ? 'success' : 'fail', events: [], stats: { turns: { winner: S.winner, tied: S.K.tied, totals: S.K.totals } } } }); phase = 'done'; }
    else phase = 'over';
  }
}

// ── drawing ──────────────────────────────────────────────────────────────────────────────────────────────────

function placeBodies() {
  const b = S.sim.bodies[0], r = b.radius;
  ballMesh.position.set(b.position[0], b.position[1] + OY, Math.max(b.position[2], -0.2)); ballMesh.scale.setScalar(r);
  ballInk.position.copy(ballMesh.position); ballInk.scale.setScalar(r * 1.1);
  shadow.position.set(b.position[0], b.position[1] + OY, 0.025); shadow.scale.setScalar(Math.max(r * 0.6, r * (1.4 - Math.min(1, b.position[2] / 30))));
  shadow.visible = b.position[2] > -0.05;
  if (S.pins) S.pins.forEach((p, i) => { const body = S.sim.bodies[2 + i], P = pinMeshes[i]; const vis = p.up && body.position[0] < 50; P.m.visible = P.ink.visible = P.band.visible = vis; if (vis) { P.m.position.set(body.position[0], body.position[1] + OY, SP.pins.height / 2); P.ink.position.copy(P.m.position); P.band.position.set(body.position[0], body.position[1] + OY, SP.pins.height * 0.72); } });
  const aiming = S.K.phase === 'turn' && !S.shot && S.dead === 0;
  aimLine.visible = aiming;
  if (aiming) {
    const t = targetOf(ctx, S), club = clubOf(ctx, S);
    const facing = (ctx.kind === 'strokes' ? Math.atan2(t[1] - b.position[1], t[0] - b.position[0]) : Math.PI / 2) - (S.aim.x * ctx.spread * Math.PI) / 180;
    const len = AIM_LEN[club] || 10;
    aimLine.geometry.setFromPoints([new THREE.Vector3(b.position[0], b.position[1] + OY, r + 0.02), new THREE.Vector3(b.position[0] + Math.cos(facing) * len, b.position[1] + OY + Math.sin(facing) * len, r + 0.02)]);
  }
}
function frameCamera() {
  const b = S.sim.bodies[0], t = targetOf(ctx, S);
  const bx = b.position[0], by = b.position[1] + OY, tx = t[0], ty = t[1] + OY;
  const d = Math.hypot(tx - bx, ty - by) || 1, ux = (tx - bx) / d, uy = (ty - by) / d;
  const flying = !!S.shot, close = ctx.kind === 'pins' ? 5 : (clubOf(ctx, S) === 'putt' ? 4 : 9);
  let wx, wy, wz, lx, ly, lz;
  if (flying) { wx = cam.x; wy = cam.y; wz = cam.z; lx = bx; ly = by; lz = Math.max(0.3, b.position[2]); }
  else { wx = bx - ux * close; wy = by - uy * close; wz = ctx.kind === 'pins' ? 2.2 : close * 0.45 + 1; lx = bx + ux * Math.min(d, 12); ly = by + uy * Math.min(d, 12); lz = 0.3; }
  const k = flying ? 1 : 0.08;
  cam.x += (wx - cam.x) * k; cam.y += (wy - cam.y) * k; cam.z += (wz - cam.z) * k;
  cam.lx += (lx - cam.lx) * (flying ? 0.3 : 0.1); cam.ly += (ly - cam.ly) * (flying ? 0.3 : 0.1); cam.lz += (lz - cam.lz) * 0.2;
  if (camera.fov !== 46) { camera.fov = 46; camera.updateProjectionMatrix(); }
  camera.position.set(cam.x, cam.y, cam.z);
  camera.lookAt(cam.lx, cam.ly, cam.lz);
}
function text(str, x, y, size, color, align = 'center', weight = 800) { g2.font = `${weight} ${size}px ${FONT}`; g2.textAlign = align; g2.textBaseline = 'middle'; g2.fillStyle = color; g2.fillText(str, x, y); }
function outlined(str, x, y, size, color) { g2.font = `900 ${size}px ${FONT}`; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.lineWidth = Math.max(3, size / 9); g2.strokeStyle = '#000'; g2.lineJoin = 'round'; g2.strokeText(str, x, y); g2.fillStyle = color; g2.fillText(str, x, y); }
function drawCard(d) {
  const x = OW - 18, rowH = 22;
  d.seats.forEach((seat, i) => {
    const y = 30 + i * rowH, col = SEAT_COLORS[i % SEAT_COLORS.length], live = d.turn === seat.id;
    if (ctx.kind === 'strokes') {
      const holes = seat.rounds.map((r) => (r.toPar === null ? String(r.strokes) : r.toPar === 0 ? 'E' : r.toPar > 0 ? `+${r.toPar}` : String(r.toPar))).join('  ');
      text(`${live ? '▸ ' : ''}${seatName(seat.id)}`, x - 200, y, 14, col, 'right', 700); text(holes, x - 70, y, 13, '#fff', 'right', 600); text(seat.toPar === null ? String(seat.total) : seat.toPar === 0 ? 'E' : seat.toPar > 0 ? `+${seat.toPar}` : String(seat.toPar), x, y, 14, '#fff', 'right', 800);
    } else {
      const marks = seat.frames.map((f) => f.mark.join('')).join(' ');
      text(`${live ? '▸ ' : ''}${seatName(seat.id)}`, x - 260, y, 14, col, 'right', 700); text(marks, x - 60, y, 13, '#fff', 'right', 600); text(String(seat.total), x, y, 14, '#fff', 'right', 800);
    }
  });
}
function draw() {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!S) { outlined('GET READY', OW / 2, OH / 2, 40, '#fff'); return; }
  placeBodies(); frameCamera();
  const d = turnsDisplay(S, ctx);
  text(`${TA.title || TA.sport.id}`, 18, 26, 20, '#fff', 'left'); text(SP.words, 18, 50, 13, 'rgba(255,255,255,0.75)', 'left', 500);
  drawCard(d);
  if (d.club) text(ctx.kind === 'strokes' ? `${d.club.toUpperCase()} · ${Math.round(Math.hypot(targetOf(ctx, S)[0] - d.ball[0], targetOf(ctx, S)[1] - d.ball[1]))} m to the cup` : `FRAME ${d.round} · ${d.standing} standing`, OW / 2, OH - 64, 15, '#fff', 'center', 600);
  // the meter
  const mw = Math.min(360, OW * 0.4), mx = OW / 2 - mw / 2, my = OH - 40;
  g2.fillStyle = 'rgba(0,0,0,0.5)'; g2.fillRect(mx, my, mw, 14);
  g2.fillStyle = d.charging ? '#ffd23a' : 'rgba(255,255,255,0.35)'; g2.fillRect(mx, my, mw * (d.charging ? d.meter : 0), 14);
  text(d.charging ? 'release!' : S.K.phase === 'turn' && !S.shot ? 'hold to charge · ◂ ▸ aim' : '', OW / 2, my - 10, 12, 'rgba(255,255,255,0.8)', 'center', 500);
  if (banner) outlined(banner.text, OW / 2, OH * 0.3, 44, banner.color);
  if (S.over) {
    const ids = Object.keys(S.K.totals);
    g2.fillStyle = 'rgba(0,0,0,0.55)'; g2.fillRect(OW / 2 - 200, OH * 0.42 - 30, 400, 44 + ids.length * 28);
    outlined(S.winner ? `${seatName(S.winner)} WINS` : 'A TIE', OW / 2, OH * 0.42, 30, '#ffd23a');
    ids.forEach((id, k) => text(`${seatName(id)}  ${S.K.totals[id]}${ctx.kind === 'strokes' && d.seats[k].toPar !== null ? ` (${d.seats[k].toPar === 0 ? 'E' : d.seats[k].toPar > 0 ? '+' + d.seats[k].toPar : d.seats[k].toPar})` : ''}`, OW / 2, OH * 0.42 + 36 + k * 28, 18, SEAT_COLORS[k % SEAT_COLORS.length], 'center', 700));
    if (phase === 'over') text('press start to play again', OW / 2, OH * 0.42 + 50 + ids.length * 28, 14, '#fff', 'center', 500);
  }
}

// the page calls this from its frame step with its clock in seconds; the game steps at 60 Hz
let acc = 0, last = null;
function stepTurnsArena(t) {
  if (last === null) last = t;
  acc += Math.min(0.1, Math.max(0, t - last));
  last = t;
  while (acc >= 1 / TURN_FPS) { acc -= 1 / TURN_FPS; tick(); }
  draw();
}

window.__mojTurns = {
  get state() { return S; }, get phase() { return phase; }, get ctx() { return ctx; },
  display: () => (S ? turnsDisplay(S, ctx) : null),
  // a probe's run: so many seconds of the game stepped at once, the pad at rest (the computer seats play)
  run(seconds) { if (phase === 'wait') begin({}); const n = Math.round(seconds * TURN_FPS); for (let i = 0; i < n && phase === 'game'; i++) tick(); return S; },
};
