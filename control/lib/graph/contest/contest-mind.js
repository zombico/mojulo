/**
 * THE CONTEST MINDS — the computer in a contest: plain, seeded, bounded. Their levels are the mind's skill tiers
 * (lib/graph/mind/vocab.js SKILLS: novice, regular, veteran, ace; held to the same names by the test): the reaction
 * before it moves, the wobble on its aim, how much of the body's speed it uses, how long it waits to play.
 *
 * THE COURT MIND (match-sim.js): it serves when its turn comes, reads where the ball will land by running the ball's
 * own physics on a copy (the physics property's integrator, never a guess), runs there after its reaction time, and
 * swings when the ball comes into reach, aiming across the court or down the line by its own habit.
 * THE TURN MIND (turn-sim.js): at its seat it plans the shot (the club the lie gives, the speed that carries the
 * distance left on the verb's arc, or the roll's line to the pocket and its hook), waits its wait, turns the aim with
 * the stick and releases the press at the meter it wants, each with the level's wobble.
 * THE POSITIONAL MIND (the team game's teammates): a role's home region, a mark to stand goal-side of, the ball to
 * press when near; the point it goes to is always inside what the kernel says is legal.
 * THE TEAM MIND (team-sim.js): the computer side's player at the ball: it chases when nearest, shoots in range of
 * the goal, else passes to the teammate furthest ahead, else carries the ball on toward the goal.
 *
 *   MIND_LEVELS                       { <level>: { react (s), wobble (a share of the stick), pace (a share of the speed),
 *                                       serveWait (s) } }
 *   newCourtMind(level, seed)          → M (its memory: the level, dice, the target, the reaction left, the last read)
 *   courtMind(M, S, who, ctx, sim)     → { x, y, b } the pad it holds this frame (the player's own frame: y toward the net)
 *   predictLanding(sim, state, id, { steps }) → { at: [x, y], t } where the ball meets the floor, or null (a copy is run)
 *   newTurnMind(level, seed), turnMind(M, S, ctx) → { x, y, b } the pad at the seat this frame
 *   newTeamMind(level, seed), teamMind(M, S, who, ctx) → { x, y, kick: { facing, power } | null } the pad (court frame)
 *   fieldTarget({ me, home, legal, ball?, mark?, press? }) → { to: [x, y], why: 'press' | 'mark' | 'home' } the point a
 *                                       role goes to, clamped into the legal shapes (the kernel's region shapes)
 *   nearestInside(shape, p)            the point of a rect or circle nearest p (p itself when inside)
 *
 * Pure and seeded: mulberry32 on the mind's own state, so the same match is the same to the byte.
 */

import { HIT_VERBS, hitVelocity, aimedElevation } from './hit.js';

export const MIND_LEVELS = Object.freeze({
  novice: Object.freeze({ react: 0.9, wobble: 0.45, pace: 0.7, serveWait: 1.6 }),
  regular: Object.freeze({ react: 0.45, wobble: 0.22, pace: 0.85, serveWait: 1.2 }),
  veteran: Object.freeze({ react: 0.2, wobble: 0.1, pace: 0.95, serveWait: 1.0 }),
  ace: Object.freeze({ react: 0.05, wobble: 0.03, pace: 1, serveWait: 0.8 }),
});
export const MIND_LEVEL_IDS = Object.freeze(Object.keys(MIND_LEVELS));
const PREDICT_EVERY = 6;   // frames between reads of the landing
// the arcade's unforced error (a sport's `slip`, arcade-rules.js): the share of balls the computer lets go, by its level
const SLIP_SCALE = Object.freeze({ novice: 2, regular: 1, veteran: 0.5, ace: 0.25 });

