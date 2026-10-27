/**
 * THE BAT SIM — a bat-and-ball game (the kernel's innings: baseball, cricket) as a pure function of two pads at 60 Hz,
 * in the court's and the pitch's shape: the kernel the referee (strikes, outs, the bases, the runs, the overs, the side
 * retired), the ball the physics property's sphere, the swing timed against the ball. No clock, no Math.random, no DOM:
 * the same context and pads are the same game to the byte.
 *
 *   stepBat(S, pads, ctx) → S     one frame; pads[i] = { x, y, b } for the sides players hold (i < players: a first):
 *                                 the side batting swings (the press, timed; the stick sprays it and lifts it), the side
 *                                 fielding pitches or bowls (the stick aims, the press lets it go); the rest the minds'
 *   newBat(ctx) → S               ctx = batContext(data) (innings-arena.js inningsArenaData)
 *   batDisplay(S, ctx)            the scoreboard: the kernel's runs and its innings, the ball, the players
 *
 * The frame: the batter at the origin, the field along +y (the pitcher's mound or the far wicket up it), x across, z up,
 * metres. A ball's whole life: in the hand, pitched (a baseball through the zone, a cricket ball bounced at a length),
 * swung at (the swing's strike against when the ball reaches the bat: early, sweet or late within the window, the
 * contact's quality and its spray),
 * and, struck, flown on the physics; its outcome is read ahead on a copy of that physics the moment it is struck (a
 * catch where a fielder reaches its landing in its hang time, over the fence or the rope, a foul outside the lines, a
 * ground ball fielded where a fielder first meets its path), and the kernel told when the play reaches it. A ball not
 * struck: a strike (swung at, or through the zone looking), a dot ball, or bowled (into the stumps). A ball out of the
 * zone and let go is pitched again (the arcade has no balls).
 */
import { contestStart, contestApply, contestDisplay } from './contest-kernel.js';
import { buildSim } from '../worlds/physics-sim.js';
import { ballBody, ballForces, ballGravity } from './ball-card.js';

// each register's fielder (its run, its reaction) and the ball off the bat and the hand: the arcade registers fly no
// air, so the bat's exit is less there (the platformer's floaty ball the least), the realistic ball more through its air
export const BAT_BODY = Object.freeze({
  realistic: Object.freeze({ run: 7, react: 0.35, exit: 1.12, pitch: 1 }),
  action: Object.freeze({ run: 8, react: 0.25, exit: 1, pitch: 0.85 }),
  platformer: Object.freeze({ run: 6, react: 0.3, exit: 0.72, pitch: 0.7 }),
  pinball: Object.freeze({ run: 10, react: 0.2, exit: 1.05, pitch: 1.1 }),
});
export const BAT_REGISTER_IDS = Object.freeze(Object.keys(BAT_BODY));
export const BPAD = Object.freeze({ SWING: 1, START: 4 });
export const BAT_FPS = 60;
const BDT = 1 / BAT_FPS;
export const BAT_DEAD = Object.freeze({ ball: 70, play: 110, side: 160, over: 180 });
// the swing: its frames and the frame it strikes; the ball must be within so many seconds of the bat at the strike
// (the arcade's window: a ball at pace is metres either side of the sweet spot in it)
const SWING_FRAMES = 16, STRIKE_AT = 9, WINDOW_T = 0.07, PITCH_WAIT = 75, CATCH_PACE = 0.75, RUN_ON = 0.8;
const BAT_LEVELS = Object.freeze({ novice: { timing: 6, chase: 0.25 }, regular: { timing: 4, chase: 0.12 }, veteran: { timing: 2.5, chase: 0.06 }, ace: { timing: 1.5, chase: 0.03 } });
const br3 = (v) => Math.round(v * 1000) / 1000;
const _bsim = buildSim();

/** The sim's context from the arena's data. */
export function batContext(data) {
  if (!data || !data.C || !data.sport) throw new Error('bat: a context is { C, sport, register?, players?, level?, seed? }');
  const register = data.register ?? 'realistic';
  if (!BAT_BODY[register]) throw new Error(`bat: register '${register}' is one of ${BAT_REGISTER_IDS.join(', ')}`);
  return { C: data.C, sport: data.sport, ball: data.sport.ball, register, players: data.players ?? 0, level: data.level ?? 'regular', seed: data.seed ?? 1, body: BAT_BODY[register] };
}

