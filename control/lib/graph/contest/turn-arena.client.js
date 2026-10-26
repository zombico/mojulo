/**
 * turn arena — a turn sport in a browser (inlined into the World page's turns block after the physics, the hit, the
 * contest kernel, the minds and the turn sim: scene/channels/contest.js). From the page it uses only what a channel
 * may: `THREE`, `scene`, `camera`, `controls`, `wrap`, and `__ctrlOwnsCamera` (it owns the camera from the start).
 *
 * One pad, hot-seat: the seat the kernel names holds it (the arrows or WASD turn the aim and set the lift or the hook,
 * Space or F charges and releases the shot, Enter begins again; gamepad 0 the same), the computer plays the rest. The
 * course is drawn from the kernel's regions (the tee, the fairway, the green, the bunkers, the water, the cup and its
 * flag; the approach, the lane, the gutters, the pins), the ball with its shadow, the aim as a line from the ball, the
 * camera behind the ball toward the target and following the shot. Nobody is drawn unless the course carries its seats'
 * athletes (characters made with create_character: athlete.client.js): then the seat to play stands to the ball in its
 * own body and swings with the meter. The overlay is the broadcast package (broadcast/broadcast.client.js): the open
 * with the seats, the bug as the card (a column a hole or a frame, the total on the accent metal, the seat to play
 * marked), the tab (the hole, its par, the club and the distance; the frame and the pins standing), the meter in the
 * seat's colour, the kernel's calls on their plates (TO PLAY, BIRDIE, STRIKE, IN THE WATER), the closeup on the cup
 * with the golfer's lower third, the bowler's on a strike or a spare, and the results board.
 *
 * As a level: hosted in a game's frame it posts READY, plays the game INIT brings (seats, players, register, level,
 * seed over the course's own), and posts the OUTCOME at the end: success when a player's seat won (or no player holds
 * a seat: an exhibition), fail otherwise, the totals as stats. On its own it starts at once and runs again on start.
 */
/* global TURNS_ARENA, THREE, scene, camera, controls, wrap, newTurns, stepTurns, turnContext, turnsDisplay, targetOf, clubOf, TPAD, TURN_FPS, athleteRig, placeAthlete, swingStick, newBroadcast, tvNames, tvAdvance, tvCall, tvOpen, tvBoard, tvCut, tvStrap, tvShot, tvDraw */

const TA = TURNS_ARENA, CO = TA.course, SP = TA.sport;
const hosted = window.parent !== window;
const BC = TA.broadcast, TV = newBroadcast(BC);
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

// the seats' athletes in their own bodies, when the course carries them (athlete.client.js inlined before this): the
// seat to play stands to the ball (a golfer square to the line with the ball before it, a bowler behind it), takes the
// club or the arm back with the meter and through with the shot, and holds its finish while the ball runs
const ATH = typeof athleteRig === 'function' && TA.bodies ? athleteRig(TA) : null;
const seatBodies = {};
let stance = null;
const BACKSWING = { drive: 2.4, iron: 2.1, putt: 0.7, roll: 1.3 };
function placeSeat() {
  for (const A of Object.values(seatBodies)) A.group.visible = A.shadow.visible = false;
  if (!ATH || S.over) return;
  const i = Number(S.K.turn.slice(1)) - 1;
  if (!ATH.has(i)) return;
  const A = seatBodies[i] || (seatBodies[i] = ATH.make(i));
  const b = S.sim.bodies[0], golf = ctx.kind === 'strokes';
  if (S.K.phase === 'turn' && !S.shot && S.dead === 0) {
    const t = targetOf(ctx, S), along = (golf ? Math.atan2(t[1] - b.position[1], t[0] - b.position[0]) : Math.PI / 2) - (S.aim.x * ctx.spread * Math.PI) / 180;
    const face = golf ? along - Math.PI / 2 : along, fx = Math.cos(face), fy = Math.sin(face);
    const at = golf ? [b.position[0] - fx * 0.75, b.position[1] + OY - fy * 0.75] : [b.position[0] - fx * 0.45 - fy * 0.2, b.position[1] + OY + fx * 0.2 - fy * 0.45];
    stance = { at, face, along, back: BACKSWING[clubOf(ctx, S)] || 1.5 };
  }
  if (!stance) return;
  const swing = S.shot || S.dead > 0 ? stance.back * 0.9 : -(S.charge.meter || 0) * stance.back;
  placeAthlete(A, swingStick({ at: stance.at, face: stance.face, along: stance.along, swing, both: golf }), { face: [Math.cos(stance.face), Math.sin(stance.face)] });
  A.group.visible = A.shadow.visible = true;
}

// ── the game ─────────────────────────────────────────────────────────────────────────────────────────────────

