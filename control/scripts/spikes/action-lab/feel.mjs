/**
 * action-lab — FEEL: what a button does, as one card, played by one pure step.
 *
 * The animation-games spike retimed a take on its own clock. A game runs on the player's: THE PRESS IS THE BEAT. This
 * kernel decides the frame of every event (the take-off, the contact, the landing, a hitstop's edges) and the clips are
 * fitted to its frames afterwards (takes.mjs), never the other way. One FEEL card is read three ways: the kernel steps
 * it, the takes are fitted to it, and the frame data is read off it (`frameData`), so the three cannot disagree.
 *
 * A step takes the card (the game) and a BODY (the character: its reach and blow speed per move, its strides, its
 * mass). The same card on another body reaches shorter, hits lighter and strides differently; the same body in another
 * card moves to another game's physics.
 *
 *   realistic    the body on earth: momentum builds and costs, a jump waits for its gather, no holds, a blow's real
 *                momentum, the hit body's own flinch
 *   action       force made visible: top speed at once, a quick gather and a high hang, a light that snaps out in six
 *                frames (the deep wind-up lives inside the startup, never before it), both bodies frozen on the blow,
 *                a string of three cancelled one into the next on an authored stun, a rolling dodge with invincible
 *                frames, the finisher throws
 *   platformer   movement first: no gather, the platform rule's arc (8.5 m/s up on gravity 20, down on 34), the jump
 *                cut short on release, coyote time and a buffer, an air dash, a hit is a boop and then mercy
 *   pinball      speed: momentum that builds long and keeps, steering not turning, every wall a bumper, a boost that
 *                cannot be hurt, a hit ricochets out faster than it came
 *
 * THE LAWS every card keeps (verify.mjs): the same pad gives the same trace; an idle pad moves nothing; every press ends
 * acted on or dropped with its reason; a ground jump leaves on press + commit; a buffered or coyote jump within its
 * window jumps and one frame past it does not; a held jump rises monotonic in the hold and the full hold reaches the
 * card's height; contact on the card's startup; a hitstop freezes both bodies for the same frames; no body passes a
 * wall at any speed.
 *
 *   FPS, DT, BTN, FEELS, FEEL_IDS, ARENA
 *   newState(card, body, { arena, spar, guard }) → state      (the card is held by the state: dials edit it live)
 *   step(state, pad) → state'   pad = [x, y, buttons], or a bare number (buttons, the stick at rest): the stick in −127..127 (+y ahead, +x right), BTN bits
 *   poseOf(state, who) → what the body shows (a clip and a frame in it: takes.mjs bakes them)
 *   frameData(card, body) → per move: startup, active, recovery, total, cancel, and its advantage on hit and on block
 *
 * NO IMPORTS: the page inlines this file's text (lab.mjs), so the gate and the eyes run the same code. Pure and
 * deterministic: no Math.random, no Date. A lab: nothing registers.
 */
export const FPS = 60;
export const DT = 1 / FPS;
export const BTN = Object.freeze({ JUMP: 1, ATTACK: 2, DODGE: 4, SPRINT: 8 });
const G = 9.81, RADIUS = 0.3, STEP = 0.12, DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const len2 = (x, y) => Math.hypot(x, y);

/**
 * The cards. Times in frames at 60 fps unless named `s`; speeds m/s; accelerations m/s²; turn deg/s.
 *
 *   ground   walk / run / sprint (stick full is run, SPRINT held is sprint), accel (toward the stick), decel (no stick,
 *            or against it), turn (facing), steer (deg/s: the velocity's heading turns at most this fast, a
 *            projectile's arc; absent: the velocity moves straight to the stick's)
 *   jump     commit (frames from the press on the ground to the take-off: the gather), height (m, the full hold's
 *            apex), gRise, gFall, cut (the rise's speed times this on release; 1: no cut), hang (frames held at the
 *            apex while the button is held), coyote (frames after walking off an edge a jump still takes), buffer
 *            (frames a press in the air waits for the landing), air (the share of ground control in the air), maxFall,
 *            land (frames the landing shows standing), heavy { fall (m/s), lag (frames without control) }
 *   dodge    kind (sidestep | roll | dash | boost), frames, speed, iframes [from, to) or null, air (allowed off the
 *            ground), cancel (out of a move's recovery)
 *   moves    string: the moves a press chains through, each { take, startup, snap (load → contact, inside startup),
 *            active, recovery, wings { wind, after } (how far the wind-up and follow-through go from ready: the clip's,
 *            takes.mjs), lunge (m stepped through startup), finisher, force (over the card's) }; cancel ('none',
 *            'half': half way through recovery, or frames after active), buffer, root (stop: a move plants the feet;
 *            keep: it carries the run), air (moves allowed off the ground)
 *   hit      hitstop { base, perMs, max } or null (frames, both bodies), stun ({ model: 'body' } the flinch the blow
 *            causes; { model: 'rule', base s, decay, min s } combat-hit's combo rule; { model: 'none' }), force
 *            (momentum { gain, lift deg } | boop { push, bounce, hop } | ricochet { restitution, floor }), mercy (frames
 *            a hit body cannot be hit again), alert (frames a free body that saw a hit guards the next)
 *   wall     stop { stagger m/s } | bonk { above, rebound, hop } | bounce { e, cap }
 *   look     squash (the volume-kept squash and stretch at take-off and landing), smear (m a hand jumps a frame)
 */
