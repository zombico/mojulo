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

// ── the flight dials (skyscape): engine, lever, gravity, lift — each absent by default ───────────────
describe('rule: fly — the flight dials', () => {
  // already flying: 400 m up at `v` (the world starts every body at rest, so the airspeed is set once it is made)
  const aloft = (rule, v = 30) => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'fly', mass: 1200, thrust: 7200, stallSpeed: 18, takeoffSpeed: 23, maxSpeed: 80, eye: 0.6, ...rule }, transform: { pos: [0, 0, 400], heading: 0, pitch: 0 } }] });
    w.byId.p.airspeed = v; w.byId.p.airborne = true;
    return w;
  };

  it('a glider (engine: false) has no thrust: full throttle level flight only bleeds speed', () => {
    const g = run(aloft({ engine: false }), { forward: 1 }, 120), p = run(aloft({}), { forward: 1 }, 120);
    expect(g.airspeed).toBeLessThan(30);
    expect(p.airspeed).toBeGreaterThan(g.airspeed);
  });

  it('a lever holds the throttle where W left it, and idles only by S', () => {
    const w = aloft({ lever: true });
    run(w, { forward: 1 }, 60);                                  // a second of W: the lever moves
    const set = w.byId.p.throttle;
    expect(set).toBeGreaterThan(0.3);
    run(w, { forward: 0 }, 60);                                  // let go: it stays
    expect(w.byId.p.throttle).toBe(set);
    run(w, { forward: -1 }, 600);                                // S pulls it back to idle
    expect(w.byId.p.throttle).toBe(0);
  });

  it('without gravity a climb costs no speed and a slow craft does not sink', () => {
    const w = aloft({ gravity: false }, 10);                    // under the stall speed, nose up
    w.byId.p.transform.pitch = 0.4;
    const z0 = w.byId.p.transform.pos[2];
    const p = run(w, { forward: 0 }, 60);
    expect(p.transform.pos[2]).toBeGreaterThan(z0);              // no sink, no stall drop
    expect(p.stalled).toBe(false);
  });

  it('without lift there is no stall, and the turn is the craft\'s own rate, not the coordinated law', () => {
    const w = aloft({ lift: false, turnRate: 1, bankMax: 1 }, 10);
    const p = run(w, { forward: 0, turn: 1 }, 120);
    expect(p.stalled).toBe(false);
    expect(Math.abs(p.transform.heading)).toBeGreaterThan(0.5);
  });

  it('assist arcade never stalls: hauling back slow, the nose will not come up and comes down for speed', () => {
    const w = aloft({ assist: 'arcade' }), p = w.byId.p;
    let stalled = false;
    for (let i = 0; i < 1800; i++) { stepWorld(w, { forward: 0, lift: 1 }, DT, flat); if (p.stalled) stalled = true; }
    expect(stalled).toBe(false);
    expect(p.transform.pitch).toBeLessThanOrEqual(0);            // the nose held down, not hauled up
    expect(p.airspeed).toBeGreaterThan(18 * 1.1);               // and the speed kept round the guard
  });

  it('assist sim leaves the bank where it is put; the default and arcade level it, arcade faster', () => {
    const bankAfter = (assist) => { const w = aloft(assist ? { assist } : {}), p = run(w, { forward: 0.6, turn: 1 }, 30); const b0 = p.bank; run(w, { forward: 0.6, turn: 0 }, 30); return [b0, p.bank]; };
    const [s0, s1] = bankAfter('sim'), [d0, d1] = bankAfter(null), [a0, a1] = bankAfter('arcade');
    expect(s1).toBeCloseTo(s0, 6);
    expect(Math.abs(d1)).toBeLessThan(Math.abs(d0));
    expect(Math.abs(a0 - a1)).toBeGreaterThan(Math.abs(d0 - d1));
  });

  it('a space craft still meets the ground it flies into (gravity off); without the dial, gravity off reads none', () => {
    const into = (extra) => { const w = createWorld({ entities: [{ id: 'p', rule: { type: 'fly', mass: 1200, thrust: 7200, stallSpeed: 18, maxSpeed: 80, eye: 0.6, gravity: false, lift: false, pitchMax: 1.2, ...extra }, transform: { pos: [0, 0, 20], heading: 0, pitch: -0.8 } }] }); w.byId.p.airspeed = 30; w.byId.p.airborne = true; return run(w, { forward: 0 }, 120); };
    const s = into({ space: true }), n = into({});
    expect(s.airborne).toBe(false);
    expect(s.transform.pos[2]).toBeCloseTo(0.6, 3);
    expect(n.transform.pos[2]).toBeLessThan(0);
  });

  it('leverStart sets the lever before it is first moved, and the lever holds there', () => {
    const w = aloft({ lever: true, leverStart: 0.5 }), p = run(w, { forward: 0 }, 60);
    expect(p.lever).toBe(0.5);
    expect(p.throttle).toBe(0.5);
  });

  it('every dial absent is the fly rule as it was', () => {
    const script = (i) => ({ forward: 1, lift: i > 200 ? 1 : 0, turn: i > 500 ? 0.6 : 0 });
    const go = (extra) => { const w = plane(extra); for (let i = 0; i < 700; i++) stepWorld(w, script(i), DT, flat); return w.byId.p; };
    const a = go({}), b = go({ engine: undefined, lever: undefined, gravity: undefined, lift: undefined, assist: undefined, leverStart: undefined, space: undefined });
    expect(a.transform.pos).toEqual(b.transform.pos);
  });
});

describe('rule: fly — the bound (the map\'s reach)', () => {
  it('bounded above and below (space), a craft out over the top is turned back down toward the centre', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'fly', mass: 1200, thrust: 7200, stallSpeed: 18, maxSpeed: 80, eye: 0.6, gravity: false, lift: false, pitchMax: 1.2, bound: { hx: 5000, hy: 5000, hz: 200, warn: 0.5 } }, transform: { pos: [0, 0, 260], heading: 0, pitch: 0.3 } }] });
    w.byId.p.airspeed = 40; w.byId.p.airborne = true;
    const p = run(w, { forward: 0.5 }, 240);
    expect(p.outOfBounds === false || p.transform.pitch < 0).toBe(true);
    expect(p.transform.pos[2]).toBeLessThan(260);
  });

  it('warns outside the reach, then turns the craft back toward the centre', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'fly', mass: 1200, thrust: 7200, stallSpeed: 18, maxSpeed: 80, eye: 0.6, bound: { hx: 200, hy: 200, warn: 1 } }, transform: { pos: [190, 0, 400], heading: 0, pitch: 0 } }] });
    w.byId.p.airspeed = 40; w.byId.p.airborne = true;
    let warned = false;
    for (let i = 0; i < 60 * 30; i++) { stepWorld(w, { forward: 0.6 }, DT, flat); if (w.byId.p.outOfBounds) warned = true; }
    const p = w.byId.p;
    expect(warned).toBe(true);
    expect(Math.abs(p.transform.pos[0])).toBeLessThan(260);    // it came back, not off to the east
  });
});
