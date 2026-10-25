// The court mind: plain, seeded, bounded. Its levels are the mind's skill names; it reads the ball's way on the ball's
// own physics; it serves when its turn comes and swings when the ball comes into reach.
import { describe, it, expect } from 'vitest';
import { MIND_LEVELS, MIND_LEVEL_IDS, newCourtMind, courtMind, predictLanding, predictCrossing, aimStick, serveStick } from './contest-mind.js';
import { SKILLS } from '../mind/vocab.js';
import { newMatch, stepMatch, matchContext, MPAD } from './match-sim.js';
import { matchArenaData } from './match-arena.js';
import { buildSim } from '../worlds/physics-sim.js';

const sim = buildSim();

describe('the levels', () => {
  it('are the mind\'s skill tiers by name, each quicker and truer than the one before', () => {
    expect(MIND_LEVEL_IDS).toEqual(Object.keys(SKILLS));
    for (let i = 1; i < MIND_LEVEL_IDS.length; i++) {
      const a = MIND_LEVELS[MIND_LEVEL_IDS[i - 1]], b = MIND_LEVELS[MIND_LEVEL_IDS[i]];
      expect(b.react).toBeLessThan(a.react); expect(b.wobble).toBeLessThan(a.wobble); expect(b.pace).toBeGreaterThanOrEqual(a.pace);
    }
    expect(() => newCourtMind('grandmaster')).toThrow(/mind level 'grandmaster' is one of novice, regular, veteran, ace/);
  });
});

describe('reading the ball', () => {
  const state = () => sim.createState({ gravity: [0, 0, -9.81], bodies: [{ id: 'ball', collider: 'sphere', mass: 0.058, radius: 0.0335, restitution: 0.73, position: [0, -11, 1], velocity: [0, 24, 2] }, { id: 'floor', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0, restitution: 1, friction: 1 }] });
  it('the landing is where the ball\'s own physics puts it, the state untouched; the crossing is where it passes a line, or where it dies short', () => {
    const st = state(), before = JSON.stringify(st);
    const land = predictLanding(sim, st);
    expect(JSON.stringify(st)).toBe(before);
    expect(land.at[1]).toBeGreaterThan(0); expect(land.t).toBeGreaterThan(0.3); expect(land.at[0]).toBeCloseTo(0, 6);
    const W = predictCrossing(sim, st, 12.9, -1);
    expect(W.land[1]).toBeCloseTo(land.at[1], 6);
    expect(W.cross).toBeTruthy(); expect(W.cross[1]).toBeCloseTo(12.9, 0); expect(W.cross[2]).toBeGreaterThan(0);
    // a ball that dies before the line: its second bounce is where it dies
    const short = predictCrossing(sim, sim.createState({ gravity: [0, 0, -9.81], bodies: [{ id: 'ball', collider: 'sphere', mass: 0.058, radius: 0.0335, restitution: 0.5, position: [0, 1, 0.5], velocity: [0, 3, 1] }, { id: 'floor', collider: 'plane', position: [0, 0, 0], normal: [0, 0, 1], mass: 0, restitution: 1, friction: 1 }] }), 12.9, -1);
    expect(short.cross).toBeNull(); expect(short.dies).toBeTruthy(); expect(short.dies[1]).toBeLessThan(12.9);
  });
});

describe('at the court', () => {
  it('it serves when its turn comes, after its wait, with the stick aimed at the box; it runs to the ball and swings in reach; the same seed is the same mind', () => {
    const ctx = matchContext(matchArenaData({ players: 0, register: 'action', level: 'regular', seed: 4 }));
    const S = newMatch(ctx);
    const sv = S.K.restart.side, i = sv === 'a' ? 0 : 1;
    let served = null;
    for (let f = 0; f < 600 && !served; f++) { stepMatch(S, [], ctx); const h = S.calls.find((c) => c.kind === 'hit'); if (h) served = { f: S.f, h }; }
    expect(served.h.who).toBe(S.p[i].id);
    expect(served.f).toBeGreaterThanOrEqual(Math.round(MIND_LEVELS.regular.serveWait * 60));
    // the receiver returned it, or at least moved toward it
    let returned = false, moved = false;
    const rec = S.p[1 - i], x0 = rec.x, y0 = rec.y;
    for (let f = 0; f < 240; f++) { stepMatch(S, [], ctx); if (S.calls.filter((c) => c.kind === 'hit').length >= 2) returned = true; if (Math.hypot(rec.x - x0, rec.y - y0) > 0.3) moved = true; }
    expect(moved || returned).toBe(true);
    // the same seed, the same pads
    const M1 = newCourtMind('veteran', 11), M2 = newCourtMind('veteran', 11), T = newMatch(ctx);
    for (let k = 0; k < 10; k++) stepMatch(T, [], ctx);
    const p1 = courtMind(M1, T, 'a1', ctx, sim), p2 = courtMind(M2, T, 'a1', ctx, sim);
    expect(p1).toEqual(p2);
    expect(typeof p1.b).toBe('number'); expect(p1.b & ~(MPAD.SWING | MPAD.START)).toBe(0);
  });
  it('its depth sense: the stick lift that lands the verb at the depth, lower for a close shot than a deep one, within the stick; the cord\'s floor under it; the serve\'s stick aims across into the box', () => {
    const ctx = matchContext(matchArenaData({ players: 0, register: 'realistic', seed: 1 })), S = newMatch(ctx);
    const deep = aimStick(ctx, S, 'forehand', [0, -10, 1], [0, 11.5]), mid = aimStick(ctx, S, 'forehand', [0, -10, 1], [0, 8]), short = aimStick(ctx, S, 'forehand', [0, -10, 1], [0, 3]);
    expect(deep).toBeGreaterThan(short); expect(mid).toBeGreaterThanOrEqual(short); expect(Math.abs(deep)).toBeLessThanOrEqual(1); expect(Math.abs(short)).toBeLessThanOrEqual(1);
    // a flat realistic forehand carries past a close target: the lift that clears the cord is the floor, the same for both
    expect(mid).toBe(short);
    expect(aimStick(ctx, S, 'serve', [1, -12.3, 2.8], [-2, 4.5])).toBeLessThanOrEqual(1);
    const sv = S.K.restart.side, P = S.p.find((p) => p.side === sv), st = serveStick(ctx, S, P);
    expect(st.x).toBeLessThan(0);   // the deuce court, the server's right: across to its left
    expect(st.y).toBeGreaterThan(0); expect(Math.abs(st.y)).toBeLessThanOrEqual(1);
  });
});