export const FEELS = Object.freeze({
  realistic: {
    says: 'the body on earth: momentum builds and costs, a jump waits for its gather, no holds, real momentum',
    ground: { walk: 1.4, run: 3.5, sprint: 6.5, accel: 6, decel: 9, turn: 540 },
    jump: { commit: 12, height: 0.45, gRise: G, gFall: G, cut: 1, hang: 0, coyote: 3, buffer: 6, air: 0.1, maxFall: 30, land: 10, heavy: { fall: 5.5, lag: 12 } },
    dodge: { kind: 'sidestep', frames: 22, speed: 3.2, iframes: null, air: false, cancel: false },
    moves: {
      string: [
        { take: 'jab', startup: 11, snap: 6, active: 2, recovery: 12, wings: { wind: 1, after: 1 }, lunge: 0.08 },
        { take: 'jab', startup: 11, snap: 6, active: 2, recovery: 12, wings: { wind: 1, after: 1 }, lunge: 0.08 },
        { take: 'cross', startup: 15, snap: 8, active: 2, recovery: 16, wings: { wind: 1, after: 1 }, lunge: 0.12 },
      ],
      cancel: 'half', buffer: 8, root: 'stop', air: false,
    },
    hit: { hitstop: null, stun: { model: 'body' }, force: { model: 'momentum', gain: 1, lift: 0 }, mercy: 0, alert: 60 },
    wall: { model: 'stop', stagger: 3.5 },
    look: { squash: 0, smear: null },
  },
  action: {
    says: 'force made visible: top speed at once, a quick gather and a hang, a light that snaps, both bodies frozen on the blow',
    ground: { walk: 2, run: 6.5, sprint: 9, accel: 45, decel: 60, turn: 1440 },
    jump: { commit: 3, height: 1.3, gRise: 28, gFall: 40, cut: 0.45, hang: 5, coyote: 6, buffer: 8, air: 0.85, maxFall: 25, land: 4, heavy: null },
    dodge: { kind: 'roll', frames: 24, speed: 8.5, iframes: [2, 15], air: false, cancel: true },
    moves: {
      string: [
        { take: 'jab', startup: 6, snap: 2, active: 3, recovery: 14, wings: { wind: 1.6, after: 1.4 }, lunge: 0.3 },
        { take: 'jab', startup: 6, snap: 2, active: 3, recovery: 14, wings: { wind: 1.6, after: 1.4 }, lunge: 0.3 },
        { take: 'cross', startup: 9, snap: 3, active: 3, recovery: 22, wings: { wind: 1.8, after: 1.5 }, lunge: 0.4, finisher: true, force: { gain: 12, lift: 18 } },
      ],
      cancel: 2, buffer: 12, root: 'stop', air: true,
    },
    hit: { hitstop: { base: 4, perMs: 0.6, max: 14 }, stun: { model: 'rule', base: 0.5, decay: 0.85, min: 0.12 }, force: { model: 'momentum', gain: 2, lift: 0 }, mercy: 0, alert: 60 },
    wall: { model: 'stop', stagger: null },
    look: { squash: 0.06, smear: 0.09 },
  },
  platformer: {
    says: 'movement first: no gather, the platform rule\'s arc, a cut jump, coyote and buffer, an air dash, a hit is a boop',
    ground: { walk: 2.5, run: 6, sprint: 8, accel: 75, decel: 75, turn: Infinity },
    jump: { commit: 0, height: 1.806, gRise: 20, gFall: 34, cut: 0.5, hang: 0, coyote: 6, buffer: 6, air: 0.7, maxFall: 18, land: 4, heavy: null },
    dodge: { kind: 'dash', frames: 12, speed: 11, iframes: null, air: true, cancel: false },
    moves: {
      string: [{ take: 'jab', startup: 4, snap: 2, active: 4, recovery: 10, wings: { wind: 1.25, after: 1.2 }, lunge: 0 }],
      cancel: 'none', buffer: 6, root: 'keep', air: true,
    },
    hit: { hitstop: { base: 2, perMs: 0, max: 2 }, stun: { model: 'none' }, force: { model: 'boop', push: 2.5, bounce: 3, hop: 0.3 }, mercy: 60, alert: 0 },
    wall: { model: 'bonk', above: 4.5, rebound: 3, hop: 0.5 },
    look: { squash: 0.22, smear: null },
  },
  pinball: {
    says: 'speed: momentum that builds long and keeps, steering not turning, every wall a bumper, a hit ricochets',
    ground: { walk: 3, run: 12, sprint: 20, accel: 7, decel: 2.5, turn: 720, steer: 200 },
    jump: { commit: 0, height: 1.0, gRise: 15.7, gFall: 15.7, cut: 0.6, hang: 0, coyote: 6, buffer: 6, air: 0.3, maxFall: 30, land: 0, heavy: null, spin: true },
    dodge: { kind: 'boost', frames: 20, speed: 8, iframes: [0, 20], air: true, cancel: true },
    moves: {
      string: [{ take: 'jab', startup: 3, snap: 1, active: 3, recovery: 6, wings: { wind: 1, after: 1 }, lunge: 0 }],
      cancel: 'none', buffer: 6, root: 'keep', air: true,
    },
    hit: { hitstop: null, stun: { model: 'none' }, force: { model: 'ricochet', restitution: 1.3, floor: 6 }, mercy: 20, alert: 0 },
    wall: { model: 'bounce', e: 1.3, cap: 20 },
    look: { squash: 0.1, smear: 0.05 },
  },
});
export const FEEL_IDS = Object.freeze(Object.keys(FEELS));

