/**
 * brawl yard client — the practice room in the browser: the yard's room (brawl-practice.js) stepped at 60 a second from
 * the seats' buttons, drawn in the round on the world's level, under the belt's locked camera, its readouts in mana-ui
 * (brawl-yard.js's screen). Inlined by the brawl channel after the fight's and the brawl's pure modules, so every name it
 * uses is theirs or the page's (THREE, scene, camera, controls).
 *
 * What it draws: each body as the fight draws its fighters (the move's pose or the reaction's, jointed by the fight's rig
 * and stood in the round by its figure, versus-figure.js) on the belt: along it the body's x, across it its z; the
 * street's things; each player's LINE on the floor (the strip a blow must share, the yard's first lesson); a flash where a
 * blow lands; the fight's sounds by event where the page carries them.
 *
 * Its keys (the brawl scheme, controls/schemes.js): the stick, attack, jump, special; start the practice settings, back
 * the move list; R a reset. A second controller pressing attack or start drops in as the next player (four at most).
 */
/* global BRAWL_YARD, THREE, scene, camera, controls, manaUi, __BR_CTL, __BR_DEV, __BR_BIND, __BR_SEATK, practiceOf, stepYard, resetYard, yardRead, brawlMoveList, brawlPoseOf, rigJoints, figureBase, figurePose, beltCamera, beltPoint, viewHalf, yardHud, inputRun, BRAWL_RULES, PRACTICE_MODE_IDS */
const BY = BRAWL_YARD;
const BELT = BY.belt;
controls.enabled = false;
__ctrlOwnsCamera = true;   // the page's loop leaves the camera to the yard
// the stage in the belt's frame: x along it, y across it (toward the far side), z up, from its start
const YARD = new THREE.Group();
YARD.position.set(BELT.at[0], BELT.at[1], BELT.floor);
YARD.rotation.z = (BELT.heading * Math.PI) / 180;
scene.add(YARD);

// ── the room ─────────────────────────────────────────────────────────────────────────────────────────────────

const cap = (w) => w[0].toUpperCase() + w.slice(1);
const SET = { mode: 'Stand', type: 'Thug', count: '3', health: BY.health === 'refill' ? 'Refill' : 'Chains', fighter: BY.roster[BY.players[0] ?? 0].name, marks: true, log: true };
let picks = BY.players.slice(0, 4);
let dummies = BY.dummies;
let room = null, bodies = [], things = new Map(), t = 0;
const runs = [];
function dummiesOf() {
  const n = Number(SET.count) || 1, mode = SET.mode.toLowerCase(), type = SET.type.toLowerCase();
  return Array.from({ length: n }, () => ({ mode, type: mode === 'grab' ? 'heavy' : type }));
}
function build() {
  for (const B of bodies) YARD.remove(B.group, B.shadow, B.line);
  room = practiceOf({ belt: BELT, players: picks.map((i) => ({ recipe: BY.roster[i].recipe, style: BY.roster[i].style })), dummies, things: BY.things, health: SET.health.toLowerCase() });
  bodies = room.s.bodies.map((b, i) => makeBody(i < picks.length ? BY.roster[picks[i]].color : '#9a8f86', room.ctx.fighters[b.fi], i < picks.length));
  for (const m of things.values()) YARD.remove(m);
  things.clear();
  runs.length = 0;
}

// ── the bodies (the fight's stick figure in the round, versus-arena.client.js's) ────────────────────────────