function mindDice(M) {
  M.r = (M.r + 0x6D2B79F5) >>> 0;
  let t = M.r;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function newCourtMind(level = 'regular', seed = 1) {
  if (!MIND_LEVELS[level]) throw new Error(`contest: mind level '${level}' is one of ${MIND_LEVEL_IDS.join(', ')}`);
  return { level, r: (seed * 2654435761) >>> 0, target: null, react: 0, read: -1, landing: null, aim: 0, wait: 0, rallyOf: -1 };
}

/** Where the ball meets the floor, by running the ball's own physics on a copy of the state. */
export function predictLanding(sim, state, id = 'ball', { steps = 300, dt = 1 / 60 } = {}) {
  const copy = JSON.parse(JSON.stringify(state));
  for (let i = 0; i < steps; i++) {
    sim.step(copy, dt);
    const hit = copy.contacts.find((c) => (c.a === id && c.b === 'floor') || (c.b === id && c.a === 'floor'));
    if (hit) { const b = copy.bodies.find((x) => x.id === id); return { at: [b.position[0], b.position[1]], t: (i + 1) * dt, z: b.position[2] }; }
    if (copy.contacts.some((c) => (c.a === id && c.b === 'net') || (c.b === id && c.a === 'net'))) return null;
  }
  return null;
}

/**
 * The ball's way onto a side, by running its physics on a copy: where it first lands (`land`), where it crosses the
 * line y = yLine (`cross`: [x, y, z], and when), or where it dies on that side before it gets there (`dies`: a second
 * landing or its rest). `sign` is the side's (a: 1, b: -1).
 */
export function predictCrossing(sim, state, yLine, sign, { id = 'ball', steps = 300, dt = 1 / 60 } = {}) {
  const copy = JSON.parse(JSON.stringify(state));
  const ball = () => copy.bodies.find((x) => x.id === id);
  let land = null, bounces = 0, prev = ball().position[1], wasOnFloor = false;
  for (let i = 0; i < steps; i++) {
    sim.step(copy, dt);
    const b = ball(), onFloor = copy.contacts.some((c) => (c.a === id && c.b === 'floor') || (c.b === id && c.a === 'floor'));
    if (onFloor && !wasOnFloor) {
      bounces += 1;
      if (b.position[1] * sign < 0) { if (!land) land = [b.position[0], b.position[1]]; else return { land, cross: null, dies: [b.position[0], b.position[1]] }; }
    }
    wasOnFloor = onFloor;
    if (b.resting) return { land, cross: null, dies: [b.position[0], b.position[1]] };
    // crossing the line toward the baseline (the ball moving away from the net on this side)
    if ((prev - yLine) * (b.position[1] - yLine) <= 0 && b.position[1] * sign < 0 && i > 0) return { land, cross: [b.position[0], b.position[1], b.position[2]], t: (i + 1) * dt };
    prev = b.position[1];
    if (copy.contacts.some((c) => (c.a === id && c.b === 'net') || (c.b === id && c.a === 'net')) && bounces === 0 && b.position[1] * sign > 0) return { land: null, cross: null, dies: null };
  }
  return { land, cross: null, dies: null };
}

/**
 * The stick's lift that lands the verb's shot from `from` ([x, y, z]) at `to` ([x, y]) on this register: the aimed arc
 * (hit.js aimedElevation, the cord counted) read back through the verb's arc and lift. In the arcade the sim aims the
 * shot itself and the stick only names the depth; here it is the mind's depth sense, and in the realistic register its
 * whole game.
 */
export function aimStick(ctx, S, verb, from, to) {
  const V = HIT_VERBS[verb];
  if (!V || !(V.lift > 0)) return 0;
  const D = Math.hypot(to[0] - from[0], to[1] - from[1]), netAt = D * (Math.abs(from[1]) / Math.max(1e-6, Math.abs(to[1] - from[1])));
  const speed = hitVelocity({ verb, register: ctx.register, tipSpeed: ctx.body.tipSpeed, hits: S.ball.hits }).speed;
  if (!(speed > 0)) return 0;
  // (a raised bed, the table: the heights over it; a ball whose air is its own, flown through it)
  const bed = ctx.sport.bed ? ctx.sport.bed.height : 0;
  const th = ctx.drag ? aimedElevation(speed, from[2] - bed, D, -S.sim.gravity[2], { at: netAt, height: ctx.sport.net.height }, ctx.drag)
    : aimedElevation(speed, from[2] - bed, D, -S.sim.gravity[2], { at: netAt, height: ctx.sport.net.height });
  // the realistic ball flies in air, which shortens it: a little more lift than the vacuum says
  const air = ctx.register === 'realistic' ? 1.5 : 0;
  return mclamp((th + air - V.arc) / V.lift, -1, 1);
}

const mclamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The stick that serves into the box the point names (S.serveTarget, match-sim.js) from where the server stands: its
 * x the azimuth across the register's spread (right aims right), its y the lift that lands the serve there.
 */
export function serveStick(ctx, S, P, sim = null) {
  const box = S.serveTarget, facing = P.side === 'a' ? Math.PI / 2 : -Math.PI / 2;
  const az = Math.atan2(box[1] - P.y, box[0] - P.x);
  let d = az - facing; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const x = mclamp(-d / (ctx.spread * Math.PI / 180), -1, 1);
  // a serve that bounces on its own half first (table tennis's): the lift found by flying the serve on a copy, in the
  // realistic register (the arcade's sim aims it itself)
  const y = ctx.C.serve.bounce === 'own' ? (ctx.register === 'realistic' && sim ? ownBounceStick(ctx, S, P, sim, x, box) : 0)
    : aimStick(ctx, S, ctx.sport.strokes.serve, [P.x, P.y, ctx.sport.serve.hand], box);
  return { x: mr4(x), y: mr4(y) };
}

/**
 * A launch flown on a copy of the match's physics: the ball set at `from` with `velocity` (and `spin`), stepped until
 * its second contact with the court or the floor, the net, or the steps run out. → { contacts: [[x, y], …], net }
 */
export function probeFlight(sim, state, from, velocity, spin = [0, 0, 0], { steps = 150, dt = 1 / 60 } = {}) {
  const copy = JSON.parse(JSON.stringify(state)), b = copy.bodies.find((x) => x.id === 'ball');
  b.position = from.slice(); b.velocity = velocity.slice(); b.angularVelocity = spin.slice(); b.resting = false;
  const contacts = [];
  let was = false;
  for (let i = 0; i < steps; i++) {
    sim.step(copy, dt);
    if (copy.contacts.some((c) => (c.a === 'ball' || c.b === 'ball') && (c.a === 'net' || c.b === 'net'))) return { contacts, net: true };
    const on = copy.contacts.some((c) => (c.a === 'ball' || c.b === 'ball') && (c.a === 'floor' || c.b === 'floor' || c.a === 'ground' || c.b === 'ground'));
    if (on && !was) { contacts.push([b.position[0], b.position[1]]); if (contacts.length >= 2) break; }
    was = on;
  }
  return { contacts, net: false };
}

/** The realistic serve's lift that bounces it on its own half and then deep on the receiver's: read on the probe. */
function ownBounceStick(ctx, S, P, sim, x, box) {
  const verb = ctx.sport.strokes.serve, sign = P.side === 'a' ? 1 : -1, facing = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
  const ball = S.sim.bodies.find((b) => b.id === 'ball'), from = ball.position.slice();
  // where the second bounce lands for a lift: its depth past the net on the receiver's side (−1 for a fault short of it)
  const depth = (y) => {
    const H = hitVelocity({ verb, register: ctx.register, facing, stick: [x, y], tipSpeed: ctx.body.tipSpeed, hits: 0 });
    const F = probeFlight(sim, S.sim, from, H.velocity, H.angularVelocity);
    if (F.contacts.length && F.contacts[0][1] * sign > 0) return Infinity;   // no bounce on its own half: too long
    if (F.net || F.contacts.length < 2) return -1;
    return F.contacts[1][1] * sign;
  };
  // (the depth is no monotone function of the lift, a steep serve kicking up short and a flat one into the net: the
  // lifts scanned, the one landing nearest the box's depth kept)
  const want = box[1] * sign;
  let best = 0, off = Infinity;
  for (let i = 0; i <= 16; i++) {
    const y = -1 + i / 8, d = depth(y);
    if (d > 0 && d !== Infinity && Math.abs(d - want) < off) { off = Math.abs(d - want); best = y; }
  }
  return best;
}
const mr4 = (v) => Math.round(v * 10000) / 10000;

/**
 * The pad the mind holds this frame. `S` is the match (match-sim.js), `who` its player id, `ctx` the match context,
 * `sim` the physics instance. The stick is in the player's own frame (x its right, y toward the net).
 */
export function courtMind(M, S, who, ctx, sim) {
  if (ctx.C.players > 1) return sideMind(M, S, who, ctx, sim);
  const L = MIND_LEVELS[M.level], P = S.p.find((p) => p.id === who), side = P.side, sign = side === 'a' ? 1 : -1;
  const court = ctx.court, body = ctx.body;
  const ball = S.sim.bodies.find((b) => b.id === 'ball');
  const own = (p) => [p[0] * sign, p[1] * sign];   // court → the player's frame
  // the stick toward a court point, in the player's frame, at the level's pace; easing in over the last metre
  const toward = (tx, ty) => { const d = own([tx - P.x, ty - P.y]); const n = Math.hypot(d[0], d[1]); if (n < 0.15) return [0, 0]; const k = (Math.min(1, n) * L.pace) / n; return [d[0] * k, d[1] * k]; };
  const dt = 1 / 60;
  // a new rally: a fresh aim, the reaction armed, the serve's wait
  if (M.rallyOf !== S.rallies) { M.rallyOf = S.rallies; M.aim = mindDice(M) < 0.5 ? -1 : 1; M.react = L.react; M.wait = L.serveWait; M.landing = null; M.read = -1; }
  // the serve: wait, then strike toward the box the point names
  if (S.K.phase === 'serve' && S.ball.held === who && S.dead === 0) {
    M.wait = Math.max(0, M.wait - dt);
    if (M.wait > 0) return { x: 0, y: 0, b: 0 };
    const aim = serveStick(ctx, S, P, sim);
    const x = aim.x + (mindDice(M) - 0.5) * L.wobble, y = aim.y + (mindDice(M) - 0.5) * L.wobble * 0.5;
    return { x: mclamp(x, -1, 1), y: mclamp(y, -1, 1), b: 1 };
  }
  if (S.K.phase !== 'live' || S.dead > 0) return { x: 0, y: 0, b: 0 };
  const coming = ball.velocity[1] * sign < -0.1 || (ball.position[1] * sign < 0 && Math.abs(ball.velocity[1]) < 0.1);
  const onMySide = ball.position[1] * sign < 0;
  // read the ball's way every few frames while it comes: where it crosses my depth, or dies short; then move after
  // the reaction, so the ball comes to the racquet side
  if (coming) {
    // (over a raised bed, the table, the ball is met as it crosses the table's end, before it drops below it)
    if (S.f - M.read >= PREDICT_EVERY) { M.read = S.f; M.landing = predictCrossing(sim, S.sim, ctx.sport.bed ? -sign * court.halfL : P.y, sign); }
    M.react = Math.max(0, M.react - dt);
  } else { M.react = L.react; M.landing = null; }
  // the home: the centre mark a step behind the baseline
  const homeY = -sign * (court.halfL + ctx.sport.home.behind), off = -sign * 0.5;   // the ball half a metre to my right
  let stick = [0, 0];
  if (coming && M.react === 0 && M.landing) {
    const W = M.landing;
    if (W.cross) stick = toward(W.cross[0] + off, P.y);
    else if (W.dies) stick = toward(W.dies[0] + off, W.dies[1] - sign * 0.6);
    else if (W.land) stick = toward(W.land[0] + off, Math.max(Math.abs(W.land[1]) + 1.5, Math.abs(homeY)) * -sign);
    else stick = toward(0, homeY);
    // close in on the ball itself once it is near and low
    if (onMySide && Math.hypot(ball.position[0] - P.x, ball.position[1] - P.y) < body.reach * 1.6 && ball.position[2] < 2) stick = toward(ball.position[0] + off, ball.position[1]);
  } else if (!coming) stick = toward(0, homeY);
  // the swing, begun so its strike meets the ball: where the ball will be when the swing reaches its strike (its line
  // flown on, the gravity counted) must be on my side, in reach and low enough, and the ball coming (or dying beside me)
  const lead = body.swing * 0.5, g = -S.sim.gravity[2];
  const bx = ball.position[0] + ball.velocity[0] * lead, by = ball.position[1] + ball.velocity[1] * lead, bz = ball.position[2] + ball.velocity[2] * lead - 0.5 * g * lead * lead;
  const dist = Math.hypot(bx - P.x, by - P.y), approaching = ball.velocity[1] * sign < 0.5;
  const swing = by * sign < 0 && dist <= body.reach * 0.9 && bz < 2.4 && (!ctx.sport.bed || bz > ctx.sport.bed.height) && approaching && !P.swing && S.ball.held === null;
  if (swing && ctx.sport.slip) {
    // the arcade's unforced error: once a ball, the level's share of the sport's slip lets it go by
    const ball = `${S.rallies}:${S.ball.hits}`;
    if (M.slipOf !== ball) { M.slipOf = ball; M.slipped = mindDice(M) < ctx.sport.slip * SLIP_SCALE[M.level]; }
    if (M.slipped) return { x: stick[0], y: stick[1], b: 0 };
  }
  if (swing) {
    // the aim: a third of the spread toward its chosen side (a rally, not a winner every ball), the level's wobble on it
    const aimX = mclamp(M.aim * 0.3 + (mindDice(M) - 0.5) * L.wobble, -1, 1);
    // the depth: three quarters of the far court, the stick read off the arc that lands there
    const verb = (bx - P.x) * sign >= 0 ? ctx.sport.strokes.fore : ctx.sport.strokes.back;
    const aimY = mclamp(aimStick(ctx, S, verb, [bx, by, Math.max(0.3, bz)], [bx + aimX * 2, sign * court.halfL * 0.75]) + (mindDice(M) - 0.5) * L.wobble, -1, 1);
    return { x: aimX, y: aimY, b: 1 };
  }
  return { x: stick[0], y: stick[1], b: 0 };
}

/**
 * THE SIDE MIND — a player on a side of more than one (volleyball's pair). The sim names the side's active player (the
 * one to play the ball, match-sim.js); the active player runs to where the ball comes down (its own physics, flown on a
 * copy) and plays it when it is in reach and low enough, the others go where the side's play wants them: by the net for
 * the set, to the attack spot for the hit, home while the other side has it. The serve as the court mind's.
 */
function sideMind(M, S, who, ctx, sim) {
  const L = MIND_LEVELS[M.level], P = S.p.find((p) => p.id === who), side = P.side, sign = side === 'a' ? 1 : -1;
  const court = ctx.court, body = ctx.body, dt = 1 / 60, B = S.K.ball;
  const ball = S.sim.bodies.find((b) => b.id === 'ball');
  const own = (p) => [p[0] * sign, p[1] * sign];
  const toward = (tx, ty, pace = L.pace) => { const d = own([tx - P.x, ty - P.y]); const n = Math.hypot(d[0], d[1]); if (n < 0.15) return [0, 0]; const k = (Math.min(1, n) * pace) / n; return [d[0] * k, d[1] * k]; };
  if (M.rallyOf !== S.rallies) { M.rallyOf = S.rallies; M.aim = mindDice(M) < 0.5 ? -1 : 1; M.react = L.react; M.wait = L.serveWait; M.landing = null; M.read = -1; }
  if (S.K.phase === 'serve' && S.ball.held === who && S.dead === 0) {
    M.wait = Math.max(0, M.wait - dt);
    if (M.wait > 0) return { x: 0, y: 0, b: 0 };
    const aim = serveStick(ctx, S, P, sim);
    return { x: mclamp(aim.x + (mindDice(M) - 0.5) * L.wobble, -1, 1), y: mclamp(aim.y + (mindDice(M) - 0.5) * L.wobble * 0.5, -1, 1), b: 1 };
  }
  const home = (() => { const n = ctx.C.players, i = Number(who.slice(1)) - 1, aside = ctx.sport.home.aside ?? 0; return [sign * (n > 1 ? (i - (n - 1) / 2) * ((2 * aside) / (n - 1)) : 0), -sign * (court.halfL + ctx.sport.home.behind)]; })();
  if (S.K.phase !== 'live' || S.dead > 0) { const st = toward(home[0], home[1]); return { x: st[0], y: st[1], b: 0 }; }
  // the ball is ours to play: on its way to our side, or on our side with touches left
  const ours = B.lastSide === side ? B.touches < ctx.C.rally.touches : ball.velocity[1] * sign < 0 || ball.position[1] * sign < 0;
  if (!ours) { M.react = L.react; M.landing = null; const st = toward(home[0], home[1]); return { x: st[0], y: st[1], b: 0 }; }
  if (S.f - M.read >= PREDICT_EVERY) { M.read = S.f; M.landing = predictLanding(sim, S.sim); }
  M.react = Math.max(0, M.react - dt);
  const up = ctx.sport.reachUp ?? 2.6;
  if (S.active[side] === who) {
    let stick = [0, 0];
    if (M.react === 0 && M.landing && M.landing.at[1] * sign < 0) stick = toward(M.landing.at[0], M.landing.at[1]);
    // the swing, begun so its strike meets the ball: in reach, under the reach up, coming down or low
    const lead = body.swing * 0.5, g = -S.sim.gravity[2];
    const bx = ball.position[0] + ball.velocity[0] * lead, by = ball.position[1] + ball.velocity[1] * lead, bz = ball.position[2] + ball.velocity[2] * lead - 0.5 * g * lead * lead;
    const swing = by * sign < 0 && Math.hypot(bx - P.x, by - P.y) <= body.reach * 0.9 && bz < up - 0.2 && bz > 0.3 && !P.swing && S.ball.held === null;
    if (swing && ctx.sport.slip) {
      const key = `${S.rallies}:${S.ball.hits}`;
      if (M.slipOf !== key) { M.slipOf = key; M.slipped = mindDice(M) < ctx.sport.slip * SLIP_SCALE[M.level]; }
      if (M.slipped) return { x: stick[0], y: stick[1], b: 0 };
    }
    if (swing) {
      const aimX = mclamp(M.aim * 0.3 + (mindDice(M) - 0.5) * L.wobble, -1, 1);
      const verb = ctx.sport.strokes.fore;
      const aimY = mclamp(aimStick(ctx, S, verb, [bx, by, Math.max(0.3, bz)], [bx + aimX * 2, sign * court.halfL * 0.6]) + (mindDice(M) - 0.5) * L.wobble, -1, 1);
      return { x: aimX, y: aimY, b: 1 };
    }
    return { x: stick[0], y: stick[1], b: 0 };
  }
  // a teammate plays it: the setter's spot by the net before the side's first touch, the attack spot after it
  const spot = B.lastSide === side && B.touches >= 1 ? [mclamp(P.x, -court.halfW * 0.7, court.halfW * 0.7), -sign * 1.2] : [0, -sign * 1.6];
  const st = toward(spot[0], spot[1], 1);
  return { x: st[0], y: st[1], b: 0 };
}

// ── the turn mind ────────────────────────────────────────────────────────────────────────────────────────────

export function newTurnMind(level = 'regular', seed = 1) {
  if (!MIND_LEVELS[level]) throw new Error(`contest: mind level '${level}' is one of ${MIND_LEVEL_IDS.join(', ')}`);
  return { level, r: (seed * 2654435761) >>> 0, want: null, wait: 0 };
}

/**
 * The shot the mind wants at its seat, read on the sim's own probe (turn-sim.js probeShot: the strike flown on a copy):
 * the meter bisected until the shot rests at the distance left to the cup along its line (the full meter when nothing
 * reaches), or the aim bisected until the roll crosses the pin line at the pocket with the hook it likes; the level's
 * wobble on each.
 */
export function planShot(M, S, ctx, probe) {
  const L = MIND_LEVELS[M.level];
  const wob = (k) => (mindDice(M) - 0.5) * L.wobble * k;
  if (ctx.kind === 'strokes') {
    const b = S.sim.bodies[0], t = ctx.C.rounds[Math.min(S.K.round, ctx.C.rounds.length) - 1].course.regions[ctx.C.turn.holed].circle;
    const D = Math.hypot(t[0] - b.position[0], t[1] - b.position[1]);
    const reach = (power) => probe(S, ctx, { power, aim: [0, 0] });
    const full = reach(0.99);
    let meter;
    if (full.holed) meter = 0.99;
    else if (full.along < D && !full.penalty) meter = 0.99;   // nothing reaches: all of it
    else {
      let lo = 0.05, hi = 0.99;
      for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2, r = reach(mid); if (r.holed) { lo = hi = mid; break; } if (r.along >= D || r.penalty) hi = mid; else lo = mid; }
      meter = (lo + hi) / 2;
    }
    return { x: mr4(wob(0.4)), y: 0, meter: mr4(mclamp(meter + wob(0.5), 0.05, 0.99)) };
  }
  // the roll: the hook it likes, the aim bisected so the ball crosses the pin line at the pocket
  const spots = ctx.sport.pins.spots, pocket = spots[2][0] / 2, hook = mclamp(0.3 + wob(0.6), -1, 1), meter = mclamp(0.85 + wob(0.4), 0.3, 0.99);
  let lo = -0.6, hi = 0.6;
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2, r = probe(S, ctx, { power: meter, aim: [mid, hook], yLine: spots[0][1] });
    const x = r.cross ? r.cross[0] : r.at[0];
    if (x > pocket) hi = mid; else lo = mid;   // the stick right aims right: a crossing right of the pocket wants less
  }
  return { x: mr4(mclamp((lo + hi) / 2 + wob(0.3), -1, 1)), y: mr4(hook), meter: mr4(meter) };
}