/** The arena: a square floor walled at ±half, and blocks { x: [x0, x1], y: [y0, y1], h } (a ledge to jump on, a wall). */
export const ARENA = Object.freeze({
  half: 9,
  blocks: [
    { id: 'low', x: [-7, -3], y: [1, 5], h: 0.4 },
    { id: 'ledge', x: [3, 7], y: [2, 4.5], h: 1.1 },
    { id: 'wall', x: [-2, 2], y: [7, 7.6], h: 2.5 },
  ],
  hero: [0, -3], dummy: [0, 0],
});

// ─── state ───────────────────────────────────────────────────────────────
const copy = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === Infinity ? 'Infinity' : v)), (k, v) => (v === 'Infinity' ? Infinity : v));
function bodyAt(xy, yaw) {
  return { fresh: false, touched: -99, p: [xy[0], xy[1], 0], v: [0, 0, 0], yaw, grounded: true, coyote: 0, jumped: false, cut: false, hang: 0, apex: null,
    act: null, stop: 0, stun: 0, mercy: 0, lag: 0, alert: 0, combo: 0, lastHit: null, stride: 0, spin: 0,
    tookOff: -99, landed: -99, fallSpeed: 0 };
}
/**
 * A new lab: the card (copied: dials edit the state's own), the body (takes.mjs `bodyOf`: reach and real blow speed
 * per take, strides, mass), the arena. `spar`: the dummy throws a telegraphed jab at a hero in range. `guard`: a free
 * dummy that saw a hit coming guards the next one.
 */
export function newState(card, body, { arena = ARENA, spar = false, guard = true } = {}) {
  return { f: 0, card: copy(card), body, arena, spar, guard, events: [], queue: [], held: 0,
    hero: bodyAt(arena.hero, 0), dummy: bodyAt(arena.dummy, Math.PI) };
}

// ─── the step ───────────────────────────────────────────────────────────
/**
 * One tick. The order: the press edges are read (each acted now, queued for its buffer, or dropped); the queue is
 * tried; each body unfrozen moves (control, its act, gravity, the walls, the ground); the queue is tried again (a press
 * meeting its landing); the hits are tested; the timers run. A frozen body (hitstop) changes nothing at all.
 */
export function step(S0, pad) {
  const S = copy(S0); S.events = [];
  const [px, py, b] = typeof pad === 'number' ? [0, 0, pad] : pad ?? [0, 0, 0];   // a bare number: buttons, the stick at rest
  const pressed = b & ~S.held, released = S.held & ~b; S.held = b;
  const stick = stickOf(px, py);
  const H = S.hero, D = S.dummy;
  for (const [name, bit] of [['jump', BTN.JUMP], ['attack', BTN.ATTACK], ['dodge', BTN.DODGE]]) if (pressed & bit) press(S, name, stick);
  if ((released & BTN.JUMP) && !H.stop) cutJump(S, H);
  tryQueue(S, stick);
  if (!H.stop) moveBody(S, H, 'hero', stick, b);
  if (!D.stop) moveBody(S, D, 'dummy', null, 0);
  tryQueue(S, stick);
  if (!H.stop) testHit(S, H, D, 'hero');
  if (!D.stop) { sparThink(S); testHit(S, D, H, 'dummy'); }
  for (const [w, B] of [['hero', H], ['dummy', D]]) {
    // a frozen body changes nothing; the tick that struck (or was struck) still shows its own frame and runs on
    if (B.stop && !B.fresh) { B.stop--; continue; }
    B.fresh = false;
    if (B.act) { B.act.shown = B.act.f; B.act.f++; endAct(S, B, w); }
    if (B.stun > 0 && --B.stun === 0) S.events.push({ f: S.f, who: w, type: 'free' });
    if (B.mercy > 0) B.mercy--;
    if (B.alert > 0) B.alert--;
    if (B.lag > 0) B.lag--;
  }
  for (const q of S.queue) if (!H.stop) q.age++;
  S.f++;
  return S;
}

function stickOf(px, py) {
  let x = clamp(px, -127, 127) / 127, y = clamp(py, -127, 127) / 127; const m = len2(x, y);
  if (m < 0.2) return { x: 0, y: 0, m: 0 };
  if (m > 1) { x /= m; y /= m; }
  return { x, y, m: Math.min(1, m) };
}

