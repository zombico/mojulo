// The meet sim: an athletic event as a pure function of the lanes' pads, the contest kernel its referee. The concept on
// one case each: the register's body held equal to the motion flavors; the gun and a false start on the frame; the
// stride's form and the mash; a hurdle hopped in its band and clipped out of it; the long jump's take-off, foul and
// mark; the placings; byte-identical replays.
import { describe, it, expect } from 'vitest';
import { MEET_REGISTERS, MEET_REGISTER_IDS, PAD, ZERO_PAD, SET_AT, HURDLE, FPS, newMeet, stepMeet, cloneMeet, meetContext, meetLanes } from './meet-sim.js';
import { meetArenaData } from './meet-arena.js';
import { MOTION_FLAVORS } from '../gameworld/feel/motion.js';

const ctxOf = (spec) => meetContext(meetArenaData(spec));
const RUN = { b: PAD.RUN }, JUMP = { b: PAD.JUMP }, BOTH = { b: PAD.RUN | PAD.JUMP };
// run the meet with a pad function per frame for the players' lanes; until over or `frames`
function run(ctx, padsAt, frames = 20000) {
  let S = newMeet(ctx), n = 0;
  while (!S.over && n++ < frames) stepMeet(S, padsAt ? padsAt(S) : [], ctx);
  return S;
}
const gunFrame = (S) => S.calls.find((c) => c.kind === 'gun').f;
const kinds = (S) => S.calls.map((c) => c.kind);

describe('the registers', () => {
  it('the body is the motion flavors\' own: the sprint\'s top speed and how fast it builds, register for register', () => {
    expect(MEET_REGISTER_IDS).toEqual(Object.keys(MOTION_FLAVORS));
    for (const id of MEET_REGISTER_IDS) { expect(MEET_REGISTERS[id].top, id).toBe(MOTION_FLAVORS[id].top); expect(MEET_REGISTERS[id].tau, id).toBe(MOTION_FLAVORS[id].tau); }
    expect(MEET_REGISTERS.realistic.control).toBe('stride'); expect(MEET_REGISTERS.action.control).toBe('mash');
    expect(() => meetContext({ C: {}, event: {}, register: 'arcade' })).toThrow(/register 'arcade' is one of/);
  });
});

describe('the referee in the loop', () => {
  it('on your marks, the set after a second, the gun on the kernel\'s seeded delay, the clock from the gun; the computer never jumps the gun', () => {
    const ctx = ctxOf({ event: 'sprint', lanes: 3, players: 0, seed: 3 });
    const S = run(ctx);
    expect(kinds(S).slice(0, 2)).toEqual(['set', 'gun']);
    expect(S.calls[0].f).toBe(SET_AT);
    const g = gunFrame(S);
    expect(g).toBeGreaterThan(SET_AT + 1.5 * FPS); expect(g).toBeLessThan(SET_AT + 3 * FPS + 1);
    expect(kinds(S).filter((k) => k === 'false-start')).toEqual([]);
    expect(S.over).toBe(true); expect(S.placings.map((p) => p.place)).toEqual([1, 2, 3]);
    // every lane's time is the clock from the gun: the finish frame less the gun's, within a frame
    for (const p of S.placings) { const fin = S.calls.find((c) => c.kind === 'finish' && c.who === p.who); expect(Math.abs(p.value - (fin.f - g) / FPS)).toBeLessThan(1.5 / FPS); }
  });
  it('a press before the gun is a false start on that frame: the lane is out and never runs; a press after it is the run', () => {
    const ctx = ctxOf({ event: 'sprint', lanes: 2, players: 1, seed: 3 });
    const S = run(ctx, (S) => [S.f === SET_AT + 10 ? RUN : ZERO_PAD]);
    const fs = S.calls.find((c) => c.kind === 'false-start');
    expect(fs).toMatchObject({ who: 'r1', warned: false, f: SET_AT + 11 });
    expect(S.r[0].dq).toBe(true); expect(S.r[0].x).toBe(0);
    expect(S.placings.map((p) => [p.who, p.place, p.dq])).toEqual([['r2', 1, false], ['r1', null, true]]);
    const clean = run(ctx, (S) => [S.f > SET_AT + 200 ? RUN : ZERO_PAD]);
    expect(kinds(clean)).not.toContain('false-start');
    expect(meetLanes(clean)[0].state).toBe('done');
  });
});

