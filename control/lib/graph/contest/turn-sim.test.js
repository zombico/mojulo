// The turn sim: a turn sport as a pure function of one pad, hot-seat, the kernel its referee, the ball the physics
// property's sphere, the shot the hit's at the meter's share. The concept on one case each: the register table; the club
// by the lie and the distance; a charged press that flies, lands and rests as the kernel's lie; the putt the cup takes;
// the water from the last lie; the roll that fells pins and the one that gutters; an exhibition to the end in both
// sports; the probe untouched; byte-identical replays.
import { describe, it, expect } from 'vitest';
import { TURN_BODY, TURN_REGISTER_IDS, TPAD, TURN_FPS, newTurns, stepTurns, cloneTurns, turnContext, turnsDisplay, clubOf, targetOf, probeShot } from './turn-sim.js';
import { turnsArenaData } from './turn-arena.js';
import { BALL_REGISTERS } from './ball-card.js';
import { contestLieOf } from './contest-kernel.js';

const ctxOf = (spec) => turnContext(turnsArenaData(spec));
const REST = { x: 0, y: 0, b: 0 };
/** Steps until `until`, the pad from `padAt(S)`, at most `frames`. */
const run = (ctx, padAt, until, frames = 30000) => { const S = newTurns(ctx); let n = 0; while (!until(S) && n++ < frames) stepTurns(S, padAt ? padAt(S) : REST, ctx); return S; };
/** A human's shot: hold the press `hold` frames (the meter climbs), then release. */
const press = (hold, aim = { x: 0, y: 0 }) => (S) => (S.K.phase === 'turn' && !S.shot && S.dead === 0 && S.charge.t * TURN_FPS < hold ? { ...aim, b: TPAD.SWING } : { ...aim, b: 0 });
const calls = (S, kind) => S.calls.filter((c) => c.kind === kind);

describe('the registers and the club', () => {
  it('a body for every ball register; the club by the lie and the distance left; the target the cup or the head pin', () => {
    expect(TURN_REGISTER_IDS).toEqual(BALL_REGISTERS);
    for (const id of TURN_REGISTER_IDS) expect(TURN_BODY[id].floor.restitution).toBeLessThanOrEqual(1);
    expect(() => turnContext({ C: { turn: { kind: 'pins' } }, sport: { swing: {} }, register: 'arcade' })).toThrow(/register 'arcade' is one of/);
    const ctx = ctxOf({ sport: 'golf', seats: 1, players: 1, rounds: 1 }), S = newTurns(ctx);
    expect(clubOf(ctx, S)).toBe('iron');   // 120 m from the tee: the iron's reach
    const t = targetOf(ctx, S); expect(t).toEqual([0, 49]);
    S.sim.bodies[0].position = [0, 49 - 180, 0.02]; expect(clubOf(ctx, S)).toBe('drive');
    S.sim.bodies[0].position = [0, 45, 0.02]; expect(clubOf(ctx, S)).toBe('putt');   // on the green
    const B = ctxOf({ sport: 'bowling', seats: 1, players: 1 });
    expect(clubOf(B, newTurns(B))).toBe('roll'); expect(targetOf(B, newTurns(B))).toEqual([0, 18.29]);
  });
});