// ─── presses: acted, queued, dropped ─────────────────────────────────────
function press(S, name, stick) {
  S.events.push({ f: S.f, who: 'hero', type: 'press', button: name });
  const why = S.hero.stop ? { reason: 'hitstop', queue: true } : can(S, name);
  if (why === true) return act(S, name, stick, 0);
  const buf = name === 'jump' ? S.card.jump.buffer : name === 'attack' ? S.card.moves.buffer : 0;
  if (buf > 0 && why.queue) { S.queue.push({ button: name, f: S.f, age: 0, buffer: buf, why: why.reason }); S.events.push({ f: S.f, who: 'hero', type: 'buffered', button: name, why: why.reason }); return; }
  S.events.push({ f: S.f, who: 'hero', type: 'dropped', button: name, why: why.reason });
}
function tryQueue(S, stick) {
  if (S.hero.stop) return;
  S.queue = S.queue.filter((q) => {
    if (q.age > q.buffer) { S.events.push({ f: S.f, who: 'hero', type: 'dropped', button: q.button, why: `buffer ran out (${q.buffer} f): ${q.why}`, pressedAt: q.f }); return false; }
    if (can(S, q.button) !== true) return true;
    act(S, q.button, stick, q.age); return false;
  });
}
/** can the hero act on a press now: true, or { reason, queue (may it wait for its buffer) } */
function can(S, name) {
  const H = S.hero, C = S.card, a = H.act;
  if (H.stun > 0) return { reason: 'in hitstun', queue: true };
  if (a && (a.kind === 'stagger' || a.kind === 'bonk' || a.kind === 'hurt')) return { reason: `in ${a.kind}`, queue: true };
  if (H.lag > 0) return { reason: 'landing lag', queue: true };
  if (name === 'jump') {
    if (a?.kind === 'gather') return { reason: 'already gathering', queue: false };
    if (a && a.kind !== 'move' && a.kind !== 'dodge') return { reason: `in ${a.kind}`, queue: true };
    if (a?.kind === 'move' && !cancelOpen(S, a)) return { reason: 'in a move\'s startup or active frames', queue: true };
    if (a?.kind === 'dodge') return { reason: 'in a dodge', queue: true };
    if (H.grounded || H.coyote > 0) return true;
    return { reason: 'in the air', queue: true };
  }
  if (name === 'attack') {
    if (!H.grounded && !C.moves.air) return { reason: 'no moves in the air in this feel', queue: true };
    if (a?.kind === 'move') {
      if (a.i + 1 >= C.moves.string.length) return { reason: 'the string is spent', queue: true };
      if (!cancelOpen(S, a)) return { reason: 'the move\'s cancel is not open yet', queue: true };
      return true;
    }
    if (a?.kind === 'gather') return { reason: 'gathering a jump', queue: true };
    if (a?.kind === 'dodge') return { reason: 'in a dodge', queue: true };
    return true;
  }
  if (name === 'dodge') {
    if (!H.grounded && !C.dodge.air) return { reason: 'no dodge in the air in this feel', queue: false };
    if (a?.kind === 'move') return C.dodge.cancel && a.f >= C.moves.string[a.i].startup + C.moves.string[a.i].active ? true : { reason: 'a move commits until its active frames end', queue: false };
    if (a) return { reason: `in ${a.kind}`, queue: false };
    return true;
  }
  return { reason: 'unknown button', queue: false };
}
function cancelOpen(S, a) {
  const C = S.card.moves, m = C.string[a.i], after = m.startup + m.active;
  if (C.cancel === 'none') return false;
  if (C.cancel === 'half') return a.f >= after + Math.ceil(m.recovery / 2);
  return a.f >= after + C.cancel;
}
function act(S, name, stick, waited) {
  const H = S.hero, C = S.card;
  S.events.push({ f: S.f, who: 'hero', type: 'acted', button: name, waited });
  if (name === 'jump') {
    if (!H.grounded) { S.events.push({ f: S.f, who: 'hero', type: 'coyote', left: H.coyote }); takeOff(S, H, 'hero'); return; }
    H.act = null;
    if (C.jump.commit > 0) { H.act = { kind: 'gather', f: 0, of: C.jump.commit }; return; }
    takeOff(S, H, 'hero'); return;
  }
  if (name === 'attack') {
    const i = H.act?.kind === 'move' ? H.act.i + 1 : 0;
    if (stick.m > 0) H.yaw = Math.atan2(stick.x, stick.y);   // the swing's direction from the held stick
    H.act = { kind: 'move', i, f: 0, hit: false }; S.events.push({ f: S.f, who: 'hero', type: 'move', i, take: C.moves.string[i].take }); return;
  }
  if (name === 'dodge') {
    const dir = stick.m > 0 ? Math.atan2(stick.x, stick.y) : H.yaw;
    H.act = { kind: 'dodge', f: 0, of: C.dodge.frames, dir, from: len2(H.v[0], H.v[1]) }; S.events.push({ f: S.f, who: 'hero', type: 'dodge', kind: C.dodge.kind });
  }
}
function takeOff(S, B, who) {
  const J = S.card.jump; B.act = null; B.grounded = false; B.coyote = 0; B.jumped = true; B.cut = false; B.hang = J.hang; B.apex = null;
  B.v[2] = Math.sqrt(2 * J.gRise * J.height); B.tookOff = S.f; B.from = B.p[2];
  S.events.push({ f: S.f, who, type: 'takeoff', z: r4(B.p[2]) });
}
function cutJump(S, B) {
  if (!B.grounded && B.jumped && !B.cut && B.v[2] > 0) { B.v[2] *= S.card.jump.cut; B.cut = true; if (S.card.jump.cut < 1) S.events.push({ f: S.f, who: 'hero', type: 'cut', vz: r4(B.v[2]) }); }
  B.hang = 0;
}