function dice(M) {
  M.r = (M.r + 0x6D2B79F5) >>> 0;
  let t = M.r;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const simBall = (S) => S.sim.bodies[0];
const batSide = (side) => (side === 'a' ? 0 : 1);

export function newBat(ctx) {
  const K = contestStart(ctx.C, ctx.seed);
  const sim = _bsim.createState({
    gravity: ballGravity(ctx.register), seed: ctx.seed,
    bodies: [ballBody(ctx.ball, ctx.register, { id: 'ball', position: [0, 0, 1] }), { id: 'ground', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0, restitution: ctx.sport.field.bounce ?? 0.45, friction: 0.7 }],
    forces: ballForces(ctx.ball, ctx.register, { id: 'ball' }),
  });
  const S = { f: 0, K, scoring: ctx.C.innings.runs, calls: [], over: false, winner: null, dead: 0, phase: 'ready', wait: PITCH_WAIT, sim, swing: null, pitch: null, play: null, fielders: [], m: { r: (ctx.seed * 2654435761) >>> 0 }, last: null };
  setupBall(S, ctx);
  return S;
}

export const cloneBat = (S) => JSON.parse(JSON.stringify(S));

/** The next ball: the fielders home, the ball in the pitcher's (the bowler's) hand. */
function setupBall(S, ctx) {
  const P = ctx.sport.pitch, b = simBall(S);
  S.fielders = ctx.sport.fielders.map((at, i) => ({ i, x: at[0], y: at[1], home: at.slice(), to: null }));
  b.position = [0, P.at[1], P.hand]; b.velocity = [0, 0, 0]; b.angularVelocity = [0, 0, 0]; b.resting = false;
  S.phase = 'ready'; S.wait = PITCH_WAIT; S.swing = null; S.pitch = null; S.play = null;
}

function fact(S, ctx, f) {
  const out = contestApply(ctx.C, S.K, f);
  S.K = out.S;
  let dead = BAT_DEAD.ball;
  for (const c of out.calls) {
    S.calls.push({ ...c, f: S.f }); S.last = c;
    if (c.kind === 'over') { S.over = true; S.winner = c.winner; dead = BAT_DEAD.over; }
    else if (c.kind === 'side') dead = Math.max(dead, BAT_DEAD.side);
    else if (c.kind === 'base-hit' || c.kind === 'runs' || c.kind === 'out') dead = Math.max(dead, BAT_DEAD.play);
  }
  S.dead = dead; S.phase = 'dead';
  return out.calls;
}

/**
 * The pitch (the delivery): from the hand to a target at the batter (a baseball through the zone at its height; a
 * cricket ball to a bounce at its length, on to the stumps' line), at the card's speed scaled by the register.
 */
function deliver(S, ctx, aim) {
  const P = ctx.sport.pitch, b = simBall(S), g = -S.sim.gravity[2], v = P.speed * ctx.body.pitch * (1 + aim.pace);
  const from = [aim.x * 0.3, P.at[1], P.hand];
  let target, t;
  if (P.length) {
    // a bounce at the length, the line its x
    target = [aim.x, aim.length];
    t = (from[1] - target[1]) / v;
    b.velocity = [br3((target[0] - from[0]) / t), br3(-v), br3((0 - from[2] + 0.5 * g * t * t) / t)];
  } else {
    target = [aim.x, 0, aim.z];
    t = from[1] / v;
    b.velocity = [br3((target[0] - from[0]) / t), br3(-v), br3((target[2] - from[2] + 0.5 * g * t * t) / t)];
  }
  b.position = from; b.angularVelocity = [0, 0, 0]; b.resting = false;
  S.phase = 'pitch'; S.pitch = { aim: { ...aim }, swung: false, f: S.f };
  S.calls.push({ kind: 'pitch', side: S.K.batting === 'a' ? 'b' : 'a', speed: br3(v), f: S.f });
}

/** The fielding side's aim, the computer's: in the zone (now and then just off it), or a length on the stumps. */
function pitcherAim(S, ctx) {
  const P = ctx.sport.pitch, Z = ctx.sport.zone, m = S.m;
  if (P.length) return { x: br3((dice(m) - 0.5) * 0.9), length: br3(P.length[0] + dice(m) * (P.length[1] - P.length[0])), pace: br3((dice(m) - 0.5) * 0.1) };
  const off = dice(m) < 0.2 ? 1.6 : 0.8;
  return { x: br3((dice(m) - 0.5) * 2 * Z.x * off), z: br3((Z.z[0] + Z.z[1]) / 2 + (dice(m) - 0.5) * (Z.z[1] - Z.z[0]) * off), pace: br3((dice(m) - 0.5) * 0.12) };
}
/** A pad's aim: the stick across the zone (or the line) and up it (or the length). */
function padAim(ctx, pad) {
  const P = ctx.sport.pitch, Z = ctx.sport.zone;
  if (P.length) return { x: br3((pad.x || 0) * 0.3), length: br3(P.length[0] + ((pad.y || 0) + 1) / 2 * (P.length[1] - P.length[0])), pace: 0 };
  return { x: br3((pad.x || 0) * Z.x * 1.5), z: br3((Z.z[0] + Z.z[1]) / 2 + (pad.y || 0) * (Z.z[1] - Z.z[0]) * 0.75), pace: 0 };
}

/** Whether the ball crossed the batter's plane in the zone (a baseball's strike) or into the stumps (a cricket ball). */
const inZone = (ctx, p) => { const Z = ctx.sport.zone; return Math.abs(p[0]) <= Z.x && p[2] >= Z.z[0] && p[2] <= Z.z[1]; };

/**
 * The swing's strike against the ball: in reach (along the field within the window, across within the bat, at a height
 * the bat meets), the timing the ball's place along the field (ahead of the batter: early, a pull; behind: late, the
 * other way), the quality its nearness to the sweet spot; the launch the bat's exit speed by the quality, its loft and
 * its spray, the stick's lift and aim on them.  → the launch, or null for a miss
 */
function contact(S, ctx, stick) {
  const b = simBall(S), B = ctx.sport.bat, y = b.position[1], win = WINDOW_T * Math.max(5, Math.abs(b.velocity[1]));
  if (Math.abs(y) > win || Math.abs(b.position[0]) > B.reach || b.position[2] < 0.15 || b.position[2] > 1.7) return null;
  const t = y / win, q = 1 - Math.abs(t);
  const speed = B.exit * ctx.body.exit * (0.45 + 0.55 * q);
  const loft = B.loft * (0.35 + 0.65 * q) + stick[1] * 14 + (t > 0 ? -8 : 14) * (1 - q);
  const spray = -t * B.spray + stick[0] * 18;   // early pulls to the batter's left (−x), late goes the other way
  const az = Math.PI / 2 + (spray * Math.PI) / 180, el = (loft * Math.PI) / 180;
  return { velocity: [br3(speed * Math.cos(el) * Math.cos(az)), br3(speed * Math.cos(el) * Math.sin(az)), br3(speed * Math.sin(el))], q: br3(q), t: br3(t), speed: br3(speed), loft: br3(loft), spray: br3(spray) };
}

/**
 * The struck ball's outcome, read ahead on a copy of the physics: over the fence (the rope) on the full; a catch where
 * a fielder reaches its first landing in its hang time; a foul outside the lines (bases'); else the ground ball or the
 * landed ball fielded where a fielder first meets its path, and the runs (or bases) the runner makes before the throw
 * comes in.  → { fact, frames, fielder, at }
 */
function outcome(S, ctx) {
  const F = ctx.sport.field, R = ctx.sport.runner, copy = JSON.parse(JSON.stringify(S.sim)), b = copy.bodies[0], body = ctx.body;
  const runs = ctx.C.innings.runs === 'runs';
  // a fielder reaches a point in a time: its run after its reaction (a catch on the run takes a step more than a chase)
  const reachAt = (fd, p, t, catching = false) => Math.hypot(fd.x - p[0], fd.y - p[1]) <= body.run * Math.max(0, t - body.react) * (catching ? CATCH_PACE : 1) + ctx.sport.catchReach;
  let landed = null;
  for (let i = 1; i <= 600; i++) {
    const t = i * BDT;
    _bsim.step(copy, BDT);
    const r = Math.hypot(b.position[0], b.position[1]);
    if (!landed && r >= F.fence && b.position[2] > (F.fenceHeight ?? 0)) {
      // over the fence or the rope on the full: a home run, a six
      return { fact: runs ? { kind: 'runs', runs: 6, boundary: true } : { kind: 'hit', bases: 4 }, frames: i, fielder: null, at: [b.position[0], b.position[1]] };
    }
    if (!runs && r >= F.fence) {
      // a fence's face: the ball comes back off it, in the air or along the ground
      const k = (F.fence - 0.05) / r;
      b.position = [b.position[0] * k, b.position[1] * k, b.position[2]];
      b.velocity = [b.velocity[0] * -0.3, b.velocity[1] * -0.3, b.velocity[2]];
    }
    const onGround = copy.contacts.some((c) => c.a === 'ball' || c.b === 'ball');
    if (!landed && onGround) {
      landed = { at: [b.position[0], b.position[1]], t };
      // a foul: landed outside the lines (a game of bases), a strike
      if (F.fair && Math.abs(Math.atan2(landed.at[0], landed.at[1])) > (F.fair * Math.PI) / 180) return { fact: { kind: 'strike', why: 'foul' }, frames: i, fielder: null, at: landed.at };
      // caught on the full: the fielder that reaches the landing first, in its hang time
      const catcher = S.fielders.filter((fd) => reachAt(fd, landed.at, t, true)).sort((p, q2) => Math.hypot(p.x - landed.at[0], p.y - landed.at[1]) - Math.hypot(q2.x - landed.at[0], q2.y - landed.at[1]))[0];
      if (catcher) return { fact: { kind: 'out', why: 'caught' }, frames: i, fielder: catcher.i, at: landed.at };
    }
    if (landed) {
      if (runs && r >= F.fence) return { fact: { kind: 'runs', runs: 4, boundary: true }, frames: i, fielder: null, at: [b.position[0], b.position[1]] };
      // fielded: the first fielder to meet the ball's path
      const fd = S.fielders.find((x) => reachAt(x, b.position, t));
      if (fd || b.resting || i === 600) {
        const at = [b.position[0], b.position[1]], who = fd ?? S.fielders.reduce((m, x) => (Math.hypot(x.x - at[0], x.y - at[1]) < Math.hypot(m.x - at[0], m.y - at[1]) ? x : m));
        const tf = fd ? t : t + Math.hypot(who.x - at[0], who.y - at[1]) / body.run;
        if (runs) {
          // a game of runs: a run each time the batters cross before the ball is back at the wicket
          const n = Math.min(3, Math.floor((tf + R.gather + Math.hypot(at[0] - R.home[0], at[1] - R.home[1]) / R.throw) / R.each));
          return { fact: n ? { kind: 'runs', runs: n } : { kind: 'dot' }, frames: Math.round(tf / BDT), fielder: who.i, at };
        }
        // a game of bases: thrown out at first when the throw beats the runner; else the furthest base the runner
        // reaches before a throw to it would (the diamond's bases from first's: second straight up, third its mirror;
        // the runner out of the box to first, at its stride round the rest)
        const base = [R.first, [0, 2 * R.first[1]], [-R.first[0], R.first[1]]];
        const thrown = (k) => tf + R.gather + Math.hypot(at[0] - base[k - 1][0], at[1] - base[k - 1][1]) / R.throw;
        const reached = (k) => R.each * (1 + RUN_ON * (k - 1));
        if (thrown(1) < reached(1)) return { fact: { kind: 'out', why: 'thrown-out' }, frames: Math.round(tf / BDT), fielder: who.i, at };
        let bases = 1;
        while (bases < 3 && thrown(bases + 1) >= reached(bases + 1)) bases += 1;
        return { fact: { kind: 'hit', bases }, frames: Math.round(tf / BDT), fielder: who.i, at };
      }
    }
  }
  return { fact: runs ? { kind: 'dot' } : { kind: 'hit', bases: 1 }, frames: 600, fielder: null, at: [b.position[0], b.position[1]] };
}

/** The batter's swing, the computer's: at a pitch it means to hit, begun so the strike meets the ball at the bat, the
 * level's error on the timing. */
function batterPress(S, ctx) {
  const b = simBall(S), L = BAT_LEVELS[ctx.level] ?? BAT_LEVELS.regular;
  if (S.phase !== 'pitch' || S.swing || b.velocity[1] >= 0) return 0;
  if (!S.pitch.mind) {
    // decide once a pitch: swing at what will cross the zone (or the stumps' line), chase a little outside it
    const p = S.pitch.aim, wants = ctx.sport.pitch.length ? true : inZone(ctx, [p.x, 0, p.z]) || dice(S.m) < L.chase;
    S.pitch.mind = { wants, err: br3((dice(S.m) - 0.5) * 2 * L.timing) };
  }
  if (!S.pitch.mind.wants) return 0;
  const frames = b.position[1] / -b.velocity[1] * BAT_FPS;   // frames until the ball reaches the bat
  return frames <= STRIKE_AT + S.pitch.mind.err ? BPAD.SWING : 0;
}

/** One frame. */
export function stepBat(S, pads, ctx) {
  S.f += 1;
  if (S.over) { if (S.dead > 0) S.dead -= 1; return S; }
  if (S.dead > 0) { S.dead -= 1; if (S.dead === 0) setupBall(S, ctx); return S; }
  const bat = S.K.batting, field = bat === 'a' ? 'b' : 'a';
  const human = (side) => batSide(side) < ctx.players, padOf = (side) => (pads && pads[batSide(side)]) || { x: 0, y: 0, b: 0 };
  const b = simBall(S);
  if (S.phase === 'ready') {
    // the fielding side lets it go: the pad's press, or the computer after its wait
    S.wait -= 1;
    const pad = human(field) ? padOf(field) : null;
    if (pad ? (pad.b & BPAD.SWING) && S.wait < PITCH_WAIT - 20 : S.wait <= 0) deliver(S, ctx, pad ? padAim(ctx, pad) : pitcherAim(S, ctx));
    else { b.position = [0, ctx.sport.pitch.at[1], ctx.sport.pitch.hand]; b.velocity = [0, 0, 0]; return S; }
  }
  if (S.phase === 'pitch') {
    const pad = human(bat) ? padOf(bat) : null, press = pad ? pad.b & BPAD.SWING : batterPress(S, ctx);
    if (press && !S.swing) { S.swing = { u: 0, stick: pad ? [Math.max(-1, Math.min(1, pad.x || 0)), Math.max(-1, Math.min(1, pad.y || 0))] : [br3((dice(S.m) - 0.5) * 0.8), br3((dice(S.m) - 0.5) * 0.6)], f: 0 }; S.pitch.swung = true; S.calls.push({ kind: 'swing', side: bat, f: S.f }); }
    if (S.swing) {
      S.swing.f += 1;
      if (S.swing.f === STRIKE_AT) {
        const L = contact(S, ctx, S.swing.stick);
        if (L) {
          b.velocity = L.velocity; b.angularVelocity = [0, 0, 0]; b.resting = false;
          S.calls.push({ kind: 'hit-ball', side: bat, q: L.q, t: L.t, speed: L.speed, loft: L.loft, spray: L.spray, f: S.f });
          const O = outcome(S, ctx);
          S.phase = 'flight'; S.play = { ...O, at0: S.f };
          if (O.fielder !== null) S.fielders[O.fielder].to = O.at;
        }
      }
    }
  }
  _bsim.step(S.sim, BDT);
  if (S.phase === 'pitch') {
    // past the batter unstruck: bowled (into the stumps), a strike (swung, or through the zone), a dot, or again
    if (b.position[1] < -0.3) {
      const p = b.position, Sd = ctx.sport.stumps;
      if (Sd) fact(S, ctx, Math.abs(p[0]) <= Sd.x && p[2] <= Sd.z ? { kind: 'out', why: 'bowled' } : { kind: 'dot' });
      else if (S.pitch.swung || inZone(ctx, p)) fact(S, ctx, { kind: 'strike', why: S.pitch.swung ? 'missed' : 'looking' });
      else { S.calls.push({ kind: 'ball', side: bat, f: S.f }); S.dead = BAT_DEAD.ball; S.phase = 'dead'; }
    }
  } else if (S.phase === 'flight') {
    // the fielder runs to where it meets the ball; the kernel told when the play reaches its end
    for (const fd of S.fielders) if (fd.to) { const d = [fd.to[0] - fd.x, fd.to[1] - fd.y], n = Math.hypot(d[0], d[1]); if (n > 0.2) { const k = Math.min(n, ctx.body.run * BDT) / n; fd.x = br3(fd.x + d[0] * k); fd.y = br3(fd.y + d[1] * k); } }
    if (S.f - S.play.at0 >= S.play.frames) fact(S, ctx, S.play.fact);
  }
  return S;
}

/** The scoreboard's words and the play's moment. */
export function batDisplay(S, ctx) {
  const d = contestDisplay(ctx.C, S.K), b = simBall(S);
  return { ...d, phase: S.phase, over: S.over, winner: S.winner, last: S.last, ball: [br3(b.position[0]), br3(b.position[1]), br3(b.position[2])], fielders: S.fielders.map((fd) => [fd.x, fd.y]), swing: S.swing ? S.swing.f : null };
}
