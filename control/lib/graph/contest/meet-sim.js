/**
 * THE MEET SIM — an athletic event as a pure function of the lanes' pads: a sprint, the hurdles or the long jump at
 * 60 Hz, in versus's shape (versus/versus-core.js). Each lane is a body on a line; the contest kernel
 * (contest-kernel.js) is the referee: the set, the gun on its seeded delay, a false start, the finish and the marks are
 * facts the sim hands it, and its calls (the gun, a disqualification, the placings) come back as the sim's `calls`.
 * No clock, no Math.random, no DOM: the same context and the same pads are the same race to the byte (a replay is the
 * pad log), and a lane with no pad is run by a seeded computer.
 *
 *   stepMeet(S, pads, ctx) → S     one frame; pads[i] = { b } (PAD bits) for the lanes a player holds (i < players)
 *   newMeet(ctx) → S               ctx = meetContext(data) (meet-arena.js meetArenaData): { C, event, register, players, seed }
 *   cloneMeet(S) → a copy          (the state is plain data)
 *   MEET_REGISTERS                 the body on each register: the sprint's top speed and how fast it builds (the motion
 *                                  flavors' own numbers, gameworld/feel/motion.js, held equal by the test), and how the
 *                                  pad drives it: `stride` (hold to run; a press on the footfall's beat lifts the form,
 *                                  one off it drops it: the realistic register) or `mash` (the press rate is the speed,
 *                                  `full` presses a second the top); whether a hurdle is taken by the body (`auto`, the
 *                                  realistic register) or on the jump press in its band; the long jump's take-off angle
 *                                  and the gravity its flight falls on
 *
 * The lane's line is x (metres from the start), its speed v; the stride cycle advances by the ground covered. A hurdle
 * is cleared by a hop begun in its approach band (a hop keeps most of the speed); a hurdle met on the ground clips the
 * runner (speed lost, a stumble no pad drives). A long jump takes off on the press (the runway's last metres), flies the
 * ballistic arc of its speed and angle, and is marked from the board; a take-off past the board is a foul, a run through
 * the board a foul too; then the runner walks back for the next attempt until the kernel says the attempts are spent.
 */
import { contestStart, contestApply, contestLegal } from './contest-kernel.js';

export const MEET_REGISTERS = Object.freeze({
  realistic: Object.freeze({ top: 7, tau: 1.0, control: 'stride', beat: 0.12, form: [0.9, 1.1], gain: 0.02, loss: 0.01, hurdle: 'auto', jumpAngle: 22, g: 9.81 }),
  action: Object.freeze({ top: 9, tau: 0.45, control: 'mash', full: 8, hurdle: 'press', jumpAngle: 24, g: 9.81 }),
  platformer: Object.freeze({ top: 6, tau: 0.08, control: 'mash', full: 6, hurdle: 'press', jumpAngle: 30, g: 5.886 }),
  pinball: Object.freeze({ top: 20, tau: 1.4, control: 'mash', full: 10, hurdle: 'press', jumpAngle: 18, g: 9.81 }),
});
export const MEET_REGISTER_IDS = Object.freeze(Object.keys(MEET_REGISTERS));
export const PAD = Object.freeze({ RUN: 1, JUMP: 2, START: 4 });
export const ZERO_PAD = Object.freeze({ b: 0 });
export const FPS = 60;
const DT = 1 / FPS;
export const STRIDE = 2.2;          // metres a sprint stride covers: the cycle's phase advances by the ground
export const SET_AT = 60;           // frames of "on your marks" before the set
export const HURDLE = Object.freeze({ band: [2.4, 0.9], auto: 1.6, air: 0.38, keep: 0.96, clip: 0.45, stumble: 0.5, height: 0.914 });
const MASH_WINDOW = 60;             // frames the press rate is read over
const STUMBLE_DECEL = 6;            // m/s² a stumbling runner sheds
const JUMP_FROM = 3;                // metres before the board a jump may be taken from
const RUN_THROUGH = 1.5;            // metres past the board a runner who never jumped has fouled
const r3 = (v) => Math.round(v * 1000) / 1000;

function dice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The sim's context from the arena's data: the compiled contest, the event, the register, the players, the seed. */
export function meetContext(data) {
  if (!data || !data.C || !data.event) throw new Error('meet: a context is { C, event, register?, players?, seed? }');
  const register = data.register ?? 'realistic';
  if (!MEET_REGISTERS[register]) throw new Error(`meet: register '${register}' is one of ${MEET_REGISTER_IDS.join(', ')}`);
  return { C: data.C, event: data.event, register, players: data.players ?? 0, seed: data.seed ?? 1 };
}