const worldOf = (p, n, out) => out.set(p.x / 1000 + p.face * n[1], p.z / 1000 - p.face * n[0], p.y / 1000 + n[2]);
const BLADE_OF = { fall: 0, ko: 0, down: 0, thrown: 0, held: 0.4, rise: 0.4, hit: 0.5 };
// the light baked into the geometry's colours (the greybox world is drawn unlit, by its faces' own shading)
function shaded(geo) {
  const n = geo.attributes.normal, c = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const k = 0.5 + 0.5 * Math.max(0, n.getX(i) * -0.35 + n.getY(i) * -0.55 + n.getZ(i) * 0.76);
    c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
const CYL = shaded(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2));
const BALL = shaded(new THREE.SphereGeometry(1, 14, 10));
const INK = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
const LIMBS = [
  ['pelvisHub', 'neckHub', 1.7], ['shoulderL', 'shoulderR', 0.9], ['hipL', 'hipR', 0.9],
  ...['L', 'R'].flatMap((S) => [[`shoulder${S}`, `elbow${S}`, 1], [`elbow${S}`, `fist${S}`, 1], [`hip${S}`, `knee${S}`, 1.15], [`knee${S}`, `ankle${S}`, 1], [`ankle${S}`, `toe${S}`, 0.8]]),
];
const JOINTS = [['pelvisHub', 1.6], ...['L', 'R'].flatMap((S) => [[`shoulder${S}`, 1.2], [`elbow${S}`, 1], [`fist${S}`, 1.5], [`knee${S}`, 1.1], [`ankle${S}`, 1]])];
const farOf = (name, face) => { const S = name.slice(-1); return (S === 'L' && face > 0) || (S === 'R' && face < 0); };
function lambert(color) { return new THREE.MeshBasicMaterial({ color, vertexColors: true }); }
function makeBody(color, F, player) {
  const near = lambert(color), far = lambert(new THREE.Color(color).multiplyScalar(0.6));
  const group = new THREE.Group();
  const part = (geo, mat) => { const fill = new THREE.Mesh(geo, mat), ink = new THREE.Mesh(geo, INK); group.add(fill, ink); return { fill, ink }; };
  const limbs = LIMBS.map(([a, b, w]) => ({ a, b, w, ...part(CYL, near) }));
  const joints = JOINTS.map(([j, w]) => ({ j, w, ...part(BALL, near) }));
  const head = part(BALL, near);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  // a player's LINE: the strip along the street a blow must share (the core's `line` each side of its body)
  const line = player ? new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false })) : null;
  YARD.add(group, shadow);
  if (line) YARD.add(line);
  return { group, limbs, joints, head, shadow, line, near, far, base: figureBase(F.body), drawn: null };
}
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1), vD = new THREE.Vector3();
function cylinderAt(mesh, a, b, r) {
  vD.subVectors(b, a);
  const len = vD.length() || 0.001;
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, vD.normalize());
  mesh.scale.set(r, r, len);
}
// a body's pose, its joints eased over a few frames when what it is doing changes (a cut would snap)
function drawnOf(B, p, F) {
  const pose = brawlPoseOf(p, F, t + p.id * 40, { ...room.s.rules, pick: BRAWL_RULES.pick, kneeFrames: BRAWL_RULES.kneeFrames }), J = rigJoints(F.body, pose);
  const key = p.mv ? `mv:${p.mv}` : `st:${p.st}`;
  const d = B.drawn;
  if (!d) { B.drawn = { key, from: J, k: 1, pose, J }; return B.drawn; }
  if (key !== d.key) { d.from = d.J; d.k = 0; d.key = key; }
  d.k = Math.min(1, d.k + 1 / (p.mv ? 2 : 4));
  const e = d.k * d.k * (3 - 2 * d.k);
  d.pose = pose;
  d.J = d.k >= 1 ? J : Object.fromEntries(Object.keys(J).map((k) => [k, [d.from[k][0] + (J[k][0] - d.from[k][0]) * e, d.from[k][1] + (J[k][1] - d.from[k][1]) * e]]));
  return d;
}
function placeBody(B, p, F) {
  const hidden = !!p.gone;
  B.group.visible = !hidden; B.shadow.visible = !hidden;
  if (B.line) B.line.visible = !hidden;
  if (hidden) return;
  const { pose, J } = drawnOf(B, p, F);
  const N = figurePose(B.base, J, { face: p.face, air: !!pose.air, blade: BLADE_OF[p.st] ?? 1, stance: F.stance, twist: pose.twist ?? 0, sway: pose.sway ?? 0, tilt: pose.tilt ?? 0, spin: pose.spin ?? 0, bank: pose.bank ?? 0, lie: !!pose.lie, ...(pose.hands ? { hands: pose.hands } : {}), ...(pose.feet ? { feet: pose.feet } : {}) });
  const r = F.body.limbR / 1000;
  for (const L of B.limbs) {
    worldOf(p, N[L.a], vA); worldOf(p, N[L.b], vB);
    L.fill.material = farOf(L.a, p.face) && farOf(L.b, p.face) ? B.far : B.near;
    cylinderAt(L.fill, vA, vB, r * L.w); cylinderAt(L.ink, vA, vB, r * L.w * 1.32);
  }
  for (const Jn of B.joints) {
    worldOf(p, N[Jn.j], vA);
    Jn.fill.material = farOf(Jn.j, p.face) ? B.far : B.near;
    for (const [mesh, k] of [[Jn.fill, 1.05], [Jn.ink, 1.32]]) { mesh.position.copy(vA); mesh.scale.setScalar(r * Jn.w * k); }
  }
  worldOf(p, N.headBase, vA); worldOf(p, N.headTop, vB);
  vA.add(vB).multiplyScalar(0.5);
  const hr = F.body.head / 1000;
  B.head.fill.position.copy(vA); B.head.fill.scale.setScalar(hr);
  B.head.ink.position.copy(vA); B.head.ink.scale.setScalar(hr * 1.12);
  B.shadow.position.set(p.x / 1000, p.z / 1000, 0.01);
  B.shadow.scale.setScalar((F.body.bodyR / 1000) * 1.6 * Math.max(0.4, 1 - p.y / 1600));
  if (B.line) {
    const half = viewHalf(BELT);
    B.line.position.set(p.x / 1000, p.z / 1000, 0.008);
    B.line.scale.set(half * 2, (room.s.rules.line * 2) / 1000, 1);
  }
}

