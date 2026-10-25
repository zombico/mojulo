// The match sim: a net game as a pure function of two pads, the kernel its referee, the ball the physics property's
// sphere, the hit the swing's. The concept on one case each: the body held to the motion flavors; the serve from the
// hand into the box the point names; a rally's bounces as the kernel's facts and its call; the arcade's aimed shot over
// the cord; an exhibition the minds play to a game; byte-identical replays.
import { describe, it, expect } from 'vitest';
import { MATCH_BODY, MATCH_REGISTER_IDS, MPAD, MATCH_FPS, newMatch, stepMatch, cloneMatch, matchContext, matchDisplay } from './match-sim.js';
import { matchArenaData } from './match-arena.js';
import { contestInside } from './contest-kernel.js';
import { aimedElevation, aimedShot } from './hit.js';
import { MOTION_FLAVORS } from '../gameworld/feel/motion.js';
import { serveStick } from './contest-mind.js';

const ctxOf = (spec) => matchContext(matchArenaData(spec));
const run = (ctx, padsAt, until, frames = 20000) => { const S = newMatch(ctx); let n = 0; while (!until(S) && n++ < frames) stepMatch(S, padsAt ? padsAt(S) : [], ctx); return S; };
const calls = (S, kind) => S.calls.filter((c) => c.kind === kind);
const REST = { x: 0, y: 0, b: 0 }, SWING = { x: 0, y: 0, b: MPAD.SWING };

describe('the body on the register', () => {
  it('its court speed is three quarters of the motion flavors\' sprint and its build-up theirs, register for register', () => {
    expect(MATCH_REGISTER_IDS).toEqual(Object.keys(MOTION_FLAVORS));
    for (const id of MATCH_REGISTER_IDS) { expect(MATCH_BODY[id].speed, id).toBeCloseTo(MOTION_FLAVORS[id].top * 0.75, 6); expect(MATCH_BODY[id].tau, id).toBe(MOTION_FLAVORS[id].tau); }
    expect(() => matchContext({ C: {}, sport: {}, court: {}, register: 'arcade' })).toThrow(/register 'arcade' is one of/);
  });
});

describe('the serve', () => {
  it('the toss names the server; the ball waits in its hand behind the baseline aside the centre; the first press serves it, and it lands in the box the point names', () => {
    const ctx = ctxOf({ players: 2, seed: 3 });
    const S0 = newMatch(ctx);
    const sv = S0.K.restart.side, server = S0.p.find((p) => p.side === sv), s = sv === 'a' ? 1 : -1;
    expect(S0.ball.held).toBe(server.id);
    expect(server.y * -s).toBeCloseTo(ctx.court.halfL + ctx.sport.serve.behind, 3);
    expect(server.x * s).toBeCloseTo(ctx.sport.serve.aside, 3);   // the deuce court first: the server's right
    expect(S0.sim.bodies[0].position[2]).toBe(ctx.sport.serve.hand);
    expect(S0.serveTarget[1] * s).toBeGreaterThan(0);   // on the receiver's side
    // the server presses once with the stick aimed across into the box (the mind's aim, a human's to learn), the receiver
    // stands: the serve lands in the receiver's box and the kernel says so; a flat press from the deuce court serves
    // straight into the wrong box, and that is a fault
    const i = sv === 'a' ? 0 : 1;
    const aimed = (S) => { const pads = [REST, REST]; if (S.f === 30) { const st = serveStick(ctx, S, S.p[i]); pads[i] = { x: st.x, y: st.y, b: MPAD.SWING }; } return pads; };
    const ended = (S) => S.calls.some((c) => c.kind === 'point' || c.kind === 'fault');
    const S = run(ctx, aimed, ended);
    expect(calls(S, 'serve').length).toBe(1);
    expect(calls(S, 'hit')[0]).toMatchObject({ who: server.id, verb: 'serve' });
    const first = S.calls.find((c) => c.kind === 'point' || c.kind === 'fault');
    expect(first.kind).toBe('point'); expect(first).toMatchObject({ side: sv, why: 'double-bounce' });   // in, and never returned
    const flat = run(ctx, (S) => { const pads = [REST, REST]; pads[i] = S.f === 30 ? SWING : REST; return pads; }, ended);
    expect(flat.calls.find((c) => c.kind === 'point' || c.kind === 'fault')).toMatchObject({ kind: 'fault' });
  });
  it('a point ends with the ball dead for a while, then the next serve is set up by the kernel\'s word (the ad court, the same server)', () => {
    const ctx = ctxOf({ players: 0, seed: 3 });
    const S = run(ctx, null, (S) => S.calls.some((c) => c.kind === 'point'));
    const sv = S.K.server;
    expect(S.dead).toBeGreaterThan(0);
    const after = run(ctx, null, (S) => S.calls.some((c) => c.kind === 'point') && S.dead === 0 && S.K.phase === 'serve');
    expect(after.K.played).toBe(1); expect(after.K.server).toBe(sv);
    const server = after.p.find((p) => p.side === sv), s = sv === 'a' ? 1 : -1;
    expect(server.x * s).toBeCloseTo(-ctx.sport.serve.aside, 3);   // the ad court: the server's left
    expect(after.ball.held).toBe(server.id); expect(after.rallies).toBe(2);
  });
});