// ─── moving a body ──────────────────────────────────────────────────────
function moveBody(S, B, who, stick, buttons) {
  const C = S.card, Gd = C.ground, a = B.act;
  const free = !(a && (a.kind === 'stagger' || a.kind === 'bonk' || a.kind === 'hurt')) && B.stun === 0;
  // the stick's ask: a speed toward a heading
  let want = null;
  if (stick && free && stick.m > 0) {
    const top = (buttons & BTN.SPRINT) ? Gd.sprint : Gd.run;
    want = { x: stick.x * top, y: stick.y * top, heading: Math.atan2(stick.x, stick.y), speed: stick.m * top };
  }
  const rooted = a?.kind === 'move' && C.moves.root === 'stop' && B.grounded;
  if (a?.kind === 'dodge') dodgeVelocity(S, B);
  else if (rooted) { const m = C.moves.string[a.i]; const speed = a.f < m.startup ? m.lunge / (m.startup * DT) : 0; B.v[0] = Math.sin(B.yaw) * speed; B.v[1] = Math.cos(B.yaw) * speed; }
  else if (B.grounded && (!stick || !free)) slide(B);
  else if (B.grounded || want) control(B, want, Gd, B.grounded ? 1 : C.jump.air);
  // facing follows the stick (a move keeps its own, set at the press)
  if (want && free && a?.kind !== 'move' && a?.kind !== 'dodge' && (B.grounded || C.jump.air > 0.5)) B.yaw = turnToward(B.yaw, want.heading, Gd.turn * DEG * DT);
  // the gather: the body waits on the ground for its take-off
  if (a?.kind === 'gather' && a.f >= a.of && B.grounded) takeOff(S, B, who);
  // gravity, exact for a constant pull, split at the apex (the rise's gravity and the fall's)
  if (!B.grounded && !(a?.kind === 'dodge' && C.dodge.kind === 'dash')) fall(S, B, who);
  // the floor plane: substeps no longer than 8 cm against the walls
  const sp = len2(B.v[0], B.v[1]); const n = Math.max(1, Math.ceil((sp * DT) / 0.08));
  let wallHit = null;
  for (let i = 0; i < n; i++) {
    B.p[0] += (B.v[0] * DT) / n; B.p[1] += (B.v[1] * DT) / n;
    const hit = resolveWalls(S, B); if (hit && !wallHit) { wallHit = hit; wallResponse(S, B, who, hit); }
  }
  ground(S, B, who);
  // the stride: a cycle at the ground's rate (strides a second = speed ÷ the travel of a stride at that speed)
  if (B.grounded) B.stride = (B.stride + strideRate(S, len2(B.v[0], B.v[1])) * DT) % 1;
  if (!B.grounded && C.jump.spin && B.jumped) B.spin += Math.min(2 * Math.PI / 8, (2 * len2(B.v[0], B.v[1]) / 0.45) * DT);
}
function control(B, want, Gd, share) {
  const vx = B.v[0], vy = B.v[1], speed = len2(vx, vy);
  if (Gd.steer && speed > 0.5 && want) {
    // a projectile steers: the heading turns at most `steer`, the speed builds or brakes along it
    const h = Math.atan2(vx, vy), against = Math.abs(angDiff(want.heading, h)) > 120 * DEG;
    const nh = against ? h : turnToward(h, want.heading, Gd.steer * DEG * DT * share);
    const ns = against ? Math.max(0, speed - Gd.decel * 3 * DT * share) : moveTo(speed, want.speed, (want.speed > speed ? Gd.accel : Gd.decel) * DT * share);
    B.v[0] = Math.sin(nh) * ns; B.v[1] = Math.cos(nh) * ns; return;
  }
  const tx = want ? want.x : 0, ty = want ? want.y : 0;
  const dx = tx - vx, dy = ty - vy, d = len2(dx, dy); if (d < 1e-9) return;
  const speeding = want && len2(tx, ty) >= speed - 1e-9 && (tx * vx + ty * vy) >= 0;
  const rate = (speeding ? Gd.accel : Gd.decel) * DT * share;
  const k = Math.min(1, rate / d); B.v[0] = vx + dx * k; B.v[1] = vy + dy * k;
}
/** a body nobody drives (the dummy, a hit or staggered hero) slides on its soles, friction 0.8 */
function slide(B) { const s = len2(B.v[0], B.v[1]); if (s < 1e-9) return; const k = Math.max(0, s - 0.8 * G * DT) / s; B.v[0] *= k; B.v[1] *= k; }
function dodgeVelocity(S, B) {
  const D = S.card.dodge, a = B.act, t = a.f / a.of;
  let speed;
  if (D.kind === 'boost') speed = Math.min(S.card.wall.cap ?? Infinity, Math.max(a.from, S.card.ground.run) + D.speed * (1 - t));
  else if (D.kind === 'dash') { speed = D.speed; B.v[2] = 0; }
  else speed = D.speed * (1 - 0.7 * t);
  B.v[0] = Math.sin(a.dir) * speed; B.v[1] = Math.cos(a.dir) * speed; if (D.kind !== 'sidestep') B.yaw = D.kind === 'boost' ? a.dir : B.yaw;
}
function fall(S, B, who) {
  const J = S.card.jump; let t = DT;
  if (B.v[2] > 0) {
    const ta = B.v[2] / J.gRise;
    if (ta >= t) { B.p[2] += B.v[2] * t - 0.5 * J.gRise * t * t; B.v[2] -= J.gRise * t; return; }
    B.p[2] += B.v[2] * ta - 0.5 * J.gRise * ta * ta; B.v[2] = 0; t -= ta; apexAt(S, B, who);
    if (B.hang > 0 && (S.held & BTN.JUMP)) { B.hang--; return; }
  } else if (B.v[2] === 0 && B.hang > 0 && B.jumped && (S.held & BTN.JUMP) && who === 'hero') { B.hang--; return; }
  B.p[2] += B.v[2] * t - 0.5 * J.gFall * t * t; B.v[2] = Math.max(-J.maxFall, B.v[2] - J.gFall * t);
}
function apexAt(S, B, who) { if (B.apex == null) { B.apex = r4(B.p[2] - (B.from ?? 0)); S.events.push({ f: S.f, who, type: 'apex', height: B.apex }); } }

