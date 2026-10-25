// The hit: the swing's strike frame and window from the swing system, and the ball's velocity off the verb, the register,
// the stick and the tip's speed. The concept on one case each.
import { describe, it, expect } from 'vitest';
import { HIT_VERBS, HIT_VERB_IDS, HIT_REGISTERS, hitWindow, hitLive, hitVelocity, hitBall } from './hit.js';
import { swingKeys, swingTiming, SWING_WORDS } from '../polygonizer/hero-swing.js';
import { rallySpeed } from './ball-card.js';

describe('the window from the swing system', () => {
  it('a verb with a swing lands on the swing\'s strike phase and is live through its window; a game type re-times both', () => {
    const W = hitWindow('forehand', 'normal', 'realistic');
    expect(W).toMatchObject({ swing: 'forehand', strike: swingKeys('forehand', 'normal').strike, window: swingKeys('forehand', 'normal').window, flavor: null });
    expect(W.strike).toBe(0.5); expect(W.window).toEqual([0.333, 0.667]);
    const A = hitWindow('bat', 'heavy', 'action'), T = swingTiming('heavy', 'action');
    expect(A).toMatchObject({ swing: 'bat', strike: T.strike, window: T.window, flavor: 'action' });
    expect(hitLive(W.strike, 'forehand')).toBe(true);
    expect(hitLive(0.1, 'forehand')).toBe(false); expect(hitLive(0.9, 'forehand')).toBe(false);
    expect(hitLive(A.strike, 'bat', 'heavy', 'action')).toBe(true);
  });
  it('every verb that names a swing names one the swing system has; a verb with none says so and is never live', () => {
    for (const [id, v] of Object.entries(HIT_VERBS)) if (v.swing) expect(SWING_WORDS, id).toContain(v.swing);
    const S = hitWindow('serve');
    expect(S).toMatchObject({ swing: null, strike: null, window: null }); expect(S.says).toMatch(/no swing clip plays 'serve' yet/);
    expect(hitLive(0.5, 'serve')).toBe(false);
    expect(HIT_VERB_IDS.filter((v) => HIT_VERBS[v].swing)).toEqual(['forehand', 'backhand', 'bat']);
    expect(() => hitWindow('volley')).toThrow(/verb 'volley' is one of forehand, backhand/);
  });
});

describe('the ball off the hit', () => {
  const r = (x) => Math.round(x * 1e4) / 1e4;
  it('direction: the facing, the stick\'s aim within the register\'s spread, the verb\'s arc lifted by the stick', () => {
    const H = hitVelocity({ verb: 'forehand', register: 'realistic', facing: Math.PI / 2, stick: [0, 0], tipSpeed: 20 });
    expect(H.azimuth).toBeCloseTo(Math.PI / 2, 4); expect(H.elevation).toBe(8);
    expect(H.velocity[0]).toBeCloseTo(0, 3); expect(H.velocity[1]).toBeGreaterThan(0); expect(H.velocity[2]).toBeGreaterThan(0);
    const right = hitVelocity({ verb: 'forehand', register: 'realistic', facing: 0, stick: [1, 0], tipSpeed: 20 });
    expect(right.azimuth).toBeCloseTo((-25 * Math.PI) / 180, 4);   // the stick right turns the aim right of the facing (clockwise) by the spread
    const lifted = hitVelocity({ verb: 'forehand', register: 'realistic', facing: 0, stick: [0, 1], tipSpeed: 20 });
    expect(lifted.elevation).toBe(20);
    expect(() => hitVelocity({ verb: 'forehand', stick: [2, 0] })).toThrow(/stick is \[x, y\]/);
  });
  it('speed: the register\'s base plus its gain on the tip, by the verb\'s power; realistic is the tip alone', () => {
    expect(hitVelocity({ verb: 'forehand', register: 'realistic', tipSpeed: 0 }).speed).toBe(0);
    expect(hitVelocity({ verb: 'forehand', register: 'realistic', tipSpeed: 20 }).speed).toBe(r(1.6 * 20));
    expect(hitVelocity({ verb: 'bat', register: 'realistic', tipSpeed: 20 }).speed).toBe(r(1.6 * 20 * 1.5));
    expect(hitVelocity({ verb: 'forehand', register: 'action', tipSpeed: 0 }).speed).toBe(HIT_REGISTERS.action.base);
    expect(hitVelocity({ verb: 'forehand', register: 'action', tipSpeed: 20 }).speed).toBe(r(12 + 1.2 * 20));
    // the rally grows by the ball card
    expect(hitVelocity({ verb: 'forehand', register: 'action', tipSpeed: 20, hits: 5 }).speed).toBe(rallySpeed('action', 5, 12 + 1.2 * 20));
    expect(hitVelocity({ verb: 'forehand', register: 'realistic', tipSpeed: 20, hits: 5 }).speed).toBe(r(32));
  });
  it('spin: topspin turns the top forward (the axis up × the heading), backspin the other way, side about the vertical, by the register', () => {
    const top = hitVelocity({ verb: 'forehand', register: 'realistic', facing: 0, tipSpeed: 20 });
    expect(top.spin).toEqual({ kind: 'top', rate: 25 });
    expect(top.angularVelocity[0]).toBeCloseTo(0, 6); expect(top.angularVelocity[1]).toBeCloseTo(25 * 2 * Math.PI, 3); expect(top.angularVelocity[2]).toBe(0);
    const back = hitVelocity({ verb: 'backhand', register: 'realistic', facing: 0, tipSpeed: 20 });
    expect(back.angularVelocity[1]).toBeLessThan(0);
    const side = hitVelocity({ verb: 'kick', register: 'realistic', facing: 0, tipSpeed: 20 });
    expect(side.angularVelocity[2]).toBeCloseTo(2 * 2 * Math.PI, 3); expect(side.angularVelocity[0]).toBe(0);
    expect(hitVelocity({ verb: 'forehand', register: 'pinball', tipSpeed: 20 }).spin.rate).toBe(r(25 * 0.1));
    expect(hitVelocity({ verb: 'serve', register: 'realistic', tipSpeed: 20 }).angularVelocity).toEqual([0, 0, 0]);
    // a ball along +y with topspin spins about -x: the axis turns with the heading
    const north = hitVelocity({ verb: 'forehand', register: 'realistic', facing: Math.PI / 2, tipSpeed: 20 });
    expect(north.angularVelocity[0]).toBeLessThan(0); expect(north.angularVelocity[1]).toBeCloseTo(0, 6);
  });
  it('the hit on a body: the impulse takes it from its velocity to the hit\'s, and the kernel\'s touch fact names who and where', () => {
    const ball = { mass: 0.058, velocity: [-10, 0, 2] };
    const H = hitBall({ ball, who: 'a1', at: [1.5, -8], verb: 'forehand', register: 'realistic', facing: Math.PI / 2, tipSpeed: 20 });
    expect(H.fact).toEqual({ kind: 'touch', who: 'a1', at: [1.5, -8] });
    for (let i = 0; i < 3; i++) expect(H.impulse[i]).toBeCloseTo(0.058 * (H.velocity[i] - ball.velocity[i]), 3);
    expect(() => hitBall({ ball: { mass: 0 }, who: 'a1', at: [0, 0], verb: 'forehand' })).toThrow(/ball is the sim body/);
    expect(() => hitBall({ ball, at: [0, 0], verb: 'forehand' })).toThrow(/who is the player/);
  });
});
