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
import { ARCADE_SPORT_IDS } from './arcade-rules.js';
import { resolveSport } from './sports.js';
import { airDrag } from './ball-card.js';

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

// the arcade rules' dials on the court, each on the card that carries it (chosen in code)
const cardWith = (pick) => ARCADE_SPORT_IDS.find((id) => pick(resolveSport(id)));
const rallies = (S) => { const out = []; let k = 0; for (const c of S.calls) { if (c.kind === 'hit') k++; if (c.kind === 'point' || c.kind === 'fault' || c.kind === 'let') { out.push(k); k = 0; } } return out; };

describe('the arcade rules on the court', () => {
  it('a raised bed: the court a slab whose top is the bed, the floor below it, the net on it; a stroke never from under it', () => {
    const sport = cardWith((s) => s.bed), ctx = ctxOf({ sport, players: 0, register: 'action', seed: 2 }), S = newMatch(ctx);
    const bed = ctx.sport.bed.height, [, floor, ground, net] = S.sim.bodies;
    expect(floor).toMatchObject({ id: 'floor', collider: 'aabb' });
    expect(floor.position[2] + floor.half[2]).toBeCloseTo(bed, 6);
    expect(ground).toMatchObject({ id: 'ground', collider: 'plane' });
    expect(net.position[2] - net.half[2]).toBeCloseTo(bed, 3);
    // the arcade's serve bounces on its own half first, every time; every stroke is over the bed's top
    const E = run(ctx, null, (S) => S.over, 60 * 300);
    expect(E.over).toBe(true);
    const hits = calls(E, 'hit');
    for (const h of hits) expect(h.at[2]).toBeGreaterThan(bed);
    expect(hits.filter((h) => h.aim && h.aim.own).length).toBe(calls(E, 'serve').length);
    expect(E.calls.filter((c) => c.kind === 'point' && (c.why === 'double-fault' || c.why === 'own-side')).length).toBe(0);
  });
  it('the realistic serve that bounces on its own half: the mind finds the lift on a copy of the physics, and it lands', () => {
    const sport = cardWith((s) => s.spec().serve.bounce === 'own'), ctx = ctxOf({ sport, players: 0, register: 'realistic', seed: 2 });
    const S = run(ctx, null, (S) => calls(S, 'point').length >= 6, 60 * 120);
    expect(S.calls.filter((c) => c.kind === 'point' && c.why === 'double-fault').length).toBeLessThan(3);
  });
  it('a no-volley region: a volley struck from it is the foul of its name and the point; off the bounce it plays', () => {
    const sport = cardWith((s) => s.noVolley), ctx = ctxOf({ sport, players: 1, register: 'realistic', seed: 2 });
    const volley = (bounces) => {
      const S = newMatch(ctx), a1 = S.p[0], b = S.sim.bodies[0];
      S.K = { ...S.K, phase: 'live', restart: null, server: 'b', ball: { side: 'b', lastSide: 'b', lastWho: 'b1', bounces, touches: 1, serving: false, netted: false, passAt: null, returns: 2 } };
      S.phase = 'live'; S.ball.held = null;
      Object.assign(a1, { x: 0, y: -1, vx: 0, vy: 0 });
      b.position = [0.4, -0.7, 1.2]; b.velocity = [0, 0, 0];
      for (let i = 0; i < 40 && !calls(S, 'point').length && !calls(S, 'hit').length; i++) stepMatch(S, [i === 0 ? SWING : REST], ctx);
      return S;
    };
    const S = volley(0);
    expect(calls(S, 'foul')[0]).toMatchObject({ foul: ctx.sport.noVolley, who: 'a1', cost: 'point' });
    expect(calls(S, 'point')[0]).toMatchObject({ side: 'b', why: ctx.sport.noVolley });
    expect(calls(volley(1), 'foul')).toEqual([]);   // off the bounce: no foul
  });
  it('the arcade\'s slip: the computer lets the card\'s share of balls go, so a small court\'s rally ends; without it, it runs on', () => {
    const sport = cardWith((s) => s.slip && s.bed);
    const longest = (v) => Math.max(0, ...rallies(run(ctxOf({ sport: v, players: 0, register: 'action', seed: 4 }), null, (S) => calls(S, 'point').length >= 6, 60 * 90)));
    const without = run(ctxOf({ sport: { id: 'no-slip', from: sport, cpu: { slip: 0 } }, players: 0, register: 'action', seed: 4 }), null, (S) => calls(S, 'hit').length >= 60, 60 * 90);
    expect(calls(without, 'point').length).toBe(0);   // sixty hits and no point: the minds never miss on a table
    expect(longest(sport)).toBeLessThan(60);
  });
  it('a side of more than one: its players at their homes across it, the pad on its active one (never the last to touch), the passes placed for a teammate', () => {
    const sport = cardWith((s) => s.players > 1 && s.assist === 'pass'), ctx = ctxOf({ sport, players: 1, register: 'action', seed: 6 }), S = newMatch(ctx);
    const n = ctx.C.players;
    expect(S.p.map((P) => P.id)).toEqual([...Array.from({ length: n }, (_, i) => `a${i + 1}`), ...Array.from({ length: n }, (_, i) => `b${i + 1}`)]);
    expect(S.minds.length).toBe(2 * n);
    const rc = S.K.server === 'a' ? 'b' : 'a', xs = S.p.filter((P) => P.side === rc).map((P) => P.x);
    expect(new Set(xs).size).toBe(n);   // across the side, not stacked
    // the pad moves side a's active player only; an exhibition's every touch obeys the rally (no side touches four times,
    // nobody twice in a row) and each placed pass is played next by the teammate it was placed for, or dies on its side
    const E = run(ctxOf({ sport, players: 0, register: 'action', seed: 6 }), null, (S) => S.over || calls(S, 'point').length >= 12, 60 * 240);
    expect(E.calls.filter((c) => c.kind === 'point' && (c.why === 'touches' || c.why === 'double-touch' || c.why === 'touched-own-serve')).length).toBe(0);
    const hits = calls(E, 'hit'), passes = hits.filter((h) => h.pass);
    expect(passes.length).toBeGreaterThan(5);
    for (const p of passes) {
      const next = E.calls.find((c) => c.f > p.f && (c.kind === 'hit' || c.kind === 'point'));
      if (next && next.kind === 'hit') expect(next.who).toBe(p.pass.for);
    }
    // a three-touch rally: a bump, a set, then over the net
    expect(hits.some((h, i) => h.verb === 'bump' && hits[i + 1] && hits[i + 1].verb === 'set' && hits[i + 2] && !hits[i + 2].pass)).toBe(true);
    // the pad: with a player at it, side a's active player is the one it drives
    const H = newMatch(ctx);
    for (let i = 0; i < 400; i++) stepMatch(H, [{ x: 1, y: 0, b: 0 }], ctx);
    expect(H.active.a).toMatch(/^a/);
  });
  it('a ball whose air is its own (the shuttle): the aim flies it through that air and lands at the depth', () => {
    const ball = resolveSport(cardWith((s) => airDrag(s.ball) > 0)).ball, k = airDrag(ball), g = 9.81;
    const A = aimedShot(30, 2, 8, g, { at: 4, height: 1.524 }, k);
    // the shot flown as a point in that air (a finer step than the aim's) lands at the aim's depth
    let x = 0, z = 2, vx = A.speed * Math.cos(A.elevationDeg * Math.PI / 180), vz = A.speed * Math.sin(A.elevationDeg * Math.PI / 180), cleared = false;
    while (z > 0) { const sp = Math.hypot(vx, vz), dt = 1 / 1000; vx -= k * sp * vx * dt; vz -= (g + k * sp * vz) * dt; const px = x; x += vx * dt; z += vz * dt; if (px < 4 && x >= 4) cleared = z > 1.524; }
    expect(x).toBeGreaterThan(7.6); expect(x).toBeLessThan(8.5); expect(cleared).toBe(true);
    expect(aimedShot(30, 2, 8, g, { at: 4, height: 1.524 }).speed).toBeLessThan(A.speed);   // the vacuum gives speed up: the air shortens it
  });
});
