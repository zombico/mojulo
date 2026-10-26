/**
 * THE MATCH SIM — a net game as a pure function of two pads at 60 Hz, in versus's shape (versus/versus-core.js): the
 * join of the contest kernel (the referee), the ball card (the ball as the physics property's sphere in its register's
 * air), the hit (the swing's strike on the ball) and the court mind (the computer across the net). No clock, no
 * Math.random, no DOM: the same context and pads are the same match to the byte.
 *
 *   stepMatch(S, pads, ctx) → S    one frame; pads[i] = { x, y, b } in the player's own frame (x its right, y toward the
 *                                  net, -1 … 1; b: PAD bits) for the sides players hold (i < players: a first, then b);
 *                                  the other side is the court mind's
 *   newMatch(ctx) → S              ctx = matchContext(data) (match-arena.js matchArenaData)
 *   matchDisplay(S, ctx)           the scoreboard: the kernel's words, the rally, the serve, the last call
 *   MATCH_BODY                     the body on each register: its court speed (three quarters of the motion flavors'
 *                                  sprint, held equal by the test) and build-up, its reach with the racquet, the tip
 *                                  speed its swing puts on the ball, the swing's seconds
 *
 * The court frame is the kernel's (x across, y along, the net at y = 0, side a at y < 0, z up, metres). Each side is a
 * body on the plane held to its own end; a press begins a swing (the forehand or the backhand by where the ball is,
 * the serve from the hand), live through the swing system's window and landing on its strike phase: a ball then
 * within the body's reach takes the hit's velocity and spin. The arcade registers AIM the hit so it lands at the depth
 * the stick asks (the cartoon tennis); the realistic register strikes as the verb and the stick say and the court is
 * the player's to find. The ball flies on the physics property's integrator (gravity, the register's air, the floor,
 * the net as a box); its floor contacts are the kernel's bounces, its net contacts the kernel's net, its rest or its
 * leaving the room a dead ball; the kernel calls every point, fault and let, and names the server and the box.
 */
import { contestStart, contestApply, contestDisplay, contestRegion } from './contest-kernel.js';
import { buildSim } from '../worlds/physics-sim.js';
import { ballBody, ballForces, ballGravity } from './ball-card.js';
import { hitBall, hitWindow, aimedShot, HIT_REGISTERS } from './hit.js';
import { newCourtMind, courtMind } from './contest-mind.js';

export const MATCH_BODY = Object.freeze({
  realistic: Object.freeze({ speed: 5.25, tau: 1.0, reach: 1.6, tipSpeed: 18, swing: 0.5 }),
  action: Object.freeze({ speed: 6.75, tau: 0.45, reach: 1.9, tipSpeed: 20, swing: 0.42 }),
  platformer: Object.freeze({ speed: 4.5, tau: 0.08, reach: 2.0, tipSpeed: 14, swing: 0.35 }),
  pinball: Object.freeze({ speed: 15, tau: 1.4, reach: 1.7, tipSpeed: 22, swing: 0.4 }),
});
export const MATCH_REGISTER_IDS = Object.freeze(Object.keys(MATCH_BODY));
export const MPAD = Object.freeze({ SWING: 1, START: 4 });
export const MATCH_FPS = 60;
const MDT = 1 / MATCH_FPS;
export const DEAD = Object.freeze({ point: 90, fault: 60, over: 150 });   // frames the ball lies dead after a call
const ROOM = 6;             // metres past the lines the ball is gone
const BEHIND = 4, BESIDE = 2.5, NEAR = 0.4;   // how far a body may go behind its baseline, beside the lines, from the net
const mr3 = (v) => Math.round(v * 1000) / 1000;
const _msim = buildSim();

/** The sim's context from the arena's data. */
export function matchContext(data) {
  if (!data || !data.C || !data.sport || !data.court) throw new Error('match: a context is { C, sport, court, register?, players?, level?, seed? }');
  const register = data.register ?? 'realistic';
  if (!MATCH_BODY[register]) throw new Error(`match: register '${register}' is one of ${MATCH_REGISTER_IDS.join(', ')}`);
  return { C: data.C, sport: data.sport, ball: data.sport.ball, court: data.court, register, players: data.players ?? 0, level: data.level ?? 'regular', seed: data.seed ?? 1, body: MATCH_BODY[register], spread: HIT_REGISTERS[register].spread, ...(data.floor ? { floor: data.floor } : {}) };
}

