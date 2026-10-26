// The team sim: a goal game as a pure function of two pads, the kernel its referee, the ball the physics property's
// sphere, the kick the leg's strike, the roles the positional mind's. The concept on one case each: the body on the
// register; the pad's active player and its kick (a tap a pass, a hold a shot); the carry; a goal, an out and their
// restarts; the keeper's save; an exhibition to the final whistle in both sports; byte-identical replays.
import { describe, it, expect } from 'vitest';
import { TEAM_BODY, TEAM_REGISTER_IDS, GPAD, TEAM_FPS, newTeam, stepTeam, cloneTeam, teamContext, teamDisplay } from './team-sim.js';
import { teamArenaData } from './team-arena.js';
import { MATCH_BODY } from './match-sim.js';

const ctxOf = (spec) => teamContext(teamArenaData(spec));
const REST = { x: 0, y: 0, b: 0 };
const run = (ctx, padsAt, until, frames = 40000) => { const S = newTeam(ctx); let n = 0; while (!until(S) && n++ < frames) stepTeam(S, padsAt ? padsAt(S) : [], ctx); return S; };
const calls = (S, kind) => S.calls.filter((c) => c.kind === kind);
const ball = (S) => S.sim.bodies[0];
/** The kickoff side's pad (the toss is the kernel's): index 0 is a, 1 is b. */
const koPad = (S) => (S.K.restart && S.K.restart.side === 'b' ? 1 : 0);
const padsFor = (i, pad) => (i === 0 ? [pad, REST] : [REST, pad]);
/** Play resumed: the kickoff side taps the ball forward (toward the other goal), then everyone rests. */
function kickoff(S, ctx) {
  const i = koPad(S), dir = i === 0 ? 1 : -1;
  for (let f = 0; f < 60 && !S.calls.some((c) => c.kind === 'live'); f++) stepTeam(S, padsFor(i, { x: 0, y: dir, b: f < 5 ? GPAD.KICK : 0 }), ctx);
  return i;
}

describe('the body and the sides', () => {
  it('the body is the match sim\'s, register for register; the sides are the book\'s roles each at its home, mirrored; the computer holds the sides nobody does', () => {
    expect(TEAM_REGISTER_IDS).toEqual(Object.keys(MATCH_BODY));
    for (const id of TEAM_REGISTER_IDS) expect(TEAM_BODY[id]).toEqual({ speed: MATCH_BODY[id].speed, tau: MATCH_BODY[id].tau });
    expect(() => teamContext({ C: {}, sport: {}, court: {}, register: 'arcade' })).toThrow(/register 'arcade' is one of/);
    const ctx = ctxOf({ sport: 'soccer', players: 1 }), S = newTeam(ctx);
    expect(S.p.length).toBe(10); expect(S.p.map((P) => P.role).slice(0, 5)).toEqual(['keeper', 'back', 'mid', 'wing', 'striker']);
    const a1 = S.p.find((P) => P.id === 'a1'), b1 = S.p.find((P) => P.id === 'b1');
    expect(a1.home).toEqual([0, -23]); expect(b1.home).toEqual([0, 23]);
    expect(Object.keys(S.minds)).toEqual(['b']);
    expect(ctxOf({ sport: 'hockey', players: 0 }).sport.ground.boards).toBe(true);
  });
});

