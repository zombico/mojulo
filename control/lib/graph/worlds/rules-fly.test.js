import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from './controllable-world.js';

// ── the `fly` rule (the second vehicle feel model — same lessons as drive) ───────────────────────
// Physics-SHAPE gates, not pinned numbers: takeoff needs rotation speed, climbing bleeds airspeed
// and diving buys it back (the energy exchange), the coordinated turn matches (g/v)·tan(bank),
// the stall drops the nose and sinks, and the runway hands back wheel brakes. Plus determinism
// and the affordance facts.

const DT = 1 / 60;
const flat = { ground: () => 0 };

const plane = (rule = {}) => createWorld({
  entities: [{ id: 'p', rule: { type: 'fly', mass: 1200, thrust: 7200, stallSpeed: 18, takeoffSpeed: 23, maxSpeed: 80, eye: 0.6, ...rule }, transform: { pos: [0, 0, 0.6], heading: 0 } }],
});

const run = (w, input, steps, hooks = flat) => { for (let i = 0; i < steps; i++) stepWorld(w, input, DT, hooks); return w.byId.p; };

describe('rule: fly — runway, rotation, takeoff', () => {
  it('is deterministic: same inputs → identical replay', () => {
    const script = (i) => ({ forward: 1, lift: i > 200 ? 1 : 0, turn: i > 500 ? 0.6 : 0 });
    const go = () => { const w = plane(); for (let i = 0; i < 700; i++) stepWorld(w, script(i), DT, flat); return w.byId.p; };
    const a = go(), b = go();
    expect(a.transform.pos).toEqual(b.transform.pos);
    expect(a.airspeed).toBe(b.airspeed);
    expect(a.bank).toBe(b.bank);
  });

  it('rolls, rotates at takeoffSpeed, and climbs out — the takeoff edge fires once', () => {
    const w = plane();
    const p = run(w, { forward: 1 }, 90);                     // throttle up the runway
    expect(p.airborne).toBe(false);
    expect(p.locomotion).toBe('taxi');
    expect(p.transform.pos[2]).toBeCloseTo(0.6, 3);           // still rolling
    let sawTakeoff = 0;
    for (let i = 0; i < 900; i++) {
      stepWorld(w, { forward: 1, lift: 1 }, DT, flat);        // hold the nose up
      if (p.takeoff) sawTakeoff++;
    }
    expect(p.airborne).toBe(true);
    expect(p.locomotion).toBe('fly');
    expect(p.transform.pos[2]).toBeGreaterThan(10);           // genuinely climbing
    expect(sawTakeoff).toBe(1);                               // an edge, not a state
    expect(p.airspeed).toBeGreaterThan(23);
  });

  it('below rotation speed the nose-up input does NOT lift it (no premature takeoff)', () => {
    const w = plane({ thrust: 250 });                         // weak engine: drag caps it under vTakeoff (v∞ = √(250/0.6) ≈ 20)
    const p = run(w, { forward: 1, lift: 1 }, 1200);
    expect(p.airborne).toBe(false);
    expect(p.transform.pos[2]).toBeCloseTo(0.6, 3);
  });
});