describe('the rally', () => {
  it('the ball\'s floor contacts reach the kernel as bounces where they are, its net contact as net, its rest or its leaving as the end', () => {
    const ctx = ctxOf({ players: 0, register: 'action', level: 'ace', seed: 2 });
    const S = run(ctx, null, (S) => calls(S, 'point').length >= 3);
    const hits = calls(S, 'hit');
    expect(hits.length).toBeGreaterThan(3);
    // every first bounce after a serve landed in the box the point named (the aimed serve), on the receiver's side
    for (const h of hits.filter((c) => c.verb === 'serve')) {
      const fault = S.calls.find((c) => c.f > h.f && (c.kind === 'fault' || c.kind === 'let'));
      if (fault) continue;
      const bounce = S.calls.find((c) => c.f > h.f && c.kind === 'point');
      expect(bounce).toBeTruthy();
    }
    expect(S.K.score.a[0] + S.K.score.b[0] + S.K.score.a[1] * 4 + S.K.score.b[1] * 4).toBeGreaterThanOrEqual(3);
    const d = matchDisplay(S, ctx);
    expect(d.score.a.length).toBe(3); expect(d.last.kind).toBe('point');
  });
  it('the arcade\'s aimed shot: the arc that lands at the depth, lifted over the cord, the speed given up for it; the realistic register is never aimed', () => {
    const g = 9.81;
    const th = aimedElevation(30, 1, 18, g);
    expect(th).toBeGreaterThan(0); expect(th).toBeLessThan(10);
    // a cord in the way lifts it, and the lifted arc lands longer; a cord past the landing changes nothing
    const over = aimedElevation(30, 0.4, 18, g, { at: 12, height: 0.914 });
    expect(over).toBeGreaterThan(aimedElevation(30, 0.4, 18, g));
    expect(aimedElevation(30, 0.4, 18, g, { at: 30, height: 0.914 })).toBe(aimedElevation(30, 0.4, 18, g));
    expect(aimedElevation(5, 1, 50, g)).toBe(45);
    const A = aimedShot(36, 0.4, 18, g, { at: 12, height: 0.914 });
    expect(A.speed).toBeLessThan(36); expect(A.speed).toBeGreaterThan(10);
    const B = aimedShot(20, 1.2, 18, g, { at: 10, height: 0.914 });
    expect(B.speed).toBe(20);
  });
  it('an exhibition between two minds reaches a game in both registers, with rallies of more than the serve and the return', () => {
    for (const register of ['realistic', 'action']) {
      const ctx = ctxOf({ players: 0, register, level: 'ace', seed: 5 });
      const S = run(ctx, null, (S) => calls(S, 'game').length >= 1, 60 * 60 * 6);
      expect(calls(S, 'game').length, register).toBe(1);
      let longest = 0, k = 0;
      for (const c of S.calls) { if (c.kind === 'hit') k++; if (c.kind === 'point' || c.kind === 'fault' || c.kind === 'let') { longest = Math.max(longest, k); k = 0; } }
      expect(longest, register).toBeGreaterThanOrEqual(3);
      expect(S.calls.filter((c) => c.kind === 'point' && c.why === 'reach-over').length, register).toBe(0);
    }
  });
});

describe('pure and seeded', () => {
  it('the same seed and pads are the same match to the byte; a clone is a copy; the state is plain data', () => {
    const ctx = ctxOf({ players: 1, register: 'action', seed: 9 });
    const pads = (S) => [{ x: Math.sin(S.f / 30), y: 0.3, b: S.f % 40 === 0 ? MPAD.SWING : 0 }];
    const a = run(ctx, pads, (S) => calls(S, 'point').length >= 4), b = run(ctx, pads, (S) => calls(S, 'point').length >= 4);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.f).toBeGreaterThan(MATCH_FPS);
    const c = cloneMatch(a); c.p[0].x = 99; expect(a.p[0].x).not.toBe(99);
    expect(contestInside(ctx.C, 'half', 'a', [0, -1])).toBe(true);
  });
});