/** The pad at the seat this frame: the aim turned toward the plan, the press held to the meter the plan wants. */
export function turnMind(M, S, ctx, probe) {
  const L = MIND_LEVELS[M.level], dt = 1 / 60;
  if (S.shot || S.dead > 0 || S.over || S.K.phase !== 'turn') { M.want = null; return { x: 0, y: 0, b: 0 }; }
  if (!M.want) { M.want = planShot(M, S, ctx, probe); M.wait = L.serveWait; }
  M.wait = Math.max(0, M.wait - dt);
  if (M.wait > 0) return { x: 0, y: 0, b: 0 };
  const W = M.want, dx = W.x - S.aim.x;
  if (Math.abs(dx) > 0.02) return { x: Math.sign(dx), y: W.y, b: 0 };   // turning the aim first
  // the press: held while the meter climbs to the want, released there (the sim fires on the release)
  const hold = !S.charge.held || (S.charge.rising && S.charge.meter < W.meter);
  if (!hold) M.want = null;
  return { x: 0, y: W.y, b: hold ? 1 : 0 };
}

// ── the positional mind ──────────────────────────────────────────────────────────────────────────────────────

/** The point of a shape (the kernel's { kind: 'rect', rect } | { kind: 'circle', circle }) nearest p; p when inside. */
export function nearestInside(sh, p) {
  if (sh.kind === 'rect') { const [x0, y0, x1, y1] = sh.rect; return [mclamp(p[0], x0, x1), mclamp(p[1], y0, y1)]; }
  const [cx, cy, r] = sh.circle, d = Math.hypot(p[0] - cx, p[1] - cy);
  if (d <= r) return [p[0], p[1]];
  return [cx + ((p[0] - cx) * r) / d, cy + ((p[1] - cy) * r) / d];
}
const shapeCentre = (sh) => (sh.kind === 'rect' ? [(sh.rect[0] + sh.rect[2]) / 2, (sh.rect[1] + sh.rect[3]) / 2] : [sh.circle[0], sh.circle[1]]);

