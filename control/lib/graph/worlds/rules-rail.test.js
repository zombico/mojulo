import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from './controllable-world.js';

// ── the `rail` rule (worlds/controllable/rules-rail.js): an arcade flier carried down a stage's path ─────────────────
// The frame moves along the path at the stage's speed and stops at its end; the stick moves the craft about it inside
// its box and no further; the ground under it is a floor that lifts it, never a crash; W boosts and S brakes from one
// meter; a roll carries it aside, unhurt while it turns. Deterministic.

const DT = 1 / 60;
const flat = { ground: () => 0 };
// a path north 1 km at 100 m up, then east 500 m
const PATH = [[0, 0, 100], [0, 1000, 100], [500, 1000, 100]];
const craft = (rule = {}) => createWorld({
  entities: [{ id: 'p', rule: { type: 'rail', path: PATH, speed: 50, box: { hx: 20, hz: 10 }, sway: 25, ...rule }, transform: { pos: [0, 0, 100], heading: 0 } }],
});
const run = (w, input, steps, hooks = flat) => { for (let i = 0; i < steps; i++) stepWorld(w, input, DT, hooks); return w.byId.p; };

describe('rule: rail', () => {
  it('is carried along its path at the stage\'s speed, and held at its end', () => {
    const w = craft(), p = run(w, {}, 120);                     // 2 s at 50 m/s
    expect(p.along).toBeCloseTo(100, 0);
    expect(p.transform.pos[0]).toBeCloseTo(0, 3);
    expect(p.transform.pos[1]).toBeCloseTo(100, 0);
    expect(p.transform.pos[2]).toBeCloseTo(100, 3);
    expect(p.airspeed).toBe(50);
    expect(p.railEnd).toBe(false);
    run(w, {}, 60 * 40);                                        // past the whole 1.5 km
    expect(p.along).toBeCloseTo(1500, 3);
    expect(p.railEnd).toBe(true);
    expect(p.transform.pos[0]).toBeCloseTo(500, 3);
    expect(p.transform.pos[1]).toBeCloseTo(1000, 3);
    // facing the way: north on the first leg (heading π/2), east on the last
    expect(p.transform.heading).toBeCloseTo(0, 2);
  });

  it('is steered as the seated pilot (its speed across is `sway`, never the car wheels\' `steer` the pilot\'s input is turned through)', () => {
    const w = createWorld({ entities: [{ id: 'p', pilotable: true, rule: { type: 'rail', path: PATH, speed: 50, box: { hx: 20, hz: 10 }, sway: 25 }, transform: { pos: [0, 0, 100], heading: 0 } }] });
    expect(w.pilotId).toBe('p');
    const p = run(w, { turn: 1 }, 30);
    expect(p.off[0]).toBeGreaterThan(2);
    expect(p.steer ?? 0).toBe(0);
  });

  it('is steered about the path inside its box, and no further; banked into a move across', () => {
    const w = craft();
    let p = run(w, { turn: 1 }, 30);
    expect(p.off[0]).toBeGreaterThan(2);                       // right of the way (east, heading north)
    expect(p.transform.pos[0]).toBeGreaterThan(2);
    expect(p.bank).toBeGreaterThan(0);
    p = run(w, { turn: 1, lift: 1 }, 300);
    expect(p.off[0]).toBeCloseTo(20, 6);                       // at the box's side, stopped there
    expect(p.off[1]).toBeCloseTo(10, 6);
    expect(p.transform.pos[2]).toBeCloseTo(110, 3);
    p = run(w, { lift: -1 }, 600);
    expect(p.off[1]).toBeCloseTo(-10, 6);
  });

  it('skims a floor over the ground: rising ground lifts it, it never touches down', () => {
    // a ridge across the way at 300 to 500 m north, 130 m high: over the path's own height
    const ridge = { ground: (q) => (q[1] > 300 && q[1] < 500 ? 130 : 0) };
    const w = craft({ floor: 15 });
    let lowest = Infinity, touched = 0;
    for (let i = 0; i < 60 * 12; i++) {
      stepWorld(w, { lift: -1 }, DT, ridge);
      const p = w.byId.p, g = ridge.ground(p.transform.pos);
      lowest = Math.min(lowest, p.transform.pos[2] - g);
      if (p.touchdown) touched++;
    }
    expect(lowest).toBeGreaterThanOrEqual(15 - 1e-6);
    expect(touched).toBe(0);
    // over the ridge it stood 145 m up: lifted, its box's bottom following it
    const w2 = craft({ floor: 15 }); run(w2, { lift: -1 }, 60 * 8, ridge);
    expect(w2.byId.p.transform.pos[2]).toBeCloseTo(145, 3);
    expect(w2.byId.p.agl).toBeCloseTo(15, 3);
  });

  it('boosts and brakes from one meter that empties and fills', () => {
    const w = craft({ boost: { mul: 2, time: 1, recharge: 0.5 } });
    let p = run(w, { forward: 1 }, 30);
    expect(p.boosting).toBe(true);
    expect(p.airspeed).toBe(100);
    p = run(w, { forward: 1 }, 60);                            // the meter out
    expect(p.boosting).toBe(false);
    expect(p.airspeed).toBe(50);
    // (emptied, it stays shut while W is held, and refills meanwhile: half a second held, a second let go, at 0.5 a second)
    p = run(w, { forward: 1 }, 10);
    expect(p.boosting).toBe(false);
    p = run(w, {}, 60);
    expect(p.boostE).toBeCloseTo(0.83, 1);
    p = run(w, { forward: -1 }, 10);
    expect(p.braking).toBe(true);
    expect(p.airspeed).toBe(25);
  });

  it('rolls aside, unhurt while it turns, and only within its box', () => {
    const w = craft({ roll: { time: 0.5, side: 12, cooldown: 1 } });
    let p = run(w, { strafe: 1 }, 6);
    expect(p.rolling).toBe(true);
    expect(p.invincible).toBe(true);
    p = run(w, {}, 40);
    expect(p.rolling).toBe(false);
    expect(p.off[0]).toBeCloseTo(12, 0);
    const w2 = craft({ roll: { time: 0.5, side: 40 } });
    expect(run(w2, { strafe: 1 }, 60).off[0]).toBeCloseTo(20, 6);
  });

  it('is deterministic: same inputs, the same flight', () => {
    const script = (i) => ({ turn: Math.sin(i / 40), lift: Math.cos(i / 55), forward: i % 200 < 50 ? 1 : 0, strafe: i === 300 ? 1 : 0 });
    const go = () => { const w = craft({ boost: {}, roll: {}, floor: 10 }); for (let i = 0; i < 900; i++) stepWorld(w, script(i), DT, flat); return w.byId.p; };
    const a = go(), b = go();
    expect(a.transform.pos).toEqual(b.transform.pos);
    expect(a.along).toBe(b.along);
    expect(a.tilt).toEqual(b.tilt);
  });

  // ── a foe on station (an `ai` with `rule.station`): held ahead of the craft down its path ──
  const station = (foe = {}) => createWorld({
    entities: [
      { id: 'p', pilotable: true, rule: { type: 'rail', path: PATH, speed: 50, box: { hx: 20, hz: 10 }, sway: 25 }, body: { type: 'mesh', hittable: true, hp: 999 }, transform: { pos: [0, 0, 100], heading: Math.PI / 2 } },
      { id: 'f', team: 'foes', rule: { type: 'ai', space: true, speed: 60, turn: 1.4, burst: 0.3, pause: 1, eye: 0, station: { of: 'p', lead: 120, at: [8, 4], stay: 6, ...foe } }, weapon: { fireClass: 'sight', auto: true, rof: 2, damage: 1, range: 400, eye: 0 }, body: { type: 'mesh', hittable: true, hp: 5 }, transform: { pos: [0, 300, 100], heading: -Math.PI / 2 } },
    ],
  });

  it('a foe on station: held its lead ahead of the craft at its place in the box, facing it, firing in bursts; then it peels off and is gone', () => {
    const w = station();
    let fired = 0;
    for (let i = 0; i < 60 * 4; i++) { stepWorld(w, {}, DT, flat); fired += w.byId.f.aiFire ? 1 : 0; }
    const p = w.byId.p, f = w.byId.f;
    expect(Math.abs(f.stAlong - p.along - 120)).toBeLessThan(15);   // closed from its post (300 m off) to its lead
    expect(f.transform.pos[0]).toBeCloseTo(8, 0);                  // its place: 8 m right of the way (east, the way north)
    expect(f.transform.pos[2]).toBeCloseTo(104, 0);
    expect(Math.cos(f.transform.heading - Math.atan2(p.transform.pos[1] - f.transform.pos[1], p.transform.pos[0] - f.transform.pos[0]))).toBeCloseTo(1, 6);
    expect(fired).toBeGreaterThan(0);
    expect(fired).toBeLessThan(60 * 4 * 0.4);                      // bursts, not a stream
    for (let i = 0; i < 60 * 8; i++) stepWorld(w, {}, DT, flat);   // past its stay and its peel
    expect(f.gone).toBe(true);
  });

  it('a foe on station asleep is left where it was posted, and taken on from there when woken', () => {
    const w = station();
    w.byId.f.dormant = true;
    for (let i = 0; i < 60; i++) stepWorld(w, {}, DT, flat);
    expect(w.byId.f.stAlong).toBeUndefined();
  });
});