describe('the body on the register', () => {
  it('the stride register: holding the run builds toward the top over tau; a press on the footfall lifts the form, one off it drops it', () => {
    const ctx = ctxOf({ event: 'sprint', lanes: 1, players: 1, distance: 400, seed: 1 });
    const g = gunFrame(run(ctxOf({ event: 'sprint', lanes: 1, players: 0, seed: 1 })));
    // held, no presses: after three tau the speed is within a twentieth of the top
    let S = newMeet(ctx);
    for (let i = 0; i < g + 3 * FPS; i++) stepMeet(S, [RUN], ctx);
    expect(S.r[0].v).toBeGreaterThan(MEET_REGISTERS.realistic.top * 0.94); expect(S.r[0].v).toBeLessThan(MEET_REGISTERS.realistic.top * 1.001);
    expect(S.r[0].form).toBe(1);
    // the footfalls: a release the frame before the half-stride wraps and a press as it does lifts the form; the same
    // pair mid-stride drops it (the sim reads the stride at the frame's start, so the press frame is the beat's)
    const frac = (S) => (S.r[0].stride * 2) % 1, stepOf = (S) => (2 * S.r[0].v / FPS) / 2.2;
    const pressWhen = (inWindow, n) => { let pressed = 0, arm = false; for (let i = 0; i < 12 * FPS && pressed < n; i++) { if (arm) { stepMeet(S, [RUN], ctx); arm = false; pressed++; } else if (inWindow(frac(S), stepOf(S))) { stepMeet(S, [ZERO_PAD], ctx); arm = true; } else stepMeet(S, [RUN], ctx); } return pressed; };
    let lifted = S.r[0].form;
    expect(pressWhen((f, st) => f >= 1 - 2 * st && f < 1 - st, 4)).toBe(4);
    expect(S.r[0].form).toBeGreaterThan(lifted);
    lifted = S.r[0].form;
    expect(pressWhen((f) => f >= 0.3 && f < 0.4, 4)).toBe(4);
    expect(S.r[0].form).toBeLessThan(lifted);
    expect(S.r[0].form).toBeGreaterThanOrEqual(MEET_REGISTERS.realistic.form[0]);
  });
  it('the mash registers: the press rate is the speed, the full rate the top; no presses, no speed; the arcade top is the register\'s', () => {
    const ctx = ctxOf({ event: 'sprint', lanes: 1, players: 1, distance: 400, register: 'action', seed: 1 });
    const g = gunFrame(run(ctxOf({ event: 'sprint', lanes: 1, players: 0, register: 'action', seed: 1 })));
    const mash = (every) => { const S = newMeet(ctx); for (let i = 0; i < g + 3 * FPS; i++) stepMeet(S, [i > g && Math.floor(i / every) !== Math.floor((i - 1) / every) ? RUN : ZERO_PAD], ctx); return S.r[0].v; };
    const full = MEET_REGISTERS.action.full;
    expect(mash(FPS / full)).toBeGreaterThan(MEET_REGISTERS.action.top * 0.9);
    expect(mash(FPS / (full / 2))).toBeLessThan(MEET_REGISTERS.action.top * 0.6);
    expect(mash(FPS / (full / 2))).toBeGreaterThan(MEET_REGISTERS.action.top * 0.4);
    const idle = newMeet(ctx); for (let i = 0; i < g + 2 * FPS; i++) stepMeet(idle, [RUN], ctx);   // held, never released: one press
    expect(idle.r[0].v).toBeLessThan(0.5);
    const pin = run(ctxOf({ event: 'sprint', lanes: 1, players: 0, register: 'pinball', seed: 1 }));
    expect(Math.max(...pin.r.map((r) => r.v))).toBeGreaterThan(MEET_REGISTERS.action.top);
  });
});

