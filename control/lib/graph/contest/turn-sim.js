/**
 * THE TURN SIM — a turn sport (golf, bowling) as a pure function of one pad at 60 Hz, hot-seat: the seat whose turn
 * the contest kernel names holds the pad (a local player's, or the turn mind's for a computer seat), aims with the
 * stick, charges a press and releases the shot; the ball flies and rolls on the physics property's integrator in its
 * register's air over the course's ground; its rest is the kernel's fact, and the kernel calls the lie, the penalty,
 * the holed, the roll's mark, the next seat, the end. No clock, no Math.random, no DOM: the same context and pads
 * are the same round to the byte.
 *
 *   stepTurns(S, pad, ctx) → S      one frame; pad = { x, y, b } (x the aim, held to turn it; y the lift or the hook;
 *                                   b: TPAD bits) for the seat at the pad (a seat below ctx.players), else the mind's
 *   newTurns(ctx) → S               ctx = turnContext(data) (turn-arena.js turnsArenaData)
 *   turnsDisplay(S, ctx)            the card (the kernel's), the hole, the club, the aim, the meter, the last call
 *   TURN_BODY                       the register's dials on the shot: the tip's share, the meter's pace, the ground
 *
 * THE SHOT: the stick turns the aim about the line to the target (the cup; the pins) across the register's spread; the
 * press runs the meter up and back (the action lab's hold-and-release); the release strikes at the meter's share of
 * the club's tip speed through the hit (hit.js): the club by the lie and the distance left (the book's clubs), the
 * bowling roll flat with the stick's lift as its hook (a side roll the lane's friction turns). THE GROUND: a ball on
 * the ground loses speed at the lie's rolling resistance (the book's lies, m/s²; the integrator's friction only
 * couples spin, it never stops a roll); the cup takes a slow ball over it; water and out of bounds stop it where it
 * went in (the kernel's penalty); the gutter drops it to the pit. THE PINS: tenpin's rack as spheres (the belly) on
 * their spots; one moved past the book's `down` has fallen, and is parked off the lane; a fresh rack stands them all.
 */
import { contestStart, contestApply, contestDisplay, contestLieOf } from './contest-kernel.js';
import { buildSim } from '../worlds/physics-sim.js';
import { ballBody, ballForces, ballGravity } from './ball-card.js';
import { hitBall } from './hit.js';
import { newTurnMind, turnMind } from './contest-mind.js';

export const TURN_BODY = Object.freeze({
  realistic: Object.freeze({ tip: 1, charge: 1, floor: Object.freeze({ restitution: 0.4, friction: 0.8 }) }),
  action: Object.freeze({ tip: 1.1, charge: 0.8, floor: Object.freeze({ restitution: 0.5, friction: 0.8 }) }),
  platformer: Object.freeze({ tip: 0.8, charge: 1.1, floor: Object.freeze({ restitution: 0.5, friction: 0.8 }) }),
  pinball: Object.freeze({ tip: 1.3, charge: 0.6, floor: Object.freeze({ restitution: 0.9, friction: 0.5 }) }),
});
export const TURN_REGISTER_IDS = Object.freeze(Object.keys(TURN_BODY));
export const TPAD = Object.freeze({ SWING: 1, START: 4 });
export const TURN_FPS = 60;
const TDT = 1 / TURN_FPS;
export const TDEAD = Object.freeze({ rest: 45, round: 120, over: 180 });   // frames after a rest, a round's end, the end
export const AIM_RATE = 1.2;      // the stick's full deflection a second: the aim turns while the stick is held
const SETTLE = TURN_FPS * 10;     // frames a shot may fly and roll before it is called at rest
const PINS_SETTLE = TURN_FPS * 4; // frames the pins may roll after the ball stops
const STOP = 0.06;                // m/s on the ground: at rest (a rolling ball keeps spin the integrator's rest rule waits on)
const PARK = [60, 60];            // where a fallen pin or a pit ball is parked, off every region
const tr3 = (v) => Math.round(v * 1000) / 1000;
const tclamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const _tsim = buildSim();

