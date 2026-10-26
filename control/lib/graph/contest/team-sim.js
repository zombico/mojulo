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
 */
import { contestStart, contestApply, contestDisplay, contestRegion } from './contest-kernel.js';
import { buildSim } from '../worlds/physics-sim.js';
import { ballBody, ballForces, ballGravity } from './ball-card.js';
import { hitBall } from './hit.js';
import { newTeamMind, teamMind, fieldTarget } from './contest-mind.js';

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
const MARGIN = 1.5;                 // metres past the lines a player may stand
const gr3 = (v) => Math.round(v * 1000) / 1000;
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
    { id: 'floor', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0, restitution: 0.5, friction: 0.8 },
  ];
  if (ctx.sport.ground.boards) {   // the rink's boards: four walls just past the lines, the goal mouths open in the end walls
    const t = 0.15, h = 1.2;
    bodies.push({ id: 'board-left', collider: 'aabb', position: [-(c.halfW + t), 0, h / 2], half: [t, c.halfL + 2 * t, h / 2], mass: 0, restitution: 0.6, friction: 0.2 });
    bodies.push({ id: 'board-right', collider: 'aabb', position: [c.halfW + t, 0, h / 2], half: [t, c.halfL + 2 * t, h / 2], mass: 0, restitution: 0.6, friction: 0.2 });
    // each end wall in three: a length either side of the goal's mouth and a lintel over it, so a puck on target goes in
    // and one beside it comes off the boards
    const G = ctx.sport.goal, gw = Math.min(G.width / 2, c.halfW), gh = Math.min(G.height, h), wing = (c.halfW + 2 * t - gw) / 2;
    for (const [end, y] of [['near', -(c.halfL + t)], ['far', c.halfL + t]]) {
      for (const sx of [-1, 1]) bodies.push({ id: `board-${end}-${sx < 0 ? 'l' : 'r'}`, collider: 'aabb', position: [sx * (gw + wing), y, h / 2], half: [wing, t, h / 2], mass: 0, restitution: 0.6, friction: 0.2 });
      if (gh < h) bodies.push({ id: `board-${end}-lintel`, collider: 'aabb', position: [0, y, (gh + h) / 2], half: [gw, t, (h - gh) / 2], mass: 0, restitution: 0.6, friction: 0.2 });
    }
  }
  const sim = _gsim.createState({ gravity: ballGravity(ctx.register), seed: ctx.seed, bodies, forces: ballForces(ctx.ball, ctx.register, { id: 'ball' }) });
  const roles = Object.keys(ctx.C.roles);
  const p = [];
  for (const side of ['a', 'b']) roles.forEach((role, i) => { const h = ctx.sport.homes[role]; p.push({ id: `${side}${i + 1}`, side, role, home: [h[0], side === 'a' ? h[1] : -h[1]], x: 0, y: 0, vx: 0, vy: 0, facing: Math.PI / 2 * signOf(side), held: 0, charge: 0, cool: 0, dribbled: -99, kicks: 0 }); });
  const S = {
    f: 0, K, phase: K.phase, calls: [], over: false, winner: null, dead: 0, last: null, sim, p,
    active: { a: null, b: null }, wait: 0, placedAt: -1, liveAt: 0, passPos: {}, minds: {},
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

function fact(S, ctx, f) {
  const out = contestApply(ctx.C, S.K, f);
  S.K = out.S; S.phase = out.S.phase;
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

/** The kick: the leg's strike on a ball in reach, aimed along `facing`, at the share `power` of the tip (a pass stays low). */
function kick(S, ctx, P, facing, power) {
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

function move(S, ctx, P, stick) {
  const c = ctx.court, B = ctx.body, k = 1 - Math.exp(-GDT / B.tau);
  P.vx += (stick[0] * B.speed - P.vx) * k; P.vy += (stick[1] * B.speed - P.vy) * k;
  P.x = gr3(gclamp(P.x + P.vx * GDT, -(c.halfW + MARGIN), c.halfW + MARGIN));
  P.y = gr3(gclamp(P.y + P.vy * GDT, -(c.halfL + MARGIN), c.halfL + MARGIN));
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
        const T = fieldTarget({ me: [P.x, P.y], home: { kind: 'circle', circle: [P.home[0], P.home[1], 1.5] }, legal, ball: [b.position[0], b.position[1]], press: restarting ? 0 : P === presser ? ctx.sport.press : 0 });
        stick = toward(P, T.to, 0.9);
      }
      move(S, ctx, P, stick);
      if (want) kick(S, ctx, P, want.facing, want.power);
      // the carry: a slow ball at the feet of a moving player stays a half step ahead of them, at their pace
      const v = Math.hypot(P.vx, P.vy), bv = Math.hypot(b.velocity[0], b.velocity[1]);
      if (v > 0.6 && b.position[2] < 0.4 && bv < K.dribble + 1 && dist2([P.x, P.y], b.position) <= K.reach * 0.9 && !(restarting && S.K.restart && S.K.restart.side !== side)) {
        if (S.f - P.dribbled > 20 || S.K.ball.lastWho !== P.id) { if (touch(S, ctx, P, b.position)) P.dribbled = S.f; }
        const n = v || 1, pace = Math.min(K.dribble, v);
        b.position = [gr3(P.x + (P.vx / n) * 0.5), gr3(P.y + (P.vy / n) * 0.5), b.position[2]];
        b.velocity = [gr3((P.vx / n) * pace), gr3((P.vy / n) * pace), b.velocity[2]]; b.resting = false;
      }
    }
  }
  // a restart nobody takes: the taker plays it after the wait
  if (restarting && S.wait >= AUTO_RESUME && S.K.restart) {
    const taker = S.p.find((P) => P.id === S.active[S.K.restart.side]);
    if (taker) { const s = signOf(taker.side); kick(S, ctx, taker, Math.atan2(s * 1, -Math.sign(b.position[0] || 1) * 0.6), K.pass); }
  }
  // fouls: a charge into the ball's carrier from behind at speed (never in the frames after a restart, while the players spread)
  if (S.K.phase === 'live' && S.f - S.liveAt > FOUL_GRACE) {
    const carrier = S.p.find((Q) => Q.id === S.K.ball.lastWho && dist2([Q.x, Q.y], b.position) <= K.reach);
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
  if (S.K.phase === 'live') {
    fact(S, ctx, { kind: 'tick', dt: GDT });
    const x = b.position[0], y = b.position[1], z = b.position[2], r = b.radius, G = ctx.sport.goal;
    if (Math.abs(y) > c.halfL + r * 0.5 && Math.abs(x) < G.width / 2 && z < G.height) {
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