// ── the street's things ──────────────────────────────────────────────────────────────────────────────────────

const THING_LOOK = { food: [0.32, 0.32, 0.22, '#e8803a'], power: [0.3, 0.3, 0.3, '#3ad2ff'], weapon: [0.9, 0.07, 0.07, '#9aa0a8'] };
const BOX_LOOK = { barrel: '#8a5a32', crate: '#a0783e', booth: '#5a6a8a' };
function placeThings() {
  const seen = new Set();
  for (const T of room.s.things ?? []) {
    seen.add(T.id);
    let m = things.get(T.id);
    if (!m || m.userData.what !== T.what) {
      if (m) YARD.remove(m);
      const box = T.kind === 'box', D = box ? null : THING_LOOK[T.kind];
      const size = box ? [0.8, 0.8, 1] : D;
      m = new THREE.Mesh(shaded(new THREE.BoxGeometry(size[0], size[1], size[2]).translate(0, 0, size[2] / 2)), lambert(box ? BOX_LOOK[T.what] ?? '#8a6a4a' : D[3]));
      m.userData.what = T.what;
      things.set(T.id, m); YARD.add(m);
    }
    m.position.set(T.x / 1000, T.z / 1000, (T.y ?? 0) / 1000);
    if (T.kind === 'power') m.rotation.z = t * 0.05;
  }
  for (const [id, m] of things) if (!seen.has(id)) { YARD.remove(m); things.delete(id); }
}

// ── a flash where a blow lands ───────────────────────────────────────────────────────────────────────────────

