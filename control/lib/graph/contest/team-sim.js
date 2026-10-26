/**
 * THE TEAM SIM — a team goal game (soccer, hockey) as a pure function of two pads at 60 Hz, in the match sim's shape:
 * the join of the contest kernel (the referee: the clock, the goals, the outs and their restarts, offside against the
 * ball, the fouls), the ball card (the ball or the puck as the physics property's sphere), the hit (the kick as the
 * leg's strike) and the positional mind (every player not at a pad: a role's home, the press on the ball, the computer
 * side's play). No clock, no Math.random, no DOM: the same context and pads are the same match to the byte.
 *
 *   stepTeam(S, pads, ctx) → S       one frame; pads[i] = { x, y, b } in the COURT frame (x across, y along; one screen,
 *                                    one camera behind side a's goal, so both pads read the screen's directions), for
 *                                    the sides players hold (i < players: a first, then b); the rest the mind's
 *   newTeam(ctx) → S                 ctx = teamContext(data) (team-arena.js teamArenaData)
 *   teamDisplay(S, ctx)              the scoreboard: the kernel's score and clock, the active players, the last call
 *   teamKick(S, ctx, P, facing, power) the release of a press: a kick, a throw, a conversion (what the pad and the mind do)
 *   TEAM_BODY                        the body on each register: its speed and build-up (the match sim's, the motion
 *                                    flavors'); the kick's tip, reach and charge are the sport's
 *
 * THE PAD drives the side's ACTIVE player, the one nearest the ball (it switches as the ball moves, with a step of
 * hysteresis); the stick moves it, a press charges a kick and the release strikes the ball if it is in reach: a tap a
 * pass along the ground, a hold a shot, aimed by the stick (or ahead). A player running at a slow ball CARRIES it (the
 * dribble: the ball ahead of the feet at the body's pace, a touch the kernel hears once). The other players hold their
 * role's home, the nearest to the ball presses it; the computer side's active player chases, passes to a teammate
 * ahead and shoots in range (contest-mind.js teamMind). The ball crossing a goal line between the posts under the bar
 * is the kernel's score; over any other line, its out (a throw-in, a corner, a goal kick, where the kernel says); two
 * opponents colliding at speed, a foul on the faster; the clock ticks while live. A restart places the ball where the
 * kernel says and the restart side's nearest player behind it; the first touch resumes play (after three seconds the
 * sim takes it for them, so play never stalls).
 *
 * A HOOP and HANDS (the arcade rules' goal family: basketball), each absent on soccer and hockey: the goal a ring with
 * its backboard over each end (a ring of the physics' spheres and a slab, so a shot rattles out or in by the physics),
 * a basket the ball dropping through the ring, worth `goal.three`'s three from beyond the arc, else two (the kernel's
 * score fact carrying its points). The ball is caught and held, not kicked: the holder dribbles it at its side, a tap
 * passes it to the teammate most along the stick, a hold shoots it at the ring on the shot's arc, the charge's
 * distance from the sweet spot (and the range) its miss; an opponent at the ball long enough takes it (a steal).
 *
 * A CARRY game (the arcade rules' carry family: rugby, American football; the kernel's `carry`): the hands, carried at
 * the chest, and plays. Each play the side with the ball stands in its formation round it (the sport's homes, the
 * ball's own side behind it, the other side its `gap` beyond), its first role takes the ball and play is live; an
 * opponent at the carrier a moment brings it down (the kernel's tackle, which ends the play); the carrier over the
 * other side's line scores (the kernel's try), and the conversion is kicked at the posts from in front, through them
 * over the bar or not; a pass tells the kernel where it was thrown from and to (a forward pass is the kernel's to
 * judge), a ball on the ground nobody holds is dropped (the kernel's incomplete). The role players run the carry
 * mind's lines (support, routes, a defensive line, a man, the pursuit).
 */
import { contestStart, contestApply, contestDisplay, contestRegion } from './contest-kernel.js';
import { buildSim } from '../worlds/physics-sim.js';
import { ballBody, ballForces, ballGravity } from './ball-card.js';
import { hitBall } from './hit.js';
import { newTeamMind, teamMind, fieldTarget, carryTarget } from './contest-mind.js';

export const TEAM_BODY = Object.freeze({
  realistic: Object.freeze({ speed: 5.25, tau: 1.0 }),
  action: Object.freeze({ speed: 6.75, tau: 0.45 }),
  platformer: Object.freeze({ speed: 4.5, tau: 0.08 }),
  pinball: Object.freeze({ speed: 15, tau: 1.4 }),
});
export const TEAM_REGISTER_IDS = Object.freeze(Object.keys(TEAM_BODY));
export const GPAD = Object.freeze({ KICK: 1, START: 4 });
export const TEAM_FPS = 60;
const GDT = 1 / TEAM_FPS;
export const TEAM_DEAD = Object.freeze({ restart: 45, goal: 120, period: 150, over: 180 });   // frames before the restart is placed
const AUTO_RESUME = TEAM_FPS * 3;   // frames a restart waits before the sim takes it
const SWITCH = 1.0;                 // metres nearer another teammate must be to take the pad
const FOUL_SPEED = 4.5, FOUL_REACH = 0.6, FOUL_COOL = 120, FOUL_GRACE = 45;   // a charge into the carrier at speed; none in the frames after a restart
const SAVE_COOL = 30;
// the hands (basketball's): a steal is an opponent this near the held ball for so many frames; a thrower cannot catch
// its own throw for a moment; a shot leaves on this arc, its sweet spot this share of the charge, its miss by register
const STEAL_REACH = 0.6, STEAL_FRAMES = 60, RECATCH = 12, FREE_FLIGHT = 10, SHOT_ARC = 60, SWEET = 0.85, RELEASE = 2.1, CATCH_UP = 2.6;
const MISS = Object.freeze({ realistic: 1, action: 0.6, platformer: 0.5, pinball: 0.8 });
const PASS_SPEED = 9, PASS_CATCH = 1.8;   // m/s along the floor; the reach the pass's receiver catches it in
// a carry game: an opponent this near the carrier for so many frames tackles it; the ball at the chest; the conversion's arc
const TACKLE_REACH = 1, TACKLE_FRAMES = 3, CARRY_PACE = 0.88, CHEST = 1.1, KICK_ARC = 35, KICK_WAIT = TEAM_FPS * 4;
const MARGIN = 1.5;                 // metres past the lines a player may stand
const gr3 = (v) => Math.round(v * 1000) / 1000;
const RIM_BEADS = 14;
const gclamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const _gsim = buildSim();