describe('the pad', () => {
  it('drives the side\'s player nearest the ball; a tap passes along the ground, a hold shoots harder and higher; the kernel hears each touch', () => {
    const ctx = ctxOf({ sport: 'soccer', players: 2, seed: 2 });
    // the kickoff side's taker is active at its pad; a tap kicks it forward
    const i = koPad(newTeam(ctx)), side = i === 0 ? 'a' : 'b', dir = i === 0 ? 1 : -1;
    const S = run(ctx, (S) => padsFor(i, S.f < 20 ? { x: 0, y: dir, b: GPAD.KICK } : REST), (S) => calls(S, 'kick').length >= 1, 300);
    const tap = calls(S, 'kick')[0];
    expect(tap.who).toBe(S.active[side]); expect(tap.who[0]).toBe(side); expect(tap.power).toBeCloseTo(ctx.sport.kick.pass, 3);
    expect(calls(S, 'live').length).toBe(1);   // the touch resumed play
    expect(S.K.ball.lastWho).toBe(tap.who);
    // a hold: the charge climbs over the sport's seconds, the release is a shot at full power
    const T = run(ctx, (S) => padsFor(i, S.f < 70 ? { x: 0, y: dir, b: GPAD.KICK } : REST), (S) => calls(S, 'kick').length >= 1, 300);
    const shot = calls(T, 'kick')[0];
    expect(shot.power).toBe(1); expect(shot.speed).toBeGreaterThan(tap.speed * 1.5);
    expect(ball(T).velocity[2]).toBeGreaterThan(ball(S).velocity[2]);
  });
  it('a player running at a slow ball carries it ahead of the feet; the second pad\'s side is b', () => {
    const ctx = ctxOf({ sport: 'soccer', players: 2, seed: 2 }), S = newTeam(ctx);
    // play live, the ball a step ahead of the kickoff side's active player, who then runs forward: it carries the ball
    const i = kickoff(S, ctx), side = i === 0 ? 'a' : 'b', dir = i === 0 ? 1 : -1;
    const A = S.p.find((P) => P.id === S.active[side]), b0 = ball(S);
    b0.position = [A.x, A.y + dir * 0.8, b0.radius]; b0.velocity = [0, 0, 0]; b0.resting = true;
    const y0 = A.y;
    for (let f = 0; f < 120; f++) stepTeam(S, padsFor(i, { x: 0, y: dir, b: 0 }), ctx);
    expect(A.side).toBe(side); expect((A.y - y0) * dir).toBeGreaterThan(3);
    expect(Math.hypot(ball(S).position[0] - A.x, ball(S).position[1] - A.y)).toBeLessThan(ctx.sport.kick.reach);
    expect(ball(S).position[1] * dir).toBeGreaterThan(A.y * dir);
    expect(S.K.ball.lastWho).toBe(A.id);
    // the other pad moves the other side's active player once play is live
    const U = newTeam(ctx); kickoff(U, ctx);
    const j = 1 - i, other = j === 0 ? 'a' : 'b';
    for (let f = 0; f < 120; f++) stepTeam(U, padsFor(j, { x: 1, y: 0, b: 0 }), ctx);
    const B = U.p.find((P) => P.id === U.active[other]);
    expect(B.side).toBe(other); expect(B.x).toBeGreaterThan(B.home[0] + 1);
  });
});

describe('the referee', () => {
  it('a ball over the goal line between the posts is a goal and the conceding side kicks off; over the touchline a throw-in where it went', () => {
    const ctx = ctxOf({ sport: 'soccer', players: 2, seed: 3 });
    const S = newTeam(ctx); kickoff(S, ctx);
    // the ball is set rolling into b's goal, past its keeper
    const b = ball(S); b.position = [1.5, 24.2, b.radius]; b.velocity = [0, 10, 0]; b.resting = false;
    let n = 0; while (!S.calls.some((c) => c.kind === 'score') && n++ < 300) stepTeam(S, [REST, REST], ctx);
    expect(S.calls.find((c) => c.kind === 'score')).toMatchObject({ side: 'a' }); expect(S.K.score).toEqual({ a: [1], b: [0] });
    expect(S.K.restart).toMatchObject({ kind: 'kickoff', side: 'b' });
    while (S.dead > 0) stepTeam(S, [REST, REST], ctx);
    expect(ball(S).position.slice(0, 2)).toEqual([0, 0]); expect(S.active.b).toBeTruthy();
    // a throw-in: the ball over the touchline on b's touch
    const T = newTeam(ctx); kickoff(T, ctx);
    const tb = ball(T); tb.position = [14, -5, tb.radius]; tb.velocity = [12, 0, 0]; tb.resting = false;
    T.K = { ...T.K, ball: { ...T.K.ball, lastSide: 'b', lastWho: 'b3' } };   // b touched it last
    n = 0; while (!T.calls.some((c) => c.kind === 'out') && n++ < 120) stepTeam(T, [REST, REST], ctx);
    expect(T.calls.find((c) => c.kind === 'out').restart).toMatchObject({ kind: 'throw-in', side: 'a' });   // b touched it last: a throws in
    while (T.dead > 0) stepTeam(T, [REST, REST], ctx);
    expect(ball(T).position[0]).toBeCloseTo(ctx.court.halfW - 0.3, 3);
    const taker = T.p.find((P) => P.id === T.active.a); expect(taker.side).toBe('a'); expect(Math.hypot(taker.x - ball(T).position[0], taker.y - ball(T).position[1])).toBeLessThan(1.2);
  });
  it('the keeper saves a ball coming at it; a puck never leaves the rink', () => {
    const ctx = ctxOf({ sport: 'soccer', players: 2, seed: 3 }), S = newTeam(ctx); kickoff(S, ctx);
    const k = S.p.find((P) => P.id === 'b1'), b = ball(S);
    b.position = [k.x, k.y - 1.0, b.radius]; b.velocity = [0, 9, 0.2]; b.resting = false;
    let n = 0; while (!S.calls.some((c) => c.kind === 'save' || c.kind === 'score') && n++ < 60) stepTeam(S, [REST, REST], ctx);
    expect(S.calls.find((c) => c.kind === 'save')).toMatchObject({ who: 'b1' }); expect(ball(S).velocity[1]).toBeLessThan(0);
    const H = ctxOf({ sport: 'hockey', players: 0, seconds: 30, seed: 2 });
    const R = run(H, null, (S) => S.K.clock && S.K.clock.period === 2, 60 * 60 * 3);
    expect(calls(R, 'out').length).toBe(0);
    for (const f of [0, 1]) { const S2 = run(H, null, (S) => S.f >= 600, 700); expect(Math.abs(ball(S2).position[0])).toBeLessThan(H.court.halfW + 0.5); expect(Math.abs(ball(S2).position[1])).toBeLessThan(H.court.halfL + 0.5); void f; }
  });
});