/** The sim's context from the arena's data. */
export function turnContext(data) {
  if (!data || !data.C || !data.sport) throw new Error('turns: a context is { C, sport, register?, players?, level?, seed? }');
  const register = data.register ?? 'realistic';
  if (!TURN_BODY[register]) throw new Error(`turns: register '${register}' is one of ${TURN_REGISTER_IDS.join(', ')}`);
  // the aim's spread is the sport's (a club's, a roll's), not the racquet's register
  return { C: data.C, sport: data.sport, ball: data.sport.ball, kind: data.C.turn.kind, register, seats: data.C.players, players: data.players ?? 0, level: data.level ?? 'regular', seed: data.seed ?? 1, body: TURN_BODY[register], spread: data.sport.swing.spread };
}

const ballBodyOf = (S) => S.sim.bodies[0];
const courseOf = (ctx, S) => ctx.C.rounds[Math.min(S.K.round, ctx.C.rounds.length) - 1].course;
/** The target the aim is about: the cup's centre, or the pins' head pin. */
export function targetOf(ctx, S) {
  if (ctx.kind === 'strokes') return courseOf(ctx, S).regions[ctx.C.turn.holed].circle.slice(0, 2);
  return ctx.sport.pins.spots[0].slice();
}
/** The club the lie and the distance left give (the book's clubs: the first that holds), or the roll. */
export function clubOf(ctx, S) {
  if (ctx.kind !== 'strokes') return 'roll';
  const b = ballBodyOf(S), lie = contestLieOf(ctx.C, S.K, [b.position[0], b.position[1]]), t = targetOf(ctx, S);
  const D = Math.hypot(t[0] - b.position[0], t[1] - b.position[1]);
  for (const c of ctx.sport.clubs) { if (c.on !== undefined ? lie === c.on : c.within !== undefined ? D <= c.within : true) return c.verb; }
  return ctx.sport.clubs[ctx.sport.clubs.length - 1].verb;
}

export function newTurns(ctx) {
  const K = contestStart(ctx.C, ctx.seed), F = ctx.body.floor;
  const bodies = [
    ballBody(ctx.ball, ctx.register, { id: 'ball', position: [0, 0, 1] }),
    { id: 'floor', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0, restitution: F.restitution, friction: F.friction },
  ];
  if (ctx.kind === 'pins') for (const [i, spot] of ctx.sport.pins.spots.entries()) bodies.push({ id: `pin${i + 1}`, collider: 'sphere', mass: ctx.sport.pins.mass, radius: ctx.sport.pins.radius, restitution: 0.7, friction: 0.6, position: [spot[0], spot[1], ctx.sport.pins.radius] });
  const sim = _tsim.createState({ gravity: ballGravity(ctx.register), seed: ctx.seed, bodies, forces: ballForces(ctx.ball, ctx.register, { id: 'ball' }) });
  const S = {
    f: 0, K, phase: K.phase, calls: [], over: false, winner: null, dead: 0, last: null, sim,
    hole: 0, aim: { x: 0, y: 0 }, charge: { held: false, t: 0, meter: 0, rising: true }, shot: null, ball: { frames: 0, gutter: false, stopped: false, settle: 0 },
    pins: ctx.kind === 'pins' ? ctx.sport.pins.spots.map((spot) => ({ spot: spot.slice(), up: true })) : null,
    minds: {},
  };
  for (let i = ctx.players; i < ctx.seats; i++) S.minds[`p${i + 1}`] = newTurnMind(ctx.level, ctx.seed * 31 + i);
  place(S, ctx);
  return S;
}

function stop(b, at) {
  if (at) b.position = [at[0], at[1], at[2]];
  b.velocity = [0, 0, 0]; b.angularVelocity = [0, 0, 0]; b.resting = true;
}