/** the floor under a point: the highest block top it stands over, else the floor */
function groundAt(S, x, y) { let h = 0; for (const k of S.arena.blocks) if (x >= k.x[0] && x <= k.x[1] && y >= k.y[0] && y <= k.y[1]) h = Math.max(h, k.h); return h; }
function ground(S, B, who) {
  const g = groundAt(S, B.p[0], B.p[1]);
  if (B.grounded) {
    if (g < B.p[2] - 1e-6) { B.grounded = false; B.jumped = false; B.coyote = S.card.jump.coyote; B.v[2] = 0; B.from = B.p[2]; B.apex = null; S.events.push({ f: S.f, who, type: 'edge', z: r4(B.p[2]) }); }
    else B.p[2] = g;
    return;
  }
  if (B.coyote > 0) B.coyote--;
  if (B.p[2] <= g && B.v[2] <= 0) {
    const fallSpeed = -B.v[2]; B.p[2] = g; B.v[2] = 0; B.grounded = true; B.coyote = 0; B.jumped = false; B.hang = 0; B.landed = S.f; B.spin = 0;
    const J = S.card.jump; if (J.heavy && fallSpeed > J.heavy.fall && who === 'hero') B.lag = J.heavy.lag;
    if (B.act?.kind === 'move' && !S.card.moves.air) B.act = null;
    S.events.push({ f: S.f, who, type: 'land', fall: r4(fallSpeed) });
  }
}
/** push a body out of the arena's walls and every block taller than a step above its feet; the first wall's normal */
function resolveWalls(S, B) {
  let hit = null; const A = S.arena, lim = A.half - RADIUS;
  for (const [i, s] of [[0, 1], [0, -1], [1, 1], [1, -1]]) if (B.p[i] * s > lim) { B.p[i] = lim * s; hit = hit ?? (i === 0 ? [-s, 0] : [0, -s]); }
  for (const k of A.blocks) {
    if (k.h <= B.p[2] + STEP) continue;
    const cx = clamp(B.p[0], k.x[0], k.x[1]), cy = clamp(B.p[1], k.y[0], k.y[1]), dx = B.p[0] - cx, dy = B.p[1] - cy, d = len2(dx, dy);
    if (d >= RADIUS) continue;
    let nx, ny;
    if (d > 1e-9) { nx = dx / d; ny = dy / d; } else {
      const e = [[B.p[0] - k.x[0], -1, 0], [k.x[1] - B.p[0], 1, 0], [B.p[1] - k.y[0], 0, -1], [k.y[1] - B.p[1], 0, 1]].sort((a, b) => a[0] - b[0])[0];
      nx = e[1]; ny = e[2];
    }
    B.p[0] = cx + nx * RADIUS; B.p[1] = cy + ny * RADIUS; hit = hit ?? [nx, ny];
  }
  return hit;
}
function wallResponse(S, B, who, n) {
  const W = S.card.wall, into = -(B.v[0] * n[0] + B.v[1] * n[1]); if (into <= 0) return;
  const leaning = B.touched === S.f - 1; B.touched = S.f;   // pressed on into a wall it already touched: no new event
  if (W.model === 'bounce') {
    B.v[0] += n[0] * (1 + W.e) * into; B.v[1] += n[1] * (1 + W.e) * into;
    const s = len2(B.v[0], B.v[1]); if (s > W.cap) { B.v[0] *= W.cap / s; B.v[1] *= W.cap / s; }
    S.events.push({ f: S.f, who, type: 'wall', response: 'bounce', into: r4(into), out: r4(Math.min(W.cap, s)) }); return;
  }
  B.v[0] += n[0] * into; B.v[1] += n[1] * into;   // the normal part stops: the body slides along
  if (W.model === 'bonk' && into > W.above && B.grounded) {
    B.v[0] = n[0] * W.rebound; B.v[1] = n[1] * W.rebound; B.grounded = false; B.jumped = false; B.v[2] = Math.sqrt(2 * S.card.jump.gRise * W.hop); B.from = B.p[2];
    B.act = { kind: 'bonk', f: 0, of: 24 }; S.events.push({ f: S.f, who, type: 'wall', response: 'bonk', into: r4(into) }); return;
  }
  if (W.model === 'stop' && W.stagger != null && into > W.stagger) { B.act = { kind: 'stagger', f: 0, of: 30 }; S.events.push({ f: S.f, who, type: 'wall', response: 'stagger', into: r4(into) }); return; }
  if (!leaning) S.events.push({ f: S.f, who, type: 'wall', response: 'stop', into: r4(into) });
}
function endAct(S, B, who) {
  const a = B.act; if (!a) return;
  if (a.kind === 'move') { const m = S.card.moves.string[a.i]; if (a.f >= m.startup + m.active + m.recovery) { B.act = null; S.events.push({ f: S.f, who, type: 'end', what: 'move' }); } return; }
  if (a.kind === 'spar') { if (a.f >= SPAR.startup + SPAR.active + SPAR.recovery) B.act = null; return; }
  if (a.of != null && a.f >= a.of && a.kind !== 'gather') { B.act = null; S.events.push({ f: S.f, who, type: 'end', what: a.kind }); }
}
function strideRate(S, speed) {
  const g = S.body.strides; if (speed < 0.05) return 0;
  let travel = speed <= g[0].v ? g[0].travel : g.at(-1).travel;
  for (let i = 1; i < g.length; i++) if (speed > g[i - 1].v && speed <= g[i].v) travel = g[i - 1].travel + ((g[i].travel - g[i - 1].travel) * (speed - g[i - 1].v)) / (g[i].v - g[i - 1].v);
  let rate = speed / travel; const top = g.at(-1).v;
  if (speed > top) rate *= 1 + 0.5 * (speed / top - 1);   // past the sprint the legs outrun the ground (pinball's wheel)
  return Math.min(FPS / 4, rate);
}