/** The sim's context from the arena's data. */
export function teamContext(data) {
  if (!data || !data.C || !data.sport || !data.court) throw new Error('team: a context is { C, sport, court, register?, players?, level?, seed? }');
  const register = data.register ?? 'realistic';
  if (!TEAM_BODY[register]) throw new Error(`team: register '${register}' is one of ${TEAM_REGISTER_IDS.join(', ')}`);
  return { C: data.C, sport: data.sport, ball: data.sport.ball, court: data.court, register, players: data.players ?? 0, level: data.level ?? 'regular', seed: data.seed ?? 1, body: TEAM_BODY[register] };
}

const signOf = (side) => (side === 'a' ? 1 : -1);
const sideOfId = (id) => id[0];
const ballBodyOf = (S) => S.sim.bodies[0];
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function newTeam(ctx) {
  const K = contestStart(ctx.C, ctx.seed), c = ctx.court, r = ballBody(ctx.ball, ctx.register).radius;
  const bodies = [
    ballBody(ctx.ball, ctx.register, { id: 'ball', position: [0, 0, r] }),
    { id: 'floor', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0, restitution: ctx.sport.ground.bounce ?? 0.5, friction: 0.8 },
  ];
  const hoop = ctx.sport.goal.hoop;
  if (hoop) for (const e of [-1, 1]) {
    // each end's ring, a circle of small spheres the ball rattles on, and its backboard behind it
    const cy = e * (c.halfL - hoop.out);
    for (let k = 0; k < RIM_BEADS; k++) { const a = (2 * Math.PI * k) / RIM_BEADS; bodies.push({ id: `rim-${e > 0 ? 'b' : 'a'}${k}`, collider: 'sphere', radius: 0.012, mass: 0, position: [gr3(hoop.radius * Math.cos(a)), gr3(cy + hoop.radius * Math.sin(a)), hoop.height], restitution: 0.6, friction: 0.3 }); }
    const by = e * (c.halfL - hoop.out + hoop.radius + 0.15 + 0.03);
    bodies.push({ id: `board-${e > 0 ? 'b' : 'a'}`, collider: 'aabb', position: [0, gr3(by), gr3(hoop.height - 0.15 + hoop.board[1] / 2)], half: [hoop.board[0] / 2, 0.03, hoop.board[1] / 2], mass: 0, restitution: 0.55, friction: 0.3 });
  }
  if (ctx.sport.ground.boards) {   // the rink's boards: four walls just past the lines, the goal mouths in the end walls' line
    const t = 0.15, h = 1.2;
    bodies.push({ id: 'board-left', collider: 'aabb', position: [-(c.halfW + t), 0, h / 2], half: [t, c.halfL + 2 * t, h / 2], mass: 0, restitution: 0.6, friction: 0.2 });
    bodies.push({ id: 'board-right', collider: 'aabb', position: [c.halfW + t, 0, h / 2], half: [t, c.halfL + 2 * t, h / 2], mass: 0, restitution: 0.6, friction: 0.2 });
    bodies.push({ id: 'board-near', collider: 'aabb', position: [0, -(c.halfL + t), h / 2], half: [c.halfW + 2 * t, t, h / 2], mass: 0, restitution: 0.6, friction: 0.2 });
    bodies.push({ id: 'board-far', collider: 'aabb', position: [0, c.halfL + t, h / 2], half: [c.halfW + 2 * t, t, h / 2], mass: 0, restitution: 0.6, friction: 0.2 });
  }
  const sim = _gsim.createState({ gravity: ballGravity(ctx.register), seed: ctx.seed, bodies, forces: ballForces(ctx.ball, ctx.register, { id: 'ball' }) });
  const roles = Object.keys(ctx.C.roles);
  const p = [];
  for (const side of ['a', 'b']) roles.forEach((role, i) => { const h = ctx.sport.homes[role]; p.push({ id: `${side}${i + 1}`, side, role, home: [h[0], side === 'a' ? h[1] : -h[1]], x: 0, y: 0, vx: 0, vy: 0, facing: Math.PI / 2 * signOf(side), held: 0, charge: 0, cool: 0, dribbled: -99, kicks: 0 }); });
  const S = {
    f: 0, K, phase: K.phase, calls: [], over: false, winner: null, dead: 0, last: null, sim, p,
    active: { a: null, b: null }, wait: 0, placedAt: -1, liveAt: 0, passPos: {}, minds: {},
    ...(ctx.sport.hands ? { hold: null, shot: null, steal: null, thrownBy: null, thrownAt: -99, passTo: null, pz: 0 } : {}),
  };
  for (const side of ['a', 'b']) if ((side === 'a' ? 0 : 1) >= ctx.players) S.minds[side] = newTeamMind(ctx.level, ctx.seed * 17 + (side === 'a' ? 1 : 2));
  place(S, ctx);
  return S;
}

function stopBall(b, at) { b.position = [at[0], at[1], b.radius]; b.velocity = [0, 0, 0]; b.angularVelocity = [0, 0, 0]; b.resting = true; }