let ctx = null, S = null, phase = 'wait', waited = 0, lastParams = null, calls = 0;
const SPORT = TA.title || (TA.sport.id || 'the game').replace(/-/g, ' ');
const seatIx = (id) => Number(id.slice(1)) - 1;
const seatName = (id) => tvNames(BC, ctx ? ctx.seats : TA.seats, ctx ? ctx.players : TA.players)[seatIx(id)];
function begin(params = {}) {
  lastParams = params;
  ctx = turnContext({ ...TA, players: params.players ?? TA.players, register: params.register ?? TA.register, level: params.level ?? TA.level, seed: params.seed ?? TA.seed });
  S = newTurns(ctx);
  stance = null;
  calls = 0;
  tvOpen(TV, { title: SPORT, rows: Object.keys(S.K.cards).map((id) => ({ name: seatName(id), color: seatIx(id) })) });
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
const strokes = () => ctx.kind === 'strokes';
const NAMES = {
  who: (id) => ({ name: seatName(id), color: seatIx(id) }),
  round: (c) => (strokes() ? `hole ${c.round}` : `frame ${c.round}`),
  gutter: () => !!S.ball.gutter,
};
// the director: each call on its plate; a holed ball and the camera closes on the cup; a strike or a spare names the bowler
function readCalls() {
  for (; calls < S.calls.length; calls++) {
    const c = S.calls[calls], q = tvCall(TV, c, NAMES);
    if (c.kind === 'over') {
      const ids = Object.keys(S.K.totals).sort((a, b) => (strokes() ? S.K.totals[a] - S.K.totals[b] : S.K.totals[b] - S.K.totals[a]));
      const seats = turnsDisplay(S, ctx).seats, toPar = (id) => { const t = seats.find((x) => x.id === id).toPar; return t === null || t === undefined ? '' : t === 0 ? 'E' : t > 0 ? `+${t}` : String(t); };
      let place = 0, prev = null;
      const rows = ids.map((id, k) => { if (S.K.totals[id] !== prev) { place = k + 1; prev = S.K.totals[id]; } return { place, name: seatName(id), color: seatIx(id), value: String(S.K.totals[id]), note: strokes() ? toPar(id) : '' }; });
      tvBoard(TV, { title: `${SPORT} · final`, rows, foot: hosted ? null : 'press start to play again' });
    }
    if (q && q.strap && (c.mark === 'strike' || c.mark === 'spare')) tvStrap(TV, { name: seatName(c.who), line: `frame ${c.round} · ${c.mark}`, tag: String(seatIx(c.who) + 1), color: seatIx(c.who), hold: 0.9 });
    if (!q || q.cut !== 'ball') continue;
    const b = S.sim.bodies[0];
    tvCut(TV, { on: [b.position[0], b.position[1] + OY, 0], hold: 60, lift: 0.25, rise: 0.5, dist: 2.6, fov: 36, strap: { name: seatName(c.who), line: `hole ${c.round} · ${c.strokes} ${c.strokes === 1 ? 'stroke' : 'strokes'}${c.par ? ` · par ${c.par}` : ''}`, tag: String(seatIx(c.who) + 1), color: seatIx(c.who) } });
  }
}
function tick() {
  const pad = padNow();
  const start = startEdge(pad);
  tvAdvance(TV);
  if (phase === 'wait') { if (!hosted || ++waited > 90) begin({}); return; }
  if (phase === 'over') { if (start) begin(lastParams); return; }
  if (phase !== 'game') return;
  stepTurns(S, pad, ctx);
  readCalls();
  if (S.hole !== courseHole) dressHole(S.hole);
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
  tvShot(TV, camera, [cam.lx, cam.ly, cam.lz]);
}
const parWord = (t) => (t === null || t === undefined ? '' : t === 0 ? 'E' : t > 0 ? `+${t}` : String(t));
function feedOf(d) {
  const n = d.rounds, low = strokes();
  const rows = d.seats.map((seat) => {
    const cells = low ? Array.from({ length: n }, (_, k) => (seat.rounds[k] ? String(seat.rounds[k].strokes) : '')) : Array.from({ length: n }, (_, k) => (seat.frames[k] ? seat.frames[k].mark.join('') : ''));
    return { name: seatName(seat.id), color: seatIx(seat.id), cells: [...cells, low ? (seat.toPar !== null ? parWord(seat.toPar) : String(seat.total)) : String(seat.total)], mark: d.turn === seat.id && !S.over ? 'turn' : null };
  });
  const aiming = S.K.phase === 'turn' && !S.shot && !S.over, live = d.turn ? seatIx(d.turn) : 0;
  const t = aiming ? targetOf(ctx, S) : null, par = low && TA.C.rounds[S.hole] ? TA.C.rounds[S.hole].par : null;
  return {
    title: SPORT, cols: [...Array.from({ length: n }, (_, k) => String(k + 1)), low ? 'TOT' : 'TOT'], hot: n, rows,
    tab: low ? `hole ${d.round}${par ? ` · par ${par}` : ''}${d.club && t ? ` · ${d.club} · ${Math.round(Math.hypot(t[0] - d.ball[0], t[1] - d.ball[1]))} m` : ''}` : `frame ${d.round} · ${d.standing} standing`,
    ...(aiming ? { meter: { share: d.charging ? d.meter : 0, label: d.charging ? 'release!' : live < ctx.players ? 'hold to charge · ◂ ▸ aim' : `${seatName(d.turn)} lines it up`, color: live } } : {}),
  };
}
function draw() {
  g2.setTransform(ODPR, 0, 0, ODPR, 0, 0);
  g2.clearRect(0, 0, OW, OH);
  if (!S) { tvDraw(TV, g2, OW, OH, null); return; }
  placeBodies(); placeSeat(); frameCamera();
  tvDraw(TV, g2, OW, OH, feedOf(turnsDisplay(S, ctx)));
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
  // how many players are drawn in their own bodies (athlete.client.js) at this frame
  athletes: () => Object.values(seatBodies).filter((A) => A.group.visible).length,
  get state() { return S; }, get phase() { return phase; }, get ctx() { return ctx; },
  display: () => (S ? turnsDisplay(S, ctx) : null),
  // a probe's run: so many seconds of the game stepped at once, the pad at rest (the computer seats play)
  run(seconds) { if (phase === 'wait') begin({}); const n = Math.round(seconds * TURN_FPS); for (let i = 0; i < n && phase === 'game'; i++) tick(); return S; },
};