/**
 * Where a role goes: the ball when it is within `press` of me (press it), else goal-side of the mark (a third of the
 * way from the mark toward home's centre), else home's centre; always inside one of the legal shapes (the nearest
 * point of the nearest, when the want lies outside them all).
 */
export function fieldTarget({ me, home, legal, ball = null, mark = null, press = 0 }) {
  if (!Array.isArray(me) || !home || !Array.isArray(legal) || !legal.length) throw new Error('contest: fieldTarget is { me: [x, y], home: shape, legal: [shapes], ball?, mark?, press? }');
  const hc = shapeCentre(home);
  let want, why;
  if (ball && press > 0 && Math.hypot(ball[0] - me[0], ball[1] - me[1]) <= press) { want = [ball[0], ball[1]]; why = 'press'; }
  else if (mark) { want = [mark[0] + (hc[0] - mark[0]) / 3, mark[1] + (hc[1] - mark[1]) / 3]; why = 'mark'; }
  else { want = hc; why = 'home'; }
  let best = null, bestD = Infinity;
  for (const sh of legal) { const q = nearestInside(sh, want); const d = Math.hypot(q[0] - want[0], q[1] - want[1]); if (d < bestD) { bestD = d; best = q; } if (d === 0) break; }
  return { to: [mr4(best[0]), mr4(best[1])], why, clamped: bestD > 0 };
}

