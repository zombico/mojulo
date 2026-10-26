// The ball card: a sport's ball as the physics property's sphere, dressed by a register. The concept on one case each:
// the cards' ladder, a body and its forces, the growing rally, and the live sim's air held to physics/flight.js (the
// oracle) on the soccer free-kick launch.
import { describe, it, expect } from 'vitest';
import { BALLS, BALL_CARDS, BALL_REGISTERS, readBallCard, ballOf, ballBody, ballForces, ballGravity, rallySpeed, ballReport, airDrag } from './ball-card.js';
import { flightPath, PROJECTILES, RHO_SEA_LEVEL } from '../physics/flight.js';
import { createState, step } from '../worlds/physics-sim.js';

describe('the cards and the balls', () => {
  it('four registers, the feel cards\' own names; every ball a mass, a radius and a rebound its rules allow', () => {
    expect(BALL_REGISTERS).toEqual(['realistic', 'action', 'platformer', 'pinball']);
    for (const [id, b] of Object.entries(BALLS)) {
      expect(b.mass, id).toBeGreaterThan(0); expect(b.radius, id).toBeGreaterThan(0);
      if (!b.ownAir) expect(b.restitution, id).toBeGreaterThan(0.2);   // the bowling ball is dead on the lane; every ball but the shuttle lively expect(b.restitution, id).toBeLessThanOrEqual(1);
      expect(typeof b.cited, id).toBe('boolean');
    }
    expect(BALLS.soccer.cited).toBe(true); expect(BALLS.soccer.aero).toBe(PROJECTILES.soccer.aero);
    expect(BALLS.tennis.restitution).toBeCloseTo(Math.sqrt(141 / 254), 3);
    expect(() => readBallCard('arcade')).toThrow(/register 'arcade' is one of realistic, action, platformer, pinball/);
    expect(() => ballOf('quidditch')).toThrow(/'quidditch' is not a ball here \(soccer, tennis/);
    expect(() => ballOf({ mass: 1 })).toThrow(/\{ mass \(kg\), radius \(m\)/);
    expect(ballOf({ mass: 0.1, radius: 0.05 })).toMatchObject({ id: 'custom', restitution: 0.7, cited: false });
  });
  it('the body and the forces: realistic flies in air on the ball\'s cited curve (or soccer\'s, said); the arcade has none', () => {
    const body = ballBody('tennis', 'realistic', { id: 'b', position: [1, 2, 3] });
    expect(body).toMatchObject({ id: 'b', collider: 'sphere', mass: 0.058, radius: 0.0335, restitution: BALLS.tennis.restitution, position: [1, 2, 3] });
    const [air] = ballForces('tennis', 'realistic', { id: 'b' });
    expect(air).toMatchObject({ kind: 'aero', on: ['b'], rho: RHO_SEA_LEVEL, cdSup: PROJECTILES.soccer.aero.cdSup, spinDecay: 0.04 });
    expect(ballReport('tennis', 'realistic').notes[0]).toMatch(/no cited aero curve: it flies on the soccer ball's/);
    expect(ballReport('soccer', 'realistic').notes).toEqual([]);
    for (const r of ['action', 'platformer', 'pinball']) expect(ballForces('soccer', r), r).toEqual([]);
    // the register scales the bounce, the sim's ceiling at 1; the platformer's ball falls slower
    expect(ballBody('soccer', 'action').restitution).toBeCloseTo(Math.min(1, BALLS.soccer.restitution * 1.1), 4);
    expect(ballBody('pingpong', 'pinball').restitution).toBe(1);
    expect(ballReport('pingpong', 'pinball').notes[0]).toMatch(/lossless at most/);
    expect(ballGravity('platformer')).toEqual([0, 0, -5.886]); expect(ballGravity('realistic')).toEqual([0, 0, -9.81]);
  });
  it('a ball whose air is its own (the shuttle) flies in it on every register, toward its terminal speed; the aim reads its drag', () => {
    const own = Object.keys(BALLS).find((id) => BALLS[id].ownAir), plain = Object.keys(BALLS).find((id) => !BALLS[id].ownAir);
    for (const r of BALL_REGISTERS) expect(ballForces(own, r).map((f) => f.kind), r).toEqual(['aero']);
    expect(ballForces(plain, 'action')).toEqual([]);
    expect(airDrag(plain)).toBe(0);
    const k = airDrag(own), st = createState({ gravity: [0, 0, -9.81], bodies: [ballBody(own, 'action', { position: [0, 0, 500], velocity: [0, 0, 0] })], forces: ballForces(own, 'action') });
    for (let i = 0; i < 600; i++) step(st, 1 / 60);
    expect(-st.bodies[0].velocity[2]).toBeCloseTo(Math.sqrt(9.81 / k), 1);   // ten seconds down: at the terminal speed its drag says
  });
  it('the rally grows by the card: not at all in realistic, eight per cent a hit to one and a half in action, unbounded in pinball', () => {
    expect(rallySpeed('realistic', 12, 20)).toBe(20);
    expect(rallySpeed('action', 0, 20)).toBe(20); expect(rallySpeed('action', 5, 20)).toBe(28); expect(rallySpeed('action', 40, 20)).toBe(30);
    expect(rallySpeed('pinball', 40, 20)).toBe(100);
    expect(() => rallySpeed('action', -1, 20)).toThrow(/hits is a count/);
    for (const c of Object.values(BALL_CARDS)) expect(c.says.length).toBeGreaterThan(20);
  });
});

describe('the live sim\'s air, held to the flight model', () => {
  // the free kick the flight model is validated on: 25 m/s at 20°, six turns of curl and three of backspin a second
  const launch = { projectile: 'soccer', speed: 25, elevationDeg: 20, spin: { curlRev: 6, spinRev: 3 } };
  const F = flightPath(launch), s0 = F.samples[0];
  const fly = (dt, forces, opts = {}) => {
    const st = createState({ gravity: [0, 0, -9.81], bodies: [{ ...ballBody('soccer', 'realistic', { position: [0, 0, 1e-4], velocity: [s0.v.x, s0.v.y, s0.v.z] }), angularVelocity: [s0.omega.x, s0.omega.y, s0.omega.z], ...opts }], forces });
    let apex = 0, prev = st.bodies[0].position.slice();
    for (let i = 0; i < 20000; i++) {
      step(st, dt);
      const p = st.bodies[0].position;
      if (p[2] > apex) apex = p[2];
      if (p[2] <= 0 && prev[2] > 0) { const f = prev[2] / (prev[2] - p[2]); return { range: prev[0] + (p[0] - prev[0]) * f, apex, lateral: prev[1] + (p[1] - prev[1]) * f, t: st.time, state: st }; }
      prev = p.slice();
    }
    throw new Error('never landed');
  };
  const within = (got, want, share) => expect(Math.abs(got - want) / Math.abs(want)).toBeLessThan(share);
  it('lands where the oracle lands: within half a per cent at the oracle\'s step, within one at the page\'s', () => {
    const forces = ballForces('soccer', 'realistic');
    const fine = fly(0.002, forces), page = fly(1 / 120, forces);
    for (const k of ['range', 'apex', 'lateral']) { within(fine[k], F.summary[k], 0.005); within(page[k], F.summary[k], 0.01); }
    expect(F.summary.lateral).toBeGreaterThan(3);   // the curl is real, and the sim's ball curls with it
    expect(fine.lateral).toBeGreaterThan(3);
  });
  it('the terms are the oracle\'s: no crisis flies farther, no spin flies straight, no air is the parabola', () => {
    const forces = ballForces('soccer', 'realistic');
    const base = fly(0.002, forces);
    const noCrisis = fly(0.002, [{ ...forces[0], crisis: false }]);
    expect(noCrisis.range).toBeGreaterThan(base.range);
    within(noCrisis.range, flightPath(launch, { crisis: false }).summary.range, 0.005);
    const noSpin = fly(0.002, [{ ...forces[0], spin: false }]);
    expect(Math.abs(noSpin.lateral)).toBeLessThan(0.01);
    const vacuum = fly(0.002, []);
    const v0 = Math.hypot(s0.v.x, s0.v.y, s0.v.z), el = (20 * Math.PI) / 180;
    within(vacuum.range, (v0 * v0 * Math.sin(2 * el)) / 9.81, 0.01);
  });
  it('a body the rule is not `on` keeps every byte; the air bleeds the spin it is on', () => {
    const forces = ballForces('soccer', 'realistic');
    const off = fly(1 / 120, [{ ...forces[0], on: ['someone-else'] }]), none = fly(1 / 120, []);
    expect(JSON.stringify(off.state.bodies)).toBe(JSON.stringify(none.state.bodies));
    const spun = fly(1 / 120, forces).state.bodies[0];
    const w0 = Math.hypot(s0.omega.x, s0.omega.y, s0.omega.z);
    expect(Math.hypot(...spun.angularVelocity)).toBeLessThan(w0);
    expect(Math.hypot(...fly(1 / 120, [{ ...forces[0], spinDecay: 0 }]).state.bodies[0].angularVelocity)).toBeCloseTo(w0, 6);
  });
});