/** The restart placed: the ball where the kernel says, every player home, the taker a step behind the ball. */
function place(S, ctx) {
  const R = S.K.restart, b = ballBodyOf(S), c = ctx.court;
  S.placedAt = S.K.n; S.wait = 0;
  for (const P of S.p) { P.x = P.home[0]; P.y = P.home[1]; P.vx = 0; P.vy = 0; P.charge = 0; P.held = 0; }
  if (ctx.sport.hands) { S.hold = null; S.shot = null; S.steal = null; }
  if (ctx.sport.carry) return placeCarry(S, ctx);
  if (!R) return;
  let at = R.at ? [gclamp(R.at[0], -c.halfW + 0.3, c.halfW - 0.3), gclamp(R.at[1], -c.halfL + 0.3, c.halfL - 0.3)] : [0, 0];
  if (R.kind === 'kickoff') at = [0, 0];
  stopBall(b, at);
  // the taker: the restart side's player nearest the ball, a step behind it (toward its own goal); the others a way off
  const s = signOf(R.side), mine = S.p.filter((P) => P.side === R.side);
  const taker = mine.reduce((best, P) => (best === null || dist2([P.x, P.y], at) < dist2([best.x, best.y], at) ? P : best), null);
  if (taker) { taker.x = gr3(at[0]); taker.y = gr3(at[1] - s * 0.9); }
  for (const P of S.p) if (P !== taker && dist2([P.x, P.y], at) < 3) { const d = [P.x - at[0], P.y - at[1]], n = Math.hypot(d[0], d[1]) || 1; P.x = gr3(at[0] + (d[0] / n) * 3); P.y = gr3(at[1] + (d[1] / n) * 3); }
  S.active[R.side] = taker ? taker.id : null;
}

/**
 * A carry game's restart: a play (the side with the ball in its formation behind it, its first role holding it, the
 * other side its line `gap` beyond; play is live at once) or the conversion (the kicker at the spot facing the posts,
 * the rest aside).
 */
function placeCarry(S, ctx) {
  const R = S.K.restart, b = ballBodyOf(S), c = ctx.court, roles = Object.keys(ctx.C.roles);
  S.tackle = null; S.convert = null;
  if (!R) return;
  const s = signOf(R.side), at = [gclamp(R.at[0], -c.halfW + 1, c.halfW - 1), R.at[1]];
  for (const P of S.p) { P.facing = Math.PI / 2 * signOf(P.side); P.charge = 0; P.held = 0; }
  if (R.kind === 'conversion') {
    const kicker = S.p.find((P) => P.side === R.side && P.role === roles[0]);
    S.p.forEach((P, i) => { if (P !== kicker) { P.x = gr3(gclamp((i % 2 ? 1 : -1) * (6 + i), -c.halfW + 0.5, c.halfW - 0.5)); P.y = gr3(at[1] - s * 4); } });
    Object.assign(kicker, { x: gr3(at[0]), y: gr3(at[1] - s * 1.2) });
    stopBall(b, at);
    S.convert = { side: R.side, at: S.f, kicked: false, py: b.position[1] };
    S.active[R.side] = kicker.id;
    return;
  }
  const gap = ctx.sport.carry.gap;
  for (const P of S.p) {
    const h = ctx.sport.homes[P.role];
    if (P.side === R.side) { P.x = gr3(gclamp(at[0] + h[0], -c.halfW + 0.5, c.halfW - 0.5)); P.y = gr3(gclamp(at[1] + s * h[1], -c.halfL, c.halfL)); }
    else { P.x = gr3(gclamp(at[0] + h[0] * 0.9, -c.halfW + 0.5, c.halfW - 0.5)); P.y = gr3(gclamp(at[1] + s * (gap + 1 + Math.abs(h[1]) * 0.6), -c.halfL, c.halfL)); }
  }
  const taker = S.p.find((P) => P.side === R.side && P.role === roles[0]);
  Object.assign(taker, { x: gr3(at[0]), y: gr3(at[1] - s * 0.3) });
  b.position = [gr3(at[0]), gr3(at[1]), CHEST]; b.velocity = [0, 0, 0]; b.angularVelocity = [0, 0, 0]; b.resting = false;
  S.active[R.side] = taker.id; S.playAt = S.f;
  if (touch(S, ctx, taker, at)) S.hold = taker.id;
}

/** The conversion kick: at the posts on the kick's arc, through them at a hand over the bar for a clean strike; the
 * charge off its sweet spot, the register and the angle its miss (wide more than short). */
function kickConversion(S, ctx, P, power) {
  if (!S.convert || S.convert.kicked || S.convert.side !== P.side) return false;
  const b = ballBodyOf(S), Po = ctx.sport.goal.posts, s = signOf(P.side), R = [0, s * Po.y, Po.bar + 2], th = (KICK_ARC * Math.PI) / 180;
  const from = [b.position[0], b.position[1], b.radius], D = Math.hypot(R[0] - from[0], R[1] - from[1]);
  const miss = (0.004 + Math.abs(power - SWEET) * 0.6) * (0.5 + D / 25) * MISS[ctx.register] * (power < SWEET ? -1 : 1);
  const az0 = Math.atan2(R[1] - from[1], R[0] - from[0]), speed = shotSpeed(S, from, az0, th, R, D + 6) * (1 + miss * 0.5), az = az0 + miss * 3;
  b.position = from; b.velocity = [gr3(speed * Math.cos(th) * Math.cos(az)), gr3(speed * Math.cos(th) * Math.sin(az)), gr3(speed * Math.sin(th))]; b.resting = false;
  S.convert.kicked = true; S.convert.at = S.f; S.convert.py = from[1];
  P.kicks += 1;
  S.calls.push({ kind: 'kick', who: P.id, speed: gr3(speed), power: gr3(power), conversion: true, f: S.f });
  return true;
}