const signOf = (side) => (side === 'a' ? 1 : -1);          // a's "toward the net" is +y
const facingOf = (side) => (side === 'a' ? Math.PI / 2 : -Math.PI / 2);
const ballBodyOf = (S) => S.sim.bodies[0];

function newPlayer(id, side) { return { id, side, x: 0, y: 0, vx: 0, vy: 0, swing: null, held: 0, hits: 0 }; }

/** The first state: the kernel's toss, the bodies at their marks, the ball in the server's hand. */
export function newMatch(ctx) {
  const K = contestStart(ctx.C, ctx.seed), c = ctx.court;
  const sim = _msim.createState({
    gravity: ballGravity(ctx.register), seed: ctx.seed,
    bodies: [
      ballBody(ctx.ball, ctx.register, { id: 'ball', position: [0, 0, 1] }),
      // (the court's surface, match-arena.js COURT_SURFACES: absent, a neutral floor, the ball's own bounce and full grip)
      { id: 'floor', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0, restitution: ctx.floor ? ctx.floor.restitution : 1, friction: ctx.floor ? ctx.floor.friction : 1 },
      { id: 'net', collider: 'aabb', position: [0, 0, ctx.sport.net.height / 2], half: [c.halfW + ctx.sport.net.beyond, 0.02, ctx.sport.net.height / 2], mass: 0, restitution: 0.1, friction: 0.6 },
    ],
    forces: ballForces(ctx.ball, ctx.register, { id: 'ball' }),
  });
  const S = {
    f: 0, K, phase: K.phase, calls: [], over: false, winner: null, rallies: 0, dead: 0, serveTarget: null, last: null,
    p: [newPlayer('a1', 'a'), newPlayer('b1', 'b')],
    ball: { held: null, hits: 0, onFloor: false, onNet: false },
    sim,
    minds: [newCourtMind(ctx.level, ctx.seed * 3 + 1), newCourtMind(ctx.level, ctx.seed * 3 + 2)],
  };
  setupServe(S, ctx);
  return S;
}

export const cloneMatch = (S) => JSON.parse(JSON.stringify(S));

/** The bodies at their marks for the serve the kernel names, the ball in the server's hand, the rally fresh. */
function setupServe(S, ctx) {
  const K = S.K, c = ctx.court, sp = ctx.sport;
  if (K.phase !== 'serve' || !K.restart) return;
  const sv = K.restart.side, rc = sv === 'a' ? 'b' : 'a', s = signOf(sv), deuce = K.played % 2 === 0;
  const server = S.p.find((p) => p.side === sv), receiver = S.p.find((p) => p.side === rc);
  // the server behind its baseline, aside the centre mark toward the court the point names (its right for the deuce court)
  Object.assign(server, { x: mr3(s * sp.serve.aside * (deuce ? 1 : -1)), y: mr3(-s * (c.halfL + sp.serve.behind)), vx: 0, vy: 0, swing: null });
  Object.assign(receiver, { x: mr3(-s * sp.receive.aside * (deuce ? 1 : -1)), y: mr3(s * (c.halfL + sp.receive.behind)), vx: 0, vy: 0, swing: null });
  // the box the point names, on the receiver's side: where the serve is aimed
  // the box the point names, on the receiver's side; the serve is aimed at its deep part, as a serve has to be
  const name = ctx.C.serve.into[K.played % ctx.C.serve.into.length], r = contestRegion(ctx.C, name, rc).rect;
  const near = Math.min(Math.abs(r[1]), Math.abs(r[3])), far = Math.max(Math.abs(r[1]), Math.abs(r[3]));
  S.serveTarget = [mr3((r[0] + r[2]) / 2), mr3(s * (near + 0.7 * (far - near)))];   // on the receiver's side: a's y < 0
  const b = ballBodyOf(S);
  b.velocity = [0, 0, 0]; b.angularVelocity = [0, 0, 0]; b.orientation = [0, 0, 0, 1]; b.resting = false;
  S.ball = { held: server.id, hits: 0, onFloor: false, onNet: false };
  holdBall(S, ctx, server);
  S.rallies += 1;
}

function holdBall(S, ctx, P) {
  const b = ballBodyOf(S), right = signOf(P.side);   // the racquet hand on the player's right (a faces +y: its right is +x)
  b.position = [mr3(P.x + right * 0.3), P.y, ctx.sport.serve.hand];
  b.velocity = [0, 0, 0]; b.angularVelocity = [0, 0, 0]; b.resting = false;
}