// ─── hits ───────────────────────────────────────────────────────────────
/** the dummy's sparring jab: a telegraph (its startup is long so the hero can read it and dodge) */
export const SPAR = Object.freeze({ take: 'jab', startup: 30, active: 4, recovery: 20, reach: 1.0, every: 90 });
function sparThink(S) {
  const D = S.dummy, H = S.hero; if (!S.spar || D.act || D.stun || !D.grounded) return;
  const dx = H.p[0] - D.p[0], dy = H.p[1] - D.p[1];
  if (len2(dx, dy) > 2.2 || S.f % SPAR.every) return;
  D.yaw = Math.atan2(dx, dy); D.act = { kind: 'spar', f: 0, hit: false }; S.events.push({ f: S.f, who: 'dummy', type: 'move', take: SPAR.take, telegraph: SPAR.startup });
}
function moveOf(S, B) {
  if (B.act?.kind === 'move') { const m = S.card.moves.string[B.act.i]; return { ...m, reach: S.body.reach[m.take], dv: S.body.dv[m.take] }; }
  if (B.act?.kind === 'spar') return { ...SPAR, reach: SPAR.reach, dv: S.body.dv.jab, spar: true };
  return null;
}
function testHit(S, A, V, who) {
  const m = moveOf(S, A); if (!m || A.act.hit) return;
  if (A.act.f < m.startup || A.act.f >= m.startup + m.active) return;
  const dx = V.p[0] - A.p[0], dy = V.p[1] - A.p[1], fx = Math.sin(A.yaw), fy = Math.cos(A.yaw);
  const ahead = dx * fx + dy * fy, side = Math.abs(dx * fy - dy * fx), up = Math.abs(V.p[2] - A.p[2]);
  if (ahead < 0 || ahead > m.reach + RADIUS || side > 0.45 || up > 0.9) { if (A.act.f === m.startup + m.active - 1) S.events.push({ f: S.f, who, type: 'whiff', i: A.act.i ?? null, short: r4(Math.max(0, ahead - m.reach - RADIUS)) }); return; }
  A.act.hit = true;
  const vic = who === 'hero' ? 'dummy' : 'hero', inv = vic === 'hero' ? iframed(S, V) : false;
  if (inv) { S.events.push({ f: S.f, who: vic, type: 'evaded', by: S.card.dodge.kind }); return; }
  if (V.mercy > 0) { S.events.push({ f: S.f, who: vic, type: 'immune', mercy: V.mercy }); return; }
  const free = V.stun === 0;
  if (vic === 'dummy' && S.guard && free && V.alert > 0 && !V.act) {
    V.alert = S.card.hit.alert; V.combo = 0; const stop = hitstop(S, m.dv * 0.5); A.stop = V.stop = stop; A.fresh = V.fresh = stop > 0;
    V.act = { kind: 'guard', f: 0, of: 12 }; S.events.push({ f: S.f, who: vic, type: 'blocked', i: A.act.i ?? null, hitstop: stop }); return;
  }
  const advantage = free ? null : V.stun;
  V.combo = free ? 1 : V.combo + 1;
  const F = { ...S.card.hit.force, ...(m.force ?? {}) };
  const fx2 = fx, fy2 = fy; let dv, lift = 0;
  if (F.model === 'momentum') { dv = m.dv * F.gain; lift = F.lift ?? 0; }
  else if (F.model === 'boop') dv = F.push;
  else dv = Math.max(F.floor, len2(A.v[0], A.v[1])) * F.restitution;
  const stop = hitstop(S, dv); A.stop = V.stop = stop; A.fresh = V.fresh = stop > 0;
  const along = dv * Math.cos(lift * DEG), up2 = dv * Math.sin(lift * DEG);
  V.v[0] = fx2 * along; V.v[1] = fy2 * along; if (up2 > 0) { V.v[2] = up2; V.grounded = false; V.jumped = false; V.from = V.p[2]; }
  if (F.model === 'boop') { A.v[0] = -fx * F.bounce; A.v[1] = -fy * F.bounce; V.v[2] = Math.sqrt(2 * S.card.jump.gRise * F.hop); V.grounded = false; V.jumped = false; V.from = V.p[2]; }
  if (F.model === 'ricochet') { A.v[0] *= 0.1; A.v[1] *= 0.1; }
  V.stun = stunOf(S, m, dv, V.combo); V.mercy = S.card.hit.mercy; V.alert = S.card.hit.alert; V.lastHit = { take: m.take, f: S.f, finisher: !!m.finisher };
  V.act = vic === 'hero' ? { kind: 'hurt', f: 0, of: Math.max(12, V.stun) } : null;
  S.events.push({ f: S.f, who: vic, type: 'hit', by: who, i: A.act.i ?? null, take: m.take, dv: r4(dv), powerscale: r4(dv / m.dv), hitstop: stop, stun: V.stun, combo: V.combo, advantage, finisher: !!m.finisher });
}
function iframed(S, B) { const I = S.card.dodge.iframes; return !!(I && B.act?.kind === 'dodge' && B.act.f >= I[0] && B.act.f < I[1]); }
function hitstop(S, dv) { const h = S.card.hit.hitstop; return h ? Math.min(h.max, Math.round(h.base + h.perMs * dv)) : 0; }
/** frames of hitstun: the body's own flinch (the reaction time and a flinch scaled by the blow), the combo rule, or none */
function stunOf(S, m, dv, n) {
  const st = S.card.hit.stun;
  if (st.model === 'body') return Math.round((0.22 + 0.4 * Math.min(1, dv / 1.2)) * FPS);
  if (st.model === 'rule') return m.finisher ? Math.round(1.2 * FPS) : Math.round(Math.max(st.min, st.base * st.decay ** (n - 1)) * FPS);
  return 0;
}