/** The conversion in the air: through the posts' plane between the uprights over the bar is good; short, wide or
 * landed first is not. */
function convertStep(S, ctx) {
  const C2 = S.convert, b = ballBodyOf(S), Po = ctx.sport.goal.posts, y = signOf(C2.side) * Po.y;
  if (!C2.kicked) return;
  const crossed = (C2.py - y) * (b.position[1] - y) <= 0 && C2.py !== b.position[1];
  if (crossed || b.position[2] <= b.radius + 0.02 && S.f - C2.at > 10 || S.f - C2.at > KICK_WAIT) {
    const good = crossed && Math.abs(b.position[0]) < Po.width / 2 && b.position[2] > Po.bar;
    S.convert = null;
    fact(S, ctx, { kind: 'convert', side: C2.side, good });
    return;
  }
  C2.py = b.position[1];
}

function fact(S, ctx, f) {
  const out = contestApply(ctx.C, S.K, f), was = S.K.phase;
  S.K = out.S; S.phase = out.S.phase;
  // (a carry game's play over: the tackle, the drop, the turnover, the conversion; a pause before the next is placed)
  if (ctx.sport.carry && !S.over && ((was === 'live' && S.K.phase === 'dead') || f.kind === 'convert')) S.dead = Math.max(S.dead, TEAM_DEAD.restart);
  for (const c of out.calls) {
    S.calls.push({ ...c, f: S.f }); S.last = c;
    if (c.kind === 'live') S.liveAt = S.f;
    if (c.kind === 'over') { S.over = true; S.winner = c.winner; S.dead = TEAM_DEAD.over; }
    else if (c.kind === 'score') S.dead = TEAM_DEAD.goal;
    else if (c.kind === 'period' || c.kind === 'overtime') S.dead = Math.max(S.dead, TEAM_DEAD.period);
    else if (c.kind === 'out' || c.kind === 'foul') S.dead = Math.max(S.dead, c.cost === 'warn' ? 0 : TEAM_DEAD.restart);
  }
  return out.calls;
}

/** A touch the kernel hears: where the toucher stood at its side's last touch rides it (the offside read). */
function touch(S, ctx, P, at) {
  const atPass = S.passPos[P.id];
  if (S.K.phase === 'dead' || S.K.phase === 'between') { if (S.K.restart && S.K.restart.side === P.side) fact(S, ctx, { kind: 'resume' }); else return false; }
  fact(S, ctx, { kind: 'touch', who: P.id, at: [gr3(at[0]), gr3(at[1])], ...(atPass ? { atPass } : {}) });
  for (const Q of S.p) if (Q.side === P.side) S.passPos[Q.id] = [gr3(Q.x), gr3(Q.y)];
  return true;
}

/** The kick: the leg's strike on a ball in reach, aimed along `facing`, at the share `power` of the tip (a pass stays low);
 * the hands' throw, a carry game's conversion kick (exported as teamKick: the pad's release, the mind's want). */
export function teamKick(S, ctx, P, facing, power) { return kick(S, ctx, P, facing, power); }
function kick(S, ctx, P, facing, power) {
  if (ctx.sport.carry && S.convert) return kickConversion(S, ctx, P, power);
  if (ctx.sport.hands) return throwBall(S, ctx, P, facing, power);
  const b = ballBodyOf(S), K = ctx.sport.kick;
  if (dist2([P.x, P.y], b.position) > K.reach || b.position[2] > 0.6) return false;
  if (!touch(S, ctx, P, b.position)) return false;
  // a shot leaves a few degrees up (under the bar from the edge of the box), a pass along the ground
  const H = hitBall({ ball: b, who: P.id, at: [b.position[0], b.position[1]], verb: K.verb, register: ctx.register, facing, stick: [0, power > 0.7 ? -0.55 : -0.75], tipSpeed: gr3(K.tipSpeed * power), hits: 0 });
  b.velocity = H.velocity.slice(); b.angularVelocity = H.angularVelocity.slice(); b.resting = false;
  P.kicks += 1; P.facing = facing;
  // goalward: struck in the attacking half along a line that meets the attacking goal line within a goal's width of the
  // posts (an attempt on goal, on target or not: the stats' shot, contest-stats.js)
  const s = signOf(P.side), dy = Math.sin(facing) * s, gy = s * ctx.court.halfL;
  const cross = dy > 0.05 && b.position[1] * s > 0 ? b.position[0] + Math.cos(facing) * ((gy - b.position[1]) / Math.sin(facing)) : null;
  const goalward = cross !== null && Math.abs(cross) < ctx.sport.goal.width * 1.5;
  S.calls.push({ kind: 'kick', who: P.id, speed: H.speed, power: gr3(power), ...(goalward ? { goalward: true } : {}), f: S.f });
  return true;
}

/** The attacking ring of a side (a attacks +y): its centre. */
const ringOf = (ctx, side) => [0, signOf(side) * (ctx.court.halfL - ctx.sport.goal.hoop.out), ctx.sport.goal.hoop.height];

/**
 * The hands' throw, by the ball's holder: a hold (`power` over 0.7) shoots at the ring on the shot's arc, short or long
 * by the charge's distance from its sweet spot and the range (the register's share of it); a tap passes to the teammate
 * most along `facing`, at chest height, flat.  → true when thrown
 */