describe('the hurdles', () => {
  const hurdleCtx = (register, players) => ctxOf({ event: 'hurdles', lanes: 2, players, register, seed: 4 });
  it('a hop pressed in the band clears the flight and keeps most of the speed; a flight met on the ground clips the runner and costs the run', () => {
    const ctx = hurdleCtx('action', 1), full = MEET_REGISTERS.action.full, every = FPS / full;
    const h0 = ctx.event.hurdles[0];
    // the mash, once the gun has gone (a press in the set would be a false start)
    const mashPad = (S) => (S.K.phase === 'live' && Math.floor(S.f / every) !== Math.floor((S.f - 1) / every) ? PAD.RUN : 0);
    // the player hops in the band before every flight
    const hopper = run(ctx, (S) => { const r = S.r[0], h = ctx.event.hurdles[r.next]; const inBand = h !== undefined && r.x >= h - HURDLE.band[0] + 0.3 && r.x <= h - HURDLE.band[1] - 0.1; return [{ b: mashPad(S) | (inBand && r.air === 0 ? PAD.JUMP : 0) }]; });
    expect(hopper.r[0].clips).toBe(0);
    expect(kinds(hopper).filter((k) => k === 'hop').length).toBeGreaterThanOrEqual(ctx.event.hurdles.length);
    // the player never hops: every flight clips, the run is slow
    const clipper = run(ctx, (S) => [{ b: mashPad(S) }]);
    expect(clipper.r[0].clips).toBe(ctx.event.hurdles.length);
    expect(clipper.placings.find((p) => p.who === 'r1').value).toBeGreaterThan(hopper.placings.find((p) => p.who === 'r1').value + 2);
    // a hop pressed too early (before the band) is nothing: the flight still clips
    const early = run(ctx, (S) => { const r = S.r[0], h = ctx.event.hurdles[r.next]; const soon = h !== undefined && r.x >= h - HURDLE.band[0] - 1.5 && r.x < h - HURDLE.band[0] - 0.2; return [{ b: mashPad(S) | (soon ? PAD.JUMP : 0) }]; });
    expect(early.r[0].clips).toBe(ctx.event.hurdles.length);
    expect(h0).toBeCloseTo(13.72, 3);
  });
  it('the realistic register takes the flights itself, on the stride; the computer lanes clear theirs', () => {
    const S = run(hurdleCtx('realistic', 1), () => [RUN]);
    expect(S.r.map((r) => r.clips)).toEqual([0, 0]);
    expect(S.over).toBe(true);
    const A = run(hurdleCtx('action', 0));
    expect(A.r.map((r) => r.clips)).toEqual([0, 0]);
  });
});

describe('the long jump', () => {
  const ctx = ctxOf({ event: 'longJump', lanes: 2, players: 1, attempts: 2, seed: 5 });
  it('a jump from the runway flies the arc of its speed and angle and is marked from the board; past the board a foul; three attempts then done; the best counts', () => {
    const board = ctx.event.board;
    const S = run(ctx, (S) => {
      const r = S.r[0];
      // the first attempt: jump 0.6 m before the board; the second: past it (a foul)
      const at = r.attempt === 0 ? board - 0.6 : board + 0.2;
      const go = r.air === 0 && r.hop === null && r.x >= at;
      return [{ b: PAD.RUN | (go ? PAD.JUMP : 0) }];
    });
    const marks = S.calls.filter((c) => c.kind === 'mark' && c.who === 'r1'), offs = S.calls.filter((c) => c.kind === 'takeoff' && c.who === 'r1');
    expect(marks.length).toBe(2); expect(offs.length).toBe(2);
    const R = MEET_REGISTERS.realistic, a = (R.jumpAngle * Math.PI) / 180;
    expect(offs[0].foul).toBe(false); expect(offs[0].at).toBeLessThan(board); expect(offs[1].foul).toBe(true);
    expect(marks[0].foul).toBe(false);
    expect(marks[0].value).toBeCloseTo(offs[0].at + (offs[0].v * offs[0].v * Math.sin(2 * a)) / R.g - board, 2);
    expect(marks[1]).toMatchObject({ foul: true, value: null });
    expect(S.K.lanes.r1.best).toBe(marks[0].value);
    expect(S.r[0].done).toBe(true); expect(S.over).toBe(true);
    expect(S.placings.every((p) => p.place !== null)).toBe(true);
  });
  it('running through the board without a jump is a foul, and the runner walks back for the next attempt', () => {
    const S = run(ctx, () => [RUN]);
    const marks = S.calls.filter((c) => c.kind === 'mark' && c.who === 'r1');
    expect(marks.map((m) => m.foul)).toEqual([true, true]);
    expect(S.placings.find((p) => p.who === 'r1')).toMatchObject({ place: null, value: null });
    expect(S.placings.find((p) => p.who === 'r2').place).toBe(1);
  });
});

describe('pure and seeded', () => {
  it('the same seed and pads are the same meet to the byte; a clone is a copy; another seed another gun', () => {
    const ctx = ctxOf({ event: 'hurdles', lanes: 3, players: 1, register: 'action', seed: 9 });
    const pads = (S) => [{ b: (S.f % 7 === 0 ? PAD.RUN : 0) | (S.f % 50 === 0 ? PAD.JUMP : 0) }];
    const a = run(ctx, pads), b = run(ctx, pads);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = cloneMeet(a); c.r[0].x = -1; expect(a.r[0].x).not.toBe(-1);
    const other = run(ctxOf({ event: 'hurdles', lanes: 3, players: 1, register: 'action', seed: 10 }), pads);
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(a));
    // a different seed changes the computers' habits too: the lanes do not tie
    const times = run(ctxOf({ event: 'sprint', lanes: 4, players: 0, seed: 3 })).placings.map((p) => p.value);
    expect(new Set(times).size).toBe(4);
  });
});