// ─── what a body shows ─────────────────────────────────────────────────
/**
 * The clip and the frame in it a body shows on this tick: a move at its frame (a hitstop holds it, since the frame does
 * not advance), the jump's gather, the air by vertical speed (rising → the apex → falling: `u` 0 → 0.5 → 1) or a spin,
 * the landing, a dodge, a reaction, the stride cycle by speed and phase, idle. `scale` the squash and stretch about the
 * feet at take-off and landing (the card's `look.squash`).
 */
export function poseOf(S, who) {
  const B = S[who], C = S.card, a = B.act ? { ...B.act, f: B.act.shown ?? B.act.f } : null, v = len2(B.v[0], B.v[1]);
  const since = (f) => (S.f - f) / FPS; const sq = C.look.squash;
  const pulse = (t) => Math.exp(-((t / 0.05) ** 2));
  let s = 0; if (sq) { s += sq * pulse(since(B.tookOff)); s -= sq * pulse(since(B.landed) - 0.03); }
  const scale = Math.abs(s) < 1e-3 ? null : [1 / Math.sqrt(1 + s), 1 / Math.sqrt(1 + s), 1 + s];
  const base = { p: B.p.slice(), yaw: B.yaw, scale, held: B.stop > 0 };
  if (a?.kind === 'move') return { ...base, clip: 'move', i: a.i, at: a.f };
  if (a?.kind === 'spar') return { ...base, clip: 'spar', at: a.f };
  if (a?.kind === 'gather') return { ...base, clip: 'gather', at: a.f, of: a.of };
  if (a?.kind === 'dodge') return { ...base, clip: 'dodge', kind: C.dodge.kind, at: a.f, of: a.of, speed: v, iframes: iframed(S, B) };
  if (a?.kind === 'guard') return { ...base, clip: 'guard', at: a.f };
  if (B.stun > 0 || a?.kind === 'hurt' || a?.kind === 'stagger' || a?.kind === 'bonk') {
    const at = B.lastHit && (B.stun > 0 || a?.kind === 'hurt') ? S.f - B.lastHit.f : a?.f ?? 0;
    return { ...base, clip: 'react', take: a?.kind === 'stagger' || a?.kind === 'bonk' ? 'cross' : B.lastHit?.take ?? 'jab', at, air: !B.grounded };
  }
  if (!B.grounded) {
    const v0 = Math.sqrt(2 * C.jump.gRise * C.jump.height);
    return { ...base, clip: C.jump.spin && B.jumped ? 'spin' : 'air', u: clamp((v0 - B.v[2]) / (2 * v0), 0, 1), spin: B.spin };
  }
  if (C.jump.land && S.f - B.landed < C.jump.land && v < C.ground.walk) return { ...base, clip: 'land', at: S.f - B.landed, of: C.jump.land };
  if (v > 0.05) return { ...base, clip: 'loco', speed: v, phase: B.stride };
  return { ...base, clip: 'idle' };
}

// ─── frame data, read off the card ─────────────────────────────────────
/**
 * Per move: startup (the press frame to the first active frame), active, recovery, total, where the next move may
 * cancel in, the stun it leaves (the card's model, against a fresh victim), and the frames of advantage that leaves:
 * on hit, stun + hitstop − (the frames after contact the attacker still owes before it can act); on block, the guard
 * minus the same. What a fighting game's move list prints, here for any feel.
 */
export function frameData(card, body) {
  const S = { card, body };
  return card.moves.string.map((m, i) => {
    const dv = body.dv[m.take], F = { ...card.hit.force, ...(m.force ?? {}) };
    const shown = F.model === 'momentum' ? dv * F.gain : F.model === 'boop' ? F.push : F.floor * F.restitution;
    const stun = stunOf(S, m, shown, i + 1), stop = card.hit.hitstop ? Math.min(card.hit.hitstop.max, Math.round(card.hit.hitstop.base + card.hit.hitstop.perMs * shown)) : 0;
    const owes = m.active + m.recovery - 1;
    const cancel = card.moves.cancel === 'none' || i + 1 >= card.moves.string.length ? null : card.moves.cancel === 'half' ? m.startup + m.active + Math.ceil(m.recovery / 2) : m.startup + m.active + card.moves.cancel;
    // the link: the stun left when the next move, pressed in time and cancelled in at the earliest, connects (the
    // hitstop freezes both, so it neither adds nor costs)
    const next = cancel == null ? null : card.moves.string[i + 1];
    const link = next ? stun - (cancel - m.startup + next.startup) : null;
    return { take: m.take, startup: m.startup, active: m.active, recovery: m.recovery, total: m.startup + m.active + m.recovery, cancel,
      reach: r4(body.reach[m.take]), dv: r4(shown), stun, hitstop: stop, link, onHit: stun - owes, onBlock: 12 - owes, finisher: !!m.finisher };
  });
}
/** helpers the page and the gate share */
export const util = { stickOf, groundAt, angDiff, RADIUS };
function moveTo(a, b, step) { return a < b ? Math.min(b, a + step) : Math.max(b, a - step); }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function turnToward(a, b, max) { const d = angDiff(b, a); return Math.abs(d) <= max ? b : a + Math.sign(d) * max; }