function newRunner(id, lane) {
  return { id, lane, x: 0, v: 0, stride: 0, form: 1, air: 0, airT: 0, stumble: 0, presses: [], held: 0, heldJ: 0, next: 0, jumpedAt: null, hop: null, done: false, dq: false, t: null, clips: 0, attempt: 0 };
}

/** The first state: the lanes at their marks, the kernel ready, each computer lane's habits rolled from the seed. */
export function newMeet(ctx) {
  const K = contestStart(ctx.C, ctx.seed), ids = Object.keys(K.lanes);
  const d = dice(ctx.seed * 7919 + 17);
  const R = MEET_REGISTERS[ctx.register];
  return {
    f: 0, phase: K.phase, K, calls: [], over: false, placings: null,
    r: ids.map((id, i) => newRunner(id, i)),
    // a computer lane: its press rate (a share of the full rate), its form, where in the band it hops, where it jumps from
    cpu: ids.map(() => ({ rate: r3(0.72 + 0.28 * d()), form: r3(0.96 + 0.08 * d()), hop: r3(HURDLE.band[1] + (HURDLE.band[0] - HURDLE.band[1]) * d()), jump: r3(0.15 + 0.9 * d()), beat: d() })),
    register: ctx.register, top: R.top,
  };
}

export const cloneMeet = (S) => JSON.parse(JSON.stringify(S));

/** A player's pad as the lane's control: run held, and the press edges since the last frame. */
export function padControl(r, pad) {
  const b = pad && Number.isInteger(pad.b) ? pad.b : 0;
  const run = !!(b & PAD.RUN), jump = !!(b & PAD.JUMP);
  const out = { run, press: run && !r.held, jump: jump && !r.heldJ };
  r.held = run ? 1 : 0; r.heldJ = jump ? 1 : 0;
  return out;
}

/**
 * A computer lane's control this frame: nothing before the gun (it never false-starts), then the run held, the mash
 * at its own rate, its form its habit on the stride register, a hop where it likes in the band, a jump from its spot.
 */
export function cpuControl(S, i, ctx) {
  const r = S.r[i], c = S.cpu[i], R = MEET_REGISTERS[ctx.register], E = ctx.event;
  if (S.K.phase !== 'live') return { run: false, press: false, jump: false };
  let press = false;
  if (R.control === 'mash') { const rate = R.full * c.rate; press = Math.floor(S.f * rate / FPS) !== Math.floor((S.f - 1) * rate / FPS); }
  let jump = false;
  if (E.kind === 'hurdles' && R.hurdle === 'press') { const h = E.hurdles[r.next]; jump = h !== undefined && r.air === 0 && r.x >= h - c.hop; }
  if (E.measure !== 'time') jump = r.air === 0 && r.hop === null && r.x >= E.board - c.jump;
  return { run: true, press, jump, ...(R.control === 'stride' ? { form: c.form } : {}) };
}

function fact(S, ctx, f) {
  const out = contestApply(ctx.C, S.K, f);
  S.K = out.S; S.phase = out.S.phase;
  for (const c of out.calls) S.calls.push({ ...c, f: S.f });
  return out.calls;
}