describe('rule: fly — the energy exchange and the coordinated turn', () => {
  const airborne = () => {
    const w = plane();
    run(w, { forward: 1 }, 300);
    run(w, { forward: 1, lift: 1 }, 300);                     // climb out
    run(w, { forward: 1, lift: -0.4 }, 200);                  // level off-ish
    return w;
  };

  it('climbing bleeds airspeed; diving buys it back', () => {
    const w = airborne();
    const p = w.byId.p;
    run(w, { forward: 0.5 }, 120);                            // settle at partial throttle
    const vLevel = p.airspeed;
    run(w, { forward: 0.5, lift: 1 }, 240);                   // nose up, same throttle
    expect(p.airspeed).toBeLessThan(vLevel);                  // the climb cost
    const vClimb = p.airspeed;
    run(w, { forward: 0.5, lift: -1 }, 240);                  // nose down
    expect(p.airspeed).toBeGreaterThan(vClimb);               // the dive refund
  });

  it('bank-to-turn: heading rate ≈ (g/v)·tan(bank); D banks right and turns right', () => {
    const w = airborne();
    const p = w.byId.p;
    run(w, { forward: 1, turn: 1 }, 120);                     // hold D — bank settles at bankMax
    expect(p.bank).toBeGreaterThan(0);                        // banked right
    const h0 = p.transform.heading, v = p.airspeed, bank = p.bank;
    stepWorld(w, { forward: 1, turn: 1 }, DT, flat);
    const rate = (p.transform.heading - h0) / DT;
    expect(rate).toBeLessThan(0);                             // heading− = a RIGHT turn (tank convention)
    expect(Math.abs(rate)).toBeCloseTo((9.81 / v) * Math.tan(bank), 1);
    const w2 = airborne();
    run(w2, { forward: 1 }, 300);                             // stick released
    expect(Math.abs(w2.byId.p.bank)).toBeLessThan(0.02);      // self-leveled
  });

  it('the stall: cut the throttle, hold the nose up — the elevator loses, the nose drops, it sinks', () => {
    const w = airborne();
    const p = w.byId.p;
    let sawStallEdge = false;
    let zAtStall = null;
    for (let i = 0; i < 1800 && zAtStall == null; i++) {
      stepWorld(w, { forward: 0, lift: 1 }, DT, flat);        // idle + full nose-up: airspeed decays
      if (p.stallStart) sawStallEdge = true;
      if (p.stalled && zAtStall == null) zAtStall = p.transform.pos[2];
    }
    expect(sawStallEdge).toBe(true);
    expect(p.airspeed).toBeLessThan(18);
    run(w, { forward: 0, lift: 1 }, 300);                     // keep hauling back — it doesn't help
    expect(p.transform.pos[2]).toBeLessThan(zAtStall);        // sinking despite full aft stick
    expect(p.transform.pitch).toBeLessThan(0.6);              // the nose was taken from you
  });

  it('lands: descend to the runway, touchdown edge fires, wheel brakes stop it', () => {
    const w = airborne();
    const p = w.byId.p;
    let sawTouchdown = 0;
    for (let i = 0; i < 3600 && p.airborne; i++) {
      stepWorld(w, { forward: 0.25, lift: -0.5 }, DT, flat);  // a shallow powered descent
      if (p.touchdown) sawTouchdown++;
    }
    run(w, {}, 5);
    if (p.touchdown) sawTouchdown++;
    expect(p.airborne).toBe(false);
    expect(sawTouchdown).toBe(1);
    let guard = 0;
    while (p.airspeed > 0 && guard++ < 1200) stepWorld(w, { forward: -1 }, DT, flat);   // wheel brakes
    expect(p.airspeed).toBe(0);
    expect(p.transform.pos[2]).toBeCloseTo(0.6, 3);
  });
});

describe('rule: fly — the affordance facts', () => {
  it('surfaces airspeed/throttle/bank/climbRate/stalled/tilt and the prop-driving gaitPhase', () => {
    const w = plane();
    const p = run(w, { forward: 1 }, 60);
    expect(p.locomotion).toBe('taxi');
    expect(p.throttle).toBe(1);
    expect(typeof p.airspeed).toBe('number');
    expect(p.tilt).toEqual({ pitch: 0, roll: p.bank || 0 });  // grounded: no visual pitch
    const g0 = p.gaitPhase;
    run(w, { forward: 1 }, 60);
    expect(p.gaitPhase).toBeGreaterThan(g0);                  // the prop spins with throttle
    run(w, { forward: 1, lift: 1 }, 600);
    expect(p.airborne).toBe(true);
    expect(p.climbRate).toBeGreaterThan(0);
    run(w, { forward: 1, turn: 1 }, 60);
    expect(p.tilt.roll).toBeGreaterThan(0);                   // the mesh sync will bank the body
    expect(p.tilt.pitch).not.toBe(0);
  });
});