/** The ball where the kernel's restart says, the pins racked as it says. */
function place(S, ctx) {
  const R = S.K.restart, b = ballBodyOf(S);
  S.hole = Math.min(S.K.round, ctx.C.rounds.length) - 1;
  S.aim = { x: 0, y: 0 }; S.charge = { held: false, t: 0, meter: 0, rising: true }; S.shot = null; S.ball = { frames: 0, gutter: false, stopped: false, settle: 0 };
  if (!R) return;
  if (ctx.kind === 'strokes') { stop(b, [R.at[0], R.at[1], b.radius]); return; }
  stop(b, [0, -1.2, b.radius]);
  if (R.standing === ctx.C.turn.pins) for (const p of S.pins) p.up = true;
  S.pins.forEach((p, i) => { const body = S.sim.bodies[2 + i]; stop(body, p.up ? [p.spot[0], p.spot[1], body.radius] : [PARK[0], PARK[1] + i, body.radius]); });
}

function fact(S, ctx, f) {
  const out = contestApply(ctx.C, S.K, f);
  S.K = out.S; S.phase = out.S.phase;
  for (const c of out.calls) { S.calls.push({ ...c, f: S.f }); S.last = c; }
  return out.calls;
}

/** The release: the club's strike at the meter's share of its tip speed, aimed by the stick about the target. */
function strike(S, ctx, who, power) {
  const b = ballBodyOf(S), verb = clubOf(ctx, S), t = targetOf(ctx, S);
  const facing = ctx.kind === 'strokes' ? Math.atan2(t[1] - b.position[1], t[0] - b.position[0]) : Math.PI / 2;
  const tipSpeed = tr3(ctx.sport.swing.tipSpeed * ctx.body.tip * power);
  // the stick's x is folded into the facing at the sport's spread (hitVelocity's spread is the racquet's register's)
  const H = hitBall({ ball: b, who, at: [b.position[0], b.position[1]], verb, register: ctx.register, facing: facing - (S.aim.x * ctx.spread * Math.PI) / 180, stick: [0, ctx.kind === 'pins' ? 0 : S.aim.y], tipSpeed, hits: 0 });
  b.velocity = H.velocity.slice(); b.angularVelocity = H.angularVelocity.slice(); b.resting = false;
  if (ctx.kind === 'pins') {
    // the hook: a side roll along the line of travel at the stick's lift, which the lane's friction turns into a curve
    const n = Math.hypot(b.velocity[0], b.velocity[1]) || 1, w = S.aim.y * ctx.sport.hook.rate * 2 * Math.PI;
    b.angularVelocity = [tr3((b.velocity[0] / n) * w), tr3((b.velocity[1] / n) * w), 0];
  }
  S.shot = { who, verb, speed: H.speed, power: tr3(power), aim: { x: tr3(S.aim.x), y: tr3(S.aim.y) }, f: S.f };
  S.ball = { frames: 0, gutter: false, stopped: false, settle: 0 };
  S.calls.push({ kind: 'hit', who, verb, speed: H.speed, power: tr3(power), f: S.f });
  fact(S, ctx, { kind: 'shot', who });
}

/** The ground's rolling resistance on a body touching the floor this step; true when it has come to rest. */
function ground(S, ctx, body, decel) {
  const v = body.velocity, vh = Math.hypot(v[0], v[1]);
  if (vh > 0) { const k = Math.max(0, vh - decel * TDT) / vh; v[0] *= k; v[1] *= k; }
  if (Math.hypot(v[0], v[1]) < STOP && Math.abs(v[2]) < 0.15) { stop(body, null); return true; }
  return false;
}
const touching = (S, id) => S.sim.contacts.some((c) => (c.a === id && c.b === 'floor') || (c.b === id && c.a === 'floor'));