/** One frame. `pads[i]` drives lane i while i < ctx.players; the other lanes are the computer's. */
export function stepMeet(S, pads, ctx) {
  const R = MEET_REGISTERS[ctx.register], E = ctx.event;
  S.f += 1;
  // the referee: the set after the marks, then the clock (the gun fires on the kernel's delay, the race clock from it)
  if (S.K.phase === 'ready' && S.f === SET_AT) fact(S, ctx, { kind: 'set' });
  if (S.K.phase === 'set' || S.K.phase === 'live') fact(S, ctx, { kind: 'tick', dt: DT });
  for (let i = 0; i < S.r.length; i++) {
    const r = S.r[i];
    if (r.done || r.dq) continue;
    const ctl = i < ctx.players ? padControl(r, pads && pads[i]) : cpuControl(S, i, ctx);
    const lane = S.K.lanes[r.id];
    if (lane.state === 'dq') { r.dq = true; continue; }
    if (S.K.phase === 'set') {
      // a press before the gun: the kernel's call (a warning or the lane out); the body stays at its mark
      if (ctl.press || ctl.jump) { fact(S, ctx, { kind: 'press', who: r.id }); if (S.K.lanes[r.id].state === 'dq') r.dq = true; }
      continue;
    }
    if (S.K.phase !== 'live' || lane.state !== 'running') continue;
    if (ctl.press) r.presses.push(S.f);
    while (r.presses.length && r.presses[0] <= S.f - MASH_WINDOW) r.presses.shift();
    // the target speed by the register: the stride's form, or the mash
    let target;
    if (R.control === 'stride') {
      if (ctl.press && r.v > 0.5) {
        // the distance to the nearest footfall, in half-cycles; the beat is the card's, and never narrower than a frame
        // and a half of stride (a press lands on a frame, the footfall between two)
        const frac = (r.stride * 2) % 1, off = Math.min(frac, 1 - frac), win = Math.max(R.beat / 2, (1.5 * 2 * r.v * DT) / STRIDE);
        r.form = off <= win ? Math.min(R.form[1], r3(r.form + R.gain)) : Math.max(R.form[0], r3(r.form - R.loss));
      }
      target = ctl.run ? R.top * (ctl.form ?? r.form) : 0;
    } else target = R.top * Math.min(1, (r.presses.length / (MASH_WINDOW / FPS)) / R.full);
    if (r.stumble > 0) { r.stumble = Math.max(0, r.stumble - DT); r.v = Math.max(0, r.v - STUMBLE_DECEL * DT); }
    else r.v += (target - r.v) * (1 - Math.exp(-DT / R.tau));
    // the body along its line: in the air it keeps its speed and its stride; on the ground the stride runs with the ground
    const x0 = r.x;
    r.x += r.v * DT;
    if (r.air > 0) { r.air = Math.max(0, r.air - DT); if (r.air === 0 && r.hop) land(S, ctx, r); }
    else r.stride += (r.v * DT) / STRIDE;
    if (r.done || r.dq) continue;
    if (E.kind === 'hurdles') hurdles(S, ctx, r, ctl, x0, R);
    if (E.measure === 'time') { if (r.x >= E.distance) { fact(S, ctx, { kind: 'finish', who: r.id }); r.done = true; r.t = S.K.lanes[r.id].t; } }
    else longJump(S, ctx, r, ctl, R);
  }
  if (S.K.phase === 'over' && !S.over) { S.over = true; S.placings = S.K.placings; }
  return S;
}

function hurdles(S, ctx, r, ctl, x0, R) {
  const E = ctx.event, h = E.hurdles[r.next];
  if (h === undefined) return;
  const inBand = r.x >= h - HURDLE.band[0] && r.x <= h - HURDLE.band[1];
  const take = R.hurdle === 'auto' ? r.x >= h - HURDLE.auto : ctl.jump;
  if (r.air === 0 && r.jumpedAt !== h && inBand && take) { r.air = HURDLE.air; r.v *= HURDLE.keep; r.jumpedAt = h; S.calls.push({ kind: 'hop', who: r.id, hurdle: r.next, f: S.f }); }
  if (x0 < h && r.x >= h) {
    if (r.jumpedAt === h && r.air > 0) r.next += 1;
    else { r.v *= HURDLE.clip; r.stumble = HURDLE.stumble; r.air = 0; r.clips += 1; r.next += 1; S.calls.push({ kind: 'clip', who: r.id, hurdle: r.next - 1, f: S.f }); }
  }
}

function longJump(S, ctx, r, ctl, R) {
  const E = ctx.event;
  if (r.air > 0 || r.hop) return;
  if (ctl.jump && r.x >= E.board - JUMP_FROM) {
    const a = (R.jumpAngle * Math.PI) / 180, d = (r.v * r.v * Math.sin(2 * a)) / R.g;
    r.hop = { from: r3(r.x), d: r3(d), foul: r.x > E.board + 1e-9 };
    r.air = r3((2 * r.v * Math.sin(a)) / R.g) || DT;
    S.calls.push({ kind: 'takeoff', who: r.id, at: r.hop.from, v: r3(r.v), foul: r.hop.foul, f: S.f });
  } else if (r.x >= E.board + RUN_THROUGH) { r.hop = { from: r3(r.x), d: 0, foul: true }; land(S, ctx, r); }
}

function land(S, ctx, r) {
  const E = ctx.event, hop = r.hop;
  r.hop = null; r.air = 0;
  const value = hop.foul ? null : r3(Math.max(0, hop.from + hop.d - E.board));
  fact(S, ctx, hop.foul ? { kind: 'mark', who: r.id, foul: true } : { kind: 'mark', who: r.id, value });
  r.attempt += 1;
  const left = contestLegal(ctx.C, S.K, r.id).attemptsLeft;
  if (left === 0 || S.K.lanes[r.id].state !== 'running') { r.done = true; return; }
  // back to the start of the runway for the next attempt
  r.x = 0; r.v = 0; r.stride = 0; r.presses = [];
}

/** Each lane's readout: where it is, how fast, its time or its best, its state. */
export function meetLanes(S) {
  return S.r.map((r) => ({ id: r.id, lane: r.lane, x: r3(r.x), v: r3(r.v), t: r.t, best: S.K.lanes[r.id].best, marks: S.K.lanes[r.id].marks.slice(), state: r.dq ? 'dq' : r.done ? 'done' : S.K.lanes[r.id].state, clips: r.clips }));
}