const FLASHES = [];
const FLASH_GEO = new THREE.SphereGeometry(1, 12, 8);
function flash(e, heavy) {
  const m = new THREE.Mesh(FLASH_GEO, new THREE.MeshBasicMaterial({ color: heavy ? 0xffd23a : 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  m.position.set(e.x / 1000, (e.z ?? 0) / 1000, (e.y ?? 1100) / 1000);
  YARD.add(m); FLASHES.push({ m, k: 0, n: heavy ? 12 : 8, r: heavy ? 0.45 : 0.3 });
}
function stepFlashes() {
  for (let i = FLASHES.length - 1; i >= 0; i--) {
    const F = FLASHES[i]; F.k++;
    const u = F.k / F.n;
    F.m.scale.setScalar(F.r * (0.4 + u)); F.m.material.opacity = 0.9 * (1 - u);
    if (F.k >= F.n) { YARD.remove(F.m); F.m.material.dispose(); FLASHES.splice(i, 1); }
  }
}

// ── the sounds: the fight's cues by event, where the page's audio channel carries them ──────────────────────

const HIT_CUE = ['hit-light', 'hit-medium', 'hit-heavy'];
function cueOf(e) {
  if (e.t === 'hit') return e.kind === 'flung' ? 'crush' : e.limb === 'foot' ? (e.w >= 2 ? 'kick-heavy' : 'kick-light') : e.limb === 'blade' ? (e.w >= 2 ? 'blade-heavy' : 'blade-light') : HIT_CUE[Math.min(2, e.w ?? 1)];
  return { grab: 'grab', throw: 'throw', land: 'land', ko: 'ko', break: 'crush', thud: 'block', armor: 'clash', state: 'super', toss: 'throw' }[e.t] ?? null;
}
function sound(e) {
  if (typeof __beatsCue !== 'function' || typeof __AUDIO === 'undefined' || !__AUDIO || !__AUDIO.cues) return;
  const c = cueOf(e);
  if (c && __AUDIO.cues[c]) __beatsCue(__AUDIO.cues[c], 0.8);
}
const unlock = () => { if (typeof __beatsUnlock === 'function') __beatsUnlock(); };
addEventListener('keydown', unlock); addEventListener('pointerdown', unlock);

// ── the seats (controls/seats-kernel.js): four, each a controller; the keyboard one, every pad another ──────────

const HELD = new Set(), LATCH = new Set();
addEventListener('keydown', (e) => {
  HELD.add(e.code); LATCH.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyR' && !UI.rt.state().screen) { room = resetYard(room); for (const B of bodies) B.drawn = null; }
});
addEventListener('keyup', (e) => HELD.delete(e.code));
addEventListener('blur', () => HELD.clear());
const kbRead = (c) => HELD.has(c) || LATCH.has(c);
let SEATS = __BR_SEATK.newSeats({ max: 4 }), READS = {};
function pollSeats() {
  const reads = { keyboard: kbRead }, frame = {};
  const wants = (fam, rd) => __BR_CTL.held(__BR_BIND, 'start', fam, rd) || __BR_CTL.held(__BR_BIND, 'attack', fam, rd);
  frame.keyboard = { join: wants('keyboard', kbRead) };
  const ps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (let k = 0; k < ps.length; k++) {
    const p = ps[k];
    if (!p || !p.connected) continue;
    const id = 'pad:' + p.index, rd = __BR_CTL.gamepadRead(p, __BR_DEV);
    reads[id] = rd; frame[id] = { connected: true, join: wants('gamepad', rd) };
  }
  for (const x of SEATS.seats) if (!frame[x.controller]) frame[x.controller] = { connected: false };
  SEATS = __BR_SEATK.step(SEATS, frame);
  READS = reads;
}
const NO_BUTTONS = Object.freeze({ x: 0, z: 0, a: false, j: false, s: false, start: false, back: false });
function buttonsOf(i) {
  const s = __BR_SEATK.seat(SEATS, i + 1);
  if (!s || s.away || !READS[s.controller]) return NO_BUTTONS;
  const fam = s.controller === 'keyboard' ? 'keyboard' : 'gamepad', rd = READS[s.controller];
  const on = (id) => __BR_CTL.held(__BR_BIND, id, fam, rd);
  return { x: (on('right') ? 1 : 0) - (on('left') ? 1 : 0), z: (on('up') ? 1 : 0) - (on('down') ? 1 : 0), a: on('attack'), j: on('jump'), s: on('special'), start: on('start'), back: on('back') };
}
const seated = () => SEATS.seats.filter((x) => !x.away).length;

// ── the screen (mana-ui over the yard: brawl-yard.js) ────────────────────────────────────────────────────────

const UI = (() => {
  const style = document.createElement('style');
  style.textContent = BY.yard.css;
  document.head.appendChild(style);
  const settings = [{ kind: 'cycler', label: 'Fighter', var: 'brawl.practice.set.fighter', options: BY.roster.map((r) => r.name) }, ...BY.yard.settings];
  const state = { brawl: { practice: { set: SET, settings, moves: [], marks: [], heads: [], beats: [], ended: '', presses: [], inputs: [], clinch: { holding: false, left: 0, of: 1, knees: 0, behind: '' } } } };
  const el = document.createElement('div');
  document.body.appendChild(el);
  const setPath = (path, to) => { const k = path.split('.'), last = k.pop(); k.reduce((o, x) => o[x], state)[last] = to; };
  const rt = manaUi.runtime(BY.yard.spec, {
    read: (p) => manaUi.readPath(state, p),
    act: (e) => { if (e && e.set) setPath(e.set, e.to); if (e && e.emit === 'training:reset') { room = resetYard(room); rt.close(); } },
    now: () => performance.now() / 1000,
  });
  rt.glyphs({ keys: { up: 'W', down: 'S', left: 'A', right: 'D', tabPrev: 'A', tabNext: 'D', back: 'Esc', accept: 'J' }, pad: { xbox: { up: '↑', down: '↓', left: '←', right: '→', tabPrev: '←', tabNext: '→', back: 'B', accept: 'A' } } });
  rt.input('keys');
  const view = manaUi.mount(el, rt, { auto: true });
  return { state, rt, view, press: (a) => { rt.press(a); view.paint(); } };
})();
// the settings applied as the screen closes: the fighter, the dummies, their health
let applied = JSON.stringify(SET);
function applySettings() {
  const now = JSON.stringify(SET);
  if (now === applied) return;
  applied = now;
  const f = BY.roster.findIndex((r) => r.name === SET.fighter);
  if (f >= 0) picks[0] = f;
  dummies = dummiesOf();
  build();
}
const MENU_PREV = {};
function menuEdges(b) {
  const now = { up: b.z > 0, down: b.z < 0, left: b.x < 0, right: b.x > 0, accept: b.a || b.j, back: b.back || b.s, start: b.start };
  const edge = {};
  for (const k of Object.keys(now)) edge[k] = now[k] && !MENU_PREV[k];
  Object.assign(MENU_PREV, now);
  return edge;
}

// ── a frame ──────────────────────────────────────────────────────────────────────────────────────────────────

const vP = new THREE.Vector3();
const project = (x, z, y) => { YARD.localToWorld(vP.set(x / 1000, z / 1000, y / 1000)).project(camera); return [(vP.x + 1) / 2, (1 - vP.y) / 2]; };
function frameCamera() {
  const C = beltCamera(BELT, room.s.cam / 1000);
  const aspect = (innerWidth || 16) / (innerHeight || 9);
  const v = (2 * Math.atan(Math.tan((C.horizontalFov * Math.PI) / 360) / aspect) * 180) / Math.PI;
  if (Math.abs(camera.fov - v) > 0.01) { camera.fov = v; camera.updateProjectionMatrix(); }
  camera.position.set(...C.cameraPosition);
  camera.up.set(0, 0, 1);
  camera.lookAt(...C.lookAt);
}
function tick() {
  pollSeats();
  const b0 = buttonsOf(0), edge = menuEdges(b0), screen = UI.rt.state().screen;
  if (screen) {
    for (const a of ['up', 'down', 'left', 'right', 'accept', 'back']) if (edge[a]) UI.press(a);
    if (edge.start) UI.press('back');
    if (!UI.rt.state().screen) applySettings();
    return;
  }
  if (edge.start) { UI.rt.open('settings'); UI.view.paint(); return; }
  if (edge.back) { UI.state.brawl.practice.moves = brawlMoveList(room.ctx.fighters[0]); UI.rt.open('moves'); UI.view.paint(); return; }
  // (a second controller sat down: it drops in as the next player)
  if (seated() > picks.length && picks.length < 4) { picks = [...picks, (picks.length) % BY.roster.length]; build(); }
  const buttons = picks.map((_, i) => buttonsOf(i));
  room = stepYard(room, buttons);
  t++;
  for (const e of room.s.events) {
    if (e.t === 'hit') flash(e, (e.w ?? 1) >= 2);
    sound(e);
  }
  const next = inputRun(runs, buttons[0]);
  runs.splice(0, runs.length, ...next);
}
function draw() {
  frameCamera();
  room.s.bodies.forEach((p, i) => placeBody(bodies[i], p, room.ctx.fighters[p.fi]));
  placeThings();
  stepFlashes();
  const read = yardRead(room, 0);
  Object.assign(UI.state.brawl.practice, yardHud(read, room.ctx.fighters[room.s.bodies[0].fi], project, runs.map((x) => ({ text: x.text }))));
}

build();
// the page calls this from its frame step with its clock in MILLISECONDS; the yard steps at 60 a second
let yardAcc = 0, yardLast = null;
function stepBrawlYard(ms) {
  const s = ms / 1000;
  if (yardLast === null) yardLast = s;
  yardAcc += Math.min(0.1, Math.max(0, s - yardLast));
  yardLast = s;
  while (yardAcc >= 1 / 60) { yardAcc -= 1 / 60; tick(); }
  LATCH.clear();
  draw();
}
window.__mojBrawl = { get room() { return room; }, get ui() { return UI; }, get read() { return yardRead(room, 0); } };
