/**
 * THE COURT MIND — the computer across the net (match-sim.js): plain, seeded, bounded. It serves when its turn comes,
 * reads where the ball will land by running the ball's own physics on a copy (the physics property's integrator, never a
 * guess), runs there after its reaction time, and swings when the ball comes into reach, aiming across the court or down
 * the line by its own habit. Its levels are the mind's skill tiers (lib/graph/mind/vocab.js SKILLS: novice, regular,
 * veteran, ace; held to the same names by the test): the reaction before it moves, the wobble on its aim, how much of
 * the body's speed it uses, and how long it waits to serve.
 *
 *   MIND_LEVELS                       { <level>: { react (s), wobble (a share of the stick), pace (a share of the speed),
 *                                       serveWait (s) } }
 *   newCourtMind(level, seed)          → M (its memory: the level, dice, the target, the reaction left, the last read)
 *   courtMind(M, S, who, ctx, sim)     → { x, y, b } the pad it holds this frame (the player's own frame: y toward the net)
 *   predictLanding(sim, state, id, { steps }) → { at: [x, y], t } where the ball meets the floor, or null (a copy is run)
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
  const th = aimedElevation(speed, from[2], D, -S.sim.gravity[2], { at: netAt, height: ctx.sport.net.height });
  // the realistic ball flies in air, which shortens it: a little more lift than the vacuum says
  const air = ctx.register === 'realistic' ? 1.5 : 0;
  return mclamp((th + air - V.arc) / V.lift, -1, 1);
}

const mclamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The stick that serves into the box the point names (S.serveTarget, match-sim.js) from where the server stands: its
 * x the azimuth across the register's spread (right aims right), its y the lift that lands the serve there.
 */
export function serveStick(ctx, S, P) {
  const box = S.serveTarget, facing = P.side === 'a' ? Math.PI / 2 : -Math.PI / 2;
  const az = Math.atan2(box[1] - P.y, box[0] - P.x);
  let d = az - facing; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const x = mclamp(-d / (ctx.spread * Math.PI / 180), -1, 1);
  const y = aimStick(ctx, S, ctx.sport.strokes.serve, [P.x, P.y, ctx.sport.serve.hand], box);
  return { x: mr4(x), y: mr4(y) };
}
const mr4 = (v) => Math.round(v * 10000) / 10000;

/**
 * The pad the mind holds this frame. `S` is the match (match-sim.js), `who` its player id, `ctx` the match context,
 * `sim` the physics instance. The stick is in the player's own frame (x its right, y toward the net).
 */
export function courtMind(M, S, who, ctx, sim) {
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
    const aim = serveStick(ctx, S, P);
    const x = aim.x + (mindDice(M) - 0.5) * L.wobble, y = aim.y + (mindDice(M) - 0.5) * L.wobble * 0.5;
    return { x: mclamp(x, -1, 1), y: mclamp(y, -1, 1), b: 1 };
  }
  if (S.K.phase !== 'live' || S.dead > 0) return { x: 0, y: 0, b: 0 };
  const coming = ball.velocity[1] * sign < -0.1 || (ball.position[1] * sign < 0 && Math.abs(ball.velocity[1]) < 0.1);
  const onMySide = ball.position[1] * sign < 0;
  // read the ball's way every few frames while it comes: where it crosses my depth, or dies short; then move after
  // the reaction, so the ball comes to the racquet side
  if (coming) {
    if (S.f - M.read >= PREDICT_EVERY) { M.read = S.f; M.landing = predictCrossing(sim, S.sim, P.y, sign); }
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
  const swing = by * sign < 0 && dist <= body.reach * 0.9 && bz < 2.4 && approaching && !P.swing && S.ball.held === null;
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