describe('an exhibition, pure and seeded', () => {
  it('two computer sides play to the final whistle in both sports, the clock the kernel\'s; the same seed and pads are the same match to the byte', () => {
    for (const sport of ['soccer', 'hockey']) {
      const ctx = ctxOf({ sport, players: 0, level: 'ace', seconds: 60, seed: 2 });
      const a = run(ctx, null, (S) => S.over, 60 * 60 * 8), b = run(ctx, null, (S) => S.over, 60 * 60 * 8);
      expect(a.over, sport).toBe(true); expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(calls(a, 'period').length, sport).toBeGreaterThanOrEqual(ctx.C.clock.periods);
      expect(calls(a, 'kick').length, sport).toBeGreaterThan(10);
      const d = teamDisplay(a, ctx); expect(d.clock.left).toBe(0); expect(d.players.length).toBe(ctx.C.players * 2);
    }
    const ctx = ctxOf({ sport: 'soccer', players: 1, seed: 9 });
    const pads = (S) => [{ x: Math.sin(S.f / 40), y: 0.6, b: S.f % 50 < 8 ? GPAD.KICK : 0 }];
    const a = run(ctx, pads, (S) => S.f >= 1200), b = run(ctx, pads, (S) => S.f >= 1200);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); expect(a.f).toBeGreaterThan(TEAM_FPS);
    const c = cloneTeam(a); c.p[0].x = 99; expect(a.p[0].x).not.toBe(99);
  });
});

describe('the rink\'s goal mouths', () => {
  // a puck slid at b's end with nobody near it: on target it goes in whatever its speed; wide of the mouth it comes back
  // off the boards
  const slide = (x, v) => {
    const ctx = teamContext(teamArenaData({ sport: 'hockey', players: 2, seed: 1 })), S = newTeam(ctx);
    S.K = { ...S.K, phase: 'live', restart: null }; S.phase = 'live';
    for (const P of S.p) { P.home = [P.home[0] + 10, P.home[1]]; P.x = 12; }
    const b = S.sim.bodies[0]; b.position = [x, ctx.court.halfL - 3, b.radius]; b.velocity = [0, v, 0]; b.resting = false;
    for (let n = 0; n < 120 && !S.calls.some((c) => c.kind === 'score'); n++) stepTeam(S, [{ x: 0, y: 0, b: 0 }, { x: 0, y: 0, b: 0 }], ctx);
    return { scored: S.calls.some((c) => c.kind === 'score'), ctx };
  };
  it('a shot on target scores at a crawl and at full speed; one beside the mouth does not', () => {
    expect(slide(0, 4).scored).toBe(true);
    expect(slide(0, 30).scored).toBe(true);
    const { ctx } = slide(0, 4);
    expect(slide(ctx.sport.goal.width / 2 + 1.5, 8).scored).toBe(false);
  });
});