function fact(S, ctx, f) {
  const out = contestApply(ctx.C, S.K, f);
  S.K = out.S; S.phase = out.S.phase;
  for (const c of out.calls) {
    S.calls.push({ ...c, f: S.f }); S.last = c;
    if (c.kind === 'over') { S.over = true; S.winner = c.winner; S.dead = DEAD.over; }
    else if (c.kind === 'point') S.dead = DEAD.point;
    else if (c.kind === 'fault' || c.kind === 'let') S.dead = DEAD.fault;
  }
  return out.calls;
}

/** The swing's strike phase and window for a verb in this register (a verb with no clip strikes at the half). */
function windowOf(verb, register) {
  const W = hitWindow(verb, 'normal', register);
  return W.window ? { strike: W.strike, window: W.window } : { strike: 0.5, window: [0.3, 0.75] };
}

function startSwing(S, ctx, P, pad) {
  const b = ballBodyOf(S), s = signOf(P.side);
  const serve = S.K.phase === 'serve' && S.ball.held === P.id;
  // the forehand on the racquet side (the player's right: +x for a, -x for b), the backhand across
  const rel = (b.position[0] - P.x) * s;
  const verb = serve ? ctx.sport.strokes.serve : rel >= 0 ? ctx.sport.strokes.fore : ctx.sport.strokes.back;
  const W = windowOf(verb, ctx.register);
  P.swing = { verb, u: 0, frames: Math.max(6, Math.round(ctx.body.swing * MATCH_FPS)), hit: false, stick: [pad.x, pad.y], strike: W.strike, window: W.window, serve };
  S.calls.push({ kind: 'swing', who: P.id, verb, f: S.f });
}

function tryHit(S, ctx, P) {
  const sw = P.swing, b = ballBodyOf(S), s = signOf(P.side), c = ctx.court;
  if (sw.hit || sw.u < sw.strike || sw.u > sw.window[1]) return;
  const serve = sw.serve && S.ball.held === P.id;
  if (!serve) {
    if (S.K.phase !== 'live' || S.ball.held) return;
    if (b.position[1] * -s < -0.3) return;   // the ball is across the net: no reaching over here (the kernel would call it)
    if (Math.hypot(b.position[0] - P.x, b.position[1] - P.y) > ctx.body.reach || b.position[2] > 2.6) return;
  }
  const facing = facingOf(P.side), stick = sw.stick;
  let aimed = {};
  if (ctx.register !== 'realistic') {
    // the arcade's aimed shot: a serve at the deep part of the box the point names, a stroke at the depth the stick asks
    // (the far service line to short of the baseline), along the aim, over the cord, at the speed that lands it
    const depth = serve ? S.serveTarget[1] : c.halfL * (0.5 + 0.35 * (stick[1] + 1) / 2) * s;   // y on the far side
    const az = facing - stick[0] * (ctx.spread * Math.PI) / 180;
    const along = Math.max(0.3, Math.abs(Math.sin(az)));
    const D = Math.abs(depth - b.position[1]) / along, netAt = Math.abs(b.position[1]) / along;
    const probe = hitBall({ ball: b, who: P.id, at: [b.position[0], b.position[1]], verb: sw.verb, register: ctx.register, facing, stick, tipSpeed: ctx.body.tipSpeed, hits: S.ball.hits, elevationDeg: 0 }).speed;
    const A = aimedShot(probe, b.position[2], D, -S.sim.gravity[2], { at: netAt, height: ctx.sport.net.height });
    aimed = { elevationDeg: A.elevationDeg, speedCap: A.speed };
    sw.aim = { D: mr3(D), netAt: mr3(netAt), depth: mr3(depth), probe, ...A };
  }
  const H = hitBall({ ball: b, who: P.id, at: [b.position[0], b.position[1]], verb: sw.verb, register: ctx.register, facing, stick, tipSpeed: ctx.body.tipSpeed, hits: S.ball.hits, ...aimed });
  b.velocity = H.velocity.slice(); b.angularVelocity = H.angularVelocity.slice(); b.resting = false;
  if (serve) S.ball.held = null; else S.ball.hits += 1;
  S.ball.onFloor = false; S.ball.onNet = false;
  P.hits += 1; sw.hit = true;
  S.calls.push({ kind: 'hit', who: P.id, verb: sw.verb, speed: H.speed, spin: H.spin, at: [mr3(b.position[0]), mr3(b.position[1]), mr3(b.position[2])], elevation: H.elevation, ...(sw.aim ? { aim: sw.aim } : {}), f: S.f });
  fact(S, ctx, H.fact);
}