// ── the team mind ────────────────────────────────────────────────────────────────────────────────────────────

export function newTeamMind(level = 'regular', seed = 1) {
  if (!MIND_LEVELS[level]) throw new Error(`contest: mind level '${level}' is one of ${MIND_LEVEL_IDS.join(', ')}`);
  return { level, r: (seed * 2654435761) >>> 0, shootWithin: 20 };
}

/** The pad the computer side's active player holds this frame, in the court frame, and the kick it wants if any. */
export function teamMind(M, S, who, ctx) {
  const L = MIND_LEVELS[M.level], P = S.p.find((p) => p.id === who), dir = P.side === 'a' ? 1 : -1;
  const b = S.sim.bodies[0], ball = [b.position[0], b.position[1]], goal = [0, dir * ctx.court.halfL];
  const wob = () => (mindDice(M) - 0.5) * L.wobble;
  const toward = (t) => { const d = [t[0] - P.x, t[1] - P.y], n = Math.hypot(d[0], d[1]); if (n < 0.15) return [0, 0]; const k = (Math.min(1, n) * L.pace) / n; return [mr4(d[0] * k), mr4(d[1] * k)]; };
  const d = Math.hypot(ball[0] - P.x, ball[1] - P.y);
  if (d > ctx.sport.kick.reach * 0.9) return { x: toward(ball)[0], y: toward(ball)[1], kick: null };
  const toGoal = Math.hypot(goal[0] - ball[0], goal[1] - ball[1]);
  if (toGoal <= M.shootWithin) {
    const az = Math.atan2(goal[1] - ball[1], (goal[0] + (mindDice(M) - 0.5) * ctx.sport.goal.width * 0.6) - ball[0]) + wob() * 0.4;
    return { x: 0, y: 0, kick: { facing: mr4(az), power: 1 } };
  }
  // a teammate ahead of the ball, within a pass
  let mate = null, best = -Infinity;
  for (const Q of S.p) { if (Q.side !== P.side || Q === P || Q.role === 'keeper') continue; const ahead = (Q.y - ball[1]) * dir, far = Math.hypot(Q.x - ball[0], Q.y - ball[1]); if (ahead > 2 && far < 18 && ahead > best) { best = ahead; mate = Q; } }
  if (mate && mindDice(M) < 0.7) return { x: 0, y: 0, kick: { facing: mr4(Math.atan2(mate.y - ball[1], mate.x - ball[0]) + wob() * 0.3), power: Math.min(0.9, ctx.sport.kick.pass + Math.hypot(mate.x - ball[0], mate.y - ball[1]) / 30) } };
  // carry on toward the goal, leaning off the centre
  const t = [ball[0] * 0.5 + wob() * 4, goal[1]];
  const st = toward(t);
  return { x: st[0], y: st[1], kick: null };
}