/** The ball's frame in play: the sim stepped, the ground and the course's rules applied; the rest fact when it stops. */
function fly(S, ctx) {
  const b = ballBodyOf(S), B = S.ball, L = ctx.sport.lies;
  if (!B.stopped) {
    _tsim.step(S.sim, TDT);
    B.frames += 1;
    const p = [b.position[0], b.position[1]], lie = contestLieOf(ctx.C, S.K, p);
    if (ctx.kind === 'strokes') {
      const cup = ctx.sport.cup, t = targetOf(ctx, S), speed = Math.hypot(b.velocity[0], b.velocity[1], b.velocity[2]);
      if (Math.hypot(p[0] - t[0], p[1] - t[1]) <= cup.radius && b.position[2] <= b.radius + 0.03 && speed <= cup.capture) { stop(b, [t[0], t[1], -0.05]); B.stopped = true; }
      else if (lie === 'water' && b.position[2] <= b.radius + 0.01) { stop(b, [p[0], p[1], -0.1]); B.stopped = true; }   // it sinks where it went in
      else if (lie === 'out') { stop(b, [p[0], p[1], b.radius]); B.stopped = true; }                                          // out of bounds where it crossed
      else if (touching(S, 'ball') && ground(S, ctx, b, L[lie] ?? L.rough)) B.stopped = true;
    } else {
      const lane = ctx.sport.lane;
      if (!B.gutter && p[1] > 0 && p[1] < lane.length + lane.deck && Math.abs(p[0]) > lane.width / 2) {
        // the gutter: the ball drops in and runs to the pit beside the pins
        B.gutter = true; stop(b, [Math.sign(p[0]) * (lane.width / 2 + lane.gutter / 2), lane.length + lane.deck + lane.pit / 2, b.radius]); B.stopped = true;
      } else if (lie === 'pit' || lie === 'out' || p[1] > lane.length + lane.deck) { stop(b, [PARK[0], PARK[1] - 2, b.radius]); B.stopped = true; }
      else if (touching(S, 'ball') && ground(S, ctx, b, L.lane)) B.stopped = true;
    }
    if (!B.stopped && B.frames >= SETTLE) { stop(b, null); B.stopped = true; }
    if (!B.stopped) return;
  }
  if (ctx.kind === 'strokes') { rest(S, ctx, { kind: 'rest', at: [tr3(b.position[0]), tr3(b.position[1])] }); return; }
  // the pins settle after the ball: each on the deck slows as a sliding pin does, one off the lane or in the pit is fallen
  _tsim.step(S.sim, TDT);
  B.settle += 1;
  const lane = ctx.sport.lane, D = ctx.sport.pins.down;
  let moving = false;
  S.pins.forEach((pin, i) => {
    if (!pin.up) return;
    const body = S.sim.bodies[2 + i], q = body.position;
    if (q[1] > lane.length + lane.deck || Math.abs(q[0]) > lane.width / 2 + lane.gutter) { pin.up = false; stop(body, [PARK[0], PARK[1] + i, body.radius]); return; }
    if (touching(S, body.id)) ground(S, ctx, body, 4);
    if (!body.resting && Math.hypot(body.velocity[0], body.velocity[1], body.velocity[2]) > STOP) moving = true;
  });
  if (moving && B.settle < PINS_SETTLE) return;
  // the count: a pin still near its spot stands; the rest have fallen and are parked
  let standing = 0;
  S.pins.forEach((pin, i) => {
    if (!pin.up) return;
    const body = S.sim.bodies[2 + i];
    if (Math.hypot(body.position[0] - pin.spot[0], body.position[1] - pin.spot[1]) > D) { pin.up = false; stop(body, [PARK[0], PARK[1] + i, body.radius]); }
    else { standing += 1; stop(body, [pin.spot[0], pin.spot[1], body.radius]); }
  });
  rest(S, ctx, { kind: 'rest', standing });
}

function rest(S, ctx, f) {
  const calls = fact(S, ctx, f);
  S.shot = null;
  S.dead = calls.some((c) => c.kind === 'over') ? TDEAD.over : calls.some((c) => c.kind === 'turn') ? TDEAD.round : TDEAD.rest;
  if (S.K.phase === 'over') { S.over = true; S.winner = S.K.winner; }
}