function move(S, ctx, P, pad) {
  const s = signOf(P.side), c = ctx.court, B = ctx.body;
  const tx = pad.x * -s * -1 * B.speed, ty = pad.y * s * B.speed;   // the player's right: +x for a, -x for b; toward the net: +y for a
  const k = 1 - Math.exp(-MDT / B.tau);
  P.vx += (tx * -1 * -1 - P.vx) * k; P.vy += (ty - P.vy) * k;
  P.x = mr3(Math.max(-(c.halfW + BESIDE), Math.min(c.halfW + BESIDE, P.x + P.vx * MDT)));
  const yMin = s > 0 ? -(c.halfL + BEHIND) : NEAR, yMax = s > 0 ? -NEAR : c.halfL + BEHIND;
  P.y = mr3(Math.max(yMin, Math.min(yMax, P.y + P.vy * MDT)));
  if (P.y === yMin || P.y === yMax) P.vy = 0;
}

/** One frame. */
export function stepMatch(S, pads, ctx) {
  S.f += 1;
  if (S.over) { if (S.dead > 0) S.dead -= 1; return S; }
  if (S.dead > 0) { S.dead -= 1; if (S.dead === 0) setupServe(S, ctx); return S; }
  const b = ballBodyOf(S);
  for (let i = 0; i < S.p.length; i++) {
    const P = S.p[i];
    const pad = i < ctx.players ? (pads && pads[i]) || { x: 0, y: 0, b: 0 } : courtMind(S.minds[i], S, P.id, ctx, _msim);
    const px = Math.max(-1, Math.min(1, pad.x || 0)), py = Math.max(-1, Math.min(1, pad.y || 0));
    move(S, ctx, P, { x: px, y: py });
    const pressed = !!(pad.b & MPAD.SWING), edge = pressed && !P.held;
    P.held = pressed ? 1 : 0;
    if (edge && !P.swing) startSwing(S, ctx, P, { x: px, y: py });
    if (P.swing) {
      P.swing.u = mr3(P.swing.u + 1 / P.swing.frames);
      tryHit(S, ctx, P);
      if (P.swing && P.swing.u >= 1) P.swing = null;
    }
    if (S.ball.held === P.id) holdBall(S, ctx, P);
    if (S.over || S.dead > 0) return S;
  }
  if (S.ball.held) return S;
  // the ball flies; its contacts are the kernel's facts
  _msim.step(S.sim, MDT);
  const touching = (id) => S.sim.contacts.some((k) => (k.a === 'ball' && k.b === id) || (k.b === 'ball' && k.a === id));
  const onFloor = touching('floor'), onNet = touching('net');
  if (onNet && !S.ball.onNet) fact(S, ctx, { kind: 'net' });
  S.ball.onNet = onNet;
  if (S.over || S.dead > 0) return S;
  if (onFloor && !S.ball.onFloor) fact(S, ctx, { kind: 'bounce', at: [mr3(b.position[0]), mr3(b.position[1])] });
  S.ball.onFloor = onFloor;
  if (S.over || S.dead > 0) return S;
  if (S.K.phase === 'live') {
    if (b.resting) fact(S, ctx, { kind: 'bounce', at: [mr3(b.position[0]), mr3(b.position[1])] });   // the ball died where it lay
    else if (Math.abs(b.position[0]) > ctx.court.halfW + ROOM || Math.abs(b.position[1]) > ctx.court.halfL + ROOM + 3 || b.position[2] < -1) fact(S, ctx, { kind: 'out' });
  }
  return S;
}

/** The scoreboard's words and the match's moment. */
export function matchDisplay(S, ctx) {
  const d = contestDisplay(ctx.C, S.K), b = ballBodyOf(S);
  return { ...d, rallies: S.rallies, hits: S.ball.hits, held: S.ball.held, faults: S.K.faults, last: S.last, dead: S.dead, over: S.over, winner: S.winner, ball: [mr3(b.position[0]), mr3(b.position[1]), mr3(b.position[2])], players: S.p.map((p) => ({ id: p.id, x: p.x, y: p.y, swing: p.swing ? { verb: p.swing.verb, u: p.swing.u } : null, hits: p.hits })) };
}