export function throwBall(S, ctx, P, facing, power) {
  if (S.hold !== P.id) return false;
  const b = ballBodyOf(S), g = -S.sim.gravity[2], from = [gr3(P.x + Math.cos(facing) * 0.3), gr3(P.y + Math.sin(facing) * 0.3), RELEASE];
  let v, shot = null;
  if (power > 0.7 && !ctx.sport.carry) {
    const R = ringOf(ctx, P.side), D = Math.max(0.5, Math.hypot(R[0] - from[0], R[1] - from[1])), th = (SHOT_ARC * Math.PI) / 180;
    // the miss: the charge off its sweet spot, the range, the register, and a defender's hand in the shooter's face
    const guard = S.p.filter((Q) => Q.side !== P.side).reduce((m, Q) => Math.min(m, Math.hypot(Q.x - P.x, Q.y - P.y)), Infinity);
    const miss = (0.003 + Math.abs(power - SWEET) * 0.3) * (0.5 + D / 8) * MISS[ctx.register] * (1 + Math.max(0, 1.5 - guard) * 1.5) * (power < SWEET ? -1 : 1);
    const az0 = Math.atan2(R[1] - from[1], R[0] - from[0]), speed = shotSpeed(S, from, az0, th, R, D) * (1 + miss);
    const az = az0 + miss * 0.25;
    v = [gr3(speed * Math.cos(th) * Math.cos(az)), gr3(speed * Math.cos(th) * Math.sin(az)), gr3(speed * Math.sin(th))];
    shot = { side: P.side, points: Math.hypot(R[0] - P.x, R[1] - P.y) > ctx.sport.goal.three ? 3 : 2, f: S.f };
  } else {
    const mates = S.p.filter((Q) => Q.side === P.side && Q !== P);
    const along = (Q) => { const d = [Q.x - P.x, Q.y - P.y], n = Math.hypot(d[0], d[1]) || 1; return (d[0] * Math.cos(facing) + d[1] * Math.sin(facing)) / n; };
    const mate = mates.filter((Q) => along(Q) > 0.4).reduce((m, Q) => (m === null || along(Q) > along(m) ? Q : m), null);
    // (a carry game's hold throws longer, the forward pass downfield) led by the pass's own flight: where the teammate
    // will be when it arrives
    const speed = ctx.sport.carry ? PASS_SPEED * (0.8 + power) : PASS_SPEED;
    const lead = mate ? Math.hypot(mate.x - from[0], mate.y - from[1]) / speed : 0;
    const to = mate ? [mate.x + mate.vx * lead, mate.y + mate.vy * lead] : [P.x + Math.cos(facing) * 8, P.y + Math.sin(facing) * 8];
    const D = Math.max(1, Math.hypot(to[0] - from[0], to[1] - from[1])), t = D / speed;
    v = [gr3(((to[0] - from[0]) / D) * speed), gr3(((to[1] - from[1]) / D) * speed), gr3((1.3 - from[2] + 0.5 * g * t * t) / t)];
    S.passTo = mate ? mate.id : null;
    // the kernel hears the pass, where from and where to: a forward pass is its to judge
    if (ctx.sport.carry) { fact(S, ctx, { kind: 'pass', who: P.id, from: [gr3(P.x), gr3(P.y)], to: [gr3(to[0]), gr3(to[1])] }); if (S.K.phase !== 'live') { S.hold = null; return true; } }
  }
  b.position = from; b.velocity = v; b.angularVelocity = [0, 0, 0]; b.resting = false;
  S.hold = null; S.steal = null; S.thrownBy = P.id; S.thrownAt = S.f; S.shot = shot;
  P.kicks += 1; P.facing = facing;
  S.calls.push({ kind: 'kick', who: P.id, speed: gr3(Math.hypot(v[0], v[1], v[2])), power: gr3(power), ...(shot ? { goalward: true, points: shot.points } : {}), f: S.f });
  return true;
}

/**
 * The speed that drops a shot on the arc `th` through the ring's centre: bisected on the ball alone flown in the sim's
 * own physics (its step, its gravity, its air), so the integrator and the air are counted, not guessed.
 */
function shotSpeed(S, from, az, th, R, D) {
  const ball = ballBodyOf(S);
  const reach = (v) => {
    const st = _gsim.createState({ gravity: S.sim.gravity, bodies: [{ ...ball, position: from.slice(), velocity: [v * Math.cos(th) * Math.cos(az), v * Math.cos(th) * Math.sin(az), v * Math.sin(th)], angularVelocity: [0, 0, 0], resting: false }], forces: S.sim.forces });
    const b = st.bodies[0];
    for (let i = 0; i < 240; i++) {
      const pz = b.position[2], px = b.position[0], py = b.position[1];
      _gsim.step(st, GDT);
      if (pz > R[2] && b.position[2] <= R[2]) { const f = (pz - R[2]) / (pz - b.position[2]); return Math.hypot(px + (b.position[0] - px) * f - from[0], py + (b.position[1] - py) * f - from[1]); }
      if (b.velocity[2] < 0 && b.position[2] < R[2]) return 0;   // never up to the ring: short
    }
    return 0;
  };
  let lo = 2, hi = 25;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (reach(mid) < D) lo = mid; else hi = mid; }
  return gr3((lo + hi) / 2);
}

/**
 * The hands after the ball has flown its frame: the held ball at its holder's side, dribbled; a steal by an opponent
 * at it long enough; a free ball caught by the nearest player in reach (the restart side's while a restart waits);
 * the basket, the ball dropping through a ring.
 */