/** The meter: up and back over the register's seconds while the press is held (the lab's hold-and-release). */
function meterAt(ctx, t) {
  const P = ctx.sport.swing.charge * ctx.body.charge, u = (t / P) % 2;
  return { meter: tr3(u <= 1 ? u : 2 - u), rising: u <= 1 };
}

/**
 * A shot tried on a copy (the mind's read, never a guess): the strike at `power` with the aim given, flown to its
 * rest; where it rested, its lie, how far along the line to the target it went, and where it crossed `yLine` if asked.
 */
export function probeShot(S, ctx, { power, aim, yLine = null } = {}) {
  const copy = cloneTurns(S);
  copy.aim = { x: aim ? aim[0] : S.aim.x, y: aim ? aim[1] : S.aim.y };
  const b = ballBodyOf(copy), from = [b.position[0], b.position[1]], t = targetOf(ctx, copy);
  const dir = [t[0] - from[0], t[1] - from[1]], n = Math.hypot(dir[0], dir[1]) || 1;
  strike(copy, ctx, copy.K.turn, power);
  let cross = null, prevY = b.position[1];
  for (let i = 0; i < SETTLE + PINS_SETTLE + 2 && copy.shot; i++) {
    fly(copy, ctx);
    if (yLine !== null && cross === null && (prevY - yLine) * (b.position[1] - yLine) <= 0 && b.position[1] !== prevY) cross = [b.position[0], b.position[1]];
    prevY = b.position[1];
  }
  const last = copy.calls[copy.calls.length - 1], at = last && last.at ? last.at : [b.position[0], b.position[1]];
  const along = ((at[0] - from[0]) * dir[0] + (at[1] - from[1]) * dir[1]) / n;
  return { at, lie: last && last.kind === 'lie' ? last.region : last ? last.kind : null, along: tr3(along), holed: !!(last && last.kind === 'holed'), penalty: !!(last && last.kind === 'penalty'), standing: last && last.standing !== undefined ? last.standing : null, cross };
}

/** One frame. */
export function stepTurns(S, pad, ctx) {
  S.f += 1;
  if (S.over) { if (S.dead > 0) S.dead -= 1; return S; }
  if (S.dead > 0) { S.dead -= 1; if (S.dead === 0) place(S, ctx); return S; }
  if (S.shot) { fly(S, ctx); return S; }
  if (S.K.phase !== 'turn') return S;
  const who = S.K.turn;
  const P = S.K.seat < ctx.players ? pad || { x: 0, y: 0, b: 0 } : turnMind(S.minds[who], S, ctx, probeShot);
  const px = tclamp(P.x || 0, -1, 1), py = tclamp(P.y || 0, -1, 1);
  S.aim.x = tr3(tclamp(S.aim.x + px * AIM_RATE * TDT, -1, 1)); S.aim.y = tr3(py);
  const pressed = !!(P.b & TPAD.SWING);
  if (pressed) { S.charge.held = true; S.charge.t = tr3(S.charge.t + TDT); Object.assign(S.charge, meterAt(ctx, S.charge.t)); }
  else if (S.charge.held) { const power = Math.max(0.05, S.charge.meter); S.charge = { held: false, t: 0, meter: 0, rising: true }; strike(S, ctx, who, power); }
  return S;
}

/** The card and the shot's state, for a page or a probe. */
export function turnsDisplay(S, ctx) {
  const d = contestDisplay(ctx.C, S.K), b = ballBodyOf(S);
  return { ...d, hole: S.hole, club: S.K.phase === 'turn' && !S.shot ? clubOf(ctx, S) : null, aim: { ...S.aim }, meter: S.charge.meter, charging: S.charge.held, ball: [tr3(b.position[0]), tr3(b.position[1]), tr3(b.position[2])], inPlay: !!S.shot, last: S.last, over: S.over, winner: S.winner, pins: S.pins ? S.pins.map((p) => p.up) : null };
}

export const cloneTurns = (S) => JSON.parse(JSON.stringify(S));