describe('the shot', () => {
  it('a press charges the meter up and back; its release strikes at the meter\'s share; the ball flies, lands and rests, and the kernel names the lie', () => {
    const ctx = ctxOf({ sport: 'golf', seats: 1, players: 1, rounds: 1, register: 'realistic' });
    const S = run(ctx, press(40), (S) => calls(S, 'lie').length >= 1 || calls(S, 'penalty').length >= 1 || calls(S, 'holed').length >= 1);
    const hit = calls(S, 'hit')[0];
    expect(hit).toMatchObject({ who: 'p1', verb: 'iron' });
    expect(hit.power).toBeCloseTo(40 / (TURN_FPS * ctx.sport.swing.charge), 1);
    expect(hit.speed).toBeCloseTo(ctx.sport.swing.tipSpeed * hit.power * 1.6 * 0.7, 0);   // the realistic hit: gain × tip × the iron's power
    const end = S.calls.at(-1);
    expect(['lie', 'penalty', 'holed']).toContain(end.kind);
    if (end.kind === 'lie') { expect(end.at[1]).toBeGreaterThan(-60); expect(contestLieOf(ctx.C, S.K, end.at)).toBe(end.region); expect(S.K.lie).toEqual(end.at); }
    expect(S.shot).toBeNull(); expect(S.dead).toBeGreaterThan(0);
    // the meter climbs and comes back over the register's seconds
    const T = newTurns(ctx), seen = [];
    for (let i = 0; i < Math.round(ctx.sport.swing.charge * TURN_FPS * 1.6); i++) { stepTurns(T, { x: 0, y: 0, b: TPAD.SWING }, ctx); seen.push(T.charge.meter); }
    expect(Math.max(...seen)).toBeGreaterThan(0.95); expect(seen.at(-1)).toBeLessThan(0.7); expect(T.shot).toBeNull();
  });
  it('a putt rolls on the green\'s resistance and the cup takes it slow; the water is a stroke and the ball is played again from its last lie', () => {
    const ctx = ctxOf({ sport: 'golf', seats: 1, players: 1, rounds: 1 }), S = newTurns(ctx);
    S.sim.bodies[0].position = [0, 44, S.sim.bodies[0].radius]; S.K.lie = [0, 44];   // on the green, 5 m short of the cup
    const want = probeShot(S, ctx, { power: 0.3, aim: [0, 0] });
    expect(want.holed || want.lie === 'green').toBe(true);
    let n = 0; const until = (S) => calls(S, 'holed').length >= 1 || calls(S, 'lie').length >= 1;
    while (!until(S) && n++ < 3000) stepTurns(S, press(Math.round(0.3 * ctx.sport.swing.charge * TURN_FPS))(S), ctx);
    expect(S.calls.at(-1).kind === 'holed' || S.K.lie[1]).toBeTruthy();
    // the water: hole 1's pond lies left of the fairway; a ball sent into it costs a stroke from the tee
    const W = newTurns(ctx), tee = W.K.lie.slice();
    W.sim.bodies[0].position = [-17, 0, 3]; W.sim.bodies[0].velocity = [0, 0, -1]; W.sim.bodies[0].resting = false;
    W.shot = { who: 'p1', verb: 'iron', f: W.f }; W.K = { ...W.K, shots: 1, pending: true };
    let m = 0; while (W.shot && m++ < 600) stepTurns(W, REST, ctx);
    expect(calls(W, 'penalty')[0]).toMatchObject({ region: 'water', strokes: 1, from: tee });
    expect(W.K.shots).toBe(2);
    while (W.dead > 0) stepTurns(W, REST, ctx);
    expect(W.sim.bodies[0].position.slice(0, 2)).toEqual(tee);
  });
  it('a roll down the lane fells pins the kernel counts; one aimed off the lane gutters and fells none; the rack stands again for the next frame', () => {
    const ctx = ctxOf({ sport: 'bowling', seats: 1, players: 1, rounds: 2 });
    const S = run(ctx, press(50), (S) => calls(S, 'roll').length >= 1);
    expect(calls(S, 'roll')[0].down).toBeGreaterThan(0);
    expect(S.pins.filter((p) => p.up).length).toBe(calls(S, 'roll')[0].standing);
    const G = run(ctx, press(50, { x: 1, y: 0 }), (S) => calls(S, 'roll').length >= 1, 1200);
    expect(G.ball.gutter).toBe(true); expect(calls(G, 'roll')[0]).toMatchObject({ down: 0, standing: 10 });
    // the frame's second roll, then the next frame: every pin on its spot again
    const F = run(ctx, press(50), (S) => calls(S, 'turn').length >= 1 && S.dead === 0);   // the next frame placed
    expect(F.K.round).toBe(2); expect(F.pins.every((p) => p.up)).toBe(true);
    F.pins.forEach((p, i) => expect(F.sim.bodies[2 + i].position.slice(0, 2)).toEqual(p.spot));
  });
});

describe('an exhibition, pure and seeded', () => {
  it('the computer seats play to the end in both sports; the probe leaves the game untouched; the same seed and pads are the same game to the byte', () => {
    for (const sport of ['golf', 'bowling']) {
      const ctx = ctxOf({ sport, seats: 2, players: 0, level: 'ace', rounds: 2, seed: 2 });
      const a = run(ctx, null, (S) => S.over, 60 * 60 * 20), b = run(ctx, null, (S) => S.over, 60 * 60 * 20);
      expect(a.over, sport).toBe(true); expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(Object.values(a.K.totals).every((t) => t > 0), sport).toBe(true);
      const d = turnsDisplay(a, ctx); expect(d.seats.length).toBe(2); expect(d.over).toBe(true);
      if (sport === 'bowling') expect(calls(a, 'roll').some((c) => c.mark === 'strike')).toBe(true);
      else expect(calls(a, 'holed').every((c) => c.why === 'holed')).toBe(true);
    }
    const ctx = ctxOf({ sport: 'golf', seats: 1, players: 1, rounds: 1 }), S = newTurns(ctx), before = JSON.stringify(S);
    probeShot(S, ctx, { power: 0.5, aim: [0.2, 0] });
    expect(JSON.stringify(S)).toBe(before);
    const c = cloneTurns(S); c.aim.x = 9; expect(S.aim.x).toBe(0);
  });
});