function handsStep(S, ctx) {
  const b = ballBodyOf(S), K = ctx.sport.kick, hoop = ctx.sport.goal.hoop;
  if (ctx.sport.carry && S.hold) {
    // the carrier: the ball at its chest; over the other side's line a try; an opponent at it a moment a tackle
    const P = S.p.find((Q) => Q.id === S.hold), s = signOf(P.side);
    b.position = [gr3(P.x + Math.cos(P.facing) * 0.3), gr3(P.y + Math.sin(P.facing) * 0.3), CHEST]; b.velocity = [gr3(P.vx), gr3(P.vy), 0]; b.angularVelocity = [0, 0, 0]; b.resting = false;
    if (S.K.phase !== 'live') return;
    if (P.y * s >= ctx.sport.carry.line) { S.hold = null; fact(S, ctx, { kind: 'try', who: P.id, at: [gr3(P.x), gr3(P.y)] }); return; }
    const near = S.p.filter((Q) => Q.side !== P.side && Math.hypot(Q.x - P.x, Q.y - P.y) <= TACKLE_REACH);
    if (near.length) {
      S.tackle = S.tackle && S.tackle.who === near[0].id ? { who: near[0].id, n: S.tackle.n + 1 } : { who: near[0].id, n: 1 };
      if (S.tackle.n >= TACKLE_FRAMES) { S.hold = null; S.calls.push({ kind: 'tackle-by', who: S.tackle.who, of: P.id, f: S.f }); S.tackle = null; fact(S, ctx, { kind: 'tackle', who: P.id, at: [gr3(P.x), gr3(P.y)] }); }
    } else S.tackle = null;
    return;
  }
  if (ctx.sport.carry && !S.hold && S.K.phase === 'live' && b.position[2] <= b.radius + 0.03 && S.f - S.thrownAt > 3) {
    fact(S, ctx, { kind: 'incomplete', at: [gr3(b.position[0]), gr3(b.position[1])] });   // the ball down, nobody holding it
    return;
  }
  if (S.hold) {
    const P = S.p.find((Q) => Q.id === S.hold);
    const near = S.p.filter((Q) => Q.side !== P.side && Math.hypot(Q.x - b.position[0], Q.y - b.position[1]) <= STEAL_REACH);
    if (near.length && S.K.phase === 'live') {
      const thief = near[0];
      S.steal = S.steal && S.steal.who === thief.id ? { who: thief.id, n: S.steal.n + 1 } : { who: thief.id, n: 1 };
      if (S.steal.n >= STEAL_FRAMES && touch(S, ctx, thief, b.position)) { S.hold = thief.id; S.steal = null; S.calls.push({ kind: 'steal', who: thief.id, from: P.id, f: S.f }); return handsStep(S, ctx); }
    } else S.steal = null;
    const bounce = 0.35 + 0.6 * Math.abs(Math.sin(S.f * 0.18)), c = ctx.court, r = b.radius;
    // (the dribble kept inside the lines: the arcade's holder never carries the ball out)
    b.position = [gr3(gclamp(P.x + Math.cos(P.facing) * 0.45, -c.halfW + r, c.halfW - r)), gr3(gclamp(P.y + Math.sin(P.facing) * 0.45, -c.halfL + r, c.halfL - r)), gr3(bounce)];
    b.velocity = [gr3(P.vx), gr3(P.vy), 0]; b.angularVelocity = [0, 0, 0]; b.resting = false;
    S.pz = b.position[2];
    return;
  }
  // the basket: down through a ring from above it, inside its rim
  if (hoop && S.K.phase === 'live') for (const side of ['a', 'b']) {
    const R = ringOf(ctx, side);
    if (S.pz > R[2] && b.position[2] <= R[2] && Math.hypot(b.position[0] - R[0], b.position[1] - R[1]) < hoop.radius - b.radius * 0.3) {
      const points = S.shot && S.shot.side === side ? S.shot.points : 2;
      S.calls.push({ kind: 'goal', side, points, f: S.f });
      S.shot = null;
      fact(S, ctx, { kind: 'score', side, points });
      S.pz = b.position[2];
      return;
    }
  }
  S.pz = b.position[2];
  // a ball just thrown flies free (no block, no tip at the release), and a shot is caught only on its way down
  if (b.position[2] > CATCH_UP || S.f - S.thrownAt < FREE_FLIGHT || (S.shot && b.velocity[2] > 0)) return;
  const restarting = S.K.phase === 'dead' || S.K.phase === 'between';
  // (a carry game's interception: a hand nearer than a catch, and at its own height)
  const pick = (P) => ctx.sport.carry && S.thrownBy && S.thrownBy[0] !== P.side && P.id !== S.passTo;
  const can = S.p.filter((P) => !(P.id === S.thrownBy && S.f - S.thrownAt < RECATCH) && (!restarting || (S.K.restart && S.K.restart.side === P.side)) && !(pick(P) && b.position[2] > 2) && Math.hypot(P.x - b.position[0], P.y - b.position[1]) <= (P.id === S.passTo ? PASS_CATCH : pick(P) ? K.reach * 0.6 : K.reach));
  if (!can.length) return;
  const P = can.reduce((m, Q) => (Math.hypot(Q.x - b.position[0], Q.y - b.position[1]) < Math.hypot(m.x - b.position[0], m.y - b.position[1]) ? Q : m));
  if (touch(S, ctx, P, b.position)) { S.hold = P.id; S.steal = null; S.passTo = null; }
}

function move(S, ctx, P, stick) {
  // (a carry game's carrier runs a step slower with the ball in its arms than the ones chasing it)
  const c = ctx.court, B = ctx.body, k = 1 - Math.exp(-GDT / B.tau), pace = ctx.sport.carry && S.hold === P.id ? B.speed * CARRY_PACE : B.speed;
  P.vx += (stick[0] * pace - P.vx) * k; P.vy += (stick[1] * pace - P.vy) * k;
  // (the hands' holder stays inside the lines)
  const m = ctx.sport.hands && S.hold === P.id ? -0.3 : MARGIN;
  P.x = gr3(gclamp(P.x + P.vx * GDT, -(c.halfW + m), c.halfW + m));
  P.y = gr3(gclamp(P.y + P.vy * GDT, -(c.halfL + m), c.halfL + m));
  if (Math.hypot(P.vx, P.vy) > 0.5) P.facing = Math.atan2(P.vy, P.vx);
}

/** The stick toward a point, eased in over the last metre. */
const toward = (P, t, pace = 1) => { const d = [t[0] - P.x, t[1] - P.y], n = Math.hypot(d[0], d[1]); if (n < 0.15) return [0, 0]; const k = (Math.min(1, n) * pace) / n; return [d[0] * k, d[1] * k]; };

/** The side's active player: the nearest to the ball, kept until another is a step nearer. */
function pickActive(S, side) {
  const b = ballBodyOf(S), mine = S.p.filter((P) => P.side === side && P.role !== 'keeper');
  let best = null, bestD = Infinity;
  for (const P of mine) { const d = dist2([P.x, P.y], b.position); if (d < bestD) { bestD = d; best = P; } }
  const cur = S.p.find((P) => P.id === S.active[side]);
  if (cur && cur.side === side && dist2([cur.x, cur.y], b.position) <= bestD + SWITCH) return cur;
  return best;
}

/** One frame. */
export function stepTeam(S, pads, ctx) {
  S.f += 1;
  if (S.over) { if (S.dead > 0) S.dead -= 1; return S; }
  if (S.dead > 0) { S.dead -= 1; if (S.dead === 0) place(S, ctx); return S; }
  const b = ballBodyOf(S), c = ctx.court, K = ctx.sport.kick, restarting = S.K.phase === 'dead' || S.K.phase === 'between';
  if (restarting) {
    if (S.placedAt !== S.K.n) place(S, ctx);
    S.wait += 1;
  }
  // the ball's possession, for the press: the nearest player to it
  for (const side of ['a', 'b']) S.active[side] = restarting ? (S.K.restart && S.K.restart.side === side ? (S.active[side] || (pickActive(S, side) || {}).id || null) : null) : (pickActive(S, side) || {}).id || null;
  for (const [i, side] of [['a'], ['b']].map((x, i) => [i, x[0]])) {
    const human = i < ctx.players, pad = human ? (pads && pads[i]) || { x: 0, y: 0, b: 0 } : null;
    const mine = S.p.filter((P) => P.side === side), activeId = S.active[side];
    // the presser: the nearest teammate to the ball that is not at the pad
    const presser = mine.filter((P) => P.id !== activeId && P.role !== 'keeper').reduce((best, P) => (best === null || dist2([P.x, P.y], b.position) < dist2([best.x, best.y], b.position) ? P : best), null);
    for (const P of mine) {
      P.cool = Math.max(0, P.cool - 1);
      let stick = [0, 0], want = null;
      if (P.role === 'keeper' && !(restarting && P.id === activeId)) {
        // the keeper: across its line with the ball, a save on a ball coming at it
        const dir = signOf(side), gw = ctx.sport.goal.width;
        stick = toward(P, [gclamp(b.position[0] * 0.7, -gw / 2 - 1, gw / 2 + 1), P.home[1]], 0.9);
        move(S, ctx, P, stick);
        const coming = b.velocity[1] * dir < -3 && b.position[2] < 2.2 && dist2([P.x, P.y], b.position) <= K.reach * 1.3;
        if (coming && P.cool === 0 && S.K.phase === 'live') {
          P.cool = SAVE_COOL;
          if (touch(S, ctx, P, b.position)) { b.velocity = [gr3(-b.velocity[0] * 0.5 + (P.x > 0 ? 2 : -2)), gr3(-b.velocity[1] * 0.35), gr3(Math.max(0, b.velocity[2]) * 0.3)]; b.resting = false; S.calls.push({ kind: 'save', who: P.id, f: S.f }); }
        }
        continue;
      }
      if (P.id === activeId && (human || S.minds[side])) {
        if (human) {
          const px = gclamp(pad.x || 0, -1, 1), py = gclamp(pad.y || 0, -1, 1);
          stick = [px, py];
          const pressed = !!(pad.b & GPAD.KICK);
          if (pressed) { P.held = 1; P.charge = Math.min(1, P.charge + GDT / K.charge); }
          else if (P.held) {
            P.held = 0;
            const power = Math.max(K.pass, P.charge); P.charge = 0;
            const facing = Math.hypot(px, py) > 0.25 ? Math.atan2(py, px) : P.facing;
            kick(S, ctx, P, facing, power);
          }
        } else {
          const M = teamMind(S.minds[side], S, P.id, ctx);
          stick = [M.x, M.y];
          if (M.kick) want = M.kick;
        }
      } else if (!(restarting && P.id === activeId)) {
        // a role: home, the press when nearest, the mark; inside the kernel's legal regions
        const legal = (ctx.C.roles && P.role === 'keeper' ? [contestRegion(ctx.C, ctx.C.roles.keeper.home, side)] : [contestRegion(ctx.C, 'pitch', side)]);
        // (the hands: the side with the ball takes its roles' spots in the attacking half, the other marks its man)
        let home = P.home, mark = null;
        if (ctx.sport.hands && S.hold) {
          if (S.hold[0] === P.side) home = [P.home[0], -P.home[1]];
          else { const man = S.p.find((Q) => Q.side !== P.side && Q.id.slice(1) === P.id.slice(1)); if (man) mark = [man.x, man.y]; }
        }
        // (a carry game's roles run the carry mind's lines: support, routes, the defensive line, the pursuit)
        const T = ctx.sport.carry ? { to: carryTarget(S, ctx, P) } : fieldTarget({ me: [P.x, P.y], home: { kind: 'circle', circle: [home[0], home[1], 1.5] }, legal, ball: [b.position[0], b.position[1]], ...(mark ? { mark } : {}), press: restarting ? 0 : P === presser ? ctx.sport.press : 0 });
        stick = toward(P, T.to, ctx.sport.carry ? 1 : 0.9);
      }
      move(S, ctx, P, stick);
      if (want) kick(S, ctx, P, want.facing, want.power);
      // the carry: a slow ball at the feet of a moving player stays a half step ahead of them, at their pace
      const v = Math.hypot(P.vx, P.vy), bv = Math.hypot(b.velocity[0], b.velocity[1]);
      if (!ctx.sport.hands && v > 0.6 && b.position[2] < 0.4 && bv < K.dribble + 1 && dist2([P.x, P.y], b.position) <= K.reach * 0.9 && !(restarting && S.K.restart && S.K.restart.side !== side)) {
        if (S.f - P.dribbled > 20 || S.K.ball.lastWho !== P.id) { if (touch(S, ctx, P, b.position)) P.dribbled = S.f; }
        const n = v || 1, pace = Math.min(K.dribble, v);
        b.position = [gr3(P.x + (P.vx / n) * 0.5), gr3(P.y + (P.vy / n) * 0.5), b.position[2]];
        b.velocity = [gr3((P.vx / n) * pace), gr3((P.vy / n) * pace), b.velocity[2]]; b.resting = false;
      }
    }
  }
  // a restart nobody takes: the taker plays it after the wait
  if (restarting && S.wait >= AUTO_RESUME && S.K.restart && !ctx.sport.carry) {
    const taker = S.p.find((P) => P.id === S.active[S.K.restart.side]);
    if (taker) { const s = signOf(taker.side); kick(S, ctx, taker, Math.atan2(s * 1, -Math.sign(b.position[0] || 1) * 0.6), K.pass); }
  }
  // fouls: a charge into the ball's carrier from behind at speed (never in the frames after a restart, while the players spread)
  if (S.K.phase === 'live' && S.f - S.liveAt > FOUL_GRACE && !ctx.sport.carry) {
    const carrier = S.p.find((Q) => Q.id === (ctx.sport.hands ? S.hold : S.K.ball.lastWho) && dist2([Q.x, Q.y], b.position) <= K.reach);
    if (carrier) for (const P of S.p) {
      if (P.side === carrier.side || P.cool > 0 || dist2([P.x, P.y], [carrier.x, carrier.y]) > FOUL_REACH) continue;
      // a charge from behind or the side at speed; a block met head-on is fair
      const rvx = P.vx - carrier.vx, rvy = P.vy - carrier.vy, fromBehind = rvx * Math.cos(carrier.facing) + rvy * Math.sin(carrier.facing) > 0;
      if (fromBehind && Math.hypot(rvx, rvy) > FOUL_SPEED && rvx * (carrier.x - P.x) + rvy * (carrier.y - P.y) > 0) { P.cool = FOUL_COOL; fact(S, ctx, { kind: 'foul', foul: 'contact', who: P.id, at: [gr3(P.x), gr3(P.y)] }); break; }
    }
  }
  // the ball on the ground and in the air
  _gsim.step(S.sim, GDT);
  if (S.sim.contacts.some((k) => (k.a === 'ball' && k.b === 'floor') || (k.b === 'ball' && k.a === 'floor'))) {
    const vh = Math.hypot(b.velocity[0], b.velocity[1]);
    if (vh > 0) { const k = Math.max(0, vh - ctx.sport.ground.roll * GDT) / vh; b.velocity[0] *= k; b.velocity[1] *= k; }
    if (Math.hypot(b.velocity[0], b.velocity[1]) < 0.05 && Math.abs(b.velocity[2]) < 0.1) { b.velocity = [0, 0, 0]; b.angularVelocity = [0, 0, 0]; b.resting = true; }
  }
  if (ctx.sport.hands) handsStep(S, ctx);
  if (ctx.sport.carry && S.convert) convertStep(S, ctx);
  if (S.K.phase === 'live') {
    fact(S, ctx, { kind: 'tick', dt: GDT });
    const x = b.position[0], y = b.position[1], z = b.position[2], r = b.radius, G = ctx.sport.goal;
    if (!G.hoop && Math.abs(y) > c.halfL + r * 0.5 && Math.abs(x) < G.width / 2 && z < G.height) {
      const scorer = y < 0 ? 'b' : 'a';   // the ball in a's goal (y < 0) is b's
      S.calls.push({ kind: 'goal', side: scorer, f: S.f });
      fact(S, ctx, { kind: 'score', side: scorer });
    } else if (!ctx.sport.ground.boards && (Math.abs(x) > c.halfW + r || Math.abs(y) > c.halfL + r)) {
      fact(S, ctx, { kind: 'out', at: [gr3(gclamp(x, -c.halfW, c.halfW)), gr3(gclamp(y, -c.halfL, c.halfL))] });
    } else if (ctx.sport.ground.boards && Math.abs(y) > c.halfL + 0.5) {
      stopBall(b, [gclamp(x, -c.halfW + 1, c.halfW - 1), Math.sign(y) * (c.halfL - 0.5)]);   // a puck squeezed past a board: back on the ice
    }
  }
  return S;
}

/** The scoreboard and the play, for a page or a probe. */
export function teamDisplay(S, ctx) {
  const d = contestDisplay(ctx.C, S.K), b = ballBodyOf(S);
  const clock = d.clock ? { period: d.clock.period, t: gr3(d.clock.t), left: gr3(Math.max(0, (d.clock.overtime ? ctx.C.clock.overtime : ctx.C.clock.seconds) - d.clock.t)), overtime: d.clock.overtime } : null;
  return { ...d, clock, active: { ...S.active }, ball: [gr3(b.position[0]), gr3(b.position[1]), gr3(b.position[2])], players: S.p.map((P) => ({ id: P.id, side: P.side, role: P.role, x: P.x, y: P.y, facing: gr3(P.facing), charge: gr3(P.charge) })), last: S.last, over: S.over, winner: S.winner, restart: S.K.restart };
}

export const cloneTeam = (S) => JSON.parse(JSON.stringify(S));
